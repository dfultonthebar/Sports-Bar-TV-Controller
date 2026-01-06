#!/usr/bin/env tsx

/**
 * Automated Logger API Fix Script v2
 *
 * Improved version that handles edge cases and multi-line calls
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

interface ErrorInfo {
  file: string;
  line: number;
  column: number;
  errorType: 'TS2559' | 'TS2353' | 'TS1005' | 'TS1135' | 'TS1472' | 'TS1128';
  message: string;
}

/**
 * Parse TypeScript errors from tsc output
 */
function parseTypeScriptErrors(): ErrorInfo[] {
  let tscOutput: string;
  try {
    execSync('npx tsc --noEmit', { encoding: 'utf-8', cwd: process.cwd() });
    return [];
  } catch (error: any) {
    tscOutput = error.stdout || '';
  }

  const errors: ErrorInfo[] = [];
  const lines = tscOutput.split('\n');
  const errorPattern = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(errorPattern);
    if (match) {
      const [, file, lineNum, colNum, errorType, message] = match;
      errors.push({
        file: file.trim(),
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
        errorType: errorType as any,
        message: message.trim(),
      });
    }
  }

  return errors;
}

/**
 * Fix syntax errors caused by incomplete logger call fixes
 */
function fixSyntaxErrors(filePath: string, lines: string[], errors: ErrorInfo[]): boolean {
  let modified = false;

  for (const error of errors.sort((a, b) => b.line - a.line)) {
    const lineIdx = error.line - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) continue;

    const line = lines[lineIdx];

    // TS1005: Missing comma - likely a closing paren was eaten
    if (error.errorType === 'TS1005' && error.message.includes("',' expected")) {
      // Check if line ends with { data: ... } without closing paren
      if (line.includes('{ data:') && !line.trim().endsWith(')')) {
        lines[lineIdx] = line + ')';
        modified = true;
        console.log(`    ✓ Fixed missing closing paren on line ${error.line}`);
      }
    }

    // TS1135: Argument expression expected - incomplete data wrapping
    if (error.errorType === 'TS1135' && error.message.includes('Argument expression expected')) {
      // Pattern: logger.method('message', { data:  <- missing closing }
      const match = line.match(/^(\s*logger\.\w+\([^,]+,\s*{\s*data:\s*)$/);
      if (match) {
        // Look at the next line to see what should have been wrapped
        if (lineIdx + 1 < lines.length) {
          const nextLine = lines[lineIdx + 1].trim();
          // If next line is just a closing brace or paren, we have an issue
          if (nextLine === '}' || nextLine === '})') {
            lines[lineIdx] = line + 'undefined })';
            lines.splice(lineIdx + 1, 1); // Remove the orphaned line
            modified = true;
            console.log(`    ✓ Fixed incomplete data wrap on line ${error.line}`);
          }
        }
      }
    }

    // TS1472: catch or finally expected - broken try/catch
    if (error.errorType === 'TS1472') {
      // This suggests we broke a try/catch block - look for the issue
      // Usually this means we have an unclosed brace somewhere above
      for (let i = lineIdx - 1; i >= Math.max(0, lineIdx - 10); i--) {
        if (lines[i].includes('logger.') && lines[i].includes('{ data:')) {
          const openBraces = (lines[i].match(/{/g) || []).length;
          const closeBraces = (lines[i].match(/}/g) || []).length;
          if (openBraces > closeBraces) {
            lines[i] = lines[i].replace(/\s*$/, ' })');
            modified = true;
            console.log(`    ✓ Fixed unclosed logger call on line ${i + 1}`);
            break;
          }
        }
      }
    }
  }

  return modified;
}

/**
 * Fix a specific file
 */
function fixFile(filePath: string, fileErrors: ErrorInfo[]): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const modified = fixSyntaxErrors(filePath, lines, fileErrors);

    if (modified) {
      fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
      return true;
    }

    return false;
  } catch (err) {
    console.error(`  ❌ Error fixing ${filePath}:`, err);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Logger Error Fix Script v2 - Syntax Repair');
  console.log('===============================================\n');

  const errors = parseTypeScriptErrors();

  // Filter for syntax errors only
  const syntaxErrors = errors.filter(e =>
    ['TS1005', 'TS1135', 'TS1472', 'TS1128'].includes(e.errorType)
  );

  if (syntaxErrors.length === 0) {
    console.log('✨ No syntax errors found!');
    return;
  }

  console.log(`Found ${syntaxErrors.length} syntax errors to fix\n`);

  // Group by file
  const errorsByFile = new Map<string, ErrorInfo[]>();
  for (const error of syntaxErrors) {
    const existing = errorsByFile.get(error.file) || [];
    existing.push(error);
    errorsByFile.set(error.file, existing);
  }

  console.log(`Fixing ${errorsByFile.size} files...\n`);

  let filesFixed = 0;
  for (const [file, fileErrors] of errorsByFile) {
    console.log(`  Processing: ${file} (${fileErrors.length} errors)`);
    if (fixFile(file, fileErrors)) {
      filesFixed++;
      console.log(`  ✅ Saved ${file}`);
    }
  }

  // Re-run type check
  console.log('\n\n📊 Running final type check...');
  const finalErrors = parseTypeScriptErrors();
  const finalSyntaxErrors = finalErrors.filter(e =>
    ['TS1005', 'TS1135', 'TS1472', 'TS1128'].includes(e.errorType)
  );

  console.log('\n📈 SUMMARY');
  console.log('===========');
  console.log(`Initial syntax errors: ${syntaxErrors.length}`);
  console.log(`Files fixed:           ${filesFixed}`);
  console.log(`Remaining errors:      ${finalSyntaxErrors.length}`);
  console.log(`Errors resolved:       ${syntaxErrors.length - finalSyntaxErrors.length}`);

  if (finalSyntaxErrors.length === 0) {
    console.log('\n✨ All syntax errors have been resolved!');
  } else {
    console.log('\n⚠️  Some errors remain and may need manual fixing');
  }
}

main().catch(console.error);
