#!/bin/bash

# Deploy Fire TV Connection Fix to Remote Server
# This script pulls the latest changes and restarts the application

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deploying Fire TV Connection Fix"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Server details
SERVER="ubuntu@24.123.87.42"
PORT="224"
PASSWORD="6809233DjD\$\$\$"
PROJECT_DIR="~/Sports-Bar-TV-Controller"

echo ""
echo "📥 Step 1: Pulling latest changes from GitHub..."
sshpass -p "$PASSWORD" ssh -p $PORT -o StrictHostKeyChecking=no $SERVER << 'ENDSSH'
cd ~/Sports-Bar-TV-Controller
echo "Current directory: $(pwd)"
echo ""
echo "Git status before pull:"
git status
echo ""
echo "Pulling from main branch..."
git pull origin main
echo ""
echo "Git status after pull:"
git status
ENDSSH

if [ $? -ne 0 ]; then
    echo "❌ Failed to pull changes from GitHub"
    exit 1
fi

echo ""
echo "✅ Successfully pulled changes"
echo ""

echo "📦 Step 2: Installing dependencies (if needed)..."
sshpass -p "$PASSWORD" ssh -p $PORT -o StrictHostKeyChecking=no $SERVER << 'ENDSSH'
cd ~/Sports-Bar-TV-Controller
echo "Checking for new dependencies..."
npm install --legacy-peer-deps
ENDSSH

if [ $? -ne 0 ]; then
    echo "⚠️  Warning: npm install had some issues, but continuing..."
fi

echo ""
echo "🔨 Step 3: Building Next.js application..."
sshpass -p "$PASSWORD" ssh -p $PORT -o StrictHostKeyChecking=no $SERVER << 'ENDSSH'
cd ~/Sports-Bar-TV-Controller
echo "Building application..."
npm run build
ENDSSH

if [ $? -ne 0 ]; then
    echo "❌ Failed to build application"
    exit 1
fi

echo ""
echo "✅ Build completed successfully"
echo ""

echo "🔄 Step 4: Restarting PM2 process..."
sshpass -p "$PASSWORD" ssh -p $PORT -o StrictHostKeyChecking=no $SERVER << 'ENDSSH'
cd ~/Sports-Bar-TV-Controller
echo "Current PM2 status:"
pm2 list
echo ""
echo "Restarting sports-bar-tv..."
pm2 restart sports-bar-tv
echo ""
echo "Waiting for application to stabilize..."
sleep 3
echo ""
echo "New PM2 status:"
pm2 list
echo ""
echo "Recent logs:"
pm2 logs sports-bar-tv --lines 20 --nostream
ENDSSH

if [ $? -ne 0 ]; then
    echo "❌ Failed to restart PM2 process"
    exit 1
fi

echo ""
echo "✅ PM2 process restarted successfully"
echo ""

echo "🔍 Step 5: Verifying deployment..."
sshpass -p "$PASSWORD" ssh -p $PORT -o StrictHostKeyChecking=no $SERVER << 'ENDSSH'
cd ~/Sports-Bar-TV-Controller
echo "Checking application status..."
curl -s http://localhost:3000 > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Application is responding on port 3000"
else
    echo "⚠️  Application may not be responding yet (this is sometimes normal during startup)"
fi
echo ""
echo "Checking Fire TV device data..."
if [ -f "data/firetv-devices.json" ]; then
    echo "✅ Fire TV devices file exists"
    cat data/firetv-devices.json | head -20
else
    echo "⚠️  Fire TV devices file not found"
fi
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Summary of Changes:"
echo "  ✓ Fire TV ADB connections now use persistent keep-alive (30s interval)"
echo "  ✓ Connection pooling implemented to reuse connections"
echo "  ✓ Removed all Prisma dependencies"
echo "  ✓ Enhanced error handling and logging"
echo "  ✓ Automatic reconnection on connection loss"
echo "  ✓ Stay awake functionality for preventing screen timeout"
echo ""
echo "🧪 Next Steps:"
echo "  1. Test connection to Fire TV devices in the web interface"
echo "  2. Monitor PM2 logs: pm2 logs sports-bar-tv"
echo "  3. Check for 'FIRE CUBE' and 'ADB CLIENT' log messages"
echo "  4. Verify devices stay connected over time"
echo ""
