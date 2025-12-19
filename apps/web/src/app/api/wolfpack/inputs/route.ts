
import { NextResponse, NextRequest } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, asc } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import fs from 'fs/promises'
import path from 'path'

interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  inputChannel?: number
}

interface TunedInfo {
  major: number
  callsign: string
  title: string
  isRecording?: boolean
}

// Fetch live channel info from a DirecTV device
async function getDirectTVTuned(ipAddress: string, port: number = 8080): Promise<TunedInfo | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000) // 3 second timeout

    const response = await fetch(`http://${ipAddress}:${port}/tv/getTuned`, {
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (response.ok) {
      const data = await response.json()
      if (data.status?.code === 200) {
        return {
          major: data.major,
          callsign: data.callsign || '',
          title: data.title || '',
          isRecording: data.isRecording || false
        }
      }
    }
    return null
  } catch (error) {
    // Timeout or connection error - device may be offline
    return null
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    logger.api.request('GET', '/api/wolfpack/inputs')

    // Get active matrix configuration
    const config = await db
      .select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()

    if (!config) {
      logger.api.response('GET', '/api/wolfpack/inputs', 404, { error: 'No active config' })
      return NextResponse.json(
        { error: 'No active matrix configuration found' },
        { status: 404 }
      )
    }

    // Get active inputs for this configuration
    const inputs = await db
      .select()
      .from(schema.matrixInputs)
      .where(
        and(
          eq(schema.matrixInputs.configId, config.id),
          eq(schema.matrixInputs.isActive, true)
        )
      )
      .orderBy(asc(schema.matrixInputs.channelNumber))
      .all()

    // Load DirecTV devices from JSON
    let directvDevices: DirecTVDevice[] = []
    try {
      const directvPath = path.join(process.cwd(), 'data', 'directv-devices.json')
      const directvData = await fs.readFile(directvPath, 'utf-8')
      const parsed = JSON.parse(directvData)
      directvDevices = parsed.devices || []
    } catch (error) {
      logger.debug('[WOLFPACK INPUTS] Could not load DirecTV devices')
    }

    // Get current channel tracking from database (for cable boxes, etc.)
    const currentChannels = await db.select().from(schema.inputCurrentChannels).all()
    const channelMap = new Map(currentChannels.map(c => [c.inputNum, c]))

    // Fetch live data from DirecTV devices in parallel
    const directvLiveData = new Map<number, TunedInfo>()

    if (directvDevices.length > 0) {
      logger.debug(`[WOLFPACK INPUTS] Fetching live data from ${directvDevices.length} DirecTV devices`)

      const liveDataPromises = directvDevices.map(async (device) => {
        if (device.inputChannel) {
          const tuned = await getDirectTVTuned(device.ipAddress, device.port)
          if (tuned) {
            directvLiveData.set(device.inputChannel, tuned)

            // Update InputCurrentChannel table with fresh data
            try {
              const existing = channelMap.get(device.inputChannel)
              const now = new Date().toISOString()

              if (existing) {
                await db.update(schema.inputCurrentChannels)
                  .set({
                    channelNumber: String(tuned.major),
                    channelName: tuned.title || tuned.callsign,
                    lastTuned: now,
                    updatedAt: now
                  })
                  .where(eq(schema.inputCurrentChannels.id, existing.id))
              } else {
                await db.insert(schema.inputCurrentChannels).values({
                  id: crypto.randomUUID(),
                  inputNum: device.inputChannel,
                  inputLabel: device.name,
                  deviceType: 'directv',
                  deviceId: device.ipAddress,
                  channelNumber: String(tuned.major),
                  channelName: tuned.title || tuned.callsign,
                  lastTuned: now,
                  updatedAt: now
                })
              }
            } catch (updateError) {
              logger.debug(`[WOLFPACK INPUTS] Failed to update channel tracking for ${device.name}`)
            }
          }
        }
      })

      await Promise.all(liveDataPromises)
      logger.debug(`[WOLFPACK INPUTS] Got live data from ${directvLiveData.size} DirecTV devices`)
    }

    // Format inputs with current channel info
    const formattedInputs = inputs.map(input => {
      // Check for live DirecTV data first
      const liveData = directvLiveData.get(input.channelNumber)
      if (liveData) {
        return {
          id: input.id,
          channelNumber: input.channelNumber,
          label: input.label,
          inputType: input.inputType,
          deviceType: input.deviceType,
          status: input.status,
          currentChannel: String(liveData.major),
          currentProgram: liveData.title || liveData.callsign,
          callsign: liveData.callsign,
          isLive: true,
          isActive: input.isActive
        }
      }

      // Fall back to tracked channel data from database
      const tracked = channelMap.get(input.channelNumber)
      if (tracked) {
        return {
          id: input.id,
          channelNumber: input.channelNumber,
          label: input.label,
          inputType: input.inputType,
          deviceType: input.deviceType,
          status: input.status,
          currentChannel: tracked.channelNumber,
          currentProgram: tracked.channelName,
          lastTuned: tracked.lastTuned,
          isLive: false,
          isActive: input.isActive
        }
      }

      // No data available
      return {
        id: input.id,
        channelNumber: input.channelNumber,
        label: input.label,
        inputType: input.inputType,
        deviceType: input.deviceType,
        status: input.status,
        currentChannel: null,
        currentProgram: null,
        isLive: false,
        isActive: input.isActive
      }
    })

    logger.api.response('GET', '/api/wolfpack/inputs', 200, {
      count: formattedInputs.length,
      configId: config.id,
      liveDevices: directvLiveData.size
    })

    return NextResponse.json({
      success: true,
      inputs: formattedInputs,
      configId: config.id,
      configName: config.name,
      liveDataCount: directvLiveData.size
    })

  } catch (error) {
    logger.api.error('GET', '/api/wolfpack/inputs', error)
    return NextResponse.json(
      { error: 'Failed to fetch Wolfpack inputs' },
      { status: 500 }
    )
  }
}
