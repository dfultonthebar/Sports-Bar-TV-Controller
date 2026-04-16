import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { operationLogger } from '@sports-bar/data'
import { SamsungTVClient, RokuTVClient, SharpTVClient, VavaTVClient, TVBrand } from '@sports-bar/tv-network-control'
import { persistSamsungTokenIfChanged } from '@/lib/samsung-token-persist'

/**
 * TV HDMI Input Control API
 *
 * Switches HDMI input on network-connected TVs
 * Body: { input: 'hdmi1' | 'hdmi2' | 'hdmi3' | 'hdmi4' }
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const { deviceId } = await params

  const bodyValidation = await validateRequestBody(request, ValidationSchemas.tvInputControl)
  if (!bodyValidation.success) return bodyValidation.error

  const { input } = bodyValidation.data
  const inputNumber = parseInt(input.replace('hdmi', ''))

  try {
    logger.info(`[TV-CONTROL] Input switch to ${input} for device ${deviceId}`)

    const devices = await db.select()
      .from(schema.networkTVDevices)
      .where(eq(schema.networkTVDevices.id, deviceId))
      .limit(1)

    if (devices.length === 0) {
      return NextResponse.json(
        { success: false, error: 'TV device not found' },
        { status: 404 }
      )
    }

    const device = devices[0]

    if (!device.supportsInput) {
      return NextResponse.json(
        { success: false, error: 'Device does not support input switching' },
        { status: 400 }
      )
    }

    let result: { success: boolean; message?: string; error?: string }

    switch (device.brand.toLowerCase()) {
      case 'roku': {
        const client = new RokuTVClient({
          ipAddress: device.ipAddress,
          port: device.port,
          brand: TVBrand.ROKU,
        })
        try {
          result = await client.switchInput(inputNumber)
        } finally {
          client.disconnect()
        }
        break
      }

      case 'samsung': {
        const client = new SamsungTVClient({
          ipAddress: device.ipAddress,
          port: device.port,
          brand: TVBrand.SAMSUNG,
          macAddress: device.macAddress,
          authToken: device.authToken,
        })
        try {
          result = await client.switchInput(inputNumber)
        } finally {
          await persistSamsungTokenIfChanged(device, client)
          client.disconnect()
        }
        break
      }

      case 'sharp': {
        const client = new SharpTVClient({
          ipAddress: device.ipAddress,
          port: device.port || 10002,
          brand: TVBrand.SHARP,
        })
        result = await client.switchInput(inputNumber)
        break
      }

      case 'vava': {
        const client = new VavaTVClient({
          ipAddress: device.ipAddress,
          port: device.port || 8000,
          brand: TVBrand.VAVA,
          macAddress: device.macAddress,
        })
        result = await client.switchInput(inputNumber)
        break
      }

      case 'epson': {
        const { exec } = require('child_process')
        const { promisify } = require('util')
        const execAsync = promisify(exec)
        const adbTarget = `${device.ipAddress}:${device.port || 5555}`
        const hdmiInputIds: Record<number, string> = {
          1: 'com.droidlogic.tvinput%2F.services.Hdmi1InputService%2FHW5',
          2: 'com.droidlogic.tvinput%2F.services.Hdmi2InputService%2FHW6',
          3: 'com.droidlogic.tvinput%2F.services.Hdmi3InputService%2FHW7',
        }
        const inputId = hdmiInputIds[inputNumber]
        if (!inputId) {
          result = { success: false, error: `HDMI ${inputNumber} not available (1-3 supported)` }
        } else {
          try {
            await execAsync(`adb connect ${adbTarget}`, { timeout: 5000 })
            await execAsync(
              `adb -s ${adbTarget} shell am start -a android.intent.action.VIEW -d "content://android.media.tv/passthrough/${inputId}"`,
              { timeout: 5000 }
            )
            result = { success: true, message: `Switched to HDMI ${inputNumber}` }
          } catch (err: any) {
            result = { success: false, error: err.message }
          }
        }
        break
      }

      default:
        return NextResponse.json(
          { success: false, error: `${device.brand} input switching not yet implemented` },
          { status: 501 }
        )
    }

    if (result.success) {
      await db.update(schema.networkTVDevices)
        .set({
          currentInput: input,
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.networkTVDevices.id, deviceId))

      await operationLogger.logOperation({
        type: 'input_switch',
        device: `${device.brand} TV (${deviceId})`,
        action: `Switch to ${input}`,
        details: { deviceId, brand: device.brand, input },
        user: 'bartender',
        success: true,
      })
    }

    return NextResponse.json({
      success: result.success,
      message: result.message || `Input switch ${result.success ? 'successful' : 'failed'}`,
      deviceId,
      deviceBrand: device.brand,
      input,
    })
  } catch (error: any) {
    logger.error('[TV-CONTROL] Input control error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Input control failed' },
      { status: 500 }
    )
  }
}
