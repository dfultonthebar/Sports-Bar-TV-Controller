/**
 * Commercial Lighting System API
 * GET /api/commercial-lighting/systems/[id] - Get system details
 * PUT /api/commercial-lighting/systems/[id] - Update system
 * DELETE /api/commercial-lighting/systems/[id] - Delete system
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get system details
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get zones and devices for this system
    const zones = await db
      .select()
      .from(schema.commercialLightingZones)
      .where(eq(schema.commercialLightingZones.systemId, id))

    const devices = await db
      .select()
      .from(schema.commercialLightingDevices)
      .where(eq(schema.commercialLightingDevices.systemId, id))

    const scenes = await db
      .select()
      .from(schema.commercialLightingScenes)
      .where(eq(schema.commercialLightingScenes.systemId, id))

    return NextResponse.json({
      success: true,
      data: {
        ...system,
        zones,
        devices,
        scenes,
      },
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to fetch system', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch system' },
      { status: 500 }
    )
  }
}

// PUT - Update system
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    const { name, ipAddress, port, username, password, applicationKey, certificate, status } = body

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }

    if (name !== undefined) updateData.name = name
    if (ipAddress !== undefined) updateData.ipAddress = ipAddress
    if (port !== undefined) updateData.port = port
    if (username !== undefined) updateData.username = username
    if (password !== undefined) updateData.password = password
    if (applicationKey !== undefined) updateData.applicationKey = applicationKey
    if (certificate !== undefined) updateData.certificate = certificate
    if (status !== undefined) updateData.status = status

    const updated = await db
      .update(schema.commercialLightingSystems)
      .set(updateData)
      .where(eq(schema.commercialLightingSystems.id, id))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: 'System not found' },
        { status: 404 }
      )
    }

    logger.info('[LIGHTING] Updated commercial lighting system', { id, updates: Object.keys(updateData) })

    return NextResponse.json({
      success: true,
      data: updated[0],
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to update system', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to update system' },
      { status: 500 }
    )
  }
}

// DELETE - Delete system
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Zones, devices, scenes, and logs will cascade delete due to FK constraints
    const deleted = await db
      .delete(schema.commercialLightingSystems)
      .where(eq(schema.commercialLightingSystems.id, id))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json(
        { success: false, error: 'System not found' },
        { status: 404 }
      )
    }

    logger.info('[LIGHTING] Deleted commercial lighting system', { id })

    return NextResponse.json({
      success: true,
      message: 'System deleted successfully',
    })
  } catch (error) {
    logger.error('[LIGHTING] Failed to delete system', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to delete system' },
      { status: 500 }
    )
  }
}
