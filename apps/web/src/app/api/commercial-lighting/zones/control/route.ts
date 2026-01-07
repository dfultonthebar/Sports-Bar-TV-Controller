/**
 * Commercial Lighting Zone Control API
 * POST /api/commercial-lighting/zones/control - Set zone level
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { LutronLIPClient, HueClient } from '@sports-bar/commercial-lighting'

// POST - Set zone level
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { zoneId, level, fadeTime, triggeredBy } = body

    if (!zoneId || level === undefined) {
      return NextResponse.json(
        { success: false, error: 'zoneId and level are required' },
        { status: 400 }
      )
    }

    // Validate level
    const clampedLevel = Math.min(100, Math.max(0, Math.round(level)))

    // Get zone and its system
    const zone = await db
      .select({
        id: schema.commercialLightingZones.id,
        name: schema.commercialLightingZones.name,
        externalId: schema.commercialLightingZones.externalId,
        systemId: schema.commercialLightingZones.systemId,
        currentLevel: schema.commercialLightingZones.currentLevel,
      })
      .from(schema.commercialLightingZones)
      .where(eq(schema.commercialLightingZones.id, zoneId))
      .get()

    if (!zone) {
      return NextResponse.json(
        { success: false, error: 'Zone not found' },
        { status: 404 }
      )
    }

    if (!zone.systemId) {
      return NextResponse.json(
        { success: false, error: 'Zone has no system configured' },
        { status: 400 }
      )
    }

    const system = await db
      .select()
      .from(schema.commercialLightingSystems)
      .where(eq(schema.commercialLightingSystems.id, zone.systemId))
      .get()

    if (!system) {
      return NextResponse.json(
        { success: false, error: 'System not found' },
        { status: 404 }
      )
    }

    let success = false
    let message = ''

    try {
      if (system.systemType.startsWith('lutron-')) {
        // Lutron: Set output level by integration ID
        if (!zone.externalId) {
          return NextResponse.json(
            { success: false, error: 'Zone missing Lutron integration ID' },
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
          parseInt(zone.externalId, 10),
          clampedLevel,
          fadeTime
        )
        client.disconnect()

        message = success ? `Zone set to ${clampedLevel}%` : 'Failed to set zone level'
      } else if (system.systemType === 'philips-hue') {
        // Hue: Set grouped light state
        if (!zone.externalId) {
          return NextResponse.json(
            { success: false, error: 'Zone missing Hue group ID' },
            { status: 400 }
          )
        }

        const client = new HueClient({
          bridgeIp: system.ipAddress,
          applicationKey: system.applicationKey || '',
          port: system.port || 443,
        })

        success = await client.setGroupState(zone.externalId, {
          on: clampedLevel > 0,
          brightness: clampedLevel,
          transitionTime: fadeTime ? fadeTime * 1000 : undefined,
        })

        message = success ? `Zone set to ${clampedLevel}%` : 'Failed to set zone level'
      } else {
        return NextResponse.json(
          { success: false, error: `Unsupported system type: ${system.systemType}` },
          { status: 400 }
        )
      }
    } catch (error) {
      success = false
      message = error instanceof Error ? error.message : 'Zone control failed'
    }

    // Update zone state in database
    if (success) {
      await db
        .update(schema.commercialLightingZones)
        .set({
          currentLevel: clampedLevel,
          isOn: clampedLevel > 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.commercialLightingZones.id, zoneId))
    }

    // Log the execution
    await db.insert(schema.commercialLightingLogs).values({
      systemId: zone.systemId,
      actionType: 'level_change',
      targetId: zoneId,
      targetName: zone.name,
      value: String(clampedLevel),
      success,
      errorMessage: success ? null : message,
      triggeredBy: triggeredBy || 'api',
    })

    logger.info('[LIGHTING] Zone control', {
      zoneId,
      zoneName: zone.name,
      level: clampedLevel,
      success,
    })

    return NextResponse.json({
      success,
      message,
      data: {
        zoneId,
        zoneName: zone.name,
        level: clampedLevel,
        previousLevel: zone.currentLevel,
      },
    })
  } catch (error) {
    logger.error('[LIGHTING] Zone control failed', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to control zone' },
      { status: 500 }
    )
  }
}
