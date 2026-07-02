import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

/**
 * GET /api/obsbot/cameras
 * List active OBSBOT cameras for this location. The bartender remote uses
 * this to decide whether to show the Camera tab at all — a location with
 * no rows here never sees the tab (mirrors the DJ Mode enabled/disabled
 * pattern in apps/web/src/app/remote/page.tsx).
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const cameras = await db.select()
      .from(schema.obsbotCameras)
      .where(eq(schema.obsbotCameras.isActive, true))
      .all()

    return NextResponse.json({ success: true, cameras })
  } catch (error) {
    logger.error('[OBSBOT] Failed to list cameras:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list cameras' },
      { status: 500 }
    )
  }
}
