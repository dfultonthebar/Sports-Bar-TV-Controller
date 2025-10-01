
#!/bin/bash

# =============================================================================
# UPDATE FROM GITHUB (No Yarn Issues)
# =============================================================================
# This script safely updates your local system from GitHub without yarn conflicts
# Includes: libCEC, Ollama AI, and Color Scheme Standardization
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
    sudo apt install -y cec-utils libcec6 libcec-dev
    echo "✅ libCEC installed successfully"
else
    echo "✅ libCEC already installed"
fi

# Check for and install Ollama (Local AI) if missing
echo ""
echo "🤖 Checking Local AI (Ollama) installation..."
if ! command -v ollama &> /dev/null; then
    echo "🔽 Ollama not found. Installing Local AI..."
    
    # Check if install script exists
    if [ -f "install-local-ai.sh" ]; then
        echo "   Using install-local-ai.sh script..."
        chmod +x install-local-ai.sh
        ./install-local-ai.sh
    else
        echo "   Downloading and installing Ollama..."
        curl -fsSL https://ollama.ai/install.sh | sh
        
        # Wait for Ollama to start
        sleep 2
        
        # Pull recommended models
        echo "   Pulling recommended AI models..."
        ollama pull llama3.2:3b 2>/dev/null || echo "   ⚠️  Could not pull llama3.2:3b"
        ollama pull llama3.2 2>/dev/null || echo "   ⚠️  Could not pull llama3.2"
    fi
    
    echo "✅ Local AI (Ollama) installed successfully"
else
    echo "✅ Local AI (Ollama) already installed"
    
    # Check if service is running
    if ! pgrep -x ollama > /dev/null; then
        echo "   Starting Ollama service..."
        ollama serve > /dev/null 2>&1 &
        sleep 2
    fi
    
    # Ensure we have at least one model
    if ! ollama list | grep -q "llama3.2"; then
        echo "   Pulling llama3.2 model for AI features..."
        ollama pull llama3.2:3b 2>/dev/null || ollama pull llama3.2 2>/dev/null || echo "   ⚠️  Could not pull model"
    fi
fi

# Update database if schema changed
if [ -f "prisma/schema.prisma" ]; then
    echo ""
    echo "🗄️  Updating database..."
    export DATABASE_URL="file:./dev.db"
    npx prisma generate
    npx prisma db push
fi

# Build the application
echo ""
echo "🏗️  Building application..."
npm run build

# Run AI Color Scheme Analysis (optional, non-blocking)
echo ""
echo "🎨 Running AI Color Scheme Analysis..."
if command -v ollama &> /dev/null && [ -f "scripts/ai-style-analyzer.js" ]; then
    echo "   This will analyze your components for styling consistency..."
    echo "   (Running in background, won't block startup)"
    
    # Run analyzer in background with timeout
    timeout 120 node scripts/ai-style-analyzer.js > ai-style-analysis.log 2>&1 &
    ANALYZER_PID=$!
    
    # Don't wait for it to complete
    echo "   Analysis started (PID: $ANALYZER_PID)"
    echo "   Check ai-style-analysis.log and ai-style-reports/ for results"
else
    echo "   ⚠️  Skipping style analysis (Ollama or script not available)"
fi

# Restart the application
echo ""
echo "🚀 Restarting application..."
npm start > server.log 2>&1 &

sleep 3

# Verify it's working
echo ""
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Update successful! Application is running on:"
    echo "   🌐 http://localhost:3000"
    echo "   🌐 http://$(hostname -I | awk '{print $1}'):3000"
    echo ""
    echo "📋 What was updated:"
    echo "   ✅ Application code from GitHub"
    echo "   ✅ Dependencies installed"
    echo "   ✅ libCEC support verified"
    echo "   ✅ Local AI (Ollama) verified"
    echo "   ✅ Database updated"
    echo "   ✅ AI style analysis running in background"
    echo ""
    echo "🎨 Style Analysis:"
    echo "   Check ai-style-reports/ for detailed component analysis"
    echo "   Run './scripts/run-style-analysis.sh' for interactive tools"
else
    echo "❌ Update may have issues. Check server.log for details."
fi
