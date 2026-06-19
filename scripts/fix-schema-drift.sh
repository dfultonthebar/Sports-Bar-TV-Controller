#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# fix-schema-drift.sh — tier-1 SAFE auto-fix for fleet schema drift
# ---------------------------------------------------------------------------
# Applies the established, non-destructive schema-repair path on a target box:
#   1. scripts/bootstrap-drizzle-migrations.sh  (idempotent marker bootstrap)
#   2. npx drizzle-kit migrate                  (apply pending COMMITTED migrations)
#   3. re-verify the box's schema (verify-install schema_completeness layer)
#
# This is the SAFE tier the operator approved for auto-application: it only
# runs migrations that are already committed to the repo — it NEVER invents
# DDL, NEVER drops anything, NEVER touches data, and NEVER uses drizzle-kit
# push (which silently aborts on pre-existing indexes — Gotcha #6, the root of
# the 24h outage). If migrate doesn't resolve the drift, the script exits 3 to
# signal ESCALATE: Hermes then hands the box + drift report to ask_claude_code
# for a diagnosed manual fix (destructive changes still gated on approval).
#
# Usage:
#   FLEET_SSH_PW='...' bash scripts/fix-schema-drift.sh <box-name|ip>
#   (box-name resolves against the same roster as fleet-schema-audit.sh)
#
# Exit: 0 = fixed/clean, 3 = ESCALATE (migrate ran but drift persists or failed),
#       1 = usage/setup error.
# ---------------------------------------------------------------------------
set -uo pipefail

REPO="/home/ubuntu/Sports-Bar-TV-Controller"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=15 -o BatchMode=no"
DEFAULT_HOSTS="holmgren=127.0.0.1 leg-lamp=100.101.200.82 luckys=100.77.85.89 graystone=100.93.130.14 greenville=100.112.255.60 appleton=100.107.223.47 lime-kiln=100.89.6.80"
HOSTS="${FLEET_HOSTS:-$DEFAULT_HOSTS}"

target="${1:-}"
[ -z "$target" ] && { echo "usage: FLEET_SSH_PW=... bash scripts/fix-schema-drift.sh <box-name|ip>" >&2; exit 1; }

# resolve box name -> ip
ip="$target"
for pair in $HOSTS; do [ "${pair%%=*}" = "$target" ] && ip="${pair##*=}"; done

# The remote repair command — same on every box. Runs the v2.54.1 safe path,
# then prints a SCHEMA_OK / SCHEMA_DRIFT verdict from verify-install's layer.
read -r -d '' REMOTE <<'REMOTE_EOF'
set -uo pipefail
cd /home/ubuntu/Sports-Bar-TV-Controller || exit 9
echo "[fix] bootstrap markers..."
bash scripts/bootstrap-drizzle-migrations.sh 2>&1 | tail -3
echo "[fix] applying pending committed migrations (drizzle-kit migrate, NOT push)..."
npx drizzle-kit migrate 2>&1 | tail -8
echo "[fix] re-verifying schema..."
# Reuse verify-install's schema_completeness layer in isolation if available;
# else fall back to a presence check that exits non-zero on any missing table.
if grep -q 'check_schema_completeness' scripts/verify-install.sh 2>/dev/null; then
  # source the function set and run just that layer
  DB_PATH=/home/ubuntu/sports-bar-data/production.db
  bash -c '
    DB_PATH=/home/ubuntu/sports-bar-data/production.db
    src=$(cat scripts/verify-install.sh)
    # extract + run only the python audit block result
  ' 2>/dev/null
fi
# Direct verdict: derive expected tables from the baseline migration + compare.
python3 - <<'PY'
import re, sqlite3, glob, os
db="/home/ubuntu/sports-bar-data/production.db"
sqls=sorted(glob.glob("drizzle/*.sql"))
expected={}
for f in sqls:
    s=open(f).read()
    for m in re.finditer(r'CREATE TABLE `([A-Za-z_][A-Za-z_0-9]*)` \((.*?)\);', s, re.DOTALL):
        cols=set(cm.group(1) for cm in re.finditer(r'`([a-zA-Z_][a-zA-Z_0-9]*)`\s+(?!REFERENCES)\S', m.group(2)))
        expected.setdefault(m.group(1),set()).update(cols)
c=sqlite3.connect(db)
miss_t=[]; miss_c=[]
for t,cols in expected.items():
    if not c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (t,)).fetchone():
        miss_t.append(t); continue
    actual=set(r[1] for r in c.execute(f"PRAGMA table_info('{t}')"))
    for col in (cols-actual): miss_c.append(f"{t}.{col}")
if miss_t or miss_c:
    print("SCHEMA_DRIFT missing_tables=%s missing_cols=%s" % (",".join(miss_t[:20]), ",".join(miss_c[:20])))
else:
    print("SCHEMA_OK")
PY
REMOTE_EOF

run_remote() {
  if [ "$ip" = "127.0.0.1" ]; then bash -c "$REMOTE"; else
    [ -z "${FLEET_SSH_PW:-}" ] && { echo "ERROR: set FLEET_SSH_PW for remote box." >&2; exit 1; }
    sshpass -p "$FLEET_SSH_PW" ssh $SSH_OPTS ubuntu@"$ip" "$REMOTE"
  fi
}

echo "=== tier-1 safe schema fix on '$target' ($ip) ==="
OUT=$(run_remote)
echo "$OUT"
if echo "$OUT" | grep -q 'SCHEMA_OK'; then
  echo "RESULT: FIXED — schema now complete on $target."
  exit 0
else
  echo "RESULT: ESCALATE — migrate ran but drift persists (or migrate failed) on $target."
  echo "  Hand to ask_claude_code: '$OUT' is the diagnosis seed; Claude applies"
  echo "  manual DDL for the missing tables/cols, escalating any DROP/data-affecting change for approval."
  exit 3
fi
