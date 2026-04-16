import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import * as net from 'net'
import WebSocket from 'ws'

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
        const powerState = await pingDevice(device.ipAddress, device.brand, device.port, device.id, device.authToken)
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
async function pingDevice(ip: string, brand: string, port: number, deviceId?: string, authToken?: string | null): Promise<'on' | 'standby' | null> {
  // Sharp Aquos uses TCP on port 10002 — not HTTP
  if (brand.toLowerCase() === 'sharp') {
    return pingSharpDevice(ip, port || 10002)
  }

  // VAVA uses EShare HTTP on port 8000
  if (brand.toLowerCase() === 'vava') {
    return pingVavaDevice(ip, port || 8000)
  }

  // Epson uses ADB — check power state via dumpsys
  if (brand.toLowerCase() === 'epson') {
    return pingEpsonDevice(ip, port || 5555)
  }

  // LG uses WebOS WebSocket on port 3001
  if (brand.toLowerCase() === 'lg') {
    return pingLGDevice(ip, port || 3001)
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

      // NOTE: Samsung token refresh via WebSocket (port 8002) was removed
      // from the status check. Opening a WebSocket to samsung.remote.control
      // causes Samsung TVs to switch away from their current HDMI input to
      // Samsung TV Plus / Smart Hub — this was the root cause of TV 1 going
      // black at Stoneyard, Holmgren, and Appleton. Token refresh should
      // only happen when we actually need to send a remote command, not
      // during routine status polling.
    }

    return 'on'
  } catch {
    clearTimeout(timeout)
    return null
  }
}

/**
 * Ping an LG TV via TCP connect to WebOS port (default 3001).
 * If the TCP connection succeeds the TV is on; if it fails/times out it's offline.
 */
async function pingLGDevice(ip: string, port: number): Promise<'on' | 'standby' | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(null)
    }, 2000)

    socket.connect(port, ip, () => {
      clearTimeout(timeout)
      socket.destroy()
      resolve('on')
    })

    socket.on('error', () => {
      clearTimeout(timeout)
      socket.destroy()
      resolve(null)
    })
  })
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

/**
 * Ping a VAVA projector via EShare HTTP API on port 8000.
 * Queries get_volume — if it responds, projector is on.
 * If connection refused/timeout, projector is off.
 */
async function pingVavaDevice(ip: string, port: number): Promise<'on' | 'standby' | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2000)

  try {
    const response = await fetch(`http://${ip}:${port}/remote/get_volume`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const text = await response.text()
    if (text.includes("'status':'ok'")) return 'on'
    return null
  } catch {
    clearTimeout(timeout)
    return null
  }
}

/**
 * Ping an Epson projector via ADB to check power state.
 * Uses dumpsys power to read mWakefulness.
 */
async function pingEpsonDevice(ip: string, port: number): Promise<'on' | 'standby' | null> {
  const { exec } = require('child_process')
  const { promisify } = require('util')
  const execAsync = promisify(exec)
  const adbTarget = `${ip}:${port}`

  try {
    await execAsync(`adb connect ${adbTarget}`, { timeout: 3000 })
    const { stdout } = await execAsync(
      `adb -s ${adbTarget} shell dumpsys power | grep mWakefulness`,
      { timeout: 3000 }
    )
    if (stdout.includes('Awake')) return 'on'
    if (stdout.includes('Asleep') || stdout.includes('Dozing')) return 'standby'
    return null
  } catch {
    return null
  }
}

/**
 * Attempt to refresh a Samsung TV's auth token via a quick WebSocket handshake.
 * Connects to the Samsung SmartView WebSocket API, waits for the ms.channel.connect
 * event, and updates the stored token if the TV returns a new one.
 * Uses a 5-second timeout so it doesn't slow down the status poll.
 * Failures are silently ignored — this is a best-effort refresh.
 */
async function refreshSamsungToken(ip: string, deviceId: string, currentToken: string | null | undefined): Promise<void> {
  const SAMSUNG_APP_NAME = 'SportsBarController'
  const nameB64 = Buffer.from(SAMSUNG_APP_NAME).toString('base64')
  let url = `wss://${ip}:8002/api/v2/channels/samsung.remote.control?name=${nameB64}`
  if (currentToken) {
    url += `&token=${currentToken}`
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.terminate()
      resolve() // Timeout is not an error — just skip refresh
    }, 5000)

    const ws = new WebSocket(url, { rejectUnauthorized: false })

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString())

        if (msg.event === 'ms.channel.connect') {
          const newToken = msg.data?.token
          clearTimeout(timeout)
          ws.close()

          if (newToken && newToken !== currentToken) {
            logger.info(`[TV-STATUS] Samsung token refreshed for ${ip} (device ${deviceId})`)
            try {
              await db.update(schema.networkTVDevices)
                .set({ authToken: newToken, updatedAt: new Date().toISOString() })
                .where(eq(schema.networkTVDevices.id, deviceId))
            } catch (dbErr: any) {
              logger.warn(`[TV-STATUS] Failed to save refreshed Samsung token for ${ip}: ${dbErr.message}`)
            }
          }

          resolve()
        }
      } catch {
        // Non-JSON message, ignore
      }
    })

    ws.on('error', () => {
      clearTimeout(timeout)
      ws.terminate()
      resolve() // Don't fail status check on WebSocket errors
    })

    ws.on('close', () => {
      clearTimeout(timeout)
      resolve()
    })
  })
}
