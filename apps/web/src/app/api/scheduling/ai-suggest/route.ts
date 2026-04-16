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
const OLLAMA_TIMEOUT_MS = HARDWARE_CONFIG.ollama.timeout // 60 seconds
const OLLAMA_MODEL = HARDWARE_CONFIG.ollama.model

// ---------- types ----------

interface SchedulingPattern {
  id: string
  pattern_type: string
  team_name?: string
  league?: string
  input_source_id?: string
  input_source_name?: string
  preferred_outputs?: string
  occurrence_count: number
  confidence: number
  last_seen?: string
  metadata?: string
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
}

interface AISuggestion {
  gameId: string
  homeTeam: string
  awayTeam: string
  league: string
  startTime: string
  channelNumber: string
  channelName: string
  suggestedInput: string
  suggestedInputId: string
  suggestedDeviceId: string
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

    const games: GameListing[] = []
    for (const row of rows) {
      // Parse broadcast networks from JSON
      let networks: string[] = []
      try { networks = JSON.parse(row.broadcastNetworks || '[]') } catch { /* ignore */ }

      // Resolve channels using the same resolver as the bartender remote
      const resolved = await resolveChannelsForGame(
        { networks, primaryNetwork: networks[0] || null, league: row.league, sport: row.sport },
        ['cable', 'directv']
      )

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
      })
    }

    // Sort by start time
    games.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    const capped = games.slice(0, 30)
    logger.info(`[AI-SUGGEST] Found ${games.length} upcoming games from ESPN data, ${capped.length} capped`)
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
      sql`SELECT * FROM scheduling_patterns ORDER BY occurrence_count DESC LIMIT 100`
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

  const inputLines: string[] = []
  for (const s of cableInputs) {
    inputLines.push(`  ${s.name} (cable${s.currentlyAllocated ? ', BUSY' : ''})`)
  }
  for (const s of directvInputs) {
    inputLines.push(`  ${s.name} (directv${s.currentlyAllocated ? ', BUSY' : ''})`)
  }

  // Build game list showing BOTH channel numbers so the AI uses the right one
  const gameLines = games.map((g, i) => {
    const time = new Date(g.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
    const cableCh = g.channelNumber ? `cable ch ${g.channelNumber}` : ''
    const dtvCh = g.directvChannel ? `directv ch ${g.directvChannel}` : ''
    const channels = [cableCh, dtvCh].filter(Boolean).join(', ')
    return `${i + 1}. ${g.awayTeam} at ${g.homeTeam} (${g.league}) — ${time} CT — ${channels || 'no channel found'}`
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
          return `${d.teamName || '?'}: usually on ${d.preferredInput || '?'}`
        } catch { return null }
      })
      .filter(Boolean)
    if (routingHints.length > 0) {
      patternHints = `\nPast routing patterns:\n${routingHints.join('\n')}`
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
1. CRITICAL: Cable inputs MUST use the "cable ch" number. DirecTV inputs MUST use the "directv ch" number. Never mix them.
2. If a game only has a cable channel, assign it to a cable input. If it only has a directv channel, assign it to a directv input.
3. If a game has both, prefer whichever input type has more availability.
4. Home team games (Brewers, Bucks, Packers, Badgers) get top priority and more TVs.
5. Each input tunes ONE channel — assign different games to different inputs.
6. Spread games across inputs — don't put everything on one box.
7. "suggestedInput" MUST be an exact name from the INPUTS list above.

Return ONLY valid JSON:
{"suggestions":[{"gameIndex":1,"suggestedInput":"${exampleInput}","channelNumber":"669","suggestedOutputs":[1,2,3],"confidence":0.9,"reasoning":"Brewers home game on DirecTV"}]}

Return up to ${Math.min(totalInputs, 6)} suggestions for the best games. JSON only, no other text.`
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
      // Use the server-side resolved channel number based on the input type.
      const inputType = input?.type || 'cable'
      const isDirectv = inputType === 'directv' || inputType === 'satellite'
      const channelNumberStr = isDirectv
        ? (game.directvChannel || game.channelNumber || '')
        : (game.channelNumber || game.directvChannel || '')

      // Skip if we have no valid channel for this input type
      if (!channelNumberStr) continue

      const suggestedOutputsInt: number[] = Array.isArray(s.suggestedOutputs)
        ? s.suggestedOutputs
            .map((o: any) => (typeof o === 'number' ? o : parseInt(String(o), 10)))
            .filter((n: number) => Number.isFinite(n) && n >= 0)
        : []

      suggestions.push({
        gameId: `game-${gameIdx}`,
        homeTeam: game.homeTeam || 'Unknown',
        awayTeam: game.awayTeam || 'Unknown',
        league: game.league || 'Unknown',
        startTime: game.time || new Date().toISOString(),
        channelNumber: channelNumberStr,
        channelName: game.channelName || '',
        suggestedInput: input?.name || s.suggestedInput || 'Unknown',
        suggestedInputId: input?.id || '',
        suggestedDeviceId: input?.deviceId || '',
        suggestedOutputs: suggestedOutputsInt,
        confidence: typeof s.confidence === 'number' ? Math.min(1, Math.max(0, s.confidence)) : 0.5,
        reasoning: s.reasoning || 'No reasoning provided',
      })
    }

    return suggestions
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

    // 2b. Filter to games that have at least one resolved channel (cable or directv)
    const filteredGames = games.filter(g => g.channelNumber || g.directvChannel)
    logger.info(`[AI-SUGGEST] Filtered ${games.length} games to ${filteredGames.length} with resolved channels`)

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
        logger.error('[AI-SUGGEST] Ollama request timed out after 30s')
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
