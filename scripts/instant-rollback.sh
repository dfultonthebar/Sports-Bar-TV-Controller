#!/usr/bin/env bash
# instant-rollback.sh — restore a previous release from snapshot in ~5s
# (vs auto-update.sh rollback which is ~3min: git reset + npm ci + rebuild).
#
# Snapshots are written by snapshot-release.sh at the END of every
# successful auto-update, so any snapshot in /home/ubuntu/sports-bar-releases/
# is by construction "known good" — verify-install passed on it.
#
# WHAT THIS DOES:
#   1. Confirm the target snapshot exists + manifest is readable.
#   2. Read the target version + SHA from the snapshot's manifest.
#   3. Stop PM2.
#   4. `git -C REPO_ROOT reset --hard <SHA>` to roll the working tree
#      back to the target version's commit.
#   5. Restore .next from the snapshot (saves the ~2-3min rebuild).
#   6. Restart PM2.
#   7. Verify health.
#
# WHAT THIS DOES NOT DO:
#   - Restore the database. Snapshots include a dbHash for future use
#     (could trigger db restore if hash diverged), but in this version
#     the operator is expected to handle DB rollback manually if needed
#     (production.db.pre-update-*.bak files exist alongside production.db).
#   - Restore node_modules. The snapshot assumes node_modules at the
#     time of rollback are compatible with the snapshot's package.json.
#     If they aren't (rare — major dep changes mid-snapshot-window), the
#     operator should re-run `npm ci` after rollback. Health check will
#     catch a busted module tree.
#
# USAGE:
#   bash scripts/instant-rollback.sh <version>
#   e.g.: bash scripts/instant-rollback.sh 2.54.1
#
#   List available snapshots:
#   bash scripts/instant-rollback.sh --list
#
# EXIT CODES:
#   0  - rollback successful
#   1  - target snapshot not found
#   2  - manifest unreadable
#   3  - git reset failed
#   4  - .next restore failed
#   5  - PM2 restart failed
#   6  - health check failed after rollback

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASES_DIR="/home/ubuntu/sports-bar-releases"
PM2=$(command -v pm2 || echo /home/ubuntu/.nvm/versions/node/v20.20.0/bin/pm2)
HEALTH_URL="http://localhost:3001/api/health"

log() { echo "[instant-rollback] $*"; }
fail() { echo "[instant-rollback] FAIL: $*" >&2; exit "${2:-1}"; }

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <version>   (e.g. 2.54.1)"
    echo "       $0 --list"
    exit 1
fi

if [ "$1" = "--list" ]; then
    echo "Available snapshots in $RELEASES_DIR:"
    if [ ! -d "$RELEASES_DIR" ] || [ -z "$(ls -A "$RELEASES_DIR" 2>/dev/null)" ]; then
        echo "  (none)"
        exit 0
    fi
    for S in "$RELEASES_DIR"/v*; do
        [ -d "$S" ] || continue
        V=$(basename "$S" | sed 's/^v//')
        TS=$(python3 -c "import json; print(json.load(open('$S/manifest.json'))['snapshotAt'])" 2>/dev/null || echo "?")
        SHA=$(python3 -c "import json; print(json.load(open('$S/manifest.json'))['sha'])" 2>/dev/null || echo "?")
        printf "  v%-10s sha=%-9s snapshotted=%s\n" "$V" "$SHA" "$TS"
    done
    exit 0
fi

TARGET_VER="$1"
SNAP_DIR="$RELEASES_DIR/v${TARGET_VER}"

[ -d "$SNAP_DIR" ] || fail "Snapshot not found: $SNAP_DIR — run with --list to see available" 1
[ -f "$SNAP_DIR/manifest.json" ] || fail "manifest.json missing in $SNAP_DIR" 2

TARGET_SHA=$(python3 -c "import json; print(json.load(open('$SNAP_DIR/manifest.json'))['sha'])" 2>/dev/null) || fail "could not read sha from manifest" 2
TARGET_VER_FROM_MANIFEST=$(python3 -c "import json; print(json.load(open('$SNAP_DIR/manifest.json'))['version'])" 2>/dev/null) || fail "could not read version from manifest" 2

# Resolve abbreviated SHA to full SHA via git
RESOLVED_SHA=$(git -C "$REPO_ROOT" rev-parse "$TARGET_SHA" 2>/dev/null || echo "")
[ -n "$RESOLVED_SHA" ] || fail "git could not resolve sha=$TARGET_SHA — local git tree may have diverged from the snapshot" 3

CURRENT_VER=$(node -e "console.log(require('$REPO_ROOT/package.json').version)" 2>/dev/null || echo "?")
CURRENT_SHA=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "?")

log "===================================================================="
log "INSTANT ROLLBACK"
log "  Current:  v${CURRENT_VER} sha=${CURRENT_SHA}"
log "  Target:   v${TARGET_VER_FROM_MANIFEST} sha=${TARGET_SHA}"
log "  Snapshot: $SNAP_DIR"
log "===================================================================="

# Sanity confirm before doing anything destructive
read -p "Proceed with rollback? [y/N] " -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    log "Aborted by operator."
    exit 0
fi

START_EPOCH=$(date +%s)

# Step 1: stop PM2 (faster than restart because we'll re-start after the file ops)
log "Stopping PM2..."
"$PM2" stop sports-bar-tv-controller >/dev/null 2>&1 || log "  (PM2 stop returned non-zero — continuing; may have been already stopped)"

# Step 2: git reset to target SHA
log "git reset --hard ${TARGET_SHA}..."
if ! git -C "$REPO_ROOT" reset --hard "$RESOLVED_SHA" 2>&1 | tail -3; then
    fail "git reset failed — repo may be in inconsistent state" 3
fi

# Step 3: restore .next from snapshot (skips the 2-3min rebuild)
log "Restoring .next from snapshot..."
if [ -d "$SNAP_DIR/.next" ]; then
    rm -rf "$REPO_ROOT/apps/web/.next"
    rsync -a "$SNAP_DIR/.next/" "$REPO_ROOT/apps/web/.next/" || fail ".next restore failed" 4
    log "  .next restored ($(du -sh "$REPO_ROOT/apps/web/.next/" | awk '{print $1}'))"
else
    log "  WARN: snapshot has no .next dir — operator will need to rebuild before next start"
fi

# Step 4: restart PM2
log "Starting PM2..."
if ! "$PM2" start sports-bar-tv-controller >/dev/null 2>&1; then
    # If start fails (process is gone, not just stopped), try restart
    "$PM2" restart sports-bar-tv-controller >/dev/null 2>&1 || fail "PM2 start AND restart both failed" 5
fi

# Step 5: health check (with retries — Next.js cold-start takes a few seconds)
log "Waiting for health..."
HEALTHY=0
for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    HEALTH=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$HEALTH" = "200" ]; then
        HEALTHY=1
        break
    fi
done

END_EPOCH=$(date +%s)
DURATION=$((END_EPOCH - START_EPOCH))

if [ "$HEALTHY" = "1" ]; then
    log "===================================================================="
    log "ROLLBACK SUCCESSFUL — v${TARGET_VER_FROM_MANIFEST} live in ${DURATION}s"
    log "===================================================================="
    exit 0
else
    log "===================================================================="
    log "ROLLBACK PROBABLY FAILED — health check did not return 200 in 20s"
    log "  Check: pm2 logs sports-bar-tv-controller --lines 50"
    log "===================================================================="
    exit 6
fi
