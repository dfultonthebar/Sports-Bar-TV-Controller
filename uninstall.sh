
#!/bin/bash

#############################################################################
# Sports Bar TV Controller - Uninstall Script
# 
# This script removes the Sports Bar TV Controller application and optionally
# removes dependencies like Node.js, Ollama, and models.
#
# Usage: 
#   ./uninstall.sh                    # Interactive mode
#   ./uninstall.sh --yes              # Non-interactive (auto-confirm)
#   ./uninstall.sh --keep-nodejs      # Keep Node.js installed
#   ./uninstall.sh --keep-ollama      # Keep Ollama and models
#   ./uninstall.sh --backup           # Backup data before removal
#   ./uninstall.sh --dry-run          # Show what would be removed
#
# Examples:
#   # Interactive uninstall
#   ./uninstall.sh
#
#   # Quick uninstall without prompts
#   ./uninstall.sh --yes
#
#   # Uninstall but keep dependencies
#   ./uninstall.sh --yes --keep-nodejs --keep-ollama
#
#   # Backup and uninstall
#   ./uninstall.sh --backup --yes
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

# Default configuration
INSTALL_DIR="${INSTALL_DIR:-$HOME/Sports-Bar-TV-Controller}"
SERVICE_NAME="sportsbar-assistant"
LOG_FILE="/tmp/sportsbar-uninstall-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="$HOME/sportsbar-backup-$(date +%Y%m%d-%H%M%S)"

# Flags
INTERACTIVE=true
KEEP_NODEJS=false
KEEP_OLLAMA=false
DO_BACKUP=false
DRY_RUN=false

# Determine if we're using a service user
if [[ "$INSTALL_DIR" == /opt/* ]] || [[ "$INSTALL_DIR" == /usr/* ]]; then
    USE_SERVICE_USER=true
    SERVICE_USER="${SERVICE_USER:-sportsbar}"
else
    USE_SERVICE_USER=false
    SERVICE_USER="$USER"
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

confirm() {
    if [ "$INTERACTIVE" = false ]; then
        return 0
    fi
    
    local prompt="$1"
    local default="${2:-n}"
    
    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi
    
    read -p "$prompt" response
    response=${response:-$default}
    
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

execute_or_dry_run() {
    local description="$1"
    shift
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would execute: $description"
        log "[DRY RUN] $description: $*"
    else
        log_and_print "$description"
        "$@" 2>&1 | tee -a "$LOG_FILE" || true
    fi
}

#############################################################################
# Parse Command Line Arguments
#############################################################################

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --yes|-y)
                INTERACTIVE=false
                shift
                ;;
            --keep-nodejs)
                KEEP_NODEJS=true
                shift
                ;;
            --keep-ollama)
                KEEP_OLLAMA=true
                shift
                ;;
            --backup|-b)
                DO_BACKUP=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
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
Sports Bar TV Controller - Uninstall Script

Usage: ./uninstall.sh [OPTIONS]

OPTIONS:
    --yes, -y           Non-interactive mode (auto-confirm all prompts)
    --keep-nodejs       Keep Node.js and npm installed
    --keep-ollama       Keep Ollama and all models installed
    --backup, -b        Backup database and configuration before removal
    --dry-run           Show what would be removed without actually removing
    --help, -h          Show this help message

EXAMPLES:
    # Interactive uninstall
    ./uninstall.sh

    # Quick uninstall without prompts
    ./uninstall.sh --yes

    # Uninstall but keep dependencies
    ./uninstall.sh --yes --keep-nodejs --keep-ollama

    # Backup and uninstall
    ./uninstall.sh --backup --yes

    # See what would be removed
    ./uninstall.sh --dry-run

ENVIRONMENT VARIABLES:
    INSTALL_DIR         Installation directory (default: \$HOME/Sports-Bar-TV-Controller)
    SERVICE_USER        Service user name (default: sportsbar for system installs, \$USER for home)

EOF
}

#############################################################################
# Backup Functions
#############################################################################

backup_data() {
    if [ "$DO_BACKUP" = false ]; then
        return 0
    fi
    
    print_header "Creating Backup"
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would create backup at: $BACKUP_DIR"
        return 0
    fi
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    if [ -f "$INSTALL_DIR/prisma/data/sports_bar.db" ]; then
        print_info "Backing up database..."
        cp "$INSTALL_DIR/prisma/data/sports_bar.db" "$BACKUP_DIR/"
        print_success "Database backed up"
    fi
    
    # Backup .env file
    if [ -f "$INSTALL_DIR/.env" ]; then
        print_info "Backing up .env file..."
        cp "$INSTALL_DIR/.env" "$BACKUP_DIR/"
        print_success ".env file backed up"
    fi
    
    # Backup knowledge base
    if [ -d "$INSTALL_DIR/knowledge-base" ]; then
        print_info "Backing up knowledge base..."
        cp -r "$INSTALL_DIR/knowledge-base" "$BACKUP_DIR/"
        print_success "Knowledge base backed up"
    fi
    
    # Backup logs
    if [ -d "$INSTALL_DIR/logs" ]; then
        print_info "Backing up logs..."
        cp -r "$INSTALL_DIR/logs" "$BACKUP_DIR/"
        print_success "Logs backed up"
    fi
    
    print_success "Backup created at: $BACKUP_DIR"
    log "Backup created at: $BACKUP_DIR"
}

#############################################################################
# Service Management
#############################################################################

stop_services() {
    print_header "Stopping Services"
    
    # Stop PM2 processes
    if command -v pm2 &> /dev/null; then
        print_info "Stopping PM2 processes..."
        execute_or_dry_run "Stop PM2 processes" pm2 stop all || true
        execute_or_dry_run "Delete PM2 processes" pm2 delete all || true
        print_success "PM2 processes stopped"
    fi
    
    # Stop systemd service
    if systemctl list-units --full -all | grep -q "$SERVICE_NAME.service"; then
        print_info "Stopping systemd service..."
        execute_or_dry_run "Stop systemd service" sudo systemctl stop "$SERVICE_NAME" || true
        execute_or_dry_run "Disable systemd service" sudo systemctl disable "$SERVICE_NAME" || true
        print_success "Systemd service stopped"
    fi
    
    # Stop Ollama service (if we're removing it)
    if [ "$KEEP_OLLAMA" = false ]; then
        if systemctl list-units --full -all | grep -q "ollama.service"; then
            print_info "Stopping Ollama service..."
            execute_or_dry_run "Stop Ollama service" sudo systemctl stop ollama || true
            execute_or_dry_run "Disable Ollama service" sudo systemctl disable ollama || true
            print_success "Ollama service stopped"
        fi
    fi
}

#############################################################################
# Application Removal
#############################################################################

remove_application() {
    print_header "Removing Application"
    
    if [ ! -d "$INSTALL_DIR" ]; then
        print_warning "Installation directory not found: $INSTALL_DIR"
        return 0
    fi
    
    if [ "$INTERACTIVE" = true ]; then
        print_warning "This will remove the application directory: $INSTALL_DIR"
        if ! confirm "Are you sure you want to continue?" "n"; then
            print_info "Skipping application removal"
            return 0
        fi
    fi
    
    print_info "Removing application directory..."
    execute_or_dry_run "Remove application directory" rm -rf "$INSTALL_DIR"
    print_success "Application directory removed"
}

remove_database() {
    print_header "Removing Database Files"
    
    local db_locations=(
        "$INSTALL_DIR/prisma/data/sports_bar.db"
        "$INSTALL_DIR/prisma/data/sports_bar.db-journal"
        "$HOME/.local/share/sportsbar/sports_bar.db"
    )
    
    for db_file in "${db_locations[@]}"; do
        if [ -f "$db_file" ]; then
            print_info "Removing database: $db_file"
            execute_or_dry_run "Remove database file" rm -f "$db_file"
        fi
    done
    
    print_success "Database files removed"
}

remove_logs_and_temp() {
    print_header "Removing Logs and Temporary Files"
    
    local log_locations=(
        "$INSTALL_DIR/logs"
        "$HOME/.pm2/logs/*sportsbar*"
        "/tmp/sportsbar-*"
        "/tmp/ollama-*"
    )
    
    for log_path in "${log_locations[@]}"; do
        if [ -e "$log_path" ] || ls $log_path 2>/dev/null; then
            print_info "Removing: $log_path"
            execute_or_dry_run "Remove logs/temp" rm -rf $log_path
        fi
    done
    
    print_success "Logs and temporary files removed"
}

#############################################################################
# System Files Removal
#############################################################################

remove_systemd_service() {
    print_header "Removing Systemd Service Files"
    
    local service_file="/etc/systemd/system/$SERVICE_NAME.service"
    
    if [ -f "$service_file" ]; then
        print_info "Removing systemd service file..."
        execute_or_dry_run "Remove systemd service" sudo rm -f "$service_file"
        execute_or_dry_run "Reload systemd daemon" sudo systemctl daemon-reload
        print_success "Systemd service file removed"
    else
        print_info "No systemd service file found"
    fi
}

remove_pm2_config() {
    print_header "Removing PM2 Configuration"
    
    if [ -d "$HOME/.pm2" ]; then
        print_info "Removing PM2 configuration..."
        execute_or_dry_run "Remove PM2 config" rm -rf "$HOME/.pm2"
        print_success "PM2 configuration removed"
    fi
}

#############################################################################
# Dependency Removal
#############################################################################

remove_nodejs() {
    if [ "$KEEP_NODEJS" = true ]; then
        print_info "Keeping Node.js (--keep-nodejs flag set)"
        return 0
    fi
    
    print_header "Removing Node.js"
    
    if [ "$INTERACTIVE" = true ]; then
        if ! confirm "Remove Node.js and npm?" "n"; then
            print_info "Keeping Node.js"
            return 0
        fi
    fi
    
    if command -v node &> /dev/null; then
        print_info "Removing Node.js..."
        
        # Remove nvm if installed
        if [ -d "$HOME/.nvm" ]; then
            execute_or_dry_run "Remove nvm" rm -rf "$HOME/.nvm"
        fi
        
        # Remove system Node.js
        execute_or_dry_run "Remove Node.js packages" sudo apt-get remove -y nodejs npm || true
        execute_or_dry_run "Autoremove Node.js dependencies" sudo apt-get autoremove -y || true
        
        print_success "Node.js removed"
    else
        print_info "Node.js not found"
    fi
}

remove_ollama() {
    if [ "$KEEP_OLLAMA" = true ]; then
        print_info "Keeping Ollama (--keep-ollama flag set)"
        return 0
    fi
    
    print_header "Removing Ollama"
    
    if [ "$INTERACTIVE" = true ]; then
        if ! confirm "Remove Ollama and all models?" "n"; then
            print_info "Keeping Ollama"
            return 0
        fi
    fi
    
    if command -v ollama &> /dev/null; then
        print_info "Removing Ollama..."
        
        # Remove Ollama binary
        execute_or_dry_run "Remove Ollama binary" sudo rm -f /usr/local/bin/ollama
        execute_or_dry_run "Remove Ollama binary (alt)" sudo rm -f /usr/bin/ollama
        
        # Remove Ollama service
        execute_or_dry_run "Remove Ollama service" sudo rm -f /etc/systemd/system/ollama.service
        execute_or_dry_run "Reload systemd" sudo systemctl daemon-reload
        
        # Remove Ollama data and models
        execute_or_dry_run "Remove Ollama data" sudo rm -rf /usr/share/ollama
        execute_or_dry_run "Remove Ollama models" rm -rf "$HOME/.ollama"
        
        print_success "Ollama removed"
    else
        print_info "Ollama not found"
    fi
}

remove_service_user() {
    if [ "$USE_SERVICE_USER" = false ]; then
        return 0
    fi
    
    print_header "Removing Service User"
    
    if id "$SERVICE_USER" &>/dev/null; then
        if [ "$INTERACTIVE" = true ]; then
            if ! confirm "Remove service user '$SERVICE_USER'?" "n"; then
                print_info "Keeping service user"
                return 0
            fi
        fi
        
        print_info "Removing service user..."
        execute_or_dry_run "Remove service user" sudo userdel -r "$SERVICE_USER" || true
        print_success "Service user removed"
    fi
}

#############################################################################
# Main Uninstall Process
#############################################################################

main() {
    parse_arguments "$@"
    
    print_header "Sports Bar TV Controller - Uninstall"
    
    if [ "$DRY_RUN" = true ]; then
        print_warning "DRY RUN MODE - No changes will be made"
    fi
    
    print_info "Installation directory: $INSTALL_DIR"
    print_info "Service user: $SERVICE_USER"
    print_info "Log file: $LOG_FILE"
    
    if [ "$DO_BACKUP" = true ]; then
        print_info "Backup directory: $BACKUP_DIR"
    fi
    
    echo ""
    
    # Confirm uninstall
    if [ "$INTERACTIVE" = true ] && [ "$DRY_RUN" = false ]; then
        print_warning "This will remove the Sports Bar TV Controller application."
        if ! confirm "Do you want to continue?" "n"; then
            print_info "Uninstall cancelled"
            exit 0
        fi
    fi
    
    # Create backup if requested
    backup_data
    
    # Stop all services
    stop_services
    
    # Remove application and data
    remove_application
    remove_database
    remove_logs_and_temp
    
    # Remove system files
    remove_systemd_service
    remove_pm2_config
    
    # Remove dependencies (if requested)
    remove_nodejs
    remove_ollama
    
    # Remove service user (if applicable)
    remove_service_user
    
    # Final summary
    print_header "Uninstall Complete"
    
    if [ "$DRY_RUN" = true ]; then
        print_success "Dry run completed - no changes were made"
    else
        print_success "Sports Bar TV Controller has been uninstalled"
    fi
    
    if [ "$DO_BACKUP" = true ] && [ "$DRY_RUN" = false ]; then
        print_info "Backup saved at: $BACKUP_DIR"
    fi
    
    print_info "Log file: $LOG_FILE"
    
    if [ "$KEEP_NODEJS" = true ]; then
        print_info "Node.js was kept (use --keep-nodejs=false to remove)"
    fi
    
    if [ "$KEEP_OLLAMA" = true ]; then
        print_info "Ollama was kept (use --keep-ollama=false to remove)"
    fi
    
    echo ""
    print_info "To reinstall, run:"
    echo "  curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash"
    echo ""
}

# Run main function
main "$@"
