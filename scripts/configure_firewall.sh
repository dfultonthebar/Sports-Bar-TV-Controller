
#!/bin/bash

# Firewall Configuration Script for Sports Bar TV Controller AI Services
# This script configures UFW firewall for secure AI service access

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AI_SERVICE_PORTS=(8001 8002 8003 8004 8005)
TRUSTED_NETWORKS=("192.168.1.0/24" "10.0.0.0/8" "172.16.0.0/12")
BACKUP_FILE="/tmp/ufw_backup_$(date +%Y%m%d_%H%M%S).json"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_ufw_installed() {
    if ! command -v ufw &> /dev/null; then
        log_error "UFW is not installed. Installing..."
        apt-get update && apt-get install -y ufw
        log_success "UFW installed successfully"
    else
        log_info "UFW is already installed"
    fi
}

backup_current_rules() {
    log_info "Backing up current firewall rules to $BACKUP_FILE"
    
    # Create backup using Python script
    python3 -c "
import subprocess
import json
from datetime import datetime

try:
    result = subprocess.run(['ufw', 'status', 'verbose'], capture_output=True, text=True)
    backup_data = {
        'timestamp': datetime.now().isoformat(),
        'ufw_status': result.stdout,
        'returncode': result.returncode
    }
    
    with open('$BACKUP_FILE', 'w') as f:
        json.dump(backup_data, f, indent=2)
    
    print('Backup created successfully')
except Exception as e:
    print(f'Error creating backup: {e}')
    exit(1)
"
    
    if [[ $? -eq 0 ]]; then
        log_success "Backup created: $BACKUP_FILE"
    else
        log_error "Failed to create backup"
        exit 1
    fi
}

configure_default_policies() {
    log_info "Configuring default UFW policies"
    
    ufw --force default deny incoming
    ufw --force default allow outgoing
    ufw --force default deny routed
    
    log_success "Default policies configured"
}

allow_essential_services() {
    log_info "Allowing essential services"
    
    # SSH access (essential for remote management)
    ufw allow 22/tcp comment 'SSH access'
    
    # HTTP and HTTPS for web interface
    ufw allow 80/tcp comment 'HTTP web interface'
    ufw allow 443/tcp comment 'HTTPS web interface'
    
    # Development web server
    ufw allow 8000/tcp comment 'Development web server'
    
    log_success "Essential services allowed"
}

configure_ai_services() {
    log_info "Configuring AI service access"
    
    local service_names=("chat_interface" "api_service" "websocket" "diagnostics" "rules_engine")
    
    for i in "${!AI_SERVICE_PORTS[@]}"; do
        local port=${AI_SERVICE_PORTS[$i]}
        local service=${service_names[$i]}
        
        log_info "Configuring port $port for $service"
        
        # Allow from trusted networks
        for network in "${TRUSTED_NETWORKS[@]}"; do
            ufw allow from "$network" to any port "$port" comment "AI $service from $network"
        done
        
        log_success "Port $port configured for $service"
    done
}

enable_firewall() {
    log_info "Enabling UFW firewall"
    
    # Check if UFW is already active
    if ufw status | grep -q "Status: active"; then
        log_warning "UFW is already active"
    else
        ufw --force enable
        log_success "UFW enabled successfully"
    fi
}

show_status() {
    log_info "Current firewall status:"
    echo
    ufw status verbose
    echo
}

test_connectivity() {
    log_info "Testing connectivity to AI services"
    
    for port in "${AI_SERVICE_PORTS[@]}"; do
        if nc -z localhost "$port" 2>/dev/null; then
            log_success "Port $port is accessible"
        else
            log_warning "Port $port is not accessible (service may not be running)"
        fi
    done
}

cleanup_old_rules() {
    log_info "Cleaning up old AI service rules"
    
    # Get numbered rules and delete AI service rules
    ufw status numbered | grep -E "(800[1-5]|AI)" | while read -r line; do
        if [[ $line =~ ^\[([0-9]+)\] ]]; then
            rule_num=${BASH_REMATCH[1]}
            log_info "Deleting rule $rule_num: $line"
            echo "y" | ufw delete "$rule_num" 2>/dev/null || true
        fi
    done
}

validate_configuration() {
    log_info "Validating firewall configuration"
    
    local errors=0
    
    # Check if UFW is active
    if ! ufw status | grep -q "Status: active"; then
        log_error "UFW is not active"
        ((errors++))
    fi
    
    # Check essential ports
    essential_ports=(22 80 443 8000)
    for port in "${essential_ports[@]}"; do
        if ! ufw status | grep -q "$port"; then
            log_error "Essential port $port is not configured"
            ((errors++))
        fi
    done
    
    # Check AI service ports
    for port in "${AI_SERVICE_PORTS[@]}"; do
        if ! ufw status | grep -q "$port"; then
            log_error "AI service port $port is not configured"
            ((errors++))
        fi
    done
    
    if [[ $errors -eq 0 ]]; then
        log_success "Firewall configuration is valid"
        return 0
    else
        log_error "Found $errors configuration errors"
        return 1
    fi
}

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Configure UFW firewall for Sports Bar TV Controller AI services"
    echo
    echo "Options:"
    echo "  --configure     Configure firewall (default action)"
    echo "  --cleanup       Clean up old AI service rules"
    echo "  --status        Show current firewall status"
    echo "  --test          Test connectivity to AI services"
    echo "  --validate      Validate current configuration"
    echo "  --backup        Create backup of current rules"
    echo "  --restore FILE  Restore rules from backup file"
    echo "  --help          Show this help message"
    echo
    echo "Examples:"
    echo "  sudo $0                    # Configure firewall"
    echo "  sudo $0 --cleanup          # Clean up old rules"
    echo "  sudo $0 --status           # Show status"
    echo "  sudo $0 --test             # Test connectivity"
}

restore_backup() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Restoring firewall rules from $backup_file"
    log_warning "This is a simplified restore - manual verification recommended"
    
    # This is a placeholder for restore functionality
    # In practice, you'd need to parse the backup and recreate rules
    log_info "Backup file contents:"
    cat "$backup_file"
}

main() {
    local action="configure"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --configure)
                action="configure"
                shift
                ;;
            --cleanup)
                action="cleanup"
                shift
                ;;
            --status)
                action="status"
                shift
                ;;
            --test)
                action="test"
                shift
                ;;
            --validate)
                action="validate"
                shift
                ;;
            --backup)
                action="backup"
                shift
                ;;
            --restore)
                action="restore"
                backup_file="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Execute action
    case $action in
        configure)
            log_info "Starting firewall configuration for AI services"
            check_root
            check_ufw_installed
            backup_current_rules
            configure_default_policies
            allow_essential_services
            configure_ai_services
            enable_firewall
            show_status
            validate_configuration
            log_success "Firewall configuration completed successfully"
            ;;
        cleanup)
            check_root
            cleanup_old_rules
            show_status
            ;;
        status)
            show_status
            ;;
        test)
            test_connectivity
            ;;
        validate)
            validate_configuration
            ;;
        backup)
            check_root
            backup_current_rules
            ;;
        restore)
            check_root
            restore_backup "$backup_file"
            ;;
        *)
            log_error "Unknown action: $action"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
