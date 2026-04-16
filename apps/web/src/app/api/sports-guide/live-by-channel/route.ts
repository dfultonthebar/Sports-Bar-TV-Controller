/**
 * API Route: Get Live Game Data by Channel Number
 *
 * Returns live game info (scores, period, clock) for specific channel numbers
 * Used by ChannelPresetGrid to show live scores on channel preset buttons
 *
 * Now uses ESPN API with network-to-DirecTV channel mapping
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { espnScoreboardAPI } from '@/lib/sports-apis/espn-scoreboard-api'
import { z } from 'zod'
import { validateQueryParams, isValidationError } from '@/lib/validation'
import { fetchDirecTVGuide } from '@/lib/directv-guide-service'
import { getDirecTVDeviceFromConfig } from '@/lib/directv-device-loader'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'
import { resolveChannelsForGame } from '@/lib/network-channel-resolver'

// Sports to fetch from ESPN - OPTIMIZED for sports bar relevance
// Reduced from 40+ to 15 core sports for faster response times
const ESPN_SPORTS = [
  // Football (HIGH PRIORITY - fall/winter)
  { sport: 'football', league: 'nfl', name: 'NFL' },
  { sport: 'football', league: 'college-football', name: 'College Football' },

  // Basketball (HIGH PRIORITY - fall/winter/spring)
  { sport: 'basketball', league: 'nba', name: 'NBA' },
  { sport: 'basketball', league: 'mens-college-basketball', name: 'College Basketball' },
  { sport: 'basketball', league: 'womens-college-basketball', name: 'Women\'s College Basketball' },

  // Hockey (MEDIUM PRIORITY - fall/winter/spring)
  { sport: 'hockey', league: 'nhl', name: 'NHL' },

  // Baseball (HIGH PRIORITY - spring/summer)
  { sport: 'baseball', league: 'mlb', name: 'MLB' },

  // Soccer (MEDIUM PRIORITY - varies by league)
  { sport: 'soccer', league: 'usa.1', name: 'MLS' },
  { sport: 'soccer', league: 'eng.1', name: 'Premier League' },
  { sport: 'soccer', league: 'uefa.champions', name: 'Champions League' },
  { sport: 'soccer', league: 'mex.1', name: 'Liga MX' },

  // Golf (MEDIUM PRIORITY - spring/summer)
  { sport: 'golf', league: 'pga', name: 'PGA Tour' },

  // Combat Sports (HIGH PRIORITY for bar crowd)
  { sport: 'mma', league: 'ufc', name: 'UFC' },
  // Note: boxing/boxing and racing/nascar-cup return 400 from ESPN API - not supported

  // Racing - F1 only (NASCAR not supported by ESPN scoreboard API)
  { sport: 'racing', league: 'f1', name: 'Formula 1' },
]

// Route-level cache for the entire response (30 second TTL)
// FIXED: Use Map to cache per device type instead of single shared cache
const routeCacheMap = new Map<string, { data: any; timestamp: number }>()
const ROUTE_CACHE_TTL = 30 * 1000 // 30 seconds

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Validate query parameters
  const queryValidation = validateQueryParams(request, z.object({
    channels: z.string().optional(), // Comma-separated channel numbers
    deviceType: z.enum(['cable', 'directv']).optional().default('directv'),
    includeGuideData: z.coerce.boolean().optional().default(true) // Include DirecTV guide data
  }))
  if (isValidationError(queryValidation)) return queryValidation.error

  const { channels, deviceType, includeGuideData } = queryValidation.data

  // Check route-level cache (keyed by device type and parameters)
  const cacheKey = `${deviceType}-${includeGuideData}-${channels || 'all'}`
  const cachedEntry = routeCacheMap.get(cacheKey)
  if (cachedEntry && Date.now() - cachedEntry.timestamp < ROUTE_CACHE_TTL) {
    logger.info(`[LIVE_BY_CHANNEL] Returning cached response for ${cacheKey}`)
    return NextResponse.json({
      ...cachedEntry.data,
      cached: true,
      cacheAge: Math.round((Date.now() - cachedEntry.timestamp) / 1000)
    })
  }

  try {
    logger.info('[LIVE_BY_CHANNEL] Fetching fresh data (cache miss or expired)')

    // Parse requested channel numbers
    const channelList = channels?.split(',').map(c => c.trim()).filter(Boolean) || []

    // Load channel presets
    const channelPresets = await db.select().from(schema.channelPresets).where(eq(schema.channelPresets.isActive, true))

    // Create set of preset channels for this device type
    const presetChannels = new Set(
      channelPresets
        .filter(p => p.deviceType === deviceType)
        .map(p => p.channelNumber)
    )

    // Build channel game map from ESPN data
    const channelGameMap: Record<string, any> = {}

    // Fetch games from ESPN for all major sports IN PARALLEL for performance
    const sportResults = await Promise.allSettled(
      ESPN_SPORTS.map(async (sportConfig) => {
        const games = await espnScoreboardAPI.getTodaysGames(sportConfig.sport, sportConfig.league)
        return { sportConfig, games }
      })
    )

    // Process results — resolve channel via the shared DB-backed helper
    // (`resolveChannelsForGame`), which walks presets → station aliases →
    // local_channel_overrides and preserves the Wisconsin RSN split
    // (FanDuelWI ch 40 Bucks vs BallyWIPlus ch 308 Brewers).
    for (const result of sportResults) {
      if (result.status === 'rejected') {
        // Error already logged by ESPN API
        continue
      }

      const { sportConfig, games } = result.value

      for (const game of games) {
        // Skip events without real team matchups (golf, F1, etc.)
        if (!game.homeTeam?.displayName || !game.awayTeam?.displayName) continue

        // Get broadcast networks
        const networks = espnScoreboardAPI.getAllNetworks(game)
        if (!networks || networks.length === 0) continue
        const primaryNetwork = networks[0] ?? null

        // Resolve to channel for this device type
        const resolved = await resolveChannelsForGame(
          {
            networks,
            primaryNetwork,
            league: sportConfig.league,
            sport: sportConfig.sport,
          },
          [deviceType]
        )
        const channelNumber = deviceType === 'cable' ? resolved.cableChannel : resolved.directvChannel
        if (!channelNumber) continue

        // Skip if not in our presets
        if (!presetChannels.has(channelNumber)) continue

        // Skip if specific channels requested and this isn't one
        if (channelList.length > 0 && !channelList.includes(channelNumber)) continue

        // Only keep the most relevant game for each channel (prefer live games)
        const existingGame = channelGameMap[channelNumber]
        if (existingGame) {
          const existingIsLive = existingGame.liveData?.isLive
          const newIsLive = espnScoreboardAPI.isLive(game)

          // Keep live game over scheduled game
          if (existingIsLive && !newIsLive) continue

          // Keep earlier scheduled game
          if (!existingIsLive && !newIsLive) {
            const existingTime = new Date(existingGame.startTime).getTime()
            const newTime = new Date(game.date).getTime()
            if (existingTime < newTime) continue
          }
        }

        channelGameMap[channelNumber] = buildGameData(game, sportConfig.name, channelNumber)
      }
    }

    logger.info(`[LIVE_BY_CHANNEL] Found games for ${Object.keys(channelGameMap).length} channels`)

    // Fetch DirecTV guide data if requested and deviceType is directv
    let guideData: Record<string, any> = {}
    if (includeGuideData && deviceType === 'directv') {
      try {
        logger.info('[LIVE_BY_CHANNEL] Fetching DirecTV guide data')

        // Get channels to fetch (either specified or all preset channels)
        const channelsToFetch = channelList.length > 0
          ? channelList
          : Array.from(presetChannels)

        const guideDevice = getDirecTVDeviceFromConfig()
        if (!guideDevice) {
          logger.warn('[LIVE_BY_CHANNEL] No online DirecTV device available for guide data')
          throw new Error('No online DirecTV device')
        }

        const guideResults = await fetchDirecTVGuide({
          device: guideDevice,
          channels: channelsToFetch,
          timeout: 5000,
          useCache: true,
          cacheTTL: 30000 // 30 second cache
        })

        // Map guide results by channel
        for (const result of guideResults) {
          if (result.success && result.programInfo) {
            guideData[result.channel] = {
              title: result.programInfo.title,
              callsign: result.programInfo.callsign,
              startTime: result.programInfo.startTime,
              duration: result.programInfo.duration,
              isOffAir: result.programInfo.isOffAir
            }
          }
        }

        logger.info(`[LIVE_BY_CHANNEL] Fetched guide data for ${Object.keys(guideData).length} channels`)
      } catch (error: any) {
        logger.error('[LIVE_BY_CHANNEL] Error fetching DirecTV guide data:', error.message)
        // Continue without guide data - not critical
      }
    }

    const responseData = {
      success: true,
      channels: channelGameMap,
      guideData: includeGuideData ? guideData : undefined,
      fetchedAt: new Date().toISOString()
    }

    // Update route-level cache (keyed by device type and parameters)
    routeCacheMap.set(cacheKey, { data: responseData, timestamp: Date.now() })

    return NextResponse.json(responseData)

  } catch (error: any) {
    logger.error('[LIVE_BY_CHANNEL] Error fetching live game data:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch live game data',
      details: error.message
    }, { status: 500 })
  }
}

// Helper function to build game data from ESPN game
function buildGameData(game: any, league: string, channelNumber: string) {
  const gameDate = new Date(game.date)
  const gameTime = gameDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: HARDWARE_CONFIG.venue.timezone  // Venue timezone for bar
  })

  const isLive = espnScoreboardAPI.isLive(game)
  const isCompleted = espnScoreboardAPI.isCompleted(game)

  return {
    league,
    homeTeam: game.homeTeam.displayName,
    awayTeam: game.awayTeam.displayName,
    gameTime,
    startTime: game.date,
    channelNumber,
    venue: game.venue?.fullName || '',
    liveData: {
      homeScore: game.homeTeam.score || 0,
      awayScore: game.awayTeam.score || 0,
      homeAbbrev: game.homeTeam.abbreviation,
      awayAbbrev: game.awayTeam.abbreviation,
      clock: game.status.displayClock,
      period: game.status.period,
      statusState: game.status.type.state,
      statusDetail: game.status.type.shortDetail,
      isLive,
      isCompleted,
    }
  }
}
