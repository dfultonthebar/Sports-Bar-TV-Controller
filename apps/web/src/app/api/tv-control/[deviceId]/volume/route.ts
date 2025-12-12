import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * TV Volume Control API
 *
 * Controls volume of network-connected TVs
 * Supports: up, down, mute, set (with value)
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Validate request body
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.tvVolumeControl)
  if (!bodyValidation.success) return bodyValidation.error

  const { action, value } = bodyValidation.data
  const { deviceId } = params

  try {
    logger.info(`[TV-CONTROL] Volume ${action} for device ${deviceId}`, { value })

    // Load device from database
    const devices = await db.select()
      .from(schema.networkTVDevices)
      .where(eq(schema.networkTVDevices.id, deviceId))
      .limit(1)

    if (devices.length === 0) {
      logger.error(`[TV-CONTROL] Device not found: ${deviceId}`)
      return NextResponse.json(
        { success: false, error: 'TV device not found' },
        { status: 404 }
      )
    }

    const device = devices[0]

    // Check if device supports volume control
    if (!device.supportsVolume) {
      logger.warn(`[TV-CONTROL] Device ${deviceId} does not support volume control`)
      return NextResponse.json(
        { success: false, error: 'Device does not support volume control' },
        { status: 400 }
      )
    }

    // Instantiate appropriate client based on brand
    let result: { success: boolean; message?: string; error?: string }

    switch (device.brand.toLowerCase()) {
      case 'roku':
        result = await controlRokuVolume(device, action, value)
        break

      case 'samsung':
      case 'lg':
      case 'sony':
      case 'vizio':
        return NextResponse.json(
          { success: false, error: `${device.brand} TV control not yet implemented` },
          { status: 501 }
        )

      default:
        return NextResponse.json(
          { success: false, error: `Unsupported TV brand: ${device.brand}` },
          { status: 400 }
        )
    }

    if (result.success) {
      // Update last seen timestamp
      await db.update(schema.networkTVDevices)
        .set({
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.networkTVDevices.id, deviceId))

      logger.info(`[TV-CONTROL] Volume ${action} successful for ${device.brand} TV ${deviceId}`)
    }

    return NextResponse.json({
      success: result.success,
      message: result.message || `Volume ${action} ${result.success ? 'successful' : 'failed'}`,
      deviceId,
      deviceBrand: device.brand,
      action,
      value
    })

  } catch (error: any) {
    logger.error('[TV-CONTROL] Volume control error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Volume control failed' },
      { status: 500 }
    )
  }
}

/**
 * Control Roku TV volume using ECP protocol
 */
async function controlRokuVolume(
  device: any,
  action: 'up' | 'down' | 'mute' | 'set',
  value?: number
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const baseUrl = `http://${device.ipAddress}:${device.port}`
    let endpoint: string

    // Roku ECP volume control
    switch (action) {
      case 'up':
        endpoint = '/keypress/VolumeUp'
        break
      case 'down':
        endpoint = '/keypress/VolumeDown'
        break
      case 'mute':
        endpoint = '/keypress/VolumeMute'
        break
      case 'set':
        // Note: Roku TVs don't support direct volume level setting via ECP
        // We would need to simulate multiple up/down presses
        return {
          success: false,
          error: 'Roku TVs do not support direct volume level setting. Use up/down instead.'
        }
      default:
        return { success: false, error: 'Invalid action' }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (response.ok) {
      return { success: true, message: `Volume ${action} command sent` }
    } else {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
    }

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Request timeout - TV may be offline' }
    }
    return { success: false, error: error.message }
  }
}
