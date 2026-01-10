/**
 * Commercial Lighting System Sync API
 * POST /api/commercial-lighting/systems/[id]/sync - Sync devices from system
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { LutronLIPClient, HueClient } from '@sports-bar/commercial-lighting'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST - Sync devices from system
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const system = await db
      .select()
      .from(schema.commercialLightingSystems)
      .where(eq(schema.commercialLightingSystems.id, id))
      .get()

    if (!system) {
      return NextResponse.json(
        { success: false, error: 'System not found' },
        { status: 404 }
      )
    }

    let syncedDevices: Array<{
      externalId: string
      name: string
      deviceType: string
      zoneId?: string
      zoneName?: string
    }> = []
    let syncedZones: Array<{
      externalId: string
      name: string
      zoneType: string
    }> = []
    let syncedScenes: Array<{
      externalId: string
      name: string
    }> = []

    try {
      if (system.systemType.startsWith('lutron-')) {
        // Lutron: Query integration report for devices
        const client = new LutronLIPClient({
          host: system.ipAddress,
          port: system.port || 23,
          username: system.username || undefined,
          password: system.password || undefined,
        })

        await client.connect()

        // Get device list from Lutron
        const devices = await client.getDevices()
        const zones = await client.getZones()
        const scenes = await client.getScenes()

        client.disconnect()

        // Sync zones first
        for (const zone of zones) {
          const existingZone = await db
            .select()
            .from(schema.commercialLightingZones)
            .where(eq(schema.commercialLightingZones.externalId, zone.integrationId.toString()))
            .get()

          if (!existingZone) {
            await db.insert(schema.commercialLightingZones).values({
              systemId: id,
              name: zone.name,
              externalId: zone.integrationId.toString(),
              zoneType: 'zone',
            })
          }

          syncedZones.push({
            externalId: zone.integrationId.toString(),
            name: zone.name,
            zoneType: 'zone',
          })
        }

        // Sync devices
        for (const device of devices) {
          const existingDevice = await db
            .select()
            .from(schema.commercialLightingDevices)
            .where(eq(schema.commercialLightingDevices.externalId, device.integrationId.toString()))
            .get()

          if (!existingDevice) {
            await db.insert(schema.commercialLightingDevices).values({
              systemId: id,
              name: device.name,
              externalId: device.integrationId.toString(),
              deviceType: device.type === 'DIMMER' ? 'dimmer' : 'switch',
            })
          }

          syncedDevices.push({
            externalId: device.integrationId.toString(),
            name: device.name,
            deviceType: device.type === 'DIMMER' ? 'dimmer' : 'switch',
          })
        }

        // Sync scenes
        for (const scene of scenes) {
          const existingScene = await db
            .select()
            .from(schema.commercialLightingScenes)
            .where(eq(schema.commercialLightingScenes.externalId, scene.integrationId.toString()))
            .get()

          if (!existingScene) {
            await db.insert(schema.commercialLightingScenes).values({
              systemId: id,
              name: scene.name,
              externalId: scene.integrationId.toString(),
              triggerDeviceId: scene.keypadId?.toString() || null,
              triggerButtonId: scene.buttonNumber || null,
            })
          }

          syncedScenes.push({
            externalId: scene.integrationId.toString(),
            name: scene.name,
          })
        }
      } else if (system.systemType === 'philips-hue') {
        // Hue: Get lights, rooms, and scenes
        const client = new HueClient({
          bridgeIp: system.ipAddress,
          applicationKey: system.applicationKey || '',
          port: system.port || 443,
        })

        const lights = await client.getLights()
        const rooms = await client.getRooms()
        const scenes = await client.getScenes()

        // Sync rooms as zones
        for (const room of rooms) {
          const existingZone = await db
            .select()
            .from(schema.commercialLightingZones)
            .where(eq(schema.commercialLightingZones.externalId, room.id))
            .get()

          if (!existingZone) {
            await db.insert(schema.commercialLightingZones).values({
              systemId: id,
              name: room.name,
              externalId: room.id,
              zoneType: 'room',
            })
          }

          syncedZones.push({
            externalId: room.id,
            name: room.name,
            zoneType: 'room',
          })
        }

        // Sync lights as devices
        for (const light of lights) {
          const existingDevice = await db
            .select()
            .from(schema.commercialLightingDevices)
            .where(eq(schema.commercialLightingDevices.externalId, light.id))
            .get()

          // Determine device type based on capabilities
          let deviceType = 'white-light'
          if (light.capabilities?.includes('color')) {
            deviceType = 'color-light'
          } else if (light.capabilities?.includes('dimming')) {
            deviceType = 'dimmer'
          }

          // Find zone for this light
          let zoneId: string | undefined
          let zoneName: string | undefined
          const room = rooms.find(r => r.lights?.includes(light.id))
          if (room) {
            const zone = await db
              .select()
              .from(schema.commercialLightingZones)
              .where(eq(schema.commercialLightingZones.externalId, room.id))
              .get()
            if (zone) {
              zoneId = zone.id
              zoneName = zone.name
            }
          }

          if (!existingDevice) {
            await db.insert(schema.commercialLightingDevices).values({
              systemId: id,
              zoneId: zoneId || null,
              name: light.name,
              externalId: light.id,
              deviceType,
              capabilities: light.capabilities ? JSON.stringify(light.capabilities) : null,
            })
          }

          syncedDevices.push({
            externalId: light.id,
            name: light.name,
            deviceType,
            zoneId,
            zoneName,
          })
        }

        // Sync scenes
        for (const scene of scenes) {
          const existingScene = await db
            .select()
            .from(schema.commercialLightingScenes)
            .where(eq(schema.commercialLightingScenes.externalId, scene.id))
            .get()

          if (!existingScene) {
            await db.insert(schema.commercialLightingScenes).values({
              systemId: id,
              name: scene.name,
              externalId: scene.id,
            })
          }

          syncedScenes.push({
            externalId: scene.id,
            name: scene.name,
          })
        }
      } else {
        return NextResponse.json(
          { success: false, error: `Unsupported system type: ${system.systemType}` },
          { status: 400 }
        )
      }

      // Update system status
      await db
        .update(schema.commercialLightingSystems)
        .set({
          status: 'online',
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.commercialLightingSystems.id, id))

      // Log the sync
      await db.insert(schema.commercialLightingLogs).values({
        systemId: id,
        actionType: 'sync',
        targetId: id,
        targetName: system.name,
        value: JSON.stringify({
          devicesCount: syncedDevices.length,
          zonesCount: syncedZones.length,
          scenesCount: syncedScenes.length,
        }),
        success: true,
        triggeredBy: 'api',
      })

      logger.info('[LIGHTING] Synced system', {
        systemId: id,
        systemName: system.name,
        devicesCount: syncedDevices.length,
        zonesCount: syncedZones.length,
        scenesCount: syncedScenes.length,
      })

      return NextResponse.json({
        success: true,
        message: 'System synced successfully',
        data: {
          devices: syncedDevices,
          zones: syncedZones,
          scenes: syncedScenes,
          counts: {
            devices: syncedDevices.length,
            zones: syncedZones.length,
            scenes: syncedScenes.length,
          },
        },
      })
    } catch (error) {
      // Update system status to error
      await db
        .update(schema.commercialLightingSystems)
        .set({
          status: 'error',
          lastError: error instanceof Error ? error.message : 'Sync failed',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.commercialLightingSystems.id, id))

      // Log the failure
      await db.insert(schema.commercialLightingLogs).values({
        systemId: id,
        actionType: 'sync',
        targetId: id,
        targetName: system.name,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Sync failed',
        triggeredBy: 'api',
      })

      throw error
    }
  } catch (error) {
    logger.error('[LIGHTING] Failed to sync system', { error })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to sync system' },
      { status: 500 }
    )
  }
}
