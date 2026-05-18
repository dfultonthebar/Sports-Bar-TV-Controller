/**
 * GET /api/sdr/peak-stats
 *
 * Per-frequency aggregations over a configurable time window —
 * foundation for Stage 2 (recurring-pattern detector) and Stage 3
 * (frequency-suggestion engine). Distinct from /api/sdr/history
 * which returns the full bucket grid for waterfall rendering;
 * peak-stats collapses time into stats per freq bin.
 *
 * Useful for:
 *   - "what frequencies have been busiest this week"
 *   - "which freqs have never gone above -90 dBm" (clean candidates
 *     for Find Clean Freq)
 *   - feeding the Ollama pattern digest with concrete numbers
 *
 * Query params:
 *   daysAgo   — int, default 7, max 90
 *   freqStart — MHz, optional (default = full band)
 *   freqEnd   — MHz, optional
 *   topN      — int, default 20, max 200 (limit results to N noisiest)
 *
 * Response shape:
 *   {
 *     success: true,
 *     windowDays, freqStart, freqEnd, totalBins,
 *     stats: [
 *       { freqMhz, maxDbm, avgDbm, p95Dbm, sampleCount,
 *         lastHotAt, hotMinutes }
 *     ]
 *   }
 *
 *   hotMinutes = number of minute-buckets where max >= -85 dBm
 *                (the carrier-detection threshold) — proxy for
 *                "how much real activity has happened here"
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

const HOT_THRESHOLD_DBM = -85

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)
    const daysAgo = Math.min(
      Math.max(parseInt(searchParams.get('daysAgo') ?? '7', 10) || 7, 1),
      90,
    )
    const topN = Math.min(
      Math.max(parseInt(searchParams.get('topN') ?? '20', 10) || 20, 1),
      200,
    )
    const freqStart = searchParams.get('freqStart')
      ? parseFloat(searchParams.get('freqStart')!)
      : null
    const freqEnd = searchParams.get('freqEnd')
      ? parseFloat(searchParams.get('freqEnd')!)
      : null

    const cutoff = Math.floor(Date.now() / 1000) - daysAgo * 86_400

    type Row = {
      freq_mhz: number
      max_dbm: number
      avg_dbm: number
      p95_dbm: number | null
      sample_count: number
      last_hot_at: number | null
      hot_minutes: number
    }

    // Single SQL aggregation pass. SQLite doesn't have a native
    // percentile function — approximate p95 by ordering and picking
    // the 95th-percentile-th row via a window function (subquery).
    // For per-freq aggregations the row count is small enough that
    // this is cheap.
    const rows = await db.all<Row>(sql`
      SELECT
        freq_mhz,
        MAX(max_dbm) AS max_dbm,
        AVG(avg_dbm) AS avg_dbm,
        NULL AS p95_dbm,  -- placeholder; computed below in JS for now
        SUM(sample_count) AS sample_count,
        MAX(CASE WHEN max_dbm >= ${HOT_THRESHOLD_DBM} THEN bucket_at ELSE NULL END) AS last_hot_at,
        SUM(CASE WHEN max_dbm >= ${HOT_THRESHOLD_DBM} THEN 1 ELSE 0 END) AS hot_minutes
      FROM sdr_spectrum
      WHERE bucket_at >= ${cutoff}
        ${freqStart !== null ? sql`AND freq_mhz >= ${freqStart}` : sql``}
        ${freqEnd !== null ? sql`AND freq_mhz <= ${freqEnd}` : sql``}
      GROUP BY freq_mhz
      ORDER BY hot_minutes DESC, max_dbm DESC
      LIMIT ${topN}
    `)

    // Compute p95 per freq from a follow-up query — separate so the
    // main aggregation stays fast. For the topN noisiest freqs only.
    const enriched: Row[] = []
    for (const r of rows) {
      try {
        const samples = await db.all<{ max_dbm: number }>(sql`
          SELECT max_dbm FROM sdr_spectrum
          WHERE freq_mhz = ${r.freq_mhz}
            AND bucket_at >= ${cutoff}
          ORDER BY max_dbm
        `)
        if (samples.length > 0) {
          const idx = Math.min(Math.floor(samples.length * 0.95), samples.length - 1)
          r.p95_dbm = samples[idx].max_dbm
        }
      } catch { /* ignore */ }
      enriched.push(r)
    }

    return NextResponse.json({
      success: true,
      windowDays: daysAgo,
      freqStart: freqStart ?? (enriched[0]?.freq_mhz ?? null),
      freqEnd: freqEnd ?? (enriched[enriched.length - 1]?.freq_mhz ?? null),
      totalBins: enriched.length,
      hotThresholdDbm: HOT_THRESHOLD_DBM,
      stats: enriched.map((r) => ({
        freqMhz: r.freq_mhz,
        maxDbm: r.max_dbm,
        avgDbm: r.avg_dbm,
        p95Dbm: r.p95_dbm,
        sampleCount: r.sample_count,
        lastHotAt: r.last_hot_at,
        hotMinutes: r.hot_minutes,
      })),
    })
  } catch (err) {
    logger.error('[SDR-PEAK-STATS] query failed:', (err as Error)?.message ?? err)
    return NextResponse.json(
      { success: false, error: (err as Error)?.message ?? 'peak-stats query failed' },
      { status: 500 },
    )
  }
}
