
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

# =============================================================================
# BACKUP LOCAL CONFIGURATION
# =============================================================================
echo "💾 Backing up local configuration..."
BACKUP_DIR="$HOME/sports-bar-backups"
BACKUP_FILE="$BACKUP_DIR/config-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

mkdir -p "$BACKUP_DIR"

# Backup local config files, .env, and database
tar -czf "$BACKUP_FILE" \
    config/*.local.json \
    .env \
    prisma/dev.db \
    2>/dev/null || true

if [ -f "$BACKUP_FILE" ]; then
    echo "✅ Configuration backed up to: $BACKUP_FILE"
    
    # Keep only last 7 backups
    cd "$BACKUP_DIR"
    ls -t config-backup-*.tar.gz 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true
    cd - > /dev/null
else
    echo "ℹ️  No local configuration to backup (first run?)"
fi

# Check git status
echo ""
echo "📊 Checking git status..."
git status

# Stop running processes
echo ""
echo "⏹️  Stopping running processes..."
pkill -f "npm.*start" 2>/dev/null || true
pkill -f "next" 2>/dev/null || true
sleep 2

# Pull latest changes
echo ""
echo "⬇️  Pulling latest changes from GitHub..."
echo "   Note: Your local files are gitignored and will be preserved:"
echo "   - config/*.local.json (system/device/sports settings)"
echo "   - .env (API keys and secrets)"
echo "   - prisma/dev.db (ALL your configurations and data)"
echo "   - uploads/ (user uploaded files)"

# Clean only temporary files (NOT the database or uploads)
git clean -fd .next/ 2>/dev/null || true
git clean -fd node_modules/.cache/ 2>/dev/null || true

# Pull from GitHub (local data is automatically preserved by .gitignore)
git pull origin main

# =============================================================================
# LOCAL CONFIGURATION INITIALIZATION
# =============================================================================
echo ""
echo "🔧 Checking local configuration..."

# Check if local config files exist
if [ ! -f "config/local.local.json" ]; then
    echo "📝 Local configuration not found. Initializing from templates..."
    if [ -f "scripts/init-local-config.sh" ]; then
        ./scripts/init-local-config.sh
        
        # Migrate settings from .env to local config
        if [ -f "scripts/migrate-env-to-local-config.sh" ]; then
            echo ""
            echo "🔄 Migrating existing .env settings to local config..."
            ./scripts/migrate-env-to-local-config.sh
        fi
        
        echo ""
        echo "✅ Local configuration initialized with your existing settings"
        echo ""
        echo "📝 To customize further, edit:"
        echo "   nano config/local.local.json      # System settings"
        echo "   nano config/devices.local.json    # Device inventory"
        echo "   nano config/sports-teams.local.json   # Sports preferences"
        echo ""
    else
        echo "⚠️  Warning: init-local-config.sh not found"
        echo "   You may need to manually create config/*.local.json files"
    fi
else
    echo "✅ Local configuration files found and preserved"
    
    # Check if migration is needed (old .env but outdated local config)
    if [ -f ".env" ] && [ -f "scripts/migrate-env-to-local-config.sh" ]; then
        # Check if local config still has default IP
        if grep -q '"ip": "192.168.1.100"' config/local.local.json && \
           grep -q '"port": 4999' config/local.local.json && \
           [ -n "$(grep 'WOLFPACK_HOST' .env)" ]; then
            echo "   📝 Detected .env settings not yet in local config..."
            echo "   🔄 Migrating .env to local config..."
            ./scripts/migrate-env-to-local-config.sh
        fi
    fi
    
    # Check if there are new template options that should be merged
    if [ -f "scripts/init-local-config.sh" ]; then
        echo "   Checking for new configuration options..."
        ./scripts/init-local-config.sh 2>&1 | grep -q "Created: 0" && \
            echo "   ✅ Configuration is up to date" || \
            echo "   ℹ️  New configuration options may have been added"
    fi
fi

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
    echo "   ✅ Database schema updated (data preserved)"
    echo "   ✅ AI style analysis running in background"
    echo ""
    echo "🔧 User Data Preserved:"
    echo "   ✅ Database (prisma/dev.db)"
    echo "      - Atlas matrix configurations"
    echo "      - Device settings (DirecTV, FireTV, Cable boxes)"
    echo "      - Input/output mappings and scenes"
    echo "      - Audio zones and settings"
    echo "      - Sports guide configuration"
    echo "      - Uploaded layout PDFs"
    echo "   ✅ Local configuration (config/*.local.json)"
    echo "   ✅ Environment variables (.env)"
    echo "   ✅ User uploads (uploads/ directory)"
    echo "   💾 Backup saved to: $BACKUP_FILE"
    echo "   📁 All backups in: $BACKUP_DIR"
    echo ""
    echo "🎨 Style Analysis:"
    echo "   Check ai-style-reports/ for detailed component analysis"
    echo "   Run './scripts/run-style-analysis.sh' for interactive tools"
    echo ""
    echo "💡 Tip: Your local settings are safe during updates!"
    echo "   Edit config: nano config/local.local.json"
else
    echo "❌ Update may have issues. Check server.log for details."
    echo ""
    echo "🔧 Configuration Status:"
    if [ -f "$BACKUP_FILE" ]; then
        echo "   💾 Your configuration was backed up to:"
        echo "      $BACKUP_FILE"
        echo "   To restore: tar -xzf $BACKUP_FILE"
    fi
fi
