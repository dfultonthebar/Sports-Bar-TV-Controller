/**
 * CEC Devices API
 *
 * GET /api/cec/devices
 * Returns all CEC devices from the database
 */

import { NextResponse, NextRequest } from 'next/server'
import { findMany } from '@/lib/db-helpers'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    logger.info('[API] Fetching CEC devices...')
    const devices = await findMany('cecDevices')
    logger.info('[API] Found CEC devices:', { data: devices })

    return NextResponse.json({
      success: true,
      devices: devices || []
    })
  } catch (error: any) {
    logger.error('[API] Error fetching CEC devices:', error)
    logger.error('[API] Error message:', error?.message)
    logger.error('[API] Error stack:', error?.stack)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch CEC devices',
        devices: []
      },
      { status: 500 }
    )
  }
}
