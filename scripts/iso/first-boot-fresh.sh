#!/bin/bash
#
# Sports Bar TV Controller - First Boot (Fresh Install Mode)
#
# Triggered by systemd on first boot when kernel cmdline contains:
#   sports_bar_mode=fresh
#
# What it does:
#   1. Regenerates SSH host keys + machine-id (unique per install)
#   2. Clones the app from GitHub
#   3. Installs npm dependencies and builds
#   4. Initializes empty DB schema (Drizzle migrate)
#   5. Starts PM2 and configures it to auto-start on boot
#   6. Runs new-location-setup.sh for network/logrotate config
#   7. Applies CLAUDE.md Gotcha #11 hardening (linger / NVM symlinks / ollama perms)
#   8. Runs verify-install.sh and captures summary for the GitHub report
#   9. Writes a tty1 MOTD pointing the operator to location-setup-wizard.sh
#  10. Marks itself complete (disables the one-shot service)
#

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
GITHUB_REPO="https://github.com/dfultonthebar/Sports-Bar-TV-Controller"
APP_DIR="/home/ubuntu/Sports-Bar-TV-Controller"
DATA_DIR="/home/ubuntu/sports-bar-data"
LOG_FILE="/var/log/sports-bar-first-boot.log"
DONE_MARKER="/var/lib/sports-bar-first-boot-done"
UBUNTU_HOME="/home/ubuntu"

# ─── Logging ──────────────────────────────────────────────────────────────────
exec > >(tee -a "$LOG_FILE") 2>&1

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
warn() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*"; }
err()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" >&2; }

# ─── Guard: only run once ─────────────────────────────────────────────────────
if [ -f "$DONE_MARKER" ]; then
    log "First-boot already completed. Exiting."
    exit 0
fi

log "============================================================"
log "Sports Bar TV Controller - Fresh Install First Boot"
log "============================================================"

# ─── Step 1: Unique system identifiers ───────────────────────────────────────
log "Step 1/10: Regenerating SSH host keys and machine-id..."

rm -f /etc/ssh/ssh_host_*
dpkg-reconfigure -f noninteractive openssh-server

rm -f /etc/machine-id /var/lib/dbus/machine-id
systemd-machine-id-setup
if command -v dbus-uuidgen &>/dev/null; then
    dbus-uuidgen --ensure=/var/lib/dbus/machine-id
fi

log "SSH host keys and machine-id regenerated."

# ─── Step 1b: Build Realtek WiFi DKMS drivers ───────────────────────────────
log "Building Realtek WiFi drivers (DKMS)..."
if dpkg -l rtl8821ce-dkms &>/dev/null 2>&1; then
    dkms autoinstall 2>&1 | tail -5 || warn "DKMS autoinstall had issues (non-fatal)"
    log "Realtek WiFi DKMS modules built."
fi
# Install rtl8812au if not present (failed in chroot, works on live kernel)
if ! dpkg -l rtl8812au-dkms &>/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y rtl8812au-dkms 2>&1 | tail -5 || warn "rtl8812au install failed (non-fatal)"
fi

# ─── Step 2: Wait for network ─────────────────────────────────────────────────
log "Step 2/10: Waiting for network..."
MAX_WAIT=120
ELAPSED=0
until curl -fsS --max-time 5 https://github.com &>/dev/null; do
    if [ $ELAPSED -ge $MAX_WAIT ]; then
        err "Network not available after ${MAX_WAIT}s. Cannot clone from GitHub."
        exit 1
    fi
    log "  Waiting for network... (${ELAPSED}s)"
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done
log "Network is up."

# ─── Step 3: Clone from GitHub ───────────────────────────────────────────────
log "Step 3/10: Cloning from GitHub..."

mkdir -p "$UBUNTU_HOME"

if [ -d "$APP_DIR/.git" ]; then
    log "  Existing clone found — pulling latest..."
    sudo -u ubuntu git -C "$APP_DIR" pull --ff-only
else
    sudo -u ubuntu git clone "$GITHUB_REPO" "$APP_DIR"
fi

log "Repository ready at $APP_DIR"

# ─── Step 4: Install deps and build ──────────────────────────────────────────
log "Step 4/10: Installing dependencies and building..."

# Load NVM / Node from ubuntu user's environment
export NVM_DIR="$UBUNTU_HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    source "$NVM_DIR/nvm.sh"
fi

# Ensure node/npm are in PATH (NodeSource install puts them in /usr/bin)
export PATH="/usr/local/bin:/usr/bin:$PATH"

if ! command -v node &>/dev/null; then
    err "Node.js not found. The ISO should have pre-installed Node 22."
    exit 1
fi

log "  Node: $(node --version), npm: $(npm --version)"

cd "$APP_DIR"
sudo -u ubuntu npm install --prefer-offline 2>&1 | tail -5
sudo -u ubuntu npm run build 2>&1 | tail -20

log "Build complete."

# Install/update Claude Code CLI (native install)
log "Installing Claude Code CLI..."
sudo -u ubuntu bash -c "curl -fsSL https://claude.ai/install.sh | sh" 2>&1 | tail -5 || warn "Claude Code CLI install failed (non-fatal)"

# Install GitHub CLI if not already present
if ! command -v gh &>/dev/null; then
    log "Installing GitHub CLI..."
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list
    apt-get update -qq && apt-get install -y gh 2>&1 | tail -3 || warn "GitHub CLI install failed (non-fatal)"
fi

# ─── Step 5: Initialize database ─────────────────────────────────────────────
# v2.54.51+ — Use the canonical migrate flow (matches scripts/auto-update.sh).
# Replaces drizzle-kit push which silently aborts on pre-existing indexes
# (CLAUDE.md Gotcha #6). This script runs unattended on first boot of an
# ISO-installed system, so failures MUST exit non-zero so the systemd
# oneshot service catches them (set -euo pipefail above takes care of this).
log "Step 5/10: Initializing database (Drizzle migrate)..."

mkdir -p "$DATA_DIR"
chown ubuntu:ubuntu "$DATA_DIR"

DB_PATH="$DATA_DIR/production.db"

cd "$APP_DIR"

# Step 5a: bootstrap migration markers if DB already exists (re-runs of
# first-boot or upgrade-from-older-ISO scenarios). On a true virgin install
# the DB doesn't exist yet and bootstrap is skipped — migrate creates it.
if [ -f "$DB_PATH" ]; then
    log "  Bootstrapping drizzle migration markers..."
    sudo -u ubuntu bash "$APP_DIR/scripts/bootstrap-drizzle-migrations.sh" "$DB_PATH" 2>&1 | tail -10
fi

# Step 5b: apply pending migrations (creates DB on virgin install). Fails
# loud — non-zero exit propagates via set -e to the systemd service.
log "  Applying pending Drizzle migrations..."
sudo -u ubuntu bash -c "cd '$APP_DIR' && NODE_ENV=development npx drizzle-kit migrate" 2>&1 | tail -20

# Step 5c: belt-and-suspenders — ensure-schema.sh adds any tables/columns
# that migration files might have missed. No-op when migrations are complete.
if [ -f "$APP_DIR/scripts/ensure-schema.sh" ] && [ -f "$DB_PATH" ]; then
    log "  Running ensure-schema.sh (belt-and-suspenders)..."
    sudo -u ubuntu bash "$APP_DIR/scripts/ensure-schema.sh" "$DB_PATH" 2>&1 | tail -10 || \
        warn "ensure-schema.sh reported issues (non-fatal — migrate is the source of truth)"
fi

log "Database schema initialized at $DB_PATH"

# ─── Step 6: Start PM2 ───────────────────────────────────────────────────────
log "Step 6/10: Starting PM2..."

export PM2_HOME="$UBUNTU_HOME/.pm2"

if ! command -v pm2 &>/dev/null; then
    log "  PM2 not found globally — installing..."
    npm install -g pm2
fi

cd "$APP_DIR"
sudo -u ubuntu bash -c "
    export PATH='/usr/local/bin:/usr/bin:\$PATH'
    export PM2_HOME='$PM2_HOME'
    pm2 start ecosystem.config.js
    pm2 save
"

# Register PM2 startup on boot
env PATH="$PATH" pm2 startup systemd -u ubuntu --hp "$UBUNTU_HOME" | tail -2
sudo -u ubuntu pm2 save

log "PM2 started and configured for auto-start."

# ─── Step 7: New-location setup ───────────────────────────────────────────────
log "Step 7/10: Running new-location-setup.sh..."

if [ -f "$APP_DIR/scripts/new-location-setup.sh" ]; then
    chmod +x "$APP_DIR/scripts/new-location-setup.sh"
    sudo -u ubuntu bash "$APP_DIR/scripts/new-location-setup.sh" || warn "new-location-setup.sh exited non-zero (non-fatal)"
else
    warn "scripts/new-location-setup.sh not found — skipping."
fi

# ─── Step 8: Gotcha #11 hardening ────────────────────────────────────────────
# Applies CLAUDE.md Gotcha #11 fixes (linger=yes for ubuntu, /usr/local/bin
# NVM symlinks for systemd PATH, ollama group membership + perms). Idempotent.
# No sudo prefix here — first-boot-fresh.sh already runs as root under the
# sports-bar-first-boot.service systemd oneshot. The hardening script handles
# user-context drops internally (e.g. for `loginctl enable-linger ubuntu`).
# Non-fatal: a failure logs a loud warning but does NOT abort first-boot;
# the operator can re-run it manually if needed.
log "Step 8/10: Applying Gotcha #11 hardening (linger / NVM symlinks / ollama perms)..."

HARDEN_EXIT=0
if [ -f "$APP_DIR/scripts/enforce-gotcha11-hardening.sh" ]; then
    bash "$APP_DIR/scripts/enforce-gotcha11-hardening.sh" 2>&1 | tail -30 || HARDEN_EXIT=$?
    if [ "$HARDEN_EXIT" -eq 0 ]; then
        log "Gotcha #11 hardening applied successfully."
    else
        warn "⚠  Gotcha #11 hardening exited $HARDEN_EXIT — re-run manually:"
        warn "       sudo bash $APP_DIR/scripts/enforce-gotcha11-hardening.sh"
    fi
else
    warn "scripts/enforce-gotcha11-hardening.sh not found — skipping (re-run after next git pull)."
    HARDEN_EXIT=127
fi

# ─── Step 9: Verify install ──────────────────────────────────────────────────
# Captures pass/fail summary into VERIFY_SUMMARY for the GitHub report below.
# Non-fatal: a verify failure is information for the operator, not a reason
# to abort first-boot (PM2 is already up; the wizard step still runs).
log "Step 9/10: Running verify-install.sh --quiet..."

VERIFY_EXIT=0
VERIFY_SUMMARY="(verify-install.sh not present)"
if [ -f "$APP_DIR/scripts/verify-install.sh" ]; then
    # Capture last few lines for the report; show full output in the log.
    VERIFY_OUTPUT=$(sudo -u ubuntu bash "$APP_DIR/scripts/verify-install.sh" --quiet 2>&1) || VERIFY_EXIT=$?
    echo "$VERIFY_OUTPUT" | tail -20
    VERIFY_SUMMARY=$(echo "$VERIFY_OUTPUT" | tail -10)
    if [ "$VERIFY_EXIT" -eq 0 ]; then
        log "verify-install.sh PASSED."
    else
        warn "verify-install.sh exited $VERIFY_EXIT — review summary above and run manually:"
        warn "       bash $APP_DIR/scripts/verify-install.sh"
    fi
else
    warn "scripts/verify-install.sh not found — skipping."
    VERIFY_EXIT=127
fi

# ─── Step 10/10: Setup wizard MOTD ──────────────────────────────────────────
# Writes a tty1 MOTD that tells the operator EXACTLY what to do next:
# log in and run scripts/iso/location-setup-wizard.sh. The wizard collects
# the bar name + admin/staff PINs and runs bootstrap-new-location.sh —
# without that, /api/auth/login returns "Invalid PIN" on every attempt
# (CLAUDE.md "Auth bootstrap" section). Cannot prompt for those values at
# boot time, so the MOTD is the operator's surface for that handoff.
log "Step 10/10: Writing setup-wizard MOTD..."

cat > /etc/update-motd.d/99-setup-wizard << 'MOTDEOF'
#!/bin/bash
if [ ! -f /var/lib/sports-bar-wizard-done ]; then
    echo ""
    echo "================================================================"
    echo "  SPORTS BAR TV CONTROLLER — ACTION REQUIRED"
    echo "================================================================"
    echo ""
    echo "  Log in and run the location setup wizard:"
    echo ""
    echo "    bash /opt/sports-bar/scripts/iso/location-setup-wizard.sh"
    echo ""
    echo "  The wizard collects the bar name + admin/staff PINs and runs"
    echo "  bootstrap-new-location.sh for you."
    echo ""
    echo "  Until then, every login at http://<this-IP>:3001 returns"
    echo "  'Invalid PIN' — that is expected."
    echo ""
    echo "  After the wizard:"
    echo "    Admin UI:     http://<this-IP>:3001"
    echo "    Bartender UI: http://<this-IP>:3002"
    echo ""
    echo "================================================================"
    echo ""
fi
MOTDEOF
chmod +x /etc/update-motd.d/99-setup-wizard

# Add wizard alias to ubuntu user's bashrc
if ! grep -q "location-setup-wizard" /home/ubuntu/.bashrc 2>/dev/null; then
    echo "" >> /home/ubuntu/.bashrc
    echo "# Sports Bar TV Controller setup wizard" >> /home/ubuntu/.bashrc
    echo "alias location-setup-wizard='sudo bash /opt/sports-bar/scripts/iso/location-setup-wizard.sh'" >> /home/ubuntu/.bashrc
fi

# ─── Done ────────────────────────────────────────────────────────────────────
touch "$DONE_MARKER"

log "============================================================"
log "Fresh install first-boot COMPLETE."
log "  App:  $APP_DIR"
log "  DB:   $DATA_DIR/production.db"
log "  Port: 3001"
log "  Log:  $LOG_FILE"
log "============================================================"

# ─── Report first-boot results to GitHub ────────────────────────────────
log "Reporting first-boot status..."
REPORT_FILE="/tmp/first-boot-report.md"
cat > "$REPORT_FILE" << REPORTEOF
## First Boot Report - $(hostname) - $(date '+%Y-%m-%d %H:%M')

### System Info
- **Hostname:** $(hostname)
- **IP:** $(ip -o -4 addr show | grep -v '127.0.0.1' | awk '{print $4}' | head -1)
- **OS:** $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
- **Node:** $(node --version 2>/dev/null || echo "not found")
- **npm:** $(npm --version 2>/dev/null || echo "not found")

### First Boot Status
- App cloned: $([ -d "$APP_DIR/.git" ] && echo "YES" || echo "NO")
- Build completed: $([ -d "$APP_DIR/apps/web/.next" ] && echo "YES" || echo "NO")
- Database initialized: $([ -f "$DATA_DIR/production.db" ] && echo "YES" || echo "NO")
- PM2 running: $(pm2 list 2>/dev/null | grep -c "online" || echo "0") process(es)
- Ollama installed: $(command -v ollama &>/dev/null && echo "YES" || echo "NO")
- Gotcha #11 hardening: $([ "$HARDEN_EXIT" -eq 0 ] && echo "PASS" || echo "FAIL (exit=$HARDEN_EXIT)")
- verify-install.sh: $([ "$VERIFY_EXIT" -eq 0 ] && echo "PASS" || echo "FAIL (exit=$VERIFY_EXIT)")

### Verify Summary
\`\`\`
${VERIFY_SUMMARY}
\`\`\`

### Improvement Notes
<!-- Add any issues encountered during first boot -->
- Review /var/log/sports-bar-first-boot.log for full details
- Setup wizard has not been run yet — operator must run location-setup-wizard.sh on tty1

### Log Tail (last 30 lines)
\`\`\`
$(tail -30 "$LOG_FILE" 2>/dev/null || echo "No log available")
\`\`\`
REPORTEOF

# Try to create GitHub issue if gh is available and authenticated
if command -v gh &>/dev/null; then
    cd "$APP_DIR"
    gh issue create \
        --title "First Boot Report: $(hostname) - $(date '+%Y-%m-%d')" \
        --body-file "$REPORT_FILE" \
        --label "first-boot-report" 2>/dev/null \
        || warn "Could not create GitHub issue (auth may not be configured)"
else
    warn "gh CLI not available — first-boot report saved to $REPORT_FILE"
fi

# Disable this one-shot service so it won't run again
systemctl disable sports-bar-first-boot.service 2>/dev/null || true
