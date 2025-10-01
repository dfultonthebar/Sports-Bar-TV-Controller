
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
# Handle any local database changes that might conflict
git checkout -- prisma/dev.db 2>/dev/null || true
git clean -fd uploads/ 2>/dev/null || true
git pull origin main

# Use npm instead of yarn to avoid version conflicts
echo "📦 Installing/updating dependencies with npm..."
npm install

# Check for and install libCEC if missing
if ! command -v cec-client &> /dev/null; then
    echo "📺 Installing HDMI-CEC support (libCEC)..."
    sudo apt update
    sudo apt install -y cec-utils libcec4 libcec-dev
    echo "✅ libCEC installed successfully"
else
    echo "✅ libCEC already installed"
fi

# Update database if schema changed
if [ -f "prisma/schema.prisma" ]; then
    echo "🗄️  Updating database..."
    export DATABASE_URL="file:./dev.db"
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
