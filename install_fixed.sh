
#!/bin/bash

# DEPRECATED — kept for backwards compatibility only.
# The canonical virgin-install entry points are:
#   - Curl one-liner: install.sh (root of repo)
#   - Bare-metal USB: scripts/iso/build-sports-bar-iso.sh (build) → boot ISO
# See docs/NEW_LOCATION_SETUP.md and docs/BARE_METAL_ISO.md.

echo "⚠️  WARNING: This script is DEPRECATED. Use install.sh or the ISO instead. See docs/NEW_LOCATION_SETUP.md" >&2

# Sports Bar AI Assistant - Fixed Installation Script
echo "🏈 Installing Sports Bar AI Assistant (Fixed Version)"
echo "===================================================="

# Function to handle errors
handle_error() {
    echo "❌ Error: $1"
    echo "Please check the logs and try again."
    exit 1
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from the Sports-Bar-TV-Controller directory"
    echo "Please run: cd /path/to/Sports-Bar-TV-Controller && ./install_fixed.sh"
    exit 1
fi

# Stop any existing server
echo "🛑 Stopping any existing server..."
pkill -f "next" || echo "No existing server to stop"

# Install system dependencies (if needed)
echo "📦 Checking system dependencies..."
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs || handle_error "Failed to install Node.js"
fi

if ! command -v yarn &> /dev/null; then
    echo "Installing Yarn..."
    sudo npm install -g yarn || handle_error "Failed to install Yarn"
fi

# Install project dependencies
echo "📦 Installing project dependencies..."
yarn install || handle_error "Yarn install failed"

# Generate Prisma client
echo "🗄️ Setting up database..."
yarn prisma generate || handle_error "Prisma generate failed"
yarn prisma db push || echo "Database already exists or push not needed"

# Create uploads directory
mkdir -p uploads
mkdir -p logs

# Start the server
echo "🚀 Starting Sports Bar AI Assistant..."
yarn dev > server.log 2>&1 &

# Wait for server to start
sleep 5

# Test connection
if curl -s http://localhost:3001 > /dev/null; then
    echo "✅ SUCCESS! Sports Bar AI Assistant is running!"
    echo ""
    echo "🎯 Access your application at: http://localhost:3001"
    echo ""
    echo "📋 Management Commands:"
    echo "   Check Status:   ./status.sh"
    echo "   View Logs:      tail -f server.log"
    echo "   Stop Server:    pkill -f 'next'"
    echo "   Restart:        pkill -f 'next' && yarn dev > server.log 2>&1 &"
    echo ""
    echo "🏈 Features Available:"
    echo "   - Document Upload for AV manuals"
    echo "   - AI Chat for troubleshooting"  
    echo "   - Wolf Pack Matrix Control"
    echo "   - System Enhancement tools"
    echo ""
else
    echo "❌ Server may not have started properly"
    echo "Check server.log for details: tail server.log"
    exit 1
fi
