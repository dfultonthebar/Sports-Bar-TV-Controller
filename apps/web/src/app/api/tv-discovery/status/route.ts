import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * TV Status Check API
 *
 * Pings all discovered TVs to check online/offline status.
 * Uses fast HTTP probes with short timeouts for quick results.
 * Updates status and lastSeen in the database.
 */

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const devices = await db.select().from(schema.networkTVDevices)

    if (devices.length === 0) {
      return NextResponse.json({ success: true, count: 0, devices: [] })
    }

    logger.info(`[TV-STATUS] Checking status of ${devices.length} TV(s)`)

    const results = await Promise.allSettled(
      devices.map(async (device) => {
        const online = await pingDevice(device.ipAddress, device.brand, device.port)
        const now = new Date().toISOString()

        await db.update(schema.networkTVDevices)
          .set({
            status: online ? 'online' : 'offline',
            ...(online ? { lastSeen: now } : {}),
            updatedAt: now,
          })
          .where(eq(schema.networkTVDevices.id, device.id))

        return {
          id: device.id,
          ipAddress: device.ipAddress,
          brand: device.brand,
          model: device.model,
          status: online ? 'online' : 'offline',
        }
      })
    )

    const deviceResults = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { status: 'error' }
    )

    const onlineCount = deviceResults.filter((d) => d.status === 'online').length

    logger.info(`[TV-STATUS] ${onlineCount}/${devices.length} online`)

    return NextResponse.json({
      success: true,
      count: devices.length,
      online: onlineCount,
      offline: devices.length - onlineCount,
      devices: deviceResults,
    })
  } catch (error: any) {
    logger.error('[TV-STATUS] Status check error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Status check failed' },
      { status: 500 }
    )
  }
}

/**
 * Ping a TV to check if it's reachable.
 * Uses brand-appropriate endpoints with a fast 2-second timeout.
 */
async function pingDevice(ip: string, brand: string, port: number): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2000)

  try {
    let url: string

    switch (brand.toLowerCase()) {
      case 'samsung':
        url = `http://${ip}:8001/api/v2/`
        break
      case 'roku':
        url = `http://${ip}:${port || 8060}/query/device-info`
        break
      default:
        url = `http://${ip}:${port}/`
        break
    }

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    return response.ok
  } catch {
    clearTimeout(timeout)
    return false
  }
}
