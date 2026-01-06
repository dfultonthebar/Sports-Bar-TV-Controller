#!/usr/bin/env tsx
/**
 * Memory Bank CLI
 * Command-line interface for memory bank operations
 */

import { getMemoryBank } from '../src/lib/memory-bank';
import { logger } from '../src/lib/logger';

const command = process.argv[2];
const arg = process.argv[3];

async function main() {
  const memoryBank = getMemoryBank();

  switch (command) {
    case 'snapshot':
      await createSnapshot(memoryBank);
      break;

    case 'restore':
      await restoreContext(memoryBank, arg);
      break;

    case 'watch':
      await startWatching(memoryBank);
      break;

    case 'stop':
      await stopWatching(memoryBank);
      break;

    case 'list':
      await listSnapshots(memoryBank);
      break;

    case 'stats':
      await showStats(memoryBank);
      break;

    default:
      showHelp();
      process.exit(1);
  }
}

async function createSnapshot(memoryBank: any) {
  console.log('📸 Creating memory bank snapshot...');
  try {
    const snapshot = await memoryBank.createSnapshot();
    console.log('\n✅ Snapshot created successfully!');
    console.log(`   ID: ${snapshot.id}`);
    console.log(`   Branch: ${snapshot.branch}`);
    console.log(`   Commit: ${snapshot.commitHash}`);
    console.log(`   Size: ${(snapshot.size / 1024).toFixed(1)} KB`);
    console.log(`   File: memory-bank/${snapshot.filename}`);
  } catch (error) {
    console.error('\n❌ Failed to create snapshot:', error);
    process.exit(1);
  }
}

async function restoreContext(memoryBank: any, snapshotId?: string) {
  console.log('🔄 Restoring context...');
  try {
    const snapshot = snapshotId
      ? await memoryBank.getSnapshot(snapshotId)
      : await memoryBank.getLatestSnapshot();

    if (!snapshot) {
      console.error('\n❌ No snapshots found');
      process.exit(1);
    }

    console.log('\n' + snapshot);
  } catch (error) {
    console.error('\n❌ Failed to restore context:', error);
    process.exit(1);
  }
}

async function startWatching(memoryBank: any) {
  console.log('👁️  Starting file watcher...');
  try {
    await memoryBank.startWatching();
    console.log('\n✅ File watcher started successfully!');
    console.log('   Watching for changes in key project files...');
    console.log('   Auto-snapshot will be created on significant changes.');
    console.log('\n   Press Ctrl+C to stop watching.\n');

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\n\n⏹️  Stopping file watcher...');
      await memoryBank.stopWatching();
      console.log('✅ File watcher stopped.');
      process.exit(0);
    });

    // Keep alive
    await new Promise(() => {});
  } catch (error) {
    console.error('\n❌ Failed to start file watcher:', error);
    process.exit(1);
  }
}

async function stopWatching(memoryBank: any) {
  console.log('⏹️  Stopping file watcher...');
  try {
    await memoryBank.stopWatching();
    console.log('\n✅ File watcher stopped.');
  } catch (error) {
    console.error('\n❌ Failed to stop file watcher:', error);
    process.exit(1);
  }
}

async function listSnapshots(memoryBank: any) {
  console.log('📋 Listing all snapshots...\n');
  try {
    const snapshots = await memoryBank.listSnapshots();

    if (snapshots.length === 0) {
      console.log('No snapshots found.');
      return;
    }

    console.log(`Found ${snapshots.length} snapshot(s):\n`);
    console.log('┌─────────────────────────┬──────────────────────┬────────────┬──────────┬─────────┐');
    console.log('│ Timestamp               │ ID                   │ Branch     │ Commit   │ Size    │');
    console.log('├─────────────────────────┼──────────────────────┼────────────┼──────────┼─────────┤');

    for (const snapshot of snapshots) {
      const timestamp = snapshot.timestamp.toLocaleString().padEnd(23);
      const id = snapshot.id.padEnd(20);
      const branch = snapshot.branch.substring(0, 10).padEnd(10);
      const commit = snapshot.commitHash.padEnd(8);
      const size = `${(snapshot.size / 1024).toFixed(1)} KB`.padEnd(7);

      console.log(`│ ${timestamp} │ ${id} │ ${branch} │ ${commit} │ ${size} │`);
    }

    console.log('└─────────────────────────┴──────────────────────┴────────────┴──────────┴─────────┘');
    console.log(`\nTo restore a snapshot, run: npm run memory:restore <id>`);
  } catch (error) {
    console.error('\n❌ Failed to list snapshots:', error);
    process.exit(1);
  }
}

async function showStats(memoryBank: any) {
  console.log('📊 Memory Bank Statistics\n');
  try {
    const stats = await memoryBank.getStats();

    console.log(`Total Snapshots: ${stats.totalSnapshots}`);
    console.log(`Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Storage Dir: ${stats.storageDir}`);
    console.log(`Watching: ${stats.isWatching ? '✅ Yes' : '❌ No'}`);

    if (stats.totalSnapshots > 0) {
      const avgSize = stats.totalSize / stats.totalSnapshots / 1024;
      console.log(`Average Size: ${avgSize.toFixed(1)} KB`);
    }
  } catch (error) {
    console.error('\n❌ Failed to get stats:', error);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Memory Bank CLI - Project Context Tracking System

Usage:
  npm run memory:snapshot              Create a new snapshot
  npm run memory:restore [id]          Restore context (latest or by ID)
  npm run memory:watch                 Start file watcher
  npm run memory:stop                  Stop file watcher
  npm run memory:list                  List all snapshots
  npm run memory:stats                 Show storage statistics

Examples:
  npm run memory:snapshot              # Create snapshot now
  npm run memory:restore               # Show latest context
  npm run memory:restore 2025-11-04    # Restore specific snapshot
  npm run memory:watch                 # Start auto-snapshot on changes
  npm run memory:list                  # See all snapshots

API Endpoints:
  GET  /api/memory-bank/current        Get latest snapshot
  GET  /api/memory-bank/history        List all snapshots
  GET  /api/memory-bank/restore/:id    Get specific snapshot
  POST /api/memory-bank/snapshot       Create manual snapshot
  POST /api/memory-bank/start-watching Start file watcher
  POST /api/memory-bank/stop-watching  Stop file watcher
  `);
}

// Run CLI
main().catch((error) => {
  logger.error('Memory Bank CLI error:', { error });
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
