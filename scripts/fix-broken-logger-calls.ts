#!/usr/bin/env tsx

/**
 * Fix broken logger calls where function calls had their closing parens removed
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

interface Fix {
  file: string;
  line: number;
  pattern: string;
  fix: string;
}

const fixes: Fix[] = [];

// Get all TS1135 and TS1005 errors
let output = '';
try {
  output = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8' });
} catch (err: any) {
  output = err.stdout || '';
}
const lines = output.split('\n');

for (const line of lines) {
  const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+(TS1135|TS1005):/);
  if (match) {
    const [, file, lineNum] = match;
    fixes.push({
      file: file.trim(),
      line: parseInt(lineNum, 10),
      pattern: '',
      fix: ''
    });
  }
}

// Group by file
const fileMap = new Map<string, number[]>();
for (const fix of fixes) {
  const lines = fileMap.get(fix.file) || [];
  lines.push(fix.line);
  fileMap.set(fix.file, lines);
}

console.log(`Found ${fixes.length} errors in ${fileMap.size} files\n`);

let totalFixed = 0;

for (const [filePath, lineNumbers] of fileMap) {
  console.log(`Processing ${filePath} (${lineNumbers.length} errors)`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const fileLines = content.split('\n');
  let modified = false;

  for (const lineNum of lineNumbers.sort((a, b) => a - b)) {
    const idx = lineNum - 1;
    if (idx < 0 || idx >= fileLines.length) continue;

    const line = fileLines[idx];

    // Pattern 1: { data: new Date().toISOString( } - missing )
    if (line.includes('.toISOString(')) {
      const fixed = line.replace('.toISOString( })', '.toISOString()) }');
      if (fixed !== line) {
        fileLines[idx] = fixed;
        modified = true;
        totalFixed++;
        console.log(`  Fixed line ${lineNum}: Added missing ) to toISOString()`);
        continue;
      }
    }

    // Pattern 2: JSON.stringify(..., null, 2 } - missing )
    if (line.includes('JSON.stringify')) {
      const fixed = line.replace(/JSON\.stringify\([^)]+,\s*null,\s*2\s+\}\)/, (match) => {
        return match.replace(' })', ') })');
      });
      if (fixed !== line) {
        fileLines[idx] = fixed;
        modified = true;
        totalFixed++;
        console.log(`  Fixed line ${lineNum}: Added missing ) to JSON.stringify()`);
        continue;
      }
    }

    // Pattern 3: Generic missing ) before })
    // Look for patterns like: { data: someFunction( }
    const missingParenMatch = line.match(/{\s*data:\s*[^}]+\(\s+\}/);
    if (missingParenMatch) {
      const fixed = line.replace(/(\([^)]*)\s+\}/, '$1) }');
      if (fixed !== line) {
        fileLines[idx] = fixed;
        modified = true;
        totalFixed++;
        console.log(`  Fixed line ${lineNum}: Added missing ) before }`);
        continue;
      }
    }

    // Pattern 4: String literal broken by { data: insertion
    // e.g., "completed, { data: found:" should be "completed", { data: { found: ... } }
    if (line.includes(', { data:') && line.includes("'") || line.includes('"')) {
      // This is trickier - need to find where the string was split
      const quotedStringMatch = line.match(/(['"])([^'"]*),\s*{\s*data:\s*([^}]*)\}\)/);
      if (quotedStringMatch) {
        const [fullMatch, quote, beforeText, afterText] = quotedStringMatch;
        // The afterText was meant to be part of a data object
        const fixed = line.replace(
          fullMatch,
          `${quote}${beforeText}${quote}, { data: { ${afterText} } })`
        );
        if (fixed !== line) {
          fileLines[idx] = fixed;
          modified = true;
          totalFixed++;
          console.log(`  Fixed line ${lineNum}: Corrected string split by { data: }`);
          continue;
        }
      }
    }

    // Pattern 5: Missing closing ) on logger.info/error lines
    if (line.includes('logger.') && line.includes('{ data:')) {
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;

      if (openParens > closeParens) {
        // Add missing closing parens at the end
        const missing = openParens - closeParens;
        fileLines[idx] = line.trimEnd() + ')'.repeat(missing);
        modified = true;
        totalFixed++;
        console.log(`  Fixed line ${lineNum}: Added ${missing} missing )`);
        continue;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, fileLines.join('\n'), 'utf-8');
    console.log(`  ✅ Saved ${filePath}`);
  } else {
    console.log(`  ⚠️  No automatic fixes applied`);
  }
}

console.log(`\n✨ Fixed ${totalFixed} lines`);

// Re-run type check
console.log('\nRunning final type check...');
try {
  const finalOutput = execSync('npx tsc --noEmit 2>&1 | grep -E "TS1135|TS1005|TS1472|TS1128" | wc -l', { encoding: 'utf-8' });
  const remaining = parseInt(finalOutput.trim(), 10);
  console.log(`Remaining syntax errors: ${remaining}`);
} catch (err) {
  console.log('Type check completed');
}
