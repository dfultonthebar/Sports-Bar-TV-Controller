
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
SERVICE_NAME="sportsbar-assistant"
REPO_URL="https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git"
REPO_BRANCH="${REPO_BRANCH:-main}"
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
# Install System Dependencies
#############################################################################

install_system_dependencies() {
    print_header "Installing System Dependencies"
    
    log_and_print "Updating package lists..."
    sudo apt-get update >> "$LOG_FILE" 2>&1
    
    log_and_print "Installing required packages..."
    sudo apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        python3-pip \
        sqlite3 \
        >> "$LOG_FILE" 2>&1
    
    print_success "System dependencies installed"
}

#############################################################################
# Install Node.js
#############################################################################

install_nodejs() {
    print_header "Installing Node.js"
    
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
# Install Ollama
#############################################################################

install_ollama() {
    print_header "Installing Ollama"
    
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
    sleep 5
    
    # Pull required models
    print_info "Pulling required AI models (this may take a while)..."
    
    log_and_print "Pulling llama3.2:3b model..."
    ollama pull llama3.2:3b >> "$LOG_FILE" 2>&1 &
    local pull_pid=$!
    
    # Show progress
    while kill -0 $pull_pid 2>/dev/null; do
        echo -n "."
        sleep 2
    done
    echo ""
    
    wait $pull_pid
    print_success "AI models installed"
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
# Clone Repository
#############################################################################

clone_repository() {
    print_header "Cloning Repository"
    
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
# Install Application Dependencies
#############################################################################

install_app_dependencies() {
    print_header "Installing Application Dependencies"
    
    cd "$INSTALL_DIR"
    
    log_and_print "Installing npm packages..."
    npm install >> "$LOG_FILE" 2>&1
    
    print_success "Application dependencies installed"
}

#############################################################################
# Setup Database
#############################################################################

setup_database() {
    print_header "Setting Up Database"
    
    cd "$INSTALL_DIR"
    
    # Create database directory
    mkdir -p prisma/data
    
    log_and_print "Running database migrations..."
    npx prisma migrate deploy >> "$LOG_FILE" 2>&1
    
    log_and_print "Generating Prisma client..."
    npx prisma generate >> "$LOG_FILE" 2>&1
    
    print_success "Database setup complete"
}

#############################################################################
# Configure Environment
#############################################################################

configure_environment() {
    print_header "Configuring Environment"
    
    cd "$INSTALL_DIR"
    
    if [ ! -f .env ]; then
        log_and_print "Creating .env file from template..."
        cp .env.example .env
        
        # Set default values
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"file:./prisma/data/sports_bar.db\"|g" .env
        sed -i "s|OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=\"http://localhost:11434\"|g" .env
        
        print_success "Environment configured"
    else
        print_info ".env file already exists, skipping"
    fi
}

#############################################################################
# Build Application
#############################################################################

build_application() {
    print_header "Building Application"
    
    cd "$INSTALL_DIR"
    
    log_and_print "Building Next.js application..."
    npm run build >> "$LOG_FILE" 2>&1
    
    print_success "Application built successfully"
}

#############################################################################
# Setup PM2
#############################################################################

setup_pm2() {
    print_header "Setting Up PM2 Process Manager"
    
    # Install PM2 globally if not already installed
    if ! check_command pm2; then
        log_and_print "Installing PM2..."
        sudo npm install -g pm2 >> "$LOG_FILE" 2>&1
    fi
    
    cd "$INSTALL_DIR"
    
    # Stop any existing PM2 processes
    pm2 stop all >> "$LOG_FILE" 2>&1 || true
    pm2 delete all >> "$LOG_FILE" 2>&1 || true
    
    # Start application with PM2
    log_and_print "Starting application with PM2..."
    pm2 start npm --name "$SERVICE_NAME" -- start >> "$LOG_FILE" 2>&1
    
    # Save PM2 configuration
    pm2 save >> "$LOG_FILE" 2>&1
    
    # Setup PM2 startup script
    pm2 startup >> "$LOG_FILE" 2>&1 || true
    
    print_success "PM2 configured and application started"
}

#############################################################################
# Set Permissions
#############################################################################

set_permissions() {
    if [ "$USE_SERVICE_USER" = false ]; then
        return 0
    fi
    
    print_header "Setting Permissions"
    
    log_and_print "Setting ownership to $SERVICE_USER..."
    sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" >> "$LOG_FILE" 2>&1
    
    print_success "Permissions set"
}

#############################################################################
# Verify Installation
#############################################################################

verify_installation() {
    print_header "Verifying Installation"
    
    # Check if application is running
    if pm2 list | grep -q "$SERVICE_NAME"; then
        print_success "Application is running"
    else
        print_error "Application is not running"
        return 1
    fi
    
    # Check if port 3000 is listening
    sleep 5
    if netstat -tuln 2>/dev/null | grep -q ":3000 " || ss -tuln 2>/dev/null | grep -q ":3000 "; then
        print_success "Application is listening on port 3000"
    else
        print_warning "Application may not be listening on port 3000 yet"
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
    echo -e "  Web Interface: ${YELLOW}http://localhost:3000${NC}"
    echo -e "  Admin Panel: ${YELLOW}http://localhost:3000/admin${NC}"
    echo ""
    
    echo -e "${CYAN}Useful Commands:${NC}"
    echo -e "  View logs: ${YELLOW}pm2 logs $SERVICE_NAME${NC}"
    echo -e "  Restart app: ${YELLOW}pm2 restart $SERVICE_NAME${NC}"
    echo -e "  Stop app: ${YELLOW}pm2 stop $SERVICE_NAME${NC}"
    echo -e "  App status: ${YELLOW}pm2 status${NC}"
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
    
    check_system_requirements
    install_system_dependencies
    install_nodejs
    install_ollama
    create_service_user
    clone_repository
    install_app_dependencies
    setup_database
    configure_environment
    build_application
    setup_pm2
    set_permissions
    verify_installation
    print_final_instructions
    
    log "Installation completed at $(date)"
}

# Run main function with all arguments
main "$@"
