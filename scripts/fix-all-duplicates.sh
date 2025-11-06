#!/bin/bash

# Fix all duplicate "const { data: body } = bodyValidation" lines
# These were accidentally added by automated fixes

files=($(grep -r "const { data: body } = bodyValidation" /home/ubuntu/Sports-Bar-TV-Controller/src/app/api/ --include="*.ts" -l))

echo "Found ${#files[@]} files with duplicate declarations"

for file in "${files[@]}"; do
  echo "Fixing: $file"
  # Remove lines that match the duplicate pattern
  sed -i '/^  const { data: body } = bodyValidation$/d' "$file"
done

echo "Done! Fixed ${#files[@]} files"
