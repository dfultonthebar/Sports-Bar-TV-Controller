#!/usr/bin/env tsx
/**
 * QA DATASET GENERATOR — curate Q-A training data from the RAG store
 * for future LoRA fine-tuning of llama3.1:8b.
 *
 * For every chunk in apps/web/rag-data/vector-store.json, ask the
 * local Ollama (qwen2.5:14b by default — strongest local instruct
 * model for structured-JSON output) to produce 3 high-quality Q-A
 * pairs that test specific facts/commands/gotchas/procedures from
 * that chunk. Aggregate into JSONL in the Unsloth/Axolotl chat
 * format, one line per Q-A pair.
 *
 *
 * USAGE
 *   npx tsx scripts/generate-qa-dataset.ts                # default --limit=100
 *   npx tsx scripts/generate-qa-dataset.ts --limit=10     # tiny smoke test
 *   npx tsx scripts/generate-qa-dataset.ts --resume       # skip already-done
 *   npx tsx scripts/generate-qa-dataset.ts --filter-tag=atlas
 *   npx tsx scripts/generate-qa-dataset.ts --model=qwen2.5:14b
 *   npx tsx scripts/generate-qa-dataset.ts --include-code # don't skip code chunks
 *   npx tsx scripts/generate-qa-dataset.ts --limit=99999 --resume   # full run
 *
 *
 * OUTPUT
 *   apps/web/rag-data/qa-dataset/qa-pairs.jsonl     append-only JSONL
 *   apps/web/rag-data/qa-dataset/seen.json          ledger of done chunk ids
 *
 *
 * ARCHITECTURE NOTES
 *   - Uses the same chdir + dynamic-require dance as scan-system-docs.ts
 *     so the rag-server package resolves RAGConfig.ragDataPath against
 *     apps/web/rag-data/ rather than the repo root. See incident note
 *     in scan-system-docs.ts (top-level await + ES static imports hoist
 *     above chdir, locking the path to the wrong directory).
 *   - Throttles to one chunk per ~10s to avoid OOM on the Iris Xe iGPU
 *     under IPEX-LLM Ollama (see CLAUDE.md §9 — Ollama runtime).
 *   - Resumable: ledger is rewritten on every batch. Ctrl-C between
 *     chunks loses at most one in-flight chunk's work.
 *   - Robust to malformed Ollama JSON: parse failures are logged +
 *     skipped, not fatal. We count + report at the end.
 *
 *
 * EXPECTED RUNTIME (Holmgren-class i9 + Iris Xe + IPEX-LLM)
 *   - qwen2.5:14b at ~6-8 tok/s on Iris Xe → ~15-25s per chunk
 *   - 10s throttle target keeps us under that envelope
 *   - 5,500 chunks × ~25s avg = ~38 hours wall clock (~1.6 days)
 *     Run --resume on a screen/tmux session.
 */

import path from 'path'
import { chdir, cwd } from 'process'
import fs from 'fs/promises'

// CRITICAL chdir-before-rag-server-import — see scan-system-docs.ts
const REPO_ROOT_FROM_SCRIPT = path.resolve(__dirname, '..')
chdir(path.join(REPO_ROOT_FROM_SCRIPT, 'apps', 'web'))
process.stderr.write(`[qa-gen] chdir → ${cwd()}\n`)

// eslint-disable-next-line @typescript-eslint/no-require-imports
const vectorStore = require('../apps/web/src/lib/rag-server/vector-store')
const { loadVectorStore } = vectorStore

const REPO_ROOT = REPO_ROOT_FROM_SCRIPT
const OUT_DIR = path.join(REPO_ROOT, 'apps', 'web', 'rag-data', 'qa-dataset')
const OUT_JSONL = path.join(OUT_DIR, 'qa-pairs.jsonl')
const SEEN_LEDGER = path.join(OUT_DIR, 'seen.json')

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const OLLAMA_TIMEOUT_MS = 180_000          // per-chunk hard ceiling
const THROTTLE_MS = 10_000                 // ~1 chunk per 10s
const MIN_CHUNK_CHARS = 100                // skip near-empty chunks
const MIN_Q_CHARS = 8                      // validate generated Q
const MIN_A_CHARS = 20                     // validate generated A
const PAIRS_PER_CHUNK_TARGET = 3

interface CliArgs {
  limit: number
  model: string
  resume: boolean
  filterTag: string | null
  includeCode: boolean
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2)
  const out: CliArgs = {
    limit: 100,
    model: 'qwen2.5:14b',
    resume: false,
    filterTag: null,
    includeCode: false,
  }
  for (const a of argv) {
    if (a.startsWith('--limit=')) out.limit = parseInt(a.split('=')[1], 10)
    else if (a.startsWith('--model=')) out.model = a.split('=')[1]
    else if (a === '--resume') out.resume = true
    else if (a.startsWith('--filter-tag=')) out.filterTag = a.split('=')[1]
    else if (a === '--include-code') out.includeCode = true
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: npx tsx scripts/generate-qa-dataset.ts [flags]\n' +
        '  --limit=N            max chunks this run (default 100)\n' +
        '  --model=NAME         Ollama model id (default qwen2.5:14b)\n' +
        '  --resume             skip chunks recorded in seen.json\n' +
        '  --filter-tag=TAG     only process chunks whose techTags include TAG\n' +
        '  --include-code       don\'t skip code-heavy chunks\n'
      )
      process.exit(0)
    }
  }
  if (!Number.isFinite(out.limit) || out.limit < 1) out.limit = 100
  return out
}

/**
 * Heuristic: is this chunk mostly code/JSON/config (low natural-language
 * density)? Such chunks make qwen2.5 produce shallow "what does this
 * variable mean?" Q-As that don't transfer to operator questions. Skip
 * unless --include-code.
 */
function isMostlyCode(text: string): boolean {
  if (text.length < 40) return false
  const lines = text.split('\n')
  let codeLines = 0
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (
      t.startsWith('//') ||
      t.startsWith('/*') ||
      t.startsWith('*') ||
      t.startsWith('import ') ||
      t.startsWith('export ') ||
      t.startsWith('const ') ||
      t.startsWith('let ') ||
      t.startsWith('var ') ||
      t.startsWith('function ') ||
      t.startsWith('class ') ||
      t.startsWith('interface ') ||
      t.startsWith('type ') ||
      t.startsWith('CREATE TABLE') ||
      t.startsWith('ALTER TABLE') ||
      t.startsWith('INSERT ') ||
      /^[\}\]\)];?$/.test(t) ||
      /^\s*[\{\[\(]/.test(line) ||
      /^\s*[a-zA-Z_$][\w$]*:\s*['"\[\{0-9]/.test(line)
    ) {
      codeLines++
    }
  }
  return codeLines / lines.filter((l) => l.trim()).length > 0.6
}

function isJsonish(text: string): boolean {
  const t = text.trim()
  if (!(t.startsWith('{') || t.startsWith('[')) ) return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}

interface QAPair {
  q: string
  a: string
}

interface OllamaGenerateResponse {
  response?: string
  done?: boolean
  error?: string
}

/**
 * Build the prompt sent to the local model. Constraints baked in:
 *   - 3 pairs
 *   - JSON-only output (no preamble) — easier to parse reliably
 *   - 2-4 sentences per answer
 *   - quote identifiers verbatim
 */
function buildPrompt(chunkContent: string, filename: string): string {
  return [
    'You are generating training data for an internal AI assistant that supports',
    'sports-bar AV operators. You will read one documentation snippet and emit',
    'exactly 3 high-quality question + answer pairs that an operator might ask',
    'an AI Hub about this content.',
    '',
    'Rules for each Q-A pair:',
    '  - The question must test a specific fact, command, gotcha, or procedure',
    '    from the snippet. Avoid trivia or restating obvious headings.',
    '  - The answer must be 2-4 sentences. No bullet lists, no markdown.',
    '  - Quote specific identifiers (function names, ports, IPs, table names,',
    '    property names like TX_MODEL, outputOffset, atlasClientManager) VERBATIM.',
    '  - Do not invent facts not present in the snippet.',
    '',
    'Output: ONLY a JSON array, no preamble, no trailing prose. Schema:',
    '  [{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."}]',
    '',
    `Source file: ${filename}`,
    '',
    'Snippet:',
    '"""',
    chunkContent,
    '"""',
    '',
    'JSON output:',
  ].join('\n')
}

async function callOllama(model: string, prompt: string): Promise<string> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS)
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,        // low → fewer hallucinations
          top_p: 0.9,
          num_predict: 1024,       // 3 pairs × ~100 tokens fits easy
        },
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`)
    }
    const body = (await res.json()) as OllamaGenerateResponse
    if (body.error) throw new Error(`Ollama error: ${body.error}`)
    return body.response || ''
  } finally {
    clearTimeout(t)
  }
}

/**
 * Pull a JSON array out of the model output. qwen2.5 sometimes wraps
 * its JSON in ```json fences or appends a "Note:" — peel the first
 * top-level [...] block out, then parse.
 */
function extractJsonArray(raw: string): unknown {
  let s = raw.trim()
  // strip ```json … ``` fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  // find first [, last matching ]
  const start = s.indexOf('[')
  if (start < 0) throw new Error('no [ found in model output')
  let depth = 0
  let end = -1
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end < 0) throw new Error('unbalanced [ in model output')
  return JSON.parse(s.slice(start, end + 1))
}

function validatePairs(parsed: unknown): QAPair[] {
  if (!Array.isArray(parsed)) throw new Error('output is not an array')
  const out: QAPair[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const q = typeof obj.q === 'string' ? obj.q.trim()
            : typeof obj.question === 'string' ? obj.question.trim()
            : ''
    const a = typeof obj.a === 'string' ? obj.a.trim()
            : typeof obj.answer === 'string' ? obj.answer.trim()
            : ''
    if (q.length < MIN_Q_CHARS) continue
    if (a.length < MIN_A_CHARS) continue
    out.push({ q, a })
  }
  return out
}

async function loadSeen(): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(SEEN_LEDGER, 'utf-8')
    const arr = JSON.parse(raw)
    return new Set<string>(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set<string>()
  }
}

async function saveSeen(seen: Set<string>): Promise<void> {
  const tmp = SEEN_LEDGER + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(Array.from(seen), null, 0))
  await fs.rename(tmp, SEEN_LEDGER)
}

async function appendPair(
  outFh: fs.FileHandle,
  pair: QAPair,
  source: string,
  chunkId: string,
): Promise<void> {
  const obj = {
    messages: [
      { role: 'user', content: pair.q },
      { role: 'assistant', content: pair.a },
    ],
    source,
    chunk_id: chunkId,
  }
  await outFh.write(JSON.stringify(obj) + '\n')
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

interface ChunkLike {
  id: string
  content: string
  metadata: {
    filename: string
    filepath: string
    techTags: string[]
  }
}

async function main(): Promise<void> {
  const args = parseArgs()
  process.stderr.write(
    `[qa-gen] args: limit=${args.limit} model=${args.model} ` +
    `resume=${args.resume} filterTag=${args.filterTag ?? '∅'} ` +
    `includeCode=${args.includeCode}\n`,
  )

  // Sanity-check Ollama is up + model is pulled
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const tags = (await r.json()) as { models?: Array<{ name: string }> }
    const have = (tags.models || []).map((m) => m.name)
    if (!have.some((n) => n === args.model || n.startsWith(args.model + ':'))) {
      process.stderr.write(
        `[qa-gen] WARNING: model "${args.model}" not in ollama list (have: ${have.join(', ')}). ` +
        `Pull it first: ollama pull ${args.model}\n`,
      )
    }
  } catch (e) {
    process.stderr.write(`[qa-gen] FATAL: Ollama unreachable at ${OLLAMA_URL}: ${(e as Error).message}\n`)
    process.exit(1)
  }

  await fs.mkdir(OUT_DIR, { recursive: true })

  process.stderr.write('[qa-gen] loading vector store …\n')
  const store = await loadVectorStore()
  const allEntries = store.entries as Array<{ id: string; chunk: ChunkLike }>
  process.stderr.write(`[qa-gen] vector store: ${allEntries.length} chunks total\n`)

  const seen = args.resume ? await loadSeen() : new Set<string>()
  if (args.resume) {
    process.stderr.write(`[qa-gen] resume: ${seen.size} chunks already in ledger, skipping\n`)
  }

  // Build the work queue
  const queue: ChunkLike[] = []
  let skippedShort = 0
  let skippedCode = 0
  let skippedTag = 0
  let skippedSeen = 0
  for (const entry of allEntries) {
    const c = entry.chunk
    if (seen.has(c.id)) { skippedSeen++; continue }
    if (args.filterTag && !c.metadata.techTags.includes(args.filterTag)) {
      skippedTag++
      continue
    }
    if (c.content.length < MIN_CHUNK_CHARS) { skippedShort++; continue }
    if (!args.includeCode && (isMostlyCode(c.content) || isJsonish(c.content))) {
      skippedCode++
      continue
    }
    queue.push(c)
    if (queue.length >= args.limit) break
  }
  process.stderr.write(
    `[qa-gen] queue: ${queue.length} chunks (limit ${args.limit}). ` +
    `pre-filtered: ${skippedSeen} seen, ${skippedTag} tag-miss, ` +
    `${skippedShort} too-short, ${skippedCode} code-heavy\n`,
  )

  if (queue.length === 0) {
    process.stderr.write('[qa-gen] nothing to do.\n')
    return
  }

  // Open output JSONL in append mode (resumable across runs)
  const outFh = await fs.open(OUT_JSONL, 'a')

  let totalPairs = 0
  let okChunks = 0
  let malformed = 0
  let timeouts = 0
  let otherErrors = 0
  const startedAt = Date.now()

  try {
    for (let i = 0; i < queue.length; i++) {
      const chunk = queue[i]
      const t0 = Date.now()
      try {
        const prompt = buildPrompt(chunk.content, chunk.metadata.filename)
        const raw = await callOllama(args.model, prompt)
        const parsed = extractJsonArray(raw)
        const pairs = validatePairs(parsed)
        if (pairs.length === 0) {
          malformed++
          process.stderr.write(
            `[qa-gen]  ⚠ ${i + 1}/${queue.length} no valid pairs from ${chunk.metadata.filename}\n`,
          )
        } else {
          for (const p of pairs) {
            await appendPair(outFh, p, chunk.metadata.filepath, chunk.id)
            totalPairs++
          }
          okChunks++
        }
        seen.add(chunk.id)
        // Persist ledger every chunk so Ctrl-C is safe
        await saveSeen(seen)
      } catch (e) {
        const msg = (e as Error).message || String(e)
        if (msg.includes('aborted') || msg.toLowerCase().includes('timeout')) {
          timeouts++
          process.stderr.write(
            `[qa-gen]  ⚠ ${i + 1}/${queue.length} TIMEOUT on ${chunk.metadata.filename} after ${Date.now() - t0}ms\n`,
          )
        } else {
          otherErrors++
          process.stderr.write(
            `[qa-gen]  ⚠ ${i + 1}/${queue.length} error on ${chunk.metadata.filename}: ${msg}\n`,
          )
        }
        // Do NOT add to seen — retry on next --resume run
      }

      const elapsed = Date.now() - t0
      const tag = chunk.metadata.techTags[0] || '∅'
      process.stderr.write(
        `[qa-gen] ${i + 1}/${queue.length} done in ${elapsed}ms — ` +
        `${chunk.metadata.filename} [${tag}] (+${totalPairs} pairs total)\n`,
      )

      // Throttle if we finished faster than the target
      if (i < queue.length - 1) {
        const remaining = THROTTLE_MS - elapsed
        if (remaining > 0) await sleep(remaining)
      }
    }
  } finally {
    await outFh.close()
  }

  const wall = Math.round((Date.now() - startedAt) / 1000)
  process.stderr.write(
    `\n[qa-gen] DONE in ${wall}s.\n` +
    `         Generated ${totalPairs} Q-A pairs across ${okChunks} chunks ` +
    `(skipped ${malformed} malformed, ${timeouts} timeouts, ${otherErrors} other errors).\n` +
    `         Output appended to: ${OUT_JSONL}\n` +
    `         Seen ledger:        ${SEEN_LEDGER} (${seen.size} entries)\n` +
    `         Re-run with --resume to continue.\n`,
  )
}

main().catch((e) => {
  process.stderr.write(`[qa-gen] FATAL: ${(e as Error).stack || e}\n`)
  process.exit(1)
})
