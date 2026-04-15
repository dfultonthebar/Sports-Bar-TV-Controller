import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, inArray } from 'drizzle-orm'
import { SamsungTVClient, RokuTVClient, SharpTVClient, VavaTVClient, LGTVClient, TVBrand } from '@sports-bar/tv-network-control'
import { persistSamsungTokenIfChanged } from '@/lib/samsung-token-persist'
import { probeSamsungTV } from '@/lib/samsung-model-probe'
import { logAuditAction } from '@sports-bar/auth'

/**
 * Determine whether a Samsung TV's screen is actually on using the REST
 * PowerState field at :8001/api/v2/.
 *
 * Port 8002 (the WebSocket control port) is NOT a reliable "is the screen
 * on" signal — modern Samsung TVs (e.g. 2024 DU7200 series) keep 8002
 * open in network standby so Wake-on-LAN still works. Treating 8002 as
 * "on" gives false positives for TVs whose screens are dark.
 *
 * REST PowerState:
 *   - "on"      → screen is lit
 *   - "standby" → screen is off, NIC alive (ready for WoL)
 *   - missing/unreachable → fully off, NIC dead
 */
async function isSamsungTVOn(ipAddress: string): Promise<boolean> {
  const result = await probeSamsungTV(ipAddress, 2000)
  return result.powerState === 'on'
}

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

    // Load devices — status is refreshed every 5 min by scheduler poll
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

    // Determine desired state by probing the first 2 Samsung TVs
    // If they're on → we want everything on. If they're off → everything off.
    // This handles the toggle problem: KEY_POWER is a toggle on Samsung,
    // so we need to know each TV's actual state before sending commands.
    let desiredState: 'on' | 'off' = action === 'on' ? 'on' : 'off'

    if (action === 'on' || action === 'off') {
      // For explicit on/off, use the action directly
      desiredState = action
    } else {
      // For toggle, probe first 2 Samsung TVs to determine intent
      const samsungTVs = devices.filter(d => d.brand?.toLowerCase() === 'samsung').slice(0, 2)
      let onCount = 0
      for (const tv of samsungTVs) {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 2000)
          const resp = await fetch(`http://${tv.ipAddress}:8001/api/v2/`, { signal: controller.signal })
          clearTimeout(timeout)
          if (resp.ok) {
            const data = await resp.json()
            const ps = data?.device?.PowerState
            if (ps === 'on' || !ps) onCount++
          }
        } catch {
          // Unreachable = off
        }
      }
      desiredState = onCount > 0 ? 'off' : 'on'
      logger.info(`[TV-CONTROL] Toggle: ${onCount}/${samsungTVs.length} reference TVs are on → desired state: ${desiredState}`)
    }

    // Step 1: Probe all Samsung TVs for actual power state via port 8002
    // (the remote-control WebSocket). Port 8001 lies — see isSamsungTVOn doc.
    const samsungDevices = devices.filter(d => d.brand?.toLowerCase() === 'samsung')
    const tvStates = new Map<string, boolean>() // deviceId → isOn

    await Promise.all(
      samsungDevices.map(async (device) => {
        const isOn = await isSamsungTVOn(device.ipAddress)
        tvStates.set(device.id, isOn)
      })
    )

    // Non-Samsung: use DB status
    devices.filter(d => d.brand?.toLowerCase() !== 'samsung').forEach(d => {
      tvStates.set(d.id, d.status === 'online')
    })

    logger.info(`[TV-CONTROL] State check: ${[...tvStates.values()].filter(v => v).length} on, ${[...tvStates.values()].filter(v => !v).length} off`)

    // Step 2: Send power commands in batches of 5
    const BATCH_SIZE = 5
    const deviceResults: any[] = []

    for (let i = 0; i < devices.length; i += BATCH_SIZE) {
      const batch = devices.slice(i, i + BATCH_SIZE)

      const batchResults = await Promise.allSettled(
        batch.map(async (device) => {
          const currentlyOn = tvStates.get(device.id) ?? false

          // Skip if already in desired state
          if (desiredState === 'on' && currentlyOn) {
            return { deviceId: device.id, brand: device.brand, ipAddress: device.ipAddress, success: true, message: 'Already on — skipped' }
          }
          if (desiredState === 'off' && !currentlyOn) {
            return { deviceId: device.id, brand: device.brand, ipAddress: device.ipAddress, success: true, message: 'Already off — skipped' }
          }

          const result = await controlDevicePower(device, desiredState)
          if (result.success) {
            await db.update(schema.networkTVDevices)
              .set({
                status: desiredState === 'on' ? 'online' : 'standby',
                lastSeen: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
              .where(eq(schema.networkTVDevices.id, device.id))
          }
          return { deviceId: device.id, brand: device.brand, ipAddress: device.ipAddress, ...result }
        })
      )

      batchResults.forEach(r => {
        deviceResults.push(r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message })
      })

      // Brief pause between batches
      if (i + BATCH_SIZE < devices.length) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    // Step 3: Verify actual power state post-send (Samsung only). Samsung
    // KEY_POWER acks as "sent successfully" even when the TV ignores the
    // key — the only trustworthy signal is whether port 8002 actually
    // closes. Wait 6 s for the TV to settle, re-probe, and retry once
    // on any Samsung still showing a live WebSocket when we wanted it off
    // (or silent when we wanted it on).
    if (samsungDevices.length > 0 && (desiredState === 'off' || desiredState === 'on')) {
      await new Promise(resolve => setTimeout(resolve, 6000))

      const retryTargets: any[] = []
      await Promise.all(
        samsungDevices.map(async (device) => {
          const isOn = await isSamsungTVOn(device.ipAddress)
          const matches = desiredState === 'on' ? isOn : !isOn
          const resultIdx = deviceResults.findIndex((r: any) => r.deviceId === device.id)
          if (resultIdx >= 0) {
            deviceResults[resultIdx].powerVerified = matches
            deviceResults[resultIdx].postProbeState = isOn ? 'on' : 'off'
          }
          if (!matches && !deviceResults[resultIdx]?.message?.includes('skipped')) {
            retryTargets.push(device)
          } else if (!matches) {
            // Was skipped but actually in wrong state — still retry.
            retryTargets.push(device)
          }
        })
      )

      if (retryTargets.length > 0) {
        logger.warn(`[TV-CONTROL] Bulk power ${action}: ${retryTargets.length} Samsung TV(s) did not reach ${desiredState}, retrying once: ${retryTargets.map(d => d.id).join(',')}`)
        await Promise.all(
          retryTargets.map(async (device) => {
            const retryResult = await controlDevicePower(device, desiredState)
            await new Promise(resolve => setTimeout(resolve, 4000))
            const isOn = await isSamsungTVOn(device.ipAddress)
            const matches = desiredState === 'on' ? isOn : !isOn
            const resultIdx = deviceResults.findIndex((r: any) => r.deviceId === device.id)
            if (resultIdx >= 0) {
              deviceResults[resultIdx] = {
                ...deviceResults[resultIdx],
                ...retryResult,
                retried: true,
                powerVerified: matches,
                postProbeState: isOn ? 'on' : 'off',
                // Success on a retry requires verification, not just key-send ack.
                success: matches,
                message: matches
                  ? `Retried and verified ${desiredState}`
                  : `Key sent twice but TV still ${isOn ? 'on' : 'off'} — manual intervention needed`,
              }
              if (matches) {
                await db.update(schema.networkTVDevices)
                  .set({
                    status: desiredState === 'on' ? 'online' : 'standby',
                    lastSeen: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  })
                  .where(eq(schema.networkTVDevices.id, device.id))
              }
            }
          })
        )
      }
    }

    const successCount = deviceResults.filter((r: any) => r.success).length
    const failCount = deviceResults.filter((r: any) => !r.success).length
    const verifiedCount = deviceResults.filter((r: any) => r.powerVerified === true).length
    const unverifiedCount = deviceResults.filter((r: any) => r.powerVerified === false).length

    // Log failures individually
    deviceResults.filter((r: any) => !r.success).forEach((r: any) => {
      logger.error(`[TV-CONTROL] Bulk power ${action} failed for ${r.brand} TV ${r.deviceId} (${r.ipAddress}): ${r.error || r.message}`)
    })

    logger.info(`[TV-CONTROL] Bulk power ${action} complete: ${successCount} success, ${failCount} failed, ${verifiedCount} verified, ${unverifiedCount} unverified`)

    // Persist an audit trail row so "what time did the bartender turn off
    // all the TVs last night?" is answerable after PM2 rotates its logs.
    // Fire-and-forget — never let audit write failure block the response.
    logAuditAction({
      action: `TV_POWER_BULK_${action.toUpperCase()}`,
      resource: 'tv_power',
      resourceId: deviceIds && deviceIds.length > 0 ? deviceIds.join(',') : 'all',
      endpoint: '/api/tv-control/bulk-power',
      method: 'POST',
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
      requestData: { action, deviceIds: deviceIds || 'all' },
      responseStatus: 200,
      success: failCount === 0,
      errorMessage: failCount > 0 ? `${failCount}/${devices.length} device(s) failed` : undefined,
      metadata: {
        totalDevices: devices.length,
        successCount,
        failCount,
        verifiedCount,
        unverifiedCount,
        results: deviceResults.map((r: any) => ({
          deviceId: r.deviceId,
          brand: r.brand,
          ipAddress: r.ipAddress,
          success: r.success,
          message: r.message || r.error,
          powerVerified: r.powerVerified ?? null,
        })),
      },
    }).catch(err => logger.warn('[TV-CONTROL] Audit log write failed (non-fatal):', err))

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
    logAuditAction({
      action: `TV_POWER_BULK_${action.toUpperCase()}`,
      resource: 'tv_power',
      resourceId: deviceIds && deviceIds.length > 0 ? deviceIds.join(',') : 'all',
      endpoint: '/api/tv-control/bulk-power',
      method: 'POST',
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
      requestData: { action, deviceIds: deviceIds || 'all' },
      responseStatus: 500,
      success: false,
      errorMessage: error.message || 'Bulk power control failed',
    }).catch(err => logger.warn('[TV-CONTROL] Audit log write failed (non-fatal):', err))
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
        if (action === 'on') {
          // Samsung TVs in network standby (screen off, NIC alive) STILL
          // report `PowerState: "on"` via /api/v2/ — the field is useless
          // for detecting "is the screen actually on". A probe-then-decide
          // approach will see "on" and skip the TV, leaving it dark.
          //
          // Delegate to SamsungTVClient.powerOn() which does the correct
          // sequence: fire WoL (idempotent — harmless if already on), poll
          // the REST API until the NIC is up, then send KEY_POWER only if
          // the post-WoL state says "standby". That method runs per TV in
          // parallel with the other TVs in this bulk call, so wall time
          // is bounded by the slowest TV, not 20×.
          return await client.powerOn()
        }

        if (action === 'off') {
          // Send KEY_POWER to turn off — state already checked by caller
          const result = await client.sendKey('KEY_POWER')
          await new Promise(resolve => setTimeout(resolve, 300))
          return result
        }

        // Toggle
        const result = await client.sendKey('KEY_POWER')
        await new Promise(resolve => setTimeout(resolve, 300))
        return result
      } finally {
        await persistSamsungTokenIfChanged(device, client)
        client.disconnect()
      }
    }

    case 'lg': {
      // LG WebOS TVs: powerOn via Wake-on-LAN, powerOff via WebSocket SSAP.
      // The single-TV route already uses this pattern (see controlLGPower
      // in apps/web/src/app/api/tv-control/[deviceId]/power/route.ts).
      // clientKey is REQUIRED — without it, register() falls back to
      // PROMPT pairing which silently hangs in automated bulk operations.
      const client = new LGTVClient({
        ipAddress: device.ipAddress,
        port: device.port || 3001,
        brand: TVBrand.LG,
        clientKey: device.clientKey || undefined,
        macAddress: device.macAddress,
      })
      try {
        if (action === 'on') {
          // WoL is idempotent — harmless if TV is already on.
          // Don't short-circuit on device.status because the DB may be
          // stale between scheduler polls.
          return await client.powerOn()
        }
        if (action === 'off') {
          // WebSocket SSAP to send ssap://system/turnOff. Fails gracefully
          // if the TV is already off (connection will refuse).
          return await client.powerOff()
        }
        // toggle — rely on DB status as the bulk route already does for
        // non-Samsung brands in the state probe loop above.
        const isOn = device.status === 'online'
        return isOn ? await client.powerOff() : await client.powerOn()
      } finally {
        client.disconnect()
      }
    }

    case 'lg': {
      // LG WebOS TVs: powerOn via Wake-on-LAN, powerOff via WebSocket SSAP.
      // The single-TV route already uses this pattern (see controlLGPower
      // in apps/web/src/app/api/tv-control/[deviceId]/power/route.ts).
      const client = new LGTVClient({
        ipAddress: device.ipAddress,
        port: device.port || 3001,
        brand: TVBrand.LG,
        macAddress: device.macAddress,
      })
      try {
        if (action === 'on') {
          // WoL is idempotent — harmless if TV is already on.
          // Don't short-circuit on device.status because the DB may be
          // stale between scheduler polls.
          return await client.powerOn()
        }
        if (action === 'off') {
          // WebSocket SSAP to send ssap://system/turnOff. Fails gracefully
          // if the TV is already off (connection will refuse).
          return await client.powerOff()
        }
        // toggle — rely on DB status as the bulk route already does for
        // non-Samsung brands in the state probe loop above.
        const isOn = device.status === 'online'
        return isOn ? await client.powerOff() : await client.powerOn()
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
      // Sharp TVs can drop TCP connections under load — retry once on failure
      const sharpAction = async () => {
        if (action === 'on') return await client.powerOn()
        if (action === 'off') {
          if (device.status === 'offline' || device.status === 'standby') {
            return { success: true, message: 'Sharp TV already off — skipped' }
          }
          return await client.powerOff()
        }
        const isOn = await client.getPowerState()
        return isOn ? await client.powerOff() : await client.powerOn()
      }
      try {
        return await sharpAction()
      } catch (firstError: any) {
        // Retry once after a short delay
        await new Promise(resolve => setTimeout(resolve, 500))
        try {
          return await sharpAction()
        } catch (retryError: any) {
          return { success: false, error: retryError.message }
        }
      }
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

    case 'epson': {
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)
      const adbTarget = `${device.ipAddress}:${device.port || 5555}`

      try {
        await execAsync(`adb connect ${adbTarget}`, { timeout: 5000 })

        if (action === 'off') {
          // Epson kills NIC on SLEEP — cannot be powered back on over network
          // Block power off to prevent unrecoverable shutdown
          return { success: true, message: 'Epson projector power off blocked — use physical remote' }
          // Check if already asleep
          try {
            const { stdout } = await execAsync(`adb -s ${adbTarget} shell dumpsys power | grep mWakefulness`, { timeout: 3000 })
            if (stdout.includes('Asleep') || stdout.includes('Dozing')) {
              return { success: true, message: 'Epson already off — skipped' }
            }
          } catch {}
          await execAsync(`adb -s ${adbTarget} shell input keyevent KEYCODE_SLEEP`, { timeout: 5000 })
          return { success: true, message: 'Epson powered off (standby)' }
        } else if (action === 'on') {
          await execAsync(`adb -s ${adbTarget} shell input keyevent KEYCODE_WAKEUP`, { timeout: 5000 })
          await new Promise(resolve => setTimeout(resolve, 2000))
          await execAsync(
            `adb -s ${adbTarget} shell am start -a android.intent.action.VIEW -d "content://android.media.tv/passthrough/com.droidlogic.tvinput%2F.services.Hdmi3InputService%2FHW7"`,
            { timeout: 5000 }
          )
          return { success: true, message: 'Epson powered on + HDMI 3 selected' }
        } else {
          // Toggle
          const { stdout } = await execAsync(`adb -s ${adbTarget} shell dumpsys power | grep mWakefulness`, { timeout: 3000 })
          if (stdout.includes('Awake')) {
            await execAsync(`adb -s ${adbTarget} shell input keyevent KEYCODE_SLEEP`, { timeout: 5000 })
            return { success: true, message: 'Epson powered off' }
          } else {
            await execAsync(`adb -s ${adbTarget} shell input keyevent KEYCODE_WAKEUP`, { timeout: 5000 })
            return { success: true, message: 'Epson powered on' }
          }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }

    default:
      return { success: false, error: `${device.brand} not supported for bulk power` }
  }
}
