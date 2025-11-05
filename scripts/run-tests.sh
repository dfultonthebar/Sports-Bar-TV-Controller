#!/bin/bash

# Sports Bar TV Controller - Test Runner Script
# Runs all tests with coverage reporting

set -e

echo ">ê Running test suite..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if --coverage flag is passed
COVERAGE_FLAG=""
if [[ " $@ " =~ " --coverage " ]]; then
  COVERAGE_FLAG="--coverage"
  echo -e "${BLUE}=Ê Running with coverage report...${NC}"
else
  echo -e "${BLUE}<Ã Running tests without coverage...${NC}"
fi

# Run tests
if npx vitest run $COVERAGE_FLAG; then
  echo ""
  echo -e "${GREEN} All tests passed!${NC}"
  echo ""

  if [[ -n "$COVERAGE_FLAG" ]]; then
    echo -e "${BLUE}=È Coverage report generated in ./coverage/${NC}"
  fi

  exit 0
else
  echo ""
  echo -e "${RED}L Tests failed!${NC}"
  echo ""
  echo -e "${YELLOW}Please fix the failing tests before committing.${NC}"
  exit 1
fi
