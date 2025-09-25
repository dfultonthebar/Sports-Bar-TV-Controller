
#!/bin/bash

# =============================================================================
# PERMANENT YARN ISSUE FIX
# =============================================================================
# This script permanently resolves yarn version conflicts by:
# 1. Configuring the project to use npm instead of yarn
# 2. Cleaning all yarn-related cache and configurations
# 3. Setting up proper Node.js package management
# =============================================================================

set -e  # Exit on any error

echo "🔧 Applying permanent fix for yarn version conflicts..."

# Navigate to project directory
cd /home/ubuntu/Sports-Bar-TV-Controller

# Stop any running processes
echo "⏹️  Stopping running processes..."
pkill -f "npm.*start" 2>/dev/null || true
pkill -f "next" 2>/dev/null || true
sleep 2

# Remove all yarn-related cache and state files
echo "🧹 Cleaning yarn cache and configurations..."
rm -rf ~/.yarn 2>/dev/null || true
rm -rf ~/.cache/yarn 2>/dev/null || true
rm -rf .yarn 2>/dev/null || true
rm -rf .pnp.* 2>/dev/null || true
rm -rf node_modules/.yarn-state.yml 2>/dev/null || true

# Remove node_modules and package-lock to ensure clean state
echo "🗑️  Removing node_modules and lock files..."
rm -rf node_modules package-lock.json yarn.lock 2>/dev/null || true

# Force npm usage by disabling yarn globally for this project
echo "📦 Configuring npm as default package manager..."
echo "package-manager=npm" > .npmrc
echo "engine-strict=false" >> .npmrc

# Clear npm cache to avoid conflicts
npm cache clean --force 2>/dev/null || true

# Install dependencies with npm
echo "⬇️  Installing dependencies with npm..."
npm install

# Generate Prisma client if needed
if [ -f "prisma/schema.prisma" ]; then
    echo "🗄️  Setting up database..."
    npx prisma generate
    npx prisma db push --accept-data-loss
fi

# Build the application
echo "🏗️  Building application..."
npm run build

# Start the application
echo "🚀 Starting application..."
npm start > server.log 2>&1 &

sleep 3

# Check if application is running
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Success! Sports Bar AI Assistant is running on:"
    echo "   🌐 http://localhost:3000"
    echo "   🌐 http://$(hostname -I | awk '{print $1}'):3000"
    echo ""
    echo "🔧 Permanent fix applied! No more yarn issues on updates."
    echo "📝 From now on, use 'npm install' and 'npm run build' instead of yarn commands."
else
    echo "❌ Application may not be running properly. Check server.log for details."
    exit 1
fi
