#!/bin/bash
# Migration script to add AudioGroup table to production database
# This fixes the issue where groups are not showing in bartender remote

set -e

echo "=== Audio Groups Migration Script ==="
echo "This script will add the AudioGroup table to the database"
echo ""

# Find the database file
DB_PATH=""
if [ -f "./prisma/data/sports_bar.db" ]; then
    DB_PATH="./prisma/data/sports_bar.db"
elif [ -f "./data/sports_bar.db" ]; then
    DB_PATH="./data/sports_bar.db"
else
    echo "Error: Could not find sports_bar.db"
    exit 1
fi

echo "Found database at: $DB_PATH"
echo ""

# Backup the database
BACKUP_PATH="${DB_PATH}.backup-$(date +%Y%m%d-%H%M%S)"
echo "Creating backup at: $BACKUP_PATH"
cp "$DB_PATH" "$BACKUP_PATH"
echo "Backup created successfully"
echo ""

# Check if table already exists
TABLE_EXISTS=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='AudioGroup';" 2>/dev/null || echo "")

if [ -n "$TABLE_EXISTS" ]; then
    echo "AudioGroup table already exists. Skipping migration."
    exit 0
fi

# Apply migration
echo "Applying migration..."
sqlite3 "$DB_PATH" << 'EOF'
-- CreateTable: AudioGroup
CREATE TABLE "AudioGroup" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "processorId" TEXT NOT NULL,
  "groupNumber" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" INTEGER DEFAULT 0 NOT NULL,
  "currentSource" TEXT,
  "gain" REAL DEFAULT -10 NOT NULL,
  "muted" INTEGER DEFAULT 0 NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  FOREIGN KEY ("processorId") REFERENCES "AudioProcessor"("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AudioGroup_processorId_groupNumber_key" ON "AudioGroup"("processorId", "groupNumber");
EOF

# Verify migration
TABLE_EXISTS=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='AudioGroup';")

if [ -n "$TABLE_EXISTS" ]; then
    echo ""
    echo "✓ Migration applied successfully!"
    echo "✓ AudioGroup table created"
    echo ""
    echo "Next steps:"
    echo "1. Restart the application: pm2 restart all"
    echo "2. Go to Atlas Programming Interface and click 'Query Hardware'"
    echo "3. Groups should now appear in Bartender Remote"
else
    echo ""
    echo "✗ Migration failed!"
    echo "Restoring backup..."
    cp "$BACKUP_PATH" "$DB_PATH"
    echo "Database restored from backup"
    exit 1
fi
