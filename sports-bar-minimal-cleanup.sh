#!/bin/bash
################################################################################
# Sports Bar TV Controller - System Cleanup Script
#
# Purpose: Remove unnecessary packages and services from Ubuntu 22.04 LTS
#          to create a minimal appliance for Sports Bar TV Controller
#
# WARNING: This script makes DESTRUCTIVE changes to the system!
#          - Removes desktop environments
#          - Removes browsers, snap, cloud-init
#          - Disables many services
#
# REQUIREMENTS:
#   - Ubuntu 22.04 LTS
#   - Root/sudo access
#   - BACKUP created before running!
#
# Usage:
#   sudo bash sports-bar-minimal-cleanup.sh [--dry-run] [--aggressive]
#
# Options:
#   --dry-run      Show what would be removed without actually removing
#   --aggressive   Also remove development tools and optional packages
#
# Author: System Analysis
# Version: 1.0
# Date: 2025-11-21
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DRY_RUN=false
AGGRESSIVE=false
BACKUP_DIR="/tmp/sports-bar-cleanup-backup-$(date +%Y%m%d-%H%M%S)"

# Parse arguments
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --aggressive)
      AGGRESSIVE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--aggressive]"
      echo ""
      echo "Options:"
      echo "  --dry-run      Show what would be removed without actually removing"
      echo "  --aggressive   Also remove development tools and optional packages"
      echo "  --help         Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

################################################################################
# Functions
################################################################################

print_header() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC} $1"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
}

print_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

run_command() {
  local cmd="$1"
  local description="$2"

  if [ "$DRY_RUN" = true ]; then
    print_info "[DRY-RUN] Would execute: $cmd"
    return 0
  fi

  print_info "$description"
  if eval "$cmd" 2>&1 | tee -a "$BACKUP_DIR/cleanup.log"; then
    return 0
  else
    print_warning "Command failed (non-fatal): $cmd"
    return 1
  fi
}

create_backup() {
  print_info "Creating backup directory: $BACKUP_DIR"
  mkdir -p "$BACKUP_DIR"

  print_info "Backing up package list..."
  dpkg --get-selections > "$BACKUP_DIR/packages-before.txt"
  apt-mark showmanual > "$BACKUP_DIR/manual-packages-before.txt"
  apt-mark showauto > "$BACKUP_DIR/auto-packages-before.txt"

  print_info "Backing up service states..."
  systemctl list-unit-files --type=service > "$BACKUP_DIR/services-before.txt"

  print_info "Backing up disk usage..."
  df -h > "$BACKUP_DIR/df-before.txt"
  du -sh /* 2>/dev/null | sort -rh > "$BACKUP_DIR/du-before.txt"

  print_info "Backup complete: $BACKUP_DIR"
}

show_stats() {
  local label="$1"
  local packages=$(dpkg --list | grep "^ii" | wc -l)
  local services=$(systemctl list-unit-files --type=service --state=enabled | wc -l)
  local disk=$(df -h / | tail -1 | awk '{print $3}')

  echo ""
  print_header "$label Statistics"
  echo "  Packages installed: $packages"
  echo "  Services enabled:   $services"
  echo "  Disk used:          $disk"
  echo ""
}

confirm_action() {
  if [ "$DRY_RUN" = true ]; then
    return 0
  fi

  echo ""
  print_warning "═══════════════════════════════════════════════════════════════"
  print_warning "                        ⚠️  WARNING  ⚠️"
  print_warning "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "This script will make DESTRUCTIVE changes to your system:"
  echo ""
  echo "  • Remove desktop environment (Xfce, X11, GTK)"
  echo "  • Remove browsers (Chrome, Firefox)"
  echo "  • Remove Snap packages and daemon (2.3GB)"
  echo "  • Remove cloud-init and related services"
  echo "  • Remove unnecessary hardware support"
  echo "  • Remove old kernel versions"
  echo "  • Disable 20+ services"
  echo ""

  if [ "$AGGRESSIVE" = true ]; then
    echo "  • [AGGRESSIVE] Remove development tools"
    echo "  • [AGGRESSIVE] Remove documentation and man pages"
    echo "  • [AGGRESSIVE] Remove non-English locales"
    echo ""
  fi

  echo "Expected savings: ~5-7GB disk space"
  echo ""
  print_warning "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Have you created a backup of your system?"
  echo "Recommended: sudo dd if=/dev/sda of=/backup/system.img bs=4M"
  echo ""
  read -p "Type 'yes' to continue, anything else to abort: " confirm

  if [ "$confirm" != "yes" ]; then
    print_error "Aborted by user."
    exit 1
  fi
}

check_requirements() {
  print_header "Checking Requirements"

  # Check if root
  if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root (use sudo)"
    exit 1
  fi

  # Check if Ubuntu 22.04
  if [ ! -f /etc/os-release ]; then
    print_error "Cannot determine OS version"
    exit 1
  fi

  source /etc/os-release
  if [ "$ID" != "ubuntu" ] || [ "${VERSION_ID%%.*}" != "22" ]; then
    print_error "This script is designed for Ubuntu 22.04 only"
    print_error "Detected: $ID $VERSION_ID"
    exit 1
  fi

  print_info "OS: Ubuntu $VERSION_ID ✓"

  # Check critical services are running
  if ! systemctl is-active --quiet ssh; then
    print_warning "SSH service is not running - you may lose remote access!"
    read -p "Continue anyway? (yes/no): " ssh_confirm
    if [ "$ssh_confirm" != "yes" ]; then
      exit 1
    fi
  fi

  print_info "Requirements check passed ✓"
}

remove_desktop_environment() {
  print_header "Phase 1: Removing Desktop Environment"

  # Xfce desktop
  run_command \
    "apt purge -y xfce4 xfce4-goodies 2>/dev/null || true" \
    "Removing Xfce desktop..."

  # Xorg/X11
  run_command \
    "apt purge -y 'xserver-xorg*' xorg x11-* 2>/dev/null || true" \
    "Removing X11 server..."

  # GTK/Desktop libraries
  run_command \
    "apt purge -y 'libgtk-3-*' 'libgtk2.0-*' libwebkit2gtk-4.0-37 2>/dev/null || true" \
    "Removing GTK libraries..."

  # GNOME components
  run_command \
    "apt purge -y 'gnome-*' 2>/dev/null || true" \
    "Removing GNOME components..."

  # Desktop utilities
  run_command \
    "apt purge -y xdg-* desktop-base desktop-file-utils 2>/dev/null || true" \
    "Removing desktop utilities..."

  # Remote desktop
  run_command \
    "apt purge -y xrdp xrdp-sesman xorgxrdp 2>/dev/null || true" \
    "Removing XRDP..."

  print_info "Desktop environment removal complete"
}

remove_browsers() {
  print_header "Phase 2: Removing Web Browsers"

  run_command \
    "apt purge -y google-chrome-stable 2>/dev/null || true" \
    "Removing Google Chrome..."

  run_command \
    "apt purge -y firefox firefox-* 2>/dev/null || true" \
    "Removing Firefox..."

  print_info "Browser removal complete"
}

remove_snap() {
  print_header "Phase 3: Removing Snap Packages"

  if [ "$DRY_RUN" = false ]; then
    print_info "Stopping snap services..."
    systemctl stop snapd.service snapd.socket 2>/dev/null || true
    systemctl disable snapd.service snapd.socket 2>/dev/null || true
  fi

  run_command \
    "apt purge -y snapd 2>/dev/null || true" \
    "Removing snapd package..."

  if [ "$DRY_RUN" = false ]; then
    print_info "Removing snap directories..."
    rm -rf /var/lib/snapd /snap ~/snap

    # Prevent snap from being reinstalled
    cat > /etc/apt/preferences.d/no-snap.pref << EOF
Package: snapd
Pin: release a=*
Pin-Priority: -10
EOF
  fi

  print_info "Snap removal complete (freed ~2.3GB)"
}

remove_cloud_init() {
  print_header "Phase 4: Removing Cloud-Init"

  run_command \
    "systemctl disable --now cloud-init cloud-init-local cloud-config cloud-final 2>/dev/null || true" \
    "Disabling cloud-init services..."

  run_command \
    "apt purge -y cloud-init cloud-initramfs-* pollinate ubuntu-advantage-tools 2>/dev/null || true" \
    "Removing cloud-init packages..."

  if [ "$DRY_RUN" = false ]; then
    # Create disable file
    touch /etc/cloud/cloud-init.disabled
  fi

  print_info "Cloud-init removal complete"
}

remove_unnecessary_hardware() {
  print_header "Phase 5: Removing Unnecessary Hardware Support"

  # Modem support
  run_command \
    "systemctl disable --now ModemManager 2>/dev/null || true" \
    "Disabling ModemManager..."

  run_command \
    "apt purge -y modemmanager 'libmm-glib*' 2>/dev/null || true" \
    "Removing modem packages..."

  # Avahi/mDNS
  run_command \
    "systemctl disable --now avahi-daemon 2>/dev/null || true" \
    "Disabling Avahi..."

  run_command \
    "apt purge -y avahi-daemon 'libavahi-*' 2>/dev/null || true" \
    "Removing Avahi packages..."

  # Bluetooth
  run_command \
    "apt purge -y bluez bluez-obexd bluetooth 2>/dev/null || true" \
    "Removing Bluetooth support..."

  # Printer/Scanner support
  run_command \
    "apt purge -y 'cups*' 'printer-driver-*' 'sane-*' ipp-usb hplip 2>/dev/null || true" \
    "Removing printer/scanner support..."

  # MultiPath
  run_command \
    "systemctl disable --now multipathd 2>/dev/null || true" \
    "Disabling multipathd..."

  run_command \
    "apt purge -y multipath-tools 2>/dev/null || true" \
    "Removing multipath tools..."

  # Other services
  run_command \
    "systemctl disable --now udisks2 packagekit bolt fwupd 2>/dev/null || true" \
    "Disabling desktop services..."

  run_command \
    "apt purge -y udisks2 packagekit bolt fwupd 2>/dev/null || true" \
    "Removing desktop service packages..."

  print_info "Unnecessary hardware support removed"
}

remove_old_kernels() {
  print_header "Phase 6: Removing Old Kernels"

  current_kernel=$(uname -r | sed 's/-generic//')
  print_info "Current kernel: $current_kernel"

  if [ "$DRY_RUN" = true ]; then
    print_info "[DRY-RUN] Would remove old kernels except $current_kernel"
    dpkg -l 'linux-*' | grep '^ii' | awk '{print $2}' | grep -vE "$current_kernel" | grep -E 'linux-(image|modules|headers)' || true
  else
    old_kernels=$(dpkg -l 'linux-*' | grep '^ii' | awk '{print $2}' | grep -vE "$current_kernel" | grep -E 'linux-(image|modules|headers)' || true)

    if [ -n "$old_kernels" ]; then
      print_info "Removing old kernel packages..."
      echo "$old_kernels" | xargs apt purge -y 2>/dev/null || true
      print_info "Old kernels removed (freed ~673MB)"
    else
      print_info "No old kernels to remove"
    fi
  fi
}

remove_aggressive() {
  if [ "$AGGRESSIVE" != true ]; then
    return 0
  fi

  print_header "Phase 7: Aggressive Cleanup"

  # Development tools
  run_command \
    "apt purge -y gcc g++ build-essential 'lib*-dev' manpages-dev 2>/dev/null || true" \
    "Removing development tools..."

  # Documentation
  if [ "$DRY_RUN" = false ]; then
    print_info "Removing documentation..."
    rm -rf /usr/share/doc/*
    rm -rf /usr/share/man/*

    # Keep minimal man pages for emergencies
    mkdir -p /usr/share/man/man1
    touch /usr/share/man/man1/.keep
  fi

  run_command \
    "apt purge -y man-db manpages 2>/dev/null || true" \
    "Removing man-db..."

  # Locales
  if [ "$DRY_RUN" = false ]; then
    print_info "Installing localepurge..."
    echo 'localepurge localepurge/mandelete boolean true' | debconf-set-selections
    echo 'localepurge localepurge/dontbothernew boolean true' | debconf-set-selections
    echo 'localepurge localepurge/quickndirtycalc boolean true' | debconf-set-selections
    echo 'localepurge localepurge/nopurge string en_US.UTF-8' | debconf-set-selections

    apt install -y localepurge

    cat > /etc/locale.nopurge << EOF
MANDELETE
SHOWFREEDSPACE
en_US.UTF-8
POSIX
EOF

    localepurge
    print_info "Non-English locales removed (freed ~63MB)"
  fi

  print_info "Aggressive cleanup complete"
}

final_cleanup() {
  print_header "Phase 8: Final Cleanup"

  run_command \
    "apt autoremove -y --purge" \
    "Removing orphaned packages..."

  run_command \
    "apt clean" \
    "Cleaning package cache..."

  run_command \
    "apt autoclean" \
    "Cleaning old package cache..."

  if [ "$DRY_RUN" = false ]; then
    print_info "Limiting journal size to 100MB..."
    mkdir -p /etc/systemd/journald.conf.d/
    cat > /etc/systemd/journald.conf.d/size.conf << EOF
[Journal]
SystemMaxUse=100M
SystemKeepFree=1G
MaxRetentionSec=7day
EOF

    journalctl --vacuum-time=1d 2>/dev/null || true
    systemctl restart systemd-journald
  fi

  print_info "Final cleanup complete"
}

verify_critical_services() {
  print_header "Verifying Critical Services"

  critical_services=(
    "ssh"
    "systemd-networkd"
    "systemd-resolved"
  )

  all_ok=true
  for service in "${critical_services[@]}"; do
    if systemctl is-active --quiet "$service"; then
      print_info "✓ $service is running"
    else
      print_error "✗ $service is NOT running!"
      all_ok=false
    fi
  done

  # Check PM2 (might not be running if app stopped)
  if systemctl is-enabled --quiet pm2-ubuntu 2>/dev/null; then
    print_info "✓ pm2-ubuntu service is enabled"
  else
    print_warning "⚠ pm2-ubuntu service not found (is PM2 installed?)"
  fi

  # Check Node.js
  if command -v node &> /dev/null; then
    node_version=$(node -v)
    print_info "✓ Node.js $node_version installed"
  else
    print_error "✗ Node.js not found!"
    all_ok=false
  fi

  # Check SQLite
  if command -v sqlite3 &> /dev/null; then
    sqlite_version=$(sqlite3 --version | awk '{print $1}')
    print_info "✓ SQLite $sqlite_version installed"
  else
    print_error "✗ SQLite not found!"
    all_ok=false
  fi

  if [ "$all_ok" = false ]; then
    print_error "Some critical services/packages are missing!"
    print_error "System may not function correctly."
    return 1
  fi

  print_info "All critical services verified ✓"
  return 0
}

create_post_cleanup_report() {
  local report="$BACKUP_DIR/cleanup-report.txt"

  print_info "Creating post-cleanup report..."

  {
    echo "Sports Bar TV Controller - Cleanup Report"
    echo "=========================================="
    echo "Date: $(date)"
    echo "Hostname: $(hostname)"
    echo ""
    echo "System Information:"
    echo "-------------------"
    echo "OS: $(lsb_release -d | cut -f2)"
    echo "Kernel: $(uname -r)"
    echo ""
    echo "Package Statistics:"
    echo "-------------------"
    echo "Before: $(wc -l < "$BACKUP_DIR/packages-before.txt") packages"
    echo "After:  $(dpkg --list | grep "^ii" | wc -l) packages"
    echo "Removed: $(($(wc -l < "$BACKUP_DIR/packages-before.txt") - $(dpkg --list | grep "^ii" | wc -l))) packages"
    echo ""
    echo "Service Statistics:"
    echo "-------------------"
    echo "Before: $(wc -l < "$BACKUP_DIR/services-before.txt") services"
    echo "After:  $(systemctl list-unit-files --type=service | wc -l) services"
    echo ""
    echo "Disk Usage:"
    echo "-----------"
    df -h /
    echo ""
    echo "Enabled Services:"
    echo "-----------------"
    systemctl list-unit-files --type=service --state=enabled
    echo ""
    echo "Running Services:"
    echo "-----------------"
    systemctl --type=service --state=running
    echo ""
    echo "Installed Packages:"
    echo "-------------------"
    dpkg --list | grep "^ii"
  } > "$report"

  dpkg --get-selections > "$BACKUP_DIR/packages-after.txt"

  print_info "Report saved to: $report"
}

################################################################################
# Main Execution
################################################################################

main() {
  clear

  print_header "Sports Bar TV Controller - System Cleanup"
  echo "Version: 1.0"
  echo "Date: $(date)"
  echo ""

  if [ "$DRY_RUN" = true ]; then
    print_warning "DRY-RUN MODE: No changes will be made"
  fi

  if [ "$AGGRESSIVE" = true ]; then
    print_warning "AGGRESSIVE MODE: Will remove dev tools, docs, locales"
  fi

  echo ""

  # Pre-flight checks
  check_requirements
  show_stats "BEFORE"

  # Create backup
  create_backup

  # Confirm with user
  confirm_action

  # Execute cleanup phases
  remove_desktop_environment
  remove_browsers
  remove_snap
  remove_cloud_init
  remove_unnecessary_hardware
  remove_old_kernels
  remove_aggressive
  final_cleanup

  # Verify system still works
  if ! verify_critical_services; then
    print_error "Critical service verification failed!"
    print_error "Review logs in: $BACKUP_DIR"
    exit 1
  fi

  # Show results
  show_stats "AFTER"

  # Create report
  if [ "$DRY_RUN" = false ]; then
    create_post_cleanup_report
  fi

  # Final message
  print_header "Cleanup Complete!"
  echo ""
  print_info "Backup location: $BACKUP_DIR"
  print_info "Cleanup log: $BACKUP_DIR/cleanup.log"

  if [ "$DRY_RUN" = false ]; then
    print_info "Report: $BACKUP_DIR/cleanup-report.txt"
    echo ""
    print_warning "REBOOT RECOMMENDED"
    echo ""
    read -p "Reboot now? (yes/no): " reboot_confirm
    if [ "$reboot_confirm" = "yes" ]; then
      print_info "Rebooting in 5 seconds..."
      sleep 5
      reboot
    fi
  fi

  echo ""
  print_info "Done!"
}

# Trap errors
trap 'print_error "Script failed at line $LINENO. Check $BACKUP_DIR/cleanup.log"' ERR

# Run main
main

exit 0
