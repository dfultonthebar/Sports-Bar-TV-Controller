# Auto-Update Design Rules — Practical Checklist

**Audience:** anyone editing `scripts/auto-update.sh` or its helpers (checkpoint-deterministic.sh, verify-install.sh, ensure-schema.sh, rollback.sh, rag-rescan-if-needed.sh, install-auto-update-timer.sh).

**TL;DR:** the 16 documented failure modes (per `docs/AUTO_UPDATE_TROUBLESHOOTING.md`) have 7 common root causes. Don't reintroduce them. This doc translates the architectural principles in `AUTO_UPDATE_ARCHITECTURE.md` into a concrete code-level checklist.

---

## Anti-pattern catalog — DO NOT introduce these

For each anti-pattern: what it looks like, why it broke us, the correct alternative.

### AP-1: Heuristic regex over git diff text

```bash
# WRONG — Checkpoint A pre-v2.50.14
if echo "$diff" | grep -qE '^diff --git a/scripts/(auto-update|verify-install|rollback)\.sh' && \
   echo "$diff" | grep -qE '^deleted file mode'; then
  emit STOP "critical script deleted in pending diff"
fi
# False-positive when ANY script was modified AND ANY unrelated file was deleted
# in the same diff (Mode 12 — Leglamp blocked by heartbeat-file delete).

# RIGHT — use git's structured output
if git diff --name-status HEAD..origin/main 2>/dev/null | grep -qE '^D\s+scripts/(auto-update|verify-install|rollback)\.sh$'; then
  emit STOP "critical script deleted in pending diff"
fi
```

`git diff --name-status` returns exactly `D<TAB>path` per deleted file. No false-positives. Same pattern for any other "did the diff do X to file Y?" question.

### AP-2: Brittle dependence on third-party stdout format

```bash
# WRONG — drizzle-kit log parsing
DROPPED_TABLES=$(grep -E "delete .* table with [0-9]+ items" "$SCHEMA_PUSH_LOG" | sed -E "s/.*delete ([a-z_]+) table.*/\1/" | sort -u)
# Breaks on every drizzle-kit version bump.

# RIGHT — use the tool's structured output, OR use a different tool entirely
# For schema management specifically: switch from `drizzle-kit push` (which
# diffs at runtime) to `drizzle-kit migrate` (which applies committed SQL).
# See AUTO_UPDATE_ARCHITECTURE.md Principle #4.
```

### AP-3: Trap-fires-then-rollback-everything

```bash
# WRONG — auto-update.sh:1318-1321 pre-v2.52.0
if ! npm run build 2>&1 | tee -a "$LOG_FILE"; then
  fail "npm run build failed" 4   # → rollback.sh → git reset --hard → service interruption
fi
# Today's geocoder TS error rolled back ALL 6 fleet boxes simultaneously.

# RIGHT — failures BEYOND backup/merge can preserve the previous-good state
if ! npm run build 2>&1 | tee -a "$LOG_FILE"; then
  # Build failed but the bar is still serving on the old .next.bak.
  # Restore .next from backup, leave merge commit applied, mark history
  # 'fail_build', exit 2 (degraded-up, NOT a real rollback).
  log "Build failed — restoring previous .next/ (bar stays up, code stays on disk)"
  rm -rf apps/web/.next
  mv apps/web/.next.bak apps/web/.next
  pm2 reload sports-bar-tv-controller
  # Mark history row as failed-but-recoverable
  record_history_result "fail_build_kept_old"
  exit 2  # different from exit 4 (real rollback)
fi
```

### AP-4: Sync flock without PID staleness check

```bash
# WRONG — auto-update.sh:213-214 pre-v2.52.0
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  log "Another auto-update run is in progress (lock held). Exiting cleanly."
  exit 0
fi
# Orphan child processes inherit FD 200 + keep lock (Mode 14).
# pgrep -af auto-update.sh shows nothing, but lock is held.

# RIGHT — flock + PID sidecar with staleness check
LOCK_FILE="/tmp/sports-bar-auto-update.lock"
LOCK_PID_FILE="${LOCK_FILE}.pid"
acquire_lock() {
  exec 200>"$LOCK_FILE"
  if flock -n -E 75 200; then
    echo "$$" > "$LOCK_PID_FILE"
    return 0
  fi
  # Lock-failed. Check if recorded PID is alive.
  if [ -f "$LOCK_PID_FILE" ]; then
    local pid; pid=$(cat "$LOCK_PID_FILE")
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      log "Stale lock from dead PID $pid — clearing and retrying"
      rm -f "$LOCK_FILE" "$LOCK_PID_FILE"
      exec 200>"$LOCK_FILE"
      if flock -n -E 75 200; then
        echo "$$" > "$LOCK_PID_FILE"
        return 0
      fi
    fi
  fi
  log "Another auto-update run is in progress (lock held by alive PID). Exiting cleanly."
  exit 75  # "retry later" — distinguishes from real failure
}
```

Exit code **75** is meaningful: per `systemd.service(5)`'s `Restart=on-failure` semantics, a clean retry-later code is different from a hard failure. Cron/systemd wakeup uses this to decide whether to retry sooner.

### AP-5: Same crash-grep filter in two files, only one gets fixed

`checkpoint-deterministic.sh:282-283` got the v2.50.14 `PM2_RESTART_EPOCH` filter. `verify-install.sh:367` does the same generic FATAL/Error grep but didn't get the fix — so the SAME false-positive class can fire during rollback verification (Mode 16 discovery, audit 2026-05-19).

```bash
# WRONG — verify-install.sh:367 today
pm2 logs sports-bar-tv-controller --lines 200 --nostream --err 2>/dev/null \
  | grep -iE '(unhandledRejection|FATAL|TypeError)' | head -5

# RIGHT — same epoch filter as checkpoint-deterministic.sh
local restart_epoch="${PM2_RESTART_EPOCH:-$(date +%s -d '30 seconds ago')}"
pm2 logs sports-bar-tv-controller --lines 200 --nostream --err 2>/dev/null \
  | grep -iE '(unhandledRejection|FATAL|TypeError)' \
  | awk -v re="$restart_epoch" '
      { match($0, /[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}/);
        if (RLENGTH > 0) {
          ts = substr($0, RSTART, RLENGTH);
          cmd = "date +%s -d \"" ts "\" 2>/dev/null"; cmd | getline epoch; close(cmd);
          if (epoch+0 >= re+0) print
        } else { print }  # no timestamp parseable, include
      }' | head -5
```

**Rule:** if two scripts share the same kind of check, factor it into a helper in a shared file (`scripts/common.sh`). One change point, no drift.

### AP-6: Background subshell PID written to lock

```bash
# WRONG — rag-rescan-if-needed.sh:85-94 (Mode 14 discovery)
(  # subshell
  echo $$ > "$LOCK_FILE"          # writes SUBSHELL's PID
  npx tsx scripts/scan-system-docs.ts > "$LOG" 2>&1
) &
# Parent then checks: kill -0 $LOCK_PID — but PID is the subshell, which dies
# when the subshell exits. Lock looks immediately stale.

# RIGHT — write the child's actual PID
nohup npx tsx scripts/scan-system-docs.ts > "$LOG" 2>&1 &
echo $! > "$LOCK_FILE"   # $! is the backgrounded child's actual PID
disown
```

### AP-7: `setsid -f` re-exec hides all output

```bash
# WRONG — auto-update.sh:62
exec setsid -f "$0" "$@" </dev/null >/dev/null 2>&1
# Any failure between this point and LOG_FILE setup at line 161 produces
# zero diagnostic output. Operator sees "nothing happened."

# RIGHT — keep stderr until LOG_FILE is set, then redirect
exec setsid -f "$0" "$@" </dev/null  # don't redirect stdout/stderr yet
# Then at the LOG_FILE setup point:
exec > >(tee -a "$LOG_FILE") 2> >(tee -a "$LOG_FILE" >&2)
```

---

## Pre-commit checklist for any auto-update.sh change

Walk these IN ORDER. If any fail, the change isn't ready.

### 1. Does the change preserve the bar staying UP on failure?
- Read the failure path. Trace what happens if your new step exits non-zero.
- If the answer is "calls rollback.sh" — that's the antipattern (AP-3). Try in-place recovery first.
- Acceptable in-place recoveries: `mv .next.bak .next`, `pm2 reload`, leave merge commit in place.

### 2. Does the change use structured data (git/pm2/sqlite output) instead of regex on tool stdout?
- `git diff --name-status` instead of `grep '^diff --git'`
- `pm2 jlist | jq` instead of `pm2 status | grep`
- `sqlite3 -separator $'\t'` + explicit column parsing instead of pipe-delimited string splitting
- If you MUST parse log text, write a unit-test against captured log samples in `scripts/test/`.

### 3. If the change adds a lock, does it have a PID file + staleness sweep?
- Pattern AP-4 (above).
- Exit code 75 for "lock held legitimately".

### 4. If the change modifies schema (Drizzle), does it use generate+migrate, NOT push?
- `npm run db:generate` produces `apps/web/drizzle/NNNN_*.sql`
- Commit the migration SQL alongside the schema.ts change
- Fleet boxes run `drizzle-kit migrate` (no prompts ever)
- If you find yourself reaching for `drizzle-kit push`, you're doing it wrong (AP-2)

### 5. If the change modifies failure recovery, is it in a DEDICATED function, not commingled with happy-path?
- Pattern from ArgoCD SyncFail: explicit hook, bounded recursion, "if SyncFail itself fails, does NOT loop."
- Keep `cleanup_on_error` (auto-update.sh:343-386) minimal. Don't grow it.

### 6. If the change is BREAKING (schema, hot-path code, scheduler, instrumentation), is canary gating enabled?
- Check `scripts/canary-config.json` — set `enabled=true` before pushing the breaking change to main.
- After your change lands cleanly on Holmgren (canary), wait for the bless commit. THEN non-canary boxes pull.
- This is the single biggest lever to prevent cascading-fleet-failure incidents.

### 7. Does the change have a corresponding entry in `docs/AUTO_UPDATE_TROUBLESHOOTING.md`?
- New failure modes get documented IN THE SAME COMMIT.
- Format: Symptom + Real-world hit (date + location) + Root cause + Detection recipe + Fix (idempotent if possible).

### 8. RAG indexing?
- If the change touches docs/, packages/*/README.md, CLAUDE.md, .claude/locations/*.md, or memory/*.md, kick off `scripts/rag-rescan-if-needed.sh` per Standing Rule 11.

---

## Helper functions you SHOULD use (in scripts/common.sh — to be created in v2.52.x)

Future: a `scripts/common.sh` library with battle-tested helpers all the auto-update scripts share. Reduces drift between checkpoint-deterministic.sh, verify-install.sh, rollback.sh, etc.

Planned helpers:
- `acquire_lock_with_staleness_check(lock_file, pid_file)` — AP-4 pattern
- `crash_pattern_grep_filtered(pm2_app, restart_epoch)` — AP-5 unified filter
- `safe_drizzle_migrate(db_path)` — applies migrations via `drizzle-kit migrate` then verifies via `sqlite3 ".schema"` diff (no prompts ever)
- `record_history_result(result_enum)` — single writer for the `AutoUpdateHistory` table; ensures the failure-vs-success vocabulary stays consistent
- `enter_degraded_up_mode(reason)` — AP-3 alternative to rollback: restore `.next.bak`, reload PM2, exit 2

---

## Related docs
- `docs/AUTO_UPDATE_ARCHITECTURE.md` — the design principles + CD patterns we're adopting
- `docs/AUTO_UPDATE_TROUBLESHOOTING.md` — 16 documented failure modes (catalog)
- `docs/AUTO_UPDATE_SYSTEM_PLAN.md` — original system design (predates this audit)
- CLAUDE.md Gotcha #11 — concise pointer to all auto-update silent-stall causes
