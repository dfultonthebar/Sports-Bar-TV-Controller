import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { getCameraById, cameraController } from '@/lib/obsbot/get-camera'
import { logger } from '@sports-bar/logger'

const moveSchema = z.object({
  pan: z.enum(['left', 'right', 'stop']),
  tilt: z.enum(['up', 'down', 'stop']),
  speed: z.number().min(1).max(24).optional(),
})

/**
 * POST /api/obsbot/cameras/[id]/move
 * {pan, tilt, speed?} — continuous move. Send {pan:'stop', tilt:'stop'} to
 * halt (matches VISCA — stop is the same command shape as move, not a
 * separate command).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, moveSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { id } = await params
  const { pan, tilt, speed } = bodyValidation.data
  try {
    const camera = await getCameraById(id)
    if (!camera) {
      return NextResponse.json({ success: false, error: 'Camera not found' }, { status: 404 })
    }

    await cameraController(camera).move(pan, tilt, speed)
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error(`[OBSBOT] Move failed for camera ${id}:`, error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Move failed' },
      { status: 500 }
    )
  }
}
