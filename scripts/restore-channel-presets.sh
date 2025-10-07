
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

# Validate JSON file first
if ! node -e "JSON.parse(require('fs').readFileSync('$LATEST_BACKUP', 'utf8'))" 2>/dev/null; then
    log "Error: Backup file contains invalid JSON"
    log "File: $LATEST_BACKUP"
    log "Skipping channel preset restoration"
    exit 1
fi

# Create a temporary SQL file for restoration
TEMP_SQL=$(mktemp)

# Convert JSON to SQL INSERT statements with error handling
if ! node -e "
try {
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('$LATEST_BACKUP', 'utf8'));
  
  if (!Array.isArray(data)) {
    console.error('Error: Backup data is not an array');
    process.exit(1);
  }
  
  if (data.length === 0) {
    console.log('No channel presets to restore');
    process.exit(0);
  }
  
  let sql = '';
  data.forEach(preset => {
    if (!preset.id || !preset.name || !preset.channelNumber || !preset.deviceType) {
      console.error('Warning: Skipping invalid preset:', preset);
      return;
    }
    
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
  
  if (sql.length === 0) {
    console.log('No valid presets found to restore');
    process.exit(0);
  }
  
  fs.writeFileSync('$TEMP_SQL', sql);
  console.log('SQL file created successfully');
} catch (error) {
  console.error('Error processing backup file:', error.message);
  process.exit(1);
}
" 2>&1; then
    log "Error: Failed to process backup file"
    rm -f "$TEMP_SQL"
    exit 1
fi

# Check if SQL file was created and has content
if [ ! -f "$TEMP_SQL" ] || [ ! -s "$TEMP_SQL" ]; then
    log "No SQL statements generated, skipping restoration"
    rm -f "$TEMP_SQL"
    exit 0
fi

# Execute the SQL
if sqlite3 "$DB_PATH" < "$TEMP_SQL" 2>&1; then
    # Clean up
    rm "$TEMP_SQL"
    
    # Count restored presets
    PRESET_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ChannelPreset;" 2>/dev/null || echo "unknown")
    log "✅ Channel presets restored successfully (Total: $PRESET_COUNT)"
else
    log "Error: Failed to execute SQL restoration"
    rm -f "$TEMP_SQL"
    exit 1
fi
