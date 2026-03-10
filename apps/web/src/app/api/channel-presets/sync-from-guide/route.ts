import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { syncPresetsFromGuide } from '@/lib/sports-guide-channel-sync'

// POST /api/channel-presets/sync-from-guide
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) return rateLimit.response

  logger.api.request('POST', '/api/channel-presets/sync-from-guide')

  try {
    const result = await syncPresetsFromGuide()

    logger.api.response('POST', '/api/channel-presets/sync-from-guide', 200, {
      created: result.created,
      updated: result.updated,
      unchanged: result.unchanged,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    logger.api.error('POST', '/api/channel-presets/sync-from-guide', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync channel presets from sports guide',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
