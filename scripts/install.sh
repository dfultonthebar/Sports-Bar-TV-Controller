#!/bin/bash
# Sports Bar TV Controller Installation Script

set -e

# Detect current user and home directory
CURRENT_USER=$(whoami)
USER_HOME=$(eval echo ~"$CURRENT_USER")
INSTALL_DIR="$USER_HOME/Sports-Bar-TV-Controller"

echo "Installing Sports Bar TV Controller..."
echo "Current user: $CURRENT_USER"
echo "Home directory: $USER_HOME"
echo "Installation directory: $INSTALL_DIR"

# Ensure we're in the correct directory
if [ ! -f "main.py" ]; then
    echo "Error: main.py not found. Please run this script from the Sports-Bar-TV-Controller directory."
    exit 1
fi

# Create necessary directories
mkdir -p logs test_logs config/ir_codes

# Set proper permissions
chmod +x main.py
chmod +x scripts/*.sh 2>/dev/null || true

# Install Python dependencies
pip3 install -r requirements.txt

# Create a temporary service file with correct user and paths
TEMP_SERVICE_FILE=$(mktemp)
sed "s/%i/$CURRENT_USER/g; s|%h|$USER_HOME|g" scripts/sportsbar-controller.service > "$TEMP_SERVICE_FILE"

# Copy service file with dynamic user configuration
sudo cp "$TEMP_SERVICE_FILE" /etc/systemd/system/sportsbar-controller.service
sudo systemctl daemon-reload

# Clean up temporary file
rm "$TEMP_SERVICE_FILE"

echo "Installation complete!"
echo "Service configured for user: $CURRENT_USER"
echo "Working directory: $INSTALL_DIR"
echo ""
echo "To start the service: sudo systemctl start sportsbar-controller"
echo "To enable auto-start: sudo systemctl enable sportsbar-controller"
echo "To check status: sudo systemctl status sportsbar-controller"
