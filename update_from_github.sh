#!/bin/bash

# =============================================================================
# UPDATE FROM GITHUB (Enhanced with Safety Checks)
# =============================================================================
# This script safely updates your local system from GitHub
# Automatically installs Ollama and downloads all required AI models
# Includes: libCEC, Ollama AI, Required Models, and Color Scheme Standardization
# 
# ENHANCEMENTS:
# - Automatic Yarn/npm detection and usage
# - Smart dependency installation (only when package files change)
# - Graceful server restart with proper process management
# - Enhanced error handling and logging
# - Safety checks to prevent breaking the working system
# =============================================================================

set -e  # Exit on error
set -o pipefail  # Catch errors in pipes

# =============================================================================
# CONFIGURATION
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="/home/ubuntu/Sports-Bar-TV-Controller"
LOG_FILE="$PROJECT_DIR/update.log"
SERVER_PORT=3000

# =============================================================================
# LOGGING FUNCTIONS
# =============================================================================
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

log_success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] ✅ $1" | tee -a "$LOG_FILE"
}

log_warning() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] ⚠️  $1" | tee -a "$LOG_FILE"
}

# =============================================================================
# ERROR HANDLING
# =============================================================================
cleanup_on_error() {
    log_error "Update failed! Check $LOG_FILE for details"
    log_error "Your system state has been preserved"
    exit 1
}

trap cleanup_on_error ERR

# =============================================================================
# PACKAGE MANAGER DETECTION
# =============================================================================
detect_package_manager() {
    # Check if yarn command exists and verify it's the JavaScript package manager
    local is_js_yarn=false
    
    if command -v yarn &> /dev/null; then
        # Get yarn version and check if it matches JavaScript yarn format (x.x.x)
        local yarn_version=$(yarn --version 2>/dev/null || echo "")
        
        # JavaScript yarn returns version like "1.22.19" or "3.6.0"
        # Hadoop YARN returns version like "0.32+git" or similar
        if [[ "$yarn_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            is_js_yarn=true
            log "   Detected JavaScript yarn (version: $yarn_version)"
        else
            log_warning "Detected non-JavaScript yarn (version: $yarn_version)"
            log_warning "This appears to be Hadoop YARN, not the JavaScript package manager"
        fi
    fi
    
    # Determine package manager based on lock files and yarn availability
    if [ -f "$PROJECT_DIR/yarn.lock" ]; then
        if [ "$is_js_yarn" = true ]; then
            echo "yarn"
            return 0
        else
            log_warning "yarn.lock found but JavaScript yarn not available"
            log_warning "Attempting to install JavaScript yarn..."
            
            # Try to install yarn globally
            if npm install -g yarn &> /dev/null; then
                # Verify the installation worked
                local new_yarn_version=$(yarn --version 2>/dev/null || echo "")
                if [[ "$new_yarn_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                    log_success "JavaScript yarn installed successfully (version: $new_yarn_version)"
                    echo "yarn"
                    return 0
                fi
            fi
            
            log_warning "Failed to install JavaScript yarn. Falling back to npm"
            echo "npm"
            return 0
        fi
    elif [ -f "$PROJECT_DIR/package-lock.json" ]; then
        echo "npm"
        return 0
    else
        # No lock file found - default to npm for safety
        log_warning "No package lock file found, defaulting to npm"
        echo "npm"
        return 0
    fi
}

# =============================================================================
# PROCESS MANAGEMENT
# =============================================================================
stop_server() {
    log "⏹️  Stopping running server..."
    
    # Find process on port 3000
    local pid=$(lsof -ti:$SERVER_PORT 2>/dev/null || true)
    
    if [ -n "$pid" ]; then
        log "Found server process (PID: $pid) on port $SERVER_PORT"
        kill -TERM "$pid" 2>/dev/null || true
        
        # Wait for graceful shutdown (max 10 seconds)
        local count=0
        while [ $count -lt 10 ] && kill -0 "$pid" 2>/dev/null; do
            sleep 1
            count=$((count + 1))
        done
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            log_warning "Server didn't stop gracefully, forcing shutdown..."
            kill -9 "$pid" 2>/dev/null || true
        fi
        
        log_success "Server stopped successfully"
    else
        log "No server process found on port $SERVER_PORT"
    fi
    
    # Also stop any npm/next processes
    pkill -f "npm.*start" 2>/dev/null || true
    pkill -f "next" 2>/dev/null || true
    sleep 2
}

start_server() {
    log "🚀 Starting server..."
    
    # Start server in background with nohup
    nohup npm start > "$PROJECT_DIR/server.log" 2>&1 &
    local server_pid=$!
    
    log "Server started (PID: $server_pid)"
    
    # Wait for server to be ready (max 30 seconds)
    local count=0
    local max_attempts=30
    
    while [ $count -lt $max_attempts ]; do
        if curl -s http://localhost:$SERVER_PORT > /dev/null 2>&1; then
            log_success "Server is ready and responding"
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done
    
    log_warning "Server started but not responding yet. Check server.log for details"
    return 1
}

# =============================================================================
# DEPENDENCY MANAGEMENT
# =============================================================================
check_dependencies_changed() {
    local package_json_hash=""
    local lock_file_hash=""
    
    # Calculate current hashes
    if [ -f "$PROJECT_DIR/package.json" ]; then
        package_json_hash=$(md5sum "$PROJECT_DIR/package.json" | cut -d' ' -f1)
    fi
    
    if [ -f "$PROJECT_DIR/yarn.lock" ]; then
        lock_file_hash=$(md5sum "$PROJECT_DIR/yarn.lock" | cut -d' ' -f1)
    elif [ -f "$PROJECT_DIR/package-lock.json" ]; then
        lock_file_hash=$(md5sum "$PROJECT_DIR/package-lock.json" | cut -d' ' -f1)
    fi
    
    # Store hashes in temp file
    echo "$package_json_hash" > /tmp/pre_update_package_hash
    echo "$lock_file_hash" > /tmp/pre_update_lock_hash
}

dependencies_need_update() {
    local old_package_hash=$(cat /tmp/pre_update_package_hash 2>/dev/null || echo "")
    local old_lock_hash=$(cat /tmp/pre_update_lock_hash 2>/dev/null || echo "")
    
    local new_package_hash=""
    local new_lock_hash=""
    
    if [ -f "$PROJECT_DIR/package.json" ]; then
        new_package_hash=$(md5sum "$PROJECT_DIR/package.json" | cut -d' ' -f1)
    fi
    
    if [ -f "$PROJECT_DIR/yarn.lock" ]; then
        new_lock_hash=$(md5sum "$PROJECT_DIR/yarn.lock" | cut -d' ' -f1)
    elif [ -f "$PROJECT_DIR/package-lock.json" ]; then
        new_lock_hash=$(md5sum "$PROJECT_DIR/package-lock.json" | cut -d' ' -f1)
    fi
    
    if [ "$old_package_hash" != "$new_package_hash" ] || [ "$old_lock_hash" != "$new_lock_hash" ]; then
        return 0  # Dependencies changed
    else
        return 1  # No changes
    fi
}

install_dependencies() {
    local pkg_manager=$1
    
    log "📦 Installing dependencies with $pkg_manager..."
    
    if [ "$pkg_manager" = "yarn" ]; then
        yarn install --frozen-lockfile
    else
        # Use npm ci if package-lock.json exists, otherwise npm install
        if [ -f "$PROJECT_DIR/package-lock.json" ]; then
            npm ci
        else
            log_warning "package-lock.json not found, using npm install"
            npm install
        fi
    fi
    
    log_success "Dependencies installed successfully"
}

# =============================================================================
# MAIN UPDATE PROCESS
# =============================================================================

log "=========================================="
log "🔄 Starting Sports Bar AI Assistant Update"
log "=========================================="
log ""

# Change to project directory
cd "$PROJECT_DIR" || {
    log_error "Failed to change to project directory: $PROJECT_DIR"
    exit 1
}

# Detect package manager
PKG_MANAGER=$(detect_package_manager)
log "📦 Detected package manager: $PKG_MANAGER"
log ""

# =============================================================================
# BACKUP LOCAL CONFIGURATION
# =============================================================================
log "💾 Backing up local configuration..."
BACKUP_DIR="$HOME/sports-bar-backups"
BACKUP_FILE="$BACKUP_DIR/config-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

mkdir -p "$BACKUP_DIR"

# Get the current config filename based on matrix configuration
CONFIG_FILENAME=$(node scripts/get-config-filename.js 2>/dev/null || echo "local.local.json")

# Backup local config files, .env, and database
tar -czf "$BACKUP_FILE" \
    config/*.local.json \
    .env \
    prisma/dev.db \
    data/*.json \
    data/scene-logs/ \
    data/atlas-configs/ \
    2>/dev/null || true

if [ -f "$BACKUP_FILE" ]; then
    log_success "Configuration backed up to: $BACKUP_FILE"
    
    # Keep only last 7 backups
    cd "$BACKUP_DIR"
    ls -t config-backup-*.tar.gz 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true
    cd - > /dev/null
else
    log "ℹ️  No local configuration to backup (first run?)"
fi

log ""

# =============================================================================
# GIT STATUS CHECK
# =============================================================================
log "📊 Checking git status..."
git status
log ""

# Check for uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    log_warning "You have uncommitted local changes"
    log_warning "These will be preserved, but may cause conflicts"
    log ""
fi

# =============================================================================
# CALCULATE PRE-UPDATE HASHES
# =============================================================================
check_dependencies_changed

# =============================================================================
# STOP SERVER
# =============================================================================
stop_server
log ""

# =============================================================================
# PULL LATEST CHANGES
# =============================================================================
log "⬇️  Pulling latest changes from GitHub..."
log "   Note: Your local files are gitignored and will be preserved:"
log "   - config/*.local.json (system/device/sports settings)"
log "   - .env (API keys and secrets)"
log "   - prisma/dev.db (ALL your configurations and data)"
log "   - data/*.json (subscriptions, credentials, device configs)"
log "   - uploads/ (user uploaded files)"
log ""

# Clean only temporary files (NOT the database or uploads)
git clean -fd .next/ 2>/dev/null || true
git clean -fd node_modules/.cache/ 2>/dev/null || true

# Pull from GitHub (local data is automatically preserved by .gitignore)
if git pull origin main; then
    log_success "Successfully pulled latest changes"
else
    log_error "Failed to pull changes from GitHub"
    log_error "Please resolve any conflicts manually"
    exit 1
fi

log ""

# =============================================================================
# DATA FILES INITIALIZATION
# =============================================================================
log "📁 Initializing data files..."

for template in data/*.template.json; do
    if [ -f "$template" ]; then
        filename=$(basename "$template" .template.json).json
        filepath="data/$filename"
        
        if [ ! -f "$filepath" ]; then
            cp "$template" "$filepath"
            log "   ✅ Created $filename from template"
        fi
    fi
done

log ""

# =============================================================================
# LOCAL CONFIGURATION INITIALIZATION
# =============================================================================
log "🔧 Checking local configuration..."

# Check if local config files exist
if [ ! -f "config/local.local.json" ]; then
    log "📝 Local configuration not found. Initializing from templates..."
    if [ -f "scripts/init-local-config.sh" ]; then
        ./scripts/init-local-config.sh
        
        # Migrate settings from .env to local config
        if [ -f "scripts/migrate-env-to-local-config.sh" ]; then
            log ""
            log "🔄 Migrating existing .env settings to local config..."
            ./scripts/migrate-env-to-local-config.sh
        fi
        
        log ""
        log_success "Local configuration initialized with your existing settings"
        log ""
        log "📝 To customize further, edit:"
        log "   nano config/local.local.json      # System settings"
        log "   nano config/devices.local.json    # Device inventory"
        log "   nano config/sports-teams.local.json   # Sports preferences"
        log ""
    else
        log_warning "init-local-config.sh not found"
        log_warning "You may need to manually create config/*.local.json files"
    fi
else
    log_success "Local configuration files found and preserved"
    
    # Check if migration is needed (old .env but outdated local config)
    if [ -f ".env" ] && [ -f "scripts/migrate-env-to-local-config.sh" ]; then
        # Check if local config still has default IP
        if grep -q '"ip": "192.168.1.100"' config/local.local.json && \
           grep -q '"port": 4999' config/local.local.json && \
           [ -n "$(grep 'WOLFPACK_HOST' .env)" ]; then
            log "   📝 Detected .env settings not yet in local config..."
            log "   🔄 Migrating .env to local config..."
            ./scripts/migrate-env-to-local-config.sh
        fi
    fi
    
    # Check if there are new template options that should be merged
    if [ -f "scripts/init-local-config.sh" ]; then
        log "   Checking for new configuration options..."
        ./scripts/init-local-config.sh 2>&1 | grep -q "Created: 0" && \
            log "   ✅ Configuration is up to date" || \
            log "   ℹ️  New configuration options may have been added"
    fi
fi

log ""

# =============================================================================
# SMART DEPENDENCY INSTALLATION
# =============================================================================
if dependencies_need_update; then
    log "📦 Package files changed - updating dependencies..."
    install_dependencies "$PKG_MANAGER"
else
    log_success "Package files unchanged - skipping dependency installation"
    log "   (This saves time and prevents breaking working dependencies)"
fi

log ""

# =============================================================================
# LIBCEC INSTALLATION CHECK
# =============================================================================
if ! command -v cec-client &> /dev/null; then
    log "📺 Installing HDMI-CEC support (libCEC)..."
    sudo apt update
    sudo apt install -y cec-utils libcec6 libcec-dev
    log_success "libCEC installed successfully"
else
    log_success "libCEC already installed"
fi

log ""

# =============================================================================
# OLLAMA AND AI MODELS INSTALLATION
# =============================================================================
log "🤖 Setting up Local AI (Ollama)..."
log "=================================================="

# Install Ollama if not present
if ! command -v ollama &> /dev/null; then
    log "📥 Ollama not found. Installing..."
    curl -fsSL https://ollama.com/install.sh | sh
    
    if [ $? -eq 0 ]; then
        log_success "Ollama installed successfully"
    else
        log_error "Failed to install Ollama"
        log_error "Please visit https://ollama.com/download for manual installation"
        exit 1
    fi
else
    log_success "Ollama already installed"
fi

# Start Ollama service if not running
if ! pgrep -x "ollama" > /dev/null; then
    log "🔄 Starting Ollama service..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
    log_success "Ollama service started"
else
    log_success "Ollama service is running"
fi

# Define required models for all AI features
REQUIRED_MODELS=(
    "llama3.2"      # Primary model for style analysis and AI features
    "llama2"        # Backup model for device diagnostics
    "mistral"       # Fast model for quick queries
)

log ""
log "📥 Downloading required AI models..."
log "   This may take a few minutes on first run..."

# Pull each required model
for MODEL in "${REQUIRED_MODELS[@]}"; do
    log ""
    log "📦 Checking model: $MODEL"
    
    if ollama list | grep -q "^$MODEL"; then
        log "   ✅ $MODEL already available"
    else
        log "   📥 Downloading $MODEL..."
        if ollama pull "$MODEL"; then
            log "   ✅ $MODEL downloaded successfully"
        else
            log_warning "Could not download $MODEL"
            log_warning "AI features may be limited"
        fi
    fi
done

log ""
log "📋 Installed AI Models:"
ollama list | tee -a "$LOG_FILE"

log ""
log_success "AI setup complete!"

# =============================================================================
# ENVIRONMENT VARIABLES CHECK
# =============================================================================
log ""
log "🔐 Checking environment variables..."

# Check if .env exists
if [ ! -f ".env" ]; then
    log_warning ".env file not found!"
    log "   Creating .env from .env.example..."
    cp .env.example .env
    log_warning "⚠️  IMPORTANT: Edit .env and add your credentials!"
    log ""
fi

# Check for new required environment variables
MISSING_VARS=()

# Check NFHS credentials (new in this update)
if ! grep -q "NFHS_USERNAME=" .env 2>/dev/null || [ -z "$(grep NFHS_USERNAME= .env | cut -d'=' -f2)" ]; then
    MISSING_VARS+=("NFHS_USERNAME")
fi
if ! grep -q "NFHS_PASSWORD=" .env 2>/dev/null || [ -z "$(grep NFHS_PASSWORD= .env | cut -d'=' -f2)" ]; then
    MISSING_VARS+=("NFHS_PASSWORD")
fi
if ! grep -q "NFHS_LOCATION=" .env 2>/dev/null || [ -z "$(grep NFHS_LOCATION= .env | cut -d'=' -f2)" ]; then
    MISSING_VARS+=("NFHS_LOCATION")
fi

# If there are missing variables, add them from .env.example
if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    log_warning "⚠️  New environment variables detected!"
    log ""
    log "   Adding new variables to .env file:"
    
    for VAR in "${MISSING_VARS[@]}"; do
        # Get the line from .env.example
        EXAMPLE_LINE=$(grep "^$VAR=" .env.example 2>/dev/null || echo "$VAR=")
        
        # Check if variable exists in .env (even if empty)
        if ! grep -q "^$VAR=" .env 2>/dev/null; then
            echo "" >> .env
            echo "# Added by update script on $(date)" >> .env
            echo "$EXAMPLE_LINE" >> .env
            log "   ✅ Added: $VAR"
        else
            log "   ℹ️  $VAR exists but is empty"
        fi
    done
    
    log ""
    log_warning "📝 ACTION REQUIRED: Configure NFHS Network credentials"
    log "   Edit your .env file and set:"
    log "   - NFHS_USERNAME: Your NFHS Network username/email"
    log "   - NFHS_PASSWORD: Your NFHS Network password"
    log "   - NFHS_LOCATION: Your location (e.g., 'Green Bay, Wisconsin')"
    log ""
    log "   Run: nano .env"
    log ""
else
    log_success "All required environment variables are configured"
fi

log ""

# =============================================================================
# DATABASE UPDATE
# =============================================================================
if [ -f "prisma/schema.prisma" ]; then
    log "🗄️  Updating database schema..."
    export DATABASE_URL="file:./dev.db"
    
    # Generate Prisma Client
    log "   Generating Prisma Client..."
    npx prisma generate
    
    # Check if migrations directory exists and has migrations
    if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
        log "   Applying database migrations..."
        npx prisma migrate deploy || {
            log_warning "Migration deploy failed, falling back to db push..."
            npx prisma db push
        }
    else
        log "   Syncing database schema..."
        npx prisma db push
    fi
    
    log_success "Database schema updated successfully"
    log "   New models added: NFHSGame, NFHSSchool"
    
    # Rename config file based on matrix configuration name
    log ""
    log "📝 Updating config file naming..."
    node scripts/rename-config-file.js || log_warning "Config rename skipped (will use default name)"
fi

# =============================================================================
# BUILD APPLICATION
# =============================================================================
log ""
log "🏗️  Building application..."
if npm run build; then
    log_success "Application built successfully"
else
    log_error "Build failed! Check the output above for errors"
    exit 1
fi

# =============================================================================
# AI COLOR SCHEME ANALYSIS (OPTIONAL)
# =============================================================================
log ""
log "🎨 Running AI Color Scheme Analysis..."
if command -v ollama &> /dev/null && [ -f "scripts/ai-style-analyzer.js" ]; then
    log "   This will analyze your components for styling consistency..."
    log "   (Running in background, won't block startup)"
    
    # Run analyzer in background with timeout
    timeout 120 node scripts/ai-style-analyzer.js > ai-style-analysis.log 2>&1 &
    ANALYZER_PID=$!
    
    # Don't wait for it to complete
    log "   Analysis started (PID: $ANALYZER_PID)"
    log "   Check ai-style-analysis.log and ai-style-reports/ for results"
else
    log_warning "Skipping style analysis (Ollama or script not available)"
fi

# =============================================================================
# RESTART SERVER
# =============================================================================
log ""
if start_server; then
    log ""
    log "=========================================="
    log_success "Update successful! Application is running"
    log "=========================================="
    log ""
    log "🌐 Access your application at:"
    log "   http://localhost:$SERVER_PORT"
    log "   http://$(hostname -I | awk '{print $1}'):$SERVER_PORT"
    log ""
    log "📋 What was updated:"
    log "   ✅ Application code from GitHub"
    if dependencies_need_update; then
        log "   ✅ Dependencies updated with $PKG_MANAGER"
    else
        log "   ✅ Dependencies unchanged (skipped for safety)"
    fi
    log "   ✅ libCEC support verified"
    log "   ✅ Local AI (Ollama) verified"
    log "   ✅ Database schema updated (data preserved)"
    log "   ✅ AI style analysis running in background"
    log ""
    log "🔧 User Data Preserved:"
    log "   ✅ Database (prisma/dev.db)"
    log "      - Atlas matrix configurations"
    log "      - Device settings (DirecTV, FireTV, Cable boxes)"
    log "      - Input/output mappings and scenes"
    log "      - Audio zones and settings"
    log "      - Sports guide configuration"
    log "      - AI API keys (Claude, ChatGPT, Grok, Local AI)"
    log "      - Soundtrack API credentials"
    log "      - Uploaded layout PDFs"
    log "   ✅ Data files (data/*.json)"
    log "      - Streaming service credentials (NFHS, etc.)"
    log "      - Device subscription configurations"
    log "      - DirecTV/FireTV/IR device configs"
    log "      - Scene logs and Atlas configs"
    log "   ✅ Local configuration (config/*.local.json)"
    log "   ✅ Environment variables (.env)"
    log "   ✅ User uploads (uploads/ directory)"
    log "   💾 Backup saved to: $BACKUP_FILE"
    log "   📁 All backups in: $BACKUP_DIR"
    log ""
    log "🎨 Style Analysis:"
    log "   Check ai-style-reports/ for detailed component analysis"
    log "   Run './scripts/run-style-analysis.sh' for interactive tools"
    log ""
    log "💡 Tip: Your local settings are safe during updates!"
    log "   Edit config: nano config/local.local.json"
    log ""
    log "📝 Full update log saved to: $LOG_FILE"
else
    log_error "Server started but not responding properly"
    log_error "Check server.log and $LOG_FILE for details"
    log ""
    log "🔧 Configuration Status:"
    if [ -f "$BACKUP_FILE" ]; then
        log "   💾 Your configuration was backed up to:"
        log "      $BACKUP_FILE"
        log "   To restore: tar -xzf $BACKUP_FILE"
    fi
    exit 1
fi

# Clean up temporary hash files
rm -f /tmp/pre_update_package_hash /tmp/pre_update_lock_hash

log ""
log "=========================================="
log_success "Update process completed!"
log "=========================================="
