/**
 * GET /api/wolfpack/chassis/[chassisId]/routes - Current routes for specific chassis
 */

import { NextResponse, NextRequest } from 'next/server'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { getChassisById } from '@/lib/wolfpack/chassis-loader'

type RouteContext = { params: Promise<{ chassisId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { chassisId } = await context.params

    const chassisConfig = getChassisById(chassisId)
    if (!chassisConfig) {
      return NextResponse.json(
        { error: `Chassis "${chassisId}" not found in wolfpack-devices.json` },
        { status: 404 }
      )
    }

    // Get routes from matrixRoutes table for this chassis
    const routes = await db.select()
      .from(schema.matrixRoutes)
      .where(eq(schema.matrixRoutes.chassisId, chassisId))
      .all()

    // Also get wolfpackMatrixRoutings for this chassis
    const wolfpackRoutings = await db.select()
      .from(schema.wolfpackMatrixRoutings)
      .where(eq(schema.wolfpackMatrixRoutings.chassisId, chassisId))
      .all()

    return NextResponse.json({
      success: true,
      chassisId,
      chassisName: chassisConfig.name,
      routes,
      wolfpackRoutings,
    })
  } catch (error) {
    logger.error('[WOLFPACK-CHASSIS] Error getting routes:', { error })
    return NextResponse.json(
      { error: 'Failed to get chassis routes' },
      { status: 500 }
    )
  }
}
