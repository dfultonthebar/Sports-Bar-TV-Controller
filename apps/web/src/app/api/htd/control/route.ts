/**
 * HTD Control API Route
 *
 * POST /api/htd/control - Send control commands to an HTD device
 */

import { NextRequest, NextResponse } from 'next/server'
import { schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { findUnique, update } from '@/lib/db-helpers'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { getHTDService } from '@sports-bar/htd'
import type { HTDModel } from '@sports-bar/htd'

// Validation schema for control commands
const htdControlSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
  command: z.enum([
    'power',
    'powerAll',
    'volumeUp',
    'volumeDown',
    'setVolume',
    'mute',
    'setSource',
    'bassUp',
    'bassDown',
    'trebleUp',
    'trebleDown',
    'balanceLeft',
    'balanceRight',
  ]),
  zone: z.number().int().min(1).max(12).optional(),
  value: z.number().optional(),
})

/**
 * POST /api/htd/control - Send control command
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  logger.api.request('POST', '/api/htd/control')

  // Validate request body
  const bodyValidation = await validateRequestBody(request, htdControlSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { data } = bodyValidation
  const { deviceId, command, zone, value } = data

  try {
    // Find the device ensuring it's an HTD type
    const device = await findUnique(
      'audioProcessors',
      and(eq(schema.audioProcessors.id, deviceId), eq(schema.audioProcessors.processorType, 'htd'))
    )

    if (!device) {
      logger.api.response('POST', '/api/htd/control', 404, { error: 'Not found' })
      return NextResponse.json({ error: 'HTD device not found' }, { status: 404 })
    }

    // Validate zone requirement for most commands
    const commandsRequiringZone = [
      'power',
      'volumeUp',
      'volumeDown',
      'setVolume',
      'mute',
      'setSource',
      'bassUp',
      'bassDown',
      'trebleUp',
      'trebleDown',
      'balanceLeft',
      'balanceRight',
    ]

    if (commandsRequiringZone.includes(command) && !zone) {
      return NextResponse.json(
        { error: `Zone is required for ${command} command` },
        { status: 400 }
      )
    }

    // Validate value requirement for setVolume and setSource
    if ((command === 'setVolume' || command === 'setSource') && value === undefined) {
      return NextResponse.json(
        { error: `Value is required for ${command} command` },
        { status: 400 }
      )
    }

    // Validate value ranges
    if (command === 'setVolume' && (value! < 0 || value! > 100)) {
      return NextResponse.json(
        { error: 'Volume must be between 0 and 100' },
        { status: 400 }
      )
    }

    if (command === 'setSource' && (value! < 1 || value! > 6)) {
      return NextResponse.json(
        { error: 'Source must be between 1 and 6' },
        { status: 400 }
      )
    }

    // Check connection requirements
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
    const service = getHTDService({
      id: device.id,
      name: device.name,
      model: device.model as HTDModel,
      connectionType: 'tcp',
      ipAddress: device.ipAddress,
      port: device.tcpPort || 10006,
      commandDelay: 100,
      autoReconnect: true,
      pollInterval: 0,
    })

    // Connect if not already connected
    if (!service.isConnected()) {
      await service.connect()
    }

    // Execute the command
    let result: { success: boolean; message: string; zoneState?: unknown } = {
      success: true,
      message: `${command} command executed successfully`,
    }

    switch (command) {
      case 'power':
        // Toggle power - we need to know current state
        const zoneState = service.getZoneState(zone!)
        const newPowerState = zoneState ? !zoneState.power : true
        await service.setZonePower(zone!, newPowerState)
        result.message = `Zone ${zone} power ${newPowerState ? 'on' : 'off'}`
        break

      case 'powerAll':
        // For powerAll, use value as boolean (1=on, 0=off)
        const allOn = value === 1 || value === undefined
        await service.setAllZonesPower(allOn)
        result.message = `All zones power ${allOn ? 'on' : 'off'}`
        break

      case 'volumeUp':
        await service.volumeUp(zone!)
        result.message = `Zone ${zone} volume increased`
        break

      case 'volumeDown':
        await service.volumeDown(zone!)
        result.message = `Zone ${zone} volume decreased`
        break

      case 'setVolume':
        await service.setVolume(zone!, value!)
        result.message = `Zone ${zone} volume set to ${value}%`
        break

      case 'mute':
        await service.toggleMute(zone!)
        result.message = `Zone ${zone} mute toggled`
        break

      case 'setSource':
        await service.setSource(zone!, value!)
        result.message = `Zone ${zone} source set to ${value}`
        break

      case 'bassUp':
        await service.bassUp(zone!)
        result.message = `Zone ${zone} bass increased`
        break

      case 'bassDown':
        await service.bassDown(zone!)
        result.message = `Zone ${zone} bass decreased`
        break

      case 'trebleUp':
        await service.trebleUp(zone!)
        result.message = `Zone ${zone} treble increased`
        break

      case 'trebleDown':
        await service.trebleDown(zone!)
        result.message = `Zone ${zone} treble decreased`
        break

      case 'balanceLeft':
        await service.balanceLeft(zone!)
        result.message = `Zone ${zone} balance shifted left`
        break

      case 'balanceRight':
        await service.balanceRight(zone!)
        result.message = `Zone ${zone} balance shifted right`
        break

      default:
        return NextResponse.json(
          { error: `Unknown command: ${command}` },
          { status: 400 }
        )
    }

    // Get updated zone state if applicable
    if (zone) {
      try {
        await service.refreshZoneStates()
        result.zoneState = service.getZoneState(zone)
      } catch (refreshError) {
        // Non-fatal, just log it
        logger.warn('[HTD] Could not refresh zone state after command')
      }
    }

    // Update device last seen
    await update('audioProcessors', eq(schema.audioProcessors.id, deviceId), {
      status: 'online',
      lastSeen: new Date().toISOString(),
    })

    logger.api.response('POST', '/api/htd/control', 200, { success: true, command })
    return NextResponse.json(result)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.api.error('POST', '/api/htd/control', error)

    // Update device status on error
    try {
      await update('audioProcessors', eq(schema.audioProcessors.id, deviceId), {
        status: 'error',
      })
    } catch (updateError) {
      // Ignore update errors
    }

    return NextResponse.json(
      { success: false, error: 'Failed to execute command', details: errorMessage },
      { status: 500 }
    )
  }
}
