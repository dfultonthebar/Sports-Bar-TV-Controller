import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { getCameraById, cameraController } from '@/lib/obsbot/get-camera'
import { logger } from '@sports-bar/logger'

const zoomSchema = z.object({
  direction: z.enum(['in', 'out', 'stop']),
  speed: z.number().min(1).max(7).optional(),
})

/** POST /api/obsbot/cameras/[id]/zoom — {direction, speed?}. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, zoomSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { id } = await params
  const { direction, speed } = bodyValidation.data
  try {
    const camera = await getCameraById(id)
    if (!camera) {
      return NextResponse.json({ success: false, error: 'Camera not found' }, { status: 404 })
    }

    await cameraController(camera).zoom(direction, speed)
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error(`[OBSBOT] Zoom failed for camera ${id}:`, error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Zoom failed' },
      { status: 500 }
    )
  }
}
