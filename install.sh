
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
LOG_FILE="/tmp/sportsbar-install-$(date +%Y%m%d-%H%M%S).log"

# Node.js version
NODE_VERSION="22"

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

# Reports whether a PM2-managed process is online. Used in 3 places after
# pm2 start to verify a specific service came up; warns (non-fatal) on miss
# so verify-install.sh in Phase 11 has the final say.
check_pm2_online() {
    local pm2_name=$1
    local description=${2:-$pm2_name}
    if pm2 list 2>/dev/null | grep -q "${pm2_name}.*online"; then
        log_and_print "${description} started successfully"
    else
        print_warning "${description} may not have started — check: pm2 logs ${pm2_name}"
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

    log_and_print "Installing all system packages (one apt-get pass)..."
    # build-essential + python3: native node-gyp modules
    # libsqlite3-dev: drizzle better-sqlite3 native binding
    # adb: Fire TV / Fire Cube control
    # cec-utils: HDMI-CEC control
    sudo apt-get install -y \
        curl wget git jq \
        build-essential python3 python3-pip \
        sqlite3 libsqlite3-dev \
        ca-certificates gnupg \
        adb cec-utils \
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
# Required AI Models (must match REQUIRED_MODELS array in download_ollama_models):
# - llama3.1:8b       : AI scheduling, gameplan suggestions (apps/web/src/app/api/scheduling/ai-suggest)
# - nomic-embed-text  : RAG vector embeddings (packages/rag-server)
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
    # Models match what production code in apps/web/src/* and packages/* expect
    # (see CLAUDE.md §RAG Documentation Server and §AI Scheduling Intelligence).
    # llama3.1:8b is what `ai-suggest/route.ts` and the RAG query engine use;
    # nomic-embed-text is the embedding model for the RAG vector store.
    local REQUIRED_MODELS=(
        "qwen2.5:14b|Primary model for AI Suggest scheduling (better reasoning than 8b at ~2x latency)"
        "llama3.1:8b|Fallback model + log analysis (kept for compatibility)"
        "nomic-embed-text|Embedding model for RAG documentation search"
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
        echo "  - AI Scheduling Suggestions (llama3.1:8b)"
        echo "  - RAG Documentation Search (nomic-embed-text)"
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
# Install Claude Code CLI
#############################################################################

install_claude_code() {
    print_header "Installing Claude Code CLI"

    if check_command claude; then
        print_success "Claude Code CLI is already installed"
        return 0
    fi

    log_and_print "Installing Claude Code CLI (native installer)..."
    curl -fsSL https://claude.ai/install.sh | sh >> "$LOG_FILE" 2>&1 || true

    if check_command claude; then
        print_success "Claude Code CLI installed"
    else
        # Try as the target user
        sudo -u "$SERVICE_USER" bash -c "curl -fsSL https://claude.ai/install.sh | sh" >> "$LOG_FILE" 2>&1 || true
        print_warning "Claude Code CLI install attempted — may need PATH update after login"
    fi
}

#############################################################################
# Install GitHub CLI
#############################################################################

install_github_cli() {
    print_header "Installing GitHub CLI"

    if check_command gh; then
        print_success "GitHub CLI is already installed"
        return 0
    fi

    log_and_print "Installing GitHub CLI (gh)..."
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg >> "$LOG_FILE" 2>&1 || true
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    # Timeout 60s — flaky GitHub mirror could hang the install indefinitely
    # otherwise. apt-get install -y inherits the same risk but at least the
    # base apt-get update is bounded.
    timeout 60 sudo apt-get update -qq >> "$LOG_FILE" 2>&1 || \
        print_warning "apt-get update for GitHub CLI repo timed out (60s) — gh install may fail"
    sudo apt-get install -y gh >> "$LOG_FILE" 2>&1

    if check_command gh; then
        print_success "GitHub CLI installed"
    else
        print_warning "GitHub CLI installation failed (non-fatal)"
    fi
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
    log_and_print "  Branch: $REPO_BRANCH"
    log_and_print "  Destination: $INSTALL_DIR"
    git clone --branch "$REPO_BRANCH" --progress "$REPO_URL" "$INSTALL_DIR" 2>&1 | tee -a "$LOG_FILE"

    if [ ! -d "$INSTALL_DIR/.git" ]; then
        print_error "Git clone failed! Check network connectivity."
        exit 1
    fi

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

    cd "$INSTALL_DIR" || { print_error "Cannot cd to $INSTALL_DIR"; exit 1; }

    log_and_print "Installing npm packages..."
    print_info "This may take a few minutes..."

    npm install 2>&1 | tail -10
    npm install -D tsx 2>&1 | tail -3

    # Verify drizzle-kit is available
    if npx drizzle-kit --version &>/dev/null; then
        print_success "Dependencies installed (drizzle-kit available)"
    else
        print_warning "drizzle-kit not found in node_modules — DB setup may fail"
    fi
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
        log_and_print "Creating .env file..."

        # Detect local IP for NEXTAUTH_URL
        local local_ip
        local_ip=$(ip -o -4 addr show | grep -v '127.0.0.1' | grep -E '(eth|enp|eno)' | awk '{print $4}' | cut -d/ -f1 | head -1)
        local_ip="${local_ip:-$(ip -o -4 addr show | grep -v '127.0.0.1' | awk '{print $4}' | cut -d/ -f1 | head -1)}"
        local_ip="${local_ip:-localhost}"

        cat > .env << ENVEOF
DATABASE_URL="file:${DATABASE_DIR}/production.db"
NODE_ENV=production
PORT=${PORT}
NEXTAUTH_URL=http://${local_ip}:${PORT}
OLLAMA_BASE_URL=http://localhost:11434
ENVEOF

        print_success "Environment configured"
        print_info "DATABASE_URL=file:${DATABASE_DIR}/production.db"
        print_info "NEXTAUTH_URL=http://${local_ip}:${PORT}"
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

    cd "$INSTALL_DIR" || { print_error "Cannot cd to $INSTALL_DIR"; exit 1; }

    # Create database directory
    mkdir -p "$DATABASE_DIR"

    # Export DATABASE_URL for drizzle-kit
    export DATABASE_URL="file:${DATABASE_DIR}/production.db"

    log_and_print "Applying database migrations..."
    log_and_print "  Database: ${DATABASE_DIR}/production.db"

    # v2.54.51+ — Use the canonical migrate flow (matches scripts/auto-update.sh).
    # Replaces drizzle-kit push which silently aborts on pre-existing indexes
    # (CLAUDE.md Gotcha #6 — caused the 2026-05-20 NeighborhoodEvent outage).
    local DB_PATH="${DATABASE_DIR}/production.db"

    # Step 1: bootstrap migration markers (idempotent). Only runs if the DB
    # already exists — on a true virgin install the DB is created by the
    # migrate step below and bootstrap is unnecessary.
    if [ -f "$DB_PATH" ]; then
        log_and_print "Bootstrapping drizzle migration markers..."
        if bash "$INSTALL_DIR/scripts/bootstrap-drizzle-migrations.sh" "$DB_PATH" 2>&1 | tee -a "$LOG_FILE"; then
            print_success "Migration markers bootstrapped"
        else
            print_error "bootstrap-drizzle-migrations.sh failed"
            echo "  Manual fix: cd $INSTALL_DIR && bash scripts/bootstrap-drizzle-migrations.sh $DB_PATH"
            return 1
        fi
    fi

    # Step 2: apply pending migrations (creates DB on virgin install)
    log_and_print "Applying pending Drizzle migrations..."
    if NODE_ENV=development npx drizzle-kit migrate 2>&1 | tee -a "$LOG_FILE"; then
        print_success "Database schema migrated"
    else
        print_error "drizzle-kit migrate failed. Trying once after wiping DB..."
        # Delete any partially-created DB and retry once
        rm -f "$DB_PATH"
        if NODE_ENV=development npx drizzle-kit migrate 2>&1 | tee -a "$LOG_FILE"; then
            print_success "Database schema migrated (retry)"
        else
            print_error "Database setup failed."
            echo "  Manual fix: cd $INSTALL_DIR && NODE_ENV=development npx drizzle-kit migrate"
            return 1
        fi
    fi

    # Step 3: belt-and-suspenders — run ensure-schema.sh to add any tables
    # or columns that the migration files might have missed. No-op when
    # migrations are complete.
    if [ -f "$INSTALL_DIR/scripts/ensure-schema.sh" ] && [ -f "$DB_PATH" ]; then
        log_and_print "Running ensure-schema.sh (belt-and-suspenders)..."
        bash "$INSTALL_DIR/scripts/ensure-schema.sh" "$DB_PATH" 2>&1 | tee -a "$LOG_FILE" || \
            print_warning "ensure-schema.sh reported issues (non-fatal — migrate is the source of truth)"
    fi

    # Verify DB exists
    if [ -f "${DATABASE_DIR}/production.db" ]; then
        local table_count
        table_count=$(sqlite3 "${DATABASE_DIR}/production.db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
        print_success "Database ready: ${table_count} tables"
    else
        print_warning "Database file not found — app will create on first run"
    fi
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

    cd "$INSTALL_DIR" || { print_error "Cannot cd to $INSTALL_DIR"; exit 1; }

    # Export DATABASE_URL — Next.js build reads it at compile time
    export DATABASE_URL="file:${DATABASE_DIR}/production.db"

    log_and_print "Building Next.js application (this takes a few minutes)..."
    if npm run build 2>&1 | tee -a "$LOG_FILE"; then
        print_success "Application built successfully"
    else
        print_error "Build failed! Check output above for errors."
        echo "  Manual fix: cd $INSTALL_DIR && npm run build"
        return 1
    fi
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

    cd "$INSTALL_DIR" || { print_error "Cannot cd to $INSTALL_DIR"; exit 1; }

    # Install PM2 globally if not present
    if ! check_command pm2; then
        log_and_print "Installing PM2..."
        sudo npm install -g pm2 2>&1 | tail -3

        if ! check_command pm2; then
            print_error "PM2 installation failed"
            exit 1
        fi
    fi
    log_and_print "PM2 version: $(pm2 --version)"

    # Stop any existing PM2 processes (clean slate before starting via
    # ecosystem.config.js below). `pm2 delete all` is idempotent — does
    # nothing if PM2 has no processes registered.
    pm2 delete all 2>/dev/null || true
    sleep 2

    # Verify port 3001 is actually free before starting
    if netstat -tuln 2>/dev/null | grep -q ":3001 " || ss -tuln 2>/dev/null | grep -q ":3001 "; then
        print_error "Port 3001 is still in use after cleanup!"
        print_error "Please manually check what's using port 3001:"
        echo "  sudo lsof -i :3001"
        echo "  sudo netstat -tulpn | grep :3001"
        exit 1
    fi

    # Install pm2-logrotate so PM2 logs don't grow unbounded.
    # Idempotent: re-running just confirms the module is present.
    if pm2 list 2>/dev/null | grep -q "pm2-logrotate"; then
        log_and_print "pm2-logrotate already installed"
    else
        log_and_print "Installing pm2-logrotate (10MB max, 7-day retention)..."
        pm2 install pm2-logrotate >> "$LOG_FILE" 2>&1 || print_warning "pm2-logrotate install had warnings"
        pm2 set pm2-logrotate:max_size 10M >> "$LOG_FILE" 2>&1 || true
        pm2 set pm2-logrotate:retain 7 >> "$LOG_FILE" 2>&1 || true
        pm2 set pm2-logrotate:compress true >> "$LOG_FILE" 2>&1 || true
    fi

    # Start application + bartender-proxy via ecosystem.config.js.
    # ecosystem.config.js is the single source of truth for PM2 process layout
    # (sports-bar-tv-controller on :3001 + bartender-proxy on :3002). Starting
    # it via `pm2 start ecosystem.config.js` brings both up together —
    # bartender-proxy is what serves the iPad-only UI on port 3002 and is
    # checked by verify-install.sh layer 4. Starting the next-server alone
    # leaves :3002 unbound and fails verify.
    log_and_print "Starting sports-bar-tv-controller + bartender-proxy via ecosystem.config.js..."
    pm2 start ecosystem.config.js >> "$LOG_FILE" 2>&1

    # Wait for apps to start before checking PM2 status
    sleep 5

    check_pm2_online "$SERVICE_NAME" "Application"
    check_pm2_online "bartender-proxy" "Bartender proxy (port 3002)"

    # Save PM2 configuration so `pm2 resurrect` brings these back on reboot
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

    # Check if application is running. (Phase 11 invokes verify-install.sh
    # which has its own port-bind wait, so we don't sleep here — the running
    # check is just a fast smoke test before the gate.)
    if pm2 list | grep -q "$SERVICE_NAME"; then
        print_success "Application is running"
    else
        print_error "Application is not running"
        return 1
    fi

    if netstat -tuln 2>/dev/null | grep -q ":3001 " || ss -tuln 2>/dev/null | grep -q ":3001 "; then
        print_success "Application is listening on port 3001"
    else
        print_warning "Application may not be listening on port 3001 yet"
    fi

    # Warn (non-fatal) if ANTHROPIC_API_KEY is missing — auto-update Checkpoints
    # A/B/C will fall back to Claude Code CLI subscription path which has a
    # monthly cap. All 6 fleet locations share the same key (per CLAUDE.md
    # §Standing Rule 8 + VERSION_SETUP_GUIDE v2.32.20).
    if ! grep -q '^ANTHROPIC_API_KEY=' "$INSTALL_DIR/.env" 2>/dev/null; then
        print_warning "ANTHROPIC_API_KEY not set in .env"
        print_warning "  Auto-update will fall back to Claude Code CLI (monthly cap risk)."
        print_warning "  Add it via the canonical .env writer:"
        print_warning "    bash scripts/bootstrap-new-location.sh --anthropic-api-key sk-ant-..."
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
    echo -e "  • ${GREEN}✓ Gotcha #11 hardening applied (linger, node, ollama)${NC} — see PHASE 12 in install log"
    echo ""

    echo -e "${CYAN}REQUIRED NEXT STEP — auth bootstrap (PHASE 13):${NC}"
    echo -e "  Without this, every login attempt returns 'Invalid PIN'."
    echo -e "  Seeds the Location row, AuthPin rows, and LOCATION_ID/.env binding."
    echo ""
    echo -e "  ${YELLOW}cd $INSTALL_DIR${NC}"
    echo -e "  ${YELLOW}bash scripts/bootstrap-new-location.sh \\${NC}"
    echo -e "  ${YELLOW}    --name \"Your Bar Name\" \\${NC}"
    echo -e "  ${YELLOW}    --admin-pin <4-digit-PIN> \\${NC}"
    echo -e "  ${YELLOW}    --staff-pin <4-digit-PIN> \\${NC}"
    echo -e "  ${YELLOW}    --anthropic-api-key sk-ant-... \\${NC}"
    echo -e "  ${YELLOW}    --create-branch${NC}"
    echo ""
    echo -e "  Then restart PM2 to pick up the new env:"
    echo -e "  ${YELLOW}pm2 restart sports-bar-tv-controller --update-env${NC}"
    echo ""
    echo -e "  Then re-run verify-install:"
    echo -e "  ${YELLOW}bash scripts/verify-install.sh${NC}    # expect PASS 7/7"
    echo ""

    echo -e "${CYAN}Auto-update timer (after Sync tab is configured):${NC}"
    echo -e "  Enable in UI: ${YELLOW}/system-admin?tab=sync${NC}, toggle Auto Update Enabled, Save"
    echo -e "  Install timer: ${YELLOW}bash scripts/install-auto-update-timer.sh${NC}"
    echo -e "  (Linger already enabled by PHASE 12 hardening — timer survives reboots.)"
    echo ""

    echo -e "${CYAN}Optional — migrate from an existing location:${NC}"
    echo -e "  ${YELLOW}./scripts/new-location-setup.sh --migrate-from <tailscale-ip>${NC}"
    echo -e "  ${YELLOW}./scripts/post-install-setup.sh${NC}    # network device discovery"
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
# PHASE 10: Post-Install Setup
#############################################################################
# Runs the new-location-setup.sh script to configure:
# - PM2 logrotate (log rotation for production)
# - NEXTAUTH_URL (auto-detect local IP)
# - Database backup script and crontab
# - Memory monitor crontab
#############################################################################

run_post_install_setup() {
    print_header "PHASE 10: Post-Install Configuration"

    local setup_script="$INSTALL_DIR/scripts/new-location-setup.sh"

    if [ -f "$setup_script" ]; then
        chmod +x "$setup_script"
        log_and_print "Running new-location-setup.sh..."
        # Run non-interactively (skip LVM prompt and data migration)
        bash "$setup_script" 2>&1 | tee -a "$LOG_FILE" || {
            print_warning "Post-install setup had warnings (non-fatal)"
        }
    else
        print_warning "Post-install script not found at $setup_script"
        print_info "Run manually after install: ./scripts/new-location-setup.sh"
    fi
}

#############################################################################
# PHASE 11: Run verify-install.sh as the install gate
#############################################################################
# verify-install.sh is the canonical post-install/post-update health check.
# It's the same script auto-update.sh runs at Checkpoint C. Running it here
# turns the install into a pass/fail gate: if any of the 7 layers fail
# (PM2 online, /api/system/health, /api/system/metrics, bartender proxy,
# critical DB tables, matrix config sanity, no recent crash patterns),
# the operator sees a clear PASS/FAIL summary instead of a silent half-broken
# install. We do NOT exit non-zero on FAIL — at this stage the auth bootstrap
# has not been run yet (it requires interactive PIN entry), so layers like
# health_http will warn rather than fail. The point is to surface what's
# missing so the operator knows what to do next.
#############################################################################

run_install_verify() {
    print_header "PHASE 11: Install Verification (verify-install.sh)"

    local verify_script="$INSTALL_DIR/scripts/verify-install.sh"

    if [ ! -f "$verify_script" ]; then
        print_warning "verify-install.sh not found at $verify_script — skipping"
        return 0
    fi

    chmod +x "$verify_script"

    # Give PM2 + Next.js a moment to bind ports and warm up routes before
    # we start hitting them. New-install boot is slower than auto-update
    # restart because the JIT cache is empty.
    log_and_print "Waiting 10s for app routes to warm up before verifying..."
    sleep 10

    log_and_print "Running verify-install.sh..."
    if bash "$verify_script" 2>&1 | tee -a "$LOG_FILE"; then
        print_success "Install verification PASSED"
    else
        # Non-fatal at install time — auth bootstrap (Phase 13, manual) hasn't
        # run yet, and the operator may still need to populate location data.
        # The operator-facing "Next steps" output below tells them what to do.
        print_warning "Install verification reported failures (see above)."
        print_warning "Most likely cause on a fresh install: auth bootstrap"
        print_warning "(scripts/bootstrap-new-location.sh) hasn't been run yet."
        print_warning "See PHASE 13 in the Next Steps below."
    fi
}

#############################################################################
# PHASE 12: Gotcha #11 hardening (linger, node symlinks, ollama perms)
#############################################################################
# Closes the four CLAUDE.md Gotcha #11 install-time gaps that cause
# auto-update / RAG rescan / scheduler timers to silently die on a fresh
# Ubuntu box. Idempotent — re-running on a hardened box is a no-op.
#
# Items applied:
#   1. loginctl enable-linger ubuntu (user timers survive without SSH)
#   2. Symlink NVM node/npm/npx into /usr/local/bin (systemd PATH fix)
#   3. ubuntu in ollama group + models-dir g+w (ollama pull works)
#   4. Proof step: verify all three from a clean-PATH subprocess view
#
# Non-fatal on failure — the rest of the install is still useful and the
# operator can re-run the hardening script manually. Distinct exit codes
# (2/3/4/5) from the hardening script let us surface WHICH item failed.
#############################################################################

run_gotcha11_hardening() {
    print_header "PHASE 12: Gotcha #11 hardening (linger, node, ollama)"

    local hardening_script="$INSTALL_DIR/scripts/enforce-gotcha11-hardening.sh"

    if [ ! -f "$hardening_script" ]; then
        print_warning "enforce-gotcha11-hardening.sh not found at $hardening_script — skipping"
        print_warning "  Apply Gotcha #11 items manually per CLAUDE.md §Gotcha #11"
        return 0
    fi

    chmod +x "$hardening_script"

    log_and_print "Running enforce-gotcha11-hardening.sh (requires sudo)..."
    # Script is root-required. sudo -E preserves env in case the script
    # ever needs to read INSTALL_DIR or PATH from us.
    local hardening_rc=0
    sudo -E bash "$hardening_script" 2>&1 | tee -a "$LOG_FILE" || hardening_rc=$?

    if [ "$hardening_rc" -eq 0 ]; then
        print_success "Gotcha #11 hardening applied (linger, node, ollama)"
    else
        # Map the script's exit codes to operator-actionable hints. See
        # script header for the full code table.
        case "$hardening_rc" in
            1) print_warning "Gotcha #11 hardening: must run as root (rc=1) — re-run manually with sudo" ;;
            2) print_warning "Gotcha #11 hardening: linger enforcement failed (rc=2)" ;;
            3) print_warning "Gotcha #11 hardening: node symlink enforcement failed (rc=3)" ;;
            4) print_warning "Gotcha #11 hardening: ollama perms enforcement failed (rc=4)" ;;
            5) print_warning "Gotcha #11 hardening: proof step caught a regression (rc=5)" ;;
            *) print_warning "Gotcha #11 hardening exited with rc=$hardening_rc" ;;
        esac
        print_warning "  Re-run manually:  sudo bash $hardening_script"
        print_warning "  (Non-fatal — the rest of the install is still usable.)"
    fi

    # Lightweight post-hardening proof: print linger state so the operator
    # can see at a glance whether the most-common Gotcha #11 failure mode
    # (Linger=no) was actually fixed. The full proof step ran inside the
    # script above; this is just a one-line summary for the install log.
    local linger_line
    linger_line=$(loginctl show-user ubuntu 2>/dev/null | grep -E '^Linger=' || echo "Linger=unknown")
    log_and_print "Post-hardening: $linger_line"
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
    install_claude_code         # Claude Code CLI (AI assistant)
    install_github_cli          # GitHub CLI (gh)

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
    
    # PHASE 10: Post-install setup (PM2 logrotate, crontab, NEXTAUTH_URL)
    run_post_install_setup

    # PHASE 11: Install verification (verify-install.sh — the install gate)
    run_install_verify

    # PHASE 12: Gotcha #11 hardening (linger, node symlinks, ollama perms).
    # Runs AFTER verify-install so the operator sees both "verify result"
    # and "hardening result" in the same install log, in that order.
    run_gotcha11_hardening

    # Show completion message
    print_final_instructions

    log "Installation completed at $(date)"
}

# Run main function with all arguments
main "$@"
