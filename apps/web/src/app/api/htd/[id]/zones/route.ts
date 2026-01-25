/**
 * HTD Device Zones Route
 *
 * GET /api/htd/[id]/zones - Get all zone states for an HTD device
 */

import { NextRequest, NextResponse } from 'next/server'
import { schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { findUnique, update } from '@/lib/db-helpers'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { getHTDService } from '@sports-bar/htd'
import type { HTDModel, HTDZoneState } from '@sports-bar/htd'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/htd/[id]/zones - Get all zone states
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params
  logger.api.request('GET', `/api/htd/${id}/zones`)

  try {
    // Find the device ensuring it's an HTD type
    const device = await findUnique(
      'audioProcessors',
      and(eq(schema.audioProcessors.id, id), eq(schema.audioProcessors.processorType, 'htd'))
    )

    if (!device) {
      logger.api.response('GET', `/api/htd/${id}/zones`, 404, { error: 'Not found' })
      return NextResponse.json({ error: 'HTD device not found' }, { status: 404 })
    }

    // Validate connection requirements
    if (device.connectionType === 'ethernet' && !device.ipAddress) {
      return NextResponse.json(
        { error: 'IP address is not configured' },
        { status: 400 }
      )
    }

    if (device.connectionType === 'rs232') {
      return NextResponse.json(
        { error: 'RS-232 connection not yet implemented' },
        { status: 501 }
      )
    }

    // Get or create service for this device
    let zones: HTDZoneState[] = []

    try {
      const service = getHTDService({
        id: device.id,
        name: device.name,
        model: device.model as HTDModel,
        connectionType: 'tcp',
        ipAddress: device.ipAddress,
        port: device.tcpPort || 10006,
        commandDelay: 100,
        autoReconnect: true,
        pollInterval: 0, // Don't auto-poll, we'll query on demand
      })

      // Connect if not already connected
      if (!service.isConnected()) {
        await service.connect()
      }

      // Get zone states
      zones = await service.refreshZoneStates()

      // Update device status
      await update('audioProcessors', eq(schema.audioProcessors.id, id), {
        status: 'online',
        lastSeen: new Date().toISOString(),
      })
    } catch (connectError: unknown) {
      const errorMessage = connectError instanceof Error ? connectError.message : 'Unknown error'
      logger.error(`[HTD] Failed to get zone states: ${errorMessage}`)

      // Update device status to error
      await update('audioProcessors', eq(schema.audioProcessors.id, id), {
        status: 'error',
      })

      return NextResponse.json(
        { error: 'Failed to connect to HTD device', details: errorMessage },
        { status: 503 }
      )
    }

    logger.api.response('GET', `/api/htd/${id}/zones`, 200, { count: zones.length })
    return NextResponse.json({
      deviceId: device.id,
      deviceName: device.name,
      model: device.model,
      zones,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.api.error('GET', `/api/htd/${id}/zones`, error)
    return NextResponse.json(
      { error: 'Failed to fetch zone states', details: errorMessage },
      { status: 500 }
    )
  }
}
