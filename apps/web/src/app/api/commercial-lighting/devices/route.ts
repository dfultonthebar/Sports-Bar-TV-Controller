/**
 * Commercial Lighting Devices API
 * GET /api/commercial-lighting/devices - List all devices
 * POST /api/commercial-lighting/devices - Create a new device
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

// GET - List all devices
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const systemId = searchParams.get('systemId')
    const zoneId = searchParams.get('zoneId')
    const deviceType = searchParams.get('deviceType')

    const devices = await db
      .select({
        id: schema.commercialLightingDevices.id,
        name: schema.commercialLightingDevices.name,
        externalId: schema.commercialLightingDevices.externalId,
        deviceType: schema.commercialLightingDevices.deviceType,
        capabilities: schema.commercialLightingDevices.capabilities,
        minLevel: schema.commercialLightingDevices.minLevel,
        maxLevel: schema.commercialLightingDevices.maxLevel,
        currentLevel: schema.commercialLightingDevices.currentLevel,
        isOn: schema.commercialLightingDevices.isOn,
        colorHex: schema.commercialLightingDevices.colorHex,
        colorTemp: schema.commercialLightingDevices.colorTemp,
        displayOrder: schema.commercialLightingDevices.displayOrder,
        isActive: schema.commercialLightingDevices.isActive,
        systemId: schema.commercialLightingDevices.systemId,
        zoneId: schema.commercialLightingDevices.zoneId,
        createdAt: schema.commercialLightingDevices.createdAt,
        updatedAt: schema.commercialLightingDevices.updatedAt,
        systemName: schema.commercialLightingSystems.name,
        systemType: schema.commercialLightingSystems.systemType,
        zoneName: schema.commercialLightingZones.name,
      })
      .from(schema.commercialLightingDevices)
      .leftJoin(
        schema.commercialLightingSystems,
        eq(schema.commercialLightingDevices.systemId, schema.commercialLightingSystems.id)
      )
      .leftJoin(
        schema.commercialLightingZones,
        eq(schema.commercialLightingDevices.zoneId, schema.commercialLightingZones.id)
      )
      .orderBy(schema.commercialLightingDevices.displayOrder, schema.commercialLightingDevices.name)

    // Filter in JS
    let filtered = devices
    if (systemId) {
      filtered = filtered.filter(d => d.systemId === systemId)
    }
    if (zoneId) {
      filtered = filtered.filter(d => d.zoneId === zoneId)
    }
    if (deviceType) {
      filtered = filtered.filter(d => d.deviceType === deviceType)
    }

    return NextResponse.json({
      success: true,
      data: filtered,
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to fetch devices', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch devices' },
      { status: 500 }
    )
  }
}

// POST - Create a new device
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      systemId,
      zoneId,
      name,
      externalId,
      deviceType,
      capabilities,
      minLevel,
      maxLevel,
      displayOrder,
    } = body

    if (!systemId || !name || !externalId || !deviceType) {
      return NextResponse.json(
        { success: false, error: 'systemId, name, externalId, and deviceType are required' },
        { status: 400 }
      )
    }

    // Validate device type
    const validTypes = ['dimmer', 'switch', 'color-light', 'white-light', 'plug', 'keypad', 'sensor']
    if (!validTypes.includes(deviceType)) {
      return NextResponse.json(
        { success: false, error: `Invalid deviceType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const newDevice = await db
      .insert(schema.commercialLightingDevices)
      .values({
        systemId,
        zoneId: zoneId || null,
        name,
        externalId,
        deviceType,
        capabilities: capabilities ? JSON.stringify(capabilities) : null,
        minLevel: minLevel ?? 0,
        maxLevel: maxLevel ?? 100,
        displayOrder: displayOrder ?? 0,
      })
      .returning()

    logger.info('[LIGHTING] Created device', {
      id: newDevice[0].id,
      name,
      deviceType,
      systemId,
    })

    return NextResponse.json({
      success: true,
      data: newDevice[0],
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to create device', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to create device' },
      { status: 500 }
    )
  }
}
