

import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { logDatabaseOperation } from '@/lib/database-logger'
import { irDevices, globalCachePorts, globalCacheDevices, irCommands } from '@/db/schema'
import { findMany, create } from '@/lib/db-helpers'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * GET /api/ir/devices
 * List all IR devices
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 [IR DEVICES] Fetching all IR devices')
  console.log('   Timestamp:', new Date().toISOString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    // Fetch all IR devices
    const devices = await findMany('irDevices', {
      orderBy: asc(schema.irDevices.createdAt)
    })

    // Fetch all ports
    const allPorts = await findMany('globalCachePorts', {})

    // Fetch all commands
    const allCommands = await findMany('irCommands', {})

    // Combine devices with their ports and commands
    const devicesWithRelations = devices.map(device => {
      // Find ports for Global Cache devices
      const ports = allPorts.filter(port => 
        device.globalCacheDeviceId && port.deviceId === device.globalCacheDeviceId
      )

      // Find commands for this device
      const commands = allCommands.filter(cmd => cmd.deviceId === device.id)

      return {
        ...device,
        ports: ports || [],
        commands: commands || []
      }
    })

    console.log('✅ [IR DEVICES] Fetched successfully')
    console.log('   Count:', devicesWithRelations.length)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'list', {
      count: devicesWithRelations.length
    })

    return NextResponse.json({ success: true, devices: devicesWithRelations })
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
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

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

    const device = await create('irDevices', {
      name,
      deviceType,
      brand,
      model: model || null,
      matrixInput: matrixInput || null,
      matrixInputLabel: matrixInputLabel || null,
      irCodeSetId: irCodeSetId || null,
      globalCacheDeviceId: globalCacheDeviceId || null,
      globalCachePortNumber: globalCachePortNumber || null,
      description: description || null,
      status: 'active'
    })

    // Fetch related data
    const ports: any[] = []
    const commands = await findMany('irCommands', {
      where: eq(schema.irCommands.deviceId, device.id)
    })

    const deviceWithRelations = {
      ...device,
      ports,
      commands
    }

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
      device: deviceWithRelations
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
