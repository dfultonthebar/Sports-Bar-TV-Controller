#!/usr/bin/env tsx

/**
 * Script to delete Q&A entries from planning folder
 */

import { db } from '../src/db'
import { like } from 'drizzle-orm'
import { schema } from '../src/db'

async function cleanupPlanningQA() {
  console.log('🧹 Cleaning up Q&A entries from planning folder...\n')

  try {
    // Find entries from planning folder
    const toDelete = await db
      .select()
      .from(schema.qaEntries)
      .where(like(schema.qaEntries.sourceFile, '%/planning/%'))
      .all()

    console.log(`Found ${toDelete.length} entries from planning folder\n`)

    if (toDelete.length === 0) {
      console.log('✅ No planning entries to delete!')
      return
    }

    // Show breakdown by file
    const fileGroups = toDelete.reduce((acc, entry) => {
      const filename = entry.sourceFile.split('/').pop() || 'unknown'
      acc[filename] = (acc[filename] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('Planning folder Q&A entries by file:')
    Object.entries(fileGroups).forEach(([filename, count]) => {
      console.log(`  - ${filename}: ${count} entries`)
    })

    console.log(`\n🗑️  Deleting ${toDelete.length} entries...`)

    // Delete entries from planning folder
    await db
      .delete(schema.qaEntries)
      .where(like(schema.qaEntries.sourceFile, '%/planning/%'))
      .run()

    console.log(`\n✅ Successfully deleted ${toDelete.length} Q&A entries from planning folder!`)

    // Count remaining entries
    const remaining = await db
      .select()
      .from(schema.qaEntries)
      .all()

    console.log(`\n📊 Knowledge Base Stats:`)
    console.log(`   Total entries now: ${remaining.length}`)
    console.log(`\n✨ Cleanup complete!`)

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error)
    process.exit(1)
  }
}

cleanupPlanningQA()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
