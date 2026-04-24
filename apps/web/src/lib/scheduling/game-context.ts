/**
 * GameWithContext — unified data shape shared by the channel-guide and
 * scheduler data paths.
 *
 * Before v2.26.0, each consumer (channel-guide route, AI Suggest,
 * ScheduledGamesPanel) reassembled the same five pieces of context
 * ad-hoc:
 *   1. The game itself (from game_schedules)
 *   2. Resolved channel/app routes (from network-channel-resolver)
 *   3. Overlapping allocations on any input during the game's window
 *   4. ScheduledOverrideDefaults rules that match the teams
 *   5. Learned patterns (team routing + league duration)
 *
 * That duplication was the root of inconsistency bugs like v2.25.3
 * (AI Suggest proposing 76ers on DirecTV 3 while Brewers were booked).
 * By composing these into one builder + one shape, drift becomes
 * impossible: whoever updates the context shape updates it for
 * everyone.
 *
 * Phase 1 (this file) ships the builder WITHOUT any consumer migrations.
 * Phase 2 migrates AI Suggest behind a feature flag. Phases 3-5 follow.
 */

import { eq, inArray, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { logger } from '@sports-bar/logger'
import { resolveChannelsForGame } from '@/lib/network-channel-resolver'
import { getAllocationConflicts } from '@/lib/scheduling/allocation-conflicts'
import { previewOverrideDefaults } from '@/lib/scheduling/apply-override-defaults'

// ---------- Types ----------

export interface GameBasics {
  id: string
  espnEventId: string | null
  homeTeamName: string
  awayTeamName: string
  league: string
  sport: string | null
  scheduledStart: number
  estimatedEnd: number
  status: string
  primaryNetwork: string | null
  broadcastNetworks: string[]
  isPriorityGame: boolean
}

export interface ResolvedRoutes {
  cableChannel: { number: string; presetName: string } | null
  directvChannel: { number: string; presetName: string } | null
  streamingApp: { app: string; code: string } | null
  resolvedVia: 'preset' | 'alias' | 'streaming' | 'override' | null
  primaryMatch: string | null
  /**
   * true if ANY of the three routes resolved at this venue. Consumers
   * that filter to "playable only" should use this instead of
   * re-checking each field.
   */
  playable: boolean
}

export interface AllocationSummary {
  allocationId: string
  inputSourceId: string
  inputSourceName: string | null
  inputType: string | null
  allocatedAt: number
  expectedFreeAt: number
  status: 'pending' | 'active'
  gameLabel: string
  isThisGame: boolean
}

export interface OverrideInPlay {
  team: string
  outputNum: number
  action: 'exclude' | 'include'
  isHomeTeam: boolean
  occurrences: number
}

export interface PatternHint {
  patternType: string
  patternKey: string
  observationCount: number
  confidence: number
  data: any
}

export interface LeagueDurationStats {
  league: string
  actualDurationAvgMin: number | null
  overrunAvgMin: number | null
  recommendedBufferMin: number | null
  sampleCount: number
}

export interface GameWithContext {
  game: GameBasics
  /**
   * Which routes are playable at THIS venue. Pre-filtered by
   * Fire TV app availability so consumers don't have to re-gate.
   */
  routes: ResolvedRoutes
  /**
   * Every pending/active allocation whose [allocatedAt, expectedFreeAt)
   * window overlaps the game's scheduled window (± padding). Sorted
   * by allocatedAt. The allocation for THIS game (if it exists) has
   * `isThisGame=true` so consumers can filter it out when asking
   * "who else is booked at this time".
   */
  allocations: AllocationSummary[]
  /**
   * ScheduledOverrideDefaults rules matching the home or away team.
   * Read-only preview — does not modify state.
   */
  overridesInPlay: OverrideInPlay[]
  /**
   * Learned team-routing patterns from `scheduling_patterns` that
   * mention this game's teams. Empty array if none.
   */
  patternHints: PatternHint[]
  /**
   * Per-league duration learning from v2.22.12. null if the
   * scheduler hasn't accumulated enough samples for this league.
   */
  leagueDuration: LeagueDurationStats | null
}

// ---------- Internal helpers ----------

function rowToGameBasics(row: any): GameBasics {
  let broadcastNetworks: string[] = []
  try {
    broadcastNetworks = row.broadcast_networks ? JSON.parse(row.broadcast_networks) : []
  } catch { /* ignore */ }
  return {
    id: row.id,
    espnEventId: row.espn_event_id ?? null,
    homeTeamName: row.home_team_name,
    awayTeamName: row.away_team_name,
    league: row.league,
    sport: row.sport ?? null,
    scheduledStart: row.scheduled_start,
    estimatedEnd: row.estimated_end,
    status: row.status,
    primaryNetwork: row.primary_network ?? null,
    broadcastNetworks,
    isPriorityGame: !!row.is_priority_game,
  }
}

async function loadPatternsForTeams(teams: string[]): Promise<PatternHint[]> {
  if (teams.length === 0) return []
  try {
    const rows = (await db.all(sql`
      SELECT pattern_type, pattern_key, pattern_data, observation_count, confidence
      FROM scheduling_patterns
      WHERE pattern_type IN ('team_routing', 'league_priority', 'tv_zone_preference')
        AND (${sql.join(teams.map(t => sql`pattern_data LIKE ${'%' + t + '%'}`), sql` OR `)})
      ORDER BY observation_count DESC
      LIMIT 10
    `)) as Array<{ pattern_type: string; pattern_key: string; pattern_data: string; observation_count: number; confidence: number }>

    return rows.map(r => {
      let data: any = null
      try { data = JSON.parse(r.pattern_data) } catch { /* ignore */ }
      return {
        patternType: r.pattern_type,
        patternKey: r.pattern_key,
        observationCount: r.observation_count,
        confidence: r.confidence,
        data,
      }
    })
  } catch (err) {
    logger.warn('[GAME-CONTEXT] pattern lookup failed (non-fatal):', err)
    return []
  }
}

async function loadLeagueDuration(league: string): Promise<LeagueDurationStats | null> {
  if (!league) return null
  try {
    const row = (await db.all(sql`
      SELECT pattern_data
      FROM scheduling_patterns
      WHERE pattern_type = 'league_duration' AND pattern_key = ${league}
      LIMIT 1
    `)) as Array<{ pattern_data: string }>
    if (row.length === 0) return null
    const data = JSON.parse(row[0].pattern_data)
    return {
      league,
      actualDurationAvgMin: typeof data.actualDurationAvgMin === 'number' ? data.actualDurationAvgMin : null,
      overrunAvgMin: typeof data.overrunAvgMin === 'number' ? data.overrunAvgMin : null,
      recommendedBufferMin: typeof data.recommendedBufferMin === 'number' ? data.recommendedBufferMin : null,
      sampleCount: typeof data.sampleCount === 'number' ? data.sampleCount : 0,
    }
  } catch (err) {
    logger.warn(`[GAME-CONTEXT] league_duration lookup failed for ${league}:`, err)
    return null
  }
}

/**
 * Resolve whether Fire TV apps needed for this game's streaming route
 * are actually installed at any of THIS venue's Fire TVs. Without
 * this, `routes.streamingApp` would claim "playable" even at a venue
 * with no matching subscription. This is the same venue-gating logic
 * ai-suggest uses inline today.
 */
async function getVenueStreamingApps(): Promise<Set<string>> {
  const apps = new Set<string>()
  try {
    const firetvSources = await db
      .select()
      .from(schema.inputSources)
      .where(eq(schema.inputSources.type, 'firetv'))
      .all()
    for (const src of firetvSources) {
      if (!src.isActive) continue
      try {
        const list = JSON.parse(src.availableNetworks || '[]') as string[]
        for (const app of list) {
          if (app) apps.add(app.toLowerCase().trim())
        }
      } catch { /* ignore */ }
    }
  } catch (err) {
    logger.warn('[GAME-CONTEXT] venue streaming apps lookup failed:', err)
  }
  return apps
}

/**
 * Collect every pending/active allocation in a window across ALL inputs,
 * joined with input_sources for names + types. Used by the builder
 * without per-input iteration.
 */
async function loadAllocationsInWindow(startUnix: number, endUnix: number): Promise<AllocationSummary[]> {
  if (startUnix >= endUnix) return []
  try {
    const rows = (await db.all(sql`
      SELECT
        isa.id AS allocationId,
        isa.input_source_id AS inputSourceId,
        isa.game_schedule_id AS gameScheduleId,
        isa.allocated_at AS allocatedAt,
        isa.expected_free_at AS expectedFreeAt,
        isa.status AS status,
        isrc.name AS inputName,
        isrc.type AS inputType,
        gs.home_team_name AS homeTeam,
        gs.away_team_name AS awayTeam
      FROM input_source_allocations isa
      LEFT JOIN input_sources isrc ON isa.input_source_id = isrc.id
      LEFT JOIN game_schedules gs ON isa.game_schedule_id = gs.id
      WHERE isa.status IN ('pending', 'active')
        AND isa.allocated_at < ${endUnix}
        AND isa.expected_free_at > ${startUnix}
      ORDER BY isa.allocated_at
    `)) as Array<any>

    return rows.map(r => ({
      allocationId: r.allocationId,
      inputSourceId: r.inputSourceId,
      inputSourceName: r.inputName ?? null,
      inputType: r.inputType ?? null,
      allocatedAt: r.allocatedAt,
      expectedFreeAt: r.expectedFreeAt,
      status: r.status as 'pending' | 'active',
      gameLabel: [r.awayTeam, r.homeTeam].filter(Boolean).join(' @ ') || 'existing booking',
      isThisGame: false,
      _gameScheduleId: r.gameScheduleId,
    })) as any
  } catch (err) {
    logger.warn('[GAME-CONTEXT] allocation window lookup failed:', err)
    return []
  }
}

// ---------- Public API ----------

export interface BuildContextOptions {
  /**
   * Pad the game's [scheduledStart, estimatedEnd] window by this many
   * seconds on each side when looking for overlapping allocations.
   * Default 15 minutes — covers pre-game tune-up and typical overrun.
   */
  windowPadSeconds?: number
}

/**
 * Build a GameWithContext for a single game id. Convenience wrapper
 * around buildGameContexts([id]).
 */
export async function buildGameContext(
  gameId: string,
  options: BuildContextOptions = {},
): Promise<GameWithContext | null> {
  const list = await buildGameContexts([gameId], options)
  return list[0] ?? null
}

/**
 * Build GameWithContext for a batch of game ids. Batch form avoids
 * the N+1 DB pattern when the Scheduler page renders a list.
 *
 * Ordering of the returned array matches the input `gameIds` array;
 * missing games are skipped (not returned as null).
 */
export async function buildGameContexts(
  gameIds: string[],
  options: BuildContextOptions = {},
): Promise<GameWithContext[]> {
  if (gameIds.length === 0) return []
  const pad = options.windowPadSeconds ?? 15 * 60

  // 1. Load the games
  const gameRows = (await db.all(sql`
    SELECT * FROM game_schedules WHERE id IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})
  `)) as Array<any>
  if (gameRows.length === 0) return []
  const gameMap = new Map<string, GameBasics>()
  for (const row of gameRows) {
    gameMap.set(row.id, rowToGameBasics(row))
  }

  // 2. Window for allocations = union of all games' padded windows
  let windowStart = Infinity
  let windowEnd = -Infinity
  for (const g of gameMap.values()) {
    windowStart = Math.min(windowStart, g.scheduledStart - pad)
    windowEnd = Math.max(windowEnd, g.estimatedEnd + pad)
  }

  // 3. Batch-load shared dependencies
  const [allocations, venueApps] = await Promise.all([
    loadAllocationsInWindow(windowStart, windowEnd),
    getVenueStreamingApps(),
  ])

  // 4. Build context per game
  const results: GameWithContext[] = []
  for (const id of gameIds) {
    const game = gameMap.get(id)
    if (!game) continue

    // Resolve routes
    const resolved = await resolveChannelsForGame(
      {
        networks: game.broadcastNetworks,
        primaryNetwork: game.primaryNetwork,
        league: game.league,
        sport: game.sport,
      },
      ['cable', 'directv', 'streaming'],
    )
    // Gate streaming by venue-installed apps
    let streamingApp = resolved.streamingApp
    if (streamingApp && !venueApps.has(streamingApp.app.toLowerCase())) {
      streamingApp = null
    }
    const cableChannel = resolved.cableChannel
      ? { number: resolved.cableChannel, presetName: resolved.primaryMatch || '' }
      : null
    const directvChannel = resolved.directvChannel
      ? { number: resolved.directvChannel, presetName: resolved.primaryMatch || '' }
      : null
    const routes: ResolvedRoutes = {
      cableChannel,
      directvChannel,
      streamingApp,
      resolvedVia: resolved.resolvedVia,
      primaryMatch: resolved.primaryMatch,
      playable: !!(cableChannel || directvChannel || streamingApp),
    }

    // Filter the pre-loaded allocations to those overlapping THIS game's window
    const gameStart = game.scheduledStart - pad
    const gameEnd = game.estimatedEnd + pad
    const relevantAllocations = allocations
      .filter((a: any) => a.allocatedAt < gameEnd && a.expectedFreeAt > gameStart)
      .map((a: any) => ({
        ...a,
        isThisGame: a._gameScheduleId === id,
      }))
      .map((a: any) => {
        const { _gameScheduleId, ...clean } = a
        return clean as AllocationSummary
      })

    // Override defaults + patterns + league duration (parallel)
    const [overridePreview, patternHints, leagueDuration] = await Promise.all([
      previewOverrideDefaults(game.homeTeamName, game.awayTeamName),
      loadPatternsForTeams([game.homeTeamName, game.awayTeamName].filter(t => !!t)),
      loadLeagueDuration(game.league),
    ])

    results.push({
      game,
      routes,
      allocations: relevantAllocations,
      overridesInPlay: overridePreview.rulesInPlay,
      patternHints,
      leagueDuration,
    })
  }

  return results
}
