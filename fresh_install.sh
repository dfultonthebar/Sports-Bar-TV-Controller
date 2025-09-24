
#!/bin/bash

# Sports Bar AI Assistant - Complete Fresh Installation Script
echo "🏈 Sports Bar AI Assistant - Fresh Installation"
echo "=============================================="
echo "This will completely remove existing installation and reinstall from GitHub"
echo ""

# Function to handle errors
handle_error() {
    echo "❌ Error: $1"
    echo "Please check the logs and try again."
    exit 1
}

# Confirm with user
read -p "⚠️  This will DELETE existing installation. Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled."
    exit 0
fi

PROJECT_NAME="Sports-Bar-TV-Controller"
INSTALL_DIR="$HOME/$PROJECT_NAME"
GITHUB_URL="https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git"

echo ""
echo "🧹 Step 1: Cleaning up existing installation..."

# Stop any running servers
echo "   Stopping any running servers..."
pkill -f "next" || echo "   No servers to stop"
pkill -f "node.*$PROJECT_NAME" || echo "   No Node.js processes to stop"

# Remove existing directory if it exists
if [ -d "$INSTALL_DIR" ]; then
    echo "   Removing existing directory: $INSTALL_DIR"
    rm -rf "$INSTALL_DIR" || handle_error "Failed to remove existing directory"
else
    echo "   No existing installation found"
fi

# Clean up any PM2 processes (if they exist)
if command -v pm2 &> /dev/null; then
    echo "   Cleaning PM2 processes..."
    pm2 delete sports-bar-ai-assistant 2>/dev/null || echo "   No PM2 processes to clean"
    pm2 kill 2>/dev/null || echo "   PM2 already stopped"
fi

echo "   ✅ Cleanup complete!"
echo ""

echo "📦 Step 2: Installing system dependencies..."

# Update package list
sudo apt-get update -qq

# Install curl and git if not present
sudo apt-get install -y curl git || handle_error "Failed to install basic dependencies"

# Install Node.js 18.x (if not present or wrong version)
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 16 ]]; then
    echo "   Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - || handle_error "Failed to add Node.js repository"
    sudo apt-get install -y nodejs || handle_error "Failed to install Node.js"
else
    echo "   ✅ Node.js already installed: $(node -v)"
fi

# Install Yarn (if not present)
if ! command -v yarn &> /dev/null; then
    echo "   Installing Yarn..."
    sudo npm install -g yarn || handle_error "Failed to install Yarn"
else
    echo "   ✅ Yarn already installed: $(yarn -v)"
fi

echo "   ✅ System dependencies ready!"
echo ""

echo "📥 Step 3: Downloading from GitHub..."

# Clone the repository
cd "$HOME" || handle_error "Failed to change to home directory"
git clone "$GITHUB_URL" || handle_error "Failed to clone repository from GitHub"

echo "   ✅ Downloaded successfully!"
echo ""

echo "🔧 Step 4: Installing project..."

# Change to project directory
cd "$INSTALL_DIR" || handle_error "Failed to change to project directory"

# Install dependencies
echo "   Installing dependencies..."
yarn install || handle_error "Yarn install failed"

# Setup database
echo "   Setting up database..."
yarn prisma generate || handle_error "Prisma generate failed"
yarn prisma db push || echo "   Database already exists or push not needed"

# Create necessary directories
mkdir -p uploads logs

# Set proper permissions
chmod +x status.sh 2>/dev/null || echo "   status.sh not found (will be created)"
chmod +x install_fixed.sh 2>/dev/null || echo "   install_fixed.sh not found"

echo "   ✅ Project installation complete!"
echo ""

echo "🚀 Step 5: Starting application..."

# Start the server
yarn dev > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "   Waiting for server to start..."
sleep 8

# Test connection
if curl -s http://localhost:3000 > /dev/null; then
    echo "   ✅ Server started successfully!"
else
    echo "   ⏳ Server still starting, checking again..."
    sleep 5
    if curl -s http://localhost:3000 > /dev/null; then
        echo "   ✅ Server started successfully!"
    else
        echo "   ⚠️  Server may be slow to start. Check logs with: tail -f server.log"
    fi
fi

echo ""
echo "🎉 FRESH INSTALLATION COMPLETE!"
echo "================================"
echo ""
echo "✅ Sports Bar AI Assistant is now running!"
echo ""
echo "🌐 Access your application:"
echo "   Local:  http://localhost:3000"
echo "   Remote: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "📋 Management Commands:"
echo "   Check Status:   cd $INSTALL_DIR && ./status.sh"
echo "   View Logs:      cd $INSTALL_DIR && tail -f server.log"
echo "   Stop Server:    pkill -f 'next'"
echo "   Restart:        cd $INSTALL_DIR && pkill -f 'next' && yarn dev > server.log 2>&1 &"
echo ""
echo "🏈 Available Features:"
echo "   📄 Document Upload for AV manuals"
echo "   🤖 AI Chat for troubleshooting"
echo "   🎛️ Wolf Pack Matrix Control"
echo "   🔧 System Enhancement tools"
echo ""
echo "📁 Installation Directory: $INSTALL_DIR"
echo ""
echo "🎯 Your Sports Bar AI Assistant is ready to use!"
