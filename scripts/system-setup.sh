
#!/bin/bash
# System Setup Script for Sports Bar TV Controller
# Auto-detects hardware - works with any Intel system
# Installs system dependencies, Node.js, and configures the OS

set -e

# Auto-detect hardware
CPU_MODEL=$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || echo "Unknown CPU")
CPU_CORES=$(nproc --all)
TOTAL_RAM_GB=$(($(free -m | awk '/Mem:/ {print $2}') / 1024))

echo "=========================================="
echo "Sports Bar TV Controller - System Setup"
echo "Detected: $CPU_MODEL"
echo "Cores: $CPU_CORES | RAM: ${TOTAL_RAM_GB}GB"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[+]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[x]${NC} $1"; }

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run as root. Use sudo when needed."
    exit 1
fi

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential build tools
print_status "Installing essential build tools..."
sudo apt install -y build-essential curl wget git vim htop jq unzip zip

# Install SQLite (our database)
print_status "Installing SQLite..."
sudo apt install -y sqlite3 libsqlite3-dev

# Install Node.js 20.x (LTS)
print_status "Installing Node.js 20.x LTS..."
if command -v node &>/dev/null; then
    NODE_VER=$(node --version | cut -dv -f2 | cut -d. -f1)
    if [ "$NODE_VER" -ge 20 ]; then
        print_status "Node.js $(node --version) already installed"
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

print_status "Node.js $(node --version), npm $(npm --version)"

# Install PM2 globally
print_status "Installing PM2 process manager..."
sudo npm install -g pm2

# Setup PM2 startup script
print_status "Configuring PM2 startup..."
sudo pm2 startup systemd -u $USER --hp $HOME
pm2 save

# Install Ollama
print_status "Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

if command -v ollama &> /dev/null; then
    print_status "Ollama installed successfully"
else
    print_error "Ollama installation failed"
fi

# Install system monitoring tools
print_status "Installing monitoring tools..."
sudo apt install -y htop iotop nethogs sysstat

sudo systemctl enable sysstat
sudo systemctl start sysstat

# Install Intel GPU tools if Intel GPU detected
if lspci 2>/dev/null | grep -qi "VGA.*Intel"; then
    print_status "Intel GPU detected - installing GPU tools..."
    sudo apt install -y intel-gpu-tools vainfo 2>/dev/null || print_warning "Some GPU tools not available"

    if ! grep -q "i915.enable_guc=3" /etc/default/grub 2>/dev/null; then
        sudo sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="/GRUB_CMDLINE_LINUX_DEFAULT="i915.enable_guc=3 /' /etc/default/grub
        sudo update-grub
        print_warning "GPU kernel parameters updated. Reboot needed for full GPU optimization."
    fi
fi

# Install hardware control dependencies
print_status "Installing hardware control tools..."
sudo apt install -y adb cec-utils 2>/dev/null || print_warning "Some hardware tools not available"

# Create data directory
print_status "Creating data directory..."
mkdir -p $HOME/sports-bar-data
mkdir -p $HOME/Sports-Bar-TV-Controller/logs

# Configure firewall (if ufw is available)
if command -v ufw &>/dev/null; then
    print_status "Configuring firewall..."
    sudo ufw allow 22/tcp
    sudo ufw allow 3001/tcp
    sudo ufw allow 11434/tcp  # Ollama
    sudo ufw --force enable 2>/dev/null || print_warning "Firewall may require manual setup"
fi

print_status "System setup completed!"
echo ""
echo "Hardware: $CPU_MODEL ($CPU_CORES cores, ${TOTAL_RAM_GB}GB RAM)"
echo ""
echo "Next steps (in order):"
echo "  1. Reboot if GPU kernel parameters were updated"
echo "  2. ./scripts/ollama-setup.sh    # Configure Ollama + pull AI models"
echo "  3. ./install.sh                 # Install the application"
echo "  4. ./scripts/new-location-setup.sh  # PM2 logrotate, backups, crontab"
echo "  5. ./scripts/post-install-setup.sh  # Device discovery & validation"
echo ""
