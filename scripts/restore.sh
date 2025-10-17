#!/bin/bash
# Sports Bar TV Controller - Database Restore Script
# Restores database from a backup file

BACKUP_DIR="/home/ubuntu/sports-bar-data/backups"
PRODUCTION_DB="/home/ubuntu/sports-bar-data/production.db"

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_filename>"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/backup_*.db 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Create safety backup of current production database
if [ -f "$PRODUCTION_DB" ]; then
    SAFETY_BACKUP="$BACKUP_DIR/pre-restore_$(date +%Y%m%d_%H%M%S).db"
    cp "$PRODUCTION_DB" "$SAFETY_BACKUP"
    echo "Safety backup created: $SAFETY_BACKUP"
fi

# Restore from backup
cp "$BACKUP_FILE" "$PRODUCTION_DB"
echo "Database restored from: $1"
echo "Production database: $PRODUCTION_DB"
echo ""
echo "⚠ IMPORTANT: Restart the application for changes to take effect:"
echo "   pm2 restart sports-bar-tv"
