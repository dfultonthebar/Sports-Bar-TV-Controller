import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas, z } from '@/lib/validation'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { findFirst, update } from '@/lib/db-helpers'
import fs from 'fs/promises'
import path from 'path'

/**
 * DirecTV Channel Tune API
 *
 * Tunes a DirecTV receiver to a specific channel using the DirecTV HTTP API.
 * DirecTV Genie receivers expose an HTTP interface on port 8080.
 *
 * API Documentation: http://{receiver-ip}:8080/info/getOptions
 * Tune Command: http://{receiver-ip}:8080/tv/tune?major={channel}
 */

interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  receiverType?: string
  isOnline?: boolean
  inputChannel?: number
}

// Helper to get current program info from DirecTV device
async function getCurrentProgramInfo(ipAddress: string, port: number): Promise<{ title?: string; callsign?: string } | null> {
  try {
    const response = await fetch(`http://${ipAddress}:${port}/tv/getTuned`, {
      signal: AbortSignal.timeout(3000)
    })
    if (response.ok) {
      const data = await response.json()
      if (data.status?.code === 200) {
        return { title: data.title, callsign: data.callsign }
      }
    }
    return null
  } catch {
    return null
  }
}

// Helper to update input current channel in database
async function updateInputCurrentChannel(
  inputNum: number,
  inputLabel: string,
  deviceId: string,
  channelNumber: string,
  channelName: string | null
): Promise<void> {
  const now = new Date()

  try {
    const existing = await findFirst('inputCurrentChannels', {
      where: eq(schema.inputCurrentChannels.inputNum, inputNum)
    })

    if (existing) {
      await update('inputCurrentChannels', eq(schema.inputCurrentChannels.id, existing.id), {
        channelNumber,
        channelName,
        lastTuned: now.toISOString(),
        updatedAt: now.toISOString()
      })
    } else {
      await db.insert(schema.inputCurrentChannels).values({
        id: crypto.randomUUID(),
        inputNum,
        inputLabel,
        deviceType: 'DirecTV',
        deviceId,
        channelNumber,
        channelName,
        lastTuned: now.toISOString(),
        updatedAt: now.toISOString()
      })
    }

    logger.debug(`[DIRECTV] Updated input ${inputNum} current channel to ${channelNumber}${channelName ? ` (${channelName})` : ''}`)
  } catch (error) {
    logger.error('[DIRECTV] Failed to update input current channel:', error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Await params (required in Next.js 16+)
  const { deviceId } = await params

  // Validate request body - accepts number or string for sub-channels like "210-1"
  const bodyValidation = await validateRequestBody(
    request,
    z.object({
      channel: z.union([
        z.number().int().min(1).max(99999),
        z.string().regex(/^\d+(-\d+)?$/, 'Channel must be a number or format like "210-1"')
      ])
    })
  )
  if (!bodyValidation.success) return bodyValidation.error

  const { channel: channelInput } = bodyValidation.data

  // Parse channel - handle both "210" and "210-1" formats
  let major: number
  let minor: number | undefined

  const channelStr = String(channelInput)
  if (channelStr.includes('-')) {
    const parts = channelStr.split('-')
    major = parseInt(parts[0], 10)
    minor = parseInt(parts[1], 10)
  } else {
    major = typeof channelInput === 'number' ? channelInput : parseInt(channelStr, 10)
  }

  try {
    // Load DirecTV devices from JSON file
    const devicesPath = path.join(process.cwd(), 'data', 'directv-devices.json')
    const devicesJson = await fs.readFile(devicesPath, 'utf-8')
    const devicesData = JSON.parse(devicesJson)

    // Find device by ID
    const device = devicesData.devices.find((d: DirecTVDevice) => d.id === deviceId)

    if (!device) {
      logger.error(`[DIRECTV] Device not found: ${deviceId}`)
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    // Build channel display string for logging
    const channelDisplay = minor !== undefined ? `${major}-${minor}` : String(major)

    logger.info(`[DIRECTV] Tuning ${device.name} (${device.ipAddress}) to channel ${channelDisplay}`)

    // Send tune command to DirecTV receiver
    // DirecTV HTTP API: http://{ip}:8080/tv/tune?major={channel}&minor={subchannel}
    const tuneUrl = minor !== undefined
      ? `http://${device.ipAddress}:${device.port}/tv/tune?major=${major}&minor=${minor}`
      : `http://${device.ipAddress}:${device.port}/tv/tune?major=${major}`

    // OPTIMISTIC UPDATE STRATEGY:
    // DirecTV devices are slow to respond (often >5s), but the tune command works reliably.
    // We send the command, wait briefly to ensure it's transmitted, update DB, then return.

    // Step 1: Send the tune command and wait briefly to ensure it's transmitted
    // Using a short timeout (2s) - enough to ensure the TCP connection is established
    // and the HTTP request is sent, but not waiting for the slow DirecTV response
    logger.info(`[DIRECTV] Sending tune command to ${device.name} at ${tuneUrl}`)

    try {
      // Start the fetch but only wait up to 2 seconds for the initial connection
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)

      // Fire the request - we don't need to wait for the full response
      fetch(tuneUrl, {
        method: 'GET',
        signal: controller.signal
      }).then(async (response) => {
        clearTimeout(timeoutId)
        try {
          const text = await response.text()
          const json = JSON.parse(text)
          if (json.status?.code === 200) {
            logger.info(`[DIRECTV] Confirmed: ${device.name} tuned to ${channelDisplay}`)
          } else {
            logger.warn(`[DIRECTV] DirecTV returned status ${json.status?.code} for ${channelDisplay}`)
          }
        } catch {
          logger.warn(`[DIRECTV] Non-JSON response from DirecTV`)
        }
      }).catch((err) => {
        clearTimeout(timeoutId)
        // Timeout is expected - the command was still sent
        if (err.name === 'AbortError') {
          logger.info(`[DIRECTV] Command sent to ${device.name} (response pending)`)
        } else {
          logger.warn(`[DIRECTV] Tune error: ${err.message}`)
        }
      })

      // Wait a moment to ensure the request is actually sent over the network
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (fetchError: any) {
      logger.error(`[DIRECTV] Failed to send tune command: ${fetchError.message}`)
      // Continue anyway - we'll update DB and hope the command went through
    }

    // Step 2: Update database immediately (optimistic update)
    if (device.inputChannel) {
      // Get channel name from presets if available
      let channelName: string | null = null
      try {
        const preset = await db
          .select({ name: schema.channelPresets.name })
          .from(schema.channelPresets)
          .where(eq(schema.channelPresets.channelNumber, channelDisplay))
          .limit(1)
        if (preset.length > 0) {
          channelName = preset[0].name
        }
      } catch {
        // Ignore preset lookup errors
      }

      await updateInputCurrentChannel(
        device.inputChannel,
        device.name,
        device.id,
        channelDisplay,
        channelName
      )
      logger.info(`[DIRECTV] Database updated: Input ${device.inputChannel} -> channel ${channelDisplay}`)
    }

    // Step 3: Return success immediately (don't wait for DirecTV response)
    // The tune command has been sent and the database has been updated
    logger.info(`[DIRECTV] Tune command sent to ${device.name} for channel ${channelDisplay}`)

    return NextResponse.json({
      success: true,
      message: `Tuned to channel ${channelDisplay}`,
      deviceId,
      deviceName: device.name,
      channel: channelDisplay,
      major,
      minor,
      ipAddress: device.ipAddress
    })

  } catch (error: any) {
    logger.error('[DIRECTV] Tune API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        deviceId,
        channel: channelStr
      },
      { status: 500 }
    )
  }
}
