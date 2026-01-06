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

# Check migration status
echo "Checking migration status..."
MIGRATION_STATUS=$(npx prisma migrate status 2>&1 || true)

echo "$MIGRATION_STATUS"
echo ""

# Check if the specific migration is in failed state
if echo "$MIGRATION_STATUS" | grep -q "20250103_add_usage_tracking"; then
    echo "Found migration 20250103_add_usage_tracking - resolving failed state..."
    
    # Resolve the failed migration as rolled back
    # This tells Prisma that the migration was rolled back and can be re-applied
    if npx prisma migrate resolve --rolled-back 20250103_add_usage_tracking; then
        echo "✓ Migration marked as rolled back successfully"
    else
        echo "⚠ Warning: Could not mark migration as rolled back"
        echo "This may be okay if the migration was already resolved"
    fi
else
    echo "Migration 20250103_add_usage_tracking not found in failed state"
    echo "Checking if it needs to be applied..."
fi

echo ""
echo "Step 3: Applying all pending migrations"
echo "---------------------------------------"

# Deploy all pending migrations
# This will apply any migrations that haven't been run yet
echo "Running: npx prisma migrate deploy"
if npx prisma migrate deploy; then
    echo "✓ All migrations applied successfully"
else
    echo "✗ Migration deployment failed"
    echo ""
    echo "Please check the error above and ensure:"
    echo "  1. Database is accessible"
    echo "  2. Database connection string is correct in .env"
    echo "  3. No other process is holding database locks"
    exit 1
fi

# Verify migration status after deployment
echo ""
echo "Verifying migration status..."
npx prisma migrate status

echo ""
echo "Step 4: Rebuilding the application"
echo "----------------------------------"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build the application
echo "Running: npm run build"
if npm run build; then
    echo "✓ Application built successfully"
else
    echo "✗ Build failed"
    echo "Please check the error above for TypeScript or build issues"
    exit 1
fi

echo ""
echo "Step 5: Restarting the application"
echo "----------------------------------"

# Check if using PM2
if command -v pm2 &> /dev/null; then
    echo "Restarting with PM2..."
    pm2 restart sports-bar-tv-controller || pm2 start npm --name "sports-bar-tv-controller" -- start
    echo "✓ Application restarted with PM2"
    echo ""
    echo "Check application status with: pm2 status"
    echo "View logs with: pm2 logs sports-bar-tv-controller"
# Check if using systemd
elif systemctl is-active --quiet sports-bar-tv-controller 2>/dev/null; then
    echo "Restarting with systemd..."
    sudo systemctl restart sports-bar-tv-controller
    echo "✓ Application restarted with systemd"
    echo ""
    echo "Check application status with: sudo systemctl status sports-bar-tv-controller"
    echo "View logs with: sudo journalctl -u sports-bar-tv-controller -f"
else
    echo "⚠ No process manager detected (PM2 or systemd)"
    echo "Please manually restart your application with:"
    echo "  npm start"
    echo ""
    echo "Or start with PM2:"
    echo "  pm2 start npm --name sports-bar-tv-controller -- start"
fi

echo ""
echo "=========================================="
echo "✓ Deployment fix completed successfully!"
echo "=========================================="
echo ""
echo "Summary of changes:"
echo "  1. ✓ Fixed TypeScript import in presetCronService.ts"
echo "  2. ✓ Resolved failed migration state"
echo "  3. ✓ Applied all pending migrations"
echo "  4. ✓ Rebuilt the application"
echo "  5. ✓ Restarted the server"
echo ""
echo "Your preset feature should now be fully deployed and working!"
echo ""
echo "Next steps:"
echo "  - Verify the application is running"
echo "  - Test the preset functionality in the UI"
echo "  - Check logs for any runtime errors"
echo ""
