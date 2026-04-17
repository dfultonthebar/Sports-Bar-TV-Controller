/**
 * HTD Audio System API Routes
 *
 * GET /api/htd - List all HTD devices
 * POST /api/htd - Create a new HTD device
 */

import { NextRequest, NextResponse } from 'next/server'
import { schema } from '@/db'
import { asc, eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { findMany, create } from '@/lib/db-helpers'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

// HTD model configurations for API responses
const HTD_MODELS: Record<string, { zones: number; sources: number; supportsWebSocket: boolean }> = {
  'MC-66': { zones: 6, sources: 6, supportsWebSocket: false },
  'MCA-66': { zones: 6, sources: 6, supportsWebSocket: false },
  'Lync6': { zones: 6, sources: 6, supportsWebSocket: true },
  'Lync12': { zones: 12, sources: 6, supportsWebSocket: true },
}

// Validation schema for creating an HTD device
const createHTDDeviceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  model: z.enum(['MC-66', 'MCA-66', 'Lync6', 'Lync12']),
  connectionType: z.enum(['ethernet', 'rs232']).default('ethernet'),
  ipAddress: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  tcpPort: z.number().int().min(1).max(65535).optional().default(10006),
  serialPort: z.string().optional(),
  baudRate: z.number().int().optional().default(57600),
  description: z.string().optional(),
})

/**
 * GET /api/htd - List all HTD devices
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  logger.api.request('GET', '/api/htd')

  try {
    // Fetch all HTD devices (processorType = 'htd')
    const devices = await findMany('audioProcessors', {
      where: eq(schema.audioProcessors.processorType, 'htd'),
      orderBy: asc(schema.audioProcessors.name),
    })

    // Enrich with model-specific info
    const devicesWithInfo = devices.map((device) => {
      const modelConfig = HTD_MODELS[device.model] || { zones: 6, sources: 6, supportsWebSocket: false }
      return {
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
    })

    logger.api.response('GET', '/api/htd', 200, { count: devicesWithInfo.length })
    return NextResponse.json({ devices: devicesWithInfo })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.api.error('GET', '/api/htd', error)
    return NextResponse.json(
      { error: 'Failed to fetch HTD devices', details: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * POST /api/htd - Create a new HTD device
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  logger.api.request('POST', '/api/htd')

  // Validate request body
  const bodyValidation = await validateRequestBody(request, createHTDDeviceSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { data } = bodyValidation

  try {
    // Validate connection type requirements
    if (data.connectionType === 'ethernet' && !data.ipAddress) {
      return NextResponse.json(
        { error: 'IP address is required for Ethernet connection' },
        { status: 400 }
      )
    }

    if (data.connectionType === 'rs232' && !data.serialPort) {
      return NextResponse.json(
        { error: 'Serial port is required for RS-232 connection' },
        { status: 400 }
      )
    }

    // Get model configuration
    const modelConfig = HTD_MODELS[data.model]

    // Create the device in audioProcessors table
    const device = await create('audioProcessors', {
      name: data.name,
      model: data.model,
      processorType: 'htd',
      connectionType: data.connectionType,
      ipAddress: data.ipAddress || '',
      port: 80, // HTTP port (not used for HTD but required by schema)
      tcpPort: data.tcpPort || 10006,
      serialPort: data.serialPort || null,
      baudRate: data.baudRate || 57600,
      zones: modelConfig.zones,
      description: data.description || null,
      status: 'offline',
    })

    // Return enriched device
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
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    }

    logger.api.response('POST', '/api/htd', 201, { deviceId: device.id })
    return NextResponse.json({ device: deviceWithInfo }, { status: 201 })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.api.error('POST', '/api/htd', error)
    return NextResponse.json(
      { error: 'Failed to create HTD device', details: errorMessage },
      { status: 500 }
    )
  }
}
