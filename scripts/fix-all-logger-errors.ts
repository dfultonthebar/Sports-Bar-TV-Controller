#!/usr/bin/env tsx

/**
 * Automated Logger API Fix Script
 *
 * This script fixes all logger API usage pattern errors across the codebase.
 * It handles:
 * - TS2559: Type has no properties in common with type 'LogOptions'
 * - TS2353: Object literal may only specify known properties
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ErrorInfo {
  file: string;
  line: number;
  column: number;
  errorType: 'TS2559' | 'TS2353';
  message: string;
}

interface FixStats {
  totalErrors: number;
  filesProcessed: Set<string>;
  fixesApplied: number;
  failedFixes: number;
}

const stats: FixStats = {
  totalErrors: 0,
  filesProcessed: new Set(),
  fixesApplied: 0,
  failedFixes: 0,
};

/**
 * Parse TypeScript errors from tsc output
 */
function parseTypeScriptErrors(): ErrorInfo[] {
  console.log('Running TypeScript compiler to find logger errors...');

  let tscOutput: string;
  try {
    execSync('npx tsc --noEmit', { encoding: 'utf-8', cwd: process.cwd() });
    return []; // No errors
  } catch (error: any) {
    tscOutput = error.stdout || '';
  }

  const errors: ErrorInfo[] = [];
  const lines = tscOutput.split('\n');

  // Pattern: src/path/to/file.ts(line,col): error TS2559: ...
  const errorPattern = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS2559|TS2353):\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(errorPattern);
    if (match) {
      const [, file, lineNum, colNum, errorType, message] = match;

      // Only process logger-related errors
      if (message.includes('LogOptions') ||
          (errorType === 'TS2353' && (
            message.includes('does not exist in type') ||
            message.includes('AtlasConnectionConfig')
          ))) {
        errors.push({
          file: file.trim(),
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          errorType: errorType as 'TS2559' | 'TS2353',
          message: message.trim(),
        });
      }
    }
  }

  return errors;
}

/**
 * Read a file and get its lines
 */
function readFileLines(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n');
}

/**
 * Write lines back to file
 */
function writeFileLines(filePath: string, lines: string[]): void {
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

/**
 * Fix a logger call on a specific line
 */
function fixLoggerCall(line: string, errorType: 'TS2559' | 'TS2353'): string {
  // Pattern to match logger calls: logger.method(message, secondParam)
  const loggerPattern = /(\s*)(logger\.(debug|info|warn|error|success))\s*\(\s*([^,]+),\s*(.+)\s*\)(\s*)$/;

  const match = line.match(loggerPattern);
  if (!match) {
    return line; // Can't parse, return unchanged
  }

  const [, indent, loggerCall, method, messageArg, secondArg, trailing] = match;

  // Clean up the second argument
  let cleanSecondArg = secondArg.trim();

  // Remove trailing parenthesis that's part of the function call
  if (cleanSecondArg.endsWith(')')) {
    cleanSecondArg = cleanSecondArg.slice(0, -1).trim();
  }

  // Determine the fix based on what the second argument looks like
  let fixedSecondArg: string;

  // Case 1: Already has 'error' property (just needs wrapping)
  if (cleanSecondArg.match(/^\s*error\s*$/i) || cleanSecondArg.match(/^\w+Error$/)) {
    fixedSecondArg = `{ error: ${cleanSecondArg} }`;
  }
  // Case 2: Primitive type (string, number, boolean) or variable
  else if (
    cleanSecondArg.startsWith("'") ||
    cleanSecondArg.startsWith('"') ||
    cleanSecondArg.startsWith('`') ||
    /^\d+$/.test(cleanSecondArg) ||
    /^(true|false)$/.test(cleanSecondArg) ||
    /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(cleanSecondArg)
  ) {
    fixedSecondArg = `{ data: ${cleanSecondArg} }`;
  }
  // Case 3: Already an object literal
  else if (cleanSecondArg.startsWith('{')) {
    // Check if it has valid LogOptions properties
    const validProps = ['category', 'level', 'data', 'error', 'timestamp'];

    // Simple heuristic: if it has unknown properties, wrap in data
    let needsDataWrap = false;

    // Extract property names (simplified - won't handle all edge cases)
    const propMatches = cleanSecondArg.matchAll(/(\w+):/g);
    for (const propMatch of propMatches) {
      const propName = propMatch[1];
      if (!validProps.includes(propName)) {
        needsDataWrap = true;
        break;
      }
    }

    if (needsDataWrap) {
      fixedSecondArg = `{ data: ${cleanSecondArg} }`;
    } else {
      fixedSecondArg = cleanSecondArg;
    }
  }
  // Case 4: Array or other expression
  else if (cleanSecondArg.startsWith('[')) {
    fixedSecondArg = `{ data: ${cleanSecondArg} }`;
  }
  // Case 5: Default - wrap in data
  else {
    fixedSecondArg = `{ data: ${cleanSecondArg} }`;
  }

  // Reconstruct the line
  return `${indent}${loggerCall}(${messageArg}, ${fixedSecondArg})${trailing}`;
}

/**
 * Fix errors in a single file
 */
function fixFileErrors(errors: ErrorInfo[]): boolean {
  const filePath = errors[0].file;

  try {
    console.log(`\n  Processing: ${filePath} (${errors.length} errors)`);

    const lines = readFileLines(filePath);
    let modified = false;

    // Sort errors by line number in reverse order to avoid line number shifts
    const sortedErrors = [...errors].sort((a, b) => b.line - a.line);

    for (const error of sortedErrors) {
      const lineIndex = error.line - 1; // Convert to 0-based index

      if (lineIndex < 0 || lineIndex >= lines.length) {
        console.log(`    ⚠ Line ${error.line} out of range, skipping`);
        stats.failedFixes++;
        continue;
      }

      const originalLine = lines[lineIndex];
      const fixedLine = fixLoggerCall(originalLine, error.errorType);

      if (fixedLine !== originalLine) {
        lines[lineIndex] = fixedLine;
        modified = true;
        stats.fixesApplied++;
        console.log(`    ✓ Fixed line ${error.line}`);
      } else {
        console.log(`    ⚠ Could not auto-fix line ${error.line}`);
        stats.failedFixes++;
      }
    }

    if (modified) {
      writeFileLines(filePath, lines);
      console.log(`  ✅ Saved ${filePath}`);
      return true;
    }

    return false;
  } catch (err) {
    console.error(`  ❌ Error processing ${filePath}:`, err);
    stats.failedFixes += errors.length;
    return false;
  }
}

/**
 * Group errors by file
 */
function groupErrorsByFile(errors: ErrorInfo[]): Map<string, ErrorInfo[]> {
  const grouped = new Map<string, ErrorInfo[]>();

  for (const error of errors) {
    const existing = grouped.get(error.file) || [];
    existing.push(error);
    grouped.set(error.file, existing);
  }

  return grouped;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Logger API Fix Script');
  console.log('========================\n');

  // Step 1: Parse errors
  const errors = parseTypeScriptErrors();
  stats.totalErrors = errors.length;

  if (errors.length === 0) {
    console.log('✨ No logger-related TypeScript errors found!');
    return;
  }

  console.log(`Found ${errors.length} logger-related errors\n`);

  // Step 2: Group by file
  const errorsByFile = groupErrorsByFile(errors);
  console.log(`Errors span ${errorsByFile.size} files\n`);

  // Step 3: Fix each file
  console.log('Fixing files...');

  for (const [file, fileErrors] of errorsByFile) {
    stats.filesProcessed.add(file);
    fixFileErrors(fileErrors);
  }

  // Step 4: Re-run type check
  console.log('\n\n📊 Running final type check...');

  let finalErrors = 0;
  try {
    execSync('npx tsc --noEmit 2>&1 | grep -E "(TS2559|TS2353)" | wc -l', {
      encoding: 'utf-8',
      cwd: process.cwd(),
      stdio: 'pipe'
    });
  } catch (error: any) {
    const output = error.stdout || '0';
    finalErrors = parseInt(output.trim(), 10) || 0;
  }

  // Step 5: Print summary
  console.log('\n\n📈 SUMMARY');
  console.log('===========');
  console.log(`Initial errors:     ${stats.totalErrors}`);
  console.log(`Files processed:    ${stats.filesProcessed.size}`);
  console.log(`Fixes applied:      ${stats.fixesApplied}`);
  console.log(`Failed fixes:       ${stats.failedFixes}`);
  console.log(`Remaining errors:   ${finalErrors}`);
  console.log(`Errors resolved:    ${stats.totalErrors - finalErrors}`);

  const successRate = ((stats.fixesApplied / stats.totalErrors) * 100).toFixed(1);
  console.log(`Success rate:       ${successRate}%`);

  if (finalErrors === 0) {
    console.log('\n✨ All logger errors have been resolved!');
  } else if (finalErrors < stats.totalErrors) {
    console.log(`\n✅ Made significant progress! ${stats.totalErrors - finalErrors} errors resolved.`);
    console.log('   Remaining errors may require manual intervention.');
  } else {
    console.log('\n⚠️  No progress made. Manual review required.');
  }
}

main().catch(console.error);
