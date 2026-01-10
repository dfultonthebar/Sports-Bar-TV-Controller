import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

const updateTriggerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  eventType: z.string().min(1).optional(),
  sportFilter: z.string().optional().nullable(),
  teamFilter: z.array(z.string()).optional().nullable(),
  homeTeamOnly: z.boolean().optional(),
  effectType: z.enum(['scene', 'strobe', 'color-burst', 'chase', 'maestro-preset']).optional(),
  sceneId: z.string().uuid().optional().nullable(),
  maestroControllerId: z.string().uuid().optional().nullable(),
  maestroPresetNumber: z.number().int().min(1).max(99).optional().nullable(),
  effectConfig: z.record(z.unknown()).optional().nullable(),
  durationMs: z.number().int().min(100).max(60000).optional(),
  cooldownMs: z.number().int().min(0).max(300000).optional(),
  isEnabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params

  try {
    const trigger = await db.select()
      .from(schema.dmxGameEventTriggers)
      .where(eq(schema.dmxGameEventTriggers.id, id))
      .get()

    if (!trigger) {
      return NextResponse.json(
        { success: false, error: 'Trigger not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields
    const parsed = {
      ...trigger,
      teamFilter: trigger.teamFilter ? JSON.parse(trigger.teamFilter) : null,
      effectConfig: trigger.effectConfig ? JSON.parse(trigger.effectConfig) : null,
    }

    return NextResponse.json({ success: true, trigger: parsed })
  } catch (error) {
    logger.error('[DMX] Error fetching trigger:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trigger' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params

  const bodyValidation = await validateRequestBody(request, updateTriggerSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data

  try {
    const existing = await db.select()
      .from(schema.dmxGameEventTriggers)
      .where(eq(schema.dmxGameEventTriggers.id, id))
      .get()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Trigger not found' },
        { status: 404 }
      )
    }

    // Validate sceneId if provided
    if (data.sceneId) {
      const scene = await db.select()
        .from(schema.dmxScenes)
        .where(eq(schema.dmxScenes.id, data.sceneId))
        .get()

      if (!scene) {
        return NextResponse.json(
          { success: false, error: 'Scene not found' },
          { status: 400 }
        )
      }
    }

    // Validate maestroControllerId if provided
    if (data.maestroControllerId) {
      const controller = await db.select()
        .from(schema.dmxControllers)
        .where(eq(schema.dmxControllers.id, data.maestroControllerId))
        .get()

      if (!controller || controller.controllerType !== 'maestro') {
        return NextResponse.json(
          { success: false, error: 'Maestro controller not found' },
          { status: 400 }
        )
      }
    }

    const now = new Date().toISOString()

    // Prepare update data with JSON serialization
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.eventType !== undefined) updateData.eventType = data.eventType
    if (data.sportFilter !== undefined) updateData.sportFilter = data.sportFilter
    if (data.teamFilter !== undefined) updateData.teamFilter = data.teamFilter ? JSON.stringify(data.teamFilter) : null
    if (data.homeTeamOnly !== undefined) updateData.homeTeamOnly = data.homeTeamOnly
    if (data.effectType !== undefined) updateData.effectType = data.effectType
    if (data.sceneId !== undefined) updateData.sceneId = data.sceneId
    if (data.maestroControllerId !== undefined) updateData.maestroControllerId = data.maestroControllerId
    if (data.maestroPresetNumber !== undefined) updateData.maestroPresetNumber = data.maestroPresetNumber
    if (data.effectConfig !== undefined) updateData.effectConfig = data.effectConfig ? JSON.stringify(data.effectConfig) : null
    if (data.durationMs !== undefined) updateData.durationMs = data.durationMs
    if (data.cooldownMs !== undefined) updateData.cooldownMs = data.cooldownMs
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled
    if (data.priority !== undefined) updateData.priority = data.priority

    const trigger = await db.update(schema.dmxGameEventTriggers)
      .set(updateData)
      .where(eq(schema.dmxGameEventTriggers.id, id))
      .returning()
      .get()

    logger.info('[DMX] Updated game event trigger', { id, name: trigger.name })

    // Parse JSON fields for response
    const parsed = {
      ...trigger,
      teamFilter: trigger.teamFilter ? JSON.parse(trigger.teamFilter) : null,
      effectConfig: trigger.effectConfig ? JSON.parse(trigger.effectConfig) : null,
    }

    return NextResponse.json({ success: true, trigger: parsed })
  } catch (error) {
    logger.error('[DMX] Error updating trigger:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update trigger' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params

  try {
    const existing = await db.select()
      .from(schema.dmxGameEventTriggers)
      .where(eq(schema.dmxGameEventTriggers.id, id))
      .get()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Trigger not found' },
        { status: 404 }
      )
    }

    await db.delete(schema.dmxGameEventTriggers)
      .where(eq(schema.dmxGameEventTriggers.id, id))
      .run()

    logger.info('[DMX] Deleted game event trigger', { id, name: existing.name })

    return NextResponse.json({ success: true, message: 'Trigger deleted' })
  } catch (error) {
    logger.error('[DMX] Error deleting trigger:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete trigger' },
      { status: 500 }
    )
  }
}
