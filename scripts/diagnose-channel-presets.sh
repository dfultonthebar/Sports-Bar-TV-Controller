
#!/bin/bash

# =============================================================================
# CHANNEL PRESETS DIAGNOSTIC SCRIPT
# =============================================================================
# This script diagnoses issues with the Channel Presets feature
# Run this to check:
# - Database table existence and structure
# - Prisma client generation status
# - API endpoint functionality
# - Server status
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project directory
PROJECT_DIR="/home/ubuntu/Sports-Bar-TV-Controller"
cd "$PROJECT_DIR" || exit 1

echo "=========================================="
echo "🔍 Channel Presets Diagnostic Tool"
echo "=========================================="
echo ""

# =============================================================================
# 1. CHECK DATABASE FILE
# =============================================================================
echo -e "${BLUE}1. Checking database file...${NC}"

# Get database path from .env
if [ -f ".env" ]; then
    DB_PATH=$(grep "DATABASE_URL" .env | cut -d'=' -f2 | tr -d '"' | sed 's|file:./||')
    echo "   Database path from .env: $DB_PATH"
else
    echo -e "   ${RED}✗ .env file not found${NC}"
    DB_PATH="prisma/dev.db"
    echo "   Using default: $DB_PATH"
fi

# Check if database exists
if [ -f "$DB_PATH" ]; then
    DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
    echo -e "   ${GREEN}✓ Database file exists${NC}"
    echo "   Size: $DB_SIZE"
    echo "   Location: $DB_PATH"
else
    echo -e "   ${RED}✗ Database file not found at: $DB_PATH${NC}"
    echo "   This is the primary issue!"
fi

echo ""

# =============================================================================
# 2. CHECK DATABASE SCHEMA
# =============================================================================
echo -e "${BLUE}2. Checking database schema...${NC}"

if [ -f "$DB_PATH" ]; then
    # Check if ChannelPreset table exists
    if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='ChannelPreset';" 2>/dev/null | grep -q "ChannelPreset"; then
        echo -e "   ${GREEN}✓ ChannelPreset table exists${NC}"
        
        # Get table structure
        echo "   Table structure:"
        sqlite3 "$DB_PATH" "PRAGMA table_info(ChannelPreset);" 2>/dev/null | while IFS='|' read -r cid name type notnull dflt_value pk; do
            echo "      - $name ($type)"
        done
        
        # Count records
        RECORD_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ChannelPreset;" 2>/dev/null || echo "0")
        echo "   Records: $RECORD_COUNT"
        
        # Check for required columns
        echo ""
        echo "   Checking required columns:"
        REQUIRED_COLS=("id" "name" "channelNumber" "deviceType" "order" "isActive" "usageCount" "lastUsed" "createdAt" "updatedAt")
        for col in "${REQUIRED_COLS[@]}"; do
            if sqlite3 "$DB_PATH" "PRAGMA table_info(ChannelPreset);" 2>/dev/null | grep -q "|$col|"; then
                echo -e "      ${GREEN}✓ $col${NC}"
            else
                echo -e "      ${RED}✗ $col (MISSING)${NC}"
            fi
        done
    else
        echo -e "   ${RED}✗ ChannelPreset table does NOT exist${NC}"
        echo "   This is the primary issue!"
        echo ""
        echo "   Available tables:"
        sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table';" 2>/dev/null | sed 's/^/      - /'
    fi
else
    echo -e "   ${YELLOW}⚠ Cannot check schema - database file not found${NC}"
fi

echo ""

# =============================================================================
# 3. CHECK PRISMA CLIENT
# =============================================================================
echo -e "${BLUE}3. Checking Prisma client...${NC}"

if [ -d "node_modules/@prisma/client" ]; then
    echo -e "   ${GREEN}✓ Prisma client directory exists${NC}"
    
    # Check if generated
    if [ -f "node_modules/.prisma/client/index.js" ]; then
        echo -e "   ${GREEN}✓ Prisma client is generated${NC}"
        
        # Check if ChannelPreset model exists in generated client
        if grep -q "ChannelPreset" node_modules/.prisma/client/index.d.ts 2>/dev/null; then
            echo -e "   ${GREEN}✓ ChannelPreset model found in client${NC}"
        else
            echo -e "   ${RED}✗ ChannelPreset model NOT found in client${NC}"
            echo "   Client needs to be regenerated!"
        fi
    else
        echo -e "   ${RED}✗ Prisma client not generated${NC}"
        echo "   Run: npx prisma generate"
    fi
else
    echo -e "   ${RED}✗ Prisma client not installed${NC}"
    echo "   Run: npm install"
fi

echo ""

# =============================================================================
# 4. CHECK MIGRATIONS
# =============================================================================
echo -e "${BLUE}4. Checking migrations...${NC}"

if [ -d "prisma/migrations" ]; then
    echo -e "   ${GREEN}✓ Migrations directory exists${NC}"
    
    # List migrations
    echo "   Available migrations:"
    ls -1 prisma/migrations/ | grep -v "migration_lock.toml" | sed 's/^/      - /'
    
    # Check for channel preset migrations
    if [ -d "prisma/migrations/20250103_channel_presets" ]; then
        echo -e "   ${GREEN}✓ Channel presets migration exists${NC}"
    else
        echo -e "   ${RED}✗ Channel presets migration NOT found${NC}"
    fi
    
    if [ -d "prisma/migrations/20250103_add_usage_tracking" ]; then
        echo -e "   ${GREEN}✓ Usage tracking migration exists${NC}"
    else
        echo -e "   ${RED}✗ Usage tracking migration NOT found${NC}"
    fi
    
    # Check migration status
    echo ""
    echo "   Migration status:"
    if npx prisma migrate status 2>&1 | tee /tmp/migrate_status.log | grep -q "Database schema is up to date"; then
        echo -e "   ${GREEN}✓ All migrations applied${NC}"
    elif grep -q "pending migrations" /tmp/migrate_status.log; then
        echo -e "   ${YELLOW}⚠ Pending migrations detected${NC}"
        echo "   Run: npx prisma migrate deploy"
    else
        echo -e "   ${YELLOW}⚠ Migration status unclear${NC}"
        cat /tmp/migrate_status.log | sed 's/^/      /'
    fi
    rm -f /tmp/migrate_status.log
else
    echo -e "   ${RED}✗ Migrations directory not found${NC}"
fi

echo ""

# =============================================================================
# 5. CHECK SERVER STATUS
# =============================================================================
echo -e "${BLUE}5. Checking server status...${NC}"

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    echo -e "   ${GREEN}✓ PM2 is installed${NC}"
    
    # Check if app is running
    if pm2 list | grep -q "sports-bar-tv-controller.*online"; then
        echo -e "   ${GREEN}✓ Server is running (PM2)${NC}"
        
        # Get uptime
        UPTIME=$(pm2 list | grep "sports-bar-tv-controller" | awk '{print $10}')
        echo "   Uptime: $UPTIME"
    else
        echo -e "   ${RED}✗ Server is NOT running in PM2${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠ PM2 not installed${NC}"
fi

# Check if port is in use
if lsof -ti:3000 &> /dev/null; then
    PID=$(lsof -ti:3000)
    echo -e "   ${GREEN}✓ Port 3000 is in use (PID: $PID)${NC}"
else
    echo -e "   ${RED}✗ Port 3000 is NOT in use${NC}"
    echo "   Server may not be running!"
fi

echo ""

# =============================================================================
# 6. TEST API ENDPOINT
# =============================================================================
echo -e "${BLUE}6. Testing API endpoint...${NC}"

# Wait a moment for server to be ready
sleep 2

# Test the endpoint
echo "   Testing: http://localhost:3000/api/channel-presets"

if curl -s -f http://localhost:3000/api/channel-presets > /tmp/api_response.json 2>/dev/null; then
    echo -e "   ${GREEN}✓ API endpoint is responding${NC}"
    
    # Check response
    if grep -q '"success":true' /tmp/api_response.json; then
        echo -e "   ${GREEN}✓ API returned success${NC}"
        
        # Count presets
        PRESET_COUNT=$(grep -o '"presets":\[' /tmp/api_response.json | wc -l)
        if [ "$PRESET_COUNT" -gt 0 ]; then
            echo "   Presets returned: Check response"
        else
            echo "   Presets returned: 0 (empty array)"
        fi
    else
        echo -e "   ${RED}✗ API returned error${NC}"
        echo "   Response:"
        cat /tmp/api_response.json | jq '.' 2>/dev/null || cat /tmp/api_response.json | sed 's/^/      /'
    fi
else
    echo -e "   ${RED}✗ API endpoint is NOT responding${NC}"
    
    # Try to get error details
    if curl -s http://localhost:3000/api/channel-presets > /tmp/api_response.json 2>&1; then
        echo "   Error response:"
        cat /tmp/api_response.json | jq '.' 2>/dev/null || cat /tmp/api_response.json | sed 's/^/      /'
    else
        echo "   Could not connect to server"
    fi
fi

rm -f /tmp/api_response.json

echo ""

# =============================================================================
# 7. CHECK SERVER LOGS
# =============================================================================
echo -e "${BLUE}7. Checking server logs...${NC}"

if command -v pm2 &> /dev/null && pm2 list | grep -q "sports-bar-tv-controller"; then
    echo "   Recent errors from PM2 logs:"
    pm2 logs sports-bar-tv-controller --lines 20 --nostream 2>/dev/null | grep -i "error\|fail\|channel.*preset" | tail -10 | sed 's/^/      /' || echo "      No recent errors found"
else
    echo -e "   ${YELLOW}⚠ Cannot check logs - PM2 not running${NC}"
fi

echo ""

# =============================================================================
# SUMMARY AND RECOMMENDATIONS
# =============================================================================
echo "=========================================="
echo "📋 DIAGNOSTIC SUMMARY"
echo "=========================================="
echo ""

# Determine the issue
ISSUE_FOUND=false
RECOMMENDATIONS=()

# Check database
if [ ! -f "$DB_PATH" ]; then
    ISSUE_FOUND=true
    echo -e "${RED}❌ PRIMARY ISSUE: Database file not found${NC}"
    RECOMMENDATIONS+=("Run the fix script: ./scripts/fix-channel-presets.sh")
fi

# Check table
if [ -f "$DB_PATH" ]; then
    if ! sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='ChannelPreset';" 2>/dev/null | grep -q "ChannelPreset"; then
        ISSUE_FOUND=true
        echo -e "${RED}❌ PRIMARY ISSUE: ChannelPreset table missing${NC}"
        RECOMMENDATIONS+=("Run migrations: npx prisma migrate deploy")
        RECOMMENDATIONS+=("Or run the fix script: ./scripts/fix-channel-presets.sh")
    fi
fi

# Check Prisma client
if [ ! -f "node_modules/.prisma/client/index.js" ]; then
    ISSUE_FOUND=true
    echo -e "${RED}❌ ISSUE: Prisma client not generated${NC}"
    RECOMMENDATIONS+=("Generate Prisma client: npx prisma generate")
fi

# Check server
if ! lsof -ti:3000 &> /dev/null; then
    ISSUE_FOUND=true
    echo -e "${RED}❌ ISSUE: Server not running${NC}"
    RECOMMENDATIONS+=("Start server: pm2 start npm --name sports-bar-tv-controller -- start")
    RECOMMENDATIONS+=("Or restart: pm2 restart sports-bar-tv-controller")
fi

if [ "$ISSUE_FOUND" = false ]; then
    echo -e "${GREEN}✅ No obvious issues found!${NC}"
    echo ""
    echo "If you're still experiencing problems:"
    echo "  1. Check browser console for errors"
    echo "  2. Clear browser cache and reload"
    echo "  3. Check PM2 logs: pm2 logs sports-bar-tv-controller"
else
    echo ""
    echo "🔧 RECOMMENDED ACTIONS:"
    for i in "${!RECOMMENDATIONS[@]}"; do
        echo "  $((i+1)). ${RECOMMENDATIONS[$i]}"
    done
fi

echo ""
echo "=========================================="
echo "For automated fix, run:"
echo "  ./scripts/fix-channel-presets.sh"
echo "=========================================="
