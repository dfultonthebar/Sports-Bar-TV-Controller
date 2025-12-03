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
import { logger } from '@/lib/logger'
import { espnScoreboardAPI } from '@/lib/sports-apis/espn-scoreboard-api'
import { z } from 'zod'
import { validateQueryParams, isValidationError } from '@/lib/validation'

// DirecTV channel mapping for broadcast networks
const NETWORK_TO_DIRECTV: Record<string, string> = {
  // ESPN family
  'ESPN': '206',
  'ESPN2': '209',
  'ESPNU': '208',
  'ESPNEWS': '207',
  'ESPN+': '206',
  'ESPN Deportes': '466',

  // Fox Sports
  'FOX': '11',  // Local Fox
  'FS1': '219',
  'FS2': '618',
  'FOX Sports 1': '219',
  'FOX Sports 2': '618',
  'Fox Deportes': '463',
  'FOX Deportes': '463',

  // CBS/NBC
  'CBS': '5',  // Local CBS
  'NBC': '2',  // Local NBC
  'CBS Sports Network': '221',
  'CBSSN': '221',
  'Peacock': '206', // Fallback - games on Peacock often simulcast

  // Turner
  'TNT': '245',
  'TBS': '247',
  'truTV': '246',
  'TruTV': '246',

  // Other sports
  'NFL Network': '212',
  'NFL RedZone': '211',
  'Red Zone': '211',
  'NFLN': '212',
  'NBA TV': '216',
  'NBATV': '216',
  'MLB Network': '213',
  'MLBN': '213',
  'NHL Network': '215',
  'NHLN': '215',
  'Golf Channel': '218',
  'Golf': '218',
  'Tennis Channel': '217',
  'Big Ten Network': '610',
  'BTN': '610',
  'SEC Network': '611',
  'SECN': '611',
  'ACC Network': '612',
  'ACCN': '612',
  'Pac-12 Network': '613',
  'Pac-12': '613',

  // USA Network (for sports)
  'USA': '242',
  'USA Network': '242',

  // Golf
  'Golf Channel': '218',
  'Golf': '218',
  'GOLF': '218',

  // Tennis
  'Tennis Channel': '217',
  'Tennis': '217',
  'TENNIS': '217',

  // Racing
  'NBCSN': '220',
  'NBC Sports': '220',
  'FS1': '219',
  'FS2': '618',
  'USA': '242',

  // Soccer
  'beIN Sports': '620',
  'beIN SPORTS': '620',
  'BEIN': '620',
  'Fox Soccer': '619',
  'FOX Soccer Plus': '619',
  'Univision': '402',
  'TUDN': '464',

  // Combat Sports
  'ESPN+': '206',

  // Local stations (Green Bay area)
  'TV32': '32',
  'WACY': '32',
  'WBAY': '2',
  'WFRV': '5',
  'WLUK': '11',
  'WCWF': '14',
  'WGBA': '26',

  // Streaming (map to likely simulcast channels)
  'Amazon Prime Video': '9550',  // Thursday Night Football
  'Prime Video': '9550',
  'Apple TV+': '9528',
  'Paramount+': '247',  // Often simulcasts CBS games
  'Peacock': '206',
}

// Cable (Spectrum) channel mapping for broadcast networks
const NETWORK_TO_CABLE: Record<string, string> = {
  // ESPN family
  'ESPN': '27',
  'ESPN2': '28',
  'ESPNU': '195',
  'ESPNEWS': '196',
  'ESPN+': '27',

  // Fox Sports
  'FOX': '11',  // Local Fox
  'FS1': '75',
  'FS2': '328',
  'FOX Sports 1': '75',
  'FOX Sports 2': '328',

  // CBS/NBC
  'CBS': '5',  // Local CBS
  'NBC': '2',  // Local NBC
  'CBS Sports Network': '329',
  'CBSSN': '329',

  // Turner
  'TNT': '29',
  'TBS': '25',
  'truTV': '37',
  'TruTV': '37',

  // Other sports
  'NFL Network': '346',
  'NFL RedZone': '347',
  'Red Zone': '347',
  'NFLN': '346',
  'NBA TV': '325',
  'NBATV': '325',
  'MLB Network': '213',
  'MLBN': '213',
  'NHL Network': '215',
  'NHLN': '215',
  'Big Ten Network': '326',
  'BTN': '326',
  'SEC Network': '327',
  'SECN': '327',
  'ACC Network': '331',
  'ACCN': '331',

  // USA Network (for sports)
  'USA': '26',
  'USA Network': '26',

  // Golf
  'Golf Channel': '78',
  'GOLF': '78',

  // Tennis
  'Tennis Channel': '330',
  'Tennis': '330',
  'TENNIS': '330',

  // Racing
  'NBCSN': '159',
  'NBC Sports': '159',

  // Soccer
  'beIN Sports': '623',
  'beIN SPORTS': '623',
  'BEIN': '623',
  'Univision': '61',
  'TUDN': '435',
  'Fox Deportes': '463',
  'FOX Deportes': '463',
  'Fox Soccer': '619',
  'FOX Soccer Plus': '619',

  // ESPN Deportes
  'ESPN Deportes': '197',

  // Pac-12 Network (now defunct but may still appear)
  'Pac-12 Network': '332',
  'Pac-12': '332',

  // Local stations (Green Bay area)
  'TV32': '32',
  'WACY': '32',
  'WBAY': '2',
  'WFRV': '5',
  'WLUK': '11',
  'WCWF': '14',
  'WGBA': '26',
}

// Function to get the appropriate channel mapping based on device type
function getNetworkMapping(deviceType: string): Record<string, string> {
  return deviceType === 'cable' ? NETWORK_TO_CABLE : NETWORK_TO_DIRECTV
}

// Reverse mapping: DirecTV channel to network names (for matching)
const DIRECTV_TO_NETWORKS: Record<string, string[]> = {}
for (const [network, channel] of Object.entries(NETWORK_TO_DIRECTV)) {
  if (!DIRECTV_TO_NETWORKS[channel]) {
    DIRECTV_TO_NETWORKS[channel] = []
  }
  DIRECTV_TO_NETWORKS[channel].push(network.toLowerCase())
}

// Sports to fetch from ESPN
const ESPN_SPORTS = [
  // Football
  { sport: 'football', league: 'nfl', name: 'NFL' },
  { sport: 'football', league: 'college-football', name: 'College Football' },

  // Basketball
  { sport: 'basketball', league: 'nba', name: 'NBA' },
  { sport: 'basketball', league: 'nba-development', name: 'NBA G League' },
  { sport: 'basketball', league: 'wnba', name: 'WNBA' },
  { sport: 'basketball', league: 'mens-college-basketball', name: 'College Basketball' },
  { sport: 'basketball', league: 'womens-college-basketball', name: 'Women\'s College Basketball' },

  // Hockey
  { sport: 'hockey', league: 'nhl', name: 'NHL' },

  // Baseball
  { sport: 'baseball', league: 'mlb', name: 'MLB' },

  // Soccer
  { sport: 'soccer', league: 'usa.1', name: 'MLS' },
  { sport: 'soccer', league: 'usa.nwsl', name: 'NWSL' },
  { sport: 'soccer', league: 'eng.1', name: 'Premier League' },
  { sport: 'soccer', league: 'uefa.champions', name: 'Champions League' },
  { sport: 'soccer', league: 'esp.1', name: 'La Liga' },
  { sport: 'soccer', league: 'ger.1', name: 'Bundesliga' },
  { sport: 'soccer', league: 'ita.1', name: 'Serie A' },
  { sport: 'soccer', league: 'fra.1', name: 'Ligue 1' },
  { sport: 'soccer', league: 'mex.1', name: 'Liga MX' },

  // Golf
  { sport: 'golf', league: 'pga', name: 'PGA Tour' },
  { sport: 'golf', league: 'lpga', name: 'LPGA Tour' },

  // Tennis
  { sport: 'tennis', league: 'atp', name: 'ATP Tennis' },
  { sport: 'tennis', league: 'wta', name: 'WTA Tennis' },

  // Racing
  { sport: 'racing', league: 'f1', name: 'Formula 1' },
  { sport: 'racing', league: 'nascar-cup', name: 'NASCAR Cup' },
  { sport: 'racing', league: 'indycar', name: 'IndyCar' },

  // Combat Sports
  { sport: 'mma', league: 'ufc', name: 'UFC' },
  { sport: 'boxing', league: 'boxing', name: 'Boxing' },

  // Rugby
  { sport: 'rugby', league: 'super-rugby', name: 'Super Rugby' },
  { sport: 'rugby', league: 'six-nations', name: 'Six Nations' },

  // College Baseball/Softball
  { sport: 'baseball', league: 'college-baseball', name: 'College Baseball' },
  { sport: 'softball', league: 'college-softball', name: 'College Softball' },

  // College Volleyball
  { sport: 'volleyball', league: 'mens-college-volleyball', name: 'Men\'s College Volleyball' },
  { sport: 'volleyball', league: 'womens-college-volleyball', name: 'Women\'s College Volleyball' },

  // College Lacrosse
  { sport: 'lacrosse', league: 'mens-college-lacrosse', name: 'Men\'s College Lacrosse' },
  { sport: 'lacrosse', league: 'womens-college-lacrosse', name: 'Women\'s College Lacrosse' },
  { sport: 'lacrosse', league: 'pll', name: 'PLL Lacrosse' },

  // College Soccer
  { sport: 'soccer', league: 'usa.ncaa.m.1', name: 'Men\'s College Soccer' },
  { sport: 'soccer', league: 'usa.ncaa.w.1', name: 'Women\'s College Soccer' },

  // College Hockey
  { sport: 'hockey', league: 'mens-college-hockey', name: 'Men\'s College Hockey' },
  { sport: 'hockey', league: 'womens-college-hockey', name: 'Women\'s College Hockey' },

  // College Wrestling
  { sport: 'wrestling', league: 'college-wrestling', name: 'College Wrestling' },

  // College Gymnastics
  { sport: 'gymnastics', league: 'mens-college-gymnastics', name: 'Men\'s College Gymnastics' },
  { sport: 'gymnastics', league: 'womens-college-gymnastics', name: 'Women\'s College Gymnastics' },

  // Other Pro Sports
  { sport: 'volleyball', league: 'womens-volleyball', name: 'Pro Volleyball' },

  // Cricket
  { sport: 'cricket', league: 'icc-world-cup', name: 'Cricket World Cup' },
  { sport: 'cricket', league: 'ipl', name: 'Indian Premier League' },
]

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Validate query parameters
  const queryValidation = validateQueryParams(request, z.object({
    channels: z.string().optional(), // Comma-separated channel numbers
    deviceType: z.enum(['cable', 'directv']).optional().default('directv')
  }))
  if (isValidationError(queryValidation)) return queryValidation.error

  const { channels, deviceType } = queryValidation.data

  try {
    logger.debug('[LIVE_BY_CHANNEL] Fetching live game data for channels:', channels)

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

    // Get the appropriate network-to-channel mapping for this device type
    const networkMapping = getNetworkMapping(deviceType)

    // Fetch games from ESPN for all major sports
    for (const sportConfig of ESPN_SPORTS) {
      try {
        const games = await espnScoreboardAPI.getTodaysGames(sportConfig.sport, sportConfig.league)

        for (const game of games) {
          // Get broadcast networks
          const networks = espnScoreboardAPI.getAllNetworks(game)

          // Map each network to channel based on device type
          for (const network of networks) {
            let channelNumber = networkMapping[network]

            if (!channelNumber) {
              // Try case-insensitive match
              const lowerNetwork = network.toLowerCase()
              for (const [key, value] of Object.entries(networkMapping)) {
                if (key.toLowerCase() === lowerNetwork) {
                  channelNumber = value
                  break
                }
              }
            }

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
      } catch (error: any) {
        logger.error(`[LIVE_BY_CHANNEL] Error fetching ${sportConfig.name} games:`, error.message)
      }
    }

    logger.info(`[LIVE_BY_CHANNEL] Found games for ${Object.keys(channelGameMap).length} channels`)

    return NextResponse.json({
      success: true,
      channels: channelGameMap,
      fetchedAt: new Date().toISOString()
    })

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
    timeZone: 'America/Chicago'  // Central time for bar
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
