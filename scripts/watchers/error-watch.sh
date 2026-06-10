#!/usr/bin/env bash
# scripts/watchers/error-watch.sh — autonomous PM2 error-log watcher.
# Phase 2 of the self-monitoring architecture (docs/HOOK_COVERAGE.md).
#
# Tails the sports-bar-tv-controller PM2 error log + greps each new line
# against a signature library. On match, writes one row to the
# error_watch_events DB table (kind='error'). Every HEARTBEAT_INTERVAL
# seconds writes a kind='heartbeat' row regardless of log activity, so
# "table has no recent rows" means the watcher itself died (not "no errors").
#
# Run as a systemd-user unit. Restart=always handles transient crashes.
# Idempotent: re-running is safe (no global state outside the DB rows).
#
# v2.55.23+

set -u

DB=/home/ubuntu/sports-bar-data/production.db
LOG_GLOB="/home/ubuntu/.pm2/logs/sports-bar-tv-controller-error*.log"
HEARTBEAT_INTERVAL_SEC=${HEARTBEAT_INTERVAL_SEC:-300}   # 5 min default
DEDUP_WINDOW_SEC=${DEDUP_WINDOW_SEC:-30}                # don't record same signature more than once per 30s

# Signature label → grep -E pattern.
# Each label is what gets stored in error_watch_events.signature. The
# patterns are intentionally permissive (we'd rather record a likely-error
# than miss one); downstream consumers can filter by signature.
declare -A SIGS=(
  ["error_level"]='\[ERROR\]|ERROR:|"level":"error"'
  ["unhandled_rejection"]='UnhandledPromiseRejection|unhandledRejection'
  ["fk_constraint"]='FOREIGN KEY constraint'
  ["econn_refused"]='ECONNREFUSED'
  ["etimedout"]='ETIMEDOUT'
  ["module_not_found"]='Cannot find module'
  ["type_error"]='TypeError:|ReferenceError:'
  ["exception"]='Exception'
)

# In-memory dedup: track last detected_at per signature.
declare -A LAST_SEEN

# DB insert helper. SQLite insert via sqlite3 CLI. Sanitizes single quotes.
db_insert() {
  local kind="$1" sig="$2" sample="$3" src="$4"
  local sample_esc src_esc
  sample_esc=$(printf '%s' "${sample:0:200}" | sed "s/'/''/g")
  src_esc=$(printf '%s' "$src" | sed "s/'/''/g")
  sqlite3 "$DB" "INSERT INTO error_watch_events (id, kind, signature, sample, source_file, detected_at) VALUES (lower(hex(randomblob(8))), '$kind', '$sig', '$sample_esc', '$src_esc', strftime('%s','now'));" 2>/dev/null
}

# Initial 'startup' row — proves the watcher started for THIS service-start.
db_insert "startup" "service_start" "error-watch.sh starting; HEARTBEAT_INTERVAL_SEC=$HEARTBEAT_INTERVAL_SEC; LOG_GLOB=$LOG_GLOB" "error-watch.sh"

# Background heartbeat — independent of log activity.
(
  while true; do
    sleep "$HEARTBEAT_INTERVAL_SEC"
    sqlite3 "$DB" "INSERT INTO error_watch_events (id, kind, signature, sample, source_file, detected_at) VALUES (lower(hex(randomblob(8))), 'heartbeat', 'watcher_alive', '', 'error-watch.sh', strftime('%s','now'));" 2>/dev/null
  done
) &
HEARTBEAT_PID=$!
trap 'kill $HEARTBEAT_PID 2>/dev/null' EXIT INT TERM

# Strip ANSI color codes; many PM2 log lines come pre-colored.
strip_ansi() {
  sed 's/\x1b\[[0-9;]*[mK]//g'
}

# Main tail loop. -F follows rotation, -n 0 starts at end (we only care
# about NEW errors after startup, not historical). Multiple log files
# (rotated) are followed via glob.
tail -n 0 -F $LOG_GLOB 2>/dev/null | while IFS= read -r raw; do
  line=$(printf '%s' "$raw" | strip_ansi)
  [ -z "$line" ] && continue

  for sig in "${!SIGS[@]}"; do
    pattern="${SIGS[$sig]}"
    if printf '%s' "$line" | grep -qE "$pattern"; then
      now=$(date +%s)
      last="${LAST_SEEN[$sig]:-0}"
      if [ $((now - last)) -lt "$DEDUP_WINDOW_SEC" ]; then
        # Skip duplicate within dedup window.
        continue
      fi
      LAST_SEEN[$sig]=$now
      db_insert "error" "$sig" "$line" "$LOG_GLOB"
    fi
  done
done
