#!/usr/bin/env tsx
/**
 * SYSTEM-WIDE RAG indexing — feeds Ollama everything it needs to act
 * as a SME for the ENTIRE Sports-Bar-TV-Controller system, not just
 * the RF subsystem.
 *
 * Operator intent: "the system local ai needs to be a subject matter
 * expert" — covering Shure, SDR, Atlas, Wolfpack matrix, DirecTV,
 * FireTV, BSS/dbx audio, Crestron, scheduler, auto-update, etc.
 *
 * Indexed material (in priority order):
 *   1. CLAUDE.md (the master architecture/conventions doc — REQUIRED)
 *   2. All packages/REPO/README.md (per-hardware SME briefings)
 *   3. All docs/*.md (LOCATION_UPDATE_NOTES, VERSION_SETUP_GUIDE,
 *      API_REFERENCE, HARDWARE_CONFIGURATION, all hardware guides)
 *   4. All auto-memory feedback + project files (operator gotchas)
 *
 * Excluded:
 *   - node_modules, .next, .git, rag-data, build artifacts
 *   - PDF duplicates of .md files (we keep the .md, drop the .pdf)
 *   - Test files and __tests__ folders
 *   - Old archived docs / changelogs we don't reference
 *
 * Usage (MUST run from apps/web/ cwd so the rag-data path matches
 * what the Next.js API reads — auto-chdir on launch):
 *   npx tsx scripts/scan-system-docs.ts            # incremental refresh
 *   npx tsx scripts/scan-system-docs.ts --clear    # wipe + rebuild
 *
 * Run this when:
 *   - Major code merge with multiple new docs
 *   - After any CLAUDE.md update
 *   - When a new package or hardware integration is added
 *   - Weekly as a cron job (recommended for production)
 */

import path from 'path'
import { chdir, cwd } from 'process'
import fs from 'fs/promises'

// CRITICAL chdir-before-rag-server-import — see incident note below.
// Top-level await fails under tsx CJS output, so we use dynamic
// require() instead. ES static imports hoist above chdir() and
// would lock rag-server's RAGConfig.ragDataPath to the wrong path.
//
// Incident 2026-05-18: scan-system-docs.ts ran cleanly with 3192
// chunks but wrote to ./rag-data (repo root) instead of
// apps/web/rag-data/ — Next.js API kept reading the stale 513-chunk
// RF-only store. Fixed by chdir + dynamic require AFTER the chdir.
const REPO_ROOT_FROM_SCRIPT = path.resolve(__dirname, '..')
chdir(path.join(REPO_ROOT_FROM_SCRIPT, 'apps', 'web'))
console.log('[scan-system] chdir →', cwd())

// eslint-disable-next-line @typescript-eslint/no-require-imports
const docProcessor = require('../apps/web/src/lib/rag-server/doc-processor')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vectorStore = require('../apps/web/src/lib/rag-server/vector-store')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const llmClient = require('../apps/web/src/lib/rag-server/llm-client')
const { scanDocuments, processDocuments } = docProcessor
const { clearVectorStore, addChunks, initializeVectorStore, getVectorStoreStats } = vectorStore
const { testOllamaConnection } = llmClient

const REPO_ROOT = path.resolve(__dirname, '..')
const MEMORY_ROOT = '/home/ubuntu/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory'
const CLEAR = process.argv.includes('--clear')

// Files always included regardless of pattern matching — these are
// the high-value docs the AI MUST have.
const ALWAYS_INCLUDE: string[] = [
  path.join(REPO_ROOT, 'CLAUDE.md'),
]

// Excluded path patterns (case-insensitive substring match)
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
  '/memory-bank/',
  '/log/',
  '/logs/',
]

// v2.48.0: extend supported extensions for the gap-fill pass — config
// files (.js / .json / .ts), drizzle SQL (.sql), shell scripts (.sh).
// These get the same chunking treatment as .md (the readDocument()
// fallback reads any extension as UTF-8).
const ORIGINAL_EXTS = require('../apps/web/src/lib/rag-server/config').RAGConfig.supportedExtensions
require('../apps/web/src/lib/rag-server/config').RAGConfig.supportedExtensions = [
  ...ORIGINAL_EXTS, '.sql', '.sh', '.json', '.js', '.ts',
]

// PDF duplicates of .md files — if we have foo.md AND foo.pdf, skip
// the PDF. We keep PDFs that don't have a sibling .md.
async function isPdfDuplicate(pdfPath: string): Promise<boolean> {
  if (!pdfPath.endsWith('.pdf')) return false
  const md = pdfPath.replace(/\.pdf$/i, '.md')
  try {
    await fs.access(md)
    return true
  } catch {
    return false
  }
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

async function collectFiles(): Promise<string[]> {
  const collected = new Set<string>()

  // 1. Always-include files
  for (const f of ALWAYS_INCLUDE) {
    if (await fileExists(f)) collected.add(f)
  }

  // 2. All docs/*.md
  const docsDir = path.join(REPO_ROOT, 'docs')
  if (await fileExists(docsDir)) {
    const docsTree = await scanDocuments(docsDir)
    for (const f of docsTree) {
      if (await isPdfDuplicate(f)) continue
      collected.add(f)
    }
  }

  // 3. All packages/*/README.md (per-package SME briefings)
  const packagesDir = path.join(REPO_ROOT, 'packages')
  if (await fileExists(packagesDir)) {
    const pkgs = await fs.readdir(packagesDir, { withFileTypes: true })
    for (const pkg of pkgs) {
      if (!pkg.isDirectory()) continue
      const readme = path.join(packagesDir, pkg.name, 'README.md')
      if (await fileExists(readme)) collected.add(readme)
    }
  }

  // 4. Top-level repo README + any *.md at root (e.g. CONTRIBUTING,
  //    INSTALLATION, DEPLOYMENT, IR_LEARNING_DEPLOYMENT, ssh.md, etc.)
  const rootEntries = await fs.readdir(REPO_ROOT, { withFileTypes: true })
  for (const e of rootEntries) {
    if (!e.isFile()) continue
    if (e.name.toLowerCase().endsWith('.md')) {
      collected.add(path.join(REPO_ROOT, e.name))
    }
  }

  // 5. Auto-memory files (ALL of them — operator gotchas + project state)
  if (await fileExists(MEMORY_ROOT)) {
    const memFiles = await fs.readdir(MEMORY_ROOT)
    for (const f of memFiles) {
      if (f.endsWith('.md')) collected.add(path.join(MEMORY_ROOT, f))
    }
  }

  // 6. Per-location reference files at .claude/locations/*.md — these
  //    hold per-bar hardware IPs, channel maps, install quirks. Easy
  //    to miss because they're in a hidden directory. Agent inventory
  //    2026-05-18 surfaced 6 locations: holmgren-way, graystone,
  //    lucky-s-1313, stoneyard-greenville, stoneyard-appleton, leg-lamp.
  const locationsDir = path.join(REPO_ROOT, '.claude', 'locations')
  if (await fileExists(locationsDir)) {
    const locFiles = await fs.readdir(locationsDir)
    for (const f of locFiles) {
      if (f.endsWith('.md')) collected.add(path.join(locationsDir, f))
    }
  }

  // 7. ai-assistant/ directory — top-level deployment runbook,
  //    examples, README. Sibling to apps/ + packages/ so wasn't
  //    picked up by any of the above.
  const aiAssistantDir = path.join(REPO_ROOT, 'ai-assistant')
  if (await fileExists(aiAssistantDir)) {
    const aiFiles = await scanDocuments(aiAssistantDir)
    for (const f of aiFiles) {
      collected.add(f)
    }
  }

  // 8a. (v2.48.0) Build / runtime / deploy config files at repo root.
  //     These are short but answer "how is the build set up?" questions
  //     that operators ask the AI Hub. Worth their weight in chunks.
  for (const f of ['next.config.js', 'ecosystem.config.js', 'turbo.json',
                   'apps/web/drizzle.config.ts', 'apps/web/next.config.js',
                   'apps/web/jest.config.js', '.npmrc', '.gitignore']) {
    const full = path.join(REPO_ROOT, f)
    if (await fileExists(full)) collected.add(full)
  }

  // 8b. (v2.48.0) Drizzle migration SQL — captures schema EVOLUTION,
  //     not just current state. Lets the AI explain "when did column X
  //     appear / why does table Y have these constraints."
  const drizzleDir = path.join(REPO_ROOT, 'apps/web/drizzle')
  if (await fileExists(drizzleDir)) {
    try {
      const sqls = await fs.readdir(drizzleDir)
      for (const f of sqls) {
        if (f.endsWith('.sql') || f.endsWith('.json')) {
          collected.add(path.join(drizzleDir, f))
        }
      }
    } catch { /* skip */ }
  }

  // 8c. (v2.48.0) Operator-facing shell scripts — install/setup/health
  //     check / one-time bootstrap. Encode procedural knowledge the AI
  //     should be able to walk an operator through. Selective list to
  //     keep noise out (not /scripts/*.ts which are dev tools).
  for (const f of ['scripts/setup-iris-ollama.sh', 'scripts/setup-sdr.sh',
                   'scripts/setup-bartender-nginx.sh',
                   'scripts/bootstrap-new-location.sh',
                   'scripts/auto-update.sh', 'scripts/verify-install.sh',
                   'install.sh', 'DEPLOY_REMOTE_FIX.sh']) {
    const full = path.join(REPO_ROOT, f)
    if (await fileExists(full)) collected.add(full)
  }

  // 9. Each package may have docs/ or additional *.md beyond README.
  //    Walk packages/*/docs and packages/*/*.md (non-recursively past
  //    the package root so we don't pick up sub-package source).
  const pkgsDir = path.join(REPO_ROOT, 'packages')
  if (await fileExists(pkgsDir)) {
    const pkgs = await fs.readdir(pkgsDir, { withFileTypes: true })
    for (const pkg of pkgs) {
      if (!pkg.isDirectory()) continue
      // Any *.md at package root (beyond README.md)
      const pkgRoot = path.join(pkgsDir, pkg.name)
      try {
        const pkgFiles = await fs.readdir(pkgRoot, { withFileTypes: true })
        for (const f of pkgFiles) {
          if (f.isFile() && f.name.endsWith('.md')) {
            collected.add(path.join(pkgRoot, f.name))
          }
        }
        // packages/<name>/docs/ if it exists
        const pkgDocsDir = path.join(pkgRoot, 'docs')
        if (await fileExists(pkgDocsDir)) {
          const docsTree = await scanDocuments(pkgDocsDir)
          for (const f of docsTree) collected.add(f)
        }
      } catch { /* skip */ }
    }
  }

  // Filter excludes
  const filtered = Array.from(collected).filter((f) => {
    const lower = f.toLowerCase()
    return !EXCLUDE_PATTERNS.some((p) => lower.includes(p))
  })

  return filtered.sort()
}

async function main() {
  console.log('\n=== SYSTEM DOC SCANNER — populating RAG for full-system SME ===\n')

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
    console.log('\n3. Clearing existing chunks (--clear)...')
    await clearVectorStore()
    console.log('✓ Cleared')
  }

  console.log('\n4. Collecting files...')
  const files = await collectFiles()
  console.log(`✓ ${files.length} files in scope`)

  // Categorize for the log
  const byCategory: Record<string, number> = {
    'CLAUDE.md': 0,
    'docs/': 0,
    'packages/*/README': 0,
    'memory/': 0,
    'root *.md': 0,
    other: 0,
  }
  for (const f of files) {
    if (f.endsWith('CLAUDE.md')) byCategory['CLAUDE.md']++
    else if (f.includes('/docs/')) byCategory['docs/']++
    else if (f.includes('/packages/') && f.endsWith('README.md')) byCategory['packages/*/README']++
    else if (f.startsWith(MEMORY_ROOT)) byCategory['memory/']++
    else if (path.dirname(f) === REPO_ROOT) byCategory['root *.md']++
    else byCategory.other++
  }
  for (const [cat, n] of Object.entries(byCategory)) {
    if (n > 0) console.log(`    ${cat}: ${n}`)
  }

  console.log('\n5. Processing + indexing in batches of 5...')
  const batchSize = 5
  // Yield the iGPU between batches so an interactive Ollama request (AI Suggest,
  // shift-brief) can slip into the serialized single-GPU queue instead of waiting
  // behind the ENTIRE remaining scan. Without this, a doc-commit rescan running
  // during pre-shift starved AI Suggest into its 300s timeout (Holmgren
  // 2026-06-11). 1.2s default; tune via RAG_SCAN_BATCH_DELAY_MS (0 disables).
  const batchDelayMs = Number(process.env.RAG_SCAN_BATCH_DELAY_MS ?? 1200)
  let totalChunks = 0
  let totalDocs = 0
  const errors: string[] = []

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    const results = await processDocuments(batch)
    for (const r of results) {
      if (r.error) {
        errors.push(`${r.filename}: ${r.error}`)
        console.log(`    ❌ ${r.filename}: ${r.error}`)
        continue
      }
      if (r.chunks.length === 0) continue
      await addChunks(r.chunks)
      totalChunks += r.chunks.length
      totalDocs += 1
    }
    const pct = Math.round(((i + batch.length) / files.length) * 100)
    console.log(`    progress ${i + batch.length}/${files.length} (${pct}%) — chunks=${totalChunks}`)
    if (batchDelayMs > 0 && i + batchSize < files.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelayMs))
    }
  }

  const stats = await getVectorStoreStats()
  console.log('\n6. Final vector store:')
  console.log(`    total chunks:    ${stats.totalChunks}`)
  console.log(`    total documents: ${stats.totalDocuments}`)
  console.log(`    indexed this run: ${totalDocs} docs / ${totalChunks} chunks`)
  console.log(`    errors: ${errors.length}`)
  if (errors.length > 0) {
    console.log('\n  Errors:')
    for (const e of errors) console.log(`    - ${e}`)
  }
  console.log('\n✓ System-wide RAG indexed. The local AI now has SME context on:')
  console.log('  - All hardware integrations (Shure, SDR, Atlas, BSS, dbx, Wolfpack, Crestron, DirecTV, FireTV, IR, CEC)')
  console.log('  - All operator gotchas + project history (memory files)')
  console.log('  - All architecture docs (CLAUDE.md, docs/, package READMEs)')
  console.log('  - All API references, hardware setup guides, version setup steps')
  console.log('')
  console.log('  Test with: curl -X POST http://localhost:3001/api/rag/query \\')
  console.log('    -H "Content-Type: application/json" -d \'{"query":"..."}\'')
  console.log('')
}

// v2.52.3: explicit process.exit(0) on success path. Without this, Ollama
// keep_alive=-1 (v2.50.0) holds embedding-model HTTP keepalive sockets +
// module-level sqlite handle in packages/database keeps the event loop
// alive, so main() resolves but the process hangs forever. 4 zombies
// accumulated 2026-05-19 burning 22 CPU-min total + 1.4 GB RSS.
// See docs/AUTO_UPDATE_DESIGN_RULES.md.
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Fatal:', e)
    process.exit(1)
  })
