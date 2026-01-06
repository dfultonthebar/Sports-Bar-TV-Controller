
/**
 * Real Device Subscription Detection
 * Replaces mock data with actual device polling
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { direcTVLogger, DirecTVOperation, LogLevel, withTiming } from './directv-logger'

import { logger } from '@/lib/logger'
const execAsync = promisify(exec)

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

/**
 * Poll real DirecTV subscriptions via HTTP API
 */
export async function pollRealDirecTVSubscriptions(device: any): Promise<Subscription[]> {
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

    const versionData = await versionResponse.json()
    
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
        const tunedData = await tunedResponse.json()
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

    logger.error('DirecTV subscription poll error:', error)
    throw new Error('Unable to connect to DirecTV receiver')
  }

  return subscriptions
}

/**
 * Poll real Fire TV subscriptions via ADB
 */
export async function pollRealFireTVSubscriptions(device: any): Promise<Subscription[]> {
  const subscriptions: Subscription[] = []

  try {
    // Connect to Fire TV via ADB
    await execAsync(`adb connect ${device.ipAddress}:5555`)

    // Get list of installed packages
    const { stdout } = await execAsync('adb shell pm list packages')
    const packages = stdout.split('\n').filter(line => line.startsWith('package:'))

    // Known streaming app package names
    const streamingApps = {
      'com.amazon.avod.thirdpartyclient': {
        name: 'Amazon Prime Video',
        type: 'streaming',
        provider: 'Amazon'
      },
      'com.netflix.ninja': {
        name: 'Netflix',
        type: 'streaming',
        provider: 'Netflix'
      },
      'com.hulu.plus': {
        name: 'Hulu',
        type: 'streaming',
        provider: 'Hulu'
      },
      'com.espn.score_center': {
        name: 'ESPN',
        type: 'sports',
        provider: 'Disney'
      },
      'com.cbs.app': {
        name: 'Paramount+',
        type: 'streaming',
        provider: 'Paramount'
      },
      'com.disney.disneyplus': {
        name: 'Disney+',
        type: 'streaming',
        provider: 'Disney'
      },
      'com.google.android.youtube.tv': {
        name: 'YouTube TV',
        type: 'streaming',
        provider: 'Google'
      },
      'com.apple.atve.androidtv.appletv': {
        name: 'Apple TV+',
        type: 'streaming',
        provider: 'Apple'
      },
      'com.hbo.hbonow': {
        name: 'Max (HBO)',
        type: 'streaming',
        provider: 'Warner Bros'
      },
      'com.nbcuni.nbc.liveextra': {
        name: 'NBC Sports',
        type: 'sports',
        provider: 'NBC'
      },
      'com.foxsports.mobile': {
        name: 'Fox Sports',
        type: 'sports',
        provider: 'Fox'
      }
    }

    // Check which streaming apps are installed
    for (const packageLine of packages) {
      const packageName = packageLine.replace('package:', '').trim()
      
      if (streamingApps[packageName as keyof typeof streamingApps]) {
        const app = streamingApps[packageName as keyof typeof streamingApps]
        
        subscriptions.push({
          id: `firetv-${packageName}`,
          name: app.name,
          type: app.type as 'streaming' | 'sports',
          status: 'active',
          provider: app.provider,
          packageName: packageName,
          description: `Installed on ${device.name}`
        })
      }
    }

    // Disconnect ADB
    await execAsync(`adb disconnect ${device.ipAddress}:5555`)

  } catch (error) {
    logger.error('Fire TV subscription poll error:', error)
    throw new Error('Unable to connect to Fire TV device via ADB')
  }

  return subscriptions
}

/**
 * Determine package type from title
 */
function determinePackageType(title: string): 'streaming' | 'premium' | 'sports' | 'addon' {
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
