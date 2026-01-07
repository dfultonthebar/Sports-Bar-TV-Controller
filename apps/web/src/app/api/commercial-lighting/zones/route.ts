/**
 * Commercial Lighting Zones API
 * GET /api/commercial-lighting/zones - List all zones
 * POST /api/commercial-lighting/zones - Create a new zone
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

// GET - List all zones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const systemId = searchParams.get('systemId')
    const bartenderOnly = searchParams.get('bartenderOnly') === 'true'

    const zones = await db
      .select({
        id: schema.commercialLightingZones.id,
        name: schema.commercialLightingZones.name,
        externalId: schema.commercialLightingZones.externalId,
        zoneType: schema.commercialLightingZones.zoneType,
        currentLevel: schema.commercialLightingZones.currentLevel,
        isOn: schema.commercialLightingZones.isOn,
        displayOrder: schema.commercialLightingZones.displayOrder,
        bartenderVisible: schema.commercialLightingZones.bartenderVisible,
        iconName: schema.commercialLightingZones.iconName,
        systemId: schema.commercialLightingZones.systemId,
        systemName: schema.commercialLightingSystems.name,
        systemType: schema.commercialLightingSystems.systemType,
      })
      .from(schema.commercialLightingZones)
      .leftJoin(
        schema.commercialLightingSystems,
        eq(schema.commercialLightingZones.systemId, schema.commercialLightingSystems.id)
      )
      .orderBy(schema.commercialLightingZones.displayOrder, schema.commercialLightingZones.name)

    // Filter in JS
    let filtered = zones
    if (systemId) {
      filtered = filtered.filter(z => z.systemId === systemId)
    }
    if (bartenderOnly) {
      filtered = filtered.filter(z => z.bartenderVisible)
    }

    return NextResponse.json({
      success: true,
      data: filtered,
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to fetch zones', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch zones' },
      { status: 500 }
    )
  }
}

// POST - Create a new zone
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { systemId, name, externalId, zoneType, displayOrder, bartenderVisible, iconName } = body

    if (!systemId || !name) {
      return NextResponse.json(
        { success: false, error: 'systemId and name are required' },
        { status: 400 }
      )
    }

    const newZone = await db
      .insert(schema.commercialLightingZones)
      .values({
        systemId,
        name,
        externalId: externalId || null,
        zoneType: zoneType || 'zone',
        displayOrder: displayOrder || 0,
        bartenderVisible: bartenderVisible !== false,
        iconName: iconName || null,
      })
      .returning()

    logger.info('[LIGHTING] Created zone', {
      id: newZone[0].id,
      name,
      systemId,
    })

    return NextResponse.json({
      success: true,
      data: newZone[0],
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to create zone', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to create zone' },
      { status: 500 }
    )
  }
}
