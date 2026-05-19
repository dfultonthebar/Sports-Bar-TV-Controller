#!/usr/bin/env tsx
/**
 * CODE-WIDE RAG indexing — adds the actual TypeScript/JavaScript
 * source code to the RAG store so the AI Hub can answer
 * implementation-level questions ("show me the function that polls
 * UDP meters", "where is the Shure preflight check?", etc.) — not
 * just doc-level questions.
 *
 * Complements scan-system-docs.ts (which indexes .md + .pdf + .html
 * documentation). Runs OVERTOP of the same vector store — does NOT
 * --clear, so docs stay indexed. Use --clear only if you want to
 * wipe everything and rebuild.
 *
 * Scope (curated — NOT everything under apps/web/src):
 *   - All route.ts files under apps/web/src/app/api (endpoint behavior)
 *   - All .ts files under apps/web/src/lib (service layer — business logic)
 *   - All .ts files under packages/PKG/src (shared package source)
 *   - apps/web/src/db/schema.ts (THE schema — single source of truth)
 *
 * Skipped:
 *   - Components (.tsx) — visual code, not great RAG fodder
 *   - Tests (__tests__) — irrelevant for "how does X work" questions
 *   - Page components (apps/web/src/app/PAGE/page.tsx) — UI, not behavior
 *
 * Usage (MUST run from apps/web/ cwd so the rag-data path matches —
 * auto-chdir on launch, same fix as scan-system-docs.ts):
 *   npx tsx scripts/scan-code-docs.ts            # incremental refresh
 *   npx tsx scripts/scan-code-docs.ts --clear    # nuke EVERYTHING and rebuild
 *
 * Run this when:
 *   - New API routes, new lib services, or new packages are added
 *   - After major refactors
 *   - Same cadence as scan-system-docs.ts (weekly cron recommended)
 *
 * NOTE: code files have larger chunk counts than markdown docs (denser
 * content). Expect 4000–6000 chunks added on top of the doc-based 3000+,
 * for a total store of ~7000–9000 chunks. Embedding generation takes
 * ~5–10 ms per chunk on iGPU; full code scan ~10–15 min.
 */

import path from 'path'
import { chdir, cwd } from 'process'
import fs from 'fs/promises'

// CRITICAL chdir-before-import — same incident note as scan-system-docs.ts.
// Top-level await fails under tsx CJS; dynamic require AFTER chdir so
// RAGConfig.ragDataPath resolves to apps/web/rag-data/, not ./rag-data
// at the repo root.
const REPO_ROOT_FROM_SCRIPT = path.resolve(__dirname, '..')
chdir(path.join(REPO_ROOT_FROM_SCRIPT, 'apps', 'web'))
console.log('[scan-code] chdir →', cwd())

// eslint-disable-next-line @typescript-eslint/no-require-imports
const docProcessor = require('../apps/web/src/lib/rag-server/doc-processor')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vectorStore = require('../apps/web/src/lib/rag-server/vector-store')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const llmClient = require('../apps/web/src/lib/rag-server/llm-client')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ragConfigModule = require('../apps/web/src/lib/rag-server/config')

const { processDocuments } = docProcessor
const { clearVectorStore, addChunks, initializeVectorStore, getVectorStoreStats } = vectorStore
const { testOllamaConnection } = llmClient
const RAGConfig = ragConfigModule.RAGConfig

const REPO_ROOT = path.resolve(__dirname, '..')
const CLEAR = process.argv.includes('--clear')

// Add .ts and .tsx to supported extensions in-memory. readDocument()
// falls through to UTF-8 read for anything that isn't .pdf or .html,
// so .ts/.tsx Just Work — we only need scanDocuments to surface them.
//
// We don't add .js — almost everything in this repo is .ts; .js files
// at the repo root are config (next.config.js, ecosystem.config.js)
// which are noise for the AI.
const ORIGINAL_EXTS = RAGConfig.supportedExtensions
RAGConfig.supportedExtensions = ['.ts', '.tsx']

const EXCLUDE_PATTERNS = [
  '/node_modules/',
  '/.next/',
  '/.git/',
  '/rag-data/',
  '/build/',
  '/dist/',
  '/__tests__/',
  '/.turbo/',
  '/coverage/',
  '/test-results/',
  '/playwright-report/',
  '/.cache/',
  '.d.ts',          // type declarations are noise
  '.test.ts',       // unit tests
  '.spec.ts',       // unit tests
  '/scripts/',      // operator scripts indexed separately if needed
]

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

// Recursive walker — collect .ts/.tsx under a root, skip excludes.
async function walkDir(root: string): Promise<string[]> {
  const out: string[] = []
  async function recurse(dir: string) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (EXCLUDE_PATTERNS.some((p) => full.includes(p))) continue
      if (e.isDirectory()) {
        await recurse(full)
      } else if (e.isFile()) {
        if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
          out.push(full)
        }
      }
    }
  }
  await recurse(root)
  return out
}

async function collectFiles(): Promise<{ files: string[]; byCategory: Record<string, number> }> {
  const collected = new Set<string>()
  const byCategory: Record<string, number> = {
    'route handlers': 0,
    'lib services': 0,
    'db schema': 0,
    'package source': 0,
  }

  // 1. API route handlers — the source of truth for endpoint behavior
  const apiDir = path.join(REPO_ROOT, 'apps/web/src/app/api')
  if (await fileExists(apiDir)) {
    const routes = (await walkDir(apiDir)).filter((f) => f.endsWith('/route.ts'))
    routes.forEach((f) => collected.add(f))
    byCategory['route handlers'] = routes.length
  }

  // 2. Lib services — business logic (clients, watchers, helpers)
  const libDir = path.join(REPO_ROOT, 'apps/web/src/lib')
  if (await fileExists(libDir)) {
    const libs = (await walkDir(libDir)).filter((f) => f.endsWith('.ts') && !f.endsWith('.tsx'))
    libs.forEach((f) => collected.add(f))
    byCategory['lib services'] = libs.length
  }

  // 3. DB schema — referenced in nearly every API question
  const schema = path.join(REPO_ROOT, 'apps/web/src/db/schema.ts')
  if (await fileExists(schema)) {
    collected.add(schema)
    byCategory['db schema'] = 1
  }

  // 4. Package source — every packages/<name>/src/*.ts
  const packagesDir = path.join(REPO_ROOT, 'packages')
  if (await fileExists(packagesDir)) {
    const pkgs = await fs.readdir(packagesDir, { withFileTypes: true })
    let pkgFileCount = 0
    for (const pkg of pkgs) {
      if (!pkg.isDirectory()) continue
      const pkgSrc = path.join(packagesDir, pkg.name, 'src')
      if (await fileExists(pkgSrc)) {
        const files = await walkDir(pkgSrc)
        files.forEach((f) => collected.add(f))
        pkgFileCount += files.length
      }
    }
    byCategory['package source'] = pkgFileCount
  }

  return { files: Array.from(collected).sort(), byCategory }
}

async function main() {
  console.log('\n=== CODE SCANNER — adding TypeScript source to RAG ===\n')

  console.log('1. Checking Ollama connection...')
  if (!(await testOllamaConnection())) {
    console.error('❌ Ollama not available. ollama serve + pull nomic-embed-text first.')
    process.exit(1)
  }
  console.log('✓ Ollama reachable')

  console.log('\n2. Initializing vector store...')
  await initializeVectorStore()
  console.log('✓ Vector store ready')

  if (CLEAR) {
    console.log('\n3. Clearing existing chunks (--clear) — INCLUDING DOCS!')
    console.log('   Re-run scan-system-docs.ts after this to restore docs.')
    await clearVectorStore()
    console.log('✓ Cleared')
  }

  console.log('\n4. Collecting source files...')
  const { files, byCategory } = await collectFiles()
  for (const [cat, n] of Object.entries(byCategory)) {
    if (n > 0) console.log(`    ${cat}: ${n}`)
  }
  console.log(`✓ ${files.length} source files in scope`)

  console.log('\n5. Processing + indexing in batches of 5...')
  const batchSize = 5
  let totalChunks = 0
  let totalDocs = 0
  const errors: string[] = []

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    const results = await processDocuments(batch)
    for (const r of results) {
      if (r.error) {
        errors.push(`${r.filename}: ${r.error}`)
        continue
      }
      if (r.chunks.length === 0) continue
      await addChunks(r.chunks)
      totalChunks += r.chunks.length
      totalDocs += 1
    }
    const pct = Math.round(((i + batch.length) / files.length) * 100)
    console.log(`    progress ${i + batch.length}/${files.length} (${pct}%) — chunks=${totalChunks}`)
  }

  // Restore the original supported-extensions list so other things
  // that loaded this RAGConfig instance don't get confused.
  RAGConfig.supportedExtensions = ORIGINAL_EXTS

  const stats = await getVectorStoreStats()
  console.log('\n6. Final vector store:')
  console.log(`    total chunks:    ${stats.totalChunks}`)
  console.log(`    total documents: ${stats.totalDocuments}`)
  console.log(`    indexed this run: ${totalDocs} files / ${totalChunks} chunks`)
  console.log(`    errors: ${errors.length}`)
  if (errors.length > 0) {
    console.log('\n  Errors:')
    for (const e of errors.slice(0, 10)) console.log(`    - ${e}`)
    if (errors.length > 10) console.log(`    ... and ${errors.length - 10} more`)
  }
  console.log('\n✓ Source code indexed. The AI can now answer questions like:')
  console.log('  - "Show me the function that polls Atlas UDP meters"')
  console.log('  - "Where is the Shure preflight check implemented?"')
  console.log('  - "What does the SDR watcher do when a carrier is detected?"')
  console.log('')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
