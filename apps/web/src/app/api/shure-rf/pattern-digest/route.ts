/**
 * POST /api/shure-rf/pattern-digest  (cached, on-demand AI summary)
 * GET  /api/shure-rf/pattern-digest  (returns cached result, no Ollama call)
 *
 * Stage 1 of the AI interference-detection pipeline. Bundles the last
 * N days of shure_rf_events + the new shure_rf_baseline rows, computes
 * structured summary stats (per channel, hour-of-day, day-of-week,
 * frequency), and hands them to Ollama with a focused prompt asking
 * for recurring-pattern identification + mitigation suggestions.
 *
 * Cached for 1 hour because:
 *  - Ollama inference on iGPU takes 60-180s — bad UX to run on every
 *    page load.
 *  - The underlying data only changes when new RF events fire; a
 *    fresh analysis every hour is more than enough.
 *
 * Cache lives in `shure_rf_pattern_cache` (single-row table — same
 * pattern as other lazy-init tables in this codebase).
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { requireAuth } from '@/lib/auth'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

const DEFAULT_WINDOW_DAYS = 30
const CACHE_TTL_SECS = 60 * 60 // 1 hour
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL_SHURE || 'llama3.1:8b'

type RfEventRow = {
  receiver_name: string | null
  channel: number
  event_type: string
  rssi_dbm: number | null
  frequency_mhz: number | null
  tx_type: string | null
  detected_at: number
}

type Bucket = {
  count: number
  channels: Set<number>
  freqs: Set<number>
  totalRssi: number
  rssiCount: number
}

async function ensureCacheTable(): Promise<void> {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS shure_rf_pattern_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      generated_at INTEGER NOT NULL,
      window_days INTEGER NOT NULL,
      event_count INTEGER NOT NULL,
      digest_text TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      model TEXT NOT NULL
    )
  `)
}

function computeStats(rows: RfEventRow[]): {
  totalEvents: number
  byEventType: Record<string, number>
  byChannel: Record<number, number>
  byHour: Record<number, number>
  byDayOfWeek: Record<number, number>
  byFreqBucket: Record<string, number>
  worstFrequencies: Array<{ freq: number; count: number; avgRssi: number | null }>
  noteworthy: string[]
} {
  const byEventType: Record<string, number> = {}
  const byChannel: Record<number, number> = {}
  const byHour: Record<number, number> = {}
  const byDayOfWeek: Record<number, number> = {}
  const byFreq: Map<number, Bucket> = new Map()

  for (const r of rows) {
    byEventType[r.event_type] = (byEventType[r.event_type] ?? 0) + 1
    byChannel[r.channel] = (byChannel[r.channel] ?? 0) + 1
    const d = new Date(r.detected_at * 1000)
    const hour = d.getHours()
    const dow = d.getDay()
    byHour[hour] = (byHour[hour] ?? 0) + 1
    byDayOfWeek[dow] = (byDayOfWeek[dow] ?? 0) + 1

    if (r.frequency_mhz !== null) {
      // Round to nearest 25 kHz step (SLX-D tuning grid).
      const bucket = Math.round(r.frequency_mhz * 40) / 40
      let b = byFreq.get(bucket)
      if (!b) {
        b = { count: 0, channels: new Set(), freqs: new Set(), totalRssi: 0, rssiCount: 0 }
        byFreq.set(bucket, b)
      }
      b.count += 1
      b.channels.add(r.channel)
      b.freqs.add(r.frequency_mhz)
      if (r.rssi_dbm !== null) {
        b.totalRssi += r.rssi_dbm
        b.rssiCount += 1
      }
    }
  }

  const worstFrequencies = Array.from(byFreq.entries())
    .map(([freq, b]) => ({
      freq,
      count: b.count,
      avgRssi: b.rssiCount > 0 ? b.totalRssi / b.rssiCount : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const noteworthy: string[] = []
  const interferenceEvents = byEventType['rf_interference'] ?? 0
  if (interferenceEvents > 0) {
    noteworthy.push(`${interferenceEvents} interference events`)
  }
  const lowBatteryEvents = byEventType['low_battery'] ?? 0
  if (lowBatteryEvents > 0) {
    noteworthy.push(`${lowBatteryEvents} low-battery events`)
  }
  // Day-of-week peak
  const dowEntries = Object.entries(byDayOfWeek).sort(([, a], [, b]) => b - a)
  if (dowEntries.length > 0 && dowEntries[0][1] > 0) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    noteworthy.push(`Most active day: ${names[parseInt(dowEntries[0][0], 10)]} (${dowEntries[0][1]} events)`)
  }

  return {
    totalEvents: rows.length,
    byEventType,
    byChannel,
    byHour,
    byDayOfWeek,
    byFreqBucket: Object.fromEntries(
      Array.from(byFreq.entries()).map(([f, b]) => [f.toFixed(3), b.count]),
    ),
    worstFrequencies,
    noteworthy,
  }
}

function buildPrompt(windowDays: number, stats: ReturnType<typeof computeStats>): string {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dowLines = Object.entries(stats.byDayOfWeek)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 7)
    .map(([d, c]) => `  ${names[parseInt(d, 10)]}: ${c}`)
    .join('\n')
  const hourLines = Object.entries(stats.byHour)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([h, c]) => `  ${h}:00-${h}:59: ${c}`)
    .join('\n')
  const freqLines = stats.worstFrequencies
    .map((f) => `  ${f.freq.toFixed(3)} MHz: ${f.count} events${f.avgRssi !== null ? ` (avg RSSI ${f.avgRssi.toFixed(0)} dBm)` : ''}`)
    .join('\n')

  return `You are an RF coordination expert analyzing wireless microphone interference logs from a sports bar's Shure SLX-D wireless mic system. Your job is to identify recurring patterns and suggest mitigation. Be concrete: name specific frequencies, days, and hours. Do not pad. Aim for 3-5 short paragraphs.

Time window: last ${windowDays} days
Total RF events: ${stats.totalEvents}

Events by type:
${Object.entries(stats.byEventType).map(([t, c]) => `  ${t}: ${c}`).join('\n')}

Events by channel:
${Object.entries(stats.byChannel).map(([ch, c]) => `  Channel ${ch}: ${c}`).join('\n') || '  (none)'}

Events by day of week:
${dowLines || '  (none)'}

Events by hour of day (top 5):
${hourLines || '  (none)'}

Frequencies most affected:
${freqLines || '  (none)'}

Note: The detector flags interference when an RF carrier appears at the receiver's tuned frequency WITHOUT a paired Shure transmitter (TX_TYPE=UNKNOWN, RSSI ≥ -85 dBm, audio silent). Common real-world sources include: ENG (electronic news gathering) trucks at sporting events, mobile broadcast rigs, other venues' wireless mic systems, IEM systems, body packs from nearby music venues. Sports bars near stadiums are especially exposed during game broadcasts.

Provide:
1. A one-paragraph summary of what the data shows.
2. Identified recurring patterns (specific times, days, frequencies) if any.
3. Concrete mitigation suggestions — e.g., move Mic 1 to a quieter frequency, avoid scheduling key events at peak interference times, expected sources to watch for.
4. If the data is sparse (fewer than 10 events), explicitly say so and recommend continued monitoring rather than over-interpreting noise.

Be terse. The bar manager reads this on an iPad between shifts.`
}

async function callOllama(prompt: string): Promise<{ text: string; model: string }> {
  const body = {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    options: { temperature: 0.3, num_ctx: 4096 },
  }
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  }
  const data = await res.json() as { response?: string; model?: string }
  return { text: (data.response ?? '').trim(), model: data.model ?? OLLAMA_MODEL }
}

async function loadCache(): Promise<{
  generated_at: number
  window_days: number
  event_count: number
  digest_text: string
  stats_json: string
  model: string
} | null> {
  await ensureCacheTable()
  const rows = await db.all<{
    generated_at: number
    window_days: number
    event_count: number
    digest_text: string
    stats_json: string
    model: string
  }>(sql`SELECT generated_at, window_days, event_count, digest_text, stats_json, model FROM shure_rf_pattern_cache WHERE id = 1`)
  return rows[0] ?? null
}

async function fetchEventsAndCompute(windowDays: number): Promise<{
  rows: RfEventRow[]
  stats: ReturnType<typeof computeStats>
}> {
  const cutoff = Math.floor(Date.now() / 1000) - windowDays * 86_400
  const rows = await db.all<RfEventRow>(sql`
    SELECT receiver_name, channel, event_type, rssi_dbm, frequency_mhz, tx_type, detected_at
    FROM shure_rf_events
    WHERE detected_at >= ${cutoff}
      AND event_type NOT IN ('startup')
    ORDER BY detected_at DESC
    LIMIT 5000
  `)
  const stats = computeStats(rows)
  return { rows, stats }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const cache = await loadCache()
    if (!cache) {
      return NextResponse.json({
        success: true,
        cached: false,
        digest: null,
        message: 'No analysis yet — POST to /api/shure-rf/pattern-digest to generate the first one.',
      })
    }
    const ageSecs = Math.floor(Date.now() / 1000) - cache.generated_at
    return NextResponse.json({
      success: true,
      cached: true,
      generatedAt: cache.generated_at,
      ageSecs,
      stale: ageSecs > CACHE_TTL_SECS,
      windowDays: cache.window_days,
      eventCount: cache.event_count,
      digest: cache.digest_text,
      stats: JSON.parse(cache.stats_json),
      model: cache.model,
    })
  } catch (err) {
    logger.error('[SHURE-PATTERN-DIGEST] GET failed:', (err as Error)?.message ?? err)
    return NextResponse.json(
      { success: false, error: (err as Error)?.message ?? 'failed to load digest' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) return rateLimit.response

  const authCheck = await requireAuth(request, 'ADMIN', { auditAction: 'shure_pattern_digest' })
  if (!authCheck.allowed) return authCheck.response!

  let windowDays = DEFAULT_WINDOW_DAYS
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body?.windowDays === 'number' && body.windowDays > 0 && body.windowDays <= 365) {
      windowDays = Math.round(body.windowDays)
    }
  } catch { /* ignore — use default */ }

  // Allow forcing through the cache (the "Refresh" button does this).
  // Otherwise serve cached results that are still fresh.
  const cache = await loadCache()
  const force = new URL(request.url).searchParams.get('force') === 'true'
  if (!force && cache) {
    const ageSecs = Math.floor(Date.now() / 1000) - cache.generated_at
    if (ageSecs < CACHE_TTL_SECS && cache.window_days === windowDays) {
      return NextResponse.json({
        success: true,
        cached: true,
        generatedAt: cache.generated_at,
        ageSecs,
        windowDays: cache.window_days,
        eventCount: cache.event_count,
        digest: cache.digest_text,
        stats: JSON.parse(cache.stats_json),
        model: cache.model,
      })
    }
  }

  try {
    const { rows, stats } = await fetchEventsAndCompute(windowDays)
    const prompt = buildPrompt(windowDays, stats)
    const ollamaStart = Date.now()
    const { text, model } = await callOllama(prompt)
    const ollamaMs = Date.now() - ollamaStart
    logger.info(
      `[SHURE-PATTERN-DIGEST] Generated digest: ${rows.length} events, ${windowDays}d window, ` +
        `${(ollamaMs / 1000).toFixed(1)}s ollama (${model})`,
    )

    const now = Math.floor(Date.now() / 1000)
    await db.run(sql`
      INSERT INTO shure_rf_pattern_cache (id, generated_at, window_days, event_count, digest_text, stats_json, model)
      VALUES (1, ${now}, ${windowDays}, ${rows.length}, ${text}, ${JSON.stringify(stats)}, ${model})
      ON CONFLICT(id) DO UPDATE SET
        generated_at = excluded.generated_at,
        window_days = excluded.window_days,
        event_count = excluded.event_count,
        digest_text = excluded.digest_text,
        stats_json = excluded.stats_json,
        model = excluded.model
    `)

    return NextResponse.json({
      success: true,
      cached: false,
      generatedAt: now,
      ageSecs: 0,
      windowDays,
      eventCount: rows.length,
      digest: text,
      stats,
      model,
      ollamaMs,
    })
  } catch (err) {
    logger.error('[SHURE-PATTERN-DIGEST] generation failed:', (err as Error)?.message ?? err)
    return NextResponse.json(
      { success: false, error: (err as Error)?.message ?? 'pattern digest failed' },
      { status: 500 },
    )
  }
}
