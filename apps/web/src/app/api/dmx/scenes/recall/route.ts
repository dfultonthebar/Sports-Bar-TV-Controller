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

const recallSceneSchema = z.object({
  sceneId: z.string().uuid(),
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

      // TODO: Call Maestro client to recall preset
      // For now, just log the action
      logger.info('[DMX] Recalling Maestro preset', {
        controllerId: controller.id,
        controllerName: controller.name,
        presetNumber: scene.maestroPresetNumber,
      })

      // Log execution
      await db.insert(schema.dmxExecutionLogs)
        .values({
          id: randomUUID(),
          controllerId: controller.id,
          actionType: 'maestro_preset',
          actionId: sceneId,
          actionName: `${scene.name} (Preset ${scene.maestroPresetNumber})`,
          success: true,
          triggeredBy: 'bartender',
          executedAt: new Date().toISOString(),
        })
        .run()
    } else {
      // Parse scene data and apply to fixtures
      const sceneData = JSON.parse(scene.sceneData || '[]')

      if (sceneData.length > 0) {
        // Get fixtures for this scene
        const fixtureIds = sceneData.map((s: { fixtureId: string }) => s.fixtureId)

        // TODO: Apply fixture states via DMX connection manager
        // For now, log the action
        logger.info('[DMX] Applying scene to fixtures', {
          sceneName: scene.name,
          fixtureCount: fixtureIds.length,
          fadeTime: actualFadeTime,
        })

        // Log execution
        await db.insert(schema.dmxExecutionLogs)
          .values({
            id: randomUUID(),
            actionType: 'scene_recall',
            actionId: sceneId,
            actionName: scene.name,
            success: true,
            triggeredBy: 'bartender',
            metadata: JSON.stringify({ fixtureCount: fixtureIds.length, fadeTime: actualFadeTime }),
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
