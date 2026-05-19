#!/usr/bin/env tsx
/**
 * One-shot rebuild of the BM25 sparse index from the existing dense
 * vector store. Used:
 *  - After v2.50.4 ships (BM25 store is brand new; vector store has
 *    existing entries that pre-date BM25 mirroring)
 *  - After any vector store import that bypassed addChunks()
 *  - On recovery when bm25.db is missing
 *
 * Idempotent — clears BM25 first, then bulk-inserts every chunk from
 * vector-store.json. Doesn't touch dense embeddings.
 *
 * Usage:
 *   npx tsx scripts/rebuild-bm25-from-vector.ts
 */

import path from 'path'
import { chdir, cwd } from 'process'

const REPO_ROOT_FROM_SCRIPT = path.resolve(__dirname, '..')
chdir(path.join(REPO_ROOT_FROM_SCRIPT, 'apps', 'web'))
console.log('[rebuild-bm25] chdir →', cwd())

// eslint-disable-next-line @typescript-eslint/no-require-imports
const vectorStore = require('../apps/web/src/lib/rag-server/vector-store')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bm25Store = require('../apps/web/src/lib/rag-server/bm25-store')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ragConfigModule = require('../apps/web/src/lib/rag-server/config')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs').promises

async function main() {
  console.log('\n=== BM25 INDEX REBUILD (from existing vector store) ===\n')

  console.log('1. Loading vector store...')
  await vectorStore.initializeVectorStore()
  const stats = await vectorStore.getVectorStoreStats()
  console.log(`✓ Vector store has ${stats.totalChunks} chunks across ${stats.totalDocuments} docs`)

  if (stats.totalChunks === 0) {
    console.log('⚠ Vector store empty — run scan-system-docs.ts first')
    process.exit(0)
  }

  console.log('\n2. Clearing existing BM25 index (if any)...')
  await bm25Store.bm25Clear()

  console.log('\n3. Streaming chunks from vector-store.json into BM25...')
  const storePath = path.join(ragConfigModule.RAGConfig.ragDataPath, 'vector-store.json')
  const raw = JSON.parse(await fs.readFile(storePath, 'utf-8'))
  const entries = raw.entries || []

  const BATCH = 500
  let inserted = 0
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH)
    const chunks = slice.map((e: any) => ({
      id: e.chunk.id,
      content: e.chunk.content,
      metadata: {
        filepath: e.chunk.metadata?.filepath,
        filename: e.chunk.metadata?.filename,
      },
    }))
    await bm25Store.bm25AddChunks(chunks)
    inserted += chunks.length
    const pct = Math.round((inserted / entries.length) * 100)
    console.log(`    progress ${inserted}/${entries.length} (${pct}%)`)
  }

  console.log('\n4. Final BM25 stats:')
  const bm25Stats = await bm25Store.bm25Stats()
  console.log(`    total chunks: ${bm25Stats.totalChunks}`)
  console.log(`    total files:  ${bm25Stats.totalFiles}`)

  console.log('\n5. Sanity probe — search for "TX_MODEL" (should hit Shure docs):')
  const probe = await bm25Store.bm25Search('TX_MODEL', 5)
  for (const r of probe.slice(0, 5)) {
    console.log(`    bm25=${r.bm25Score.toFixed(2)}  ${r.filename}`)
  }
  if (probe.length === 0) {
    console.log('    (no hits — odd, but not fatal; vector still works)')
  }

  console.log('\n✓ BM25 rebuild complete. Hybrid search at /api/rag/query is now live.\n')
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
