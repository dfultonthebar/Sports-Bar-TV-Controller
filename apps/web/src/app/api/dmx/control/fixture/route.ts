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

const setFixtureStateSchema = z.object({
  fixtureId: z.string().uuid(),
  state: z.record(z.number().int().min(0).max(255)),
  fadeTimeMs: z.number().int().min(0).max(10000).optional(),
  triggeredBy: z.enum(['bartender', 'manager', 'scheduler', 'game_event', 'api']).optional(),
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, setFixtureStateSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { fixtureId, state, fadeTimeMs = 0, triggeredBy = 'api' } = bodyValidation.data

  try {
    // Get the fixture with its controller
    const fixture = await db.select()
      .from(schema.dmxFixtures)
      .where(eq(schema.dmxFixtures.id, fixtureId))
      .get()

    if (!fixture) {
      return NextResponse.json(
        { success: false, error: 'Fixture not found' },
        { status: 404 }
      )
    }

    if (!fixture.isActive) {
      return NextResponse.json(
        { success: false, error: 'Fixture is not active' },
        { status: 400 }
      )
    }

    // Get the controller
    const controller = await db.select()
      .from(schema.dmxControllers)
      .where(eq(schema.dmxControllers.id, fixture.controllerId))
      .get()

    if (!controller) {
      return NextResponse.json(
        { success: false, error: 'Controller not found' },
        { status: 404 }
      )
    }

    if (controller.status !== 'online') {
      return NextResponse.json(
        { success: false, error: 'Controller is offline' },
        { status: 503 }
      )
    }

    // Parse the channel map to validate state keys
    const channelMap = fixture.channelMap ? JSON.parse(fixture.channelMap) : {}
    const validChannels = Object.keys(channelMap)

    // Validate that all state keys are valid channels
    const invalidChannels = Object.keys(state).filter(key => !validChannels.includes(key))
    if (invalidChannels.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid channels: ${invalidChannels.join(', ')}` },
        { status: 400 }
      )
    }

    // In a real implementation, this would send DMX commands to the controller
    // For now, we'll just update the fixture's current state in the database
    const now = new Date().toISOString()

    // Merge with existing state
    const currentState = fixture.currentState ? JSON.parse(fixture.currentState) : {}
    const newState = { ...currentState, ...state }

    await db.update(schema.dmxFixtures)
      .set({
        currentState: JSON.stringify(newState),
        updatedAt: now,
      })
      .where(eq(schema.dmxFixtures.id, fixtureId))
      .run()

    // Log the execution
    await db.insert(schema.dmxExecutionLogs)
      .values({
        id: randomUUID(),
        controllerId: controller.id,
        actionType: 'fixture_control',
        actionId: fixtureId,
        actionName: `Set ${fixture.name}`,
        success: true,
        errorMessage: null,
        triggeredBy,
        metadata: JSON.stringify({ state, fadeTimeMs }),
        executedAt: now,
      })
      .run()

    logger.info('[DMX] Set fixture state', {
      fixtureId,
      fixtureName: fixture.name,
      state,
      fadeTimeMs,
    })

    return NextResponse.json({
      success: true,
      fixture: {
        id: fixtureId,
        name: fixture.name,
        currentState: newState,
      },
    })
  } catch (error) {
    logger.error('[DMX] Error setting fixture state:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to set fixture state' },
      { status: 500 }
    )
  }
}
