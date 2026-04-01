import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { findFirst, update as dbUpdate } from '@/lib/db-helpers'
import fs from 'fs/promises'
import path from 'path'

// Poll all DirecTV receivers for their current channel and update the DB
async function pollDirecTVChannels() {
  try {
    const devicesPath = path.join(process.cwd(), 'data', 'directv-devices.json')
    const devicesJson = await fs.readFile(devicesPath, 'utf-8')
    const devicesData = JSON.parse(devicesJson)

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

    // Transform into a map for easy lookup by input number
    const channelMap: Record<number, {
      channelNumber: string
      channelName: string | null
      deviceType: string
      inputLabel: string
      lastTuned: string
    }> = {}

    currentChannels.forEach(channel => {
      channelMap[channel.inputNum] = {
        channelNumber: channel.channelNumber,
        channelName: channel.channelName,
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
