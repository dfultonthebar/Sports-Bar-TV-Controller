#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# fleet-data-integrity-audit.sh — per-box DATA-integrity invariants
#                                 (companion to fleet-deps/security/schema audits)
# ---------------------------------------------------------------------------
# Checks each box's production.db for LOCATION-AGNOSTIC data invariants — rules
# that must hold regardless of which devices/channels a location runs. These are
# NOT value comparisons against a golden config; they are structural truths
# ("every active tuner must resolve to a MatrixInput", "Brewers must not route to
# a Bucks RSN channel", etc).
#
# REPORT-ONLY by design — there is NO --fix. Data fixes need operator wiring
# (the matrix_input_id resolution today proved a bad auto-fix silently misroutes
# real TVs), so every finding is surfaced for human action, never auto-mutated.
#
# Invariants (any returned SQL row = FINDING):
#   INV-1  matrix_input_id resolvable  — active cable/directv/satellite sources
#          must point at a real MatrixInput (id or channelNumber). Unresolvable
#          = a tuner the scheduler is blind to. (today's DirecTV regression guard)
#   INV-6  Brewers RSN misroute        — Brewers override must NOT land on a
#          FanDuel (Bucks/general) preset; Brewers RSN is the '+' Bally preset.
#   INV-3  station_aliases JSON valid + override resolvable — bad alias JSON, or
#          an active override whose channel has no active ChannelPreset.
#   INV-4  device_id FK orphans        — input_sources.device_id pointing at a
#          non-existent IR/DirecTV/FireTV device row.
#   INV-5  BartenderLayout rooms       — active layout missing rooms (Gotcha #8 —
#          room filter tabs vanish on the bartender Video tab).
#
# Usage:  FLEET_SSH_PW=... bash scripts/fleet-data-integrity-audit.sh
# Exit: 0 = every box clean, 2 = findings on at least one box, 1 = setup error.
# Output: human report + /tmp/fleet-data-integrity-audit.json
# ---------------------------------------------------------------------------
set -uo pipefail

OUT_JSON="/tmp/fleet-data-integrity-audit.json"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=12 -o BatchMode=no"
DB="/home/ubuntu/sports-bar-data/production.db"

DEFAULT_HOSTS="holmgren=100.117.155.98 leg-lamp=100.101.200.82 luckys=100.77.85.89 graystone=100.93.130.14 greenville=100.112.255.60 appleton=100.107.223.47 lime-kiln=100.89.6.80"
HOSTS="${FLEET_HOSTS:-$DEFAULT_HOSTS}"

if [ -z "${FLEET_SSH_PW:-}" ]; then echo "ERROR: set FLEET_SSH_PW." >&2; exit 1; fi
command -v sshpass >/dev/null 2>&1 || { echo "ERROR: sshpass not installed locally." >&2; exit 1; }

# Per-box remote probe. Runs sqlite3 ON the box. Emits one line per invariant:
#   OK <inv>                         — zero offending rows
#   FINDING <inv> (<summary>)        — at least one offending row (capped 120 chars)
#   REPORT <inv> (<reason>)          — could not evaluate (missing table / no sqlite3 / no db)
# Each query is guarded so a missing table reports rather than crashing the run.
read -r -d '' REMOTE <<REMOTE_EOF
set -uo pipefail
DB="$DB"

if ! command -v sqlite3 >/dev/null 2>&1; then echo "REPORT env (sqlite3 not installed)"; exit 0; fi
if [ ! -f "\$DB" ]; then echo "REPORT env (production.db not found)"; exit 0; fi

# require_tables <inv> <tbl> [<tbl>...] : echo REPORT + return 1 if any table absent.
have_table() {
  sqlite3 "\$DB" "SELECT 1 FROM sqlite_master WHERE type='table' AND name='\$1' LIMIT 1;" 2>/dev/null | grep -q 1
}
require_tables() {
  inv="\$1"; shift
  for t in "\$@"; do
    if ! have_table "\$t"; then echo "REPORT \$inv (table \$t missing)"; return 1; fi
  done
  return 0
}

# run_check <inv> <sql> : FINDING if any row returned, else OK. Summary capped 120 chars.
run_check() {
  inv="\$1"; sql="\$2"
  rows=\$(sqlite3 -noheader -separator '|' "\$DB" "\$sql" 2>/dev/null)
  rc=\$?
  if [ \$rc -ne 0 ]; then echo "REPORT \$inv (query error)"; return; fi
  if [ -z "\$rows" ]; then echo "OK \$inv"; return; fi
  n=\$(printf '%s\n' "\$rows" | grep -c .)
  summary=\$(printf '%s' "\$rows" | tr '\n' ';' | cut -c1-120)
  echo "FINDING \$inv (\${n} row(s): \${summary})"
}

# -- INV-1 matrix_input_id resolvable -------------------------------------------------
if require_tables "INV-1" input_sources MatrixInput; then
  run_check "INV-1" "SELECT s.name, s.type FROM input_sources s WHERE lower(s.type) IN ('cable','directv','satellite') AND s.is_active=1 AND (s.matrix_input_id IS NULL OR s.matrix_input_id='' OR NOT EXISTS (SELECT 1 FROM MatrixInput mi WHERE mi.id=s.matrix_input_id OR CAST(mi.channelNumber AS TEXT)=s.matrix_input_id));"
fi

# -- INV-6 Brewers RSN misroute -------------------------------------------------------
if require_tables "INV-6" local_channel_overrides ChannelPreset; then
  run_check "INV-6" "SELECT o.team_name, o.channel_number, o.device_type FROM local_channel_overrides o WHERE o.is_active=1 AND lower(o.team_name) LIKE '%brewer%' AND EXISTS (SELECT 1 FROM ChannelPreset p WHERE CAST(p.channelNumber AS TEXT)=CAST(o.channel_number AS TEXT) AND p.deviceType=o.device_type AND (replace(replace(upper(p.name),' ',''),'-','') LIKE '%FANDUEL%' OR upper(p.name) IN ('FAN DUEL','FANDUEL')) AND replace(upper(p.name),' ','') NOT LIKE '%+%');"
fi

# -- INV-3 station_aliases JSON valid + override resolvable ---------------------------
if require_tables "INV-3a" station_aliases; then
  run_check "INV-3a json" "SELECT standard_name FROM station_aliases WHERE json_valid(aliases)=0;"
fi
if require_tables "INV-3b" local_channel_overrides ChannelPreset; then
  run_check "INV-3b override" "SELECT o.team_name, o.channel_number, o.device_type FROM local_channel_overrides o WHERE o.is_active=1 AND NOT EXISTS (SELECT 1 FROM ChannelPreset p WHERE CAST(p.channelNumber AS TEXT)=CAST(o.channel_number AS TEXT) AND p.deviceType=o.device_type AND p.isActive=1);"
fi

# -- INV-4 device_id FK orphans -------------------------------------------------------
if require_tables "INV-4" input_sources IRDevice DirecTVDevice FireTVDevice; then
  run_check "INV-4" "SELECT s.type, s.device_id FROM input_sources s WHERE s.device_id IS NOT NULL AND s.device_id!='' AND ((lower(s.type)='cable' AND NOT EXISTS(SELECT 1 FROM IRDevice d WHERE d.id=s.device_id)) OR (lower(s.type)='directv' AND NOT EXISTS(SELECT 1 FROM DirecTVDevice d WHERE d.id=s.device_id)) OR (lower(s.type)='firetv' AND NOT EXISTS(SELECT 1 FROM FireTVDevice d WHERE d.id=s.device_id)));"
fi

# -- INV-5 BartenderLayout rooms ------------------------------------------------------
if require_tables "INV-5" BartenderLayout; then
  run_check "INV-5" "SELECT id, name FROM BartenderLayout WHERE isActive=1 AND (rooms IS NULL OR rooms='' OR rooms='[]' OR json_array_length(rooms)=0);"
fi
REMOTE_EOF

echo "============================================================"
echo "FLEET DATA-INTEGRITY AUDIT — $(date -Iseconds)  (report-only)"
echo "============================================================"
NEED=0; JSON=""
for pair in $HOSTS; do
  name="${pair%%=*}"; ip="${pair##*=}"
  echo ""; echo "## $name ($ip)"
  out=$(sshpass -p "$FLEET_SSH_PW" ssh $SSH_OPTS ubuntu@"$ip" "$REMOTE" 2>/dev/null)
  if [ -z "$out" ]; then echo "   [!] unreachable — skipped"; JSON="${JSON}{\"box\":\"$name\",\"reachable\":false},"; continue; fi
  echo "$out" | grep -vE '^OK ' | sed 's/^/   /'
  f=$(echo "$out" | grep -c '^FINDING' || true)
  r=$(echo "$out" | grep -c '^REPORT' || true)
  [ "$f" -eq 0 ] && [ "$r" -eq 0 ] && echo "   ✅ all invariants hold"
  [ "$f" -gt 0 ] && NEED=1
  flist=$(echo "$out"  | grep '^FINDING' | sed 's/^FINDING //;s/.*/"&"/' | paste -sd, -)
  rlist=$(echo "$out"  | grep '^REPORT'  | sed 's/^REPORT //;s/.*/"&"/'  | paste -sd, -)
  JSON="${JSON}{\"box\":\"$name\",\"reachable\":true,\"findings\":[${flist}],\"reports\":[${rlist}]},"
done

printf '{"generatedAt":"%s","reportOnly":true,"needsAttention":%s,"boxes":[%s]}\n' \
  "$(date -Iseconds)" "$([ $NEED -eq 1 ] && echo true || echo false)" "${JSON%,}" > "$OUT_JSON"
echo ""; echo "------------------------------------------------------------"
if [ $NEED -eq 1 ]; then
  echo "RESULT: data-integrity findings (operator action — no auto-fix). JSON -> $OUT_JSON"
  exit 2
else
  echo "RESULT: every box's data invariants hold. JSON -> $OUT_JSON"; exit 0
fi
