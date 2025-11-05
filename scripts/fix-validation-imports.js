#!/usr/bin/env node

/**
 * Add isValidationError and isValidationSuccess to all validation imports
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

let fixedFiles = 0;

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;

  // Skip if no validation import or already has isValidationError
  if (!content.includes("from '@/lib/validation'") && !content.includes('from "@/lib/validation"')) {
    return false;
  }

  if (content.includes('isValidationError')) {
    return false; // Already fixed
  }

  // Pattern: import { ... } from '@/lib/validation'
  content = content.replace(
    /(import\s*{\s*)([^}]+)(\s*}\s*from\s+['"]@\/lib\/validation['"])/g,
    (match, before, imports, after) => {
      // Parse existing imports
      const importList = imports.split(',').map(i => i.trim());

      // Add the type guards if not present
      if (!importList.includes('isValidationError')) {
        importList.push('isValidationError');
      }
      if (!importList.includes('isValidationSuccess')) {
        importList.push('isValidationSuccess');
      }

      // Reconstruct the import
      return `${before}${importList.join(', ')}${after}`;
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    fixedFiles++;
    console.log(`✓ ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

function main() {
  console.log('Adding type guard imports to validation files...\n');

  const files = globSync('src/app/api/**/*.ts', {
    cwd: '/home/ubuntu/Sports-Bar-TV-Controller',
    absolute: true,
    ignore: ['**/node_modules/**', '**/.next/**']
  });

  for (const file of files) {
    try {
      fixFile(file);
    } catch (error) {
      console.error(`✗ Error in ${file}:`, error.message);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary:');
  console.log(`  Files fixed: ${fixedFiles}`);
  console.log(`${'='.repeat(60)}\n`);
}

main();
