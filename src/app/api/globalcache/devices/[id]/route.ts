import { NextRequest, NextResponse } from 'next/server'
import { globalCacheDevices, globalCachePorts } from '@/db/schema'
import { db, schema } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { findFirst, findMany, update, deleteRecord } from '@/lib/db-helpers'

/**
 * GET /api/globalcache/devices/[id]
 * Get a specific Global Cache device
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const device = await findFirst('globalCacheDevices', {
      where: eq(schema.globalCacheDevices.id, params.id)
    })

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    // Fetch ports for this device
    const ports = await findMany('globalCachePorts', {
      where: eq(schema.globalCachePorts.deviceId, params.id),
      orderBy: asc(schema.globalCachePorts.portNumber)
    })

    const deviceWithPorts = {
      ...device,
      ports
    }

    return NextResponse.json({
      success: true,
      device: deviceWithPorts
    })
  } catch (error) {
    console.error('Error fetching device:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch device' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/globalcache/devices/[id]
 * Delete a Global Cache device
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteRecord('globalCacheDevices', eq(schema.globalCacheDevices.id, params.id))

    console.log(`Global Cache device deleted: ${params.id}`)

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Error deleting device:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete device' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/globalcache/devices/[id]
 * Update a Global Cache device
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, ipAddress, port, model } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (ipAddress !== undefined) updateData.ipAddress = ipAddress
    if (port !== undefined) updateData.port = port
    if (model !== undefined) updateData.model = model

    const device = await update('globalCacheDevices', eq(schema.globalCacheDevices.id, params.id), updateData)

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    // Fetch ports for this device
    const ports = await findMany('globalCachePorts', {
      where: eq(schema.globalCachePorts.deviceId, params.id),
      orderBy: asc(schema.globalCachePorts.portNumber)
    })

    const deviceWithPorts = {
      ...device,
      ports
    }

    console.log(`Global Cache device updated: ${device.name}`)

    return NextResponse.json({
      success: true,
      device: deviceWithPorts
    })
  } catch (error) {
    console.error('Error updating device:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update device' },
      { status: 500 }
    )
  }
}
