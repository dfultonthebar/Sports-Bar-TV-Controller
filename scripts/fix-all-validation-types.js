#!/usr/bin/env node

/**
 * Fix all ValidatedResult type guard issues
 *
 * This script finds patterns like:
 *   const validation = await validateRequestBody(...)
 *   if (!validation.success) return validation.error
 *   const data = validation.data  // ❌ Error
 *
 * And fixes them to:
 *   const validation = await validateRequestBody(...)
 *   if (!validation.success) return validation.error
 *   const { data } = validation  // ✅ Works
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

let totalFiles = 0;
let fixedFiles = 0;
let totalFixes = 0;

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Skip if no validation used
  if (!content.includes('validateRequestBody') &&
      !content.includes('validateQueryParams') &&
      !content.includes('validatePathParams') &&
      !content.includes('validateRequest')) {
    return false;
  }

  totalFiles++;

  let newContent = content;
  let fileModified = false;

  // Pattern 1: const varName = validationVar.data
  // Change to: const { data: varName } = validationVar
  const pattern1 = /^(\s*)const\s+(\w+)\s*=\s*(\w+)\.data\s*$/gm;
  if (pattern1.test(content)) {
    newContent = newContent.replace(pattern1, (match, indent, varName, validationVar) => {
      // Check if there's a type guard before this line
      const beforeMatch = newContent.substring(0, newContent.indexOf(match));
      if (beforeMatch.includes(`if (!${validationVar}.success) return ${validationVar}.error`)) {
        totalFixes++;
        fileModified = true;
        return `${indent}const { data: ${varName} } = ${validationVar}`;
      }
      return match;
    });
  }

  // Pattern 2: const data = validationVar.data
  // Change to: const { data } = validationVar
  const pattern2 = /^(\s*)const\s+data\s*=\s*(\w+)\.data\s*$/gm;
  if (pattern2.test(content)) {
    newContent = newContent.replace(pattern2, (match, indent, validationVar) => {
      const beforeMatch = newContent.substring(0, newContent.indexOf(match));
      if (beforeMatch.includes(`if (!${validationVar}.success) return ${validationVar}.error`)) {
        totalFixes++;
        fileModified = true;
        return `${indent}const { data } = ${validationVar}`;
      }
      return match;
    });
  }

  // Pattern 3: const { ...props } = validationVar.data
  // Change to: const { data } = validationVar\n  const { ...props } = data
  const pattern3 = /^(\s*)const\s+\{([^}]+)\}\s*=\s*(\w+)\.data\s*$/gm;
  const matches3 = [...content.matchAll(pattern3)];
  for (const match of matches3.reverse()) { // Reverse to maintain positions
    const [fullMatch, indent, props, validationVar] = match;
    const beforeMatch = content.substring(0, match.index);
    if (beforeMatch.includes(`if (!${validationVar}.success) return ${validationVar}.error`)) {
      const replacement = `${indent}const { data } = ${validationVar}\n${indent}const {${props}} = data`;
      newContent = newContent.substring(0, match.index) + replacement + newContent.substring(match.index + fullMatch.length);
      totalFixes++;
      fileModified = true;
    }
  }

  if (fileModified) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
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
