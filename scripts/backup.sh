#!/bin/bash
# Sports Bar TV Controller - Database Backup Script
# Automatically backs up the production database

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SOURCE_DB="/home/ubuntu/sports-bar-data/production.db"
BACKUP_DIR="/home/ubuntu/sports-bar-data/backups"
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.db"

# Create backup
if [ -f "$SOURCE_DB" ]; then
    cp "$SOURCE_DB" "$BACKUP_FILE"
    echo "[$(date)] Database backed up to: $BACKUP_FILE"
    
    # Keep only last 30 backups
    cd "$BACKUP_DIR"
    ls -t backup_*.db 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null
    
    # Show backup statistics
    BACKUP_COUNT=$(ls -1 backup_*.db 2>/dev/null | wc -l)
    BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Total backups: $BACKUP_COUNT, Latest size: $BACKUP_SIZE"
else
    echo "[$(date)] ERROR: Source database not found at $SOURCE_DB"
    exit 1
fi
