import { NextRequest, NextResponse } from 'next/server'
import { globalCacheDevices, globalCachePorts } from '@/db/schema'
import { db, schema } from '@/db'
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm'
import { findFirst, findMany, update, deleteRecord } from '@/lib/db-helpers'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
/**
 * GET /api/globalcache/devices/[id]
 * Get a specific Global Cache device
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Path parameter validation
  const resolvedParams = await params
  const paramsValidation = validatePathParams(resolvedParams, z.object({ id: z.string().min(1) }))
  if (!paramsValidation.success) return paramsValidation.error


  try {
    const { id } = await params
    const device = await findFirst('globalCacheDevices', {
      where: eq(schema.globalCacheDevices.id, id)
    })

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    // Fetch ports for this device
    const ports = await findMany('globalCachePorts', {
      where: eq(schema.globalCachePorts.deviceId, id),
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
    logger.error('Error fetching device:', error)
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
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Path parameter validation
  const resolvedParams = await params
  const paramsValidation = validatePathParams(resolvedParams, z.object({ id: z.string().min(1) }))
  if (!paramsValidation.success) return paramsValidation.error


  try {
    const { id } = await params
    await deleteRecord('globalCacheDevices', eq(schema.globalCacheDevices.id, id))

    logger.info(`Global Cache device deleted: ${id}`)

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    logger.error('Error deleting device:', error)
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
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Path parameter validation
  const resolvedParams = await params
  const paramsValidation = validatePathParams(resolvedParams, z.object({ id: z.string().min(1) }))
  if (!paramsValidation.success) return paramsValidation.error


  try {
    const { id } = await params
    const body = await request.json()
    const { name, ipAddress, port, model } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (ipAddress !== undefined) updateData.ipAddress = ipAddress
    if (port !== undefined) updateData.port = port
    if (model !== undefined) updateData.model = model

    const device = await update('globalCacheDevices', eq(schema.globalCacheDevices.id, id), updateData)

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    // Fetch ports for this device
    const ports = await findMany('globalCachePorts', {
      where: eq(schema.globalCachePorts.deviceId, id),
      orderBy: asc(schema.globalCachePorts.portNumber)
    })

    const deviceWithPorts = {
      ...device,
      ports
    }

    logger.info(`Global Cache device updated: ${device.name}`)

    return NextResponse.json({
      success: true,
      device: deviceWithPorts
    })
  } catch (error) {
    logger.error('Error updating device:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update device' },
      { status: 500 }
    )
  }
}
