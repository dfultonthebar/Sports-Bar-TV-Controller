#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# fleet-deps-audit.sh — ensure required dependencies/software are installed
#                       on EVERY fleet box (companion to fleet-schema-audit.sh)
# ---------------------------------------------------------------------------
# "Same software everywhere": every box must have the toolchain the app + the
# fleet scripts need. This checks each box and, with --fix, AUTO-INSTALLS the
# missing SAFE apt packages (idempotent). Version-sensitive / special-install
# items (Node MAJOR version, pm2, ollama + its models) are REPORTED and left
# for escalation — they are NEVER auto-changed here, because a Node major bump
# is a 20-40min risky native-rebuild procedure (feedback-node-major-upgrade-
# gotchas) and ollama is the IPEX/CUDA build, not an apt package.
#
# Usage:
#   FLEET_SSH_PW=... bash scripts/fleet-deps-audit.sh            # report only
#   FLEET_SSH_PW=... bash scripts/fleet-deps-audit.sh --fix      # auto-install safe apt deps
#
# Exit: 0 = every box has all SAFE deps (after any --fix), 2 = missing deps
#       remain or a version/special item needs escalation, 1 = setup error.
# Output: human report + /tmp/fleet-deps-audit.json
# ---------------------------------------------------------------------------
set -uo pipefail

OUT_JSON="/tmp/fleet-deps-audit.json"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=12 -o BatchMode=no"
FIX=0; [ "${1:-}" = "--fix" ] && FIX=1

DEFAULT_HOSTS="holmgren=100.117.155.98 leg-lamp=100.101.200.82 luckys=100.77.85.89 graystone=100.93.130.14 greenville=100.112.255.60 appleton=100.107.223.47 lime-kiln=100.89.6.80"
HOSTS="${FLEET_HOSTS:-$DEFAULT_HOSTS}"

# SAFE deps: "command:aptpackage" — auto-installable with --fix.
SAFE_DEPS="sqlite3:sqlite3 jq:jq curl:curl git:git sshpass:sshpass python3:python3 base64:coreutils"
# Minimum Node major (fleet standard). Node upgrades are NOT auto-applied.
NODE_MIN_MAJOR=22

if [ -z "${FLEET_SSH_PW:-}" ]; then echo "ERROR: set FLEET_SSH_PW." >&2; exit 1; fi
command -v sshpass >/dev/null 2>&1 || { echo "ERROR: sshpass not installed locally." >&2; exit 1; }

# Remote probe+fix, built once. Absolute commands only (cwd-independent).
# Emits one line per finding: OK/INSTALLED/MISSING/ESCALATE <what> [detail].
read -r -d '' REMOTE <<REMOTE_EOF
set -uo pipefail
FIX=$FIX
NODE_MIN=$NODE_MIN_MAJOR
SAFE="$SAFE_DEPS"
for pair in \$SAFE; do
  cmd="\${pair%%:*}"; pkg="\${pair##*:}"
  if command -v "\$cmd" >/dev/null 2>&1; then
    echo "OK \$cmd"
  elif [ "\$FIX" = "1" ]; then
    if echo "$FLEET_SSH_PW" | sudo -S apt-get install -y "\$pkg" >/dev/null 2>&1 && command -v "\$cmd" >/dev/null 2>&1; then
      echo "INSTALLED \$cmd (\$pkg)"
    else
      echo "MISSING \$cmd (\$pkg) — apt install FAILED"
    fi
  else
    echo "MISSING \$cmd (\$pkg)"
  fi
done
# Node major (report/escalate only)
if command -v node >/dev/null 2>&1; then
  nv=\$(node -v 2>/dev/null | sed 's/^v//'); maj=\${nv%%.*}
  if [ "\${maj:-0}" -ge "\$NODE_MIN" ] 2>/dev/null; then echo "OK node (v\$nv)"; else echo "ESCALATE node (v\$nv < \$NODE_MIN — major upgrade, manual)"; fi
else echo "ESCALATE node (absent — manual install)"; fi
command -v npm >/dev/null 2>&1 && echo "OK npm" || echo "ESCALATE npm (absent)"
command -v pm2 >/dev/null 2>&1 && echo "OK pm2" || echo "ESCALATE pm2 (absent — npm -g install, manual)"
# Ollama: present + has the core models? (IPEX/CUDA build — never apt)
if command -v ollama >/dev/null 2>&1; then
  models=\$(ollama list 2>/dev/null | awk 'NR>1{print \$1}' | tr '\n' ',')
  echo "OK ollama (models: \${models:-none})"
else echo "ESCALATE ollama (absent — IPEX/CUDA build, manual)"; fi
REMOTE_EOF

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
echo "============================================================"
echo "FLEET DEPENDENCY AUDIT — $(date -Iseconds)  (fix=$FIX)"
echo "============================================================"
NEED=0; JSON=""
for pair in $HOSTS; do
  name="${pair%%=*}"; ip="${pair##*=}"
  echo ""; echo "## $name ($ip)"
  out=$(sshpass -p "$FLEET_SSH_PW" ssh $SSH_OPTS ubuntu@"$ip" "$REMOTE" 2>/dev/null)
  if [ -z "$out" ]; then echo "   [!] unreachable — skipped"; JSON="${JSON}{\"box\":\"$name\",\"reachable\":false},"; continue; fi
  miss=$(echo "$out" | grep -c '^MISSING' || true)
  esc=$(echo "$out"  | grep -c '^ESCALATE' || true)
  inst=$(echo "$out" | grep -c '^INSTALLED' || true)
  echo "$out" | grep -vE '^OK ' | sed 's/^/   /'
  [ "$inst" -gt 0 ] && echo "   (+${inst} auto-installed)"
  [ "$miss" -eq 0 ] && [ "$esc" -eq 0 ] && echo "   ✅ all deps present"
  [ "$miss" -gt 0 ] || [ "$esc" -gt 0 ] && NEED=1
  esc_list=$(echo "$out" | grep '^ESCALATE' | sed 's/^ESCALATE //' | sed 's/.*/"&"/' | paste -sd, -)
  miss_list=$(echo "$out" | grep '^MISSING' | sed 's/^MISSING //' | sed 's/.*/"&"/' | paste -sd, -)
  JSON="${JSON}{\"box\":\"$name\",\"reachable\":true,\"installed\":$inst,\"missing\":[${miss_list}],\"escalate\":[${esc_list}]},"
done
printf '{"generatedAt":"%s","fixApplied":%s,"needsAttention":%s,"boxes":[%s]}\n' \
  "$(date -Iseconds)" "$([ $FIX -eq 1 ] && echo true || echo false)" \
  "$([ $NEED -eq 1 ] && echo true || echo false)" "${JSON%,}" > "$OUT_JSON"
echo ""; echo "------------------------------------------------------------"
if [ $NEED -eq 1 ]; then
  echo "RESULT: deps missing or escalation needed. JSON -> $OUT_JSON"
  [ $FIX -eq 0 ] && echo "  Re-run with --fix to auto-install the safe apt deps."
  exit 2
else
  echo "RESULT: every box has all required deps. JSON -> $OUT_JSON"; exit 0
fi
