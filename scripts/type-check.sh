#!/bin/bash

# Sports Bar TV Controller - TypeScript Type Check Script
# Runs TypeScript compiler in noEmit mode to check for type errors

set -e

echo "= Running TypeScript type check..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Run type check
if npx tsc --noEmit; then
  echo ""
  echo -e "${GREEN} TypeScript type check passed!${NC}"
  echo ""
  exit 0
else
  echo ""
  echo -e "${RED}L TypeScript type check failed!${NC}"
  echo ""
  echo -e "${YELLOW}Please fix the type errors above before committing.${NC}"
  exit 1
fi
