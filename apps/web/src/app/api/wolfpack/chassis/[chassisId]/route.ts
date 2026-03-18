/**
 * GET /api/wolfpack/chassis/[chassisId] - Single chassis config + runtime state
 * POST /api/wolfpack/chassis/[chassisId]/route - Route input→output on specific chassis
 */

import { NextResponse, NextRequest } from 'next/server'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { getChassisById } from '@/lib/wolfpack/chassis-loader'
import { getActiveChassisConfig } from '@/lib/wolfpack/get-active-chassis'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

type RouteContext = { params: Promise<{ chassisId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { chassisId } = await context.params

    // Get JSON config
    const chassisConfig = getChassisById(chassisId)
    if (!chassisConfig) {
      return NextResponse.json(
        { error: `Chassis "${chassisId}" not found in wolfpack-devices.json` },
        { status: 404 }
      )
    }

    // Get DB runtime state
    const dbConfig = await getActiveChassisConfig(chassisId)

    // Get current routes for this chassis
    const routes = dbConfig
      ? await db.select()
          .from(schema.matrixRoutes)
          .where(eq(schema.matrixRoutes.chassisId, chassisId))
          .all()
      : []

    return NextResponse.json({
      success: true,
      chassis: {
        ...chassisConfig,
        dbId: dbConfig?.id || null,
        isActive: dbConfig?.isActive ?? false,
        isSynced: !!dbConfig,
      },
      routes,
    })
  } catch (error) {
    logger.error('[WOLFPACK-CHASSIS] Error getting chassis:', { error })
    return NextResponse.json(
      { error: 'Failed to get chassis' },
      { status: 500 }
    )
  }
}
