#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# fleet-security-audit.sh — fleet security/hygiene consistency (companion to
#                           fleet-schema/deps/config audits)
# ---------------------------------------------------------------------------
# Checks each box for security hygiene. The ONLY safe auto-fix is `chmod 600`
# on secret-bearing files (--fix). Everything else is REPORT/ESCALATE — never
# auto-rotate a PIN, never auto-fill/rotate a secret, never rewrite git history.
# NEVER logs or transmits a PIN, hash, or secret VALUE — only booleans/flags.
#
# Checks:
#   A1 env-file perms      — .env + cron env must be 0600 (AUTO-FIX: chmod 600)
#   A3 default/weak PIN     — bcrypt-compare active AuthPins vs a weak denylist (REPORT)
#   A4 AUTH_COOKIE_SECURE   — must be false on http:// LAN (REPORT)
#   A2 leaked secret        — known tokens still in git history (LOCAL repo, REPORT)
#
# Usage:  FLEET_SSH_PW=... bash scripts/fleet-security-audit.sh [--fix]
# Exit: 0 clean, 2 findings, 1 setup error.  JSON -> /tmp/fleet-security-audit.json
# ---------------------------------------------------------------------------
set -uo pipefail
OUT_JSON="/tmp/fleet-security-audit.json"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=12 -o BatchMode=no"
REPO="/home/ubuntu/Sports-Bar-TV-Controller"
DB="/home/ubuntu/sports-bar-data/production.db"
FIX=0; [ "${1:-}" = "--fix" ] && FIX=1
DEFAULT_HOSTS="holmgren=100.117.155.98 leg-lamp=100.101.200.82 luckys=100.77.85.89 graystone=100.93.130.14 greenville=100.112.255.60 appleton=100.107.223.47 lime-kiln=100.89.6.80"
HOSTS="${FLEET_HOSTS:-$DEFAULT_HOSTS}"
[ -z "${FLEET_SSH_PW:-}" ] && { echo "ERROR: set FLEET_SSH_PW." >&2; exit 1; }

# Per-box remote probe (+fix). Emits OK/FIXED/FINDING/REPORT <what>. Never prints a value.
read -r -d '' REMOTE <<REMOTE_EOF
set -uo pipefail
FIX=$FIX
# A1 — secret-file perms (0600). Auto-fix with chmod.
for f in "$REPO/.env" "\$HOME/.config/fleet-schema-cron.env"; do
  [ -f "\$f" ] || continue
  m=\$(stat -c '%a' "\$f" 2>/dev/null)
  if [ "\$m" = "600" ]; then echo "OK perms (\$(basename \$f))"
  elif [ "\$FIX" = "1" ]; then chmod 600 "\$f" && echo "FIXED perms (\$(basename \$f) \$m->600)"
  else echo "FINDING perms (\$(basename \$f) is \$m, want 600)"; fi
done
# A4 — AUTH_COOKIE_SECURE must be false on http LAN
if [ -f "$REPO/.env" ]; then
  acs=\$(grep -E '^AUTH_COOKIE_SECURE=' "$REPO/.env" | head -1 | cut -d= -f2 | tr -d '"'"'"' ')
  nau=\$(grep -E '^NEXTAUTH_URL=' "$REPO/.env" | head -1 | cut -d= -f2)
  if echo "\$nau" | grep -qi '^http://' && [ "\${acs,,}" = "true" ]; then echo "FINDING cookie (AUTH_COOKIE_SECURE=true on http:// — login will silently fail)"
  elif [ -z "\$acs" ]; then echo "REPORT cookie (AUTH_COOKIE_SECURE unset)"
  else echo "OK cookie (\$acs)"; fi
fi
# A3 — weak/default active PINs (bcrypt compare; report ROLE only, never the PIN)
cd "$REPO" 2>/dev/null && node -e '
try {
  const Database=require("better-sqlite3"), bcrypt=require("bcryptjs");
  const db=new Database("$DB",{readonly:true});
  const weak=["7819","1234","0000","1111","2580","123456","9999","1379"];
  let cols; try{ cols=db.prepare("SELECT role,pinHash FROM AuthPin WHERE isActive=1").all(); }
  catch(e){ cols=db.prepare("SELECT role,pinHash FROM AuthPin").all(); }
  for(const r of cols){ for(const w of weak){ try{ if(r.pinHash&&bcrypt.compareSync(w,r.pinHash)){ console.log("FINDING pin (role="+r.role+" is a weak/default PIN)"); break; } }catch(_){} } }
  console.log("OK pin (checked "+cols.length+" active)");
} catch(e){ console.log("REPORT pin (check skipped: "+(e.code||e.message).toString().slice(0,40)+")"); }
' 2>/dev/null || echo "REPORT pin (node/bcrypt unavailable)"
REMOTE_EOF

echo "============================================================"
echo "FLEET SECURITY AUDIT — $(date -Iseconds)  (fix=$FIX)"
echo "============================================================"
NEED=0; JSON=""
for pair in $HOSTS; do
  name="${pair%%=*}"; ip="${pair##*=}"
  echo ""; echo "## $name ($ip)"
  out=$(sshpass -p "$FLEET_SSH_PW" ssh $SSH_OPTS ubuntu@"$ip" "$REMOTE" 2>/dev/null)
  if [ -z "$out" ]; then echo "   [!] unreachable"; JSON="${JSON}{\"box\":\"$name\",\"reachable\":false},"; continue; fi
  echo "$out" | grep -vE '^OK ' | sed 's/^/   /'
  echo "$out" | grep -q '^OK ' && ! echo "$out" | grep -qE '^(FINDING|REPORT)' && echo "   ✅ clean"
  f=$(echo "$out" | grep -c '^FINDING' || true)
  fx=$(echo "$out" | grep -c '^FIXED' || true)
  [ "$f" -gt 0 ] && NEED=1
  flist=$(echo "$out" | grep '^FINDING' | sed 's/^FINDING //;s/.*/"&"/' | paste -sd, -)
  JSON="${JSON}{\"box\":\"$name\",\"reachable\":true,\"fixed\":$fx,\"findings\":[${flist}]},"
done

# A2 — leaked secrets still in git history (LOCAL repo, names not values)
echo ""; echo "## leaked-secret history scan (local repo)"
LEAKED=0
for tok in '6809233DjD'; do
  n=$(cd "$REPO" && git log --all -S "$tok" --oneline 2>/dev/null | wc -l)
  if [ "$n" -gt 0 ]; then echo "   FINDING: token still in $n commits of git history — ROTATE the credential (history rewrite is destructive, operator decision)"; LEAKED=1; NEED=1; fi
done
[ "$LEAKED" -eq 0 ] && echo "   ✅ no known leaked tokens in history"

printf '{"generatedAt":"%s","fixApplied":%s,"needsAttention":%s,"leakedInHistory":%s,"boxes":[%s]}\n' \
  "$(date -Iseconds)" "$([ $FIX -eq 1 ] && echo true||echo false)" "$([ $NEED -eq 1 ] && echo true||echo false)" \
  "$([ $LEAKED -eq 1 ] && echo true||echo false)" "${JSON%,}" > "$OUT_JSON"
echo ""; echo "------------------------------------------------------------"
[ $NEED -eq 1 ] && { echo "RESULT: security findings. JSON -> $OUT_JSON"; [ $FIX -eq 0 ] && echo "  --fix auto-chmods secret files to 600 (the only safe auto-fix)."; exit 2; }
echo "RESULT: clean. JSON -> $OUT_JSON"; exit 0
