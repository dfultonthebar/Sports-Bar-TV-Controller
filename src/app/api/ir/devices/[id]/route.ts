

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { logDatabaseOperation } from '@/lib/database-logger'

const prisma = new PrismaClient()

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
    const device = await prisma.iRDevice.findUnique({
      where: { id: params.id },
      include: {
        ports: {
          include: {
            device: true
          }
        },
        commands: {
          orderBy: {
            category: 'asc'
          }
        }
      }
    })

    if (!device) {
      console.log('❌ [IR DEVICES] Device not found')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    console.log('✅ [IR DEVICES] Device fetched successfully')
    console.log('   Name:', device.name)
    console.log('   Commands count:', device.commands.length)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'get', {
      deviceId: device.id,
      name: device.name
    })

    return NextResponse.json({ success: true, device })
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

    const device = await prisma.iRDevice.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(deviceType !== undefined && { deviceType }),
        ...(brand !== undefined && { brand }),
        ...(model !== undefined && { model }),
        ...(matrixInput !== undefined && { matrixInput }),
        ...(matrixInputLabel !== undefined && { matrixInputLabel }),
        ...(irCodeSetId !== undefined && { irCodeSetId }),
        ...(globalCacheDeviceId !== undefined && { globalCacheDeviceId }),
        ...(globalCachePortNumber !== undefined && { globalCachePortNumber }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status })
      },
      include: {
        ports: true,
        commands: true
      }
    })

    console.log('✅ [IR DEVICES] Device updated successfully')
    console.log('   Name:', device.name)
    console.log('   Global Cache Device:', device.globalCacheDeviceId || 'Not assigned')
    console.log('   Global Cache Port:', device.globalCachePortNumber || 'Not assigned')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'update', {
      deviceId: device.id,
      name: device.name
    })

    return NextResponse.json({ success: true, device })
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
    await prisma.iRDevice.delete({
      where: { id: params.id }
    })

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
