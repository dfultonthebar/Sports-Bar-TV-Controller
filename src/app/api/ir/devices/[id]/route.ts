

import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { logDatabaseOperation } from '@/lib/database-logger'
import { irDevices, globalCachePorts, globalCacheDevices, irCommands } from '@/db/schema'
import { findFirst, findMany, update, deleteRecord } from '@/lib/db-helpers'

/**
 * GET /api/ir/devices/:id
 * Get a specific IR device
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 [IR DEVICES] Fetching device')
  console.log('   ID:', params.id)
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const device = await findFirst('irDevices', {
      where: eq(schema.irDevices.id, params.id)
    })

    if (!device) {
      console.log('❌ [IR DEVICES] Device not found')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    // Fetch related ports if Global Cache device is assigned
    let ports: any[] = []
    if (device.globalCacheDeviceId) {
      ports = await findMany('globalCachePorts', {
        where: eq(schema.globalCachePorts.deviceId, device.globalCacheDeviceId)
      })
    }

    // Fetch commands for this device
    const commands = await findMany('irCommands', {
      where: eq(schema.irCommands.deviceId, device.id),
      orderBy: asc(schema.irCommands.category)
    })

    const deviceWithRelations = {
      ...device,
      ports,
      commands
    }

    console.log('✅ [IR DEVICES] Device fetched successfully')
    console.log('   Name:', device.name)
    console.log('   Commands count:', commands.length)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'get', {
      deviceId: device.id,
      name: device.name
    })

    return NextResponse.json({ success: true, device: deviceWithRelations })
  } catch (error: any) {
    console.error('❌ [IR DEVICES] Error fetching device:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'get_error', {
      deviceId: params.id,
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/ir/devices/:id
 * Update an IR device
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✏️  [IR DEVICES] Updating device')
  console.log('   ID:', params.id)
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const body = await request.json()
    const {
      name,
      deviceType,
      brand,
      model,
      matrixInput,
      matrixInputLabel,
      irCodeSetId,
      globalCacheDeviceId,
      globalCachePortNumber,
      description,
      status
    } = body

    console.log('   Update fields:')
    console.log('     Name:', name)
    console.log('     Global Cache Device:', globalCacheDeviceId)
    console.log('     Global Cache Port:', globalCachePortNumber)

    // Build update data object
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (deviceType !== undefined) updateData.deviceType = deviceType
    if (brand !== undefined) updateData.brand = brand
    if (model !== undefined) updateData.model = model
    if (matrixInput !== undefined) updateData.matrixInput = matrixInput
    if (matrixInputLabel !== undefined) updateData.matrixInputLabel = matrixInputLabel
    if (irCodeSetId !== undefined) updateData.irCodeSetId = irCodeSetId
    if (globalCacheDeviceId !== undefined) updateData.globalCacheDeviceId = globalCacheDeviceId
    if (globalCachePortNumber !== undefined) updateData.globalCachePortNumber = globalCachePortNumber
    if (description !== undefined) updateData.description = description
    if (status !== undefined) updateData.status = status

    const device = await update('irDevices', eq(schema.irDevices.id, params.id), updateData)

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    // Fetch related ports if Global Cache device is assigned
    let ports: any[] = []
    if (device.globalCacheDeviceId) {
      ports = await findMany('globalCachePorts', {
        where: eq(schema.globalCachePorts.deviceId, device.globalCacheDeviceId)
      })
    }

    // Fetch commands for this device
    const commands = await findMany('irCommands', {
      where: eq(schema.irCommands.deviceId, device.id)
    })

    const deviceWithRelations = {
      ...device,
      ports,
      commands
    }

    console.log('✅ [IR DEVICES] Device updated successfully')
    console.log('   Name:', device.name)
    console.log('   Global Cache Device:', device.globalCacheDeviceId || 'Not assigned')
    console.log('   Global Cache Port:', device.globalCachePortNumber || 'Not assigned')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'update', {
      deviceId: device.id,
      name: device.name
    })

    return NextResponse.json({ success: true, device: deviceWithRelations })
  } catch (error: any) {
    console.error('❌ [IR DEVICES] Error updating device:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'update_error', {
      deviceId: params.id,
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ir/devices/:id
 * Delete an IR device
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🗑️  [IR DEVICES] Deleting device')
  console.log('   ID:', params.id)
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    await deleteRecord('irDevices', eq(schema.irDevices.id, params.id))

    console.log('✅ [IR DEVICES] Device deleted successfully')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'delete', {
      deviceId: params.id
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ [IR DEVICES] Error deleting device:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'delete_error', {
      deviceId: params.id,
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
