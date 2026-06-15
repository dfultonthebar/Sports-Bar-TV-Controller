#!/usr/bin/env node
/**
 * check-stale-docs.mjs — flag code-grounded docs whose source code changed.
 *
 * Reads docs/doc-source-map.json (doc -> source files/globs). Given a set of
 * changed files (from a git range or --files), reports every doc whose mapped
 * sources were touched, so it can be refreshed before it rots.
 *
 * Part of the self-updating docs system — see docs/SELF_UPDATING_DOCS.md.
 * Called by scripts/auto-update.sh after a successful merge, and by the weekly
 * doc-audit cron. Always exits 0 (non-fatal); signals via stdout + optional TODO.
 *
 * Usage:
 *   node scripts/docs/check-stale-docs.mjs --since <ref>        # diff <ref>...HEAD
 *   node scripts/docs/check-stale-docs.mjs --files a.ts,b.tsx   # explicit changed files
 *   node scripts/docs/check-stale-docs.mjs --all                # flag every mapped doc
 *   node scripts/docs/check-stale-docs.mjs --since <ref> --file-todo   # also POST a TODO
 *   flags: --json  --api <url>(default http://localhost:3001)  --repo <path>
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const getFlag = (name) => args.includes(name)
const getOpt = (name, def) => {
  const i = args.indexOf(name)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def
}

const REPO = resolve(getOpt('--repo', resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')))
const API = getOpt('--api', 'http://localhost:3001')
const SINCE = getOpt('--since', null)
const FILES = getOpt('--files', null)
const ALL = getFlag('--all')
const JSON_OUT = getFlag('--json')
const FILE_TODO = getFlag('--file-todo')

const mapPath = resolve(REPO, 'docs/doc-source-map.json')
if (!existsSync(mapPath)) {
  console.error(`[check-stale-docs] no manifest at ${mapPath}`)
  process.exit(0)
}
const manifest = JSON.parse(readFileSync(mapPath, 'utf8'))
const docs = manifest.docs || []

// --- determine the changed file set -------------------------------------------------
let changed = []
if (ALL) {
  changed = null // sentinel: everything matches
} else if (FILES) {
  changed = FILES.split(',').map((s) => s.trim()).filter(Boolean)
} else if (SINCE) {
  try {
    const out = execSync(`git -C "${REPO}" diff --name-only ${SINCE}...HEAD`, { encoding: 'utf8' })
    changed = out.split('\n').map((s) => s.trim()).filter(Boolean)
  } catch (e) {
    console.error(`[check-stale-docs] git diff failed for "${SINCE}": ${e.message}`)
    process.exit(0)
  }
} else {
  console.error('[check-stale-docs] need one of --since <ref> | --files a,b | --all')
  process.exit(0)
}

// --- glob matcher: exact, "dir/**" (recursive), "dir/*" (direct), "prefix*" ----------
function sourceMatches(source, file) {
  if (source === file) return true
  if (source.endsWith('/**')) {
    const base = source.slice(0, -3)
    return file === base || file.startsWith(base + '/')
  }
  if (source.endsWith('/*')) {
    const base = source.slice(0, -2)
    if (!file.startsWith(base + '/')) return false
    return !file.slice(base.length + 1).includes('/')
  }
  if (source.endsWith('*')) return file.startsWith(source.slice(0, -1))
  return false
}

// --- evaluate each doc ---------------------------------------------------------------
const stale = []
const driftWarnings = []
for (const entry of docs) {
  const { doc, sources = [] } = entry
  if (!existsSync(resolve(REPO, doc))) {
    driftWarnings.push(`doc missing on disk: ${doc}`)
    continue
  }
  let hits
  if (changed === null) {
    hits = sources.slice() // --all
  } else {
    hits = []
    for (const f of changed) {
      if (sources.some((s) => sourceMatches(s, f))) hits.push(f)
    }
  }
  if (hits.length) stale.push({ doc, changedSources: [...new Set(hits)] })
}

// --- output --------------------------------------------------------------------------
if (JSON_OUT) {
  console.log(JSON.stringify({ stale, driftWarnings, scanned: docs.length }, null, 2))
} else {
  if (driftWarnings.length) {
    console.log('[check-stale-docs] drift warnings:')
    driftWarnings.forEach((w) => console.log(`  ⚠ ${w}`))
  }
  if (stale.length === 0) {
    console.log(`[check-stale-docs] no docs stale (${docs.length} mapped).`)
  } else {
    console.log(`[check-stale-docs] ${stale.length} doc(s) need refresh — source code changed:`)
    for (const s of stale) {
      console.log(`  • ${s.doc}`)
      s.changedSources.forEach((f) => console.log(`        ↳ ${f}`))
    }
  }
}

// --- optional: file ONE aggregated refresh TODO (best-effort, non-fatal) --------------
if (FILE_TODO && stale.length > 0) {
  const lines = stale
    .map((s) => `- ${s.doc}\n    changed: ${s.changedSources.join(', ')}`)
    .join('\n')
  const body =
    `Source code changed for ${stale.length} documented feature(s); refresh the doc(s) so they don't rot ` +
    `(re-trace via ask_claude_code, rewrite in place, RAG rescan). See docs/SELF_UPDATING_DOCS.md.\n\n${lines}`
  const payload = {
    title: `Refresh ${stale.length} stale doc(s) — feature code changed`,
    description: body,
    priority: 'MEDIUM',
    status: 'PLANNED',
    category: 'documentation',
    tags: ['docs-stale', 'self-updating-docs', 'auto'],
  }
  try {
    const res = await fetch(`${API}/api/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    console.log(`[check-stale-docs] refresh TODO filed: HTTP ${res.status}`)
  } catch (e) {
    console.log(`[check-stale-docs] could not file TODO (non-fatal): ${e.message}`)
  }
}

process.exit(0)
