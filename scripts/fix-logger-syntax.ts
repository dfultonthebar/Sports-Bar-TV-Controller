#!/usr/bin/env tsx

/**
 * Fix syntax errors from logger fixes
 * Specifically handles missing closing parentheses
 */

import * as fs from 'fs';

const filesToFix = [
  'src/app/api/channel-guide/route.ts',
  'src/app/api/chat/route.ts',
  'src/app/api/globalcache/learn/route.ts',
  'src/app/api/ir/commands/[id]/route.ts',
  'src/app/api/ir/commands/route.ts',
  'src/app/api/ir/commands/send/route.ts',
  'src/app/api/ir/credentials/route.ts',
  'src/app/api/ir/database/brands/route.ts',
  'src/app/api/ir/database/download/route.ts',
  'src/app/api/ir/database/functions/route.ts',
  'src/app/api/ir/database/models/route.ts',
  'src/app/api/ir/database/types/route.ts',
  'src/app/api/ir/devices/[id]/commands/route.ts',
  'src/app/api/ir/devices/[id]/route.ts',
  'src/app/api/ir/devices/route.ts',
  'src/app/api/ir-devices/send-command/route.ts',
  'src/app/api/ir/learn/route.ts',
  'src/app/api/sports-guide/route.ts',
  'src/app/api/system/health/route.ts',
  'src/app/api/tests/wolfpack/connection/route.ts',
  'src/app/api/tests/wolfpack/switching/route.ts',
  'src/components/ir/IRDeviceSetup.tsx',
  'src/lib/database-logger.ts',
  'src/lib/db-audit-logger.ts',
  'src/lib/directv-logger.ts',
  'src/lib/services/ir-database.ts',
  'src/lib/soundtrack-your-brand.ts',
  'src/services/firetv-health-monitor.ts',
];

function fixFile(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let fixes = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern 1: logger.method('...', { data: ... } without closing )
    // Matches lines like: logger.info('...', { data: ... }
    // That should be: logger.info('...', { data: ... })
    if (line.match(/logger\.(debug|info|warn|error|success)\([^)]+,\s*{\s*data:/)) {
      // Count parentheses
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;

      if (openParens > closeParens) {
        // Check if it ends with just }
        if (line.trim().endsWith('}')) {
          lines[i] = line + ')';
          fixes++;
          console.log(`  Fixed line ${i + 1}: Added closing )`);
        }
      }
    }

    // Pattern 2: Lines ending with { data: but nothing after
    // These are incomplete and need to be fixed more carefully
    if (line.match(/{\s*data:\s*$/)) {
      // This is an incomplete line - the original value was lost
      // Check the next line for clues
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        // If next line is just }, we have a broken statement
        if (nextLine === '}' || nextLine === '})') {
          // Replace with a safe default
          lines[i] = line.replace(/{\s*data:\s*$/, '{ data: {} })');
          // Remove the orphaned closing brace
          lines.splice(i + 1, 1);
          fixes++;
          console.log(`  Fixed line ${i + 1}: Completed incomplete data wrap`);
        }
      }
    }
  }

  if (fixes > 0) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  return fixes;
}

console.log('🔧 Fixing Logger Syntax Errors');
console.log('===============================\n');

let totalFixes = 0;

for (const file of filesToFix) {
  console.log(`Processing: ${file}`);
  try {
    const fixes = fixFile(file);
    totalFixes += fixes;
    if (fixes > 0) {
      console.log(`  ✅ Applied ${fixes} fixes`);
    } else {
      console.log(`  ℹ️  No fixes needed`);
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err}`);
  }
}

console.log(`\n✨ Total fixes applied: ${totalFixes}`);
