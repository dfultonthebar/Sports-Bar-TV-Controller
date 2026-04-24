import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { findFirst, update as dbUpdate } from '@/lib/db-helpers'
import { loadDirecTVDevices } from '@/lib/device-db'

// Poll all DirecTV receivers for their current channel and update the DB
async function pollDirecTVChannels() {
  try {
    const devicesData = await loadDirecTVDevices()

    await Promise.allSettled(
      (devicesData.devices || []).map(async (device: any) => {
        if (!device.ipAddress || !device.inputChannel) return

        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 2000)
          const response = await fetch(`http://${device.ipAddress}:${device.port || 8080}/tv/getTuned`, {
            signal: controller.signal,
          })
          clearTimeout(timeout)

          if (!response.ok) return
          const data = await response.json()
          if (data.status?.code !== 200 || !data.major) return

          const channelNumber = String(data.major)
          const channelName = data.callsign || null
          const inputNum = device.inputChannel
          const now = new Date().toISOString()

          const existing = await findFirst('inputCurrentChannels', {
            where: eq(schema.inputCurrentChannels.inputNum, inputNum)
          })

          if (existing) {
            // Only update if channel changed
            if (existing.channelNumber !== channelNumber) {
              await dbUpdate('inputCurrentChannels', eq(schema.inputCurrentChannels.id, existing.id), {
                channelNumber,
                channelName,
                deviceType: 'directv',
                lastTuned: now,
                updatedAt: now,
              })
            }
          } else {
            await db.insert(schema.inputCurrentChannels).values({
              id: crypto.randomUUID(),
              inputNum,
              inputLabel: device.name,
              deviceType: 'directv',
              deviceId: device.id,
              channelNumber,
              channelName,
              lastTuned: now,
              updatedAt: now,
            })
          }
        } catch {
          // Skip unreachable receivers
        }
      })
    )
  } catch {
    // Ignore errors
  }
}

// GET /api/matrix/current-channels - Get current channel info for all inputs
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Poll DirecTV receivers for live channel data (fire-and-forget update to DB)
    pollDirecTVChannels().catch(() => {})

    // Get all current channel records
    const currentChannels = await db
      .select()
      .from(schema.inputCurrentChannels)
      .all()

    // Hydrate channelName from ChannelPreset for any rows that have a
    // channelNumber but no channelName. Tune route only sets channelName
    // when the user clicks a labeled preset; a manual numeric entry or a
    // bare API tune leaves it null, which then suppresses the channel
    // logo in the bartender remote (logo block early-returns on empty
    // channelName). Hydrating here keeps the source of truth (DB) clean
    // while restoring the visual.
    const numbersToHydrate = currentChannels
      .filter(c => c.channelNumber && c.channelNumber !== 'APP' && !c.channelName)
      .map(c => ({ channelNumber: c.channelNumber, deviceType: c.deviceType }))

    const presetLookup = new Map<string, string>()
    if (numbersToHydrate.length > 0) {
      const allPresets = await db.select().from(schema.channelPresets).all()
      for (const p of allPresets) {
        // Key by `${deviceType}|${channelNumber}` so cable ch 27 and directv
        // ch 27 don't collide on different network names.
        const key = `${p.deviceType}|${p.channelNumber}`
        if (!presetLookup.has(key)) presetLookup.set(key, p.name)
      }
    }

    // Transform into a map for easy lookup by input number
    const channelMap: Record<number, {
      channelNumber: string
      channelName: string | null
      deviceType: string
      inputLabel: string
      lastTuned: string
    }> = {}

    currentChannels.forEach(channel => {
      let resolvedName = channel.channelName
      if (!resolvedName && channel.channelNumber && channel.channelNumber !== 'APP') {
        resolvedName = presetLookup.get(`${channel.deviceType}|${channel.channelNumber}`) || null
      }
      channelMap[channel.inputNum] = {
        channelNumber: channel.channelNumber,
        channelName: resolvedName,
        deviceType: channel.deviceType,
        inputLabel: channel.inputLabel,
        lastTuned: channel.lastTuned
      }
    })

    return NextResponse.json({
      success: true,
      channels: channelMap,
      count: currentChannels.length
    })
  } catch (error) {
    logger.error('[Current Channels] Error fetching current channels:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch current channel information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
