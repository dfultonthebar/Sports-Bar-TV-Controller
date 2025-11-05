#!/usr/bin/env node

/**
 * Fix ValidatedResult type guard issues - Final version
 * Properly handles all patterns without creating duplicates
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

let fixedFiles = 0;
let totalFixes = 0;

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Skip if no validation used
  if (!content.includes('validation')) {
    return false;
  }

  const lines = content.split('\n');
  const newLines = [];
  let fileModified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    newLines.push(line);

    // Pattern 1: Look for type guard and check if next lines access .data
    if (line.match(/if\s*\(!(\w+)\.success\)\s*return\s+\1\.error/)) {
      const varName = line.match(/if\s*\(!(\w+)\.success\)/)[1];
      const indent = line.match(/^(\s*)/)[1];

      // Check if next line already has destructuring
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.includes(`const { data } = ${varName}`)) {
        continue;
      }

      // Check if there's a .data access in the next few lines
      let needsDestructuring = false;
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        if (lines[j].includes(`${varName}.data`)) {
          needsDestructuring = true;
          break;
        }
        // Stop if we hit a new function or major block
        if (lines[j].match(/^\s*(export\s+)?(async\s+)?function/) ||
            lines[j].match(/^\s*export\s+(async\s+)?function/)) {
          break;
        }
      }

      if (needsDestructuring) {
        newLines.push(`${indent}const { data } = ${varName}`);
        totalFixes++;
        fileModified = true;
      }
    }
  }

  // Now replace all validationVar.data with just data after type guards
  let finalContent = newLines.join('\n');

  // Find all validation variables
  const validationVars = [...finalContent.matchAll(/if\s*\(!(\w+)\.success\)\s*return\s+\1\.error\s*\n\s*const\s*\{\s*data\s*\}\s*=\s*\1/g)]
    .map(m => m[1]);

  for (const varName of validationVars) {
    // Find each occurrence and replace .data access in the same block
    const regex = new RegExp(`(if\\s*\\(!${varName}\\.success\\)\\s*return\\s+${varName}\\.error\\s*\\n\\s*const\\s*\\{\\s*data\\s*\\}\\s*=\\s*${varName})([\\s\\S]*?)(?=\\n\\s*(?:export\\s+)?(?:async\\s+)?function|\\n\\}\\n|$)`, 'g');

    finalContent = finalContent.replace(regex, (match, guard, block) => {
      // Replace varName.data with just data in this block
      const fixedBlock = block.replace(new RegExp(`${varName}\\.data`, 'g'), 'data');
      return guard + fixedBlock;
    });
  }

  if (fileModified && finalContent !== content) {
    fs.writeFileSync(filePath, finalContent, 'utf-8');
    fixedFiles++;
    console.log(`✓ ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

function main() {
  console.log('Fixing ValidatedResult type guard issues...\n');

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
  console.log(`  Total fixes applied: ${totalFixes}`);
  console.log(`${'='.repeat(60)}\n`);
}

main();
