#!/usr/bin/env tsx
/**
 * Force Database Creation Script
 * 
 * This script aggressively fixes the database issue where migrations are marked
 * as applied but tables don't actually exist. It:
 * 1. Backs up the existing database
 * 2. Checks if tables exist
 * 3. Forces schema creation using multiple methods
 * 4. Verifies table creation
 * 5. Restarts the server
 * 
 * Run with: npm run force-db-fix
 */

import { execSync } from 'child_process';
import { existsSync, copyFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

const DB_PATH = join(process.cwd(), 'prisma', 'dev.db');
const BACKUP_PATH = join(process.cwd(), 'prisma', 'dev.db.backup');

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m', // Yellow
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}[${type.toUpperCase()}]${reset} ${message}`);
}

function executeCommand(command: string, description: string): boolean {
  try {
    log(`Executing: ${description}`, 'info');
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    log(`✓ ${description} completed`, 'success');
    if (output.trim()) {
      console.log(output);
    }
    return true;
  } catch (error: any) {
    log(`✗ ${description} failed: ${error.message}`, 'error');
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    return false;
  }
}

function checkTablesExist(): string[] {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all() as { name: string }[];
    db.close();
    return tables.map(t => t.name);
  } catch (error: any) {
    log(`Error checking tables: ${error.message}`, 'error');
    return [];
  }
}

function verifyChannelPresetTable(): boolean {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const result = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='ChannelPreset'"
    ).get() as { name: string } | undefined;
    db.close();
    return !!result;
  } catch (error: any) {
    log(`Error verifying ChannelPreset table: ${error.message}`, 'error');
    return false;
  }
}

function manuallyCreateTable(): boolean {
  try {
    log('Attempting manual table creation...', 'warning');
    const db = new Database(DB_PATH);
    
    // Create ChannelPreset table
    db.exec(`
      CREATE TABLE IF NOT EXISTS "ChannelPreset" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "channelNumber" TEXT NOT NULL,
        "deviceType" TEXT NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "usageCount" INTEGER NOT NULL DEFAULT 0,
        "lastUsed" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      );
    `);
    
    // Create indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS "ChannelPreset_deviceType_order_idx" ON "ChannelPreset"("deviceType", "order");
      CREATE INDEX IF NOT EXISTS "ChannelPreset_isActive_idx" ON "ChannelPreset"("isActive");
      CREATE INDEX IF NOT EXISTS "ChannelPreset_usageCount_idx" ON "ChannelPreset"("usageCount");
    `);
    
    db.close();
    log('✓ Manual table creation completed', 'success');
    return true;
  } catch (error: any) {
    log(`✗ Manual table creation failed: ${error.message}`, 'error');
    return false;
  }
}

async function main() {
  log('=== Force Database Creation Script ===', 'info');
  log('This script will aggressively fix the database issue', 'info');
  console.log('');

  // Step 1: Check if database exists
  if (!existsSync(DB_PATH)) {
    log('Database file does not exist. Creating new database...', 'warning');
  } else {
    log(`Database file found at: ${DB_PATH}`, 'info');
    
    // Step 2: Backup existing database
    try {
      copyFileSync(DB_PATH, BACKUP_PATH);
      log(`✓ Database backed up to: ${BACKUP_PATH}`, 'success');
    } catch (error: any) {
      log(`Warning: Could not backup database: ${error.message}`, 'warning');
    }
  }

  // Step 3: Check current tables
  log('Checking existing tables...', 'info');
  const existingTables = checkTablesExist();
  if (existingTables.length === 0) {
    log('⚠ No tables found in database!', 'warning');
  } else {
    log(`Found ${existingTables.length} tables: ${existingTables.join(', ')}`, 'info');
  }

  // Step 4: Check if ChannelPreset exists
  const channelPresetExists = verifyChannelPresetTable();
  if (channelPresetExists) {
    log('✓ ChannelPreset table already exists!', 'success');
    log('Database appears to be in good state.', 'success');
    return;
  }

  log('✗ ChannelPreset table does NOT exist. Proceeding with fixes...', 'error');
  console.log('');

  // Step 5: Try Prisma db push (most aggressive)
  log('=== Method 1: Prisma DB Push (Force) ===', 'info');
  const pushSuccess = executeCommand(
    'npx prisma db push --accept-data-loss --skip-generate',
    'Prisma DB Push'
  );

  if (pushSuccess && verifyChannelPresetTable()) {
    log('✓ ChannelPreset table created successfully via Prisma DB Push!', 'success');
  } else {
    log('⚠ Prisma DB Push did not create the table. Trying migration reset...', 'warning');
    console.log('');

    // Step 6: Try migration reset
    log('=== Method 2: Migration Reset ===', 'info');
    const resetSuccess = executeCommand(
      'npx prisma migrate reset --force --skip-generate --skip-seed',
      'Prisma Migration Reset'
    );

    if (resetSuccess && verifyChannelPresetTable()) {
      log('✓ ChannelPreset table created successfully via Migration Reset!', 'success');
    } else {
      log('⚠ Migration reset did not create the table. Trying manual creation...', 'warning');
      console.log('');

      // Step 7: Manual table creation
      log('=== Method 3: Manual Table Creation ===', 'info');
      const manualSuccess = manuallyCreateTable();

      if (!manualSuccess || !verifyChannelPresetTable()) {
        log('✗ All methods failed to create the ChannelPreset table!', 'error');
        log('Please check the database file permissions and Prisma configuration.', 'error');
        process.exit(1);
      }
    }
  }

  // Step 8: Generate Prisma Client
  log('Generating Prisma Client...', 'info');
  executeCommand('npx prisma generate', 'Prisma Client Generation');

  // Step 9: Final verification
  console.log('');
  log('=== Final Verification ===', 'info');
  const finalTables = checkTablesExist();
  log(`Total tables in database: ${finalTables.length}`, 'info');
  log(`Tables: ${finalTables.join(', ')}`, 'info');

  if (verifyChannelPresetTable()) {
    log('✓✓✓ SUCCESS! ChannelPreset table exists and is ready to use!', 'success');
    
    // Step 10: Restart server (if running)
    log('Attempting to restart server...', 'info');
    try {
      execSync('pkill -f "next dev" || true', { stdio: 'ignore' });
      log('Server process killed (if it was running)', 'info');
      log('Please restart your server with: npm run dev', 'info');
    } catch (error) {
      log('Could not kill server process (it may not be running)', 'warning');
    }
  } else {
    log('✗✗✗ FAILURE! ChannelPreset table still does not exist!', 'error');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
