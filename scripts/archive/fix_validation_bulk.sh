#!/bin/bash

# Bulk fix for validation bypass pattern
# This handles the most common pattern where await request.json() appears
# a few lines after the validateRequestBody check

set -e

FILES=$(find src/app/api -name "route.ts" -type f -exec sh -c 'grep -l "validateRequestBody" "$1" 2>/dev/null && grep -q "await request.json()" "$1" 2>/dev/null && echo "$1"' _ {} \; 2>/dev/null | head -50)

FIXED=0

for FILE in $FILES; do
    echo "Processing: $FILE"

    # Create backup
    cp "$FILE" "${FILE}.bak3"

    # Use awk to make the replacement more reliably
    awk '
    /const bodyValidation = await validateRequestBody/ {
        validation_line = $0
        print
        getline
        if (/if \(!bodyValidation\.success\)/) {
            print
            # Skip empty lines and collect them
            empty_lines = ""
            while (getline > 0 && /^[[:space:]]*$/) {
                empty_lines = empty_lines "\n"
            }
            # Now we have a non-empty line
            if (/await request\.json\(\)/) {
                # Extract the variable pattern (const body or const { ... })
                if (match($0, /const[[:space:]]+(body|\{[^}]+\})[[:space:]]*=/)) {
                    var_part = substr($0, RSTART, RLENGTH-1)
                    indent = match($0, /[^[:space:]]/)
                    indent_str = substr($0, 1, indent-1)

                    print empty_lines
                    print indent_str "// Security: use validated data"
                    print var_part " = bodyValidation.data"
                    print ""
                    next
                }
            }
            # Print collected empty lines and current line
            printf "%s", empty_lines
            print
        } else {
            print
        }
        next
    }
    { print }
    ' "$FILE" > "${FILE}.tmp" && mv "${FILE}.tmp" "$FILE"

    # Check if file was modified
    if ! diff -q "$FILE" "${FILE}.bak3" > /dev/null 2>&1; then
        echo "  ✓ Fixed"
        FIXED=$((FIXED + 1))
    else
        echo "  - No changes"
        rm "${FILE}.bak3"
    fi
done

echo ""
echo "Fixed $FIXED files"
