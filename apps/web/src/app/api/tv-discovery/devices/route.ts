import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { desc } from 'drizzle-orm'

/**
 * TV Discovery Devices List API
 *
 * Returns all discovered NetworkTVDevice records from database
 */

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    logger.info('[TV-DISCOVERY] Fetching all discovered TV devices')

    // Fetch all network TV devices
    const devices = await db.select()
      .from(schema.networkTVDevices)
      .orderBy(desc(schema.networkTVDevices.lastSeen))

    logger.info(`[TV-DISCOVERY] Found ${devices.length} TV devices`)

    return NextResponse.json({
      success: true,
      count: devices.length,
      devices
    })

  } catch (error: any) {
    logger.error('[TV-DISCOVERY] Failed to fetch devices:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch TV devices' },
      { status: 500 }
    )
  }
}
