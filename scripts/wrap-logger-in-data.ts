#!/usr/bin/env tsx

/**
 * Wrap unknown properties in logger calls with { data: ... }
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

// Get TS2353 errors
let output = '';
try {
  output = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8' });
} catch (err: any) {
  output = err.stdout || '';
}

const lines = output.split('\n');
const errors: Array<{ file: string; line: number; property: string }> = [];

for (const line of lines) {
  const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+TS2353:.*'(\w+)' does not exist in type 'LogOptions'/);
  if (match) {
    const [, file, lineNum, , property] = match;
    errors.push({
      file: file.trim(),
      line: parseInt(lineNum, 10),
      property
    });
  }
}

console.log(`Found ${errors.length} TS2353 errors related to LogOptions\n`);

// Group by file
const fileMap = new Map<string, Array<{ line: number; property: string }>>();
for (const error of errors) {
  const arr = fileMap.get(error.file) || [];
  arr.push({ line: error.line, property: error.property });
  fileMap.set(error.file, arr);
}

let totalFixed = 0;

for (const [filePath, fileErrors] of fileMap) {
  console.log(`Processing ${filePath} (${fileErrors.length} errors)`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const fileLines = content.split('\n');

  // Sort by line number descending to avoid offset issues
  const sortedErrors = fileErrors.sort((a, b) => b.line - a.line);

  for (const err of sortedErrors) {
    const idx = err.line - 1;
    if (idx < 0 || idx >= fileLines.length) continue;

    const line = fileLines[idx];

    // Check if this line has a logger call with an object that contains the unknown property
    if (!line.includes('logger.')) continue;
    if (!line.includes(`${err.property}:`)) continue;

    // Pattern: logger.method('...', { property: value, ... })
    // We need to wrap the entire object in { data: { ... } }

    // Find the opening brace of the second argument
    const loggerMatch = line.match(/logger\.\w+\([^,]+,\s*(\{)/);
    if (!loggerMatch) {
      console.log(`  ⚠️  Line ${err.line}: Could not find logger pattern`);
      continue;
    }

    // Check if it's already wrapped in data
    if (line.includes('{ data:') || line.includes('{data:')) {
      console.log(`  ℹ️  Line ${err.line}: Already has data wrapper`);
      continue;
    }

    // Simple heuristic: if the line has { property: value } and doesn't end with })
    // it's likely multiline and we need a more complex fix
    if (!line.trim().endsWith('})') && !line.trim().endsWith(')')) {
      console.log(`  ⚠️  Line ${err.line}: Multiline pattern, skipping auto-fix`);
      continue;
    }

    // Extract the second argument (the object)
    const secondArgMatch = line.match(/logger\.\w+\([^,]+,\s*(\{[^}]+\})\)/);
    if (secondArgMatch) {
      const objectArg = secondArgMatch[1];
      const wrappedArg = `{ data: ${objectArg} }`;
      const fixedLine = line.replace(objectArg + ')', wrappedArg + ')');

      fileLines[idx] = fixedLine;
      totalFixed++;
      console.log(`  ✓ Fixed line ${err.line}`);
    } else {
      console.log(`  ⚠️  Line ${err.line}: Could not extract second argument`);
    }
  }

  fs.writeFileSync(filePath, fileLines.join('\n'), 'utf-8');
}

console.log(`\n✨ Fixed ${totalFixed} logger calls`);

// Re-run type check
console.log('\nRunning type check...');
try {
  const result = execSync('npx tsc --noEmit 2>&1 | grep -E "TS2353.*LogOptions" | wc -l', { encoding: 'utf-8' });
  const remaining = parseInt(result.trim(), 10);
  console.log(`Remaining TS2353 LogOptions errors: ${remaining}`);
} catch (err) {
  console.log('Type check completed');
}
