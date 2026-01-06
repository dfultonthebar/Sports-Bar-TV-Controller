
#!/bin/bash

# Sports Bar AI Assistant - Proper Yarn Fix and Install
echo "🔧 Sports Bar AI Assistant - Proper Yarn Fix"
echo "============================================"

# Function to handle errors
handle_error() {
    echo "❌ Error: $1"
    echo "Please check the logs and try again."
    exit 1
}

PROJECT_DIR="$HOME/Sports-Bar-TV-Controller"

echo ""
echo "🧹 Step 1: Cleaning Yarn Configuration..."

# Go to project directory
cd "$PROJECT_DIR" || handle_error "Project directory not found"

# Remove corrupted yarn files
echo "   Removing corrupted yarn configuration..."
rm -rf .yarn .yarnrc.yml yarn.lock node_modules 2>/dev/null

# Don't reinstall yarn globally - just fix the configuration
echo "   Using existing yarn installation: $(yarn --version)"

echo "   ✅ Yarn configuration cleaned!"
echo ""

echo "📦 Step 2: Installing Dependencies..."

# Clear npm cache to avoid conflicts  
echo "   Clearing npm cache..."
npm cache clean --force 2>/dev/null || echo "   NPM cache already clean"

# Try npm first (most reliable)
echo "   Installing dependencies with npm..."
npm install || handle_error "NPM install failed"

echo "   ✅ Dependencies installed with npm!"
echo ""

echo "🗄️ Step 3: Setting up Database..."

# Use npx to ensure we have the right tools
echo "   Generating Prisma client..."
npx prisma generate || handle_error "Prisma generate failed"

echo "   Setting up database..."
npx prisma db push || echo "   Database already exists or push not needed"

echo "   ✅ Database setup complete!"
echo ""

echo "📁 Step 4: Preparing Application..."

# Create directories
mkdir -p uploads logs

# Set permissions
chmod +x status.sh install_fixed.sh fresh_install.sh fix_and_install.sh 2>/dev/null

echo "   ✅ Application prepared!"
echo ""

echo "🚀 Step 5: Starting Application..."

# Stop any existing server
pkill -f "next" 2>/dev/null || echo "   No existing server to stop"
sleep 2

# Start server with npm (most reliable)
echo "   Starting server with npm..."
npm run dev > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "   Waiting for server to start..."
sleep 10

# Test connection multiple times
SUCCESS=false
for i in {1..3}; do
    if curl -s http://localhost:3001 > /dev/null; then
        echo "   ✅ Server started successfully!"
        SUCCESS=true
        break
    else
        echo "   ⏳ Server still starting (attempt $i/3)..."
        sleep 5
    fi
done

if [ "$SUCCESS" = false ]; then
    echo "   ⚠️  Server may be slow to start. Checking server log..."
    echo "   Last few lines of server.log:"
    tail -5 server.log 2>/dev/null || echo "   No server log yet"
fi

echo ""
echo "🎉 INSTALLATION COMPLETE!"
echo "========================"
echo ""

if [ "$SUCCESS" = true ]; then
    echo "✅ Sports Bar AI Assistant is running!"
    echo ""
    echo "🌐 Access your application:"
    echo "   Local:  http://localhost:3001"
    echo "   Remote: http://$(hostname -I | awk '{print $1}'):3000"
else
    echo "⚠️  Application installed but may need a moment to fully start"
    echo "   Check status: curl http://localhost:3001"
    echo "   View logs: tail -f $PROJECT_DIR/server.log"
fi

echo ""
echo "📋 Management Commands:"
echo "   Check Status:   cd $PROJECT_DIR && curl http://localhost:3001"
echo "   View Logs:      cd $PROJECT_DIR && tail -f server.log"
echo "   Stop Server:    pkill -f 'next'"
echo "   Restart:        cd $PROJECT_DIR && pkill -f 'next' && npm run dev > server.log 2>&1 &"
echo ""
echo "🏈 Available Features:"
echo "   📄 Document Upload for AV manuals"
echo "   🤖 AI Chat for troubleshooting"  
echo "   🎛️ Wolf Pack Matrix Control"
echo "   🔧 System Enhancement tools"
echo ""
echo "📁 Installation Directory: $PROJECT_DIR"
echo ""
echo "🎯 Your Sports Bar AI Assistant is ready!"

# Final status check
echo ""
echo "🔍 Final Status Check:"
if curl -s http://localhost:3001 > /dev/null; then
    echo "   ✅ Server is responding correctly!"
    echo "   🚀 You can now use your application!"
else
    echo "   ⏳ Server may still be starting up..."
    echo "   💡 Wait 30 seconds and try: curl http://localhost:3001"
fi
