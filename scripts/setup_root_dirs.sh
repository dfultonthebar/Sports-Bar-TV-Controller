#!/bin/bash

# Sports Bar TV Controller - Root Directory Setup Script
# This script creates the proper directory structure and sets permissions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
INSTALL_DIR="/opt/sportsbar"
SERVICE_USER="sportsbar"
SERVICE_GROUP="sportsbar"

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (use sudo)"
fi

log "Setting up Sports Bar TV Controller directory structure..."

# Create main directory structure
log "Creating directory structure..."
mkdir -p "$INSTALL_DIR"/{app,logs,data,config,backups,media,temp,scripts,docs}

# Create subdirectories for application
mkdir -p "$INSTALL_DIR/app"/{core,devices,ui,services,tests,frontend,backend}
mkdir -p "$INSTALL_DIR/app/ui"/{templates,static}
mkdir -p "$INSTALL_DIR/app/ui/static"/{css,js,images}

# Create log directories
mkdir -p "$INSTALL_DIR/logs"/{application,nginx,system,sports}
mkdir -p /var/log/sportsbar

# Create data directories
mkdir -p "$INSTALL_DIR/data"/{cache,sessions,uploads,exports}

# Create media directories
mkdir -p "$INSTALL_DIR/media"/{images,videos,audio,documents}

# Create configuration directories
mkdir -p "$INSTALL_DIR/config"/{devices,sports,nginx,ssl}
mkdir -p /etc/sportsbar

# Create backup directories
mkdir -p "$INSTALL_DIR/backups"/{daily,weekly,monthly,config}

# Create temporary directories
mkdir -p "$INSTALL_DIR/temp"/{uploads,processing,downloads}

# Create system directories
mkdir -p /var/lib/sportsbar
mkdir -p /var/cache/sportsbar

log "Directory structure created successfully"

# Set ownership
log "Setting ownership to $SERVICE_USER:$SERVICE_GROUP..."
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
chown -R "$SERVICE_USER:$SERVICE_GROUP" /var/log/sportsbar
chown -R "$SERVICE_USER:$SERVICE_GROUP" /var/lib/sportsbar
chown -R "$SERVICE_USER:$SERVICE_GROUP" /var/cache/sportsbar

# Set permissions
log "Setting permissions..."

# Application directories - read/write for service user
chmod -R 755 "$INSTALL_DIR/app"
chmod -R 755 "$INSTALL_DIR/scripts"
chmod -R 755 "$INSTALL_DIR/docs"

# Data directories - read/write for service user
chmod -R 750 "$INSTALL_DIR/data"
chmod -R 750 "$INSTALL_DIR/config"
chmod -R 750 "$INSTALL_DIR/backups"

# Log directories - read/write for service user
chmod -R 755 "$INSTALL_DIR/logs"
chmod -R 755 /var/log/sportsbar

# Media directories - read/write for service user and web server
chmod -R 755 "$INSTALL_DIR/media"

# Temporary directories - read/write/execute for service user
chmod -R 755 "$INSTALL_DIR/temp"

# System directories
chmod -R 755 /var/lib/sportsbar
chmod -R 755 /var/cache/sportsbar

# Secure configuration directories
chmod 700 "$INSTALL_DIR/config"
chmod 700 /etc/sportsbar

# Create symbolic links for easy access
log "Creating symbolic links..."
ln -sf "$INSTALL_DIR/app" /opt/sportsbar-app
ln -sf "$INSTALL_DIR/logs" /opt/sportsbar-logs
ln -sf "$INSTALL_DIR/config" /opt/sportsbar-config

# Create environment file template
log "Creating environment file template..."
cat > "$INSTALL_DIR/config/environment" << EOF
# Sports Bar TV Controller Environment Configuration
# Copy this file to /etc/sportsbar/environment and customize

# Application Settings
FLASK_ENV=production
PYTHONUNBUFFERED=1
LOG_LEVEL=INFO

# Sports API Keys (optional but recommended)
# Get your API keys from:
# - API-Sports.io: https://api-sports.io/
# - SportsDataIO: https://sportsdata.io/
API_SPORTS_KEY=""
SPORTSDATA_IO_KEY=""
ESPN_API_KEY=""

# Database Settings (if using external database)
DATABASE_URL=""

# Redis Settings
REDIS_URL="redis://localhost:6379/0"

# Security Settings
SECRET_KEY=""
JWT_SECRET_KEY=""

# Network Settings
ALLOWED_HOSTS="localhost,127.0.0.1"
CORS_ORIGINS="http://localhost:3000,http://localhost:5000"

# File Upload Settings
MAX_UPLOAD_SIZE=10485760  # 10MB
UPLOAD_FOLDER="$INSTALL_DIR/media/uploads"

# Logging Settings
LOG_FILE="$INSTALL_DIR/logs/application/sportsbar.log"
LOG_MAX_SIZE=10485760  # 10MB
LOG_BACKUP_COUNT=5

# Performance Settings
WORKERS=4
THREADS=2
TIMEOUT=30

# Feature Flags
ENABLE_SPORTS_DISCOVERY=true
ENABLE_DEEP_LINKING=true
ENABLE_ANALYTICS=false
ENABLE_DEBUG=false
EOF

chmod 600 "$INSTALL_DIR/config/environment"

# Create configuration templates
log "Creating configuration templates..."

# Device mappings template
cat > "$INSTALL_DIR/config/mappings.yaml.template" << EOF
# Sports Bar TV Controller - Device Mappings Configuration
# Copy this file to mappings.yaml and customize for your setup

# Global Settings
global:
  refresh_interval: 30  # seconds
  timeout: 10          # seconds
  retry_attempts: 3

# Room/Zone Configuration
rooms:
  main_bar:
    name: "Main Bar Area"
    displays:
      - id: "tv1"
        name: "Main TV 1"
        type: "samsung"
        ip: "192.168.1.100"
        port: 8001
      - id: "tv2"
        name: "Main TV 2"
        type: "lg"
        ip: "192.168.1.101"
        port: 8080
    
    audio:
      - id: "main_audio"
        name: "Main Bar Audio"
        type: "dbx"
        ip: "192.168.1.200"
        port: 5000

  dining_area:
    name: "Dining Area"
    displays:
      - id: "tv3"
        name: "Dining TV 1"
        type: "samsung"
        ip: "192.168.1.102"
        port: 8001

# Device Types Configuration
device_types:
  samsung:
    protocol: "websocket"
    default_port: 8001
    
  lg:
    protocol: "http"
    default_port: 8080
    
  dbx:
    protocol: "tcp"
    default_port: 5000

# Preset Configurations
presets:
  big_game:
    name: "Big Game Mode"
    description: "All TVs show main feed with high volume"
    actions:
      - device: "all_tvs"
        action: "set_input"
        value: "hdmi1"
      - device: "main_audio"
        action: "set_volume"
        value: 80

  multi_game:
    name: "Multi Game Mode"
    description: "Different games on different zones"
    actions:
      - device: "tv1"
        action: "set_input"
        value: "hdmi1"
      - device: "tv2"
        action: "set_input"
        value: "hdmi2"
EOF

# Sports configuration template
cat > "$INSTALL_DIR/config/sports_config.yaml.template" << EOF
# Sports Bar TV Controller - Sports Content Configuration
# Copy this file to sports_config.yaml and customize

# API Configuration
sports_api:
  cache_duration_minutes: 30
  api_keys:
    api_sports: "\${API_SPORTS_KEY}"
    sportsdata_io: "\${SPORTSDATA_IO_KEY}"
    espn_api: "\${ESPN_API_KEY}"
  timeout_seconds: 30

# Streaming Providers
streaming_providers:
  prime_video:
    enabled: true
    priority: 100
  espn_plus:
    enabled: true
    priority: 90
  paramount_plus:
    enabled: true
    priority: 80

# Content Discovery Settings
content_discovery:
  default_results:
    live: 10
    upcoming: 20
    search: 15
    featured: 8
EOF

# Create maintenance scripts
log "Creating maintenance scripts..."

cat > "$INSTALL_DIR/scripts/backup.sh" << 'EOF'
#!/bin/bash
# Sports Bar TV Controller - Backup Script

INSTALL_DIR="/opt/sportsbar"
BACKUP_DIR="$INSTALL_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
tar -czf "$BACKUP_DIR/daily/sportsbar_backup_$DATE.tar.gz" \
    -C "$INSTALL_DIR" \
    --exclude="logs/*" \
    --exclude="temp/*" \
    --exclude="media/uploads/*" \
    app config data

# Keep only last 7 daily backups
find "$BACKUP_DIR/daily" -name "sportsbar_backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: sportsbar_backup_$DATE.tar.gz"
EOF

cat > "$INSTALL_DIR/scripts/update.sh" << 'EOF'
#!/bin/bash
# Sports Bar TV Controller - Update Script

INSTALL_DIR="/opt/sportsbar"
SERVICE_USER="sportsbar"

cd "$INSTALL_DIR/app"

# Stop services
sudo systemctl stop sportsbar-controller
sudo systemctl stop sportsbar-backend 2>/dev/null || true

# Backup current version
sudo -u "$SERVICE_USER" ./scripts/backup.sh

# Pull latest changes
sudo -u "$SERVICE_USER" git pull origin main

# Update dependencies
sudo -u "$SERVICE_USER" ./venv/bin/pip install -r requirements.txt
sudo -u "$SERVICE_USER" ./venv/bin/pip install -r backend/requirements.txt

# Build frontend if needed
if [[ -f "frontend/package.json" ]]; then
    cd frontend
    sudo -u "$SERVICE_USER" npm install
    sudo -u "$SERVICE_USER" npm run build
    cd ..
fi

# Restart services
sudo systemctl start sportsbar-controller
sudo systemctl start sportsbar-backend 2>/dev/null || true

echo "Update completed successfully"
EOF

chmod +x "$INSTALL_DIR/scripts"/*.sh

# Create status check script
cat > "$INSTALL_DIR/scripts/status.sh" << 'EOF'
#!/bin/bash
# Sports Bar TV Controller - Status Check Script

echo "=== Sports Bar TV Controller Status ==="
echo

echo "Services:"
systemctl is-active sportsbar-controller && echo "✓ Main Controller: Running" || echo "✗ Main Controller: Stopped"
systemctl is-active sportsbar-backend 2>/dev/null && echo "✓ Backend: Running" || echo "✗ Backend: Stopped"
systemctl is-active nginx && echo "✓ Nginx: Running" || echo "✗ Nginx: Stopped"
systemctl is-active redis-server && echo "✓ Redis: Running" || echo "✗ Redis: Stopped"

echo
echo "Network:"
netstat -tlnp | grep :5000 && echo "✓ Main app listening on port 5000" || echo "✗ Main app not listening"
netstat -tlnp | grep :8000 && echo "✓ Backend listening on port 8000" || echo "✗ Backend not listening"
netstat -tlnp | grep :80 && echo "✓ Nginx listening on port 80" || echo "✗ Nginx not listening"

echo
echo "Disk Usage:"
df -h /opt/sportsbar

echo
echo "Memory Usage:"
free -h

echo
echo "Recent Logs:"
tail -n 5 /var/log/sportsbar/*.log 2>/dev/null || echo "No logs found"
EOF

chmod +x "$INSTALL_DIR/scripts/status.sh"

# Set final permissions
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"

log "Root directory setup completed successfully!"
info ""
info "Directory structure created at: $INSTALL_DIR"
info "Configuration templates created in: $INSTALL_DIR/config/"
info "Maintenance scripts created in: $INSTALL_DIR/scripts/"
info ""
info "Next steps:"
info "1. Copy and customize configuration templates"
info "2. Run the main installation script: ./install.sh"
info "3. Configure your devices in mappings.yaml"
info ""
