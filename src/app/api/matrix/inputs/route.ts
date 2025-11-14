import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'

/**
 * GET /api/matrix/inputs
 * Get all matrix inputs
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const inputs = await db.select()
      .from(schema.matrixInputs)
      .orderBy(schema.matrixInputs.channelNumber)
      .all()

    return NextResponse.json({
      success: true,
      inputs
    })
  } catch (error: any) {
    logger.error('Error fetching matrix inputs:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch matrix inputs',
        details: error.message
      },
      { status: 500 }
    )
  }
}
