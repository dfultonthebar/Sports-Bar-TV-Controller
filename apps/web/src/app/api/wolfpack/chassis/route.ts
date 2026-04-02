/**
 * GET /api/wolfpack/chassis - List all chassis from JSON driver file
 */

import { NextResponse, NextRequest } from 'next/server'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { loadChassis } from '@/lib/wolfpack/chassis-loader'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const chassis = loadChassis()

    // Enrich with DB runtime state (connection status, last seen, etc.)
    const enriched = await Promise.all(
      chassis.map(async (c) => {
        const dbConfig = await db.select()
          .from(schema.matrixConfigurations)
          .where(eq(schema.matrixConfigurations.chassisId, c.id))
          .limit(1)
          .get()

        return {
          ...c,
          dbId: dbConfig?.id || null,
          isActive: dbConfig?.isActive ?? false,
          isSynced: !!dbConfig,
        }
      })
    )

    return NextResponse.json({
      success: true,
      chassis: enriched,
      count: enriched.length,
    })
  } catch (error) {
    logger.error('[WOLFPACK-CHASSIS] Error listing chassis:', { error })
    return NextResponse.json(
      { error: 'Failed to list chassis' },
      { status: 500 }
    )
  }
}
