#!/bin/bash
# Deployment script to fix migration order and deploy channel presets
# Run this on your server at /home/ubuntu/Sports-Bar-TV-Controller

set -e  # Exit on error

echo "=========================================="
echo "Channel Preset Deployment Fix Script"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in Sports-Bar-TV-Controller directory"
    echo "Please run: cd /home/ubuntu/Sports-Bar-TV-Controller"
    exit 1
fi

echo "✅ In correct directory"
echo ""

# Backup current database
echo "📦 Creating database backup..."
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp prisma/data/sports_bar.db "$BACKUP_DIR/sports_bar.db.backup" 2>/dev/null || echo "No database to backup (fresh install)"
echo "✅ Backup created at $BACKUP_DIR"
echo ""

# Pull latest fixes
echo "📥 Pulling latest fixes from GitHub..."
git fetch origin
git checkout fix/migration-order-and-import
git pull origin fix/migration-order-and-import
echo "✅ Code updated"
echo ""

# Check if migrations have been applied
echo "🔍 Checking migration state..."
if npx prisma migrate status 2>&1 | grep -q "20250103_add_usage_tracking"; then
    echo "⚠️  Old migration detected, marking as applied..."
    npx prisma migrate resolve --applied 20250103_add_usage_tracking
    echo "✅ Old migration marked as applied"
else
    echo "✅ No conflicting migrations found"
fi
echo ""

# Apply migrations
echo "🔄 Applying database migrations..."
npx prisma migrate deploy
echo "✅ Migrations applied successfully"
echo ""

# Install dependencies (in case any changed)
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Build the application
echo "🔨 Building application..."
npm run build
echo "✅ Build completed"
echo ""

# Restart the application
echo "🔄 Restarting application..."
if command -v pm2 &> /dev/null; then
    pm2 restart all
    echo "✅ Application restarted with PM2"
elif command -v systemctl &> /dev/null && systemctl is-active --quiet sports-bar-tv; then
    sudo systemctl restart sports-bar-tv
    echo "✅ Application restarted with systemd"
else
    echo "⚠️  Please manually restart your application"
fi
echo ""

# Verify deployment
echo "🔍 Verifying deployment..."
sleep 3
if command -v pm2 &> /dev/null; then
    pm2 status
elif command -v systemctl &> /dev/null && systemctl is-active --quiet sports-bar-tv; then
    systemctl status sports-bar-tv --no-pager
fi
echo ""

echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Check the application logs for any errors"
echo "2. Open the web interface and verify channel presets are visible"
echo "3. Test the preset quick access buttons"
echo ""
echo "If you encounter issues:"
echo "- Check logs: pm2 logs (or journalctl -u sports-bar-tv -f)"
echo "- Database backup is at: $BACKUP_DIR"
echo "- Report issues at: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues"
echo ""
