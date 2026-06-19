#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# fleet-firmware-audit.sh — record + compare reachable device firmware vs
#                           documented minimums, per location (REPORT-ONLY)
# ---------------------------------------------------------------------------
# Companion to fleet-deps/security/schema audits. This one looks at HARDWARE
# firmware (Shure SLX-D receivers, Atlas processors, Crestron matrices).
#
# ⚠️  REPORT-ONLY BY DESIGN — this script NEVER flashes, upgrades, or writes
#     firmware to any device, and there is NO --fix flag. A failed flash
#     bricks a device behind the bar. Firmware updates are an operator
#     decision made at the device's own web UI / vendor tool, off-hours.
#
# Why this audit calls each box's LOCAL app API instead of the DB or the
# device protocols directly:
#   - There is NO firmware column anywhere in the DB schema. Firmware is only
#     knowable by live-probing the device.
#   - The device probes already live inside the Next.js app (Shure TCP 2202,
#     Atlas TCP 5321, Crestron Telnet 23). Rather than reimplement three wire
#     protocols in bash, we curl each box's own http://localhost:3001 API,
#     which talks to the devices on the bar LAN that only that box can reach.
#
# Best-effort semantics: a device that is OFF / absent / unreachable is
# recorded as `unknown` — NOT a failure. We can only audit what is online.
#
# Endpoints used (confirmed present 2026-06-19 — see notes at bottom):
#   - GET  /api/shure-rf/status            (no auth) → receivers[] w/ firmwareVersion
#   - POST /api/shure-rf/preflight {ip,port}(ADMIN)  → checks[] incl thirdPartyControls
#   - GET  /api/crestron/matrices          (no auth) → matrices[] (model/ip/port)
#   - POST /api/crestron/matrices/{id}/test(no auth) → deviceInfo.response = raw VER
#
# Device classes with NO clean firmware endpoint (emitted as REPORT, manual):
#   - Atlas processors  — NO API route surfaces firmware. atlas-http-client.ts
#       carries a firmwareVersion field internally but no /api/atlas/* route
#       returns it; /api/atlas/query-hardware returns sources/zones/groups only.
#   - Wolf Pack matrix  — DELIBERATELY OUT. No firmware accessor in the wolfpack
#       package or any /api/wolfpack/* route (TCP SET/o2o routing only).
#   - DirecTV receivers — DELIBERATELY OUT. No clean firmware accessor.
#
# Usage:   FLEET_SSH_PW=... bash scripts/fleet-firmware-audit.sh
# Exit: 0 = no firmware findings (everything online meets minimums, or is
#           `unknown`/manual-report), 2 = at least one box has a firmware
#           FINDING (below-minimum / third-party-controls off / fleet laggard),
#           1 = local setup error.
# Output: human report + /tmp/fleet-firmware-audit.json
# ---------------------------------------------------------------------------
set -uo pipefail

OUT_JSON="/tmp/fleet-firmware-audit.json"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=12 -o BatchMode=no"
APP="http://localhost:3001"

# Documented minimums (from CLAUDE.md §7a + packages/shure-slxd/README.md).
SHURE_MIN="1.1.0"          # network control requires ≥ 1.1.0
ATLAS_CUSTOM_PRI="4.5"     # firmware ≥4.5 adds Custom Priority Volume (drop-watcher caveat)

DEFAULT_HOSTS="holmgren=100.117.155.98 leg-lamp=100.101.200.82 luckys=100.77.85.89 graystone=100.93.130.14 greenville=100.112.255.60 appleton=100.107.223.47 lime-kiln=100.89.6.80"
HOSTS="${FLEET_HOSTS:-$DEFAULT_HOSTS}"

if [ -z "${FLEET_SSH_PW:-}" ]; then echo "ERROR: set FLEET_SSH_PW." >&2; exit 1; fi
command -v sshpass >/dev/null 2>&1 || { echo "ERROR: sshpass not installed locally." >&2; exit 1; }
command -v jq      >/dev/null 2>&1 || { echo "ERROR: jq not installed locally." >&2; exit 1; }

# ---------------------------------------------------------------------------
# Remote probe, built once. Runs ON each box, curling that box's own app API.
# Emits, per device, ONE machine-readable line consumed by the local parser:
#   FW <class> <key> <status> <detail>
#     class  = shure|atlas|crestron
#     key    = receiver/processor/matrix identifier (no spaces)
#     status = OK | FINDING | UNKNOWN | REPORT
#     detail = free text (rest of line)
# REPORT-ONLY: this remote half issues only GET + read-only test POSTs. It
# never sends a firmware/upgrade/flash command to any device.
# ---------------------------------------------------------------------------
read -r -d '' REMOTE <<REMOTE_EOF
set -uo pipefail
APP="$APP"
SHURE_MIN="$SHURE_MIN"
ATLAS_CUSTOM_PRI="$ATLAS_CUSTOM_PRI"

command -v curl >/dev/null 2>&1 || { echo "FW env curl UNKNOWN (curl absent on box)"; exit 0; }
HAVE_JQ=0; command -v jq >/dev/null 2>&1 && HAVE_JQ=1
if [ "\$HAVE_JQ" = "0" ]; then echo "FW env jq UNKNOWN (jq absent on box — cannot parse API JSON)"; exit 0; fi

CURL="curl -s --max-time 25"

# verlt A B  -> true (rc 0) if A < B as dotted version
verlt() {
  [ "\$1" = "\$2" ] && return 1
  local lo; lo=\$(printf '%s\n%s\n' "\$1" "\$2" | sort -t. -k1,1n -k2,2n -k3,3n | head -1)
  [ "\$lo" = "\$1" ]
}

# ---- SHURE SLX-D ---------------------------------------------------------
# /api/shure-rf/status (no auth) enumerates managed receivers + firmwareVersion.
shure_json=\$(\$CURL "\$APP/api/shure-rf/status" 2>/dev/null)
if [ -z "\$shure_json" ] || ! echo "\$shure_json" | jq -e '.success==true' >/dev/null 2>&1; then
  echo "FW shure - UNKNOWN (status endpoint unreachable or non-OK — app down?)"
else
  rcount=\$(echo "\$shure_json" | jq '.receivers | length' 2>/dev/null || echo 0)
  if [ "\${rcount:-0}" = "0" ]; then
    echo "FW shure - UNKNOWN (no Shure receiver configured on this box)"
  else
    # Per receiver: ip, port, connected, firmwareVersion
    echo "\$shure_json" | jq -r '.receivers[] | [(.receiverName // .receiverId // "rx"), .ipAddress, (.port|tostring), (.connected|tostring), (.firmwareVersion // "")] | @tsv' 2>/dev/null |
    while IFS=\$'\t' read -r rname rip rport rconn rfw; do
      key=\$(echo "\${rname:-rx}" | tr ' ' '_')
      if [ "\$rconn" != "true" ]; then
        echo "FW shure \$key UNKNOWN (receiver \$rip not connected — powered off / unreachable)"
        continue
      fi
      if [ -z "\$rfw" ]; then
        # Connected but firmware not yet cached — try a one-shot preflight.
        # preflight is ADMIN-gated; unauthenticated localhost curl returns 401.
        pf=\$(\$CURL -X POST -H 'Content-Type: application/json' -d "{\"ip\":\"\$rip\",\"port\":\$rport}" "\$APP/api/shure-rf/preflight" 2>/dev/null)
        if echo "\$pf" | jq -e '.success==true' >/dev/null 2>&1; then
          rfw=\$(echo "\$pf" | jq -r '.receiver.firmwareVersion // ""')
        fi
      fi
      if [ -z "\$rfw" ]; then
        echo "FW shure \$key UNKNOWN (\$rip connected but firmware not reported — preflight ADMIN-gated, status cache empty)"
        continue
      fi
      # Have a firmware string. Compare to documented minimum.
      base=\$(echo "\$rfw" | grep -oE '^[0-9]+(\.[0-9]+){1,2}' | head -1)
      base="\${base:-\$rfw}"
      if verlt "\$base" "\$SHURE_MIN"; then
        echo "FW shure \$key FINDING (\$rip firmware \$rfw < \$SHURE_MIN minimum — network control unreliable; upgrade at receiver web UI)"
      else
        # Firmware OK; opportunistically confirm third-party-controls via preflight
        # (only if not ADMIN-blocked). thirdPartyControlsEnabled=false is a FINDING.
        pf=\$(\$CURL -X POST -H 'Content-Type: application/json' -d "{\"ip\":\"\$rip\",\"port\":\$rport}" "\$APP/api/shure-rf/preflight" 2>/dev/null)
        if echo "\$pf" | jq -e '.success==true' >/dev/null 2>&1; then
          tpc=\$(echo "\$pf" | jq -r '.checks[] | select(.name=="thirdPartyControlsEnabled") | .passed' 2>/dev/null | head -1)
          if [ "\$tpc" = "false" ]; then
            echo "FW shure \$key FINDING (\$rip firmware \$rfw OK but third-party-controls DISABLED — Menu→Advanced→Network→Allow Third-Party Controls→Enable)"
          else
            echo "FW shure \$key OK (\$rip firmware \$rfw ≥ \$SHURE_MIN, third-party-controls on)"
          fi
        else
          echo "FW shure \$key OK (\$rip firmware \$rfw ≥ \$SHURE_MIN; third-party-controls not verified — preflight ADMIN-gated)"
        fi
      fi
    done
  fi
fi

# ---- ATLAS ---------------------------------------------------------------
# No API route surfaces Atlas firmware (atlas-http-client.ts has the field
# internally, but /api/atlas/* never returns it). Emit a REPORT line per
# configured processor so the operator manual-checks the Atlas web UI.
atlas_proc=\$(\$CURL "\$APP/api/audio-processor" 2>/dev/null)
# /api/audio-processor → { processors: [{ name, model, processorType, ipAddress, ... }] }
# processorType 'atlas' is the Atlas discriminator (dbx-zonepro/bss are other DSPs).
acount=0
if echo "\$atlas_proc" | jq -e '.' >/dev/null 2>&1; then
  acount=\$(echo "\$atlas_proc" | jq '[ (.processors // []) [] | select((.processorType//"atlas")=="atlas" or (.model//"" | test("AZM";"i"))) ] | length' 2>/dev/null || echo 0)
fi
if [ "\${acount:-0}" != "0" ] 2>/dev/null && [ "\${acount:-0}" -gt 0 ] 2>/dev/null; then
  echo "\$atlas_proc" | jq -r '(.processors // [])[] | select((.processorType//"atlas")=="atlas" or (.model//"" | test("AZM";"i"))) | [(.name // .id // "atlas"), (.ipAddress // "?"), (.model // "?")] | @tsv' 2>/dev/null |
  while IFS=\$'\t' read -r aname aip amodel; do
    key=\$(echo "\${aname:-atlas}" | tr ' ' '_')
    echo "FW atlas \$key REPORT (\$aip \$amodel — no firmware endpoint; manual check at Atlas web UI. Note: fw ≥ \$ATLAS_CUSTOM_PRI adds Custom Priority Volume, affects drop-watcher reading)"
  done
else
  echo "FW atlas - UNKNOWN (no Atlas processor configured on this box)"
fi

# ---- CRESTRON ------------------------------------------------------------
# /api/crestron/matrices (no auth) enumerates; /test (no auth) sends VER and
# returns the raw firmware/banner string in deviceInfo.response. We RECORD the
# raw VER text (no minimum to compare against — Crestron has no documented
# floor in our docs), and only FINDING if a configured matrix won't respond.
cres_json=\$(\$CURL "\$APP/api/crestron/matrices" 2>/dev/null)
if ! echo "\$cres_json" | jq -e '.success==true' >/dev/null 2>&1; then
  echo "FW crestron - UNKNOWN (matrices endpoint unreachable or non-OK)"
else
  ccount=\$(echo "\$cres_json" | jq '.matrices | length' 2>/dev/null || echo 0)
  if [ "\${ccount:-0}" = "0" ]; then
    echo "FW crestron - UNKNOWN (no Crestron matrix configured on this box)"
  else
    echo "\$cres_json" | jq -r '.matrices[] | [.id, (.name // "matrix"), (.model // "?"), (.ipAddress // "?")] | @tsv' 2>/dev/null |
    while IFS=\$'\t' read -r cid cname cmodel cip; do
      key=\$(echo "\${cname:-matrix}" | tr ' ' '_')
      tj=\$(\$CURL -X POST "\$APP/api/crestron/matrices/\$cid/test" 2>/dev/null)
      ok=\$(echo "\$tj" | jq -r '.success' 2>/dev/null)
      if [ "\$ok" = "true" ]; then
        ver=\$(echo "\$tj" | jq -r '.deviceInfo.response // ""' 2>/dev/null | tr '\n\r' '  ' | tr -s ' ' | sed 's/^ *//;s/ *\$//')
        [ -z "\$ver" ] && ver="(connected, no VER text)"
        echo "FW crestron \$key REPORT (\$cip \$cmodel — VER: \${ver:0:120})"
      else
        echo "FW crestron \$key FINDING (\$cip \$cmodel configured but did not respond to VER — powered off, or Telnet/port issue)"
      fi
    done
  fi
fi
REMOTE_EOF

echo "============================================================"
echo "FLEET FIRMWARE AUDIT — $(date -Iseconds)  (REPORT-ONLY — never flashes)"
echo "============================================================"

NEED=0
JSON=""
for pair in $HOSTS; do
  name="${pair%%=*}"; ip="${pair##*=}"
  echo ""; echo "## $name ($ip)"
  out=$(sshpass -p "$FLEET_SSH_PW" ssh $SSH_OPTS ubuntu@"$ip" "$REMOTE" 2>/dev/null)
  if [ -z "$out" ]; then
    echo "   [!] unreachable — skipped"
    JSON="${JSON}{\"box\":\"$name\",\"reachable\":false},"
    continue
  fi

  fnd=$(echo "$out" | grep -c ' FINDING ' || true)
  okc=$(echo "$out" | grep -c ' OK '      || true)
  unk=$(echo "$out" | grep -c ' UNKNOWN ' || true)
  rep=$(echo "$out" | grep -c ' REPORT '  || true)

  # Show findings + reports + unknowns; collapse OK to a count.
  echo "$out" | grep -E ' (FINDING|REPORT|UNKNOWN) ' | sed 's/^FW /   /'
  [ "$okc" -gt 0 ] && echo "   (+${okc} device(s) OK / meet minimums)"
  [ "$fnd" -eq 0 ] && [ "$rep" -eq 0 ] && [ "$unk" -eq 0 ] && [ "$okc" -gt 0 ] && echo "   ✅ all reachable firmware meets minimums"
  [ "$fnd" -eq 0 ] && [ "$rep" -eq 0 ] && [ "$unk" -gt 0 ] && [ "$okc" -eq 0 ] && echo "   (no probeable devices online — nothing to audit)"
  [ "$fnd" -gt 0 ] && NEED=1

  # JSON: collect each finding/report line's detail (escape quotes/backslashes).
  esc() { echo "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
  find_list=$(echo "$out" | grep ' FINDING ' | while read -r l; do printf '"%s",' "$(esc "$l")"; done)
  rep_list=$(echo "$out"  | grep ' REPORT '  | while read -r l; do printf '"%s",' "$(esc "$l")"; done)
  JSON="${JSON}{\"box\":\"$name\",\"reachable\":true,\"ok\":$okc,\"unknown\":$unk,\"reports\":[${rep_list%,}],\"findings\":[${find_list%,}]},"
done

printf '{"generatedAt":"%s","reportOnly":true,"needsAttention":%s,"boxes":[%s]}\n' \
  "$(date -Iseconds)" "$([ $NEED -eq 1 ] && echo true || echo false)" "${JSON%,}" > "$OUT_JSON"

echo ""; echo "------------------------------------------------------------"
echo "NOTE: REPORT lines (Atlas, Crestron VER, etc.) are informational —"
echo "      firmware updates are an off-hours operator decision at the"
echo "      device's own UI. This script NEVER flashes firmware."
if [ $NEED -eq 1 ]; then
  echo "RESULT: firmware FINDING(s) present (below-minimum or third-party-controls off). JSON -> $OUT_JSON"
  exit 2
else
  echo "RESULT: no firmware findings on reachable devices. JSON -> $OUT_JSON"
  exit 0
fi
