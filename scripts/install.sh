#!/bin/bash

# Sports Bar TV Controller - Complete Installation Script
# This script installs all dependencies and configures the system for the Sports Bar TV Controller

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root for security reasons"
   exit 1
fi

log "Starting Sports Bar TV Controller Installation..."

# Update system packages
log "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+ and pip
log "Installing Python and pip..."
sudo apt install -y python3 python3-pip python3-venv python3-dev

# Install system dependencies
log "Installing system dependencies..."
sudo apt install -y \
    git \
    curl \
    wget \
    build-essential \
    libssl-dev \
    libffi-dev \
    libjpeg-dev \
    zlib1g-dev \
    libtiff-dev \
    libfreetype6-dev \
    liblcms2-dev \
    libwebp-dev \
    tcl8.6-dev \
    tk8.6-dev \
    python3-tk \
    ghostscript \
    nginx \
    ufw

# Configure firewall for Sports Bar TV Controller
log "Configuring firewall for Sports Bar TV Controller..."
sudo ufw --force enable

# Allow SSH (important to not lock ourselves out)
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow Sports Bar TV Controller ports - CRITICAL FIX
log "Opening required ports for Sports Bar TV Controller..."
sudo ufw allow 5000/tcp comment 'Sports Bar TV Controller - Main Dashboard'
sudo ufw allow 3001/tcp comment 'Sports Bar TV Controller - AI Agent Service'

# Allow additional ports that might be needed
sudo ufw allow 8080/tcp comment 'Sports Bar TV Controller - Alternative HTTP'
sudo ufw allow 8000/tcp comment 'Sports Bar TV Controller - Development'

# Show firewall status
log "Firewall configuration complete. Current status:"
sudo ufw status verbose

# Create application directory
APP_DIR="/opt/sportsbar-controller"
log "Creating application directory at $APP_DIR..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Clone or update repository
if [ -d "$APP_DIR/.git" ]; then
    log "Updating existing repository..."
    cd $APP_DIR
    git pull origin main
else
    log "Cloning repository..."
    git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git $APP_DIR
    cd $APP_DIR
fi

# Create virtual environment
log "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
log "Upgrading pip..."
pip install --upgrade pip setuptools wheel

# Install Python dependencies
log "Installing Python dependencies..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    # Install basic dependencies if requirements.txt doesn't exist
    pip install flask flask-socketio eventlet requests pyyaml python-dotenv
fi

# Create necessary directories
log "Creating necessary directories..."
mkdir -p logs config static/css static/js templates

# Create basic configuration files if they don't exist
if [ ! -f "config/mappings.yaml" ]; then
    log "Creating default mappings.yaml..."
    cat > config/mappings.yaml << 'YAML_EOF'
# Sports Bar TV Controller - Device Mappings
devices:
  tv_1:
    name: "Main Bar TV"
    ip: "192.168.1.100"
    type: "samsung"
  tv_2:
    name: "Side TV"
    ip: "192.168.1.101"
    type: "lg"

cable_boxes:
  box_1:
    name: "Main Cable Box"
    ip: "192.168.1.200"
    channels:
      espn: 206
      fox_sports: 219
      nfl_network: 212
YAML_EOF
fi

if [ ! -f "config/sports_config.yaml" ]; then
    log "Creating default sports_config.yaml..."
    cat > config/sports_config.yaml << 'YAML_EOF'
# Sports Bar TV Controller - Sports Configuration
sports:
  football:
    priority: 1
    channels: [206, 212, 219]
  basketball:
    priority: 2
    channels: [206, 215]
  baseball:
    priority: 3
    channels: [206, 220]

schedules:
  update_interval: 3600  # 1 hour
  sources:
    - espn
    - fox_sports
YAML_EOF
fi

# Install systemd service file
log "Installing systemd service..."
sudo cp scripts/sportsbar-controller.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sportsbar-controller.service

# Set proper permissions
log "Setting proper permissions..."
sudo chown -R $USER:$USER $APP_DIR
chmod +x main.py

# Create startup script
log "Creating startup script..."
cat > start.sh << 'START_EOF'
#!/bin/bash
cd /opt/sportsbar-controller
source venv/bin/activate
python main.py --host 0.0.0.0 --port 5000
START_EOF
chmod +x start.sh

# Final setup
log "Performing final setup..."
deactivate 2>/dev/null || true

log "Installation completed successfully!"
info "Sports Bar TV Controller has been installed to: $APP_DIR"
info "Service name: sportsbar-controller.service"
info "Firewall ports opened: 5000 (main), 3001 (AI agent), 80, 443, 8000, 8080"
info ""
info "To start the service:"
info "  sudo systemctl start sportsbar-controller.service"
info ""
info "To check service status:"
info "  sudo systemctl status sportsbar-controller.service"
info ""
info "To view logs:"
info "  sudo journalctl -u sportsbar-controller.service -f"
info ""
info "To start manually:"
info "  cd $APP_DIR && ./start.sh"
info ""
info "Web interface will be available at:"
info "  http://localhost:5000 (main dashboard)"
info "  http://localhost:3001 (AI agent interface)"

warn "Please reboot the system to ensure all changes take effect properly."
