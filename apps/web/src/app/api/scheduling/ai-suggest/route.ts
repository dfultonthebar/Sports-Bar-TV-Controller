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
import { eq, and, sql, gte, inArray } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateQueryParams, z } from '@/lib/validation'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'
import {
  logSchedulingEvent,
  newSchedulingRequestId,
} from '@/lib/scheduling-logger'
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
  // v2.32.100 — Fields populated only for streaming candidates that came
  // from firetv_streaming_catalog (per-device Scout walker output).
  // `firetvInputId` is the input_sources.id of the Fire TV input whose
  // catalog row produced this candidate — the parser uses it to lock the
  // suggestion to that exact input, since a streaming candidate is
  // device-specific (same content title may appear on multiple Fire TVs
  // as separate candidates). `deepLink` is the per-event launch URI the
  // walker captured (e.g. "primevideo://detail?gti=...") which the apply
  // path forwards to scheduler-service so the tune lands on the exact
  // game instead of the app's home screen. `isLive`, `sportTag`, and
  // `gameSource` are display-only context for the LLM prompt.
  firetvInputId?: string
  deepLink?: string
  isLive?: boolean
  sportTag?: string
  gameSource?: 'gameSchedules' | 'streamingCatalog'
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
  // v2.32.100 — Per-event deep link for firetv suggestions sourced from
  // firetv_streaming_catalog. When present, the apply path forwards this
  // to inputSourceAllocations.deepLink, which scheduler-service uses at
  // tune time to launch the Fire TV directly to the specific game (vs.
  // landing on the app's home screen).
  deepLink?: string
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
//
// v2.32.100 — Streaming routes are NO LONGER resolved here. The bartender
// channel guide moved its streaming source to firetv_streaming_catalog
// (per-device Scout walker output) and AI Suggest now does the same via
// fetchStreamingCatalogCandidates() so its suggestions are guaranteed
// launchable on a real Fire TV input. This function returns ONLY cable +
// directv candidates — streaming-only games are skipped here and may be
// picked up by the catalog path, which carries deepLink for autoplay.

async function fetchUpcomingGames(): Promise<GameListing[]> {
  try {
    const nowUnix = Math.floor(Date.now() / 1000)
    const twelveHoursLater = nowUnix + 12 * 60 * 60

    // v2.32.0 — include in-progress games whose start is in the past so
    // long broadcasts (NFL Draft Day 1, Sunday Night Football's 4-hour
    // window, etc) stay visible after kickoff. v2.32.62 — tightened: only
    // include past-start in-progress games when estimated_end is still in
    // the future. ESPN sync doesn't reliably mark old games 'completed' —
    // 72 zombies stuck in_progress past their end at Holmgren today,
    // including the NFL Draft from 11 days ago, surfaced as AI Suggest
    // candidates. Now they don't.
    const rows = await db.select().from(schema.gameSchedules).where(
      and(
        sql`(${schema.gameSchedules.scheduledStart} >= ${nowUnix} OR (${schema.gameSchedules.status} = 'in_progress' AND ${schema.gameSchedules.estimatedEnd} > ${nowUnix}))`,
        sql`${schema.gameSchedules.scheduledStart} <= ${twelveHoursLater}`,
        sql`${schema.gameSchedules.status} != 'completed'`,
      )
    )

    // v2.32.3 — Parallelize resolveChannelsForGame across all rows
    // (was awaited serially in a for-loop, ~30 sequential resolver calls
    // per request). One Promise.all fans out, then a fast synchronous
    // pass builds the games array.
    //
    // v2.32.100 — Resolver called with cable+directv only; streaming
    // candidates come from fetchStreamingCatalogCandidates().
    const resolverInputs = rows.map((row) => {
      let networks: string[] = []
      try { networks = JSON.parse(row.broadcastNetworks || '[]') } catch { /* ignore */ }
      return { row, networks }
    })
    const resolverResults = await Promise.all(
      resolverInputs.map(({ row, networks }) =>
        resolveChannelsForGame(
          { networks, primaryNetwork: networks[0] || null, league: row.league, sport: row.sport },
          ['cable', 'directv']
        )
      )
    )

    const games: GameListing[] = []
    let skippedNoChannel = 0
    for (let i = 0; i < resolverInputs.length; i++) {
      const { row, networks } = resolverInputs[i]
      const resolved = resolverResults[i]

      // Skip games that don't have a cable OR directv route. Streaming-only
      // games are NOT included here — they come from the per-device catalog.
      if (!resolved.cableChannel && !resolved.directvChannel) {
        skippedNoChannel++
        continue
      }

      const awayName = row.awayTeamName || ''
      const homeName = row.homeTeamName || ''
      const titleStr = (awayName && homeName)
        ? `${awayName} at ${homeName}`
        : (awayName || homeName || `${row.league || 'event'}`.toUpperCase())

      games.push({
        time: new Date(row.scheduledStart * 1000).toISOString(),
        title: titleStr,
        league: row.league || 'Unknown',
        homeTeam: homeName,
        awayTeam: awayName,
        stations: networks,
        channelNumber: resolved.cableChannel || '',
        channelName: resolved.primaryMatch || networks[0] || '',
        directvChannel: resolved.directvChannel || '',
        streamingApp: '',
        gameSource: 'gameSchedules',
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
    // v2.32.3 — Pre-compute priority + timestamp once per game instead of
    // 2× per sort comparator (priorityOf was being called for both a and b
    // on every comparison; new Date() too). For 30 games × ~150 comparator
    // calls = 300 priorityOf invocations becomes 30. Same fix avoids the
    // repeated `new Date(g.time).getTime()` allocation.
    const scored = games.map((g) => ({
      g,
      p: priorityOf(g),
      t: new Date(g.time).getTime(),
    }))
    scored.sort((a, b) => (a.p !== b.p ? a.p - b.p : a.t - b.t))
    const capped = scored.slice(0, 30).map((s) => s.g)
    logger.info(
      `[AI-SUGGEST] gameSchedules in window: ${rows.length}, with cable/directv route: ${games.length} (skipped ${skippedNoChannel} streaming-only/no-route), capped to ${capped.length}`
    )
    return capped
  } catch (err: any) {
    logger.error('[AI-SUGGEST] Error fetching games from game_schedules:', err)
    return []
  }
}

// ---------- helper: pull streaming candidates from per-device Scout catalog ----------
//
// v2.32.100 — Source-of-truth shift: streaming game candidates now come from
// firetv_streaming_catalog (one row per content tile the Scout walker pulled
// off a specific Fire TV) instead of game_schedules + the network resolver.
// Why: the bartender remote already moved to this source so the channel guide
// shows EXACTLY what the Fire TVs can launch right now (with deepLinks for
// autoplay). AI Suggest reads from the same well so its suggestions are
// guaranteed launchable on a specific input — no more "I picked Apple TV+
// but no Fire TV here has Apple TV+" rejections.
//
// Each catalog row becomes one GameListing locked to its source Fire TV
// input via firetvInputId. Same content title appearing on multiple Fire
// TVs produces multiple candidates — the LLM treats them as alternates.
//
// Cable/satellite candidates are unchanged (fetchUpcomingGames above).
async function fetchStreamingCatalogCandidates(
  firetvInputs: Array<{ id: string; deviceId: string | null; name: string }>,
): Promise<GameListing[]> {
  if (firetvInputs.length === 0) return []
  try {
    const nowSec = Math.floor(Date.now() / 1000)
    const windowEnd = nowSec + 12 * 60 * 60
    const STALE_LIVE_SECONDS = 4 * 60 * 60 // see channel-guide STALE_LIVE_SECONDS — same intent
    const candidates: GameListing[] = []
    let totalRows = 0
    let skippedDupes = 0
    let skippedOutOfWindow = 0
    let skippedNoTimeAnchor = 0

    // Single bulk query across all inputs — was previously N round-trips
    // (one per Fire TV) which serialized on the SQLite connection.
    const deviceIds = firetvInputs.map((i) => i.deviceId).filter((d): d is string => !!d)
    if (deviceIds.length === 0) return []
    const allRows = await db
      .select()
      .from(schema.firetvStreamingCatalog)
      .where(
        and(
          inArray(schema.firetvStreamingCatalog.deviceId, deviceIds),
          sql`${schema.firetvStreamingCatalog.expiresAt} > ${nowSec}`,
        ),
      )
      .all()
    const rowsByDeviceId = new Map<string, typeof allRows>()
    for (const r of allRows) {
      const arr = rowsByDeviceId.get(r.deviceId) ?? []
      arr.push(r)
      rowsByDeviceId.set(r.deviceId, arr)
    }

    // Per-input dedupe: same contentTitle on the same input produces one
    // candidate (catalog can have duplicates from multiple walker passes).
    // Cross-input duplicates (same title on Fire TV 1 AND Fire TV 2) are
    // KEPT as separate candidates — they're real alternates.
    for (const input of firetvInputs) {
      if (!input.deviceId) continue

      const rows = rowsByDeviceId.get(input.deviceId) ?? []

      totalRows += rows.length
      const seen = new Set<string>()
      for (const row of rows) {
        // Time-window filter: AI Suggest plans the next 12h. Include rows
        // that are currently live OR have an explicit startTime within the
        // window. Skip rows with no time anchor at all (typically generic
        // app-home tiles + on-demand content) — those have no game-time
        // for the scheduler to pivot on. capturedAt is NOT a substitute
        // since it's "when scout walked the tile", not "when the game
        // airs". Keeps the prompt focused on schedulable content.
        if (!row.isLive) {
          if (row.startTime == null) {
            skippedNoTimeAnchor++
            continue
          }
          if (row.startTime < nowSec - 30 * 60 || row.startTime > windowEnd) {
            skippedOutOfWindow++
            continue
          }
        } else {
          // v2.33.30 — Even when scout flagged the tile as live, the
          // row's startTime can be from a previous walk (e.g. yesterday's
          // game still has isLive=1 in DB because catalog hasn't been
          // re-walked since). If startTime is present and points past
          // the realistic live window, skip — otherwise the approve
          // endpoint pivots on that stale anchor, matches yesterday's
          // game in game_schedules ±1hr, and rejects "game already
          // ended" while the operator sees an upcoming-game card.
          // Operator caught 2026-05-11 at Holmgren.
          if (row.startTime != null && row.startTime < nowSec - STALE_LIVE_SECONDS) {
            skippedOutOfWindow++
            continue
          }
        }

        const key = `${row.app}::${row.contentTitle}`
        if (seen.has(key)) {
          skippedDupes++
          continue
        }
        seen.add(key)

        // Best-effort home/away split. Most catalog titles aren't
        // "Away at Home" formatted (they're "MLB.TV: Brewers vs Cubs",
        // "Thursday Night Football", "Drive to Survive S6E1"). Try a
        // light split on " at " / " vs " / " vs. " separators; otherwise
        // put the full title in awayTeam as a single token so the LLM
        // shows it verbatim. The home-team rule matcher does substring
        // checks so "Brewers" inside a "vs Brewers" title still matches.
        const title = row.contentTitle || '(untitled)'
        let awayTeam = title
        let homeTeam = ''
        const sepMatch = title.match(/^(.+?)\s+(?:at|vs\.?)\s+(.+)$/i)
        if (sepMatch) {
          awayTeam = sepMatch[1].trim()
          homeTeam = sepMatch[2].trim()
        }

        // Time used for the prompt + scheduling. Walker prefers
        // row.startTime (extracted from accessibility text) when present;
        // capturedAt is the fallback for on-demand content.
        const startSec = row.startTime ?? row.capturedAt
        const sport = row.sportTag ? row.sportTag.toUpperCase() : ''

        candidates.push({
          time: new Date(startSec * 1000).toISOString(),
          title,
          league: sport || 'STREAMING',
          homeTeam,
          awayTeam,
          stations: [row.app],
          channelNumber: '',
          channelName: row.app,
          directvChannel: '',
          streamingApp: row.app,
          firetvInputId: input.id,
          deepLink: row.deepLink || undefined,
          isLive: !!row.isLive,
          sportTag: row.sportTag || undefined,
          gameSource: 'streamingCatalog',
        })
      }
    }

    // Cap streaming candidates so a Fire TV with 50+ tiles doesn't blow
    // out the prompt. Sort by isLive first (live games matter most), then
    // by startTime (soonest first), and slice to 20. Per-input cap keeps a
    // single overflowing Fire TV from dominating the suggestions list.
    candidates.sort((a, b) => {
      if (!!b.isLive !== !!a.isLive) return b.isLive ? 1 : -1
      return new Date(a.time).getTime() - new Date(b.time).getTime()
    })
    const capped = candidates.slice(0, 20)

    logger.info(
      `[AI-SUGGEST] firetv_streaming_catalog candidates: ${capped.length} (capped from ${candidates.length}) from ${totalRows} rows across ${firetvInputs.length} Fire TV inputs (deduped ${skippedDupes}, no-time-anchor ${skippedNoTimeAnchor}, out-of-window ${skippedOutOfWindow})`,
    )
    return capped
  } catch (err: any) {
    logger.error('[AI-SUGGEST] Error fetching streaming catalog candidates:', err)
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
      availableNetworks: (() => {
        try { return JSON.parse(s.availableNetworks) }
        catch (err: any) {
          // v2.32.3 — log instead of swallow. A malformed availableNetworks
          // JSON in the DB silently filters every streaming game off this
          // input — the operator never sees why the box stopped getting
          // recommendations.
          logger.warn(`[AI-SUGGEST] Bad availableNetworks JSON on input ${s.id} (${s.name}): ${err.message}`)
          return []
        }
      })(),
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

// v2.28.4 — home-team minTV rules. Matches game teams against HomeTeam.aliases
// (case-insensitive contains), returns the minTVsWhenActive for the best match
// or null if neither side is a home team. Packers=20, Bucks=5, Brewers=3,
// Badgers=3 etc. — operator-configurable via the HomeTeam table.
export interface HomeTeamRule {
  teamName: string
  minTVs: number
  aliases: string[] // normalized lowercase
  priority: number
}

export function matchHomeTeamRule(
  homeTeam: string,
  awayTeam: string,
  rules: HomeTeamRule[],
): HomeTeamRule | null {
  const hay = `${homeTeam} ${awayTeam}`.toLowerCase()
  let best: HomeTeamRule | null = null
  for (const r of rules) {
    const hit = r.aliases.some(a => a && hay.includes(a))
    if (hit && (best === null || r.priority > best.priority)) best = r
  }
  return best
}

function buildPrompt(
  games: GameListing[],
  inputSources: any[],
  tvOutputs: any[],
  patterns: SchedulingPattern[],
  homeTeamRules: HomeTeamRule[] = [],
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

  // Build game list with per-route labels. Cable/sat games may have either
  // a cable channel, a directv channel, or both. Streaming games are
  // catalog-sourced (firetv_streaming_catalog) and pre-bound to a specific
  // Fire TV input — the prompt names that input so the LLM knows where the
  // game lands but the parser locks it regardless.
  //
  // v2.28.4 — per-game TV target. Home-team games get HomeTeam.minTVsWhenActive
  // (Packers=20, Bucks=5, Brewers=3, Badgers=3 at Holmgren). Non-home games
  // get the default tvPerGame share. The LLM sees an explicit "assign N TVs"
  // per row PLUS a [HOME TEAM: <Name>] tag so it can't miss the rule.
  //
  // v2.32.100 — Streaming candidates from firetv_streaming_catalog include
  // [LIVE]/[UPCOMING] badge + locked-input note. When the catalog row has a
  // deepLink, the line is tagged "deep-link ready" so the LLM knows the
  // tune lands on the exact event (autoplay) rather than the app's home.
  const inputNameById = new Map<string, string>(inputSources.map((s: any) => [s.id, s.name]))
  const gameLines = games.map((g, i) => {
    const time = new Date(g.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: HARDWARE_CONFIG.venue.timezone })
    const cableCh = g.channelNumber ? `cable ch ${g.channelNumber}` : ''
    const dtvCh = g.directvChannel ? `directv ch ${g.directvChannel}` : ''
    const isStreamingCatalog = g.gameSource === 'streamingCatalog' && g.firetvInputId
    const lockedInputName = isStreamingCatalog ? inputNameById.get(g.firetvInputId!) : ''
    let app = ''
    if (g.streamingApp) {
      const lockNote = isStreamingCatalog && lockedInputName
        ? ` on ${lockedInputName} (LOCKED — pre-bound)`
        : ''
      const deepLinkNote = isStreamingCatalog && g.deepLink ? ' · deep-link ready (autoplay)' : ''
      const liveNote = isStreamingCatalog ? (g.isLive ? ' · LIVE NOW' : ' · UPCOMING') : ''
      app = `firetv app "${g.streamingApp}"${lockNote}${liveNote}${deepLinkNote}`
    }
    const routes = [cableCh, dtvCh, app].filter(Boolean).join(', ')
    const availability: string[] = []
    if (g.channelNumber) availability.push('CABLE')
    if (g.directvChannel) availability.push('DIRECTV')
    if (g.streamingApp) availability.push('FIRETV')
    const tag = availability.length > 1 ? availability.join('+') : (availability[0] || 'NO-ROUTE')
    // UFC/PPV events come through ESPN with empty home/away team names.
    const teams = (g.awayTeam && g.homeTeam)
      ? `${g.awayTeam} at ${g.homeTeam}`
      : (g.awayTeam || g.homeTeam || `${g.league.toUpperCase()} event`)

    // v2.28.4 — match against HomeTeam.minTVsWhenActive
    const rule = matchHomeTeamRule(g.homeTeam || '', g.awayTeam || '', homeTeamRules)
    const targetTVs = rule ? Math.min(rule.minTVs, tvCount) : tvPerGame
    const homeTag = rule ? ` [HOME TEAM: ${rule.teamName} — REQUIRES ${targetTVs} TVs MINIMUM]` : ''
    const assignClause = rule
      ? ` · assign ${targetTVs} TVs (HOME-TEAM RULE — minimum, do NOT go lower)`
      : ` · assign ~${targetTVs} TVs (min 1, max 8)`

    return `${i + 1}. [${tag}]${homeTag} ${teams} (${g.league}) — ${time} CT — ${routes || 'no route'}${assignClause}`
  }).join('\n')

  // v2.32.0 — Same-channel-same-device grouping hint.
  // When ESPN runs College GameDay 11am-2pm followed by NBA Playoffs 2pm-5pm
  // followed by NFL Draft 7pm-11pm, all three games are on cable ch 27.
  // Without this hint the LLM might pick three different inputs to route
  // them, churning channel changes the bartender doesn't need. With it,
  // the LLM keeps them on one cable box — saves tunes, keeps the
  // bartender's mental model simple, frees other inputs for diverse
  // content. Built per device type because the ch 27 on cable IS NOT
  // the same as ch 27 on directv.
  const groupGames = (selector: (g: GameListing) => string | undefined) => {
    const m = new Map<string, number[]>()
    games.forEach((g, i) => {
      const k = selector(g)
      if (!k) return
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(i + 1)
    })
    return [...m.entries()].filter(([_, ids]) => ids.length >= 2)
  }
  const cableGroups = groupGames((g) => g.channelNumber || undefined)
  const directvGroups = groupGames((g) => g.directvChannel || undefined)
  const streamingGroups = groupGames((g) => g.streamingApp || undefined)
  const sameChannelLines: string[] = []
  for (const [ch, ids] of cableGroups) sameChannelLines.push(`  cable ch ${ch}: games #${ids.join(', #')}`)
  for (const [ch, ids] of directvGroups) sameChannelLines.push(`  directv ch ${ch}: games #${ids.join(', #')}`)
  for (const [app, ids] of streamingGroups) sameChannelLines.push(`  firetv app "${app}": games #${ids.join(', #')}`)
  const sameChannelHint = sameChannelLines.length > 0
    ? `\nSAME-CHANNEL GROUPS (prefer one input for each group — see Rule 14):\n${sameChannelLines.join('\n')}\n`
    : ''

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
${sameChannelHint}
SETUP: ${tvCount} TVs across ${totalInputs} inputs. Home teams: Packers, Brewers, Bucks, Badgers.
${patternHints}

RULES:
1. CRITICAL: Cable inputs MUST use the "cable ch" number. DirecTV inputs MUST use the "directv ch" number. Fire TV inputs MUST use the streaming app name as the channelNumber value (e.g. "Prime Video", "Apple TV+", "Peacock"). Never mix identifiers.
2. STREAMING (FIRETV) GAMES ARE PRE-LOCKED TO A SPECIFIC FIRE TV: Each [FIRETV] line names the input it's bound to (e.g. "on Fire TV 2 (LOCKED — pre-bound)"). The catalog walker confirmed the app is launchable on THAT box; the deepLink (when shown as "deep-link ready") opens the EXACT game with autoplay. Use the LOCKED input name as your suggestedInput — do NOT pick a different Fire TV. The server enforces this regardless.
3. FIRE TV WITHOUT APP: This rule no longer applies — every [FIRETV] line is from a Fire TV that proved the app launches there. Just use the locked input.
4. NO INPUT DOUBLE-BOOKING: Each input source can host only ONE game at a time. Two games whose time windows overlap on the same input are forbidden. Game windows are 3 hours starting at the listed time.
5. SPREAD BEFORE STACK: Before assigning any game to DirecTV, check whether an idle cable box can carry the channel. Spread games across ALL available inputs (cable + DirecTV) rather than packing DirecTV. Pull the next idle input from the full pool — do not default to DirecTV just because it appears later in the INPUTS list.
6. CHANNEL TELLS YOU DEVICE CLASS: The channel number tells you device class — cable channels prefer cable boxes; RSNs that are DirecTV-only get DirecTV. Do not default to DirecTV when a cable box is idle and the channel is on cable.
7. DYNAMIC FREE-SET: The set of allocatable inputs for a given time slot = all inputs with no existing booking AND no in-batch suggestion overlapping that slot. Re-check for every game you assign — once you suggest input X for game A, X is no longer free for game B if their windows overlap.
8. ALTERNATES OK: A given gameIndex may appear up to 2 times on different inputs (e.g. Brewers game on cable ch 308 AND on firetv Apple TV+ as alternatives). A given input may also appear up to 2 times with different game options. Do NOT propose the same game+input combo more than once.
9. EXACT INPUT NAMES: "suggestedInput" MUST be an exact name from the INPUTS list above.
10. RESPECT EXISTING BOOKINGS. Each input line may include a "BOOKED: <start>-<end> <game>" suffix listing allocations that already overlap the 12-hour window. Do NOT suggest a game for an input whose booking window overlaps the game's start time. Only re-use a booked input if the new game's start is AFTER the booking's end time.
11. MANDATORY OUTPUTS: Every suggestion MUST include at least 1 TV output number in suggestedOutputs. Empty arrays are REJECTED server-side. Use any TV channel number from 1 to ${tvCount}.
12. HOME-TEAM TV MINIMUMS (NON-NEGOTIABLE): Each game line carries an "assign N TVs" clause. For lines tagged [HOME TEAM: <name>] the N is a HARD MINIMUM — your suggestedOutputs.length MUST be >= N. Server-side enforcement WILL pad your output to N if you under-assign, but the LLM should respect the rule directly so it can pick visually-grouped TVs rather than getting padded with TVs 1..N. Operator-set: Packers=20, Bucks=5, Brewers=3, Badgers=3.
13. PRIORITY ORDER: Home-team games get top priority — always propose them first. Then diverse options across leagues (MLB, NBA, NHL, MLS, UFL, UFC, Premier League, college sports) so the manager can compare.
14. SAME-CHANNEL GROUPING: When the SAME-CHANNEL GROUPS section above lists multiple games on the same channel (e.g. "cable ch 27: games #3, #7, #11"), prefer to put ALL those games on the SAME input. Reasons: (a) saves tunes — no channel change needed, (b) the bartender's view stays consistent, (c) frees other inputs for content on different channels. Only split the group across inputs if the home-team minimums (Rule 12) force you to spread that game across many TVs and there isn't enough room on one input.

Return ONLY valid JSON:
{"suggestions":[{"gameIndex":1,"suggestedInput":"${exampleInput}","channelNumber":"669","suggestedOutputs":[1,2,3],"confidence":0.9,"reasoning":"Brewers home game on DirecTV"}]}

Return ${Math.min(totalInputs * 2, games.length, 12)} suggestions — at least one per input when possible, plus alternatives across different leagues for the manager to pick from. JSON only, no other text.`
}

// ---------- helper: parse Ollama response ----------

interface ParsedSuggestionRejection {
  gameId: string
  suggestedInput: string
  reason:
    | 'zero_outputs'
    | 'existing_collision'
    | 'in_batch_collision'
    | 'no_route'
    | 'duplicate_combo'
    | 'over_per_input_cap'
    | 'over_per_game_cap'
    | 'wrong_firetv_app'   // v2.32.3 — was being pushed at runtime but not in the union
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
  homeTeamRules: HomeTeamRule[] = [],
  tvCount: number = 0,
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

    // Cache lowercase app names per input id for the per-box app gate below.
    // Note: loadInputSources() already JSON.parsed src.availableNetworks into
    // an array — re-parsing it here (as we did pre-v2.32.77) silently threw
    // and left every Set empty, which made the v2.29.1 gate reject every
    // firetv suggestion. Operate on the array directly.
    const appsByInputId = new Map<string, Set<string>>()
    for (const src of inputSources) {
      const apps = Array.isArray(src.availableNetworks) ? src.availableNetworks : []
      appsByInputId.set(src.id, new Set(apps.map((a: string) => a.toLowerCase().trim())))
    }
    const inputHasApp = (src: any, appLower: string): boolean =>
      !!src && (appsByInputId.get(src.id)?.has(appLower) ?? false)
    const resolveInput = (suggestedId: string, suggestedName: string) => {
      if (!suggestedId && !suggestedName) return null
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
      // v2.32.3 — Step 4 widened to ALL inputs (was cable-only), so the
      // LLM saying "DirecTV 2" with garbled punctuation can still match a
      // DirecTV input by digit instead of falling through to a wrong-type
      // substitution. Match within the device class implied by the
      // suggested name first, then fall back to any input with that digit.
      const dsug = digitsOf(suggestedName)
      if (dsug) {
        const lname = (suggestedName || '').toLowerCase()
        const sameClass = inputSources.filter((src: any) => {
          if (lname.includes('directv') || lname.includes('satellite')) return src.type === 'directv' || src.type === 'satellite'
          if (lname.includes('fire') || lname.includes('amazon') || lname.includes('atmosphere')) return src.type === 'firetv'
          if (lname.includes('cable')) return src.type === 'cable'
          return true
        })
        const byDigit = sameClass.find((src: any) => digitsOf(src.name) === dsug)
                     || inputSources.find((src: any) => digitsOf(src.name) === dsug)
        if (byDigit) return byDigit
      }
      // v2.32.3 — Removed the silent step-5 cable fallback. Returning the
      // first cable input when none of the above match meant the LLM
      // hallucinating an input name resulted in the suggestion proceeding
      // with a WRONG suggestedInputId / suggestedDeviceId / suggestedDeviceType
      // — approve would write the allocation to the wrong physical device
      // and route the wrong TV. A clean rejection is correct: the caller
      // pushes a 'no_route' rejection when input is null.
      return null
    }

    for (const s of parsed.suggestions || []) {
      const gameIdx = (s.gameIndex || 0) - 1
      const game = games[gameIdx]
      if (!game) continue

      // v2.32.100 — Streaming candidates from firetv_streaming_catalog are
      // device-locked: each candidate was produced by a specific Fire TV's
      // walker output and is only launchable on that input. We bypass the
      // LLM's input pick for these and pin to the source input directly.
      // This sidesteps the entire wrong_firetv_app reroute path because the
      // catalog row already proved the app is launchable on this Fire TV.
      let input: any = null
      if (game.firetvInputId) {
        input = inputSources.find((src: any) => src.id === game.firetvInputId) || null
        if (!input) {
          // Fire TV input was active when we built candidates but is gone now —
          // very rare. Reject cleanly so the operator sees something is off.
          rejections.push({
            gameId: `game-${gameIdx}`,
            suggestedInput: game.streamingApp ? `firetv (${game.streamingApp})` : 'firetv',
            reason: 'no_route',
            detail: `Source Fire TV input ${game.firetvInputId} no longer available`,
          })
          continue
        }
      } else {
        input = resolveInput(s.suggestedInputId || '', s.suggestedInput || '')
        // v2.32.3 — resolveInput now returns null when the LLM names a
        // non-existent input (was silently substituting first cable; see
        // the function for context). Reject cleanly.
        if (!input) {
          rejections.push({
            gameId: `game-${gameIdx}`,
            suggestedInput: s.suggestedInput || s.suggestedInputId || '?',
            reason: 'no_route',
            detail: `Input "${s.suggestedInput || s.suggestedInputId}" not found in current input list`,
          })
          continue
        }
      }

      // CRITICAL: Don't trust the LLM's channel number — it hallucinates.
      // Use the server-side resolved identifier based on the input type:
      //   cable  → cable channel number
      //   directv → directv channel number
      //   firetv → streaming app name (+ deepLink for catalog-sourced games)
      const inputType = input?.type || 'cable'
      const isDirectv = inputType === 'directv' || inputType === 'satellite'
      let isFiretv = inputType === 'firetv'
      let channelNumberStr = ''
      let appName = ''
      let resolvedInput = input
      if (isFiretv) {
        appName = game.streamingApp || ''
        channelNumberStr = appName // display value carries the app name

        // For catalog-sourced streaming games (firetvInputId set), the
        // walker already proved the app launches on THIS Fire TV — skip the
        // per-box reroute. For LLM-picked Fire TVs (legacy path, no longer
        // exercised in v2.32.100 since fetchUpcomingGames stopped emitting
        // streaming routes — but kept defensively in case a path re-emerges):
        // verify the app is actually on the input and reroute if not.
        if (!game.firetvInputId && appName) {
          const appLower = appName.toLowerCase().trim()
          if (!inputHasApp(input, appLower)) {
            const firetvCandidates = inputSources.filter(
              (src: any) => src.type === 'firetv' && inputHasApp(src, appLower) && !src.currentlyAllocated
            )
            const fallback = firetvCandidates[0]
            if (fallback) {
              logger.info(
                `[AI-SUGGEST] Rerouted firetv game "${game.title}" — LLM picked ${input?.name || '?'} (no ${appName}); using ${fallback.name} instead`
              )
              resolvedInput = fallback
            } else {
              rejections.push({
                gameId: `game-${gameIdx}`,
                suggestedInput: input?.name || s.suggestedInput || '?',
                reason: 'wrong_firetv_app',
                detail: `${appName} is not installed/logged-in on any free Fire TV input`,
              })
              continue
            }
          }
        }
      } else if (isDirectv) {
        channelNumberStr = game.directvChannel || game.channelNumber || ''
      } else {
        channelNumberStr = game.channelNumber || game.directvChannel || ''
      }

      // Skip if we have no valid route for this input type
      if (!channelNumberStr) {
        rejections.push({
          gameId: `game-${gameIdx}`,
          suggestedInput: resolvedInput?.name || s.suggestedInput || '?',
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
        // v2.32.100 — propagate the per-event deepLink the catalog walker
        // captured. The apply path forwards it to bartender-schedule, which
        // writes inputSourceAllocations.deep_link, which scheduler-service
        // reads at tune time so the Fire TV opens directly to the game.
        deepLink: isFiretv ? (game.deepLink || undefined) : undefined,
        suggestedInput: resolvedInput?.name || s.suggestedInput || 'Unknown',
        suggestedInputId: resolvedInput?.id || '',
        suggestedDeviceId: resolvedInput?.deviceId || '',
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
    // v2.32.3 — Use the canonical matchHomeTeamRule (DB-loaded HomeTeam
    // rows + aliases) instead of a hardcoded substring check. The
    // hardcoded array missed any home team an operator added via the UI
    // (e.g. Brewers AAA affiliates, college teams) and missed alias
    // variations (Green Bay Packers vs GB Packers vs Packers). Falls
    // back to the hardcoded list only when no DB rules are loaded.
    const HOME_TEAMS_FALLBACK = ['Packers', 'Brewers', 'Bucks', 'Badgers']
    const isHomeTeamGame = (s: AISuggestion): boolean => {
      if (homeTeamRules.length > 0) {
        return matchHomeTeamRule(s.homeTeam, s.awayTeam, homeTeamRules) !== null
      }
      return HOME_TEAMS_FALLBACK.some(t => s.homeTeam.includes(t) || s.awayTeam.includes(t))
    }

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

      // v2.28.4 — enforce home-team minTV minimums. If the LLM under-assigned
      // (e.g., 3 TVs for a Packers game when minTVs=20), pad with TVs 1..N
      // (deduped) so the operator's rule is honored even when the model drops
      // it. Doesn't deduct from other games — outputs CAN repeat across
      // games per the alternates pattern, and the operator picks at approve
      // time. Logs the pad event so operators can see the LLM was lazy here.
      if (origGame && homeTeamRules.length > 0 && tvCount > 0) {
        const rule = matchHomeTeamRule(origGame.homeTeam || '', origGame.awayTeam || '', homeTeamRules)
        if (rule && sug.suggestedOutputs.length < rule.minTVs) {
          const target = Math.min(rule.minTVs, tvCount)
          const have = new Set(sug.suggestedOutputs)
          let n = 1
          while (have.size < target && n <= tvCount) {
            have.add(n)
            n++
          }
          const padded = Array.from(have).sort((a, b) => a - b)
          const addedCount = padded.length - sug.suggestedOutputs.length
          if (addedCount > 0) {
            logger.info(
              `[AI-SUGGEST] Home-team pad: ${rule.teamName} (${origGame.awayTeam} @ ${origGame.homeTeam}) — LLM gave ${sug.suggestedOutputs.length} TVs, padded to ${padded.length} (rule minTVs=${rule.minTVs})`,
            )
            sug.suggestedOutputs = padded
            sug.reasoning = `${sug.reasoning} [auto-padded to ${padded.length} TVs per ${rule.teamName} home-team rule]`
          }
        }
      }

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

  // v2.55.42 — scheduling-logger instrumentation (closes the AI half of the
  // dedicated-log coverage). Manual path was wired in v2.55.38; this adds
  // source='ai' visibility so the operator can grep
  // /home/ubuntu/sports-bar-data/logs/scheduling-YYYY-MM-DD.log for the
  // AI's decision trail alongside the bartender's manual schedules.
  const aiReqId = newSchedulingRequestId()
  await logSchedulingEvent({
    level: 'info',
    source: 'ai',
    action: 'attempt',
    requestId: aiReqId,
    note: 'AI Suggest invoked — about to load games, inputs, patterns',
  })

  try {
    // v2.32.100 — Load input sources FIRST so the streaming catalog fetch
    // can scope to this venue's actual Fire TV inputs. Cable/satellite
    // candidates from gameSchedules are then merged with per-device
    // streaming candidates from firetv_streaming_catalog.
    const [inputSources, tvOutputs, patterns] = await Promise.all([
      loadInputSources(),
      loadTVOutputs(),
      loadSchedulingPatterns(),
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

    // 1. Fetch cable/directv games + per-device streaming candidates in parallel.
    const firetvInputs = inputSources
      .filter((s: any) => s.type === 'firetv')
      .map((s: any) => ({ id: s.id, deviceId: s.deviceId, name: s.name }))
    const [cableSatGames, streamingGames] = await Promise.all([
      fetchUpcomingGames(),
      fetchStreamingCatalogCandidates(firetvInputs),
    ])
    const games = [...cableSatGames, ...streamingGames]

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

    // 2b. Filter to games that have at least one resolved route (cable, directv, or streaming)
    const filteredGames = games.filter(g => g.channelNumber || g.directvChannel || g.streamingApp)
    logger.info(`[AI-SUGGEST] Filtered ${games.length} games (${cableSatGames.length} cable/sat + ${streamingGames.length} streaming) to ${filteredGames.length} with resolved routes`)

    if (filteredGames.length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        analyzedAt: new Date().toISOString(),
        message: `Found ${games.length} upcoming games but none match your channel presets.`,
      })
    }

    // 2c. v2.28.4 — load HomeTeam.minTVsWhenActive rules so the prompt and
    // parser can enforce per-team TV minimums (Packers=20, Bucks=5, etc.)
    let homeTeamRules: HomeTeamRule[] = []
    try {
      const homeRows = await db.select().from(schema.homeTeams).where(eq(schema.homeTeams.isActive, true)).all()
      homeTeamRules = homeRows
        .filter(r => r.isPrimary && r.minTVsWhenActive && r.minTVsWhenActive > 0)
        .map(r => {
          let aliases: string[] = [r.teamName.toLowerCase()]
          try {
            const parsed = JSON.parse(r.aliases || '[]') as string[]
            aliases = aliases.concat(parsed.map(a => a.toLowerCase()))
          } catch {}
          return {
            teamName: r.teamName,
            minTVs: r.minTVsWhenActive,
            aliases: Array.from(new Set(aliases.filter(a => a && a.length >= 3))),
            priority: r.priority || 0,
          }
        })
      logger.info(`[AI-SUGGEST] Loaded ${homeTeamRules.length} home-team minTV rules: ${homeTeamRules.map(r => `${r.teamName}=${r.minTVs}`).join(', ')}`)
    } catch (err: any) {
      logger.warn(`[AI-SUGGEST] Failed to load HomeTeam minTV rules (proceeding without): ${err.message}`)
    }

    // 3. Build prompt and call Ollama
    const prompt = buildPrompt(filteredGames, inputSources, tvOutputs, patterns, homeTeamRules)
    logger.info(`[AI-SUGGEST] Sending prompt to Ollama (${prompt.length} chars, ${games.length} games, ${inputSources.length} inputs)`)

    let ollamaResponse: string
    try {
      ollamaResponse = await callOllama(prompt)
    } catch (err: any) {
      if (err.name === 'AbortError') {
        logger.error(`[AI-SUGGEST] Ollama request timed out after ${Math.round(OLLAMA_TIMEOUT_MS / 1000)}s`)
        await logSchedulingEvent({
          level: 'error',
          source: 'ai',
          action: 'tune_fail',
          requestId: aiReqId,
          outcome: {
            httpStatus: 504,
            errorMessage: `Ollama timed out after ${Math.round(OLLAMA_TIMEOUT_MS / 1000)}s`,
          },
          note: 'AI suggestion aborted — Ollama unresponsive (may be RAM-pressured, model evicted, or service down)',
        })
        return NextResponse.json(
          { success: false, error: 'AI suggestion timed out. Ollama may be busy or unavailable.', suggestions: [] },
          { status: 504 }
        )
      }

      logger.error('[AI-SUGGEST] Ollama unavailable:', err)
      await logSchedulingEvent({
        level: 'error',
        source: 'ai',
        action: 'tune_fail',
        requestId: aiReqId,
        outcome: { httpStatus: 503, errorMessage: err.message },
        note: `Ollama at ${HARDWARE_CONFIG.ollama.baseUrl} unreachable`,
      })
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
    const { suggestions, rejections } = parseOllamaResponse(ollamaResponse, filteredGames, inputSources, homeTeamRules, tvOutputs.length)

    // v2.27.1: Persist rejection telemetry so operators can see WHY the LLM
    // dropped suggestions (zero outputs, in-batch collision, existing booking,
    // duplicate, cap exceeded). One SchedulerLog row per rejection. Best-
    // effort — failures here MUST NOT block the response.
    if (rejections.length > 0) {
      const correlationId = crypto.randomUUID()
      try {
        // v2.32.3 — Batch the per-rejection inserts into one statement.
        // Was N sequential round-trips (up to ~12 per request); now 1.
        await db.insert(schema.schedulerLogs).values(
          rejections.map((r) => ({
            correlationId,
            component: 'ai-suggest' as const,
            operation: 'reject' as const,
            level: (r.reason === 'zero_outputs' || r.reason === 'in_batch_collision' ? 'warn' : 'info') as 'warn' | 'info',
            message: `Rejected AI suggestion: ${r.reason}${r.detail ? ` (${r.detail})` : ''}`,
            gameId: r.gameId,
            success: false,
            metadata: JSON.stringify({
              reason: r.reason,
              detail: r.detail || null,
              suggestedInput: r.suggestedInput,
            }),
          }))
        )
      } catch (logErr) {
        logger.warn('[AI-SUGGEST] Failed to persist rejection telemetry:', logErr)
      }
    }

    logger.api.response('GET', '/api/scheduling/ai-suggest', 200, {
      gamesAnalyzed: games.length,
      suggestionsReturned: suggestions.length,
      rejections: rejections.length,
    })

    await logSchedulingEvent({
      level: 'info',
      source: 'ai',
      action: 'allocation_created',  // semantically: AI proposed N allocations; operator's approve flow creates them
      requestId: aiReqId,
      outcome: { httpStatus: 200 },
      note: `AI returned ${suggestions.length} suggestion(s) for ${games.length} game(s) (${rejections.length} rejections, ${inputSources.length} inputs avail, ${patterns.length} learned patterns consulted). Operator will approve via /api/schedules/bartender-schedule.`,
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
    await logSchedulingEvent({
      level: 'error',
      source: 'ai',
      action: 'tune_fail',
      requestId: aiReqId,
      outcome: { httpStatus: 500, errorMessage: error.message },
      note: 'AI Suggest threw uncaught — see PM2 stack',
    })
    return NextResponse.json(
      { success: false, error: 'Failed to generate scheduling suggestions', details: error.message },
      { status: 500 }
    )
  }
}
