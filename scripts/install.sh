#!/bin/bash

# Sports Bar TV Controller - Installation Script
# This script installs all dependencies and sets up the system for production use

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/sportsbar"
SERVICE_USER="sportsbar"
SERVICE_GROUP="sportsbar"
PYTHON_VERSION="3.11"
NODE_VERSION="18"

# Logging
LOG_FILE="/var/log/sportsbar-install.log"

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
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
    
    # Install global packages
    npm install -g pm2 yarn
    
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

# Clone and setup application
setup_application() {
    log "Setting up Sports Bar TV Controller application..."
    
    # Clone repository if not exists
    if [[ ! -d "$INSTALL_DIR/app/.git" ]]; then
        log "Cloning repository..."
        cd "$INSTALL_DIR"
        sudo -u "$SERVICE_USER" git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git app
    else
        log "Repository already exists, pulling latest changes..."
        cd "$INSTALL_DIR/app"
        sudo -u "$SERVICE_USER" git pull origin main
    fi
    
    cd "$INSTALL_DIR/app"
    
    # Create Python virtual environment
    log "Creating Python virtual environment..."
    sudo -u "$SERVICE_USER" python3 -m venv venv
    
    # Install Python dependencies
    log "Installing Python dependencies..."
    sudo -u "$SERVICE_USER" ./venv/bin/pip install --upgrade pip
    sudo -u "$SERVICE_USER" ./venv/bin/pip install -r requirements.txt
    sudo -u "$SERVICE_USER" ./venv/bin/pip install -r backend/requirements.txt
    
    # Install Node.js dependencies for frontend
    if [[ -f "frontend/package.json" ]]; then
        log "Installing Node.js dependencies..."
        cd frontend
        sudo -u "$SERVICE_USER" npm install
        sudo -u "$SERVICE_USER" npm run build
        cd ..
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
    chmod +x "$INSTALL_DIR/app/main.py"
    
    log "Application setup completed"
}

# Setup systemd service
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

# Setup nginx reverse proxy
setup_nginx() {
    log "Setting up Nginx reverse proxy..."
    
    # Backup original nginx config
    if [[ -f /etc/nginx/sites-available/default ]]; then
        cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
    fi
    
    # Create nginx configuration
    cat > /etc/nginx/sites-available/sportsbar << EOF
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Main application
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Backend API (if exists)
    location /api/v2/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static files
    location /static/ {
        alias $INSTALL_DIR/app/ui/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Media files
    location /media/ {
        alias $INSTALL_DIR/media/;
        expires 1y;
        add_header Cache-Control "public";
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
    
    # Enable site and disable default
    ln -sf /etc/nginx/sites-available/sportsbar /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    nginx -t
    
    log "Nginx configuration completed"
}

# Setup firewall
setup_firewall() {
    log "Setting up firewall..."
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH
    ufw allow ssh
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow application ports (only from local network)
    ufw allow from 192.168.0.0/16 to any port 5000
    ufw allow from 10.0.0.0/8 to any port 5000
    ufw allow from 172.16.0.0/12 to any port 5000
    
    # Enable firewall
    ufw --force enable
    
    log "Firewall configured"
}

# Setup log rotation
setup_logging() {
    log "Setting up log rotation..."
    
    cat > /etc/logrotate.d/sportsbar << EOF
/var/log/sportsbar/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $SERVICE_USER $SERVICE_GROUP
    postrotate
        systemctl reload sportsbar-controller || true
        systemctl reload sportsbar-backend || true
    endscript
}

$INSTALL_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $SERVICE_USER $SERVICE_GROUP
    postrotate
        systemctl reload sportsbar-controller || true
    endscript
}
EOF
    
    log "Log rotation configured"
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

# Create startup script
create_startup_script() {
    log "Creating startup script..."
    
    cat > "$INSTALL_DIR/start.sh" << EOF
#!/bin/bash
# Sports Bar TV Controller - Startup Script

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "\${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] \$1\${NC}"
}

error() {
    echo -e "\${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: \$1\${NC}"
    exit 1
}

# Check if running as service user
if [[ "\$(whoami)" != "$SERVICE_USER" ]]; then
    error "This script must be run as the $SERVICE_USER user"
fi

cd "$INSTALL_DIR/app"

# Check if virtual environment exists
if [[ ! -d "venv" ]]; then
    error "Virtual environment not found. Please run the installation script."
fi

# Activate virtual environment
source venv/bin/activate

# Check configuration
if [[ ! -f "config/mappings.yaml" ]]; then
    log "Creating default configuration..."
    if [[ -f "config/mappings.yaml.example" ]]; then
        cp config/mappings.yaml.example config/mappings.yaml
    else
        error "No configuration template found"
    fi
fi

# Start the application
log "Starting Sports Bar TV Controller..."
exec python main.py --host 0.0.0.0 --port 5000
EOF
    
    chmod +x "$INSTALL_DIR/start.sh"
    chown "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR/start.sh"
    
    log "Startup script created"
}

# Main installation function
main() {
    log "Starting Sports Bar TV Controller installation..."
    
    check_root
    check_system
    update_system
    install_python
    install_nodejs
    install_system_deps
    setup_user_and_dirs
    setup_application
    setup_systemd_service
    setup_nginx
    setup_redis
    setup_firewall
    setup_logging
    create_startup_script
    
    log "Installation completed successfully!"
    info ""
    info "Next steps:"
    info "1. Edit configuration: $INSTALL_DIR/app/config/mappings.yaml"
    info "2. Configure sports APIs (optional): export API_SPORTS_KEY=your_key"
    info "3. Start services: systemctl start sportsbar-controller"
    info "4. Check status: systemctl status sportsbar-controller"
    info "5. Access dashboard: http://$(hostname -I | awk '{print $1}')"
    info ""
    info "For detailed configuration, see: $INSTALL_DIR/app/docs/INSTALLATION.md"
    info ""
    
    # Show service status
    log "Current service status:"
    systemctl status redis-server --no-pager -l || true
    systemctl status nginx --no-pager -l || true
    
    warn "Please reboot the system to ensure all services start correctly"
}

# Run main function
main "$@"
