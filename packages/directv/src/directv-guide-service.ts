/**
 * DirecTV Guide Service
 *
 * Fetches program guide data from DirecTV receivers via SHEF API
 * Endpoint: http://{ip}:8080/tv/getProgInfo?major={channel}&minor={minor}
 *
 * Features:
 * - Parallel fetching for multiple channels
 * - Built-in caching to reduce API calls
 * - Timeout and error handling
 * - Integration with channel presets
 */

import { logger } from '@sports-bar/logger'
import { cacheManager } from '@sports-bar/cache-manager'
import fs from 'fs'
import path from 'path'

// DirecTV device data location
const DIRECTV_DEVICES_FILE = path.join(process.cwd(), 'data', 'directv-devices.json')

export interface DirecTVProgramInfo {
  title: string
  callsign: string
  duration: number
  startTime: number
  isOffAir: boolean
  major: number
  minor: number
  status: {
    code: number
    commandResult: number
    msg?: string
  }
}

export interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  receiverType: string
  inputChannel?: number
  isOnline: boolean
}

export interface DirecTVGuideResult {
  success: boolean
  channel: string
  channelName?: string
  programInfo?: DirecTVProgramInfo
  error?: string
  fetchedAt: string
  deviceId: string
  deviceName: string
}

export interface DirecTVGuideOptions {
  deviceId?: string  // If not provided, uses first online device
  channels?: string[]  // Channel numbers to fetch. If not provided, fetches all active presets
  timeout?: number  // Request timeout in milliseconds (default: 5000)
  useCache?: boolean  // Whether to use cached results (default: true)
  cacheTTL?: number  // Cache TTL in milliseconds (default: 30000)
}

/**
 * Load DirecTV devices from data file
 */
function loadDirecTVDevices(): DirecTVDevice[] {
  try {
    const fileContent = fs.readFileSync(DIRECTV_DEVICES_FILE, 'utf-8')
    const data = JSON.parse(fileContent)
    return data.devices || []
  } catch (error) {
    logger.error('[DIRECTV_GUIDE] Failed to load DirecTV devices:', error)
    return []
  }
}

/**
 * Get a specific DirecTV device by ID or the first online device
 */
export function getDirecTVDevice(deviceId?: string): DirecTVDevice | null {
  const devices = loadDirecTVDevices()

  if (deviceId) {
    const device = devices.find(d => d.id === deviceId)
    if (!device) {
      logger.error(`[DIRECTV_GUIDE] Device not found: ${deviceId}`)
      return null
    }
    return device
  }

  // Return first online device
  const onlineDevice = devices.find(d => d.isOnline)
  if (!onlineDevice) {
    logger.error('[DIRECTV_GUIDE] No online DirecTV devices found')
    return null
  }

  return onlineDevice
}

/**
 * Fetch program info for a single channel from DirecTV receiver
 */
export async function fetchChannelProgramInfo(
  device: DirecTVDevice,
  channelNumber: string,
  timeout: number = 5000
): Promise<DirecTVProgramInfo> {
  const { ipAddress, port } = device

  // DirecTV channels can be "206" (major only) or "210-1" (major-minor)
  // The dash format is used for sub-channels like ESPN Plus
  let major: string
  let minor: string | undefined

  if (channelNumber.includes('-')) {
    const parts = channelNumber.split('-')
    major = parts[0]
    minor = parts[1]
  } else if (channelNumber.includes('.')) {
    // Also support dot notation for backwards compatibility
    const parts = channelNumber.split('.')
    major = parts[0]
    minor = parts[1]
  } else {
    major = channelNumber
  }

  // Only include minor parameter if specified (important: don't default to 1!)
  const url = minor !== undefined
    ? `http://${ipAddress}:${port}/tv/getProgInfo?major=${major}&minor=${minor}`
    : `http://${ipAddress}:${port}/tv/getProgInfo?major=${major}`

  logger.debug(`[DIRECTV_GUIDE] Fetching channel ${channelNumber} from ${ipAddress}:${port}`)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Sports-Bar-Controller/1.0',
        'Accept': 'application/json'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json() as DirecTVProgramInfo

    // Validate response structure
    if (!data.status || data.status.code !== 200) {
      throw new Error(`DirecTV API error: ${data.status?.msg || 'Unknown error'}`)
    }

    return data
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`)
      }
      throw error
    }
    throw new Error('Unknown error fetching program info')
  }
}

/**
 * Fetch program info for multiple channels in parallel
 */
export async function fetchMultipleChannelProgramInfo(
  device: DirecTVDevice,
  channels: string[],
  timeout: number = 5000
): Promise<Map<string, DirecTVProgramInfo>> {
  logger.info(`[DIRECTV_GUIDE] Fetching ${channels.length} channels from ${device.name}`)

  const results = new Map<string, DirecTVProgramInfo>()

  // Channels that commonly fail (premium packages, sports tiers, invalid)
  // Log at debug level instead of error to reduce log spam
  const expectedFailureChannels = new Set([
    // Premium sports packages (9500+ range)
    '9519', '9520', '9521', '9522', '9523', '9524', '9525', '9528', '9529', '9549', '9550', '9567',
    // Sports tier channels that may not be subscribed
    '602', '610', '610-1', '612', '205', '242', '245-1', '215-1', '217', '218', '221'
  ])

  // Fetch all channels in parallel
  const promises = channels.map(async (channel) => {
    try {
      const programInfo = await fetchChannelProgramInfo(device, channel, timeout)
      results.set(channel, programInfo)
    } catch (error) {
      // Only log as error if it's an unexpected channel failure
      if (expectedFailureChannels.has(channel)) {
        logger.debug(`[DIRECTV_GUIDE] Channel ${channel} not available (expected)`)
      } else {
        logger.error(`[DIRECTV_GUIDE] Failed to fetch channel ${channel}:`, error)
      }
      // Don't set in results map - will be handled by caller
    }
  })

  await Promise.all(promises)

  return results
}

/**
 * Fetch DirecTV guide data with caching
 */
export async function fetchDirecTVGuide(
  options: DirecTVGuideOptions = {}
): Promise<DirecTVGuideResult[]> {
  const {
    deviceId,
    channels = [],
    timeout = 5000,
    useCache = true,
    cacheTTL = 30000  // 30 seconds default cache
  } = options

  // Get device
  const device = getDirecTVDevice(deviceId)
  if (!device) {
    return [{
      success: false,
      channel: 'N/A',
      error: deviceId
        ? `DirecTV device not found: ${deviceId}`
        : 'No online DirecTV devices available',
      fetchedAt: new Date().toISOString(),
      deviceId: deviceId || 'unknown',
      deviceName: 'Unknown'
    }]
  }

  logger.info(`[DIRECTV_GUIDE] Using device: ${device.name} (${device.ipAddress})`)

  // If no channels specified, would need to load from channel presets
  // For now, require channels to be specified
  if (channels.length === 0) {
    return [{
      success: false,
      channel: 'N/A',
      error: 'No channels specified',
      fetchedAt: new Date().toISOString(),
      deviceId: device.id,
      deviceName: device.name
    }]
  }

  const results: DirecTVGuideResult[] = []
  const channelsToFetch: string[] = []
  const cachedResults = new Map<string, DirecTVProgramInfo>()

  // Check cache first if enabled
  if (useCache) {
    for (const channel of channels) {
      const cacheKey = `directv-guide-${device.id}-${channel}`
      const cached = cacheManager.get('directv-guide', cacheKey)

      if (cached) {
        logger.debug(`[DIRECTV_GUIDE] Cache hit for channel ${channel}`)
        cachedResults.set(channel, cached)
      } else {
        channelsToFetch.push(channel)
      }
    }
  } else {
    channelsToFetch.push(...channels)
  }

  // Fetch uncached channels
  let fetchedResults = new Map<string, DirecTVProgramInfo>()
  if (channelsToFetch.length > 0) {
    logger.info(`[DIRECTV_GUIDE] Fetching ${channelsToFetch.length} uncached channels`)
    fetchedResults = await fetchMultipleChannelProgramInfo(device, channelsToFetch, timeout)

    // Cache the fetched results
    if (useCache) {
      for (const [channel, programInfo] of fetchedResults.entries()) {
        const cacheKey = `directv-guide-${device.id}-${channel}`
        cacheManager.set('directv-guide', cacheKey, programInfo, cacheTTL)
      }
    }
  }

  // Combine cached and fetched results
  const allResults = new Map([...cachedResults, ...fetchedResults])

  // Build response
  for (const channel of channels) {
    const programInfo = allResults.get(channel)

    if (programInfo) {
      results.push({
        success: true,
        channel,
        channelName: programInfo.callsign,
        programInfo,
        fetchedAt: new Date().toISOString(),
        deviceId: device.id,
        deviceName: device.name
      })
    } else {
      results.push({
        success: false,
        channel,
        error: `Failed to fetch program info for channel ${channel}`,
        fetchedAt: new Date().toISOString(),
        deviceId: device.id,
        deviceName: device.name
      })
    }
  }

  logger.info(`[DIRECTV_GUIDE] Completed: ${results.filter(r => r.success).length}/${results.length} successful`)

  return results
}

/**
 * Get all DirecTV devices
 */
export function getAllDirecTVDevices(): DirecTVDevice[] {
  return loadDirecTVDevices()
}
