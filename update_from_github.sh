
#!/bin/bash

# =============================================================================
# UPDATE FROM GITHUB (No Yarn Issues)
# =============================================================================
# This script safely updates your local system from GitHub without yarn conflicts
# =============================================================================

set -e

echo "🔄 Updating Sports Bar AI Assistant from GitHub..."

cd /home/ubuntu/Sports-Bar-TV-Controller

# Check git status
echo "📊 Checking git status..."
git status

# Stop running processes
echo "⏹️  Stopping running processes..."
pkill -f "npm.*start" 2>/dev/null || true
pkill -f "next" 2>/dev/null || true
sleep 2

# Pull latest changes
echo "⬇️  Pulling latest changes from GitHub..."
git pull origin main

# Use npm instead of yarn to avoid version conflicts
echo "📦 Installing/updating dependencies with npm..."
npm install

# Update database if schema changed
if [ -f "prisma/schema.prisma" ]; then
    echo "🗄️  Updating database..."
    npx prisma generate
    npx prisma db push
fi

# Build the application
echo "🏗️  Building application..."
npm run build

# Restart the application
echo "🚀 Restarting application..."
npm start > server.log 2>&1 &

sleep 3

# Verify it's working
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Update successful! Application is running on:"
    echo "   🌐 http://localhost:3000"
    echo "   🌐 http://$(hostname -I | awk '{print $1}'):3000"
else
    echo "❌ Update may have issues. Check server.log for details."
fi
