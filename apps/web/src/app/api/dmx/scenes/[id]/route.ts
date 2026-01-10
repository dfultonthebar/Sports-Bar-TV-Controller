import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

const updateSceneSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  category: z.enum(['general', 'game-day', 'celebration', 'ambient', 'special']).optional(),
  sceneData: z.array(z.object({
    fixtureId: z.string().uuid(),
    state: z.record(z.number().int().min(0).max(255)),
  })).optional(),
  fadeTimeMs: z.number().int().min(0).max(10000).optional(),
  maestroControllerId: z.string().uuid().optional().nullable(),
  maestroPresetNumber: z.number().int().min(1).max(99).optional().nullable(),
  displayOrder: z.number().int().optional(),
  isFavorite: z.boolean().optional(),
  bartenderVisible: z.boolean().optional(),
  iconName: z.string().optional().nullable(),
  iconColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params

  try {
    const scene = await db.select()
      .from(schema.dmxScenes)
      .where(eq(schema.dmxScenes.id, id))
      .get()

    if (!scene) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      )
    }

    // Parse sceneData JSON
    const parsed = {
      ...scene,
      sceneData: scene.sceneData ? JSON.parse(scene.sceneData) : [],
    }

    return NextResponse.json({ success: true, scene: parsed })
  } catch (error) {
    logger.error('[DMX] Error fetching scene:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scene' },
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

  const bodyValidation = await validateRequestBody(request, updateSceneSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data

  try {
    const existing = await db.select()
      .from(schema.dmxScenes)
      .where(eq(schema.dmxScenes.id, id))
      .get()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      )
    }

    // If maestroControllerId is being updated, verify it exists
    if (data.maestroControllerId) {
      const controller = await db.select()
        .from(schema.dmxControllers)
        .where(eq(schema.dmxControllers.id, data.maestroControllerId))
        .get()

      if (!controller) {
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
    if (data.category !== undefined) updateData.category = data.category
    if (data.sceneData !== undefined) updateData.sceneData = JSON.stringify(data.sceneData)
    if (data.fadeTimeMs !== undefined) updateData.fadeTimeMs = data.fadeTimeMs
    if (data.maestroControllerId !== undefined) updateData.maestroControllerId = data.maestroControllerId
    if (data.maestroPresetNumber !== undefined) updateData.maestroPresetNumber = data.maestroPresetNumber
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder
    if (data.isFavorite !== undefined) updateData.isFavorite = data.isFavorite
    if (data.bartenderVisible !== undefined) updateData.bartenderVisible = data.bartenderVisible
    if (data.iconName !== undefined) updateData.iconName = data.iconName
    if (data.iconColor !== undefined) updateData.iconColor = data.iconColor

    const scene = await db.update(schema.dmxScenes)
      .set(updateData)
      .where(eq(schema.dmxScenes.id, id))
      .returning()
      .get()

    logger.info('[DMX] Updated scene', { id, name: scene.name })

    // Parse sceneData JSON for response
    const parsed = {
      ...scene,
      sceneData: scene.sceneData ? JSON.parse(scene.sceneData) : [],
    }

    return NextResponse.json({ success: true, scene: parsed })
  } catch (error) {
    logger.error('[DMX] Error updating scene:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update scene' },
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
      .from(schema.dmxScenes)
      .where(eq(schema.dmxScenes.id, id))
      .get()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      )
    }

    await db.delete(schema.dmxScenes)
      .where(eq(schema.dmxScenes.id, id))
      .run()

    logger.info('[DMX] Deleted scene', { id, name: existing.name })

    return NextResponse.json({ success: true, message: 'Scene deleted' })
  } catch (error) {
    logger.error('[DMX] Error deleting scene:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete scene' },
      { status: 500 }
    )
  }
}
