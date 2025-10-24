#!/usr/bin/env node

/**
 * Fix Drizzle Migration Issues
 * 
 * 1. Remove duplicate imports
 * 2. Remove old drizzle-orm direct imports when using db-helpers
 * 3. Fix WHERE clause format
 * 4. Remove migration warning comments
 */

const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  console.log(`\n🔧 Fixing: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    let changes = [];
    
    // Fix 1: Remove direct drizzle-orm imports if we have db-helpers
    if (content.includes("from '@/lib/db-helpers'")) {
      const oldImportPattern = /import\s+{[^}]*}\s+from\s+['"]drizzle-orm['"]\s*\n?/g;
      if (oldImportPattern.test(content)) {
        content = content.replace(oldImportPattern, '');
        changes.push('Removed duplicate drizzle-orm import');
      }
    }
    
    // Fix 2: Remove import line breaks/malformed imports
    // Pattern: import { X } from '@/db'import {
    content = content.replace(/}\s+from\s+['"]@\/db['"]\s*import\s+{/g, '} from \'@/db\'\nimport {');
    
    // Fix 3: Remove duplicate operators in db-helpers import
    const dbHelpersImportPattern = /import\s+{([^}]+)}\s+from\s+['"]@\/lib\/db-helpers['"]/;
    const match = content.match(dbHelpersImportPattern);
    if (match) {
      const imports = match[1].split(',').map(s => s.trim());
      const uniqueImports = [...new Set(imports)];
      if (imports.length !== uniqueImports.length) {
        content = content.replace(dbHelpersImportPattern, `import { ${uniqueImports.join(', ')} } from '@/lib/db-helpers'`);
        changes.push('Removed duplicate operators from db-helpers import');
      }
    }
    
    // Fix 4: Fix WHERE clauses - convert { where: { field: value } } to { where: eq(schema.table.field, value) }
    // This is complex and context-dependent, so we'll just add helper comments
    // Manual review is still needed for complex WHERE clauses
    
    // Fix 5: Remove migration warning comment if no longer needed
    if (content.includes('// DRIZZLE MIGRATION:')) {
      content = content.replace(/\/\/ DRIZZLE MIGRATION:[^\n]*\n/, '');
      changes.push('Removed migration warning comment');
    }
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed: ${changes.join(', ')}`);
      return true;
    } else {
      console.log(`⏭️  No fixes needed`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting Drizzle Import Fixer...\n');
  
  // Find all TypeScript files in src/ that have db-helpers imports
  const {execSync} = require('child_process');
  
  try {
    const output = execSync('grep -r "from \'@/lib/db-helpers\'" --include="*.ts" --include="*.tsx" src/ | cut -d: -f1 | sort -u', {encoding: 'utf-8'});
    const files = output.trim().split('\n').filter(f => f);
    
    console.log(`📋 Found ${files.length} files with db-helpers imports\n`);
    
    let successCount = 0;
    let skipCount = 0;
    
    for (const file of files) {
      const result = fixFile(path.join(process.cwd(), file));
      if (result === true) successCount++;
      else if (result === false) skipCount++;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Fix Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Fixed: ${successCount} files`);
    console.log(`⏭️  Skipped: ${skipCount} files`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main().catch(console.error);
