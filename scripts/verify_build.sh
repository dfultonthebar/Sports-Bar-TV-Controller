
#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Build Verification Script                         ║${NC}"
echo -e "${BLUE}║         Sports Bar TV Controller                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in the Sports-Bar-TV-Controller directory${NC}"
    echo -e "${YELLOW}Please run: cd ~/Sports-Bar-TV-Controller${NC}"
    exit 1
fi

echo -e "${BLUE}📁 Current directory:${NC} $(pwd)"
echo ""

# Check if .next directory exists
if [ ! -d ".next" ]; then
    echo -e "${RED}❌ CRITICAL: .next directory not found!${NC}"
    echo -e "${YELLOW}The application has never been built.${NC}"
    echo ""
    echo -e "${YELLOW}You MUST run:${NC}"
    echo -e "  ${GREEN}npm run build${NC}"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} .next directory exists"

# Check if src directory exists
if [ ! -d "src" ]; then
    echo -e "${RED}❌ Error: src directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} src directory exists"
echo ""

# Find the most recently modified source file
echo -e "${BLUE}🔍 Checking source code timestamps...${NC}"
NEWEST_SOURCE=$(find src -type f -name "*.ts" -o -name "*.tsx" | xargs ls -t | head -1)
if [ -z "$NEWEST_SOURCE" ]; then
    echo -e "${RED}❌ No TypeScript source files found${NC}"
    exit 1
fi

SOURCE_TIME=$(stat -c %Y "$NEWEST_SOURCE" 2>/dev/null || stat -f %m "$NEWEST_SOURCE" 2>/dev/null)
SOURCE_DATE=$(date -d @$SOURCE_TIME 2>/dev/null || date -r $SOURCE_TIME 2>/dev/null)

echo -e "  Most recent source file: ${YELLOW}$NEWEST_SOURCE${NC}"
echo -e "  Modified: ${YELLOW}$SOURCE_DATE${NC}"
echo ""

# Find the most recently modified compiled file
echo -e "${BLUE}🔍 Checking compiled code timestamps...${NC}"
NEWEST_COMPILED=$(find .next -type f -name "*.js" | xargs ls -t | head -1)
if [ -z "$NEWEST_COMPILED" ]; then
    echo -e "${RED}❌ No compiled JavaScript files found in .next${NC}"
    echo -e "${YELLOW}You need to rebuild!${NC}"
    echo ""
    echo -e "${YELLOW}Run:${NC}"
    echo -e "  ${GREEN}npm run build${NC}"
    echo ""
    exit 1
fi

COMPILED_TIME=$(stat -c %Y "$NEWEST_COMPILED" 2>/dev/null || stat -f %m "$NEWEST_COMPILED" 2>/dev/null)
COMPILED_DATE=$(date -d @$COMPILED_TIME 2>/dev/null || date -r $COMPILED_TIME 2>/dev/null)

echo -e "  Most recent compiled file: ${YELLOW}$NEWEST_COMPILED${NC}"
echo -e "  Modified: ${YELLOW}$COMPILED_DATE${NC}"
echo ""

# Compare timestamps
echo -e "${BLUE}⚖️  Comparing timestamps...${NC}"
if [ $SOURCE_TIME -gt $COMPILED_TIME ]; then
    TIME_DIFF=$((SOURCE_TIME - COMPILED_TIME))
    HOURS=$((TIME_DIFF / 3600))
    MINUTES=$(((TIME_DIFF % 3600) / 60))
    
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ⚠️  WARNING: BUILD IS OUT OF DATE! ⚠️                    ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Your source code is NEWER than your compiled code!${NC}"
    echo -e "${YELLOW}Time difference: ${HOURS}h ${MINUTES}m${NC}"
    echo ""
    echo -e "${RED}This means:${NC}"
    echo -e "  • Your recent code changes are NOT being used"
    echo -e "  • PM2 is running OLD compiled code"
    echo -e "  • Bug fixes and features won't work"
    echo ""
    echo -e "${YELLOW}You MUST rebuild the application:${NC}"
    echo ""
    echo -e "  ${GREEN}pm2 stop all${NC}"
    echo -e "  ${GREEN}npm run build${NC}"
    echo -e "  ${GREEN}pm2 restart all${NC}"
    echo ""
    echo -e "${BLUE}💡 Tip: Always run 'npm run build' after 'git pull'${NC}"
    echo ""
    exit 1
else
    TIME_DIFF=$((COMPILED_TIME - SOURCE_TIME))
    HOURS=$((TIME_DIFF / 3600))
    MINUTES=$(((TIME_DIFF % 3600) / 60))
    
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ BUILD IS UP TO DATE! ✓                                ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Your compiled code is newer than your source code.${NC}"
    echo -e "${GREEN}Time difference: ${HOURS}h ${MINUTES}m${NC}"
    echo ""
    echo -e "${GREEN}This means:${NC}"
    echo -e "  ✓ Your latest code changes are compiled"
    echo -e "  ✓ PM2 is running the current code"
    echo -e "  ✓ All fixes and features are active"
    echo ""
    echo -e "${BLUE}You're good to go! 🚀${NC}"
    echo ""
fi

# Check if PM2 is running
echo -e "${BLUE}🔍 Checking PM2 status...${NC}"
if command -v pm2 &> /dev/null; then
    PM2_STATUS=$(pm2 list | grep -i "sports-bar" || echo "not found")
    if [[ "$PM2_STATUS" == *"online"* ]]; then
        echo -e "${GREEN}✓${NC} PM2 is running the application"
    elif [[ "$PM2_STATUS" == *"stopped"* ]]; then
        echo -e "${YELLOW}⚠${NC}  PM2 process exists but is stopped"
        echo -e "${YELLOW}Run: pm2 restart all${NC}"
    else
        echo -e "${YELLOW}⚠${NC}  PM2 process not found"
        echo -e "${YELLOW}Run: pm2 start ecosystem.config.js${NC}"
    fi
else
    echo -e "${YELLOW}⚠${NC}  PM2 not found or not in PATH"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}For more information, see: REBUILD_REQUIRED.md${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
