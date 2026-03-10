#!/bin/bash
#
# Sports Bar TV Controller - First Boot (Snapshot Install Mode)
#
# Triggered by systemd on first boot when kernel cmdline contains:
#   sports_bar_mode=snapshot
#
# What it does:
#   1. Regenerates SSH host keys + machine-id (unique per install)
#   2. Restores pre-baked app from /opt/sports-bar-snapshot/app/
#   3. Restores pre-baked DB from /opt/sports-bar-snapshot/production.db
#   4. Starts PM2 and configures it to auto-start on boot
#   5. Runs new-location-setup.sh for network/logrotate config
#   6. Marks itself complete (disables the one-shot service)
#

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
SNAPSHOT_DIR="/opt/sports-bar-snapshot"
SNAPSHOT_APP="$SNAPSHOT_DIR/app"
SNAPSHOT_DB="$SNAPSHOT_DIR/production.db"
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
log "Sports Bar TV Controller - Snapshot Install First Boot"
log "============================================================"

# ─── Verify snapshot exists ───────────────────────────────────────────────────
if [ ! -d "$SNAPSHOT_APP" ]; then
    err "Snapshot not found at $SNAPSHOT_APP"
    err "This ISO may not have been built with snapshot mode."
    exit 1
fi

if [ ! -f "$SNAPSHOT_DB" ]; then
    warn "Snapshot DB not found at $SNAPSHOT_DB — will start with empty DB."
fi

# ─── Step 1: Unique system identifiers ───────────────────────────────────────
log "Step 1/5: Regenerating SSH host keys and machine-id..."

rm -f /etc/ssh/ssh_host_*
dpkg-reconfigure -f noninteractive openssh-server

rm -f /etc/machine-id /var/lib/dbus/machine-id
systemd-machine-id-setup
if command -v dbus-uuidgen &>/dev/null; then
    dbus-uuidgen --ensure=/var/lib/dbus/machine-id
fi

log "SSH host keys and machine-id regenerated."

# ─── Step 2: Restore app from snapshot ───────────────────────────────────────
log "Step 2/5: Restoring app from snapshot..."

mkdir -p "$(dirname "$APP_DIR")"

if [ -d "$APP_DIR" ] && [ "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
    warn "  $APP_DIR already exists — moving to ${APP_DIR}.bak"
    mv "$APP_DIR" "${APP_DIR}.bak.$(date +%Y%m%d%H%M%S)"
fi

cp -a "$SNAPSHOT_APP" "$APP_DIR"
chown -R ubuntu:ubuntu "$APP_DIR"

log "  App restored to $APP_DIR"

# ─── Step 3: Restore database ─────────────────────────────────────────────────
log "Step 3/5: Restoring database..."

mkdir -p "$DATA_DIR"
chown ubuntu:ubuntu "$DATA_DIR"

if [ -f "$SNAPSHOT_DB" ]; then
    if [ -f "$DATA_DIR/production.db" ]; then
        warn "  Existing DB found — moving to production.db.bak"
        mv "$DATA_DIR/production.db" "$DATA_DIR/production.db.bak.$(date +%Y%m%d%H%M%S)"
    fi
    cp "$SNAPSHOT_DB" "$DATA_DIR/production.db"
    chown ubuntu:ubuntu "$DATA_DIR/production.db"
    local_size=$(du -h "$DATA_DIR/production.db" | cut -f1)
    log "  Database restored ($local_size)"
else
    warn "  No snapshot DB — app will initialize an empty database on first run."
fi

# ─── Step 4: Start PM2 ───────────────────────────────────────────────────────
log "Step 4/5: Starting PM2..."

export PM2_HOME="$UBUNTU_HOME/.pm2"
export PATH="/usr/local/bin:/usr/bin:$PATH"

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

# ─── Step 5: New-location setup ───────────────────────────────────────────────
log "Step 5/5: Running new-location-setup.sh..."

if [ -f "$APP_DIR/scripts/new-location-setup.sh" ]; then
    chmod +x "$APP_DIR/scripts/new-location-setup.sh"
    sudo -u ubuntu bash "$APP_DIR/scripts/new-location-setup.sh" || warn "new-location-setup.sh exited non-zero (non-fatal)"
else
    warn "scripts/new-location-setup.sh not found — skipping."
fi

# ─── Done ────────────────────────────────────────────────────────────────────
touch "$DONE_MARKER"

log "============================================================"
log "Snapshot install first-boot COMPLETE."
log "  App:  $APP_DIR"
log "  DB:   $DATA_DIR/production.db"
log "  Port: 3001"
log "  Log:  $LOG_FILE"
log "============================================================"

# Disable this one-shot service so it won't run again
systemctl disable sports-bar-first-boot.service 2>/dev/null || true
