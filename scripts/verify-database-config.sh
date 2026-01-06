#!/bin/bash
###############################################################################
# Database Configuration Verification Script
#
# Purpose: Verify correct database is configured and prevent misconfiguration
#
# Checks:
# - DATABASE_URL points to production.db
# - Database file exists and is non-empty
# - No empty .db files exist in data/ or prisma/ directories
# - Database has valid SQLite structure
#
# Exit codes:
# 0 - All checks passed
# 1 - Configuration error found
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Expected production database path
EXPECTED_DB="/home/ubuntu/sports-bar-data/production.db"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Database Configuration Verification${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Function to check for empty database files
check_empty_db_files() {
    local found_empty=0

    echo -e "${BLUE}[1/5] Checking for empty database files...${NC}"

    # Check data/ directory
    if [ -d "/home/ubuntu/Sports-Bar-TV-Controller/data" ]; then
        for dbfile in /home/ubuntu/Sports-Bar-TV-Controller/data/*.db; do
            if [ -f "$dbfile" ]; then
                size=$(stat -f%z "$dbfile" 2>/dev/null || stat -c%s "$dbfile" 2>/dev/null)
                if [ "$size" -eq 0 ]; then
                    echo -e "${RED}  ✗ Found empty database file: $dbfile${NC}"
                    found_empty=1
                fi
            fi
        done
    fi

    # Check prisma/ directory
    if [ -d "/home/ubuntu/Sports-Bar-TV-Controller/prisma" ]; then
        for dbfile in /home/ubuntu/Sports-Bar-TV-Controller/prisma/*.db; do
            if [ -f "$dbfile" ]; then
                size=$(stat -f%z "$dbfile" 2>/dev/null || stat -c%s "$dbfile" 2>/dev/null)
                if [ "$size" -eq 0 ]; then
                    echo -e "${RED}  ✗ Found empty database file: $dbfile${NC}"
                    found_empty=1
                fi
            fi
        done
    fi

    if [ $found_empty -eq 0 ]; then
        echo -e "${GREEN}  ✓ No empty database files found${NC}"
    else
        echo -e "${YELLOW}  ! Empty database files should be deleted${NC}"
        return 1
    fi
}

# Function to check DATABASE_URL
check_database_url() {
    echo -e "\n${BLUE}[2/5] Checking DATABASE_URL environment variable...${NC}"

    # Try to get DATABASE_URL from .env file
    if [ -f "/home/ubuntu/Sports-Bar-TV-Controller/.env" ]; then
        DB_URL=$(grep "^DATABASE_URL=" /home/ubuntu/Sports-Bar-TV-Controller/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'")

        if [ -z "$DB_URL" ]; then
            echo -e "${RED}  ✗ DATABASE_URL not found in .env file${NC}"
            return 1
        fi

        # Remove file: prefix
        DB_PATH="${DB_URL#file:}"

        echo -e "  Current DATABASE_URL: ${DB_PATH}"

        if [ "$DB_PATH" == "$EXPECTED_DB" ]; then
            echo -e "${GREEN}  ✓ DATABASE_URL points to correct production database${NC}"
        else
            echo -e "${RED}  ✗ DATABASE_URL is incorrect${NC}"
            echo -e "${YELLOW}  Expected: $EXPECTED_DB${NC}"
            echo -e "${YELLOW}  Found:    $DB_PATH${NC}"
            return 1
        fi
    else
        echo -e "${RED}  ✗ .env file not found${NC}"
        return 1
    fi
}

# Function to check database file exists
check_database_exists() {
    echo -e "\n${BLUE}[3/5] Checking production database file...${NC}"

    if [ ! -f "$EXPECTED_DB" ]; then
        echo -e "${RED}  ✗ Production database not found at: $EXPECTED_DB${NC}"
        return 1
    fi

    echo -e "${GREEN}  ✓ Database file exists${NC}"

    # Check file size
    size=$(stat -f%z "$EXPECTED_DB" 2>/dev/null || stat -c%s "$EXPECTED_DB" 2>/dev/null)
    size_mb=$(echo "scale=2; $size / 1048576" | bc)

    if [ "$size" -eq 0 ]; then
        echo -e "${RED}  ✗ Database file is empty (0 bytes)${NC}"
        return 1
    fi

    echo -e "${GREEN}  ✓ Database size: ${size_mb} MB${NC}"
}

# Function to check database integrity
check_database_integrity() {
    echo -e "\n${BLUE}[4/5] Checking database integrity...${NC}"

    # Check if sqlite3 is available
    if ! command -v sqlite3 &> /dev/null; then
        echo -e "${YELLOW}  ! sqlite3 not found, skipping integrity check${NC}"
        return 0
    fi

    # Try to query the database
    if sqlite3 "$EXPECTED_DB" "SELECT COUNT(*) FROM sqlite_master;" > /dev/null 2>&1; then
        table_count=$(sqlite3 "$EXPECTED_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
        echo -e "${GREEN}  ✓ Database is readable${NC}"
        echo -e "${GREEN}  ✓ Database has $table_count tables${NC}"

        # Run integrity check
        integrity=$(sqlite3 "$EXPECTED_DB" "PRAGMA integrity_check;")
        if [ "$integrity" == "ok" ]; then
            echo -e "${GREEN}  ✓ Database integrity check passed${NC}"
        else
            echo -e "${RED}  ✗ Database integrity check failed${NC}"
            echo -e "${RED}  $integrity${NC}"
            return 1
        fi
    else
        echo -e "${RED}  ✗ Database is not readable or corrupted${NC}"
        return 1
    fi
}

# Function to check for wrong database paths in code
check_code_references() {
    echo -e "\n${BLUE}[5/5] Checking for hardcoded database paths in code...${NC}"

    cd /home/ubuntu/Sports-Bar-TV-Controller

    # Search for old database paths
    wrong_paths_found=0

    # Check for prisma/data/sports_bar.db references
    if grep -r "prisma/data/sports_bar.db" --include="*.ts" --include="*.js" src/ 2>/dev/null | grep -v "// Production" | grep -v "node_modules" > /dev/null; then
        echo -e "${YELLOW}  ! Found references to old path: prisma/data/sports_bar.db${NC}"
        wrong_paths_found=1
    fi

    # Check for data/sports-bar.db references
    if grep -r "data/sports-bar.db" --include="*.ts" --include="*.js" src/ 2>/dev/null | grep -v "node_modules" > /dev/null; then
        echo -e "${YELLOW}  ! Found references to old path: data/sports-bar.db${NC}"
        wrong_paths_found=1
    fi

    # Check for data/sqlite.db references
    if grep -r "data/sqlite.db" --include="*.ts" --include="*.js" src/ 2>/dev/null | grep -v "node_modules" > /dev/null; then
        echo -e "${YELLOW}  ! Found references to old path: data/sqlite.db${NC}"
        wrong_paths_found=1
    fi

    if [ $wrong_paths_found -eq 0 ]; then
        echo -e "${GREEN}  ✓ No hardcoded wrong database paths found in src/${NC}"
    else
        echo -e "${YELLOW}  ! Review and update these references to use process.env.DATABASE_URL${NC}"
    fi
}

# Run all checks
all_passed=0

check_empty_db_files || all_passed=1
check_database_url || all_passed=1
check_database_exists || all_passed=1
check_database_integrity || all_passed=1
check_code_references

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}========================================${NC}\n"

if [ $all_passed -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo -e "${GREEN}✓ Database is correctly configured at: $EXPECTED_DB${NC}\n"
    exit 0
else
    echo -e "${RED}✗ Configuration errors found!${NC}"
    echo -e "${YELLOW}Please fix the issues above before running the application${NC}\n"

    echo -e "${BLUE}Quick fixes:${NC}"
    echo -e "  1. Update .env file:"
    echo -e "     ${YELLOW}DATABASE_URL=\"file:$EXPECTED_DB\"${NC}"
    echo -e "  2. Remove empty database files:"
    echo -e "     ${YELLOW}rm -f /home/ubuntu/Sports-Bar-TV-Controller/data/*.db${NC}"
    echo -e "     ${YELLOW}rm -f /home/ubuntu/Sports-Bar-TV-Controller/prisma/*.db${NC}\n"

    exit 1
fi
