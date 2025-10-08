#!/bin/bash

# =============================================================================
# Database Location Migration Script
# =============================================================================
# This script consolidates database files to a single standardized location
# and updates the .env file to prevent data loss after updates.
#
# Issue: Multiple database files existed in different locations:
#   - ./data/sports_bar.db (old GitHub repo default)
#   - ./prisma/data/sports_bar.db (new standardized location)
#
# This caused Wolfpack labels to be "lost" after updates because the app
# would switch between different database files.
#
# Solution: Standardize on ./prisma/data/sports_bar.db
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project directory
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}Database Location Migration Script${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Not in project root directory${NC}"
    echo "Please run this script from the Sports-Bar-TV-Controller directory"
    exit 1
fi

# Ensure prisma/data directory exists
echo -e "${YELLOW}Creating prisma/data directory if it doesn't exist...${NC}"
mkdir -p prisma/data

# Find all database files
echo -e "${YELLOW}Searching for database files...${NC}"
DB_FILES=()
if [ -f "data/sports_bar.db" ]; then
    DB_FILES+=("data/sports_bar.db")
    echo -e "  Found: data/sports_bar.db"
fi
if [ -f "prisma/data/sports_bar.db" ]; then
    DB_FILES+=("prisma/data/sports_bar.db")
    echo -e "  Found: prisma/data/sports_bar.db"
fi

# Determine which database to use (most recently modified)
if [ ${#DB_FILES[@]} -eq 0 ]; then
    echo -e "${YELLOW}No existing database files found. A new one will be created.${NC}"
elif [ ${#DB_FILES[@]} -eq 1 ]; then
    echo -e "${GREEN}Found one database file: ${DB_FILES[0]}${NC}"
    if [ "${DB_FILES[0]}" != "prisma/data/sports_bar.db" ]; then
        echo -e "${YELLOW}Moving to standardized location...${NC}"
        cp -p "${DB_FILES[0]}" "prisma/data/sports_bar.db"
        echo -e "${GREEN}✓ Database copied to prisma/data/sports_bar.db${NC}"
    fi
else
    echo -e "${YELLOW}Multiple database files found. Selecting most recent...${NC}"
    NEWEST_DB=$(ls -t "${DB_FILES[@]}" | head -1)
    echo -e "${GREEN}Using: $NEWEST_DB (most recently modified)${NC}"
    
    if [ "$NEWEST_DB" != "prisma/data/sports_bar.db" ]; then
        # Create backup of existing prisma/data/sports_bar.db if it exists
        if [ -f "prisma/data/sports_bar.db" ]; then
            BACKUP_FILE="prisma/data/sports_bar.db.backup.$(date +%Y%m%d_%H%M%S)"
            cp -p "prisma/data/sports_bar.db" "$BACKUP_FILE"
            echo -e "${YELLOW}  Backed up existing prisma/data/sports_bar.db to $BACKUP_FILE${NC}"
        fi
        
        cp -p "$NEWEST_DB" "prisma/data/sports_bar.db"
        echo -e "${GREEN}✓ Database copied to prisma/data/sports_bar.db${NC}"
    fi
fi

# Update .env file
echo ""
echo -e "${YELLOW}Updating .env file...${NC}"
if [ -f ".env" ]; then
    # Check current DATABASE_URL
    CURRENT_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2- | tr -d '"')
    EXPECTED_URL="file:./prisma/data/sports_bar.db"
    
    if [ "$CURRENT_URL" != "$EXPECTED_URL" ]; then
        # Create backup of .env
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        
        # Update DATABASE_URL
        sed -i 's|^DATABASE_URL=.*|DATABASE_URL="file:./prisma/data/sports_bar.db"|' .env
        echo -e "${GREEN}✓ Updated DATABASE_URL in .env${NC}"
        echo -e "  Old: $CURRENT_URL"
        echo -e "  New: $EXPECTED_URL"
    else
        echo -e "${GREEN}✓ DATABASE_URL already correct${NC}"
    fi
else
    echo -e "${RED}Warning: .env file not found${NC}"
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created .env file${NC}"
    else
        echo -e "${RED}Error: .env.example not found${NC}"
        exit 1
    fi
fi

# Verify database file exists and is accessible
echo ""
echo -e "${YELLOW}Verifying database...${NC}"
if [ -f "prisma/data/sports_bar.db" ]; then
    DB_SIZE=$(du -h "prisma/data/sports_bar.db" | cut -f1)
    echo -e "${GREEN}✓ Database file exists (Size: $DB_SIZE)${NC}"
    
    # Check if database is readable
    if sqlite3 "prisma/data/sports_bar.db" "SELECT COUNT(*) FROM sqlite_master;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database is readable${NC}"
    else
        echo -e "${RED}Warning: Database file exists but may be corrupted${NC}"
    fi
else
    echo -e "${YELLOW}Database file will be created on first run${NC}"
fi

# Clean up old database files (optional - commented out for safety)
echo ""
echo -e "${YELLOW}Old database files:${NC}"
if [ -f "data/sports_bar.db" ]; then
    echo -e "  data/sports_bar.db (can be removed after verifying migration)"
fi

echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Migration Complete!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Run: ${YELLOW}npx prisma generate${NC}"
echo -e "  2. Run: ${YELLOW}npm run build${NC}"
echo -e "  3. Restart the application: ${YELLOW}pm2 restart sports-bar-tv-controller${NC}"
echo ""
echo -e "${BLUE}Database location:${NC} prisma/data/sports_bar.db"
echo -e "${BLUE}This location will persist across updates.${NC}"
echo ""
