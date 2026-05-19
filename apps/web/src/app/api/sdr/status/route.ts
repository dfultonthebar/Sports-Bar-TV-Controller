/**
 * GET /api/sdr/status
 *
 * Lightweight liveness probe for the SDR pipeline. Used by the UI to
 * tell the operator "watcher is running, last sweep at X seconds ago"
 * vs "watcher is disabled" vs "watcher up but no recent data".
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    // Must mirror sdr-watcher.ts's SDR_ENABLED_MODE parsing — both
    // 'true' (force-start) and 'auto' (start when dongle detected) are
    // "enabled" from the UI's perspective. Previously this only
    // matched 'true', so when the operator used the recommended
    // SDR_ENABLED=auto mode the status response always reported
    // enabled=false and the UI showed the "SDR disabled" explainer
    // even with the watcher actively writing data. Caught by code
    // review on v2.45.0.
    const mode = (process.env.SDR_ENABLED ?? 'false').toLowerCase()
    const enabled = mode === 'true' || mode === 'auto'
    const nowSec = Math.floor(Date.now() / 1000)
    let lastBucketAt = 0
    let totalRows = 0
    let recentCarriers: Array<{ freq_mhz: number; event_type: string; peak_dbm: number | null; detected_at: number }> = []

    try {
      const r1 = await db.all<{ last: number | null }>(sql`SELECT MAX(bucket_at) AS last FROM sdr_spectrum`)
      lastBucketAt = r1[0]?.last ?? 0
      const r2 = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM sdr_spectrum`)
      totalRows = r2[0]?.n ?? 0
      recentCarriers = await db.all(sql`
        SELECT freq_mhz, event_type, peak_dbm, detected_at
        FROM sdr_carriers
        WHERE detected_at >= ${nowSec - 600}
          AND event_type IN ('carrier_active', 'carrier_heartbeat')
        ORDER BY detected_at DESC
        LIMIT 20
      `) as any
    } catch {
      // Table doesn't exist yet — watcher hasn't run.
    }

    const ageSecs = lastBucketAt > 0 ? nowSec - lastBucketAt : null
    const healthy = enabled && ageSecs !== null && ageSecs < 120

    return NextResponse.json({
      success: true,
      enabled,
      healthy,
      lastSweepAt: lastBucketAt > 0 ? lastBucketAt : null,
      ageSecs,
      totalAggregatedRows: totalRows,
      activeCarriers: Array.from(
        new Map(recentCarriers.map((c) => [c.freq_mhz, c])).values(),
      ).map((c) => ({
        freqMhz: c.freq_mhz,
        peakDbm: c.peak_dbm,
        lastSeenSec: nowSec - c.detected_at,
      })),
    })
  } catch (err) {
    logger.error('[SDR-STATUS] query failed:', (err as Error)?.message ?? err)
    return NextResponse.json(
      { success: false, error: (err as Error)?.message ?? 'status query failed' },
      { status: 500 },
    )
  }
}
