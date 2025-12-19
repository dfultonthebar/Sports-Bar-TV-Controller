
/**
 * API Route: Get Streaming Service Status
 *
 * Get status of all streaming service integrations
 */

import { NextRequest, NextResponse } from 'next/server'
import { unifiedStreamingApi } from '@/lib/streaming/unified-streaming-api'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'
import { cacheManager } from '@/lib/cache-manager'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const cacheKey = 'streaming-service-status'

    // Try to get from cache first (1 minute TTL)
    const cached = cacheManager.get('streaming-status', cacheKey)
    if (cached && typeof cached === 'object') {
      logger.debug('[Streaming] Returning service status from cache')
      return NextResponse.json({
        ...cached,
        fromCache: true
      })
    }

    const services = unifiedStreamingApi.getServiceStatus()

    const summary = {
      totalServices: services.length,
      available: services.filter(s => s.isAvailable).length,
      configured: services.filter(s => s.hasCredentials).length
    }

    const response = {
      success: true,
      summary,
      services
    }

    // Cache for 1 minute
    cacheManager.set('streaming-status', cacheKey, response)
    logger.debug('[Streaming] Cached service status')

    return NextResponse.json({
      ...response,
      fromCache: false
    })
  } catch (error: any) {
    logger.error('[API] Error getting service status:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get service status',
        message: error.message
      },
      { status: 500 }
    )
  }
}
