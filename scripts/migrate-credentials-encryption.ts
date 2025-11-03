#!/usr/bin/env tsx

/**
 * Migration Script: Upgrade Streaming Credentials Encryption
 *
 * This script migrates streaming credentials from base64 encoding
 * to AES-256-GCM encryption.
 *
 * Usage:
 *   npx tsx scripts/migrate-credentials-encryption.ts
 *
 * Requirements:
 *   - ENCRYPTION_KEY must be set in environment variables
 *   - Backup will be created before migration
 */

import fs from 'fs';
import path from 'path';
import { encryptToString, decryptFromString, generateEncryptionKey } from '../src/lib/security/encryption';

const CREDENTIALS_FILE = path.join(process.cwd(), 'data', 'streaming-credentials.json');
const BACKUP_FILE = path.join(process.cwd(), 'data', 'streaming-credentials.backup.json');

interface StreamingCredential {
  id: string;
  platformId: string;
  username: string;
  passwordHash: string;
  encrypted: boolean;
  encryptionVersion?: string;
  lastUpdated: string;
  status: 'active' | 'expired' | 'error';
  lastSync?: string;
}

/**
 * Decrypt old base64 encoded password
 */
function decryptLegacyPassword(passwordHash: string): string {
  try {
    return Buffer.from(passwordHash, 'base64').toString();
  } catch (error) {
    throw new Error('Failed to decode legacy password');
  }
}

/**
 * Main migration function
 */
async function migrateCredentials() {
  console.log('========================================');
  console.log('Streaming Credentials Encryption Migration');
  console.log('========================================\n');

  // Check if ENCRYPTION_KEY is set
  if (!process.env.ENCRYPTION_KEY) {
    console.error('ERROR: ENCRYPTION_KEY environment variable is not set!');
    console.log('\nTo fix this:');
    console.log('1. Generate a new encryption key:');
    console.log(`   ENCRYPTION_KEY="${generateEncryptionKey()}"`);
    console.log('2. Add it to your .env file');
    console.log('3. Run this script again\n');
    process.exit(1);
  }

  console.log('Encryption key found: ' + ''.padEnd(process.env.ENCRYPTION_KEY.length, '*'));

  // Check if credentials file exists
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    console.log(`\nNo credentials file found at: ${CREDENTIALS_FILE}`);
    console.log('Nothing to migrate. Exiting.');
    process.exit(0);
  }

  // Load existing credentials
  console.log(`\nLoading credentials from: ${CREDENTIALS_FILE}`);
  const credentialsData = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
  const credentials: StreamingCredential[] = JSON.parse(credentialsData);

  console.log(`Found ${credentials.length} credential(s)`);

  // Check if any credentials need migration
  const needsMigration = credentials.filter(
    cred => !cred.encryptionVersion || cred.encryptionVersion !== 'aes-256-gcm'
  );

  if (needsMigration.length === 0) {
    console.log('\nAll credentials are already using AES-256-GCM encryption.');
    console.log('No migration needed. Exiting.');
    process.exit(0);
  }

  console.log(`\n${needsMigration.length} credential(s) need migration`);

  // Create backup
  console.log(`\nCreating backup at: ${BACKUP_FILE}`);
  fs.writeFileSync(BACKUP_FILE, credentialsData);
  console.log('Backup created successfully');

  // Migrate each credential
  console.log('\nMigrating credentials...');
  const migratedCredentials: StreamingCredential[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const cred of credentials) {
    try {
      // Skip if already using new encryption
      if (cred.encryptionVersion === 'aes-256-gcm') {
        console.log(`  ✓ ${cred.platformId} (${cred.username}): Already migrated`);
        migratedCredentials.push(cred);
        continue;
      }

      // Decrypt the old password
      console.log(`  → ${cred.platformId} (${cred.username}): Migrating...`);
      let plainPassword: string;

      if (cred.encrypted && cred.passwordHash) {
        // Legacy base64 encoding
        plainPassword = decryptLegacyPassword(cred.passwordHash);
      } else {
        // Plain text (shouldn't happen)
        plainPassword = cred.passwordHash;
      }

      // Re-encrypt with AES-256-GCM
      const newPasswordHash = encryptToString(plainPassword);

      // Update credential
      const migratedCred: StreamingCredential = {
        ...cred,
        passwordHash: newPasswordHash,
        encrypted: true,
        encryptionVersion: 'aes-256-gcm',
        lastUpdated: new Date().toISOString(),
      };

      // Verify the migration by decrypting
      const verified = decryptFromString(newPasswordHash);
      if (verified !== plainPassword) {
        throw new Error('Verification failed: decrypted password does not match');
      }

      migratedCredentials.push(migratedCred);
      console.log(`  ✓ ${cred.platformId} (${cred.username}): Migrated successfully`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ ${cred.platformId} (${cred.username}): FAILED`);
      console.error(`    Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      errorCount++;

      // Keep the original credential if migration fails
      migratedCredentials.push(cred);
    }
  }

  // Save migrated credentials
  if (successCount > 0) {
    console.log(`\nSaving migrated credentials...`);
    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(migratedCredentials, null, 2)
    );
    console.log('Credentials saved successfully');
  }

  // Summary
  console.log('\n========================================');
  console.log('Migration Summary');
  console.log('========================================');
  console.log(`Total credentials: ${credentials.length}`);
  console.log(`Successfully migrated: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  console.log(`Already migrated: ${credentials.length - needsMigration.length}`);

  if (errorCount > 0) {
    console.log('\n⚠️  Some credentials failed to migrate.');
    console.log(`Backup available at: ${BACKUP_FILE}`);
    process.exit(1);
  } else {
    console.log('\n✓ All credentials migrated successfully!');
    console.log(`Backup available at: ${BACKUP_FILE}`);
    process.exit(0);
  }
}

// Run migration
migrateCredentials().catch(error => {
  console.error('\n❌ Migration failed with error:');
  console.error(error);
  process.exit(1);
});
