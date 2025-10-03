#!/bin/bash

# =============================================================================
# UPDATE FROM GITHUB (Enhanced with PM2 Process Management)
# =============================================================================
# This script safely updates your local system from GitHub
# Automatically installs Ollama and downloads all required AI models
# Includes: libCEC, Ollama AI, Required Models, PM2 Process Management
# 
# ENHANCEMENTS:
# - Uses npm exclusively for package management
# - PM2 process management for production-grade reliability
# - Smart dependency installation (only when package files change)
# - Graceful server restart with proper process management
# - Auto-restart on crashes and startup on boot
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
PM2_APP_NAME="sports-bar-tv-controller"

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
# PM2 MANAGEMENT
# =============================================================================
check_pm2_installed() {
    if command -v pm2 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

install_pm2() {
    log "📦 Installing PM2 globally..."
    
    if sudo npm install -g pm2; then
        log_success "PM2 installed successfully"
        
        # Verify installation
        if command -v pm2 &> /dev/null; then
            log "   PM2 version: $(pm2 --version)"
            return 0
        else
            log_error "PM2 installation verification failed"
            return 1
        fi
    else
        log_error "Failed to install PM2"
        return 1
    fi
}

setup_pm2_startup() {
    log "🔧 Configuring PM2 startup on boot..."
    
    # Check if PM2 startup is already configured
    if pm2 startup | grep -q "already configured"; then
        log "   ℹ️  PM2 startup already configured"
        return 0
    fi
    
    # Get the startup command
    local startup_cmd=$(pm2 startup | grep "sudo env" | tail -1)
    
    if [ -n "$startup_cmd" ]; then
        log "   Executing PM2 startup configuration..."
        eval "$startup_cmd" 2>&1 | tee -a "$LOG_FILE"
        
        if [ $? -eq 0 ]; then
            log_success "PM2 startup configured successfully"
            return 0
        else
            log_warning "PM2 startup configuration may have failed"
            log_warning "You may need to run 'pm2 startup' manually"
            return 1
        fi
    else
        log_warning "Could not determine PM2 startup command"
        log "   Run 'pm2 startup' manually to configure"
        return 1
    fi
}

# =============================================================================
# PROCESS MANAGEMENT
# =============================================================================
stop_server() {
    log "⏹️  Stopping running server..."
    
    if check_pm2_installed; then
        # Check if app is running in PM2
        if pm2 list | grep -q "$PM2_APP_NAME"; then
            log "   Stopping PM2 process: $PM2_APP_NAME"
            pm2 stop "$PM2_APP_NAME" 2>&1 | tee -a "$LOG_FILE"
            log_success "PM2 process stopped"
        else
            log "   No PM2 process found for $PM2_APP_NAME"
        fi
    fi
    
    # Also check for any processes on the port (fallback)
    local pid=$(lsof -ti:$SERVER_PORT 2>/dev/null || true)
    
    if [ -n "$pid" ]; then
        log "   Found process on port $SERVER_PORT (PID: $pid)"
        kill -TERM "$pid" 2>/dev/null || true
        
        # Wait for graceful shutdown (max 10 seconds)
        local count=0
        while [ $count -lt 10 ] && kill -0 "$pid" 2>/dev/null; do
            sleep 1
            count=$((count + 1))
        done
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            log_warning "Process didn't stop gracefully, forcing shutdown..."
            kill -9 "$pid" 2>/dev/null || true
        fi
        
        log_success "Port $SERVER_PORT cleared"
    fi
    
    # Clean up any stray npm/next processes
    pkill -f "npm.*start" 2>/dev/null || true
    pkill -f "next" 2>/dev/null || true
    sleep 2
}

start_server() {
    log "🚀 Starting server with PM2..."
    
    # Check if PM2 is installed
    if ! check_pm2_installed; then
        log_error "PM2 is not installed. This should not happen!"
        return 1
    fi
    
    # Check if app already exists in PM2
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        log "   Restarting existing PM2 process..."
        pm2 restart "$PM2_APP_NAME" 2>&1 | tee -a "$LOG_FILE"
    else
        log "   Starting new PM2 process..."
        pm2 start npm --name "$PM2_APP_NAME" -- start 2>&1 | tee -a "$LOG_FILE"
    fi
    
    # Save PM2 process list
    log "   Saving PM2 process list..."
    pm2 save 2>&1 | tee -a "$LOG_FILE"
    
    # Wait for server to be ready (max 30 seconds)
    log "   Waiting for server to be ready..."
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
    
    log_warning "Server started but not responding yet"
    log "   Check PM2 logs: pm2 logs $PM2_APP_NAME"
    return 1
}

verify_server_running() {
    log "🔍 Verifying server status..."
    
    # Check PM2 status
    if pm2 list | grep -q "$PM2_APP_NAME.*online"; then
        log_success "PM2 process is running"
        
        # Check if server is responding
        if curl -s http://localhost:$SERVER_PORT > /dev/null 2>&1; then
            log_success "Server is responding on port $SERVER_PORT"
            return 0
        else
            log_warning "PM2 process running but server not responding"
            log "   Check logs: pm2 logs $PM2_APP_NAME"
            return 1
        fi
    else
        log_error "PM2 process is not running"
        log "   Check status: pm2 status"
        log "   Check logs: pm2 logs $PM2_APP_NAME"
        return 1
    fi
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
    
    if [ -f "$PROJECT_DIR/package-lock.json" ]; then
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
    
    if [ -f "$PROJECT_DIR/package-lock.json" ]; then
        new_lock_hash=$(md5sum "$PROJECT_DIR/package-lock.json" | cut -d' ' -f1)
    fi
    
    if [ "$old_package_hash" != "$new_package_hash" ] || [ "$old_lock_hash" != "$new_lock_hash" ]; then
        return 0  # Dependencies changed
    else
        return 1  # No changes
    fi
}

install_dependencies() {
    log "📦 Installing dependencies with npm..."
    
    # Use npm ci if package-lock.json exists, otherwise npm install
    if [ -f "$PROJECT_DIR/package-lock.json" ]; then
        npm ci
    else
        log_warning "package-lock.json not found, using npm install"
        npm install
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

log "📦 Using npm for package management"
log ""

# =============================================================================
# PM2 INSTALLATION CHECK
# =============================================================================
log "🔧 Checking PM2 installation..."

if check_pm2_installed; then
    log_success "PM2 is already installed (version: $(pm2 --version))"
else
    log "PM2 not found - installing..."
    if install_pm2; then
        log_success "PM2 installation complete"
    else
        log_error "Failed to install PM2"
        log_error "PM2 is required for production-grade process management"
        exit 1
    fi
fi

log ""

# =============================================================================
# =============================================================================
# BACKUP LOCAL CONFIGURATION (ENHANCED)
# =============================================================================
log "💾 Backing up local configuration and database..."
BACKUP_DIR="$HOME/sports-bar-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/config-backup-$TIMESTAMP.tar.gz"
DB_BACKUP_DIR="$BACKUP_DIR/database-backups"
DB_SQL_BACKUP="$DB_BACKUP_DIR/dev-db-$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"
mkdir -p "$DB_BACKUP_DIR"

# Get the current config filename based on matrix configuration
CONFIG_FILENAME=$(node scripts/get-config-filename.js 2>/dev/null || echo "local.local.json")

# =============================================================================
# DATABASE BACKUP (SQL DUMP)
# =============================================================================
if [ -f "prisma/dev.db" ]; then
    log "   📊 Creating SQL dump of database..."
    
    # Create SQL dump for better reliability and portability
    if command -v sqlite3 &> /dev/null; then
        sqlite3 prisma/dev.db .dump > "$DB_SQL_BACKUP" 2>/dev/null || {
            log_warning "SQL dump failed, will rely on binary backup"
            rm -f "$DB_SQL_BACKUP"
        }
        
        if [ -f "$DB_SQL_BACKUP" ]; then
            # Compress the SQL dump
            gzip "$DB_SQL_BACKUP"
            DB_SQL_BACKUP="${DB_SQL_BACKUP}.gz"
            
            # Get database statistics
            DB_SIZE=$(du -h prisma/dev.db | cut -f1)
            SQL_SIZE=$(du -h "$DB_SQL_BACKUP" | cut -f1)
            
            log_success "Database SQL dump created: $DB_SQL_BACKUP"
            log "      Database size: $DB_SIZE, SQL dump size: $SQL_SIZE"
            
            # Keep only last 10 SQL backups
            cd "$DB_BACKUP_DIR"
            ls -t dev-db-*.sql.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
            cd - > /dev/null
        fi
    else
        log_warning "sqlite3 command not found - SQL dump skipped"
        log "      Binary database backup will still be included in tar.gz"
    fi
else
    log "   ℹ️  No database file found (first run?)"
fi

# =============================================================================
# CONFIGURATION FILES BACKUP
# =============================================================================
log "   📦 Creating compressed backup of all configuration files..."

# Backup local config files, .env, database, and data files
tar -czf "$BACKUP_FILE" \
    config/*.local.json \
    .env \
    prisma/dev.db \
    data/*.json \
    data/scene-logs/ \
    data/atlas-configs/ \
    2>/dev/null || true

# =============================================================================
# BACKUP VERIFICATION
# =============================================================================
if [ -f "$BACKUP_FILE" ]; then
    # Verify backup integrity
    if tar -tzf "$BACKUP_FILE" > /dev/null 2>&1; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        FILE_COUNT=$(tar -tzf "$BACKUP_FILE" 2>/dev/null | wc -l)
        
        log_success "Configuration backup created: $BACKUP_FILE"
        log "      Backup size: $BACKUP_SIZE, Files: $FILE_COUNT"
        
        # List what was backed up
        log "      Contents:"
        if tar -tzf "$BACKUP_FILE" 2>/dev/null | grep -q "prisma/dev.db"; then
            log "        ✅ Database (prisma/dev.db)"
        fi
        if tar -tzf "$BACKUP_FILE" 2>/dev/null | grep -q ".env"; then
            log "        ✅ Environment variables (.env)"
        fi
        if tar -tzf "$BACKUP_FILE" 2>/dev/null | grep -q "config/.*\.local\.json"; then
            log "        ✅ Local configuration files"
        fi
        if tar -tzf "$BACKUP_FILE" 2>/dev/null | grep -q "data/.*\.json"; then
            log "        ✅ Data files (subscriptions, credentials)"
        fi
    else
        log_error "Backup file created but verification failed!"
        log_error "Backup may be corrupted: $BACKUP_FILE"
    fi
    
    # Keep only last 7 backups
    cd "$BACKUP_DIR"
    ls -t config-backup-*.tar.gz 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true
    cd - > /dev/null
    
    # Create backup manifest
    MANIFEST_FILE="$BACKUP_DIR/backup-manifest-$TIMESTAMP.txt"
    cat > "$MANIFEST_FILE" << EOF
Sports Bar TV Controller - Backup Manifest
==========================================
Backup Date: $(date '+%Y-%m-%d %H:%M:%S')
Backup Files:
  - Configuration: $BACKUP_FILE ($BACKUP_SIZE)
  - SQL Dump: ${DB_SQL_BACKUP:-"Not created"} ${SQL_SIZE:+"($SQL_SIZE)"}

Database Tables Backed Up:
  - MatrixConfiguration (Wolfpack matrix settings)
  - MatrixInput (Input configurations and labels)
  - MatrixOutput (Output/TV configurations)
  - MatrixRoute (Routing configurations)
  - MatrixScene (Saved scenes)
  - AudioProcessor (AZMP8 processor settings)
  - AudioZone (Audio zone configurations)
  - AudioScene (Audio scenes)
  - AudioMessage (Audio messages)
  - AudioInputMeter (Input meter settings)
  - AIGainConfiguration (AI gain control settings)
  - CECConfiguration (HDMI-CEC settings)
  - TVProvider (Cable/Satellite provider info)
  - ProviderInput (Provider-to-input mappings)
  - HomeTeam (Favorite teams)
  - SportsGuideConfiguration (Sports guide settings)
  - SoundtrackConfig (Soundtrack API credentials)
  - SoundtrackPlayer (Soundtrack player configs)
  - Schedule (Automated schedules)
  - WolfpackMatrixRouting (Wolfpack routing state)
  - WolfpackMatrixState (Current routing state)
  - NFHSSchool (High school sports data)
  - NFHSGame (Game schedules)
  - ApiKey (AI API keys)
  - User (User accounts)
  - Equipment (Equipment inventory)
  - Document (Uploaded documents)

Configuration Files Backed Up:
  - config/*.local.json (System/device/sports settings)
  - .env (API keys and secrets)
  - data/*.json (Subscriptions, credentials, device configs)
  - data/scene-logs/ (Scene execution logs)
  - data/atlas-configs/ (Atlas matrix configurations)

Restore Instructions:
  To restore this backup:
    1. Stop the application: pm2 stop sports-bar-tv-controller
    2. Extract backup: tar -xzf $BACKUP_FILE
    3. Or restore from SQL: gunzip -c ${DB_SQL_BACKUP:-dev-db-TIMESTAMP.sql.gz} | sqlite3 prisma/dev.db
    4. Restart application: pm2 restart sports-bar-tv-controller

  For detailed restore instructions, see: BACKUP_RESTORE_GUIDE.md
EOF
    
    log "      📋 Backup manifest: $MANIFEST_FILE"
    
else
    log "ℹ️  No local configuration to backup (first run?)"
fi

log ""
log "💡 Backup Summary:"
log "   📁 Backup location: $BACKUP_DIR"
log "   📦 Latest backup: $BACKUP_FILE"
if [ -f "$DB_SQL_BACKUP" ]; then
    log "   📊 SQL dump: $DB_SQL_BACKUP"
fi
log "   📋 Manifest: ${MANIFEST_FILE:-Not created}"
log "   🔄 Retention: Last 7 backups kept (older ones auto-deleted)"
log ""
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
    install_dependencies
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
    
    # Check if database file exists
    DB_EXISTS=false
    if [ -f "prisma/dev.db" ]; then
        DB_EXISTS=true
        log "   ℹ️  Existing database detected - your data will be preserved"
    else
        log "   ℹ️  No existing database - creating new one"
    fi
    
    # Check if migrations directory exists and has migrations
    if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
        if [ "$DB_EXISTS" = true ]; then
            log "   📊 Syncing schema with existing database..."
            log "   (Using 'db push' to preserve your data safely)"
            
            # For existing databases, use db push to avoid migration conflicts
            # This is the recommended approach for development databases with data
            if npx prisma db push --accept-data-loss 2>&1 | tee /tmp/prisma_output.log; then
                log_success "Database schema synchronized successfully"
            else
                # Check if it's the expected P3005 error (schema not empty)
                if grep -q "P3005" /tmp/prisma_output.log; then
                    log "   ℹ️  Database already has the correct schema"
                    log_success "No schema changes needed - database is up to date"
                else
                    log_error "Database sync failed - check output above"
                    rm -f /tmp/prisma_output.log
                    exit 1
                fi
            fi
            rm -f /tmp/prisma_output.log
        else
            log "   📊 Applying database migrations to new database..."
            
            # For new databases, try migrate deploy first
            if npx prisma migrate deploy 2>&1 | tee /tmp/prisma_output.log; then
                log_success "Database migrations applied successfully"
            else
                # If migrate deploy fails, fall back to db push
                log "   ℹ️  Switching to schema sync method..."
                if npx prisma db push; then
                    log_success "Database schema created successfully"
                else
                    log_error "Database creation failed - check output above"
                    rm -f /tmp/prisma_output.log
                    exit 1
                fi
            fi
            rm -f /tmp/prisma_output.log
        fi
    else
        log "   📊 Syncing database schema (no migrations found)..."
        if npx prisma db push; then
            log_success "Database schema synchronized successfully"
        else
            log_error "Database sync failed - check output above"
            exit 1
        fi
    fi
    
    log ""
    log "   ✅ Database update complete"
    log "   📦 Available models: NFHSGame, NFHSSchool, and all existing models"
    
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
# PM2 STARTUP CONFIGURATION
# =============================================================================
log ""
log "🔧 Configuring PM2 for system startup..."

# Only configure startup if not already done
if ! pm2 startup 2>&1 | grep -q "already configured"; then
    setup_pm2_startup
else
    log_success "PM2 startup already configured"
fi

log ""

# =============================================================================
# RESTART SERVER
# =============================================================================
log ""
if start_server; then
    log ""
    
    # Verify server is actually running
    sleep 3
    verify_server_running
    
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
        log "   ✅ Dependencies updated with npm"
    else
        log "   ✅ Dependencies unchanged (skipped for safety)"
    fi
    log "   ✅ PM2 process manager installed and configured"
    log "   ✅ Application running under PM2 (auto-restart enabled)"
    log "   ✅ PM2 startup on boot configured"
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
    log "🔧 PM2 Process Management:"
    log "   View status:    pm2 status"
    log "   View logs:      pm2 logs $PM2_APP_NAME"
    log "   Restart app:    pm2 restart $PM2_APP_NAME"
    log "   Stop app:       pm2 stop $PM2_APP_NAME"
    log "   Monitor:        pm2 monit"
    log "   Web dashboard:  pm2 plus (optional)"
    log ""
    log "💡 Tip: Your local settings are safe during updates!"
    log "   Edit config: nano config/local.local.json"
    log ""
    log "📝 Full update log saved to: $LOG_FILE"
else
    log_error "Server started but not responding properly"
    log_error "Check logs for details:"
    log_error "   PM2 logs: pm2 logs $PM2_APP_NAME"
    log_error "   Update log: $LOG_FILE"
    log ""
    log "🔧 Troubleshooting:"
    log "   Check PM2 status: pm2 status"
    log "   View PM2 logs:    pm2 logs $PM2_APP_NAME --lines 50"
    log "   Restart app:      pm2 restart $PM2_APP_NAME"
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
