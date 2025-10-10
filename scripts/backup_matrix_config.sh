#!/bin/bash

# Matrix Configuration Backup Script
# Backs up matrix configuration from SQLite database
# Usage: ./scripts/backup_matrix_config.sh [backup_dir]

set -e

# Configuration
PROJECT_DIR="$HOME/Sports-Bar-TV-Controller"
DB_PATH="$PROJECT_DIR/prisma/data/sports_bar.db"
BACKUP_DIR="${1:-$PROJECT_DIR/backups/matrix-config}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="matrix_config_${TIMESTAMP}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Matrix Configuration Backup ===${NC}"
echo "Timestamp: $(date)"
echo "Database: $DB_PATH"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}Error: Database not found at $DB_PATH${NC}"
    exit 1
fi

# Create backup subdirectory for this backup
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
mkdir -p "$BACKUP_PATH"

echo -e "${YELLOW}[1/5] Backing up full database...${NC}"
cp "$DB_PATH" "$BACKUP_PATH/sports_bar.db"
echo "✓ Database copied"

echo -e "${YELLOW}[2/5] Exporting MatrixConfiguration...${NC}"
sqlite3 "$DB_PATH" <<EOF > "$BACKUP_PATH/matrix_configuration.sql"
.mode insert MatrixConfiguration
SELECT * FROM MatrixConfiguration;
EOF
echo "✓ MatrixConfiguration exported"

echo -e "${YELLOW}[3/5] Exporting MatrixInput...${NC}"
sqlite3 "$DB_PATH" <<EOF > "$BACKUP_PATH/matrix_input.sql"
.mode insert MatrixInput
SELECT * FROM MatrixInput;
EOF
echo "✓ MatrixInput exported"

echo -e "${YELLOW}[4/5] Exporting MatrixOutput...${NC}"
sqlite3 "$DB_PATH" <<EOF > "$BACKUP_PATH/matrix_output.sql"
.mode insert MatrixOutput
SELECT * FROM MatrixOutput;
EOF
echo "✓ MatrixOutput exported"

echo -e "${YELLOW}[5/5] Creating JSON export...${NC}"
sqlite3 "$DB_PATH" <<EOF > "$BACKUP_PATH/matrix_config.json"
.mode json
SELECT 
    c.id as config_id,
    c.name,
    c.ipAddress,
    c.tcpPort,
    c.udpPort,
    c.protocol,
    c.isActive,
    c.cecInputChannel,
    c.createdAt,
    c.updatedAt,
    (SELECT json_group_array(json_object(
        'id', i.id,
        'channelNumber', i.channelNumber,
        'label', i.label,
        'inputType', i.inputType,
        'deviceType', i.deviceType,
        'isActive', i.isActive,
        'status', i.status,
        'powerOn', i.powerOn,
        'isCecPort', i.isCecPort
    )) FROM MatrixInput i WHERE i.configId = c.id) as inputs,
    (SELECT json_group_array(json_object(
        'id', o.id,
        'channelNumber', o.channelNumber,
        'label', o.label,
        'resolution', o.resolution,
        'isActive', o.isActive,
        'status', o.status,
        'audioOutput', o.audioOutput,
        'powerOn', o.powerOn
    )) FROM MatrixOutput o WHERE o.configId = c.id) as outputs
FROM MatrixConfiguration c
WHERE c.isActive = 1;
EOF
echo "✓ JSON export created"

# Create backup info file
cat > "$BACKUP_PATH/backup_info.txt" <<EOF
Matrix Configuration Backup
===========================

Backup Date: $(date)
Backup Name: $BACKUP_NAME
Database Path: $DB_PATH
Backup Path: $BACKUP_PATH

Contents:
- sports_bar.db: Full database backup
- matrix_configuration.sql: MatrixConfiguration table (SQL INSERT format)
- matrix_input.sql: MatrixInput table (SQL INSERT format)
- matrix_output.sql: MatrixOutput table (SQL INSERT format)
- matrix_config.json: Active configuration in JSON format
- backup_info.txt: This file

Statistics:
EOF

# Add statistics
echo "- MatrixConfiguration records: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM MatrixConfiguration;")" >> "$BACKUP_PATH/backup_info.txt"
echo "- MatrixInput records: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM MatrixInput;")" >> "$BACKUP_PATH/backup_info.txt"
echo "- MatrixOutput records: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM MatrixOutput;")" >> "$BACKUP_PATH/backup_info.txt"
echo "- Active configurations: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM MatrixConfiguration WHERE isActive = 1;")" >> "$BACKUP_PATH/backup_info.txt"

# Create compressed archive
echo -e "${YELLOW}Creating compressed archive...${NC}"
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
ARCHIVE_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
echo "✓ Archive created: ${BACKUP_NAME}.tar.gz ($ARCHIVE_SIZE)"

# Display backup info
echo ""
echo -e "${GREEN}=== Backup Complete ===${NC}"
echo "Backup location: $BACKUP_PATH"
echo "Archive: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
echo ""
cat "$BACKUP_PATH/backup_info.txt"

# Cleanup old backups (keep last 30 days)
echo ""
echo -e "${YELLOW}Cleaning up old backups (keeping last 30 days)...${NC}"
find "$BACKUP_DIR" -name "matrix_config_*.tar.gz" -type f -mtime +30 -delete
find "$BACKUP_DIR" -name "matrix_config_*" -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true
echo "✓ Cleanup complete"

echo ""
echo -e "${GREEN}Backup successful!${NC}"
echo ""
echo "To restore from this backup:"
echo "  1. Stop the application: pm2 stop sports-bar-tv-controller"
echo "  2. Restore database: cp $BACKUP_PATH/sports_bar.db $DB_PATH"
echo "  3. Start the application: pm2 start sports-bar-tv-controller"
echo ""
echo "Or restore from SQL:"
echo "  sqlite3 $DB_PATH < $BACKUP_PATH/matrix_configuration.sql"
echo "  sqlite3 $DB_PATH < $BACKUP_PATH/matrix_input.sql"
echo "  sqlite3 $DB_PATH < $BACKUP_PATH/matrix_output.sql"
