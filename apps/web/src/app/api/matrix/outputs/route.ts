import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

/**
 * GET /api/matrix/outputs
 * Get all matrix outputs
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const outputs = await db.select()
      .from(schema.matrixOutputs)
      .orderBy(schema.matrixOutputs.channelNumber)
      .all()

    return NextResponse.json({
      success: true,
      outputs
    })
  } catch (error: any) {
    logger.error('Error fetching matrix outputs:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch matrix outputs',
        details: error.message
      },
      { status: 500 }
    )
  }
}
