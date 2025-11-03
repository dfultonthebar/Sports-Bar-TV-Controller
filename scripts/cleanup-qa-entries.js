#!/usr/bin/env node

/**
 * Script to delete outdated Q&A entries from planning/mockup documentation
 */

const { db, schema } = require('../src/db');
const { inArray } = require('drizzle-orm');

async function cleanupQAEntries() {
  console.log('🧹 Starting Q&A Knowledge Base Cleanup...\n');

  const planningSources = [
    '/home/ubuntu/Sports-Bar-TV-Controller/docs/FEATURE_MANAGER_UI_MOCKUPS.md',
    '/home/ubuntu/Sports-Bar-TV-Controller/docs/MODULAR_HARDWARE_ROADMAP.md',
    '/home/ubuntu/Sports-Bar-TV-Controller/docs/MODULAR_SYSTEM_STATUS.md'
  ];

  try {
    // First, count entries to delete
    const toDelete = await db
      .select()
      .from(schema.qaEntries)
      .where(inArray(schema.qaEntries.sourceFile, planningSources))
      .all();

    console.log(`Found ${toDelete.length} entries to delete from planning documents:\n`);

    planningSources.forEach(source => {
      const count = toDelete.filter(e => e.sourceFile === source).length;
      const filename = source.split('/').pop();
      console.log(`  - ${filename}: ${count} entries`);
    });

    if (toDelete.length === 0) {
      console.log('\n✅ No entries to delete. Knowledge base is clean!');
      return;
    }

    console.log(`\n🗑️  Deleting ${toDelete.length} outdated entries...`);

    // Delete entries
    const result = await db
      .delete(schema.qaEntries)
      .where(inArray(schema.qaEntries.sourceFile, planningSources))
      .run();

    console.log(`\n✅ Successfully deleted ${toDelete.length} outdated Q&A entries!`);

    // Count remaining entries
    const remaining = await db
      .select()
      .from(schema.qaEntries)
      .all();

    console.log(`\n📊 Knowledge Base Stats:`);
    console.log(`   Before: ${toDelete.length + remaining.length} entries`);
    console.log(`   Deleted: ${toDelete.length} entries`);
    console.log(`   After: ${remaining.length} entries`);
    console.log(`\n✨ Knowledge base cleaned successfully!`);

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupQAEntries()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
