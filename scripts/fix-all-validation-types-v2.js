#!/usr/bin/env node

/**
 * Fix all ValidatedResult type guard issues - Version 2
 * Handles all patterns including nested property access
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

let totalFiles = 0;
let fixedFiles = 0;
let totalFixes = 0;

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Skip if no validation used
  if (!content.includes('validateRequestBody') &&
      !content.includes('validateQueryParams') &&
      !content.includes('validatePathParams') &&
      !content.includes('validateRequest')) {
    return false;
  }

  totalFiles++;
  const originalContent = content;
  let fileModified = false;

  // Find all validation variable names and check if they need fixing
  const validationVarNames = new Set();
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find validation assignments
    const validationAssignment = line.match(/^\s*const\s+(\w+)\s*=\s*(?:await\s+)?validate(?:RequestBody|QueryParams|PathParams|Request)\(/);
    if (validationAssignment) {
      validationVarNames.add(validationAssignment[1]);
    }
  }

  // For each validation variable, check if it needs a destructuring line
  for (const varName of validationVarNames) {
    // Find the type guard line
    const typeGuardRegex = new RegExp(`if\\s*\\(!${varName}\\.success\\)\\s*return\\s*${varName}\\.error`, 'g');
    const matches = [...content.matchAll(typeGuardRegex)];

    for (const match of matches) {
      const typeGuardPos = match.index;
      const linesBefore = content.substring(0, typeGuardPos).split('\n');
      const linesAfter = content.substring(typeGuardPos).split('\n');

      // Find the end of the type guard line
      const typeGuardLine = linesAfter[0];
      const indent = typeGuardLine.match(/^(\s*)/)[1];

      // Check if next line already has destructuring
      const nextLine = linesAfter[1];
      if (nextLine && nextLine.trim().startsWith(`const { data } = ${varName}`)) {
        continue; // Already fixed
      }

      // Check if there's any usage of varName.data after this type guard
      const remainingContent = linesAfter.slice(1).join('\n');
      const dataAccessRegex = new RegExp(`${varName}\\.data`, 'g');

      if (dataAccessRegex.test(remainingContent.split('if (!')[0] || remainingContent.substring(0, 500))) {
        // Insert destructuring after type guard
        const destructureLine = `${indent}const { data } = ${varName}`;

        // Find position to insert
        const insertPos = typeGuardPos + typeGuardLine.length;
        content = content.substring(0, insertPos) + '\n' + destructureLine + content.substring(insertPos);

        // Now replace all varName.data with just data in the following block
        // Find the function/block end
        let blockEnd = insertPos + destructureLine.length + 100;
        let braceCount = 0;
        let inBlock = false;

        for (let j = insertPos; j < content.length && j < insertPos + 5000; j++) {
          if (content[j] === '{') {
            braceCount++;
            inBlock = true;
          } else if (content[j] === '}') {
            braceCount--;
            if (braceCount === 0 && inBlock) {
              blockEnd = j;
              break;
            }
          }
        }

        // Replace varName.data with data in this block
        const beforeBlock = content.substring(0, insertPos + destructureLine.length + 1);
        const block = content.substring(insertPos + destructureLine.length + 1, blockEnd);
        const afterBlock = content.substring(blockEnd);

        const fixedBlock = block.replace(new RegExp(`${varName}\\.data`, 'g'), 'data');
        content = beforeBlock + fixedBlock + afterBlock;

        totalFixes++;
        fileModified = true;
      }
    }
  }

  if (fileModified && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    fixedFiles++;
    console.log(`✓ ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

function main() {
  console.log('Fixing ValidatedResult type guard issues (v2)...\n');

  const files = globSync('src/app/api/**/*.ts', {
    cwd: '/home/ubuntu/Sports-Bar-TV-Controller',
    absolute: true,
    ignore: ['**/node_modules/**', '**/.next/**']
  });

  console.log(`Found ${files.length} API route files\n`);

  for (const file of files) {
    try {
      fixFile(file);
    } catch (error) {
      console.error(`✗ Error in ${file}:`, error.message);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary:');
  console.log(`  Files with validation: ${totalFiles}`);
  console.log(`  Files fixed: ${fixedFiles}`);
  console.log(`  Total fixes applied: ${totalFixes}`);
  console.log(`${'='.repeat(60)}\n`);
}

main();
