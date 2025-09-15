
#!/bin/bash

# Sports Bar TV Controller - Enhanced Installation Script
# This is an improved version of the original install.sh with fixes for hanging issues
# Key improvements:
# 1. Timeout protection for npm operations
# 2. Better git conflict resolution
# 3. Multiple installation strategies
# 4. Enhanced error handling and recovery

set -e

# Source the fixes
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/install_fixes.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/sportsbar"
SERVICE_USER="sportsbar"
SERVICE_GROUP="sportsbar"
PYTHON_VERSION="3.11"
NODE_VERSION="18"
AI_CHAT_PORT="3001"
AI_MONITORING_PORT="3002"

# Logging
LOG_FILE="/var/log/sportsbar-install.log"
AI_LOG_FILE="/var/log/sportsbar-ai-monitor.log"

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
    ai_notify "info" "$1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
    ai_notify "warning" "$1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    ai_notify "error" "$1"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
    ai_notify "info" "$1"
}

ai_log() {
    echo -e "${PURPLE}[$(date '+%Y-%m-%d %H:%M:%S')] AI: $1${NC}" | tee -a "$AI_LOG_FILE"
}

ai_notify() {
    local level="$1"
    local message="$2"
    if command -v curl >/dev/null 2>&1 && nc -z localhost "$AI_MONITORING_PORT" 2>/dev/null; then
        curl -s -X POST "http://localhost:$AI_MONITORING_PORT/notify" \
            -H "Content-Type: application/json" \
            -d "{\"level\":\"$level\",\"message\":\"$message\",\"timestamp\":\"$(date -Iseconds)\"}" \
            >/dev/null 2>&1 || true
    fi
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Check system requirements
check_system() {
    log "Checking system requirements..."
    
    # Check OS
    if [[ ! -f /etc/os-release ]]; then
        error "Cannot determine OS version"
    fi
    
    source /etc/os-release
    if [[ "$ID" != "ubuntu" ]] && [[ "$ID" != "debian" ]]; then
        warn "This script is designed for Ubuntu/Debian. Other distributions may not work correctly."
    fi
    
    # Check architecture
    ARCH=$(uname -m)
    if [[ "$ARCH" != "x86_64" ]] && [[ "$ARCH" != "aarch64" ]] && [[ "$ARCH" != "armv7l" ]]; then
        warn "Architecture $ARCH may not be fully supported"
    fi
    
    # Check available memory
    MEMORY_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    MEMORY_GB=$((MEMORY_KB / 1024 / 1024))
    if [[ $MEMORY_GB -lt 2 ]]; then
        warn "System has less than 2GB RAM. Performance may be affected."
    fi
    
    log "System check completed - OS: $PRETTY_NAME, Arch: $ARCH, RAM: ${MEMORY_GB}GB"
}

# Update system packages
update_system() {
    log "Updating system packages..."
    apt-get update -y
    apt-get upgrade -y
    apt-get install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates
}

# Install Python and dependencies
install_python() {
    log "Installing Python $PYTHON_VERSION and dependencies..."
    
    # Add deadsnakes PPA for latest Python versions
    add-apt-repository ppa:deadsnakes/ppa -y
    apt-get update -y
    
    # Install Python and essential packages
    apt-get install -y \
        python${PYTHON_VERSION} \
        python${PYTHON_VERSION}-dev \
        python${PYTHON_VERSION}-venv \
        python3-pip \
        python3-setuptools \
        python3-wheel \
        build-essential \
        libffi-dev \
        libssl-dev \
        libyaml-dev \
        libxml2-dev \
        libxslt1-dev \
        zlib1g-dev
    
    # Create symlinks for python3 if needed
    if [[ ! -f /usr/bin/python3 ]]; then
        ln -sf /usr/bin/python${PYTHON_VERSION} /usr/bin/python3
    fi
    
    # Upgrade pip
    python3 -m pip install --upgrade pip setuptools wheel
    
    log "Python installation completed"
}

# Install Node.js and npm
install_nodejs() {
    log "Installing Node.js $NODE_VERSION..."
    
    # Install NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    
    # Install global packages with timeout protection
    log "Installing global npm packages..."
    timeout 120 npm install -g pm2 yarn || {
        warn "Global npm install timed out, trying individual packages..."
        timeout 60 npm install -g pm2 || warn "Failed to install pm2"
        timeout 60 npm install -g yarn || warn "Failed to install yarn"
    }
    
    log "Node.js installation completed - Version: $(node --version)"
}

# Install system dependencies
install_system_deps() {
    log "Installing system dependencies..."
    
    apt-get install -y \
        nginx \
        redis-server \
        git \
        htop \
        iotop \
        net-tools \
        ufw \
        fail2ban \
        logrotate \
        supervisor \
        sqlite3 \
        libsqlite3-dev \
        postgresql-client \
        mysql-client \
        ffmpeg \
        imagemagick \
        curl \
        wget \
        unzip \
        zip \
        rsync \
        cron \
        systemd \
        dbus
    
    log "System dependencies installed"
}

# Create service user and directories
setup_user_and_dirs() {
    log "Setting up service user and directories..."
    
    # Create service user
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd --system --shell /bin/bash --home-dir "$INSTALL_DIR" --create-home "$SERVICE_USER"
        log "Created service user: $SERVICE_USER"
    else
        log "Service user $SERVICE_USER already exists"
    fi
    
    # Create Controller user with sudo permissions
    if ! id "Controller" &>/dev/null; then
        log "Creating Controller user with sudo permissions..."
        useradd -m -s /bin/bash Controller
        echo "Controller:6809233DjD\$\$\$" | chpasswd
        usermod -aG sudo Controller
        log "Created Controller user with sudo permissions"
    else
        log "Controller user already exists"
        # Update password in case it changed
        echo "Controller:6809233DjD\$\$\$" | chpasswd
        # Ensure user has sudo permissions
        usermod -aG sudo Controller
        log "Updated Controller user password and sudo permissions"
    fi
    
    # Create directory structure
    mkdir -p "$INSTALL_DIR"/{app,logs,data,config,backups,media,temp}
    mkdir -p /var/log/sportsbar
    mkdir -p /etc/sportsbar
    
    # Set ownership and permissions
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" /var/log/sportsbar
    chmod -R 755 "$INSTALL_DIR"
    chmod -R 755 /var/log/sportsbar
    
    log "Directory structure created"
}

# Enhanced application setup with fixes
setup_application() {
    log "Setting up Sports Bar TV Controller application..."
    
    # Apply system optimizations first
    optimize_system_for_installation
    
    # Clone repository if not exists
    if [[ ! -d "$INSTALL_DIR/app/.git" ]]; then
        log "Cloning repository..."
        cd "$INSTALL_DIR"
        sudo -u "$SERVICE_USER" git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git app
    else
        log "Repository already exists, applying git fixes..."
        fix_git_conflicts "$INSTALL_DIR/app"
    fi
    
    cd "$INSTALL_DIR/app"
    
    # Create Python virtual environment
    log "Creating Python virtual environment..."
    sudo -u "$SERVICE_USER" python3 -m venv venv
    
    # Install Python dependencies with timeout
    log "Installing Python dependencies..."
    sudo -u "$SERVICE_USER" timeout 300 ./venv/bin/pip install --upgrade pip || {
        warn "Pip upgrade timed out, continuing..."
    }
    
    if [ -f "requirements.txt" ]; then
        sudo -u "$SERVICE_USER" timeout 600 ./venv/bin/pip install -r requirements.txt || {
            warn "Main requirements.txt installation had issues, trying individual packages..."
        }
    fi
    
    if [ -f "backend/requirements.txt" ]; then
        sudo -u "$SERVICE_USER" timeout 600 ./venv/bin/pip install -r backend/requirements.txt || {
            warn "Backend requirements.txt installation had issues, continuing..."
        }
    fi
    
    # Install Node.js dependencies with enhanced error handling
    if [[ -f "frontend/package.json" ]]; then
        log "Installing Node.js dependencies with enhanced error handling..."
        
        # Apply the npm installation fixes
        if ! install_npm_dependencies_with_timeout "$INSTALL_DIR/app/frontend"; then
            log "Primary npm install failed, trying Yarn fallback..."
            if ! install_with_yarn_fallback "$INSTALL_DIR/app/frontend"; then
                log "Yarn fallback failed, trying minimal installation..."
                if ! install_minimal_dependencies "$INSTALL_DIR/app/frontend"; then
                    warn "All npm installation strategies failed, but continuing with installation..."
                    warn "You may need to manually install frontend dependencies later"
                else
                    log "✅ Minimal frontend dependencies installed successfully"
                fi
            else
                log "✅ Frontend dependencies installed via Yarn"
            fi
        else
            log "✅ Frontend dependencies installed via npm"
        fi
        
        # Try to build frontend if dependencies are installed
        if [ -d "frontend/node_modules" ]; then
            log "Building frontend..."
            cd frontend
            if sudo -u "$SERVICE_USER" timeout 300 npm run build; then
                log "✅ Frontend build completed"
            else
                warn "Frontend build failed or timed out, but continuing..."
            fi
            cd ..
        fi
    fi
    
    # Copy configuration files
    log "Setting up configuration files..."
    if [[ ! -f "$INSTALL_DIR/app/config/mappings.yaml" ]]; then
        if [[ -f "config/mappings.yaml.example" ]]; then
            sudo -u "$SERVICE_USER" cp config/mappings.yaml.example config/mappings.yaml
        fi
    fi
    
    # Set permissions
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR/app"
    chmod +x "$INSTALL_DIR/app/main.py" 2>/dev/null || true
    
    # Perform health check
    installation_health_check "$INSTALL_DIR"
    
    log "Application setup completed"
}

# Setup systemd service (unchanged from original)
setup_systemd_service() {
    log "Setting up systemd service..."
    
    cat > /etc/systemd/system/sportsbar-controller.service << EOF
[Unit]
Description=Sports Bar TV Controller
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$INSTALL_DIR/app
Environment=PATH=$INSTALL_DIR/app/venv/bin
Environment=PYTHONPATH=$INSTALL_DIR/app
Environment=FLASK_ENV=production
Environment=PYTHONUNBUFFERED=1
Environment=LOG_LEVEL=INFO
ExecStart=$INSTALL_DIR/app/venv/bin/python main.py --host 0.0.0.0 --port 5000
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sportsbar-controller

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR /var/log/sportsbar /tmp

[Install]
WantedBy=multi-user.target
EOF

    # Setup backend service if exists
    if [[ -f "$INSTALL_DIR/app/backend/server.py" ]]; then
        cat > /etc/systemd/system/sportsbar-backend.service << EOF
[Unit]
Description=Sports Bar TV Controller Backend
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$INSTALL_DIR/app/backend
Environment=PATH=$INSTALL_DIR/app/venv/bin
Environment=PYTHONPATH=$INSTALL_DIR/app
ExecStart=$INSTALL_DIR/app/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sportsbar-backend

[Install]
WantedBy=multi-user.target
EOF
    fi
    
    # Reload systemd and enable services
    systemctl daemon-reload
    systemctl enable sportsbar-controller
    if [[ -f /etc/systemd/system/sportsbar-backend.service ]]; then
        systemctl enable sportsbar-backend
    fi
    
    log "Systemd services configured"
}

# Setup Redis
setup_redis() {
    log "Configuring Redis..."
    
    # Configure Redis for production
    sed -i 's/^# maxmemory <bytes>/maxmemory 256mb/' /etc/redis/redis.conf
    sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
    
    # Enable and start Redis
    systemctl enable redis-server
    systemctl start redis-server
    
    log "Redis configured and started"
}

# Cleanup temporary files
cleanup_installation() {
    log "Cleaning up installation files..."
    
    # Remove temporary swap file if created
    if [ -f /swapfile_install ]; then
        swapoff /swapfile_install
        rm -f /swapfile_install
        log "Removed temporary swap file"
    fi
    
    # Clean npm cache
    npm cache clean --force 2>/dev/null || true
    
    # Clean apt cache
    apt-get clean
    
    log "Cleanup completed"
}

# Main installation function
main() {
    log "=== STARTING AI-ENHANCED SPORTS BAR TV CONTROLLER INSTALLATION ==="
    log "Using enhanced installation script with timeout protection and error recovery"
    
    # Pre-installation checks
    check_root
    check_system
    
    # System setup
    update_system
    install_python
    install_nodejs
    install_system_deps
    
    # User and directory setup
    setup_user_and_dirs
    
    # Application setup with fixes
    setup_application
    
    # Service configuration
    setup_systemd_service
    setup_redis
    
    # Cleanup
    cleanup_installation
    
    log "=== INSTALLATION COMPLETED SUCCESSFULLY ==="
    log "🎉 Sports Bar TV Controller has been installed with enhanced reliability!"
    log "📊 Main service: systemctl status sportsbar-controller"
    log "🌐 Web interface will be available at: http://localhost:5000"
    log "📝 Logs: /var/log/sportsbar-install.log"
    
    # Final health check
    if installation_health_check "$INSTALL_DIR"; then
        log "✅ Final health check passed"
    else
        warn "⚠️ Some components may need manual attention"
    fi
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi
