
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

  /**
   * v2.32.98 — Send a PLAY_GAME broadcast to the on-device Scout APK
   * (com.sportsbar.scout v1.5.0+). When Scout's PlaybackAutomationService
   * is enabled, it observes the AccessibilityService event stream, finds
   * a tile whose accessibility content matches the supplied tokens, and
   * performs an in-app click via AccessibilityNodeInfo.performAction.
   * This bypasses the DPAD navigation entirely and is more reliable when
   * Scout is provisioned on the Cube.
   *
   * Fire-and-forget: returns immediately. If Scout isn't installed or its
   * AccessibilityService isn't enabled, the broadcast is consumed but
   * does nothing. The caller should always also fire its existing
   * autoplay path as a fallback for un-provisioned Cubes.
   *
   * @param targetPackage e.g. "com.espn.gtv" or "com.playon.nfhslive"
   * @param contentTitle  Human-readable title for logging (Scout-side)
   * @param matchTokens   Whitespace-separated tokens to match against
   *                      tile accessibility content. Will be lowercased
   *                      and joined with commas before sending.
   * @param maxAttempts   How many onAccessibilityEvent ticks Scout should
   *                      try before giving up. Default 60.
   */
  async sendScoutPlayGameBroadcast(
    targetPackage: string,
    contentTitle: string,
    matchTokens: string,
    maxAttempts: number = 60,
  ): Promise<void> {
    try {
      const escTitle = contentTitle.replace(/'/g, "'\\''").replace(/ /g, '%s')
      const escTokens = matchTokens
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 2)
        .join(',')
      const cmd = [
        'am broadcast',
        '-a com.sportsbar.scout.PLAY_GAME',
        `--es target_package ${targetPackage}`,
        `--es game_title '${escTitle}'`,
        `--es match_tokens '${escTokens}'`,
        `--ei max_attempts ${maxAttempts}`,
        '-n com.sportsbar.scout/.PlayCommandReceiver',
      ].join(' ')
      logger.info(`[ADB CLIENT] Scout PLAY_GAME → ${targetPackage} tokens=${escTokens}`)
      await this.executeShellCommand(cmd, 5000)
    } catch (err: any) {
      // Non-fatal — if Scout isn't on the device, the broadcast still
      // returns successfully (the receiver class doesn't exist, but `am
      // broadcast` doesn't fail loudly). Any actual error is logged but
      // doesn't propagate.
      logger.warn(`[ADB CLIENT] Scout PLAY_GAME broadcast failed (non-fatal): ${err.message}`)
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
   * v2.32.94 — when `contentTitle` is provided, switches to a
   * search-by-title path that types the title into ESPN's in-app
   * search (left-rail Search button, navigated via DPAD_LEFT then
   * DPAD_UP from the launcher position) and clicks the first result.
   * This reliably reaches the SPECIFIC game the bartender clicked
   * (verified live on Cube 3, MediaSession state=3 PLAYING). When
   * `contentTitle` is empty/missing, falls back to the v2.32.85
   * featured-tile path (DPAD_DOWN + CENTER from launcher). Niche
   * games (college softball, regional sports) that ESPN doesn't
   * feature on its home tab now reach playback.
   */
  async launchEspnToLiveContent(
    contentTitle?: string,
    packageName: string = 'com.espn.gtv',
  ): Promise<string> {
    try {
      logger.info(
        `[ADB CLIENT] Launching ESPN${contentTitle ? ` for search-by-title "${contentTitle}"` : ` (featured-tile fallback)`} on ${this.deviceAddress}`,
      )

      // v2.32.97 — Pre-tune cleanup: stop any active media playback
      // before navigating. KEYCODE_MEDIA_STOP (86) signals any
      // foregrounded MediaSession to stop; force-stop ESPN clears
      // any leftover navigation state from a previous Watch click.
      // Both are safe no-ops if nothing's playing or ESPN isn't open.
      logger.info(`[ADB CLIENT] Pre-tune cleanup — MEDIA_STOP + force-stop`)
      await this.sendKey(86, 5000).catch(() => {}) // KEYCODE_MEDIA_STOP
      await this.executeShellCommand(`am force-stop ${packageName}`, 5000).catch(() => {})
      await new Promise((r) => setTimeout(r, 500))

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

      const trimmedTitle = (contentTitle || '').trim()
      if (trimmedTitle) {
        // v2.32.94 — Search-by-title autoplay. Verified end-to-end on
        // Cube 3 (AFTR / com.espn.gtv) — final foreground:
        // com.espn.gtv/com.espn.video.dmp.PlayerActivity, MediaSession
        // state=3 PLAYING.
        //
        // Sequence:
        //   1. DPAD_LEFT — focus moves from first content tile (where
        //      ESPN's home tab leaves it after launch) to the left
        //      navigation rail. Lands on "Home" (rail bounds y=436-484).
        //   2. DPAD_UP — moves up the rail to "Search" (rail bounds
        //      y=356-404, immediately above Home).
        //   3. DPAD_CENTER — opens the search activity (focuses an
        //      EditText).
        //   4. `input text` — Android types the query into the focused
        //      EditText. Spaces must be `%s`-escaped because `adb shell`
        //      tokenizes on whitespace; backslash-escape any single
        //      quotes to safely wrap the whole arg in single quotes.
        //   5. Wait 4s for ESPN's search results to populate.
        //   6. DPAD_DOWN — moves focus from the search EditText down
        //      into the first result tile.
        //   7. DPAD_CENTER — opens the result, lands on PlayerActivity.
        //
        // Per-step `timeoutMs: 8000` matches the v2.32.91 sendKey
        // pattern (framework pins during search-results render).
        logger.info(`[ADB CLIENT] DPAD_LEFT → focus left navigation rail`)
        await this.sendKey(21, 8000) // KEYCODE_DPAD_LEFT
        await new Promise((r) => setTimeout(r, 400))
        logger.info(`[ADB CLIENT] DPAD_UP → focus Search rail item`)
        await this.sendKey(19, 8000) // KEYCODE_DPAD_UP
        await new Promise((r) => setTimeout(r, 400))
        logger.info(`[ADB CLIENT] DPAD_CENTER → open Search activity`)
        await this.sendKey(23, 8000) // KEYCODE_DPAD_CENTER
        await new Promise((r) => setTimeout(r, 3000))
        // `input text` arg: spaces → %s, single-quote → '\''.
        const escaped = trimmedTitle
          .replace(/'/g, "'\\''")
          .replace(/ /g, '%s')
        logger.info(`[ADB CLIENT] input text "${trimmedTitle}" (escaped: ${escaped})`)
        await this.executeShellCommand(`input text '${escaped}'`, 8000)
        logger.info(`[ADB CLIENT] Waiting 4s for ESPN search results to render`)
        await new Promise((r) => setTimeout(r, 4000))

        // v2.32.97 — TEXT-TARGETED TAP replaces blind DPAD_DOWN + verify.
        //
        // Pre-fix v2.32.94/.96 used DPAD_DOWN to "focus first result"
        // and pressed CENTER. v2.32.96 added a verification gate that
        // rejected mismatches but couldn't fix them — when ESPN's UI
        // ended up on the Featured tab instead of Search results, the
        // autoplay aborted entirely.
        //
        // New approach: dump the UI right after the search query
        // typed, scan ALL on-screen tiles for one whose accessibility
        // content matches the intended title, then `input tap <x> <y>`
        // at that tile's bounds center. Targeting by content rather
        // than position handles both the Search-results case AND the
        // Featured-tab case — if ESPN displays a tile matching the
        // query ANYWHERE on screen, we tap it directly.
        //
        // If no matching tile is visible, throw with diagnostic. Only
        // way that can happen now: ESPN search returned no results
        // for the query (truly unfindable game), or ESPN's UI is in a
        // state with no visible content tiles at all.
        const tapTarget = await this._findVisibleTileMatchingTitle(trimmedTitle)
        if (tapTarget) {
          logger.info(
            `[ADB CLIENT] ESPN tile match — tapping "${tapTarget.text}" at (${tapTarget.cx}, ${tapTarget.cy})`,
          )
          await this.executeShellCommand(`input tap ${tapTarget.cx} ${tapTarget.cy}`, 8000)
          logger.info(`[ADB CLIENT] ESPN text-targeted tap dispatched`)
          return `ESPN text-targeted tap dispatched for "${trimmedTitle}" (matched: ${tapTarget.text})`
        }
        logger.warn(
          `[ADB CLIENT] ESPN no visible tile matched "${trimmedTitle}". NOT tapping.`,
        )
        throw new Error(
          `ESPN couldn't find "${trimmedTitle}" on the search-results screen. App is open at home for manual navigation.`,
        )
      }

      // v2.32.91 — same 8s sendKey timeout as Prime Video (see comment in
      // launchPrimeVideoToContent). ESPN's home tab also pins the framework
      // momentarily during content-row hydration.
      logger.info(`[ADB CLIENT] DPAD_DOWN → focus first content tile (featured-tile fallback)`)
      await this.sendKey(20, 8000) // KEYCODE_DPAD_DOWN

      // Brief pause for the focus animation, matching the Prime Video flow.
      await new Promise((r) => setTimeout(r, 400))

      logger.info(`[ADB CLIENT] DPAD_CENTER → open tile (PlayerActivity)`)
      await this.sendKey(23, 8000) // KEYCODE_DPAD_CENTER

      logger.info(`[ADB CLIENT] ESPN featured-tile autoplay dispatched`)
      return 'ESPN featured-tile autoplay dispatched'
    } catch (error) {
      logger.error(`[ADB CLIENT] ESPN autoplay error:`, error)
      throw error
    }
  }

  /**
   * v2.32.97 — Find an on-screen tile whose accessibility content
   * matches the intended title, return its bounds center for tapping.
   *
   * Replaces the v2.32.96 verify-focused-tile approach with a more
   * permissive scan: dump the UI, walk every <node> with non-empty
   * text/content-desc, group siblings by bounds (ESPN's tile pattern
   * has a focusable parent + sibling at same bounds with the
   * description), and find the first whose concatenated content
   * tokens overlap with the intended title's tokens.
   *
   * Returns `{ text, cx, cy }` for the matched tile, or null if
   * nothing matches. Caller does `input tap cx cy` to click it.
   */
  private async _findVisibleTileMatchingTitle(
    intendedTitle: string,
  ): Promise<{ text: string; cx: number; cy: number } | null> {
    try {
      const dumpPath = `/sdcard/espn_tap_${Date.now()}.xml`
      await this.executeShellCommand(`uiautomator dump ${dumpPath}`, 8000)
      const xml = await this.executeShellCommand(`cat ${dumpPath}`, 8000)
      this.executeShellCommand(`rm -f ${dumpPath}`, 3000).catch(() => {})

      if (!xml || xml.length < 200) {
        logger.warn(`[ADB CLIENT] findVisibleTile: empty dump (size=${xml?.length ?? 0})`)
        return null
      }

      // Build a map: bounds-key → accumulated content + center coords.
      // Many ESPN tiles have multiple sibling nodes at exactly the same
      // bounds (focusable container + accessibility wrapper); we
      // concatenate their text/content-desc together so the match can
      // see all tile content at once.
      type TileInfo = { text: string[]; cx: number; cy: number; w: number; h: number }
      const tilesByBounds = new Map<string, TileInfo>()

      const nodeTags = xml.match(/<node[^>]*\/?>/g) || []
      for (const tag of nodeTags) {
        const bm = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
        if (!bm) continue
        const [x1, y1, x2, y2] = bm.slice(1, 5).map(Number)
        const w = x2 - x1
        const h = y2 - y1
        // Filter out obviously-non-tile nodes: the full screen, the
        // navigation rail (narrow column), zero-area, or very wide
        // banner regions. Actual ESPN tiles are roughly 200-400px
        // wide and 200-300px tall.
        if (w < 100 || h < 80 || w > 1500 || h > 800) continue
        const tm = tag.match(/ text="([^"]+)"/)
        const cdm = tag.match(/ content-desc="([^"]+)"/)
        if (!tm && !cdm) continue
        const key = `${x1},${y1},${x2},${y2}`
        let info = tilesByBounds.get(key)
        if (!info) {
          info = {
            text: [],
            cx: Math.round((x1 + x2) / 2),
            cy: Math.round((y1 + y2) / 2),
            w,
            h,
          }
          tilesByBounds.set(key, info)
        }
        if (tm) info.text.push(tm[1])
        if (cdm) info.text.push(cdm[1])
      }

      // Score each tile by how many intended-title tokens appear in
      // its concatenated text. Highest score wins.
      const stripNoise = (s: string) =>
        s
          .toLowerCase()
          .replace(/\(\d+\)/g, ' ')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      const stop = new Set([
        'the', 'at', 'vs', 'a', 'an', 'of', 'and', 'on', 'in', '&',
        'live', 'ncaa', 'espn', 'plus',
      ])
      const intendedTokens = stripNoise(intendedTitle)
        .split(' ')
        .filter((t) => t.length >= 3 && !stop.has(t))
      if (intendedTokens.length === 0) {
        logger.warn(`[ADB CLIENT] findVisibleTile: no usable tokens from "${intendedTitle}"`)
        return null
      }

      let best: { score: number; text: string; cx: number; cy: number } | null = null
      for (const tile of tilesByBounds.values()) {
        const combined = stripNoise(tile.text.join(' '))
        if (!combined) continue
        const score = intendedTokens.filter((t) => combined.includes(t)).length
        if (score > 0 && (!best || score > best.score)) {
          best = {
            score,
            text: tile.text.join(' | ').slice(0, 200),
            cx: tile.cx,
            cy: tile.cy,
          }
        }
      }
      if (!best) {
        // Diagnostic: log a sample of visible tile text so the operator
        // can see what ESPN actually surfaced.
        const sample = Array.from(tilesByBounds.values())
          .slice(0, 5)
          .map((t) => t.text.join(' | ').slice(0, 80))
          .join(' / ')
        logger.warn(
          `[ADB CLIENT] findVisibleTile: no tile matched "${intendedTitle}" (tokens: ${intendedTokens.join(',')}). Visible sample: ${sample}`,
        )
        return null
      }
      logger.info(
        `[ADB CLIENT] findVisibleTile: best match score=${best.score}/${intendedTokens.length} text="${best.text}"`,
      )
      return { text: best.text, cx: best.cx, cy: best.cy }
    } catch (err: any) {
      logger.warn(`[ADB CLIENT] findVisibleTile error: ${err.message}`)
      return null
    }
  }

  /**
   * v2.32.96 — Verify the currently-focused ESPN tile matches the
   * bartender's intended title before pressing CENTER.
   *
   * The focused container itself usually has empty content-desc, so we
   * scan all nodes whose bounds are CONTAINED IN the focused node's
   * bounds and concatenate any non-empty text/content-desc values.
   * This captures the sibling/child node that actually carries the
   * accessibility text (typical pattern: ESPN's RecyclerView tile is a
   * focusable container with a textless wrapper, and a sibling
   * `View.AccessibilityWrapper` at the same bounds carries the full
   * description like "ESPN+ • NCAA Baseball Live Southern Miss 2
   * James Madison 1 Top 4th").
   *
   * Match policy: token-overlap. Strip noise from the intended title
   * (rankings like "(22)", separators like "@" / "vs."), tokenize on
   * whitespace, lowercase, drop short stopwords. Match if at least
   * ONE meaningful token is present in the actual focused content.
   * Conservative-by-design: false positives on common team names
   * (e.g. just "Texans") are possible but the alternative — strict
   * substring on the full title — produces too many false negatives
   * because ESPN abbreviates differently in tile labels.
   */
  private async _verifyFocusedTileMatchesTitle(
    intendedTitle: string,
  ): Promise<{ matched: boolean; actualText: string }> {
    try {
      // Dump the current UI state. Use a fresh path each time so a stale
      // dump from a previous walker run doesn't get re-read.
      const dumpPath = `/sdcard/espn_verify_${Date.now()}.xml`
      await this.executeShellCommand(`uiautomator dump ${dumpPath}`, 8000)
      const xml = await this.executeShellCommand(`cat ${dumpPath}`, 8000)
      // Best-effort cleanup; not critical if it fails.
      this.executeShellCommand(`rm -f ${dumpPath}`, 3000).catch(() => {})

      if (!xml || xml.length < 200) {
        logger.warn(`[ADB CLIENT] verifyFocusedTile: empty dump (size=${xml?.length ?? 0})`)
        return { matched: false, actualText: '' }
      }

      // Find the focused="true" node's bounds.
      const focusedMatch = xml.match(
        /<node[^>]*focused="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/,
      )
      if (!focusedMatch) {
        logger.warn(`[ADB CLIENT] verifyFocusedTile: no focused="true" node in dump`)
        return { matched: false, actualText: '' }
      }
      const [fx1, fy1, fx2, fy2] = focusedMatch.slice(1, 5).map(Number)

      // Walk all <node> entries; collect text/content-desc from nodes whose
      // bounds are contained within the focused node's bounds.
      const accumulated: string[] = []
      const nodeRe = /<node[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/>|<node[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?>/g
      // Simpler: extract every <node ...> tag and check each
      const nodeTags = xml.match(/<node[^>]*\/?>/g) || []
      for (const tag of nodeTags) {
        const bm = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
        if (!bm) continue
        const [x1, y1, x2, y2] = bm.slice(1, 5).map(Number)
        // Contained in focused tile (inclusive — same-bounds sibling counts)
        if (x1 < fx1 || y1 < fy1 || x2 > fx2 || y2 > fy2) continue
        const tm = tag.match(/ text="([^"]+)"/)
        const cdm = tag.match(/ content-desc="([^"]+)"/)
        if (tm) accumulated.push(tm[1])
        if (cdm) accumulated.push(cdm[1])
      }
      const actualText = accumulated.join(' | ').trim()

      if (!actualText) {
        return { matched: false, actualText: '' }
      }

      // Token-overlap match. Strip rankings + punctuation, lowercase, drop
      // short stopwords, then check if any token from intended is in actual.
      const stripNoise = (s: string) =>
        s
          .toLowerCase()
          .replace(/\(\d+\)/g, ' ')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      const stop = new Set(['the', 'at', 'vs', 'a', 'an', 'of', 'and', 'on', 'in', '&', 'live', 'ncaa', 'espn', 'plus'])
      const intendedTokens = stripNoise(intendedTitle)
        .split(' ')
        .filter((t) => t.length >= 3 && !stop.has(t))
      const actualLower = stripNoise(actualText)
      const matched = intendedTokens.some((t) => actualLower.includes(t))

      return { matched, actualText }
    } catch (err: any) {
      logger.warn(`[ADB CLIENT] verifyFocusedTile error: ${err.message}`)
      return { matched: false, actualText: '' }
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
