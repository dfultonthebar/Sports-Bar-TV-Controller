
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
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const services = unifiedStreamingApi.getServiceStatus()

    const summary = {
      totalServices: services.length,
      available: services.filter(s => s.isAvailable).length,
      configured: services.filter(s => s.hasCredentials).length
    }

    return NextResponse.json({
      success: true,
      summary,
      services
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
