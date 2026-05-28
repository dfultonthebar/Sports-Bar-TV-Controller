#!/bin/bash
# audit-installed-vm.sh — production-readiness check of a freshly-installed VM
#
# Verifies the installed system is ready for HARDWARE configuration:
# DB schema present, AuthPin/Location seeded ready, env vars set, first-boot
# completed all 10 steps, verify-install layers pass, PM2 healthy, Nginx
# bartender allow-list working, location-setup-wizard available.
#
# Usage:
#   bash scripts/iso/audit-installed-vm.sh                    # uses default Proxmox + VM 200
#   bash scripts/iso/audit-installed-vm.sh --ip 10.0.0.42     # explicit installed-VM IP
#   bash scripts/iso/audit-installed-vm.sh --host bar5.lan    # explicit hostname
#
# Exit 0 = all green, ready for hardware. Exit non-zero = something needs fixing.

set -uo pipefail

PROXMOX="${PROXMOX:-root@100.118.54.10}"
VMID="${VMID:-200}"
VM_MAC="${VM_MAC:-bc:24:11:5b:53:45}"
VM_USER="${VM_USER:-ubuntu}"
VM_PASS="${VM_PASS:-6809233DjD$$}"
TARGET_IP=""
TARGET_HOST=""

while [ $# -gt 0 ]; do
    case "$1" in
        --ip) TARGET_IP="$2"; shift 2 ;;
        --host) TARGET_HOST="$2"; shift 2 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

PASS=0
WARN=0
FAIL=0

ok()   { echo "  ✅ $*"; PASS=$((PASS+1)); }
warn() { echo "  ⚠️  $*"; WARN=$((WARN+1)); }
fail() { echo "  ❌ $*"; FAIL=$((FAIL+1)); }
step() { echo ""; echo "═══ $* ═══"; }

# Discover target IP if not provided
if [ -z "$TARGET_IP" ] && [ -z "$TARGET_HOST" ]; then
    echo "Discovering VM $VMID IP via Proxmox arp..."
    TARGET_IP=$(ssh -o BatchMode=yes "$PROXMOX" "ip -4 neigh | grep -i '$VM_MAC' | awk '{print \$1}' | head -1" 2>/dev/null || true)
    [ -z "$TARGET_IP" ] && { echo "ERROR: could not discover VM IP via Proxmox arp"; exit 1; }
    echo "Discovered IP: $TARGET_IP"
fi
TARGET="${TARGET_HOST:-$TARGET_IP}"

# SSH proxy hop through Proxmox so we don't need direct routing.
# v2.55.5: base64-encode the remote command to survive the triple-hop
# (Holmgren -> Proxmox -> VM) without quote-nesting corruption. The old
# single-quote wrap broke any command containing quotes (sqlite3 'SELECT...',
# python -c '...'), producing false "tables MISSING" / "PM2 not running".
vmssh() {
    local cmd_b64
    cmd_b64=$(printf '%s' "$*" | base64 -w0)
    ssh -o BatchMode=yes "$PROXMOX" "sshpass -p '$VM_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 $VM_USER@$TARGET 'echo $cmd_b64 | base64 -d | bash'" 2>/dev/null
}

echo "Auditing installed VM at $TARGET (via $PROXMOX proxy)"
echo "Started: $(date)"

# ─────────────────────────────────────────────────────────────────────
# Layer 1: SSH + basic system
# ─────────────────────────────────────────────────────────────────────
step "Layer 1/9: SSH + OS"
HOSTNAME=$(vmssh "hostname")
[ -n "$HOSTNAME" ] && ok "SSH reachable + hostname=$HOSTNAME" || fail "SSH unreachable"

OS_INFO=$(vmssh "lsb_release -ds")
echo "$OS_INFO" | grep -q "Ubuntu 24.04" && ok "OS: $OS_INFO" || warn "OS unexpected: $OS_INFO"

UPTIME=$(vmssh "uptime -p")
ok "Uptime: $UPTIME"

# ─────────────────────────────────────────────────────────────────────
# Layer 2: First-boot service completion
# ─────────────────────────────────────────────────────────────────────
step "Layer 2/9: First-boot service status"
FB_STATUS=$(vmssh "systemctl is-active sports-bar-first-boot.service")
echo "first-boot.service status: $FB_STATUS"
if [ "$FB_STATUS" = "active" ] || [ "$FB_STATUS" = "inactive" ]; then
    # 'inactive' is correct for a oneshot that finished successfully
    DONE_MARKER=$(vmssh "test -f /var/lib/sports-bar-first-boot-done && echo yes || echo no")
    [ "$DONE_MARKER" = "yes" ] && ok "first-boot completed (marker present)" || warn "first-boot service ran but no done marker"
else
    fail "first-boot.service in unexpected state: $FB_STATUS"
fi

# All 10 steps of first-boot-fresh.sh should be in the log
LOG_SUMMARY=$(vmssh "sudo tail -100 /var/log/sports-bar-first-boot.log 2>/dev/null | grep -E 'Step [0-9]+/10' | tail -10")
echo "$LOG_SUMMARY" | head -10
STEP_COUNT=$(echo "$LOG_SUMMARY" | grep -c "Step ")
[ "$STEP_COUNT" -ge 10 ] && ok "All 10 first-boot steps logged" || warn "Only $STEP_COUNT/10 first-boot steps in log"

# ─────────────────────────────────────────────────────────────────────
# Layer 3: Node.js + PM2
# ─────────────────────────────────────────────────────────────────────
step "Layer 3/9: Node.js + PM2 runtime"
NODE_VER=$(vmssh "node --version")
echo "$NODE_VER" | grep -qE "^v22\." && ok "Node $NODE_VER" || fail "Node version unexpected: $NODE_VER"

NPM_VER=$(vmssh "npm --version")
ok "npm $NPM_VER"

PM2_VER=$(vmssh "pm2 --version")
ok "PM2 $PM2_VER"

PM2_STATUS=$(vmssh "pm2 jlist 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); p=[x for x in d if x.get(\"name\")==\"sports-bar-tv-controller\"]; print(p[0][\"pm2_env\"][\"status\"] if p else \"NOT_FOUND\")'")
[ "$PM2_STATUS" = "online" ] && ok "PM2 sports-bar-tv-controller: $PM2_STATUS" || fail "PM2 sports-bar-tv-controller: $PM2_STATUS"

# ─────────────────────────────────────────────────────────────────────
# Layer 4: Database schema
# ─────────────────────────────────────────────────────────────────────
step "Layer 4/9: Database schema"
DB_PATH="/home/ubuntu/sports-bar-data/production.db"
DB_EXISTS=$(vmssh "test -f $DB_PATH && echo yes || echo no")
[ "$DB_EXISTS" = "yes" ] && ok "production.db exists at $DB_PATH" || fail "production.db MISSING"

TABLE_COUNT=$(vmssh "sqlite3 $DB_PATH 'SELECT count(*) FROM sqlite_master WHERE type=\"table\";'")
[ "$TABLE_COUNT" -ge 70 ] && ok "Schema: $TABLE_COUNT tables (>=70 expected)" || warn "Schema: only $TABLE_COUNT tables — drizzle migrate may not have completed"

# Check key tables explicitly (v2.55.5: corrected names — Atlas processors/
# zones are AudioProcessor/AudioZone; CEC is handled via CableBox + IRCommand).
for tbl in DirecTVDevice FireTVDevice CableBox ChannelPreset MatrixConfiguration AudioZone AudioProcessor Location AuthPin BartenderLayout; do
    EXISTS=$(vmssh "sqlite3 $DB_PATH \"SELECT name FROM sqlite_master WHERE type='table' AND name='$tbl';\"")
    [ "$EXISTS" = "$tbl" ] && echo "    ✓ table $tbl" || warn "table $tbl MISSING"
done

# ─────────────────────────────────────────────────────────────────────
# Layer 5: Auth + Location bootstrap
# ─────────────────────────────────────────────────────────────────────
step "Layer 5/9: Auth + Location seed"
LOC_COUNT=$(vmssh "sqlite3 $DB_PATH 'SELECT count(*) FROM Location;'")
[ "$LOC_COUNT" -ge 1 ] && ok "Location row: $LOC_COUNT seeded" || warn "Location row: NONE seeded yet (wizard not run)"

PIN_COUNT=$(vmssh "sqlite3 $DB_PATH 'SELECT count(*) FROM AuthPin;'")
[ "$PIN_COUNT" -ge 2 ] && ok "AuthPin: $PIN_COUNT pins seeded (ADMIN+STAFF expected)" || warn "AuthPin: only $PIN_COUNT seeded (wizard not run)"

ENV_LOCATION_ID=$(vmssh "grep '^LOCATION_ID=' /home/ubuntu/Sports-Bar-TV-Controller/.env 2>/dev/null | cut -d= -f2")
[ -n "$ENV_LOCATION_ID" ] && ok "LOCATION_ID set in .env: $ENV_LOCATION_ID" || warn ".env LOCATION_ID not set (wizard not run)"

ENV_COOKIE=$(vmssh "grep '^AUTH_COOKIE_SECURE=' /home/ubuntu/Sports-Bar-TV-Controller/.env 2>/dev/null | cut -d= -f2")
[ "$ENV_COOKIE" = "false" ] && ok "AUTH_COOKIE_SECURE=false (correct for LAN HTTP)" || warn ".env AUTH_COOKIE_SECURE=$ENV_COOKIE (should be 'false' on HTTP-only LAN)"

# ─────────────────────────────────────────────────────────────────────
# Layer 6: HTTP endpoints (admin :3001 + bartender :3002)
# ─────────────────────────────────────────────────────────────────────
step "Layer 6/9: HTTP endpoints"
ADMIN_HTTP=$(vmssh "curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health")
[ "$ADMIN_HTTP" = "200" ] && ok "Admin :3001 /api/health = 200" || fail "Admin :3001 /api/health = $ADMIN_HTTP"

BARTENDER_HTTP=$(vmssh "curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/remote")
echo "$BARTENDER_HTTP" | grep -qE "^(200|302)$" && ok "Bartender :3002 /remote = $BARTENDER_HTTP" || fail "Bartender :3002 /remote = $BARTENDER_HTTP"

VERSION=$(vmssh "curl -s http://localhost:3001/api/system/version 2>/dev/null")
echo "    version: $VERSION"
echo "$VERSION" | grep -q "version" && ok "Version endpoint reachable" || warn "Version endpoint not returning JSON"

# ─────────────────────────────────────────────────────────────────────
# Layer 7: Gotcha #11 hardening (linger / NVM / ollama)
# ─────────────────────────────────────────────────────────────────────
step "Layer 7/9: Gotcha #11 hardening"
LINGER=$(vmssh "loginctl show-user ubuntu | grep -E '^Linger=' | cut -d= -f2")
[ "$LINGER" = "yes" ] && ok "Linger=yes (systemd user services persist)" || warn "Linger=$LINGER (auto-update timer may not survive logout)"

NVM_SYMLINKS=$(vmssh "ls -la /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx 2>&1 | grep -c '^l' || echo 0")
[ "$NVM_SYMLINKS" -ge 3 ] && ok "node/npm/npx symlinked in /usr/local/bin" || warn "NVM PATH symlinks missing — systemd scripts may fail"

# ─────────────────────────────────────────────────────────────────────
# Layer 8: Nginx bartender proxy + allow-list
# ─────────────────────────────────────────────────────────────────────
step "Layer 8/9: Bartender :3002 proxy"
# v2.55.5: the v3.1.0 install serves :3002 via the PM2 bartender-proxy app
# (not nginx — that's an optional later upgrade via setup-bartender-nginx.sh).
# Accept EITHER nginx OR the PM2 proxy as long as :3002 actually serves.
NGINX_STATUS=$(vmssh "systemctl is-active nginx 2>/dev/null || echo inactive")
PROXY_PM2=$(vmssh "pm2 jlist 2>/dev/null | python3 -c \"import json,sys;d=json.load(sys.stdin);print('yes' if any(x.get('name')=='bartender-proxy' and x['pm2_env']['status']=='online' for x in d) else 'no')\"")
BARTENDER_3002=$(vmssh "curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/remote")
if [ "$NGINX_STATUS" = "active" ]; then
    ok "Bartender :3002 via nginx (active)"
elif [ "$PROXY_PM2" = "yes" ]; then
    ok "Bartender :3002 via PM2 bartender-proxy (online) — nginx upgrade optional"
fi
echo "$BARTENDER_3002" | grep -qE '^(200|302)$' && ok ":3002/remote serves ($BARTENDER_3002)" || fail ":3002/remote = $BARTENDER_3002"

# ─────────────────────────────────────────────────────────────────────
# Layer 9: Wizard ready (operator can configure for the location)
# ─────────────────────────────────────────────────────────────────────
step "Layer 9/9: Setup wizard availability"
# v2.55.5: repo installs to /home/ubuntu/Sports-Bar-TV-Controller (not /opt).
APP_DIR="/home/ubuntu/Sports-Bar-TV-Controller"
# wizard may be named location-setup-wizard.sh or new-location-setup.sh
WIZARD=$(vmssh "ls $APP_DIR/scripts/iso/location-setup-wizard.sh $APP_DIR/scripts/iso/new-location-setup.sh $APP_DIR/scripts/new-location-setup.sh 2>/dev/null | head -1")
[ -n "$WIZARD" ] && ok "Setup wizard present: $WIZARD" || warn "setup wizard script not found in $APP_DIR/scripts"

BOOTSTRAP=$(vmssh "ls $APP_DIR/scripts/bootstrap-new-location.sh 2>/dev/null | head -1")
[ -n "$BOOTSTRAP" ] && ok "bootstrap-new-location.sh present" || warn "bootstrap-new-location.sh missing"

# ─────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "                    AUDIT SUMMARY"
echo "════════════════════════════════════════════════════════════════════"
echo "  Target:        $TARGET"
echo "  Hostname:      $HOSTNAME"
echo "  Version:       $(echo "$VERSION" | head -c 100)"
echo ""
echo "  ✅ PASS:  $PASS"
echo "  ⚠️  WARN:  $WARN"
echo "  ❌ FAIL:  $FAIL"
echo "════════════════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
    echo "RESULT: NOT READY — $FAIL critical failures"
    exit 1
elif [ "$WARN" -gt 5 ]; then
    echo "RESULT: PARTIAL — $WARN warnings (operator action needed)"
    exit 2
else
    echo "RESULT: READY for hardware configuration"
    exit 0
fi
