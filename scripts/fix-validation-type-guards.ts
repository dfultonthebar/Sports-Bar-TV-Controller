#!/usr/bin/env tsx

/**
 * Script to fix all ValidatedResult type guard issues across the codebase
 *
 * This script:
 * 1. Finds all files using validation functions
 * 2. Identifies patterns where .data is accessed without proper type narrowing
 * 3. Applies fixes to ensure proper TypeScript type narrowing
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface Fix {
  file: string;
  line: number;
  before: string;
  after: string;
}

const fixes: Fix[] = [];

function fixValidationPattern(content: string, filePath: string): string {
  const lines = content.split('\n');
  let modified = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Pattern 1: Look for validation assignment followed by accessing .data without proper type guard
    const validationMatch = line.match(/^\s*(const|let)\s+(\w+)\s*=\s*await\s+(validateRequestBody|validateQueryParams|validatePathParams|validateRequest)\(/);

    if (validationMatch) {
      const indent = line.match(/^(\s*)/)?.[1] || '';
      const varName = validationMatch[2];

      // Look ahead to see if there's a proper type guard
      let hasProperTypeGuard = false;
      let typeGuardIndex = -1;

      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes(`if (!${varName}.success)`) && lines[j].includes(`return ${varName}.error`)) {
          hasProperTypeGuard = true;
          typeGuardIndex = j;
          break;
        }
      }

      if (hasProperTypeGuard && typeGuardIndex > -1) {
        // Check if data is accessed after the type guard
        let dataAccessIndex = -1;
        for (let j = typeGuardIndex + 1; j < Math.min(typeGuardIndex + 10, lines.length); j++) {
          if (lines[j].match(new RegExp(`${varName}\\.data`)) ||
              lines[j].match(new RegExp(`(const|let)\\s+.*=\\s*${varName}\\.data`))) {
            dataAccessIndex = j;
            break;
          }
        }

        // If data is accessed directly, add destructuring after the type guard
        if (dataAccessIndex > -1) {
          const dataLine = lines[dataAccessIndex];

          // Check if it's already destructured properly
          if (!dataLine.includes('const {') && !dataLine.includes('const data =')) {
            // Add destructuring line after type guard
            const destructureLine = `${indent}const { data } = ${varName}`;
            lines.splice(typeGuardIndex + 1, 0, destructureLine);

            fixes.push({
              file: filePath,
              line: typeGuardIndex + 2,
              before: 'Missing destructuring',
              after: destructureLine
            });

            modified = true;
            i = typeGuardIndex + 2; // Skip past the new line
            continue;
          }
        }
      }
    }

    // Pattern 2: Look for direct access to validation.data without destructuring
    const directDataAccess = line.match(/^\s*const\s+(\w+)\s*=\s*(\w+)\.data\s*$/);
    if (directDataAccess) {
      const varName = directDataAccess[1];
      const validationVar = directDataAccess[2];
      const indent = line.match(/^(\s*)/)?.[1] || '';

      // Check if there was a type guard before this
      let hasTypeGuard = false;
      for (let j = Math.max(0, i - 5); j < i; j++) {
        if (lines[j].includes(`if (!${validationVar}.success)`)) {
          hasTypeGuard = true;
          break;
        }
      }

      if (hasTypeGuard) {
        // Change to destructuring
        lines[i] = `${indent}const { data: ${varName} } = ${validationVar}`;
        fixes.push({
          file: filePath,
          line: i + 1,
          before: line,
          after: lines[i]
        });
        modified = true;
      }
    }

    // Pattern 3: Look for validation.data used inline (e.g., in await request.json())
    if (line.includes('.data') && line.match(/(\w+)\.data/)) {
      const matches = line.matchAll(/(\w+)\.data/g);
      for (const match of matches) {
        const validationVar = match[1];

        // Check if this looks like a validation variable
        if (validationVar.toLowerCase().includes('validation') ||
            validationVar.toLowerCase().includes('body') ||
            validationVar.toLowerCase().includes('query') ||
            validationVar.toLowerCase().includes('params')) {

          // Look backwards for type guard
          let hasTypeGuard = false;
          for (let j = Math.max(0, i - 10); j < i; j++) {
            if (lines[j].includes(`if (!${validationVar}.success)`)) {
              hasTypeGuard = true;
              break;
            }
          }

          if (!hasTypeGuard) {
            console.log(`Warning: Potential missing type guard for ${validationVar} in ${filePath}:${i + 1}`);
          }
        }
      }
    }

    i++;
  }

  return modified ? lines.join('\n') : content;
}

async function main() {
  console.log('Finding all TypeScript files with validation usage...\n');

  const files = await glob('src/app/api/**/*.ts', {
    cwd: '/home/ubuntu/Sports-Bar-TV-Controller',
    absolute: true,
    ignore: ['**/node_modules/**', '**/.next/**']
  });

  console.log(`Found ${files.length} files to check\n`);

  let filesModified = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');

      // Skip files that don't use validation
      if (!content.includes('validateRequestBody') &&
          !content.includes('validateQueryParams') &&
          !content.includes('validatePathParams') &&
          !content.includes('validateRequest')) {
        continue;
      }

      const newContent = fixValidationPattern(content, file);

      if (newContent !== content) {
        fs.writeFileSync(file, newContent, 'utf-8');
        filesModified++;
        console.log(`✓ Fixed: ${file}`);
      }
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Summary:`);
  console.log(`- Files checked: ${files.length}`);
  console.log(`- Files modified: ${filesModified}`);
  console.log(`- Fixes applied: ${fixes.length}`);
  console.log(`${'='.repeat(60)}\n`);

  if (fixes.length > 0) {
    console.log('Sample fixes:');
    fixes.slice(0, 10).forEach(fix => {
      console.log(`\n${fix.file}:${fix.line}`);
      console.log(`  ${fix.after}`);
    });
  }
}

main().catch(console.error);
