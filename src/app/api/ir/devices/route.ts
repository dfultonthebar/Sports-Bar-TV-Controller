

import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { logDatabaseOperation } from '@/lib/database-logger'
import { irDevices, globalCachePorts, globalCacheDevices, irCommands } from '@/db/schema'
import { findMany, create } from '@/lib/db-helpers'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
/**
 * GET /api/ir/devices
 * List all IR devices
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('📋 [IR DEVICES] Fetching all IR devices')
  logger.info('   Timestamp:', new Date().toISOString())
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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

    logger.info('✅ [IR DEVICES] Fetched successfully')
    logger.info('   Count:', devicesWithRelations.length)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'list', {
      count: devicesWithRelations.length
    })

    return NextResponse.json({ success: true, devices: devicesWithRelations })
  } catch (error: any) {
    logger.error('❌ [IR DEVICES] Error fetching devices:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error
  const body = bodyValidation.data


  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('➕ [IR DEVICES] Creating new IR device')
  logger.info('   Timestamp:', new Date().toISOString())
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
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
      logger.info('❌ [IR DEVICES] Missing required fields')
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      return NextResponse.json(
        { success: false, error: 'Name, device type, and brand are required' },
        { status: 400 }
      )
    }

    logger.info('   Name:', name)
    logger.info('   Type:', deviceType)
    logger.info('   Brand:', brand)
    logger.info('   Model:', model || 'N/A')
    logger.info('   Global Cache Device:', globalCacheDeviceId || 'Not assigned')
    logger.info('   Global Cache Port:', globalCachePortNumber || 'Not assigned')

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

    logger.info('✅ [IR DEVICES] Device created successfully')
    logger.info('   ID:', device.id)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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
    logger.error('❌ [IR DEVICES] Error creating device:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'create_error', {
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
