import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, inArray } from 'drizzle-orm'
import { SamsungTVClient, RokuTVClient, SharpTVClient, VavaTVClient, TVBrand } from '@sports-bar/tv-network-control'

/**
 * Bulk TV Power Control API
 *
 * Powers on/off multiple TVs at once (bar open/close).
 * Body: { action: 'on' | 'off', deviceIds?: string[] }
 * If no deviceIds, applies to ALL active TVs.
 */

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, ValidationSchemas.tvBulkPower)
  if (!bodyValidation.success) return bodyValidation.error

  const { action, deviceIds } = bodyValidation.data

  try {
    logger.info(`[TV-CONTROL] Bulk power ${action}`, { deviceIds: deviceIds || 'all' })

    // Load devices — filter by IDs if provided, otherwise get all
    let devices
    if (deviceIds && deviceIds.length > 0) {
      devices = await db.select()
        .from(schema.networkTVDevices)
        .where(inArray(schema.networkTVDevices.id, deviceIds))
    } else {
      devices = await db.select()
        .from(schema.networkTVDevices)
        .where(eq(schema.networkTVDevices.supportsPower, true))
    }

    if (devices.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No TV devices found' },
        { status: 404 }
      )
    }

    logger.info(`[TV-CONTROL] Bulk power ${action} for ${devices.length} device(s)`)

    // Execute power commands in parallel
    const results = await Promise.allSettled(
      devices.map(async (device) => {
        try {
          const result = await controlDevicePower(device, action)
          if (result.success) {
            await db.update(schema.networkTVDevices)
              .set({
                lastSeen: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
              .where(eq(schema.networkTVDevices.id, device.id))
          }
          return { deviceId: device.id, brand: device.brand, ipAddress: device.ipAddress, ...result }
        } catch (error: any) {
          return { deviceId: device.id, brand: device.brand, ipAddress: device.ipAddress, success: false, error: error.message }
        }
      })
    )

    const deviceResults = results.map((r) => {
      if (r.status === 'fulfilled') return r.value
      return { success: false, error: r.reason?.message || 'Unknown error' }
    })

    const successCount = deviceResults.filter((r) => r.success).length
    const failCount = deviceResults.filter((r) => !r.success).length

    // Log failures individually
    deviceResults.filter((r: any) => !r.success).forEach((r: any) => {
      logger.error(`[TV-CONTROL] Bulk power ${action} failed for ${r.brand} TV ${r.deviceId} (${r.ipAddress}): ${r.error}`)
    })

    logger.info(`[TV-CONTROL] Bulk power ${action} complete: ${successCount} success, ${failCount} failed`)

    return NextResponse.json({
      success: failCount === 0,
      message: `Power ${action}: ${successCount}/${devices.length} succeeded`,
      totalDevices: devices.length,
      successCount,
      failCount,
      results: deviceResults,
    })
  } catch (error: any) {
    logger.error('[TV-CONTROL] Bulk power error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Bulk power control failed' },
      { status: 500 }
    )
  }
}

async function controlDevicePower(
  device: any,
  action: 'on' | 'off' | 'toggle'
): Promise<{ success: boolean; message?: string; error?: string }> {
  switch (device.brand.toLowerCase()) {
    case 'roku': {
      const baseUrl = `http://${device.ipAddress}:${device.port}`
      const endpointMap = { on: '/keypress/PowerOn', off: '/keypress/PowerOff', toggle: '/keypress/Power' }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      try {
        const response = await fetch(`${baseUrl}${endpointMap[action]}`, {
          method: 'POST',
          signal: controller.signal,
        })
        clearTimeout(timeout)
        return response.ok
          ? { success: true, message: `Power ${action} sent` }
          : { success: false, error: `HTTP ${response.status}` }
      } catch (error: any) {
        clearTimeout(timeout)
        return { success: false, error: error.name === 'AbortError' ? 'Timeout' : error.message }
      }
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
        if (action === 'on') return await client.powerOn()
        // Samsung only supports KEY_POWER toggle for both off and toggle
        const result = await client.sendKey('KEY_POWER')
        await new Promise(resolve => setTimeout(resolve, 500))
        return result
      } finally {
        client.disconnect()
      }
    }

    case 'sharp': {
      const client = new SharpTVClient({
        ipAddress: device.ipAddress,
        port: device.port || 10002,
        brand: TVBrand.SHARP,
        macAddress: device.macAddress,
      })
      if (action === 'on') return await client.powerOn()
      if (action === 'off') return await client.powerOff()
      // toggle
      const isOn = await client.getPowerState()
      return isOn ? await client.powerOff() : await client.powerOn()
    }

    case 'vava': {
      const client = new VavaTVClient({
        ipAddress: device.ipAddress,
        port: device.port || 8000,
        brand: TVBrand.VAVA,
        macAddress: device.macAddress,
      })
      if (action === 'on') return await client.powerOn()
      if (action === 'off') return await client.powerOff()
      const isVavaOn = await client.getPowerState()
      return isVavaOn ? await client.powerOff() : await client.powerOn()
    }

    default:
      return { success: false, error: `${device.brand} not supported for bulk power` }
  }
}
