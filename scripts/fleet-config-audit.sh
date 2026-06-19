#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# fleet-config-audit.sh — config/env/service CONSISTENCY across the fleet
#                         (companion to fleet-deps-audit / fleet-security-audit)
# ---------------------------------------------------------------------------
# "Same config everywhere": the committed, location-agnostic config files and
# the systemd/PM2/nginx wiring must be identical-in-SHAPE on every box. Data
# VALUES are per-location (IPs, PINs, keys) so this script compares
# file-hashes / key-SETS / enabled-state / route-SETS — never the values.
#
# Checks:
#   1 ecosystem.config.js hash  — committed + location-agnostic; must match (REPORT)
#   2 systemd units             — linger=yes, autoupdate.timer, ollama-ipex  (AUTO-FIX)
#   3 .env required-key presence— required-everywhere key NAMES present       (REPORT)
#   4 nginx allow-list          — live config grants every route the committed
#                                 setup script grants                         (AUTO-FIX)
#   5 PM2 process set           — sports-bar-tv-controller online; no split-brain
#                                 bartender-proxy when nginx serves :3002      (AUTO-FIX)
#
# NEVER logs a secret VALUE (env values, keys, PINs) — only key NAMES /
# presence booleans / enabled-state / route names / file hashes.
#
# Usage:
#   FLEET_SSH_PW=... bash scripts/fleet-config-audit.sh           # report only
#   FLEET_SSH_PW=... bash scripts/fleet-config-audit.sh --fix     # safe auto-fixes
#
# Exit: 0 = every box consistent (after any --fix), 2 = findings remain,
#       1 = local setup error.  Output: human report + /tmp/fleet-config-audit.json
# ---------------------------------------------------------------------------
set -uo pipefail

OUT_JSON="/tmp/fleet-config-audit.json"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=12 -o BatchMode=no"
REPO="/home/ubuntu/Sports-Bar-TV-Controller"
FIX=0; [ "${1:-}" = "--fix" ] && FIX=1

DEFAULT_HOSTS="holmgren=100.117.155.98 leg-lamp=100.101.200.82 luckys=100.77.85.89 graystone=100.93.130.14 greenville=100.112.255.60 appleton=100.107.223.47 lime-kiln=100.89.6.80"
HOSTS="${FLEET_HOSTS:-$DEFAULT_HOSTS}"

# .env keys that MUST be present on every box (NAMES only — never values).
# Opt-in flags that legitimately differ per-location are NOT listed here:
# TICKETMASTER_API_KEY, SDR_*, AI_HUB_T4_ENABLED, DISTRIBUTION_ENGINE_LEARNING, etc.
REQUIRED_ENV_KEYS="LOCATION_ID LOCATION_NAME AUTH_COOKIE_SECURE DATABASE_URL NEXTAUTH_URL SPORTS_GUIDE_API_KEY SPORTS_GUIDE_USER_ID NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"

if [ -z "${FLEET_SSH_PW:-}" ]; then echo "ERROR: set FLEET_SSH_PW." >&2; exit 1; fi
command -v sshpass >/dev/null 2>&1 || { echo "ERROR: sshpass not installed locally." >&2; exit 1; }

# ---------------------------------------------------------------------------
# Derive the canonical /api allow-list from the COMMITTED setup script. These
# are the routes the bartender nginx config is supposed to grant. We extract
# every `location <prefix> { proxy_pass ... }` whose path begins with /api so
# the comparison tracks the script automatically as routes are added/removed.
# ---------------------------------------------------------------------------
SETUP_SCRIPT="$REPO/scripts/setup-bartender-nginx.sh"
if [ ! -f "$SETUP_SCRIPT" ]; then echo "ERROR: $SETUP_SCRIPT not found." >&2; exit 1; fi
# Match both `location /api/foo {` and `location = /api/foo {` forms; emit the path.
CANON_API_ROUTES=$(grep -oE 'location[[:space:]]+(=[[:space:]]+)?/api[^ ]*' "$SETUP_SCRIPT" \
  | sed -E 's/^location[[:space:]]+(=[[:space:]]+)?//' | sort -u | paste -sd' ' -)
CANON_API_COUNT=$(echo "$CANON_API_ROUTES" | wc -w | tr -d ' ')

# Local hash of the committed ecosystem.config.js — the fleet reference value.
# (Boxes are expected to match this; a divergent hash = stale commit / hand-edit.)
LOCAL_ECO_HASH=$(sha256sum "$REPO/ecosystem.config.js" 2>/dev/null | awk '{print $1}')

# ---------------------------------------------------------------------------
# Per-box remote probe (+fix). Emits one line per check:
#   OK / FINDING / FIXED / ESCALATE <what> (detail)
# Absolute commands only (cwd-independent). Never prints a secret value.
# ---------------------------------------------------------------------------
read -r -d '' REMOTE <<REMOTE_EOF
set -uo pipefail
FIX=$FIX
REPO="$REPO"
REQUIRED_ENV_KEYS="$REQUIRED_ENV_KEYS"
CANON_API_ROUTES="$CANON_API_ROUTES"
CANON_API_COUNT=$CANON_API_COUNT
LOCAL_ECO_HASH="$LOCAL_ECO_HASH"
SETUP_SCRIPT="$SETUP_SCRIPT"
SUDO() { echo "$FLEET_SSH_PW" | sudo -S "\$@" 2>/dev/null; }

# --- 1. ecosystem.config.js hash (committed, location-agnostic) ---
if [ -f "\$REPO/ecosystem.config.js" ]; then
  h=\$(sha256sum "\$REPO/ecosystem.config.js" 2>/dev/null | awk '{print \$1}')
  if [ -z "\$LOCAL_ECO_HASH" ]; then
    echo "OK ecosystem (hash \${h:0:12}, no local reference)"
  elif [ "\$h" = "\$LOCAL_ECO_HASH" ]; then
    echo "OK ecosystem (hash matches fleet reference)"
  else
    echo "FINDING ecosystem (hash \${h:0:12} != reference \${LOCAL_ECO_HASH:0:12} — stale commit or hand-edit)"
  fi
else
  echo "FINDING ecosystem (ecosystem.config.js missing)"
fi

# --- 2. systemd units (AUTO-FIX, idempotent) ---
# 2a. linger=yes for ubuntu (user units run without an active login session)
lng=\$(loginctl show-user ubuntu 2>/dev/null | grep -E '^Linger=' | cut -d= -f2)
if [ "\$lng" = "yes" ]; then echo "OK linger (yes)"
elif [ "\$FIX" = "1" ]; then
  if SUDO loginctl enable-linger ubuntu; then echo "FIXED linger (enabled)"; else echo "FINDING linger (\${lng:-no} — enable-linger FAILED)"; fi
else echo "FINDING linger (\${lng:-no}, want yes — user timers die without it)"; fi

# 2b. sports-bar-autoupdate.timer enabled (user unit)
au=\$(systemctl --user is-enabled sports-bar-autoupdate.timer 2>/dev/null || echo "unknown")
if [ "\$au" = "enabled" ]; then echo "OK autoupdate-timer (enabled)"
elif [ "\$FIX" = "1" ]; then
  if systemctl --user enable --now sports-bar-autoupdate.timer >/dev/null 2>&1; then echo "FIXED autoupdate-timer (enabled)"; else echo "FINDING autoupdate-timer (\$au — enable FAILED; unit installed?)"; fi
else echo "FINDING autoupdate-timer (\$au, want enabled)"; fi

# 2c. ollama-ipex.service enabled (system unit). Absent on non-iGPU boxes → ESCALATE, never auto-install.
if systemctl list-unit-files 2>/dev/null | grep -q '^ollama-ipex\.service'; then
  oi=\$(systemctl is-enabled ollama-ipex.service 2>/dev/null || echo "unknown")
  if [ "\$oi" = "enabled" ]; then echo "OK ollama-ipex (enabled)"
  elif [ "\$FIX" = "1" ]; then
    if SUDO systemctl enable --now ollama-ipex.service; then echo "FIXED ollama-ipex (enabled)"; else echo "FINDING ollama-ipex (\$oi — enable FAILED)"; fi
  else echo "FINDING ollama-ipex (\$oi, want enabled)"; fi
else
  echo "ESCALATE ollama-ipex (unit not installed — IPEX build, run setup-iris-ollama.sh manually)"
fi

# --- 3. .env required-key presence (NAMES only, never values) ---
if [ -f "\$REPO/.env" ]; then
  present=\$(grep -oE '^[A-Z_0-9]+=' "\$REPO/.env" 2>/dev/null | sed 's/=\$//' | sort -u)
  missing=""
  for k in \$REQUIRED_ENV_KEYS; do
    echo "\$present" | grep -qx "\$k" || missing="\$missing \$k"
  done
  if [ -z "\$missing" ]; then echo "OK env-keys (all required present)"
  else echo "FINDING env-keys (missing:\$missing)"; fi
else
  echo "FINDING env-keys (.env missing)"
fi

# --- 4. nginx bartender allow-list (AUTO-FIX) ---
# Compare the live config's /api location set against what the committed
# setup script grants. Conservative: FINDING only when the live config is
# missing one or more routes the script grants (extra routes are not flagged).
NGINX_FILE="/etc/nginx/sites-available/bartender-remote"
live=""
if SUDO nginx -T >/tmp/_ngt.\$\$ 2>/dev/null && grep -q 'listen 3002' /tmp/_ngt.\$\$; then
  live=\$(grep -oE 'location[[:space:]]+(=[[:space:]]+)?/api[^ ]*' /tmp/_ngt.\$\$ | sed -E 's/^location[[:space:]]+(=[[:space:]]+)?//' | sort -u)
elif [ -f "\$NGINX_FILE" ]; then
  live=\$(SUDO cat "\$NGINX_FILE" | grep -oE 'location[[:space:]]+(=[[:space:]]+)?/api[^ ]*' | sed -E 's/^location[[:space:]]+(=[[:space:]]+)?//' | sort -u)
fi
rm -f /tmp/_ngt.\$\$ 2>/dev/null
if [ -z "\$live" ]; then
  echo "ESCALATE nginx (bartender config not found / nginx not installed — run setup-bartender-nginx.sh)"
else
  missing_routes=""
  for r in \$CANON_API_ROUTES; do
    echo "\$live" | grep -qx "\$r" || missing_routes="\$missing_routes \$r"
  done
  if [ -z "\$missing_routes" ]; then
    echo "OK nginx (all \$CANON_API_COUNT granted /api routes present)"
  elif [ "\$FIX" = "1" ]; then
    if [ -x "\$SETUP_SCRIPT" ] || [ -f "\$SETUP_SCRIPT" ]; then
      if bash "\$SETUP_SCRIPT" >/dev/null 2>&1 && SUDO nginx -t >/dev/null 2>&1; then
        echo "FIXED nginx (re-ran setup-bartender-nginx.sh; routes restored)"
      else
        echo "FINDING nginx (missing:\$missing_routes — re-run of setup script FAILED, check nginx -t)"
      fi
    else
      echo "FINDING nginx (missing:\$missing_routes — setup script absent on box)"
    fi
  else
    echo "FINDING nginx (live config missing:\$missing_routes)"
  fi
fi

# --- 5. PM2 process set ---
pm2j=\$(pm2 jlist 2>/dev/null)
if [ -z "\$pm2j" ]; then
  echo "ESCALATE pm2 (pm2 jlist empty / pm2 not running)"
else
  main_online=\$(echo "\$pm2j" | grep -o '"name":"sports-bar-tv-controller"[^}]*"status":"online"' | head -1)
  if echo "\$pm2j" | grep -q '"name":"sports-bar-tv-controller"'; then
    if [ -n "\$main_online" ]; then echo "OK pm2 (sports-bar-tv-controller online)"
    else echo "FINDING pm2 (sports-bar-tv-controller present but NOT online)"; fi
  else
    echo "FINDING pm2 (sports-bar-tv-controller process absent)"
  fi
  # Split-brain: legacy bartender-proxy running AND nginx serves :3002
  proxy_running=\$(echo "\$pm2j" | grep -c '"name":"bartender-proxy"' || true)
  nginx_3002=0
  SUDO nginx -T 2>/dev/null | grep -q 'listen 3002' && nginx_3002=1
  if [ "\$proxy_running" -gt 0 ] && [ "\$nginx_3002" = "1" ]; then
    if [ "\$FIX" = "1" ]; then
      if pm2 delete bartender-proxy >/dev/null 2>&1 && pm2 save >/dev/null 2>&1; then
        echo "FIXED pm2 (removed split-brain bartender-proxy; nginx owns :3002)"
      else
        echo "FINDING pm2 (bartender-proxy running alongside nginx :3002 — pm2 delete FAILED)"
      fi
    else
      echo "FINDING pm2 (legacy bartender-proxy running while nginx serves :3002 — split-brain on port 3002)"
    fi
  elif [ "\$proxy_running" -gt 0 ]; then
    echo "OK pm2 (bartender-proxy running; nginx not on :3002 — legacy-but-consistent)"
  fi
fi
REMOTE_EOF

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
echo "============================================================"
echo "FLEET CONFIG AUDIT — $(date -Iseconds)  (fix=$FIX)"
echo "============================================================"
echo "Reference ecosystem.config.js hash: ${LOCAL_ECO_HASH:0:12}"
echo "Canonical bartender /api routes:    $CANON_API_COUNT (from setup-bartender-nginx.sh)"
NEED=0; JSON=""
for pair in $HOSTS; do
  name="${pair%%=*}"; ip="${pair##*=}"
  echo ""; echo "## $name ($ip)"
  out=$(sshpass -p "$FLEET_SSH_PW" ssh $SSH_OPTS ubuntu@"$ip" "$REMOTE" 2>/dev/null)
  if [ -z "$out" ]; then echo "   [!] unreachable — skipped"; JSON="${JSON}{\"box\":\"$name\",\"reachable\":false},"; continue; fi
  echo "$out" | grep -vE '^OK ' | sed 's/^/   /'
  echo "$out" | grep -q '^OK ' && ! echo "$out" | grep -qE '^(FINDING|ESCALATE)' && echo "   ✅ consistent"
  f=$(echo "$out"  | grep -c '^FINDING'  || true)
  esc=$(echo "$out" | grep -c '^ESCALATE' || true)
  fx=$(echo "$out" | grep -c '^FIXED'    || true)
  [ "$fx" -gt 0 ] && echo "   (+${fx} auto-fixed)"
  [ "$f" -gt 0 ] || [ "$esc" -gt 0 ] && NEED=1
  flist=$(echo "$out"   | grep '^FINDING'  | sed 's/^FINDING //;s/.*/"&"/'  | paste -sd, -)
  esclist=$(echo "$out" | grep '^ESCALATE' | sed 's/^ESCALATE //;s/.*/"&"/' | paste -sd, -)
  JSON="${JSON}{\"box\":\"$name\",\"reachable\":true,\"fixed\":$fx,\"findings\":[${flist}],\"escalate\":[${esclist}]},"
done

printf '{"generatedAt":"%s","fixApplied":%s,"needsAttention":%s,"ecosystemRefHash":"%s","canonicalApiRouteCount":%s,"boxes":[%s]}\n' \
  "$(date -Iseconds)" "$([ $FIX -eq 1 ] && echo true || echo false)" \
  "$([ $NEED -eq 1 ] && echo true || echo false)" "${LOCAL_ECO_HASH:0:12}" "$CANON_API_COUNT" "${JSON%,}" > "$OUT_JSON"
echo ""; echo "------------------------------------------------------------"
if [ $NEED -eq 1 ]; then
  echo "RESULT: config drift or escalation needed. JSON -> $OUT_JSON"
  [ $FIX -eq 0 ] && echo "  Re-run with --fix to auto-apply the safe fixes (linger, timers, nginx allow-list, split-brain proxy)."
  exit 2
else
  echo "RESULT: every box config-consistent. JSON -> $OUT_JSON"; exit 0
fi
