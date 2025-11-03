/**
 * Remove duplicate Q&A entries (keep oldest entry for each question)
 */

import { db, schema } from '../src/db'
import { sql } from 'drizzle-orm'

const { qaEntries } = schema

async function cleanupDuplicates() {
  console.log('Starting duplicate Q&A cleanup...\n')

  // Find duplicates
  const duplicates = await db.all(sql`
    SELECT question, COUNT(*) as count, MIN(createdAt) as firstCreated
    FROM QAEntry
    WHERE sourceType = 'documentation'
      AND DATE(createdAt) = '2025-11-03'
    GROUP BY question
    HAVING count > 1
    ORDER BY question
  `)

  console.log(`Found ${duplicates.length} questions with duplicates\n`)

  let totalDeleted = 0

  for (const dup of duplicates) {
    const question = dup.question as string
    const firstCreated = dup.firstCreated as string
    const count = dup.count as number

    // Delete all entries for this question EXCEPT the oldest one
    const result = await db.run(sql`
      DELETE FROM QAEntry
      WHERE question = ${question}
        AND sourceType = 'documentation'
        AND createdAt > ${firstCreated}
    `)

    const deleted = result.changes || 0
    totalDeleted += deleted

    console.log(`✓ Cleaned: "${question.substring(0, 60)}..." (removed ${deleted} duplicate${deleted > 1 ? 's' : ''})`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('CLEANUP SUMMARY')
  console.log('='.repeat(80))
  console.log(`Questions with duplicates: ${duplicates.length}`)
  console.log(`Total duplicate entries removed: ${totalDeleted}`)
  console.log(`Unique Q&A entries retained: ${duplicates.length}`)
  console.log('\nDatabase is now clean!')
}

cleanupDuplicates()
  .then(() => {
    console.log('\nCleanup completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error during cleanup:', error)
    process.exit(1)
  })
