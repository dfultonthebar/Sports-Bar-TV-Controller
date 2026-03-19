import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, inArray } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { randomUUID } from 'crypto'
import { getSceneEngine, dmxConnectionManager } from '@sports-bar/dmx'
import type { SceneFixtureData, SceneData } from '@sports-bar/dmx'
import { ensureDMXControllersRegistered } from '@/lib/dmx-bootstrap'

const recallSceneSchema = z.object({
  sceneId: z.string(),
  fadeTimeMs: z.number().int().min(0).max(10000).optional(),
})

/**
 * POST /api/dmx/scenes/recall
 * Recall a DMX scene - either via Maestro preset or by setting fixture states
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, recallSceneSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { sceneId, fadeTimeMs } = bodyValidation.data

  try {
    // Load scene
    const scene = await db.select()
      .from(schema.dmxScenes)
      .where(eq(schema.dmxScenes.id, sceneId))
      .limit(1)
      .get()

    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
    }

    const actualFadeTime = fadeTimeMs ?? scene.fadeTimeMs

    // Check if this is a Maestro preset scene
    if (scene.maestroControllerId && scene.maestroPresetNumber) {
      // Recall via Maestro preset
      const controller = await db.select()
        .from(schema.dmxControllers)
        .where(eq(schema.dmxControllers.id, scene.maestroControllerId))
        .limit(1)
        .get()

      if (!controller) {
        return NextResponse.json({ error: 'Maestro controller not found' }, { status: 404 })
      }

      await ensureDMXControllersRegistered()
      const success = await dmxConnectionManager.recallMaestroPreset(
        controller.id,
        scene.maestroPresetNumber,
      )

      logger.info('[DMX] Recalling Maestro preset', {
        controllerId: controller.id,
        controllerName: controller.name,
        presetNumber: scene.maestroPresetNumber,
        success,
      })

      // Log execution
      await db.insert(schema.dmxExecutionLogs)
        .values({
          id: randomUUID(),
          controllerId: controller.id,
          actionType: 'maestro_preset',
          actionId: sceneId,
          actionName: `${scene.name} (Preset ${scene.maestroPresetNumber})`,
          success,
          triggeredBy: 'bartender',
          executedAt: new Date().toISOString(),
        })
        .run()
    } else {
      // Parse scene data and apply to fixtures via scene engine
      const rawSceneData: Array<{ fixtureId: string; state: Record<string, number> }> = JSON.parse(scene.sceneData || '[]')

      if (rawSceneData.length > 0) {
        // Load fixture metadata from DB to get universe/address/channelMap
        const fixtureIds = rawSceneData.map(s => s.fixtureId)
        const fixtures = await db.select()
          .from(schema.dmxFixtures)
          .where(inArray(schema.dmxFixtures.id, fixtureIds))
          .all()

        const fixtureMap = new Map(fixtures.map(f => [f.id, f]))

        // Build SceneFixtureData array with full addressing info
        const sceneFixtures: SceneFixtureData[] = []
        for (const entry of rawSceneData) {
          const fixture = fixtureMap.get(entry.fixtureId)
          if (!fixture) {
            logger.warn('[DMX] Fixture not found for scene entry', { fixtureId: entry.fixtureId })
            continue
          }

          const channelMap = fixture.channelMap ? JSON.parse(fixture.channelMap) : {}
          sceneFixtures.push({
            fixtureId: entry.fixtureId,
            universe: fixture.universe,
            startChannel: fixture.startAddress,
            channelMap,
            state: entry.state,
          })
        }

        // Ensure controllers are registered before sending DMX
        await ensureDMXControllersRegistered()

        // Recall scene via scene engine (handles fading)
        const sceneEngine = getSceneEngine()
        const engineData: SceneData = {
          id: sceneId,
          name: scene.name,
          fixtures: sceneFixtures,
          fadeTimeMs: actualFadeTime,
        }

        await sceneEngine.recallScene(engineData, actualFadeTime)

        logger.info('[DMX] Scene recalled via engine', {
          sceneName: scene.name,
          fixtureCount: sceneFixtures.length,
          fadeTime: actualFadeTime,
        })

        // Update fixture current states in DB
        for (const entry of rawSceneData) {
          await db.update(schema.dmxFixtures)
            .set({
              currentState: JSON.stringify(entry.state),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.dmxFixtures.id, entry.fixtureId))
            .run()
        }

        // Log execution
        await db.insert(schema.dmxExecutionLogs)
          .values({
            id: randomUUID(),
            actionType: 'scene_recall',
            actionId: sceneId,
            actionName: scene.name,
            success: true,
            triggeredBy: 'bartender',
            metadata: JSON.stringify({ fixtureCount: sceneFixtures.length, fadeTime: actualFadeTime }),
            executedAt: new Date().toISOString(),
          })
          .run()
      }
    }

    // Update usage stats
    await db.update(schema.dmxScenes)
      .set({
        usageCount: (scene.usageCount || 0) + 1,
        lastUsed: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.dmxScenes.id, sceneId))
      .run()

    logger.info('[DMX] Scene recalled', { sceneId, sceneName: scene.name })

    return NextResponse.json({
      success: true,
      message: `Scene "${scene.name}" recalled`,
      details: {
        fadeTimeMs: actualFadeTime,
        isMaestroPreset: !!(scene.maestroControllerId && scene.maestroPresetNumber),
      },
    })
  } catch (error) {
    logger.error('[DMX] Error recalling scene:', error)

    // Log failure
    await db.insert(schema.dmxExecutionLogs)
      .values({
        id: randomUUID(),
        actionType: 'scene_recall',
        actionId: sceneId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        triggeredBy: 'bartender',
        executedAt: new Date().toISOString(),
      })
      .run()

    return NextResponse.json({ error: 'Failed to recall scene' }, { status: 500 })
  }
}
