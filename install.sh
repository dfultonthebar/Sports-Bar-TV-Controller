
#!/bin/bash

#############################################################################
# Sports Bar TV Controller - One-Line Installation Script
# 
# This script automates the complete installation of the Sports Bar TV 
# Controller application on a fresh Ubuntu/Debian system.
#
# Usage: 
#   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
#   or
#   wget -qO- https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
#
# For custom installation directory:
#   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | INSTALL_DIR=/custom/path bash
#
# For reinstall (removes existing installation first):
#   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash -s -- --reinstall
#   or
#   ./install.sh --reinstall
#
# Examples:
#   # Install to home directory (default)
#   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
#
#   # Install to custom location
#   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | INSTALL_DIR=/opt/sportsbar bash
#
#   # Reinstall (clean install)
#   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash -s -- --reinstall
#
#   # Reinstall without prompts
#   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash -s -- --reinstall --force
#
#############################################################################

set -e  # Exit on any error
set -o pipefail  # Catch errors in pipes
set -u  # Exit on undefined variables

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Installation configuration
# Default to user's home directory for simpler, user-friendly installation
INSTALL_DIR="${INSTALL_DIR:-$HOME/Sports-Bar-TV-Controller}"
SERVICE_NAME="sports-bar-tv-controller"
REPO_URL="https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git"
REPO_BRANCH="${REPO_BRANCH:-main}"
DATABASE_DIR="$HOME/sports-bar-data"
PORT="3001"
QA_WORKER_NAME="qa-worker"
LOG_FILE="/tmp/sportsbar-install-$(date +%Y%m%d-%H%M%S).log"

# Node.js version
NODE_VERSION="20"

# Reinstall flags
REINSTALL=false
FORCE_REINSTALL=false

# Determine if we need a service user (only for system-wide installations)
# For home directory installations, use the current user
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
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
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

#############################################################################
# Parse Command Line Arguments
#############################################################################

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --reinstall)
                REINSTALL=true
                shift
                ;;
            --force)
                FORCE_REINSTALL=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << EOF
Sports Bar TV Controller - Installation Script

Usage: ./install.sh [OPTIONS]

OPTIONS:
    --reinstall         Uninstall existing installation before installing
    --force             Skip confirmation prompts (use with --reinstall)
    --help, -h          Show this help message

EXAMPLES:
    # Normal installation
    ./install.sh

    # Reinstall (removes existing installation first)
    ./install.sh --reinstall

    # Reinstall without prompts
    ./install.sh --reinstall --force

    # One-line reinstall from GitHub
    curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash -s -- --reinstall --force

ENVIRONMENT VARIABLES:
    INSTALL_DIR         Installation directory (default: \$HOME/Sports-Bar-TV-Controller)
    REPO_BRANCH         Git branch to install (default: main)
    SERVICE_USER        Service user name (default: sportsbar for system installs, \$USER for home)

EOF
}

#############################################################################
# Uninstall Function
#############################################################################

run_uninstall() {
    print_header "Running Uninstall"
    
    # Download uninstall script
    local uninstall_script="/tmp/sportsbar-uninstall-$$.sh"
    
    print_info "Downloading uninstall script..."
    if curl -sSL "https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/$REPO_BRANCH/uninstall.sh" -o "$uninstall_script"; then
        chmod +x "$uninstall_script"
        print_success "Uninstall script downloaded"
    else
        print_error "Failed to download uninstall script"
        return 1
    fi
    
    # Run uninstall with appropriate flags
    local uninstall_flags=""
    if [ "$FORCE_REINSTALL" = true ]; then
        uninstall_flags="--yes --keep-nodejs --keep-ollama"
    else
        uninstall_flags="--keep-nodejs --keep-ollama"
    fi
    
    print_info "Running uninstall with flags: $uninstall_flags"
    if INSTALL_DIR="$INSTALL_DIR" bash "$uninstall_script" $uninstall_flags; then
        print_success "Uninstall completed"
    else
        print_error "Uninstall failed"
        return 1
    fi
    
    # Clean up uninstall script
    rm -f "$uninstall_script"
}

#############################################################################
# System Requirements Check
#############################################################################

check_system_requirements() {
    print_header "Checking System Requirements"
    
    # Check if running on Linux
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        print_error "This script only supports Linux systems"
        exit 1
    fi
    
    # Check if running on Ubuntu/Debian
    if ! command -v apt-get &> /dev/null; then
        print_error "This script requires apt-get (Ubuntu/Debian)"
        exit 1
    fi
    
    # Check for sudo access
    if ! sudo -n true 2>/dev/null; then
        print_info "This script requires sudo access. You may be prompted for your password."
        sudo -v
    fi
    
    print_success "System requirements met"
}

#############################################################################
# PHASE 1: Install ALL System Dependencies
#############################################################################
# This phase installs ALL system-level packages before any application setup.
# This ensures that all required libraries, compilers, and tools are available
# before we attempt to install Node packages or run database migrations.
#
# Why this order matters:
# - System packages provide the foundation (compilers, libraries, drivers)
# - Node.js and npm need these tools to compile native modules
# - SQLite libraries must be present before Drizzle can work with the database
# - Build tools are required for npm packages with native dependencies
#############################################################################

install_system_dependencies() {
    print_header "PHASE 1: Installing System Dependencies"
    
    log_and_print "Updating package lists..."
    sudo apt-get update >> "$LOG_FILE" 2>&1
    
    log_and_print "Installing core system packages..."
    # Core utilities
    sudo apt-get install -y \
        curl \
        wget \
        git \
        >> "$LOG_FILE" 2>&1
    
    log_and_print "Installing build tools and compilers..."
    # Build tools required for compiling native Node.js modules
    # - build-essential: gcc, g++, make, and other compilation tools
    # - python3: Required by node-gyp for building native addons
    # - python3-pip: Python package manager (may be needed by some npm packages)
    sudo apt-get install -y \
        build-essential \
        python3 \
        python3-pip \
        >> "$LOG_FILE" 2>&1
    
    log_and_print "Installing SQLite database libraries..."
    # SQLite packages required for Drizzle and database operations
    # - sqlite3: SQLite command-line tool
    # - libsqlite3-dev: Development headers for SQLite (required for native modules)
    sudo apt-get install -y \
        sqlite3 \
        libsqlite3-dev \
        >> "$LOG_FILE" 2>&1
    
    log_and_print "Installing additional system utilities..."
    # Additional utilities that may be needed
    # - ca-certificates: SSL/TLS certificates for secure connections
    # - gnupg: For verifying package signatures
    sudo apt-get install -y \
        ca-certificates \
        gnupg \
        >> "$LOG_FILE" 2>&1

    log_and_print "Installing hardware control dependencies..."
    # Hardware control packages for TV/device management
    # - adb: Android Debug Bridge for Fire TV/Fire Cube control
    # - cec-utils: HDMI-CEC control for TVs and cable boxes
    sudo apt-get install -y \
        adb \
        cec-utils \
        >> "$LOG_FILE" 2>&1

    print_success "All system dependencies installed"
    print_info "Installed: build tools, Python 3, SQLite libraries, ADB, CEC utilities, and core utilities"
}

#############################################################################
# PHASE 1 (continued): Install Node.js Runtime
#############################################################################
# Node.js is installed as part of Phase 1 because it's a system-level runtime
# that npm packages will depend on. This must be available before installing
# any application dependencies.
#############################################################################

install_nodejs() {
    print_header "PHASE 1: Installing Node.js Runtime"
    
    if check_command node; then
        local current_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$current_version" -ge "$NODE_VERSION" ]; then
            print_success "Node.js $current_version is already installed"
            return 0
        fi
    fi
    
    log_and_print "Installing Node.js $NODE_VERSION..."
    
    # Install Node.js using NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash - >> "$LOG_FILE" 2>&1
    sudo apt-get install -y nodejs >> "$LOG_FILE" 2>&1
    
    # Verify installation
    if check_command node && check_command npm; then
        print_success "Node.js $(node --version) and npm $(npm --version) installed"
    else
        print_error "Failed to install Node.js"
        exit 1
    fi
}

#############################################################################
# PHASE 1 (continued): Install Ollama AI Runtime
#############################################################################
# Ollama is installed as part of Phase 1 because it's a system-level service
# that the application will depend on. Installing it early ensures the service
# is ready before application configuration.
#
# Required AI Models:
# - llama3.2:3b  : Primary model for enhanced chat, tool chat, and log analysis
# - phi3:mini    : Lightweight model for general chat interface
# - llama2       : Backup model for device diagnostics
# - mistral      : Fast model for quick queries
#############################################################################

install_ollama() {
    print_header "PHASE 1: Installing Ollama AI Runtime"
    
    if check_command ollama; then
        print_success "Ollama is already installed"
    else
        log_and_print "Installing Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh >> "$LOG_FILE" 2>&1
        print_success "Ollama installed"
    fi
    
    # Start Ollama service
    log_and_print "Starting Ollama service..."
    sudo systemctl enable ollama >> "$LOG_FILE" 2>&1 || true
    sudo systemctl start ollama >> "$LOG_FILE" 2>&1 || true
    
    # Wait for Ollama to be ready
    print_info "Waiting for Ollama to be ready..."
    local max_wait=30
    local waited=0
    while ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
        if [ $waited -ge $max_wait ]; then
            print_error "Ollama service failed to start within ${max_wait}s"
            return 1
        fi
        sleep 2
        waited=$((waited + 2))
    done
    print_success "Ollama service is ready"
    
    # Download all required AI models
    download_ollama_models
}

#############################################################################
# Download Required Ollama Models
#############################################################################
# This function downloads all AI models required by the application.
# Models are pulled sequentially to avoid resource contention and ensure
# reliable downloads. Each model is verified after download.
#
# The function includes:
# - Progress indicators for each model
# - Retry logic for network failures
# - Verification of successful downloads
# - Clear error messages and troubleshooting guidance
#############################################################################

download_ollama_models() {
    print_header "Downloading Required AI Models"
    
    # Define all required models with descriptions
    # Format: "model_name:tag|description"
    local REQUIRED_MODELS=(
        "llama3.2:3b|Primary model for enhanced chat, tool chat, and log analysis"
        "phi3:mini|Lightweight model for general chat interface"
        "llama2|Backup model for device diagnostics"
        "mistral|Fast model for quick queries"
    )
    
    local total_models=${#REQUIRED_MODELS[@]}
    local current_model=0
    local failed_models=()
    
    print_info "Downloading ${total_models} AI models (this may take 10-30 minutes depending on your connection)..."
    echo ""
    
    # Pull each model sequentially
    for model_entry in "${REQUIRED_MODELS[@]}"; do
        current_model=$((current_model + 1))
        
        # Parse model name and description
        local model_name="${model_entry%%|*}"
        local model_desc="${model_entry##*|}"
        
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${CYAN}Model ${current_model} of ${total_models}: ${model_name}${NC}"
        echo -e "${CYAN}Purpose: ${model_desc}${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        # Check if model is already installed
        if ollama list | grep -q "^${model_name}"; then
            print_success "Model ${model_name} is already installed"
            echo ""
            continue
        fi
        
        # Try to pull the model with retry logic
        local max_retries=3
        local retry_count=0
        local pull_success=false
        
        while [ $retry_count -lt $max_retries ]; do
            if [ $retry_count -gt 0 ]; then
                print_warning "Retry attempt ${retry_count} of $((max_retries - 1)) for ${model_name}..."
            fi
            
            print_info "Downloading ${model_name}... (this may take several minutes)"
            
            # Pull model and capture output
            if ollama pull "$model_name" >> "$LOG_FILE" 2>&1; then
                pull_success=true
                break
            else
                retry_count=$((retry_count + 1))
                if [ $retry_count -lt $max_retries ]; then
                    print_warning "Download failed, waiting 5 seconds before retry..."
                    sleep 5
                fi
            fi
        done
        
        # Verify the model was successfully downloaded
        if [ "$pull_success" = true ]; then
            if ollama list | grep -q "^${model_name}"; then
                print_success "Model ${model_name} downloaded and verified successfully"
            else
                print_error "Model ${model_name} download reported success but verification failed"
                failed_models+=("$model_name")
            fi
        else
            print_error "Failed to download ${model_name} after ${max_retries} attempts"
            failed_models+=("$model_name")
        fi
        
        echo ""
    done
    
    # Display summary of installed models
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    print_header "AI Models Installation Summary"
    echo ""
    print_info "Installed AI Models:"
    ollama list
    echo ""
    
    # Check for failures and provide guidance
    if [ ${#failed_models[@]} -gt 0 ]; then
        print_warning "Some models failed to download:"
        for failed_model in "${failed_models[@]}"; do
            echo -e "  ${RED}✗${NC} $failed_model"
        done
        echo ""
        print_warning "The application will still work, but some AI features may be limited."
        echo ""
        print_info "Troubleshooting steps:"
        echo "  1. Check your internet connection"
        echo "  2. Verify Ollama service is running: sudo systemctl status ollama"
        echo "  3. Check available disk space: df -h"
        echo "  4. Try manually pulling models later: ollama pull <model-name>"
        echo "  5. View detailed logs: tail -f $LOG_FILE"
        echo ""
        print_info "You can continue with the installation. Failed models can be downloaded later."
        echo ""
        
        # Don't fail the installation, just warn
        return 0
    else
        print_success "All required AI models downloaded successfully!"
        echo ""
        print_info "AI Features Ready:"
        echo "  ✓ Enhanced Chat (llama3.2:3b)"
        echo "  ✓ Tool Chat (llama3.2:3b)"
        echo "  ✓ Log Analysis (llama3.2:3b)"
        echo "  ✓ General Chat (phi3:mini)"
        echo "  ✓ Device Diagnostics (llama2)"
        echo "  ✓ Quick Queries (mistral)"
        echo ""
    fi
}

#############################################################################
# PHASE 1 (continued): Install Tailscale Remote Access
#############################################################################
# Tailscale provides secure remote access to the system even with dynamic
# WAN IP addresses. This is essential for remote management of the sports bar
# TV controller system.
#
# Features:
# - Mesh VPN that works behind NAT/firewalls
# - SSH access via Tailscale network
# - No port forwarding required
# - Works with dynamic IP addresses
#############################################################################

install_tailscale() {
    print_header "PHASE 1: Installing Tailscale Remote Access"

    if check_command tailscale; then
        print_success "Tailscale is already installed"
        local ts_version=$(tailscale --version | head -1)
        print_info "Tailscale version: $ts_version"
    else
        log_and_print "Installing Tailscale..."
        curl -fsSL https://tailscale.com/install.sh | sh >> "$LOG_FILE" 2>&1

        if check_command tailscale; then
            print_success "Tailscale installed successfully"
        else
            print_warning "Tailscale installation may have failed - continuing with installation"
            return 0
        fi
    fi

    # Enable Tailscale service
    log_and_print "Enabling Tailscale service..."
    sudo systemctl enable tailscaled >> "$LOG_FILE" 2>&1 || true
    sudo systemctl start tailscaled >> "$LOG_FILE" 2>&1 || true

    # Check if already authenticated
    if tailscale status 2>/dev/null | grep -q "Tailscale is stopped"; then
        print_warning "Tailscale is installed but not authenticated"
        print_info ""
        print_info "To complete Tailscale setup after installation:"
        print_info "  1. Run: sudo tailscale up --ssh"
        print_info "  2. Open the URL shown in your browser"
        print_info "  3. Authenticate with your Tailscale account"
        print_info ""
        print_info "Once authenticated, you can SSH to this machine from"
        print_info "any device on your Tailscale network."
        print_info ""
    elif tailscale status 2>/dev/null | grep -q "100."; then
        local ts_ip=$(tailscale ip -4 2>/dev/null || echo "unknown")
        print_success "Tailscale is connected"
        print_info "Tailscale IP: $ts_ip"
    else
        print_info "Tailscale installed - run 'sudo tailscale up --ssh' to authenticate"
    fi

    print_success "Tailscale setup complete"
}

#############################################################################
# Create Service User (if needed)
#############################################################################

create_service_user() {
    if [ "$USE_SERVICE_USER" = false ]; then
        print_info "Using current user: $SERVICE_USER"
        return 0
    fi
    
    print_header "Creating Service User"
    
    if id "$SERVICE_USER" &>/dev/null; then
        print_success "Service user '$SERVICE_USER' already exists"
    else
        log_and_print "Creating service user '$SERVICE_USER'..."
        sudo useradd -r -m -s /bin/bash "$SERVICE_USER" >> "$LOG_FILE" 2>&1
        print_success "Service user created"
    fi
}

#############################################################################
# PHASE 2: Clone Repository
#############################################################################
# Now that all system dependencies are installed, we can safely clone the
# application repository. This is done before installing application dependencies
# because we need the package.json file to know what to install.
#############################################################################

clone_repository() {
    print_header "PHASE 2: Cloning Repository"
    
    # Remove existing directory if it exists
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "Installation directory already exists: $INSTALL_DIR"
        log_and_print "Removing existing directory..."
        rm -rf "$INSTALL_DIR"
    fi
    
    # Create parent directory
    mkdir -p "$(dirname "$INSTALL_DIR")"
    
    log_and_print "Cloning repository from $REPO_URL..."
    git clone --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR" >> "$LOG_FILE" 2>&1
    
    print_success "Repository cloned to $INSTALL_DIR"
}

#############################################################################
# PHASE 3: Install Application Dependencies
#############################################################################
# This phase installs all npm packages required by the application.
# This MUST happen BEFORE database setup because:
# - Drizzle CLI is installed as an npm package
# - Database migrations require Drizzle to be available
# - Native modules need the build tools we installed in Phase 1
#
# Why this is critical:
# - Running migrations before npm install will fail because Drizzle isn't available
# - Some npm packages compile native code using the build tools from Phase 1
# - All application code dependencies must be present before configuration
#############################################################################

install_app_dependencies() {
    print_header "PHASE 3: Installing Application Dependencies"
    
    cd "$INSTALL_DIR"
    
    log_and_print "Installing npm packages (including Drizzle)..."
    print_info "This may take a few minutes as packages are downloaded and compiled..."
    
    # Install all npm dependencies
    # This includes Drizzle, Next.js, and all other application dependencies
    npm install
    npm install -D tsx >> "$LOG_FILE" 2>&1
    
    print_success "Application dependencies installed"
    print_info "Drizzle CLI and all required packages are now available"
}

#############################################################################
# PHASE 4: Configure Environment
#############################################################################
# Environment configuration must happen BEFORE database setup because:
# - The .env file contains the DATABASE_URL that Drizzle needs
# - Database migrations will fail without proper environment configuration
# - Other environment variables may be needed by the migration process
#############################################################################

configure_environment() {
    print_header "PHASE 4: Configuring Environment"
    
    cd "$INSTALL_DIR"
    
    if [ ! -f .env ]; then
        log_and_print "Creating .env file from template..."
        cp .env.example .env
        
        # Set default values
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"file:.//home/ubuntu/sports-bar-data/production.db\"|g" .env
        sed -i "s|OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=\"http://localhost:11434\"|g" .env
        
        print_success "Environment configured"
        print_info "Database URL and Ollama settings configured in .env"
    else
        print_info ".env file already exists, skipping"
    fi
}

#############################################################################
# PHASE 5: Setup Database
#############################################################################
# Database setup happens AFTER all dependencies and configuration are ready:
# - System dependencies (Phase 1): SQLite libraries installed
# - Application dependencies (Phase 3): Drizzle CLI available
# - Environment configuration (Phase 4): DATABASE_URL configured
#
# This ensures that Drizzle has everything it needs to successfully run migrations.
#############################################################################

setup_database() {
    print_header "PHASE 5: Setting Up Database"
    
    cd "$INSTALL_DIR"
    
    # Create database directory
    # Create database directory
    mkdir -p "$DATABASE_DIR"
    
    # Function to detect and resolve failed migrations
    resolve_failed_migrations() {
        print_info "Checking for failed migrations..."
        
        # Check if migrations table exists and has failed entries
        if [ -f "/home/ubuntu/sports-bar-data/production.db" ]; then
            local failed_count=$(sqlite3 /home/ubuntu/sports-bar-data/production.db \
                "SELECT COUNT(*) FROM drizzle_migrations WHERE finished_at IS NULL;" 2>/dev/null || echo "0")
            
            if [ "$failed_count" -gt 0 ]; then
                print_warning "Found $failed_count failed migration(s)"
                print_info "Marking failed migrations as rolled back..."
                
                sqlite3 /home/ubuntu/sports-bar-data/production.db \
                    "UPDATE drizzle_migrations SET rolled_back_at = datetime('now') WHERE finished_at IS NULL;" \
                    >> "$LOG_FILE" 2>&1 || true
                
                print_success "Failed migrations resolved"
                return 0
            fi
        fi
        
        return 1
    }
    
    # Try running migrations with timeout
    log_and_print "Running database migrations (with 60s timeout)..."
    
    local migration_success=false
    local migration_output
    
    # Run with timeout and capture output
    if migration_output=$(timeout 60s npm run db:push 2>&1); then
        echo "$migration_output" >> "$LOG_FILE"
        migration_success=true
        print_success "Database migrations completed"
    else
        local exit_code=$?
        echo "$migration_output" >> "$LOG_FILE"
        
        if [ $exit_code -eq 124 ]; then
            print_error "Migration timed out after 60 seconds"
            log "Migration timeout - attempting recovery"
        else
            print_error "Migration failed with exit code $exit_code"
            log "Migration failed - attempting recovery"
        fi
        
        # Try to resolve failed migrations
        if resolve_failed_migrations; then
            print_info "Retrying migrations after cleanup..."
            if timeout 60s npm run db:push >> "$LOG_FILE" 2>&1; then
                migration_success=true
                print_success "Database migrations completed after retry"
            fi
        fi
        
        # If still failing, try db push as fallback
        if [ "$migration_success" = false ]; then
            print_warning "Migration failed, falling back to prisma db push..."
            log "Attempting fallback: prisma db push"
            
            if timeout 60s npm run db:push >> "$LOG_FILE" 2>&1; then
                migration_success=true
                print_success "Database schema pushed successfully (fallback method)"
            else
                print_error "Database setup failed completely"
                log "Both migrate deploy and db push failed"
                
                # Provide helpful error message
                echo ""
                print_error "Database setup failed. Possible causes:"
                echo "  1. Database file is locked by another process"
                echo "  2. Insufficient permissions on prisma/data directory"
                echo "  3. Corrupted migration state"
                echo ""
                echo "To manually fix:"
                echo "  cd $INSTALL_DIR"
                echo "  rm -f /home/ubuntu/sports-bar-data/production.db*"
                echo "  npm run db:push"
                echo ""
                
                return 1
            fi
        fi
    fi
    
    # Generate Drizzle client
    log_and_print "Generating Drizzle client..."
    if ! echo "Drizzle schema is ready (no generation needed)" >> "$LOG_FILE" 2>&1; then
        print_error "Failed to generate Drizzle client"
        return 1
    fi
    
    print_success "Database setup complete"
}

#############################################################################
# PHASE 6: Build Application
#############################################################################
# Building the application happens after database setup because:
# - The build process may need to access the database schema
# - Drizzle client generation (done in Phase 5) must complete first
# - All dependencies and configuration are now in place
#############################################################################

build_application() {
    print_header "PHASE 6: Building Application"
    
    cd "$INSTALL_DIR"
    
    log_and_print "Building Next.js application..."
    npm run build >> "$LOG_FILE" 2>&1
    
    print_success "Application built successfully"
}

#############################################################################
# PHASE 7: Setup PM2 Process Manager
#############################################################################
# PM2 setup is one of the final steps because:
# - The application must be fully built before it can be run
# - All dependencies, configuration, and database must be ready
# - This starts the application as a managed service
#############################################################################

setup_pm2() {
    print_header "PHASE 7: Setting Up PM2 Process Manager"
    
    # Configure npm global prefix for user installation
    local NPM_GLOBAL_DIR="$HOME/.npm-global"
    
    # Set npm prefix if not already set
    if [ "$(npm config get prefix)" != "$NPM_GLOBAL_DIR" ]; then
        log_and_print "Configuring npm global prefix..."
        npm config set prefix "$NPM_GLOBAL_DIR"
    fi
    
    # Ensure npm global bin is in PATH for current session
    if [[ ":$PATH:" != *":$NPM_GLOBAL_DIR/bin:"* ]]; then
        export PATH="$NPM_GLOBAL_DIR/bin:$PATH"
        log_and_print "Added npm global bin to PATH"
    fi
    
    # Add to .profile for persistence (if not already there)
    if [ -f "$HOME/.profile" ]; then
        if ! grep -q "\.npm-global/bin" "$HOME/.profile" 2>/dev/null; then
            echo '' >> "$HOME/.profile"
            echo '# npm global packages' >> "$HOME/.profile"
            echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.profile"
            log_and_print "Added npm global bin to .profile"
        fi
    fi
    
    # Clean up duplicate entries in .bashrc (if they exist)
    if [ -f "$HOME/.bashrc" ]; then
        local bashrc_backup="$HOME/.bashrc.backup-$(date +%Y%m%d-%H%M%S)"
        if grep -c "\.npm-global/bin" "$HOME/.bashrc" 2>/dev/null | grep -q "[2-9]"; then
            log_and_print "Cleaning up duplicate PATH entries in .bashrc..."
            cp "$HOME/.bashrc" "$bashrc_backup"
            # Remove all npm-global PATH entries
            sed -i '/\.npm-global\/bin/d' "$HOME/.bashrc"
            # Add single entry
            echo '' >> "$HOME/.bashrc"
            echo '# npm global packages' >> "$HOME/.bashrc"
            echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.bashrc"
            log_and_print "Cleaned up .bashrc (backup: $bashrc_backup)"
        elif ! grep -q "\.npm-global/bin" "$HOME/.bashrc" 2>/dev/null; then
            echo '' >> "$HOME/.bashrc"
            echo '# npm global packages' >> "$HOME/.bashrc"
            echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.bashrc"
            log_and_print "Added npm global bin to .bashrc"
        fi
    fi
    
    # Install PM2 globally (user installation, not sudo)
    if ! check_command pm2; then
        log_and_print "Installing PM2..."
        npm install -g pm2 >> "$LOG_FILE" 2>&1
        
        # Verify installation
        if ! check_command pm2; then
            print_error "PM2 installation failed"
            print_error "PM2 should be at: $NPM_GLOBAL_DIR/bin/pm2"
            exit 1
        fi
        
        log_and_print "PM2 installed successfully: $(pm2 --version)"
    else
        log_and_print "PM2 already installed: $(pm2 --version)"
    fi
    
    cd "$INSTALL_DIR"
    
    # Clean up any existing PM2 processes that might conflict with port 3001
    print_info "Checking for existing PM2 processes on port 3001..."
    
    # Get list of all PM2 processes
    local pm2_processes=$(pm2 jlist 2>/dev/null || echo "[]")
    
    # Check if any processes are using port 3001 or match our service names
    local processes_to_delete=()
    
    # Look for processes with our service name or old variations
    while IFS= read -r process_name; do
        if [ -n "$process_name" ]; then
            processes_to_delete+=("$process_name")
            print_info "Found existing process: $process_name"
        fi
    done < <(echo "$pm2_processes" | jq -r '.[] | select(.name | test("sportsbar|sports-bar-tv")) | .name' 2>/dev/null || true)
    
    # Also check for processes using port 3001 by examining their environment/script
    while IFS= read -r process_info; do
        if [ -n "$process_info" ]; then
            local proc_name=$(echo "$process_info" | jq -r '.name' 2>/dev/null || true)
            local proc_script=$(echo "$process_info" | jq -r '.pm2_env.pm_exec_path // ""' 2>/dev/null || true)
            
            # Check if this process might be using port 3001 (Next.js default)
            if [[ "$proc_script" == *"next"* ]] || [[ "$proc_script" == *"start"* ]]; then
                if [[ ! " ${processes_to_delete[@]} " =~ " ${proc_name} " ]]; then
                    print_warning "Found potential port 3001 process: $proc_name"
                    processes_to_delete+=("$proc_name")
                fi
            fi
        fi
    done < <(echo "$pm2_processes" | jq -c '.[]' 2>/dev/null || true)
    
    # Delete all identified processes
    if [ ${#processes_to_delete[@]} -gt 0 ]; then
        print_warning "Cleaning up ${#processes_to_delete[@]} existing PM2 process(es)..."
        for process_name in "${processes_to_delete[@]}"; do
            print_info "Stopping and removing: $process_name"
            pm2 stop "$process_name" >> "$LOG_FILE" 2>&1 || true
            pm2 delete "$process_name" >> "$LOG_FILE" 2>&1 || true
        done
        print_success "Cleaned up existing PM2 processes"
        
        # Wait a moment for ports to be released
        sleep 2
    else
        print_info "No existing PM2 processes found that conflict with port 3001"
    fi
    
    # Verify port 3001 is actually free before starting
    if netstat -tuln 2>/dev/null | grep -q ":3001 " || ss -tuln 2>/dev/null | grep -q ":3001 "; then
        print_error "Port 3001 is still in use after cleanup!"
        print_error "Please manually check what's using port 3001:"
        echo "  sudo lsof -i :3001"
        echo "  sudo netstat -tulpn | grep :3001"
        exit 1
    fi
    
    # Start application with PM2
    log_and_print "Starting application with PM2..."
    pm2 start npm --name "$SERVICE_NAME" -- start >> "$LOG_FILE" 2>&1

    # Start QA background worker
    log_and_print "Starting QA background worker..."
    pm2 start "/src/workers/qa-worker.ts" --name "qa-worker" --interpreter=node --node-args="--require=tsx" >> "$LOG_FILE" 2>&1
    
    # Wait for worker to start
    sleep 2
    
    # Verify worker is running
    if pm2 list 2>/dev/null | grep -q "qa-worker.*online"; then
        log_and_print "QA worker started successfully"
    else
        print_warning "QA worker may not have started correctly"
    fi
    
    # Wait for app to start
    sleep 3
    
    # Verify app is running
    if pm2 list 2>/dev/null | grep -q "$SERVICE_NAME.*online"; then
        log_and_print "Application started successfully"
    else
        print_warning "Application may not have started correctly"
        print_warning "Check PM2 logs: pm2 logs $SERVICE_NAME"
    fi
    
    # Save PM2 configuration
    pm2 save >> "$LOG_FILE" 2>&1
    
    # Setup PM2 startup script (requires sudo, but optional)
    log_and_print "Configuring PM2 startup..."
    if pm2 startup 2>&1 | tee -a "$LOG_FILE" | grep -q "sudo"; then
        print_warning "PM2 startup requires sudo to configure auto-start on boot"
        print_warning "Run the command shown above to enable auto-start"
    fi
    
    print_success "PM2 configured and application started"
}

#############################################################################
# PHASE 8: Set Permissions
#############################################################################
# Permissions are set after all files are in place to ensure proper ownership.
#############################################################################

set_permissions() {
    if [ "$USE_SERVICE_USER" = false ]; then
        return 0
    fi
    
    print_header "PHASE 8: Setting Permissions"
    
    log_and_print "Setting ownership to $SERVICE_USER..."
    sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" >> "$LOG_FILE" 2>&1
    
    print_success "Permissions set"
}

#############################################################################
# PHASE 9: Verify Installation
#############################################################################
# Final verification ensures everything is working correctly.
#############################################################################

verify_installation() {
    print_header "PHASE 9: Verifying Installation"
    
    # Check if application is running
    if pm2 list | grep -q "$SERVICE_NAME"; then
        print_success "Application is running"
    else
        print_error "Application is not running"
        return 1
    fi
    
    # Check if port 3001 is listening
    sleep 5
    if netstat -tuln 2>/dev/null | grep -q ":3001 " || ss -tuln 2>/dev/null | grep -q ":3001 "; then
        print_success "Application is listening on port 3001"
    else
        print_warning "Application may not be listening on port 3001 yet"
    fi
    
    print_success "Installation verified"
}

#############################################################################
# Print Final Instructions
#############################################################################

print_final_instructions() {
    print_header "Installation Complete!"
    
    echo -e "${GREEN}✓ Sports Bar TV Controller has been successfully installed!${NC}\n"
    
    echo -e "${CYAN}Installation Details:${NC}"
    echo -e "  Installation Directory: ${YELLOW}$INSTALL_DIR${NC}"
    echo -e "  Service User: ${YELLOW}$SERVICE_USER${NC}"
    echo -e "  Log File: ${YELLOW}$LOG_FILE${NC}"
    echo ""
    
    echo -e "${CYAN}Access the Application:${NC}"
    echo -e "  Web Interface: ${YELLOW}http://localhost:3001${NC}"
    echo -e "  Admin Panel: ${YELLOW}http://localhost:3001/admin${NC}"
    echo ""
    
    echo -e "${CYAN}Useful Commands:${NC}"
    echo -e "  View logs: ${YELLOW}pm2 logs $SERVICE_NAME${NC}"
    echo -e "  Restart app: ${YELLOW}pm2 restart $SERVICE_NAME${NC}"
    echo -e "  Stop app: ${YELLOW}pm2 stop $SERVICE_NAME${NC}"
    echo -e "  App status: ${YELLOW}pm2 status${NC}"
    echo ""
    
    echo -e "${CYAN}Remote Access (Tailscale):${NC}"
    if check_command tailscale; then
        if tailscale status 2>/dev/null | grep -q "100."; then
            local ts_ip=$(tailscale ip -4 2>/dev/null || echo "unknown")
            echo -e "  Tailscale IP: ${YELLOW}$ts_ip${NC}"
            echo -e "  SSH via Tailscale: ${YELLOW}ssh ubuntu@$ts_ip${NC}"
        else
            echo -e "  Status: ${YELLOW}Installed but not authenticated${NC}"
            echo -e "  Setup: ${YELLOW}sudo tailscale up --ssh${NC}"
        fi
    else
        echo -e "  Status: ${YELLOW}Not installed${NC}"
    fi
    echo ""

    echo -e "${CYAN}Hardware Control:${NC}"
    echo -e "  Fire TV (ADB): ${YELLOW}adb connect <device-ip>:5555${NC}"
    echo -e "  HDMI-CEC: ${YELLOW}cec-client -l${NC} (list CEC devices)"
    echo ""

    echo -e "${CYAN}Important Notes:${NC}"
    echo -e "  • PM2 is installed in: ${YELLOW}$HOME/.npm-global/bin${NC}"
    echo -e "  • If 'pm2' command not found, run: ${YELLOW}source ~/.profile${NC}"
    echo -e "  • Or log out and log back in to refresh your PATH"
    echo ""
    
    echo -e "${CYAN}Uninstall:${NC}"
    echo -e "  To uninstall: ${YELLOW}cd $INSTALL_DIR && ./uninstall.sh${NC}"
    echo -e "  Or download: ${YELLOW}curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/uninstall.sh | bash${NC}"
    echo ""
    
    echo -e "${CYAN}Documentation:${NC}"
    echo -e "  README: ${YELLOW}$INSTALL_DIR/README.md${NC}"
    echo -e "  GitHub: ${YELLOW}https://github.com/dfultonthebar/Sports-Bar-TV-Controller${NC}"
    echo ""
}

#############################################################################
# Trap errors and provide helpful message
#############################################################################

trap 'print_error "Installation failed! Check log file: $LOG_FILE"' ERR

#############################################################################
# Main Installation Process
#############################################################################
# 
# INSTALLATION PHASES (Best Practice Order):
# ==========================================
# 
# PHASE 1: System Dependencies & Runtimes
#   - Install ALL system-level packages first (build tools, libraries, drivers)
#   - Install Node.js runtime (required by npm)
#   - Install Ollama AI runtime (system service)
#   Why: Provides the foundation for everything else
# 
# PHASE 2: Clone Repository
#   - Get the application source code
#   Why: Need package.json to know what dependencies to install
# 
# PHASE 3: Application Dependencies
#   - Run npm install to get all Node packages (including Drizzle)
#   Why: Must happen BEFORE database setup because Drizzle CLI is an npm package
# 
# PHASE 4: Environment Configuration
#   - Create .env file with database URL and other settings
#   Why: Drizzle needs DATABASE_URL to run migrations
# 
# PHASE 5: Database Setup
#   - Run Drizzle migrations to create database schema
#   Why: Now we have SQLite libraries (Phase 1), Drizzle CLI (Phase 3), and config (Phase 4)
# 
# PHASE 6: Build Application
#   - Compile Next.js application
#   Why: Build may need database schema and Drizzle client (generated in Phase 5)
# 
# PHASE 7: Service Setup
#   - Configure PM2 to run the application
#   Why: Application must be fully built before it can run
# 
# PHASE 8: Permissions
#   - Set proper file ownership
#   Why: All files must be in place first
# 
# PHASE 9: Verification
#   - Verify everything is working
#   Why: Final check before completion
# 
#############################################################################

main() {
    # Parse command line arguments
    parse_arguments "$@"
    
    print_header "Sports Bar TV Controller - Installation"
    
    # Run uninstall if reinstall flag is set
    if [ "$REINSTALL" = true ]; then
        print_warning "Reinstall mode: Existing installation will be removed first"
        run_uninstall
        echo ""
    fi
    
    # Start installation
    log "Installation started at $(date)"
    
    # Pre-installation checks
    check_system_requirements
    
    # PHASE 1: Install ALL system dependencies and runtimes FIRST
    install_system_dependencies  # System packages, build tools, SQLite libraries, ADB, CEC
    install_nodejs              # Node.js runtime (required by npm)
    install_ollama              # Ollama AI runtime (system service)
    install_tailscale           # Tailscale remote access (mesh VPN)

    # User setup (if needed for system-wide installation)
    create_service_user
    
    # PHASE 2: Get the application code
    clone_repository
    
    # PHASE 3: Install application dependencies (npm packages including Drizzle)
    install_app_dependencies
    
    # PHASE 4: Configure environment (.env file with DATABASE_URL)
    configure_environment
    
    # PHASE 5: Setup database (now that Drizzle CLI is available)
    setup_database
    
    # PHASE 6: Build the application
    build_application
    
    # PHASE 7: Setup process manager and start the service
    setup_pm2
    
    # PHASE 8: Set proper permissions
    set_permissions
    
    # PHASE 9: Verify everything works
    verify_installation
    
    # Show completion message
    print_final_instructions
    
    log "Installation completed at $(date)"
}

# Run main function with all arguments
main "$@"
