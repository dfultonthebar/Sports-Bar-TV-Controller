import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { operationLogger } from '@sports-bar/data'
import { SamsungTVClient, RokuTVClient, TVBrand } from '@sports-bar/tv-network-control'

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
          client.disconnect()
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
