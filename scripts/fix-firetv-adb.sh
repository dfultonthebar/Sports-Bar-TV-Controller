#!/bin/bash
# Fire TV ADB Connection Fix Script
# This script diagnoses and fixes ADB connection issues with Fire TV devices

set -e

echo "========================================="
echo "Fire TV ADB Connection Fix Script"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default device (can be overridden with command line argument)
DEVICE_IP="${1:-192.168.5.131}"
DEVICE_PORT="${2:-5555}"
DEVICE_ADDRESS="${DEVICE_IP}:${DEVICE_PORT}"

echo "Target Device: ${DEVICE_ADDRESS}"
echo ""

# Step 1: Check if ADB is installed
echo "Step 1: Checking if ADB is installed..."
if command -v adb &> /dev/null; then
    echo -e "${GREEN}✓ ADB is installed${NC}"
    adb version | head -n 1
else
    echo -e "${RED}✗ ADB is not installed${NC}"
    echo "Please install with: sudo apt-get install adb"
    exit 1
fi
echo ""

# Step 2: Check network connectivity
echo "Step 2: Checking network connectivity to ${DEVICE_IP}..."
if ping -c 3 -W 2 "${DEVICE_IP}" &> /dev/null; then
    echo -e "${GREEN}✓ Device is reachable on network${NC}"
else
    echo -e "${RED}✗ Device is not reachable${NC}"
    echo "Please check:"
    echo "  - Device is powered on"
    echo "  - Device is connected to the network"
    echo "  - IP address is correct"
    exit 1
fi
echo ""

# Step 3: Check if ADB port is open
echo "Step 3: Checking if ADB port ${DEVICE_PORT} is open..."
if timeout 3 bash -c "echo > /dev/tcp/${DEVICE_IP}/${DEVICE_PORT}" 2>/dev/null; then
    echo -e "${GREEN}✓ ADB port is open${NC}"
else
    echo -e "${RED}✗ ADB port is not reachable${NC}"
    echo "Please check:"
    echo "  - ADB debugging is enabled on Fire TV"
    echo "  - Go to Settings > My Fire TV > Developer Options > ADB Debugging"
    exit 1
fi
echo ""

# Step 4: Check current ADB connections
echo "Step 4: Checking current ADB connections..."
adb devices -l
echo ""

# Step 5: Restart ADB server
echo "Step 5: Restarting ADB server..."
echo "Killing ADB server..."
adb kill-server
sleep 1
echo "Starting ADB server..."
adb start-server
echo -e "${GREEN}✓ ADB server restarted${NC}"
echo ""

# Step 6: Connect to device
echo "Step 6: Connecting to ${DEVICE_ADDRESS}..."
if adb connect "${DEVICE_ADDRESS}"; then
    echo -e "${GREEN}✓ Successfully connected to device${NC}"
else
    echo -e "${RED}✗ Failed to connect to device${NC}"
    exit 1
fi
echo ""

# Step 7: Verify connection
echo "Step 7: Verifying connection..."
if adb -s "${DEVICE_ADDRESS}" shell "echo 'Connection test successful'"; then
    echo -e "${GREEN}✓ Connection verified${NC}"
else
    echo -e "${RED}✗ Connection verification failed${NC}"
    exit 1
fi
echo ""

# Step 8: Get device info
echo "Step 8: Getting device information..."
echo "Model: $(adb -s "${DEVICE_ADDRESS}" shell getprop ro.product.model)"
echo "Serial: $(adb -s "${DEVICE_ADDRESS}" shell getprop ro.serialno)"
echo "Android Version: $(adb -s "${DEVICE_ADDRESS}" shell getprop ro.build.version.release)"
echo ""

# Step 9: List all connected devices
echo "Step 9: Final device list..."
adb devices -l
echo ""

echo "========================================="
echo -e "${GREEN}Fire TV ADB connection fix complete!${NC}"
echo "========================================="
echo ""
echo "The device should now be accessible to the application."
echo "Keep-alive pings will maintain the connection automatically."
echo ""
