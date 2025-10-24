#!/usr/bin/env node

/**
 * Automated Prisma to Drizzle Migration Script V2
 * 
 * This script converts Prisma syntax to Drizzle ORM with db-helpers
 * Run: node migrate-to-drizzle-v2.js
 */

const fs = require('fs');
const path = require('path');

// Common Prisma model names mapped to Drizzle table names
const MODEL_TO_TABLE_MAP = {
  // Core Models
  'fireTVDevice': 'fireTVDevices',
  'schedule': 'schedules',
  'scheduleLog': 'scheduleLogs',
  'homeTeam': 'homeTeams',
  
  // Channel Models
  'channelPreset': 'channelPresets',
  'channelPresetUsage': 'channelPresetUsages',
  
  // Matrix Models
  'matrixConfiguration': 'matrixConfigurations',
  'matrixOutput': 'matrixOutputs',
  'matrixInput': 'matrixInputs',
  
  // Audio Processor Models
  'audioProcessor': 'audioProcessors',
  'zoneControl': 'zoneControls',
  'inputGain': 'inputGains',
  
  // Document Models
  'document': 'documents',
  'chatSession': 'chatSessions',
  'qaEntry': 'qaEntries',
  
  // Device Models
  'globalCacheDevice': 'globalCacheDevices',
  'irDevice': 'irDevices',
  'cecDevice': 'cecDevices',
  
  // API Keys
  'apiKey': 'apiKeys',
  
  // Todo Models
  'todo': 'todos',
  'todoDocument': 'todoDocuments',
  
  // Soundtrack
  'soundtrackConfig': 'soundtrackConfigs',
  'soundtrackPlayer': 'soundtrackPlayers',
  
  // IR and Global Cache
  'irCredential': 'irCredentials',
  'globalCachePort': 'globalCachePorts',
  
  // System
  'systemStatus': 'systemStatuses',
  'testLog': 'testLogs',
  
  // Selected Leagues
  'selectedLeague': 'selectedLeagues',
};

/**
 * Convert model name to table name
 */
function modelToTable(modelName) {
  // Try exact match first
  if (MODEL_TO_TABLE_MAP[modelName]) {
    return MODEL_TO_TABLE_MAP[modelName];
  }
  
  // If model name is already pluralized and in the map values, use it
  if (Object.values(MODEL_TO_TABLE_MAP).includes(modelName)) {
    return modelName;
  }
  
  // Try adding 's' for simple pluralization
  if (MODEL_TO_TABLE_MAP[modelName + 's']) {
    return MODEL_TO_TABLE_MAP[modelName + 's'];
  }
  
  // Default: assume model name is singular, pluralize it
  if (modelName.endsWith('y')) {
    return modelName.slice(0, -1) + 'ies';
  } else if (modelName.endsWith('s')) {
    return modelName + 'es';
  } else {
    return modelName + 's';
  }
}

/**
 * Migrate a single file from Prisma to Drizzle
 */
function migrateFile(filePath) {
  console.log(`\n📝 Migrating: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Step 1: Remove Prisma imports
    const prismaImportPatterns = [
      /import\s+{\s*prisma\s*}\s+from\s+['"]@\/lib\/db['"]\s*\n?/g,
      /import\s+{\s*prisma\s*}\s+from\s+['"]@\/db\/prisma-adapter['"]\s*\n?/g,
      /import\s+prisma\s+from\s+['"]@\/lib\/prisma['"]\s*\n?/g,
    ];
    
    let hadPrismaImport = false;
    for (const pattern of prismaImportPatterns) {
      if (pattern.test(content)) {
        hadPrismaImport = true;
        content = content.replace(pattern, '');
      }
    }
    
    // Step 2: Convert Prisma query patterns
    // Pattern: prisma.modelName.operation({ ... })
    const prismaQueryPattern = /prisma\.(\w+)\.(findMany|findFirst|findUnique|create|createMany|update|updateMany|delete|deleteMany|count|upsert)\(/g;
    
    const conversions = [];
    content = content.replace(prismaQueryPattern, (match, modelName, operation) => {
      const tableName = modelToTable(modelName);
      conversions.push({ from: match, to: `${operation}('${tableName}',`, modelName, operation });
      
      // Map Prisma operations to Drizzle db-helpers operations
      const operationMap = {
        'findMany': 'findMany',
        'findFirst': 'findFirst',
        'findUnique': 'findFirst', // Drizzle uses findFirst for unique queries
        'create': 'create',
        'createMany': 'createMany',
        'update': 'updateOne',
        'updateMany': 'updateMany',
        'delete': 'deleteOne',
        'deleteMany': 'deleteMany',
        'count': 'count',
        'upsert': 'upsert',
      };
      
      const drizzleOp = operationMap[operation] || operation;
      return `${drizzleOp}('${tableName}', `;
    });
    
    // Step 3: Add Drizzle imports if we made conversions
    if (conversions.length > 0 || hadPrismaImport) {
      // Check if db-helpers import already exists
      if (!content.includes("from '@/lib/db-helpers'")) {
        // Find the position to insert imports (after the last import or at the top)
        const lastImportMatch = content.match(/import\s+.*?from\s+['"].*?['"]\s*(\n|$)/g);
        
        if (lastImportMatch && lastImportMatch.length > 0) {
          const lastImport = lastImportMatch[lastImportMatch.length - 1];
          const lastImportIndex = content.lastIndexOf(lastImport);
          const insertPosition = lastImportIndex + lastImport.length;
          
          // Collect all unique operations used
          const operations = new Set();
          conversions.forEach(conv => {
            const operationMap = {
              'findMany': 'findMany',
              'findFirst': 'findFirst',
              'findUnique': 'findFirst',
              'create': 'create',
              'createMany': 'createMany',
              'update': 'updateOne',
              'updateMany': 'updateMany',
              'delete': 'deleteOne',
              'deleteMany': 'deleteMany',
              'count': 'count',
              'upsert': 'upsert',
            };
            operations.add(operationMap[conv.operation] || conv.operation);
          });
          
          const operationsStr = Array.from(operations).join(', ');
          const newImports = `\nimport { ${operationsStr}, eq, and, or, desc, asc } from '@/lib/db-helpers'\nimport { schema } from '@/db'`;
          
          content = content.slice(0, insertPosition) + newImports + content.slice(insertPosition);
        }
      }
      
      // Add migration warning comment for WHERE clauses
      if (content.includes('where:') && !content.includes('DRIZZLE MIGRATION:')) {
        content = `// DRIZZLE MIGRATION: WHERE clauses may need manual conversion to use eq(schema.table.field, value)\n${content}`;
      }
    }
    
    // Check if content changed
    if (content !== originalContent) {
      // Write modified content
      fs.writeFileSync(filePath, content);
      console.log(`✅ Successfully migrated: ${filePath}`);
      console.log(`   - Converted ${conversions.length} Prisma queries`);
      if (conversions.length > 0) {
        conversions.forEach(conv => {
          console.log(`     • prisma.${conv.modelName}.${conv.operation}() → ${conv.to.replace(', ', '')}`);
        });
      }
      return true;
    } else {
      console.log(`⏭️  No changes needed: ${filePath}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error migrating ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting Prisma to Drizzle Migration V2...\n');
  
  // Read the list of files to migrate
  const filesListPath = '/tmp/prisma_files.txt';
  
  if (!fs.existsSync(filesListPath)) {
    console.error('❌ Files list not found at /tmp/prisma_files.txt');
    process.exit(1);
  }
  
  const filesList = fs.readFileSync(filesListPath, 'utf-8')
    .split('\n')
    .filter(line => line.trim() !== '' && !line.includes('prisma-adapter.ts') && !line.includes('/lib/prisma.ts'));
  
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
  
  console.log('\n⚠️  NEXT STEPS:');
  console.log('   1. Review files with "DRIZZLE MIGRATION:" comments');
  console.log('   2. Convert WHERE clauses to use eq(), and(), or(), etc.');
  console.log('   3. Test the application thoroughly');
  console.log('   4. Remove prisma-adapter.ts and lib/prisma.ts\n');
}

// Run the migration
main().catch(console.error);
