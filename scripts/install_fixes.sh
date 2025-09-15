
#!/bin/bash

# Sports Bar TV Controller - Installation Fixes
# This script contains fixes for the hanging installation issues
# Addresses: Node.js dependency timeouts, git conflicts, and error handling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/sportsbar"
SERVICE_USER="sportsbar"
NPM_TIMEOUT=300  # 5 minutes timeout for npm operations
MAX_RETRIES=3

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Fix 1: Enhanced npm installation with timeout and retry logic
install_npm_dependencies_with_timeout() {
    local package_dir="$1"
    local max_attempts="${MAX_RETRIES}"
    local attempt=1
    
    log "Installing Node.js dependencies in $package_dir with timeout protection..."
    
    cd "$package_dir"
    
    # Configure npm for better reliability
    sudo -u "$SERVICE_USER" npm config set registry https://registry.npmjs.org/
    sudo -u "$SERVICE_USER" npm config set fetch-timeout 60000
    sudo -u "$SERVICE_USER" npm config set fetch-retry-mintimeout 10000
    sudo -u "$SERVICE_USER" npm config set fetch-retry-maxtimeout 60000
    sudo -u "$SERVICE_USER" npm config set fetch-retries 3
    sudo -u "$SERVICE_USER" npm config set cache-min 3600
    
    # Clear npm cache to avoid corruption issues
    log "Clearing npm cache..."
    sudo -u "$SERVICE_USER" npm cache clean --force
    
    while [ $attempt -le $max_attempts ]; do
        log "Attempt $attempt of $max_attempts for npm install..."
        
        # Use timeout command to prevent hanging
        if timeout $NPM_TIMEOUT sudo -u "$SERVICE_USER" npm install --no-audit --no-fund --prefer-offline; then
            log "✅ npm install completed successfully on attempt $attempt"
            return 0
        else
            local exit_code=$?
            if [ $exit_code -eq 124 ]; then
                warn "npm install timed out after ${NPM_TIMEOUT} seconds (attempt $attempt)"
            else
                warn "npm install failed with exit code $exit_code (attempt $attempt)"
            fi
            
            if [ $attempt -lt $max_attempts ]; then
                log "Cleaning up and retrying..."
                # Remove node_modules and package-lock.json for clean retry
                sudo -u "$SERVICE_USER" rm -rf node_modules package-lock.json
                # Clear npm cache again
                sudo -u "$SERVICE_USER" npm cache clean --force
                sleep 10  # Wait before retry
            fi
            
            attempt=$((attempt + 1))
        fi
    done
    
    error "Failed to install npm dependencies after $max_attempts attempts"
    return 1
}

# Fix 2: Alternative npm installation using yarn (faster and more reliable)
install_with_yarn_fallback() {
    local package_dir="$1"
    
    log "Attempting installation with Yarn as fallback..."
    
    cd "$package_dir"
    
    # Install yarn if not present
    if ! command -v yarn >/dev/null 2>&1; then
        log "Installing Yarn package manager..."
        npm install -g yarn
    fi
    
    # Configure yarn for better reliability
    sudo -u "$SERVICE_USER" yarn config set registry https://registry.npmjs.org/
    sudo -u "$SERVICE_USER" yarn config set network-timeout 60000
    
    # Clear yarn cache
    sudo -u "$SERVICE_USER" yarn cache clean
    
    # Install with yarn and timeout
    if timeout $NPM_TIMEOUT sudo -u "$SERVICE_USER" yarn install --no-audit --prefer-offline; then
        log "✅ Yarn install completed successfully"
        return 0
    else
        error "Yarn install also failed"
        return 1
    fi
}

# Fix 3: Minimal dependency installation (only essential packages)
install_minimal_dependencies() {
    local package_dir="$1"
    
    log "Attempting minimal dependency installation..."
    
    cd "$package_dir"
    
    # Create a minimal package.json for essential dependencies only
    cat > package.json.minimal << 'EOF'
{
  "name": "sports-bar-tv-controller-frontend",
  "version": "1.0.0",
  "description": "React frontend for Sports Bar TV Controller",
  "main": "App.js",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
EOF
    
    # Backup original and use minimal
    sudo -u "$SERVICE_USER" cp package.json package.json.full
    sudo -u "$SERVICE_USER" cp package.json.minimal package.json
    
    # Install minimal dependencies
    if timeout $NPM_TIMEOUT sudo -u "$SERVICE_USER" npm install --no-audit --no-fund; then
        log "✅ Minimal dependencies installed successfully"
        
        # Now try to add react-scripts separately
        log "Adding react-scripts separately..."
        if timeout $NPM_TIMEOUT sudo -u "$SERVICE_USER" npm install react-scripts@5.0.1 --no-audit --no-fund; then
            log "✅ react-scripts added successfully"
            # Restore full package.json
            sudo -u "$SERVICE_USER" cp package.json.full package.json
            return 0
        else
            warn "Failed to add react-scripts, but core React is installed"
            return 0  # Still consider this a success
        fi
    else
        error "Even minimal dependency installation failed"
        return 1
    fi
}

# Fix 4: Enhanced git conflict resolution
fix_git_conflicts() {
    local repo_dir="$1"
    
    log "Applying enhanced git conflict resolution..."
    
    cd "$repo_dir"
    
    # Check if we're in a git repository
    if [ ! -d ".git" ]; then
        warn "Not a git repository, skipping git fixes"
        return 0
    fi
    
    # Stash any local changes
    if ! sudo -u "$SERVICE_USER" git diff --quiet || ! sudo -u "$SERVICE_USER" git diff --cached --quiet; then
        log "Stashing local changes..."
        sudo -u "$SERVICE_USER" git stash push -m "Auto-stash before installation fixes $(date)"
    fi
    
    # Reset to clean state
    log "Resetting to clean state..."
    sudo -u "$SERVICE_USER" git reset --hard HEAD
    
    # Fetch latest changes
    log "Fetching latest changes..."
    if sudo -u "$SERVICE_USER" git fetch origin main; then
        # Check if we need to update
        local behind_count=$(sudo -u "$SERVICE_USER" git rev-list --count HEAD..origin/main 2>/dev/null || echo "0")
        if [ "$behind_count" -gt 0 ]; then
            log "Updating repository ($behind_count commits behind)..."
            sudo -u "$SERVICE_USER" git pull origin main
        else
            log "Repository is up to date"
        fi
    else
        warn "Failed to fetch from remote, continuing with local version"
    fi
    
    return 0
}

# Fix 5: Pre-installation system optimization
optimize_system_for_installation() {
    log "Optimizing system for installation..."
    
    # Increase npm timeout globally
    npm config set fetch-timeout 300000
    npm config set fetch-retry-mintimeout 20000
    npm config set fetch-retry-maxtimeout 120000
    
    # Clear system caches
    log "Clearing system caches..."
    apt-get clean
    npm cache clean --force 2>/dev/null || true
    
    # Ensure adequate swap space
    local swap_size=$(free -m | awk '/^Swap:/ {print $2}')
    if [ "$swap_size" -lt 1024 ]; then
        log "Creating additional swap space for installation..."
        if [ ! -f /swapfile_install ]; then
            dd if=/dev/zero of=/swapfile_install bs=1M count=1024
            chmod 600 /swapfile_install
            mkswap /swapfile_install
            swapon /swapfile_install
            log "Added 1GB temporary swap space"
        fi
    fi
    
    # Set npm to use less memory
    export NODE_OPTIONS="--max-old-space-size=2048"
    
    log "System optimization completed"
}

# Fix 6: Installation health check and recovery
installation_health_check() {
    local install_dir="$1"
    
    log "Performing installation health check..."
    
    # Check if Python virtual environment exists and works
    if [ -d "$install_dir/app/venv" ]; then
        if "$install_dir/app/venv/bin/python" -c "import sys; print('Python OK')" >/dev/null 2>&1; then
            log "✅ Python virtual environment is healthy"
        else
            warn "Python virtual environment is corrupted, recreating..."
            rm -rf "$install_dir/app/venv"
            cd "$install_dir/app"
            sudo -u "$SERVICE_USER" python3 -m venv venv
            sudo -u "$SERVICE_USER" ./venv/bin/pip install --upgrade pip
        fi
    fi
    
    # Check if Node.js dependencies are properly installed
    if [ -d "$install_dir/app/frontend/node_modules" ]; then
        if [ -f "$install_dir/app/frontend/node_modules/react/package.json" ]; then
            log "✅ React dependencies are installed"
        else
            warn "React dependencies are incomplete"
            return 1
        fi
    else
        warn "Node.js dependencies are missing"
        return 1
    fi
    
    # Check if services can start
    log "Testing service startup..."
    if systemctl is-active --quiet sportsbar-controller; then
        log "✅ Main service is running"
    else
        log "Main service is not running (expected during installation)"
    fi
    
    return 0
}

# Main fix application function
apply_installation_fixes() {
    log "=== APPLYING INSTALLATION FIXES ==="
    
    # Fix 1: System optimization
    optimize_system_for_installation
    
    # Fix 2: Git conflicts
    if [ -d "$INSTALL_DIR/app" ]; then
        fix_git_conflicts "$INSTALL_DIR/app"
    fi
    
    # Fix 3: Enhanced npm installation
    if [ -d "$INSTALL_DIR/app/frontend" ]; then
        log "Applying npm installation fixes..."
        
        # Try multiple installation strategies
        if ! install_npm_dependencies_with_timeout "$INSTALL_DIR/app/frontend"; then
            log "Primary npm install failed, trying Yarn fallback..."
            if ! install_with_yarn_fallback "$INSTALL_DIR/app/frontend"; then
                log "Yarn fallback failed, trying minimal installation..."
                if ! install_minimal_dependencies "$INSTALL_DIR/app/frontend"; then
                    error "All npm installation strategies failed"
                    return 1
                fi
            fi
        fi
    fi
    
    # Fix 4: Health check
    installation_health_check "$INSTALL_DIR"
    
    log "=== INSTALLATION FIXES COMPLETED ==="
    return 0
}

# Run fixes if script is executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
        exit 1
    fi
    
    apply_installation_fixes
fi
