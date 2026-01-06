#!/bin/bash

echo "🔧 Fixing select dropdown styling..."

# Define the target style
TARGET_STYLE="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

# Find all TypeScript/TSX files with select elements
FILES=$(find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "<select" 2>/dev/null)

total_files=0
total_changes=0

for file in $FILES; do
  echo "Processing: $file"
  
  # Create a backup
  cp "$file" "$file.bak"
  
  # Replace various select className patterns with the standard one
  # Note: This is a simple approach - might need manual review
  sed -i 's/className="w-full px-[0-9] py-[0-9.]* bg-slate-[0-9]* border border-slate-[0-9]* rounded[^"]*text-slate-[0-9]*[^"]*"/className="'"$TARGET_STYLE"'"/g' "$file"
  
  # Check if file changed
  if ! cmp -s "$file" "$file.bak"; then
    ((total_files++))
    changes=$(diff -u "$file.bak" "$file" | grep -c "^[-+]" || true)
    ((total_changes += changes / 2))  # Divide by 2 because diff shows both - and + lines
    echo "  ✓ Modified"
    rm "$file.bak"
  else
    echo "  - No changes"
    rm "$file.bak"
  fi
done

echo ""
echo "📊 Results:"
echo "  Files modified: $total_files"
echo "  Total changes: $total_changes"
echo ""
echo "✅ Done!"
