import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { SamsungTVClient, TVBrand } from '@sports-bar/tv-network-control'

/**
 * TV Pairing API (Samsung only)
 *
 * Initiates pairing flow — connects without token, waits for TV popup approval,
 * saves returned auth token to database.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const { deviceId } = await params

  const bodyValidation = await validateRequestBody(request, ValidationSchemas.tvPair)
  if (!bodyValidation.success) return bodyValidation.error

  const { timeout } = bodyValidation.data

  try {
    logger.info(`[TV-CONTROL] Pairing request for device ${deviceId}`)

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

    if (device.brand.toLowerCase() !== 'samsung') {
      return NextResponse.json(
        { success: false, error: 'Pairing is only supported for Samsung TVs' },
        { status: 400 }
      )
    }

    const client = new SamsungTVClient({
      ipAddress: device.ipAddress,
      port: device.port,
      brand: TVBrand.SAMSUNG,
      macAddress: device.macAddress,
    })

    try {
      // Update status to pairing
      await db.update(schema.networkTVDevices)
        .set({ status: 'pairing', updatedAt: new Date().toISOString() })
        .where(eq(schema.networkTVDevices.id, deviceId))

      const token = await client.pair(timeout)

      // Save token to database
      await db.update(schema.networkTVDevices)
        .set({
          authToken: token,
          status: 'online',
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.networkTVDevices.id, deviceId))

      logger.info(`[TV-CONTROL] Pairing successful for device ${deviceId}`)

      return NextResponse.json({
        success: true,
        message: 'Pairing successful — token saved',
        deviceId,
      })
    } catch (pairError: any) {
      // Reset status on failure
      await db.update(schema.networkTVDevices)
        .set({ status: 'online', updatedAt: new Date().toISOString() })
        .where(eq(schema.networkTVDevices.id, deviceId))

      return NextResponse.json(
        { success: false, error: pairError.message || 'Pairing failed' },
        { status: 408 }
      )
    } finally {
      client.disconnect()
    }
  } catch (error: any) {
    logger.error('[TV-CONTROL] Pairing error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Pairing failed' },
      { status: 500 }
    )
  }
}
