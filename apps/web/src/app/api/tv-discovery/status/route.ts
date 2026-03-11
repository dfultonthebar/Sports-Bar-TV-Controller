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
 * Pings all discovered TVs to check online/offline/standby status.
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
        const info = await pingDevice(device.ipAddress, device.brand, device.port, device.authToken)
        const now = new Date().toISOString()
        // Map power state: 'on' = online, 'standby' = standby, null = offline
        const status = info.powerState === 'on' ? 'online' : info.powerState === 'standby' ? 'standby' : 'offline'

        await db.update(schema.networkTVDevices)
          .set({
            status,
            ...(info.powerState ? { lastSeen: now } : {}),
            updatedAt: now,
          })
          .where(eq(schema.networkTVDevices.id, device.id))

        return {
          id: device.id,
          ipAddress: device.ipAddress,
          brand: device.brand,
          model: device.model,
          status,
          powerState: info.powerState || null,
          currentSource: info.currentSource || null,
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
 * Ping a TV to check if it's reachable and gather diagnostic info.
 * Returns powerState ('on', 'standby', or null) and optionally currentSource.
 */
async function pingDevice(
  ip: string,
  brand: string,
  port: number,
  authToken?: string | null
): Promise<{ powerState: 'on' | 'standby' | null; currentSource?: string }> {
  // Sharp Aquos uses TCP on port 10002 — not HTTP
  if (brand.toLowerCase() === 'sharp') {
    const state = await pingSharpDevice(ip, port || 10002)
    return { powerState: state }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    switch (brand.toLowerCase()) {
      case 'samsung': {
        const response = await fetch(`http://${ip}:8001/api/v2/`, { signal: controller.signal })
        clearTimeout(timeout)
        if (!response.ok) return { powerState: null }

        const data = await response.json()
        const rawPowerState = data?.device?.PowerState
        const powerState: 'on' | 'standby' = rawPowerState === 'standby' ? 'standby' : 'on'

        // Try to get current source from authenticated endpoint
        let currentSource: string | undefined
        if (authToken) {
          try {
            const srcController = new AbortController()
            const srcTimeout = setTimeout(() => srcController.abort(), 2000)
            const srcResponse = await fetch(
              `http://${ip}:8001/api/v2/sources/`,
              { signal: srcController.signal, headers: { 'Authorization': `Bearer ${authToken}` } }
            )
            clearTimeout(srcTimeout)
            if (srcResponse.ok) {
              const srcData = await srcResponse.json()
              if (Array.isArray(srcData)) {
                const active = srcData.find((s: any) => s.connected || s.active)
                currentSource = active?.name || active?.label || undefined
              }
            }
          } catch {
            // Source query failed — not critical
          }
        }

        return { powerState, currentSource }
      }

      case 'roku': {
        const response = await fetch(`http://${ip}:${port || 8060}/query/device-info`, { signal: controller.signal })
        clearTimeout(timeout)
        if (!response.ok) return { powerState: null }

        let currentSource: string | undefined
        try {
          const inputController = new AbortController()
          const inputTimeout = setTimeout(() => inputController.abort(), 2000)
          const inputResponse = await fetch(`http://${ip}:${port || 8060}/query/active-app`, { signal: inputController.signal })
          clearTimeout(inputTimeout)
          if (inputResponse.ok) {
            const text = await inputResponse.text()
            const match = text.match(/<app[^>]*>([^<]+)<\/app>/)
            if (match) currentSource = match[1]
          }
        } catch { /* not critical */ }

        return { powerState: 'on', currentSource }
      }

      default: {
        const response = await fetch(`http://${ip}:${port}/`, { signal: controller.signal })
        clearTimeout(timeout)
        return { powerState: response.ok ? 'on' : null }
      }
    }
  } catch {
    clearTimeout(timeout)
    return { powerState: null }
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
