import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import * as net from 'net'

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
        const powerState = await pingDevice(device.ipAddress, device.brand, device.port)
        const now = new Date().toISOString()
        // Map power state: 'on' = online, 'standby' = standby, null = offline
        const status = powerState === 'on' ? 'online' : powerState === 'standby' ? 'standby' : 'offline'

        await db.update(schema.networkTVDevices)
          .set({
            status,
            ...(powerState ? { lastSeen: now } : {}),
            updatedAt: now,
          })
          .where(eq(schema.networkTVDevices.id, device.id))

        return {
          id: device.id,
          ipAddress: device.ipAddress,
          brand: device.brand,
          model: device.model,
          status,
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
 * Ping a TV to check if it's reachable and get its power state.
 * Uses brand-appropriate endpoints with a fast 2-second timeout.
 * Returns 'on' if powered on, 'standby' if in standby, or null if unreachable.
 */
async function pingDevice(ip: string, brand: string, port: number): Promise<'on' | 'standby' | null> {
  // Sharp Aquos uses TCP on port 10002 — not HTTP
  if (brand.toLowerCase() === 'sharp') {
    return pingSharpDevice(ip, port || 10002)
  }

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

    if (!response.ok) return null

    // Samsung REST API returns PowerState field
    if (brand.toLowerCase() === 'samsung') {
      try {
        const data = await response.json()
        const powerState = data?.device?.PowerState
        if (powerState === 'standby') return 'standby'
      } catch {
        // JSON parse failure — still reachable
      }
    }

    return 'on'
  } catch {
    clearTimeout(timeout)
    return null
  }
}

/**
 * Ping a Sharp Aquos TV via TCP port 10002.
 * Sends POWR? query — response "1" = on, "0" = standby, timeout = offline
 */
async function pingSharpDevice(ip: string, port: number): Promise<'on' | 'standby' | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(null)
    }, 2000)

    socket.connect(port, ip, () => {
      socket.write('POWR?   \r')
    })

    socket.on('data', (data) => {
      clearTimeout(timeout)
      const resp = data.toString().trim()
      socket.destroy()
      if (resp === '1') resolve('on')
      else if (resp === '0') resolve('standby')
      else resolve(null)
    })

    socket.on('error', () => {
      clearTimeout(timeout)
      socket.destroy()
      resolve(null)
    })
  })
}
