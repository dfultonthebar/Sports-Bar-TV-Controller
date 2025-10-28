/**
 * Streaming Service Manager
 * 
 * Manages streaming app detection, launching, and integration
 * with Fire TV devices.
 */

import { connectionManager } from './firetv-connection-manager'
import { STREAMING_APPS_DATABASE, StreamingApp, getStreamingAppById } from '@/lib/streaming/streaming-apps-database'

export interface InstalledStreamingApp {
  app: StreamingApp
  isInstalled: boolean
  deviceId: string
  lastChecked: Date
}

export interface StreamingAppLaunchOptions {
  deepLink?: string
  activityName?: string
}

/**
 * Singleton streaming service manager
 */
class StreamingServiceManager {
  private static instance: StreamingServiceManager
  private installedAppsCache: Map<string, InstalledStreamingApp[]> = new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  private constructor() {
    console.log('[STREAMING MANAGER] Initializing Streaming Service Manager')
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): StreamingServiceManager {
    if (!StreamingServiceManager.instance) {
      StreamingServiceManager.instance = new StreamingServiceManager()
    }
    return StreamingServiceManager.instance
  }

  /**
   * Detect installed streaming apps on a Fire TV device
   */
  public async detectInstalledApps(deviceId: string, ipAddress: string, port: number = 5555): Promise<InstalledStreamingApp[]> {
    try {
      console.log(`[STREAMING MANAGER] Detecting installed streaming apps on device ${deviceId}`)

      // Check cache first
      const cached = this.installedAppsCache.get(deviceId)
      if (cached && this.isCacheValid(cached[0]?.lastChecked)) {
        console.log(`[STREAMING MANAGER] Returning cached results for ${deviceId}`)
        return cached
      }

      // Get ADB connection
      const client = await connectionManager.getOrCreateConnection(deviceId, ipAddress, port)

      // Get all installed packages
      const installedPackages = await client.getInstalledPackages()
      console.log(`[STREAMING MANAGER] Device has ${installedPackages.length} total packages installed`)

      // Check which streaming apps are installed
      const installedApps: InstalledStreamingApp[] = []
      const now = new Date()

      for (const app of STREAMING_APPS_DATABASE) {
        const isInstalled = installedPackages.includes(app.packageName)
        
        if (isInstalled) {
          console.log(`[STREAMING MANAGER] ✓ ${app.name} (${app.packageName}) is installed`)
        }

        installedApps.push({
          app,
          isInstalled,
          deviceId,
          lastChecked: now
        })
      }

      const installedCount = installedApps.filter(a => a.isInstalled).length
      console.log(`[STREAMING MANAGER] Found ${installedCount} streaming apps installed on device ${deviceId}`)

      // Cache results
      this.installedAppsCache.set(deviceId, installedApps)

      return installedApps
    } catch (error) {
      console.error(`[STREAMING MANAGER] Error detecting installed apps:`, error)
      throw error
    }
  }

  /**
   * Get installed apps from cache or detect
   */
  public async getInstalledApps(deviceId: string, ipAddress: string, port: number = 5555, forceRefresh: boolean = false): Promise<InstalledStreamingApp[]> {
    if (forceRefresh) {
      this.installedAppsCache.delete(deviceId)
    }

    return this.detectInstalledApps(deviceId, ipAddress, port)
  }

  /**
   * Check if a specific app is installed on a device
   */
  public async isAppInstalled(deviceId: string, ipAddress: string, appId: string, port: number = 5555): Promise<boolean> {
    try {
      const app = getStreamingAppById(appId)
      if (!app) {
        console.error(`[STREAMING MANAGER] App ${appId} not found in database`)
        return false
      }

      const client = await connectionManager.getOrCreateConnection(deviceId, ipAddress, port)
      return await client.isAppInstalled(app.packageName)
    } catch (error) {
      console.error(`[STREAMING MANAGER] Error checking if app is installed:`, error)
      return false
    }
  }

  /**
   * Launch a streaming app on a Fire TV device
   */
  public async launchApp(
    deviceId: string,
    ipAddress: string,
    appId: string,
    options?: StreamingAppLaunchOptions,
    port: number = 5555
  ): Promise<boolean> {
    try {
      const app = getStreamingAppById(appId)
      if (!app) {
        console.error(`[STREAMING MANAGER] App ${appId} not found in database`)
        return false
      }

      console.log(`[STREAMING MANAGER] Launching ${app.name} on device ${deviceId}`)

      // Get ADB connection
      const client = await connectionManager.getOrCreateConnection(deviceId, ipAddress, port)

      // Check if app is installed
      const isInstalled = await client.isAppInstalled(app.packageName)
      if (!isInstalled) {
        console.error(`[STREAMING MANAGER] ${app.name} is not installed on device ${deviceId}`)
        return false
      }

      // Launch app with appropriate method
      if (options?.deepLink && app.deepLinkSupport) {
        console.log(`[STREAMING MANAGER] Launching ${app.name} with deep link: ${options.deepLink}`)
        await client.launchAppWithDeepLink(options.deepLink)
      } else if (options?.activityName) {
        console.log(`[STREAMING MANAGER] Launching ${app.name} with activity: ${options.activityName}`)
        await client.launchAppWithIntent(app.packageName, options.activityName)
      } else {
        console.log(`[STREAMING MANAGER] Launching ${app.name} with default launcher`)
        await client.launchApp(app.packageName)
      }

      console.log(`[STREAMING MANAGER] Successfully launched ${app.name}`)
      return true
    } catch (error) {
      console.error(`[STREAMING MANAGER] Error launching app:`, error)
      return false
    }
  }

  /**
   * Stop a streaming app on a Fire TV device
   */
  public async stopApp(deviceId: string, ipAddress: string, appId: string, port: number = 5555): Promise<boolean> {
    try {
      const app = getStreamingAppById(appId)
      if (!app) {
        console.error(`[STREAMING MANAGER] App ${appId} not found in database`)
        return false
      }

      console.log(`[STREAMING MANAGER] Stopping ${app.name} on device ${deviceId}`)

      const client = await connectionManager.getOrCreateConnection(deviceId, ipAddress, port)
      await client.stopApp(app.packageName)

      console.log(`[STREAMING MANAGER] Successfully stopped ${app.name}`)
      return true
    } catch (error) {
      console.error(`[STREAMING MANAGER] Error stopping app:`, error)
      return false
    }
  }

  /**
   * Get currently running app on a Fire TV device
   */
  public async getCurrentApp(deviceId: string, ipAddress: string, port: number = 5555): Promise<StreamingApp | null> {
    try {
      const client = await connectionManager.getOrCreateConnection(deviceId, ipAddress, port)
      const currentApp = await client.getCurrentApp()

      if (!currentApp) {
        return null
      }

      // Find matching streaming app
      const streamingApp = STREAMING_APPS_DATABASE.find(
        app => app.packageName === currentApp.packageName
      )

      return streamingApp || null
    } catch (error) {
      console.error(`[STREAMING MANAGER] Error getting current app:`, error)
      return null
    }
  }

  /**
   * Clear cache for a device
   */
  public clearCache(deviceId?: string): void {
    if (deviceId) {
      this.installedAppsCache.delete(deviceId)
      console.log(`[STREAMING MANAGER] Cleared cache for device ${deviceId}`)
    } else {
      this.installedAppsCache.clear()
      console.log(`[STREAMING MANAGER] Cleared all cache`)
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(lastChecked: Date): boolean {
    if (!lastChecked) return false
    const now = new Date()
    return (now.getTime() - lastChecked.getTime()) < this.CACHE_TTL
  }

  /**
   * Get all apps in database
   */
  public getAllApps(): StreamingApp[] {
    return [...STREAMING_APPS_DATABASE]
  }

  /**
   * Get apps with public APIs
   */
  public getAppsWithApis(): StreamingApp[] {
    return STREAMING_APPS_DATABASE.filter(app => app.hasPublicApi)
  }

  /**
   * Get sports-specific apps
   */
  public getSportsApps(): StreamingApp[] {
    return STREAMING_APPS_DATABASE.filter(app => app.category === 'sports')
  }
}

// Export singleton instance
export const streamingManager = StreamingServiceManager.getInstance()
