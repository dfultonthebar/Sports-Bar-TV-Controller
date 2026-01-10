/**
 * Commercial Lighting Device Control API
 * POST /api/commercial-lighting/devices/control - Set device state
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { LutronLIPClient, HueClient } from '@sports-bar/commercial-lighting'

// POST - Set device state
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId, level, isOn, colorHex, colorTemp, fadeTime, triggeredBy } = body

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      )
    }

    // Get device and its system
    const device = await db
      .select({
        id: schema.commercialLightingDevices.id,
        name: schema.commercialLightingDevices.name,
        externalId: schema.commercialLightingDevices.externalId,
        deviceType: schema.commercialLightingDevices.deviceType,
        systemId: schema.commercialLightingDevices.systemId,
        currentLevel: schema.commercialLightingDevices.currentLevel,
        isOn: schema.commercialLightingDevices.isOn,
        minLevel: schema.commercialLightingDevices.minLevel,
        maxLevel: schema.commercialLightingDevices.maxLevel,
      })
      .from(schema.commercialLightingDevices)
      .where(eq(schema.commercialLightingDevices.id, deviceId))
      .get()

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    if (!device.systemId) {
      return NextResponse.json(
        { success: false, error: 'Device has no system configured' },
        { status: 400 }
      )
    }

    const system = await db
      .select()
      .from(schema.commercialLightingSystems)
      .where(eq(schema.commercialLightingSystems.id, device.systemId))
      .get()

    if (!system) {
      return NextResponse.json(
        { success: false, error: 'System not found' },
        { status: 404 }
      )
    }

    // Calculate target level
    let targetLevel = device.currentLevel
    if (level !== undefined) {
      targetLevel = Math.min(device.maxLevel, Math.max(device.minLevel, Math.round(level)))
    } else if (isOn !== undefined) {
      targetLevel = isOn ? device.maxLevel : 0
    }

    let success = false
    let message = ''

    try {
      if (system.systemType.startsWith('lutron-')) {
        // Lutron: Set output level by integration ID
        if (!device.externalId) {
          return NextResponse.json(
            { success: false, error: 'Device missing Lutron integration ID' },
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
        success = await client.setOutputLevel(
          parseInt(device.externalId, 10),
          targetLevel,
          fadeTime
        )
        client.disconnect()

        message = success ? `Device set to ${targetLevel}%` : 'Failed to set device level'
      } else if (system.systemType === 'philips-hue') {
        // Hue: Set light state
        if (!device.externalId) {
          return NextResponse.json(
            { success: false, error: 'Device missing Hue light ID' },
            { status: 400 }
          )
        }

        const client = new HueClient({
          bridgeIp: system.ipAddress,
          applicationKey: system.applicationKey || '',
          port: system.port || 443,
        })

        const state: {
          on: boolean
          brightness?: number
          transitionTime?: number
          colorHex?: string
          colorTemp?: number
        } = {
          on: targetLevel > 0,
          brightness: targetLevel,
        }

        if (fadeTime) {
          state.transitionTime = fadeTime * 1000
        }
        if (colorHex && device.deviceType === 'color-light') {
          state.colorHex = colorHex
        }
        if (colorTemp && (device.deviceType === 'color-light' || device.deviceType === 'white-light')) {
          state.colorTemp = colorTemp
        }

        success = await client.setLightState(device.externalId, state)
        message = success ? `Device set to ${targetLevel}%` : 'Failed to set device state'
      } else {
        return NextResponse.json(
          { success: false, error: `Unsupported system type: ${system.systemType}` },
          { status: 400 }
        )
      }
    } catch (error) {
      success = false
      message = error instanceof Error ? error.message : 'Device control failed'
    }

    // Update device state in database
    if (success) {
      const updateData: Record<string, unknown> = {
        currentLevel: targetLevel,
        isOn: targetLevel > 0,
        updatedAt: new Date().toISOString(),
      }

      if (colorHex !== undefined) {
        updateData.colorHex = colorHex
      }
      if (colorTemp !== undefined) {
        updateData.colorTemp = colorTemp
      }

      await db
        .update(schema.commercialLightingDevices)
        .set(updateData)
        .where(eq(schema.commercialLightingDevices.id, deviceId))
    }

    // Log the execution
    await db.insert(schema.commercialLightingLogs).values({
      systemId: device.systemId,
      actionType: colorHex || colorTemp ? 'color_change' : 'level_change',
      targetId: deviceId,
      targetName: device.name,
      value: JSON.stringify({ level: targetLevel, colorHex, colorTemp }),
      success,
      errorMessage: success ? null : message,
      triggeredBy: triggeredBy || 'api',
    })

    logger.info('[LIGHTING] Device control', {
      deviceId,
      deviceName: device.name,
      level: targetLevel,
      success,
    })

    return NextResponse.json({
      success,
      message,
      data: {
        deviceId,
        deviceName: device.name,
        level: targetLevel,
        previousLevel: device.currentLevel,
        isOn: targetLevel > 0,
        colorHex,
        colorTemp,
      },
    })
  } catch (error) {
    logger.error('[LIGHTING] Device control failed', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to control device' },
      { status: 500 }
    )
  }
}
