#!/usr/bin/env node

/**
 * Automated Prisma to Drizzle Migration Script
 * 
 * This script converts Prisma syntax to Drizzle ORM with db-helpers
 * Run: node migrate-to-drizzle.js
 */

const fs = require('fs');
const path = require('path');

// Common Prisma model names mapped to Drizzle table names
const MODEL_TO_TABLE_MAP = {
  // Core Models
  'fireTVDevice': 'fireTVDevices',
  'fireTVDevices': 'fireTVDevices',
  'schedule': 'schedules',
  'schedules': 'schedules',
  'scheduleLog': 'scheduleLogs',
  'scheduleLogs': 'scheduleLogs',
  'homeTeam': 'homeTeams',
  'homeTeams': 'homeTeams',
  
  // Channel Models
  'channelPreset': 'channelPresets',
  'channelPresets': 'channelPresets',
  'channelPresetUsage': 'channelPresetUsages',
  'channelPresetUsages': 'channelPresetUsages',
  
  // Matrix Models
  'matrixConfiguration': 'matrixConfigurations',
  'matrixConfigurations': 'matrixConfigurations',
  'matrixOutput': 'matrixOutputs',
  'matrixOutputs': 'matrixOutputs',
  'matrixInput': 'matrixInputs',
  'matrixInputs': 'matrixInputs',
  
  // Audio Processor Models
  'audioProcessor': 'audioProcessors',
  'audioProcessors': 'audioProcessors',
  'zoneControl': 'zoneControls',
  'zoneControls': 'zoneControls',
  'inputGain': 'inputGains',
  'inputGains': 'inputGains',
  
  // Document Models
  'document': 'documents',
  'documents': 'documents',
  'chatSession': 'chatSessions',
  'chatSessions': 'chatSessions',
  'qaEntry': 'qaEntries',
  'qaEntries': 'qaEntries',
  
  // Device Models
  'globalCacheDevice': 'globalCacheDevices',
  'globalCacheDevices': 'globalCacheDevices',
  'irDevice': 'irDevices',
  'irDevices': 'irDevices',
  'cecDevice': 'cecDevices',
  'cecDevices': 'cecDevices',
  
  // API Keys
  'apiKey': 'apiKeys',
  'apiKeys': 'apiKeys',
  
  // Todo Models
  'todo': 'todos',
  'todos': 'todos',
  'todoDocument': 'todoDocuments',
  'todoDocuments': 'todoDocuments',
};

// Prisma query operations and their Drizzle equivalents
const OPERATION_PATTERNS = {
  // findMany, findFirst, findUnique
  findMany: (modelName) => {
    const tableName = MODEL_TO_TABLE_MAP[modelName] || modelName;
    return `findMany('${tableName}'`;
  },
  findFirst: (modelName) => {
    const tableName = MODEL_TO_TABLE_MAP[modelName] || modelName;
    return `findFirst('${tableName}'`;
  },
  findUnique: (modelName) => {
    const tableName = MODEL_TO_TABLE_MAP[modelName] || modelName;
    return `findFirst('${tableName}'`;
  },
  
  // create, createMany
  create: (modelName) => {
    const tableName = MODEL_TO_TABLE_MAP[modelName] || modelName;
    return `create('${tableName}'`;
  },
  createMany: (modelName) => {
    const tableName = MODEL_TO_TABLE_MAP[modelName] || modelName;
    return `createMany('${tableName}'`;
  },
  
  // update, updateMany
  update: (modelName) => {
    const tableName = MODEL_TO_TABLE_MAP[modelName] || modelName;
    return `updateOne('${tableName}'`;
  },
  updateMany: (modelName) => {
    const tableName = MODEL_TO_TABLE_MAP[modelName] || modelName;
    return `updateMany('${tableName}'`;
  },
  
  // delete, deleteMany
  delete: (modelName) => {
    const tableName = MODEL_TO_TABLE_MAP[modelName] || modelName;
    return `deleteOne('${tableName}'`;
  },
  deleteMany: (modelName) => {
    const tableName = MODEL_TO_TABLE_MAP[modelName] || modelName;
    return `deleteMany('${tableName}'`;
  },
  
  // count
  count: (modelName) => {
    const tableName = MODEL_TO_TABLE_MAP[modelName] || modelName;
    return `count('${tableName}'`;
  },
  
  // upsert
  upsert: (modelName) => {
    const tableName = MODEL_TO_TABLE_MAP[modelName] || modelName;
    return `upsert('${tableName}'`;
  },
};

/**
 * Migrate a single file from Prisma to Drizzle
 */
function migrateFile(filePath) {
  console.log(`\n📝 Migrating: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // Step 1: Update imports
    // Remove Prisma imports
    if (content.includes("import { prisma } from '@/lib/db'")) {
      content = content.replace(/import\s+{\s*prisma\s*}\s+from\s+['"]@\/lib\/db['"]/g, '');
      modified = true;
    }
    
    if (content.includes("import { prisma } from '@/db/prisma-adapter'")) {
      content = content.replace(/import\s+{\s*prisma\s*}\s+from\s+['"]@\/db\/prisma-adapter['"]/g, '');
      modified = true;
    }
    
    if (content.includes("import prisma from '@/lib/prisma'")) {
      content = content.replace(/import\s+prisma\s+from\s+['"]@\/lib\/prisma['"]/g, '');
      modified = true;
    }
    
    // Add Drizzle imports if Prisma was used
    if (modified) {
      // Check if db-helpers import already exists
      if (!content.includes("from '@/lib/db-helpers'")) {
        // Find the last import statement
        const importMatches = content.match(/import\s+.*?from\s+['"].*?['"]/g);
        if (importMatches && importMatches.length > 0) {
          const lastImport = importMatches[importMatches.length - 1];
          const lastImportIndex = content.lastIndexOf(lastImport);
          const insertPosition = lastImportIndex + lastImport.length;
          
          const newImports = `\nimport { findMany, findFirst, create, createMany, updateOne, updateMany, deleteOne, deleteMany, count, upsert, eq, and, or, desc, asc } from '@/lib/db-helpers'\nimport { schema } from '@/db'`;
          
          content = content.slice(0, insertPosition) + newImports + content.slice(insertPosition);
        }
      }
    }
    
    // Step 2: Convert Prisma queries to Drizzle
    // Pattern: prisma.modelName.operation(...)
    const prismaQueryRegex = /prisma\.(\w+)\.(findMany|findFirst|findUnique|create|createMany|update|updateMany|delete|deleteMany|count|upsert)\s*\(/g;
    
    content = content.replace(prismaQueryRegex, (match, modelName, operation) => {
      modified = true;
      const conversionFn = OPERATION_PATTERNS[operation];
      if (conversionFn) {
        return `${conversionFn(modelName)}(`;
      }
      return match; // If no conversion found, keep original
    });
    
    // Step 3: Convert where clauses
    // Convert { where: { field: value } } to { where: eq(schema.table.field, value) }
    // This is complex and may require manual review, so we'll add a comment
    if (modified && content.includes('where:')) {
      // Add a comment at the top of the file
      const firstLine = content.split('\n')[0];
      if (!firstLine.includes('MIGRATION WARNING')) {
        content = `// MIGRATION WARNING: Please review WHERE clauses - they may need manual conversion to Drizzle operators (eq, and, or, etc.)\n${content}`;
      }
    }
    
    // Step 4: Convert data property to use proper format
    // In Drizzle with db-helpers, we use { data: {...} } similar to Prisma
    // But we need to make sure the syntax is compatible
    
    // Step 5: Write the modified file
    if (modified) {
      // Create backup
      const backupPath = filePath + '.prisma-backup';
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, fs.readFileSync(filePath));
      }
      
      // Write modified content
      fs.writeFileSync(filePath, content);
      console.log(`✅ Successfully migrated: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  No Prisma usage found in: ${filePath}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error migrating ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting Prisma to Drizzle Migration...\n');
  
  // Read the list of files to migrate
  const filesListPath = '/tmp/prisma_files.txt';
  
  if (!fs.existsSync(filesListPath)) {
    console.error('❌ Files list not found at /tmp/prisma_files.txt');
    console.log('Run this command first:');
    console.log('grep -r "prisma\\." --include="*.ts" --include="*.tsx" src/ | cut -d: -f1 | sort -u > /tmp/prisma_files.txt');
    process.exit(1);
  }
  
  const filesList = fs.readFileSync(filesListPath, 'utf-8')
    .split('\n')
    .filter(line => line.trim() !== '');
  
  console.log(`📋 Found ${filesList.length} files to migrate\n`);
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (const file of filesList) {
    const fullPath = path.join(process.cwd(), file);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  File not found: ${fullPath}`);
      skipCount++;
      continue;
    }
    
    const result = migrateFile(fullPath);
    if (result === true) {
      successCount++;
    } else if (result === false) {
      skipCount++;
    } else {
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Successfully migrated: ${successCount} files`);
  console.log(`⏭️  Skipped (no changes): ${skipCount} files`);
  console.log(`❌ Errors: ${errorCount} files`);
  console.log('='.repeat(60));
  
  console.log('\n⚠️  IMPORTANT: Please review the migrated files manually!');
  console.log('   - WHERE clauses may need manual conversion to use eq(), and(), or(), etc.');
  console.log('   - Complex queries may need additional adjustments');
  console.log('   - Test your application thoroughly after migration');
  console.log('\n🔍 Files with MIGRATION WARNING comments need special attention\n');
}

// Run the migration
main().catch(console.error);
