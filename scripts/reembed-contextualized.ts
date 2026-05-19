#!/usr/bin/env tsx
/**
 * Re-embed every chunk that has a contextPrefix using the
 * `${prefix}\n\n${content}` text. Runs after scripts/contextualize-chunks.ts
 * has finished writing the prefixes.
 *
 * Why a separate step: contextualize-chunks.ts is LLM-bound (~2s/chunk
 * on iGPU); embedding is much faster batched (~50-100ms/chunk via
 * /api/embed). Splitting lets the slow step run overnight and the fast
 * step run in minutes the morning after.
 *
 * Usage:
 *   npx tsx scripts/reembed-contextualized.ts            # only chunks with new prefixes (default)
 *   npx tsx scripts/reembed-contextualized.ts --all      # re-embed ALL (use after --clear)
 *   npx tsx scripts/reembed-contextualized.ts --batch=64 # tune batch size
 */

import path from 'path'
import { chdir, cwd } from 'process'
import fs from 'fs/promises'

const REPO_ROOT_FROM_SCRIPT = path.resolve(__dirname, '..')
chdir(path.join(REPO_ROOT_FROM_SCRIPT, 'apps', 'web'))
console.log('[reembed] chdir →', cwd())

// eslint-disable-next-line @typescript-eslint/no-require-imports
const llmClient = require('../apps/web/src/lib/rag-server/llm-client')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ragConfigModule = require('../apps/web/src/lib/rag-server/config')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vectorStore = require('../apps/web/src/lib/rag-server/vector-store')

const RAGConfig = ragConfigModule.RAGConfig

const args = process.argv.slice(2)
const ALL = args.includes('--all')
const BATCH = (() => {
  const a = args.find((x) => x.startsWith('--batch='))
  return a ? parseInt(a.split('=')[1], 10) : 32
})()

async function main() {
  console.log('\n=== Re-embed chunks with contextPrefix ===\n')

  if (!(await llmClient.testOllamaConnection())) {
    console.error('❌ Ollama unreachable')
    process.exit(1)
  }
  await vectorStore.initializeVectorStore()

  const storePath = path.join(RAGConfig.ragDataPath, 'vector-store.json')
  const raw = JSON.parse(await fs.readFile(storePath, 'utf-8'))
  const entries: any[] = raw.entries || []

  // Pick targets: chunks WITH a contextPrefix
  const targets = ALL
    ? entries.filter((e) => e.chunk?.metadata?.contextPrefix)
    : entries.filter((e) => e.chunk?.metadata?.contextPrefix && !e.chunk?.metadata?.reembeddedWithPrefix)

  console.log(`Targets: ${targets.length} chunks${ALL ? ' (--all)' : ' (incremental)'}`)
  if (targets.length === 0) {
    console.log('Nothing to re-embed. Did contextualize-chunks.ts run first?')
    return
  }

  let done = 0
  for (let i = 0; i < targets.length; i += BATCH) {
    const slice = targets.slice(i, i + BATCH)
    const texts = slice.map((e) => `${e.chunk.metadata.contextPrefix}\n\n${e.chunk.content}`)
    const embeddings: number[][] = await llmClient.generateEmbeddings(texts)
    for (let k = 0; k < slice.length; k++) {
      slice[k].embedding = embeddings[k]
      slice[k].chunk.metadata.reembeddedWithPrefix = true
      slice[k].timestamp = Date.now()
    }
    done += slice.length
    if (i % (BATCH * 4) === 0 || done === targets.length) {
      await fs.writeFile(storePath, JSON.stringify(raw, null, 2))
      console.log(`    progress ${done}/${targets.length} (${Math.round(done / targets.length * 100)}%)`)
    }
  }

  await fs.writeFile(storePath, JSON.stringify(raw, null, 2))
  console.log(`\n✓ Re-embedded ${done} chunks with contextual prefix\n`)
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
