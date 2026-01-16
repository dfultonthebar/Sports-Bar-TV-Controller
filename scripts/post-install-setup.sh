#!/bin/bash

#############################################################################
# Sports Bar TV Controller - Post-Installation Setup Helper
#
# This script helps configure a newly installed system by:
# - Discovering devices on the network
# - Validating hardware connections
# - Setting up common configurations
#
# Usage: ./scripts/post-install-setup.sh
#############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_info() { echo -e "${CYAN}ℹ${NC} $1"; }

#############################################################################
# System Checks
#############################################################################

check_application() {
    print_header "Checking Application Status"

    if pm2 list 2>/dev/null | grep -q "sports-bar-tv-controller.*online"; then
        print_success "Application is running"
        local port_check=$(ss -tuln 2>/dev/null | grep ":3001 " || true)
        if [ -n "$port_check" ]; then
            print_success "Web interface is listening on port 3001"
        else
            print_warning "Port 3001 not detected yet (may still be starting)"
        fi
    else
        print_error "Application is NOT running"
        print_info "Start with: pm2 restart sports-bar-tv-controller"
        return 1
    fi
}

#############################################################################
# Network Discovery
#############################################################################

discover_devices() {
    print_header "Network Device Discovery"

    local subnet=$(ip route | grep -oP 'src \K[\d.]+' | head -1 | cut -d. -f1-3)
    print_info "Scanning subnet: ${subnet}.0/24"

    echo ""
    echo "Scanning for common devices..."
    echo ""

    # Wolf Pack Matrix (port 5000)
    echo -e "${CYAN}Wolf Pack Matrix (port 5000):${NC}"
    for ip in ${subnet}.100 ${subnet}.101 ${subnet}.102; do
        if timeout 1 bash -c "echo > /dev/tcp/$ip/5000" 2>/dev/null; then
            print_success "Found Wolf Pack at $ip:5000"
        fi
    done

    echo ""

    # DirecTV Receivers (port 8080)
    echo -e "${CYAN}DirecTV Receivers (port 8080):${NC}"
    for i in $(seq 121 128); do
        ip="${subnet}.$i"
        if timeout 1 bash -c "echo > /dev/tcp/$ip/8080" 2>/dev/null; then
            print_success "Found DirecTV at $ip:8080"
        fi
    done

    echo ""

    # Fire TV Devices (port 5555)
    echo -e "${CYAN}Fire TV Devices (port 5555):${NC}"
    for i in $(seq 131 140); do
        ip="${subnet}.$i"
        if timeout 1 bash -c "echo > /dev/tcp/$ip/5555" 2>/dev/null; then
            print_success "Found Fire TV at $ip:5555"
        fi
    done

    echo ""

    # Global Cache iTach (port 4998)
    echo -e "${CYAN}Global Cache iTach (port 4998):${NC}"
    for i in $(seq 140 145); do
        ip="${subnet}.$i"
        if timeout 1 bash -c "echo > /dev/tcp/$ip/4998" 2>/dev/null; then
            print_success "Found Global Cache at $ip:4998"
        fi
    done
}

#############################################################################
# Hardware Validation
#############################################################################

check_cec_adapters() {
    print_header "CEC Adapter Detection"

    if ! command -v cec-client &> /dev/null; then
        print_error "cec-client not installed"
        print_info "Install with: sudo apt install cec-utils"
        return 1
    fi

    local adapters=$(cec-client -l 2>&1)

    if echo "$adapters" | grep -q "Found devices: 0"; then
        print_warning "No CEC adapters found"
        print_info "Connect Pulse-Eight USB CEC adapter"
    else
        local count=$(echo "$adapters" | grep -oP 'Found devices: \K\d+' || echo "0")
        print_success "Found $count CEC adapter(s)"

        # List each adapter
        echo "$adapters" | grep -E "(device:|com port:)" | while read line; do
            echo "  $line"
        done
    fi
}

check_adb() {
    print_header "ADB (Fire TV) Status"

    if ! command -v adb &> /dev/null; then
        print_error "ADB not installed"
        print_info "Install with: sudo apt install adb"
        return 1
    fi

    print_success "ADB is installed"

    # Check connected devices
    local devices=$(adb devices 2>/dev/null | grep -v "List of" | grep -v "^$")

    if [ -z "$devices" ]; then
        print_warning "No ADB devices connected"
        print_info "Connect Fire TV: adb connect <ip>:5555"
    else
        print_success "Connected ADB devices:"
        echo "$devices" | while read line; do
            echo "  $line"
        done
    fi
}

#############################################################################
# Configuration Status
#############################################################################

check_database() {
    print_header "Database Status"

    local db_path="/home/ubuntu/sports-bar-data/production.db"

    if [ -f "$db_path" ]; then
        local size=$(du -h "$db_path" | cut -f1)
        print_success "Database exists: $db_path ($size)"

        # Check table counts
        if command -v sqlite3 &> /dev/null; then
            local tables=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "?")
            print_info "Tables in database: $tables"
        fi
    else
        print_error "Database not found at $db_path"
    fi
}

check_config_files() {
    print_header "Configuration Files"

    local data_dir="$HOME/Sports-Bar-TV-Controller/apps/web/data"

    # Check each config file
    for file in firetv-devices.json directv-devices.json tv-layout.json device-subscriptions.json everpass-devices.json; do
        if [ -f "$data_dir/$file" ]; then
            local count=$(cat "$data_dir/$file" | grep -o '"id"' | wc -l 2>/dev/null || echo "0")
            print_success "$file (${count} devices)"
        else
            print_warning "$file not found"
        fi
    done
}

#############################################################################
# Tailscale Status
#############################################################################

check_tailscale() {
    print_header "Tailscale Remote Access"

    if ! command -v tailscale &> /dev/null; then
        print_warning "Tailscale not installed"
        print_info "Install with: curl -fsSL https://tailscale.com/install.sh | sh"
        return 0
    fi

    local status=$(tailscale status 2>&1)

    if echo "$status" | grep -q "Tailscale is stopped"; then
        print_warning "Tailscale is stopped"
        print_info "Start with: sudo tailscale up --ssh"
    elif echo "$status" | grep -q "100."; then
        local ts_ip=$(tailscale ip -4 2>/dev/null || echo "unknown")
        print_success "Tailscale connected: $ts_ip"
        print_info "SSH remotely: ssh ubuntu@$ts_ip"
    else
        print_warning "Tailscale status unknown"
        print_info "Run: sudo tailscale up --ssh"
    fi
}

#############################################################################
# Ollama Status
#############################################################################

check_ollama() {
    print_header "Ollama AI Status"

    if ! command -v ollama &> /dev/null; then
        print_warning "Ollama not installed"
        return 0
    fi

    if curl -s http://localhost:11434/api/tags &>/dev/null; then
        print_success "Ollama service is running"

        # List installed models
        local models=$(ollama list 2>/dev/null | tail -n +2)
        if [ -n "$models" ]; then
            print_info "Installed models:"
            echo "$models" | while read line; do
                echo "  $line"
            done
        else
            print_warning "No models installed"
            print_info "Install models: ollama pull llama3.2:3b"
        fi
    else
        print_warning "Ollama service is not running"
        print_info "Start with: sudo systemctl start ollama"
    fi
}

#############################################################################
# Summary & Recommendations
#############################################################################

show_summary() {
    print_header "Setup Summary & Next Steps"

    local local_ip=$(hostname -I | awk '{print $1}')

    echo -e "${CYAN}Access Points:${NC}"
    echo "  Web Interface:    http://$local_ip:3001"
    echo "  Remote Control:   http://$local_ip:3001/remote"
    echo "  Device Config:    http://$local_ip:3001/device-config"
    echo "  Matrix Control:   http://$local_ip:3001/matrix-control"
    echo ""

    echo -e "${CYAN}Next Steps:${NC}"
    echo "  1. Open web interface at http://$local_ip:3001"
    echo "  2. Go to Device Config → Configure your devices"
    echo "  3. Go to Matrix Control → Label inputs/outputs"
    echo "  4. Go to Sports Guide Config → Add channel presets"
    echo "  5. Go to Layout Editor → Upload floor plan"
    echo ""

    echo -e "${CYAN}Useful Commands:${NC}"
    echo "  pm2 status                    # Check app status"
    echo "  pm2 logs                      # View logs"
    echo "  pm2 restart sports-bar-tv-controller  # Restart"
    echo "  cec-client -l                 # List CEC adapters"
    echo "  adb devices                   # List Fire TV connections"
    echo ""
}

#############################################################################
# Main
#############################################################################

main() {
    print_header "Sports Bar TV Controller - Post-Install Setup"

    echo "This script will check your installation and help configure devices."
    echo ""

    check_application
    check_database
    check_config_files
    echo ""

    check_cec_adapters
    check_adb
    echo ""

    discover_devices
    echo ""

    check_tailscale
    check_ollama
    echo ""

    show_summary
}

main "$@"
