import { NextRequest, NextResponse } from 'next/server'
import { getSportsScheduleSyncService } from '@/lib/services/sports-schedule-sync'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * POST /api/sports/sync
 * Manually trigger sports schedule sync
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    logger.info('[Sports Sync API] Manual sync triggered')

    const syncService = getSportsScheduleSyncService()
    const result = await syncService.syncAllTeamsSchedules()

    return NextResponse.json({
      success: true,
      ...result,
      message: `Synced ${result.totalEventsFound} events across ${result.logs.length} teams`
    })
  } catch (error) {
    logger.error('[Sports Sync API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync schedules'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sports/sync
 * Get last sync status
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { findMany, desc, schema } = await import('@/lib/db-helpers')

    const recentSyncs = await findMany('sportsEventSyncLogs', {
      orderBy: desc(schema.sportsEventSyncLogs.syncedAt),
      limit: 10
    })

    return NextResponse.json({
      success: true,
      recentSyncs
    })
  } catch (error) {
    logger.error('[Sports Sync API] Error getting sync logs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get sync logs' },
      { status: 500 }
    )
  }
}
