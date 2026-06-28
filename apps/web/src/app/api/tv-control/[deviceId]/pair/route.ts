import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { SamsungTVClient, LGTVClient, TVBrand } from '@sports-bar/tv-network-control'

/**
 * TV Pairing API (Samsung + LG)
 *
 * Initiates pairing flow — connects without a token/key, waits for the TV
 * popup approval, and saves the returned credential to the database:
 * Samsung -> authToken, LG (webOS) -> clientKey.
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

    const brand = device.brand.toLowerCase()
    if (brand !== 'samsung' && brand !== 'lg') {
      return NextResponse.json(
        { success: false, error: 'Pairing is supported for Samsung and LG TVs only' },
        { status: 400 }
      )
    }

    // Mark pairing in progress (both brands)
    await db.update(schema.networkTVDevices)
      .set({ status: 'pairing', updatedAt: new Date().toISOString() })
      .where(eq(schema.networkTVDevices.id, deviceId))

    // LG WebOS — connecting without a clientKey triggers the on-screen
    // "Allow this device to connect?" prompt; pair() waits for the user to
    // accept and returns the captured clientKey.
    if (brand === 'lg') {
      const lg = new LGTVClient({
        ipAddress: device.ipAddress,
        port: device.port || 3001,
        brand: TVBrand.LG,
        macAddress: device.macAddress,
        clientKey: device.clientKey || undefined,
      })
      try {
        const clientKey = await lg.pair(timeout)

        await db.update(schema.networkTVDevices)
          .set({
            clientKey,
            status: 'online',
            lastSeen: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.networkTVDevices.id, deviceId))

        logger.info(`[TV-CONTROL] LG pairing successful for device ${deviceId}`)

        return NextResponse.json({
          success: true,
          message: 'Pairing successful — clientKey saved',
          deviceId,
        })
      } catch (pairError: any) {
        await db.update(schema.networkTVDevices)
          .set({ status: 'online', updatedAt: new Date().toISOString() })
          .where(eq(schema.networkTVDevices.id, deviceId))

        return NextResponse.json(
          { success: false, error: pairError.message || 'Pairing failed' },
          { status: 408 }
        )
      } finally {
        lg.disconnect()
      }
    }

    // Samsung — pairing captures an authToken.
    const client = new SamsungTVClient({
      ipAddress: device.ipAddress,
      port: device.port,
      brand: TVBrand.SAMSUNG,
      macAddress: device.macAddress,
    })

    try {
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
