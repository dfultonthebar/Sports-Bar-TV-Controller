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

const createTriggerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  eventType: z.string().min(1), // 'goal', 'touchdown', 'home-run', 'score-change', etc.
  sportFilter: z.string().optional().nullable(), // 'nfl', 'nba', 'nhl', 'mlb'
  teamFilter: z.array(z.string()).optional().nullable(), // Array of team IDs
  homeTeamOnly: z.boolean().optional(),
  effectType: z.enum(['scene', 'strobe', 'color-burst', 'chase', 'maestro-preset']),
  sceneId: z.string().uuid().optional().nullable(),
  maestroControllerId: z.string().uuid().optional().nullable(),
  maestroPresetNumber: z.number().int().min(1).max(99).optional().nullable(),
  effectConfig: z.record(z.unknown()).optional(),
  durationMs: z.number().int().min(100).max(60000).optional(),
  cooldownMs: z.number().int().min(0).max(300000).optional(),
  isEnabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
})

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)
    const eventType = searchParams.get('eventType')
    const sport = searchParams.get('sport')
    const enabledOnly = searchParams.get('enabled') === 'true'

    const triggers = await db.select()
      .from(schema.dmxGameEventTriggers)
      .orderBy(desc(schema.dmxGameEventTriggers.priority), asc(schema.dmxGameEventTriggers.name))
      .all()

    // Filter in JS
    let filtered = triggers
    if (eventType) {
      filtered = filtered.filter(t => t.eventType === eventType)
    }
    if (sport) {
      filtered = filtered.filter(t => !t.sportFilter || t.sportFilter === sport)
    }
    if (enabledOnly) {
      filtered = filtered.filter(t => t.isEnabled)
    }

    // Parse JSON fields
    const parsed = filtered.map(trigger => ({
      ...trigger,
      teamFilter: trigger.teamFilter ? JSON.parse(trigger.teamFilter) : null,
      effectConfig: trigger.effectConfig ? JSON.parse(trigger.effectConfig) : null,
    }))

    return NextResponse.json({
      success: true,
      triggers: parsed,
      count: parsed.length,
    })
  } catch (error) {
    logger.error('[DMX] Error loading game event triggers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load triggers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, createTriggerSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data

  try {
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
    const id = randomUUID()

    const trigger = await db.insert(schema.dmxGameEventTriggers)
      .values({
        id,
        name: data.name,
        description: data.description || null,
        eventType: data.eventType,
        sportFilter: data.sportFilter || null,
        teamFilter: data.teamFilter ? JSON.stringify(data.teamFilter) : null,
        homeTeamOnly: data.homeTeamOnly ?? true,
        effectType: data.effectType,
        sceneId: data.sceneId || null,
        maestroControllerId: data.maestroControllerId || null,
        maestroPresetNumber: data.maestroPresetNumber || null,
        effectConfig: data.effectConfig ? JSON.stringify(data.effectConfig) : null,
        durationMs: data.durationMs ?? 5000,
        cooldownMs: data.cooldownMs ?? 30000,
        isEnabled: data.isEnabled ?? true,
        priority: data.priority ?? 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get()

    logger.info('[DMX] Created game event trigger', { id, name: data.name, eventType: data.eventType })

    // Parse JSON fields for response
    const parsed = {
      ...trigger,
      teamFilter: trigger.teamFilter ? JSON.parse(trigger.teamFilter) : null,
      effectConfig: trigger.effectConfig ? JSON.parse(trigger.effectConfig) : null,
    }

    return NextResponse.json({ success: true, trigger: parsed }, { status: 201 })
  } catch (error) {
    logger.error('[DMX] Error creating game event trigger:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create trigger' },
      { status: 500 }
    )
  }
}
