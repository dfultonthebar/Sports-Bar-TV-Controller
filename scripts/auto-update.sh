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
# Cron jitter (v2.32.47)
# ---------------------------------------------------------------------------
# All 6 locations have cron firing at 02:30/02:31 local time. When a release
# lands on main and every host wakes simultaneously, all 6 hit the Anthropic
# API at the same Checkpoint A/B/C boundaries and trip the org-wide 30k
# input-tokens-per-minute rate limit. Hosts that lose the race retry, exhaust
# their 4 attempts, and roll back even though the merge would have succeeded
# in isolation — exactly what happened on 2026-05-06 with the v2.32.43 fanout.
#
# Spread the herd: cron-triggered runs sleep a random 0-1799s before doing
# any work. Manual triggers (manual_api / manual_cli) skip the jitter so the
# operator doesn't wait on a 30-min sleep when they hit "Run Update Now."
if [ "$TRIGGERED_BY" = "cron" ]; then
  JITTER=$((RANDOM % 1800))
  sleep "$JITTER"
  # Refresh RUN_TS / LOG_FILE so the log is named for when work actually
  # starts rather than when the script was invoked. Otherwise hosts that
  # slept 25 minutes would all share a log filename close to 02:30 even
  # though their work happened at 02:55.
  RUN_TS="$(date +%Y-%m-%d-%H-%M)"
  LOG_FILE="$LOG_DIR/auto-update-$RUN_TS.log"
  RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  RUN_STARTED_EPOCH="$(date +%s)"
  CRON_JITTER_SECS="$JITTER"
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

# v2.55.33 — Last-attempt sidecar for verify-install Layer 19 freshness check.
# On NOOP runs (e.g. origin/main already merged) no new log file is created,
# so log-mtime makes the timer look stuck even when systemctl shows it fired.
# Always-touch this sidecar at every exit path (noop/success/fail) so the
# layer's freshness signal is "did the timer run", not "did it produce a log".
# Atomic write via mv to avoid partial reads on race with verify-install.
update_last_attempt_sidecar() {
  local outcome="${1:-unknown}"
  local sidecar="$DATA_DIR/.auto-update-last-attempt.json"
  local tmp
  local run_id
  run_id=$(basename "${LOG_FILE:-auto-update-${RUN_TS:-unknown}.log}" .log)
  [ -d "$DATA_DIR" ] || return 0
  tmp=$(mktemp "$DATA_DIR/.auto-update-last-attempt.json.XXXXXX" 2>/dev/null) || return 0
  {
    printf '{\n'
    printf '  "attempted_at": %d,\n' "$(date +%s)"
    printf '  "attempted_at_iso": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf '  "outcome": "%s",\n' "$outcome"
    printf '  "runId": "%s",\n' "$run_id"
    printf '  "triggeredBy": "%s",\n' "${TRIGGERED_BY:-unknown}"
    printf '  "branch": "%s"\n' "${BRANCH:-unknown}"
    printf '}\n'
  } > "$tmp" 2>/dev/null && mv -f "$tmp" "$sidecar" 2>/dev/null || rm -f "$tmp" 2>/dev/null
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

  # Flywheel hook (best-effort): log the auto-update FAILURE outcome to the Honcho
  # ops corpus (sports-bar/fleet-ops) so the fleet-ops-LLM learns failure->cause.
  curl -sS -m 6 -X POST -H 'Content-Type: application/json' \
    "http://100.90.175.125:8000/v3/workspaces/sports-bar/sessions/fleet-ops-log/messages" \
    -d "$(printf '%s' "auto-update FAILED on $(hostname) at step '$CURRENT_STEP': $reason (version ${PRE_MERGE_VERSION:-?}, triggered-by ${TRIGGERED_BY:-?})" | python3 -c 'import sys,json; print(json.dumps({"messages":[{"peer_id":"fleet-ops","content":sys.stdin.read()}]}))')" >/dev/null 2>&1 || true

  update_last_attempt_sidecar "fail"
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
# Mutual exclusion via flock + PID-staleness sweep
# ---------------------------------------------------------------------------
# `flock -n` fails immediately if another run holds the lock. The lock is
# released automatically when the shell exits (including on SIGKILL) because
# file descriptors are closed by the kernel.
#
# v2.52.0 — added PID-staleness check + exit code 75 semantics.
#
# WHY: pre-v2.52.0 flock would correctly say "lock held" but the lock could
# be held by ORPHAN child processes (npm/build/node) that inherited FD 200
# from a parent script that already exited. `pgrep -af auto-update.sh`
# would return nothing yet the lock would persist (Mode 14 — Holmgren
# 2026-05-19 02:50). Operator had to manually `rm /tmp/sports-bar-auto-update.lock`.
#
# Now: on lock-failed, check the PID file. If the recorded PID is dead,
# remove the lock + PID file, retry once. If still held by alive PID,
# exit 75 — distinct from real failure exit codes, so cron/systemd can
# retry sooner. Per AP-4 in docs/AUTO_UPDATE_DESIGN_RULES.md + Helm/ArgoCD
# inspired patterns.
acquire_lock_or_sweep_stale() {
  exec 200>"$LOCK_FILE"
  if flock -n 200; then
    echo $$ > "$PID_FILE"
    return 0
  fi
  # Lock held. Read PID, check if it's alive.
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null | tr -d '[:space:]')
    if [ -n "$pid" ] && [ "$pid" -gt 0 ] 2>/dev/null; then
      if ! kill -0 "$pid" 2>/dev/null; then
        log "Stale lock detected — recorded PID $pid is dead. Clearing lock + retrying."
        # Close our FD-200 first so the rm doesn't affect a brand-new flock
        # we're about to acquire.
        exec 200>&-
        rm -f "$LOCK_FILE" "$PID_FILE"
        exec 200>"$LOCK_FILE"
        if flock -n 200; then
          echo $$ > "$PID_FILE"
          return 0
        fi
        log "Lock still unavailable after stale-PID sweep — another run started concurrently."
      else
        log "Lock held by ALIVE PID $pid — legit concurrent run, exiting cleanly (exit 75 = 'retry later')."
      fi
    else
      log "Lock held but PID file empty/unreadable — possibly mid-acquisition by concurrent run. Exiting clean (exit 75)."
    fi
  else
    # v2.52.2 fix: lock file exists but NO PID file companion. Pre-v2.52.2
    # this branch immediately exited 75 — but in practice this state means
    # one of:
    #   (a) the previous parent crashed AFTER cleanup_on_error rm'd the PID
    #       file but BEFORE its FD-200 was released, then a setsid-detached
    #       child kept the lock open
    #   (b) the very first parent never got to write the PID file (race
    #       between mkdir/flock acquisition and the echo $$ write)
    #
    # All 4 location boxes hit (a) on the 2026-05-19 v2.52.1 rollout,
    # blocking the auto-update until I manually `rm /tmp/sports-bar-auto-update.lock`.
    # Same root cause as the v2.52.0 PID-staleness sweep — we just hadn't
    # covered the no-PID-file variant.
    #
    # Liveness check via pgrep (not PID file): if no auto-update.sh process
    # OTHER THAN our own invocation is running, the lock is truly orphan → sweep.
    #
    # v2.55.14 fix: a single timer-fired run shows up as MULTIPLE processes
    # (the systemd-spawned shell + the script + subshells). The old
    # `grep -v "$$"` only excluded the current PID, leaving sibling/parent
    # processes of THIS SAME run counted → live_count=1 → false "concurrent
    # run" → exit 75 every night → permanent stall. (All 5 remote boxes hit
    # this, frozen 154 commits behind, 2026-05-28.) Exclude the entire current
    # process GROUP so only a genuinely separate invocation counts.
    local live_count mypgid ppg p
    mypgid=$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ')
    live_count=0
    for p in $(pgrep -f "[a]uto-update\.sh" 2>/dev/null); do
      [ "$p" = "$$" ] && continue
      ppg=$(ps -o pgid= -p "$p" 2>/dev/null | tr -d ' ')
      [ -n "$mypgid" ] && [ "$ppg" = "$mypgid" ] && continue   # same invocation
      live_count=$((live_count + 1))
    done
    if [ "$live_count" -eq 0 ]; then
      log "Lock held but no PID file AND no auto-update.sh process running — orphan lock, sweeping."
      exec 200>&-
      rm -f "$LOCK_FILE" "$PID_FILE"
      exec 200>"$LOCK_FILE"
      if flock -n 200; then
        echo $$ > "$PID_FILE"
        return 0
      fi
      log "Lock still unavailable after orphan-sweep — race with a concurrent run."
    else
      log "Lock held but no PID file — auto-update.sh process(es) running ($live_count), legit concurrent run. Exit 75."
    fi
  fi
  exit 75
}
acquire_lock_or_sweep_stale

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
# v2.32.80 — Refresh just the os.* fields of an existing heartbeat. Called
# on the "no update available" exit path so the Fleet Dashboard still gets
# fresh OS info after operator-driven changes outside auto-update (e.g.
# apt dist-upgrade + kernel reboot — see FLEET_STATUS Outstanding #4).
#
# Conservative on purpose: only patches the `os` block, leaves
# verifyInstall / configChecksums / dbRowCounts intact (those reflect the
# last full verify run and weren't re-checked here). Commits + pushes only
# if the os fields actually changed (uses python's atomic write + git's
# no-op-on-no-diff behavior).
# ---------------------------------------------------------------------------
refresh_heartbeat_os_only() {
  local hb="$REPO_ROOT/.auto-update-last-success.json"
  [ -f "$hb" ] || return 0  # no existing heartbeat → nothing to patch

  local codename version kernel
  codename=$(lsb_release -cs 2>/dev/null || echo "unknown")
  version=$(lsb_release -rs 2>/dev/null || echo "unknown")
  kernel=$(uname -r 2>/dev/null || echo "unknown")

  # Use python for in-place JSON patching — pure shell sed/grep would
  # break the rest of the heartbeat structure on edge cases.
  if ! python3 - "$hb" "$codename" "$version" "$kernel" <<'PY' 2>/dev/null
import json, sys
path, codename, version, kernel = sys.argv[1:5]
with open(path) as f:
    d = json.load(f)
new_os = {"codename": codename, "version": version, "kernel": kernel}
if d.get("os") == new_os:
    sys.exit(1)  # nothing to do — caller treats as no-op
d["os"] = new_os
with open(path, "w") as f:
    json.dump(d, f, indent=2)
    f.write("\n")
PY
  then
    return 0  # python returned 1: no change needed
  fi

  # v2.32.82 — keep sidecar copy in sync (see drift-recovery block).
  if [ -d "/home/ubuntu/sports-bar-data" ]; then
    cp -f "$hb" "/home/ubuntu/sports-bar-data/.auto-update-last-success.json" 2>/dev/null || true
  fi
  git -C "$REPO_ROOT" add -f ".auto-update-last-success.json" 2>/dev/null || true
  if ! git -C "$REPO_ROOT" diff --cached --quiet -- ".auto-update-last-success.json" 2>/dev/null; then
    git -C "$REPO_ROOT" commit -q \
      -m "chore(heartbeat): refresh os fields on no-op auto-update ($(date +%Y-%m-%d-%H-%M))" 2>/dev/null || true
    # Push the heartbeat directly — NO `pull --rebase` (it tangles into a stuck
    # multi-commit rebase against a diverged origin; this very line helped freeze
    # the whole fleet on 2026-06-14). A heartbeat is just an os-field refresh, so
    # if the push is rejected (origin diverged) we simply skip it this cycle.
    git -C "$REPO_ROOT" fetch -q origin "$BRANCH" 2>/dev/null || true
    if git -C "$REPO_ROOT" push -q origin "$BRANCH" 2>/dev/null; then
      log "Heartbeat os.* refreshed (kernel=$kernel)"
    else
      log "Heartbeat push skipped (origin diverged — non-fatal, refreshed locally)"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Cleanup trap — runs on every exit, success or fail
# ---------------------------------------------------------------------------
cleanup_on_error() {
  local exit_code=$?
  if [ "$exit_code" -eq 0 ]; then
    rm -f "$PID_FILE" 2>/dev/null || true
    exec 200>&- 2>/dev/null || true
    return
  fi
  log "Trap fired: exit code=$exit_code, step=$CURRENT_STEP"
  # v2.52.3 fix (AP-4 audit Finding #1): do NOT rm PID_FILE here. Rollback
  # children (rollback.sh + its child spawns) inherit FD 200 on the lock
  # file via this script's `exec 200>"$LOCK_FILE"`. If we drop the PID
  # file NOW but those children keep FD 200 open, a concurrent cron tick
  # sees (lock + no PID file) and the v2.52.2 sweep mis-classifies the
  # state as orphan (the rollback children aren't named "auto-update.sh"
  # so pgrep misses them). Result: lock gets swept WHILE rollback is
  # still running — a real concurrency hazard.
  #
  # Defer PID removal + FD release until after rollback completes at end
  # of this function. cleanup_on_error_finalize() handles both.

  # Only trigger rollback if we got past the merge step (state has changed).
  case "$CURRENT_STEP" in
    preflight|checkpoint_a|fetch|lock|init)
      log "Failure happened before any on-disk change. No rollback needed."
      if [ -n "$HISTORY_ID" ]; then
        history_update_result "fail" "Aborted at $CURRENT_STEP before state change"
      fi
      state_update "fail" "Aborted at $CURRENT_STEP"
      write_summary_json "fail" "Aborted at $CURRENT_STEP before state change"
      # v2.52.3: no rollback children to inherit FD 200 → safe to release now
      rm -f "$PID_FILE" 2>/dev/null || true
      exec 200>&- 2>/dev/null || true
      return
      ;;
  esac

  if [ -z "$ROLLBACK_TAG" ]; then
    log "CRITICAL: no rollback tag set but failure happened past pre-flight"
    state_update "fail" "CRITICAL: no rollback tag, step=$CURRENT_STEP"
    [ -n "$HISTORY_ID" ] && history_update_result "fail" "CRITICAL: no rollback tag"
    write_summary_json "fail" "CRITICAL: no rollback tag, step=$CURRENT_STEP"
    # v2.52.3: no rollback ran → safe to release
    rm -f "$PID_FILE" 2>/dev/null || true
    exec 200>&- 2>/dev/null || true
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
    # v2.52.3: still release lock+PID before exit 99 — rollback already
    # finished, no children to inherit FD 200.
    rm -f "$PID_FILE" 2>/dev/null || true
    exec 200>&- 2>/dev/null || true
    exit 99
  fi
  # v2.52.3: NOW it is safe to release the lock — rollback children have
  # finished, any FD 200 inheritors have exited.
  rm -f "$PID_FILE" 2>/dev/null || true
  exec 200>&- 2>/dev/null || true
}
trap cleanup_on_error EXIT

# ---------------------------------------------------------------------------
# Hermes SHADOW reviewer (#359 Layer 3) — advisory only, NEVER gates the update.
# After the real (deterministic / Claude) decision is made, ask the shared T4
# model for its own verdict and log both so we accumulate an agreement record.
# Once shadow data proves Hermes agrees, a later slice flips it to primary with
# Claude as fallback. Fully non-fatal: any failure logs UNAVAILABLE and moves on.
# ---------------------------------------------------------------------------
hermes_shadow_review() {
  local label=$1 prompt_file=$2 real_decision=$3
  [ -x "$REPO_ROOT/scripts/checkpoint-hermes.sh" ] || return 0
  # Run on the shared T4 (OLLAMA_REMOTE_BASE) if configured, else the box's OWN
  # local Ollama — checkpoint-hermes.sh falls back to localhost:11434 by design,
  # and every fleet box has llama3.1:8b locally. Skip ONLY if no Ollama is
  # reachable at all, so the shadow stays advisory + non-fatal and never delays a
  # real install. (Was gated on OLLAMA_REMOTE_BASE, which is now unset fleet-wide
  # since AI Suggest moved to each box's local Iris — that produced 0 shadow data.)
  local _shadow_ollama="${OLLAMA_REMOTE_BASE:-http://localhost:11434}"
  curl -sf --max-time 4 "${_shadow_ollama}/api/tags" >/dev/null 2>&1 || return 0

  local shadow_out hermes_verdict real_verdict agree="n/a"
  shadow_out=$(timeout 150 bash "$REPO_ROOT/scripts/checkpoint-hermes.sh" "$label" "$prompt_file" 2>/dev/null | head -1 || true)
  hermes_verdict=$(printf '%s' "$shadow_out" | sed -E 's/^DECISION: ([A-Z]+).*/\1/')
  [ -n "$hermes_verdict" ] || hermes_verdict="UNAVAILABLE"
  real_verdict=$(printf '%s' "$real_decision" | sed -E 's/.*DECISION: ([A-Z]+).*/\1/')
  [ -n "$real_verdict" ] || real_verdict="UNKNOWN"
  if [ "$hermes_verdict" != "UNAVAILABLE" ]; then
    [ "$hermes_verdict" = "$real_verdict" ] && agree="yes" || agree="NO"
  fi
  log "[HERMES-SHADOW] Checkpoint $label: real=$real_verdict hermes=$hermes_verdict agree=$agree"

  # Accumulate one JSONL row per checkpoint for later agreement analysis.
  local shadow_dir="$DATA_DIR/hermes-shadow"
  mkdir -p "$shadow_dir" 2>/dev/null || true
  printf '{"ts":"%s","run":"%s","branch":"%s","label":"%s","real":"%s","hermes":"%s","agree":"%s"}\n' \
    "$(date -u +%FT%TZ)" "${RUN_TS:-?}" "${BRANCH:-?}" "$label" "$real_verdict" "$hermes_verdict" "$agree" \
    >> "$shadow_dir/checkpoint-shadow.jsonl" 2>/dev/null || true
  return 0
}

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

  # v2.32.49 — Deterministic fast path. The vast majority of checkpoint
  # decisions are bash-classifiable (verify-sql markers, file presence, log
  # patterns). Try the deterministic script first. If it returns
  # GO/CAUTION/STOP we honor it. If UNDETERMINED, fall through to the AI path.
  # This cuts API spend ~10x and eliminates Haiku false-positive STOPs in
  # the common case (today's leaked-key false-STOP would have been a clean
  # GO under deterministic-A).
  if [ -x "$REPO_ROOT/scripts/checkpoint-deterministic.sh" ]; then
    local det_out="$out_file.det"
    if PRE_MERGE_SHA="${PRE_MERGE_SHA:-}" POST_MERGE_SHA="${POST_MERGE_SHA:-}" \
       timeout 30 bash "$REPO_ROOT/scripts/checkpoint-deterministic.sh" "$label" "$prompt_file" \
         > "$det_out" 2>>"$LOG_FILE"; then
      local det_decision
      det_decision=$(grep -m1 '^DECISION:' "$det_out" || true)
      case "$det_decision" in
        "DECISION: UNDETERMINED"*)
          log "Checkpoint $label: deterministic → UNDETERMINED, escalating to AI"
          rm -f "$det_out"
          ;;
        "DECISION: "*)
          log "Checkpoint $label: $det_decision (deterministic, no AI)"
          decision="$det_decision"
          decision_normalized=$(echo "$decision" | sed -E 's/^[^A-Z]*//')
          rm -f "$det_out" "$out_file"
          hermes_shadow_review "$label" "$prompt_file" "$decision_normalized"
          # Jump to the case statement at end of function via a goto-style
          # variable. (Bash has no goto; we just inline the case here.)
          case "$decision_normalized" in
            "DECISION: GO"*) return 0 ;;
            "DECISION: CAUTION"*)
              CAUTION_MODE=1
              log "Checkpoint $label: CAUTION — proceeding with extra monitoring"
              return 0 ;;
            "DECISION: STOP"*)
              fail "Checkpoint $label: STOP — ${decision_normalized#DECISION: STOP}" 2 ;;
          esac
          ;;
        *)
          log "Checkpoint $label: deterministic emitted unparseable line, escalating to AI"
          rm -f "$det_out"
          ;;
      esac
    else
      log "Checkpoint $label: deterministic script errored ($?), escalating to AI"
      rm -f "$det_out"
    fi
  fi

  # v2.73.0 — LOCAL AI is the PRIMARY checkpoint reviewer (T4 qwen2.5:14b or the
  # box's own llama3.1:8b via scripts/checkpoint-hermes.sh + retrieve-only RAG).
  # This removes the cloud-Claude dependency that FROZE the whole fleet: the CLI
  # subscription path times out / hits the org monthly-limit (4s empty response
  # → UNDETERMINED → STOP), and the API path needs a key #363 removed. Local AI
  # has none of those failure modes. Cloud stays a fallback only when local AI
  # is UNAVAILABLE (no reachable Ollama).
  local ai_done=0
  if [ -x "$REPO_ROOT/scripts/checkpoint-hermes.sh" ]; then
    log "Checkpoint $label: LOCAL AI reviewer (Ollama=${OLLAMA_REMOTE_BASE:-localhost:11434}, timeout ${timeout_secs}s)"
    if timeout "$timeout_secs" bash "$REPO_ROOT/scripts/checkpoint-hermes.sh" "$label" "$prompt_file" > "$out_file" 2>>"$LOG_FILE"; then
      case "$(grep -m1 '^DECISION:' "$out_file" 2>/dev/null)" in
        "DECISION: GO"*|"DECISION: CAUTION"*|"DECISION: STOP"*) ai_done=1 ;;
        *) log "Checkpoint $label: local AI UNAVAILABLE/unparseable → cloud fallback" ;;
      esac
    else
      log "Checkpoint $label: local AI reviewer errored/timed out → cloud fallback"
    fi
  fi

  # v2.32.20 — Cloud FALLBACK (only when local AI yielded no decision). API path
  # (checkpoint-runner.py, pay-per-token, no monthly cap) when ANTHROPIC_API_KEY
  # is set; else the Claude Code CLI subscription path.
  if [ "$ai_done" = "0" ]; then
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    # v2.32.28 — API path now uses tool use via scripts/checkpoint-runner.py.
    # The plain text-completion path failed Checkpoint B at Lucky's + Leg Lamp
    # because the prompts expect bash/sqlite3 execution; the model correctly
    # said "I cannot execute commands" and emitted DECISION: STOP. The new
    # runner exposes `bash` and `read_file` tools and loops the
    # tool_use → tool_result cycle until the model returns a text-only DECISION.
    log "Checkpoint $label: invoking Anthropic API w/ tool use (model=${CLAUDE_API_MODEL:-claude-haiku-4-5-20251001}, timeout ${timeout_secs}s)"
    if ! timeout "$timeout_secs" python3 "$REPO_ROOT/scripts/checkpoint-runner.py" "$label" "$prompt_file" \
         > "$out_file" 2>>"$LOG_FILE"; then
      log "Checkpoint $label: checkpoint-runner.py failed or timed out"
      log "Checkpoint $label output: $(head -c 1000 "$out_file" 2>/dev/null)"
      rm -f "$out_file"
      fail "Checkpoint $label: checkpoint-runner.py failure" 2
    fi
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
  fi  # end ai_done==0 cloud-fallback wrapper

  local decision
  # Try line-start first, then fall back to anywhere in the response.
  # Claude sometimes writes a summary before the DECISION line.
  # v2.32.34 — Haiku sometimes wraps the decision line in markdown bold
  # (`**DECISION: GO**`). Strip leading non-alphanumeric chars before the
  # case match so wildcard matching stays simple.
  decision=$(grep -m1 '^DECISION:' "$out_file" || grep -m1 'DECISION:' "$out_file" || true)
  decision_normalized=$(echo "$decision" | sed -E 's/^[^A-Z]*//')
  log "Checkpoint $label: $decision"
  log "--- Checkpoint $label full response ---"
  cat "$out_file" >> "$LOG_FILE"
  log "--- end Checkpoint $label response ---"
  rm -f "$out_file"

  # Shadow-compare only when CLOUD made the call (ai_done=0). When local AI was
  # already the primary reviewer, re-running it to "shadow itself" is redundant.
  [ "$ai_done" = "1" ] || hermes_shadow_review "$label" "$prompt_file" "$decision_normalized"

  case "$decision_normalized" in
    "DECISION: GO"*)
      return 0
      ;;
    "DECISION: CAUTION"*)
      CAUTION_MODE=1
      log "Checkpoint $label: CAUTION — proceeding with extra monitoring"
      return 0
      ;;
    "DECISION: STOP"*)
      fail "Checkpoint $label: STOP — ${decision_normalized#DECISION: STOP}" 2
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
[ -n "${CRON_JITTER_SECS:-}" ] && log "Cron jitter: slept ${CRON_JITTER_SECS}s before starting"

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

# 0b. Ensure NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is persisted in .env
# BEFORE the build runs (task #149, v2.52.6). Without a persistent key
# Next.js generates a random one per build → Server Action references
# in stale client bundles fail with "Failed to find Server Action 'X'"
# after every PM2 restart. Holmgren logged exactly that 2026-05-19 05:52
# after the v2.52.1 PM2 restart. Idempotent: skips if key already set.
if [ -x "$REPO_ROOT/scripts/ensure-server-actions-key.sh" ]; then
  bash "$REPO_ROOT/scripts/ensure-server-actions-key.sh" 2>&1 | tee -a "$LOG_FILE" || log "WARN: ensure-server-actions-key failed (non-fatal)"
  # Re-source so subsequent shell sees the new key
  if [ -f "$REPO_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$REPO_ROOT/.env"
    set +a
  fi
fi

# 0. Confirm we're in a clean git repo on a location branch
cd "$REPO_ROOT" || fail "cannot cd to $REPO_ROOT" 2
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ -z "$BRANCH" ] && fail "not in a git repo or detached HEAD" 2
log "Current branch: $BRANCH"

# Files maintained on main (LOCATION_PATHS_THEIRS) — get rewritten by every
# merge, so any uncommitted local edits to them are pre-cleaned before either
# the regular merge phase OR the drift-recovery branch switch below. Defined
# once here so both consumers share a single source of truth.
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
  # v2.82.32 — app writes apps/web/TODO_LIST.md at runtime (error-watch auto-file +
  # /api/todos mirror), leaving a tracked-modified file that aborts `git merge` ("Please
  # commit your changes or stash them before you merge"). This silently stalled the WHOLE
  # fleet at 2.82.10 (every nightly auto-update failed at the merge step → rollback). Reset
  # it to HEAD pre-merge; main's version wins and the app rewrites it after. The TODO data
  # itself lives in the DB (/api/todos), so the .md is a regenerable mirror — safe to discard.
  "apps/web/TODO_LIST.md"
)

# v2.32.81 — branch drift recovery (sidecar fix in v2.32.82).
# A box can be left on `main` by an interactive Claude/operator session.
# When that happens, every cron run no-ops because the pre-merge check at
# the FETCH phase sees "origin/main already merged into HEAD" — origin/main
# IS HEAD when local is on main. Holmgren sat on main for ~10h on
# 2026-05-08 and missed v2.32.76-.80 because of this; only caught by a
# manual fleet-status check.
#
# Recovery uses the heartbeat file (.auto-update-last-success.json), which
# records the canonical branch from the last successful run. The repo-root
# copy is per-branch (tracked on location/* branches, missing on main), so
# it disappears from the working tree exactly when we need it most. v2.32.82
# adds a sidecar copy in /home/ubuntu/sports-bar-data/ (gitignored, survives
# branch switches) and reads from there first. Falls back to repo-local
# (covers boxes that haven't run v2.32.82 yet, when on the right branch).
if [ "$BRANCH" = "main" ]; then
  HEARTBEAT_FILE="$REPO_ROOT/.auto-update-last-success.json"
  SIDECAR_HEARTBEAT="/home/ubuntu/sports-bar-data/.auto-update-last-success.json"
  EXPECTED_BRANCH=""
  for hb in "$SIDECAR_HEARTBEAT" "$HEARTBEAT_FILE"; do
    if [ -f "$hb" ]; then
      EXPECTED_BRANCH=$(python3 - "$hb" 2>/dev/null <<'PY' || echo ""
import json, sys
try:
    print(json.load(open(sys.argv[1])).get("branch", ""))
except Exception:
    pass
PY
)
      [ -n "$EXPECTED_BRANCH" ] && break
    fi
  done
  if [ -n "$EXPECTED_BRANCH" ] && [ "$EXPECTED_BRANCH" != "main" ]; then
    log "DRIFT: on 'main' but heartbeat says canonical branch is '$EXPECTED_BRANCH' — switching back"
    # Pre-clean uncommitted edits to LOCATION_PATHS_THEIRS files. Without
    # this, `git checkout EXPECTED_BRANCH` fails with "your local changes
    # would be overwritten". Same files the regular merge phase resets.
    for path in "${PRE_MERGE_RESET_PATHS[@]}"; do
      if [ -e "$REPO_ROOT/$path" ] && ! git diff --quiet HEAD -- "$path" 2>/dev/null; then
        git checkout HEAD -- "$path" 2>/dev/null || true
      fi
    done
    if git checkout "$EXPECTED_BRANCH" 2>&1 | tee -a "$LOG_FILE"; then
      BRANCH="$EXPECTED_BRANCH"
      log "Switched to $BRANCH; continuing update flow"
    else
      fail "could not switch from main to '$EXPECTED_BRANCH' — operator intervention needed (check 'git status' on the box)" 2
    fi
  elif [ -z "$EXPECTED_BRANCH" ]; then
    log "WARNING: on 'main' with no heartbeat at $SIDECAR_HEARTBEAT or $HEARTBEAT_FILE — cannot determine canonical branch; continuing as main"
  fi
fi

# 1. Check auto_update_state.enabled (unless manually triggered)
if [ "$TRIGGERED_BY" = "cron" ]; then
  ENABLED=$(sql "SELECT enabled FROM auto_update_state WHERE id=1;" 2>/dev/null || echo "0")
  if [ "$ENABLED" != "1" ]; then
    log "auto_update_state.enabled=$ENABLED (cron invocation); exiting early"
    update_last_attempt_sidecar "noop"
    exit 0
  fi
fi

# 2. Reviewer reachability — LOCAL AI (v2.73.0+) is PRIMARY; Claude is fallback.
# If the local-AI checkpoint (checkpoint-hermes.sh + a reachable Ollama) is
# available, a missing Claude reviewer is DOWNGRADED to a warning instead of a
# hard preflight fail — local AI alone is sufficient to gate the update. This is
# what lets a fresh box that has Ollama (e.g. Lime Kiln) self-update without the
# Claude Code CLI installed (v2.81.2 — "push the local AI").
LOCAL_AI_REVIEWER=0
if [ -x "$REPO_ROOT/scripts/checkpoint-hermes.sh" ]; then
  _ollama_base="${OLLAMA_REMOTE_BASE:-http://localhost:11434}"
  if curl -s --max-time 5 "${_ollama_base}/api/version" >/dev/null 2>&1; then
    LOCAL_AI_REVIEWER=1
    log "Reviewer: LOCAL AI primary (checkpoint-hermes + Ollama ${_ollama_base})"
  fi
fi
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  command -v curl >/dev/null 2>&1 || fail "curl not on PATH (required for Anthropic API)" 2
  command -v python3 >/dev/null 2>&1 || fail "python3 not on PATH (required for API JSON build)" 2
  log "Claude path: Anthropic API (model=${CLAUDE_API_MODEL:-claude-opus-4-7}) — fallback to local AI primary"
elif command -v claude >/dev/null 2>&1 && timeout 15 claude --version >/dev/null 2>&1; then
  log "Claude path: Claude Code CLI ($(claude --version 2>/dev/null | head -1)) — fallback to local AI primary"
elif [ "$LOCAL_AI_REVIEWER" = "1" ]; then
  log "WARN: no Claude reviewer (no ANTHROPIC_API_KEY, no Claude CLI) — LOCAL AI is sufficient; proceeding with local-AI-only checkpoints."
else
  fail "No reviewer available: neither LOCAL AI (Ollama + checkpoint-hermes.sh) nor ANTHROPIC_API_KEY nor Claude Code CLI" 2
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
# Array PRE_MERGE_RESET_PATHS is defined once near the top of the script
# so both this loop and the drift-recovery block can share it (v2.32.81).
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
  # v2.32.80 — refresh os.* fields in the heartbeat even on no-op runs so
  # the Fleet Dashboard reflects kernel/OS changes that happened outside
  # auto-update (apt dist-upgrade + reboot). No-op if values unchanged.
  refresh_heartbeat_os_only
  # Write a "no-op pass" history row so the Sync tab UI shows the run occurred
  history_insert_start
  history_update_result "pass" "no update available"
  state_update "pass" "no update available"
  write_summary_json "pass" "no update available"
  update_last_attempt_sidecar "noop"
  exit 0
fi

COMMITS_TO_MERGE=$(git log --oneline HEAD..origin/main | wc -l)
log "Commits pending merge: $COMMITS_TO_MERGE"

# v2.82.15 — Move aside UNTRACKED files that collide with incoming tracked files.
# git merge aborts ("untracked working tree files would be overwritten by merge") when a
# non-ignored untracked local file (e.g. .env.bak, a stray scripts/*.ts) shares a path with
# a file main ADDS. The clean-check above uses --untracked-files=no, so it misses these —
# this rolled back 4 of 6 boxes on 2026-06-23. Back them up (never destroy) so the merge
# proceeds; operator can recover from .auto-update-untracked-bak/<ts>/ if ever needed.
# --exclude-standard scopes to non-ignored files (the ones git actually blocks on), so it
# won't touch legitimately-ignored .env / data files.
mapfile -t _collisions < <(comm -12 \
  <(git ls-files --others --exclude-standard | sort) \
  <(git diff --name-only HEAD origin/main | sort))
if [ "${#_collisions[@]}" -gt 0 ]; then
  COLLIDE_BAK="$REPO_ROOT/.auto-update-untracked-bak/$RUN_TS"
  log "Untracked collisions with incoming files (${#_collisions[@]}) — backing up to ${COLLIDE_BAK#"$REPO_ROOT"/}/ so the merge can proceed:"
  for u in "${_collisions[@]}"; do
    mkdir -p "$COLLIDE_BAK/$(dirname "$u")"
    log "  moving aside: $u"
    mv "$REPO_ROOT/$u" "$COLLIDE_BAK/$u" 2>&1 | tee -a "$LOG_FILE" || true
  done
fi

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
      update_last_attempt_sidecar "noop"
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
      update_last_attempt_sidecar "noop"
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
      update_last_attempt_sidecar "noop"
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

# v2.32.33 — Risk-aware model picker. If LOCATION_UPDATE_NOTES.md flags this
# update with `**Checkpoint model:** sonnet|opus`, override the default Haiku
# for all three checkpoints. Useful for big refactors that need cross-file
# reasoning. Skip if operator already set CLAUDE_API_MODEL in .env.
if [ -z "${CLAUDE_API_MODEL:-}" ]; then
  RISK_MODEL=$(grep -m1 -oE "Checkpoint model:[[:space:]]*(haiku|sonnet|opus)" "$REPO_ROOT/docs/LOCATION_UPDATE_NOTES.md" 2>/dev/null | grep -oE "(haiku|sonnet|opus)$" | head -1)
  case "$RISK_MODEL" in
    sonnet)
      export CLAUDE_API_MODEL="claude-sonnet-4-6"
      log "Risk-model override → claude-sonnet-4-6 (per LOCATION_UPDATE_NOTES.md)"
      ;;
    opus)
      export CLAUDE_API_MODEL="claude-opus-4-7"
      log "Risk-model override → claude-opus-4-7 (per LOCATION_UPDATE_NOTES.md)"
      ;;
  esac
fi

run_checkpoint "A" "$PROMPTS_DIR/checkpoint-a.txt" 600

# If dry-run, report what we WOULD do and stop here (before any state change).
if [ "$DRY_RUN" -eq 1 ]; then
  log "DRY-RUN: would merge $COMMITS_TO_MERGE commits from origin/main onto $BRANCH"
  log "DRY-RUN: would backup DB to $BACKUP_DIR/pre-update-$RUN_TS.db"
  log "DRY-RUN: would create rollback tag rollback-$RUN_TS at $PRE_MERGE_SHA"
  log "DRY-RUN: stopping now — nothing changed on disk"
  history_update_result "pass" "dry-run stopped after checkpoint A"
  state_update "pass" "dry-run"
  write_summary_json "pass" "dry-run — no changes made"
  update_last_attempt_sidecar "noop"
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
  # v2.32.35 — per-location hardware reference docs. v2.32.23 added stub
  # files for all 6 locations to main; some location branches (Stoneyard
  # Appleton, Greenville) had their own pre-existing versions → add/add
  # conflict on merge → exit 3. Location's version wins because each
  # location maintains its own hardware notes (DB is the source of truth
  # for actual IPs; these files are quick-reference for operators).
  ".claude/locations"
  # v2.32.38 — ecosystem.config.js + hardware-config.ts MUST be per-location.
  # Stoneyard committed their own version of both with hardcoded API key
  # ("12548RK0...") + Atlas processor IP "10.40.10.102" to main; without
  # OURS protection, every other location's auto-update would inherit
  # Stoneyard's credentials. Lucky's checkpoint A correctly STOPPED on
  # this. Main now ships these as generic env-driven / empty defaults;
  # each location branch holds its own real values.
  "ecosystem.config.js"
  "apps/web/src/lib/hardware-config.ts"
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
  # v2.73.7 — apps/web/TODO_LIST.md is a shared dev TODO updated on main
  # ("chore: Update TODO" commits). It sits directly under apps/web/, NOT under
  # apps/web/src/, so the SHARED_SOFTWARE_PREFIXES fallback below does NOT catch
  # it — without this explicit entry a content conflict on it aborts the whole
  # update as a "non-whitelisted file" (observed on graystone 2026-06-18 14:03,
  # the first conflict to surface once the local-AI Checkpoint A fix let the
  # 29-commit backlog reach the merge step). Main always wins.
  "apps/web/TODO_LIST.md"
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
  "apps/web/src/services/"
  "apps/web/src/config/"
  "apps/web/src/middleware/"
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
  # v2.32.35 — also catch add/add (^AA) + delete-by-them/us (DU/UD) in
  # addition to modify/modify (^UU). Stoneyard-Appleton hit add/add on
  # .claude/locations/stoneyard-appleton.md when v2.32.23 added a stub on
  # main and the location had its own pre-existing version.
  CONFLICT_RE='^(UU|AA|DU|UD)'

  # v2.52.5 fix (task #155, Mode 1 of auto-update-failure-modes memory):
  # modify/delete (UD) auto-resolver with caller-grep. Pre-v2.52.5, the
  # resolver tried `git checkout --theirs` on UD conflicts, which fails
  # silently because main has NO "theirs" version when it deleted the
  # file. Trap then aborted the merge — graystone hit this 2026-05-19
  # when v2.48.x verified-dead-route sweeps merged into a location that
  # had whitespace mods on those routes.
  #
  # Strategy: a UD conflict (deleted by them=main, modified by us=location)
  # means main intentionally removed the file. If our caller-grep proves
  # there are no live references to it in apps/web/src/ (the live code
  # paths), we accept the deletion via `git rm`. If references DO exist,
  # the deletion would break runtime — STOP for human review.
  #
  # Symmetric DU (deleted by us=location, modified by them=main) is the
  # rarer case where the location deleted a file that main edited. We
  # currently treat that the same way (caller-grep → rm or STOP) since
  # the location's intent was clearly "remove this file."
  resolve_modify_delete() {
    local conflicts
    conflicts=$(git status --porcelain | grep -E '^(UD|DU) ' || true)
    [ -z "$conflicts" ] && return 0
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      local conflict_path="${line:3}"
      local status_code="${line:0:2}"
      local basename_part
      basename_part=$(basename "$conflict_path" | sed -E 's/\.(ts|tsx|js|jsx|md|sql|json)$//')
      # Caller-grep: scan apps/web/src for imports/refs to this file's
      # basename. Multiple variants to catch each style of import.
      local refs=0
      if [ -d "$REPO_ROOT/apps/web/src" ]; then
        refs=$(grep -rlE "(['\"\`]).*${basename_part}\\1|/${basename_part}\\b" \
          "$REPO_ROOT/apps/web/src" "$REPO_ROOT/packages" 2>/dev/null | \
          grep -v "$conflict_path" | wc -l)
      fi
      if [ "$refs" -eq 0 ]; then
        log "  modify/delete ($status_code): accepting deletion of $conflict_path (0 live refs to basename '$basename_part')"
        git rm -f "$conflict_path" 2>&1 | tee -a "$LOG_FILE" || true
      else
        log "  modify/delete ($status_code): $conflict_path has $refs live refs — STOP for human review"
        git status --porcelain "$conflict_path" | tee -a "$LOG_FILE"
        return 1  # signal that auto-resolve can't handle this
      fi
    done <<<"$conflicts"
    return 0
  }
  if ! resolve_modify_delete; then
    git merge --abort 2>/dev/null || true
    fail "modify/delete conflict on file with live callers — needs human review" 3
  fi

  for path in "${LOCATION_PATHS_OURS[@]}"; do
    # If the path is a directory, the status query lists every conflicted
    # file inside it; resolve each one individually.
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      conflict_path="${line:3}"
      log "  keeping LOCATION version: $conflict_path"
      git checkout --ours "$conflict_path" 2>&1 | tee -a "$LOG_FILE"
      git add "$conflict_path"
    done < <(git status --porcelain "$path" 2>/dev/null | grep -E "$CONFLICT_RE")
  done
  for path in "${LOCATION_PATHS_THEIRS[@]}"; do
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      conflict_path="${line:3}"
      log "  taking MAIN version: $conflict_path"
      git checkout --theirs "$conflict_path" 2>&1 | tee -a "$LOG_FILE"
      git add "$conflict_path"
    done < <(git status --porcelain "$path" 2>/dev/null | grep -E "$CONFLICT_RE")
  done

  # Prefix-based shared-software fallback. Any remaining conflicted file
  # whose path starts with a SHARED_SOFTWARE_PREFIXES entry takes MAIN.
  # Files in LOCATION_PATHS_OURS were already resolved above so the
  # fallback only fires on files that ARE shared code.
  if git status --porcelain | grep -qE "$CONFLICT_RE"; then
    while IFS= read -r conflict_line; do
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
    done < <(git status --porcelain | grep -E "$CONFLICT_RE")
  fi

  # Any STILL-remaining conflict = unexpected file, human required
  if git status --porcelain | grep -qE "$CONFLICT_RE"; then
    log "Unexpected merge conflict on non-whitelisted files (not covered by OURS/THEIRS/prefix fallback):"
    git status --porcelain | grep -E "$CONFLICT_RE" | tee -a "$LOG_FILE"
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
# PHASE: SCHEMA MIGRATE (drizzle-kit) — v2.54.1+
# ===========================================================================
# Apply pending schema changes by running drizzle-kit migrate against
# committed migration files in drizzle/. Replaces the v2.8-v2.53 `push`
# flow which had a known silent-abort failure mode (CLAUDE.md Gotcha #6):
# push aborts on a pre-existing index, but exits 0, and any CREATE TABLE
# scheduled after the failing point is silently skipped. v2.51 shipped
# this way to 5 fleet boxes — NeighborhoodEvent never created, preemptive-
# strike scheduler threw "no such table" every 10 min for ~24 hours
# before being caught.
#
# Migrate has none of those failure modes: pending migrations are tracked
# in __drizzle_migrations, missing migrations are applied one-at-a-time,
# any SQL error fails LOUD with a non-zero exit. Schema state is
# deterministic from the migration files in git, not from in-place diff.
#
# Step 1: bootstrap-drizzle-migrations.sh marks the current committed
# migrations as "already applied" if they aren't already. Idempotent —
# no-op after first run on a given DB. Bridges existing fleet boxes from
# the push workflow without touching their schemas.
#
# Step 2: drizzle-kit migrate runs any pending migrations. On a freshly-
# bootstrapped box this is a no-op. On a box that's been on migrate for
# a while, this applies whatever was generated since the last update.
#
# Legacy `ensure-schema.sh` and the push fallback handling have been
# removed — the migrate flow eliminates the failure modes they existed
# to work around. If they're needed again, git history has them.
step "schema_migrate"
log "Bootstrap drizzle migrations + run migrate"
SCHEMA_MIGRATE_LOG="$LOG_DIR/drizzle-migrate-$(date +%s).log"

# --- Step 1: bootstrap (idempotent) ---
if bash "$REPO_ROOT/scripts/bootstrap-drizzle-migrations.sh" "$DB_PATH" 2>&1 | tee -a "$SCHEMA_MIGRATE_LOG" | tee -a "$LOG_FILE"; then
    log "bootstrap-drizzle-migrations.sh OK"
else
    fail "bootstrap-drizzle-migrations.sh failed — see $SCHEMA_MIGRATE_LOG" 4
fi

# --- Step 2: run migrate ---
if NODE_ENV=development npx drizzle-kit migrate 2>&1 | tee -a "$SCHEMA_MIGRATE_LOG" | tee -a "$LOG_FILE"; then
    log "drizzle-kit migrate completed cleanly"
else
    fail "drizzle-kit migrate failed — see $SCHEMA_MIGRATE_LOG. To re-attempt manually: cd $REPO_ROOT && NODE_ENV=development npx drizzle-kit migrate" 4
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
# v2.54.1+ — adapted to read the migrate log. Both `push` and `migrate`
# emit similar destructive-operation strings ("drop table X" etc.) when
# they would lose data. We scan both logs so this block keeps working
# during the legacy push fallback window AND after it's removed.
DESTRUCT_LOG="${SCHEMA_MIGRATE_LOG:-${SCHEMA_PUSH_LOG:-}}"
if [ -n "$DESTRUCT_LOG" ] && [ -f "$DESTRUCT_LOG" ] && grep -qiE "you're about to (delete|drop)|drop (table|column)|data.loss|truncate" "$DESTRUCT_LOG" 2>/dev/null; then
  DESTRUCTIVE_MARKER="$BACKUP_FILE.destructive"
  log "Schema migration included destructive operations — writing $DESTRUCTIVE_MARKER (rollback will auto-restore DB)"
  {
    echo "runId=$(basename "$LOG_FILE" .log)"
    echo "detectedAtUtc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "preMergeSha=${PRE_MERGE_SHA:-unknown}"
    echo "postMergeSha=${POST_MERGE_SHA:-unknown}"
    echo "--- detected lines ---"
    grep -iE "you're about to|drop (table|column)|data.loss|truncate|dropping" "$DESTRUCT_LOG" 2>/dev/null | head -20
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
run_checkpoint "B" "$PROMPTS_DIR/checkpoint-b.txt" 900

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
# Save the pre-build .next as .next.bak so degraded-up recovery (below) can
# restore it if the new build fails. v2.32.x already did this for the
# rollback path; v2.52.0 promotes .next.bak from "input to rollback.sh" to
# "primary in-place recovery artifact" so we don't need a full git reset
# for compile-only failures.
if [ -d "$REPO_ROOT/apps/web/.next" ] && [ ! -d "$REPO_ROOT/apps/web/.next.bak" ]; then
  cp -al "$REPO_ROOT/apps/web/.next" "$REPO_ROOT/apps/web/.next.bak" 2>/dev/null || cp -a "$REPO_ROOT/apps/web/.next" "$REPO_ROOT/apps/web/.next.bak"
fi
npx turbo run build --force 2>&1 | tee -a "$LOG_FILE"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then
  # v2.52.0 — DEGRADED-UP recovery instead of full rollback.
  #
  # Pre-v2.52.0: any build failure called `fail "npm run build failed" 4`
  # which triggered the cleanup trap → rollback.sh → git reset --hard →
  # PM2 restart on rolled-back code → ~5 min service interruption × 6
  # boxes simultaneously when main has a bad commit (2026-05-19 geocoder TS).
  #
  # Now: leave the merge commit in place, restore the prior .next/ artifact
  # so PM2 serves the previous-good build, reload PM2 to drop any stale
  # module caches, mark history result 'fail_build_kept_old', exit 2.
  # The next cron picks up either (a) a fix on main → succeeds, or (b)
  # the same broken main → exits 2 again with no churn.
  #
  # SAFETY GATE: this works only for pure-code build failures. If the
  # merge included a schema change or a package-major bump, the previous
  # build CAN'T safely serve the new state. Detection: did schema.ts or
  # drizzle/*.sql or package-lock.json *.major* change? If so, fall back
  # to the v2.32.x rollback path. Otherwise, degraded-up.
  log "❌ Build failed. Evaluating recovery strategy (degraded-up vs full rollback)..."
  BUILD_RECOVERY="degraded_up"
  if git -C "$REPO_ROOT" diff --name-only "$PRE_MERGE_SHA" "$POST_MERGE_SHA" 2>/dev/null | grep -qE "packages/database/src/schema\.ts|drizzle/[0-9]+_.*\.sql$"; then
    log "  Merge includes schema changes — previous build may not handle new schema. Falling back to full rollback."
    BUILD_RECOVERY="full_rollback"
  fi
  if [ "$BUILD_RECOVERY" = "degraded_up" ] && [ -d "$REPO_ROOT/apps/web/.next.bak" ]; then
    log "  → DEGRADED-UP: restoring .next from .next.bak, leaving merge applied, reloading PM2"
    rm -rf "$REPO_ROOT/apps/web/.next"
    mv "$REPO_ROOT/apps/web/.next.bak" "$REPO_ROOT/apps/web/.next"
    pm2 reload sports-bar-tv-controller --update-env 2>&1 | tee -a "$LOG_FILE" || true
    sleep 5
    if curl -sf -m 5 http://localhost:3001/api/health >/dev/null 2>&1; then
      log "  ✓ Bar still serving on previous-good build. Next cron will retry."
      log "  History row recorded with result='fail_build_kept_old' (exit 2 — different from rollback exit 4)."
    else
      log "  ⚠ Health check failed after PM2 reload — degraded-up didn't help. Falling back to full rollback."
      BUILD_RECOVERY="full_rollback"
    fi
  fi
  if [ "$BUILD_RECOVERY" = "full_rollback" ]; then
    fail "npm run build failed and degraded-up was unsafe — falling back to full rollback" 4
  else
    # v2.52.3 fix (code-reviewer audit Finding #3): `trap - EXIT` disarmed
    # ALL signals — a SIGTERM between the trap clear and the exit would
    # skip cleanup entirely. Replace with an explicit cleanup-only trap
    # that still runs PID+FD release but skips rollback.
    trap 'rm -f "$PID_FILE" 2>/dev/null || true; exec 200>&- 2>/dev/null || true' EXIT
    exit 2
  fi
fi

# ===========================================================================
# PHASE: PM2 RESTART
# ===========================================================================
step "pm2_restart"
# v2.50.14: record exact pm2_restart moment so Checkpoint C's PM2 crash-pattern
# detector can filter out stale crashes from BEFORE this restart. Without this,
# any unrelated crash in the last 80 PM2 log lines trips the deterministic STOP
# (Holmgren hit this 2026-05-19 with a 5-min-old JSON parse error from a
# chat/RAG race). Export so checkpoint-deterministic.sh's awk filter sees it.
export PM2_RESTART_EPOCH=$(date +%s)
log "PM2_RESTART_EPOCH=$PM2_RESTART_EPOCH (Checkpoint C crash scan will ignore older log lines)"
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
run_checkpoint "C" "$PROMPTS_DIR/checkpoint-c.txt" 600

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
  # v2.32.72 — capture OS codename + kernel for the fleet dashboard so
  # operators can see at a glance which boxes are still on jammy vs noble
  # (matters during the 22.04 → 24.04 upgrade campaign per
  # docs/OS_UPGRADE_RUNBOOK.md).
  HB_OS_CODENAME=$(lsb_release -cs 2>/dev/null || echo "unknown")
  HB_OS_VERSION=$(lsb_release -rs 2>/dev/null || echo "unknown")
  HB_OS_KERNEL=$(uname -r 2>/dev/null || echo "unknown")
  {
    printf '{\n'
    printf '  "version": "%s",\n' "${POST_MERGE_VERSION:-unknown}"
    printf '  "branch": "%s",\n' "${BRANCH:-unknown}"
    printf '  "commitSha": "%s",\n' "${POST_MERGE_SHA:-unknown}"
    printf '  "successAt": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf '  "successAtUnix": %d,\n' "$(date +%s)"
    printf '  "runId": "%s",\n' "$(basename "$LOG_FILE" .log)"
    printf '  "verifyInstall": %s,\n' "$VERIFY_INSTALL_JSON"
    printf '  "os": { "codename": "%s", "version": "%s", "kernel": "%s" },\n' \
      "$HB_OS_CODENAME" "$HB_OS_VERSION" "$HB_OS_KERNEL"
    if [ -n "$HB_FILE_CHECKSUMS" ]; then
      printf '  "configChecksums": {\n%s\n  },\n' "$HB_FILE_CHECKSUMS"
    fi
    if [ -n "$HB_ROW_COUNTS" ]; then
      printf '  "dbRowCounts": {\n%s\n  },\n' "$HB_ROW_COUNTS"
    fi
    # Schema version of this heartbeat record so dashboard knows which fields are present
    printf '  "heartbeatSchemaVersion": 3\n'
    printf '}\n'
  } > "$REPO_ROOT/.auto-update-last-success.json"
  # v2.32.82 — sidecar copy in gitignored data dir so the drift-recovery
  # block at line ~580 has a persistent source for the canonical branch
  # name when the box is sitting on main (where the in-repo copy is gone
  # from the working tree).
  if [ -d "/home/ubuntu/sports-bar-data" ]; then
    cp -f "$REPO_ROOT/.auto-update-last-success.json" "/home/ubuntu/sports-bar-data/.auto-update-last-success.json" 2>/dev/null || true
  fi
  git -C "$REPO_ROOT" add -f ".auto-update-last-success.json" 2>/dev/null || true
  if ! git -C "$REPO_ROOT" diff --cached --quiet -- ".auto-update-last-success.json" 2>/dev/null; then
    git -C "$REPO_ROOT" commit -q -m "chore(heartbeat): update .auto-update-last-success.json ($(date +%Y-%m-%d-%H-%M))" 2>/dev/null || true
    log "Heartbeat file committed"
  fi
fi

# v2.54.3 — Snapshot the just-verified release to /home/ubuntu/sports-bar-releases/
# so scripts/instant-rollback.sh can restore it in ~5s without re-checkout
# + rebuild. Snapshot is "known good" by construction — we got here only
# because verify-install passed. Non-fatal: if snapshot fails, the update
# is still successful; only instant-rollback for THIS version is unavailable
# (operator can still use auto-update.sh's normal rollback path).
if bash "$REPO_ROOT/scripts/snapshot-release.sh" 2>&1 | tee -a "$LOG_FILE"; then
  log "Release snapshot OK"
else
  log "WARN: snapshot-release.sh returned non-zero — instant-rollback unavailable for this version, but update still successful"
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

# v2.50.11 — Fleet auto-update stagger. If scripts/fleet-schedule.json
# exists, re-run install-auto-update-timer.sh so this location's systemd
# timer reflects the (possibly updated) stagger slot. install-auto-update-timer.sh
# is idempotent — when nothing changed it just re-writes the same unit
# files and reloads systemd (~1s). When the slot moved (operator edited
# fleet-schedule.json and pushed, OR a new entry pushed this location
# to a different slot), the timer updates without an operator touching
# the box. Non-fatal: errors here are logged and ignored, so the
# auto-update success status isn't affected.
if [ -f "$REPO_ROOT/scripts/fleet-schedule.json" ] && [ -x "$REPO_ROOT/scripts/install-auto-update-timer.sh" ]; then
  if bash "$REPO_ROOT/scripts/install-auto-update-timer.sh" >/tmp/fleet-stagger-sync.log 2>&1; then
    SYNCED_SLOT=$(grep -E "OnCalendar:" /tmp/fleet-stagger-sync.log | tail -1 | sed -E 's/.*OnCalendar: //')
    log "Fleet stagger: re-synced timer to $SYNCED_SLOT"
  else
    log "⚠ Fleet stagger: install-auto-update-timer.sh failed (continuing — see /tmp/fleet-stagger-sync.log)"
  fi
fi

# v2.50.13 — Standing Rule 11: RAG rescan after every successful auto-update.
# Path-aware via scripts/rag-rescan-if-needed.sh — it diffs PRE vs POST
# commit SHAs, checks if any RAG-indexed paths changed (CLAUDE.md, docs/**,
# .claude/locations/*.md, packages/*/README.md, memory/*.md, drizzle SQL),
# and only kicks off the actual scan if so. Returns immediately (the scan
# runs as a detached background job, 25-40 min on iGPU). Non-fatal —
# failure here doesn't roll back the auto-update; the operator can re-run
# the script manually if it errored.
#
# Why this matters: docs/AUTO_UPDATE_TROUBLESHOOTING.md and the bartender
# runbooks aren't useful to operators (or to the Claude CLI at checkpoints)
# until they're embedded in the local RAG store. Without this hook, every
# location's RAG drifts further out of date with every doc-touching update,
# and the AI Hub chat answers stale questions. Wiring this here means every
# location's RAG self-heals on every update — no manual operator action
# needed at any of the 6 fleet boxes.
if [ -x "$REPO_ROOT/scripts/rag-rescan-if-needed.sh" ]; then
  RESCAN_SINCE="${PRE_MERGE_SHA:-HEAD~5}"
  if bash "$REPO_ROOT/scripts/rag-rescan-if-needed.sh" --since "$RESCAN_SINCE" >/tmp/auto-update-rag-rescan.log 2>&1; then
    log "RAG rescan: $(tail -1 /tmp/auto-update-rag-rescan.log)"
  else
    log "⚠ RAG rescan: returned non-zero (continuing — see /tmp/auto-update-rag-rescan.log)"
  fi
fi

# v2.64.x — Self-updating docs (Standing Rule 1 automated): flag code-grounded
# docs whose source code changed in this merge, so they get refreshed before
# they rot. Maps live in docs/doc-source-map.json; checker is non-fatal and
# files ONE aggregated "refresh stale docs" TODO (source=self-updating-docs).
# See docs/SELF_UPDATING_DOCS.md. A doc with wrong steps is worse than none —
# a bartender follows it and it fails.
if [ -f "$REPO_ROOT/scripts/docs/check-stale-docs.mjs" ] && command -v node >/dev/null 2>&1; then
  STALE_SINCE="${PRE_MERGE_SHA:-HEAD~5}"
  if node "$REPO_ROOT/scripts/docs/check-stale-docs.mjs" --since "$STALE_SINCE" --file-todo \
       >/tmp/auto-update-stale-docs.log 2>&1; then
    log "stale-docs check: $(grep -E 'need refresh|no docs stale' /tmp/auto-update-stale-docs.log | head -1)"
  else
    log "⚠ stale-docs check: returned non-zero (continuing — see /tmp/auto-update-stale-docs.log)"
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
    git -C "$REPO_ROOT" fetch -q origin "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE" || true
    if git -C "$REPO_ROOT" push origin "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE"; then
      log "Push succeeded — Fleet Dashboard will reflect this update within 5 min (cache TTL)"
    else
      # Push rejected (origin diverged). Reconcile by MERGE, never `pull --rebase`:
      # against a badly-diverged origin (e.g. frozen for weeks) a rebase replays
      # the box's local commits and gets STUCK in a 70+ commit interactive rebase,
      # silently leaving the working tree detached on old code. That tangle hit
      # the ENTIRE fleet (2026-06-14) — every box stuck-rebase, origin frozen at
      # 2.55.48. A merge with -X ours keeps THIS box's authoritative content and
      # just records origin's history so the retry push fast-forwards. If even the
      # merge conflicts, abort it and leave the box healthy (push is non-fatal).
      log "Push rejected (origin diverged) — reconciling via merge (-X ours), NOT rebase"
      if git -C "$REPO_ROOT" merge --no-edit -X ours "origin/$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE"; then
        if git -C "$REPO_ROOT" push origin "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE"; then
          log "Push succeeded after merge-reconcile"
        else
          log "WARNING: push still failed after merge — location healthy, Fleet Dashboard lagging; manual reconcile needed"
        fi
      else
        git -C "$REPO_ROOT" merge --abort 2>/dev/null || true
        log "WARNING: merge-reconcile conflicted — aborted (NOT rebasing). Location healthy; manual reconcile needed"
      fi
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
update_last_attempt_sidecar "success"
exit 0
