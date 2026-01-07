import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { randomUUID } from 'crypto'

const recallPresetSchema = z.object({
  controllerId: z.string().uuid(),
  presetNumber: z.number().int().min(1).max(99),
})

/**
 * POST /api/dmx/maestro/recall-preset
 * Recall a Maestro controller's built-in preset
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, recallPresetSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { controllerId, presetNumber } = bodyValidation.data

  try {
    // Load controller
    const controller = await db.select()
      .from(schema.dmxControllers)
      .where(eq(schema.dmxControllers.id, controllerId))
      .limit(1)
      .get()

    if (!controller) {
      return NextResponse.json({ error: 'Controller not found' }, { status: 404 })
    }

    if (controller.controllerType !== 'maestro') {
      return NextResponse.json({ error: 'Controller is not a Maestro type' }, { status: 400 })
    }

    const maxPresets = controller.maestroPresetCount || 12
    if (presetNumber > maxPresets) {
      return NextResponse.json({
        error: `Preset ${presetNumber} exceeds controller maximum (${maxPresets})`,
      }, { status: 400 })
    }

    // TODO: Call Maestro client to recall preset
    // For now, log the action
    logger.info('[DMX] Recalling Maestro preset', {
      controllerId,
      controllerName: controller.name,
      presetNumber,
      ipAddress: controller.ipAddress,
    })

    // Log execution
    await db.insert(schema.dmxExecutionLogs)
      .values({
        id: randomUUID(),
        controllerId,
        actionType: 'maestro_preset',
        actionId: String(presetNumber),
        actionName: `Preset ${presetNumber}`,
        success: true,
        triggeredBy: 'api',
        executedAt: new Date().toISOString(),
      })
      .run()

    // Update controller last seen
    await db.update(schema.dmxControllers)
      .set({
        lastSeen: new Date().toISOString(),
        status: 'online',
      })
      .where(eq(schema.dmxControllers.id, controllerId))
      .run()

    return NextResponse.json({
      success: true,
      message: `Preset ${presetNumber} recalled on ${controller.name}`,
    })
  } catch (error) {
    logger.error('[DMX] Error recalling Maestro preset:', error)
    return NextResponse.json({ error: 'Failed to recall preset' }, { status: 500 })
  }
}
