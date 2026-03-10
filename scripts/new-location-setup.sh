#!/bin/bash
# New Location Setup Script for Sports Bar TV Controller
# Run this AFTER install.sh completes on a new system
#
# Handles everything we learned from manual installs:
#   1. LVM storage check/expansion
#   2. PM2 logrotate installation
#   3. NEXTAUTH_URL auto-detection from local IP
#   4. Database backup script + crontab
#   5. Memory monitor crontab
#   6. Data migration from source system (IR codes, presets)
#   7. PM2 restart with updated env
#   8. Full system verification
#
# Usage:
#   ./scripts/new-location-setup.sh
#   ./scripts/new-location-setup.sh --migrate-from 100.93.130.14

set -e

# Configuration
APP_DIR="${APP_DIR:-$HOME/Sports-Bar-TV-Controller}"
DATA_DIR="${DATA_DIR:-$HOME/sports-bar-data}"
DB_FILE="$DATA_DIR/production.db"
ENV_FILE="$APP_DIR/.env"
LOG_FILE="/tmp/new-location-setup-$(date +%Y%m%d-%H%M%S).log"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[+]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[x]${NC} $1"; }
print_info() { echo -e "${CYAN}[i]${NC} $1"; }

# Parse arguments
SOURCE_SYSTEM=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --migrate-from)
            SOURCE_SYSTEM="$2"
            shift 2
            ;;
        --help|-h)
            echo "New Location Setup - Sports Bar TV Controller"
            echo ""
            echo "Usage: $0 [--migrate-from <source-ip>]"
            echo ""
            echo "Options:"
            echo "  --migrate-from <ip>  Tailscale IP of source system to migrate data from"
            echo "                       (IR codes, channel presets, device configs)"
            echo ""
            echo "Examples:"
            echo "  $0                              # Setup only (no data migration)"
            echo "  $0 --migrate-from 100.93.130.14 # Setup + migrate from Graystone"
            echo ""
            echo "What this script does:"
            echo "  1. Checks LVM storage and offers to expand if under-allocated"
            echo "  2. Installs PM2 logrotate (10MB max, 7-day retention)"
            echo "  3. Auto-detects local IP and updates NEXTAUTH_URL in .env"
            echo "  4. Creates hourly database backup script"
            echo "  5. Sets up crontab (backup + memory monitor)"
            echo "  6. Migrates IR codes, presets, and device configs from source"
            echo "  7. Restarts PM2 with updated environment"
            echo "  8. Runs full system verification"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage"
            exit 1
            ;;
    esac
done

echo "=========================================="
echo "Sports Bar TV Controller"
echo "New Location Setup"
echo "=========================================="
echo ""

# =========================================================================
# 1. LVM Storage Check
# =========================================================================

check_storage() {
    print_status "Step 1/8: Checking storage allocation..."

    if command -v lvs &>/dev/null && sudo lvs 2>/dev/null | grep -q "ubuntu"; then
        local lv_size_gb=$(sudo lvs --noheadings -o lv_size --units g 2>/dev/null | head -1 | tr -d ' <g' | cut -d. -f1)
        local vg_free_gb=$(sudo vgs --noheadings -o vg_free --units g 2>/dev/null | head -1 | tr -d ' <g' | cut -d. -f1)

        if [ -n "$vg_free_gb" ] && [ "$vg_free_gb" -gt 50 ]; then
            print_warning "LVM has ${vg_free_gb}GB unallocated! (current: ${lv_size_gb}GB)"
            print_info "Ubuntu Server installs often only allocate 100GB of the disk."
            echo ""
            read -p "  Expand to use full disk? (y/N) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                sudo lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv >> "$LOG_FILE" 2>&1
                sudo resize2fs /dev/ubuntu-vg/ubuntu-lv >> "$LOG_FILE" 2>&1
                local new_size=$(df -h / | tail -1 | awk '{print $2}')
                print_status "Storage expanded to $new_size"
            else
                print_info "Skipped. Run later:"
                echo "    sudo lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv && sudo resize2fs /dev/ubuntu-vg/ubuntu-lv"
            fi
        else
            local avail=$(df -h / | tail -1 | awk '{print $4}')
            print_status "Storage OK: ${lv_size_gb}GB allocated, ${avail} available"
        fi
    else
        local avail=$(df -h / | tail -1 | awk '{print $4}')
        print_status "Storage OK: ${avail} available (not LVM)"
    fi
    echo ""
}

# =========================================================================
# 2. PM2 Logrotate
# =========================================================================

setup_pm2_logrotate() {
    print_status "Step 2/8: Setting up PM2 logrotate..."

    if pm2 list 2>/dev/null | grep -q "pm2-logrotate"; then
        print_status "PM2 logrotate already installed"
    else
        pm2 install pm2-logrotate >> "$LOG_FILE" 2>&1
        pm2 set pm2-logrotate:max_size 10M >> "$LOG_FILE" 2>&1
        pm2 set pm2-logrotate:retain 7 >> "$LOG_FILE" 2>&1
        pm2 set pm2-logrotate:compress true >> "$LOG_FILE" 2>&1
        print_status "PM2 logrotate installed (10MB max, 7-day retention, compressed)"
    fi
    echo ""
}

# =========================================================================
# 3. NEXTAUTH_URL Auto-Detection
# =========================================================================

configure_nextauth_url() {
    print_status "Step 3/8: Configuring NEXTAUTH_URL..."

    if [ ! -f "$ENV_FILE" ]; then
        print_warning ".env file not found at $ENV_FILE - skipping"
        echo ""
        return
    fi

    # Detect local IP: prefer ethernet > wifi > any non-loopback non-tailscale
    local LOCAL_IP=""

    # Try ethernet
    LOCAL_IP=$(ip -4 addr show | grep -E 'inet.*(eth|enp)' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -1)

    # Fall back to wifi
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP=$(ip -4 addr show | grep -E 'inet.*wl' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -1)
    fi

    # Fall back to any non-loopback, non-tailscale
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP=$(ip -4 addr show | grep 'inet ' | grep -v '127.0.0.1' | grep -v '100\.' | awk '{print $2}' | cut -d/ -f1 | head -1)
    fi

    if [ -z "$LOCAL_IP" ]; then
        print_warning "Could not detect local IP address"
        print_info "Set NEXTAUTH_URL manually in $ENV_FILE"
        echo ""
        return
    fi

    local NEW_URL="http://${LOCAL_IP}:3001"
    local CURRENT_URL=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '"')

    if [ "$CURRENT_URL" = "$NEW_URL" ]; then
        print_status "NEXTAUTH_URL already correct: $NEW_URL"
    elif [ -n "$CURRENT_URL" ]; then
        sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=\"${NEW_URL}\"|" "$ENV_FILE"
        print_status "Updated NEXTAUTH_URL: $CURRENT_URL -> $NEW_URL"
    else
        echo "NEXTAUTH_URL=\"${NEW_URL}\"" >> "$ENV_FILE"
        print_status "Added NEXTAUTH_URL=$NEW_URL to .env"
    fi
    echo ""
}

# =========================================================================
# 4. Database Backup Script
# =========================================================================

setup_backup() {
    print_status "Step 4/8: Setting up database backup..."

    mkdir -p "$DATA_DIR/backups"

    if [ -f "$DATA_DIR/backup.sh" ]; then
        print_status "Backup script already exists"
        echo ""
        return
    fi

    cat << 'BACKUP_EOF' > "$DATA_DIR/backup.sh"
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/home/ubuntu/sports-bar-data/backup.log"
DB_FILE="/home/ubuntu/sports-bar-data/production.db"
BACKUP_DIR="/home/ubuntu/sports-bar-data/backups"

mkdir -p "$BACKUP_DIR"
touch "$LOG_FILE"

echo "[$(date)] Starting backup..." | tee -a "$LOG_FILE"

if [ -f "$DB_FILE" ]; then
    BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.db"
    PRE_SIZE=$(du -h "$DB_FILE" | cut -f1)

    cp "$DB_FILE" "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        echo "[$(date)] Backup OK: backup_$TIMESTAMP.db ($PRE_SIZE)" | tee -a "$LOG_FILE"

        # Keep only last 30 backups
        OLD_BACKUPS=$(ls -t "$BACKUP_DIR"/backup_*.db 2>/dev/null | tail -n +31)
        if [ -n "$OLD_BACKUPS" ]; then
            echo "$OLD_BACKUPS" | xargs rm -f
            REMOVED=$(echo "$OLD_BACKUPS" | wc -l)
            echo "[$(date)] Removed $REMOVED old backup(s)" | tee -a "$LOG_FILE"
        fi
    else
        echo "[$(date)] ERROR: Backup failed!" | tee -a "$LOG_FILE"
        exit 1
    fi
else
    echo "[$(date)] ERROR: Database not found at $DB_FILE" | tee -a "$LOG_FILE"
    exit 1
fi
BACKUP_EOF

    chmod +x "$DATA_DIR/backup.sh"
    print_status "Backup script created: $DATA_DIR/backup.sh"
    echo ""
}

# =========================================================================
# 5. Crontab Setup
# =========================================================================

setup_crontab() {
    print_status "Step 5/8: Setting up crontab..."

    local CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")
    local NEW_ENTRIES=""
    local ADDED=0

    # Hourly database backup
    if ! echo "$CURRENT_CRON" | grep -q "sports-bar-data/backup.sh"; then
        NEW_ENTRIES="${NEW_ENTRIES}
# Hourly database backup (keep last 30)
0 * * * * $DATA_DIR/backup.sh >> $DATA_DIR/backup.log 2>&1"
        ADDED=$((ADDED + 1))
    fi

    # Memory monitor every 5 minutes
    if ! echo "$CURRENT_CRON" | grep -q "monitor-memory.sh"; then
        if [ -f "$APP_DIR/scripts/monitor-memory.sh" ]; then
            chmod +x "$APP_DIR/scripts/monitor-memory.sh"
            NEW_ENTRIES="${NEW_ENTRIES}

# Memory monitor every 5 minutes
*/5 * * * * $APP_DIR/scripts/monitor-memory.sh"
            ADDED=$((ADDED + 1))
        else
            print_warning "monitor-memory.sh not found, skipping"
        fi
    fi

    if [ $ADDED -gt 0 ]; then
        echo "${CURRENT_CRON}${NEW_ENTRIES}" | crontab -
        print_status "Added $ADDED cron job(s):"
        crontab -l | grep -v "^$"
    else
        print_status "Crontab already configured"
    fi
    echo ""
}

# =========================================================================
# 6. Data Migration from Source System
# =========================================================================

migrate_data() {
    print_status "Step 6/8: Data migration..."

    if [ -z "$SOURCE_SYSTEM" ]; then
        print_info "No source system specified (use --migrate-from <ip> to migrate)"
        echo ""
        return
    fi

    print_info "Migrating data from $SOURCE_SYSTEM..."

    # Test connectivity
    if ! ssh -o ConnectTimeout=5 -o BatchMode=yes ubuntu@"$SOURCE_SYSTEM" "echo ok" &>/dev/null; then
        print_error "Cannot SSH to ubuntu@$SOURCE_SYSTEM"
        print_info "Ensure Tailscale is connected and SSH keys are set up"
        echo ""
        return
    fi

    local REMOTE_DB="/home/ubuntu/sports-bar-data/production.db"
    local EXPORT_DIR="/tmp/sportsbar-export-$$"
    mkdir -p "$EXPORT_DIR"

    # Tables to migrate (device configs, IR codes, and presets)
    local TABLES=(
        "IRCommand"
        "IRDevice"
        "ChannelPreset"
        "GlobalCacheDevice"
        "GlobalCachePort"
    )

    local migrated=0

    for table in "${TABLES[@]}"; do
        ssh ubuntu@"$SOURCE_SYSTEM" \
            "sqlite3 '$REMOTE_DB' '.mode insert $table' 'SELECT * FROM $table;'" \
            > "$EXPORT_DIR/$table.sql" 2>/dev/null || true

        local count=$(grep -c "INSERT" "$EXPORT_DIR/$table.sql" 2>/dev/null || echo 0)
        if [ "$count" -gt 0 ]; then
            # Use INSERT OR IGNORE to skip duplicates
            sed -i "s/INSERT INTO/INSERT OR IGNORE INTO/g" "$EXPORT_DIR/$table.sql"
            if sqlite3 "$DB_FILE" < "$EXPORT_DIR/$table.sql" 2>>"$LOG_FILE"; then
                print_status "  $table: $count records imported"
                migrated=$((migrated + count))
            else
                print_warning "  $table: import had errors (check $LOG_FILE)"
            fi
        else
            print_info "  $table: no records on source"
        fi
    done

    rm -rf "$EXPORT_DIR"

    if [ $migrated -gt 0 ]; then
        print_status "Migration complete: $migrated total records imported"
    else
        print_info "No records to migrate"
    fi
    echo ""
}

# =========================================================================
# 7. Restart PM2
# =========================================================================

restart_pm2() {
    print_status "Step 7/8: Restarting PM2 with updated environment..."

    if pm2 list 2>/dev/null | grep -q "sports-bar-tv-controller"; then
        pm2 restart sports-bar-tv-controller --update-env >> "$LOG_FILE" 2>&1
        sleep 3

        if pm2 list 2>/dev/null | grep -q "sports-bar-tv-controller.*online"; then
            print_status "Application restarted successfully"
        else
            print_warning "Application may not be running - check: pm2 logs"
        fi
    else
        print_warning "PM2 process 'sports-bar-tv-controller' not found"
        print_info "Start with: pm2 start ecosystem.config.js"
    fi
    echo ""
}

# =========================================================================
# 8. Final Verification
# =========================================================================

verify() {
    print_status "Step 8/8: System verification..."
    echo ""
    echo "=========================================="
    echo "  System Status"
    echo "=========================================="
    echo ""

    # PM2 app
    if pm2 list 2>/dev/null | grep -q "sports-bar-tv-controller.*online"; then
        print_status "PM2 app:       RUNNING"
    else
        print_error "PM2 app:       NOT RUNNING"
    fi

    # PM2 logrotate
    if pm2 list 2>/dev/null | grep -q "pm2-logrotate"; then
        print_status "PM2 logrotate: INSTALLED"
    else
        print_warning "PM2 logrotate: NOT INSTALLED"
    fi

    # Web app
    local HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        print_status "Web app:       HTTP 200"
    else
        print_warning "Web app:       HTTP $HTTP_CODE"
    fi

    # NEXTAUTH_URL
    local AUTH_URL=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '"')
    if [ -n "$AUTH_URL" ]; then
        print_status "NEXTAUTH_URL:  $AUTH_URL"
    else
        print_warning "NEXTAUTH_URL:  NOT SET"
    fi

    # Crontab
    local CRON_COUNT=$(crontab -l 2>/dev/null | grep -cv "^#\|^$" || echo "0")
    print_status "Crontab:       $CRON_COUNT job(s)"

    # Ollama
    if systemctl is-active --quiet ollama 2>/dev/null; then
        local MODEL_COUNT=$(ollama list 2>/dev/null | tail -n +2 | wc -l)
        print_status "Ollama:        ACTIVE ($MODEL_COUNT models)"
    else
        print_warning "Ollama:        NOT RUNNING (run scripts/ollama-setup.sh)"
    fi

    # Tailscale
    if tailscale status --peers=false 2>/dev/null | grep -q "100."; then
        local TS_IP=$(tailscale ip -4 2>/dev/null)
        print_status "Tailscale:     $TS_IP"
    else
        print_warning "Tailscale:     NOT CONNECTED"
    fi

    # Database
    if [ -f "$DB_FILE" ]; then
        local TABLE_COUNT=$(sqlite3 "$DB_FILE" ".tables" 2>/dev/null | wc -w)
        local DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
        print_status "Database:      $TABLE_COUNT tables ($DB_SIZE)"
    else
        print_error "Database:      NOT FOUND"
    fi

    # Disk
    local DISK_AVAIL=$(df -h / | tail -1 | awk '{print $4}')
    local DISK_TOTAL=$(df -h / | tail -1 | awk '{print $2}')
    print_status "Disk:          $DISK_AVAIL available / $DISK_TOTAL total"

    echo ""
    echo "=========================================="
    print_status "New location setup complete!"
    echo "=========================================="
    echo ""
    print_info "Next: Run ./scripts/post-install-setup.sh for device discovery"
    print_info "Log:  $LOG_FILE"
    echo ""
}

# =========================================================================
# Main
# =========================================================================

main() {
    check_storage
    setup_pm2_logrotate
    configure_nextauth_url
    setup_backup
    setup_crontab
    migrate_data
    restart_pm2
    verify
}

main "$@"
