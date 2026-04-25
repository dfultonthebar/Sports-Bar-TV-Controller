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

# v2.32.27 — Source nvm if present so npm/node are on PATH for cron + setsid
# subshells. Hosts that installed Node via nvm (Leg Lamp) didn't have npm on
# the default PATH; the build phase exited 127 with "npm: command not found"
# and the rollback phase couldn't run npm ci to realign node_modules.
# Hosts using the apt npm at /usr/bin/npm are unaffected by this source.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" --no-use 2>/dev/null
  # Activate the default nvm alias if one is set; falls through silently if not.
  nvm use default >/dev/null 2>&1 || true
fi
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

# ---------------------------------------------------------------------------
# Self-update re-exec handler: if we were re-exec'd by a prior version of
# this script after the merge updated us, restore state and skip to where
# the prior version left off.
# ---------------------------------------------------------------------------
if [ "${AUTO_UPDATE_REEXEC:-}" = "1" ]; then
  PRE_MERGE_SHA="$AUTO_UPDATE_PRE_MERGE_SHA"
  PRE_MERGE_VERSION="$AUTO_UPDATE_PRE_MERGE_VERSION"
  POST_MERGE_SHA="$AUTO_UPDATE_POST_MERGE_SHA"
  RUN_TS="$AUTO_UPDATE_RUN_TS"
  LOG_FILE="${AUTO_UPDATE_LOG_FILE:-$LOG_FILE}"
  ROLLBACK_TAG="${AUTO_UPDATE_ROLLBACK_TAG:-}"
  HISTORY_ID="${AUTO_UPDATE_HISTORY_ID:-}"
  BRANCH=$(git -C "$REPO_ROOT" branch --show-current)
  unset AUTO_UPDATE_REEXEC
  log "=== RE-EXEC: running updated auto-update.sh from version_check ==="
fi

case "$TRIGGERED_BY" in
  cron|manual_api|manual_cli) ;;
  *) echo "Invalid --triggered-by: $TRIGGERED_BY" >&2; exit 1 ;;
esac

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
  local reason="$*"
  log "FAIL at step '$CURRENT_STEP': $reason"

  # Rollback-learn hook (v2.25.1+): capture failure signature for future
  # Checkpoint A consultation. Non-fatal — if the API call fails we still
  # exit with the failure code, just without the learn-signal.
  # Run-id = the basename of the current log file (auto-update-YYYY-MM-DD-HH-MM)
  if [ -n "${LOG_FILE:-}" ] && [ -n "${CURRENT_STEP:-}" ]; then
    local run_id
    run_id=$(basename "$LOG_FILE" .log)
    local payload
    payload=$(printf '{"action":"capture","runId":%s,"failedStep":%s,"reason":%s,"version":%s}' \
      "$(printf '%s' "$run_id"       | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')" \
      "$(printf '%s' "$CURRENT_STEP" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')" \
      "$(printf '%s' "$reason"       | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')" \
      "$(printf '%s' "${PRE_MERGE_VERSION:-}" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')")
    curl -sS -m 5 -X POST -H 'Content-Type: application/json' \
      "http://localhost:3001/api/auto-update/failures" -d "$payload" >/dev/null 2>&1 || true
  fi

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

  local prompt
  prompt=$(cat "$prompt_file")

  # v2.32.20 — Default path is direct Anthropic API (pay-per-token, no
  # subscription cap). The Claude Code CLI subscription path was hitting
  # "You've hit your org's monthly usage limit" mid-month, failing
  # Checkpoint B with UNDETERMINED → rollback. API path bills per-token
  # against ANTHROPIC_API_KEY in .env and has no monthly cap.
  #
  # Falls back to the CLI path (with the original PTY/skip-permissions
  # dance) only when ANTHROPIC_API_KEY is unset — useful for hosts that
  # haven't been provisioned with an API key yet.
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    log "Checkpoint $label: invoking Anthropic API (model=${CLAUDE_API_MODEL:-claude-opus-4-7}, timeout ${timeout_secs}s)"
    local model="${CLAUDE_API_MODEL:-claude-opus-4-7}"
    local request_file
    request_file=$(mktemp)
    # Build JSON safely via python — handles multi-KB prompts + special chars
    # without shell escape headaches that caustic jq -Rs would still leave.
    python3 -c "
import json, sys
with open('$prompt_file') as f:
    prompt = f.read()
sys.stdout.write(json.dumps({
    'model': '$model',
    'max_tokens': 4096,
    'messages': [{'role': 'user', 'content': prompt}]
}))
" > "$request_file" || {
      rm -f "$request_file"
      fail "Checkpoint $label: failed to build API request JSON" 2
    }
    local http_status
    http_status=$(timeout "$timeout_secs" curl -sS -o "$out_file.raw" -w '%{http_code}' \
      -X POST https://api.anthropic.com/v1/messages \
      -H "x-api-key: $ANTHROPIC_API_KEY" \
      -H "anthropic-version: 2023-06-01" \
      -H "content-type: application/json" \
      --data @"$request_file" 2>>"$LOG_FILE") || {
      rm -f "$request_file" "$out_file.raw"
      fail "Checkpoint $label: API call timed out or curl errored" 2
    }
    rm -f "$request_file"
    if [ "$http_status" != "200" ]; then
      log "Checkpoint $label: API returned HTTP $http_status"
      log "Checkpoint $label body: $(head -c 1000 "$out_file.raw" 2>/dev/null)"
      rm -f "$out_file.raw"
      fail "Checkpoint $label: API HTTP $http_status" 2
    fi
    # Extract text from messages response: content[0].text
    python3 -c "
import json
with open('$out_file.raw') as f:
    d = json.load(f)
print(d.get('content', [{}])[0].get('text', ''))
" > "$out_file" 2>>"$LOG_FILE" || {
      log "Checkpoint $label: failed to parse API response"
      log "Checkpoint $label raw body: $(head -c 500 "$out_file.raw" 2>/dev/null)"
      rm -f "$out_file.raw" "$out_file"
      fail "Checkpoint $label: API response parse failure" 2
    }
    rm -f "$out_file.raw"
  else
    log "Checkpoint $label: ANTHROPIC_API_KEY unset — falling back to Claude Code CLI (timeout ${timeout_secs}s)"
    # Original CLI path. PTY wrap + --dangerously-skip-permissions, with
    # ANTHROPIC_API_KEY stripped (mutually exclusive with OAuth flag).
    local claude_bin
    claude_bin=$(command -v claude)
    if [ -z "$claude_bin" ]; then
      fail "Checkpoint $label: ANTHROPIC_API_KEY unset AND claude binary not on PATH" 2
    fi
    local prompt_file_tmp
    prompt_file_tmp=$(mktemp)
    printf '%s' "$prompt" > "$prompt_file_tmp"
    if ! env -u ANTHROPIC_API_KEY timeout "$timeout_secs" \
         script -qfc "$claude_bin -p --dangerously-skip-permissions \"\$(cat $prompt_file_tmp)\"" /dev/null \
         >"$out_file" 2>&1; then
      log "Checkpoint $label: Claude Code timed out or errored"
      log "Checkpoint $label output: $(head -40 "$out_file" 2>/dev/null)"
      rm -f "$out_file" "$prompt_file_tmp"
      fail "Checkpoint $label: Claude Code CLI failure" 2
    fi
    rm -f "$prompt_file_tmp"
  fi

  local decision
  # Try line-start first, then fall back to anywhere in the response.
  # Claude sometimes writes a summary before the DECISION line.
  decision=$(grep -m1 '^DECISION:' "$out_file" || grep -m1 'DECISION:' "$out_file" || true)
  log "Checkpoint $label: $decision"
  # Also dump full response to log for forensics
  log "--- Checkpoint $label full response ---"
  cat "$out_file" >> "$LOG_FILE"
  log "--- end Checkpoint $label response ---"
  rm -f "$out_file"

  case "$decision" in
    "DECISION: GO"*)
      return 0
      ;;
    "DECISION: CAUTION"*)
      CAUTION_MODE=1
      log "Checkpoint $label: CAUTION — proceeding with extra monitoring"
      return 0
      ;;
    "DECISION: STOP"*)
      fail "Checkpoint $label: STOP — ${decision#DECISION: STOP}" 2
      ;;
    *)
      fail "Checkpoint $label: UNDETERMINED response from Claude Code" 2
      ;;
  esac
}

# ===========================================================================
# Skip to version_check if this is a re-exec after self-update
# ===========================================================================
if [ "${AUTO_UPDATE_REEXEC_FROM:-}" = "version_check" ]; then
  unset AUTO_UPDATE_REEXEC_FROM
  log "Skipping preflight → merge phases (already completed by prior script version)"
  # Jump directly to version_check — all prior phases were completed by the
  # old script before it exec'd us.
else
# ===========================================================================
# PHASE: PRE-FLIGHT
# ===========================================================================
step "preflight"
log "Triggered by: $TRIGGERED_BY (dry-run=$DRY_RUN)"

# 0a. Source .env so checkpoint phases see ANTHROPIC_API_KEY (v2.32.20).
# The build phase sources .env again at line ~966 — that source is for
# Turbo/Next.js, this earlier source is for Claude API calls in the
# Checkpoint A/B/C helpers below. set -a so child processes inherit.
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

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

# 2. Claude reachability — API path preferred, CLI as fallback
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  command -v curl >/dev/null 2>&1 || fail "curl not on PATH (required for Anthropic API)" 2
  command -v python3 >/dev/null 2>&1 || fail "python3 not on PATH (required for API JSON build)" 2
  log "Claude path: Anthropic API (model=${CLAUDE_API_MODEL:-claude-opus-4-7})"
else
  command -v claude >/dev/null 2>&1 || fail "Neither ANTHROPIC_API_KEY set nor Claude Code CLI installed" 2
  if ! timeout 15 claude --version >/dev/null 2>&1; then
    fail "Claude Code CLI not responding (--version failed or timed out)" 2
  fi
  log "Claude path: Claude Code CLI ($(claude --version 2>/dev/null | head -1))"
  log "WARN: ANTHROPIC_API_KEY missing from .env — using subscription CLI path."
  log "WARN: This path has a monthly token cap. To switch to the API path:"
  log "WARN:   echo 'ANTHROPIC_API_KEY=sk-ant-...' >> $REPO_ROOT/.env"
fi

# 3. Verify/rollback scripts present and executable
[ -x "$VERIFY_SCRIPT" ] || fail "verify-install.sh missing or not executable at $VERIFY_SCRIPT" 2
[ -f "$ROLLBACK_SCRIPT" ] || fail "rollback.sh missing at $ROLLBACK_SCRIPT" 2
bash -n "$ROLLBACK_SCRIPT" || fail "rollback.sh has syntax errors" 2

# 4. Working tree must be clean (location data files get normalized during update)
# v2.32.26 — Pre-clean uncommitted edits to LOCATION_PATHS_THEIRS files
# (auto-update.sh, CLAUDE.md, etc.). These get rewritten by the merge
# anyway (we always take main's version) but git refuses the merge with
# "Your local changes would be overwritten" if they're modified in the
# working tree. The bootstrap-fix dance (manually writing a hot-patched
# auto-update.sh into the tree before re-running) was failing on exactly
# this — operator wrote the new script but didn't commit it, then the next
# merge phase aborted with exit 4. Reset these paths to HEAD so the merge
# can proceed; their content will be replaced by main's version anyway.
PRE_MERGE_RESET_PATHS=(
  "scripts/auto-update.sh"
  "scripts/rollback.sh"
  "scripts/verify-install.sh"
  "scripts/ensure-schema.sh"
  "scripts/ensure-ollama-model.sh"
  "scripts/prompts/checkpoint-a.txt"
  "scripts/prompts/checkpoint-b.txt"
  "scripts/prompts/checkpoint-c.txt"
  "CLAUDE.md"
  "package.json"
  "package-lock.json"
)
for path in "${PRE_MERGE_RESET_PATHS[@]}"; do
  if [ -e "$REPO_ROOT/$path" ] && ! git diff --quiet HEAD -- "$path" 2>/dev/null; then
    log "Pre-clean: discarding working-tree edits to $path (will be replaced by main)"
    git checkout HEAD -- "$path" 2>&1 | tee -a "$LOG_FILE" || true
  fi
done

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

# v2.32.6 — Canary location gate. When scripts/canary-config.json has
# enabled=true AND this is NOT the canary branch, refuse to merge a
# commit until the canary has successfully installed it AND soaked for
# minBlessAgeMinutes. Bad commits break only the canary; the other 5
# locations skip with exit 0 (no-op) and try again on the next nightly
# run. The canary itself is exempt — it always proceeds without gating.
CANARY_CFG="$REPO_ROOT/scripts/canary-config.json"
if [ -f "$CANARY_CFG" ]; then
  CANARY_ENABLED=$(node -e "try{const c=require('$CANARY_CFG');console.log(c.enabled?'true':'false')}catch(e){console.log('false')}" 2>/dev/null || echo "false")
  CANARY_BRANCH=$(node -e "try{const c=require('$CANARY_CFG');console.log(c.canaryBranch||'')}catch(e){console.log('')}" 2>/dev/null || echo "")
  CANARY_MIN_AGE_MIN=$(node -e "try{const c=require('$CANARY_CFG');console.log(c.minBlessAgeMinutes||240)}catch(e){console.log('240')}" 2>/dev/null || echo "240")
  if [ "$CANARY_ENABLED" = "true" ] && [ -n "$CANARY_BRANCH" ] && [ "$BRANCH" != "$CANARY_BRANCH" ]; then
    log "Canary gate: this branch ($BRANCH) is non-canary; canary is $CANARY_BRANCH (min age ${CANARY_MIN_AGE_MIN}min)"
    git fetch origin "$CANARY_BRANCH" 2>&1 | tee -a "$LOG_FILE" || true
    BLESS_JSON=$(git show "origin/$CANARY_BRANCH:.canary-blessed.json" 2>/dev/null || echo "")
    if [ -z "$BLESS_JSON" ]; then
      log "Canary gate: no .canary-blessed.json on origin/$CANARY_BRANCH yet — skipping (will retry on next cron run)"
      history_insert_start
      history_update_result "pass" "skipped — canary $CANARY_BRANCH has not blessed any commit"
      state_update "pass" "skipped — waiting on canary"
      write_summary_json "pass" "skipped — waiting on canary"
      exit 0
    fi
    BLESSED_SHA=$(printf '%s' "$BLESS_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).blessedCommitSha||'')}catch(e){console.log('')}})" 2>/dev/null || echo "")
    BLESSED_UNIX=$(printf '%s' "$BLESS_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).blessedAtUnix||0)}catch(e){console.log('0')}})" 2>/dev/null || echo "0")
    if [ "$BLESSED_SHA" != "$TARGET_SHA" ]; then
      log "Canary gate: canary blessed $BLESSED_SHA but target is $TARGET_SHA — skipping (canary still on older commit)"
      history_insert_start
      history_update_result "pass" "skipped — canary not yet on target commit"
      state_update "pass" "skipped — waiting on canary catch-up"
      write_summary_json "pass" "skipped — canary not yet on target commit"
      exit 0
    fi
    NOW_UNIX=$(date +%s)
    AGE_MIN=$(( (NOW_UNIX - BLESSED_UNIX) / 60 ))
    if [ "$AGE_MIN" -lt "$CANARY_MIN_AGE_MIN" ]; then
      log "Canary gate: canary blessed target commit ${AGE_MIN}min ago, need ${CANARY_MIN_AGE_MIN}min soak — skipping (will retry on next cron run)"
      history_insert_start
      history_update_result "pass" "skipped — canary soak in progress (${AGE_MIN}/${CANARY_MIN_AGE_MIN}min)"
      state_update "pass" "skipped — canary soaking"
      write_summary_json "pass" "skipped — canary soaking ${AGE_MIN}/${CANARY_MIN_AGE_MIN}min"
      exit 0
    fi
    log "Canary gate: passed — $CANARY_BRANCH blessed $TARGET_SHA ${AGE_MIN}min ago (≥${CANARY_MIN_AGE_MIN}min required)"
  elif [ "$CANARY_ENABLED" = "true" ] && [ "$BRANCH" = "$CANARY_BRANCH" ]; then
    log "Canary gate: this IS the canary ($BRANCH) — proceeding without gating"
  fi
fi

# Insert history start row now that we know we have work to do
history_insert_start
log "History row id=$HISTORY_ID"

# v2.32.4 — Scan the incoming diff for newly-introduced process.env.X
# references and warn if they're not in the current .env. Warn-only —
# many env vars have `|| 'fallback'` defaults, so a missing var isn't
# automatically a failure. Operator can review the list before the merge
# proceeds. Real enforcement still happens at verify-install + Checkpoint
# B if the missing var actually breaks something at runtime.
NEW_ENV_REFS=$(git diff "$PRE_MERGE_SHA..$TARGET_SHA" -- '*.ts' '*.tsx' '*.js' 2>/dev/null \
  | grep -E '^\+[^+].*process\.env\.[A-Z][A-Z0-9_]+' \
  | grep -oE 'process\.env\.[A-Z][A-Z0-9_]+' \
  | sort -u || true)
if [ -n "$NEW_ENV_REFS" ]; then
  CURRENT_ENV_KEYS=$(grep -oE '^[A-Z][A-Z0-9_]+(?==)' "$REPO_ROOT/.env" 2>/dev/null \
                     || grep -oE '^[A-Z][A-Z0-9_]+' "$REPO_ROOT/.env" 2>/dev/null | head -200 \
                     || echo "")
  MISSING_ENV=()
  for ref in $NEW_ENV_REFS; do
    key="${ref#process.env.}"
    # Skip well-known optional keys with code-side fallbacks
    case "$key" in NODE_ENV|PORT|DATABASE_URL) continue ;; esac
    if ! printf '%s\n' "$CURRENT_ENV_KEYS" | grep -qx "$key"; then
      MISSING_ENV+=("$key")
    fi
  done
  if [ "${#MISSING_ENV[@]}" -gt 0 ]; then
    log "⚠ env-var pre-flight: incoming diff references env vars not in current .env:"
    for k in "${MISSING_ENV[@]}"; do log "    $k"; done
    log "    These may have code-side fallbacks. Verify before continuing if any are required."
    log "    Real enforcement runs at verify-install + Checkpoint B."
  fi
fi

# ===========================================================================
# CHECKPOINT A — Pre-update analysis
# ===========================================================================
step "checkpoint_a"
run_checkpoint "A" "$PROMPTS_DIR/checkpoint-a.txt" 180

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
  "apps/web/data/everpass-devices.json"
  # v2.32.4 — per-location OTA broadcast affiliates (introduced v2.23.0).
  # Holmgren has WBAY/WFRV/WLUK/WGBA station aliases; Stoneyard's set is
  # different; Lucky's smaller. Without this entry, any future merge that
  # touches this file at any location with custom OTA aliases would hit
  # "unexpected conflict" and abort auto-update with exit 3 (no rollback,
  # half-merged tree). Always keep the location's version.
  "apps/web/data/station-aliases-local.json"
  "apps/web/public/uploads/layouts"
  "data"
  ".env"
  # PM2 config carries per-location Sports Guide credentials via process.env.
  # Main historically hardcoded a location's values in this file, which means
  # every merge from main overwrites the running location's creds. Keep the
  # location's env-driven version across merges. When main eventually adopts
  # the env-driven pattern, this entry becomes a no-op (content-identical).
  "ecosystem.config.js"
  # hardware-config.ts has per-location values (venue name, processor IP,
  # audio output slot range). Main historically shipped with Stoneyard's
  # values hardcoded; merging main overwrites the location's correct
  # values. Keep ours until the file is refactored into DB/env lookups
  # keyed by LOCATION_ID.
  "apps/web/src/lib/hardware-config.ts"
)

# These paths always take the MAIN version (git checkout --theirs)
# package-lock and package.json version bumps must come from main for
# `npm ci` to work after the reset.
#
# Orchestration scripts (auto-update.sh, rollback.sh, ensure-*.sh) and
# prompt files are pure software — locations should never carry
# divergent versions. When a location's branch has stale edits to these
# (e.g. from a manual tweak during an earlier debugging session), the
# merge hits a content conflict and the whole update aborts. Force them
# to take main's version so software fixes propagate cleanly.
LOCATION_PATHS_THEIRS=(
  "package-lock.json"
  "package.json"
  "scripts/auto-update.sh"
  "scripts/rollback.sh"
  "scripts/verify-install.sh"
  "scripts/ensure-schema.sh"
  "scripts/ensure-ollama-model.sh"
  "scripts/prompts/checkpoint-a.txt"
  "scripts/prompts/checkpoint-b.txt"
  "scripts/prompts/checkpoint-c.txt"
  # v2.32.26 — CLAUDE.md is shared documentation. Location-branch commits
  # to it (e.g. holmgren-way 8610e1e2 adding the Fire TV launcher gotcha)
  # MUST be cherry-picked to main first; locations should never carry a
  # divergent CLAUDE.md. Without this entry, the v2.32.21/22 simplify pass
  # on main (1122→672 lines) collided with location-only edits and aborted
  # auto-update across the fleet for 4+ days. CLAUDE.md Standing Rule 9
  # codifies "CLAUDE.md is main-only" — this entry enforces it at merge time.
  "CLAUDE.md"
)

# Prefix-based fallback: any remaining conflict under a shared-software
# prefix takes MAIN. These subtrees are pure software and location
# branches should never carry divergent edits. Prior to v2.22.2 a single
# stale edit anywhere under apps/web/src/app/ would abort the entire
# auto-update (remote/page.tsx at Lucky's 1313 on 2026-04-19 is the
# case that prompted this fix). Ordered most-specific-first — a later
# match does NOT override an earlier one, so putting OURS-exempt paths
# in LOCATION_PATHS_OURS above is what protects them from this fallback.
SHARED_SOFTWARE_PREFIXES=(
  "apps/web/src/app/"
  "apps/web/src/components/"
  "apps/web/src/lib/"
  "apps/web/src/hooks/"
  "apps/web/src/db/"
  "apps/web/src/types/"
  "apps/web/src/utils/"
  "apps/web/public/"
  "packages/"
  "docs/"
  "drizzle/"
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

  # Prefix-based shared-software fallback. Any remaining UU file whose
  # path starts with a SHARED_SOFTWARE_PREFIXES entry takes MAIN. Files
  # in LOCATION_PATHS_OURS were already resolved above so the fallback
  # only fires on files that ARE shared code.
  if git status --porcelain | grep -q "^UU"; then
    while IFS= read -r conflict_line; do
      # conflict_line looks like "UU apps/web/src/app/remote/page.tsx"
      conflict_path="${conflict_line:3}"
      for prefix in "${SHARED_SOFTWARE_PREFIXES[@]}"; do
        case "$conflict_path" in
          "$prefix"*)
            log "  taking MAIN version (shared-software fallback): $conflict_path"
            git checkout --theirs "$conflict_path" 2>&1 | tee -a "$LOG_FILE"
            git add "$conflict_path"
            break
            ;;
        esac
      done
    done < <(git status --porcelain | grep "^UU")
  fi

  # Any STILL-remaining conflict = unexpected file, human required
  if git status --porcelain | grep -q "^UU"; then
    log "Unexpected merge conflict on non-whitelisted files (not covered by OURS/THEIRS/prefix fallback):"
    git status --porcelain | grep "^UU" | tee -a "$LOG_FILE"
    git merge --abort 2>/dev/null || true
    fail "merge conflict on non-whitelisted file" 3
  fi

  git commit --no-edit 2>&1 | tee -a "$LOG_FILE" || fail "merge commit failed after conflict resolution" 4
fi

POST_MERGE_SHA=$(git rev-parse HEAD)
log "Post-merge sha: $POST_MERGE_SHA"

# ===========================================================================
# SELF-UPDATE CHECK: if auto-update.sh itself changed in the merge, re-exec
# the new version so all subsequent steps (build, checkpoint prompts, etc.)
# use the latest logic. Without this, a location running an old script gets
# the new code but builds/verifies with the old script's stale commands.
# ===========================================================================
if git diff "$PRE_MERGE_SHA" HEAD --name-only | grep -q '^scripts/auto-update\.sh$'; then
  log "auto-update.sh was updated by the merge — re-executing new version"
  log "Re-exec args: $0 $*"
  # Pass a flag so the re-exec'd script skips phases already completed
  export AUTO_UPDATE_REEXEC=1
  export AUTO_UPDATE_REEXEC_FROM="version_check"
  export AUTO_UPDATE_PRE_MERGE_SHA="$PRE_MERGE_SHA"
  export AUTO_UPDATE_PRE_MERGE_VERSION="$PRE_MERGE_VERSION"
  export AUTO_UPDATE_POST_MERGE_SHA="$POST_MERGE_SHA"
  export AUTO_UPDATE_RUN_TS="$RUN_TS"
  export AUTO_UPDATE_LOG_FILE="$LOG_FILE"
  export AUTO_UPDATE_ROLLBACK_TAG="$ROLLBACK_TAG"
  export AUTO_UPDATE_HISTORY_ID="$HISTORY_ID"
  exec bash "$REPO_ROOT/scripts/auto-update.sh" "$@"
fi

fi  # end of "skip to version_check if re-exec" else block

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
NPM_CI_LOG="$LOG_DIR/npm-ci-$(date +%s).log"
NODE_ENV=development npm ci --include=dev 2>&1 | tee "$NPM_CI_LOG" | tee -a "$LOG_FILE"
NPM_CI_EXIT="${PIPESTATUS[0]}"

if [ "$NPM_CI_EXIT" -ne 0 ]; then
  # Fail-safe: lockfile drift (EUSAGE) is a common class of failure when
  # package.json was bumped but the lockfile wasn't regenerated. Rather than
  # rolling back the whole update (which strands the location), fall back to
  # `npm install` to regenerate the lockfile in-place. The rebuilt lockfile
  # stays local — not pushed back to git — so the root cause still needs a
  # fix on main, but at least this location can install and run.
  if grep -qE "EUSAGE|npm ci.*can only install|out of sync with|package-lock\.json.*not in sync" "$NPM_CI_LOG"; then
    log "WARNING: npm ci failed with lockfile drift — falling back to npm install"
    log "WARNING: The root cause is on main (package.json bumped without regenerating lock)."
    log "WARNING: This location's lockfile will be regenerated in-place and NOT committed."
    NODE_ENV=development npm install --include=dev 2>&1 | tee -a "$LOG_FILE"
    if [ "${PIPESTATUS[0]}" -ne 0 ]; then
      fail "npm install fallback also failed" 4
    fi
    log "npm install fallback succeeded"
  else
    fail "npm ci failed" 4
  fi
fi
rm -f "$NPM_CI_LOG"

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
# drizzle-kit push prompts for confirmation when it detects a data-loss
# statement (e.g. dropping a table that still has rows). In the
# auto-update flow the schema change was already approved at Checkpoint A
# (it's in the merge diff Claude reviewed), so we auto-accept.
#
# Piping `yes` into stdin does NOT work: drizzle-kit uses the `prompts`
# package with a TTY-aware reader that bails with "Interactive prompts
# require a TTY terminal" the moment it detects stdin is not a tty —
# BEFORE it ever tries to read a character. Same class of problem as
# the Claude CLI TTY bug (v2.22.4). Fix the same way: wrap in
# `script -qfc` to provide a pty, and feed the "y\n" answer via `yes`
# inside the script so it's ready when the prompt reads.
if script -qfc "yes 2>/dev/null | NODE_ENV=development npx drizzle-kit push" /dev/null 2>&1 | tee "$SCHEMA_PUSH_LOG" | tee -a "$LOG_FILE"; then
  log "drizzle-kit push completed cleanly"
else
  if grep -qE "(index|table|column) [\`\"]?[A-Za-z_][A-Za-z0-9_]*[\`\"]? already exists|already exists" "$SCHEMA_PUSH_LOG"; then
    log "WARNING: drizzle-kit push reported pre-existing objects (benign — see $SCHEMA_PUSH_LOG)"
    log "WARNING: this means the DB already had untracked tables/indexes from a prior manual hotfix."
    log "WARNING: Running ensure-schema.sh fallback to create any genuinely missing tables/columns..."
    if bash "$REPO_ROOT/scripts/ensure-schema.sh" "$DB_PATH" 2>&1 | tee -a "$LOG_FILE"; then
      log "ensure-schema.sh fallback completed successfully"
    else
      log "WARNING: ensure-schema.sh had errors — some new tables/columns may be missing"
    fi
  else
    cat "$SCHEMA_PUSH_LOG" >> "$LOG_FILE"
    fail "drizzle-kit push failed with an unrecognized error — see $SCHEMA_PUSH_LOG" 4
  fi
fi

# v2.32.5 — Detect destructive schema operations and mark the pre-update
# DB backup as required for rollback. Without this marker, rollback.sh
# resets git + .next but leaves the DB in the half-migrated state — a
# DROP COLUMN / DROP TABLE in this run is permanent. The marker is a
# small companion file alongside $BACKUP_FILE; rollback.sh checks for
# it after git reset and restores the DB BEFORE rebuilding so the build
# runs against the schema the reset code expects.
#
# Conservative grep — only flags operations drizzle ANNOUNCES as data-
# loss in its push output. Pure additive schema (CREATE TABLE / ADD
# COLUMN) doesn't trip this and rollback continues to leave the DB
# alone (the additive schema is forward-compatible with old code).
if [ -f "$SCHEMA_PUSH_LOG" ] && grep -qiE "you're about to (delete|drop)|drop (table|column)|data.loss|truncate" "$SCHEMA_PUSH_LOG" 2>/dev/null; then
  DESTRUCTIVE_MARKER="$BACKUP_FILE.destructive"
  log "Schema push included destructive operations — writing $DESTRUCTIVE_MARKER (rollback will auto-restore DB)"
  {
    echo "runId=$(basename "$LOG_FILE" .log)"
    echo "detectedAtUtc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "preMergeSha=${PRE_MERGE_SHA:-unknown}"
    echo "postMergeSha=${POST_MERGE_SHA:-unknown}"
    echo "--- detected lines ---"
    grep -iE "you're about to|drop (table|column)|data.loss|truncate|dropping" "$SCHEMA_PUSH_LOG" 2>/dev/null | head -20
  } > "$DESTRUCTIVE_MARKER" 2>/dev/null || log "WARNING: could not write destructive marker"
fi

# ===========================================================================
# PHASE: OLLAMA MODEL — ensure AI Suggest has the required LLM
# ===========================================================================
# Non-fatal: if this fails the app still boots; only the AI Suggest
# scheduling feature is degraded. See scripts/ensure-ollama-model.sh for
# exit code meanings. First run at a location downloads ~4.7GB.
step "ollama_model"
if [ -x "$REPO_ROOT/scripts/ensure-ollama-model.sh" ]; then
  if bash "$REPO_ROOT/scripts/ensure-ollama-model.sh" 2>&1 | tee -a "$LOG_FILE"; then
    log "ollama model check passed"
  else
    log "WARNING: ollama model check reported a problem — AI Suggest may be unavailable"
  fi
else
  log "WARNING: scripts/ensure-ollama-model.sh missing or not executable — skipping"
fi

# ===========================================================================
# CHECKPOINT B — Post-merge / pre-build review
# ===========================================================================
step "checkpoint_b"
run_checkpoint "B" "$PROMPTS_DIR/checkpoint-b.txt" 300

# ===========================================================================
# PHASE: BUILD (with .next.bak caching for instant rollback)
# ===========================================================================
step "build"
if [ -d "$REPO_ROOT/apps/web/.next" ]; then
  log "Caching current build at apps/web/.next.bak"
  rm -rf "$REPO_ROOT/apps/web/.next.bak"
  mv "$REPO_ROOT/apps/web/.next" "$REPO_ROOT/apps/web/.next.bak"
fi

# Source the location's .env so LOCATION_NAME, LOCATION_ID (and anything
# else the build reads via process.env) reach Turbo and the Next.js build
# subprocess. Without this, Turbo's strict-env mode strips location-
# specific vars and statically-rendered pages bake the wrong default
# (e.g. the browser tab title from v2.23.11's generateMetadata). This
# matters even though PM2's ecosystem.config.js already loads .env for
# the runtime — builds happen in a separate shell that never touches
# ecosystem.config.js. Any new file-format env (e.g. lines with quotes,
# comments) should pass through cleanly because we use `set -a` + source.
if [ -f "$REPO_ROOT/.env" ]; then
  log "Sourcing .env so build sees LOCATION_NAME / LOCATION_ID / etc."
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

log "npm run build (--force to bypass Turbo cache for package changes)"
rm -rf "$REPO_ROOT/.turbo" "$REPO_ROOT/node_modules/.cache"
npx turbo run build --force 2>&1 | tee -a "$LOG_FILE"
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
# Capture for heartbeat file (v2.25.2+). One-line JSON suitable for
# embedding inside another JSON document.
if [ -f "$VERIFY_JSON" ]; then
  VERIFY_INSTALL_JSON=$(cat "$VERIFY_JSON" | tr -d '\n' | tr -s ' ')
fi

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
run_checkpoint "C" "$PROMPTS_DIR/checkpoint-c.txt" 300

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

# Heartbeat (v2.25.2+): write .auto-update-last-success.json at repo root
# with the just-verified state. Committed + pushed alongside the merge so
# the Fleet Dashboard can read verify-install-7/7-PASS, uptime, and
# success timestamp via `git show origin/location/X:.auto-update-last-success.json`.
# Tells the dashboard "this location is actually HEALTHY right now", not
# just "last commit was N hours ago".
#
# The file is gitignored on main (main has no concept of "last successful
# update at this location") but tracked on location branches. We force-
# add it here with `git add -f` so the gitignore doesn't block the commit.
if [ -n "${VERIFY_INSTALL_JSON:-}" ]; then
  # v2.32.4 — Enrich the heartbeat with config-file checksums and DB
  # row-count snapshots. Lets the Fleet Dashboard detect post-update
  # config drift (operator hand-edited .env after auto-update; tv-layout
  # got blanked by a stale merge; AuthPin rows missing) WITHOUT polling
  # each location. The dashboard compares last-success snapshot to the
  # current commit's expected values and flags drift.
  HB_FILE_CHECKSUMS=$(
    {
      for f in ".env" "apps/web/data/tv-layout.json" "apps/web/data/station-aliases-local.json" "apps/web/src/lib/hardware-config.ts"; do
        if [ -f "$REPO_ROOT/$f" ]; then
          h=$(sha256sum "$REPO_ROOT/$f" 2>/dev/null | awk '{print substr($1,1,16)}')
          [ -n "$h" ] && printf '    "%s": "%s",\n' "$f" "$h"
        fi
      done
    } | sed '$ s/,$//'
  )
  HB_ROW_COUNTS=$(
    {
      DB_PATH="${DATABASE_PATH:-/home/ubuntu/sports-bar-data/production.db}"
      if [ -f "$DB_PATH" ]; then
        for tbl in Location AuthPin MatrixConfiguration HomeTeam ChannelPreset station_aliases; do
          c=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $tbl;" 2>/dev/null || echo "")
          [ -n "$c" ] && printf '    "%s": %d,\n' "$tbl" "$c"
        done
      fi
    } | sed '$ s/,$//'
  )
  {
    printf '{\n'
    printf '  "version": "%s",\n' "${POST_MERGE_VERSION:-unknown}"
    printf '  "branch": "%s",\n' "${BRANCH:-unknown}"
    printf '  "commitSha": "%s",\n' "${POST_MERGE_SHA:-unknown}"
    printf '  "successAt": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf '  "successAtUnix": %d,\n' "$(date +%s)"
    printf '  "runId": "%s",\n' "$(basename "$LOG_FILE" .log)"
    printf '  "verifyInstall": %s,\n' "$VERIFY_INSTALL_JSON"
    if [ -n "$HB_FILE_CHECKSUMS" ]; then
      printf '  "configChecksums": {\n%s\n  },\n' "$HB_FILE_CHECKSUMS"
    fi
    if [ -n "$HB_ROW_COUNTS" ]; then
      printf '  "dbRowCounts": {\n%s\n  },\n' "$HB_ROW_COUNTS"
    fi
    # Schema version of this heartbeat record so dashboard knows which fields are present
    printf '  "heartbeatSchemaVersion": 2\n'
    printf '}\n'
  } > "$REPO_ROOT/.auto-update-last-success.json"
  git -C "$REPO_ROOT" add -f ".auto-update-last-success.json" 2>/dev/null || true
  if ! git -C "$REPO_ROOT" diff --cached --quiet -- ".auto-update-last-success.json" 2>/dev/null; then
    git -C "$REPO_ROOT" commit -q -m "chore(heartbeat): update .auto-update-last-success.json ($(date +%Y-%m-%d-%H-%M))" 2>/dev/null || true
    log "Heartbeat file committed"
  fi
fi

# v2.32.6 — Canary bless write. If this location IS the canary AND
# canary mode is enabled in scripts/canary-config.json, write
# .canary-blessed.json with the just-verified commit so non-canary
# locations can gate their own auto-update on it. The bless file is
# committed + pushed alongside the heartbeat so other locations can
# read it via `git show origin/<canaryBranch>:.canary-blessed.json`.
if [ -f "$REPO_ROOT/scripts/canary-config.json" ]; then
  CANARY_ENABLED=$(node -e "try{const c=require('$REPO_ROOT/scripts/canary-config.json');console.log(c.enabled?'true':'false')}catch(e){console.log('false')}" 2>/dev/null || echo "false")
  CANARY_BRANCH=$(node -e "try{const c=require('$REPO_ROOT/scripts/canary-config.json');console.log(c.canaryBranch||'')}catch(e){console.log('')}" 2>/dev/null || echo "")
  if [ "$CANARY_ENABLED" = "true" ] && [ "$BRANCH" = "$CANARY_BRANCH" ]; then
    {
      printf '{\n'
      printf '  "blessedCommitSha": "%s",\n' "${POST_MERGE_SHA:-unknown}"
      printf '  "blessedAtUtc": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      printf '  "blessedAtUnix": %d,\n' "$(date +%s)"
      printf '  "verifyResult": "PASS",\n'
      printf '  "blesserBranch": "%s",\n' "$BRANCH"
      printf '  "blesserVersion": "%s"\n' "${POST_MERGE_VERSION:-unknown}"
      printf '}\n'
    } > "$REPO_ROOT/.canary-blessed.json"
    git -C "$REPO_ROOT" add -f ".canary-blessed.json" 2>/dev/null || true
    if ! git -C "$REPO_ROOT" diff --cached --quiet -- ".canary-blessed.json" 2>/dev/null; then
      git -C "$REPO_ROOT" commit -q -m "chore(canary): bless commit ${POST_MERGE_SHA:-unknown} ($(date +%Y-%m-%d-%H-%M))" 2>/dev/null || true
      log "Canary bless file committed (other locations will gate on this)"
    fi
  fi
fi

# Push the merge commit back to origin so the Fleet Dashboard (v2.24.0+)
# sees this location's current version. Before v2.24.6, auto-update.sh
# merged main locally, built, verified, restarted — but never pushed. The
# remote branch stayed at whatever the last human-pushed state was, which
# meant every dashboard report of "stuck" for a location that had been
# auto-updating was wrong. We only push here AFTER all verifications have
# passed (checkpoint_c + verify-install 6/6), so pushing a broken state
# to GitHub can't happen.
#
# Safety properties:
#   - Pushes ONLY the current branch (the location/* branch). Never
#     touches main — location work must not leak to other locations.
#   - No --force. If the remote has diverged (someone pushed while we
#     were running), we fail this step loud rather than overwriting.
#   - Push failure is NON-FATAL — the location itself is in a good
#     state; only the dashboard signal is missing. Log and continue.
if git rev-parse --abbrev-ref HEAD >/dev/null 2>&1; then
  CURRENT_BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)
  if [ "$CURRENT_BRANCH" = "main" ]; then
    log "WARNING: auto-update ran on main; not pushing (location branches only)"
  elif [ -z "$CURRENT_BRANCH" ] || [ "$CURRENT_BRANCH" = "HEAD" ]; then
    log "WARNING: detached HEAD — skipping push"
  else
    log "Pushing $CURRENT_BRANCH to origin (fleet-dashboard signal)"
    if git -C "$REPO_ROOT" push origin "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE"; then
      log "Push succeeded — Fleet Dashboard will reflect this update within 5 min (cache TTL)"
    else
      log "WARNING: push failed — location is still healthy, but Fleet Dashboard won't see this update until a human pushes manually or next successful auto-update"
    fi
  fi
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
