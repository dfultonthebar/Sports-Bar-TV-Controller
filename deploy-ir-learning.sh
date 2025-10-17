#!/bin/bash

# Deployment script for IR Learning feature
# Run this on the production server: 24.123.87.42

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deploying IR Learning Feature"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Navigate to project directory
cd /home/ubuntu/Sports-Bar-TV-Controller || exit 1

echo "📥 Pulling latest changes from GitHub..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Git pull failed!"
    exit 1
fi

echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed!"
    exit 1
fi

echo ""
echo "🔨 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "🔄 Restarting PM2 application..."
pm2 restart sports-bar-tv

if [ $? -ne 0 ]; then
    echo "❌ PM2 restart failed!"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Successful!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show application status
echo "📊 Application Status:"
pm2 status sports-bar-tv

echo ""
echo "🌐 Application URL: http://24.123.87.42:3000"
echo "📋 View Logs: pm2 logs sports-bar-tv"
echo ""

# Show recent logs
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Recent Application Logs (last 20 lines):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 logs sports-bar-tv --lines 20 --nostream

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 IR Learning Feature Deployed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To test the feature:"
echo "1. Navigate to http://24.123.87.42:3000/device-config"
echo "2. Click the 'Global Cache' tab"
echo "3. Click the 'IR Learning' tab"
echo "4. Select a Global Cache device"
echo "5. Click 'Start Learning'"
echo "6. Point your remote at the device and press a button"
echo ""
echo "To view IR learning logs:"
echo "pm2 logs sports-bar-tv | grep 'GLOBAL CACHE'"
echo ""
