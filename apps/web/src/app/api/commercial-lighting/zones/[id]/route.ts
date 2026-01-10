/**
 * Commercial Lighting Zone API
 * GET /api/commercial-lighting/zones/[id] - Get zone details
 * PUT /api/commercial-lighting/zones/[id] - Update zone
 * DELETE /api/commercial-lighting/zones/[id] - Delete zone
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get zone details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const zone = await db
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
        createdAt: schema.commercialLightingZones.createdAt,
        updatedAt: schema.commercialLightingZones.updatedAt,
        systemName: schema.commercialLightingSystems.name,
        systemType: schema.commercialLightingSystems.systemType,
      })
      .from(schema.commercialLightingZones)
      .leftJoin(
        schema.commercialLightingSystems,
        eq(schema.commercialLightingZones.systemId, schema.commercialLightingSystems.id)
      )
      .where(eq(schema.commercialLightingZones.id, id))
      .get()

    if (!zone) {
      return NextResponse.json(
        { success: false, error: 'Zone not found' },
        { status: 404 }
      )
    }

    // Get devices in this zone
    const devices = await db
      .select()
      .from(schema.commercialLightingDevices)
      .where(eq(schema.commercialLightingDevices.zoneId, id))

    return NextResponse.json({
      success: true,
      data: {
        ...zone,
        devices,
      },
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to fetch zone', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch zone' },
      { status: 500 }
    )
  }
}

// PUT - Update zone
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    const { name, externalId, zoneType, displayOrder, bartenderVisible, iconName } = body

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }

    if (name !== undefined) updateData.name = name
    if (externalId !== undefined) updateData.externalId = externalId
    if (zoneType !== undefined) updateData.zoneType = zoneType
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder
    if (bartenderVisible !== undefined) updateData.bartenderVisible = bartenderVisible
    if (iconName !== undefined) updateData.iconName = iconName

    const updated = await db
      .update(schema.commercialLightingZones)
      .set(updateData)
      .where(eq(schema.commercialLightingZones.id, id))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Zone not found' },
        { status: 404 }
      )
    }

    logger.info('[LIGHTING] Updated zone', { id, updates: Object.keys(updateData) })

    return NextResponse.json({
      success: true,
      data: updated[0],
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to update zone', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to update zone' },
      { status: 500 }
    )
  }
}

// DELETE - Delete zone
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Devices in this zone will have zoneId set to null due to FK constraint
    const deleted = await db
      .delete(schema.commercialLightingZones)
      .where(eq(schema.commercialLightingZones.id, id))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Zone not found' },
        { status: 404 }
      )
    }

    logger.info('[LIGHTING] Deleted zone', { id })

    return NextResponse.json({
      success: true,
      message: 'Zone deleted successfully',
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to delete zone', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to delete zone' },
      { status: 500 }
    )
  }
}
