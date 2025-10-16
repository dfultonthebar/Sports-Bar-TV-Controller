
#!/bin/bash
# System Setup Script for NUC13ANHi5 Production Deployment
# Intel i5-1340P (12 cores, 16 threads) with 16GB RAM
# Sports Bar TV Controller Application

set -e

echo "=========================================="
echo "Sports Bar TV Controller - System Setup"
echo "Target: Intel NUC13ANHi5 (i5-1340P)"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

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
sudo apt install -y build-essential curl wget git vim htop

# Install Node.js 20.x (LTS)
print_status "Installing Node.js 20.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
print_status "Node.js version: $NODE_VERSION"
print_status "npm version: $NPM_VERSION"

# Install PM2 globally
print_status "Installing PM2 process manager..."
sudo npm install -g pm2

# Setup PM2 startup script
print_status "Configuring PM2 startup..."
sudo pm2 startup systemd -u $USER --hp $HOME
pm2 save

# Install PostgreSQL 15
print_status "Installing PostgreSQL 15..."
sudo apt install -y postgresql-15 postgresql-contrib-15

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install Ollama
print_status "Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

# Verify Ollama installation
if command -v ollama &> /dev/null; then
    print_status "Ollama installed successfully"
else
    print_error "Ollama installation failed"
    exit 1
fi

# Install system monitoring tools
print_status "Installing monitoring tools..."
sudo apt install -y htop iotop nethogs sysstat

# Enable sysstat for performance monitoring
sudo systemctl enable sysstat
sudo systemctl start sysstat

# Install Intel GPU tools (for Iris Xe optimization)
print_status "Installing Intel GPU tools..."
sudo apt install -y intel-gpu-tools vainfo

# Configure kernel parameters for Intel Iris Xe
print_status "Configuring Intel Iris Xe graphics..."
if ! grep -q "i915.enable_guc=3" /etc/default/grub; then
    sudo sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="/GRUB_CMDLINE_LINUX_DEFAULT="i915.enable_guc=3 /' /etc/default/grub
    sudo update-grub
    print_warning "Kernel parameters updated. Reboot required for GPU optimization."
fi

# Install additional utilities
print_status "Installing additional utilities..."
sudo apt install -y jq unzip zip

# Create application directory
print_status "Creating application directory..."
sudo mkdir -p /opt/sports-bar-tv
sudo chown $USER:$USER /opt/sports-bar-tv

# Create logs directory
mkdir -p $HOME/logs/sports-bar-tv

# Install Nginx (optional, for reverse proxy)
print_status "Installing Nginx..."
sudo apt install -y nginx

# Configure firewall
print_status "Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw --force enable

print_status "System setup completed successfully!"
echo ""
print_warning "IMPORTANT: Please reboot the system to apply kernel parameters for GPU optimization."
echo ""
echo "After reboot, run the following scripts in order:"
echo "  1. ./scripts/ollama-setup.sh"
echo "  2. ./scripts/app-deploy.sh"
echo "  3. ./scripts/data-migration.sh"
echo ""
