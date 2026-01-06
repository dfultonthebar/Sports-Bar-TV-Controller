#!/bin/bash
# Deployment script for React error #31 fix
# Run this on the remote server at 24.123.87.42

set -e  # Exit on error

echo "=========================================="
echo "  React Error #31 Fix Deployment"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Checking current status...${NC}"
git status

echo ""
echo -e "${YELLOW}Step 2: Stopping the application...${NC}"
# Uncomment the appropriate command for your setup:
# pm2 stop sports-bar-tv-controller || true
# sudo systemctl stop sports-bar-tv-controller || true
# pkill -f "next start" || true
echo "Please manually stop your application if needed"
read -p "Press Enter when the application is stopped..."

echo ""
echo -e "${YELLOW}Step 3: Backing up current build...${NC}"
if [ -d ".next" ]; then
    mv .next .next.backup.$(date +%Y%m%d_%H%M%S) || true
    echo "Backup created"
fi

echo ""
echo -e "${YELLOW}Step 4: Pulling latest changes from GitHub...${NC}"
git fetch origin
git checkout main
git pull origin main

echo ""
echo -e "${YELLOW}Step 5: Cleaning old build artifacts...${NC}"
rm -rf .next
rm -rf node_modules/.cache
echo "Cleaned .next and node_modules cache"

echo ""
echo -e "${YELLOW}Step 6: Installing dependencies...${NC}"
npm ci

echo ""
echo -e "${YELLOW}Step 7: Building the application...${NC}"
npm run build

echo ""
echo -e "${YELLOW}Step 8: Verifying React is deduplicated...${NC}"
npm ls react react-dom | grep -E "(deduped|18.2.0)" || echo "Warning: Check React versions"

echo ""
echo -e "${GREEN}=========================================="
echo "  Deployment Complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Start your application:"
echo "   - pm2 start sports-bar-tv-controller"
echo "   - OR: sudo systemctl start sports-bar-tv-controller"
echo "   - OR: npm run start"
echo ""
echo "2. Verify the fix:"
echo "   - Open http://24.123.87.42:3000/audio-control"
echo "   - Check browser console for errors (F12)"
echo "   - React error #31 should be gone"
echo ""
echo "3. Check application logs:"
echo "   - pm2 logs sports-bar-tv-controller"
echo "   - OR: sudo journalctl -u sports-bar-tv-controller -f"
echo ""
echo -e "${YELLOW}If you encounter issues, see REACT_ERROR_31_FIX.md for troubleshooting${NC}"
