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
import { eq, and, sql } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateQueryParams, z } from '@/lib/validation'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'

const OLLAMA_URL = `${HARDWARE_CONFIG.ollama.baseUrl}/api/generate`
// const OLLAMA_MODEL = 'llama3.1:8b' // Too slow for large prompts
const OLLAMA_TIMEOUT_MS = HARDWARE_CONFIG.ollama.timeout // 60 seconds
const OLLAMA_MODEL = HARDWARE_CONFIG.ollama.model // Smaller model for faster responses
const SPORTS_GUIDE_URL = 'http://localhost:3001/api/sports-guide'

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
  channelNumber?: string
  channelName?: string
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

// ---------- helper: fetch upcoming games from sports guide ----------

async function fetchUpcomingGames(): Promise<GameListing[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const response = await fetch(SPORTS_GUIDE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 2 }),
      signal: controller.signal,
    })

    if (!response.ok) {
      logger.error(`[AI-SUGGEST] Sports guide returned ${response.status}`)
      return []
    }

    const data = await response.json()
    if (!data.success || !data.data?.listing_groups) {
      logger.warn('[AI-SUGGEST] Sports guide returned no listing groups')
      return []
    }

    const now = new Date()
    const games: GameListing[] = []

    for (const group of data.data.listing_groups) {
      const league = group.group_title || 'Unknown'

      for (const listing of group.listings || []) {
        // Parse time — Rail Media returns "7:00 pm" + "Mar 27" format
        let gameTime: Date | null = null
        if (listing.time) {
          const currentYear = new Date().getFullYear()
          const dateStr = listing.date
            ? `${listing.date} ${currentYear} ${listing.time}`
            : `${new Date().toDateString()} ${listing.time}`
          gameTime = new Date(dateStr)
          if (isNaN(gameTime.getTime())) gameTime = null
        }
        if (!gameTime || gameTime < now) continue // skip past games

        // Only include games within the next ~12 hours
        const hoursAhead = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60)
        if (hoursAhead > 12) continue

        // Skip events without team matchups (golf, F1, etc.)
        const homeTeamCheck = listing.data?.['home team'] || listing.data?.['team'] || ''
        const awayTeamCheck = listing.data?.['visiting team'] || listing.data?.['opponent'] || ''
        if (!homeTeamCheck.trim() && !awayTeamCheck.trim()) continue

        // Extract team names from listing data
        const listingData = listing.data || {}
        const title = Object.values(listingData).join(' ') || 'Unknown Game'

        // Stations can be an array or an object
        let stations: string[] = []
        if (Array.isArray(listing.stations)) {
          stations = listing.stations
        } else if (listing.stations && typeof listing.stations === 'object') {
          stations = Object.keys(listing.stations)
        }

        // Extract cable channel numbers (CAB lineup) — matches Spectrum presets
        let channelNumber = ''
        let channelName = stations[0] || ''
        if (listing.channel_numbers) {
          const cabLineup = listing.channel_numbers['CAB'] || listing.channel_numbers['cab'] || {}
          for (const [station, numbers] of Object.entries(cabLineup)) {
            if (Array.isArray(numbers) && numbers.length > 0) {
              // Use the lowest channel number (most common/basic tier)
              channelNumber = String(Math.min(...(numbers as number[])))
              channelName = station
              break
            }
          }
          // Fallback to DRTV if no cable
          if (!channelNumber) {
            const dtvLineup = listing.channel_numbers['DRTV'] || listing.channel_numbers['SAT'] || {}
            for (const [station, numbers] of Object.entries(dtvLineup)) {
              if (Array.isArray(numbers) && numbers.length > 0) {
                channelNumber = String(numbers[0])
                channelName = station
                break
              }
            }
          }
        }

        // Extract home/away teams from Rail Media data fields
        let homeTeam = listingData['home team'] || listingData['team'] || ''
        let awayTeam = listingData['visiting team'] || listingData['opponent'] || ''

        // Skip games without team names (golf, racing, etc.)
        if (!homeTeam.trim() && !awayTeam.trim()) continue

        games.push({
          time: gameTime.toISOString(),
          date: listing.date,
          title,
          league,
          homeTeam,
          awayTeam,
          stations,
          channelNumber,
          channelName,
        })
      }
    }

    // Cap at 30 games — filtering later will reduce to only those with matching presets
    const capped = games.slice(0, 30)
    logger.info(`[AI-SUGGEST] Found ${games.length} upcoming games, sending ${capped.length} to AI`)
    return capped
  } catch (err: any) {
    if (err.name === 'AbortError') {
      logger.error('[AI-SUGGEST] Sports guide request timed out')
    } else {
      logger.error('[AI-SUGGEST] Error fetching sports guide:', err)
    }
    return []
  } finally {
    clearTimeout(timeout)
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
  channelPresets: any[],
  tvOutputs: any[],
  patterns: SchedulingPattern[],
  historicalSummary: string,
): string {
  const inputList = inputSources.slice(0, 6).map(s =>
    `${s.name} (${s.type}${s.currentlyAllocated ? ', BUSY' : ''})`
  ).join(', ')

  const gameList = games.map((g, i) =>
    `${i + 1}. ${g.league}: ${g.awayTeam || '?'} @ ${g.homeTeam || '?'}, ${new Date(g.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}, ch ${g.channelNumber || '?'} (${g.channelName || '?'})`
  ).join('\n')

  const presetList = channelPresets.slice(0, 20).map((p: any) =>
    `${p.name}: ch ${p.channelNumber}`
  ).join(', ')

  // Build pattern hints from learned data
  let patternHints = ''
  if (patterns.length > 0) {
    const routingHints = patterns
      .filter((p: any) => p.pattern_type === 'team_routing' && p.pattern_data)
      .slice(0, 5)
      .map((p: any) => {
        try {
          const d = typeof p.pattern_data === 'string' ? JSON.parse(p.pattern_data) : p.pattern_data
          const outputs = d.preferredOutputs?.slice(0, 8)?.join(',') || 'unknown'
          return `${d.teamName || '?'}: Box=${d.preferredInput || '?'}, TVs=[${outputs}]`
        } catch { return null }
      })
      .filter(Boolean)

    if (routingHints.length > 0) {
      patternHints = `\nLearned routing (from bartender history):\n${routingHints.join('\n')}`
    }
  }

  // Build the JSON example using the first actual input source name so the
  // AI echoes back a name we can resolve. Previously the example used a
  // hardcoded "Cable Box 1" which doesn't match the real source names at any
  // of our locations (Stoneyard uses "Cable 1"..."Cable 4"), causing the
  // post-response lookup to fail and suggestedInputId to be empty.
  const exampleInputName = inputSources[0]?.name || 'Cable 1'

  return `Sports bar scheduler. Assign upcoming games to cable boxes and suggest which TVs to show each game on. ONLY use channel numbers from our presets.

Boxes: ${inputList}

Our channel presets: ${presetList}

Games (only ones on our channels):
${gameList}

Home teams: Packers, Brewers, Bucks, Badgers
${patternHints}

Rules: Each box tunes ONE channel. Prioritize home teams. Home team games get more TVs. Use learned routing patterns when available.
IMPORTANT: The "suggestedInput" field MUST be one of the exact box names listed under "Boxes:" above. Do not invent names.
Return JSON: {"suggestions":[{"gameIndex":1,"suggestedInput":"${exampleInputName}","channelNumber":"27","suggestedOutputs":[1,2,3,5],"confidence":0.8,"reasoning":"brief reason"}]}
Only top games. JSON only.`
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

      const input = resolveInput(s.suggestedInputId || '', s.suggestedInput || '')

      // Coerce channelNumber to string. The LLM sometimes returns it as a
      // number ("channelNumber": 40) which then fails Zod validation on
      // /api/schedules/bartender-schedule (requires string). Same for
      // any output IDs (must be integers, not strings or mixed).
      const channelNumberStr = s.channelNumber != null
        ? String(s.channelNumber)
        : (game?.channelNumber || '')
      const suggestedOutputsInt: number[] = Array.isArray(s.suggestedOutputs)
        ? s.suggestedOutputs
            .map((o: any) => (typeof o === 'number' ? o : parseInt(String(o), 10)))
            .filter((n: number) => Number.isFinite(n) && n >= 0)
        : []

      suggestions.push({
        gameId: game ? `game-${gameIdx}` : `game-unknown`,
        homeTeam: s.homeTeam || game?.homeTeam || 'Unknown',
        awayTeam: s.awayTeam || game?.awayTeam || 'Unknown',
        league: s.league || game?.league || 'Unknown',
        startTime: game?.time || new Date().toISOString(),
        channelNumber: channelNumberStr,
        channelName: s.channelName || game?.channelName || '',
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

    // 2b. Filter games to only those with cable channels matching our presets
    // Exclude streaming-only channels (MLBEI, ESPN+, MLSDK, NBALP, etc.)
    const STREAMING_ONLY = new Set(['MLBEI', 'ESPN+', 'MLSDK', 'NBALP', 'TELE', 'NBCUN', 'Netflix', 'Prime'])
    const cablePresets = channelPresets.filter((p: any) => p.deviceType === 'cable')
    const presetChannels = new Set(cablePresets.map((p: any) => String(p.channelNumber)))
    const filteredGames = games.filter(g => {
      if (STREAMING_ONLY.has(g.channelName)) return false
      if (g.channelNumber && presetChannels.has(String(g.channelNumber))) return true
      return false
    })
    logger.info(`[AI-SUGGEST] Filtered ${games.length} games to ${filteredGames.length} matching channel presets`)

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
