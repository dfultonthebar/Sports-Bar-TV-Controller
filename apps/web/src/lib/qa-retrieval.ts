/**
 * QA-first retrieval helper for the bartender chat path. v2.54.50.
 *
 * Grok audit follow-up #1: the 36 curated bartender Q&A pairs seeded
 * by scripts/seed-bartender-qa.ts were sitting in the QAEntry table
 * but the chat route's RAG path (apps/web/src/app/api/chat/route.ts ->
 * searchDocsViaRag -> retrieveContext -> searchHybrid) ignored them
 * entirely. Pure cosine-on-doc-chunks meant the bartender voice the
 * curated answers carry got diluted by neighboring CLAUDE.md / runbook
 * chunks even when the question was an exact match for a curated one.
 *
 * This helper does a fast in-memory match against the cached curated
 * pool. If a confident hit is found, the chat route uses ONLY the QA
 * as context (LLM still re-narrates but in the curated bartender
 * voice). Moderate hits prepend the QA as the highest-ranked source
 * with vector chunks supplying additional context. Misses pass through.
 *
 * Why in apps/web/ and not packages/rag-server/: rag-server doesn't
 * depend on @sports-bar/database (and shouldn't — it's the search
 * engine, not the data layer). The chat route already imports both;
 * the adapter pattern keeps the package graph clean.
 */
import { db, schema } from '@sports-bar/database'
import { and, eq, like } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

const CACHE_TTL_MS = 5 * 60 * 1000

interface QARow {
  id: string
  question: string
  answer: string
  sourceFile: string | null
  category: string
}

interface Cache {
  rows: QARow[]
  loadedAt: number
}

// Per-bundle module singleton is fine here: cache stale = next request
// just re-fetches. No cross-bundle correctness risk (Gotcha #10 doesn't
// apply to read-only caches that can refresh independently).
let cache: Cache | null = null

async function loadActiveCuratedQAs(): Promise<QARow[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.rows
  }
  const rows = await db
    .select({
      id: schema.qaEntries.id,
      question: schema.qaEntries.question,
      answer: schema.qaEntries.answer,
      sourceFile: schema.qaEntries.sourceFile,
      category: schema.qaEntries.category,
    })
    .from(schema.qaEntries)
    .where(
      and(
        eq(schema.qaEntries.isActive, true),
        like(schema.qaEntries.sourceType, 'curated_bartender_%'),
      ),
    )
  cache = { rows, loadedAt: Date.now() }
  return rows
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'i', 'you', 'it', 'we', 'they', 'me', 'my', 'your', 'our', 'their',
  'to', 'in', 'on', 'at', 'of', 'for', 'and', 'or', 'but',
  'do', 'does', 'did', 'doing', 'done',
  'how', 'what', 'where', 'when', 'why', 'who', 'which',
  'this', 'that', 'these', 'those',
  'can', 'could', 'should', 'would', 'will', 'shall',
  'have', 'has', 'had',
  'so', 'if', 'then',
])

// Crude suffix stripper — catches "work" vs "working", "swap" vs "swapping",
// "battery" vs "batteries", "fix" vs "fixed". Not a real stemmer (Porter
// would be overkill for 36 hand-written QA questions), but enough to close
// the obvious singular/plural + verb-tense gaps that the smoke test caught.
function stem(t: string): string {
  if (t.length <= 3) return t
  if (t.endsWith('ies') && t.length > 4) return t.slice(0, -3) + 'y'
  if (t.endsWith('ing') && t.length > 5) return t.slice(0, -3)
  if (t.endsWith('ed') && t.length > 4) return t.slice(0, -2)
  if (t.endsWith('es') && t.length > 4) return t.slice(0, -2)
  if (t.endsWith('s') && t.length > 4) return t.slice(0, -1)
  return t
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
      .map(stem),
  )
}

function score(queryTokens: Set<string>, qaTokens: Set<string>): number {
  if (queryTokens.size === 0 || qaTokens.size === 0) return 0
  let intersection = 0
  for (const t of queryTokens) {
    if (qaTokens.has(t)) intersection++
  }
  const union = queryTokens.size + qaTokens.size - intersection
  const jaccard = intersection / union
  const coverage = intersection / queryTokens.size
  return 0.5 * jaccard + 0.5 * coverage
}

export interface QAMatch {
  id: string
  question: string
  answer: string
  sourceFile: string
  score: number
  matchType: 'confident' | 'moderate'
}

export const QA_CONFIDENT_THRESHOLD = 0.55
export const QA_MODERATE_THRESHOLD = 0.40

export async function findBestQAMatch(query: string): Promise<QAMatch | null> {
  const rows = await loadActiveCuratedQAs()
  if (rows.length === 0) return null

  const qTokens = tokenize(query)
  if (qTokens.size === 0) return null

  let best: { row: QARow; s: number } | null = null
  for (const row of rows) {
    const qaTokens = tokenize(row.question)
    const s = score(qTokens, qaTokens)
    if (!best || s > best.s) best = { row, s }
  }

  if (!best || best.s < QA_MODERATE_THRESHOLD) return null

  return {
    id: best.row.id,
    question: best.row.question,
    answer: best.row.answer,
    sourceFile: best.row.sourceFile ?? 'docs/bartender-help/',
    score: best.s,
    matchType: best.s >= QA_CONFIDENT_THRESHOLD ? 'confident' : 'moderate',
  }
}

export function recordQAHit(id: string): void {
  void (async () => {
    try {
      const row = await db
        .select({ useCount: schema.qaEntries.useCount })
        .from(schema.qaEntries)
        .where(eq(schema.qaEntries.id, id))
        .limit(1)
      const next = (row[0]?.useCount ?? 0) + 1
      await db
        .update(schema.qaEntries)
        .set({ useCount: next, lastUsed: new Date() })
        .where(eq(schema.qaEntries.id, id))
    } catch (err) {
      logger.warn(`[QA-RETRIEVAL] recordQAHit failed for ${id}: ${(err as Error)?.message ?? err}`)
    }
  })()
}

// Mirror of vector-store.ts:303 BARTENDER_MARKERS so the chat-route
// adapter can decide whether to run the QA pre-pass without importing
// from the rag-server package internals. Keep in sync with vector-store.
//
// v2.54.50 broadening (smoke test caught 5 missed phrasings out of 14):
// - "doesn't work" (alongside "isn't working" / "not working")
// - "what does/should/is/are" (alongside "what do i do")
// - "the (banner|lights|patio|bar|tab|game|channel)" topic markers
// - "tv N" pattern (operator says "TV 7 wrong game" without "the")
// - "wrong" as topic marker (wrong game, wrong channel, wrong source)
// - "fire alarm" / "emergency" as urgency markers
// Bartender-register false positives are CHEAP — the QA pre-pass returns
// null on no match and the chat path falls through to vector RAG anyway.
const BARTENDER_MARKERS = /\b(isn'?t working|not working|doesn'?t work|won'?t (come up|turn on|play|work)|no (sound|signal|video|audio|music|picture)|the (tv|mic|music|sound|banner|lights|patio|bar|tab|game|channel)|\btv\s*\d+\b|stopped|broken|stuck|frozen|wrong|i (pressed|tried|just|don'?t know)|how (do|can|to|i|you)|what (do|does|should|is|are)|where (is|do)|fix|trouble|interferen|wireless|channel scan|group scan|help|fire alarm|emergency|clock in)\b/

export function looksLikeBartenderQuery(query: string): boolean {
  return BARTENDER_MARKERS.test(query.toLowerCase())
}
