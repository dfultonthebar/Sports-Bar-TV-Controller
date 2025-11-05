#!/bin/bash

# Fix the incorrect paren/brace order in logger calls
# Pattern: .toISOString()) } should be .toISOString() })

echo "Fixing incorrect paren/brace order..."

find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\.toISOString()) }/\.toISOString() })/g' {} +

echo "Done!"
