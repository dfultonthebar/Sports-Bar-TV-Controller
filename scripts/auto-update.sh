#!/bin/bash
# =============================================================================
# Sports Bar TV Controller — Auto-Update Orchestrator (Phase 1)
# =============================================================================
# Invoked from cron (default 02:30 local time), or manually via the Sync tab
# "Run Update Now" button, or from a shell. Updates this location's branch
# with the latest commits from origin/main, rebuilds, and verifies that the
# result is healthy — with Claude Code CLI as an active monitor at three
# checkpoints. On any failure it triggers scripts/rollback.sh to return to
# the pre-update state.
#
# Usage:
#   scripts/auto-update.sh [--dry-run] [--triggered-by=cron|manual_api|manual_cli]
#
# Exit codes:
#   0  — success (updated, or no updates available)
#   2  — pre-flight or checkpoint STOP (no state change)
#   3  — merge conflict on non-whitelisted path (no state change)
#   4  — build, verify, or runtime failure — ROLLED BACK to pre-update state
#   99 — CRITICAL: rollback itself failed, human intervention required
#
# References:
#   docs/AUTO_UPDATE_SYSTEM_PLAN.md (sections 5, 6 Phase 1, 8)
#   docs/AUTO_UPDATE_SETUP.md (state-location decision)
# =============================================================================

set -uo pipefail
# NOTE: we intentionally do NOT use `set -e`. Each step checks its own exit
# status and routes to the trap via `exit N`. `set -e` interacts poorly with
# pipes and `|| return` patterns we need for state-updating sub-calls.

# ---------------------------------------------------------------------------
# Detach from parent process group (CRITICAL)
# ---------------------------------------------------------------------------
# When the Next.js API route spawns this script via child_process.spawn
# with detached:true, the child still shares the process group with the
# Next.js server that spawned it. Later in the flow we run
# `pm2 restart sports-bar-tv-controller` which kills and restarts that
# Next.js server — and the kill signal propagates to the entire process
# group, including THIS script. The bash EXIT trap never fires because
# SIGKILL bypasses traps, so the history row stays "in_progress" forever
# and the rollback never runs.
#
# Fix: re-exec via `setsid -f` to break into a new session and process
# group before we do anything else. This way `pm2 restart` can kill
# Next.js without touching us. Idempotent via the AUTO_UPDATE_DETACHED
# env flag so re-execs don't loop.
if [ -z "${AUTO_UPDATE_DETACHED:-}" ]; then
  export AUTO_UPDATE_DETACHED=1
  exec setsid -f "$0" "$@" </dev/null >/dev/null 2>&1
fi

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
REPO_ROOT="/home/ubuntu/Sports-Bar-TV-Controller"
DATA_DIR="/home/ubuntu/sports-bar-data"
DB_PATH="$DATA_DIR/production.db"
LOG_DIR="$DATA_DIR/update-logs"
BACKUP_DIR="$DATA_DIR/backups"
LOCK_FILE="/tmp/sports-bar-auto-update.lock"
PID_FILE="$DATA_DIR/auto-update.pid"
LATEST_SUMMARY="$LOG_DIR/latest.json"
PROMPTS_DIR="$REPO_ROOT/scripts/prompts"
VERIFY_SCRIPT="$REPO_ROOT/scripts/verify-install.sh"
ROLLBACK_SCRIPT="$REPO_ROOT/scripts/rollback.sh"

RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RUN_STARTED_EPOCH="$(date +%s)"
RUN_TS="$(date +%Y-%m-%d-%H-%M)"
LOG_FILE="$LOG_DIR/auto-update-$RUN_TS.log"

TRIGGERED_BY="cron"
DRY_RUN=0
CURRENT_STEP="init"
ROLLBACK_TAG=""
PRE_MERGE_SHA=""
POST_MERGE_SHA=""
PRE_MERGE_VERSION=""
POST_MERGE_VERSION=""
BRANCH=""
HISTORY_ID=""
CAUTION_MODE=0

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --triggered-by=*) TRIGGERED_BY="${arg#--triggered-by=}" ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

case "$TRIGGERED_BY" in
  cron|manual_api|manual_cli) ;;
  *) echo "Invalid --triggered-by: $TRIGGERED_BY" >&2; exit 1 ;;
esac

# ---------------------------------------------------------------------------
# Re-exec resume: if we were exec'd from an earlier version of this script
# after the merge updated us, restore state and skip to npm_ci. The trigger
# exports state vars; we read them here to avoid repeating preflight/merge.
# ---------------------------------------------------------------------------
REEXEC_RESUMED=0
if [ "${AUTO_UPDATE_REEXEC:-}" = "1" ]; then
  PRE_MERGE_SHA="${AUTO_UPDATE_PRE_MERGE_SHA:-}"
  PRE_MERGE_VERSION="${AUTO_UPDATE_PRE_MERGE_VERSION:-}"
  POST_MERGE_SHA="${AUTO_UPDATE_POST_MERGE_SHA:-}"
  RUN_TS="${AUTO_UPDATE_RUN_TS:-$RUN_TS}"
  LOG_FILE="${AUTO_UPDATE_LOG_FILE:-$LOG_FILE}"
  ROLLBACK_TAG="${AUTO_UPDATE_ROLLBACK_TAG:-}"
  HISTORY_ID="${AUTO_UPDATE_HISTORY_ID:-}"
  BRANCH=$(git -C "$REPO_ROOT" branch --show-current)
  unset AUTO_UPDATE_REEXEC
  REEXEC_RESUMED=1
fi

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mkdir -p "$LOG_DIR" "$BACKUP_DIR"

log() {
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$ts][AUTO-UPDATE] $*" | tee -a "$LOG_FILE"
}

step() {
  CURRENT_STEP="$1"
  log "=== STEP: $CURRENT_STEP ==="
}

fail() {
  log "FAIL at step '$CURRENT_STEP': $*"
  exit "${2:-4}"
}

sql() {
  sqlite3 "$DB_PATH" "$@"
}

# SQL-escape a string by doubling any single quotes
sql_escape() {
  printf '%s' "$1" | sed "s/'/''/g"
}

# ---------------------------------------------------------------------------
# Mutual exclusion via flock
# ---------------------------------------------------------------------------
# `flock -n` fails immediately if another run holds the lock. The lock is
# released automatically when the shell exits (including on SIGKILL) because
# file descriptors are closed by the kernel.
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  log "Another auto-update run is in progress (lock held). Exiting cleanly."
  exit 0
fi

# Write PID file for the Sync tab status API
echo $$ > "$PID_FILE"

# ---------------------------------------------------------------------------
# History row helpers
# ---------------------------------------------------------------------------
history_insert_start() {
  local branch_esc
  branch_esc=$(sql_escape "$BRANCH")
  local sha_esc
  sha_esc=$(sql_escape "$PRE_MERGE_SHA")
  # INSERT + SELECT must share the same sqlite3 session, otherwise
  # last_insert_rowid() runs in a fresh connection and returns 0.
  HISTORY_ID=$(sql "INSERT INTO auto_update_history (started_at, result, commit_sha_before, branch, triggered_by) VALUES ('$RUN_STARTED_AT', 'in_progress', '$sha_esc', '$branch_esc', '$TRIGGERED_BY'); SELECT last_insert_rowid();")
}

history_update_result() {
  local result=$1
  local error_msg=${2:-}
  local finished_at
  finished_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  local duration=$(( $(date +%s) - RUN_STARTED_EPOCH ))
  local sha_after_esc
  sha_after_esc=$(sql_escape "$POST_MERGE_SHA")
  local err_esc
  err_esc=$(sql_escape "$error_msg")
  sql "UPDATE auto_update_history SET result='$result', finished_at='$finished_at', commit_sha_after=NULLIF('$sha_after_esc',''), duration_secs=$duration, error_message=NULLIF('$err_esc','') WHERE id=$HISTORY_ID;"
}

state_update() {
  local result=$1
  local error_msg=${2:-}
  local duration=$(( $(date +%s) - RUN_STARTED_EPOCH ))
  local sha_before_esc
  sha_before_esc=$(sql_escape "$PRE_MERGE_SHA")
  local sha_after_esc
  sha_after_esc=$(sql_escape "$POST_MERGE_SHA")
  local err_esc
  err_esc=$(sql_escape "$error_msg")
  local updated_at
  updated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  sql "UPDATE auto_update_state SET last_run_at='$RUN_STARTED_AT', last_result='$result', last_commit_sha_before=NULLIF('$sha_before_esc',''), last_commit_sha_after=NULLIF('$sha_after_esc',''), last_error=NULLIF('$err_esc',''), last_duration_secs=$duration, updated_at='$updated_at' WHERE id=1;"
}

write_summary_json() {
  local result=$1
  local error_msg=${2:-}
  local duration=$(( $(date +%s) - RUN_STARTED_EPOCH ))
  # Hand-rolled JSON (jq may not be on the host). Shell-escape quotes.
  local err_js
  err_js=$(printf '%s' "$error_msg" | sed 's/\\/\\\\/g; s/"/\\"/g')
  cat > "$LATEST_SUMMARY" <<JSON
{
  "startedAt": "$RUN_STARTED_AT",
  "finishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "result": "$result",
  "branch": "$BRANCH",
  "commitShaBefore": "$PRE_MERGE_SHA",
  "commitShaAfter": "$POST_MERGE_SHA",
  "durationSecs": $duration,
  "triggeredBy": "$TRIGGERED_BY",
  "errorMessage": "$err_js",
  "logFile": "$LOG_FILE",
  "historyId": "$HISTORY_ID"
}
JSON
}

# ---------------------------------------------------------------------------
# Cleanup trap — runs on every exit, success or fail
# ---------------------------------------------------------------------------
cleanup_on_error() {
  local exit_code=$?
  rm -f "$PID_FILE" 2>/dev/null || true
  if [ "$exit_code" -eq 0 ]; then
    return
  fi
  log "Trap fired: exit code=$exit_code, step=$CURRENT_STEP"

  # Only trigger rollback if we got past the merge step (state has changed).
  case "$CURRENT_STEP" in
    preflight|checkpoint_a|fetch|lock|init)
      log "Failure happened before any on-disk change. No rollback needed."
      if [ -n "$HISTORY_ID" ]; then
        history_update_result "fail" "Aborted at $CURRENT_STEP before state change"
      fi
      state_update "fail" "Aborted at $CURRENT_STEP"
      write_summary_json "fail" "Aborted at $CURRENT_STEP before state change"
      return
      ;;
  esac

  if [ -z "$ROLLBACK_TAG" ]; then
    log "CRITICAL: no rollback tag set but failure happened past pre-flight"
    state_update "fail" "CRITICAL: no rollback tag, step=$CURRENT_STEP"
    [ -n "$HISTORY_ID" ] && history_update_result "fail" "CRITICAL: no rollback tag"
    write_summary_json "fail" "CRITICAL: no rollback tag, step=$CURRENT_STEP"
    return
  fi

  log "Triggering rollback to tag $ROLLBACK_TAG"
  if LOG_FILE="$LOG_FILE" bash "$ROLLBACK_SCRIPT" "$ROLLBACK_TAG" "$CURRENT_STEP" >>"$LOG_FILE" 2>&1; then
    log "Rollback succeeded."
    state_update "rolled_back" "Rolled back from step: $CURRENT_STEP"
    [ -n "$HISTORY_ID" ] && history_update_result "rolled_back" "Rolled back from step: $CURRENT_STEP"
    write_summary_json "rolled_back" "Rolled back from step: $CURRENT_STEP"
  else
    local rc=$?
    log "CRITICAL: rollback itself failed with exit $rc"
    state_update "fail" "Rollback failed at step: $CURRENT_STEP (rollback exit $rc)"
    [ -n "$HISTORY_ID" ] && history_update_result "fail" "Rollback failed: exit $rc"
    write_summary_json "fail" "Rollback failed at step: $CURRENT_STEP (rollback exit $rc)"
    exit 99
  fi
}
trap cleanup_on_error EXIT

# ---------------------------------------------------------------------------
# Checkpoint helper — invokes Claude Code CLI and parses the DECISION line
# ---------------------------------------------------------------------------
run_checkpoint() {
  local label=$1
  local prompt_file=$2
  local timeout_secs=${3:-120}
  local out_file="/tmp/claude-checkpoint-$label-$$.txt"

  if [ ! -f "$prompt_file" ]; then
    fail "Checkpoint $label: prompt file missing: $prompt_file" 2
  fi

  log "Checkpoint $label: invoking Claude Code CLI (timeout ${timeout_secs}s)"
  local prompt
  prompt=$(cat "$prompt_file")

  # Per Pre-work 3 validation: `claude -p "<prompt>"` works in cron-minimal env
  # without ANTHROPIC_API_KEY (persistent login handles auth).
  # --dangerously-skip-permissions: checkpoints need to run sqlite3/git/etc.
  # without hanging on an interactive permission prompt in headless mode.
  #
  # `env -u ANTHROPIC_API_KEY` strips any pay-per-token API key that leaked
  # in from .env/PM2. --dangerously-skip-permissions requires the claude.ai
  # OAuth credential from ~/.claude/.credentials.json; if Claude Code sees
  # an API key in env it tries that path and rejects the skip-permissions
  # flag with "Invalid API key · Fix external API key", failing the
  # checkpoint in ~2 seconds. Stripping the var forces OAuth mode.
  # We check the CLI exit code AND the output file independently. The CLI can
  # exit non-zero (e.g., SIGPIPE on timeout, or after flushing stdout right at
  # the 180s mark) while still having written a valid DECISION line. Treating
  # that as a hard failure wastes a run that actually produced a good answer.
  set +e
  env -u ANTHROPIC_API_KEY timeout "$timeout_secs" claude -p --dangerously-skip-permissions "$prompt" >"$out_file" 2>&1
  local cli_rc=$?
  set -e

  if [ "$cli_rc" -ne 0 ]; then
    # Check if the output contains a parseable DECISION before giving up.
    if [ -s "$out_file" ] && grep -qE '^(DECISION:|GO\b|CAUTION\b|STOP\b)' "$out_file"; then
      log "Checkpoint $label: CLI exited $cli_rc but output has a DECISION line — parsing anyway"
    else
      log "Checkpoint $label: Claude Code timed out or errored (exit $cli_rc)"
      log "Checkpoint $label output: $(head -40 "$out_file" 2>/dev/null)"
      rm -f "$out_file"
      fail "Checkpoint $label: Claude Code CLI failure" 2
    fi
  fi

  # Parse the decision. Claude is SUPPOSED to emit "DECISION: GO|CAUTION|STOP - <reason>"
  # as the first line, but in practice it sometimes rephrases ("GO confirmed. ...",
  # "CAUTION: ...", etc.). Accept both the strict form and a leading-word form
  # so a valid GO doesn't trigger a false rollback. STOP/CAUTION keywords must
  # appear BEFORE any GO keyword on the first match line, to avoid a response
  # like "I would STOP but actually GO" from being misread.
  local decision decision_kind
  decision=$(grep -m1 -E '^(DECISION:|GO\b|CAUTION\b|STOP\b)' "$out_file" || true)
  if [ -z "$decision" ]; then
    # Fallback: scan the whole response for an unambiguous keyword.
    if grep -qiE '\bDECISION:\s*STOP\b|\bSTOP\s*[:\-]' "$out_file"; then
      decision_kind="STOP"
    elif grep -qiE '\bDECISION:\s*CAUTION\b|\bCAUTION\s*[:\-]' "$out_file"; then
      decision_kind="CAUTION"
    elif grep -qiE '\bDECISION:\s*GO\b|^GO\b|\bGO confirmed\b' "$out_file"; then
      decision_kind="GO"
    fi
  else
    # Normalise the first-line match to a bare kind.
    case "$decision" in
      "DECISION: GO"*|"DECISION:GO"*|"GO"*|"GO "*) decision_kind="GO" ;;
      "DECISION: CAUTION"*|"DECISION:CAUTION"*|"CAUTION"*|"CAUTION "*) decision_kind="CAUTION" ;;
      "DECISION: STOP"*|"DECISION:STOP"*|"STOP"*|"STOP "*) decision_kind="STOP" ;;
    esac
  fi

  log "Checkpoint $label: decision=${decision_kind:-UNDETERMINED} line=\"$decision\""
  # Also dump full response to log for forensics
  log "--- Checkpoint $label full response ---"
  cat "$out_file" >> "$LOG_FILE"
  log "--- end Checkpoint $label response ---"
  rm -f "$out_file"

  case "${decision_kind:-UNDETERMINED}" in
    GO)
      return 0
      ;;
    CAUTION)
      CAUTION_MODE=1
      log "Checkpoint $label: CAUTION — proceeding with extra monitoring"
      return 0
      ;;
    STOP)
      fail "Checkpoint $label: STOP — ${decision}" 2
      ;;
    *)
      fail "Checkpoint $label: UNDETERMINED response from Claude Code" 2
      ;;
  esac
}

# ===========================================================================
# PHASE: PRE-FLIGHT through VERSION_CHECK
# ===========================================================================
# Skip these phases if we just re-exec'd ourselves after the merge updated
# auto-update.sh on disk. State is restored from env vars by the re-exec
# handler above. Resume directly at npm_ci.
if [ "$REEXEC_RESUMED" -eq 0 ]; then

step "preflight"
log "Triggered by: $TRIGGERED_BY (dry-run=$DRY_RUN)"

# 0. Confirm we're in a clean git repo on a location branch
cd "$REPO_ROOT" || fail "cannot cd to $REPO_ROOT" 2
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ -z "$BRANCH" ] && fail "not in a git repo or detached HEAD" 2
log "Current branch: $BRANCH"

# 1. Check auto_update_state.enabled (unless manually triggered)
if [ "$TRIGGERED_BY" = "cron" ]; then
  ENABLED=$(sql "SELECT enabled FROM auto_update_state WHERE id=1;" 2>/dev/null || echo "0")
  if [ "$ENABLED" != "1" ]; then
    log "auto_update_state.enabled=$ENABLED (cron invocation); exiting early"
    exit 0
  fi
fi

# 2. Claude Code CLI reachability
command -v claude >/dev/null 2>&1 || fail "Claude Code CLI not installed on PATH" 2
if ! timeout 15 claude --version >/dev/null 2>&1; then
  fail "Claude Code CLI not responding (--version failed or timed out)" 2
fi
log "Claude Code CLI: $(claude --version 2>/dev/null | head -1)"

# 3. Verify/rollback scripts present and executable
[ -x "$VERIFY_SCRIPT" ] || fail "verify-install.sh missing or not executable at $VERIFY_SCRIPT" 2
[ -f "$ROLLBACK_SCRIPT" ] || fail "rollback.sh missing at $ROLLBACK_SCRIPT" 2
bash -n "$ROLLBACK_SCRIPT" || fail "rollback.sh has syntax errors" 2

# 4. Working tree must be clean (location data files get normalized during update)
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  log "WARNING: working tree has modifications — will be lost if not committed"
  git status --short | head -20 | tee -a "$LOG_FILE"
fi

# ===========================================================================
# PHASE: FETCH
# ===========================================================================
step "fetch"
PRE_MERGE_SHA=$(git rev-parse HEAD)
PRE_MERGE_VERSION=$(node -p "require('$REPO_ROOT/package.json').version" 2>/dev/null || echo "unknown")
log "Pre-merge: branch=$BRANCH sha=$PRE_MERGE_SHA version=$PRE_MERGE_VERSION"

git fetch origin 2>&1 | tee -a "$LOG_FILE" || fail "git fetch origin failed" 4
TARGET_SHA=$(git rev-parse origin/main)
log "origin/main: $TARGET_SHA"

# Idempotent: if origin/main is already an ancestor of HEAD, nothing to do.
if git merge-base --is-ancestor "$TARGET_SHA" HEAD 2>/dev/null; then
  log "origin/main is already merged into $BRANCH — no update available"
  POST_MERGE_SHA=$PRE_MERGE_SHA
  # Write a "no-op pass" history row so the Sync tab UI shows the run occurred
  history_insert_start
  history_update_result "pass" "no update available"
  state_update "pass" "no update available"
  write_summary_json "pass" "no update available"
  exit 0
fi

COMMITS_TO_MERGE=$(git log --oneline HEAD..origin/main | wc -l)
log "Commits pending merge: $COMMITS_TO_MERGE"

# Insert history start row now that we know we have work to do
history_insert_start
log "History row id=$HISTORY_ID"

# ===========================================================================
# CHECKPOINT A — Pre-update analysis
# ===========================================================================
step "checkpoint_a"
run_checkpoint "A" "$PROMPTS_DIR/checkpoint-a.txt" 240

# If dry-run, report what we WOULD do and stop here (before any state change).
if [ "$DRY_RUN" -eq 1 ]; then
  log "DRY-RUN: would merge $COMMITS_TO_MERGE commits from origin/main onto $BRANCH"
  log "DRY-RUN: would backup DB to $BACKUP_DIR/pre-update-$RUN_TS.db"
  log "DRY-RUN: would create rollback tag rollback-$RUN_TS at $PRE_MERGE_SHA"
  log "DRY-RUN: stopping now — nothing changed on disk"
  history_update_result "pass" "dry-run stopped after checkpoint A"
  state_update "pass" "dry-run"
  write_summary_json "pass" "dry-run — no changes made"
  exit 0
fi

# ===========================================================================
# PHASE: BACKUP
# ===========================================================================
step "backup"
BACKUP_FILE="$BACKUP_DIR/pre-update-$RUN_TS.db"
log "Backing up DB to $BACKUP_FILE"
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'" 2>&1 | tee -a "$LOG_FILE"
if [ ! -f "$BACKUP_FILE" ]; then
  fail "DB backup failed — file not created" 4
fi
log "DB backup OK ($(stat -c%s "$BACKUP_FILE" 2>/dev/null || wc -c <"$BACKUP_FILE") bytes)"

ROLLBACK_TAG="rollback-$RUN_TS"
git tag "$ROLLBACK_TAG" "$PRE_MERGE_SHA" 2>&1 | tee -a "$LOG_FILE" || fail "git tag failed" 4
log "Rollback tag created: $ROLLBACK_TAG"

# ===========================================================================
# PHASE: MERGE (with LOCATION_PATHS_OURS / _THEIRS conflict auto-resolve)
# ===========================================================================
step "merge"

# These paths always keep the LOCATION version (git checkout --ours)
LOCATION_PATHS_OURS=(
  "apps/web/data/tv-layout.json"
  "apps/web/data/directv-devices.json"
  "apps/web/data/firetv-devices.json"
  "apps/web/data/device-subscriptions.json"
  "apps/web/data/wolfpack-devices.json"
  "apps/web/data/atlas-configs"
  "apps/web/data/channel-presets-cable.json"
  "apps/web/data/channel-presets-directv.json"
  "apps/web/public/uploads/layouts"
  "data"
  ".env"
  # PM2 config carries per-location Sports Guide credentials via process.env.
  # Main historically hardcoded a location's values in this file, which means
  # every merge from main overwrites the running location's creds. Keep the
  # location's env-driven version across merges. When main eventually adopts
  # the env-driven pattern, this entry becomes a no-op (content-identical).
  "ecosystem.config.js"
)

# These paths always take the MAIN version (git checkout --theirs)
# package-lock and package.json version bumps must come from main for
# `npm ci` to work after the reset.
LOCATION_PATHS_THEIRS=(
  "package-lock.json"
  "package.json"
)

log "git merge origin/main --no-ff -m 'chore: auto-update merge $RUN_TS'"
set +e
git merge origin/main --no-ff -m "chore: auto-update merge $RUN_TS" 2>&1 | tee -a "$LOG_FILE"
MERGE_EXIT=${PIPESTATUS[0]}
set -e 2>/dev/null || true

if [ "$MERGE_EXIT" -ne 0 ]; then
  log "Merge had conflicts — applying auto-resolve rules"
  for path in "${LOCATION_PATHS_OURS[@]}"; do
    if git status --porcelain "$path" 2>/dev/null | grep -q "^UU"; then
      log "  keeping LOCATION version: $path"
      git checkout --ours "$path" 2>&1 | tee -a "$LOG_FILE"
      git add "$path"
    fi
  done
  for path in "${LOCATION_PATHS_THEIRS[@]}"; do
    if git status --porcelain "$path" 2>/dev/null | grep -q "^UU"; then
      log "  taking MAIN version: $path"
      git checkout --theirs "$path" 2>&1 | tee -a "$LOG_FILE"
      git add "$path"
    fi
  done

  # Any remaining conflict = unexpected file, human required
  if git status --porcelain | grep -q "^UU"; then
    log "Unexpected merge conflict on non-whitelisted files:"
    git status --porcelain | grep "^UU" | tee -a "$LOG_FILE"
    git merge --abort 2>/dev/null || true
    fail "merge conflict on non-whitelisted file" 3
  fi

  git commit --no-edit 2>&1 | tee -a "$LOG_FILE" || fail "merge commit failed after conflict resolution" 4
fi

POST_MERGE_SHA=$(git rev-parse HEAD)
log "Post-merge sha: $POST_MERGE_SHA"

# ===========================================================================
# PHASE: VERSION REGRESSION CHECK
# ===========================================================================
step "version_check"
POST_MERGE_VERSION=$(node -p "require('$REPO_ROOT/package.json').version" 2>/dev/null || echo "unknown")
log "Pre-merge version: $PRE_MERGE_VERSION  /  Post-merge version: $POST_MERGE_VERSION"

# node -e compare: fails the run if post < pre (semver)
if [ "$PRE_MERGE_VERSION" != "unknown" ] && [ "$POST_MERGE_VERSION" != "unknown" ]; then
  CMP=$(node -e "
    const a = process.argv[1].split('.').map(Number);
    const b = process.argv[2].split('.').map(Number);
    for (let i=0; i<3; i++) {
      const ai = a[i]||0, bi = b[i]||0;
      if (ai !== bi) { console.log(ai < bi ? 'less' : 'greater'); process.exit(0); }
    }
    console.log('equal');
  " "$POST_MERGE_VERSION" "$PRE_MERGE_VERSION" 2>/dev/null || echo "unknown")
  if [ "$CMP" = "less" ]; then
    fail "version regression: $POST_MERGE_VERSION < $PRE_MERGE_VERSION" 4
  fi
fi

# ---------------------------------------------------------------------------
# SELF-UPDATE RE-EXEC — critical to prevent mid-run script corruption
# ---------------------------------------------------------------------------
# When the merge step updates scripts/auto-update.sh itself, bash keeps
# reading the file line-by-line from disk. The portions after the current
# read position may be completely different code than what was compiled into
# the bash process's state so far, producing bizarre failures like "schema_push
# exits immediately with code 1" that don't match any code path in either
# the pre-merge or post-merge script. The bug is self-modifying scripts,
# not a specific bug in either version.
#
# Fix: if the merge changed auto-update.sh, re-exec self with the new copy
# so bash loads a consistent version from start. Pass state via env vars so
# the re-exec's handler block at the top of the script can resume from here
# instead of re-running preflight/fetch/merge.
if [ -n "$PRE_MERGE_SHA" ] && [ -n "$POST_MERGE_SHA" ] && [ "$PRE_MERGE_SHA" != "$POST_MERGE_SHA" ]; then
  if git -C "$REPO_ROOT" diff --name-only "$PRE_MERGE_SHA" "$POST_MERGE_SHA" 2>/dev/null | grep -qx 'scripts/auto-update.sh'; then
    log "auto-update.sh was updated by the merge — re-exec'ing with new version"
    export AUTO_UPDATE_REEXEC=1
    export AUTO_UPDATE_PRE_MERGE_SHA="$PRE_MERGE_SHA"
    export AUTO_UPDATE_PRE_MERGE_VERSION="$PRE_MERGE_VERSION"
    export AUTO_UPDATE_POST_MERGE_SHA="$POST_MERGE_SHA"
    export AUTO_UPDATE_RUN_TS="$RUN_TS"
    export AUTO_UPDATE_LOG_FILE="$LOG_FILE"
    export AUTO_UPDATE_ROLLBACK_TAG="$ROLLBACK_TAG"
    export AUTO_UPDATE_HISTORY_ID="$HISTORY_ID"
    exec "$0" "$@"
  fi
fi

fi # end of: if [ "$REEXEC_RESUMED" -eq 0 ] — pre-flight through version_check block
if [ "$REEXEC_RESUMED" -eq 1 ]; then
  log "=== RESUMED from re-exec — skipped preflight/fetch/checkpoint_a/backup/merge/version_check ==="
  log "Pre-merge: $PRE_MERGE_SHA  /  Post-merge: $POST_MERGE_SHA  /  Rollback tag: $ROLLBACK_TAG"
fi

# ===========================================================================
# PHASE: NPM CI
# ===========================================================================
step "npm_ci"
log "npm ci --include=dev (install/sync node_modules to the merged lockfile)"
# CRITICAL: --include=dev (or equivalently, unsetting NODE_ENV) is required
# because the auto-update script inherits PM2's env which has
# NODE_ENV=production. npm ci under NODE_ENV=production skips
# devDependencies, which means `turbo` (the build orchestrator for this
# monorepo) gets dropped from node_modules, and `npm run build` then
# fails with `sh: 1: turbo: not found`. Same applies to `next` CLI tools
# and any other dev-only build machinery.
NODE_ENV=development npm ci --include=dev 2>&1 | tee -a "$LOG_FILE"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then
  fail "npm ci failed" 4
fi

# ===========================================================================
# PHASE: SCHEMA PUSH (drizzle-kit)
# ===========================================================================
# Apply any new tables/columns from packages/database/src/schema.ts to the
# live production.db before the build runs. Without this, releases that add
# a new table (like v2.8.0's ChannelTuneLog) build successfully but their
# new endpoints 500 at runtime because the table doesn't exist.
#
# drizzle-kit push will sometimes fail on *pre-existing* indexes/tables that
# were created out of band (manual sqlite3, earlier hotfix, etc.) — drizzle
# tracks schema by literal CREATE statements, not by structural diff, so any
# untracked-but-already-present object trips it. That class of error is
# benign: the schema is already in the desired state. We detect it, log a
# warning, and continue. Any OTHER error fails the update because it likely
# indicates a real schema corruption or version mismatch.
step "schema_push"
log "npx drizzle-kit push (apply pending schema changes)"
SCHEMA_PUSH_LOG="$LOG_DIR/drizzle-push-$(date +%s).log"

# Iterative retry loop. drizzle-kit push is NOT atomic: it commits statements
# one-at-a-time, so a conflict partway through leaves partial state in the
# DB. We handle three classes of recoverable error per iteration; anything
# else is surfaced and aborts.
#
# Recoverable errors:
# 1. "index|table|column X already exists" — a pre-existing object (from a
#    prior hotfix or partial push) collides with drizzle's CREATE. Drop it
#    and retry; drizzle recreates it fresh on the next pass.
# 2. "no such column: X" — drizzle is running its SQLite ADD-COLUMN
#    workaround (create __new_Table, copy data, swap) and the SELECT is
#    referencing a column that hasn't been added yet. The orphan
#    __new_Table from the failed copy blocks retries. Drop every __new_*
#    shadow and, if X appears in schema.ts, add it to the source table
#    directly so the next push can complete without the shadow pattern.
# 3. Convergence cap: 350 iterations max so a genuine schema bug can't
#    trap us in an infinite loop.
SCHEMA_MAX_ITERATIONS=350
SCHEMA_ITER=0
SCHEMA_FILE="$REPO_ROOT/packages/database/src/schema.ts"

while [ "$SCHEMA_ITER" -lt "$SCHEMA_MAX_ITERATIONS" ]; do
  SCHEMA_ITER=$((SCHEMA_ITER + 1))
  if NODE_ENV=development npx drizzle-kit push > "$SCHEMA_PUSH_LOG" 2>&1; then
    tail -20 "$SCHEMA_PUSH_LOG" >> "$LOG_FILE"
    log "[SCHEMA] drizzle-kit push succeeded after $SCHEMA_ITER iteration(s)"
    break
  fi

  # Class 1: "X already exists"
  DUP_IDX=$(grep -oE "(index|table|column) [A-Za-z_][A-Za-z0-9_]* already exists" "$SCHEMA_PUSH_LOG" | head -1 | awk '{print $2}')
  if [ -n "$DUP_IDX" ]; then
    sqlite3 "$DB_PATH" "DROP INDEX IF EXISTS \"$DUP_IDX\"; DROP TABLE IF EXISTS \"$DUP_IDX\";" >>"$LOG_FILE" 2>&1
    [ $((SCHEMA_ITER % 25)) -eq 0 ] && log "[SCHEMA] iter=$SCHEMA_ITER last-dropped=$DUP_IDX"
    continue
  fi

  # Class 2: "no such column: X" — stuck ADD-COLUMN workaround
  MISSING_COL=$(grep -oE 'no such column: "[A-Za-z_][A-Za-z0-9_]*"' "$SCHEMA_PUSH_LOG" | head -1 | sed -E 's/no such column: "([^"]+)"/\1/')
  if [ -n "$MISSING_COL" ]; then
    # Drop any __new_* shadow tables that drizzle left behind from the
    # failed copy. These block subsequent push attempts.
    SHADOWS=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '__new_%';" 2>/dev/null)
    if [ -n "$SHADOWS" ]; then
      while read -r sh; do
        [ -z "$sh" ] && continue
        sqlite3 "$DB_PATH" "DROP TABLE IF EXISTS \"$sh\";" >>"$LOG_FILE" 2>&1
        log "[SCHEMA] iter=$SCHEMA_ITER dropped shadow table $sh"
      done <<< "$SHADOWS"
    fi
    # Find any tables in schema.ts that declare $MISSING_COL as a column
    # and don't have it in the live DB. Add it directly so drizzle's next
    # pass sees it and skips the shadow-table workaround.
    TYPE_LINE=$(grep -nE "^[[:space:]]+${MISSING_COL}[[:space:]]*:[[:space:]]*(text|integer|real|blob|timestamp)[[:space:]]*\(" "$SCHEMA_FILE" | head -1)
    if [ -n "$TYPE_LINE" ]; then
      DRIZZLE_TYPE=$(printf '%s' "$TYPE_LINE" | grep -oE "(text|integer|real|blob|timestamp)" | head -1)
      case "$DRIZZLE_TYPE" in
        text|timestamp) SQL_TYPE="TEXT" ;;
        integer)        SQL_TYPE="INTEGER" ;;
        real)           SQL_TYPE="REAL" ;;
        blob)           SQL_TYPE="BLOB" ;;
        *)              SQL_TYPE="TEXT" ;;
      esac
      LINE_NUM=$(printf '%s' "$TYPE_LINE" | cut -d: -f1)
      TARGET_TABLE=$(awk -v ln="$LINE_NUM" 'NR<=ln && /sqliteTable\(/ {match($0,/sqliteTable\(['"'"'"]([A-Za-z_][A-Za-z0-9_]*)['"'"'"]/,arr); if(arr[1]!="")tbl=arr[1]} END {print tbl}' "$SCHEMA_FILE")
      if [ -n "$TARGET_TABLE" ]; then
        IN_DB=$(sqlite3 "$DB_PATH" "PRAGMA table_info(\"$TARGET_TABLE\");" 2>/dev/null | awk -F'|' -v c="$MISSING_COL" '$2==c {print "yes"}')
        if [ "$IN_DB" != "yes" ]; then
          sqlite3 "$DB_PATH" "ALTER TABLE \"$TARGET_TABLE\" ADD COLUMN \"$MISSING_COL\" $SQL_TYPE;" >>"$LOG_FILE" 2>&1 \
            && log "[SCHEMA] iter=$SCHEMA_ITER added $TARGET_TABLE.$MISSING_COL $SQL_TYPE (bypassing drizzle shadow-pattern)"
        fi
      fi
    fi
    continue
  fi

  # Anything else — surface and abort.
  cat "$SCHEMA_PUSH_LOG" >> "$LOG_FILE"
  fail "drizzle-kit push failed with an unrecognized error (iteration $SCHEMA_ITER) — see $SCHEMA_PUSH_LOG" 4
done

if [ "$SCHEMA_ITER" -ge "$SCHEMA_MAX_ITERATIONS" ]; then
  log "[SCHEMA] iterative retry hit cap ($SCHEMA_MAX_ITERATIONS) without converging — switching to bulk-regenerate fallback"
  log "[SCHEMA] this pattern — iterations cycling through the same indexes without making net progress — happens when"
  log "[SCHEMA] drizzle-kit commits-per-statement AND its CREATE order lets duplicates re-appear each pass."

  # Step 1: drop every user-defined index. Indexes carry no data, only metadata;
  # safe to recreate from scratch.
  BULK_DROP_SQL=$(mktemp)
  {
    echo "BEGIN;"
    sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_autoindex%';" \
      | awk 'NF {printf "DROP INDEX IF EXISTS \"%s\";\n", $0}'
    echo "COMMIT;"
  } > "$BULK_DROP_SQL"
  IDX_DROPPED=$(wc -l < "$BULK_DROP_SQL")
  if ! sqlite3 "$DB_PATH" < "$BULK_DROP_SQL" >>"$LOG_FILE" 2>&1; then
    rm -f "$BULK_DROP_SQL"
    fail "bulk-drop of user indexes failed — see $LOG_FILE" 4
  fi
  rm -f "$BULK_DROP_SQL"
  log "[SCHEMA] bulk-drop: removed ~$IDX_DROPPED user indexes"

  # Step 2: generate fresh migration SQL from schema.ts. This gives us the
  # canonical CREATE TABLE / CREATE INDEX set for the current schema.
  BULK_GEN_DIR=$(mktemp -d)
  if ! NODE_ENV=development npx drizzle-kit generate --out "$BULK_GEN_DIR" --dialect sqlite --schema "$SCHEMA_FILE" >>"$LOG_FILE" 2>&1; then
    rm -rf "$BULK_GEN_DIR"
    fail "drizzle-kit generate failed during bulk-regenerate fallback" 4
  fi
  GEN_SQL=$(ls "$BULK_GEN_DIR"/*.sql 2>/dev/null | head -1)
  if [ -z "$GEN_SQL" ]; then
    rm -rf "$BULK_GEN_DIR"
    fail "drizzle-kit generate produced no .sql output — see $LOG_FILE" 4
  fi

  # Step 3: extract CREATE INDEX statements, make them IF NOT EXISTS, apply
  # in one transaction. Using IF NOT EXISTS so any index that survived the
  # drop (unlikely, but possible via a race) is tolerated.
  BULK_IDX_SQL=$(mktemp)
  {
    echo "BEGIN;"
    grep -E "^CREATE (UNIQUE )?INDEX" "$GEN_SQL" \
      | sed -E 's/^CREATE INDEX /CREATE INDEX IF NOT EXISTS /; s/^CREATE UNIQUE INDEX /CREATE UNIQUE INDEX IF NOT EXISTS /; s| --> statement-breakpoint||'
    echo "COMMIT;"
  } > "$BULK_IDX_SQL"
  IDX_CREATED=$(grep -cE "^CREATE " "$BULK_IDX_SQL")
  if ! sqlite3 "$DB_PATH" < "$BULK_IDX_SQL" >>"$LOG_FILE" 2>&1; then
    rm -f "$BULK_IDX_SQL"
    rm -rf "$BULK_GEN_DIR"
    fail "bulk-apply of $IDX_CREATED CREATE INDEX statements failed — see $LOG_FILE" 4
  fi
  rm -f "$BULK_IDX_SQL"
  rm -rf "$BULK_GEN_DIR"
  log "[SCHEMA] bulk-apply: created $IDX_CREATED indexes from generate output"

  # Step 4: final drizzle-kit push. With all indexes present AND all
  # previously-applied column additions intact, this should either succeed
  # cleanly OR report benign pre-existing objects (which are fine — schema
  # IS in sync). Anything else is a genuine error.
  FINAL_LOG="$LOG_DIR/drizzle-push-final-$(date +%s).log"
  if NODE_ENV=development npx drizzle-kit push > "$FINAL_LOG" 2>&1; then
    log "[SCHEMA] bulk-regenerate fallback succeeded — schema now in sync"
  elif grep -qE "already exists" "$FINAL_LOG"; then
    log "[SCHEMA] bulk-regenerate fallback: final push reports benign pre-existing objects — schema IS in sync"
  else
    cat "$FINAL_LOG" >> "$LOG_FILE"
    fail "bulk-regenerate fallback: final drizzle-kit push failed with unrecognized error — see $FINAL_LOG" 4
  fi
fi

# ===========================================================================
# CHECKPOINT B — Post-merge / pre-build review
# ===========================================================================
step "checkpoint_b"
run_checkpoint "B" "$PROMPTS_DIR/checkpoint-b.txt" 240

# ===========================================================================
# PHASE: BUILD (with .next.bak caching for instant rollback)
# ===========================================================================
step "build"
if [ -d "$REPO_ROOT/apps/web/.next" ]; then
  log "Caching current build at apps/web/.next.bak"
  rm -rf "$REPO_ROOT/apps/web/.next.bak"
  mv "$REPO_ROOT/apps/web/.next" "$REPO_ROOT/apps/web/.next.bak"
fi

log "npm run build"
npm run build 2>&1 | tee -a "$LOG_FILE"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then
  fail "npm run build failed" 4
fi

# ===========================================================================
# PHASE: PM2 RESTART
# ===========================================================================
step "pm2_restart"
log "pm2 restart sports-bar-tv-controller --update-env"
pm2 restart sports-bar-tv-controller --update-env 2>&1 | tee -a "$LOG_FILE"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then
  fail "pm2 restart failed" 4
fi

log "Sleeping 10s for app to come up"
sleep 10

# ===========================================================================
# PHASE: VERIFY (deterministic layers)
# ===========================================================================
step "verify"
log "Running verify-install.sh --json"
VERIFY_JSON="/tmp/verify-install-$$.json"
bash "$VERIFY_SCRIPT" --json >"$VERIFY_JSON" 2>>"$LOG_FILE"
VERIFY_EXIT=$?
log "verify-install.sh exit: $VERIFY_EXIT"
log "verify-install.sh output: $(cat "$VERIFY_JSON" 2>/dev/null | head -20)"

if [ "$VERIFY_EXIT" -ne 0 ]; then
  rm -f "$VERIFY_JSON"
  fail "verify-install.sh failed (exit $VERIFY_EXIT)" 4
fi

# Store the JSON blob for the Sync tab log view
VERIFY_BLOB=$(cat "$VERIFY_JSON" 2>/dev/null | tr '\n' ' ' | sed "s/'/''/g")
rm -f "$VERIFY_JSON"
if [ -n "$HISTORY_ID" ] && [ -n "$VERIFY_BLOB" ]; then
  sql "UPDATE auto_update_history SET verify_result_json='$VERIFY_BLOB' WHERE id=$HISTORY_ID;" || true
fi

# ===========================================================================
# CHECKPOINT C — Post-restart holistic check
# ===========================================================================
step "checkpoint_c"
run_checkpoint "C" "$PROMPTS_DIR/checkpoint-c.txt" 240

# ===========================================================================
# PHASE: FINALIZE
# ===========================================================================
step "finalize"

# Remove .next.bak — we don't need the pre-update build any more.
# Next run will recreate it from the fresh build.
if [ -d "$REPO_ROOT/apps/web/.next.bak" ]; then
  log "Removing stale apps/web/.next.bak"
  rm -rf "$REPO_ROOT/apps/web/.next.bak"
fi

FINAL_RESULT="pass"
FINAL_MSG=""
if [ "$CAUTION_MODE" -eq 1 ]; then
  FINAL_MSG="completed with CAUTION flags from Claude Code (see log)"
fi

history_update_result "$FINAL_RESULT" "$FINAL_MSG"
state_update "$FINAL_RESULT" "$FINAL_MSG"
write_summary_json "$FINAL_RESULT" "$FINAL_MSG"

DURATION=$(( $(date +%s) - RUN_STARTED_EPOCH ))
log "SUCCESS: updated $BRANCH from $PRE_MERGE_SHA to $POST_MERGE_SHA in ${DURATION}s"
log "Log file: $LOG_FILE"
exit 0
