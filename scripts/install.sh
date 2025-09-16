#!/bin/bash
# Sports Bar TV Controller Installation Script

set -e

echo "Installing Sports Bar TV Controller..."

# Create necessary directories
mkdir -p logs test_logs config/ir_codes

# Set proper permissions
chmod +x main.py
chmod +x scripts/*.sh 2>/dev/null || true

# Install Python dependencies
pip3 install -r requirements.txt

# Copy service file
sudo cp scripts/sportsbar-controller.service /etc/systemd/system/
sudo systemctl daemon-reload

echo "Installation complete!"
echo "To start the service: sudo systemctl start sportsbar-controller"
echo "To enable auto-start: sudo systemctl enable sportsbar-controller"
