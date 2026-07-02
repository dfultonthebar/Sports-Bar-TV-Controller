import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { getCameraById, cameraController } from '@/lib/obsbot/get-camera'
import { logger } from '@sports-bar/logger'

const presetSchema = z.object({
  action: z.enum(['save', 'recall']),
  slot: z.number().min(1).max(8),
  label: z.string().optional(),
})

/**
 * POST /api/obsbot/cameras/[id]/preset
 * {action: 'save'|'recall', slot: 1-8, label?}. Slot is 1-8 at the API
 * boundary (matches the 8 preset buttons in the UI); VISCA itself is
 * 0-indexed, translated in obsbot-tail2.ts.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, presetSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { id } = await params
  const { action, slot, label } = bodyValidation.data
  const viscaSlot = slot - 1 // API is 1-8, VISCA memory is 0-indexed

  try {
    const camera = await getCameraById(id)
    if (!camera) {
      return NextResponse.json({ success: false, error: 'Camera not found' }, { status: 404 })
    }

    const controller = cameraController(camera)

    if (action === 'save') {
      await controller.presetSave(viscaSlot)
      const presets = camera.presets ? JSON.parse(camera.presets) : {}
      presets[String(slot)] = { label: label || `Preset ${slot}`, savedAt: new Date().toISOString() }
      await db.update(schema.obsbotCameras)
        .set({ presets: JSON.stringify(presets), updatedAt: new Date().toISOString() })
        .where(eq(schema.obsbotCameras.id, id))
        .run()
    } else {
      await controller.presetRecall(viscaSlot)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error(`[OBSBOT] Preset ${action} failed for camera ${id}:`, error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : `Preset ${action} failed` },
      { status: 500 }
    )
  }
}
