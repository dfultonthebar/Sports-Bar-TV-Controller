/**
 * GET /api/sdr/history
 *
 * Time-range query against the sdr_spectrum aggregate table. Powers
 * the historical waterfall view + Stage 2 pattern analysis. For
 * real-time live data, use /api/sdr/stream (SSE) — coming next.
 *
 * Query params:
 *   freqStart  — MHz, optional (default = full band)
 *   freqEnd    — MHz, optional
 *   minutesAgo — int, default 60, max 1440 (24h)
 *
 * Response:
 *   { success: true, bins: number[], times: number[], grid: number[][] }
 *     where grid[t][f] = max dBm seen at time bucket t, freq bin f
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

type Row = {
  freq_mhz: number
  max_dbm: number
  avg_dbm: number
  sample_count: number
  bucket_at: number
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)
    const minutesAgo = Math.min(
      Math.max(parseInt(searchParams.get('minutesAgo') ?? '60', 10) || 60, 1),
      1440,
    )
    const freqStart = searchParams.get('freqStart')
      ? parseFloat(searchParams.get('freqStart')!)
      : null
    const freqEnd = searchParams.get('freqEnd')
      ? parseFloat(searchParams.get('freqEnd')!)
      : null

    const nowSec = Math.floor(Date.now() / 1000)
    const cutoff = nowSec - minutesAgo * 60

    // Build WHERE clause safely via drizzle sql template.
    const rows = await db.all<Row>(sql`
      SELECT freq_mhz, max_dbm, avg_dbm, sample_count, bucket_at
      FROM sdr_spectrum
      WHERE bucket_at >= ${cutoff}
        ${freqStart !== null ? sql`AND freq_mhz >= ${freqStart}` : sql``}
        ${freqEnd !== null ? sql`AND freq_mhz <= ${freqEnd}` : sql``}
      ORDER BY bucket_at ASC, freq_mhz ASC
      LIMIT 200000
    `)

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        binsCount: 0,
        timesCount: 0,
        bins: [],
        times: [],
        grid: [],
        message: 'No SDR spectrum data yet. Either the watcher is disabled (SDR_ENABLED env) or it has not received any sweeps in the requested window.',
      })
    }

    // Pivot to a 2D grid: rows = time buckets (ascending), cols = freq bins.
    // Build freq + time axes from observed values.
    const binSet = new Set<number>()
    const timeSet = new Set<number>()
    for (const r of rows) {
      binSet.add(r.freq_mhz)
      timeSet.add(r.bucket_at)
    }
    const bins = Array.from(binSet).sort((a, b) => a - b)
    const times = Array.from(timeSet).sort((a, b) => a - b)
    const binIdx = new Map(bins.map((f, i) => [f, i]))
    const timeIdx = new Map(times.map((t, i) => [t, i]))

    // Fill with sentinel = -120 dBm (noise floor) for any (t, f) cell
    // that didn't receive a sample. Visual: shows up as deepest blue.
    const grid: number[][] = Array.from({ length: times.length }, () =>
      Array(bins.length).fill(-120),
    )
    for (const r of rows) {
      const ti = timeIdx.get(r.bucket_at)!
      const fi = binIdx.get(r.freq_mhz)!
      grid[ti][fi] = r.max_dbm
    }

    return NextResponse.json({
      success: true,
      binsCount: bins.length,
      timesCount: times.length,
      bins,
      times,
      grid,
      windowSecs: minutesAgo * 60,
      freqStart: freqStart ?? bins[0],
      freqEnd: freqEnd ?? bins[bins.length - 1],
    })
  } catch (err) {
    logger.error('[SDR-HISTORY] query failed:', (err as Error)?.message ?? err)
    return NextResponse.json(
      { success: false, error: (err as Error)?.message ?? 'history query failed' },
      { status: 500 },
    )
  }
}
