/**
 * API Route: Trigger an immediate Sports Bar Scout catalog walk.
 *
 * POST runs runFiretvCatalogWalk() now, bypassing the daily-cron cooldown.
 * Used for ad-hoc operator triggers (e.g. after installing a new streaming
 * app on a Fire TV — refresh the catalog without waiting for 04:00).
 *
 * Returns the per-input walk stats including how many tiles were uploaded
 * for each app.
 *
 * No request body. Auth-gated by the rate limiter and (intended) admin-
 * only access — this triggers ADB activity on every Fire TV at the venue
 * which lights up screens for ~30s per app.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runFiretvCatalogWalk } from '@sports-bar/scheduler'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

export async function POST(_request: NextRequest) {
  const rateLimit = await withRateLimit(_request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    logger.info('[FIRESTICK_SCOUT_CATALOG_WALK] Manual walk triggered')
    const stats = await runFiretvCatalogWalk()
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    logger.error('[FIRESTICK_SCOUT_CATALOG_WALK] Walk failed:', err)
    return NextResponse.json(
      { success: false, error: 'Walk failed', message: err.message },
      { status: 500 }
    )
  }
}
