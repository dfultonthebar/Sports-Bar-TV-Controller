import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { getCameraById, cameraController } from '@/lib/obsbot/get-camera'
import { logger } from '@sports-bar/logger'

/** POST /api/obsbot/cameras/[id]/home — recenter pan/tilt. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params
  try {
    const camera = await getCameraById(id)
    if (!camera) {
      return NextResponse.json({ success: false, error: 'Camera not found' }, { status: 404 })
    }

    await cameraController(camera).home()
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error(`[OBSBOT] Home failed for camera ${id}:`, error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Home failed' },
      { status: 500 }
    )
  }
}
