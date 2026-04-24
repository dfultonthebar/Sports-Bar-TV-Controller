import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { probeAllDirecTVTuned } from '@sports-bar/scheduler'

/**
 * POST /api/directv/probe-tuned
 *
 * Trigger an immediate sweep of every configured DirecTV box's
 * /tv/getTuned endpoint and upsert any PPV-band channel observations
 * into the discovered_ppv_channels table.
 *
 * The same probe runs automatically every 10 minutes from
 * SchedulerService; this endpoint exists for on-demand testing
 * (e.g., after a manager tunes a box to a UFC PPV channel and wants
 * to confirm the channel is now visible to the AI scheduler).
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  logger.api.request('POST', '/api/directv/probe-tuned')

  try {
    const result = await probeAllDirecTVTuned()
    logger.api.response('POST', '/api/directv/probe-tuned', 200)
    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error: any) {
    logger.api.error('POST', '/api/directv/probe-tuned', error)
    return NextResponse.json(
      { success: false, error: 'Probe failed', details: error.message },
      { status: 500 },
    )
  }
}
