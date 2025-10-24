

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { logDatabaseOperation } from '@/lib/database-logger'
import { irDevices } from '@/db/schema'
import { prisma } from '@/db/prisma-adapter'

/**
 * GET /api/ir/devices
 * List all IR devices
 */
export async function GET() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 [IR DEVICES] Fetching all IR devices')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const devices = await prisma.iRDevice.findMany({
      include: {
        ports: {
          include: {
            device: true
          }
        },
        commands: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    console.log('✅ [IR DEVICES] Fetched successfully')
    console.log('   Count:', devices.length)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'list', {
      count: devices.length
    })

    return NextResponse.json({ success: true, devices })
  } catch (error: any) {
    console.error('❌ [IR DEVICES] Error fetching devices:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'list_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ir/devices
 * Create a new IR device
 */
export async function POST(request: NextRequest) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('➕ [IR DEVICES] Creating new IR device')
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
      description
    } = body

    if (!name || !deviceType || !brand) {
      console.log('❌ [IR DEVICES] Missing required fields')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json(
        { success: false, error: 'Name, device type, and brand are required' },
        { status: 400 }
      )
    }

    console.log('   Name:', name)
    console.log('   Type:', deviceType)
    console.log('   Brand:', brand)
    console.log('   Model:', model || 'N/A')
    console.log('   Global Cache Device:', globalCacheDeviceId || 'Not assigned')
    console.log('   Global Cache Port:', globalCachePortNumber || 'Not assigned')

    const device = await prisma.iRDevice.create({
      data: {
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
        status: 'active'
      },
      include: {
        ports: true,
        commands: true
      }
    })

    console.log('✅ [IR DEVICES] Device created successfully')
    console.log('   ID:', device.id)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'create', {
      deviceId: device.id,
      name: device.name,
      deviceType: device.deviceType,
      brand: device.brand
    })

    return NextResponse.json({
      success: true,
      device
    })
  } catch (error: any) {
    console.error('❌ [IR DEVICES] Error creating device:', error)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'create_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
