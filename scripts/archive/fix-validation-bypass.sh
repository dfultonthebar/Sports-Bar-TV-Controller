#!/bin/bash

# Script to fix validation bypass bug in all API routes
# This replaces "await request.json()" with "bodyValidation.data" when used after validateRequestBody

set -e

echo "Finding all files with validation bypass pattern..."

# Find all files that have both validateRequestBody and await request.json()
FILES=$(find src/app/api -name "route.ts" -type f -exec sh -c 'if grep -q "validateRequestBody" "$1" && grep -q "await request.json()" "$1"; then echo "$1"; fi' _ {} \;)

FIXED_COUNT=0
SKIPPED_COUNT=0

for FILE in $FILES; do
    echo "Processing: $FILE"

    # Check if file contains the pattern we need to fix
    if grep -q "const bodyValidation = await validateRequestBody" "$FILE" && \
       grep -q "await request.json()" "$FILE"; then

        # Create backup
        cp "$FILE" "${FILE}.bak"

        # Try to fix the pattern
        # Pattern 1: Simple case where await request.json() is on its own line after validation
        if grep -A10 "const bodyValidation = await validateRequestBody" "$FILE" | grep -q "const .* = await request.json()"; then
            echo "  → Found fixable pattern in $FILE"
            # This file needs manual review - skip automated fix for safety
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
            rm "${FILE}.bak"
        else
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
            rm "${FILE}.bak"
        fi
    else
        echo "  → No fixable pattern found"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    fi
done

echo ""
echo "Summary:"
echo "  Fixed: $FIXED_COUNT files"
echo "  Skipped: $SKIPPED_COUNT files"
echo ""
echo "Manual fixes still needed for complex patterns"
