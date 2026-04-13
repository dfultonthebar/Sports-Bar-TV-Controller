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
import { HARDWARE_CONFIG } from '@/lib/hardware-config'
import { resolveChannelsForGame } from '@/lib/network-channel-resolver'

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

// ── Network → Cable / DirecTV channel resolution ────────────────────────
//
// As of v2.5.0 (Phase 2 of channel-resolver consolidation), the hardcoded
// NETWORK_TO_CABLE and NETWORK_TO_DIRECTV dicts that used to live here have
// been removed. Cable + DirecTV resolution is now handled by the shared
// `resolveChannelsForGame()` helper in `@/lib/network-channel-resolver`,
// which reads from the `channel_presets` + `station_aliases` tables. This
// preserves the Wisconsin RSN split (FanDuelWI ch 40 for Bucks vs
// BallyWIPlus ch 308 for Brewers) and removes per-location channel-number
// drift. See docs/CHANNEL_RESOLVER_CONSOLIDATION_PLAN.md.
//
// Streaming (NETWORK_TO_STREAMING_APP) is still resolved locally because
// the bartender remote needs the full {appId, name, packageName} shape for
// Fire TV app launch, which the shared helper does not yet provide.

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

        const entry = await buildDashboardEntry(game, cfg.name, cfg.sport)
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

async function buildDashboardEntry(game: any, league: string, sport?: string) {
  const networks = espnScoreboardAPI.getAllNetworks(game)
  const primaryNetwork = networks[0] || null
  const isLive = espnScoreboardAPI.isLive(game)
  const isCompleted = espnScoreboardAPI.isCompleted(game)

  const gameDate = new Date(game.date)
  const gameTime = gameDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: HARDWARE_CONFIG.venue.timezone,
  })

  // Channel mappings — resolved via the shared DB-backed helper. Walks the
  // full networks array, primary first (preserving the "ESPN often returns
  // a placeholder like 'MLB.TV' as the first entry but the real RSN like
  // 'Brewers.TV' later" behavior — `resolveChannelsForGame` orders
  // primaryNetwork first, then iterates through the rest).
  //
  // Wisconsin RSN safety: the helper preserves the FanDuelWI ch 40 (Bucks)
  // vs BallyWIPlus ch 308 (Brewers) split via the station_aliases table.
  // This cannot be verified live without an active Bucks/Brewers game in
  // the response, but is covered by the helper's unit tests
  // (apps/web/src/lib/__tests__/network-channel-resolver.test.ts).
  const resolved = await resolveChannelsForGame(
    {
      networks,
      primaryNetwork,
      league,
      sport: sport ?? null,
    },
    ['cable', 'directv']
  )
  const cableChannel = resolved.cableChannel
  const direcTVChannel = resolved.directvChannel

  // Streaming app mapping — still uses the local hardcoded map because the
  // bartender remote needs the {appId, name, packageName} shape for Fire TV
  // app launch, which the shared helper does not yet expose.
  const streamingApp = findStreamingAppFromNetworks(networks)

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

function findStreamingApp(network: string): { appId: string; name: string; packageName: string } | null {
  if (NETWORK_TO_STREAMING_APP[network]) return NETWORK_TO_STREAMING_APP[network]
  const lower = network.toLowerCase()
  for (const [key, value] of Object.entries(NETWORK_TO_STREAMING_APP)) {
    if (key.toLowerCase() === lower) return value
  }
  return null
}

function findStreamingAppFromNetworks(networks: string[]): { appId: string; name: string; packageName: string } | null {
  for (const network of networks) {
    if (!network) continue
    const hit = findStreamingApp(network)
    if (hit) return hit
  }
  return null
}
