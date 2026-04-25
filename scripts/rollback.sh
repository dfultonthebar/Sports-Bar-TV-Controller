#!/bin/bash
# -----------------------------------------------------------------------------
# Sports Bar TV Controller — Auto-Update Rollback Script
# -----------------------------------------------------------------------------
# Invoked by scripts/auto-update.sh on failure. Restores the pre-update state
# via the rollback git tag, reinstalls dependencies, restores .next.bak if
# present (else rebuilds), restarts PM2, and re-runs verify-install.sh.
#
# Usage:
#   scripts/rollback.sh <rollback-tag> <failed-step-label>
#
# Exit codes:
#   0  — rollback succeeded, app is back on the pre-update commit
#   99 — CRITICAL: rollback itself failed; human intervention required
#
# Runs intentionally WITHOUT `set -e` so that each step can return non-zero
# and we can report WHICH step failed rather than aborting at the first
# error.
# -----------------------------------------------------------------------------

ROLLBACK_TAG="${1:-}"
FAILED_STEP="${2:-unknown}"
REPO_ROOT="/home/ubuntu/Sports-Bar-TV-Controller"
LOG_FILE="${LOG_FILE:-/home/ubuntu/sports-bar-data/update-logs/rollback-$(date +%Y-%m-%d-%H-%M).log}"

# v2.32.27 — Source nvm if present so npm/node are on PATH. Without this,
# rollback's npm-ci-realign step exits 127 ("npm: command not found") on
# nvm-using hosts (Leg Lamp), aborting with CRITICAL even though the git
# rollback itself succeeded.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" --no-use 2>/dev/null
  nvm use default >/dev/null 2>&1 || true
fi

mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() {
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$ts][ROLLBACK] $*" | tee -a "$LOG_FILE"
}

critical() {
  log "CRITICAL: $*"
  log "Human intervention required. See $LOG_FILE"
}

if [ -z "$ROLLBACK_TAG" ]; then
  critical "No rollback tag provided"
  exit 99
fi

log "Starting rollback to tag '$ROLLBACK_TAG' (failed at step: $FAILED_STEP)"

cd "$REPO_ROOT" || { critical "cannot cd to $REPO_ROOT"; exit 99; }

# --- 1. Abort any in-progress merge ----------------------------------------
if [ -f .git/MERGE_HEAD ]; then
  log "Found in-progress merge — aborting it"
  git merge --abort 2>&1 | tee -a "$LOG_FILE" || {
    log "merge --abort failed; forcing reset"
  }
fi

# --- 2. Hard reset to the rollback tag -------------------------------------
log "git reset --hard $ROLLBACK_TAG"
git reset --hard "$ROLLBACK_TAG" 2>&1 | tee -a "$LOG_FILE"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then
  critical "git reset --hard $ROLLBACK_TAG failed — repo may be in an unknown state"
  exit 99
fi

# --- 2.5. Restore DB if the failed run did a destructive schema_push -------
# v2.32.5 — auto-update.sh writes $BACKUP_FILE.destructive next to the
# pre-update DB backup whenever drizzle-kit push includes DROP TABLE /
# DROP COLUMN / data-loss operations. If that marker is present, the
# in-place DB has destructive changes git reset can't undo, so restore
# from the SQLite backup BEFORE rebuilding (so the rolled-back code runs
# against the schema it expects).
#
# Pure additive schema (CREATE TABLE / ADD COLUMN — the normal case)
# leaves the DB untouched by rollback because additive changes are
# forward-compatible with the old code; restoring then would lose the
# new columns when we re-merge the same commit on a successful retry.
RUN_TS="${ROLLBACK_TAG#rollback-}"
BACKUP_FILE="/home/ubuntu/sports-bar-data/backups/pre-update-$RUN_TS.db"
DESTRUCTIVE_MARKER="$BACKUP_FILE.destructive"
DB_PATH="/home/ubuntu/sports-bar-data/production.db"
if [ -f "$DESTRUCTIVE_MARKER" ]; then
  if [ -f "$BACKUP_FILE" ]; then
    log "Destructive schema_push detected (marker: $DESTRUCTIVE_MARKER); restoring DB"
    # Belt-and-suspenders: snapshot the current half-migrated DB so an
    # operator can forensic the failed migration if needed.
    cp "$DB_PATH" "$BACKUP_FILE.pre-rollback-snapshot" 2>/dev/null || true
    # Use cp not mv: BACKUP_FILE is the canonical pre-update state, we
    # want to preserve it for re-rollback if this attempt also fails.
    if cp "$BACKUP_FILE" "$DB_PATH"; then
      # SQLite WAL/SHM files become inconsistent after a binary swap of
      # the main DB file. Delete them so SQLite recreates fresh ones on
      # next open.
      rm -f "$DB_PATH-wal" "$DB_PATH-shm" 2>/dev/null || true
      log "DB restored from $BACKUP_FILE (pre-rollback snapshot at $BACKUP_FILE.pre-rollback-snapshot)"
    else
      critical "Failed to restore DB from $BACKUP_FILE — schema is half-migrated"
      exit 99
    fi
  else
    log "WARNING: destructive marker present but backup file $BACKUP_FILE missing"
    log "         DB cannot be auto-restored; manual recovery may be required"
  fi
fi

# --- 3. Reinstall dependencies to match the reset package-lock.json --------
# If the failed-forward run pulled new packages, node_modules now mismatches
# the lockfile we just reset to. Skipping npm ci would let the rollback build
# succeed on stale node_modules and then crash at runtime on a missing module.
log "npm ci --include=dev (re-aligning node_modules with the reset lockfile)"
# --include=dev required because PM2 env has NODE_ENV=production, which
# would cause npm ci to skip devDependencies (including `turbo`, the
# build orchestrator). Without dev deps, the rollback rebuild would
# also fail on `sh: turbo: not found` — same bug the main script had.
NPM_CI_ROLLBACK_LOG="/tmp/npm-ci-rollback-$$.log"
NODE_ENV=development npm ci --include=dev 2>&1 | tee "$NPM_CI_ROLLBACK_LOG" | tee -a "$LOG_FILE"
NPM_CI_EXIT="${PIPESTATUS[0]}"
if [ "$NPM_CI_EXIT" -ne 0 ]; then
  # Same fail-safe as auto-update.sh: if rollback's npm ci hits lockfile
  # drift, fall back to npm install so we don't end up with rollback
  # failing too (which means no version of the app is installable).
  if grep -qE "EUSAGE|npm ci.*can only install|out of sync with|package-lock\.json.*not in sync" "$NPM_CI_ROLLBACK_LOG"; then
    log "WARNING: rollback npm ci hit lockfile drift — falling back to npm install"
    NODE_ENV=development npm install --include=dev 2>&1 | tee -a "$LOG_FILE"
    if [ "${PIPESTATUS[0]}" -ne 0 ]; then
      rm -f "$NPM_CI_ROLLBACK_LOG"
      critical "npm install fallback also failed during rollback"
      exit 99
    fi
  else
    rm -f "$NPM_CI_ROLLBACK_LOG"
    critical "npm ci failed during rollback"
    exit 99
  fi
fi
rm -f "$NPM_CI_ROLLBACK_LOG"

# --- 4. Restore the Next.js build ------------------------------------------
rm -rf apps/web/.next
if [ -d apps/web/.next.bak ]; then
  log "Restoring apps/web/.next from .next.bak (instant rollback)"
  mv apps/web/.next.bak apps/web/.next
  if [ "$?" -ne 0 ]; then
    critical "mv .next.bak → .next failed"
    exit 99
  fi
else
  log "No .next.bak present — rebuilding from the reset source tree"
  npm run build 2>&1 | tee -a "$LOG_FILE"
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then
    critical "rollback rebuild failed"
    exit 99
  fi
fi

# --- 5. Restart PM2 ---------------------------------------------------------
log "pm2 restart sports-bar-tv-controller --update-env"
pm2 restart sports-bar-tv-controller --update-env 2>&1 | tee -a "$LOG_FILE"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then
  critical "pm2 restart failed"
  exit 99
fi

sleep 10

# --- 6. Re-verify -----------------------------------------------------------
log "Re-running verify-install.sh --quiet"
bash "$REPO_ROOT/scripts/verify-install.sh" --quiet 2>&1 | tee -a "$LOG_FILE"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then
  critical "post-rollback verification failed — app may be unhealthy"
  exit 99
fi

log "Rollback SUCCESS. App is back on tag $ROLLBACK_TAG"
exit 0
