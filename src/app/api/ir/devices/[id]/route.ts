

import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { logDatabaseOperation } from '@/lib/database-logger'
import { irDevices, globalCachePorts, globalCacheDevices, irCommands } from '@/db/schema'
import { findFirst, findMany, update, deleteRecord } from '@/lib/db-helpers'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
/**
 * GET /api/ir/devices/:id
 * Get a specific IR device
 */
export async function GET(
  request: NextRequest,
  {  params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  const { id } = params
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('📋 [IR DEVICES] Fetching device')
  logger.info('   ID:', { data: id })
  logger.info('   Timestamp:', { data: new Date().toISOString() })
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    const device = await findFirst('irDevices', {
      where: eq(schema.irDevices.id, id)
    })

    if (!device) {
      logger.info('❌ [IR DEVICES] Device not found')
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
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

    logger.info('✅ [IR DEVICES] Device fetched successfully')
    logger.info('   Name:', device.name)
    logger.info('   Commands count:', { data: commands.length })
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'get', {
      deviceId: device.id,
      name: device.name
    })

    return NextResponse.json({ success: true, device: deviceWithRelations })
  } catch (error: any) {
    logger.error('❌ [IR DEVICES] Error fetching device:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'get_error', {
      deviceId: id,
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
  {  params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data: body } = bodyValidation
  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  const { id } = params
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('✏️  [IR DEVICES] Updating device')
  logger.info('   ID:', { data: id })
  logger.info('   Timestamp:', { data: new Date().toISOString() })
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
      description,
      status
    } = body

    logger.info('   Update fields:')
    logger.info('     Name:', name)
    logger.info('     Global Cache Device:', globalCacheDeviceId)
    logger.info('     Global Cache Port:', globalCachePortNumber)

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

    const device = await update('irDevices', eq(schema.irDevices.id, id), updateData)

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

    logger.info('✅ [IR DEVICES] Device updated successfully')
    logger.info('   Name:', device.name)
    logger.info('   Global Cache Device:', device.globalCacheDeviceId || 'Not assigned')
    logger.info('   Global Cache Port:', device.globalCachePortNumber || 'Not assigned')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'update', {
      deviceId: device.id,
      name: device.name
    })

    return NextResponse.json({ success: true, device: deviceWithRelations })
  } catch (error: any) {
    logger.error('❌ [IR DEVICES] Error updating device:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'update_error', {
      deviceId: id,
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
  {  params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  const { id } = params
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  logger.info('🗑️  [IR DEVICES] Deleting device')
  logger.info('   ID:', { data: id })
  logger.info('   Timestamp:', { data: new Date().toISOString() })
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    await deleteRecord('irDevices', eq(schema.irDevices.id, id))

    logger.info('✅ [IR DEVICES] Device deleted successfully')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'delete', {
      deviceId: id
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('❌ [IR DEVICES] Error deleting device:', error)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    logDatabaseOperation('IR_DEVICES', 'delete_error', {
      deviceId: id,
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
