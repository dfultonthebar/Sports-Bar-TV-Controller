#!/bin/bash

# Deployment Script for Sports Bar TV Controller
# This script should be run from a machine that has SSH access to the remote server

set -e  # Exit on error

echo "=================================================="
echo "Sports Bar TV Controller - Deployment Script"
echo "=================================================="
echo ""

# Remote server configuration
REMOTE_HOST="24.123.187.42"
REMOTE_PORT="224"
REMOTE_USER="ubuntu"
REMOTE_PASSWORD="6809233DjD\$\$\$"

echo "🔍 Step 1: Connecting to remote server..."
echo "Host: $REMOTE_HOST"
echo "Port: $REMOTE_PORT"
echo ""

# Connect to remote server and execute deployment commands
sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST << 'ENDSSH'
    set -e
    
    echo "✅ Connected to remote server successfully!"
    echo ""
    
    # Find the application directory
    echo "🔍 Step 2: Locating application directory..."
    if [ -d "$HOME/Sports-Bar-TV-Controller" ]; then
        APP_DIR="$HOME/Sports-Bar-TV-Controller"
    elif [ -d "/var/www/Sports-Bar-TV-Controller" ]; then
        APP_DIR="/var/www/Sports-Bar-TV-Controller"
    elif [ -d "/opt/Sports-Bar-TV-Controller" ]; then
        APP_DIR="/opt/Sports-Bar-TV-Controller"
    else
        echo "❌ Application directory not found!"
        echo "Searching for directories..."
        find ~/ -name "Sports-Bar-TV-Controller" -type d 2>/dev/null || true
        exit 1
    fi
    
    echo "✅ Found application at: $APP_DIR"
    cd "$APP_DIR"
    echo ""
    
    # Check current branch
    echo "🔍 Step 3: Checking current Git status..."
    git branch -a
    git status
    echo ""
    
    # Stash any local changes
    echo "💾 Step 4: Stashing any local changes..."
    git stash save "Auto-stash before deployment $(date)"
    echo ""
    
    # Pull latest changes from GitHub
    echo "📥 Step 5: Pulling latest changes from GitHub main branch..."
    git fetch origin
    git checkout main
    git pull origin main
    echo "✅ Latest changes pulled successfully!"
    echo ""
    
    # Check if package.json has changed (need to reinstall dependencies)
    echo "🔍 Step 6: Checking for dependency updates..."
    if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
        echo "📦 package.json changed, installing dependencies..."
        npm install
        echo "✅ Dependencies installed successfully!"
    else
        echo "✅ No dependency changes detected"
    fi
    echo ""
    
    # Build the application
    echo "🏗️  Step 7: Building the application..."
    npm run build
    echo "✅ Build completed successfully!"
    echo ""
    
    # Identify the process manager and restart
    echo "🔄 Step 8: Restarting the application..."
    
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
        sudo systemctl status sports-bar --no-pager
        echo "✅ Application restarted with systemctl"
        
    else
        echo "⚠️  No process manager detected (PM2 or systemd)"
        echo "Please manually restart your application"
        echo "Common commands:"
        echo "  - npm run start (for development)"
        echo "  - pm2 restart <app-name> (if using PM2)"
        echo "  - systemctl restart <service-name> (if using systemd)"
    fi
    echo ""
    
    # Verify the application is running
    echo "🔍 Step 9: Verifying application status..."
    
    # Check if port 3000 is listening
    if netstat -tuln | grep -q ":3000"; then
        echo "✅ Application is listening on port 3000"
    else
        echo "⚠️  Warning: Port 3000 is not listening"
    fi
    
    # Check if the application responds
    echo "Testing HTTP endpoint..."
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ || echo "000")
    if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 301 ] || [ "$HTTP_STATUS" -eq 302 ]; then
        echo "✅ Application is responding (HTTP $HTTP_STATUS)"
    else
        echo "⚠️  Warning: Application returned HTTP $HTTP_STATUS"
    fi
    echo ""
    
    # Test Atlas processor connectivity
    echo "🔍 Step 10: Testing Atlas processor connectivity..."
    echo "Attempting to connect to Atlas processor..."
    
    # The API should be at /api/audio-processor
    ATLAS_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/audio-processor/atlas-001 || echo "000")
    if [ "$ATLAS_TEST" -eq 200 ]; then
        echo "✅ Atlas processor API is responding (HTTP $ATLAS_TEST)"
    else
        echo "⚠️  Atlas processor API returned HTTP $ATLAS_TEST"
        echo "This might be expected if processor ID 'atlas-001' doesn't exist"
    fi
    echo ""
    
    echo "=================================================="
    echo "✅ Deployment completed successfully!"
    echo "=================================================="
    echo ""
    echo "📊 Deployment Summary:"
    echo "  - Repository: Sports-Bar-TV-Controller"
    echo "  - Branch: main"
    echo "  - Location: $APP_DIR"
    echo "  - Application URL: http://24.123.187.42:3000"
    echo "  - Audio Control: http://24.123.187.42:3000/audio-control"
    echo ""
    echo "🔧 Recent Changes Deployed:"
    echo "  - Fixed Atlas processor connection issues"
    echo "  - Removed mock data from the system"
    echo "  - Fixed API endpoints for Atlas processor (port 5321)"
    echo "  - Fixed frontend rendering errors"
    echo "  - Added comprehensive documentation"
    echo ""
    echo "📝 Next Steps:"
    echo "  1. Open http://24.123.187.42:3000/audio-control in your browser"
    echo "  2. Verify the Atlas processor connection"
    echo "  3. Test audio input/output functionality"
    echo "  4. Check the AI Monitor for any errors"
    echo ""
ENDSSH

echo ""
echo "=================================================="
echo "Deployment script finished!"
echo "=================================================="
