
#!/bin/bash

# =============================================================================
# UPDATE FROM GITHUB (Auto AI Setup)
# =============================================================================
# This script safely updates your local system from GitHub
# Automatically installs Ollama and downloads all required AI models
# Includes: libCEC, Ollama AI, Required Models, and Color Scheme Standardization
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

# =============================================================================
# OLLAMA AND AI MODELS INSTALLATION
# =============================================================================
echo ""
echo "🤖 Setting up Local AI (Ollama)..."
echo "=================================================="

# Install Ollama if not present
if ! command -v ollama &> /dev/null; then
    echo "📥 Ollama not found. Installing..."
    curl -fsSL https://ollama.com/install.sh | sh
    
    if [ $? -eq 0 ]; then
        echo "✅ Ollama installed successfully"
    else
        echo "❌ Failed to install Ollama"
        echo "   Please visit https://ollama.com/download for manual installation"
        exit 1
    fi
else
    echo "✅ Ollama already installed"
fi

# Start Ollama service if not running
if ! pgrep -x "ollama" > /dev/null; then
    echo "🔄 Starting Ollama service..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
    echo "✅ Ollama service started"
else
    echo "✅ Ollama service is running"
fi

# Define required models for all AI features
REQUIRED_MODELS=(
    "llama3.2"      # Primary model for style analysis and AI features
    "llama2"        # Backup model for device diagnostics
    "mistral"       # Fast model for quick queries
)

echo ""
echo "📥 Downloading required AI models..."
echo "   This may take a few minutes on first run..."

# Pull each required model
for MODEL in "${REQUIRED_MODELS[@]}"; do
    echo ""
    echo "📦 Checking model: $MODEL"
    
    if ollama list | grep -q "^$MODEL"; then
        echo "   ✅ $MODEL already available"
    else
        echo "   📥 Downloading $MODEL..."
        if ollama pull "$MODEL"; then
            echo "   ✅ $MODEL downloaded successfully"
        else
            echo "   ⚠️  Warning: Could not download $MODEL"
            echo "      AI features may be limited"
        fi
    fi
done

echo ""
echo "📋 Installed AI Models:"
ollama list

echo ""
echo "✅ AI setup complete!"

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
