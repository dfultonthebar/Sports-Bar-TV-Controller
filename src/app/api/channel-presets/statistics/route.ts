
import { NextRequest, NextResponse } from 'next/server'
import { getUsageStatistics } from '@/services/presetReorderService'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * GET /api/channel-presets/statistics
 * Get usage statistics for channel presets
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const stats = await getUsageStatistics()

    return NextResponse.json({
      success: true,
      ...stats
    })
  } catch (error) {
    console.error('Error fetching preset statistics:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
