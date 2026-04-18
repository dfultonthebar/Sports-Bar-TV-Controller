#!/bin/bash
set -e

echo "=== Sports Bar TV Controller - Emergency Fix Script ==="
echo "Starting at: $(date)"
echo ""

# Navigate to project directory
cd ~/Sports-Bar-TV-Controller

# Step 1: Backup configurations
echo "Step 1: Creating backup of configurations..."
mkdir -p backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/backup_${TIMESTAMP}.json"

# Create backup using Node.js with proper Prisma client
cat > /tmp/backup_db.js << 'EOFBACKUP'
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function backup() {
  const prisma = new PrismaClient();
  try {
    const wolfpackConfig = await prisma.matrixConfiguration.findMany({
      include: {
        inputs: true,
        outputs: true
      }
    });
    
    const backup = {
      timestamp: new Date().toISOString(),
      matrixConfigurations: wolfpackConfig
    };
    
    console.log(JSON.stringify(backup, null, 2));
  } catch (error) {
    console.error('Backup error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backup();
EOFBACKUP

node /tmp/backup_db.js > "$BACKUP_FILE" 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Backup saved to: $BACKUP_FILE"
  cat "$BACKUP_FILE" | head -50
else
  echo "✗ Backup failed, but continuing with fixes..."
fi

# Step 2: Regenerate Prisma Client
echo ""
echo "Step 2: Regenerating Prisma Client..."
npx prisma generate
echo "✓ Prisma client regenerated"

# Step 3: Run any pending migrations
echo ""
echo "Step 3: Checking for pending migrations..."
npx prisma migrate deploy
echo "✓ Migrations applied"

# Step 4: Rebuild application
echo ""
echo "Step 4: Rebuilding application..."
npm run build
echo "✓ Application rebuilt"

# Step 5: Restart PM2
echo ""
echo "Step 5: Restarting PM2 process..."
pm2 restart sports-bar-tv-controller
echo "✓ PM2 restarted"

# Step 6: Wait for application to start
echo ""
echo "Step 6: Waiting for application to start..."
sleep 5

# Step 7: Check PM2 status
echo ""
echo "Step 7: Checking PM2 status..."
pm2 status sports-bar-tv-controller

echo ""
echo "=== Fix script completed at: $(date) ==="
echo "Backup file: $BACKUP_FILE"
echo ""
echo "Next steps:"
echo "1. Test connection at: http://24.123.87.42:3001"
echo "2. Run Wolf Pack Connection Test"
echo "3. Run Wolf Pack Switching Test"
echo "4. Verify Bartender Remote connection"
