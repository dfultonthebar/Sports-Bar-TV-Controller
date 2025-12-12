import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateQueryParams, isValidationError } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const DIRECTV_DEVICES_FILE = join(process.cwd(), 'data', 'directv-devices.json')

interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
  port?: number
}

interface ChannelScanResult {
  channelNumber: string
  callsign: string | null
  title: string | null
  isOffAir: boolean
  hasPreset: boolean
  presetName: string | null
}

// Load DirecTV devices from file
async function loadDirecTVDevices(): Promise<DirecTVDevice[]> {
  try {
    if (!existsSync(DIRECTV_DEVICES_FILE)) {
      return []
    }
    const data = await readFile(DIRECTV_DEVICES_FILE, 'utf8')
    const parsed = JSON.parse(data)
    return parsed.devices || []
  } catch (error) {
    logger.error('[DIRECTV-SCAN] Error loading DirecTV devices:', error)
    return []
  }
}

// Fetch program info from DirecTV device without tuning
async function getProgInfo(
  deviceIp: string,
  port: number,
  major: number,
  minor?: number
): Promise<{
  success: boolean
  title: string | null
  callsign: string | null
  isOffAir: boolean
}> {
  try {
    const url = minor !== undefined
      ? `http://${deviceIp}:${port}/tv/getProgInfo?major=${major}&minor=${minor}`
      : `http://${deviceIp}:${port}/tv/getProgInfo?major=${major}`

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000)
    })
    const data = await response.json()

    if (data.status?.code === 200) {
      return {
        success: true,
        title: data.title || null,
        callsign: data.callsign || null,
        isOffAir: data.isOffAir || false
      }
    }
    return { success: false, title: null, callsign: null, isOffAir: true }
  } catch (error) {
    logger.debug('[DIRECTV-SCAN] Error getting program info:', error)
    return { success: false, title: null, callsign: null, isOffAir: true }
  }
}

// Get existing presets for quick lookup
async function getExistingPresets(): Promise<Map<string, string>> {
  const presets = await db.select()
    .from(schema.channelPresets)
    .where(eq(schema.channelPresets.deviceType, 'directv'))

  const presetMap = new Map<string, string>()
  for (const preset of presets.filter(p => p.isActive)) {
    presetMap.set(preset.channelNumber.toLowerCase(), preset.name)
  }
  return presetMap
}

// Query parameter schema
const scanChannelsQuerySchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  mode: z.enum(['range', 'list', 'sports']).optional().default('sports'),
  start: z.coerce.number().int().min(1).max(9999).optional(),
  end: z.coerce.number().int().min(1).max(9999).optional(),
  channels: z.string().optional() // Comma-separated list of channels
})

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const queryValidation = validateQueryParams(request, scanChannelsQuerySchema)
  if (isValidationError(queryValidation)) return queryValidation.error

  const { deviceId, mode, start, end, channels } = queryValidation.data

  logger.api.request('GET', '/api/directv/scan-channels', { deviceId, mode, start, end })

  try {
    // Load DirecTV devices
    const devices = await loadDirecTVDevices()
    const device = devices.find(d => d.id === deviceId)

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'DirecTV device not found' },
        { status: 404 }
      )
    }

    const port = device.port || 8080
    const presets = await getExistingPresets()
    const results: ChannelScanResult[] = []

    let channelList: number[] = []

    // Determine which channels to scan
    if (mode === 'range') {
      if (!start || !end) {
        return NextResponse.json(
          { success: false, error: 'Start and end channel required for range mode' },
          { status: 400 }
        )
      }
      if (start > end) {
        return NextResponse.json(
          { success: false, error: 'Start channel must be less than or equal to end channel' },
          { status: 400 }
        )
      }
      // Limit range to prevent overwhelming requests
      if (end - start > 100) {
        return NextResponse.json(
          { success: false, error: 'Channel range too large. Maximum 100 channels per scan.' },
          { status: 400 }
        )
      }
      channelList = Array.from({ length: end - start + 1 }, (_, i) => start + i)
    } else if (mode === 'list' && channels) {
      const channelStrings = channels.split(',').map(ch => ch.trim())
      channelList = channelStrings
        .map(ch => parseInt(ch, 10))
        .filter(ch => !isNaN(ch) && ch >= 1 && ch <= 9999)

      if (channelList.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No valid channels provided' },
          { status: 400 }
        )
      }

      // Limit to 50 channels for specific list
      if (channelList.length > 50) {
        return NextResponse.json(
          { success: false, error: 'Too many channels. Maximum 50 channels per scan.' },
          { status: 400 }
        )
      }
    } else if (mode === 'sports') {
      // Common sports channel ranges
      channelList = [
        // ESPN Family
        206, 207, 208, 209,
        // NFL
        212, 213,
        // NBA, MLB, NHL
        215, 217, 219,
        // Fox Sports
        220, 221,
        // CBS Sports, Big Ten, SEC
        618, 614, 607, 608, 613,
        // TNT, TBS
        611, 620,
        // beIN Sports
        623, 624,
        // Regional sports (common ranges)
        ...Array.from({ length: 11 }, (_, i) => 640 + i), // 640-650
      ]
    }

    // Scan each channel
    for (const major of channelList) {
      const progInfo = await getProgInfo(device.ipAddress, port, major)

      // Skip off-air channels
      if (progInfo.isOffAir || !progInfo.success) {
        continue
      }

      const channelNumber = String(major)
      const hasPreset = presets.has(channelNumber.toLowerCase())
      const presetName = presets.get(channelNumber.toLowerCase()) || null

      results.push({
        channelNumber,
        callsign: progInfo.callsign,
        title: progInfo.title,
        isOffAir: false,
        hasPreset,
        presetName
      })

      // Small delay to avoid overwhelming the device
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    logger.api.response('GET', '/api/directv/scan-channels', 200, {
      scanned: channelList.length,
      found: results.length
    })

    return NextResponse.json({
      success: true,
      channels: results,
      scannedCount: channelList.length,
      foundCount: results.length
    })
  } catch (error) {
    logger.api.error('GET', '/api/directv/scan-channels', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to scan channels',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
