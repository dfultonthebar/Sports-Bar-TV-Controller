import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, and, desc, sql } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { randomUUID } from 'crypto'

const simulateEventSchema = z.object({
  eventType: z.string().min(1), // 'goal', 'touchdown', 'home-run', 'score-change', etc.
  sport: z.string().optional(), // 'nfl', 'nba', 'nhl', 'mlb'
  teamId: z.string().optional(),
  isHomeTeam: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, simulateEventSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const {
    eventType,
    sport,
    teamId,
    isHomeTeam = true,
    metadata = {},
  } = bodyValidation.data

  try {
    // Find matching triggers
    const allTriggers = await db.select()
      .from(schema.dmxGameEventTriggers)
      .where(eq(schema.dmxGameEventTriggers.isEnabled, true))
      .orderBy(desc(schema.dmxGameEventTriggers.priority))
      .all()

    // Filter triggers that match the event
    const matchingTriggers = allTriggers.filter(trigger => {
      // Must match event type
      if (trigger.eventType !== eventType) return false

      // Check sport filter
      if (trigger.sportFilter && sport && trigger.sportFilter !== sport) return false

      // Check home team only
      if (trigger.homeTeamOnly && !isHomeTeam) return false

      // Check team filter
      if (trigger.teamFilter && teamId) {
        const teams = JSON.parse(trigger.teamFilter) as string[]
        if (!teams.includes(teamId)) return false
      }

      // Check cooldown
      if (trigger.lastTriggered) {
        const lastTriggered = new Date(trigger.lastTriggered).getTime()
        const now = Date.now()
        if (now - lastTriggered < trigger.cooldownMs) {
          logger.debug('[DMX] Trigger in cooldown', { triggerId: trigger.id, name: trigger.name })
          return false
        }
      }

      return true
    })

    if (matchingTriggers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matching triggers found',
        triggersMatched: 0,
        triggersExecuted: 0,
      })
    }

    const now = new Date().toISOString()
    const executedTriggers: Array<{ id: string; name: string; effectType: string }> = []

    // Execute matching triggers (highest priority first)
    for (const trigger of matchingTriggers) {
      try {
        // Update last triggered timestamp
        await db.update(schema.dmxGameEventTriggers)
          .set({ lastTriggered: now, updatedAt: now })
          .where(eq(schema.dmxGameEventTriggers.id, trigger.id))
          .run()

        // Log the execution
        await db.insert(schema.dmxExecutionLogs)
          .values({
            id: randomUUID(),
            controllerId: trigger.maestroControllerId || null,
            actionType: 'game_event',
            actionId: trigger.id,
            actionName: `${eventType} - ${trigger.name}`,
            success: true,
            errorMessage: null,
            triggeredBy: 'game_event',
            metadata: JSON.stringify({
              eventType,
              sport,
              teamId,
              isHomeTeam,
              triggerName: trigger.name,
              effectType: trigger.effectType,
              ...metadata,
            }),
            executedAt: now,
          })
          .run()

        // In a real implementation, this would:
        // 1. Recall the scene if effectType is 'scene'
        // 2. Send Maestro preset if effectType is 'maestro-preset'
        // 3. Start the effect if effectType is 'strobe', 'color-burst', 'chase'
        // For now, we just log and track

        executedTriggers.push({
          id: trigger.id,
          name: trigger.name,
          effectType: trigger.effectType,
        })

        logger.info('[DMX] Executed game event trigger', {
          triggerId: trigger.id,
          triggerName: trigger.name,
          eventType,
          effectType: trigger.effectType,
        })
      } catch (triggerError) {
        logger.error('[DMX] Error executing trigger:', { triggerId: trigger.id, error: triggerError })

        // Log the failure
        await db.insert(schema.dmxExecutionLogs)
          .values({
            id: randomUUID(),
            controllerId: trigger.maestroControllerId || null,
            actionType: 'game_event',
            actionId: trigger.id,
            actionName: `${eventType} - ${trigger.name}`,
            success: false,
            errorMessage: triggerError instanceof Error ? triggerError.message : 'Unknown error',
            triggeredBy: 'game_event',
            metadata: JSON.stringify({ eventType, sport, teamId, isHomeTeam }),
            executedAt: now,
          })
          .run()
      }
    }

    logger.info('[DMX] Simulated game event', {
      eventType,
      sport,
      triggersMatched: matchingTriggers.length,
      triggersExecuted: executedTriggers.length,
    })

    return NextResponse.json({
      success: true,
      message: `Simulated ${eventType} event`,
      event: {
        type: eventType,
        sport,
        teamId,
        isHomeTeam,
      },
      triggersMatched: matchingTriggers.length,
      triggersExecuted: executedTriggers.length,
      executedTriggers,
    })
  } catch (error) {
    logger.error('[DMX] Error simulating game event:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to simulate game event' },
      { status: 500 }
    )
  }
}
