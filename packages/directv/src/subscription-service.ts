/**
 * DirecTV Subscription Service
 *
 * Polls DirecTV receivers for device information and connection status.
 * Note: DirecTV SHEF API does not provide actual subscription/package data.
 * This would require integration with DirecTV's cloud services.
 */

import {
  direcTVLogger,
  DirecTVOperation,
  LogLevel,
  withTiming
} from './directv-logger'
import { logger } from '@sports-bar/logger'

export interface Subscription {
  id: string
  name: string
  type: 'streaming' | 'premium' | 'sports' | 'addon'
  status: 'active' | 'inactive' | 'expired'
  provider?: string
  packageName?: string
  subscriptionDate?: string
  expirationDate?: string
  cost?: number
  description?: string
  logoUrl?: string
}

export interface DirecTVDeviceInfo {
  id: string
  name: string
  ipAddress: string
  port: number
  receiverType?: string
}

/**
 * Poll real DirecTV subscriptions via HTTP API
 */
export async function pollRealDirecTVSubscriptions(
  device: DirecTVDeviceInfo
): Promise<Subscription[]> {
  const subscriptions: Subscription[] = []
  const deviceId = device.id || 'unknown'
  const deviceName = device.name || 'Unknown Device'
  const ipAddress = device.ipAddress
  const port = device.port || 8080

  // Log start of subscription polling
  await direcTVLogger.log({
    level: LogLevel.INFO,
    operation: DirecTVOperation.SUBSCRIPTION_POLL,
    deviceId,
    deviceName,
    ipAddress,
    port,
    message: `Starting subscription poll for ${deviceName}`,
    details: {
      deviceType: device.receiverType || 'Unknown',
      deviceInfo: {
        id: deviceId,
        name: deviceName,
        ip: ipAddress,
        port
      }
    }
  })

  try {
    // Step 1: Test basic connectivity with getVersion endpoint
    await direcTVLogger.log({
      level: LogLevel.DEBUG,
      operation: DirecTVOperation.DEVICE_INFO_QUERY,
      deviceId,
      deviceName,
      ipAddress,
      port,
      message: 'Attempting to query device version information'
    })

    const versionUrl = `http://${ipAddress}:${port}/info/getVersion`
    const { result: versionResponse, duration: versionDuration } = await withTiming(async () => {
      return await fetch(versionUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      })
    })

    await direcTVLogger.logApiRequest(
      DirecTVOperation.DEVICE_INFO_QUERY,
      deviceName,
      ipAddress,
      port,
      versionUrl,
      'GET',
      versionResponse.ok,
      versionResponse.status,
      versionResponse.ok ? await versionResponse.clone().text() : undefined,
      versionDuration
    )

    if (!versionResponse.ok) {
      const errorMessage = `DirecTV receiver returned HTTP ${versionResponse.status}: ${versionResponse.statusText}`
      await direcTVLogger.log({
        level: LogLevel.ERROR,
        operation: DirecTVOperation.DEVICE_INFO_QUERY,
        deviceId,
        deviceName,
        ipAddress,
        port,
        message: errorMessage,
        response: {
          status: versionResponse.status,
          statusText: versionResponse.statusText
        }
      })
      throw new Error(errorMessage)
    }

    await direcTVLogger.log({
      level: LogLevel.INFO,
      operation: DirecTVOperation.DEVICE_INFO_QUERY,
      deviceId,
      deviceName,
      ipAddress,
      port,
      message: `Device version query successful (${versionDuration}ms)`
    })

    // Step 2: Get device information and current channel
    // NOTE: DirecTV SHEF API does NOT provide subscription/package information
    // The API only provides device control and status information
    await direcTVLogger.log({
      level: LogLevel.INFO,
      operation: DirecTVOperation.DEVICE_INFO_QUERY,
      deviceId,
      deviceName,
      ipAddress,
      port,
      message: 'Querying device information and current channel'
    })

    const versionData = await versionResponse.json() as any

    // Get currently tuned channel
    let currentChannel = 'Unknown'
    let currentProgram = 'Unknown'
    try {
      const tunedUrl = `http://${ipAddress}:${port}/tv/getTuned`
      const { result: tunedResponse, duration: tunedDuration } = await withTiming(async () => {
        return await fetch(tunedUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000)
        })
      })

      if (tunedResponse.ok) {
        const tunedData = await tunedResponse.json() as any
        currentChannel = `${tunedData.major}${tunedData.minor !== 65535 ? `-${tunedData.minor}` : ''}`
        currentProgram = tunedData.title || 'Unknown'

        await direcTVLogger.log({
          level: LogLevel.DEBUG,
          operation: DirecTVOperation.DEVICE_INFO_QUERY,
          deviceId,
          deviceName,
          ipAddress,
          port,
          message: `Currently tuned to channel ${currentChannel}: ${currentProgram}`,
          details: {
            channel: currentChannel,
            program: currentProgram,
            callsign: tunedData.callsign,
            duration: tunedDuration
          }
        })
      }
    } catch (tunedError) {
      await direcTVLogger.log({
        level: LogLevel.WARNING,
        operation: DirecTVOperation.DEVICE_INFO_QUERY,
        deviceId,
        deviceName,
        ipAddress,
        port,
        message: 'Could not retrieve current channel information',
        error: tunedError instanceof Error ? {
          name: tunedError.name,
          message: tunedError.message
        } : undefined
      })
    }

    // Create a single "Device Connected" status entry with device information
    // NOTE: Actual subscription data is NOT available via the DirecTV receiver's HTTP API
    // This would require integration with DirecTV's cloud services or business API
    await direcTVLogger.log({
      level: LogLevel.INFO,
      operation: DirecTVOperation.DEVICE_INFO_QUERY,
      deviceId,
      deviceName,
      ipAddress,
      port,
      message: 'Device successfully connected. Note: Subscription data not available via local API',
      details: {
        limitation: 'DirecTV SHEF API does not expose subscription/package information',
        availableInfo: {
          receiverId: versionData.receiverId,
          accessCardId: versionData.accessCardId,
          softwareVersion: versionData.stbSoftwareVersion,
          apiVersion: versionData.version,
          currentChannel,
          currentProgram
        }
      }
    })

    subscriptions.push({
      id: 'directv-connected',
      name: 'DirecTV Receiver Connected',
      type: 'premium',
      status: 'active',
      provider: 'DIRECTV',
      description: `Receiver ID: ${versionData.receiverId || 'Unknown'} | Card: ${versionData.accessCardId || 'Unknown'} | Channel: ${currentChannel} | ${currentProgram}`,
      packageName: `Software v${versionData.stbSoftwareVersion || 'Unknown'} | API v${versionData.version || 'Unknown'}`
    })

    // Log successful completion
    await direcTVLogger.logSubscriptionPoll(
      deviceId,
      deviceName,
      ipAddress,
      port,
      true,
      subscriptions.length,
      {
        subscriptions: subscriptions.map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          status: s.status
        }))
      }
    )

  } catch (error) {
    // Comprehensive error logging
    await direcTVLogger.logSubscriptionPoll(
      deviceId,
      deviceName,
      ipAddress,
      port,
      false,
      0,
      {
        attemptedEndpoints: [
          `http://${ipAddress}:${port}/info/getVersion`,
          `http://${ipAddress}:${port}/info/getOptions`
        ],
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorCode: (error as any)?.code
      },
      error instanceof Error ? error : new Error(String(error))
    )

    // Log error with full context for debugging
    logger.error(`[DirecTV] Subscription poll failed for ${deviceName} (${ipAddress}:${port})`, {
      error,
      data: {
        deviceId,
        deviceName,
        ipAddress,
        port,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    })
    throw new Error('Unable to connect to DirecTV receiver')
  }

  return subscriptions
}

/**
 * Determine package type from title (helper function)
 */
export function determinePackageType(title: string): 'streaming' | 'premium' | 'sports' | 'addon' {
  const lowerTitle = title.toLowerCase()

  if (lowerTitle.includes('sport') || lowerTitle.includes('nfl') ||
      lowerTitle.includes('nba') || lowerTitle.includes('mlb')) {
    return 'sports'
  }

  if (lowerTitle.includes('premier') || lowerTitle.includes('choice') ||
      lowerTitle.includes('ultimate') || lowerTitle.includes('select')) {
    return 'premium'
  }

  if (lowerTitle.includes('addon') || lowerTitle.includes('add-on')) {
    return 'addon'
  }

  return 'premium'
}
