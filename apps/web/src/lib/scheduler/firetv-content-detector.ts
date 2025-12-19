/**
 * Fire TV Content Detector
 *
 * Detects live sports games available on streaming platforms:
 * - Amazon Prime Video (Thursday Night Football, MLB, NHL)
 * - Peacock (Sunday Night Football, Premier League, WWE)
 * - YouTube TV (MLB, NBA, NHL - live TV replacement)
 * - ESPN+ (UFC, college sports, international soccer)
 * - Paramount+ (CBS Sports, Champions League)
 *
 * Integrates with Fire TV devices to launch apps and navigate to content
 */

import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { GameInfo } from './priority-calculator'

export interface StreamingPlatform {
  name: string
  packageName: string // Android package name for Fire TV
  launchIntent: string // ADB intent to launch
  supportsDeepLinks: boolean
  availableInputs: number[] // Fire TV matrix input numbers
}

export interface StreamingGame extends GameInfo {
  platform: StreamingPlatform
  deepLink?: string // Direct link to game (if supported)
  requiresSubscription: boolean
  inputNumber: number // Fire TV input to use
}

export const STREAMING_PLATFORMS: Record<string, StreamingPlatform> = {
  PRIME_VIDEO: {
    name: 'Amazon Prime Video',
    packageName: 'com.amazon.avod',
    launchIntent: 'android.intent.action.VIEW',
    supportsDeepLinks: true,
    availableInputs: [13, 14, 15, 16] // Fire TV inputs
  },
  PEACOCK: {
    name: 'Peacock',
    packageName: 'com.peacocktv.peacockandroid',
    launchIntent: 'android.intent.action.MAIN',
    supportsDeepLinks: true,
    availableInputs: [13, 14, 15, 16]
  },
  YOUTUBE_TV: {
    name: 'YouTube TV',
    packageName: 'com.google.android.youtube.tvunplugged',
    launchIntent: 'android.intent.action.MAIN',
    supportsDeepLinks: false,
    availableInputs: [13, 14, 15, 16]
  },
  ESPN_PLUS: {
    name: 'ESPN+',
    packageName: 'com.espn.score_center',
    launchIntent: 'android.intent.action.MAIN',
    supportsDeepLinks: false,
    availableInputs: [13, 14, 15, 16]
  },
  PARAMOUNT_PLUS: {
    name: 'Paramount+',
    packageName: 'com.cbs.ott',
    launchIntent: 'android.intent.action.MAIN',
    supportsDeepLinks: true,
    availableInputs: [13, 14, 15, 16]
  }
}

export class FireTVContentDetector {
  /**
   * Detect streaming-exclusive games
   */
  async detectStreamingGames(games: GameInfo[]): Promise<StreamingGame[]> {
    const streamingGames: StreamingGame[] = []

    for (const game of games) {
      // Check if game is available on streaming platforms
      const platform = this.detectPlatform(game)

      if (platform) {
        // Get available Fire TV input
        const inputNumber = await this.getAvailableFireTVInput(platform)

        if (inputNumber) {
          streamingGames.push({
            ...game,
            platform,
            deepLink: this.generateDeepLink(game, platform),
            requiresSubscription: this.requiresSubscription(platform),
            inputNumber
          })

          logger.info(
            `[FIRETV_DETECTOR] Found streaming game: ${game.homeTeam} vs ${game.awayTeam} ` +
            `on ${platform.name} (Input ${inputNumber})`
          )
        }
      }
    }

    return streamingGames
  }

  /**
   * Detect which platform has the game
   */
  private detectPlatform(game: GameInfo): StreamingPlatform | null {
    const channel = (game.channelName || '').toLowerCase()
    const description = (game.description || '').toLowerCase()

    // Thursday Night Football → Prime Video
    if (
      (game.league === 'NFL' || game.sport === 'Football') &&
      (description.includes('thursday night') || channel.includes('prime'))
    ) {
      return STREAMING_PLATFORMS.PRIME_VIDEO
    }

    // Sunday Night Football → Peacock (simulcast)
    if (
      (game.league === 'NFL' || game.sport === 'Football') &&
      (description.includes('sunday night') || channel.includes('peacock'))
    ) {
      return STREAMING_PLATFORMS.PEACOCK
    }

    // Premier League → Peacock
    if (
      (game.league === 'Premier League' || game.sport === 'Soccer') &&
      (channel.includes('peacock') || description.includes('premier league'))
    ) {
      return STREAMING_PLATFORMS.PEACOCK
    }

    // MLB on Prime Video (select games)
    if (
      (game.league === 'MLB' || game.sport === 'Baseball') &&
      channel.includes('prime')
    ) {
      return STREAMING_PLATFORMS.PRIME_VIDEO
    }

    // NHL on ESPN+ (out-of-market games)
    if (
      (game.league === 'NHL' || game.sport === 'Hockey') &&
      (channel.includes('espn+') || channel.includes('espn plus'))
    ) {
      return STREAMING_PLATFORMS.ESPN_PLUS
    }

    // Champions League → Paramount+
    if (
      (description.includes('champions league') || description.includes('uefa')) &&
      (channel.includes('paramount') || channel.includes('cbs'))
    ) {
      return STREAMING_PLATFORMS.PARAMOUNT_PLUS
    }

    // YouTube TV (cable replacement - has most channels)
    if (channel.includes('youtube tv')) {
      return STREAMING_PLATFORMS.YOUTUBE_TV
    }

    return null
  }

  /**
   * Get available Fire TV input for platform
   */
  private async getAvailableFireTVInput(platform: StreamingPlatform): Promise<number | null> {
    try {
      // Get Fire TV devices from database
      const fireTVDevices = await db
        .select()
        .from(schema.fireTVDevices)
        .where(eq(schema.fireTVDevices.status, 'online'))

      if (fireTVDevices.length === 0) {
        logger.warn('[FIRETV_DETECTOR] No online Fire TV devices found')
        return null
      }

      // Get matrix inputs for Fire TV devices
      const matrixInputs = await db
        .select()
        .from(schema.matrixInputs)
        .where(eq(schema.matrixInputs.deviceType, 'Fire TV'))

      // Find first available input from platform's available inputs
      for (const inputNum of platform.availableInputs) {
        const input = matrixInputs.find(i => i.channelNumber === inputNum)
        if (input) {
          return inputNum
        }
      }

      logger.warn(`[FIRETV_DETECTOR] No available inputs for ${platform.name}`)
      return null
    } catch (error) {
      logger.error('[FIRETV_DETECTOR] Error getting Fire TV input:', error)
      return null
    }
  }

  /**
   * Generate deep link for streaming app (if supported)
   */
  private generateDeepLink(game: GameInfo, platform: StreamingPlatform): string | undefined {
    if (!platform.supportsDeepLinks) {
      return undefined
    }

    // Prime Video deep links
    if (platform.name === 'Amazon Prime Video') {
      // Prime Video uses ASIN identifiers
      // For live sports, typically need to navigate to "Live TV" section
      return 'https://app.amazon.com/live-tv'
    }

    // Peacock deep links
    if (platform.name === 'Peacock') {
      // Peacock uses entity IDs
      // For live events, use sports section
      return 'peacock://sports/live'
    }

    // Paramount+ deep links
    if (platform.name === 'Paramount+') {
      // Paramount+ uses content IDs
      return 'cbsott://live-tv'
    }

    return undefined
  }

  /**
   * Check if platform requires subscription
   */
  private requiresSubscription(platform: StreamingPlatform): boolean {
    // All platforms require subscriptions except some Prime Video content
    // (Amazon Prime membership is assumed)
    return platform.name !== 'Amazon Prime Video'
  }

  /**
   * Launch streaming app on Fire TV
   */
  async launchStreamingApp(
    streamingGame: StreamingGame,
    deviceId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info(
        `[FIRETV_DETECTOR] Launching ${streamingGame.platform.name} on Fire TV ${deviceId}`
      )

      // Get Fire TV device
      const device = await db
        .select()
        .from(schema.fireTVDevices)
        .where(eq(schema.fireTVDevices.id, deviceId))
        .limit(1)

      if (device.length === 0) {
        return { success: false, error: 'Fire TV device not found' }
      }

      const fireTVDevice = device[0]

      // Build ADB command to launch app
      const packageName = streamingGame.platform.packageName
      const intent = streamingGame.platform.launchIntent

      let adbCommand: string

      if (streamingGame.deepLink && streamingGame.platform.supportsDeepLinks) {
        // Launch with deep link
        adbCommand = `adb -s ${fireTVDevice.ipAddress}:5555 shell am start -a ${intent} -d "${streamingGame.deepLink}"`
      } else {
        // Launch app main activity
        adbCommand = `adb -s ${fireTVDevice.ipAddress}:5555 shell monkey -p ${packageName} 1`
      }

      logger.debug(`[FIRETV_DETECTOR] ADB command: ${adbCommand}`)

      // Use Fire TV API to send command
      const response = await fetch(`http://localhost:3001/api/firetv/${deviceId}/adb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: adbCommand,
          description: `Launch ${streamingGame.platform.name} for ${streamingGame.homeTeam} vs ${streamingGame.awayTeam}`
        })
      })

      const result = await response.json()

      if (result.success) {
        logger.info(`[FIRETV_DETECTOR] Successfully launched ${streamingGame.platform.name}`)
        return { success: true }
      } else {
        logger.error(`[FIRETV_DETECTOR] Failed to launch app: ${result.error}`)
        return { success: false, error: result.error }
      }
    } catch (error: any) {
      logger.error('[FIRETV_DETECTOR] Error launching streaming app:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get recommended Fire TV games (streaming exclusives)
   */
  async getRecommendedStreamingGames(
    allGames: GameInfo[]
  ): Promise<{ exclusives: StreamingGame[]; supplements: StreamingGame[] }> {
    const streamingGames = await this.detectStreamingGames(allGames)

    // Separate into exclusives (only on streaming) and supplements (also on cable/satellite)
    const exclusives: StreamingGame[] = []
    const supplements: StreamingGame[] = []

    for (const game of streamingGames) {
      // Check if game is ONLY available on streaming (no cable/satellite channel)
      const hasCableChannel = game.channelNumber && !game.channelName?.toLowerCase().includes('prime')

      if (!hasCableChannel) {
        exclusives.push(game)
      } else {
        supplements.push(game)
      }
    }

    logger.info(
      `[FIRETV_DETECTOR] Found ${exclusives.length} streaming exclusives, ` +
      `${supplements.length} supplemental streams`
    )

    return { exclusives, supplements }
  }
}

// Singleton instance
let detectorInstance: FireTVContentDetector | null = null

export function getFireTVContentDetector(): FireTVContentDetector {
  if (!detectorInstance) {
    detectorInstance = new FireTVContentDetector()
  }
  return detectorInstance
}

export function resetFireTVContentDetector(): void {
  detectorInstance = null
}
