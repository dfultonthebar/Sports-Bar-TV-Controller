import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, desc, asc } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { randomUUID } from 'crypto'

const createSceneSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: z.enum(['general', 'game-day', 'celebration', 'ambient', 'special']).optional(),
  sceneData: z.array(z.object({
    fixtureId: z.string().uuid(),
    state: z.record(z.number().int().min(0).max(255)),
  })),
  fadeTimeMs: z.number().int().min(0).max(10000).optional(),
  maestroControllerId: z.string().uuid().optional(),
  maestroPresetNumber: z.number().int().min(1).max(99).optional(),
  bartenderVisible: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  iconName: z.string().optional(),
  iconColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const bartenderOnly = searchParams.get('bartender') === 'true'

    let query = db.select().from(schema.dmxScenes)

    const scenes = await query
      .orderBy(asc(schema.dmxScenes.displayOrder), desc(schema.dmxScenes.usageCount))
      .all()

    // Filter in JS (drizzle-orm sqlite has limited WHERE support for multiple conditions)
    let filtered = scenes
    if (category) {
      filtered = filtered.filter(s => s.category === category)
    }
    if (bartenderOnly) {
      filtered = filtered.filter(s => s.bartenderVisible)
    }

    return NextResponse.json({
      success: true,
      scenes: filtered,
      count: filtered.length,
    })
  } catch (error) {
    logger.error('[DMX] Error loading scenes:', error)
    return NextResponse.json({ error: 'Failed to load scenes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, createSceneSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data

  try {
    const now = new Date().toISOString()
    const id = randomUUID()

    const scene = await db.insert(schema.dmxScenes)
      .values({
        id,
        name: data.name,
        description: data.description || null,
        category: data.category ?? 'general',
        sceneData: JSON.stringify(data.sceneData),
        fadeTimeMs: data.fadeTimeMs ?? 500,
        maestroControllerId: data.maestroControllerId || null,
        maestroPresetNumber: data.maestroPresetNumber || null,
        bartenderVisible: data.bartenderVisible ?? true,
        isFavorite: data.isFavorite ?? false,
        iconName: data.iconName || null,
        iconColor: data.iconColor || null,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get()

    logger.info('[DMX] Created scene', { id, name: data.name })

    return NextResponse.json({ success: true, scene }, { status: 201 })
  } catch (error) {
    logger.error('[DMX] Error creating scene:', error)
    return NextResponse.json({ error: 'Failed to create scene' }, { status: 500 })
  }
}
