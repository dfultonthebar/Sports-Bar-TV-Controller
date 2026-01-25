/**
 * HTD Device API Routes
 *
 * GET /api/htd/[id] - Get a single HTD device
 * PUT /api/htd/[id] - Update an HTD device
 * DELETE /api/htd/[id] - Delete an HTD device
 */

import { NextRequest, NextResponse } from 'next/server'
import { schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { findUnique, update, deleteRecord } from '@/lib/db-helpers'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

// HTD model configurations
const HTD_MODELS: Record<string, { zones: number; sources: number; supportsWebSocket: boolean }> = {
  'MC-66': { zones: 6, sources: 6, supportsWebSocket: false },
  'MCA-66': { zones: 6, sources: 6, supportsWebSocket: false },
  'Lync6': { zones: 6, sources: 6, supportsWebSocket: true },
  'Lync12': { zones: 12, sources: 6, supportsWebSocket: true },
}

// Validation schema for updating an HTD device
const updateHTDDeviceSchema = z.object({
  name: z.string().min(1).optional(),
  model: z.enum(['MC-66', 'MCA-66', 'Lync6', 'Lync12']).optional(),
  connectionType: z.enum(['ethernet', 'rs232']).optional(),
  ipAddress: z.string().optional(),
  tcpPort: z.number().int().min(1).max(65535).optional(),
  serialPort: z.string().optional(),
  baudRate: z.number().int().optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['online', 'offline', 'error']).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/htd/[id] - Get a single HTD device
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params
  logger.api.request('GET', `/api/htd/${id}`)

  try {
    // Find the device ensuring it's an HTD type
    const device = await findUnique(
      'audioProcessors',
      and(eq(schema.audioProcessors.id, id), eq(schema.audioProcessors.processorType, 'htd'))
    )

    if (!device) {
      logger.api.response('GET', `/api/htd/${id}`, 404, { error: 'Not found' })
      return NextResponse.json({ error: 'HTD device not found' }, { status: 404 })
    }

    // Enrich with model-specific info
    const modelConfig = HTD_MODELS[device.model] || { zones: 6, sources: 6, supportsWebSocket: false }
    const deviceWithInfo = {
      id: device.id,
      name: device.name,
      model: device.model,
      processorType: device.processorType,
      connectionType: device.connectionType,
      ipAddress: device.ipAddress,
      port: device.port,
      tcpPort: device.tcpPort,
      serialPort: device.serialPort,
      baudRate: device.baudRate,
      zones: modelConfig.zones,
      sources: modelConfig.sources,
      supportsWebSocket: modelConfig.supportsWebSocket,
      description: device.description,
      status: device.status,
      lastSeen: device.lastSeen,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    }

    logger.api.response('GET', `/api/htd/${id}`, 200)
    return NextResponse.json({ device: deviceWithInfo })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.api.error('GET', `/api/htd/${id}`, error)
    return NextResponse.json(
      { error: 'Failed to fetch HTD device', details: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/htd/[id] - Update an HTD device
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params
  logger.api.request('PUT', `/api/htd/${id}`)

  // Validate request body
  const bodyValidation = await validateRequestBody(request, updateHTDDeviceSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { data } = bodyValidation

  try {
    // Verify device exists and is HTD type
    const existing = await findUnique(
      'audioProcessors',
      and(eq(schema.audioProcessors.id, id), eq(schema.audioProcessors.processorType, 'htd'))
    )

    if (!existing) {
      logger.api.response('PUT', `/api/htd/${id}`, 404, { error: 'Not found' })
      return NextResponse.json({ error: 'HTD device not found' }, { status: 404 })
    }

    // Validate connection type requirements
    const connectionType = data.connectionType || existing.connectionType
    const ipAddress = data.ipAddress !== undefined ? data.ipAddress : existing.ipAddress
    const serialPort = data.serialPort !== undefined ? data.serialPort : existing.serialPort

    if (connectionType === 'ethernet' && !ipAddress) {
      return NextResponse.json(
        { error: 'IP address is required for Ethernet connection' },
        { status: 400 }
      )
    }

    if (connectionType === 'rs232' && !serialPort) {
      return NextResponse.json(
        { error: 'Serial port is required for RS-232 connection' },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.model !== undefined) {
      updateData.model = data.model
      // Update zones based on new model
      const modelConfig = HTD_MODELS[data.model]
      if (modelConfig) updateData.zones = modelConfig.zones
    }
    if (data.connectionType !== undefined) updateData.connectionType = data.connectionType
    if (data.ipAddress !== undefined) updateData.ipAddress = data.ipAddress
    if (data.tcpPort !== undefined) updateData.tcpPort = data.tcpPort
    if (data.serialPort !== undefined) updateData.serialPort = data.serialPort
    if (data.baudRate !== undefined) updateData.baudRate = data.baudRate
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) updateData.status = data.status

    // Update the device
    const device = await update('audioProcessors', eq(schema.audioProcessors.id, id), updateData)

    // Enrich with model-specific info
    const modelConfig = HTD_MODELS[device.model] || { zones: 6, sources: 6, supportsWebSocket: false }
    const deviceWithInfo = {
      id: device.id,
      name: device.name,
      model: device.model,
      processorType: device.processorType,
      connectionType: device.connectionType,
      ipAddress: device.ipAddress,
      port: device.port,
      tcpPort: device.tcpPort,
      serialPort: device.serialPort,
      baudRate: device.baudRate,
      zones: modelConfig.zones,
      sources: modelConfig.sources,
      supportsWebSocket: modelConfig.supportsWebSocket,
      description: device.description,
      status: device.status,
      lastSeen: device.lastSeen,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    }

    logger.api.response('PUT', `/api/htd/${id}`, 200)
    return NextResponse.json({ device: deviceWithInfo })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.api.error('PUT', `/api/htd/${id}`, error)
    return NextResponse.json(
      { error: 'Failed to update HTD device', details: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/htd/[id] - Delete an HTD device
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params
  logger.api.request('DELETE', `/api/htd/${id}`)

  try {
    // Verify device exists and is HTD type
    const existing = await findUnique(
      'audioProcessors',
      and(eq(schema.audioProcessors.id, id), eq(schema.audioProcessors.processorType, 'htd'))
    )

    if (!existing) {
      logger.api.response('DELETE', `/api/htd/${id}`, 404, { error: 'Not found' })
      return NextResponse.json({ error: 'HTD device not found' }, { status: 404 })
    }

    // Delete the device
    await deleteRecord('audioProcessors', eq(schema.audioProcessors.id, id))

    logger.api.response('DELETE', `/api/htd/${id}`, 200)
    return NextResponse.json({ message: 'HTD device deleted successfully' })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.api.error('DELETE', `/api/htd/${id}`, error)
    return NextResponse.json(
      { error: 'Failed to delete HTD device', details: errorMessage },
      { status: 500 }
    )
  }
}
