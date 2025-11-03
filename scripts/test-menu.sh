#!/bin/bash

# Interactive Test Menu
# Provides an easy way to run different test suites

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

clear

echo -e "${BLUE}========================================"
echo "  Sports Bar TV Controller"
echo "  Integration Test Menu"
echo -e "========================================${NC}"
echo ""

PS3=$'\n'"Select test suite to run: "

options=(
    "Safe Tests (Database + Hardware Check)"
    "Database Tests Only"
    "Hardware Connectivity Tests"
    "API Tests (requires server running)"
    "Matrix Control Tests (WARNING: sends commands!)"
    "Fire TV Tests (requires ADB)"
    "User Workflow Scenarios"
    "All Integration Tests"
    "All Tests with Coverage"
    "Exit"
)

select opt in "${options[@]}"
do
    case $opt in
        "Safe Tests (Database + Hardware Check)")
            echo ""
            echo -e "${GREEN}Running safe tests...${NC}"
            ./scripts/run-safe-tests.sh
            break
            ;;
        "Database Tests Only")
            echo ""
            echo -e "${GREEN}Running database tests...${NC}"
            npm run test:database
            break
            ;;
        "Hardware Connectivity Tests")
            echo ""
            echo -e "${YELLOW}Skip hardware interaction? (y/n)${NC}"
            read -r skip
            if [ "$skip" = "y" ]; then
                SKIP_HARDWARE_TESTS=true npm run test:hardware
            else
                npm run test:hardware
            fi
            break
            ;;
        "API Tests (requires server running)")
            echo ""
            echo -e "${YELLOW}Is the server running at localhost:3000? (y/n)${NC}"
            read -r running
            if [ "$running" != "y" ]; then
                echo -e "${RED}Please start the server first: npm run dev${NC}"
                exit 1
            fi
            echo -e "${GREEN}Running API tests...${NC}"
            npm run test:api
            break
            ;;
        "Matrix Control Tests (WARNING: sends commands!)")
            echo ""
            echo -e "${RED}WARNING: This will send actual routing commands to the matrix!${NC}"
            echo -e "${YELLOW}Continue? (y/n)${NC}"
            read -r confirm
            if [ "$confirm" = "y" ]; then
                npm run test:matrix
            else
                echo "Cancelled."
            fi
            break
            ;;
        "Fire TV Tests (requires ADB)")
            echo ""
            if ! command -v adb &> /dev/null; then
                echo -e "${RED}ADB is not installed.${NC}"
                echo "Install with: sudo apt-get install adb"
                exit 1
            fi
            echo -e "${GREEN}Running Fire TV tests...${NC}"
            npm run test:firetv
            break
            ;;
        "User Workflow Scenarios")
            echo ""
            echo -e "${YELLOW}This requires the server to be running. Continue? (y/n)${NC}"
            read -r confirm
            if [ "$confirm" = "y" ]; then
                npm run test:scenarios
            else
                echo "Cancelled."
            fi
            break
            ;;
        "All Integration Tests")
            echo ""
            echo -e "${YELLOW}Run with hardware interaction? (y/n)${NC}"
            read -r hardware
            if [ "$hardware" = "y" ]; then
                npm run test:integration
            else
                SKIP_HARDWARE_TESTS=true SKIP_NETWORK_TESTS=true npm run test:integration
            fi
            break
            ;;
        "All Tests with Coverage")
            echo ""
            echo -e "${GREEN}Running all tests with coverage...${NC}"
            npm run test:coverage
            echo ""
            echo -e "${GREEN}Coverage report generated in coverage/lcov-report/index.html${NC}"
            break
            ;;
        "Exit")
            echo ""
            echo "Goodbye!"
            break
            ;;
        *)
            echo -e "${RED}Invalid option $REPLY${NC}"
            ;;
    esac
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Test execution complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Documentation:"
echo "  docs/TESTING.md          - Full testing guide"
echo "  docs/TEST_RESULTS.md     - Test results summary"
echo "  tests/README.md          - Quick start guide"
echo ""
