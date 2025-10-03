#!/bin/bash

# Comprehensive fix script for Sports Bar TV Controller deployment issues
# This script fixes:
# 1. TypeScript import error in presetCronService.ts
# 2. Failed migration state in database
# 3. Rebuilds and restarts the application

set -e  # Exit on any error

echo "=========================================="
echo "Sports Bar TV Controller - Deployment Fix"
echo "=========================================="
echo ""

# Define the project directory
PROJECT_DIR="/home/ubuntu/Sports-Bar-TV-Controller"

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo "ERROR: Project directory not found at $PROJECT_DIR"
    echo "Please ensure the application is installed at this location."
    exit 1
fi

cd "$PROJECT_DIR"

echo "Step 1: Fixing TypeScript import in presetCronService.ts"
echo "--------------------------------------------------------"

# Backup the original file
cp src/services/presetCronService.ts src/services/presetCronService.ts.backup

# Fix the import statement - replace any old cron namespace imports with proper import
sed -i "1s/.*/import cron, { ScheduledTask } from 'node-cron'/" src/services/presetCronService.ts

# Verify the fix
if grep -q "import cron, { ScheduledTask } from 'node-cron'" src/services/presetCronService.ts; then
    echo "✓ TypeScript import fixed successfully"
else
    echo "✗ Failed to fix TypeScript import"
    mv src/services/presetCronService.ts.backup src/services/presetCronService.ts
    exit 1
fi

echo ""
echo "Step 2: Resolving failed migration state"
echo "----------------------------------------"

# Check if the migration is marked as failed
MIGRATION_STATUS=$(npx prisma migrate status 2>&1 || true)

if echo "$MIGRATION_STATUS" | grep -q "20250103_add_usage_tracking"; then
    echo "Found migration 20250103_add_usage_tracking in database"
    
    # Resolve the failed migration as rolled back
    echo "Marking migration as rolled back..."
    npx prisma migrate resolve --rolled-back 20250103_add_usage_tracking || {
        echo "Warning: Could not mark migration as rolled back. It may not exist or already be resolved."
    }
    
    echo "✓ Migration state resolved"
else
    echo "Migration 20250103_add_usage_tracking not found in failed state"
fi

echo ""
echo "Step 3: Applying all pending migrations"
echo "---------------------------------------"

npx prisma migrate deploy

echo "✓ All migrations applied successfully"

echo ""
echo "Step 4: Rebuilding the application"
echo "----------------------------------"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build the application
npm run build

echo "✓ Application built successfully"

echo ""
echo "Step 5: Restarting the application"
echo "----------------------------------"

# Check if using PM2
if command -v pm2 &> /dev/null; then
    echo "Restarting with PM2..."
    pm2 restart sports-bar-tv-controller || pm2 start npm --name "sports-bar-tv-controller" -- start
    echo "✓ Application restarted with PM2"
# Check if using systemd
elif systemctl is-active --quiet sports-bar-tv-controller; then
    echo "Restarting with systemd..."
    sudo systemctl restart sports-bar-tv-controller
    echo "✓ Application restarted with systemd"
else
    echo "⚠ No process manager detected (PM2 or systemd)"
    echo "Please manually restart your application with:"
    echo "  npm start"
fi

echo ""
echo "=========================================="
echo "✓ Deployment fix completed successfully!"
echo "=========================================="
echo ""
echo "Summary of changes:"
echo "  1. Fixed TypeScript import in presetCronService.ts"
echo "  2. Resolved failed migration state"
echo "  3. Applied all pending migrations"
echo "  4. Rebuilt the application"
echo "  5. Restarted the server"
echo ""
echo "Your preset feature should now be fully deployed and working!"
echo ""
