/**
 * API Route: AI Scheduling Suggestions
 *
 * GET /api/scheduling/ai-suggest
 *
 * Fetches upcoming games from the sports guide, reads learned scheduling patterns
 * from the database, and uses Ollama (llama3.1:8b) to generate intelligent
 * scheduling suggestions for cable box / TV routing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, sql, gte } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateQueryParams, z } from '@/lib/validation'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'
import { resolveChannelsForGame } from '@/lib/network-channel-resolver'

const OLLAMA_URL = `${HARDWARE_CONFIG.ollama.baseUrl}/api/generate`
// AI Suggest runs Ollama with a longer prompt (up to 12 diverse suggestions)
// than other routes. CPU-only llama3.1:8b takes ~20s per suggestion generated,
// so 10-12 suggestions = ~240s. Extend past the shared HARDWARE_CONFIG default
// to avoid aborts during legitimate generation.
const OLLAMA_TIMEOUT_MS = Math.max(HARDWARE_CONFIG.ollama.timeout, 300000) // ≥ 300s
const OLLAMA_MODEL = HARDWARE_CONFIG.ollama.model

// ---------- types ----------

interface SchedulingPattern {
  id: string
  pattern_type: string
  pattern_key: string
  pattern_data: string
  observation_count: number
  sample_size: number
  confidence: number
  first_observed: number
  last_observed: number
}

interface GameListing {
  time: string
  date?: string
  title: string
  league: string
  homeTeam: string
  awayTeam: string
  stations: string[]
  channelNumber?: string   // cable channel
  channelName?: string
  directvChannel?: string  // directv channel (different numbering)
  streamingApp?: string    // app name for firetv inputs (e.g. "Prime Video", "Apple TV+")
}

interface AISuggestion {
  gameId: string
  homeTeam: string
  awayTeam: string
  league: string
  startTime: string
  channelNumber: string
  channelName: string
  appName?: string          // populated for firetv suggestions
  suggestedInput: string
  suggestedInputId: string
  suggestedDeviceId: string
  suggestedDeviceType: 'cable' | 'directv' | 'firetv'
  suggestedOutputs: number[]
  confidence: number
  reasoning: string
}

// ---------- helper: fetch upcoming games from game_schedules (ESPN data) ----------
// Uses the same data source as the bartender remote channel guide, resolved
// through the shared network-channel-resolver for correct per-device-type
// channel numbers.

async function fetchUpcomingGames(): Promise<GameListing[]> {
  try {
    const nowUnix = Math.floor(Date.now() / 1000)
    const twelveHoursLater = nowUnix + 12 * 60 * 60

    const rows = await db.select().from(schema.gameSchedules).where(
      and(
        gte(schema.gameSchedules.scheduledStart, nowUnix),
        sql`${schema.gameSchedules.scheduledStart} <= ${twelveHoursLater}`,
        sql`${schema.gameSchedules.status} != 'completed'`,
      )
    )

    // Collect apps that are actually available on at least one firetv input at
    // this venue. An "installed" app is one the venue has a login for — if
    // nobody at Holmgren has MLB.TV, a Cubs/Mets MLB.TV-only game is not
    // playable here even though we have Fire TVs. Store as lowercase for
    // case-insensitive comparison against the resolver's app names.
    const firetvSources = await db.select().from(schema.inputSources).where(
      and(eq(schema.inputSources.isActive, true), eq(schema.inputSources.type, 'firetv'))
    )
    const availableApps = new Set<string>()
    for (const src of firetvSources) {
      try {
        const apps = JSON.parse(src.availableNetworks || '[]') as string[]
        for (const app of apps) {
          if (app) availableApps.add(app.toLowerCase().trim())
        }
      } catch { /* ignore */ }
    }
    logger.info(`[AI-SUGGEST] Available firetv apps at venue: ${[...availableApps].join(', ') || '(none)'}`)

    const games: GameListing[] = []
    let skippedNoChannel = 0
    for (const row of rows) {
      // Parse broadcast networks from JSON
      let networks: string[] = []
      try { networks = JSON.parse(row.broadcastNetworks || '[]') } catch { /* ignore */ }

      // Resolve channels using the same resolver as the bartender remote.
      // Include 'streaming' so Prime Video / Apple TV+ / Peacock games can
      // be routed to a Fire TV input.
      const resolved = await resolveChannelsForGame(
        { networks, primaryNetwork: networks[0] || null, league: row.league, sport: row.sport },
        ['cable', 'directv', 'streaming']
      )

      // Gate the streaming route against apps actually installed on our
      // Fire TVs. If the resolved app is MLB.TV but no venue Fire TV has
      // MLB.TV, clear the streaming app so this doesn't count as a playable
      // route.
      let streamingAppName = resolved.streamingApp?.app || ''
      if (streamingAppName && !availableApps.has(streamingAppName.toLowerCase())) {
        streamingAppName = ''
      }

      // Skip games that don't have ANY playable route at this venue.
      // Out-of-market RSN broadcasts (e.g. BravesVision, Marquee Sports Net)
      // with no streaming fallback fall out here — our cable/DirecTV lineup
      // doesn't carry them and there's no Fire TV app for them either.
      if (!resolved.cableChannel && !resolved.directvChannel && !streamingAppName) {
        skippedNoChannel++
        continue
      }

      const gameTime = new Date(row.scheduledStart * 1000)

      // Tolerate empty home/away names (UFC/PPV — see espn-sync-service.ts).
      // The prompt builder applies its own fallback when both are empty.
      const awayName = row.awayTeamName || ''
      const homeName = row.homeTeamName || ''
      const titleStr = (awayName && homeName)
        ? `${awayName} at ${homeName}`
        : (awayName || homeName || `${row.league || 'event'}`.toUpperCase())

      games.push({
        time: gameTime.toISOString(),
        title: titleStr,
        league: row.league || 'Unknown',
        homeTeam: homeName,
        awayTeam: awayName,
        stations: networks,
        channelNumber: resolved.cableChannel || '',
        channelName: resolved.primaryMatch || networks[0] || '',
        directvChannel: resolved.directvChannel || '',
        streamingApp: streamingAppName,
      })
    }

    // Sort by importance so the 30-cap picks high-value games instead of
    // whatever comes first chronologically. With 23 leagues synced, a raw
    // time sort would fill the prompt with routine college baseball games
    // and push the Brewers / MLS / UFL games out.
    //
    // Priority tiers (lower number = higher priority):
    //   1. Home-team games (Brewers/Bucks/Packers/Badgers) — always include
    //   2. Pro leagues (MLB, NBA, NHL, NFL, MLS, Premier League, UFC, UFL,
    //      F1, NASCAR, IndyCar, PGA, LPGA)
    //   3. College football and men's/women's college basketball
    //   4. Other college sports (college baseball, softball, hockey, tennis)
    const HOME_TEAMS_RE = /(Brewers|Bucks|Packers|Badgers)/i
    const PRO_LEAGUES = new Set([
      'mlb', 'nba', 'wnba', 'nhl', 'nfl', 'ufl',
      'usa.1', 'eng.1', 'uefa.champions',
      'f1', 'nascar-premier', 'irl',
      'pga', 'lpga', 'ufc', 'atp', 'wta',
    ])
    const TOP_COLLEGE = new Set(['college-football', 'mens-college-basketball', 'womens-college-basketball'])
    const priorityOf = (g: GameListing): number => {
      if (HOME_TEAMS_RE.test(g.homeTeam) || HOME_TEAMS_RE.test(g.awayTeam)) return 1
      if (PRO_LEAGUES.has(g.league)) return 2
      if (TOP_COLLEGE.has(g.league)) return 3
      return 4
    }
    games.sort((a, b) => {
      const pa = priorityOf(a)
      const pb = priorityOf(b)
      if (pa !== pb) return pa - pb
      return new Date(a.time).getTime() - new Date(b.time).getTime()
    })
    const capped = games.slice(0, 30)
    logger.info(
      `[AI-SUGGEST] Games in window: ${rows.length}, playable at this venue: ${games.length} (skipped ${skippedNoChannel} with no resolvable channel), capped to ${capped.length}`
    )
    return capped
  } catch (err: any) {
    logger.error('[AI-SUGGEST] Error fetching games from game_schedules:', err)
    return []
  }
}

// ---------- helper: load scheduling patterns (raw SQL) ----------

async function loadSchedulingPatterns(): Promise<SchedulingPattern[]> {
  try {
    const rows = await db.all(
      sql`SELECT * FROM scheduling_patterns ORDER BY observation_count DESC LIMIT 100`
    ) as SchedulingPattern[]
    logger.info(`[AI-SUGGEST] Loaded ${rows.length} scheduling patterns`)
    return rows
  } catch (err: any) {
    // Table may not exist yet
    logger.warn(`[AI-SUGGEST] Could not load scheduling_patterns (table may not exist): ${err.message}`)
    return []
  }
}

// ---------- helper: load historical allocation patterns from existing data ----------

async function loadHistoricalPatterns(): Promise<string> {
  try {
    const rows = await db.all(sql`
      SELECT
        isa.input_source_type,
        isa.channel_number,
        isa.tv_output_ids,
        isa.status,
        isa.scheduled_by,
        gs.home_team_name,
        gs.away_team_name,
        gs.league,
        isrc.name as input_name,
        isrc.matrix_input_id
      FROM input_source_allocations isa
      JOIN game_schedules gs ON isa.game_schedule_id = gs.id
      JOIN input_sources isrc ON isa.input_source_id = isrc.id
      WHERE isa.status IN ('completed', 'active')
      ORDER BY isa.allocated_at DESC
      LIMIT 50
    `) as any[]

    if (rows.length === 0) return 'No historical scheduling data available yet.'

    const summary = rows.map(r => {
      let outputs: number[] = []
      try { outputs = JSON.parse(r.tv_output_ids || '[]') } catch { /* ignore */ }
      return `- ${r.away_team_name || '?'} at ${r.home_team_name || '?'} (${r.league}): Input "${r.input_name}" (matrix input ${r.matrix_input_id || 'N/A'}), ch ${r.channel_number || 'N/A'}, TVs ${outputs.join(',') || 'none'}`
    })

    return summary.join('\n')
  } catch (err: any) {
    logger.warn(`[AI-SUGGEST] Could not load historical patterns: ${err.message}`)
    return 'No historical scheduling data available.'
  }
}

// ---------- helper: load input sources ----------
//
// `currentlyAllocated` must reflect LIVE pending/active allocations in the
// AI-suggest window, not the `input_sources.currently_allocated` stored
// column which can drift (it's updated lazily by unrelated flows and is
// often stale). v2.25.3: we compute it from input_source_allocations
// rows that overlap the coming 12h window. That window matches the
// games pulled by fetchUpcomingGames() — so any input marked BUSY here
// has a real conflict against the game list the AI is about to plan.
//
// Also returns the per-input list of upcoming bookings so the prompt
// can say "DirecTV 3: BUSY 12:40-15:49 with Brewers @ Marlins" rather
// than just BUSY. Gives the AI the time info to reason about whether
// a later 76ers tip-off at 20:00 can still land on DirecTV 3 after
// Brewers clears.

async function loadInputSources() {
  const sources = await db.select().from(schema.inputSources).where(eq(schema.inputSources.isActive, true))

  const nowUnix = Math.floor(Date.now() / 1000)
  const windowEnd = nowUnix + 12 * 60 * 60

  // Pull pending+active allocations in our planning window, plus game
  // names for display.
  const activeAllocations = await db.all(sql`
    SELECT
      isa.input_source_id AS inputSourceId,
      isa.allocated_at AS allocatedAt,
      isa.expected_free_at AS expectedFreeAt,
      isa.status AS status,
      gs.home_team_name AS homeTeam,
      gs.away_team_name AS awayTeam
    FROM input_source_allocations isa
    JOIN game_schedules gs ON isa.game_schedule_id = gs.id
    WHERE isa.status IN ('pending', 'active')
      AND isa.expected_free_at >= ${nowUnix}
      AND isa.allocated_at <= ${windowEnd}
  `) as Array<{
    inputSourceId: string
    allocatedAt: number
    expectedFreeAt: number
    status: string
    homeTeam: string | null
    awayTeam: string | null
  }>

  const bookingsByInput = new Map<string, typeof activeAllocations>()
  for (const a of activeAllocations) {
    const list = bookingsByInput.get(a.inputSourceId) || []
    list.push(a)
    bookingsByInput.set(a.inputSourceId, list)
  }

  return sources.map(s => {
    const bookings = bookingsByInput.get(s.id) || []
    // Sort by allocatedAt so "upcoming" order is stable
    bookings.sort((a, b) => a.allocatedAt - b.allocatedAt)
    return {
      id: s.id,
      name: s.name,
      type: s.type,
      deviceId: s.deviceId,
      matrixInputId: s.matrixInputId,
      // Live flag: BUSY if any booking overlaps RIGHT NOW (allocatedAt <=
      // now <= expectedFreeAt). Still-upcoming bookings are shown
      // separately via `bookings` so the AI can plan around them.
      currentlyAllocated: bookings.some(b => b.allocatedAt <= nowUnix && b.expectedFreeAt >= nowUnix),
      currentChannel: s.currentChannel,
      priorityRank: s.priorityRank,
      availableNetworks: (() => { try { return JSON.parse(s.availableNetworks) } catch { return [] } })(),
      bookings: bookings.map(b => ({
        startUnix: b.allocatedAt,
        endUnix: b.expectedFreeAt,
        startLocal: new Date(b.allocatedAt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: HARDWARE_CONFIG.venue.timezone }),
        endLocal: new Date(b.expectedFreeAt * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: HARDWARE_CONFIG.venue.timezone }),
        gameLabel: [b.awayTeam, b.homeTeam].filter(Boolean).join(' @ ') || 'game',
        status: b.status,
      })),
    }
  })
}

// ---------- helper: load channel presets ----------

async function loadChannelPresets() {
  const presets = await db.select().from(schema.channelPresets).where(eq(schema.channelPresets.isActive, true))
  return presets.map(p => ({
    name: p.name,
    channelNumber: p.channelNumber,
    deviceType: p.deviceType,
  }))
}

// ---------- helper: load TV outputs ----------

async function loadTVOutputs() {
  const outputs = await db.select().from(schema.matrixOutputs).where(
    and(
      eq(schema.matrixOutputs.isActive, true),
      eq(schema.matrixOutputs.isSchedulingEnabled, true),
    )
  )
  return outputs.map(o => ({
    channelNumber: o.channelNumber,
    label: o.label,
    tvGroupId: o.tvGroupId,
  }))
}

// ---------- helper: call Ollama ----------

async function callOllama(prompt: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS)

  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.3,
          num_predict: 2048,
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`)
    }

    const data = await response.json()
    return data.response || ''
  } finally {
    clearTimeout(timeout)
  }
}

// ---------- helper: build the LLM prompt ----------

function buildPrompt(
  games: GameListing[],
  inputSources: any[],
  _channelPresets: any[],
  tvOutputs: any[],
  patterns: SchedulingPattern[],
  _historicalSummary: string,
): string {
  // Group inputs by type so the AI knows which channel number to use
  const cableInputs = inputSources.filter(s => s.type === 'cable')
  const directvInputs = inputSources.filter(s => s.type === 'directv' || s.type === 'satellite')
  const firetvInputs = inputSources.filter(s => s.type === 'firetv')

  // Format each input's booking summary: "BUSY 12:40-15:49 Brewers @ Marlins; 20:00-22:30 76ers @ Lakers"
  // Shown inline with the input so the AI can reason about overlapping windows.
  const bookingsStr = (s: any): string => {
    if (!Array.isArray(s.bookings) || s.bookings.length === 0) return ''
    const lines = s.bookings.slice(0, 3).map((b: any) => `${b.startLocal}-${b.endLocal} ${b.gameLabel}`)
    return ` · BOOKED: ${lines.join('; ')}`
  }

  const inputLines: string[] = []
  for (const s of cableInputs) {
    inputLines.push(`  ${s.name} (cable${s.currentlyAllocated ? ', BUSY NOW' : ''}${bookingsStr(s)})`)
  }
  for (const s of directvInputs) {
    inputLines.push(`  ${s.name} (directv${s.currentlyAllocated ? ', BUSY NOW' : ''}${bookingsStr(s)})`)
  }
  for (const s of firetvInputs) {
    const apps = Array.isArray(s.availableNetworks) ? s.availableNetworks.slice(0, 6).join(', ') : 'streaming apps'
    inputLines.push(`  ${s.name} (firetv — apps: ${apps}${s.currentlyAllocated ? ', BUSY NOW' : ''}${bookingsStr(s)})`)
  }

  const tvCount = tvOutputs.length
  const totalInputs = inputSources.length

  // Per-game TV-count hint. Used in the game line and in rule 11 below so
  // the LLM has a concrete target instead of leaving suggestedOutputs empty.
  // Floor with min 2 so a 24-TV / 12-game venue still shows 2-per-game
  // suggestions; max 8 keeps a single game from claiming the whole bar.
  const tvPerGame = Math.max(2, Math.min(8, Math.floor(tvCount / Math.max(1, games.length))))

  // Build game list with per-route labels. A game can have multiple simultaneous
  // routes — cable channel, directv channel, and/or a streaming app on Fire TV.
  // The AI picks whichever input it wants and uses the matching identifier.
  const gameLines = games.map((g, i) => {
    const time = new Date(g.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: HARDWARE_CONFIG.venue.timezone })
    const cableCh = g.channelNumber ? `cable ch ${g.channelNumber}` : ''
    const dtvCh = g.directvChannel ? `directv ch ${g.directvChannel}` : ''
    const app = g.streamingApp ? `firetv app "${g.streamingApp}"` : ''
    const routes = [cableCh, dtvCh, app].filter(Boolean).join(', ')
    const availability: string[] = []
    if (g.channelNumber) availability.push('CABLE')
    if (g.directvChannel) availability.push('DIRECTV')
    if (g.streamingApp) availability.push('FIRETV')
    const tag = availability.length > 1 ? availability.join('+') : (availability[0] || 'NO-ROUTE')
    // UFC/PPV events come through ESPN with empty home/away team names —
    // ESPN structures MMA as fighters, not teams, so the displayName fields
    // are null and our espn-sync-service backfill yields awayTeam=
    // "UFC Fight Night" + homeTeam="" (or both empty if the event-name
    // parser couldn't split). Render whichever halves are non-empty rather
    // than emitting " at " which trips the LLM into ignoring the row.
    const teams = (g.awayTeam && g.homeTeam)
      ? `${g.awayTeam} at ${g.homeTeam}`
      : (g.awayTeam || g.homeTeam || `${g.league.toUpperCase()} event`)
    return `${i + 1}. [${tag}] ${teams} (${g.league}) — ${time} CT — ${routes || 'no route'} · assign ~${tvPerGame} TVs (min 1, max 8)`
  }).join('\n')

  // Pattern hints
  let patternHints = ''
  if (patterns.length > 0) {
    const routingHints = patterns
      .filter((p: any) => p.pattern_type === 'team_routing' && p.pattern_data)
      .slice(0, 5)
      .map((p: any) => {
        try {
          const d = typeof p.pattern_data === 'string' ? JSON.parse(p.pattern_data) : p.pattern_data
          return `${d.team || d.teamName || '?'}: usually on ${d.preferredInput || '?'}`
        } catch { return null }
      })
      .filter(Boolean)
    if (routingHints.length > 0) {
      patternHints = `\nPast routing patterns:\n${routingHints.join('\n')}`
    }

    // Per-league duration history. Feeds the LLM observed runtime so
    // slot planning for high-overrun leagues (MLB, college baseball)
    // can buffer accordingly. Data comes from (actually_freed_at -
    // allocated_at) aggregated by pattern-analyzer.ts.
    const durationHints = patterns
      .filter((p: any) => p.pattern_type === 'league_duration' && p.pattern_data)
      .slice(0, 8)
      .map((p: any) => {
        try {
          const d = typeof p.pattern_data === 'string' ? JSON.parse(p.pattern_data) : p.pattern_data
          if (!d.actualDurationAvgMin || !d.sampleCount) return null
          const overrun = d.overrunAvgMin ?? 0
          const overrunLabel = overrun > 0 ? `+${overrun} min over scheduled` : overrun < 0 ? `${overrun} min under scheduled` : 'on time'
          const bufferNote = d.recommendedBufferMin > 0 ? `; buffer ${d.recommendedBufferMin} min for P90 overrun` : ''
          return `${d.league}: ~${d.actualDurationAvgMin} min actual (${overrunLabel}, n=${d.sampleCount}${bufferNote})`
        } catch { return null }
      })
      .filter(Boolean)
    if (durationHints.length > 0) {
      patternHints += `\nLearned league durations (from completed games at this venue):\n${durationHints.join('\n')}`
    }
  }

  const exampleInput = inputSources[0]?.name || 'DirecTV 1'

  return `You are a sports bar TV scheduler in Green Bay, Wisconsin. Assign games to inputs and TVs.

INPUTS (each tunes ONE channel at a time):
${inputLines.join('\n')}

GAMES (next 12 hours):
${gameLines}

SETUP: ${tvCount} TVs across ${totalInputs} inputs. Home teams: Packers, Brewers, Bucks, Badgers.
${patternHints}

RULES:
1. CRITICAL: Cable inputs MUST use the "cable ch" number. DirecTV inputs MUST use the "directv ch" number. Fire TV inputs MUST use the streaming app name as the channelNumber value (e.g. "Prime Video", "Apple TV+", "Peacock"). Never mix identifiers.
2. STREAMING-ONLY GAMES: Any game tagged [FIRETV] (Prime Video, Apple TV+, Peacock, ESPN+, Max, Paramount+) with no cable/directv route MUST be routed to a firetv input. Skip the game entirely if no Fire TV has the required app installed.
3. FIRE TV WITHOUT APP: Skip a [FIRETV] game if the streaming app is not in the firetv input's apps list — no other input can tune it.
4. NO INPUT DOUBLE-BOOKING: Each input source can host only ONE game at a time. Two games whose time windows overlap on the same input are forbidden. Game windows are 3 hours starting at the listed time.
5. SPREAD BEFORE STACK: Before assigning any game to DirecTV, check whether an idle cable box can carry the channel. Spread games across ALL available inputs (cable + DirecTV) rather than packing DirecTV. Pull the next idle input from the full pool — do not default to DirecTV just because it appears later in the INPUTS list.
6. CHANNEL TELLS YOU DEVICE CLASS: The channel number tells you device class — cable channels prefer cable boxes; RSNs that are DirecTV-only get DirecTV. Do not default to DirecTV when a cable box is idle and the channel is on cable.
7. DYNAMIC FREE-SET: The set of allocatable inputs for a given time slot = all inputs with no existing booking AND no in-batch suggestion overlapping that slot. Re-check for every game you assign — once you suggest input X for game A, X is no longer free for game B if their windows overlap.
8. ALTERNATES OK: A given gameIndex may appear up to 2 times on different inputs (e.g. Brewers game on cable ch 308 AND on firetv Apple TV+ as alternatives). A given input may also appear up to 2 times with different game options. Do NOT propose the same game+input combo more than once.
9. EXACT INPUT NAMES: "suggestedInput" MUST be an exact name from the INPUTS list above.
10. RESPECT EXISTING BOOKINGS. Each input line may include a "BOOKED: <start>-<end> <game>" suffix listing allocations that already overlap the 12-hour window. Do NOT suggest a game for an input whose booking window overlaps the game's start time. Only re-use a booked input if the new game's start is AFTER the booking's end time.
11. MANDATORY OUTPUTS: Every suggestion MUST include at least 1 TV output number in suggestedOutputs. Empty arrays are REJECTED server-side. Aim for ~${tvPerGame} TVs per game; never zero. Use any TV channel number from 1 to ${tvCount}.
12. PRIORITY ORDER: Home team games (Brewers, Bucks, Packers, Badgers) get top priority — always propose them first. Then propose diverse options across leagues (MLB, NBA, NHL, MLS, UFL, UFC, Premier League, college sports) so the manager can compare.

Return ONLY valid JSON:
{"suggestions":[{"gameIndex":1,"suggestedInput":"${exampleInput}","channelNumber":"669","suggestedOutputs":[1,2,3],"confidence":0.9,"reasoning":"Brewers home game on DirecTV"}]}

Return ${Math.min(totalInputs * 2, games.length, 12)} suggestions — at least one per input when possible, plus alternatives across different leagues for the manager to pick from. JSON only, no other text.`
}

// ---------- helper: parse Ollama response ----------

interface ParsedSuggestionRejection {
  gameId: string
  suggestedInput: string
  reason: 'zero_outputs' | 'existing_collision' | 'in_batch_collision' | 'no_route' | 'duplicate_combo' | 'over_per_input_cap' | 'over_per_game_cap'
  detail?: string
}

interface ParseResult {
  suggestions: AISuggestion[]
  rejections: ParsedSuggestionRejection[]
}

function parseOllamaResponse(
  raw: string,
  games: GameListing[],
  inputSources: any[],
): ParseResult {
  try {
    const parsed = JSON.parse(raw)
    const suggestions: AISuggestion[] = []
    const rejections: ParsedSuggestionRejection[] = []

    // Helper: find the best matching input source for a suggested name.
    // Tries exact id, exact name, case-insensitive normalized name, then
    // substring / digit matching as a last resort. Finally falls back to
    // the first cable input source of the right type so approve never
    // ends up with an empty inputSourceId when at least one cable input
    // exists.
    const normalize = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '').replace(/box/g, '')
    const digitsOf = (s: string) => (s || '').match(/\d+/)?.[0] || ''
    const cableSources = inputSources.filter((src: any) => src.type === 'cable')
    const resolveInput = (suggestedId: string, suggestedName: string) => {
      if (!suggestedId && !suggestedName) return cableSources[0] || null
      // 1. Exact id match
      const byId = inputSources.find((src: any) => src.id && src.id === suggestedId)
      if (byId) return byId
      // 2. Exact name match
      const byName = inputSources.find((src: any) => src.name === suggestedName)
      if (byName) return byName
      // 3. Normalized name match (strips "box", spaces, casing)
      const nsug = normalize(suggestedName)
      const byNormName = inputSources.find((src: any) => normalize(src.name) === nsug)
      if (byNormName) return byNormName
      // 4. Digit match — "Cable Box 1" and "Cable 1" share "1"
      const dsug = digitsOf(suggestedName)
      if (dsug) {
        const byDigit = cableSources.find((src: any) => digitsOf(src.name) === dsug)
        if (byDigit) return byDigit
      }
      // 5. Fall back to first cable input so approve can proceed
      return cableSources[0] || null
    }

    for (const s of parsed.suggestions || []) {
      const gameIdx = (s.gameIndex || 0) - 1
      const game = games[gameIdx]
      if (!game) continue

      const input = resolveInput(s.suggestedInputId || '', s.suggestedInput || '')

      // CRITICAL: Don't trust the LLM's channel number — it hallucinates.
      // Use the server-side resolved identifier based on the input type:
      //   cable  → cable channel number
      //   directv → directv channel number
      //   firetv → streaming app name
      const inputType = input?.type || 'cable'
      const isDirectv = inputType === 'directv' || inputType === 'satellite'
      const isFiretv = inputType === 'firetv'
      let channelNumberStr = ''
      let appName = ''
      if (isFiretv) {
        appName = game.streamingApp || ''
        channelNumberStr = appName // display value carries the app name
      } else if (isDirectv) {
        channelNumberStr = game.directvChannel || game.channelNumber || ''
      } else {
        channelNumberStr = game.channelNumber || game.directvChannel || ''
      }

      // Skip if we have no valid route for this input type
      if (!channelNumberStr) {
        rejections.push({
          gameId: `game-${gameIdx}`,
          suggestedInput: input?.name || s.suggestedInput || '?',
          reason: 'no_route',
          detail: `inputType=${inputType} but game has no matching channel/app`,
        })
        continue
      }

      const suggestedOutputsInt: number[] = Array.isArray(s.suggestedOutputs)
        ? s.suggestedOutputs
            .map((o: any) => (typeof o === 'number' ? o : parseInt(String(o), 10)))
            .filter((n: number) => Number.isFinite(n) && n >= 0)
        : []

      const resolvedDeviceType: 'cable' | 'directv' | 'firetv' =
        isDirectv ? 'directv' : isFiretv ? 'firetv' : 'cable'

      suggestions.push({
        gameId: `game-${gameIdx}`,
        homeTeam: game.homeTeam || 'Unknown',
        awayTeam: game.awayTeam || 'Unknown',
        league: game.league || 'Unknown',
        startTime: game.time || new Date().toISOString(),
        channelNumber: channelNumberStr,
        channelName: game.channelName || '',
        appName: appName || undefined,
        suggestedInput: input?.name || s.suggestedInput || 'Unknown',
        suggestedInputId: input?.id || '',
        suggestedDeviceId: input?.deviceId || '',
        suggestedDeviceType: resolvedDeviceType,
        suggestedOutputs: suggestedOutputsInt,
        confidence: typeof s.confidence === 'number' ? Math.min(1, Math.max(0, s.confidence)) : 0.5,
        reasoning: s.reasoning || 'No reasoning provided',
      })
    }

    // Server-side enforcement: the AI sometimes ignores the prompt. Apply hard
    // rules post-parse.
    //
    // (a) Exclusivity: a [BOTH]-availability game that the AI put on a cable
    //     input gets moved to DirecTV if at least one directv input is not yet
    //     claimed by another suggestion. This frees cable boxes for CABLE-ONLY
    //     games (and vice versa for directv-only games).
    //
    // (b) Deduplicate inputs: each input can carry only one game; drop later
    //     suggestions that collide with an already-picked input (rank by home-
    //     team > confidence).
    const inputAssignmentCount = new Map<string, number>()
    const gameAssignmentCount = new Map<string, number>()
    const gameInputCombos = new Set<string>()
    const HOME_TEAMS = ['Packers', 'Brewers', 'Bucks', 'Badgers']
    const isHomeTeamGame = (s: AISuggestion) =>
      HOME_TEAMS.some(t => s.homeTeam.includes(t) || s.awayTeam.includes(t))

    // Sort order for the suggestion list returned to the manager:
    //   1. Home team games first (Brewers/Bucks/Packers/Badgers).
    //   2. Within each tier, live-TV sources (cable + directv) above
    //      streaming (firetv). Live sources are the primary feeds; firetv
    //      is a fallback for streaming-only broadcasts (Prime Video, Apple TV+,
    //      Paramount+, etc.). Previously firetv suggestions could appear
    //      above directv ones when confidence was identical, pushing the
    //      primary-source options below the alternates.
    //   3. Tiebreak by confidence descending.
    // At DirecTV-only locations (no cable inputs) this keeps directv at top.
    // At cable-only locations (no directv inputs) it keeps cable at top.
    // At mixed locations (cable + directv), both appear before firetv.
    const liveTvRank = (s: AISuggestion) => (s.suggestedDeviceType === 'firetv' ? 1 : 0)
    suggestions.sort((a, b) => {
      const ah = isHomeTeamGame(a) ? 0 : 1
      const bh = isHomeTeamGame(b) ? 0 : 1
      if (ah !== bh) return ah - bh
      const ar = liveTvRank(a)
      const br = liveTvRank(b)
      if (ar !== br) return ar - br
      return b.confidence - a.confidence
    })

    const cableInputsAll = inputSources.filter((src: any) => src.type === 'cable')
    const directvInputsAll = inputSources.filter((src: any) => src.type === 'directv' || src.type === 'satellite')

    // Build a map of inputId -> bookings for collision checks below.
    const bookingsByInputId = new Map<string, Array<{ startUnix: number; endUnix: number; gameLabel: string }>>()
    for (const s of inputSources) {
      if (Array.isArray(s.bookings) && s.bookings.length > 0) {
        bookingsByInputId.set(s.id, s.bookings)
      }
    }

    // v2.27.1: in-batch collision tracker. Each entry records a 3h game-start
    // window already claimed by a previously-accepted suggestion in THIS batch.
    // Prevents the LLM from putting two overlapping games on the same input,
    // which the prompt's rule #4 forbids but Ollama doesn't always honor.
    // Reset per parse call — only protects within a single AI-suggest response.
    const inBatchClaims = new Map<string, Array<{ start: number; end: number; gameId: string }>>()

    const finalSuggestions: AISuggestion[] = []
    for (const sug of suggestions) {
      const gameIdx = parseInt(sug.gameId.replace('game-', ''), 10)
      const origGame = games[gameIdx]

      // v2.27.1: REJECT empty suggestedOutputs. Bug A root cause was the LLM
      // dropping the outputs array entirely on long prompts (12-game tail-
      // attention drop at temp=0.3). Suggestions with no TVs are useless and
      // would silently insert empty allocations downstream.
      if (sug.suggestedOutputs.length === 0) {
        rejections.push({
          gameId: sug.gameId,
          suggestedInput: sug.suggestedInput,
          reason: 'zero_outputs',
          detail: `${sug.awayTeam} @ ${sug.homeTeam} on ${sug.suggestedInput}`,
        })
        continue
      }

      // (0) Safety net: drop any suggestion that collides with an
      // existing booking on the proposed input. The prompt includes
      // rule 10 telling the AI to respect bookings, but we don't trust
      // Ollama to always honor it. If the game's start time falls
      // within an existing booking's window on the same input, the
      // suggestion is a hard conflict and we silently drop it.
      if (origGame && sug.suggestedInputId) {
        const bookings = bookingsByInputId.get(sug.suggestedInputId)
        if (bookings && bookings.length > 0) {
          const gameStartUnix = new Date(origGame.time).getTime() / 1000
          const collision = bookings.find(
            b => gameStartUnix >= b.startUnix && gameStartUnix < b.endUnix,
          )
          if (collision) {
            logger.info(
              `[AI-SUGGEST] Dropping collision: ${sug.awayTeam} @ ${sug.homeTeam} on ${sug.suggestedInput} (conflicts with ${collision.gameLabel})`,
            )
            rejections.push({
              gameId: sug.gameId,
              suggestedInput: sug.suggestedInput,
              reason: 'existing_collision',
              detail: `conflicts with existing booking ${collision.gameLabel}`,
            })
            continue
          }
        }
      }

      // v2.27.1: in-batch collision check. If a previously-accepted suggestion
      // in this batch already claimed this input for an overlapping window,
      // try to spread to an idle input of the same class instead of dropping.
      // This is the post-LLM enforcement of prompt rule #4 (no double-booking)
      // and #5 (spread before stack).
      const gameStartUnix = origGame ? Math.floor(new Date(origGame.time).getTime() / 1000) : 0
      const gameEndUnix = gameStartUnix + 3 * 60 * 60
      let claims = inBatchClaims.get(sug.suggestedInputId) || []
      let inBatchHit = claims.find(c => gameStartUnix < c.end && gameEndUnix > c.start)

      if (inBatchHit) {
        // Try to reroute to an idle same-class input. Tie-break cable > directv
        // when both have an idle option (rule #5: spread before stack on DTV).
        const sameClass = sug.suggestedDeviceType === 'directv'
          ? directvInputsAll
          : sug.suggestedDeviceType === 'cable'
            ? cableInputsAll
            : []
        const reroute = sameClass.find((src: any) => {
          if (src.id === sug.suggestedInputId) return false
          const otherClaims = inBatchClaims.get(src.id) || []
          const overlap = otherClaims.find(c => gameStartUnix < c.end && gameEndUnix > c.start)
          if (overlap) return false
          // Also respect existing bookings on the candidate input.
          const otherBookings = bookingsByInputId.get(src.id) || []
          const bookingHit = otherBookings.find(b => gameStartUnix >= b.startUnix && gameStartUnix < b.endUnix)
          if (bookingHit) return false
          // And the per-input cap of 2 must not already be hit on the candidate.
          if ((inputAssignmentCount.get(src.id) || 0) >= 2) return false
          return true
        })

        if (reroute) {
          logger.info(
            `[AI-SUGGEST] Spread reroute: ${sug.awayTeam} @ ${sug.homeTeam} ${sug.suggestedInput} → ${reroute.name} (in-batch collision avoided)`,
          )
          sug.suggestedInput = reroute.name
          sug.suggestedInputId = reroute.id
          sug.suggestedDeviceId = reroute.deviceId || ''
          // Device type stays the same since we routed within the same class.
          sug.reasoning = `${sug.reasoning} [auto-spread to ${reroute.name} to avoid double-booking]`
          claims = inBatchClaims.get(sug.suggestedInputId) || []
          inBatchHit = undefined
        } else {
          rejections.push({
            gameId: sug.gameId,
            suggestedInput: sug.suggestedInput,
            reason: 'in_batch_collision',
            detail: `${sug.suggestedInput} already claimed by ${inBatchHit.gameId} in this batch; no idle ${sug.suggestedDeviceType} input available`,
          })
          continue
        }
      }

      // (b) Per-input limit: up to 2 alternatives per input so the manager
      //     can compare options. The manager picks one on approve; the other
      //     is dropped by the UI.
      const inputCount = inputAssignmentCount.get(sug.suggestedInputId) || 0
      if (inputCount >= 2) {
        logger.debug(
          `[AI-SUGGEST] Dropping 3rd+ assignment for input ${sug.suggestedInput} (already at limit 2)`,
        )
        rejections.push({
          gameId: sug.gameId,
          suggestedInput: sug.suggestedInput,
          reason: 'over_per_input_cap',
        })
        continue
      }

      // (c) Per-game limit: up to 2 proposals per game so the manager sees
      //     alternate routes.
      const gameCount = gameAssignmentCount.get(sug.gameId) || 0
      if (gameCount >= 2) {
        logger.debug(
          `[AI-SUGGEST] Dropping 3rd+ proposal for game ${sug.gameId} (${sug.awayTeam} @ ${sug.homeTeam})`,
        )
        rejections.push({
          gameId: sug.gameId,
          suggestedInput: sug.suggestedInput,
          reason: 'over_per_game_cap',
        })
        continue
      }

      // (d) Reject exact game+input duplicates.
      const comboKey = `${sug.gameId}::${sug.suggestedInputId}`
      if (gameInputCombos.has(comboKey)) {
        logger.debug(
          `[AI-SUGGEST] Dropping exact game+input duplicate: ${sug.awayTeam} @ ${sug.homeTeam} on ${sug.suggestedInput}`,
        )
        rejections.push({
          gameId: sug.gameId,
          suggestedInput: sug.suggestedInput,
          reason: 'duplicate_combo',
        })
        continue
      }

      gameAssignmentCount.set(sug.gameId, gameCount + 1)
      inputAssignmentCount.set(sug.suggestedInputId, inputCount + 1)
      gameInputCombos.add(comboKey)
      // v2.27.1: register this suggestion's claim on the input so the next
      // overlapping game in the batch routes elsewhere.
      claims.push({ start: gameStartUnix, end: gameEndUnix, gameId: sug.gameId })
      inBatchClaims.set(sug.suggestedInputId, claims)
      finalSuggestions.push(sug)
    }

    return { suggestions: finalSuggestions, rejections }
  } catch (err: any) {
    logger.error(`[AI-SUGGEST] Failed to parse Ollama JSON response: ${err.message}`)
    logger.debug(`[AI-SUGGEST] Raw response: ${raw.substring(0, 500)}`)
    return { suggestions: [], rejections: [] }
  }
}

// ---------- GET handler ----------

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) return rateLimit.response

  logger.api.request('GET', '/api/scheduling/ai-suggest')

  const queryValidation = validateQueryParams(
    request,
    z.object({
      forceRefresh: z.coerce.boolean().optional(),
    })
  )

  if (!queryValidation.success) return queryValidation.error

  try {
    // 1. Fetch upcoming games from sports guide
    const games = await fetchUpcomingGames()

    // Phase 2 (v2.26.0): Dual-run diff harness when USE_UNIFIED_CONTEXT=true.
    // Builds the same 12h window via the new buildGameContexts() composer
    // and logs a per-request summary of how its output compares to the
    // inline fetchUpcomingGames() path. Does NOT change behavior — the
    // existing code path still drives the response. Lets operators soak
    // the new builder for a week before migrating.
    if (process.env.USE_UNIFIED_CONTEXT === 'true') {
      try {
        const { buildGameContexts } = await import('@/lib/scheduling/game-context')
        const nowUnix = Math.floor(Date.now() / 1000)
        const windowEnd = nowUnix + 12 * 60 * 60
        const { db: db2, schema: schema2 } = await import('@/db')
        const { and: and2, gte: gte2, lte: lte2, ne: ne2 } = await import('drizzle-orm')
        const gameRows = await db2
          .select({ id: schema2.gameSchedules.id })
          .from(schema2.gameSchedules)
          .where(
            and2(
              gte2(schema2.gameSchedules.scheduledStart, nowUnix),
              lte2(schema2.gameSchedules.scheduledStart, windowEnd),
              ne2(schema2.gameSchedules.status, 'completed'),
            ),
          )
          .all()
        const ids = gameRows.map(r => r.id)
        const contexts = await buildGameContexts(ids)
        const unifiedPlayable = contexts.filter(c => c.routes.playable).length
        const unifiedWithBookings = contexts.filter(c => c.allocations.length > 0).length
        const unifiedWithOverrides = contexts.filter(c => c.overridesInPlay.length > 0).length
        logger.info(
          `[AI-SUGGEST:UNIFIED-DIFF] new: ${contexts.length} games, ${unifiedPlayable} playable, ${unifiedWithBookings} with bookings, ${unifiedWithOverrides} with overrides · old: ${games.length} playable games`,
        )
      } catch (diffErr) {
        logger.warn('[AI-SUGGEST:UNIFIED-DIFF] builder failed (non-fatal):', diffErr)
      }
    }

    if (games.length === 0) {
      logger.info('[AI-SUGGEST] No upcoming games found')
      return NextResponse.json({
        success: true,
        suggestions: [],
        analyzedAt: new Date().toISOString(),
        message: 'No upcoming games found in the sports guide.',
      })
    }

    // 2. Load all required data in parallel
    const [inputSources, channelPresets, tvOutputs, patterns, historicalSummary] = await Promise.all([
      loadInputSources(),
      loadChannelPresets(),
      loadTVOutputs(),
      loadSchedulingPatterns(),
      loadHistoricalPatterns(),
    ])

    if (inputSources.length === 0) {
      logger.warn('[AI-SUGGEST] No active input sources configured')
      return NextResponse.json({
        success: true,
        suggestions: [],
        analyzedAt: new Date().toISOString(),
        message: 'No active input sources configured. Add cable boxes or streaming devices first.',
      })
    }

    // 2b. Filter to games that have at least one resolved route (cable, directv, or streaming)
    const filteredGames = games.filter(g => g.channelNumber || g.directvChannel || g.streamingApp)
    logger.info(`[AI-SUGGEST] Filtered ${games.length} games to ${filteredGames.length} with resolved routes`)

    if (filteredGames.length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        analyzedAt: new Date().toISOString(),
        message: `Found ${games.length} upcoming games but none match your channel presets.`,
      })
    }

    // 3. Build prompt and call Ollama
    const prompt = buildPrompt(filteredGames, inputSources, channelPresets, tvOutputs, patterns, historicalSummary)
    logger.info(`[AI-SUGGEST] Sending prompt to Ollama (${prompt.length} chars, ${games.length} games, ${inputSources.length} inputs)`)

    let ollamaResponse: string
    try {
      ollamaResponse = await callOllama(prompt)
    } catch (err: any) {
      if (err.name === 'AbortError') {
        logger.error(`[AI-SUGGEST] Ollama request timed out after ${Math.round(OLLAMA_TIMEOUT_MS / 1000)}s`)
        return NextResponse.json(
          { success: false, error: 'AI suggestion timed out. Ollama may be busy or unavailable.', suggestions: [] },
          { status: 504 }
        )
      }

      logger.error('[AI-SUGGEST] Ollama unavailable:', err)
      return NextResponse.json(
        {
          success: false,
          error: `Ollama is not available. Make sure it is running on ${HARDWARE_CONFIG.ollama.baseUrl}.`,
          details: err.message,
          suggestions: [],
        },
        { status: 503 }
      )
    }

    logger.info(`[AI-SUGGEST] Ollama raw response (${ollamaResponse.length} chars): ${ollamaResponse.slice(0, 2000)}`)

    // 4. Parse response into structured suggestions
    const { suggestions, rejections } = parseOllamaResponse(ollamaResponse, filteredGames, inputSources)

    // v2.27.1: Persist rejection telemetry so operators can see WHY the LLM
    // dropped suggestions (zero outputs, in-batch collision, existing booking,
    // duplicate, cap exceeded). One SchedulerLog row per rejection. Best-
    // effort — failures here MUST NOT block the response.
    if (rejections.length > 0) {
      const correlationId = crypto.randomUUID()
      try {
        for (const r of rejections) {
          await db.insert(schema.schedulerLogs).values({
            correlationId,
            component: 'ai-suggest',
            operation: 'reject',
            level: r.reason === 'zero_outputs' || r.reason === 'in_batch_collision' ? 'warn' : 'info',
            message: `Rejected AI suggestion: ${r.reason}${r.detail ? ` (${r.detail})` : ''}`,
            gameId: r.gameId,
            success: false,
            metadata: JSON.stringify({
              reason: r.reason,
              detail: r.detail || null,
              suggestedInput: r.suggestedInput,
            }),
          })
        }
      } catch (logErr) {
        logger.warn('[AI-SUGGEST] Failed to persist rejection telemetry:', logErr)
      }
    }

    logger.api.response('GET', '/api/scheduling/ai-suggest', 200, {
      gamesAnalyzed: games.length,
      suggestionsReturned: suggestions.length,
      rejections: rejections.length,
    })

    return NextResponse.json({
      success: true,
      suggestions,
      analyzedAt: new Date().toISOString(),
      meta: {
        gamesFound: games.length,
        inputSourcesAvailable: inputSources.length,
        tvOutputsAvailable: tvOutputs.length,
        patternsLoaded: patterns.length,
        model: OLLAMA_MODEL,
      },
    })
  } catch (error: any) {
    logger.api.error('GET', '/api/scheduling/ai-suggest', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate scheduling suggestions', details: error.message },
      { status: 500 }
    )
  }
}
