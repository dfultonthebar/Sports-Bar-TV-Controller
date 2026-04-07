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
#   4. Initializes empty DB schema (Drizzle db:push)
#   5. Starts PM2 and configures it to auto-start on boot
#   6. Runs new-location-setup.sh for network/logrotate config
#   7. Marks itself complete (disables the one-shot service)
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
log "Step 1/8: Regenerating SSH host keys and machine-id..."

rm -f /etc/ssh/ssh_host_*
dpkg-reconfigure -f noninteractive openssh-server

rm -f /etc/machine-id /var/lib/dbus/machine-id
systemd-machine-id-setup
if command -v dbus-uuidgen &>/dev/null; then
    dbus-uuidgen --ensure=/var/lib/dbus/machine-id
fi

log "SSH host keys and machine-id regenerated."

# ─── Step 2: Wait for network ─────────────────────────────────────────────────
log "Step 2/8: Waiting for network..."
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
log "Step 3/8: Cloning from GitHub..."

mkdir -p "$UBUNTU_HOME"

if [ -d "$APP_DIR/.git" ]; then
    log "  Existing clone found — pulling latest..."
    sudo -u ubuntu git -C "$APP_DIR" pull --ff-only
else
    sudo -u ubuntu git clone "$GITHUB_REPO" "$APP_DIR"
fi

log "Repository ready at $APP_DIR"

# ─── Step 4: Install deps and build ──────────────────────────────────────────
log "Step 4/8: Installing dependencies and building..."

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

# ─── Step 5: Initialize database ─────────────────────────────────────────────
log "Step 5/8: Initializing database (Drizzle db:push)..."

mkdir -p "$DATA_DIR"
chown ubuntu:ubuntu "$DATA_DIR"

cd "$APP_DIR"
sudo -u ubuntu npm run db:push 2>&1 | tail -10

log "Database schema initialized at $DATA_DIR/production.db"

# ─── Step 6: Start PM2 ───────────────────────────────────────────────────────
log "Step 6/8: Starting PM2..."

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
log "Step 7/8: Running new-location-setup.sh..."

if [ -f "$APP_DIR/scripts/new-location-setup.sh" ]; then
    chmod +x "$APP_DIR/scripts/new-location-setup.sh"
    sudo -u ubuntu bash "$APP_DIR/scripts/new-location-setup.sh" || warn "new-location-setup.sh exited non-zero (non-fatal)"
else
    warn "scripts/new-location-setup.sh not found — skipping."
fi

# ─── Step 8/8: Setup Wizard Instructions ────────────────────────────────
log "Step 8/8: Creating setup wizard instructions..."

cat > /etc/update-motd.d/99-setup-wizard << 'MOTDEOF'
#!/bin/bash
if [ ! -f /var/lib/sports-bar-wizard-done ]; then
    echo ""
    echo "============================================"
    echo "  SPORTS BAR TV CONTROLLER - SETUP REQUIRED"
    echo "============================================"
    echo ""
    echo "  Run the setup wizard to configure your devices:"
    echo ""
    echo "    location-setup-wizard"
    echo ""
    echo "  This will scan your network and configure all"
    echo "  AV equipment (matrix, TVs, cable boxes, etc.)"
    echo ""
    echo "============================================"
    echo ""
fi
MOTDEOF
chmod +x /etc/update-motd.d/99-setup-wizard

# Add wizard alias to ubuntu user's bashrc
if ! grep -q "location-setup-wizard" /home/ubuntu/.bashrc 2>/dev/null; then
    echo "" >> /home/ubuntu/.bashrc
    echo "# Sports Bar TV Controller setup wizard" >> /home/ubuntu/.bashrc
    echo "alias location-setup-wizard='sudo bash /usr/local/bin/location-setup-wizard.sh'" >> /home/ubuntu/.bashrc
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

### Improvement Notes
<!-- Add any issues encountered during first boot -->
- Review /var/log/sports-bar-first-boot.log for full details
- Setup wizard has not been run yet

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
