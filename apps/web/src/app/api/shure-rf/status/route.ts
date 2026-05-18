/**
 * GET /api/shure-rf/status
 *
 * Live per-receiver per-channel snapshot from the managed Shure SLX-D
 * clients. Powers the battery + RSSI tile on the bartender Audio tab
 * (apps/web/src/components/ShureMicStatusPanel.tsx).
 *
 * Returns whatever the in-memory client cache has — no fresh GETs are
 * issued. The cache is kept hot by:
 *   - REP-on-change frames the receiver pushes whenever anything moves
 *   - SAMPLE frames at the configured METER_RATE (1Hz today)
 * Stale data is possible if a receiver dropped TCP and hasn't
 * reconnected yet (check `connected: false` in the response).
 *
 * The endpoint short-circuits with an empty array if no Shure clients
 * have been attached — locations without a shure-slxd processor row
 * always get `{ success: true, receivers: [] }`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { shureSlxdClientManager } from '@sports-bar/shure-slxd'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const snapshots = shureSlxdClientManager.getSnapshots()
    return NextResponse.json({
      success: true,
      receivers: snapshots,
      count: snapshots.length,
    })
  } catch (err) {
    logger.error('[SHURE-RF-STATUS] Failed to build snapshot:', err)
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    )
  }
}
