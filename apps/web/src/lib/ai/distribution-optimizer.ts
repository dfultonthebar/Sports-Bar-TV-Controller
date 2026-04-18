/**
 * Pre-schedule Distribution Optimizer
 *
 * Given a batch of proposed games (e.g., a morning "approve all suggested
 * games" action), produce the single best end-of-day assignment plan
 * that maximizes coverage across all input sources. Not LLM-driven — this
 * is constrained assignment with historical preferences baked in.
 *
 * Key inputs (all from prior games this location has actually run):
 *   - `scheduling_patterns` rows where pattern_type='team_routing'
 *     (written hourly by pattern-analyzer from post-correction
 *     tv_output_ids). This tells us: Brewers has gone on Cable Box 1
 *     outputs [1,3,5,6,8,10,12,13,14,16] historically.
 *   - Stable override-digest recommendations (SchedulerLog
 *     component='override-digest' operation='recommend' with
 *     occurrences ≥ 3). When a bartender has repeatedly adjusted a
 *     team's TV list, trust it.
 *   - Per-league duration stats from `game_schedules.duration_minutes`
 *     — lets the optimizer pack back-to-back games tightly when one
 *     sport runs short (e.g., NBA ~135m) so a later game can reuse an
 *     input source without a conflict.
 *
 * Hard constraints:
 *   - A cable box / fire cube can only run one game at a time. Two games
 *     that overlap in time can't share an input.
 *   - A TV output can only show one input at a time. Assigned output
 *     sets must be disjoint across games whose time windows overlap.
 *
 * Soft preferences (used for scoring; violated when necessary):
 *   - Home teams (HomeTeam table) get priority assignment — they get
 *     their historical preferred inputs FIRST.
 *   - Spread load: prefer a cable box not yet used in the plan batch.
 *   - Use the team's historical preferred outputs when possible.
 *
 * Output is a dry-run plan. Caller commits each line through the
 * existing POST /api/schedules/bartender-schedule endpoint.
 */

import { db, schema } from '@/db'
import { and, eq, gt, inArray, isNotNull, lt, or, sql } from 'drizzle-orm'
import { getExpectedDurationSeconds } from '@/lib/game-duration-stats'

// ---------- types ----------

export interface ProposedGame {
  gameScheduleId: string
  preferredTvCount?: number        // bartender's ask; optimizer may shrink
  priority?: number                // 0-100, higher = assigned first
}

export interface AssignmentPlan {
  gameId: string
  gameDescription: string
  league: string
  isHomeTeam: boolean
  inputSourceId: string
  inputSourceName: string
  inputSourceType: string
  channelNumber: string
  tvOutputIds: number[]
  tuneAtUnix: number
  expectedFreeAtUnix: number
  durationMinutes: number
  durationSource: 'learned' | 'default'
  score: number
  reasoning: string[]
  preflight: {
    channelMappingExists: boolean
    inputSourceActive: boolean
    outputsFree: boolean
    overallOk: boolean
  }
}

export interface UnassignedGame {
  gameId: string
  gameDescription: string
  reason: string
}

export interface DistributionPlanResult {
  plan: AssignmentPlan[]
  unassigned: UnassignedGame[]
  warnings: string[]
  stats: {
    totalGames: number
    assigned: number
    homeTeamGames: number
    homeTeamAssigned: number
    inputSourcesUsed: number
    avgTvsPerGame: number
  }
}

// ---------- main entry point ----------

export async function buildDistributionPlan(
  proposedGames: ProposedGame[]
): Promise<DistributionPlanResult> {
  if (proposedGames.length === 0) {
    return { plan: [], unassigned: [], warnings: [], stats: zeroStats() }
  }

  // Hydrate everything we need once; constrained assignment is purely
  // in-memory from here on.
  const games = await hydrateGames(proposedGames)
  const inputSources = await loadInputSources()
  const teamPatterns = await loadTeamPatterns()
  const overrideRecs = await loadOverrideRecommendations()
  const channelMappings = await loadChannelMappings()
  const homeTeams = await loadHomeTeamNames()

  // Sort games: home teams first (they get first pick of their
  // historical preferred inputs), then by scheduled_start asc (earlier
  // games get inputs first and their overlap windows are known), then
  // descending by caller-provided priority.
  const sorted = [...games].sort((a, b) => {
    const aHome = isHomeTeamGame(a, homeTeams)
    const bHome = isHomeTeamGame(b, homeTeams)
    if (aHome !== bHome) return aHome ? -1 : 1
    if (a.scheduledStart !== b.scheduledStart) return a.scheduledStart - b.scheduledStart
    return (b.priority ?? 50) - (a.priority ?? 50)
  })

  // Batch-local occupancy tracking. Maps input_source_id → array of
  // [startUnix, endUnix] windows already claimed in this plan.
  const inputOccupancy = new Map<string, Array<[number, number]>>()
  const outputOccupancy = new Map<number, Array<[number, number]>>()
  const usedInputSources = new Set<string>()

  const plan: AssignmentPlan[] = []
  const unassigned: UnassignedGame[] = []
  const warnings: string[] = []

  for (const g of sorted) {
    const assignment = await tryAssignGame(
      g,
      inputSources,
      teamPatterns,
      overrideRecs,
      channelMappings,
      homeTeams,
      inputOccupancy,
      outputOccupancy,
      usedInputSources
    )
    if (assignment) {
      plan.push(assignment)
      pushWindow(inputOccupancy, assignment.inputSourceId, [assignment.tuneAtUnix, assignment.expectedFreeAtUnix])
      for (const out of assignment.tvOutputIds) {
        pushWindow(outputOccupancy, out, [assignment.tuneAtUnix, assignment.expectedFreeAtUnix])
      }
      usedInputSources.add(assignment.inputSourceId)
    } else {
      unassigned.push({
        gameId: g.id,
        gameDescription: `${g.awayTeamName} @ ${g.homeTeamName}`,
        reason: 'No available input source for this time window (all boxes booked during overlap)',
      })
    }
  }

  if (unassigned.length > 0) {
    warnings.push(`${unassigned.length} game(s) could not be placed — all input sources were booked during their time windows. Consider shrinking earlier games' durations or shifting start times.`)
  }

  return {
    plan,
    unassigned,
    warnings,
    stats: computeStats(plan, sorted, homeTeams),
  }
}

// ---------- assignment core ----------

async function tryAssignGame(
  g: HydratedGame,
  allInputs: InputSourceRow[],
  teamPatterns: Map<string, TeamPattern>,
  overrideRecs: Map<string, number[]>,
  channelMappings: Map<string, Set<string>>,
  homeTeams: Set<string>,
  inputOccupancy: Map<string, Array<[number, number]>>,
  outputOccupancy: Map<number, Array<[number, number]>>,
  usedInputSources: Set<string>
): Promise<AssignmentPlan | null> {
  const reasoning: string[] = []
  const isHome = isHomeTeamGame(g, homeTeams)
  const { durationSeconds, source: durationSource, sampleCount } = await getExpectedDurationSeconds(g.league)
  const expectedFreeAt = g.scheduledStart + durationSeconds
  reasoning.push(`Duration ${Math.round(durationSeconds / 60)}min (${durationSource === 'learned' ? `learned from ${sampleCount} games` : 'default — no history yet'})`)

  // Rank candidate inputs by score. Higher score wins.
  const candidates = allInputs
    .filter(src => src.isActive !== false)
    .map(src => ({ src, score: scoreInputSource(g, src, teamPatterns, usedInputSources, isHome) }))
    .sort((a, b) => b.score - a.score)

  for (const { src, score: inputScore } of candidates) {
    // Time-window constraint on the input source
    if (hasConflict(inputOccupancy.get(src.id) || [], g.scheduledStart, expectedFreeAt)) {
      continue
    }

    const preferredOutputs = resolvePreferredOutputs(
      g,
      src.id,
      teamPatterns,
      overrideRecs
    )

    // Pick output set: start with pattern/override recommendation, trim
    // any that conflict with prior batch assignments in the overlap
    // window. If we end up with zero, fall back to an empty set (the
    // UI will prompt the bartender to pick outputs).
    const tvOutputIds = preferredOutputs.filter(out =>
      !hasConflict(outputOccupancy.get(out) || [], g.scheduledStart, expectedFreeAt)
    )
    if (preferredOutputs.length > 0 && tvOutputIds.length < preferredOutputs.length) {
      reasoning.push(`Trimmed ${preferredOutputs.length - tvOutputIds.length} output(s) due to batch-local conflicts`)
    }

    const channelNumber = bestChannelForGame(g, src, channelMappings)
    if (!channelNumber) {
      // Without a channel mapping we can't tune — try next input
      reasoning.push(`Skipped ${src.name}: no channel mapping for broadcast networks ${JSON.stringify(g.broadcastNetworks)}`)
      continue
    }

    reasoning.push(`Picked ${src.name} (score ${inputScore})`)
    if (isHome) reasoning.unshift(`Home team priority: ${g.homeTeamName}`)

    const preflight = {
      channelMappingExists: true,
      inputSourceActive: src.isActive !== false,
      outputsFree: tvOutputIds.length > 0,
      overallOk: false,
    }
    preflight.overallOk = preflight.channelMappingExists && preflight.inputSourceActive && preflight.outputsFree

    return {
      gameId: g.id,
      gameDescription: `${g.awayTeamName} @ ${g.homeTeamName}`,
      league: g.league,
      isHomeTeam: isHome,
      inputSourceId: src.id,
      inputSourceName: src.name,
      inputSourceType: src.type,
      channelNumber,
      tvOutputIds,
      tuneAtUnix: g.scheduledStart,
      expectedFreeAtUnix: expectedFreeAt,
      durationMinutes: Math.round(durationSeconds / 60),
      durationSource,
      score: inputScore,
      reasoning,
      preflight,
    }
  }

  return null
}

// ---------- scoring ----------

function scoreInputSource(
  g: HydratedGame,
  src: InputSourceRow,
  teamPatterns: Map<string, TeamPattern>,
  usedInputSources: Set<string>,
  isHome: boolean
): number {
  let score = 0

  // Broadcast-network match. Cable can tune anything (generic score);
  // firetv needs app-name match. Assume true if inputsource type==cable
  // or directv (both tune channels); firetv only if a network is
  // streaming-compatible.
  if (src.type === 'cable' || src.type === 'directv') {
    score += 20
  } else if (src.type === 'firetv') {
    if (streamingCompatible(g.broadcastNetworks)) score += 15
    else score -= 20 // strongly disfavor firetv for linear-only broadcasts
  }

  // Historical team pattern: has this team lived on this input before?
  const pattern = teamPatterns.get(g.homeTeamName) || teamPatterns.get(g.awayTeamName)
  if (pattern) {
    if (pattern.preferredInputId === src.id) {
      score += isHome ? 40 : 25
    }
  }

  // Spread load: penalize an input already used in this plan batch
  if (usedInputSources.has(src.id)) score -= 8

  return score
}

function resolvePreferredOutputs(
  g: HydratedGame,
  inputSourceId: string,
  teamPatterns: Map<string, TeamPattern>,
  overrideRecs: Map<string, number[]>
): number[] {
  // Priority order:
  //   1. override-digest stable "add" recommendations for this team
  //   2. team_routing preferredOutputs when the input matches
  //   3. empty set — caller picks
  const teamKey = g.homeTeamName
  const overrideOutputs = overrideRecs.get(teamKey) || overrideRecs.get(g.awayTeamName)
  if (overrideOutputs && overrideOutputs.length > 0) return [...overrideOutputs]

  const pattern = teamPatterns.get(teamKey) || teamPatterns.get(g.awayTeamName)
  if (pattern && pattern.preferredInputId === inputSourceId) {
    return [...pattern.preferredOutputs]
  }
  return []
}

// ---------- data loaders ----------

interface HydratedGame {
  id: string
  awayTeamName: string
  homeTeamName: string
  league: string
  scheduledStart: number
  broadcastNetworks: string[]
  priority?: number
}

async function hydrateGames(proposed: ProposedGame[]): Promise<HydratedGame[]> {
  const ids = proposed.map(p => p.gameScheduleId)
  const rows = await db.select().from(schema.gameSchedules)
    .where(inArray(schema.gameSchedules.id, ids))
    .all()
  const priorityById = new Map(proposed.map(p => [p.gameScheduleId, p.priority]))
  return rows.map(r => ({
    id: r.id,
    awayTeamName: r.awayTeamName,
    homeTeamName: r.homeTeamName,
    league: r.league,
    scheduledStart: r.scheduledStart,
    broadcastNetworks: safeParseArray(r.broadcastNetworks),
    priority: priorityById.get(r.id) ?? undefined,
  }))
}

interface InputSourceRow {
  id: string
  name: string
  type: string
  isActive: boolean
}

async function loadInputSources(): Promise<InputSourceRow[]> {
  const rows = await db.select({
      id: schema.inputSources.id,
      name: schema.inputSources.name,
      type: schema.inputSources.type,
      isActive: schema.inputSources.isActive,
    })
    .from(schema.inputSources)
    .all()
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    isActive: r.isActive !== false,
  }))
}

interface TeamPattern {
  team: string
  preferredInput: string
  preferredInputId: string
  preferredOutputs: number[]
  frequency: number
}

async function loadTeamPatterns(): Promise<Map<string, TeamPattern>> {
  const rows = await db.select()
    .from(schema.schedulingPatterns)
    .where(eq(schema.schedulingPatterns.patternType, 'team_routing'))
    .all()
  const map = new Map<string, TeamPattern>()
  for (const r of rows) {
    try {
      const p = JSON.parse(r.patternData)
      if (p.team && p.preferredInputId) map.set(p.team, p as TeamPattern)
    } catch {}
  }
  return map
}

async function loadOverrideRecommendations(): Promise<Map<string, number[]>> {
  // Team-keyed set of recurring 'add' outputs from the digester.
  const cutoff = Math.floor(Date.now() / 1000) - 30 * 86400
  const rows = await db.select()
    .from(schema.schedulerLogs)
    .where(and(
      eq(schema.schedulerLogs.component, 'override-digest'),
      eq(schema.schedulerLogs.operation, 'recommend'),
      gt(schema.schedulerLogs.createdAt, cutoff),
    ))
    .all()
  const map = new Map<string, number[]>()
  for (const r of rows) {
    if (!r.metadata) continue
    try {
      const m = JSON.parse(r.metadata)
      if (m.action === 'add' && m.team && typeof m.outputNum === 'number') {
        const arr = map.get(m.team) || []
        if (!arr.includes(m.outputNum)) arr.push(m.outputNum)
        map.set(m.team, arr)
      }
    } catch {}
  }
  return map
}

async function loadChannelMappings(): Promise<Map<string, Set<string>>> {
  // Map inputSourceId → set of channel numbers it has a preset for.
  // Used to pre-flight whether we can tune this game on this source.
  const rows = await db.select({
      deviceType: schema.channelPresets.deviceType,
      channelNumber: schema.channelPresets.channelNumber,
    })
    .from(schema.channelPresets)
    .all()
  // Keying by deviceType (cable/directv/firetv) rather than input_source_id;
  // presets are currently per-device-type at this location.
  const map = new Map<string, Set<string>>()
  for (const r of rows) {
    const key = (r.deviceType || '').toLowerCase()
    const s = map.get(key) || new Set()
    s.add(String(r.channelNumber))
    map.set(key, s)
  }
  return map
}

async function loadHomeTeamNames(): Promise<Set<string>> {
  const rows = await db.select({ name: schema.homeTeams.teamName })
    .from(schema.homeTeams)
    .all()
  return new Set(rows.map(r => r.name))
}

// ---------- helpers ----------

function isHomeTeamGame(g: HydratedGame, homeTeams: Set<string>): boolean {
  return homeTeams.has(g.homeTeamName) || homeTeams.has(g.awayTeamName)
}

function streamingCompatible(networks: string[]): boolean {
  // Conservative: treat these as firetv-compatible.
  const streamingKeywords = ['Peacock', 'Paramount+', 'Apple TV', 'Prime', 'Amazon', 'MLB.TV', 'ESPN+', 'NBA TV', 'NHL Network', 'MAX']
  return networks.some(n => streamingKeywords.some(k => n.includes(k)))
}

function bestChannelForGame(
  g: HydratedGame,
  src: InputSourceRow,
  channelMappings: Map<string, Set<string>>
): string | null {
  // For linear sources (cable/directv) we need at least one broadcast
  // network the mapping knows. If nothing matches, we decline this
  // input for this game. We don't try to parse a channel NUMBER out of
  // the network list — the caller (bartender or AI Suggest) has
  // already paired the game to a preset before submitting. This
  // function is intentionally conservative: it returns the FIRST known
  // channel as a placeholder so the caller can override per-line in
  // the UI.
  const known = channelMappings.get(src.type.toLowerCase())
  if (!known || known.size === 0) return null
  // Placeholder: first known channel — UI shows this and caller can
  // re-select per-game before commit.
  return [...known][0]
}

function hasConflict(
  windows: Array<[number, number]>,
  start: number,
  end: number
): boolean {
  return windows.some(([a, b]) => start < b && end > a)
}

function pushWindow(
  map: Map<any, Array<[number, number]>>,
  key: any,
  w: [number, number]
) {
  const arr = map.get(key) || []
  arr.push(w)
  map.set(key, arr)
}

function safeParseArray(s: string | null | undefined): string[] {
  if (!s) return []
  try {
    const x = JSON.parse(s)
    return Array.isArray(x) ? x.filter(v => typeof v === 'string') : []
  } catch { return [] }
}

function zeroStats() {
  return {
    totalGames: 0,
    assigned: 0,
    homeTeamGames: 0,
    homeTeamAssigned: 0,
    inputSourcesUsed: 0,
    avgTvsPerGame: 0,
  }
}

function computeStats(
  plan: AssignmentPlan[],
  allGames: HydratedGame[],
  homeTeams: Set<string>
) {
  const homeTeamGames = allGames.filter(g => isHomeTeamGame(g, homeTeams)).length
  const homeTeamAssigned = plan.filter(p => p.isHomeTeam).length
  const tvCounts = plan.map(p => p.tvOutputIds.length)
  const avgTvs = tvCounts.length > 0 ? tvCounts.reduce((a, b) => a + b, 0) / tvCounts.length : 0
  return {
    totalGames: allGames.length,
    assigned: plan.length,
    homeTeamGames,
    homeTeamAssigned,
    inputSourcesUsed: new Set(plan.map(p => p.inputSourceId)).size,
    avgTvsPerGame: Math.round(avgTvs * 10) / 10,
  }
}
