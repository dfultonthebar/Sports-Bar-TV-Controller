#!/usr/bin/env tsx
/**
 * Contextual Retrieval pre-pass (Anthropic Sept 2024).
 *
 * Walks every chunk in the existing vector store. For each, sends the
 * full document text + the chunk text to llama3.1:8b with the canonical
 * Anthropic prompt:
 *
 *   "Please give a short succinct context to situate this chunk within
 *    the overall document for the purposes of improving search retrieval
 *    of the chunk. Answer only with the succinct context and nothing else."
 *
 * Stores the result as chunk.metadata.contextPrefix, then re-embeds with
 * `${prefix}\n\n${content}` and rewrites both the dense vector store and
 * BM25 index. The chunk.content stays clean so downstream LLM display +
 * citation work the same.
 *
 * Why: chunks lose their doc-level context (§-header, "applies to
 * firmware X.Y", "for location Z"). A chunk reading "TX_MODEL (NOT
 * TX_TYPE)" embeds the same whether it's from §7a Shure SLX-D firmware
 * 1.4.7.0 or a generic vendor cheatsheet. Prepending "This is from
 * CLAUDE.md §7a Shure SLX-D firmware 1.4.7.0..." resolves that.
 *
 * Cost: one llama3.1:8b call per chunk. With ~3,700 chunks at ~2s/chunk
 * on iGPU = ~2 hours. Throttled, resumable via seen.json ledger.
 *
 * Usage:
 *   npx tsx scripts/contextualize-chunks.ts                # incremental
 *   npx tsx scripts/contextualize-chunks.ts --clear        # restart from scratch
 *   npx tsx scripts/contextualize-chunks.ts --limit=N      # test pass
 *   npx tsx scripts/contextualize-chunks.ts --filter=docs/bartender-help
 */

import path from 'path'
import { chdir, cwd } from 'process'
import fs from 'fs/promises'

const REPO_ROOT_FROM_SCRIPT = path.resolve(__dirname, '..')
chdir(path.join(REPO_ROOT_FROM_SCRIPT, 'apps', 'web'))
console.log('[ctx] chdir →', cwd())

// eslint-disable-next-line @typescript-eslint/no-require-imports
const vectorStore = require('../apps/web/src/lib/rag-server/vector-store')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const llmClient = require('../apps/web/src/lib/rag-server/llm-client')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ragConfigModule = require('../apps/web/src/lib/rag-server/config')

const RAGConfig = ragConfigModule.RAGConfig
const OLLAMA_URL = RAGConfig.ollamaUrl || 'http://localhost:11434'
const CONTEXT_MODEL = process.env.CONTEXT_MODEL || 'llama3.1:8b'

const args = process.argv.slice(2)
const CLEAR = args.includes('--clear')
const LIMIT = (() => {
  const a = args.find((x) => x.startsWith('--limit='))
  return a ? parseInt(a.split('=')[1], 10) : Infinity
})()
const FILTER = (() => {
  const a = args.find((x) => x.startsWith('--filter='))
  return a ? a.split('=')[1] : null
})()

const LEDGER_PATH = path.join(RAGConfig.ragDataPath, 'context-prefix-ledger.json')

interface Ledger {
  seenChunkIds: string[]
  generatedAt: string
}

async function loadLedger(): Promise<Ledger> {
  if (CLEAR) return { seenChunkIds: [], generatedAt: new Date().toISOString() }
  try {
    const raw = await fs.readFile(LEDGER_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { seenChunkIds: [], generatedAt: new Date().toISOString() }
  }
}

async function saveLedger(l: Ledger): Promise<void> {
  l.generatedAt = new Date().toISOString()
  await fs.writeFile(LEDGER_PATH, JSON.stringify(l, null, 2))
}

/**
 * Anthropic's canonical Contextual Retrieval prompt (Sept 2024). Returns
 * 1-2 sentences of doc-level framing for the chunk.
 */
async function generateContextPrefix(docText: string, chunkText: string): Promise<string> {
  const prompt = `<document>
${docText.slice(0, 6000)}${docText.length > 6000 ? '\n\n[...document truncated...]' : ''}
</document>

Here is the chunk we want to situate within the whole document:

<chunk>
${chunkText}
</chunk>

Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else.`

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONTEXT_MODEL,
      prompt,
      stream: false,
      keep_alive: -1,
      options: { temperature: 0.2, num_predict: 120 },
    }),
  })
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text()}`)
  const data = await response.json() as { response?: string }
  // Sanitize: single line, max 300 chars (the prefix is structural metadata,
  // not narrative; a runaway model would balloon embedding cost).
  let text = (data.response || '').trim().replace(/\s+/g, ' ')
  if (text.length > 300) text = text.slice(0, 300).replace(/\s+\S*$/, '…')
  return text
}

async function main() {
  console.log('\n=== Contextual Retrieval pre-pass ===\n')

  console.log('1. Checking Ollama...')
  if (!(await llmClient.testOllamaConnection())) {
    console.error('❌ Ollama unreachable — check that ollama serve is running')
    process.exit(1)
  }
  console.log('✓ Ollama reachable')

  console.log('\n2. Loading vector store + ledger...')
  await vectorStore.initializeVectorStore()
  const ledger = await loadLedger()
  const seen = new Set(ledger.seenChunkIds)

  // Read raw vector store (bypassing addChunks/searchVectorStore which would
  // load+save full file each call — we need per-chunk surgical updates).
  const storePath = path.join(RAGConfig.ragDataPath, 'vector-store.json')
  const raw = JSON.parse(await fs.readFile(storePath, 'utf-8'))
  const entries: any[] = raw.entries || []
  console.log(`✓ ${entries.length} chunks in store, ${seen.size} already contextualized`)

  // Group chunks by filepath so we can fetch the full doc text once
  const byFile = new Map<string, any[]>()
  for (const e of entries) {
    const fp = e.chunk?.metadata?.filepath || ''
    if (!fp) continue
    if (FILTER && !fp.includes(FILTER)) continue
    if (seen.has(e.chunk.id) && !CLEAR) continue
    if (e.chunk.metadata.contextPrefix && !CLEAR) {
      seen.add(e.chunk.id)
      continue
    }
    if (!byFile.has(fp)) byFile.set(fp, [])
    byFile.get(fp)!.push(e)
  }

  const totalToDo = Array.from(byFile.values()).reduce((s, arr) => s + arr.length, 0)
  console.log(`\n3. ${totalToDo} chunks across ${byFile.size} files need contextualization`)
  if (totalToDo === 0) {
    console.log('   Nothing to do. (Use --clear to regenerate all prefixes.)')
    return
  }
  console.log(`   Model: ${CONTEXT_MODEL}, throttle ~2s/chunk, ETA ~${Math.ceil(totalToDo * 2 / 60)} min`)

  let processed = 0
  let errors = 0
  let updated = 0

  for (const [filepath, fileChunks] of byFile) {
    if (processed >= LIMIT) break
    // Load full document text (best-effort — some chunks are from .pdf
    // we'd have to re-extract; for those, concatenate the chunks themselves
    // as a proxy for "doc text")
    let docText = ''
    try {
      const abs = path.isAbsolute(filepath) ? filepath : path.join(REPO_ROOT_FROM_SCRIPT, filepath)
      docText = await fs.readFile(abs, 'utf-8')
    } catch {
      // Fall back to concatenated chunks (rare — pdf-parse failures, etc.)
      docText = fileChunks.map((e) => e.chunk.content).join('\n\n')
    }

    for (const e of fileChunks) {
      if (processed >= LIMIT) break
      try {
        const prefix = await generateContextPrefix(docText, e.chunk.content)
        if (prefix && prefix.length >= 10) {
          e.chunk.metadata.contextPrefix = prefix
          updated++
        }
        seen.add(e.chunk.id)
        processed++
        if (processed % 25 === 0) {
          // Periodic save so a crash doesn't lose progress
          ledger.seenChunkIds = Array.from(seen)
          await saveLedger(ledger)
          await fs.writeFile(storePath, JSON.stringify(raw, null, 2))
          console.log(`    progress ${processed}/${totalToDo} (${Math.round(processed / totalToDo * 100)}%) — ${updated} prefixed, ${errors} errors`)
        }
        // Throttle so the embedding-batch / chat traffic isn't starved
        await new Promise((r) => setTimeout(r, 250))
      } catch (err) {
        errors++
        console.warn(`    ⚠ ${filepath} chunk ${e.chunk.id}: ${(err as Error).message}`)
      }
    }
  }

  // Final save
  ledger.seenChunkIds = Array.from(seen)
  await saveLedger(ledger)
  await fs.writeFile(storePath, JSON.stringify(raw, null, 2))
  console.log(`\n✓ ${processed} chunks contextualized (${updated} prefixed, ${errors} errors)`)

  console.log('\n4. NEXT STEP: re-embed chunks that got new prefixes')
  console.log('   The vector store contains the new contextPrefix metadata,')
  console.log('   but embeddings are still the OLD prefix-less ones. Run:')
  console.log('     npx tsx scripts/reembed-contextualized.ts')
  console.log('   to regenerate embeddings using the new prefix+content text.\n')
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
