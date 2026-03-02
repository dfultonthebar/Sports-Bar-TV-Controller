/**
 * API Route: Live Sports Dashboard
 *
 * Single aggregation endpoint for the bartender dashboard.
 * Fetches all ESPN leagues in parallel, categorizes games as
 * liveNow / comingUp / laterToday, and maps broadcast networks
 * to both cable/DirecTV channel numbers and streaming app IDs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { espnScoreboardAPI } from '@/lib/sports-apis/espn-scoreboard-api'

// ── ESPN sports (same list as live-by-channel) ──────────────────────────
const ESPN_SPORTS = [
  { sport: 'football', league: 'nfl', name: 'NFL' },
  { sport: 'football', league: 'college-football', name: 'College Football' },
  { sport: 'basketball', league: 'nba', name: 'NBA' },
  { sport: 'basketball', league: 'mens-college-basketball', name: 'College Basketball' },
  { sport: 'basketball', league: 'womens-college-basketball', name: "Women's College Basketball" },
  { sport: 'hockey', league: 'nhl', name: 'NHL' },
  { sport: 'baseball', league: 'mlb', name: 'MLB' },
  { sport: 'soccer', league: 'usa.1', name: 'MLS' },
  { sport: 'soccer', league: 'eng.1', name: 'Premier League' },
  { sport: 'soccer', league: 'uefa.champions', name: 'Champions League' },
  { sport: 'soccer', league: 'mex.1', name: 'Liga MX' },
  { sport: 'golf', league: 'pga', name: 'PGA Tour' },
  { sport: 'mma', league: 'ufc', name: 'UFC' },
  { sport: 'racing', league: 'f1', name: 'Formula 1' },
]

// ── Network → DirecTV channel ───────────────────────────────────────────
const NETWORK_TO_DIRECTV: Record<string, string> = {
  'ESPN': '206', 'ESPN2': '209', 'ESPNU': '208', 'ESPNEWS': '207', 'ESPN+': '206',
  'ESPN Deportes': '466',
  'FOX': '11', 'FS1': '219', 'FS2': '618', 'FOX Sports 1': '219', 'FOX Sports 2': '618',
  'Fox Deportes': '463', 'FOX Deportes': '463',
  'CBS': '5', 'NBC': '2', 'CBS Sports Network': '221', 'CBSSN': '221',
  'Peacock': '206',
  'TNT': '245', 'TBS': '247', 'truTV': '246', 'TruTV': '246',
  'NFL Network': '212', 'NFL RedZone': '211', 'Red Zone': '211', 'NFLN': '212',
  'NBA TV': '216', 'NBATV': '216',
  'MLB Network': '213', 'MLBN': '213',
  'NHL Network': '215', 'NHLN': '215',
  'Big Ten Network': '610', 'BTN': '610',
  'SEC Network': '611', 'SECN': '611',
  'ACC Network': '612', 'ACCN': '612',
  'Pac-12 Network': '613', 'Pac-12': '613',
  'USA': '242', 'USA Network': '242',
  'Golf Channel': '218', 'Golf': '218', 'GOLF': '218',
  'Tennis Channel': '217', 'Tennis': '217', 'TENNIS': '217',
  'NBCSN': '220', 'NBC Sports': '220',
  'beIN Sports': '620', 'beIN SPORTS': '620', 'BEIN': '620',
  'Amazon Prime Video': '9550', 'Prime Video': '9550',
  'Apple TV+': '9528', 'Paramount+': '247',
  'ABC': '7',
}

// ── Network → Cable (Spectrum) channel ──────────────────────────────────
const NETWORK_TO_CABLE: Record<string, string> = {
  'ESPN': '27', 'ESPN2': '28', 'ESPNU': '303', 'ESPNEWS': '305', 'ESPN+': '27',
  'FOX': '12', 'FS1': '75', 'FS2': '328', 'FOX Sports 1': '75', 'FOX Sports 2': '328',
  'CBS': '6', 'NBC': '13', 'ABC': '3',
  'CBS Sports Network': '322', 'CBSSN': '322',
  'TNT': '29', 'TBS': '25', 'truTV': '37', 'TruTV': '37',
  'NFL Network': '346', 'NFL RedZone': '347', 'Red Zone': '347', 'NFLN': '346',
  'NBA TV': '325', 'NBATV': '325',
  'MLB Network': '213', 'MLBN': '213',
  'NHL Network': '215', 'NHLN': '215',
  'Big Ten Network': '39', 'BTN': '39',
  'SEC Network': '65', 'SECN': '65',
  'ACC Network': '348', 'ACCN': '348',
  'USA': '26', 'USA Network': '26',
  'Golf Channel': '14', 'GOLF': '14',
  'Tennis Channel': '327', 'Tennis': '327', 'TENNIS': '327',
  'NBCSN': '159', 'NBC Sports': '159',
  'beIN Sports': '327', 'beIN SPORTS': '327', 'BEIN': '327',
  'CW': '10', 'The CW': '10',
}

// ── Network → Streaming app ID (for Fire TV launch) ────────────────────
const NETWORK_TO_STREAMING_APP: Record<string, { appId: string; name: string; packageName: string }> = {
  'ESPN':        { appId: 'espn-plus',      name: 'ESPN',         packageName: 'com.espn.gtv' },
  'ESPN2':       { appId: 'espn-plus',      name: 'ESPN',         packageName: 'com.espn.gtv' },
  'ESPNU':       { appId: 'espn-plus',      name: 'ESPN',         packageName: 'com.espn.gtv' },
  'ESPNEWS':     { appId: 'espn-plus',      name: 'ESPN',         packageName: 'com.espn.gtv' },
  'ESPN+':       { appId: 'espn-plus',      name: 'ESPN',         packageName: 'com.espn.gtv' },
  'FOX':         { appId: 'fox-sports',     name: 'Fox Sports',   packageName: 'com.fox.nowapp' },
  'FS1':         { appId: 'fox-sports',     name: 'Fox Sports',   packageName: 'com.fox.nowapp' },
  'FS2':         { appId: 'fox-sports',     name: 'Fox Sports',   packageName: 'com.fox.nowapp' },
  'FOX Sports 1':{ appId: 'fox-sports',     name: 'Fox Sports',   packageName: 'com.fox.nowapp' },
  'FOX Sports 2':{ appId: 'fox-sports',     name: 'Fox Sports',   packageName: 'com.fox.nowapp' },
  'CBS':         { appId: 'paramount-plus', name: 'Paramount+',   packageName: 'com.cbs.ott' },
  'Paramount+':  { appId: 'paramount-plus', name: 'Paramount+',   packageName: 'com.cbs.ott' },
  'NBC':         { appId: 'peacock',        name: 'Peacock',      packageName: 'com.peacocktv.peacockandroid' },
  'Peacock':     { appId: 'peacock',        name: 'Peacock',      packageName: 'com.peacocktv.peacockandroid' },
  'BTN':         { appId: 'peacock',        name: 'Peacock',      packageName: 'com.peacocktv.peacockandroid' },
  'Big Ten Network': { appId: 'peacock',    name: 'Peacock',      packageName: 'com.peacocktv.peacockandroid' },
  'TNT':         { appId: 'sling-tv',       name: 'Sling TV',     packageName: 'com.sling' },
  'TBS':         { appId: 'sling-tv',       name: 'Sling TV',     packageName: 'com.sling' },
  'Amazon Prime Video': { appId: 'amazon-prime', name: 'Prime Video', packageName: 'com.amazon.avod' },
  'Prime Video': { appId: 'amazon-prime',   name: 'Prime Video',  packageName: 'com.amazon.avod' },
  'ABC':         { appId: 'espn-plus',      name: 'ESPN',         packageName: 'com.espn.gtv' },
  'USA':         { appId: 'peacock',        name: 'Peacock',      packageName: 'com.peacocktv.peacockandroid' },
  'USA Network': { appId: 'peacock',        name: 'Peacock',      packageName: 'com.peacocktv.peacockandroid' },
}

// ── Response cache (60 second TTL) ──────────────────────────────────────
let cachedResponse: { data: any; timestamp: number } | null = null
const CACHE_TTL = 60 * 1000

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) return rateLimit.response

  // Return cached response if fresh
  if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
    return NextResponse.json({
      ...cachedResponse.data,
      cached: true,
      cacheAge: Math.round((Date.now() - cachedResponse.timestamp) / 1000),
    })
  }

  try {
    logger.info('[LIVE_DASHBOARD] Fetching fresh ESPN data for all leagues')

    const sportResults = await Promise.allSettled(
      ESPN_SPORTS.map(async (cfg) => {
        const games = await espnScoreboardAPI.getTodaysGames(cfg.sport, cfg.league)
        return { cfg, games }
      })
    )

    const now = Date.now()
    const twoHoursFromNow = now + 2 * 60 * 60 * 1000

    const liveNow: any[] = []
    const comingUp: any[] = []
    const todaySchedule: any[] = []
    const seenGameIds = new Set<string>()

    for (const result of sportResults) {
      if (result.status === 'rejected') continue
      const { cfg, games } = result.value

      for (const game of games) {
        const gameId = `${cfg.league}-${game.homeTeam?.abbreviation}-${game.awayTeam?.abbreviation}-${game.date}`
        if (seenGameIds.has(gameId)) continue
        seenGameIds.add(gameId)

        const entry = buildDashboardEntry(game, cfg.name)
        const gameTime = new Date(game.date).getTime()
        const isLive = espnScoreboardAPI.isLive(game)
        const isCompleted = espnScoreboardAPI.isCompleted(game)

        if (isLive) {
          liveNow.push(entry)
        } else if (!isCompleted && gameTime > now && gameTime <= twoHoursFromNow) {
          comingUp.push(entry)
        } else if (!isCompleted && gameTime > now) {
          todaySchedule.push(entry)
        }
      }
    }

    // Sort: live by period desc, coming up by start time, schedule by time
    liveNow.sort((a, b) => (b.period || 0) - (a.period || 0))
    comingUp.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    todaySchedule.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    const responseData = {
      success: true,
      liveNow,
      comingUp,
      todaySchedule,
      totalGames: liveNow.length + comingUp.length + todaySchedule.length,
      fetchedAt: new Date().toISOString(),
    }

    cachedResponse = { data: responseData, timestamp: Date.now() }

    logger.info(
      `[LIVE_DASHBOARD] ${liveNow.length} live, ${comingUp.length} coming up, ${todaySchedule.length} later`
    )

    return NextResponse.json(responseData)
  } catch (error: any) {
    logger.error('[LIVE_DASHBOARD] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch live dashboard data', details: error.message },
      { status: 500 }
    )
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function buildDashboardEntry(game: any, league: string) {
  const networks = espnScoreboardAPI.getAllNetworks(game)
  const primaryNetwork = networks[0] || null
  const isLive = espnScoreboardAPI.isLive(game)
  const isCompleted = espnScoreboardAPI.isCompleted(game)

  const gameDate = new Date(game.date)
  const gameTime = gameDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago',
  })

  // Channel mappings
  const direcTVChannel = primaryNetwork ? findChannel(primaryNetwork, NETWORK_TO_DIRECTV) : null
  const cableChannel = primaryNetwork ? findChannel(primaryNetwork, NETWORK_TO_CABLE) : null

  // Streaming app mapping
  const streamingApp = primaryNetwork ? findStreamingApp(primaryNetwork) : null

  // Minutes until start
  const minutesUntilStart = Math.max(0, Math.round((gameDate.getTime() - Date.now()) / 60000))

  return {
    league,
    homeTeam: game.homeTeam?.displayName || 'TBD',
    awayTeam: game.awayTeam?.displayName || 'TBD',
    homeAbbrev: game.homeTeam?.abbreviation || '?',
    awayAbbrev: game.awayTeam?.abbreviation || '?',
    homeScore: game.homeTeam?.score ?? null,
    awayScore: game.awayTeam?.score ?? null,
    clock: game.status?.displayClock || '',
    period: game.status?.period || 0,
    statusDetail: game.status?.type?.shortDetail || '',
    statusState: game.status?.type?.state || 'pre',
    isLive,
    isCompleted,
    startTime: game.date,
    gameTime,
    minutesUntilStart,
    networks,
    primaryNetwork,
    direcTVChannel,
    cableChannel,
    streamingApp,
    venue: game.venue?.fullName || '',
  }
}

function findChannel(network: string, mapping: Record<string, string>): string | null {
  if (mapping[network]) return mapping[network]
  const lower = network.toLowerCase()
  for (const [key, value] of Object.entries(mapping)) {
    if (key.toLowerCase() === lower) return value
  }
  return null
}

function findStreamingApp(network: string): { appId: string; name: string; packageName: string } | null {
  if (NETWORK_TO_STREAMING_APP[network]) return NETWORK_TO_STREAMING_APP[network]
  const lower = network.toLowerCase()
  for (const [key, value] of Object.entries(NETWORK_TO_STREAMING_APP)) {
    if (key.toLowerCase() === lower) return value
  }
  return null
}
