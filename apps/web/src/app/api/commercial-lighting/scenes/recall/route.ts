/**
 * Commercial Lighting Scene Recall API
 * POST /api/commercial-lighting/scenes/recall - Recall (activate) a scene
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import {
  commercialLightingManager,
  LutronLIPClient,
  HueClient,
} from '@sports-bar/commercial-lighting'

// POST - Recall a scene
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sceneId, triggeredBy } = body

    if (!sceneId) {
      return NextResponse.json(
        { success: false, error: 'sceneId is required' },
        { status: 400 }
      )
    }

    // Get scene from database
    const scene = await db
      .select()
      .from(schema.commercialLightingScenes)
      .where(eq(schema.commercialLightingScenes.id, sceneId))
      .get()

    if (!scene) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      )
    }

    let success = false
    let message = ''

    // If scene has a system associated, use that system's native scene recall
    if (scene.systemId) {
      const system = await db
        .select()
        .from(schema.commercialLightingSystems)
        .where(eq(schema.commercialLightingSystems.id, scene.systemId))
        .get()

      if (!system) {
        return NextResponse.json(
          { success: false, error: 'Associated system not found' },
          { status: 404 }
        )
      }

      try {
        if (system.systemType.startsWith('lutron-')) {
          // Lutron: Recall scene by pressing keypad button
          if (!scene.triggerDeviceId || scene.triggerButtonId === null) {
            return NextResponse.json(
              { success: false, error: 'Lutron scene missing trigger device/button configuration' },
              { status: 400 }
            )
          }

          const client = new LutronLIPClient({
            host: system.ipAddress,
            port: system.port || 23,
            username: system.username || undefined,
            password: system.password || undefined,
          })

          await client.connect()
          success = await client.recallScene(
            parseInt(scene.triggerDeviceId, 10),
            scene.triggerButtonId
          )
          client.disconnect()

          message = success ? 'Lutron scene recalled successfully' : 'Failed to recall Lutron scene'
        } else if (system.systemType === 'philips-hue') {
          // Hue: Recall scene by ID
          if (!scene.externalId) {
            return NextResponse.json(
              { success: false, error: 'Hue scene missing external ID' },
              { status: 400 }
            )
          }

          const client = new HueClient({
            bridgeIp: system.ipAddress,
            applicationKey: system.applicationKey || '',
            port: system.port || 443,
          })

          success = await client.recallScene(scene.externalId)
          message = success ? 'Hue scene recalled successfully' : 'Failed to recall Hue scene'
        }
      } catch (error) {
        success = false
        message = error instanceof Error ? error.message : 'Scene recall failed'
      }
    } else if (scene.sceneData) {
      // Custom scene: Apply device states from sceneData
      // This would iterate through devices and set their states
      // For now, return that custom scenes aren't fully implemented
      return NextResponse.json(
        { success: false, error: 'Custom scene recall not yet implemented - please assign scene to a system' },
        { status: 501 }
      )
    } else {
      return NextResponse.json(
        { success: false, error: 'Scene has no system or scene data configured' },
        { status: 400 }
      )
    }

    // Update scene usage stats
    await db
      .update(schema.commercialLightingScenes)
      .set({
        usageCount: (scene.usageCount || 0) + 1,
        lastUsed: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.commercialLightingScenes.id, sceneId))

    // Log the execution
    await db.insert(schema.commercialLightingLogs).values({
      systemId: scene.systemId,
      actionType: 'scene_recall',
      targetId: sceneId,
      targetName: scene.name,
      success,
      errorMessage: success ? null : message,
      triggeredBy: triggeredBy || 'api',
    })

    logger.info('[LIGHTING] Scene recall', {
      sceneId,
      sceneName: scene.name,
      success,
      triggeredBy,
    })

    return NextResponse.json({
      success,
      message,
      data: {
        sceneId,
        sceneName: scene.name,
      },
    })
  } catch (error) {
    logger.error('[LIGHTING] Scene recall failed', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to recall scene' },
      { status: 500 }
    )
  }
}
