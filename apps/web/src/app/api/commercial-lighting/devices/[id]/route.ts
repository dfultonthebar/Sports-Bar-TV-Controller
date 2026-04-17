/**
 * Commercial Lighting Device API
 * GET /api/commercial-lighting/devices/[id] - Get device details
 * PUT /api/commercial-lighting/devices/[id] - Update device
 * DELETE /api/commercial-lighting/devices/[id] - Delete device
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get device details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const device = await db
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
      .where(eq(schema.commercialLightingDevices.id, id))
      .get()

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: device,
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to fetch device', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch device' },
      { status: 500 }
    )
  }
}

// PUT - Update device
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      name,
      zoneId,
      externalId,
      deviceType,
      capabilities,
      minLevel,
      maxLevel,
      displayOrder,
      isActive,
    } = body

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }

    if (name !== undefined) updateData.name = name
    if (zoneId !== undefined) updateData.zoneId = zoneId
    if (externalId !== undefined) updateData.externalId = externalId
    if (deviceType !== undefined) updateData.deviceType = deviceType
    if (capabilities !== undefined) {
      updateData.capabilities = typeof capabilities === 'string' ? capabilities : JSON.stringify(capabilities)
    }
    if (minLevel !== undefined) updateData.minLevel = minLevel
    if (maxLevel !== undefined) updateData.maxLevel = maxLevel
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder
    if (isActive !== undefined) updateData.isActive = isActive

    const updated = await db
      .update(schema.commercialLightingDevices)
      .set(updateData)
      .where(eq(schema.commercialLightingDevices.id, id))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    logger.info('[LIGHTING] Updated device', { id, updates: Object.keys(updateData) })

    return NextResponse.json({
      success: true,
      data: updated[0],
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to update device', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to update device' },
      { status: 500 }
    )
  }
}

// DELETE - Delete device
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const deleted = await db
      .delete(schema.commercialLightingDevices)
      .where(eq(schema.commercialLightingDevices.id, id))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    logger.info('[LIGHTING] Deleted device', { id })

    return NextResponse.json({
      success: true,
      message: 'Device deleted successfully',
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to delete device', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to delete device' },
      { status: 500 }
    )
  }
}
