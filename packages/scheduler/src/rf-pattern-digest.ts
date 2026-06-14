/**
 * RF Pattern Digest (v2.52.14 — Tier 3 AI integration)
 *
 * Daily Ollama-powered summary of the bar's RF environment. Pulls 24h
 * of SDR carriers + Shure events + matched NeighborhoodEvent rows,
 * formats a structured prompt, calls qwen2.5:14b (the local-AI model
 * already loaded in memory per v2.50.0's keep_alive=-1), and stores
 * the bartender-grade summary in rf_pattern_digest.
 *
 * Read by the bartender Audio tab's RF Pattern Digest card.
 *
 * Design choices:
 * - 24h window (one digest per day): keeps prompt size bounded + gives
 *   enough data to find patterns without overwhelming the LLM.
 * - Aggregates BEFORE LLM: we coalesce / count / cluster on the SQL
 *   side, then feed the LLM a digestible structured summary. The LLM's
 *   job is interpretation + bartender translation, not data crunching.
 * - Bartender voice in prompt: "Pretend you're explaining this to a
 *   bartender who doesn't know what dBm means. Stick to plain English."
 * - Stores both prose (summary_text) AND structured findings JSON so
 *   the UI can render badges + chart + prose independently.
 */

import { db, sql, schema } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
// v2.52.21: shared helpers (was inlined in gatherRawCounts; same code as
// interference-correlator + preemptive-strike — now one source).
import { getShureFreqsMhz, buildFreqBandClauses, SHURE_FREQ_MATCH_MHZ } from './shure-freq-utils'

// v2.52.20 fix (audit M1): create rf_pattern_digest at runtime if it
// doesn't already exist. Pre-fix relied entirely on `drizzle-kit push`
// for table creation — fresh installs OR locations that skipped the
// push step (CLAUDE.md Gotcha #6) would throw "no such table" on the
// first INSERT and never recover. Mirrors sdr-watcher.ts's
// ensureTables() pattern.
let tableEnsured = false
async function ensureDigestTable(): Promise<void> {
  if (tableEnsured) return
  try {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS rf_pattern_digest (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        period_start INTEGER NOT NULL,
        period_end INTEGER NOT NULL,
        summary_text TEXT NOT NULL,
        structured_findings TEXT,
        model_used TEXT NOT NULL,
        prompt_token_count INTEGER,
        completion_token_count INTEGER,
        generation_ms INTEGER,
        generated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      )
    `)
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS rf_pattern_digest_location_idx
      ON rf_pattern_digest(location_id, generated_at DESC)
    `)
    tableEnsured = true
  } catch (err) {
    logger.error('[RF-DIGEST] ensureDigestTable failed:', (err as Error)?.message ?? err)
  }
}

// v2.52.20 fix (audit security #1): sanitize LLM-interpolated free-form
// strings (venue + artist names from external scrapers). Strips
// newlines, control chars, and length-caps at 80 chars. Without this,
// a crafted venue name like `"} Ignore previous instructions and ...`
// could derail the LLM into outputting misleading operator instructions
// stored verbatim in rf_pattern_digest.summary_text + rendered on the
// bartender screen. The output is operator-facing only (no code-exec
// path) but misleading "all mics broken" text on a bartender screen is
// a concrete harm.
function sanitizeForLlmContext(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/```+/g, "'''")  // neutralize fenced-block injection
    .slice(0, 80)
    .trim()
}

// v2.52.17: switched from qwen2.5:14b (9 GB) to llama3.1:8b (5 GB) so
// the daily digest shares the SAME resident model as everything else
// (shift-brief, ai-suggest, chat). Pre-v2.52.17 had both models pinned
// via keep_alive=-1, totaling 14 GB resident — pushed Holmgren into
// 7.8/8 GB swap thrash, which slowed every Ollama call to 30+ sec.
// llama3.1:8b's output quality is plenty for the bartender-grade
// summary; qwen2.5:14b's extra capacity was wasted on this prompt.
// Operator can override via env if a location has more RAM headroom.
const DEFAULT_MODEL = process.env.RF_DIGEST_MODEL ?? 'llama3.1:8b'
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const PERIOD_HOURS = 24

interface ShureCount {
  artist_normalized: string | null
  artist_name: string | null
  venue_name: string | null
  distance_mi: number | null
  attribution_count: number
  avg_confidence: number
  source_breakdown: string // "shure: N, sdr: M"
}

interface UpcomingEvent {
  artist_name: string
  venue_name: string
  start_time: number
  distance_mi: number | null
  has_profile: number
}

interface RawCounts {
  shureEvents24h: number
  sdrCarriers24h: number
  sdrCarriersOnOurFreqs24h: number
  attributionsToday: number
  topInterferers: ShureCount[]
  upcomingEvents24h: UpcomingEvent[]
  ourShureFreqs: number[]
  hottestSdrFreqsLast24h: Array<{ freq_mhz: number; avg_dbm: number; hot_minutes: number }>
}

async function gatherRawCounts(locationId: string): Promise<RawCounts> {
  const nowSec = Math.floor(Date.now() / 1000)
  const periodStart = nowSec - PERIOD_HOURS * 3600

  // v2.52.21: shared util (was duplicate of interference-correlator's
  // getOurShureFreqsForCorrelation + preemptive-strike's getCurrentShureFreqs).
  const ourShureFreqs = await getShureFreqsMhz()

  // 24h Shure RF event count
  let shureEvents24h = 0
  try {
    const r = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM shure_rf_events
      WHERE detected_at >= ${periodStart}
        AND event_type = 'rf_interference'
    `)
    shureEvents24h = r[0]?.n ?? 0
  } catch { /* table missing */ }

  // 24h SDR carrier_active count (total, then narrowed to our freqs)
  let sdrCarriers24h = 0
  try {
    const r = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM sdr_carriers
      WHERE detected_at >= ${periodStart}
        AND event_type = 'carrier_active'
    `)
    sdrCarriers24h = r[0]?.n ?? 0
  } catch { /* table missing */ }

  let sdrCarriersOnOurFreqs24h = 0
  if (ourShureFreqs.length > 0) {
    try {
      // v2.52.21: shared buildFreqBandClauses + canonical tolerance
      // constant (was hardcoded 0.1 here — risk of drift if the
      // correlator's tolerance changed).
      const freqBandClause = buildFreqBandClauses(ourShureFreqs, SHURE_FREQ_MATCH_MHZ)!
      const r = await db.all<{ n: number }>(sql`
        SELECT COUNT(*) AS n FROM sdr_carriers
        WHERE detected_at >= ${periodStart}
          AND event_type = 'carrier_active'
          AND (${freqBandClause})
      `)
      sdrCarriersOnOurFreqs24h = r[0]?.n ?? 0
    } catch { /* table missing */ }
  }

  let topInterferers: ShureCount[] = []
  try {
    topInterferers = await db.all<ShureCount>(sql`
      SELECT
        ne.artist_normalized,
        ne.artist_name,
        nv.name AS venue_name,
        nv.distance_mi,
        COUNT(*) AS attribution_count,
        AVG(ia.confidence) AS avg_confidence,
        GROUP_CONCAT(ia.source) AS source_breakdown
      FROM InterferenceAttribution ia
      INNER JOIN NeighborhoodEvent ne ON ne.id = ia.neighborhood_event_id
      INNER JOIN NeighborhoodVenue nv ON nv.id = ne.venue_id
      WHERE ia.created_at >= ${periodStart}
      GROUP BY ne.artist_normalized
      ORDER BY attribution_count DESC, avg_confidence DESC
      LIMIT 5
    `)
  } catch { /* table missing */ }
  const attributionsToday = topInterferers.reduce((sum, r) => sum + (r.attribution_count ?? 0), 0)

  let upcomingEvents24h: UpcomingEvent[] = []
  try {
    // v2.55.15: cap upcoming-event relevance to RF_MIC_RELEVANT_RADIUS_MI.
    // The Ticketmaster scraper pulls a 30-mi radius for general awareness,
    // but wireless mics / ENG rigs only step on our UHF band from a mile or
    // two away — a stadium game 30 mi out has ZERO RF relevance and was a
    // false positive in the digest (operator caught the Timber Rattlers @30mi).
    // Venues with unknown distance (NULL) are excluded — we can't claim RF
    // relevance we can't confirm.
    const RF_MIC_RELEVANT_RADIUS_MI = 2.0
    upcomingEvents24h = await db.all<UpcomingEvent>(sql`
      SELECT
        ne.artist_name,
        nv.name AS venue_name,
        ne.start_time,
        nv.distance_mi,
        CASE WHEN aip.confidence IS NOT NULL AND aip.confidence >= 0.6 THEN 1 ELSE 0 END AS has_profile
      FROM NeighborhoodEvent ne
      INNER JOIN NeighborhoodVenue nv ON nv.id = ne.venue_id
      LEFT JOIN ArtistInterferenceProfile aip
        ON aip.artist_normalized = ne.artist_normalized
        AND aip.location_id = ${locationId}
      WHERE ne.start_time > ${nowSec}
        AND ne.start_time < ${nowSec + 24 * 3600}
        AND nv.distance_mi IS NOT NULL
        AND nv.distance_mi <= ${RF_MIC_RELEVANT_RADIUS_MI}
      ORDER BY ne.start_time ASC
      LIMIT 10
    `)
  } catch { /* table missing */ }

  let hottestSdrFreqsLast24h: Array<{ freq_mhz: number; avg_dbm: number; hot_minutes: number }> = []
  try {
    hottestSdrFreqsLast24h = await db.all<{ freq_mhz: number; avg_dbm: number; hot_minutes: number }>(sql`
      SELECT
        ROUND(freq_mhz * 4) / 4 AS freq_mhz,
        AVG(max_dbm) AS avg_dbm,
        SUM(CASE WHEN max_dbm > -75 THEN 1 ELSE 0 END) AS hot_minutes
      FROM sdr_spectrum
      WHERE detected_at >= ${periodStart}
      GROUP BY ROUND(freq_mhz * 4) / 4
      HAVING avg_dbm > -75
      ORDER BY avg_dbm DESC
      LIMIT 8
    `)
  } catch { /* table missing */ }

  return {
    shureEvents24h,
    sdrCarriers24h,
    sdrCarriersOnOurFreqs24h,
    attributionsToday,
    topInterferers,
    upcomingEvents24h,
    ourShureFreqs,
    hottestSdrFreqsLast24h,
  }
}

function formatPromptForLlm(counts: RawCounts): string {
  const freqList =
    counts.ourShureFreqs.length > 0
      ? counts.ourShureFreqs.map((f) => `${f} MHz`).join(', ')
      : 'no Shure receivers configured'

  const topInterferersStr = counts.topInterferers.length === 0
    ? '  (none)'
    : counts.topInterferers
        .map(
          (r) =>
            `  - ${sanitizeForLlmContext(r.artist_name ?? r.artist_normalized ?? '?')} at ${sanitizeForLlmContext(r.venue_name ?? '?')} (${(r.distance_mi ?? 0).toFixed(2)} mi): ${r.attribution_count} attributions, avg confidence ${(r.avg_confidence ?? 0).toFixed(2)}, sources [${r.source_breakdown ?? '?'}]`,
        )
        .join('\n')

  const upcomingStr = counts.upcomingEvents24h.length === 0
    ? '  (no events in next 24h within the neighborhood)'
    : counts.upcomingEvents24h
        .map((e) => {
          const hoursAway = ((e.start_time - Math.floor(Date.now() / 1000)) / 3600).toFixed(1)
          return `  - ${sanitizeForLlmContext(e.artist_name)} at ${sanitizeForLlmContext(e.venue_name)} in ${hoursAway}h (${(e.distance_mi ?? 0).toFixed(2)} mi)${e.has_profile ? ' [KNOWN INTERFERER]' : ''}`
        })
        .join('\n')

  const hottestStr = counts.hottestSdrFreqsLast24h.length === 0
    ? '  (no hot freqs detected in last 24h)'
    : counts.hottestSdrFreqsLast24h
        .map((r) => `  - ${r.freq_mhz} MHz: avg ${r.avg_dbm.toFixed(0)} dBm, hot ${r.hot_minutes} min`)
        .join('\n')

  return `You are summarizing the last 24 hours of RF activity at a sports bar for the BARTENDER, who manages wireless microphones but doesn't know radio engineering jargon. Keep your response under 6 sentences. Plain English. No "dBm" or "freq" — say "channel" and "signal strength."

DATA FROM THE LAST 24 HOURS:

- Our wireless mic channels are tuned to: ${freqList}
- Shure receiver detected ${counts.shureEvents24h} interference events on our mic channels
- The SDR (wide-band scanner) saw ${counts.sdrCarriers24h} total radio carriers across the band; ${counts.sdrCarriersOnOurFreqs24h} of those were close enough to our mic channels to actually interfere
- ${counts.attributionsToday} of those events have been attributed to specific nearby bands/DJs:
${topInterferersStr}

UPCOMING NEXT 24 HOURS at nearby venues:
${upcomingStr}

HOTTEST FREQUENCIES THE SDR SAW (avg power):
${hottestStr}

WRITE A 3-6 SENTENCE BARTENDER-GRADE SUMMARY:
1. Is the RF environment quiet, busy, or noisy right now? Plain language.
2. Were there any specific incidents worth mentioning? Name the band/DJ if known.
3. Are there any upcoming gigs in the next 24h that might cause mic problems? If yes, suggest preparing.
4. If everything is fine, say so concisely.

Skip greetings + sign-offs. Just the summary.`
}

interface DigestResult {
  id: string | null
  summaryText: string
  modelUsed: string
  generationMs: number
  promptTokenCount: number | null
  completionTokenCount: number | null
}

async function callOllama(prompt: string, model: string): Promise<{ text: string; promptTokens: number | null; completionTokens: number | null; ms: number }> {
  const start = Date.now()
  // v2.52.19 fix (audit H3): add AbortSignal.timeout. Pre-fix had NO
  // timeout, so if Ollama was busy loading another model into VRAM the
  // fetch hung indefinitely. POST /api/sdr/digest would never return,
  // leaving the operator on a spinner until PM2 keep-alive killed it.
  // shift-brief had this timeout from day one; this matches.
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      // keep_alive=-1 per v2.50.0 — keeps the model resident.
      keep_alive: -1,
      options: { temperature: 0.4, num_predict: 400 },
    }),
  })
  const ms = Date.now() - start
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text().catch(() => 'unknown')}`)
  const data = (await res.json()) as any
  return {
    text: (data.response ?? '').trim(),
    promptTokens: typeof data.prompt_eval_count === 'number' ? data.prompt_eval_count : null,
    completionTokens: typeof data.eval_count === 'number' ? data.eval_count : null,
    ms,
  }
}

export async function generateRfPatternDigest(opts?: {
  locationId?: string
  model?: string
}): Promise<DigestResult> {
  const locationId = opts?.locationId ?? process.env.LOCATION_ID ?? 'default-location'
  const model = opts?.model ?? DEFAULT_MODEL
  const periodEnd = Math.floor(Date.now() / 1000)
  const periodStart = periodEnd - PERIOD_HOURS * 3600

  logger.info(`[RF-DIGEST] generating for location ${locationId}, model ${model}, ${PERIOD_HOURS}h window`)

  await ensureDigestTable() // v2.52.20: runtime CREATE IF NOT EXISTS

  const counts = await gatherRawCounts(locationId)
  const prompt = formatPromptForLlm(counts)

  let summary = ''
  let ms = 0
  let promptTokens: number | null = null
  let completionTokens: number | null = null
  try {
    const llm = await callOllama(prompt, model)
    summary = llm.text
    ms = llm.ms
    promptTokens = llm.promptTokens
    completionTokens = llm.completionTokens
  } catch (err: any) {
    logger.error(`[RF-DIGEST] Ollama call failed: ${err?.message ?? err}`)
    // Fallback summary so the digest row still lands (operator can see
    // "model unavailable" rather than no card at all).
    summary = `RF digest could not be generated (Ollama unavailable: ${err?.message ?? 'unknown error'}). Raw counts: ${counts.shureEvents24h} Shure events, ${counts.sdrCarriers24h} SDR carriers (${counts.sdrCarriersOnOurFreqs24h} on our freqs), ${counts.attributionsToday} attributions, ${counts.upcomingEvents24h.length} upcoming events.`
  }

  if (!summary) {
    summary = '(empty LLM response — check Ollama logs)'
  }

  const id = crypto.randomUUID()
  const structured = JSON.stringify({
    counts: {
      shureEvents24h: counts.shureEvents24h,
      sdrCarriers24h: counts.sdrCarriers24h,
      sdrCarriersOnOurFreqs24h: counts.sdrCarriersOnOurFreqs24h,
      attributionsToday: counts.attributionsToday,
    },
    ourShureFreqs: counts.ourShureFreqs,
    topInterferers: counts.topInterferers.slice(0, 3),
    upcomingEvents: counts.upcomingEvents24h.slice(0, 5),
    hottestFreqs: counts.hottestSdrFreqsLast24h.slice(0, 5),
  })

  await db.run(sql`
    INSERT INTO rf_pattern_digest (
      id, location_id, period_start, period_end,
      summary_text, structured_findings, model_used,
      prompt_token_count, completion_token_count, generation_ms
    ) VALUES (
      ${id}, ${locationId}, ${periodStart}, ${periodEnd},
      ${summary}, ${structured}, ${model},
      ${promptTokens}, ${completionTokens}, ${ms}
    )
  `)

  logger.info(`[RF-DIGEST] stored digest ${id} (${ms}ms, ${completionTokens ?? '?'} tokens out): ${summary.slice(0, 80)}...`)

  return {
    id,
    summaryText: summary,
    modelUsed: model,
    generationMs: ms,
    promptTokenCount: promptTokens,
    completionTokenCount: completionTokens,
  }
}
