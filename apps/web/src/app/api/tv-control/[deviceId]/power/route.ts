import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { operationLogger } from '@sports-bar/data'
import { SamsungTVClient, SharpTVClient, VavaTVClient, TVBrand } from '@sports-bar/tv-network-control'

/**
 * TV Power Control API
 *
 * Controls power state of network-connected TVs
 * Supports: on, off, toggle
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Await params (required in Next.js 16+)
  const { deviceId } = await params

  // Validate request body
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.tvPowerControl)
  if (!bodyValidation.success) return bodyValidation.error

  const { action } = bodyValidation.data

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
        result = await controlSamsungPower(device, action)
        break

      case 'sharp':
        result = await controlSharpPower(device, action)
        break

      case 'vava':
        result = await controlVavaPower(device, action)
        break

      case 'epson':
        result = await controlEpsonPower(device, action)
        break

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
      // Determine new power status based on action taken
      let newStatus: string | undefined
      if (action === 'on') {
        newStatus = 'online'
      } else if (action === 'off') {
        newStatus = 'standby'
      } else if (action === 'toggle') {
        // Toggle flips the current status
        newStatus = device.status === 'online' ? 'standby' : 'online'
      }

      // Update status and last seen timestamp
      await db.update(schema.networkTVDevices)
        .set({
          ...(newStatus ? { status: newStatus } : {}),
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.networkTVDevices.id, deviceId))

      logger.info(`[TV-CONTROL] Power ${action} successful for ${device.brand} TV ${deviceId} (${device.ipAddress})`)
    } else {
      logger.error(`[TV-CONTROL] Power ${action} failed for ${device.brand} TV ${deviceId} (${device.ipAddress}): ${result.error}`)
    }

    // Log operation for AI learning (both success and failure)
    await operationLogger.logOperation({
      type: 'power_control',
      device: `${device.brand} TV (${deviceId})`,
      action: `Power ${action}`,
      details: {
        deviceId,
        brand: device.brand,
        ipAddress: device.ipAddress,
        action,
        error: result.error || undefined,
      },
      user: 'bartender',
      success: result.success,
    })

    return NextResponse.json({
      success: result.success,
      message: result.message || `Power ${action} ${result.success ? 'successful' : 'failed'}`,
      error: result.error,
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

/**
 * Control Samsung TV power using WebSocket + WOL
 */
async function controlSamsungPower(
  device: any,
  action: 'on' | 'off' | 'toggle'
): Promise<{ success: boolean; message?: string; error?: string }> {
  const client = new SamsungTVClient({
    ipAddress: device.ipAddress,
    port: device.port,
    brand: TVBrand.SAMSUNG,
    macAddress: device.macAddress,
    authToken: device.authToken,
  })

  try {
    let result: { success: boolean; message?: string; error?: string }

    if (action === 'on') {
      // Use powerOn() which sends WoL + checks PowerState before sending KEY_POWER
      result = await client.powerOn()
    } else {
      // off or toggle — send KEY_POWER via WebSocket (works in both on and standby)
      result = await client.sendKey('KEY_POWER')
    }

    // Wait for the TV to process the command before disconnecting
    await new Promise(resolve => setTimeout(resolve, 500))

    return result
  } catch (error: any) {
    // Last resort: try WOL if WebSocket completely failed
    if (action !== 'off' && device.macAddress) {
      logger.info(`[TV-CONTROL] Falling back to WOL for ${device.ipAddress}`)
      try {
        return await client.powerOn()
      } catch {
        // WOL also failed
      }
    }
    return { success: false, error: error.message }
  } finally {
    client.disconnect()
  }
}

/**
 * Control Sharp Aquos TV power via TCP (port 10002)
 */
async function controlSharpPower(
  device: any,
  action: 'on' | 'off' | 'toggle'
): Promise<{ success: boolean; message?: string; error?: string }> {
  const client = new SharpTVClient({
    ipAddress: device.ipAddress,
    port: device.port || 10002,
    brand: TVBrand.SHARP,
    macAddress: device.macAddress,
  })

  try {
    switch (action) {
      case 'on':
        return await client.powerOn()
      case 'off':
        return await client.powerOff()
      case 'toggle': {
        const isOn = await client.getPowerState()
        return isOn ? await client.powerOff() : await client.powerOn()
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Control VAVA projector power via EShare HTTP API + WOL
 */
async function controlVavaPower(
  device: any,
  action: 'on' | 'off' | 'toggle'
): Promise<{ success: boolean; message?: string; error?: string }> {
  const client = new VavaTVClient({
    ipAddress: device.ipAddress,
    port: device.port || 8000,
    brand: TVBrand.VAVA,
    macAddress: device.macAddress,
  })

  try {
    // For toggle, use DB status instead of live query — avoids double-sleep causing full shutdown
    if (action === 'toggle') {
      const isOn = device.status === 'online'
      return isOn ? await client.powerOff() : await client.powerOn()
    }
    return action === 'on' ? await client.powerOn() : await client.powerOff()
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Control Epson projector power via ADB (SLEEP/WAKEUP)
 * On power-on, automatically switches to HDMI 1 input
 */
async function controlEpsonPower(
  device: any,
  action: 'on' | 'off' | 'toggle'
): Promise<{ success: boolean; message?: string; error?: string }> {
  const { exec } = require('child_process')
  const { promisify } = require('util')
  const execAsync = promisify(exec)
  const adbTarget = `${device.ipAddress}:${device.port || 5555}`

  try {
    // Ensure ADB connection
    await execAsync(`adb connect ${adbTarget}`, { timeout: 5000 })

    let shouldPowerOn: boolean
    if (action === 'toggle') {
      shouldPowerOn = device.status !== 'online'
    } else {
      shouldPowerOn = action === 'on'
    }

    if (shouldPowerOn) {
      // Wake up
      await execAsync(`adb -s ${adbTarget} shell input keyevent KEYCODE_WAKEUP`, { timeout: 5000 })
      // Wait for projector to initialize, then switch to HDMI 1
      await new Promise(resolve => setTimeout(resolve, 2000))
      await execAsync(
        `adb -s ${adbTarget} shell am start -a android.intent.action.VIEW -d "content://android.media.tv/passthrough/com.droidlogic.tvinput%2F.services.Hdmi3InputService%2FHW7"`,
        { timeout: 5000 }
      )
      return { success: true, message: 'Epson powered on + HDMI 3 selected' }
    } else {
      // Sleep
      await execAsync(`adb -s ${adbTarget} shell input keyevent KEYCODE_SLEEP`, { timeout: 5000 })
      return { success: true, message: 'Epson powered off (standby)' }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
