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

const startEffectSchema = z.object({
  effectType: z.enum(['strobe', 'color-burst', 'chase', 'fade', 'rainbow', 'pulse']),
  fixtureIds: z.array(z.string().uuid()).min(1).optional(),
  zoneId: z.string().uuid().optional(),
  config: z.object({
    color: z.object({
      red: z.number().int().min(0).max(255).optional(),
      green: z.number().int().min(0).max(255).optional(),
      blue: z.number().int().min(0).max(255).optional(),
      white: z.number().int().min(0).max(255).optional(),
    }).optional(),
    speed: z.number().int().min(1).max(100).optional(),
    intensity: z.number().int().min(0).max(255).optional(),
  }).optional(),
  durationMs: z.number().int().min(100).max(60000).optional(),
  triggeredBy: z.enum(['bartender', 'manager', 'scheduler', 'game_event', 'api']).optional(),
})

// In-memory store for running effects (in production, use Redis or similar)
const runningEffects = new Map<string, NodeJS.Timeout>()

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, startEffectSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const {
    effectType,
    fixtureIds,
    zoneId,
    config = {},
    durationMs = 5000,
    triggeredBy = 'api',
  } = bodyValidation.data

  try {
    // Get target fixtures
    let fixtures: Array<{ id: string; name: string; controllerId: string }> = []

    if (fixtureIds && fixtureIds.length > 0) {
      // Get specific fixtures
      for (const fixtureId of fixtureIds) {
        const fixture = await db.select({
          id: schema.dmxFixtures.id,
          name: schema.dmxFixtures.name,
          controllerId: schema.dmxFixtures.controllerId,
        })
          .from(schema.dmxFixtures)
          .where(eq(schema.dmxFixtures.id, fixtureId))
          .get()

        if (fixture) {
          fixtures.push(fixture)
        }
      }
    } else if (zoneId) {
      // Get all fixtures in zone
      fixtures = await db.select({
        id: schema.dmxFixtures.id,
        name: schema.dmxFixtures.name,
        controllerId: schema.dmxFixtures.controllerId,
      })
        .from(schema.dmxFixtures)
        .where(eq(schema.dmxFixtures.zoneId, zoneId))
        .all()
    }

    if (fixtures.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fixtures found for effect' },
        { status: 400 }
      )
    }

    // Generate effect ID
    const effectId = randomUUID()
    const now = new Date().toISOString()

    // In a real implementation, this would:
    // 1. Start sending DMX commands in a loop
    // 2. Apply the effect algorithm (strobe, chase, etc.)
    // For now, we'll simulate by logging and setting a timeout

    // Log the effect start
    const controllerIds = [...new Set(fixtures.map(f => f.controllerId))]
    for (const controllerId of controllerIds) {
      await db.insert(schema.dmxExecutionLogs)
        .values({
          id: randomUUID(),
          controllerId,
          actionType: 'effect',
          actionId: effectId,
          actionName: `${effectType} effect`,
          success: true,
          errorMessage: null,
          triggeredBy,
          metadata: JSON.stringify({
            effectType,
            fixtureCount: fixtures.length,
            config,
            durationMs,
          }),
          executedAt: now,
        })
        .run()
    }

    // Set up auto-stop timeout
    const timeout = setTimeout(() => {
      runningEffects.delete(effectId)
      logger.info('[DMX] Effect auto-stopped', { effectId, effectType })
    }, durationMs)

    runningEffects.set(effectId, timeout)

    logger.info('[DMX] Started effect', {
      effectId,
      effectType,
      fixtureCount: fixtures.length,
      durationMs,
    })

    return NextResponse.json({
      success: true,
      effect: {
        id: effectId,
        type: effectType,
        fixtureCount: fixtures.length,
        durationMs,
        status: 'running',
      },
    }, { status: 201 })
  } catch (error) {
    logger.error('[DMX] Error starting effect:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to start effect' },
      { status: 500 }
    )
  }
}

const stopEffectSchema = z.object({
  effectId: z.string().uuid(),
})

export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, stopEffectSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { effectId } = bodyValidation.data

  try {
    // Check if effect is running
    const timeout = runningEffects.get(effectId)

    if (!timeout) {
      return NextResponse.json(
        { success: false, error: 'Effect not found or already stopped' },
        { status: 404 }
      )
    }

    // Clear the timeout and remove from running effects
    clearTimeout(timeout)
    runningEffects.delete(effectId)

    logger.info('[DMX] Stopped effect', { effectId })

    return NextResponse.json({
      success: true,
      message: 'Effect stopped',
      effectId,
    })
  } catch (error) {
    logger.error('[DMX] Error stopping effect:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to stop effect' },
      { status: 500 }
    )
  }
}
