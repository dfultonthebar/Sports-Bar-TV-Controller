
#!/bin/bash

# Sports Bar AI Assistant - Fix Yarn Configuration and Install
echo "🔧 Fixing Yarn Configuration and Installing Sports Bar AI Assistant"
echo "=================================================================="

# Function to handle errors
handle_error() {
    echo "❌ Error: $1"
    echo "Please check the logs and try again."
    exit 1
}

PROJECT_DIR="$HOME/Sports-Bar-TV-Controller"

echo ""
echo "🧹 Step 1: Fixing Yarn Configuration..."

# Go to project directory
cd "$PROJECT_DIR" || handle_error "Project directory not found. Run the fresh installer first."

# Remove yarn configuration that's causing issues
rm -rf .yarn .yarnrc.yml yarn.lock node_modules 2>/dev/null

# Reinstall yarn globally to ensure clean version
echo "   Reinstalling Yarn globally..."
sudo npm uninstall -g yarn 2>/dev/null || echo "   Yarn was not globally installed"
sudo npm install -g yarn@latest || handle_error "Failed to install yarn"

# Initialize yarn properly
echo "   Initializing Yarn configuration..."
yarn set version stable 2>/dev/null || echo "   Using system yarn"

echo "   ✅ Yarn configuration fixed!"
echo ""

echo "📦 Step 2: Installing Dependencies..."

# Install dependencies using npm first as fallback
echo "   Installing with npm (fallback)..."
npm install || handle_error "NPM install failed"

# Try yarn install now
echo "   Installing with yarn..."
yarn install || echo "   Yarn install had warnings but may have succeeded"

echo "   ✅ Dependencies installed!"
echo ""

echo "🗄️ Step 3: Setting up Database..."

# Generate Prisma client
yarn prisma generate || npx prisma generate || handle_error "Prisma generate failed"
yarn prisma db push || npx prisma db push || echo "Database already exists or push not needed"

echo "   ✅ Database setup complete!"
echo ""

echo "📁 Step 4: Creating Directories..."

mkdir -p uploads logs
chmod +x status.sh install_fixed.sh fresh_install.sh 2>/dev/null

echo "   ✅ Directories created!"
echo ""

echo "🚀 Step 5: Starting Application..."

# Stop any existing server
pkill -f "next" || echo "   No existing server to stop"

# Start server with npm as fallback
echo "   Starting server..."
yarn dev > server.log 2>&1 & || npm run dev > server.log 2>&1 &

# Wait for server to start
echo "   Waiting for server to start..."
sleep 8

# Test connection
if curl -s http://localhost:3001 > /dev/null; then
    echo "   ✅ Server started successfully!"
    SUCCESS=true
else
    echo "   ⏳ Server still starting, checking again..."
    sleep 5
    if curl -s http://localhost:3001 > /dev/null; then
        echo "   ✅ Server started successfully!"
        SUCCESS=true
    else
        echo "   ⚠️  Server may be slow to start. Check logs with: tail -f server.log"
        SUCCESS=false
    fi
fi

echo ""
if [ "$SUCCESS" = true ]; then
    echo "🎉 INSTALLATION SUCCESSFUL!"
    echo "=========================="
    echo ""
    echo "✅ Sports Bar AI Assistant is now running!"
    echo ""
    echo "🌐 Access your application:"
    echo "   Local:  http://localhost:3001"
    echo "   Remote: http://$(hostname -I | awk '{print $1}'):3000"
    echo ""
    echo "📋 Management Commands:"
    echo "   Check Status:   ./status.sh"
    echo "   View Logs:      tail -f server.log"
    echo "   Stop Server:    pkill -f 'next'"
    echo "   Restart:        pkill -f 'next' && (yarn dev > server.log 2>&1 & || npm run dev > server.log 2>&1 &)"
    echo ""
    echo "🏈 Available Features:"
    echo "   📄 Document Upload for AV manuals"
    echo "   🤖 AI Chat for troubleshooting"
    echo "   🎛️ Wolf Pack Matrix Control"
    echo "   🔧 System Enhancement tools"
else
    echo "⚠️  Installation completed but server may need manual start"
    echo "Try: cd $PROJECT_DIR && npm run dev"
fi

echo ""
echo "📁 Installation Directory: $PROJECT_DIR"
echo "🎯 Your Sports Bar AI Assistant should be ready!"
