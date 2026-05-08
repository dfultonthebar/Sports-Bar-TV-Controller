/**
 * Streaming Service Manager
 * 
 * Manages streaming app detection, launching, and integration
 * with Fire TV devices.
 */

import { connectionManager } from './firetv-connection-manager'
import { STREAMING_APPS_DATABASE, StreamingApp, getStreamingAppById, findStreamingAppByPackageName } from '@/lib/streaming/streaming-apps-database'

import { logger } from '@sports-bar/logger'
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
    logger.info('[STREAMING MANAGER] Initializing Streaming Service Manager')
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
      logger.info(`[STREAMING MANAGER] Detecting installed streaming apps on device ${deviceId}`)

      // Check cache first
      const cached = this.installedAppsCache.get(deviceId)
      if (cached && this.isCacheValid(cached[0]?.lastChecked)) {
        logger.info(`[STREAMING MANAGER] Returning cached results for ${deviceId}`)
        return cached
      }

      // Get ADB connection
      const client = await connectionManager.getOrCreateConnection(deviceId, ipAddress, port)

      // Get all installed packages
      const installedPackages = await client.getInstalledPackages()
      logger.info(`[STREAMING MANAGER] Device has ${installedPackages.length} total packages installed`)

      // Check which streaming apps are installed
      const installedApps: InstalledStreamingApp[] = []
      const now = new Date()

      for (const app of STREAMING_APPS_DATABASE) {
        const isInstalled = installedPackages.includes(app.packageName)
        
        if (isInstalled) {
          logger.info(`[STREAMING MANAGER] ✓ ${app.name} (${app.packageName}) is installed`)
        }

        installedApps.push({
          app,
          isInstalled,
          deviceId,
          lastChecked: now
        })
      }

      const installedCount = installedApps.filter(a => a.isInstalled).length
      logger.info(`[STREAMING MANAGER] Found ${installedCount} streaming apps installed on device ${deviceId}`)

      // Cache results
      this.installedAppsCache.set(deviceId, installedApps)

      return installedApps
    } catch (error) {
      logger.error(`[STREAMING MANAGER] Error detecting installed apps:`, error)
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
        logger.error(`[STREAMING MANAGER] App ${appId} not found in database`)
        return false
      }

      const client = await connectionManager.getOrCreateConnection(deviceId, ipAddress, port)
      return await client.isAppInstalled(app.packageName)
    } catch (error) {
      logger.error(`[STREAMING MANAGER] Error checking if app is installed:`, error)
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
        logger.error(`[STREAMING MANAGER] App ${appId} not found in database`)
        return false
      }

      logger.info(`[STREAMING MANAGER] Launching ${app.name} on device ${deviceId}`)

      // Get ADB connection
      const client = await connectionManager.getOrCreateConnection(deviceId, ipAddress, port)

      // Find a package variant actually installed on this device. Fire TV Cubes
      // ship Amazon-specific builds (com.apple.atve.amazon.appletv) while
      // generic Android TVs use androidtv builds — different physical devices
      // at the same venue may even have different variants. Try the primary
      // first, then aliases.
      const candidatePackages = [app.packageName, ...(app.packageAliases || [])]
      let installedPackage: string | null = null
      for (const pkg of candidatePackages) {
        if (await client.isAppInstalled(pkg)) {
          installedPackage = pkg
          break
        }
      }
      if (!installedPackage) {
        logger.error(
          `[STREAMING MANAGER] ${app.name} is not installed on device ${deviceId} (tried: ${candidatePackages.join(', ')})`
        )
        return false
      }
      logger.info(`[STREAMING MANAGER] Using package ${installedPackage} for ${app.name}`)

      // Launch app with appropriate method
      if (options?.deepLink && !app.deepLinkSupport) {
        // v2.32.84 — surface a silent-discard footgun: if a caller passes a
        // deepLink for an app whose catalog entry forgot to set
        // deepLinkSupport: true, we'd otherwise fall through to home-screen
        // launch with no explanation and the operator would never know.
        logger.warn(
          `[STREAMING MANAGER] deepLink provided for ${app.name} but deepLinkSupport=false in catalog — falling through to home-screen launch`,
        )
      }

      if (options?.deepLink && app.deepLinkSupport && app.id === 'amazon-prime') {
        // v2.32.84 — Prime Video on AFTR Cubes (com.amazon.firebat) registers
        // for `https://watch.amazon.com/search?phrase=...` but not the older
        // `aiv://` schemes. Instead of just landing on the search page, the
        // 5-DPAD sequence in launchPrimeVideoToContent autoplays the first
        // matching tile (verified to reach PlaybackActivity, MediaSession
        // state=3 PLAYING). The deepLink we receive is the SAME URL but it
        // only carries us to the search page — we extract the query and run
        // the autoplay sequence.
        const phraseMatch = options.deepLink.match(/[?&]phrase=([^&]+)/)
        const phrase = phraseMatch ? decodeURIComponent(phraseMatch[1]) : ''
        if (phrase) {
          logger.info(`[STREAMING MANAGER] Prime Video autoplay sequence for "${phrase}"`)
          await client.launchPrimeVideoToContent(phrase, installedPackage)
        } else {
          // Fallback: land on the search page with no autoplay nav.
          logger.info(`[STREAMING MANAGER] Prime Video deep link (no phrase): ${options.deepLink}`)
          await client.launchAppWithDeepLink(options.deepLink, installedPackage)
        }
      } else if (options?.deepLink && app.deepLinkSupport && app.id === 'espn-plus') {
        // v2.32.94 — Per-tile ESPN search-by-title autoplay. The walker
        // now writes `sportscenter://x-callback-url/showHomeTab?q=<title>`
        // for every captured tile (v2.32.94 walker change). We extract `q`
        // and pass it to launchEspnToLiveContent's search path, which
        // navigates ESPN's in-app search rail and types the title to find
        // the SPECIFIC game the bartender clicked. Pre-fix the autoplay
        // landed on whatever ESPN featured first (e.g. PGA, MLB) — niche
        // games like college softball never reached PlayerActivity.
        // When `q` is missing (older catalog rows from before v2.32.94),
        // fall back to the v2.32.85 blind-DPAD path that picks ESPN's
        // featured tile.
        const espnQMatch = options.deepLink.match(/[?&]q=([^&]+)/)
        const espnQuery = espnQMatch ? decodeURIComponent(espnQMatch[1]) : undefined
        if (espnQuery) {
          logger.info(`[STREAMING MANAGER] ESPN search-by-title autoplay for "${espnQuery}"`)
        } else {
          logger.info(`[STREAMING MANAGER] ESPN autoplay (no title — featured-tile fallback)`)
        }
        // v2.32.98 — BEFORE launching ESPN, fire a Scout PLAY_GAME
        // broadcast. Scout's PlaybackAutomationService (v1.5.0+ APK)
        // sees ESPN's window-state events as soon as it opens and
        // clicks the matching tile in-app via AccessibilityService —
        // far more reliable than the DPAD-and-tap autoplay below for
        // Cubes that have Scout's AS enabled. Cubes without Scout AS
        // ignore the broadcast and the existing autoplay path takes
        // over. Belt-and-suspenders.
        if (espnQuery) {
          await client.sendScoutPlayGameBroadcast(
            installedPackage,
            espnQuery,
            espnQuery, // tokens = title (split + filtered Scout-side)
          )
        }
        await client.launchEspnToLiveContent(espnQuery, installedPackage)
      } else if (options?.deepLink && app.deepLinkSupport) {
        logger.info(`[STREAMING MANAGER] Launching ${app.name} with deep link: ${options.deepLink}`)
        // v2.32.84 — pass the resolved package name so adb-client can include
        // `-p <pkg>` and bypass Android's ResolverActivity when multiple apps
        // claim the same URL scheme.
        await client.launchAppWithDeepLink(options.deepLink, installedPackage)
      } else if (options?.activityName) {
        logger.info(`[STREAMING MANAGER] Launching ${app.name} with activity: ${options.activityName}`)
        await client.launchAppWithIntent(installedPackage, options.activityName)
      } else {
        logger.info(`[STREAMING MANAGER] Launching ${app.name} with default launcher`)
        await client.launchApp(installedPackage)
      }

      logger.info(`[STREAMING MANAGER] Successfully launched ${app.name}`)
      return true
    } catch (error) {
      // v2.32.96 — Re-throw so the caller (typically the
      // /api/streaming/launch route) can surface the error message
      // to the bartender remote. Pre-fix this catch swallowed the
      // exception and returned false, leaving the API to respond
      // with a generic "Failed to launch app" string with no detail.
      // The verification-gate ESPN failure ("ESPN couldn't find
      // 'Southern Miss James Madison'…") was logged but never
      // shown to the operator.
      logger.error(`[STREAMING MANAGER] Error launching app:`, error)
      throw error
    }
  }

  /**
   * Stop a streaming app on a Fire TV device
   */
  public async stopApp(deviceId: string, ipAddress: string, appId: string, port: number = 5555): Promise<boolean> {
    try {
      const app = getStreamingAppById(appId)
      if (!app) {
        logger.error(`[STREAMING MANAGER] App ${appId} not found in database`)
        return false
      }

      logger.info(`[STREAMING MANAGER] Stopping ${app.name} on device ${deviceId}`)

      const client = await connectionManager.getOrCreateConnection(deviceId, ipAddress, port)
      await client.stopApp(app.packageName)

      logger.info(`[STREAMING MANAGER] Successfully stopped ${app.name}`)
      return true
    } catch (error) {
      logger.error(`[STREAMING MANAGER] Error stopping app:`, error)
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

      // v2.32.84 — alias-aware lookup. After moving com.amazon.firebat to
      // primary `packageName` for amazon-prime (and com.amazon.avod to
      // packageAliases), a raw `app.packageName === currentApp.packageName`
      // would silently miss non-AFTR Cubes whose foreground package is
      // com.amazon.avod. The shared helper checks packageName + every
      // packageAliases entry.
      return findStreamingAppByPackageName(currentApp.packageName) || null
    } catch (error) {
      logger.error(`[STREAMING MANAGER] Error getting current app:`, error)
      return null
    }
  }

  /**
   * Clear cache for a device
   */
  public clearCache(deviceId?: string): void {
    if (deviceId) {
      this.installedAppsCache.delete(deviceId)
      logger.info(`[STREAMING MANAGER] Cleared cache for device ${deviceId}`)
    } else {
      this.installedAppsCache.clear()
      logger.info(`[STREAMING MANAGER] Cleared all cache`)
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
