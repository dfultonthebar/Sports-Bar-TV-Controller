#!/bin/bash

# Sports Bar TV Controller - Pre-Commit Hook Script
# Lightweight checks before committing (no tests to keep commits fast)

set -e

echo "= Pre-commit quality checks..."
echo ""
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FAILED_CHECKS=()

# Function to run a check and track failures
run_check() {
  local check_name="$1"
  local check_command="$2"

  echo -e "${BLUE}¶ $check_name${NC}"

  if eval "$check_command" > /dev/null 2>&1; then
    echo -e "${GREEN} $check_name passed${NC}"
    echo ""
  else
    echo -e "${RED}L $check_name failed${NC}"
    # Run again with output visible for debugging
    eval "$check_command"
    echo ""
    FAILED_CHECKS+=("$check_name")
  fi
}

# 1. TypeScript Type Check
run_check "TypeScript" "npx tsc --noEmit"

# 2. ESLint
run_check "ESLint" "npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 0"

# 3. Prettier Format Check
run_check "Prettier" "npx prettier --check 'src/**/*.{ts,tsx,js,jsx,json}'"

# Summary
echo ""
echo ""

if [ ${#FAILED_CHECKS[@]} -eq 0 ]; then
  echo -e "${GREEN} Pre-commit checks passed!${NC}"
  echo ""
  echo -e "${YELLOW}Note: Run 'npm run quality-check' to include tests before pushing.${NC}"
  exit 0
else
  echo -e "${RED}L Pre-commit checks failed!${NC}"
  echo ""
  echo -e "${YELLOW}Failed checks:${NC}"
  for check in "${FAILED_CHECKS[@]}"; do
    echo "  L $check"
  done
  echo ""
  echo -e "${YELLOW}Fix these issues before committing:${NC}"
  echo "  " Run 'npm run lint:fix' to auto-fix linting issues"
  echo "  " Run 'npm run format' to auto-format code"
  echo "  " Fix TypeScript errors manually"
  exit 1
fi
