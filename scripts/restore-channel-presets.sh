
#!/bin/bash

# =============================================================================
# CHANNEL PRESETS RESTORE SCRIPT
# =============================================================================
# This script restores channel presets from a JSON backup
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$HOME/sports-bar-backups/channel-presets"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Find the most recent backup
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/channel-presets-*.json 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    log "No backup file found in $BACKUP_DIR"
    exit 1
fi

log "Found backup: $LATEST_BACKUP"

# Check if database exists
DB_PATH="$PROJECT_DIR/prisma/data/sports_bar.db"
if [ ! -f "$DB_PATH" ]; then
    log "Warning: Database not found at $DB_PATH"
    exit 1
fi

log "Restoring channel presets..."

# Create a temporary SQL file for restoration
TEMP_SQL=$(mktemp)

# Convert JSON to SQL INSERT statements
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$LATEST_BACKUP', 'utf8'));

let sql = '';
data.forEach(preset => {
  const id = preset.id;
  const name = preset.name.replace(/'/g, \"''\");
  const channelNumber = preset.channelNumber;
  const deviceType = preset.deviceType;
  const order = preset.order || 0;
  const usageCount = preset.usageCount || 0;
  const lastUsed = preset.lastUsed ? \"'\" + preset.lastUsed + \"'\" : 'NULL';
  const createdAt = preset.createdAt;
  const updatedAt = preset.updatedAt;
  
  sql += \`INSERT OR REPLACE INTO ChannelPreset (id, name, channelNumber, deviceType, \\\`order\\\`, isActive, usageCount, lastUsed, createdAt, updatedAt) VALUES ('\${id}', '\${name}', '\${channelNumber}', '\${deviceType}', \${order}, 1, \${usageCount}, \${lastUsed}, '\${createdAt}', '\${updatedAt}');\n\`;
});

fs.writeFileSync('$TEMP_SQL', sql);
"

# Execute the SQL
sqlite3 "$DB_PATH" < "$TEMP_SQL"

# Clean up
rm "$TEMP_SQL"

PRESET_COUNT=$(cat "$LATEST_BACKUP" | grep -o '"id"' | wc -l)
log "✅ Restored $PRESET_COUNT channel presets successfully"
