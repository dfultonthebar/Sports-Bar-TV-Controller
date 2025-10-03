
#!/bin/bash

# =============================================================================
# CHANNEL PRESETS BACKUP SCRIPT
# =============================================================================
# This script exports channel presets to JSON for backup purposes
# Can be used standalone or integrated into update_from_github.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$HOME/sports-bar-backups/channel-presets"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting channel presets backup..."

# Check if database exists
DB_PATH="$PROJECT_DIR/prisma/data/sports_bar.db"
if [ ! -f "$DB_PATH" ]; then
    log "Warning: Database not found at $DB_PATH"
    exit 1
fi

# Export presets to JSON using sqlite3
BACKUP_FILE="$BACKUP_DIR/channel-presets-$TIMESTAMP.json"

log "Exporting presets to $BACKUP_FILE..."

sqlite3 "$DB_PATH" <<EOF > "$BACKUP_FILE"
.mode json
SELECT * FROM ChannelPreset WHERE isActive = 1;
EOF

if [ -f "$BACKUP_FILE" ]; then
    PRESET_COUNT=$(cat "$BACKUP_FILE" | grep -o '"id"' | wc -l)
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    
    log "✅ Backup completed successfully"
    log "   File: $BACKUP_FILE"
    log "   Size: $FILE_SIZE"
    log "   Presets: $PRESET_COUNT"
    
    # Keep only last 30 backups
    cd "$BACKUP_DIR"
    ls -t channel-presets-*.json 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true
    
    echo "$BACKUP_FILE"
else
    log "❌ Backup failed"
    exit 1
fi
