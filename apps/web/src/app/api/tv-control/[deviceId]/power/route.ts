import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * TV Power Control API
 *
 * Controls power state of network-connected TVs
 * Supports: on, off, toggle
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
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.tvPowerControl)
  if (!bodyValidation.success) return bodyValidation.error

  const { action } = bodyValidation.data
  const { deviceId } = params

  try {
    logger.info(`[TV-CONTROL] Power ${action} for device ${deviceId}`)

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

    // Check if device supports power control
    if (!device.supportsPower) {
      logger.warn(`[TV-CONTROL] Device ${deviceId} does not support power control`)
      return NextResponse.json(
        { success: false, error: 'Device does not support power control' },
        { status: 400 }
      )
    }

    // Instantiate appropriate client based on brand
    let result: { success: boolean; message?: string; error?: string }

    switch (device.brand.toLowerCase()) {
      case 'roku':
        result = await controlRokuPower(device, action)
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

      logger.info(`[TV-CONTROL] Power ${action} successful for ${device.brand} TV ${deviceId}`)
    }

    return NextResponse.json({
      success: result.success,
      message: result.message || `Power ${action} ${result.success ? 'successful' : 'failed'}`,
      deviceId,
      deviceBrand: device.brand,
      action
    })

  } catch (error: any) {
    logger.error('[TV-CONTROL] Power control error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Power control failed' },
      { status: 500 }
    )
  }
}

/**
 * Control Roku TV power using ECP protocol
 */
async function controlRokuPower(
  device: any,
  action: 'on' | 'off' | 'toggle'
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const baseUrl = `http://${device.ipAddress}:${device.port}`
    let endpoint: string

    // Roku ECP power control
    // keypress/PowerOn - Wake from standby
    // keypress/PowerOff - Enter standby
    switch (action) {
      case 'on':
        endpoint = '/keypress/PowerOn'
        break
      case 'off':
        endpoint = '/keypress/PowerOff'
        break
      case 'toggle':
        endpoint = '/keypress/Power'
        break
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (response.ok) {
      return { success: true, message: `Power ${action} command sent` }
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
