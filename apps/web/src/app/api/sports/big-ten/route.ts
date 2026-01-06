/**
 * Big Ten Games API
 *
 * Returns Big Ten basketball and football games from ESPN
 * Used by Fire TV streaming guide to show games available on Big Ten Plus
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { espnAPI, ESPNGame } from '@/lib/sports-apis/espn-api'
import { logger } from '@sports-bar/logger'

interface BigTenGameFormatted {
  id: string
  title: string
  shortName: string
  sport: 'Basketball' | 'Football'
  date: string
  startTime: string
  status: string
  isLive: boolean
  isCompleted: boolean
  teams: {
    home: {
      name: string
      abbreviation: string
      score?: string
      logo?: string
    }
    away: {
      name: string
      abbreviation: string
      score?: string
      logo?: string
    }
  }
  broadcast: {
    network: string
    isOnBTN: boolean  // Big Ten Network
    isOnBigTenPlus: boolean  // Streaming exclusive
  }
  venue?: string
  deepLink?: string
}

// Networks that indicate the game is on Big Ten Plus or BTN
const BIG_TEN_NETWORKS = ['BTN', 'Big Ten Network', 'B1G+', 'Big Ten Plus', 'BTN+']
const BTN_STREAMING_ONLY = ['B1G+', 'Big Ten Plus', 'BTN+']

function formatGame(game: ESPNGame, sport: 'Basketball' | 'Football'): BigTenGameFormatted {
  const competition = game.competitions?.[0]
  const homeTeam = competition?.competitors?.find(c => c.homeAway === 'home')
  const awayTeam = competition?.competitors?.find(c => c.homeAway === 'away')
  const status = competition?.status?.type
  const broadcasts = competition?.broadcasts || []

  // Get broadcast network
  const networkNames = broadcasts.flatMap(b => b.names || [])
  const primaryNetwork = networkNames[0] || 'TBD'
  const isOnBTN = networkNames.some(n => BIG_TEN_NETWORKS.some(btn => n.toUpperCase().includes(btn.toUpperCase())))
  const isOnBigTenPlus = networkNames.some(n => BTN_STREAMING_ONLY.some(btn => n.toUpperCase().includes(btn.toUpperCase())))

  return {
    id: game.id,
    title: game.name || game.shortName,
    shortName: game.shortName,
    sport,
    date: game.date,
    startTime: new Date(game.date).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }),
    status: status?.shortDetail || status?.description || 'Scheduled',
    isLive: status?.state === 'in',
    isCompleted: status?.completed || false,
    teams: {
      home: {
        name: homeTeam?.team?.displayName || homeTeam?.team?.name || 'TBD',
        abbreviation: homeTeam?.team?.abbreviation || '',
        score: homeTeam?.score,
        logo: homeTeam?.team?.logos?.[0]?.href
      },
      away: {
        name: awayTeam?.team?.displayName || awayTeam?.team?.name || 'TBD',
        abbreviation: awayTeam?.team?.abbreviation || '',
        score: awayTeam?.score,
        logo: awayTeam?.team?.logos?.[0]?.href
      }
    },
    broadcast: {
      network: primaryNetwork,
      isOnBTN,
      isOnBigTenPlus
    },
    venue: competition?.venue?.fullName,
    // Deep link to Big Ten Plus app
    deepLink: isOnBTN || isOnBigTenPlus ? 'bigtenplus://live' : undefined
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport') // 'basketball', 'football', or null for both
    const filter = searchParams.get('filter') // 'live', 'today', 'upcoming', 'btn' (BTN only)
    const date = searchParams.get('date') // YYYY-MM-DD format

    logger.info(`[BIG TEN API] Fetching games - sport: ${sport || 'all'}, filter: ${filter || 'all'}, date: ${date || 'today'}`)

    let games: BigTenGameFormatted[] = []

    // Fetch games based on sport filter
    if (!sport || sport === 'basketball') {
      const basketballGames = await espnAPI.getBigTenBasketballGames(date || undefined)
      games.push(...basketballGames.map(g => formatGame(g, 'Basketball')))
    }

    if (!sport || sport === 'football') {
      const footballGames = await espnAPI.getBigTenFootballGames(date || undefined)
      games.push(...footballGames.map(g => formatGame(g, 'Football')))
    }

    // Apply filters
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    if (filter === 'live') {
      games = games.filter(g => g.isLive)
    } else if (filter === 'today') {
      games = games.filter(g => {
        const gameDate = new Date(g.date)
        return gameDate >= todayStart && gameDate <= todayEnd
      })
    } else if (filter === 'upcoming') {
      games = games.filter(g => !g.isLive && !g.isCompleted && new Date(g.date) > now)
    } else if (filter === 'btn') {
      // Only games on Big Ten Network or Big Ten Plus
      games = games.filter(g => g.broadcast.isOnBTN || g.broadcast.isOnBigTenPlus)
    }

    // Sort by date
    games.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Separate live games to show first
    const liveGames = games.filter(g => g.isLive)
    const otherGames = games.filter(g => !g.isLive)

    logger.info(`[BIG TEN API] Found ${games.length} games (${liveGames.length} live)`)

    return NextResponse.json({
      success: true,
      games: [...liveGames, ...otherGames],
      summary: {
        total: games.length,
        live: liveGames.length,
        basketball: games.filter(g => g.sport === 'Basketball').length,
        football: games.filter(g => g.sport === 'Football').length,
        onBTN: games.filter(g => g.broadcast.isOnBTN).length
      },
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    logger.error('[BIG TEN API] Error fetching games:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch Big Ten games',
      games: []
    }, { status: 500 })
  }
}
