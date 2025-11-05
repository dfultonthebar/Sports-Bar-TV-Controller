#!/usr/bin/env node

const fs = require('fs');
const { globSync } = require('glob');

const files = globSync('src/app/api/**/*.ts', {
  cwd: '/home/ubuntu/Sports-Bar-TV-Controller',
  absolute: true
});

let fixed = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  const original = content;

  // Check if file uses isValidationError but doesn't import it
  if (content.includes('isValidationError(') && !content.match(/import.*isValidationError.*from/)) {
    // Find the validation import line
    const importMatch = content.match(/(import\s*{\s*)([^}]+)(\s*}\s*from\s+['"]@\/lib\/validation['"])/);

    if (importMatch) {
      const [fullMatch, before, imports, after] = importMatch;
      const importList = imports.split(',').map(s => s.trim());

      // Add type guards if not present
      if (!importList.includes('isValidationError')) {
        importList.push('isValidationError');
      }
      if (!importList.includes('isValidationSuccess')) {
        importList.push('isValidationSuccess');
      }

      const newImport = `${before}${importList.join(', ')}${after}`;
      content = content.replace(fullMatch, newImport);

      if (content !== original) {
        fs.writeFileSync(file, content, 'utf-8');
        fixed++;
        console.log(`✓ ${file.replace('/home/ubuntu/Sports-Bar-TV-Controller/', '')}`);
      }
    }
  }
}

console.log(`\nFixed ${fixed} files`);
