#!/bin/bash

# Fix the last remaining LogOptions errors with multiline patterns

# Helper function to wrap logger call properties in data
fix_logger_multiline() {
    local file="$1"
    local line_num="$2"
    local property="$3"

    echo "Fixing $file:$line_num (property: $property)"

    # Use awk to add 'data: {' after the opening brace and '}' before closing
    awk -v line=$line_num '
    NR == line && /logger\./ {
        # Find the opening brace position
        if (match($0, /\{/)) {
            indent = substr($0, 1, RSTART + length(match($0, /^[ \t]*/)) - 1)
            # Replace { with { data: {
            sub(/\{/, "{ data: {", $0)
            print
            next
        }
    }
    # If we are after the target line and see a closing }, add extra }
    NR > line && /^\s*\}\)/ {
        # Add closing } for data wrapper
        indent = match($0, /[^ \t]/)
        spaces = substr($0, 1, indent - 1)
        sub(/\}\)/, "}\n" spaces "  })", $0)
    }
    { print }
    ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
}

# Process each error
while IFS= read -r error_line; do
    if [[ $error_line =~ ^([^(]+)\(([0-9]+),.+\'([^\']+)\' ]]; then
        file="${BASH_REMATCH[1]}"
        line="${BASH_REMATCH[2]}"
        prop="${BASH_REMATCH[3]}"

        # Simple sed approach - for single property on one line
        # Pattern: property: value, → data: { property: value,
        sed -i "${line}s/^\(\s*\)\($prop:\)/\1data: { \2/" "$file"

        # Find the closing of this object and add }
        # This is a simplification - for multiline we need the line after
        next_line=$((line + 1))
        sed -i "${next_line}s/^\(\s*\)\(.*\)\(\}\)/\1\2 }\n\1\3/" "$file"

        echo "  ✓ Fixed $file:$line"
    fi
done < <(npx tsc --noEmit 2>&1 | grep "TS2353.*LogOptions")

echo
echo "✅ Applied fixes to all remaining files"
