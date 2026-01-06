#!/bin/bash

###############################################################################
# PWA Verification Script
# Verifies all PWA components are properly installed and accessible
###############################################################################

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "================================================"
echo "  PWA Installation Verification"
echo "================================================"
echo ""

FAILED=0
PASSED=0

# Function to check file exists
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} File exists: $1"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} Missing file: $1"
    ((FAILED++))
  fi
}

# Function to check HTTP endpoint
check_endpoint() {
  local url=$1
  local description=$2

  if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
    echo -e "${GREEN}✓${NC} Accessible: $description ($url)"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} Not accessible: $description ($url)"
    ((FAILED++))
  fi
}

echo "Checking PWA Files..."
echo "--------------------"

# Check manifest
check_file "/home/ubuntu/Sports-Bar-TV-Controller/public/manifest.json"

# Check offline page
check_file "/home/ubuntu/Sports-Bar-TV-Controller/public/offline.html"

# Check service worker
check_file "/home/ubuntu/Sports-Bar-TV-Controller/public/sw.js"

# Check icons
check_file "/home/ubuntu/Sports-Bar-TV-Controller/public/icon-72x72.png"
check_file "/home/ubuntu/Sports-Bar-TV-Controller/public/icon-96x96.png"
check_file "/home/ubuntu/Sports-Bar-TV-Controller/public/icon-128x128.png"
check_file "/home/ubuntu/Sports-Bar-TV-Controller/public/icon-144x144.png"
check_file "/home/ubuntu/Sports-Bar-TV-Controller/public/icon-152x152.png"
check_file "/home/ubuntu/Sports-Bar-TV-Controller/public/icon-192x192.png"
check_file "/home/ubuntu/Sports-Bar-TV-Controller/public/icon-384x384.png"
check_file "/home/ubuntu/Sports-Bar-TV-Controller/public/icon-512x512.png"

echo ""
echo "Checking Component Files..."
echo "---------------------------"

# Check PWA component
check_file "/home/ubuntu/Sports-Bar-TV-Controller/src/components/PWAInstallPrompt.tsx"

# Check next.config.js has PWA
if grep -q "withPWA" /home/ubuntu/Sports-Bar-TV-Controller/next.config.js; then
  echo -e "${GREEN}✓${NC} next.config.js configured with PWA"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} next.config.js missing PWA configuration"
  ((FAILED++))
fi

# Check layout.tsx has manifest
if grep -q "manifest:" /home/ubuntu/Sports-Bar-TV-Controller/src/app/layout.tsx; then
  echo -e "${GREEN}✓${NC} layout.tsx configured with manifest"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} layout.tsx missing manifest configuration"
  ((FAILED++))
fi

echo ""
echo "Checking HTTP Endpoints..."
echo "-------------------------"

# Check if server is running
if ! pgrep -f "next start" > /dev/null && ! pm2 list | grep -q "sports-bar-tv-controller.*online"; then
  echo -e "${YELLOW}⚠${NC}  Server not running. Starting checks anyway..."
fi

# Check manifest endpoint
check_endpoint "http://localhost:3001/manifest.json" "Manifest JSON"

# Check service worker endpoint
check_endpoint "http://localhost:3001/sw.js" "Service Worker"

# Check offline page
check_endpoint "http://localhost:3001/offline.html" "Offline Page"

# Check sample icon
check_endpoint "http://localhost:3001/icon-192x192.png" "App Icon (192x192)"

echo ""
echo "Checking Documentation..."
echo "------------------------"

# Check documentation
if grep -q "Installing as Mobile App" /home/ubuntu/Sports-Bar-TV-Controller/docs/BARTENDER_QUICK_START.md; then
  echo -e "${GREEN}✓${NC} BARTENDER_QUICK_START.md has PWA installation guide"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} BARTENDER_QUICK_START.md missing PWA documentation"
  ((FAILED++))
fi

check_file "/home/ubuntu/Sports-Bar-TV-Controller/PWA_IMPLEMENTATION_REPORT.md"

echo ""
echo "Checking Package Installation..."
echo "--------------------------------"

if npm list next-pwa 2>/dev/null | grep -q "next-pwa@"; then
  echo -e "${GREEN}✓${NC} next-pwa package installed"
  ((PASSED++))
else
  echo -e "${RED}✗${NC} next-pwa package not installed"
  ((FAILED++))
fi

echo ""
echo "================================================"
echo "  Verification Summary"
echo "================================================"
echo ""
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All PWA components verified successfully!${NC}"
  echo ""
  echo "Next Steps:"
  echo "1. Test installation on mobile device"
  echo "2. Open Chrome DevTools → Application → Manifest"
  echo "3. Check Service Worker is registered"
  echo "4. Test offline mode"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some PWA components are missing or not accessible${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "1. Run: npm run build"
  echo "2. Run: pm2 restart sports-bar-tv-controller"
  echo "3. Check browser console for errors"
  echo "4. Verify server is running on port 3001"
  echo ""
  exit 1
fi
