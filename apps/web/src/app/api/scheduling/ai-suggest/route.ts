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

      games.push({
        time: gameTime.toISOString(),
        title: `${row.awayTeamName} at ${row.homeTeamName}`,
        league: row.league || 'Unknown',
        homeTeam: row.homeTeamName,
        awayTeam: row.awayTeamName,
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

async function loadInputSources() {
  const sources = await db.select().from(schema.inputSources).where(eq(schema.inputSources.isActive, true))
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    type: s.type,
    deviceId: s.deviceId,
    matrixInputId: s.matrixInputId,
    currentlyAllocated: s.currentlyAllocated,
    currentChannel: s.currentChannel,
    priorityRank: s.priorityRank,
    availableNetworks: (() => { try { return JSON.parse(s.availableNetworks) } catch { return [] } })(),
  }))
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

  const inputLines: string[] = []
  for (const s of cableInputs) {
    inputLines.push(`  ${s.name} (cable${s.currentlyAllocated ? ', BUSY' : ''})`)
  }
  for (const s of directvInputs) {
    inputLines.push(`  ${s.name} (directv${s.currentlyAllocated ? ', BUSY' : ''})`)
  }
  for (const s of firetvInputs) {
    const apps = Array.isArray(s.availableNetworks) ? s.availableNetworks.slice(0, 6).join(', ') : 'streaming apps'
    inputLines.push(`  ${s.name} (firetv — apps: ${apps}${s.currentlyAllocated ? ', BUSY' : ''})`)
  }

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
    return `${i + 1}. [${tag}] ${g.awayTeam} at ${g.homeTeam} (${g.league}) — ${time} CT — ${routes || 'no route'}`
  }).join('\n')

  const tvCount = tvOutputs.length
  const totalInputs = inputSources.length

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

  // Exclusivity preference only applies when the venue has BOTH cable and
  // directv inputs available. Single-type venues (cable-only or directv-only)
  // have no routing choice to make.
  const hasMixedInputs = cableInputs.length > 0 && directvInputs.length > 0
  const exclusivityRule = hasMixedInputs
    ? `2. Assign EXCLUSIVE games to their required input type FIRST, then fill remaining slots with BOTH games:
   - [CABLE-ONLY] games MUST go on a cable input — nothing else can carry them.
   - [DIRECTV-ONLY] games MUST go on a directv input — nothing else can carry them.
   - [BOTH] games should go on DIRECTV by default, so cable inputs stay free for cable-only games.
     Only put a [BOTH] game on cable if all directv inputs are already taken OR if another game needs directv exclusively.`
    : `2. Every input is ${cableInputs.length > 0 ? 'cable' : 'directv'} — assign all games to these inputs using the matching channel number.`

  return `You are a sports bar TV scheduler in Green Bay, Wisconsin. Assign games to inputs and TVs.

INPUTS (each tunes ONE channel at a time):
${inputLines.join('\n')}

GAMES (next 12 hours):
${gameLines}

SETUP: ${tvCount} TVs across ${totalInputs} inputs. Home teams: Packers, Brewers, Bucks, Badgers.
${patternHints}

RULES:
1. CRITICAL: Cable inputs MUST use the "cable ch" number. DirecTV inputs MUST use the "directv ch" number. Fire TV inputs MUST use the streaming app name as the channelNumber value (e.g. "Prime Video", "Apple TV+", "Peacock"). Never mix identifiers.
${exclusivityRule}
3. STREAMING GAMES: Any game tagged [FIRETV] (Prime Video, Apple TV+, Peacock, ESPN+, Max, Paramount+) MUST be routed to a firetv input — no cable/directv box can tune it.
4. PROPOSE OPTIONS FOR THE MANAGER TO CHOOSE FROM. The manager will approve the ones they want. A given gameIndex may appear up to 2 times (e.g. Brewers game on both cable ch 308 AND on firetv Apple TV+ as alternatives). A given input may also appear up to 2 times with different game options (e.g. Fire TV 2 proposed for both the NBA game and the MLS game — manager picks one). Do NOT propose the same game+input combo more than once.
5. Home team games (Brewers, Bucks, Packers, Badgers) get top priority — always propose them first. Then propose diverse options across leagues (MLB, NBA, NHL, MLS, UFL, UFC, Premier League, college sports) so the manager can compare. Don't only suggest one sport — include games from every league present in the GAMES list.
6. Spread across inputs — propose games for EVERY available input. Every cable box, DirecTV receiver, and Fire TV should have at least one suggestion.
7. "suggestedInput" MUST be an exact name from the INPUTS list above.

Return ONLY valid JSON:
{"suggestions":[{"gameIndex":1,"suggestedInput":"${exampleInput}","channelNumber":"669","suggestedOutputs":[1,2,3],"confidence":0.9,"reasoning":"Brewers home game on DirecTV"}]}

Return ${Math.min(totalInputs * 2, games.length, 12)} suggestions — at least one per input when possible, plus alternatives across different leagues for the manager to pick from. JSON only, no other text.`
}

// ---------- helper: parse Ollama response ----------

function parseOllamaResponse(
  raw: string,
  games: GameListing[],
  inputSources: any[],
): AISuggestion[] {
  try {
    const parsed = JSON.parse(raw)
    const suggestions: AISuggestion[] = []

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
      if (!channelNumberStr) continue

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

    suggestions.sort((a, b) => {
      const ah = isHomeTeamGame(a) ? 1 : 0
      const bh = isHomeTeamGame(b) ? 1 : 0
      if (ah !== bh) return bh - ah
      return b.confidence - a.confidence
    })

    const cableInputsAll = inputSources.filter((src: any) => src.type === 'cable')
    const directvInputsAll = inputSources.filter((src: any) => src.type === 'directv' || src.type === 'satellite')
    // Exclusivity rerouting only makes sense when the venue has both input types.
    const hasMixedInputs = cableInputsAll.length > 0 && directvInputsAll.length > 0

    const finalSuggestions: AISuggestion[] = []
    for (const sug of suggestions) {
      const gameIdx = parseInt(sug.gameId.replace('game-', ''), 10)
      const origGame = games[gameIdx]
      const availableOnBoth = origGame?.channelNumber && origGame?.directvChannel

      // (a) Prefer DirecTV for BOTH-availability games when a directv input is free.
      // Skip entirely at single-platform venues. "Free" means assigned fewer
      // than 2 times (we allow up to 2 alternates per input).
      if (hasMixedInputs && availableOnBoth && sug.suggestedDeviceType === 'cable') {
        const freeDirectv = directvInputsAll.find((src: any) => (inputAssignmentCount.get(src.id) || 0) < 2)
        if (freeDirectv) {
          sug.suggestedInput = freeDirectv.name
          sug.suggestedInputId = freeDirectv.id
          sug.suggestedDeviceId = freeDirectv.deviceId || ''
          sug.suggestedDeviceType = 'directv'
          sug.channelNumber = origGame.directvChannel || sug.channelNumber
          sug.reasoning = `${sug.reasoning} [moved to DirecTV to keep cable free for cable-only games]`
        }
      }
      // Same rule the other way — if AI put a BOTH game on directv but no cable
      // inputs are claimed yet AND there are directv-only games later that need
      // the directv slot, move this one to cable. Approximation: prefer cable
      // only if no directv-only game exists in the remaining queue.
      // (Skipped for now — DirecTV-preference is the stated default per user.)

      // (b) Per-input limit: up to 2 alternatives per input so the manager
      //     can compare options (e.g. Fire TV 2 proposed for both NBA and MLS).
      //     The manager picks one on approve; the other is dropped by the UI.
      const inputCount = inputAssignmentCount.get(sug.suggestedInputId) || 0
      if (inputCount >= 2) {
        logger.debug(
          `[AI-SUGGEST] Dropping 3rd+ assignment for input ${sug.suggestedInput} (already at limit 2)`
        )
        continue
      }

      // (c) Per-game limit: up to 2 proposals per game so the manager sees
      //     alternate routes (e.g. Brewers on cable ch 308 OR on firetv Apple
      //     TV+). Same cap for home-team and non-home games — the user wants
      //     choice across the board. The per-game+input uniqueness below
      //     prevents literal duplicates.
      const gameCount = gameAssignmentCount.get(sug.gameId) || 0
      if (gameCount >= 2) {
        logger.debug(
          `[AI-SUGGEST] Dropping 3rd+ proposal for game ${sug.gameId} (${sug.awayTeam} @ ${sug.homeTeam})`
        )
        continue
      }

      // (d) Reject exact game+input duplicates (same game proposed twice on
      //     the same input adds no manager choice).
      const comboKey = `${sug.gameId}::${sug.suggestedInputId}`
      if (gameInputCombos.has(comboKey)) {
        logger.debug(
          `[AI-SUGGEST] Dropping exact game+input duplicate: ${sug.awayTeam} @ ${sug.homeTeam} on ${sug.suggestedInput}`
        )
        continue
      }

      gameAssignmentCount.set(sug.gameId, gameCount + 1)
      inputAssignmentCount.set(sug.suggestedInputId, inputCount + 1)
      gameInputCombos.add(comboKey)
      finalSuggestions.push(sug)
    }

    return finalSuggestions
  } catch (err: any) {
    logger.error(`[AI-SUGGEST] Failed to parse Ollama JSON response: ${err.message}`)
    logger.debug(`[AI-SUGGEST] Raw response: ${raw.substring(0, 500)}`)
    return []
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
    const suggestions = parseOllamaResponse(ollamaResponse, filteredGames, inputSources)

    logger.api.response('GET', '/api/scheduling/ai-suggest', 200, {
      gamesAnalyzed: games.length,
      suggestionsReturned: suggestions.length,
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
