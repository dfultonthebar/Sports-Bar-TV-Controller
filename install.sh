
#!/bin/bash

#############################################################################
# Sports Bar TV Controller - One-Click Installation Script
# 
# This script automates the complete installation of the Sports Bar TV 
# Controller application on a fresh Ubuntu/Debian system.
#
# Usage: sudo bash install.sh
#############################################################################

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Installation directory
INSTALL_DIR="/home/ubuntu/Sports-Bar-TV-Controller"
SERVICE_NAME="sportsbar-assistant"
REPO_URL="https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git"

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
    echo -e "${BLUE}ℹ $1${NC}"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then 
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_os() {
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
}

#############################################################################
# Installation Steps
#############################################################################

install_system_dependencies() {
    print_header "Installing System Dependencies"
    
    print_info "Updating package lists..."
    apt-get update -qq
    
    print_info "Installing required packages..."
    apt-get install -y -qq \
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
        lsb-release
    
    print_success "System dependencies installed"
}

install_nodejs() {
    print_header "Installing Node.js"
    
    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        print_warning "Node.js is already installed: $NODE_VERSION"
        
        # Check if version is acceptable (v18 or higher)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -ge 18 ]; then
            print_success "Node.js version is acceptable"
            return 0
        else
            print_warning "Node.js version is too old. Installing newer version..."
        fi
    fi
    
    print_info "Setting up NodeSource repository for Node.js 20.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    
    print_info "Installing Node.js..."
    apt-get install -y -qq nodejs
    
    NODE_VERSION=$(node -v)
    NPM_VERSION=$(npm -v)
    print_success "Node.js $NODE_VERSION and npm $NPM_VERSION installed"
}

clone_repository() {
    print_header "Cloning Repository"
    
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "Directory $INSTALL_DIR already exists"
        read -p "Do you want to remove it and clone fresh? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Removing existing directory..."
            rm -rf "$INSTALL_DIR"
        else
            print_info "Using existing directory..."
            return 0
        fi
    fi
    
    print_info "Cloning repository from $REPO_URL..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    
    # Set ownership to ubuntu user
    chown -R ubuntu:ubuntu "$INSTALL_DIR"
    
    print_success "Repository cloned to $INSTALL_DIR"
}

install_npm_packages() {
    print_header "Installing NPM Packages"
    
    cd "$INSTALL_DIR"
    
    print_info "Installing dependencies (this may take a few minutes)..."
    sudo -u ubuntu npm install --production=false
    
    print_success "NPM packages installed"
}

setup_database() {
    print_header "Setting Up Database"
    
    cd "$INSTALL_DIR"
    
    # Create data directory if it doesn't exist
    mkdir -p "$INSTALL_DIR/prisma/data"
    chown -R ubuntu:ubuntu "$INSTALL_DIR/prisma"
    
    print_info "Generating Prisma client..."
    sudo -u ubuntu npx prisma generate
    
    print_info "Running database migrations..."
    sudo -u ubuntu npx prisma migrate deploy || {
        print_warning "Migration failed, trying to push schema..."
        sudo -u ubuntu npx prisma db push --accept-data-loss
    }
    
    print_success "Database setup complete"
}

create_env_file() {
    print_header "Creating Environment Configuration"
    
    cd "$INSTALL_DIR"
    
    if [ -f ".env" ]; then
        print_warning ".env file already exists"
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Keeping existing .env file"
            return 0
        fi
    fi
    
    print_info "Creating .env file from template..."
    cp .env.example .env
    
    # Generate a random secret for NextAuth
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    sed -i "s/your-nextauth-secret-here/$NEXTAUTH_SECRET/" .env
    
    # Get the local IP address
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    if [ -n "$LOCAL_IP" ]; then
        sed -i "s|http://192.168.1.25:3000|http://$LOCAL_IP:3000|" .env
        print_info "Set NEXTAUTH_URL to http://$LOCAL_IP:3000"
    fi
    
    chown ubuntu:ubuntu .env
    chmod 600 .env
    
    print_success "Environment file created"
    print_warning "IMPORTANT: Edit $INSTALL_DIR/.env to add your API keys"
}

build_application() {
    print_header "Building Application"
    
    cd "$INSTALL_DIR"
    
    print_info "Building Next.js application..."
    sudo -u ubuntu npm run build
    
    print_success "Application built successfully"
}

install_systemd_service() {
    print_header "Installing Systemd Service"
    
    print_info "Copying service file..."
    cp "$INSTALL_DIR/sportsbar-assistant.service" "/etc/systemd/system/$SERVICE_NAME.service"
    
    print_info "Reloading systemd daemon..."
    systemctl daemon-reload
    
    print_info "Enabling service to start on boot..."
    systemctl enable "$SERVICE_NAME.service"
    
    print_success "Systemd service installed and enabled"
}

start_service() {
    print_header "Starting Application"
    
    print_info "Starting $SERVICE_NAME service..."
    systemctl start "$SERVICE_NAME.service"
    
    sleep 3
    
    if systemctl is-active --quiet "$SERVICE_NAME.service"; then
        print_success "Service started successfully"
    else
        print_error "Service failed to start"
        print_info "Checking service status..."
        systemctl status "$SERVICE_NAME.service" --no-pager
        return 1
    fi
}

#############################################################################
# Main Installation Flow
#############################################################################

main() {
    print_header "Sports Bar TV Controller - Installation"
    
    check_root
    check_os
    
    print_info "This script will install the Sports Bar TV Controller application"
    print_info "Installation directory: $INSTALL_DIR"
    echo
    read -p "Continue with installation? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        print_info "Installation cancelled"
        exit 0
    fi
    
    # Run installation steps
    install_system_dependencies
    install_nodejs
    clone_repository
    install_npm_packages
    setup_database
    create_env_file
    build_application
    install_systemd_service
    start_service
    
    # Print completion message
    print_header "Installation Complete!"
    
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    
    echo -e "${GREEN}✓ Sports Bar TV Controller has been successfully installed!${NC}\n"
    
    echo -e "${BLUE}Access the application at:${NC}"
    echo -e "  ${GREEN}http://$LOCAL_IP:3000${NC}"
    echo -e "  ${GREEN}http://localhost:3000${NC} (if accessing locally)\n"
    
    echo -e "${BLUE}Service Management Commands:${NC}"
    echo -e "  Start:   ${YELLOW}sudo systemctl start $SERVICE_NAME${NC}"
    echo -e "  Stop:    ${YELLOW}sudo systemctl stop $SERVICE_NAME${NC}"
    echo -e "  Restart: ${YELLOW}sudo systemctl restart $SERVICE_NAME${NC}"
    echo -e "  Status:  ${YELLOW}sudo systemctl status $SERVICE_NAME${NC}"
    echo -e "  Logs:    ${YELLOW}sudo journalctl -u $SERVICE_NAME -f${NC}\n"
    
    echo -e "${YELLOW}⚠ IMPORTANT NEXT STEPS:${NC}"
    echo -e "  1. Edit ${BLUE}$INSTALL_DIR/.env${NC} to add your API keys"
    echo -e "  2. Restart the service: ${YELLOW}sudo systemctl restart $SERVICE_NAME${NC}"
    echo -e "  3. Check the logs: ${YELLOW}sudo journalctl -u $SERVICE_NAME -f${NC}\n"
    
    echo -e "${BLUE}For more information, see:${NC}"
    echo -e "  ${GREEN}$INSTALL_DIR/README_INSTALLATION.md${NC}\n"
}

# Run main installation
main
