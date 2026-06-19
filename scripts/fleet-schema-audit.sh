#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# fleet-schema-audit.sh — fleet-wide DB SCHEMA consistency checker
# ---------------------------------------------------------------------------
# Compares the *structure* (tables + columns) of every fleet box's production
# DB. DATA is location-specific and intentionally IGNORED — this only reads
# sqlite_master + PRAGMA table_info, never a single row of business data.
#
# Drift model: boxes are grouped by deployed app VERSION. Within a version
# cohort every box MUST have an identical schema fingerprint — the consensus
# (lines present on the most boxes in the cohort) is treated as canonical, and
# any box missing canonical tables/columns is flagged as DRIFT. A box simply
# behind on version is expected auto-update lag, reported separately, NOT
# flagged as drift. This is the exact failure class behind the 24h
# NeighborhoodEvent outage (Gotcha #6) and the ArtistInterferenceProfile /
# Location.latitude missing-on-5-of-6 incidents (see verify-install.sh
# check_schema_completeness, whose per-box logic this complements fleet-wide).
#
# Read-only. No DB writes anywhere. The companion fixer is fix-schema-drift.sh.
#
# Auth: reads the fleet SSH password from $FLEET_SSH_PW (never hardcoded — see
# feedback-password-leak-in-git-history). Export it before running:
#   FLEET_SSH_PW='...' bash scripts/fleet-schema-audit.sh
#
# Output: human report to stdout + machine-readable JSON to
#   /tmp/fleet-schema-audit.json   (consumed by the Hermes task / ask_claude_code)
#
# Exit code: 0 = no drift, 2 = drift detected, 1 = usage/setup error.
# ---------------------------------------------------------------------------
set -uo pipefail

DB="/home/ubuntu/sports-bar-data/production.db"
OUT_JSON="/tmp/fleet-schema-audit.json"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=no"

# Fleet roster (Tailscale MagicDNS IPs — see reference-tailscale-hostnames memory).
# Override with FLEET_HOSTS="name=ip name=ip ...". The local box (Holmgren) is
# included via 127.0.0.1 so it's audited without an SSH round-trip.
DEFAULT_HOSTS="holmgren=127.0.0.1 leg-lamp=100.101.200.82 luckys=100.77.85.89 graystone=100.93.130.14 greenville=100.112.255.60 appleton=100.107.223.47 lime-kiln=100.89.6.80"
HOSTS="${FLEET_HOSTS:-$DEFAULT_HOSTS}"

if [ -z "${FLEET_SSH_PW:-}" ]; then
  echo "ERROR: set FLEET_SSH_PW (fleet SSH password) before running." >&2
  echo "  FLEET_SSH_PW='...' bash scripts/fleet-schema-audit.sh" >&2
  exit 1
fi
command -v sshpass >/dev/null 2>&1 || { echo "ERROR: sshpass not installed." >&2; exit 1; }

# Fingerprint query: one "table|column" line per column across all user tables.
# pragma_table_info() table-valued function needs SQLite >= 3.16 (fleet is newer).
FP_SQL="SELECT m.name||'|'||p.name FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type='table' AND m.name NOT LIKE 'sqlite_%' ORDER BY 1;"
FP_B64=$(printf '%s' "$FP_SQL" | base64 -w0)

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# --- 1. collect (version, fingerprint) from every reachable box -------------
declare -A VERSION FPFILE REACH
for pair in $HOSTS; do
  name="${pair%%=*}"; ip="${pair##*=}"
  if [ "$ip" = "127.0.0.1" ]; then
    ver=$(node -e "console.log(require('/home/ubuntu/Sports-Bar-TV-Controller/package.json').version)" 2>/dev/null || echo unknown)
    echo "$FP_B64" | base64 -d | sqlite3 "$DB" > "$WORK/$name.fp" 2>/dev/null
  else
    ver=$(sshpass -p "$FLEET_SSH_PW" ssh $SSH_OPTS ubuntu@"$ip" \
      "node -e \"console.log(require('/home/ubuntu/Sports-Bar-TV-Controller/package.json').version)\" 2>/dev/null || echo unknown" 2>/dev/null)
    sshpass -p "$FLEET_SSH_PW" ssh $SSH_OPTS ubuntu@"$ip" \
      "echo $FP_B64 | base64 -d | sqlite3 $DB 2>/dev/null" 2>/dev/null > "$WORK/$name.fp"
  fi
  if [ -s "$WORK/$name.fp" ]; then
    REACH[$name]=1; VERSION[$name]="${ver:-unknown}"; FPFILE[$name]="$WORK/$name.fp"
  else
    REACH[$name]=0; VERSION[$name]="${ver:-unreachable}"
    echo "  [!] $name ($ip): unreachable or empty schema — skipped"
  fi
done

# --- 2. group by version, build per-cohort consensus, flag deviations -------
declare -A COHORT
for name in "${!REACH[@]}"; do
  [ "${REACH[$name]}" = "1" ] || continue
  v="${VERSION[$name]}"
  COHORT[$v]="${COHORT[$v]:-} $name"
done

DRIFT=0
JSON_BOXES=""; JSON_DRIFT=""
echo ""
echo "============================================================"
echo "FLEET SCHEMA AUDIT — $(date -Iseconds)"
echo "============================================================"
for v in $(printf '%s\n' "${!COHORT[@]}" | sort); do
  members=${COHORT[$v]}
  count=$(echo $members | wc -w)
  echo ""
  echo "## version $v  (${count} box(es):${members} )"
  # consensus = every table|col line, counted across cohort members; canonical
  # lines appear on the MAX number of members (the majority structure).
  cat $(for m in $members; do echo "${FPFILE[$m]}"; done) | sort | uniq -c | sort -rn > "$WORK/cohort-$v.counts"
  maxseen=$(awk 'NR==1{print $1}' "$WORK/cohort-$v.counts")
  awk -v mx="$count" '$1==mx{ $1=""; sub(/^ /,""); print }' "$WORK/cohort-$v.counts" | sort > "$WORK/canon-$v.lines"
  canon_n=$(wc -l < "$WORK/canon-$v.lines")
  echo "   canonical structure: ${canon_n} table.column lines (present on all ${count})"
  for m in $members; do
    missing=$(comm -23 "$WORK/canon-$v.lines" <(sort "${FPFILE[$m]}"))
    extra=$(comm -13 "$WORK/canon-$v.lines" <(sort "${FPFILE[$m]}"))
    nm=$(echo "$missing" | grep -c . || true)
    nx=$(echo "$extra" | grep -c . || true)
    if [ "$nm" -gt 0 ]; then
      DRIFT=1
      echo "   ❌ $m: MISSING ${nm} (vs cohort) -> $(echo "$missing" | tr '\n' ' ' | cut -c1-160)"
      mj=$(echo "$missing" | grep . | sed 's/.*/"&"/' | paste -sd, -)
      JSON_DRIFT="${JSON_DRIFT}{\"box\":\"$m\",\"version\":\"$v\",\"missing\":[${mj}]},"
    elif [ "$nx" -gt 0 ]; then
      # extra tables/cols (often orphans like sdr_*) — informational, not a fix trigger
      echo "   ⚠️  $m: ${nx} extra line(s) not in cohort consensus (orphan? informational)"
    else
      echo "   ✅ $m: matches cohort canonical"
    fi
    JSON_BOXES="${JSON_BOXES}{\"box\":\"$m\",\"version\":\"$v\",\"lines\":$(wc -l < ${FPFILE[$m]})},"
  done
done

# cross-version note: behind-version boxes are lag, not drift
nverbs=$(printf '%s\n' "${!COHORT[@]}" | sort -V | wc -l)
if [ "$nverbs" -gt 1 ]; then
  echo ""
  echo "## version spread: $(printf '%s ' $(printf '%s\n' "${!COHORT[@]}" | sort -V)) — boxes behind latest will converge via auto-update (lag, not drift)"
fi

printf '{"generatedAt":"%s","drift":%s,"boxes":[%s],"driftDetails":[%s]}\n' \
  "$(date -Iseconds)" "$([ $DRIFT -eq 1 ] && echo true || echo false)" \
  "${JSON_BOXES%,}" "${JSON_DRIFT%,}" > "$OUT_JSON"

echo ""
echo "------------------------------------------------------------"
if [ $DRIFT -eq 1 ]; then
  echo "RESULT: DRIFT DETECTED. JSON -> $OUT_JSON"
  echo "  Next: bash scripts/fix-schema-drift.sh <box>  (tier-1 safe migrate)"
  exit 2
else
  echo "RESULT: all same-version boxes structurally identical. JSON -> $OUT_JSON"
  exit 0
fi
