#!/usr/bin/env bash
# snapshot-release.sh — capture a usable snapshot of the current release
# so instant-rollback.sh can restore it without re-checkout + rebuild.
#
# Called by auto-update.sh at the END of every successful update, AFTER
# verify-install has already confirmed the new version is healthy. The
# snapshot is "known good" by construction.
#
# Snapshot contents:
#   /home/ubuntu/sports-bar-releases/<version>/
#     .next/                — full Next.js build output
#     package.json          — version + dep manifest
#     drizzle/              — migration files at this version
#     manifest.json         — { version, sha, snapshotAt, dbHash }
#
# Snapshots are de-duped by version: if the version already has a
# snapshot, this script skips (idempotent). To force re-snapshot, pass
# --force.
#
# Retention: KEEP_LAST snapshots (default 5). Oldest snapshots beyond
# that are deleted to avoid filling disk.
#
# Usage:
#   bash scripts/snapshot-release.sh [--force]

set -uo pipefail

FORCE=""
[ "${1:-}" = "--force" ] && FORCE="yes"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASES_DIR="/home/ubuntu/sports-bar-releases"
KEEP_LAST=5
VERSION=$(node -e "console.log(require('$REPO_ROOT/package.json').version)" 2>/dev/null || echo "unknown")
SHA=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
SNAP_DIR="$RELEASES_DIR/v${VERSION}"

log() { echo "[snapshot-release] $*"; }

if [ "$VERSION" = "unknown" ]; then
    log "ERR: could not read version from package.json — aborting"
    exit 1
fi

mkdir -p "$RELEASES_DIR"

if [ -d "$SNAP_DIR" ] && [ -z "$FORCE" ]; then
    log "SKIP v${VERSION} — snapshot already exists at $SNAP_DIR (use --force to overwrite)"
    exit 0
fi

log "Snapshotting v${VERSION} (sha=$SHA) to $SNAP_DIR"
mkdir -p "$SNAP_DIR"

# .next is the Next.js build output. Required for an instant-rollback to
# work without rebuilding. Use rsync so partial copies don't leave a
# half-snapshot if interrupted.
if [ -d "$REPO_ROOT/apps/web/.next" ]; then
    rsync -a --delete "$REPO_ROOT/apps/web/.next/" "$SNAP_DIR/.next/" 2>&1 | tail -3
    NEXT_SIZE=$(du -sh "$SNAP_DIR/.next/" 2>/dev/null | awk '{print $1}')
    log "  .next: $NEXT_SIZE"
else
    log "WARN: no .next directory at $REPO_ROOT/apps/web/.next — snapshot will be incomplete"
fi

cp "$REPO_ROOT/package.json" "$SNAP_DIR/package.json"
log "  package.json copied"

# Migration files at this version — used to verify schema state on rollback.
if [ -d "$REPO_ROOT/drizzle" ]; then
    rsync -a --delete "$REPO_ROOT/drizzle/" "$SNAP_DIR/drizzle/" 2>&1 | tail -3
    MIGRATION_COUNT=$(ls "$SNAP_DIR/drizzle/"*.sql 2>/dev/null | wc -l)
    log "  drizzle/: $MIGRATION_COUNT migrations"
fi

# Manifest with metadata for instant-rollback.sh
DB_HASH=""
if [ -f /home/ubuntu/sports-bar-data/production.db ]; then
    DB_HASH=$(sha256sum /home/ubuntu/sports-bar-data/production.db | awk '{print $1}' | cut -c1-16)
fi
cat > "$SNAP_DIR/manifest.json" <<EOF
{
  "version": "${VERSION}",
  "sha": "${SHA}",
  "snapshotAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "snapshotAtUnix": $(date +%s),
  "dbHash": "${DB_HASH}",
  "host": "$(hostname)"
}
EOF
log "  manifest.json written"

# Retention: keep last KEEP_LAST snapshots. Sort by mtime DESC, skip the
# top KEEP_LAST, delete the rest.
log "Pruning old snapshots (keeping last $KEEP_LAST)..."
PRUNE_COUNT=0
ls -dt "$RELEASES_DIR"/v* 2>/dev/null | tail -n +"$((KEEP_LAST + 1))" | while read -r OLD; do
    log "  prune: $OLD"
    rm -rf "$OLD"
    PRUNE_COUNT=$((PRUNE_COUNT + 1))
done

TOTAL_SNAPS=$(ls -d "$RELEASES_DIR"/v* 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$RELEASES_DIR" 2>/dev/null | awk '{print $1}')
log "Done. Snapshot count: $TOTAL_SNAPS, total size: $TOTAL_SIZE"
