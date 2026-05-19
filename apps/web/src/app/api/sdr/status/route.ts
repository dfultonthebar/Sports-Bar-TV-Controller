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
    let lastSweepAt = 0
    let totalRows = 0
    let recentCarriers: Array<{ freq_mhz: number; event_type: string; peak_dbm: number | null; detected_at: number }> = []

    try {
      // v2.52.8 fix: pre-v2.52.8 used MAX(bucket_at) — the per-MINUTE
      // BUCKET boundary timestamp (always rounded down to minute start).
      // Between minute flushes, ageSecs grew from 0 → 140s+ and crossed
      // the healthy threshold → UI ShureSdrSpectrumPanel flipped to its
      // "waiting for first sweep" empty state → waterfall disappeared
      // every minute, then re-appeared on the next bucket flush.
      // Operator at Holmgren reported "appears and disappears" 2026-05-19.
      //
      // Switch to MAX(detected_at) — the actual row INSERT timestamp.
      // The 30s periodic flushAggregator interval keeps this within
      // 0-30s of now, so ageSecs no longer oscillates past the
      // healthy threshold.
      const r1 = await db.all<{ last: number | null }>(sql`SELECT MAX(detected_at) AS last FROM sdr_spectrum`)
      lastSweepAt = r1[0]?.last ?? 0
      const r2 = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM sdr_spectrum`)
      totalRows = r2[0]?.n ?? 0
      // v2.52.11: pull a wider window (200 rows) so coalescing has
      // enough data to merge adjacent bins of a single transmitter.
      // Without this the LIMIT 20 alone could leave bin 5 of a
      // station orphaned from the other 15 bins.
      recentCarriers = await db.all(sql`
        SELECT freq_mhz, event_type, peak_dbm, detected_at
        FROM sdr_carriers
        WHERE detected_at >= ${nowSec - 600}
          AND event_type IN ('carrier_active', 'carrier_heartbeat')
        ORDER BY detected_at DESC
        LIMIT 200
      `) as any
    } catch {
      // Table doesn't exist yet — watcher hasn't run.
    }

    // v2.52.8: threshold relaxed 120 → 180s. The watcher's flushAggregator
    // interval is 30s but real-world wall-clock jitter (PM2 contention,
    // SQLite WAL checkpoint pause) can push gaps to 60-90s. 180s preserves
    // the "watcher truly dead" signal while tolerating realistic jitter.
    const ageSecs = lastSweepAt > 0 ? nowSec - lastSweepAt : null
    const healthy = enabled && ageSecs !== null && ageSecs < 180

    // v2.52.11: coalesce adjacent active-bin carrier events into ONE
    // entry per real signal. Pre-v2.52.11 deduped only by exact freq_mhz,
    // so a 200 kHz wide TV broadcast at 470.3 MHz appeared as 8-12
    // separate "carriers" of 25 kHz each, dominating the LIMIT 20 list
    // and crowding out actual interference signals (wireless mics, DJ
    // rigs). Now: dedupe by freq, sort, then walk freq-ascending and
    // merge into a cluster any time the next bin is within
    // COALESCE_GAP_MHZ (0.10 MHz = 4 bin spacing). Each cluster ends up
    // as one carrier with peak = max(peaks), widthKhz = (last-first+bin)
    // in kHz.
    // 0.50 MHz gap: wide enough to coalesce a 6 MHz QAM TV broadcast
    // (WCWF's stepped power profile has ~150-200 kHz gaps between
    // peaks) into one carrier entry. Narrow enough that a 200 kHz
    // wireless mic and a TV broadcast on adjacent freqs stay distinct.
    const COALESCE_GAP_MHZ = 0.50
    const dedupedByFreq = Array.from(
      new Map(recentCarriers.map((c) => [c.freq_mhz, c])).values(),
    ).sort((a, b) => a.freq_mhz - b.freq_mhz)

    type Coalesced = {
      freqMhz: number
      peakDbm: number | null
      lastSeenSec: number
      widthKhz: number
      binCount: number
    }
    const coalesced: Coalesced[] = []
    for (const c of dedupedByFreq) {
      const last = coalesced[coalesced.length - 1]
      if (last && c.freq_mhz - (last.freqMhz + last.widthKhz / 2000) <= COALESCE_GAP_MHZ) {
        // Extend the existing cluster
        if (c.peak_dbm !== null && (last.peakDbm === null || c.peak_dbm > last.peakDbm)) {
          last.peakDbm = c.peak_dbm
          last.freqMhz = c.freq_mhz // re-center on the strongest bin
        }
        last.binCount += 1
        last.widthKhz = (last.binCount) * 25 // 25 kHz per bin (RESOLUTION_KHZ)
        last.lastSeenSec = Math.min(last.lastSeenSec, nowSec - c.detected_at)
      } else {
        coalesced.push({
          freqMhz: c.freq_mhz,
          peakDbm: c.peak_dbm,
          lastSeenSec: nowSec - c.detected_at,
          widthKhz: 25,
          binCount: 1,
        })
      }
    }
    // Limit to 20 strongest after coalescing (mics tend to be narrower
    // than broadcast TV, so sort by peak power so mics aren't crowded
    // out by a few wide TV broadcasts).
    coalesced.sort((a, b) => (b.peakDbm ?? -200) - (a.peakDbm ?? -200))

    return NextResponse.json({
      success: true,
      enabled,
      healthy,
      lastSweepAt: lastSweepAt > 0 ? lastSweepAt : null,
      ageSecs,
      totalAggregatedRows: totalRows,
      activeCarriers: coalesced.slice(0, 20),
    })
  } catch (err) {
    logger.error('[SDR-STATUS] query failed:', (err as Error)?.message ?? err)
    return NextResponse.json(
      { success: false, error: (err as Error)?.message ?? 'status query failed' },
      { status: 500 },
    )
  }
}
