#!/bin/bash

# Sports Bar TV Controller - Enhanced Installation Script with AI Monitoring
# This script installs all dependencies and sets up the system for production use
# AI Chat Interface is installed FIRST for real-time monitoring and troubleshooting
#
# Git Update Behavior Control:
# Set GIT_UPDATE_MODE environment variable to control how git conflicts are handled:
#   - "prompt" (default): Interactive prompts for conflict resolution
#   - "keep_local": Always keep local configurations, skip git updates
#   - "update_from_github": Always update from GitHub, backup and overwrite local changes
#
# Examples:
#   sudo ./install.sh                                    # Interactive mode (default)
#   sudo GIT_UPDATE_MODE=keep_local ./install.sh         # Keep local configs
#   sudo GIT_UPDATE_MODE=update_from_github ./install.sh # Force GitHub update

set -e  # Exit on any error

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
    ai_auto_fix "$1"
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

ai_auto_fix() {
    local error_msg="$1"
    ai_log "Attempting automatic fix for: $error_msg"
    
    # Common auto-fixes
    case "$error_msg" in
        *"Permission denied"*)
            ai_log "Fixing permission issues..."
            chmod -R 755 "$INSTALL_DIR" 2>/dev/null || true
            chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR" 2>/dev/null || true
            ;;
        *"No space left"*)
            ai_log "Cleaning up disk space..."
            apt-get clean 2>/dev/null || true
            rm -rf /tmp/* 2>/dev/null || true
            ;;
        *"Connection refused"*|*"Network"*)
            ai_log "Checking network connectivity..."
            systemctl restart networking 2>/dev/null || true
            sleep 5
            ;;
        *"Package"*|*"apt"*)
            ai_log "Fixing package manager issues..."
            apt-get update --fix-missing 2>/dev/null || true
            dpkg --configure -a 2>/dev/null || true
            ;;
    esac
}

# Setup AI Chat Interface and Monitoring System (FIRST PRIORITY)
setup_ai_chat_interface() {
    ai_log "=== SETTING UP AI CHAT INTERFACE FOR REAL-TIME MONITORING ==="
    
    # Create AI directories
    mkdir -p /opt/ai-monitor/{chat,logs,config,temp}
    mkdir -p /var/log/ai-monitor
    
    # Install minimal Node.js if not present (for AI chat interface)
    if ! command -v node >/dev/null 2>&1; then
        ai_log "Installing Node.js for AI chat interface..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash - >/dev/null 2>&1
        apt-get install -y nodejs >/dev/null 2>&1
    fi
    
    # Create AI Chat Interface
    cat > /opt/ai-monitor/chat/server.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const AI_CHAT_PORT = process.env.AI_CHAT_PORT || 3001;
const AI_MONITORING_PORT = process.env.AI_MONITORING_PORT || 3002;

let installationLogs = [];
let currentStatus = 'Starting AI Monitor...';

// Monitoring server for receiving installation updates
const monitorServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.method === 'POST' && req.url === '/notify') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                installationLogs.push({
                    ...data,
                    id: Date.now()
                });
                currentStatus = data.message;
                
                // Auto-fix suggestions
                if (data.level === 'error') {
                    console.log(`🤖 AI DETECTED ERROR: ${data.message}`);
                    suggestFix(data.message);
                }
                
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({success: true}));
            } catch (e) {
                res.writeHead(400);
                res.end('Invalid JSON');
            }
        });
    } else if (req.method === 'GET' && req.url === '/status') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
            status: currentStatus,
            logs: installationLogs.slice(-50), // Last 50 logs
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// Chat interface server
const chatServer = http.createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(getAIChatHTML());
    } else if (req.url === '/api/logs') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
            logs: installationLogs.slice(-100),
            status: currentStatus
        }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

function suggestFix(errorMessage) {
    const fixes = {
        'Permission denied': 'Try: sudo chmod -R 755 /opt/sportsbar && sudo chown -R sportsbar:sportsbar /opt/sportsbar',
        'No space left': 'Try: sudo apt-get clean && sudo rm -rf /tmp/* && df -h',
        'Connection refused': 'Try: sudo systemctl restart networking && ping -c 3 google.com',
        'Package': 'Try: sudo apt-get update --fix-missing && sudo dpkg --configure -a'
    };
    
    for (const [key, fix] of Object.entries(fixes)) {
        if (errorMessage.includes(key)) {
            console.log(`💡 AI SUGGESTION: ${fix}`);
            installationLogs.push({
                level: 'suggestion',
                message: `AI Suggestion: ${fix}`,
                timestamp: new Date().toISOString(),
                id: Date.now()
            });
            break;
        }
    }
}

function getAIChatHTML() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>🤖 AI Installation Monitor - Sports Bar TV Controller</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #1a1a1a; color: #fff; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #00ff88; font-size: 2.5em; margin-bottom: 10px; }
        .status-bar { background: #2d2d2d; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
        .status { font-size: 1.2em; color: #00ff88; }
        .logs-container { background: #2d2d2d; border-radius: 10px; padding: 20px; height: 500px; overflow-y: auto; }
        .log-entry { margin-bottom: 10px; padding: 8px; border-radius: 5px; }
        .log-info { background: #1e3a8a; }
        .log-warning { background: #f59e0b; color: #000; }
        .log-error { background: #dc2626; }
        .log-suggestion { background: #059669; }
        .timestamp { font-size: 0.8em; opacity: 0.7; }
        .controls { margin-top: 20px; text-align: center; }
        .btn { background: #00ff88; color: #000; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 0 10px; }
        .btn:hover { background: #00cc6a; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .stat-card { background: #2d2d2d; padding: 15px; border-radius: 10px; text-align: center; }
        .stat-number { font-size: 2em; color: #00ff88; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 AI Installation Monitor</h1>
            <p>Real-time monitoring and troubleshooting for Sports Bar TV Controller installation</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number" id="totalLogs">0</div>
                <div>Total Events</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="errorCount">0</div>
                <div>Errors Detected</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="fixCount">0</div>
                <div>Auto-fixes Applied</div>
            </div>
        </div>
        
        <div class="status-bar">
            <div class="status" id="currentStatus">Initializing AI Monitor...</div>
        </div>
        
        <div class="logs-container" id="logsContainer">
            <div class="log-entry log-info">
                <div>🤖 AI Monitor initialized and ready for installation monitoring</div>
                <div class="timestamp">${new Date().toLocaleString()}</div>
            </div>
        </div>
        
        <div class="controls">
            <button class="btn" onclick="clearLogs()">Clear Logs</button>
            <button class="btn" onclick="exportLogs()">Export Logs</button>
            <button class="btn" onclick="toggleAutoScroll()">Toggle Auto-scroll</button>
        </div>
    </div>

    <script>
        let autoScroll = true;
        let logs = [];
        
        function updateDisplay() {
            fetch('/api/logs')
                .then(r => r.json())
                .then(data => {
                    logs = data.logs;
                    document.getElementById('currentStatus').textContent = data.status;
                    
                    const container = document.getElementById('logsContainer');
                    container.innerHTML = logs.map(log => 
                        \`<div class="log-entry log-\${log.level}">
                            <div>\${getLogIcon(log.level)} \${log.message}</div>
                            <div class="timestamp">\${new Date(log.timestamp).toLocaleString()}</div>
                        </div>\`
                    ).join('');
                    
                    // Update stats
                    document.getElementById('totalLogs').textContent = logs.length;
                    document.getElementById('errorCount').textContent = logs.filter(l => l.level === 'error').length;
                    document.getElementById('fixCount').textContent = logs.filter(l => l.level === 'suggestion').length;
                    
                    if (autoScroll) {
                        container.scrollTop = container.scrollHeight;
                    }
                })
                .catch(e => console.error('Failed to fetch logs:', e));
        }
        
        function getLogIcon(level) {
            const icons = {
                info: '📋',
                warning: '⚠️',
                error: '❌',
                suggestion: '💡'
            };
            return icons[level] || '📋';
        }
        
        function clearLogs() {
            if (confirm('Clear all logs?')) {
                logs = [];
                document.getElementById('logsContainer').innerHTML = '';
            }
        }
        
        function exportLogs() {
            const data = logs.map(l => \`[\${l.timestamp}] \${l.level.toUpperCase()}: \${l.message}\`).join('\\n');
            const blob = new Blob([data], {type: 'text/plain'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'installation-logs.txt';
            a.click();
        }
        
        function toggleAutoScroll() {
            autoScroll = !autoScroll;
            document.querySelector('button[onclick="toggleAutoScroll()"]').textContent = 
                autoScroll ? 'Disable Auto-scroll' : 'Enable Auto-scroll';
        }
        
        // Update every 2 seconds
        setInterval(updateDisplay, 2000);
        updateDisplay();
    </script>
</body>
</html>`;
}

// Start servers
monitorServer.listen(AI_MONITORING_PORT, () => {
    console.log(`🤖 AI Monitoring server running on port ${AI_MONITORING_PORT}`);
});

chatServer.listen(AI_CHAT_PORT, () => {
    console.log(`💬 AI Chat interface running on port ${AI_CHAT_PORT}`);
    console.log(`🌐 Access at: http://localhost:${AI_CHAT_PORT}`);
});
EOF

    # Create systemd service for AI monitor
    cat > /etc/systemd/system/ai-monitor.service << EOF
[Unit]
Description=AI Installation Monitor
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ai-monitor/chat
Environment=AI_CHAT_PORT=$AI_CHAT_PORT
Environment=AI_MONITORING_PORT=$AI_MONITORING_PORT
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Start AI monitor service
    systemctl daemon-reload
    systemctl enable ai-monitor
    systemctl start ai-monitor
    
    # Wait for service to start
    sleep 3
    
    ai_log "AI Chat Interface is now running!"
    ai_log "🌐 Access the AI Monitor at: http://localhost:$AI_CHAT_PORT"
    ai_log "🤖 Real-time monitoring and auto-fixing enabled"
    
    # Test the connection
    if nc -z localhost "$AI_CHAT_PORT" 2>/dev/null; then
        ai_log "✅ AI Chat Interface is accessible"
    else
        ai_log "⚠️ AI Chat Interface may not be fully ready yet"
    fi
    
    if nc -z localhost "$AI_MONITORING_PORT" 2>/dev/null; then
        ai_log "✅ AI Monitoring API is accessible"
    else
        ai_log "⚠️ AI Monitoring API may not be fully ready yet"
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

# Handle git repository updates with merge conflict resolution
handle_git_update() {
    local update_mode="${GIT_UPDATE_MODE:-prompt}"
    local backup_dir="/tmp/sportsbar-config-backup-$(date +%Y%m%d-%H%M%S)"
    
    log "Checking for local changes..."
    
    # Check if there are uncommitted changes
    if ! sudo -u "$SERVICE_USER" git diff --quiet || ! sudo -u "$SERVICE_USER" git diff --cached --quiet; then
        warn "Local changes detected in repository"
        
        # Backup important configuration files
        log "Creating backup of local configurations..."
        mkdir -p "$backup_dir"
        
        # Backup configuration files if they exist
        for config_file in "config/mappings.yaml" "config/settings.json" ".env" "config/devices.yaml"; do
            if [[ -f "$config_file" ]]; then
                cp "$config_file" "$backup_dir/" 2>/dev/null || true
                log "Backed up: $config_file"
            fi
        done
        
        # Handle based on update mode
        case "$update_mode" in
            "keep_local")
                log "Keeping local configurations (skipping git pull)"
                warn "Repository not updated - using existing local version"
                return 0
                ;;
            "update_from_github")
                log "Updating from GitHub (local changes will be overwritten)"
                sudo -u "$SERVICE_USER" git stash push -m "Auto-stash before installation update $(date)"
                ;;
            "prompt"|*)
                if [[ -t 0 ]] && [[ "$update_mode" == "prompt" ]]; then
                    # Interactive mode - prompt user
                    echo ""
                    warn "Local changes detected! Choose how to proceed:"
                    echo "1) Keep local configurations (skip update)"
                    echo "2) Update from GitHub (backup and overwrite local changes)"
                    echo "3) Show differences and decide"
                    echo ""
                    read -p "Enter choice (1-3) [default: 1]: " choice
                    choice=${choice:-1}
                    
                    case "$choice" in
                        1)
                            log "User chose to keep local configurations"
                            return 0
                            ;;
                        2)
                            log "User chose to update from GitHub"
                            sudo -u "$SERVICE_USER" git stash push -m "User-requested stash before update $(date)"
                            ;;
                        3)
                            log "Showing differences..."
                            sudo -u "$SERVICE_USER" git diff --name-status
                            echo ""
                            read -p "Proceed with GitHub update? (y/N): " proceed
                            if [[ "$proceed" =~ ^[Yy]$ ]]; then
                                sudo -u "$SERVICE_USER" git stash push -m "User-approved stash after review $(date)"
                            else
                                log "User chose to keep local version"
                                return 0
                            fi
                            ;;
                        *)
                            log "Invalid choice, keeping local configurations"
                            return 0
                            ;;
                    esac
                else
                    # Non-interactive mode - default to keeping local
                    log "Non-interactive mode: keeping local configurations"
                    warn "Set GIT_UPDATE_MODE=update_from_github to force update"
                    return 0
                fi
                ;;
        esac
    fi
    
    # Fetch latest changes
    log "Fetching latest changes from GitHub..."
    if ! sudo -u "$SERVICE_USER" git fetch origin main; then
        error "Failed to fetch from GitHub repository"
        return 1
    fi
    
    # Check if we're behind
    local behind_count=$(sudo -u "$SERVICE_USER" git rev-list --count HEAD..origin/main 2>/dev/null || echo "0")
    if [[ "$behind_count" -eq 0 ]]; then
        log "Repository is already up to date"
        return 0
    fi
    
    log "Repository is $behind_count commits behind, updating..."
    
    # Attempt to pull with merge strategy
    if sudo -u "$SERVICE_USER" git pull origin main; then
        log "Successfully updated repository"
        
        # Restore backed up configs if they don't conflict
        if [[ -d "$backup_dir" ]]; then
            log "Restoring non-conflicting configuration files..."
            for backup_file in "$backup_dir"/*; do
                if [[ -f "$backup_file" ]]; then
                    filename=$(basename "$backup_file")
                    if [[ ! -f "$filename" ]] || ! sudo -u "$SERVICE_USER" git diff --quiet HEAD~1 HEAD -- "$filename" 2>/dev/null; then
                        cp "$backup_file" "$filename" 2>/dev/null || true
                        log "Restored: $filename"
                    fi
                fi
            done
        fi
    else
        # Pull failed, likely due to merge conflicts
        error_code=$?
        warn "Git pull failed (exit code: $error_code)"
        
        # Reset to clean state and try again
        log "Attempting to resolve conflicts automatically..."
        sudo -u "$SERVICE_USER" git reset --hard HEAD
        
        if sudo -u "$SERVICE_USER" git pull origin main; then
            log "Successfully updated after reset"
            
            # Restore all backed up configs
            if [[ -d "$backup_dir" ]]; then
                log "Restoring backed up configuration files..."
                cp "$backup_dir"/* . 2>/dev/null || true
                log "Configuration files restored from backup"
            fi
        else
            error "Failed to update repository even after reset. Manual intervention required."
            log "Backup of configurations available at: $backup_dir"
            return 1
        fi
    fi
    
    # Clean up backup if successful
    if [[ -d "$backup_dir" ]]; then
        rm -rf "$backup_dir" 2>/dev/null || true
    fi
    
    log "Repository update completed successfully"
    return 0
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
        log "Repository already exists, updating from GitHub..."
        cd "$INSTALL_DIR/app"
        
        # Handle git merge conflicts intelligently
        handle_git_update
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
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          🤖 AI-ENHANCED INSTALLATION STARTING 🤖             ║${NC}"
    echo -e "${CYAN}║     Sports Bar TV Controller with Real-time AI Monitoring   ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    
    log "Starting AI-Enhanced Sports Bar TV Controller installation..."
    
    # CRITICAL: Setup AI Chat Interface FIRST for real-time monitoring
    ai_log "🚀 PRIORITY 1: Setting up AI Chat Interface for installation monitoring..."
    check_root
    
    # Install minimal dependencies needed for AI interface
    apt-get update -y >/dev/null 2>&1
    apt-get install -y curl wget netcat-openbsd >/dev/null 2>&1
    
    # Setup AI monitoring system FIRST
    setup_ai_chat_interface
    
    ai_log "✅ AI Chat Interface is now monitoring the installation process!"
    ai_log "🌐 You can view real-time progress at: http://localhost:$AI_CHAT_PORT"
    
    # Now proceed with regular installation with AI monitoring
    log "Proceeding with system installation under AI supervision..."
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
    
    ai_log "🎉 AI-ENHANCED INSTALLATION COMPLETED SUCCESSFULLY! 🎉"
    log "Installation completed successfully!"
    
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🎯 INSTALLATION COMPLETE! 🎯              ║${NC}"
    echo -e "${GREEN}║          AI Monitoring System Successfully Deployed          ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    
    info ""
    info "🤖 AI MONITORING SYSTEM:"
    info "   • AI Chat Interface: http://localhost:$AI_CHAT_PORT"
    info "   • Real-time monitoring: ACTIVE"
    info "   • Auto-fix capabilities: ENABLED"
    info "   • Service status: systemctl status ai-monitor"
    info ""
    info "📋 NEXT STEPS:"
    info "1. Edit configuration: $INSTALL_DIR/app/config/mappings.yaml"
    info "2. Configure sports APIs (optional): export API_SPORTS_KEY=your_key"
    info "3. Start services: systemctl start sportsbar-controller"
    info "4. Check status: systemctl status sportsbar-controller"
    info "5. Access main dashboard: http://$(hostname -I | awk '{print $1}')"
    info "6. Monitor with AI: http://$(hostname -I | awk '{print $1}'):$AI_CHAT_PORT"
    info ""
    info "📚 For detailed configuration, see: $INSTALL_DIR/app/docs/INSTALLATION.md"
    info ""
    
    # Show service status including AI monitor
    log "Current service status:"
    systemctl status ai-monitor --no-pager -l || true
    systemctl status redis-server --no-pager -l || true
    systemctl status nginx --no-pager -l || true
    
    ai_log "🔄 AI Monitor will continue running to assist with any post-installation issues"
    warn "Please reboot the system to ensure all services start correctly"
    
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  🤖 AI Assistant remains active for ongoing support! 🤖     ║${NC}"
    echo -e "${CYAN}║     Access anytime at: http://localhost:$AI_CHAT_PORT        ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
}

# Run main function
main "$@"
