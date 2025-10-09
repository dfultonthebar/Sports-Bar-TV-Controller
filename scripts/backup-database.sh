#!/bin/bash
# Database Backup Script for Sports Bar TV Controller
# This script creates timestamped backups of the SQLite database

set -e

# Configuration
DB_PATH="${DB_PATH:-./data/sports-bar.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/sports-bar_${TIMESTAMP}.db"
MAX_BACKUPS=10

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database not found at $DB_PATH"
    exit 1
fi

# Create backup
echo "Creating backup: $BACKUP_FILE"
cp "$DB_PATH" "$BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
    echo "Backup created successfully (${BACKUP_SIZE} bytes)"
else
    echo "Error: Backup failed"
    exit 1
fi

# Clean up old backups (keep only MAX_BACKUPS most recent)
echo "Cleaning up old backups (keeping ${MAX_BACKUPS} most recent)..."
ls -t "${BACKUP_DIR}"/sports-bar_*.db | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -f

echo "Backup complete!"
echo "Backup location: $BACKUP_FILE"
echo "Total backups: $(ls -1 "${BACKUP_DIR}"/sports-bar_*.db 2>/dev/null | wc -l)"
