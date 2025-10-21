#!/bin/bash

# Sports Bar TV Controller - Emergency Deployment Script
# This script will pull the latest code from GitHub and rebuild the application
# Run this script on the remote server (24.123.87.42)

set -e  # Exit on error

echo "================================================"
echo "Sports Bar TV Controller - Emergency Fix Deployment"
echo "================================================"
echo ""

# Find the application directory
if [ -d "$HOME/Sports-Bar-TV-Controller" ]; then
    APP_DIR="$HOME/Sports-Bar-TV-Controller"
elif [ -d "/var/www/Sports-Bar-TV-Controller" ]; then
    APP_DIR="/var/www/Sports-Bar-TV-Controller"
elif [ -d "/opt/Sports-Bar-TV-Controller" ]; then
    APP_DIR="/opt/Sports-Bar-TV-Controller"
else
    echo "❌ ERROR: Application directory not found!"
    echo "Searching for the directory..."
    APP_DIR=$(find ~/ -name "Sports-Bar-TV-Controller" -type d 2>/dev/null | head -1)
    if [ -z "$APP_DIR" ]; then
        echo "Could not find Sports-Bar-TV-Controller directory"
        exit 1
    fi
fi

echo "✅ Application Directory: $APP_DIR"
cd "$APP_DIR"

# Check Git status
echo ""
echo "📋 Step 1: Checking Git status..."
git status

# Stash any local changes
echo ""
echo "💾 Step 2: Stashing local changes..."
git stash save "Auto-stash before emergency fix deployment $(date)"

# Pull latest changes from main branch
echo ""
echo "📥 Step 3: Pulling latest changes from GitHub..."
git fetch origin
git checkout main
git pull origin main

echo ""
echo "✅ SUCCESS: Latest code pulled from GitHub"

# Install/update dependencies if package.json changed
echo ""
echo "📦 Step 4: Checking for dependency updates..."
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
    echo "package.json changed, installing dependencies..."
    npm install
    echo "✅ Dependencies installed successfully!"
else
    echo "✅ No dependency changes detected"
fi

# Build the application
echo ""
echo "🏗️  Step 5: Building the application..."
echo "This may take a few minutes..."
npm run build

echo ""
echo "✅ SUCCESS: Application built successfully!"

# Restart the application
echo ""
echo "🔄 Step 6: Restarting the application..."

if command -v pm2 &> /dev/null; then
    echo "Using PM2 to restart application..."
    pm2 list
    
    # Try to find the app name
    APP_NAME=$(pm2 list | grep -i "sports-bar\|audio-control" | awk '{print $2}' | head -1)
    
    if [ -z "$APP_NAME" ]; then
        echo "PM2 app not found, starting new instance..."
        pm2 start npm --name "sports-bar-tv" -- start
    else
        echo "Restarting PM2 app: $APP_NAME"
        pm2 restart "$APP_NAME"
    fi
    
    pm2 save
    echo "✅ Application restarted with PM2"
    
elif systemctl list-units --type=service | grep -q "sports-bar"; then
    echo "Using systemctl to restart service..."
    sudo systemctl restart sports-bar
    echo "✅ Application restarted with systemctl"
    
else
    echo "⚠️  No process manager detected (PM2 or systemd)"
    echo "Please manually restart your application:"
    echo "  1. Stop the current running instance"
    echo "  2. Run: npm run start"
    echo "  OR if using PM2: pm2 restart all"
fi

# Verify the application
echo ""
echo "🔍 Step 7: Verifying application..."
sleep 5

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 || echo "000")
if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 301 ] || [ "$HTTP_STATUS" -eq 302 ]; then
    echo "✅ SUCCESS: Application is responding (HTTP $HTTP_STATUS)"
else
    echo "⚠️  WARNING: Application returned HTTP $HTTP_STATUS"
    echo "The application may need a moment to start up"
fi

echo ""
echo "================================================"
echo "✅ DEPLOYMENT COMPLETED!"
echo "================================================"
echo ""
echo "What was fixed:"
echo "  ✓ Added missing /api/matrix/video-input-selection endpoint"
echo "  ✓ Fixed SQLite3 data binding errors (sanitizeData)"
echo "  ✓ Fixed React rendering errors with Atlas configuration"
echo "  ✓ Improved error handling in Atlas hardware queries"
echo ""
echo "Next steps:"
echo "  1. Open http://24.123.87.42:3001/audio-control in your browser"
echo "  2. Verify that the errors are resolved"
echo "  3. Test Atlas processor connectivity"
echo "  4. Check the browser console for any remaining errors"
echo ""
echo "If you encounter issues, check the logs:"
echo "  - PM2 logs: pm2 logs"
echo "  - Application logs: Check the console output"
echo ""
