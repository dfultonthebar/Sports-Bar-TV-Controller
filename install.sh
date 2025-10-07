#!/bin/bash

#############################################################################
# Sports Bar TV Controller - Comprehensive One-Line Installation Script
# Version: 2.0 - Updated with all recent fixes and improvements
# 
# This script automates the complete installation of the Sports Bar TV 
# Controller application on a fresh Ubuntu/Debian system with all the
# latest AI features, optimizations, and bug fixes.
#
# Recent Updates:
# - Node.js v22 (upgraded from v18)
# - AI tools integration (file system + code execution)
# - Q&A generation optimizations (180s timeout, parallel processing)
# - Chatbot streaming support
# - Enhanced security controls
# - Knowledge base building (critical for AI features)
# - phi3:mini model installation (faster AI responses)
# - All bug fixes from PRs #122, #123, and optim/ai-perf-security
#
# Usage: 
#   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
#   or
#   wget -qO- https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
#
# For custom installation directory:
#   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | INSTALL_DIR=/custom/path bash
#
# Examples:
#   # Install to home directory (default)
#   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
#
#   # Install to custom location
#   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | INSTALL_DIR=/opt/sportsbar bash
#
#   # Skip Ollama installation (if already installed)
#   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | SKIP_OLLAMA=true bash
#
#############################################################################

set -euo pipefail  # Exit on error, undefined variables, and pipe failures

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Installation configuration
INSTALL_DIR="${INSTALL_DIR:-$HOME/Sports-Bar-TV-Controller}"
SERVICE_NAME="sportsbar-assistant"
REPO_URL="https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git"
REPO_BRANCH="${REPO_BRANCH:-main}"
LOG_FILE="/tmp/sportsbar-install-$(date +%Y%m%d-%H%M%S).log"

# Node.js version - UPDATED TO v22
NODE_VERSION="22"

# Ollama configuration
SKIP_OLLAMA="${SKIP_OLLAMA:-false}"
OLLAMA_MODELS=("llama3.2:latest" "llama2:latest" "mistral:latest" "phi3:mini")

# Installation state tracking
INSTALLATION_STATE_FILE="/tmp/sportsbar-install-state-$(date +%Y%m%d-%H%M%S).json"

# Determine if we need a service user (only for system-wide installations)
if [[ "$INSTALL_DIR" == /opt/* ]] || [[ "$INSTALL_DIR" == /usr/* ]]; then
    USE_SERVICE_USER=true
    SERVICE_USER="${SERVICE_USER:-sportsbar}"
else
    USE_SERVICE_USER=false
    SERVICE_USER="${USER:-$(whoami)}"
fi

#############################################################################
# Helper Functions
#############################################################################

print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║ $(printf '%-62s' "$1")║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

print_progress() {
    echo -e "${MAGENTA}▶ $1${NC}"
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log_and_print() {
    echo "$1"
    log "$1"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

prompt_yes_no() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi
    
    read -p "$prompt" response
    response=${response:-$default}
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

save_installation_state() {
    local step="$1"
    local status="$2"
    local message="${3:-}"
    
    cat > "$INSTALLATION_STATE_FILE" <<EOF
{
  "step": "$step",
  "status": "$status",
  "message": "$message",
  "timestamp": "$(date -Iseconds)",
  "install_dir": "$INSTALL_DIR",
  "node_version": "$NODE_VERSION"
}
EOF
    log "Installation state saved: $step - $status"
}

check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root. This is acceptable but not required."
        if [ "$USE_SERVICE_USER" = true ]; then
            print_info "The script will create a dedicated service user for system-wide installation."
        fi
        IS_ROOT=true
    else
        print_info "Running as non-root user: ${USER:-$(whoami)}"
        IS_ROOT=false
        
        if ! check_command sudo; then
            print_warning "sudo is not available. Some system operations may fail."
            print_info "You can still install to your home directory without sudo."
        else
            if ! sudo -n true 2>/dev/null; then
                print_info "This script may require sudo privileges for system operations."
                print_info "You may be prompted for your password."
                sudo -v 2>/dev/null || print_warning "No sudo access. Continuing with user-level installation."
            fi
        fi
    fi
}

run_as_root() {
    if [ "$IS_ROOT" = true ]; then
        "$@"
    else
        sudo "$@"
    fi
}

check_os() {
    print_header "Checking System Requirements"
    
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        print_error "Cannot determine OS. This script requires Ubuntu or Debian."
        exit 1
    fi

    if [[ ! "$OS" =~ "Ubuntu" ]] && [[ ! "$OS" =~ "Debian" ]]; then
        print_error "This script is designed for Ubuntu or Debian systems."
        print_error "Detected OS: $OS"
        exit 1
    fi

    print_success "Detected OS: $OS $VER"
    log "OS: $OS $VER"
    
    # Check architecture
    ARCH=$(uname -m)
    print_info "Architecture: $ARCH"
    log "Architecture: $ARCH"
    
    # Check available disk space (require at least 5GB for AI models)
    AVAILABLE_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -lt 5 ]; then
        print_warning "Low disk space detected: ${AVAILABLE_SPACE}GB available"
        print_warning "At least 5GB is recommended (AI models require ~3GB)"
        if ! prompt_yes_no "Continue anyway?"; then
            exit 1
        fi
    else
        print_success "Sufficient disk space: ${AVAILABLE_SPACE}GB available"
    fi
    
    # Check memory (recommend at least 2GB for AI features)
    TOTAL_MEM=$(free -g | awk 'NR==2 {print $2}')
    if [ "$TOTAL_MEM" -lt 2 ]; then
        print_warning "Low memory detected: ${TOTAL_MEM}GB total"
        print_warning "At least 2GB RAM is recommended for AI features"
    else
        print_success "Memory: ${TOTAL_MEM}GB total"
    fi
    
    save_installation_state "system_check" "completed" "OS: $OS $VER, Arch: $ARCH"
}

check_existing_installation() {
    print_header "Checking for Existing Installation"
    
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "Installation directory already exists: $INSTALL_DIR"
        
        if prompt_yes_no "Remove existing installation and start fresh?"; then
            print_info "Backing up existing installation..."
            BACKUP_DIR="${INSTALL_DIR}.backup.$(date +%Y%m%d-%H%M%S)"
            if [ "$USE_SERVICE_USER" = true ]; then
                run_as_root mv "$INSTALL_DIR" "$BACKUP_DIR"
            else
                mv "$INSTALL_DIR" "$BACKUP_DIR"
            fi
            print_success "Existing installation backed up to: $BACKUP_DIR"
        else
            print_error "Installation cancelled. Please remove or backup the existing installation manually."
            exit 1
        fi
    fi
    
    # Check if service is already running
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        print_warning "Service $SERVICE_NAME is currently running"
        print_info "Stopping service..."
        run_as_root systemctl stop "$SERVICE_NAME"
        print_success "Service stopped"
    fi
    
    save_installation_state "existing_check" "completed" "Ready for fresh installation"
}

install_system_dependencies() {
    print_header "Installing System Dependencies"
    
    print_progress "Updating package lists..."
    run_as_root apt-get update -qq
    log "Package lists updated"
    
    print_progress "Installing required packages..."
    run_as_root apt-get install -y -qq \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        python3-pip \
        sqlite3 \
        libsqlite3-dev \
        ca-certificates \
        gnupg \
        lsb-release \
        software-properties-common \
        udev \
        android-tools-adb \
        libcec-dev \
        cec-utils \
        jq \
        htop 2>&1 | tee -a "$LOG_FILE" > /dev/null
    
    print_success "System dependencies installed"
    log "System dependencies installed successfully"
    save_installation_state "system_deps" "completed" "All system packages installed"
}

install_nodejs() {
    print_header "Installing Node.js v${NODE_VERSION}"
    
    if check_command node; then
        CURRENT_NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$CURRENT_NODE_VERSION" -ge "$NODE_VERSION" ]; then
            print_success "Node.js $(node -v) is already installed"
            log "Node.js $(node -v) already installed"
            save_installation_state "nodejs" "completed" "Node.js $(node -v) already present"
            return
        else
            print_warning "Node.js $(node -v) is installed but version $NODE_VERSION is required"
            print_info "Upgrading Node.js..."
        fi
    fi
    
    print_progress "Installing Node.js $NODE_VERSION using NodeSource repository..."
    
    # Remove old NodeSource repository if it exists
    run_as_root rm -f /etc/apt/sources.list.d/nodesource.list 2>/dev/null || true
    
    # Install Node.js using NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | run_as_root bash - >> "$LOG_FILE" 2>&1
    run_as_root apt-get install -y nodejs >> "$LOG_FILE" 2>&1
    
    # Verify installation
    if check_command node && check_command npm; then
        NODE_INSTALLED_VERSION=$(node -v)
        NPM_INSTALLED_VERSION=$(npm -v)
        print_success "Node.js $NODE_INSTALLED_VERSION and npm $NPM_INSTALLED_VERSION installed successfully"
        log "Node.js $NODE_INSTALLED_VERSION and npm $NPM_INSTALLED_VERSION installed"
        
        # Verify npm is accessible globally
        NPM_PATH=$(which npm)
        print_info "npm installed at: $NPM_PATH"
        log "npm path: $NPM_PATH"
        
        # Ensure npm is in system PATH for all users
        if [ ! -f /etc/profile.d/nodejs.sh ]; then
            run_as_root tee /etc/profile.d/nodejs.sh > /dev/null <<'EOF'
# Node.js and npm PATH configuration
export PATH="/usr/bin:$PATH"
EOF
            run_as_root chmod +x /etc/profile.d/nodejs.sh
            print_success "Node.js PATH configuration added to /etc/profile.d/nodejs.sh"
        fi
        
        save_installation_state "nodejs" "completed" "Node.js $NODE_INSTALLED_VERSION installed"
    else
        print_error "Failed to install Node.js"
        save_installation_state "nodejs" "failed" "Node.js installation failed"
        exit 1
    fi
}

install_ollama() {
    print_header "Installing Ollama (Local AI Engine)"
    
    if [ "$SKIP_OLLAMA" = "true" ]; then
        print_info "Skipping Ollama installation (SKIP_OLLAMA=true)"
        save_installation_state "ollama" "skipped" "User requested to skip"
        return
    fi
    
    if check_command ollama; then
        print_success "Ollama is already installed"
        OLLAMA_VERSION=$(ollama --version 2>/dev/null || echo "unknown")
        print_info "Ollama version: $OLLAMA_VERSION"
        log "Ollama already installed: $OLLAMA_VERSION"
    else
        print_progress "Installing Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh >> "$LOG_FILE" 2>&1
        
        if check_command ollama; then
            print_success "Ollama installed successfully"
            log "Ollama installed"
        else
            print_error "Failed to install Ollama"
            print_warning "AI features will not work without Ollama"
            save_installation_state "ollama" "failed" "Ollama installation failed"
            if ! prompt_yes_no "Continue without Ollama?"; then
                exit 1
            fi
            return
        fi
    fi
    
    # Start Ollama service
    print_progress "Starting Ollama service..."
    if systemctl is-active --quiet ollama 2>/dev/null; then
        print_success "Ollama service is already running"
    else
        run_as_root systemctl start ollama 2>/dev/null || {
            print_warning "Could not start Ollama as a service, starting manually..."
            ollama serve >> "$LOG_FILE" 2>&1 &
            sleep 3
        }
        print_success "Ollama service started"
    fi
    
    # Enable Ollama service to start on boot
    run_as_root systemctl enable ollama 2>/dev/null || print_info "Ollama service auto-start not configured"
    
    save_installation_state "ollama" "completed" "Ollama installed and running"
}

install_ollama_models() {
    print_header "Installing Ollama AI Models"
    
    if [ "$SKIP_OLLAMA" = "true" ]; then
        print_info "Skipping Ollama model installation (SKIP_OLLAMA=true)"
        return
    fi
    
    if ! check_command ollama; then
        print_warning "Ollama is not installed, skipping model installation"
        return
    fi
    
    # Wait for Ollama to be ready
    print_progress "Waiting for Ollama to be ready..."
    local max_attempts=30
    local attempt=0
    while ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [ $attempt -ge $max_attempts ]; then
            print_error "Ollama service did not start in time"
            save_installation_state "ollama_models" "failed" "Ollama service not responding"
            return
        fi
        sleep 2
    done
    print_success "Ollama is ready"
    
    # Install each model
    local models_installed=0
    local models_failed=0
    
    for model in "${OLLAMA_MODELS[@]}"; do
        print_progress "Installing model: $model (this may take several minutes)..."
        
        # Check if model is already installed
        if ollama list | grep -q "^${model%%:*}"; then
            print_success "Model $model is already installed"
            models_installed=$((models_installed + 1))
            continue
        fi
        
        # Pull the model with progress indication
        if ollama pull "$model" >> "$LOG_FILE" 2>&1; then
            print_success "Model $model installed successfully"
            models_installed=$((models_installed + 1))
            log "Ollama model installed: $model"
        else
            print_error "Failed to install model: $model"
            models_failed=$((models_failed + 1))
            log "Failed to install Ollama model: $model"
        fi
    done
    
    # Summary
    print_info "Models installed: $models_installed/${#OLLAMA_MODELS[@]}"
    if [ $models_failed -gt 0 ]; then
        print_warning "$models_failed model(s) failed to install"
        save_installation_state "ollama_models" "partial" "$models_installed/${#OLLAMA_MODELS[@]} models installed"
    else
        print_success "All Ollama models installed successfully"
        save_installation_state "ollama_models" "completed" "All ${#OLLAMA_MODELS[@]} models installed"
    fi
    
    # List installed models
    print_info "Installed models:"
    ollama list | tail -n +2 | while read -r line; do
        model_name=$(echo "$line" | awk '{print $1}')
        model_size=$(echo "$line" | awk '{print $2}')
        print_info "  • $model_name ($model_size)"
    done
}

create_service_user() {
    if [ "$USE_SERVICE_USER" = false ]; then
        print_header "Using Current User"
        print_info "Installing as user: $SERVICE_USER"
        print_info "No separate service user needed for home directory installation"
        log "Using current user: $SERVICE_USER"
        
        if check_command sudo && sudo -n true 2>/dev/null; then
            print_info "Adding user to required groups..."
            sudo usermod -a -G plugdev,dialout "$SERVICE_USER" 2>/dev/null || true
            print_success "User groups configured"
        fi
        save_installation_state "service_user" "completed" "Using current user: $SERVICE_USER"
        return
    fi
    
    print_header "Creating Service User"
    
    if id "$SERVICE_USER" &>/dev/null; then
        print_success "User $SERVICE_USER already exists"
        log "User $SERVICE_USER already exists"
    else
        print_info "Creating user $SERVICE_USER..."
        run_as_root useradd -r -m -s /bin/bash "$SERVICE_USER"
        print_success "User $SERVICE_USER created"
        log "User $SERVICE_USER created"
    fi
    
    print_info "Adding user to required groups..."
    run_as_root usermod -a -G plugdev,dialout "$SERVICE_USER" 2>/dev/null || true
    print_success "User groups configured"
    save_installation_state "service_user" "completed" "Service user: $SERVICE_USER"
}

clone_repository() {
    print_header "Cloning Repository"
    
    print_progress "Cloning from $REPO_URL (branch: $REPO_BRANCH)..."
    
    # Create parent directory if it doesn't exist
    if [ "$USE_SERVICE_USER" = true ]; then
        run_as_root mkdir -p "$(dirname "$INSTALL_DIR")"
    else
        mkdir -p "$(dirname "$INSTALL_DIR")"
    fi
    
    # Clone repository
    if [ "$USE_SERVICE_USER" = true ]; then
        run_as_root git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR" >> "$LOG_FILE" 2>&1
    else
        git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR" >> "$LOG_FILE" 2>&1
    fi
    
    if [ -d "$INSTALL_DIR" ]; then
        print_success "Repository cloned successfully"
        log "Repository cloned to $INSTALL_DIR"
        
        # Set ownership
        if [ "$USE_SERVICE_USER" = true ]; then
            run_as_root chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
            print_success "Ownership set to $SERVICE_USER"
        else
            print_success "Installation directory: $INSTALL_DIR"
        fi
        
        save_installation_state "clone_repo" "completed" "Repository cloned to $INSTALL_DIR"
    else
        print_error "Failed to clone repository"
        save_installation_state "clone_repo" "failed" "Git clone failed"
        exit 1
    fi
}

install_npm_dependencies() {
    print_header "Installing NPM Dependencies"
    
    cd "$INSTALL_DIR"
    
    print_progress "Installing Node.js packages (this may take a few minutes)..."
    
    # Run npm install as appropriate user
    if [ "$USE_SERVICE_USER" = false ]; then
        npm install --production >> "$LOG_FILE" 2>&1
    elif [ "$IS_ROOT" = true ]; then
        su - "$SERVICE_USER" -c "cd $INSTALL_DIR && npm install --production" >> "$LOG_FILE" 2>&1
    else
        sudo -u "$SERVICE_USER" bash -c "cd $INSTALL_DIR && npm install --production" >> "$LOG_FILE" 2>&1
    fi
    
    print_success "NPM dependencies installed"
    log "NPM dependencies installed"
    save_installation_state "npm_deps" "completed" "All Node.js packages installed"
}

setup_database() {
    print_header "Setting Up Database"
    
    cd "$INSTALL_DIR"
    
    # Create data directory
    print_progress "Creating database directory..."
    if [ "$USE_SERVICE_USER" = false ]; then
        mkdir -p "$INSTALL_DIR/data"
    else
        run_as_root mkdir -p "$INSTALL_DIR/data"
        run_as_root chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/data"
    fi
    
    # Set DATABASE_URL environment variable for Prisma
    export DATABASE_URL="file:../data/sports_bar.db"
    print_info "Database will be created at: $INSTALL_DIR/data/sports_bar.db"
    log "Database URL: $DATABASE_URL (relative to schema location)"
    
    # Initialize database schema
    print_progress "Initializing database schema..."
    
    local DB_PUSH_CMD="npx prisma db push --schema=./prisma/schema.prisma --skip-generate"
    local DB_SETUP_SUCCESS=false
    
    if [ "$USE_SERVICE_USER" = false ]; then
        if $DB_PUSH_CMD >> "$LOG_FILE" 2>&1; then
            DB_SETUP_SUCCESS=true
        fi
    elif [ "$IS_ROOT" = true ]; then
        if su - "$SERVICE_USER" -c "cd $INSTALL_DIR && export DATABASE_URL='file:../data/sports_bar.db' && $DB_PUSH_CMD" >> "$LOG_FILE" 2>&1; then
            DB_SETUP_SUCCESS=true
        fi
    else
        if sudo -u "$SERVICE_USER" bash -c "cd $INSTALL_DIR && export DATABASE_URL='file:../data/sports_bar.db' && $DB_PUSH_CMD" >> "$LOG_FILE" 2>&1; then
            DB_SETUP_SUCCESS=true
        fi
    fi
    
    if [ "$DB_SETUP_SUCCESS" = false ]; then
        print_error "Database schema initialization failed"
        print_error "Check the log file for details: $LOG_FILE"
        echo -e "\n${YELLOW}Last 20 lines of log file:${NC}"
        tail -n 20 "$LOG_FILE"
        log "Database schema initialization failed"
        save_installation_state "database" "failed" "Schema initialization failed"
        exit 1
    fi
    
    print_success "Database schema initialized successfully"
    log "Database schema initialized"
    
    # Generate Prisma Client
    print_progress "Generating Prisma Client..."
    
    local GENERATE_CMD="npx prisma generate --schema=./prisma/schema.prisma"
    local GENERATE_SUCCESS=false
    
    if [ "$USE_SERVICE_USER" = false ]; then
        if $GENERATE_CMD >> "$LOG_FILE" 2>&1; then
            GENERATE_SUCCESS=true
        fi
    elif [ "$IS_ROOT" = true ]; then
        if su - "$SERVICE_USER" -c "cd $INSTALL_DIR && export DATABASE_URL='file:../data/sports_bar.db' && $GENERATE_CMD" >> "$LOG_FILE" 2>&1; then
            GENERATE_SUCCESS=true
        fi
    else
        if sudo -u "$SERVICE_USER" bash -c "cd $INSTALL_DIR && export DATABASE_URL='file:../data/sports_bar.db' && $GENERATE_CMD" >> "$LOG_FILE" 2>&1; then
            GENERATE_SUCCESS=true
        fi
    fi
    
    if [ "$GENERATE_SUCCESS" = false ]; then
        print_error "Prisma Client generation failed"
        print_error "Check the log file for details: $LOG_FILE"
        log "Prisma Client generation failed"
        save_installation_state "database" "failed" "Prisma Client generation failed"
        exit 1
    fi
    
    print_success "Prisma Client generated successfully"
    log "Prisma Client generated"
    
    # Verify database file was created
    if [ -f "$INSTALL_DIR/data/sports_bar.db" ]; then
        local DB_SIZE=$(du -h "$INSTALL_DIR/data/sports_bar.db" | cut -f1)
        print_success "Database file created: sports_bar.db ($DB_SIZE)"
        log "Database file created successfully: $DB_SIZE"
    else
        print_warning "Database file not found at expected location"
        log "Warning: Database file not found at $INSTALL_DIR/data/sports_bar.db"
    fi
    
    print_success "Database setup completed"
    log "Database setup completed successfully"
    save_installation_state "database" "completed" "Database initialized and ready"
}

create_env_file() {
    print_header "Creating Environment Configuration"
    
    ENV_FILE="$INSTALL_DIR/.env"
    
    if [ -f "$ENV_FILE" ]; then
        print_warning ".env file already exists"
        if ! prompt_yes_no "Overwrite existing .env file?"; then
            print_info "Keeping existing .env file"
            save_installation_state "env_file" "skipped" "Existing .env file preserved"
            return
        fi
    fi
    
    print_progress "Creating .env file from template..."
    
    # Copy example file
    if [ "$USE_SERVICE_USER" = false ]; then
        cp "$INSTALL_DIR/.env.example" "$ENV_FILE"
    else
        run_as_root cp "$INSTALL_DIR/.env.example" "$ENV_FILE"
    fi
    
    # Generate random secret for NextAuth
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    
    # Get local IP address
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    
    # Update .env file with generated values
    if [ "$USE_SERVICE_USER" = false ]; then
        sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"|" "$ENV_FILE"
        sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=\"http://${LOCAL_IP}:3000\"|" "$ENV_FILE"
        sed -i "s|NODE_ENV=.*|NODE_ENV=\"production\"|" "$ENV_FILE"
        chmod 600 "$ENV_FILE"
    else
        run_as_root sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"|" "$ENV_FILE"
        run_as_root sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=\"http://${LOCAL_IP}:3000\"|" "$ENV_FILE"
        run_as_root sed -i "s|NODE_ENV=.*|NODE_ENV=\"production\"|" "$ENV_FILE"
        run_as_root chown "$SERVICE_USER:$SERVICE_USER" "$ENV_FILE"
        run_as_root chmod 600 "$ENV_FILE"
    fi
    
    print_success ".env file created"
    print_info "NextAuth secret generated automatically"
    print_info "Application URL set to: http://${LOCAL_IP}:3000"
    log ".env file created with generated secrets"
    
    print_warning "\nIMPORTANT: You need to configure API keys in $ENV_FILE"
    print_info "Required API keys:"
    print_info "  - ANTHROPIC_API_KEY (for AI features)"
    print_info "  - OPENAI_API_KEY (optional, for AI features)"
    print_info "  - SOUNDTRACK_API_KEY (for music control)"
    print_info "  - GITHUB_TOKEN (for remote updates)"
    print_info "\nOptional API keys:"
    print_info "  - ESPN_API_KEY, SPORTS_RADAR_API_KEY (for sports data)"
    print_info "  - SPECTRUM_API_KEY, GRACENOTE_API_KEY (for TV guide)"
    
    save_installation_state "env_file" "completed" "Environment configured"
}

build_knowledge_base() {
    print_header "Building AI Knowledge Base"
    
    cd "$INSTALL_DIR"
    
    print_progress "Building knowledge base from documentation and codebase..."
    print_info "This process indexes all documentation and code files for AI context"
    print_info "This may take 2-5 minutes depending on system performance..."
    
    local BUILD_KB_CMD="npm run build-knowledge-base"
    local BUILD_KB_SUCCESS=false
    
    if [ "$USE_SERVICE_USER" = false ]; then
        if timeout 600 $BUILD_KB_CMD >> "$LOG_FILE" 2>&1; then
            BUILD_KB_SUCCESS=true
        fi
    elif [ "$IS_ROOT" = true ]; then
        if timeout 600 su - "$SERVICE_USER" -c "cd $INSTALL_DIR && $BUILD_KB_CMD" >> "$LOG_FILE" 2>&1; then
            BUILD_KB_SUCCESS=true
        fi
    else
        if timeout 600 sudo -u "$SERVICE_USER" bash -c "cd $INSTALL_DIR && $BUILD_KB_CMD" >> "$LOG_FILE" 2>&1; then
            BUILD_KB_SUCCESS=true
        fi
    fi
    
    if [ "$BUILD_KB_SUCCESS" = true ]; then
        if [ -f "$INSTALL_DIR/data/ai-knowledge-base.json" ]; then
            local KB_SIZE=$(du -h "$INSTALL_DIR/data/ai-knowledge-base.json" | cut -f1)
            local KB_CHUNKS=$(jq '.chunks | length' "$INSTALL_DIR/data/ai-knowledge-base.json" 2>/dev/null || echo "unknown")
            print_success "Knowledge base built successfully"
            print_info "Knowledge base size: $KB_SIZE"
            print_info "Document chunks indexed: $KB_CHUNKS"
            log "Knowledge base built: $KB_SIZE, $KB_CHUNKS chunks"
            save_installation_state "knowledge_base" "completed" "KB built: $KB_SIZE, $KB_CHUNKS chunks"
        else
            print_warning "Knowledge base file not found after build"
            print_info "AI chatbot may have limited context without knowledge base"
            log "Warning: Knowledge base file not found"
            save_installation_state "knowledge_base" "partial" "Build completed but file not found"
        fi
    else
        print_warning "Knowledge base build failed or timed out"
        print_info "AI chatbot will work but with limited context"
        print_info "You can rebuild it later with: npm run build-knowledge-base"
        log "Knowledge base build failed"
        save_installation_state "knowledge_base" "failed" "Build failed or timed out"
    fi
}

build_application() {
    print_header "Building Application"
    
    cd "$INSTALL_DIR"
    
    print_progress "Building Next.js application (this may take several minutes)..."
    
    local BUILD_SUCCESS=false
    export DATABASE_URL="file:../data/sports_bar.db"
    
    if [ "$USE_SERVICE_USER" = false ]; then
        if npm run build >> "$LOG_FILE" 2>&1; then
            BUILD_SUCCESS=true
        fi
    elif [ "$IS_ROOT" = true ]; then
        if su - "$SERVICE_USER" -c "cd $INSTALL_DIR && export DATABASE_URL='file:../data/sports_bar.db' && npm run build" >> "$LOG_FILE" 2>&1; then
            BUILD_SUCCESS=true
        fi
    else
        if sudo -u "$SERVICE_USER" bash -c "cd $INSTALL_DIR && export DATABASE_URL='file:../data/sports_bar.db' && npm run build" >> "$LOG_FILE" 2>&1; then
            BUILD_SUCCESS=true
        fi
    fi
    
    if [ "$BUILD_SUCCESS" = true ]; then
        print_success "Application built successfully"
        log "Application built successfully"
        save_installation_state "build_app" "completed" "Next.js build successful"
    else
        print_error "Application build failed"
        print_error "Check the log file for details: $LOG_FILE"
        log "Application build failed"
        echo -e "\n${YELLOW}Last 30 lines of build log:${NC}"
        tail -n 30 "$LOG_FILE"
        save_installation_state "build_app" "failed" "Next.js build failed"
        exit 1
    fi
}

verify_installation() {
    print_header "Verifying Installation"
    
    local verification_passed=true
    
    # Check Node.js
    print_progress "Checking Node.js..."
    if check_command node; then
        print_success "Node.js $(node -v) is installed"
    else
        print_error "Node.js is not installed"
        verification_passed=false
    fi
    
    # Check npm
    print_progress "Checking npm..."
    if check_command npm; then
        print_success "npm $(npm -v) is installed"
    else
        print_error "npm is not installed"
        verification_passed=false
    fi
    
    # Check Ollama
    if [ "$SKIP_OLLAMA" != "true" ]; then
        print_progress "Checking Ollama..."
        if check_command ollama; then
            print_success "Ollama is installed"
            
            # Check if Ollama is running
            if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
                print_success "Ollama service is running"
                
                # Check installed models
                local model_count=$(ollama list | tail -n +2 | wc -l)
                print_info "Ollama models installed: $model_count"
            else
                print_warning "Ollama is installed but not running"
            fi
        else
            print_warning "Ollama is not installed (AI features will be limited)"
        fi
    fi
    
    # Check database
    print_progress "Checking database..."
    if [ -f "$INSTALL_DIR/data/sports_bar.db" ]; then
        print_success "Database file exists"
    else
        print_error "Database file not found"
        verification_passed=false
    fi
    
    # Check knowledge base
    print_progress "Checking knowledge base..."
    if [ -f "$INSTALL_DIR/data/ai-knowledge-base.json" ]; then
        print_success "Knowledge base exists"
    else
        print_warning "Knowledge base not found (AI context will be limited)"
    fi
    
    # Check .env file
    print_progress "Checking environment configuration..."
    if [ -f "$INSTALL_DIR/.env" ]; then
        print_success ".env file exists"
    else
        print_error ".env file not found"
        verification_passed=false
    fi
    
    # Check build output
    print_progress "Checking build output..."
    if [ -d "$INSTALL_DIR/.next" ]; then
        print_success "Next.js build output exists"
    else
        print_error "Next.js build output not found"
        verification_passed=false
    fi
    
    if [ "$verification_passed" = true ]; then
        print_success "All critical components verified successfully"
        save_installation_state "verification" "completed" "All checks passed"
    else
        print_warning "Some verification checks failed"
        print_info "The application may still work, but some features might be unavailable"
        save_installation_state "verification" "partial" "Some checks failed"
    fi
}

setup_systemd_service() {
    print_header "Setting Up Systemd Service"
    
    if [ "$USE_SERVICE_USER" = false ] && ! check_command sudo; then
        print_warning "Systemd service setup requires sudo access"
        print_info "You can run the application manually with: cd $INSTALL_DIR && npm start"
        save_installation_state "systemd" "skipped" "No sudo access"
        return
    fi
    
    if ! prompt_yes_no "Set up systemd service for auto-start on boot?" "y"; then
        print_info "Skipping systemd service setup"
        print_info "You can run the application manually with: cd $INSTALL_DIR && npm start"
        save_installation_state "systemd" "skipped" "User declined"
        return
    fi
    
    print_progress "Creating systemd service file..."
    
    SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
    
    run_as_root tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Sports Bar TV Controller
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=DATABASE_URL=file:./data/sports_bar.db
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR/data $INSTALL_DIR/.next

[Install]
WantedBy=multi-user.target
EOF

    run_as_root chmod 644 "$SERVICE_FILE"
    
    print_progress "Reloading systemd daemon..."
    run_as_root systemctl daemon-reload
    
    print_progress "Enabling service..."
    run_as_root systemctl enable "$SERVICE_NAME"
    
    print_success "Systemd service configured"
    log "Systemd service configured"
    
    if prompt_yes_no "Start the service now?" "y"; then
        print_progress "Starting service..."
        run_as_root systemctl start "$SERVICE_NAME"
        sleep 5
        
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            print_success "Service started successfully"
            log "Service started"
            save_installation_state "systemd" "completed" "Service running"
        else
            print_error "Service failed to start"
            print_info "Check logs with: sudo journalctl -u $SERVICE_NAME -f"
            save_installation_state "systemd" "failed" "Service failed to start"
        fi
    else
        save_installation_state "systemd" "completed" "Service configured but not started"
    fi
}

configure_firewall() {
    print_header "Configuring Firewall"
    
    if ! check_command ufw; then
        print_info "UFW firewall not installed, skipping firewall configuration"
        save_installation_state "firewall" "skipped" "UFW not installed"
        return
    fi
    
    if ! run_as_root ufw status | grep -q "Status: active"; then
        print_info "UFW firewall is not active, skipping firewall configuration"
        save_installation_state "firewall" "skipped" "UFW not active"
        return
    fi
    
    if prompt_yes_no "Configure firewall to allow port 3000?" "y"; then
        print_progress "Adding firewall rule for port 3000..."
        run_as_root ufw allow 3000/tcp >> "$LOG_FILE" 2>&1
        print_success "Firewall configured"
        log "Firewall rule added for port 3000"
        save_installation_state "firewall" "completed" "Port 3000 allowed"
    else
        save_installation_state "firewall" "skipped" "User declined"
    fi
}

print_completion_message() {
    print_header "Installation Complete!"
    
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║  Sports Bar TV Controller has been installed successfully!    ║"
    echo "║                                                                ║"
    echo "║  Version 2.0 - With all latest fixes and improvements         ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo -e "\n${CYAN}Installation Details:${NC}"
    echo -e "  Installation Directory: ${GREEN}$INSTALL_DIR${NC}"
    echo -e "  Running as User: ${GREEN}$SERVICE_USER${NC}"
    echo -e "  Node.js Version: ${GREEN}$(node -v)${NC}"
    echo -e "  Log File: ${GREEN}$LOG_FILE${NC}"
    echo -e "  State File: ${GREEN}$INSTALLATION_STATE_FILE${NC}"
    
    echo -e "\n${CYAN}Access Your Application:${NC}"
    echo -e "  Local: ${GREEN}http://localhost:3000${NC}"
    echo -e "  Network: ${GREEN}http://${LOCAL_IP}:3000${NC}"
    
    echo -e "\n${CYAN}New Features in This Version:${NC}"
    echo -e "  ${GREEN}✓${NC} Node.js v22 (upgraded from v18)"
    echo -e "  ${GREEN}✓${NC} AI tools integration (file system + code execution)"
    echo -e "  ${GREEN}✓${NC} Q&A generation with 180s timeout"
    echo -e "  ${GREEN}✓${NC} Chatbot streaming support"
    echo -e "  ${GREEN}✓${NC} Enhanced security controls"
    echo -e "  ${GREEN}✓${NC} Knowledge base building"
    echo -e "  ${GREEN}✓${NC} phi3:mini model (faster AI responses)"
    
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo -e "\n${CYAN}Service Management:${NC}"
        echo -e "  Start:   ${GREEN}sudo systemctl start $SERVICE_NAME${NC}"
        echo -e "  Stop:    ${GREEN}sudo systemctl stop $SERVICE_NAME${NC}"
        echo -e "  Restart: ${GREEN}sudo systemctl restart $SERVICE_NAME${NC}"
        echo -e "  Status:  ${GREEN}sudo systemctl status $SERVICE_NAME${NC}"
        echo -e "  Logs:    ${GREEN}sudo journalctl -u $SERVICE_NAME -f${NC}"
    else
        echo -e "\n${CYAN}Running the Application:${NC}"
        echo -e "  Start manually: ${GREEN}cd $INSTALL_DIR && npm start${NC}"
        echo -e "  Development mode: ${GREEN}cd $INSTALL_DIR && npm run dev${NC}"
        if [ "$USE_SERVICE_USER" = false ]; then
            echo -e "\n${YELLOW}Note:${NC} Systemd service was not configured."
            echo -e "  You can set it up later with sudo access if needed."
        fi
    fi
    
    echo -e "\n${YELLOW}⚠ IMPORTANT NEXT STEPS:${NC}"
    echo -e "  ${CYAN}1.${NC} Configure API keys in: ${GREEN}$INSTALL_DIR/.env${NC}"
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo -e "  ${CYAN}2.${NC} Restart the service: ${GREEN}sudo systemctl restart $SERVICE_NAME${NC}"
    else
        echo -e "  ${CYAN}2.${NC} Start the application: ${GREEN}cd $INSTALL_DIR && npm start${NC}"
    fi
    echo -e "  ${CYAN}3.${NC} Access the web interface and complete initial setup"
    echo -e "  ${CYAN}4.${NC} Test AI features in the chatbot"
    
    echo -e "\n${CYAN}Required API Keys:${NC}"
    echo -e "  • ${YELLOW}ANTHROPIC_API_KEY${NC} - For AI assistant features"
    echo -e "  • ${YELLOW}SOUNDTRACK_API_KEY${NC} - For music control"
    echo -e "  • ${YELLOW}GITHUB_TOKEN${NC} - For remote updates"
    
    echo -e "\n${CYAN}Optional Features:${NC}"
    echo -e "  • Sports data APIs (ESPN, SportsRadar)"
    echo -e "  • TV guide APIs (Spectrum, Gracenote)"
    if [ "$SKIP_OLLAMA" = "true" ]; then
        echo -e "  • ${YELLOW}Local AI (Ollama)${NC} - Not installed (SKIP_OLLAMA=true)"
        echo -e "    Install later with: ${GREEN}curl -fsSL https://ollama.com/install.sh | sh${NC}"
    else
        echo -e "  • ${GREEN}Local AI (Ollama)${NC} - Installed and configured"
    fi
    
    echo -e "\n${CYAN}AI Models Installed:${NC}"
    if check_command ollama && [ "$SKIP_OLLAMA" != "true" ]; then
        ollama list | tail -n +2 | while read -r line; do
            model_name=$(echo "$line" | awk '{print $1}')
            model_size=$(echo "$line" | awk '{print $2}')
            echo -e "  • ${GREEN}$model_name${NC} ($model_size)"
        done
    else
        echo -e "  ${YELLOW}No models installed (Ollama not available)${NC}"
    fi
    
    echo -e "\n${CYAN}Knowledge Base:${NC}"
    if [ -f "$INSTALL_DIR/data/ai-knowledge-base.json" ]; then
        local KB_SIZE=$(du -h "$INSTALL_DIR/data/ai-knowledge-base.json" | cut -f1)
        local KB_CHUNKS=$(jq '.chunks | length' "$INSTALL_DIR/data/ai-knowledge-base.json" 2>/dev/null || echo "unknown")
        echo -e "  • ${GREEN}Built successfully${NC} ($KB_SIZE, $KB_CHUNKS chunks)"
        echo -e "  • Rebuild with: ${GREEN}npm run build-knowledge-base${NC}"
    else
        echo -e "  • ${YELLOW}Not built${NC} (AI context will be limited)"
        echo -e "  • Build with: ${GREEN}cd $INSTALL_DIR && npm run build-knowledge-base${NC}"
    fi
    
    echo -e "\n${CYAN}Documentation:${NC}"
    echo -e "  • Installation Guide: ${GREEN}$INSTALL_DIR/INSTALLATION.md${NC}"
    echo -e "  • Deployment Guide: ${GREEN}$INSTALL_DIR/DEPLOYMENT_INSTRUCTIONS.md${NC}"
    echo -e "  • README: ${GREEN}$INSTALL_DIR/README.md${NC}"
    echo -e "  • Test Report: ${GREEN}$INSTALL_DIR/TEST_REPORT.md${NC}"
    
    echo -e "\n${CYAN}Support:${NC}"
    echo -e "  • GitHub: ${GREEN}https://github.com/dfultonthebar/Sports-Bar-TV-Controller${NC}"
    echo -e "  • Issues: ${GREEN}https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues${NC}"
    
    echo -e "\n${CYAN}Troubleshooting:${NC}"
    echo -e "  • View installation log: ${GREEN}cat $LOG_FILE${NC}"
    echo -e "  • View installation state: ${GREEN}cat $INSTALLATION_STATE_FILE${NC}"
    echo -e "  • Test Ollama: ${GREEN}curl http://localhost:11434/api/tags${NC}"
    echo -e "  • Check service status: ${GREEN}sudo systemctl status $SERVICE_NAME${NC}"
    
    echo -e "\n${GREEN}Thank you for installing Sports Bar TV Controller v2.0!${NC}"
    echo -e "${GREEN}All recent fixes and improvements have been included.${NC}\n"
    
    log "Installation completed successfully"
    save_installation_state "complete" "success" "Installation finished successfully"
}

#############################################################################
# Main Installation Flow
#############################################################################

main() {
    clear
    
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║     Sports Bar TV Controller - Installation Script v2.0       ║"
    echo "║                                                                ║"
    echo "║  This script will install all required dependencies and       ║"
    echo "║  set up the Sports Bar TV Controller with all latest fixes.   ║"
    echo "║                                                                ║"
    echo "║  New in v2.0:                                                  ║"
    echo "║  • Node.js v22                                                 ║"
    echo "║  • AI tools integration                                        ║"
    echo "║  • Chatbot streaming support                                   ║"
    echo "║  • Knowledge base building                                     ║"
    echo "║  • phi3:mini model (faster AI)                                 ║"
    echo "║  • All recent bug fixes                                        ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"
    
    log "Installation started - Version 2.0"
    log "Installation directory: $INSTALL_DIR"
    log "Repository: $REPO_URL (branch: $REPO_BRANCH)"
    log "Log file: $LOG_FILE"
    log "Node.js version: $NODE_VERSION"
    log "Skip Ollama: $SKIP_OLLAMA"
    
    print_info "Installation log will be saved to: $LOG_FILE"
    print_info "Installation state will be saved to: $INSTALLATION_STATE_FILE"
    
    # Pre-installation checks
    print_info "Step 1/14: Checking system requirements..."
    check_root
    check_os
    check_existing_installation
    
    # System setup
    print_info "Step 2/14: Installing system dependencies..."
    install_system_dependencies
    
    print_info "Step 3/14: Installing Node.js v${NODE_VERSION}..."
    install_nodejs
    
    print_info "Step 4/14: Installing Ollama (Local AI)..."
    install_ollama
    
    print_info "Step 5/14: Installing Ollama AI models..."
    install_ollama_models
    
    print_info "Step 6/14: Configuring user..."
    create_service_user
    
    # Application setup
    print_info "Step 7/14: Cloning repository..."
    clone_repository
    
    print_info "Step 8/14: Installing NPM dependencies..."
    install_npm_dependencies
    
    print_info "Step 9/14: Setting up database..."
    setup_database
    
    print_info "Step 10/14: Creating environment configuration..."
    create_env_file
    
    print_info "Step 11/14: Building AI knowledge base..."
    build_knowledge_base
    
    print_info "Step 12/14: Building application..."
    build_application
    
    print_info "Step 13/14: Verifying installation..."
    verify_installation
    
    # Service setup
    print_info "Step 14/14: Setting up system service..."
    setup_systemd_service
    
    # Optional: Firewall configuration
    configure_firewall
    
    # Completion
    print_completion_message
    
    log "Installation completed successfully"
}

# Error handler with detailed diagnostics
error_handler() {
    local line_number=$1
    local exit_code=$?
    
    print_error "Installation failed at line $line_number (exit code: $exit_code)"
    print_error "Check log file for details: $LOG_FILE"
    log "Installation failed at line $line_number (exit code: $exit_code)"
    
    # Save error state
    save_installation_state "error" "failed" "Installation failed at line $line_number"
    
    # Show last 30 lines of log file for quick debugging
    if [ -f "$LOG_FILE" ]; then
        echo -e "\n${YELLOW}Last 30 lines of log file:${NC}"
        tail -n 30 "$LOG_FILE"
    fi
    
    echo -e "\n${CYAN}Troubleshooting:${NC}"
    echo -e "  • Full log: ${GREEN}cat $LOG_FILE${NC}"
    echo -e "  • Installation state: ${GREEN}cat $INSTALLATION_STATE_FILE${NC}"
    echo -e "  • Report issue: ${GREEN}https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues${NC}"
    
    exit 1
}

trap 'error_handler ${LINENO}' ERR

# Run main installation
main "$@"
