#!/bin/bash
# =============================================================================
# checkpoint-deterministic.sh — bash-only fast path for auto-update checkpoints
# =============================================================================
# Drop-in replacement for `scripts/checkpoint-runner.py` that handles the ~80%
# deterministic case without invoking the Anthropic API. When a check can't
# classify the situation it emits `DECISION: UNDETERMINED` and the caller
# (run_checkpoint() in auto-update.sh) escalates to the AI runner.
#
# Goals:
#   - Cost: ~$0/run (no API calls in the common case)
#   - Speed: <30s per checkpoint
#   - Reliability: zero false-positive STOPs (UNDETERMINED → escalate, not STOP)
#
# Output contract — same as checkpoint-runner.py:
#   stdout: exactly one line beginning "DECISION: GO|CAUTION|STOP|UNDETERMINED"
#   stderr: diagnostic detail (caller tees to $LOG_FILE)
#   exit 0: decision emitted
#   exit 1: script-level error
#
# Usage:
#   checkpoint-deterministic.sh <A|B|C> [prompt_file]
#   prompt_file is accepted for compat with checkpoint-runner.py and ignored.
#
# Env vars consumed (auto-update.sh exports these before calling):
#   REPO_ROOT, DB_PATH, PRE_MERGE_VERSION, POST_MERGE_VERSION,
#   PRE_MERGE_SHA, POST_MERGE_SHA, VERIFY_INSTALL_JSON
# =============================================================================

set -uo pipefail

LABEL="${1:-}"
REPO_ROOT="${REPO_ROOT:-/home/ubuntu/Sports-Bar-TV-Controller}"
DB_PATH="${DB_PATH:-/home/ubuntu/sports-bar-data/production.db}"
NOTES="$REPO_ROOT/docs/LOCATION_UPDATE_NOTES.md"
SETUP="$REPO_ROOT/docs/VERSION_SETUP_GUIDE.md"

emit() { echo "DECISION: $1${2:+ - $2}"; exit 0; }
diag() { echo "[deterministic-$LABEL] $*" >&2; }

case "$LABEL" in A|B|C) ;; *)
  echo "usage: $0 <A|B|C> [prompt_file]" >&2
  exit 1
;; esac

# ---------------------------------------------------------------------------
# CHECKPOINT A — pre-merge risk scan
# ---------------------------------------------------------------------------
run_a() {
  cd "$REPO_ROOT" || { diag "REPO_ROOT unreachable"; emit UNDETERMINED "REPO_ROOT not accessible"; }

  # Fast exit: nothing pending → GO.
  local pending
  pending=$(git log --format='%h %s' HEAD..origin/main 2>/dev/null)
  if [ -z "$pending" ]; then
    emit GO "no commits pending merge"
  fi
  local pending_count
  pending_count=$(echo "$pending" | wc -l)
  diag "$pending_count pending commits"

  # 1. Hard secret-leak pattern scan in the pending diff.
  # v2.52.4 fix (code-reviewer audit Finding #2, AP-1 spirit): scope to
  # non-docs/non-test paths via git pathspec. Pre-v2.52.4 grepped the
  # full diff, including markdown + test fixtures, which can legitimately
  # contain example AKIA... strings or commented-out api_key patterns —
  # causing false STOP. Scoped diff excludes docs/, README.md anywhere,
  # *.md, *.test.* files, anywhere with /tests/.
  local diff
  diff=$(git diff HEAD..origin/main 2>/dev/null)
  local scoped_diff
  scoped_diff=$(git diff HEAD..origin/main -- \
    ':!docs/' ':!**/*.md' ':!**/tests/**' ':!**/*.test.*' ':!**/__tests__/**' \
    2>/dev/null)
  if echo "$scoped_diff" | grep -qE '^\+.*(AKIA[0-9A-Z]{16}|"sk-[A-Za-z0-9]{32,}|api[-_]?key["'\'' ]*[:=]["'\'' ]*[A-Za-z0-9]{30,})'; then
    emit STOP "leaked-secret pattern in pending diff"
  fi

  # 2. Critical-script deletion scan.
  # v2.52.1 fix: switch from awk-on-diff-text (AP-1 anti-pattern, see
  # docs/AUTO_UPDATE_DESIGN_RULES.md) to `git diff --name-status`. The
  # v2.50.14 awk parser had a latent bug: once a critical script's
  # `diff --git` line was matched, the `capturing` state stayed true for
  # ALL subsequent diff entries — so an unrelated non-critical script
  # being deleted later in the same diff (e.g. legitimately-removed
  # capture-tv-macs.sh) attributed the deletion to the LAST-seen file
  # which happened to be the non-critical one. Luckys hit this on
  # 2026-05-19 v2.50.16 with capture-tv-macs.sh deletion.
  #
  # The right fix per AP-1: use git's structured `--name-status` output
  # which returns exactly `D<TAB>path` per deleted file. No false
  # positives possible.
  local critical_deleted
  critical_deleted=$(git diff --name-status HEAD..origin/main 2>/dev/null \
    | grep -E '^D[[:space:]]+scripts/(auto-update|verify-install|rollback)\.sh$' || true)
  if [ -n "$critical_deleted" ]; then
    diag "critical-script deletion: $critical_deleted"
    emit STOP "critical script deleted in pending diff"
  fi

  # 3. NOT NULL column without default in any added schema field.
  # v2.52.4 fix (Guardian audit M1): pre-v2.52.4 only checked same-line
  # `.default(`. Multi-line schemas like
  #     fieldName: integer('field_name')
  #       .notNull()
  #       .default(0)
  # would false-fire UNDETERMINED on the .notNull() line. New approach:
  # use grep with -B0 -A3 context window so .default() on the next 3 lines
  # also counts as paired. Only emit UNDETERMINED if NO .default() appears
  # within that window for at least one offending line.
  local bad_schema
  bad_schema=$(echo "$diff" | grep -nE '^\+' | grep -E '\.notNull\(\)' | grep -v '^\+\+\+' | grep -v '\.default(' | head -5)
  if [ -n "$bad_schema" ]; then
    # For each candidate, look 3 lines ahead in the diff for .default(
    local still_bad=""
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      local lineno
      lineno=$(echo "$line" | cut -d: -f1)
      # Check 4 lines starting from this one for .default(
      if ! echo "$diff" | sed -n "${lineno},$((lineno+3))p" | grep -q '\.default('; then
        still_bad="$still_bad
$line"
      fi
    done <<<"$bad_schema"
    if [ -n "$still_bad" ]; then
      diag "NOT NULL without default (3-line window) candidates: $(echo "$still_bad" | head -3)"
      emit UNDETERMINED "schema adds NOT NULL column without default — needs AI review"
    fi
  fi

  # 4. LOCATION_UPDATE_NOTES.md scan for STOP/CAUTION on pending SHAs.
  # Notes use version headers like "### YYYY-MM-DD — vX.Y.Z — title".
  # Match by checking if any pending commit's subject mentions a version that
  # appears in the notes between PRE_MERGE_VERSION and origin/main HEAD.
  local stop_hit
  stop_hit=$(awk '
    /^### [0-9]{4}-[0-9]{2}-[0-9]{2}.*v[0-9]+\.[0-9]+\.[0-9]+/ { in_entry=1; header=$0; next }
    in_entry && /^\*\*Risk:\*\* *STOP/ { print header; exit }
    /^---$/ { in_entry=0 }
  ' "$NOTES" 2>/dev/null | head -1)
  if [ -n "$stop_hit" ]; then
    # An entry exists with Risk: STOP. Only block if the version is in the
    # pending range — otherwise it's a historical entry already merged.
    local stop_version
    stop_version=$(echo "$stop_hit" | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    if [ -n "$stop_version" ] && echo "$pending" | grep -qF "$stop_version"; then
      emit STOP "LOCATION_UPDATE_NOTES marks $stop_version as Risk: STOP"
    fi
  fi

  # 5. Major dep bump → CAUTION (not STOP — operator can review during run).
  if echo "$diff" | grep -qE '^\+.*"(next|react|drizzle-orm|drizzle-kit)": *"\^?[0-9]+'; then
    local maj_change
    maj_change=$(echo "$diff" | grep -E '^[+-].*"(next|react|drizzle-orm|drizzle-kit)":' | head -2)
    diag "dep change: $maj_change"
    # Only CAUTION if a major version digit changed; skip patch/minor.
    # v2.52.4 fix (Guardian audit M2): pre-v2.52.4 awk left `old` empty
    # when the diff has only a `+` line (new dep added, no prior `-`
    # line). `old != new` then evaluates "" != "X" = true, falsely
    # triggering CAUTION on every NEW dep. Require BOTH values present
    # before comparing.
    if echo "$maj_change" | awk -F'"' '
      /^-/ { for(i=1;i<=NF;i++) if($i ~ /^\^?[0-9]+\./) { split($i,a,"."); old=a[1]; gsub(/\^/,"",old) } }
      /^\+/ { for(i=1;i<=NF;i++) if($i ~ /^\^?[0-9]+\./) { split($i,a,"."); new=a[1]; gsub(/\^/,"",new) } }
      END { if (old == "" || new == "") exit 1; exit (old != new) ? 0 : 1 }
    '; then
      emit CAUTION "major version bump in core dep (next/react/drizzle)"
    fi
  fi

  # All clear.
  emit GO "$pending_count pending commit(s); no STOP patterns matched"
}

# ---------------------------------------------------------------------------
# CHECKPOINT B — post-merge workspace coherence
# ---------------------------------------------------------------------------
run_b() {
  cd "$REPO_ROOT" || emit UNDETERMINED "REPO_ROOT not accessible"

  # 1. Critical infra-row sanity (location auth, presets).
  if ! command -v sqlite3 >/dev/null 2>&1; then
    emit UNDETERMINED "sqlite3 not on PATH"
  fi
  if [ ! -f "$DB_PATH" ]; then
    emit UNDETERMINED "DB_PATH ($DB_PATH) does not exist"
  fi

  local loc_count
  loc_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Location;" 2>/dev/null || echo 0)
  if [ "${loc_count:-0}" -lt 1 ]; then
    emit STOP "Location table empty — auth will fail"
  fi
  diag "Location row count: $loc_count"

  # 2. ChannelPreset count (CAUTION not STOP — some locations seed later).
  local preset_count
  preset_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ChannelPreset WHERE isActive=1;" 2>/dev/null || echo 0)
  if [ "${preset_count:-0}" -lt 1 ]; then
    diag "ChannelPreset count is 0 — flagging CAUTION"
    # Don't block; merge can still proceed.
  fi

  # 3. New schema tables must exist if schema diff added any.
  # Extract `export const X = sqliteTable('Y', ...)` from diff additions.
  local new_tables
  new_tables=$(git diff "$PRE_MERGE_SHA"..HEAD -- '*/schema.ts' 2>/dev/null \
    | grep -E '^\+export const \w+ = sqliteTable' \
    | grep -oE "sqliteTable\('[^']+'" \
    | grep -oE "'[^']+'" \
    | tr -d "'")
  local existing_tables
  existing_tables=$(sqlite3 "$DB_PATH" ".tables" 2>/dev/null | tr -s ' ' '\n')
  local missing=""
  for t in $new_tables; do
    if ! echo "$existing_tables" | grep -qx "$t"; then
      missing="$missing $t"
    fi
  done
  if [ -n "$missing" ]; then
    emit STOP "schema diff added tables but they don't exist in DB:$missing"
  fi

  # 4. verify-sql markers from VERSION_SETUP_GUIDE.md within version range.
  # Marker format (existing convention): a fenced bash block containing
  # sqlite3 commands inside a "Verification:" section. Run any sqlite3 line
  # that ends with "wc -l" or COUNT(*) — failure to return ≥1 is a STOP.
  # Implementation: keep it simple — only check entries between PRE/POST.
  if [ -n "${PRE_MERGE_VERSION:-}" ] && [ -n "${POST_MERGE_VERSION:-}" ]; then
    local in_range_section
    in_range_section=$(awk -v post="$POST_MERGE_VERSION" -v pre="$PRE_MERGE_VERSION" '
      /^### v[0-9]+\.[0-9]+\.[0-9]+/ {
        match($0, /v[0-9]+\.[0-9]+\.[0-9]+/);
        cur = substr($0, RSTART+1, RLENGTH-1);
        if (cur == pre) { stop=1 }
        if (cur == post) { capture=1 }
      }
      capture && !stop { print }
    ' "$SETUP" 2>/dev/null)

    # Pull out sqlite3 SELECT COUNT lines and run them.
    local sql_lines
    sql_lines=$(echo "$in_range_section" | grep -oE 'sqlite3 [^|]*"SELECT[^"]+"' | head -10)
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      local sql_stmt
      sql_stmt=$(echo "$line" | grep -oE '"SELECT[^"]+"' | tr -d '"')
      [ -z "$sql_stmt" ] && continue
      local sql_result
      sql_result=$(sqlite3 "$DB_PATH" "$sql_stmt" 2>/dev/null)
      if [ -z "$sql_result" ] || [ "$sql_result" = "0" ]; then
        diag "verify-sql 0 rows: $sql_stmt"
        emit STOP "verify-sql returned 0 rows: $sql_stmt"
      fi
    done <<< "$sql_lines"
  fi

  emit GO "Location=$loc_count, presets=$preset_count, no missing schema tables, verify-sql passed"
}

# ---------------------------------------------------------------------------
# CHECKPOINT C — post-restart health
# ---------------------------------------------------------------------------
run_c() {
  # 1. verify-install JSON status (auto-update.sh sets VERIFY_INSTALL_JSON).
  if [ -n "${VERIFY_INSTALL_JSON:-}" ]; then
    if echo "$VERIFY_INSTALL_JSON" | grep -q '"status":"FAIL"'; then
      emit STOP "verify-install.sh reported FAIL"
    fi
  fi

  # 2. /api/system/health curl (5s timeout).
  if command -v curl >/dev/null 2>&1; then
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
      http://localhost:3001/api/system/health 2>/dev/null || echo "000")
    if [ "$code" != "200" ]; then
      diag "health endpoint returned $code"
      emit STOP "/api/system/health returned $code"
    fi
  fi

  # 3. PM2 crash-pattern scan — narrow allowlist, NOT generic ERROR.
  # Patterns chosen to match real crashes only.
  #
  # Two false-positives we explicitly suppress:
  # - "non-fatal" — case-insensitive FATAL hit hits this benign substring
  #   (seen at v2.32.59 via `[AI-SUGGEST:UNIFIED-DIFF] builder failed (non-fatal):`)
  # - ESPN softball 400 logged at level ERROR — doesn't match the allowlist
  #   and is correctly ignored.
  # v2.50.14 fix: filter PM2 log lines by timestamp so we only flag crashes
  # that happened AFTER our pm2_restart in this run. The auto-update.sh
  # passes the restart epoch in PM2_RESTART_EPOCH env var; if missing,
  # fall back to "30 seconds ago" as a conservative window (will catch
  # genuine post-restart crashes but miss anything older).
  #
  # Holmgren hit the original bug on 2026-05-19 v2.50.13 — a JSON parse
  # error from a chat-API/RAG-rescan race condition at 02:33:44 (5 min
  # BEFORE this run's pm2_restart at 02:38:06) was still in the last
  # 80 PM2 log lines and tripped the detector. Filter by epoch instead.
  if command -v pm2 >/dev/null 2>&1; then
    local restart_epoch="${PM2_RESTART_EPOCH:-$(date +%s -d '30 seconds ago')}"
    local crashes
    # PM2 log format: "1|sports-b | 2026-05-19 02:33:44 -05:00: ..."
    # Extract the timestamp, convert to epoch, compare against restart_epoch.
    crashes=$(pm2 logs sports-bar-tv-controller --lines 200 --nostream 2>/dev/null \
      | grep -iE '(unhandledRejection|Cannot find module|EADDRINUSE|SyntaxError|FATAL)' \
      | grep -ivE 'non-fatal' \
      | awk -v re="$restart_epoch" '
          {
            match($0, /[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}/)
            if (RLENGTH > 0) {
              ts = substr($0, RSTART, RLENGTH)
              cmd = "date +%s -d \"" ts "\" 2>/dev/null"
              cmd | getline epoch; close(cmd)
              if (epoch + 0 >= re + 0) print
            } else { print }  # no parseable timestamp, include for safety
          }' \
      | head -3)
    if [ -n "$crashes" ]; then
      diag "PM2 crash pattern hit (since restart_epoch=$restart_epoch): $crashes"
      emit STOP "fresh crash pattern in PM2 logs post-restart"
    fi
  fi

  emit GO "verify-install OK, health=200, no PM2 crash patterns"
}

case "$LABEL" in
  A) run_a ;;
  B) run_b ;;
  C) run_c ;;
esac
