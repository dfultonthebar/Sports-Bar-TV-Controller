#!/bin/bash

# Sports Bar TV Controller - Comprehensive Quality Check Script
# Runs all quality checks: type-check, lint, format, tests, coverage

set -e

echo "<¯ Sports Bar TV Controller - Quality Check Suite"
echo ""
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

FAILED_CHECKS=()

# Function to run a check and track failures
run_check() {
  local check_name="$1"
  local check_command="$2"

  echo -e "${CYAN}¶ Running: $check_name${NC}"
  echo ""

  if eval "$check_command"; then
    echo -e "${GREEN} $check_name passed${NC}"
    echo ""
  else
    echo -e "${RED}L $check_name failed${NC}"
    echo ""
    FAILED_CHECKS+=("$check_name")
  fi
}

# 1. TypeScript Type Check
run_check "TypeScript Type Check" "./scripts/type-check.sh"

# 2. ESLint
run_check "ESLint" "npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0"

# 3. Prettier Format Check
run_check "Prettier Format Check" "npx prettier --check 'src/**/*.{ts,tsx,js,jsx,json}'"

# 4. Tests with Coverage
run_check "Tests with Coverage" "./scripts/run-tests.sh --coverage"

# Summary
echo ""
echo ""

if [ ${#FAILED_CHECKS[@]} -eq 0 ]; then
  echo -e "${GREEN}<‰ All quality checks passed!${NC}"
  echo ""
  echo " TypeScript compilation"
  echo " ESLint (no warnings)"
  echo " Prettier formatting"
  echo " Tests with 80% coverage"
  echo ""
  echo -e "${GREEN}Ready to commit! =€${NC}"
  exit 0
else
  echo -e "${RED}L Quality check failed!${NC}"
  echo ""
  echo -e "${YELLOW}Failed checks:${NC}"
  for check in "${FAILED_CHECKS[@]}"; do
    echo "  L $check"
  done
  echo ""
  echo -e "${YELLOW}Please fix the issues above before committing.${NC}"
  exit 1
fi
