/**
 * HTD Device Test Connection Route
 *
 * POST /api/htd/[id]/test - Test connection to an HTD device
 */

import { NextRequest, NextResponse } from 'next/server'
import { schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { findUnique, update } from '@/lib/db-helpers'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { getHTDService, disconnectHTDService } from '@sports-bar/htd'
import type { HTDModel } from '@sports-bar/htd'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/htd/[id]/test - Test connection to an HTD device
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const { id } = await params
  logger.api.request('POST', `/api/htd/${id}/test`)

  try {
    // Find the device ensuring it's an HTD type
    const device = await findUnique(
      'audioProcessors',
      and(eq(schema.audioProcessors.id, id), eq(schema.audioProcessors.processorType, 'htd'))
    )

    if (!device) {
      logger.api.response('POST', `/api/htd/${id}/test`, 404, { error: 'Not found' })
      return NextResponse.json({ error: 'HTD device not found' }, { status: 404 })
    }

    // Validate connection requirements
    if (device.connectionType === 'ethernet' && !device.ipAddress) {
      return NextResponse.json(
        { success: false, error: 'IP address is not configured' },
        { status: 400 }
      )
    }

    if (device.connectionType === 'rs232') {
      return NextResponse.json(
        { success: false, error: 'RS-232 connection test not yet implemented' },
        { status: 501 }
      )
    }

    // Test TCP connection using the HTD service
    const startTime = Date.now()
    let service = null
    let connectionSuccess = false
    let zones = null
    let errorMessage = null

    try {
      service = getHTDService({
        id: device.id,
        name: device.name,
        model: device.model as HTDModel,
        connectionType: 'tcp',
        ipAddress: device.ipAddress,
        port: device.tcpPort || 10006,
        commandDelay: 100,
        autoReconnect: false, // Don't auto-reconnect during test
        pollInterval: 0, // Don't poll during test
      })

      await service.connect()
      connectionSuccess = true

      // Try to get zone states
      try {
        zones = await service.refreshZoneStates()
      } catch (zoneError: unknown) {
        logger.warn(`[HTD] Could not fetch zone states: ${zoneError instanceof Error ? zoneError.message : String(zoneError)}`)
      }

      // Update device status to online
      await update('audioProcessors', eq(schema.audioProcessors.id, id), {
        status: 'online',
        lastSeen: new Date().toISOString(),
      })
    } catch (connectError: unknown) {
      errorMessage = connectError instanceof Error ? connectError.message : 'Unknown error'
      logger.error(`[HTD] Connection test failed: ${errorMessage}`)

      // Update device status to error
      await update('audioProcessors', eq(schema.audioProcessors.id, id), {
        status: 'error',
      })
    } finally {
      // Clean up connection
      if (service) {
        try {
          await disconnectHTDService(device.id)
        } catch (disconnectError) {
          // Ignore disconnect errors during test
        }
      }
    }

    const responseTime = Date.now() - startTime

    if (connectionSuccess) {
      logger.api.response('POST', `/api/htd/${id}/test`, 200, { success: true })
      return NextResponse.json({
        success: true,
        message: 'Connection successful',
        responseTime,
        model: device.model,
        zonesDetected: zones ? zones.length : null,
        zoneStates: zones,
      })
    } else {
      logger.api.response('POST', `/api/htd/${id}/test`, 200, { success: false })
      return NextResponse.json({
        success: false,
        error: errorMessage,
        responseTime,
      })
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.api.error('POST', `/api/htd/${id}/test`, error)
    return NextResponse.json(
      { success: false, error: 'Failed to test HTD device', details: errorMessage },
      { status: 500 }
    )
  }
}
