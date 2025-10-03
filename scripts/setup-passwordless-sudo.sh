#!/bin/bash

# =============================================================================
# SETUP PASSWORDLESS SUDO
# =============================================================================
# This script configures passwordless sudo for the current user
# This is required for the update script to run without password prompts
# =============================================================================

set -e

SUDOERS_FILE="/etc/sudoers.d/sports-bar-tv-controller"
CURRENT_USER=$(whoami)

echo "=========================================="
echo "Setting up passwordless sudo"
echo "=========================================="
echo ""
echo "This will allow the update script to run without password prompts."
echo "You will need to enter your password ONE TIME to set this up."
echo ""

# Check if already configured
if sudo -n true 2>/dev/null; then
    echo "✅ Passwordless sudo is already configured!"
    echo ""
    exit 0
fi

echo "Configuring passwordless sudo for user: $CURRENT_USER"
echo ""

# Create sudoers file with proper permissions
echo "$CURRENT_USER ALL=(ALL) NOPASSWD: ALL" | sudo tee "$SUDOERS_FILE" > /dev/null

# Set proper permissions
sudo chmod 0440 "$SUDOERS_FILE"

# Verify the configuration
if sudo -n true 2>/dev/null; then
    echo ""
    echo "=========================================="
    echo "✅ Passwordless sudo configured successfully!"
    echo "=========================================="
    echo ""
    echo "The update script will now run without password prompts."
    echo ""
else
    echo ""
    echo "=========================================="
    echo "❌ Configuration failed!"
    echo "=========================================="
    echo ""
    echo "Please check the sudoers file manually:"
    echo "  sudo visudo -f $SUDOERS_FILE"
    echo ""
    exit 1
fi
