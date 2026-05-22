#!/usr/bin/env bash
# bootstrap-drizzle-migrations.sh — one-shot transition tool from drizzle-kit
# `push` workflow to `migrate` workflow.
#
# Marks every migration in ./drizzle/ as "already applied" on the target DB
# WITHOUT executing it. After this runs, `drizzle-kit migrate` against the
# same DB will be a no-op (everything is already applied).
#
# Purpose: bridge existing fleet boxes (whose schemas were built via `push`)
# into the migrate workflow without re-running schema DDL against an already-
# populated DB. Future schema changes generate new 0001+/migration files
# which drizzle-kit migrate will then apply.
#
# Idempotent — safe to re-run. Skips marking any migration already in
# __drizzle_migrations.
#
# Usage:
#   bash scripts/bootstrap-drizzle-migrations.sh [DB_PATH]
#   DB_PATH defaults to /home/ubuntu/sports-bar-data/production.db
#
# Exit codes:
#   0  - all migrations marked (or already marked)
#   1  - drizzle/meta/_journal.json missing
#   2  - DB file missing
#   3  - sqlite3 not available
#   4  - sha256sum not available

set -euo pipefail

DB_PATH="${1:-/home/ubuntu/sports-bar-data/production.db}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DRIZZLE_DIR="$REPO_ROOT/drizzle"
JOURNAL="$DRIZZLE_DIR/meta/_journal.json"

log() { echo "[bootstrap-drizzle] $*"; }
fail() { echo "[bootstrap-drizzle] FAIL: $*" >&2; exit "${2:-1}"; }

command -v sqlite3 >/dev/null || fail "sqlite3 not installed" 3
command -v sha256sum >/dev/null || fail "sha256sum not installed" 4
[ -f "$JOURNAL" ] || fail "journal not found: $JOURNAL" 1
[ -f "$DB_PATH" ] || fail "DB not found: $DB_PATH" 2

log "Target DB: $DB_PATH"
log "Migrations dir: $DRIZZLE_DIR"

# Ensure the markers table exists. Match the schema drizzle-kit creates
# itself so future migrate runs find it the way they expect.
sqlite3 "$DB_PATH" <<'SQL'
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash text NOT NULL,
    created_at numeric
);
SQL

# Pull each migration's tag from the journal, find its SQL file, compute the
# sha256 hash drizzle expects, and INSERT a marker row if not already there.
# Drizzle's hash is sha256(sql_file_contents) hex.
MARKED=0
SKIPPED=0

# Parse the journal entries — each has a `tag` field that maps to <tag>.sql
TAGS=$(python3 -c "
import json, sys
j = json.load(open('$JOURNAL'))
for e in j.get('entries', []):
    print(e['tag'])
")

for tag in $TAGS; do
    SQL_FILE="$DRIZZLE_DIR/$tag.sql"
    if [ ! -f "$SQL_FILE" ]; then
        fail "Migration SQL missing for tag $tag: $SQL_FILE" 1
    fi

    HASH=$(sha256sum "$SQL_FILE" | awk '{print $1}')
    EXISTS=$(sqlite3 "$DB_PATH" "SELECT 1 FROM __drizzle_migrations WHERE hash='$HASH';")

    if [ -n "$EXISTS" ]; then
        log "SKIP $tag (already marked, hash=${HASH:0:12}…)"
        SKIPPED=$((SKIPPED + 1))
    else
        # created_at is unix millis to match drizzle's own writes
        sqlite3 "$DB_PATH" "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('$HASH', CAST(strftime('%s','now') AS INTEGER) * 1000);"
        log "MARK $tag (hash=${HASH:0:12}…)"
        MARKED=$((MARKED + 1))
    fi
done

log "Done: marked=$MARKED skipped=$SKIPPED"

# Final state check — count rows
TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM __drizzle_migrations;")
log "__drizzle_migrations row count: $TOTAL"

exit 0
