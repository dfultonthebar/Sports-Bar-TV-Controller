#!/usr/bin/env node

/**
 * Fix ValidatedResult type guard issues by using the proper isValidationError function
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

let fixedFiles = 0;
let totalFixes = 0;

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;

  // Skip if no validation used
  if (!content.includes('validation')) {
    return false;
  }

  // Pattern 1: if (!validation.success) return validation.error
  // Replace with: if (isValidationError(validation)) return validation.error
  const pattern1 = /if\s*\(\s*!(\w+)\.success\s*\)\s*return\s+\1\.error/g;
  content = content.replace(pattern1, (match, varName) => {
    totalFixes++;
    return `if (isValidationError(${varName})) return ${varName}.error`;
  });

  // Check if we need to add the import
  if (content !== originalContent) {
    // Check if isValidationError is already imported
    if (!content.includes('isValidationError')) {
      // Find the validation import line and add isValidationError to it
      content = content.replace(
        /(import\s+{[^}]*)(validateRequestBody|validateQueryParams|validatePathParams|validateRequest)([^}]*}[^;]*from\s+['"]@\/lib\/validation)/,
        (match, before, funcName, after) => {
          // Check if there's already a comma or space before the closing brace
          if (!before.includes('isValidationError') && !after.includes('isValidationError')) {
            // Add isValidationError to the import
            const needsComma = !before.trim().endsWith(',') && !before.trim().endsWith('{');
            return `${before}${needsComma ? ', ' : ''}isValidationError, ${funcName}${after}`;
          }
          return match;
        }
      );
    }

    // Also add isValidationSuccess if not present (for future use)
    if (!content.includes('isValidationSuccess')) {
      content = content.replace(
        /(import\s+{[^}]*isValidationError)([^}]*}[^;]*from\s+['"]@\/lib\/validation)/,
        (match, before, after) => {
          const needsComma = !before.trim().endsWith(',');
          return `${before}${needsComma ? ', ' : ''}isValidationSuccess${after}`;
        }
      );
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    fixedFiles++;
    console.log(`✓ ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

function main() {
  console.log('Fixing ValidatedResult type guard issues with isValidationError()...\n');

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
  console.log(`  Total type guards fixed: ${totalFixes}`);
  console.log(`${'='.repeat(60)}\n`);
}

main();
