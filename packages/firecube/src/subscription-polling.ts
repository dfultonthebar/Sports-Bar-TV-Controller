/**
 * Fire TV Subscription Polling
 *
 * Simple ADB-based subscription detection for Fire TV devices.
 * Detects installed streaming apps via ADB package listing.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from '@sports-bar/logger'

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

export interface FireTVDeviceInfo {
  id: string
  name: string
  ipAddress: string
  port?: number
}

/**
 * Poll real Fire TV subscriptions via ADB
 */
export async function pollRealFireTVSubscriptions(
  device: FireTVDeviceInfo
): Promise<Subscription[]> {
  const subscriptions: Subscription[] = []
  const deviceSerial = `${device.ipAddress}:5555`

  try {
    // Connect to Fire TV via ADB
    await execAsync(`adb connect ${deviceSerial}`)

    // Get list of installed packages - IMPORTANT: Use -s flag to target specific device
    const { stdout } = await execAsync(`adb -s ${deviceSerial} shell pm list packages`)
    const packages = stdout.split('\n').filter(line => line.startsWith('package:'))

    // Known streaming app package names
    const streamingApps: Record<string, {
      name: string
      type: 'streaming' | 'sports'
      provider: string
    }> = {
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
      'com.espn.gtv': {
        name: 'ESPN',
        type: 'sports',
        provider: 'Disney'
      },
      'com.playon.nfhslive': {
        name: 'NFHS Network',
        type: 'sports',
        provider: 'NFHS'
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

      if (streamingApps[packageName]) {
        const app = streamingApps[packageName]

        subscriptions.push({
          id: `firetv-${packageName}`,
          name: app.name,
          type: app.type,
          status: 'active',
          provider: app.provider,
          packageName: packageName,
          description: `Installed on ${device.name}`
        })
      }
    }

    // Disconnect ADB from specific device
    await execAsync(`adb disconnect ${deviceSerial}`)

  } catch (error) {
    // Log error with full context for debugging
    logger.error(`[FireTV] Subscription poll failed for ${device.name || 'Unknown'} (${deviceSerial})`, {
      error,
      data: {
        deviceId: device.id || 'unknown',
        deviceName: device.name || 'Unknown',
        deviceSerial,
        ipAddress: device.ipAddress,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    })
    throw new Error('Unable to connect to Fire TV device via ADB')
  }

  return subscriptions
}
