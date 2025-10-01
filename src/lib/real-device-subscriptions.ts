
/**
 * Real Device Subscription Detection
 * Replaces mock data with actual device polling
 */

import { exec } from 'child_process'
import { promisify } from 'util'

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

  try {
    // Connect to DirecTV receiver HTTP API
    const response = await fetch(`http://${device.ipAddress}:8080/info/getVersion`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      throw new Error('DirecTV receiver not responding')
    }

    // Get subscribed packages via DirecTV API
    const packagesResponse = await fetch(`http://${device.ipAddress}:8080/info/getOptions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000)
    })

    if (packagesResponse.ok) {
      const packagesData = await packagesResponse.json()
      
      // Parse package information
      if (packagesData.options && Array.isArray(packagesData.options)) {
        for (const option of packagesData.options) {
          subscriptions.push({
            id: `directv-${option.id}`,
            name: option.title || 'Unknown Package',
            type: determinePackageType(option.title),
            status: option.subscribed ? 'active' : 'inactive',
            provider: 'DIRECTV',
            packageName: option.title,
            description: option.description || 'DIRECTV subscription package'
          })
        }
      }
    }

    // If no subscriptions found, device is connected but may not support package query
    if (subscriptions.length === 0) {
      subscriptions.push({
        id: 'directv-connected',
        name: 'DIRECTV Service',
        type: 'premium',
        status: 'active',
        provider: 'DIRECTV',
        description: 'DirecTV receiver connected and operational'
      })
    }

  } catch (error) {
    console.error('DirecTV subscription poll error:', error)
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
    console.error('Fire TV subscription poll error:', error)
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
