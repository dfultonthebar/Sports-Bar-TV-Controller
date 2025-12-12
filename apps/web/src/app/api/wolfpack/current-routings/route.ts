import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    logger.api.request('GET', '/api/wolfpack/current-routings')

    // Get all active routings from the database
    const routings = await db
      .select({
        matrixOutputNumber: schema.wolfpackMatrixRoutings.matrixOutputNumber,
        wolfpackInputNumber: schema.wolfpackMatrixRoutings.wolfpackInputNumber,
        wolfpackInputLabel: schema.wolfpackMatrixRoutings.wolfpackInputLabel,
      })
      .from(schema.wolfpackMatrixRoutings)
      .where(eq(schema.wolfpackMatrixRoutings.isActive, true))
      .all()

    logger.api.response('GET', '/api/wolfpack/current-routings', 200, {
      count: routings.length
    })

    return NextResponse.json({
      success: true,
      routings
    })

  } catch (error) {
    logger.api.error('GET', '/api/wolfpack/current-routings', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch current routings',
        routings: []
      },
      { status: 500 }
    )
  }
}
