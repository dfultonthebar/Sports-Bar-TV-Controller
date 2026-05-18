#!/usr/bin/env tsx
/**
 * RF-specific RAG indexing — feeds Ollama the docs it needs to act
 * as a Shure / SDR / Atlas RF coordination SME.
 *
 * The default `npm run rag:scan` only scans `docs/`. RF expertise
 * lives in additional locations:
 *   - CLAUDE.md §7a (Shure) + §7b (SDR) + Gotcha #10
 *   - packages/shure-slxd/README.md (the SME protocol briefing)
 *   - Auto-memory feedback files about RF
 *   - The docs/ tree (LOCATION_UPDATE_NOTES, VERSION_SETUP_GUIDE,
 *     hardware refs)
 *
 * This script collects all of them into one explicit file list, runs
 * the same processDocuments + addChunks pipeline, and reports.
 * Idempotent — re-running just refreshes the chunks for the targeted
 * files. Use --clear to wipe + rebuild from scratch.
 *
 * Usage:
 *   npx tsx scripts/scan-rf-docs.ts
 *   npx tsx scripts/scan-rf-docs.ts --clear
 */

import path from 'path'
import fs from 'fs/promises'
import { scanDocuments, processDocuments } from '../apps/web/src/lib/rag-server/doc-processor'
import {
  clearVectorStore,
  addChunks,
  initializeVectorStore,
  getVectorStoreStats,
} from '../apps/web/src/lib/rag-server/vector-store'
import { testOllamaConnection } from '../apps/web/src/lib/rag-server/llm-client'

const REPO_ROOT = path.resolve(__dirname, '..')
const MEMORY_ROOT = '/home/ubuntu/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory'
const CLEAR = process.argv.includes('--clear')

// Explicit list of RF-coordination-relevant files. Add here when new
// material lands. Files that don't exist are silently skipped (so
// the script doesn't break when memory files are added/removed).
const RF_DOC_PATHS: string[] = [
  // The big architecture doc — CLAUDE.md §7a/§7b/Gotcha #10 live here
  path.join(REPO_ROOT, 'CLAUDE.md'),
  // SME-level protocol briefing
  path.join(REPO_ROOT, 'packages/shure-slxd/README.md'),
  // Atlas package README (zone/source/priority semantics)
  path.join(REPO_ROOT, 'packages/atlas/README.md'),
  // Per-release notes that explain WHY things are as they are
  path.join(REPO_ROOT, 'docs/LOCATION_UPDATE_NOTES.md'),
  path.join(REPO_ROOT, 'docs/VERSION_SETUP_GUIDE.md'),
  path.join(REPO_ROOT, 'docs/HARDWARE_CONFIGURATION.md'),
  // RF-related auto-memory feedback (what bit us + how to avoid)
  path.join(MEMORY_ROOT, 'feedback_atlas_azm8_no_priority_param.md'),
  path.join(MEMORY_ROOT, 'feedback_atlas_firmware_4_5_custom_priority_volume.md'),
  path.join(MEMORY_ROOT, 'feedback_watcher_cache_after_action.md'),
  path.join(MEMORY_ROOT, 'feedback_nextjs_per_bundle_singleton.md'),
  path.join(MEMORY_ROOT, 'feedback_safeboundary_for_new_panels.md'),
  path.join(MEMORY_ROOT, 'feedback_tdz_usecallback_useeffect_deps.md'),
  path.join(MEMORY_ROOT, 'feedback_browser_console_for_react_errors.md'),
  path.join(MEMORY_ROOT, 'feedback_nginx_allowlist_new_api_routes.md'),
  path.join(MEMORY_ROOT, 'project_shure_sdr_atlas_rf_pipeline.md'),
  path.join(MEMORY_ROOT, 'project_holmgren_way.md'),
]

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

async function main() {
  console.log('\n=== RF Doc Scanner — populating RAG store for Shure/SDR/Atlas SME ===\n')

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

  console.log('\n4. Building RF doc file list...')
  const candidates = [...RF_DOC_PATHS]

  // Also pull in everything under docs/ that mentions RF, Shure, SDR,
  // Atlas, or wireless — captures any future docs without needing
  // to re-edit this script.
  const docsDir = path.join(REPO_ROOT, 'docs')
  if (await fileExists(docsDir)) {
    const docsTree = await scanDocuments(docsDir)
    for (const f of docsTree) {
      const lower = f.toLowerCase()
      if (/shure|sdr|atlas|wireless|rf|mic|spectrum|frequency/.test(lower)) {
        candidates.push(f)
      }
    }
  }

  const existing: string[] = []
  for (const f of candidates) {
    if (await fileExists(f)) existing.push(f)
  }
  const unique = Array.from(new Set(existing))
  console.log(`✓ ${unique.length} RF-relevant files found (${candidates.length - unique.length} skipped — missing or duplicates)`)
  unique.forEach((f) => console.log(`    ${f.replace(REPO_ROOT, '').replace(MEMORY_ROOT, '<memory>')}`))

  console.log('\n5. Processing + indexing...')
  const results = await processDocuments(unique)
  let totalChunks = 0
  let totalDocs = 0
  for (const r of results) {
    if (r.error) {
      console.log(`    ❌ ${r.filename}: ${r.error}`)
      continue
    }
    if (r.chunks.length === 0) {
      console.log(`    ⚠  ${r.filename}: empty`)
      continue
    }
    await addChunks(r.chunks)
    totalChunks += r.chunks.length
    totalDocs += 1
    console.log(`    ✓ ${r.filename}: ${r.chunks.length} chunks${r.techTags.length ? ` [${r.techTags.join(', ')}]` : ''}`)
  }

  const stats = await getVectorStoreStats()
  console.log('\n6. Final vector store:')
  console.log(`    total chunks:    ${stats.totalChunks}`)
  console.log(`    total documents: ${stats.totalDocuments}`)
  console.log(`    indexed this run: ${totalDocs} docs / ${totalChunks} chunks`)
  console.log('\n✓ RF docs indexed. Pattern digest will now ground its analysis in:')
  console.log('  - Shure SLX-D protocol details (TX_MODEL, GROUP_CHANNEL, no-network-scan, etc.)')
  console.log('  - SDR architecture + cross-confirmation semantics')
  console.log('  - Atlas firmware 4.5 Custom Priority Volume gotcha')
  console.log('  - Holmgren-specific TV station + freq context')
  console.log('  - Operator history of mitigations + known gotchas\n')
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
