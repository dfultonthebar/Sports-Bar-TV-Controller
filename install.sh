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
#############################################################################

set -e  # Exit on any error
set -o pipefail  # Catch errors in pipes

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Installation configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/sports-bar-tv-controller}"
SERVICE_NAME="sportsbar-assistant"
REPO_URL="https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git"
REPO_BRANCH="${REPO_BRANCH:-main}"
LOG_FILE="/tmp/sportsbar-install-$(date +%Y%m%d-%H%M%S).log"

# Node.js version
NODE_VERSION="20"

# System user for running the service
SERVICE_USER="${SERVICE_USER:-sportsbar}"

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

check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root. This is acceptable but not required."
        print_info "The script will create a dedicated service user if needed."
        IS_ROOT=true
    else
        print_info "Running as non-root user. Will use sudo for privileged operations."
        IS_ROOT=false
        
        # Check if sudo is available
        if ! check_command sudo; then
            print_error "sudo is not available. Please run as root or install sudo."
            exit 1
        fi
        
        # Check if user has sudo privileges
        if ! sudo -n true 2>/dev/null; then
            print_warning "This script requires sudo privileges for system operations."
            print_info "You may be prompted for your password."
            sudo -v || {
                print_error "Failed to obtain sudo privileges."
                exit 1
            }
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
    
    # Check available disk space (require at least 2GB)
    AVAILABLE_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -lt 2 ]; then
        print_warning "Low disk space detected: ${AVAILABLE_SPACE}GB available"
        print_warning "At least 2GB is recommended for installation"
        if ! prompt_yes_no "Continue anyway?"; then
            exit 1
        fi
    else
        print_success "Sufficient disk space: ${AVAILABLE_SPACE}GB available"
    fi
    
    # Check memory (recommend at least 1GB)
    TOTAL_MEM=$(free -g | awk 'NR==2 {print $2}')
    if [ "$TOTAL_MEM" -lt 1 ]; then
        print_warning "Low memory detected: ${TOTAL_MEM}GB total"
        print_warning "At least 1GB RAM is recommended"
    else
        print_success "Memory: ${TOTAL_MEM}GB total"
    fi
}

check_existing_installation() {
    print_header "Checking for Existing Installation"
    
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "Installation directory already exists: $INSTALL_DIR"
        
        if prompt_yes_no "Remove existing installation and start fresh?"; then
            print_info "Backing up existing installation..."
            BACKUP_DIR="${INSTALL_DIR}.backup.$(date +%Y%m%d-%H%M%S)"
            run_as_root mv "$INSTALL_DIR" "$BACKUP_DIR"
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
}

install_system_dependencies() {
    print_header "Installing System Dependencies"
    
    print_info "Updating package lists..."
    run_as_root apt-get update -qq
    log "Package lists updated"
    
    print_info "Installing required packages..."
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
        cec-utils 2>&1 | tee -a "$LOG_FILE" > /dev/null
    
    print_success "System dependencies installed"
    log "System dependencies installed successfully"
}

install_nodejs() {
    print_header "Installing Node.js"
    
    if check_command node; then
        CURRENT_NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$CURRENT_NODE_VERSION" -ge "$NODE_VERSION" ]; then
            print_success "Node.js $(node -v) is already installed"
            log "Node.js $(node -v) already installed"
            return
        else
            print_warning "Node.js $(node -v) is installed but version $NODE_VERSION is required"
            print_info "Upgrading Node.js..."
        fi
    fi
    
    print_info "Installing Node.js $NODE_VERSION using NodeSource repository..."
    
    # Install Node.js using NodeSource repository (globally available)
    # This ensures npm is available to all users including the service user
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | run_as_root bash - >> "$LOG_FILE" 2>&1
    run_as_root apt-get install -y nodejs >> "$LOG_FILE" 2>&1
    
    # Verify installation
    if check_command node && check_command npm; then
        print_success "Node.js $(node -v) and npm $(npm -v) installed successfully"
        log "Node.js $(node -v) and npm $(npm -v) installed"
        
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
    else
        print_error "Failed to install Node.js"
        exit 1
    fi
}

create_service_user() {
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
    
    # Add user to required groups
    print_info "Adding user to required groups..."
    run_as_root usermod -a -G plugdev,dialout "$SERVICE_USER" 2>/dev/null || true
    print_success "User groups configured"
}

clone_repository() {
    print_header "Cloning Repository"
    
    print_info "Cloning from $REPO_URL (branch: $REPO_BRANCH)..."
    
    # Create parent directory if it doesn't exist
    run_as_root mkdir -p "$(dirname "$INSTALL_DIR")"
    
    # Clone repository
    run_as_root git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR" >> "$LOG_FILE" 2>&1
    
    if [ -d "$INSTALL_DIR" ]; then
        print_success "Repository cloned successfully"
        log "Repository cloned to $INSTALL_DIR"
        
        # Set ownership
        run_as_root chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
        print_success "Ownership set to $SERVICE_USER"
    else
        print_error "Failed to clone repository"
        exit 1
    fi
}

install_npm_dependencies() {
    print_header "Installing NPM Dependencies"
    
    cd "$INSTALL_DIR"
    
    print_info "Installing Node.js packages (this may take a few minutes)..."
    
    # Run npm install as service user
    if [ "$IS_ROOT" = true ]; then
        su - "$SERVICE_USER" -c "cd $INSTALL_DIR && npm install --production" >> "$LOG_FILE" 2>&1
    else
        sudo -u "$SERVICE_USER" bash -c "cd $INSTALL_DIR && npm install --production" >> "$LOG_FILE" 2>&1
    fi
    
    print_success "NPM dependencies installed"
    log "NPM dependencies installed"
}

setup_database() {
    print_header "Setting Up Database"
    
    cd "$INSTALL_DIR"
    
    # Create data directory
    print_info "Creating database directory..."
    run_as_root mkdir -p "$INSTALL_DIR/data"
    run_as_root chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/data"
    
    # Run Prisma migrations
    print_info "Running database migrations..."
    if [ "$IS_ROOT" = true ]; then
        su - "$SERVICE_USER" -c "cd $INSTALL_DIR && npx prisma migrate deploy" >> "$LOG_FILE" 2>&1
    else
        sudo -u "$SERVICE_USER" bash -c "cd $INSTALL_DIR && npx prisma migrate deploy" >> "$LOG_FILE" 2>&1
    fi
    
    print_success "Database initialized"
    log "Database initialized"
}

create_env_file() {
    print_header "Creating Environment Configuration"
    
    ENV_FILE="$INSTALL_DIR/.env"
    
    if [ -f "$ENV_FILE" ]; then
        print_warning ".env file already exists"
        if ! prompt_yes_no "Overwrite existing .env file?"; then
            print_info "Keeping existing .env file"
            return
        fi
    fi
    
    print_info "Creating .env file from template..."
    
    # Copy example file
    run_as_root cp "$INSTALL_DIR/.env.example" "$ENV_FILE"
    
    # Generate random secret for NextAuth
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    
    # Get local IP address
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    
    # Update .env file with generated values
    run_as_root sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"|" "$ENV_FILE"
    run_as_root sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=\"http://${LOCAL_IP}:3000\"|" "$ENV_FILE"
    run_as_root sed -i "s|NODE_ENV=.*|NODE_ENV=\"production\"|" "$ENV_FILE"
    
    run_as_root chown "$SERVICE_USER:$SERVICE_USER" "$ENV_FILE"
    run_as_root chmod 600 "$ENV_FILE"
    
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
}

build_application() {
    print_header "Building Application"
    
    cd "$INSTALL_DIR"
    
    print_info "Building Next.js application (this may take several minutes)..."
    
    if [ "$IS_ROOT" = true ]; then
        su - "$SERVICE_USER" -c "cd $INSTALL_DIR && npm run build" >> "$LOG_FILE" 2>&1
    else
        sudo -u "$SERVICE_USER" bash -c "cd $INSTALL_DIR && npm run build" >> "$LOG_FILE" 2>&1
    fi
    
    print_success "Application built successfully"
    log "Application built"
}

setup_systemd_service() {
    print_header "Setting Up Systemd Service"
    
    if ! prompt_yes_no "Set up systemd service for auto-start on boot?" "y"; then
        print_info "Skipping systemd service setup"
        return
    fi
    
    print_info "Creating systemd service file..."
    
    SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
    
    run_as_root tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Sports Bar TV Controller
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

    run_as_root chmod 644 "$SERVICE_FILE"
    
    print_info "Reloading systemd daemon..."
    run_as_root systemctl daemon-reload
    
    print_info "Enabling service..."
    run_as_root systemctl enable "$SERVICE_NAME"
    
    print_success "Systemd service configured"
    log "Systemd service configured"
    
    if prompt_yes_no "Start the service now?" "y"; then
        print_info "Starting service..."
        run_as_root systemctl start "$SERVICE_NAME"
        sleep 3
        
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            print_success "Service started successfully"
            log "Service started"
        else
            print_error "Service failed to start"
            print_info "Check logs with: sudo journalctl -u $SERVICE_NAME -f"
        fi
    fi
}

configure_firewall() {
    print_header "Configuring Firewall"
    
    if ! check_command ufw; then
        print_info "UFW firewall not installed, skipping firewall configuration"
        return
    fi
    
    if ! run_as_root ufw status | grep -q "Status: active"; then
        print_info "UFW firewall is not active, skipping firewall configuration"
        return
    fi
    
    if prompt_yes_no "Configure firewall to allow port 3000?" "y"; then
        print_info "Adding firewall rule for port 3000..."
        run_as_root ufw allow 3000/tcp >> "$LOG_FILE" 2>&1
        print_success "Firewall configured"
        log "Firewall rule added for port 3000"
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
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo -e "\n${CYAN}Installation Details:${NC}"
    echo -e "  Installation Directory: ${GREEN}$INSTALL_DIR${NC}"
    echo -e "  Service User: ${GREEN}$SERVICE_USER${NC}"
    echo -e "  Log File: ${GREEN}$LOG_FILE${NC}"
    
    echo -e "\n${CYAN}Access Your Application:${NC}"
    echo -e "  Local: ${GREEN}http://localhost:3000${NC}"
    echo -e "  Network: ${GREEN}http://${LOCAL_IP}:3000${NC}"
    
    echo -e "\n${CYAN}Service Management:${NC}"
    echo -e "  Start:   ${GREEN}sudo systemctl start $SERVICE_NAME${NC}"
    echo -e "  Stop:    ${GREEN}sudo systemctl stop $SERVICE_NAME${NC}"
    echo -e "  Restart: ${GREEN}sudo systemctl restart $SERVICE_NAME${NC}"
    echo -e "  Status:  ${GREEN}sudo systemctl status $SERVICE_NAME${NC}"
    echo -e "  Logs:    ${GREEN}sudo journalctl -u $SERVICE_NAME -f${NC}"
    
    echo -e "\n${YELLOW}⚠ IMPORTANT NEXT STEPS:${NC}"
    echo -e "  1. Configure API keys in: ${GREEN}$INSTALL_DIR/.env${NC}"
    echo -e "  2. Restart the service after configuration: ${GREEN}sudo systemctl restart $SERVICE_NAME${NC}"
    echo -e "  3. Access the web interface and complete initial setup"
    
    echo -e "\n${CYAN}Required API Keys:${NC}"
    echo -e "  • ANTHROPIC_API_KEY - For AI assistant features"
    echo -e "  • SOUNDTRACK_API_KEY - For music control"
    echo -e "  • GITHUB_TOKEN - For remote updates"
    
    echo -e "\n${CYAN}Optional Features:${NC}"
    echo -e "  • Sports data APIs (ESPN, SportsRadar)"
    echo -e "  • TV guide APIs (Spectrum, Gracenote)"
    echo -e "  • Local AI (Ollama) - Run: ${GREEN}$INSTALL_DIR/install-ollama.sh${NC}"
    
    echo -e "\n${CYAN}Documentation:${NC}"
    echo -e "  • Installation Guide: ${GREEN}$INSTALL_DIR/INSTALLATION.md${NC}"
    echo -e "  • Deployment Guide: ${GREEN}$INSTALL_DIR/DEPLOYMENT_INSTRUCTIONS.md${NC}"
    echo -e "  • README: ${GREEN}$INSTALL_DIR/README.md${NC}"
    
    echo -e "\n${CYAN}Support:${NC}"
    echo -e "  • GitHub: ${GREEN}https://github.com/dfultonthebar/Sports-Bar-TV-Controller${NC}"
    echo -e "  • Issues: ${GREEN}https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues${NC}"
    
    echo -e "\n${GREEN}Thank you for installing Sports Bar TV Controller!${NC}\n"
    
    log "Installation completed successfully"
}

#############################################################################
# Main Installation Flow
#############################################################################

main() {
    clear
    
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║        Sports Bar TV Controller - Installation Script         ║"
    echo "║                                                                ║"
    echo "║  This script will install all required dependencies and       ║"
    echo "║  set up the Sports Bar TV Controller application.             ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"
    
    log "Installation started"
    log "Installation directory: $INSTALL_DIR"
    log "Repository: $REPO_URL (branch: $REPO_BRANCH)"
    
    # Pre-installation checks
    check_root
    check_os
    check_existing_installation
    
    # System setup
    install_system_dependencies
    install_nodejs
    create_service_user
    
    # Application setup
    clone_repository
    install_npm_dependencies
    setup_database
    create_env_file
    build_application
    
    # Service setup
    setup_systemd_service
    configure_firewall
    
    # Completion
    print_completion_message
}

# Trap errors and provide helpful message
trap 'print_error "Installation failed! Check log file: $LOG_FILE"; log "Installation failed with error"; exit 1' ERR

# Run main installation
main "$@"
