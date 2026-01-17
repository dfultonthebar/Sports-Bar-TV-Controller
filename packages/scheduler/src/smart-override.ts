/**
 * Smart Override Duration Calculator
 *
 * Calculates intelligent override durations based on live game schedules.
 * When a bartender manually tunes to a channel, this service:
 * 1. Detects if the channel is showing a live game
 * 2. Estimates when the game will end
 * 3. Sets override to protect the input until game end + buffer
 * 4. Falls back to default duration if no game detected
 */

import { logger } from '@sports-bar/logger'
import { espnScoreboardAPI, ESPNScoreboardGame as ESPNGame } from '@sports-bar/sports-apis'
import { db, schema, eq } from '@sports-bar/database'

// Sport-specific configurations
interface SportConfig {
  espnSport: string
  espnLeague: string
  estimatedDurationMinutes: number
  periodCount: number
  periodMinutes: number
}

const SPORT_CONFIGS: Record<string, SportConfig> = {
  'nfl': {
    espnSport: 'football',
    espnLeague: 'nfl',
    estimatedDurationMinutes: 210, // 3.5 hours
    periodCount: 4,
    periodMinutes: 15
  },
  'nba': {
    espnSport: 'basketball',
    espnLeague: 'nba',
    estimatedDurationMinutes: 150, // 2.5 hours
    periodCount: 4,
    periodMinutes: 12
  },
  'mlb': {
    espnSport: 'baseball',
    espnLeague: 'mlb',
    estimatedDurationMinutes: 180, // 3 hours
    periodCount: 9,
    periodMinutes: 20 // Approximate
  },
  'nhl': {
    espnSport: 'hockey',
    espnLeague: 'nhl',
    estimatedDurationMinutes: 150, // 2.5 hours
    periodCount: 3,
    periodMinutes: 20
  },
  'ncaab': {
    espnSport: 'basketball',
    espnLeague: 'mens-college-basketball',
    estimatedDurationMinutes: 135, // 2.25 hours
    periodCount: 2,
    periodMinutes: 20
  },
  'ncaaf': {
    espnSport: 'football',
    espnLeague: 'college-football',
    estimatedDurationMinutes: 210, // 3.5 hours
    periodCount: 4,
    periodMinutes: 15
  }
}

const DEFAULT_OVERRIDE_HOURS = 4
const GAME_END_BUFFER_MINUTES = 30

export interface SmartOverrideResult {
  durationMs: number
  durationMinutes: number
  reason: string
  gameDetected: boolean
  gameInfo?: {
    league: string
    homeTeam: string
    awayTeam: string
    period: number
    clock: string
    status: string
    estimatedEndTime: string
  }
}

/**
 * Calculate smart override duration for a channel
 */
export async function calculateSmartOverrideDuration(
  channelNumber: string
): Promise<SmartOverrideResult> {
  try {
    logger.info(`[SMART OVERRIDE] Calculating duration for channel ${channelNumber}`)

    // Get channel preset to find network/league info
    const preset = await db
      .select()
      .from(schema.channelPresets)
      .where(eq(schema.channelPresets.channelNumber, channelNumber))
      .limit(1)
      .get()

    if (preset) {
      logger.debug(`[SMART OVERRIDE] Found preset: ${preset.name}`)
    }

    // Query ESPN for live games across major sports
    const leagues = ['nfl', 'nba', 'mlb', 'nhl', 'ncaab', 'ncaaf']
    const now = new Date()

    for (const leagueKey of leagues) {
      const config = SPORT_CONFIGS[leagueKey]
      if (!config) continue

      try {
        // Get today's games for this league
        const games = await espnScoreboardAPI.getTodaysGames(
          config.espnSport,
          config.espnLeague
        )

        if (!games || games.length === 0) continue

        logger.debug(`[SMART OVERRIDE] Checking ${games.length} ${leagueKey.toUpperCase()} games`)

        // Find games that match this channel
        for (const game of games) {
          // Check if game is on this channel via broadcast info
          const isOnChannel = await isGameOnChannel(game, channelNumber, preset?.name)

          if (isOnChannel) {
            logger.info(
              `[SMART OVERRIDE] Game detected: ${game.homeTeam.displayName} vs ${game.awayTeam.displayName}`
            )

            // Calculate override duration based on game status
            const result = calculateGameBasedOverride(game, config, now)

            if (result) {
              return {
                ...result,
                gameDetected: true,
                gameInfo: {
                  league: leagueKey.toUpperCase(),
                  homeTeam: game.homeTeam.displayName,
                  awayTeam: game.awayTeam.displayName,
                  period: game.status.period,
                  clock: game.status.displayClock,
                  status: game.status.type.state,
                  estimatedEndTime: new Date(
                    now.getTime() + result.durationMs - (GAME_END_BUFFER_MINUTES * 60 * 1000)
                  ).toISOString()
                }
              }
            }
          }
        }
      } catch (error) {
        logger.error(`[SMART OVERRIDE] Error checking ${leagueKey}:`, error)
        // Continue checking other leagues
      }
    }

    // No game detected - use default duration
    const defaultDurationMs = DEFAULT_OVERRIDE_HOURS * 60 * 60 * 1000
    logger.info(`[SMART OVERRIDE] No game detected on channel ${channelNumber}, using default ${DEFAULT_OVERRIDE_HOURS}h`)

    return {
      durationMs: defaultDurationMs,
      durationMinutes: DEFAULT_OVERRIDE_HOURS * 60,
      reason: `No live game detected - default ${DEFAULT_OVERRIDE_HOURS} hour protection`,
      gameDetected: false
    }
  } catch (error) {
    logger.error('[SMART OVERRIDE] Error calculating duration:', error)

    // Fallback to default on error
    const defaultDurationMs = DEFAULT_OVERRIDE_HOURS * 60 * 60 * 1000
    return {
      durationMs: defaultDurationMs,
      durationMinutes: DEFAULT_OVERRIDE_HOURS * 60,
      reason: `Error detecting game - default ${DEFAULT_OVERRIDE_HOURS} hour protection`,
      gameDetected: false
    }
  }
}

/**
 * Check if a game is broadcasting on a specific channel
 */
async function isGameOnChannel(
  game: ESPNGame,
  channelNumber: string,
  presetName?: string
): Promise<boolean> {
  // Method 1: Match by broadcast network
  const networks = espnScoreboardAPI.getAllNetworks(game)

  if (networks.length > 0 && presetName) {
    const presetLower = presetName.toLowerCase()
    for (const network of networks) {
      const networkLower = network.toLowerCase()

      // Check if preset name contains network name
      if (presetLower.includes(networkLower) || networkLower.includes(presetLower)) {
        logger.debug(`[SMART OVERRIDE] Match by network: ${network} in preset "${presetName}"`)
        return true
      }
    }
  }

  // Method 2: Match by time window (game started within last 4 hours and not ended)
  const gameStart = new Date(game.date)
  const now = new Date()
  const hoursSinceStart = (now.getTime() - gameStart.getTime()) / (1000 * 60 * 60)

  if (hoursSinceStart >= 0 && hoursSinceStart <= 4 && !game.status.type.completed) {
    // Game is currently ongoing or recently started
    logger.debug(`[SMART OVERRIDE] Game is live/recent: ${game.homeTeam.displayName} vs ${game.awayTeam.displayName}`)

    // If preset name contains team names, it's likely the right game
    if (presetName) {
      const presetLower = presetName.toLowerCase()
      const homeTeamLower = game.homeTeam.displayName.toLowerCase()
      const awayTeamLower = game.awayTeam.displayName.toLowerCase()
      const homeAbbr = game.homeTeam.abbreviation.toLowerCase()
      const awayAbbr = game.awayTeam.abbreviation.toLowerCase()

      if (
        presetLower.includes(homeTeamLower) ||
        presetLower.includes(awayTeamLower) ||
        presetLower.includes(homeAbbr) ||
        presetLower.includes(awayAbbr)
      ) {
        logger.debug(`[SMART OVERRIDE] Match by team name in preset`)
        return true
      }
    }
  }

  return false
}

/**
 * Calculate override duration for a detected game
 * Returns base result without gameDetected/gameInfo (those are added by caller)
 */
function calculateGameBasedOverride(
  game: ESPNGame,
  config: SportConfig,
  now: Date
): Omit<SmartOverrideResult, 'gameDetected' | 'gameInfo'> | null {
  const gameStart = new Date(game.date)

  // Game hasn't started yet
  if (game.status.type.state === 'pre') {
    const timeUntilStart = gameStart.getTime() - now.getTime()
    const estimatedGameDuration = config.estimatedDurationMinutes * 60 * 1000
    const bufferMs = GAME_END_BUFFER_MINUTES * 60 * 1000

    const totalDuration = timeUntilStart + estimatedGameDuration + bufferMs
    const durationMinutes = Math.ceil(totalDuration / (1000 * 60))

    logger.info(`[SMART OVERRIDE] Pre-game: Protect until ${durationMinutes} minutes from now`)

    return {
      durationMs: totalDuration,
      durationMinutes,
      reason: `Game starts at ${gameStart.toLocaleTimeString()} + ${config.estimatedDurationMinutes}min duration + ${GAME_END_BUFFER_MINUTES}min buffer`
    }
  }

  // Game is live
  if (game.status.type.state === 'in') {
    // Calculate estimated remaining time
    const currentPeriod = game.status.period
    const periodsRemaining = config.periodCount - currentPeriod

    // Parse clock (format: "12:34", "0:45", etc.)
    let clockMinutes = 0
    if (game.status.displayClock && game.status.displayClock !== '0:00') {
      const parts = game.status.displayClock.split(':')
      if (parts.length === 2) {
        clockMinutes = parseInt(parts[0]) + (parseInt(parts[1]) / 60)
      }
    }

    // Estimate remaining time: current period clock + remaining full periods
    const estimatedRemainingMinutes = clockMinutes + (periodsRemaining * config.periodMinutes)

    // Add buffer and convert to milliseconds
    const totalMinutes = Math.max(estimatedRemainingMinutes + GAME_END_BUFFER_MINUTES, 60) // Minimum 1 hour
    const durationMs = totalMinutes * 60 * 1000

    logger.info(
      `[SMART OVERRIDE] Live game: Period ${currentPeriod}/${config.periodCount}, ` +
      `Clock: ${game.status.displayClock}, Estimated ${Math.ceil(estimatedRemainingMinutes)}min remaining`
    )

    return {
      durationMs,
      durationMinutes: Math.ceil(totalMinutes),
      reason: `Live: Period ${currentPeriod}/${config.periodCount}, ${game.status.displayClock} remaining, +${GAME_END_BUFFER_MINUTES}min buffer`
    }
  }

  // Game completed - use minimal override
  if (game.status.type.completed) {
    const minimalOverrideMs = 30 * 60 * 1000 // 30 minutes for post-game

    logger.info(`[SMART OVERRIDE] Game completed - minimal 30min post-game protection`)

    return {
      durationMs: minimalOverrideMs,
      durationMinutes: 30,
      reason: 'Game completed - 30min post-game protection'
    }
  }

  return null
}
