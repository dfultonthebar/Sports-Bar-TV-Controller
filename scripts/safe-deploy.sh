#!/bin/bash
# Sports Bar TV Controller - Safe Deployment Script
# Ensures database is backed up before any deployment operations

set -e

echo "=========================================="
echo "Sports Bar TV Controller - Safe Deployment"
echo "=========================================="
echo "Started: $(date)"
echo ""

# Step 1: Backup database
echo "Step 1: Backing up database..."
/home/ubuntu/sports-bar-data/backup.sh
if [ $? -ne 0 ]; then
    echo "ERROR: Database backup failed! Aborting deployment."
    exit 1
fi
echo ""

# Step 2: Navigate to project
echo "Step 2: Navigating to project directory..."
cd /home/ubuntu/Sports-Bar-TV-Controller
echo "✓ Current directory: $(pwd)"
echo ""

# Step 3: Pull latest code
echo "Step 3: Pulling latest code from GitHub..."
git pull origin main
echo "✓ Code updated"
echo ""

# Step 4: Install dependencies
echo "Step 4: Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Step 5: Generate Prisma Client (NOT migrate!)
echo "Step 5: Generating Prisma Client..."
npx prisma generate
echo "✓ Prisma Client generated"
echo ""
echo "⚠ NOTE: NOT running 'prisma migrate' to protect existing data"
echo ""

# Step 6: Build application
echo "Step 6: Building application..."
npm run build
echo "✓ Application built"
echo ""

# Step 7: Restart PM2
echo "Step 7: Restarting application..."
pm2 restart sports-bar-tv
sleep 3
pm2 status sports-bar-tv
echo "✓ Application restarted"
echo ""

echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo "Database location: /home/ubuntu/sports-bar-data/production.db"
echo "Latest backup: /home/ubuntu/sports-bar-data/backups/"
ls -lht /home/ubuntu/sports-bar-data/backups/ | head -n 2
echo ""
echo "To view logs: pm2 logs sports-bar-tv"
echo "To restore database: /home/ubuntu/sports-bar-data/restore.sh <backup_filename>"
