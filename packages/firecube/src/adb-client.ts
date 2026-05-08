
// ADB Client for Fire TV Communication with Keep-Alive Support

import { exec } from 'child_process'
import { promisify } from 'util'

import { logger } from '@sports-bar/logger'
const execAsync = promisify(exec)

export interface ADBConnectionOptions {
  keepAliveInterval?: number // milliseconds
  connectionTimeout?: number // milliseconds
}

export class ADBClient {
  private ipAddress: string
  private port: number
  private deviceAddress: string
  private isConnected: boolean = false
  private keepAliveTimer: NodeJS.Timeout | null = null
  private options: ADBConnectionOptions
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private baseReconnectDelay: number = 1000

  constructor(ipAddress: string, port: number = 5555, options: ADBConnectionOptions = {}) {
    this.ipAddress = ipAddress
    this.port = port
    this.deviceAddress = `${ipAddress}:${port}`
    this.options = {
      keepAliveInterval: options.keepAliveInterval || 30000, // 30 seconds default
      connectionTimeout: options.connectionTimeout || 5000 // 5 seconds default
    }
    
    logger.info(`[ADB CLIENT] Initialized for ${this.deviceAddress}`)
    logger.info(`[ADB CLIENT] Keep-alive interval: ${this.options.keepAliveInterval}ms`)
  }

  async connect(): Promise<boolean> {
    try {
      logger.info(`[ADB CLIENT] Connecting to ${this.deviceAddress}...`)

      const connectCommand = `adb connect ${this.deviceAddress}`
      const { stdout, stderr } = await execAsync(connectCommand, {
        timeout: this.options.connectionTimeout
      })

      logger.info(`[ADB CLIENT] Connect stdout: ${stdout}`)
      if (stderr) logger.info(`[ADB CLIENT] Connect stderr: ${stderr}`)

      if (stdout.includes('connected') || stdout.includes('already connected')) {
        logger.info(`[ADB CLIENT] Connection result: SUCCESS`)
        this.isConnected = true
        this.reconnectAttempts = 0 // Reset reconnect counter on successful connection

        // Start keep-alive mechanism
        this.startKeepAlive()

        return true
      }

      logger.info(`[ADB CLIENT] Connection result: FAILED`)
      this.isConnected = false
      return false
    } catch (error: any) {
      logger.error(`[ADB CLIENT] Connection error:`, error.message)

      // Check if ADB command is not found
      if (error.message && (error.message.includes('adb') &&
          (error.message.includes('not found') ||
           error.message.includes('command not found')))) {
        throw new Error('ADB command-line tool not installed. Please install with: sudo apt-get install adb')
      }

      this.isConnected = false
      throw error
    }
  }

  /**
   * Start periodic keep-alive to maintain connection
   */
  private startKeepAlive(): void {
    // Clear any existing timer
    this.stopKeepAlive()
    
    logger.info(`[ADB CLIENT] Starting keep-alive for ${this.deviceAddress}`)
    
    let consecutiveFailures = 0
    const MAX_FAILURES_BEFORE_RECONNECT = 3
    
    this.keepAliveTimer = setInterval(async () => {
      try {
        // Send a lightweight command to keep connection alive
        await this.executeShellCommand('echo keepalive')
        logger.info(`[ADB CLIENT] Keep-alive ping successful for ${this.deviceAddress}`)

        // Reset failure counter on success
        consecutiveFailures = 0
      } catch (error: any) {
        consecutiveFailures++
        const errorMsg = error?.message || 'Unknown error'
        const stderr = error?.stderr || ''
        const fullError = stderr ? `${errorMsg} - ${stderr}` : errorMsg
        logger.error(`[ADB CLIENT] Keep-alive ping failed for ${this.deviceAddress} (failure ${consecutiveFailures}/${MAX_FAILURES_BEFORE_RECONNECT}): ${fullError}`)

        // Only attempt reconnection after multiple consecutive failures
        if (consecutiveFailures >= MAX_FAILURES_BEFORE_RECONNECT) {
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error(`[ADB CLIENT] Max reconnection attempts (${this.maxReconnectAttempts}) reached for ${this.deviceAddress}`)
            return // Stop trying
          }

          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts)
          this.reconnectAttempts++

          logger.info(`[ADB CLIENT] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

          setTimeout(async () => {
            try {
              await this.connect()
              this.reconnectAttempts = 0 // Reset on success
              consecutiveFailures = 0
              logger.info(`[ADB CLIENT] Reconnection successful for ${this.deviceAddress}`)
            } catch (reconnectError: any) {
              const reconnectErrMsg = reconnectError?.message || 'Unknown error'
              logger.error(`[ADB CLIENT] Reconnection failed for ${this.deviceAddress}: ${reconnectErrMsg}`)
            }
          }, delay)
        }
      }
    }, this.options.keepAliveInterval)
  }

  /**
   * Stop keep-alive mechanism
   */
  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
      logger.info(`[ADB CLIENT] Stopped keep-alive for ${this.deviceAddress}`)
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.stopKeepAlive()

      logger.info(`[ADB CLIENT] Disconnecting from ${this.deviceAddress}...`)

      try {
        const disconnectCommand = `adb disconnect ${this.deviceAddress}`
        const { stdout, stderr } = await execAsync(disconnectCommand, { timeout: 5000 })

        // Log output but don't fail on errors
        if (stdout) logger.info(`[ADB CLIENT] Disconnect stdout: ${stdout.trim()}`)
        if (stderr) logger.info(`[ADB CLIENT] Disconnect stderr: ${stderr.trim()}`)

      } catch (disconnectError: any) {
        // Don't throw on disconnect errors - device might already be disconnected
        logger.info(`[ADB CLIENT] Disconnect command failed (device may already be disconnected): ${disconnectError.message}`)
      }

      // Always mark as disconnected regardless of command result
      this.isConnected = false
      logger.info(`[ADB CLIENT] Disconnected from ${this.deviceAddress}`)

    } catch (error) {
      logger.error(`[ADB CLIENT] Disconnect error:`, error)
      // Still mark as disconnected even if there's an error
      this.isConnected = false
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      logger.info(`[ADB CLIENT] Testing connection to ${this.deviceAddress}...`)
      
      // First, try to connect if not already connected
      if (!this.isConnected) {
        await this.connect()
      }
      
      // Test by getting device properties
      const result = await this.getDeviceProperty('ro.product.model')
      logger.info(`[ADB CLIENT] Test connection result: ${result ? 'SUCCESS' : 'FAILED'}`)
      
      return !!result
    } catch (error) {
      logger.error(`[ADB CLIENT] Test connection error:`, error)
      this.isConnected = false
      return false
    }
  }

  async getDeviceInfo(): Promise<{
    model?: string
    serialNumber?: string
    softwareVersion?: string
  }> {
    try {
      const model = await this.getDeviceProperty('ro.product.model')
      const serialNumber = await this.getDeviceProperty('ro.serialno')
      const softwareVersion = await this.getDeviceProperty('ro.build.version.release')
      
      return {
        model: model || undefined,
        serialNumber: serialNumber || undefined,
        softwareVersion: softwareVersion || undefined
      }
    } catch (error) {
      logger.error(`[ADB CLIENT] Get device info error:`, error)
      return {}
    }
  }

  async getDeviceProperty(property: string, timeoutMs: number = 3000): Promise<string | null> {
    try {
      const command = `adb -s ${this.deviceAddress} shell getprop ${property}`
      const { stdout } = await execAsync(command, { timeout: timeoutMs })
      return stdout.trim() || null
    } catch (error) {
      logger.error(`[ADB CLIENT] Get property error:`, error)
      return null
    }
  }

  async executeShellCommand(command: string, timeoutMs: number = 3000): Promise<string> {
    try {
      // Use -T flag (no TTY allocation) for faster execution - 2x speed improvement
      const adbCommand = `adb -s ${this.deviceAddress} shell -T "${command}"`
      const { stdout } = await execAsync(adbCommand, { timeout: timeoutMs })
      return stdout.trim()
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error'
      const stderr = error.stderr || ''
      const fullError = stderr ? `${errorMsg} - ${stderr}` : errorMsg
      logger.error(`[ADB CLIENT] Execute command error for ${this.deviceAddress}:`, fullError)
      throw error
    }
  }

  async sendKey(keyCode: number, timeoutMs?: number): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Sending key ${keyCode} to ${this.deviceAddress}`)
      return await this.executeShellCommand(`input keyevent ${keyCode}`, timeoutMs)
    } catch (error) {
      logger.error(`[ADB CLIENT] Send key error:`, error)
      throw error
    }
  }

  async getInstalledPackages(): Promise<string[]> {
    try {
      logger.info(`[ADB CLIENT] Getting installed packages from ${this.deviceAddress}`)
      const output = await this.executeShellCommand('pm list packages')
      const packages = output
        .split('\n')
        .filter(line => line.startsWith('package:'))
        .map(line => line.replace('package:', '').trim())
      
      logger.info(`[ADB CLIENT] Found ${packages.length} installed packages`)
      return packages
    } catch (error) {
      logger.error(`[ADB CLIENT] Get installed packages error:`, error)
      throw error
    }
  }

  async isAppInstalled(packageName: string): Promise<boolean> {
    try {
      logger.info(`[ADB CLIENT] Checking if ${packageName} is installed on ${this.deviceAddress}`)
      const packages = await this.getInstalledPackages()
      const isInstalled = packages.includes(packageName)
      logger.info(`[ADB CLIENT] ${packageName} is ${isInstalled ? 'INSTALLED' : 'NOT INSTALLED'}`)
      return isInstalled
    } catch (error) {
      logger.error(`[ADB CLIENT] Check app installed error:`, error)
      return false
    }
  }

  async getCurrentApp(): Promise<{ packageName: string; activityName: string } | null> {
    try {
      logger.info(`[ADB CLIENT] Getting current app on ${this.deviceAddress}`)
      const output = await this.executeShellCommand('dumpsys window windows | grep -E "mCurrentFocus"')
      
      // Parse output like: mCurrentFocus=Window{abc123 u0 com.amazon.tv.launcher/com.amazon.tv.launcher.ui.HomeActivity}
      const match = output.match(/([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/)
      
      if (match) {
        return {
          packageName: match[1],
          activityName: match[2]
        }
      }
      
      return null
    } catch (error) {
      logger.error(`[ADB CLIENT] Get current app error:`, error)
      return null
    }
  }

  async launchApp(packageName: string): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Launching app ${packageName} on ${this.deviceAddress}`)
      // Resolve launcher activity then start it - more reliable than monkey on Fire TV
      const activityLine = await this.executeShellCommand(
        `cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER ${packageName} 2>/dev/null | tail -1`
      )
      const activity = activityLine.trim()
      if (activity && activity.includes('/')) {
        return await this.executeShellCommand(`am start -n ${activity}`)
      }
      // Fallback: try monkey command
      logger.warn(`[ADB CLIENT] Could not resolve activity for ${packageName}, trying monkey`)
      return await this.executeShellCommand(`monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`)
    } catch (error) {
      logger.error(`[ADB CLIENT] Launch app error:`, error)
      throw error
    }
  }

  async launchAppWithIntent(packageName: string, activityName?: string): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Launching app with intent: ${packageName}${activityName ? '/' + activityName : ''} on ${this.deviceAddress}`)
      
      if (activityName) {
        // Launch specific activity
        return await this.executeShellCommand(`am start -n ${packageName}/${activityName}`)
      } else {
        // Launch main launcher activity
        return await this.executeShellCommand(`am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER ${packageName}`)
      }
    } catch (error) {
      logger.error(`[ADB CLIENT] Launch app with intent error:`, error)
      throw error
    }
  }

  async launchAppWithDeepLink(deepLink: string, packageName?: string): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Launching app with deep link: ${deepLink}${packageName ? ` (pkg=${packageName})` : ''} on ${this.deviceAddress}`)
      // v2.32.84 — single-quote the URL to protect characters like `&` (query
      // separators) from the outer shell wrapper that `executeShellCommand`
      // applies. With double quotes inside double quotes, a URL like
      // `https://x?a=1&b=2` would have the outer shell terminate at the `&`
      // and produce a partial command.
      // The optional `-p ${packageName}` flag forces intent resolution to the
      // given package, bypassing Android's ResolverActivity when multiple
      // apps register for the same scheme (Prime Video + Silk Browser both
      // own https://watch.amazon.com/* — without -p, the resolver dialog
      // pops on the TV instead of opening Prime Video directly).
      // Escape any literal `'` in the URL using the standard `'\''` pattern
      // — without this a deep-link containing a single quote (e.g.
      // `phrase=O%27Brien` decoded callers, or older app schemes that allow
      // raw apostrophes) would terminate the single-quoted span early and
      // break the shell command.
      const pkgFlag = packageName ? `-p ${packageName} ` : ''
      const escaped = deepLink.replace(/'/g, "'\\''")
      return await this.executeShellCommand(`am start ${pkgFlag}-a android.intent.action.VIEW -d '${escaped}'`)
    } catch (error) {
      logger.error(`[ADB CLIENT] Launch app with deep link error:`, error)
      throw error
    }
  }

  /**
   * Prime Video direct-to-playback sequence (v2.32.84).
   *
   * Verified live on Cube 3 (AFTR, Fire OS 9, PVFTV-215.5374N) on 2026-05-08:
   * lands on `com.amazon.firebatcore.playback.inappplayback.PlaybackActivity`
   * with MediaSession state=3 (PLAYING).
   *
   * Sequence:
   *   1. Search deep-link  →  SearchResultsActivity (≈3s to render)
   *   2. Wait 5s for results
   *   3. DPAD_DOWN — focus moves from search bar to first result tile
   *   4. DPAD_CENTER — opens detail page (≈3s)
   *   5. Wait 3s for detail page
   *   6. DPAD_CENTER on the auto-focused "Watch now" / "Watch live" button
   *      → PlaybackActivity
   *
   * Pattern mirrors `launchParamountLiveTV` (deep link + nav-event sequence).
   * Caller should allow ~5 additional seconds after this returns for actual
   * playback to begin and the stream to buffer.
   */
  async launchPrimeVideoToContent(
    contentTitle: string,
    packageName: string = 'com.amazon.firebat',
  ): Promise<string> {
    try {
      // Without an actual title, the search URL becomes `phrase=` which
      // Prime Video treats as "show me everything" — the autoplay sequence
      // would then click whatever arbitrary tile happens to be first
      // (catch-up shows, promotional content). Refuse rather than launch
      // something unrelated to the bartender's intent.
      if (!contentTitle.trim()) {
        throw new Error('contentTitle is required for Prime Video autoplay sequence')
      }

      logger.info(`[ADB CLIENT] Launching Prime Video to "${contentTitle}" on ${this.deviceAddress}`)

      const searchUrl = `https://watch.amazon.com/search?phrase=${encodeURIComponent(contentTitle)}`
      await this.launchAppWithDeepLink(searchUrl, packageName)

      logger.info(`[ADB CLIENT] Waiting 5s for Prime Video search results to render`)
      await new Promise((r) => setTimeout(r, 5000))

      // v2.32.91 — pass timeoutMs=8000 to each keyevent in the autoplay
      // sequence. The default 3s timeout in executeShellCommand can fire
      // mid-sequence when the Cube is still loading SearchResultsActivity
      // or DetailActivity (both can pin the framework momentarily); the
      // input keyevent itself is fast but the wrapped `adb shell -T` may
      // wait for system_server to acknowledge. 3s timeout reproduced live
      // on Cube 3 today: DPAD_DOWN to SearchResultsActivity timed out at
      // 3000ms, autoplay aborted, /api/streaming/launch returned
      // success:false, bartender saw "Failed to launch". 8s gives generous
      // headroom without delaying real failures.
      logger.info(`[ADB CLIENT] DPAD_DOWN → focus first result`)
      await this.sendKey(20, 8000) // KEYCODE_DPAD_DOWN

      // Tiny pause so the focus animation completes before CENTER is honored.
      await new Promise((r) => setTimeout(r, 400))

      logger.info(`[ADB CLIENT] DPAD_CENTER → open detail page`)
      await this.sendKey(23, 8000) // KEYCODE_DPAD_CENTER

      logger.info(`[ADB CLIENT] Waiting 3s for detail page`)
      await new Promise((r) => setTimeout(r, 3000))

      logger.info(`[ADB CLIENT] DPAD_CENTER → trigger Watch now`)
      await this.sendKey(23, 8000) // KEYCODE_DPAD_CENTER

      logger.info(`[ADB CLIENT] Prime Video autoplay sequence dispatched`)
      return 'Prime Video autoplay sequence dispatched'
    } catch (error) {
      logger.error(`[ADB CLIENT] Prime Video autoplay error:`, error)
      throw error
    }
  }

  /**
   * ESPN direct-to-playback sequence (v2.32.85).
   *
   * Verified live on Cube 3 (AFTR, com.espn.gtv) on 2026-05-08: lands on
   * `com.espn.video.dmp.PlayerActivity` after just two key events.
   *
   * Sequence:
   *   1. Deep-link to ESPN's home tab (`sportscenter://x-callback-url/showHomeTab`)
   *      — verified scheme; the older catalog format `espn://...` is not
   *      registered with this APK and would silently fail.
   *   2. Wait 8s (ESPN's content cards finish rendering ~7s after launch
   *      per APP_WALK_RULES['ESPN'].postLaunchDelayMs)
   *   3. DPAD_DOWN — focus moves from the hero "Explore" banner to the
   *      first tile in the first content row (which on the live-sports
   *      landing is the most prominent currently-airing game/feed)
   *   4. DPAD_CENTER — opens the focused tile directly into PlayerActivity
   *
   * Limitation: this picks ESPN's curated "first live tile", not a
   * specific event matching `contentTitle`. Bartender remote shows live
   * ESPN games and ESPN curates the same set to the top of its UI, so
   * the most-prominent tile is usually what the operator wanted. Truly
   * event-specific deep links would require an ESPN event-ID resolver
   * (call ESPN scoreboard API at click time using contentTitle + start
   * time) — TODO for a future version.
   */
  async launchEspnToLiveContent(
    contentTitle?: string,
    packageName: string = 'com.espn.gtv',
  ): Promise<string> {
    try {
      logger.info(
        `[ADB CLIENT] Launching ESPN to live content${contentTitle ? ` (target: "${contentTitle}")` : ''} on ${this.deviceAddress}`,
      )

      // v2.32.85 — IMPORTANT: launch via the standard LEANBACK_LAUNCHER
      // entry point, NOT via the `sportscenter://x-callback-url/showHomeTab`
      // deep link. Verified live on Cube 3 on 2026-05-08: deeplink-launch
      // takes ESPN to a different focus state than launcher-launch — DOWN
      // from the launcher path lands on the first live content tile (e.g.
      // "Main Feed • BetCast • PGA TOUR Live"), but DOWN from the deeplink
      // path lands on a tile-carousel slot whose CENTER doesn't reliably
      // navigate to PlayerActivity. The deepLink in the catalog serves as
      // the "yes this app supports deep linking" flag for the streaming-
      // service-manager routing decision; the actual ADB launch goes
      // through `launchApp` here.
      await this.launchApp(packageName)

      logger.info(`[ADB CLIENT] Waiting 8s for ESPN content rows to render`)
      await new Promise((r) => setTimeout(r, 8000))

      // v2.32.91 — same 8s sendKey timeout as Prime Video (see comment in
      // launchPrimeVideoToContent). ESPN's home tab also pins the framework
      // momentarily during content-row hydration.
      logger.info(`[ADB CLIENT] DPAD_DOWN → focus first content tile`)
      await this.sendKey(20, 8000) // KEYCODE_DPAD_DOWN

      // Brief pause for the focus animation, matching the Prime Video flow.
      await new Promise((r) => setTimeout(r, 400))

      logger.info(`[ADB CLIENT] DPAD_CENTER → open tile (PlayerActivity)`)
      await this.sendKey(23, 8000) // KEYCODE_DPAD_CENTER

      logger.info(`[ADB CLIENT] ESPN autoplay sequence dispatched`)
      return 'ESPN autoplay sequence dispatched'
    } catch (error) {
      logger.error(`[ADB CLIENT] ESPN autoplay error:`, error)
      throw error
    }
  }

  /**
   * Launch Paramount+ Live TV with automated profile selection.
   *
   * Sequence:
   * 1. Deep link to Paramount+ live TV activity
   * 2. Wait for profile picker to appear (~5 seconds)
   * 3. Send DPAD_CENTER to auto-select the first profile
   *
   * The caller should allow ~8 additional seconds after this method
   * returns for the live TV stream to begin playing.
   */
  async launchParamountLiveTV(): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Launching Paramount+ Live TV on ${this.deviceAddress}`)

      // Step 1: Launch Paramount+ with live-tv deep link
      const launchResult = await this.executeShellCommand(
        'am start -a android.intent.action.VIEW ' +
        '-n "com.cbs.ott/com.paramount.android.pplus.features.splash.tv.SplashMediatorActivity" ' +
        '-d "https://www.paramountplus.com/live-tv/"'
      )
      logger.info(`[ADB CLIENT] Paramount+ launch result: ${launchResult}`)

      // Step 2: Wait for profile picker to appear
      logger.info(`[ADB CLIENT] Waiting 5s for Paramount+ profile picker on ${this.deviceAddress}`)
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Step 3: Send DPAD_CENTER to select the first profile
      // v2.32.92 — 8s sendKey timeout matches Prime Video / ESPN autoplay
      // (v2.32.91). Paramount+ SplashMediatorActivity can pin system_server
      // momentarily while loading the profile list; the default 3s timeout
      // would abort here under load. Same root-cause class as v2.32.91.
      logger.info(`[ADB CLIENT] Sending DPAD_CENTER to select profile on ${this.deviceAddress}`)
      await this.sendKey(23, 8000) // KEYCODE_DPAD_CENTER

      logger.info(`[ADB CLIENT] Paramount+ Live TV launch sequence completed on ${this.deviceAddress}`)
      return 'Paramount+ Live TV launch sequence completed'
    } catch (error) {
      logger.error(`[ADB CLIENT] Paramount+ Live TV launch error:`, error)
      throw error
    }
  }

  async stopApp(packageName: string): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Stopping app ${packageName} on ${this.deviceAddress}`)
      return await this.executeShellCommand(`am force-stop ${packageName}`)
    } catch (error) {
      logger.error(`[ADB CLIENT] Stop app error:`, error)
      throw error
    }
  }

  async wakeDevice(): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Waking device ${this.deviceAddress}`)
      // Send power button if screen is off
      await this.sendKey(26) // KEYCODE_POWER
      // Wait a moment then send home to ensure device is awake
      await new Promise(resolve => setTimeout(resolve, 500))
      await this.sendKey(3) // KEYCODE_HOME
      return 'Device woken'
    } catch (error) {
      logger.error(`[ADB CLIENT] Wake device error:`, error)
      throw error
    }
  }

  async keepAwake(enabled: boolean): Promise<string> {
    try {
      logger.info(`[ADB CLIENT] Setting stay awake to ${enabled} on ${this.deviceAddress}`)
      const value = enabled ? '1' : '0'
      return await this.executeShellCommand(`settings put global stay_on_while_plugged_in ${value}`)
    } catch (error) {
      logger.error(`[ADB CLIENT] Keep awake error:`, error)
      throw error
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected
  }

  /**
   * Cleanup method to be called when done with the client
   */
  cleanup(): void {
    this.stopKeepAlive()
  }
}
