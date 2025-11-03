#!/bin/bash

# Safe Test Runner
# Runs integration tests without interacting with hardware
# Safe to run on production system

set -e

echo "========================================"
echo "  Sports Bar TV Controller"
echo "  Safe Integration Test Suite"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running safe integration tests...${NC}"
echo ""

# Set flags to skip hardware tests
export SKIP_HARDWARE_TESTS=true
export SKIP_NETWORK_TESTS=false

# 1. Database Tests (Always safe)
echo -e "${GREEN}[1/2] Running Database Tests...${NC}"
npm run test:database

echo ""

# 2. Hardware Connectivity Tests (Read-only)
echo -e "${GREEN}[2/2] Running Hardware Connectivity Tests (Read-Only)...${NC}"
npm run test:hardware

echo ""
echo "========================================"
echo -e "${GREEN}All safe tests completed!${NC}"
echo "========================================"
echo ""
echo "To run tests that interact with hardware:"
echo "  npm run test:matrix     (sends routing commands)"
echo "  npm run test:api        (requires server running)"
echo "  npm run test:firetv     (requires ADB)"
echo ""
