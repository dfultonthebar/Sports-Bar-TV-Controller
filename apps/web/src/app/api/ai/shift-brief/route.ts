
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { and, eq, gte, lt, inArray, sql } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'
import { logLlmPerf } from '@/lib/llm-perf-logger'

// v2.52.20 (audit security #2): sanitize free-form scraper-sourced
// strings before LLM interpolation. Bananas Entertainment + venue
// discovery feed artist + venue names into NeighborhoodEvent; those
// could in principle contain newlines or instruction-shaped text that
// derails the LLM into outputting misleading operator instructions.
// Output is operator-facing only (no code-exec) but a "Heads up: all
// mics broken" line on the bartender screen is a real harm path.
function sanitizeForLlmContext(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/```+/g, "'''")
    .slice(0, 80)
    .trim()
}

// Pre-shift brief. When a bartender opens their remote or the manager
// opens the Sports Guide admin, this endpoint synthesizes:
//   - games starting in the next 12 hours, flagged home-team or not
//   - recent failure-sweep clusters worth pre-flight testing
//   - new override-digest recommendations stabilized in the last 24h
//   - default-source sanity (is every output mapped?)
// into a short markdown brief via Ollama. Cached 10 minutes — not
// regenerated on every bartender-remote page load.

const CACHE_TTL_MS = 10 * 60 * 1000
let cachedBrief: { text: string; generatedAt: number } | null = null

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const force = request.nextUrl.searchParams.get('force') === 'true'
  if (!force && cachedBrief && Date.now() - cachedBrief.generatedAt < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, brief: cachedBrief.text, generatedAt: cachedBrief.generatedAt, fromCache: true })
  }

  try {
    const context = await gatherShiftContext()
    const brief = await generateBriefViaOllama(context)
    cachedBrief = { text: brief, generatedAt: Date.now() }
    return NextResponse.json({ success: true, brief, generatedAt: cachedBrief.generatedAt, fromCache: false })
  } catch (error: any) {
    // Build an always-informative reason. A bare AbortSignal.timeout rejection
    // (or any DOMException) frequently has an EMPTY `.message`, which is why this
    // previously logged "[SHIFT-BRIEF] Error:" with nothing after it — completely
    // undiagnosable. Name the timeout case explicitly and fall back through
    // message → cause.message → name so the log is never blank.
    const errName = error?.name || 'Error'
    const reason =
      errName === 'TimeoutError' || errName === 'AbortError'
        ? 'Ollama request timed out after 90s (model not resident or box under load)'
        : error?.message || error?.cause?.message || errName
    logger.error(`[SHIFT-BRIEF] LLM generation failed: ${reason}`, error)
    // Degrade gracefully — still return something useful without the LLM
    try {
      const context = await gatherShiftContext()
      return NextResponse.json({
        success: true,
        brief: fallbackBrief(context),
        generatedAt: Date.now(),
        fromCache: false,
        llmError: reason,
      })
    } catch (e: any) {
      logger.error(`[SHIFT-BRIEF] Fallback also failed (context gather): ${e?.message || e?.name || 'unknown'}`, e)
      return NextResponse.json({ success: false, error: e?.message || 'shift-brief failed' }, { status: 500 })
    }
  }
}

// ---------- context gathering ----------

async function gatherShiftContext() {
  const nowUnix = Math.floor(Date.now() / 1000)
  // v2.55.32 — was 12 hours. Bumped to 18h so an end-of-night brief
  // (fired at 23:00) still surfaces the next-day noon games (which
  // start ~12:10 PM CDT, just past a 12h window). 18h catches them
  // without leaking 2-day-out content. Same lookback discipline as
  // the 8-item cap downstream.
  const twelveHoursLater = nowUnix + 18 * 3600

  const homeTeams = await db.select({ name: schema.homeTeams.teamName })
    .from(schema.homeTeams)
    .all()
  const homeTeamSet = new Set(homeTeams.map(h => h.name))

  const upcomingGames = await db.select({
      id: schema.gameSchedules.id,
      league: schema.gameSchedules.league,
      home: schema.gameSchedules.homeTeamName,
      away: schema.gameSchedules.awayTeamName,
      start: schema.gameSchedules.scheduledStart,
      network: schema.gameSchedules.primaryNetwork,
      status: schema.gameSchedules.status,
    })
    .from(schema.gameSchedules)
    .where(and(
      gte(schema.gameSchedules.scheduledStart, nowUnix),
      lt(schema.gameSchedules.scheduledStart, twelveHoursLater),
    ))
    .orderBy(schema.gameSchedules.scheduledStart)
    .all()

  const activeAllocations = await db.select({
      channelNumber: schema.inputSourceAllocations.channelNumber,
      tvCount: schema.inputSourceAllocations.tvCount,
      game: {
        home: schema.gameSchedules.homeTeamName,
        away: schema.gameSchedules.awayTeamName,
        start: schema.gameSchedules.scheduledStart,
        status: schema.gameSchedules.status,
      },
      source: { name: schema.inputSources.name },
    })
    .from(schema.inputSourceAllocations)
    .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
    .innerJoin(schema.inputSources, eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id))
    .where(eq(schema.inputSourceAllocations.status, 'active'))
    .all()

  // v2.32.2 — Filter the failure clusters that get into the brief.
  // failure-sweep buckets ALL recurring scheduler-log failures, but
  // AI Suggest rejections (wrong_firetv_app, no_route, in_batch_collision,
  // etc.) are scheduling-time DECISIONS, not hardware/software failures
  // the bartender should pre-test. Worse, when they appear in the brief
  // context the LLM hallucinates concrete-sounding details (e.g.
  // "Wrong FireTV app on Cable Box 2" — Cable Box 2 wasn't actually in
  // the source data; the LLM mixed it with a nearby active allocation).
  // Filter rows whose metadata.component is one of the AI-side decision
  // components — they don't belong in a "things to pre-test" list.
  const allFailureClusters = await db.select()
    .from(schema.schedulerLogs)
    .where(and(
      eq(schema.schedulerLogs.component, 'failure-sweep'),
      eq(schema.schedulerLogs.operation, 'cluster'),
      gte(schema.schedulerLogs.createdAt, nowUnix - 24 * 3600),
    ))
    .orderBy(sql`${schema.schedulerLogs.createdAt} DESC`)
    .limit(20)
    .all()

  const SCHEDULING_DECISION_COMPONENTS = new Set([
    'ai-suggest', 'smart-input-allocator', 'priority-calculator', 'conflict-detector',
  ])
  const recentFailureClusters = allFailureClusters
    .filter((r) => {
      try {
        const meta = JSON.parse(r.metadata || '{}')
        return !SCHEDULING_DECISION_COMPONENTS.has(meta.component)
      } catch {
        return true // can't parse metadata = err on the side of including it
      }
    })
    .slice(0, 5)

  const newOverrideRecs = await db.select()
    .from(schema.schedulerLogs)
    .where(and(
      eq(schema.schedulerLogs.component, 'override-digest'),
      eq(schema.schedulerLogs.operation, 'recommend'),
      gte(schema.schedulerLogs.createdAt, nowUnix - 24 * 3600),
    ))
    .orderBy(sql`${schema.schedulerLogs.createdAt} DESC`)
    .limit(5)
    .all()

  // v2.52.16 — mic status + upcoming neighborhood RF risks.
  // Gives the bartender a 1-liner on mic health + a heads-up on bands
  // playing nearby today that might step on the bar's wireless mics.
  // Operator example: "Johnny Wadd at Anduzzi's at 3pm might have mic
  // interference."
  let micStatusLine: string | null = null
  let upcomingMicRisks: Array<{ artistName: string; venueName: string; startLocal: string; confidence: number; distanceMi: number | null; known: boolean; eventType: string; source: string }> = []
  try {
    const sixtyMinAgo = nowUnix - 60 * 60
    const shureRecent = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM shure_rf_events
      WHERE event_type = 'rf_interference' AND detected_at >= ${sixtyMinAgo}
    `)
    const shureCount = shureRecent[0]?.n ?? 0

    const watcherLive = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM shure_rf_events
      WHERE detected_at >= ${nowUnix - 5 * 60}
    `)
    const watcherFresh = (watcherLive[0]?.n ?? 0) > 0

    if (!watcherFresh && shureCount === 0) {
      // Either no Shure receivers configured or watcher quiet. Either way: no alarm.
      micStatusLine = 'Mic status: nothing to report.'
    } else if (shureCount === 0) {
      micStatusLine = 'Mic status: good (no interference in the last hour).'
    } else if (shureCount < 5) {
      micStatusLine = `Mic status: ${shureCount} brief signal hiccup${shureCount > 1 ? 's' : ''} in the last hour. Probably fine — check the receivers if you hear dropouts.`
    } else {
      micStatusLine = `Mic status: ${shureCount} interference events in the last hour — wireless mic environment is busy. Worth a Shure receiver check before the rush.`
    }
  } catch {
    // shure_rf_events table missing — no Shure setup. Skip mic line.
  }

  // v2.55.32 — Pending Shure mic resync bullet (task #331 follow-up).
  // If an admin queued a receiver-side freq change via /api/shure-rf/
  // queue-freq-change and the operator hasn't IR-synced the matching
  // transmitter yet, the brief should call it out. Otherwise the
  // bartender starts a shift, picks up the mic, presses talk, and
  // hears nothing — because the TX is still on the old freq.
  let pendingResyncBullet: string | null = null
  try {
    const pendingRows = await db.all<{ channel: number; new_freq_khz: number }>(sql`
      SELECT channel, new_freq_khz FROM shure_pending_resync
      WHERE verified_at IS NULL AND canceled_at IS NULL
      ORDER BY channel
    `)
    if (pendingRows.length > 0) {
      const channelList = pendingRows.map((r) =>
        `ch${r.channel} (${(r.new_freq_khz / 1000).toFixed(3)} MHz)`,
      ).join(', ')
      pendingResyncBullet = `WIRELESS MIC RESYNC NEEDED: ${channelList} ${pendingRows.length === 1 ? 'needs' : 'need'} an IR sync — power on the transmitter${pendingRows.length === 1 ? '' : 's'}, hold ${pendingRows.length === 1 ? 'it' : 'each one'} near the receiver's IR port, press SYNC. Will not transmit on the right frequency until done.`
    }
  } catch {
    // shure_pending_resync table missing — pre-v2.55.31 box. Skip.
  }

  // Upcoming neighborhood gigs in next 12h. Join to
  // ArtistInterferenceProfile to mark known interferers.
  try {
    // v2.53.2 — category-aware radius. Bands/DJs at small venues (bars,
    // restaurants) only matter within 1 mi (RF travels < 1 mi at typical
    // wireless-mic power levels). Stadiums and concert halls get a 25-mi
    // window because Packers games at Lambeau, Resch Center concerts, and
    // Fox Cities arena sports are very high-RF events (broadcast trucks,
    // multi-channel wireless rigs) that can radiate further AND because
    // the operator wants the heads-up about the bigger event regardless.
    const upcomingRisks = await db.all<{
      artist_name: string
      venue_name: string
      start_time: number
      distance_mi: number | null
      confidence: number | null
      event_type: string
      source: string
      category: string
    }>(sql`
      SELECT
        ne.artist_name,
        nv.name AS venue_name,
        ne.start_time,
        nv.distance_mi,
        aip.confidence,
        ne.event_type,
        ne.source,
        nv.category
      FROM NeighborhoodEvent ne
      INNER JOIN NeighborhoodVenue nv ON nv.id = ne.venue_id
      LEFT JOIN ArtistInterferenceProfile aip
        ON aip.artist_normalized = ne.artist_normalized
        AND aip.location_id = ${process.env.LOCATION_ID ?? 'default-location'}
      WHERE ne.start_time > ${nowUnix}
        AND nv.is_active = 1
        AND (
          -- v2.54.74: operator directive — "don't need to see anything
          -- further than 2 miles away from the location in the shift
          -- brief". Capped BOTH big-venue + small-venue radius at 2 mi.
          -- Big venues stay on the 72h lookahead horizon (a Lambeau game
          -- 5 mi away is still worth knowing about — but the operator
          -- says no). Small venues stay on 12h.
          --
          -- This filter applies ONLY to what shows up in the shift-brief
          -- bullets. The wider-radius data (Ticketmaster 30 mi, Bananas
          -- whatever) is STILL fetched + stored in NeighborhoodEvent for
          -- the SDR pre-emptive-strike correlator + AI digest — those
          -- need wider context to do their jobs.
          (nv.category IN ('stadium', 'concert_hall')
            AND nv.distance_mi IS NOT NULL
            AND nv.distance_mi <= 2.0
            AND ne.start_time < ${nowUnix + 72 * 3600})
          OR
          (nv.category NOT IN ('stadium', 'concert_hall')
            AND (nv.distance_mi IS NULL OR nv.distance_mi <= 2.0)
            AND ne.start_time < ${twelveHoursLater})
        )
        AND (nv.is_self = 0 OR nv.is_self IS NULL)
      ORDER BY ne.start_time ASC
      LIMIT 8
    `)
    upcomingMicRisks = upcomingRisks.map((r) => {
      // v2.53.2 — date-aware formatting. Bands at neighbor bars are
      // always tonight (12h window) so just show the time. Big-venue
      // events go up to 72h out, so include day-of-week + time so the
      // LLM can phrase "tonight" / "tomorrow" / "Friday" correctly
      // instead of always saying "tonight at 7:30pm" for a Saturday show.
      const startMs = r.start_time * 1000
      const tz = HARDWARE_CONFIG.venue.timezone
      const startDate = new Date(startMs)
      const nowDate = new Date()
      const dayDeltaHours = (startMs - nowDate.getTime()) / 3_600_000
      const isToday = dayDeltaHours < 18 && startDate.getDate() === nowDate.getDate()
      const isTomorrow = !isToday && dayDeltaHours < 42
      const timeStr = startDate.toLocaleString('en-US', {
        timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
      })
      const dateTagStr = startDate.toLocaleString('en-US', {
        timeZone: tz, month: 'short', day: 'numeric',
      })
      let startLocal: string
      if (isToday) {
        startLocal = `tonight (${dateTagStr}) at ${timeStr}`
      } else if (isTomorrow) {
        startLocal = `tomorrow (${dateTagStr}) at ${timeStr}`
      } else {
        const dayStr = startDate.toLocaleString('en-US', { timeZone: tz, weekday: 'long' })
        // Force the explicit date so the LLM cannot paraphrase "Friday"
        // as "tonight" — the (May 22) parenthetical pins it.
        startLocal = `${dayStr} (${dateTagStr}) at ${timeStr}`
      }
      return {
        artistName: r.artist_name,
        venueName: r.venue_name,
        startLocal,
        confidence: r.confidence ?? 0,
        distanceMi: r.distance_mi,
        known: (r.confidence ?? 0) >= 0.6,
        eventType: r.event_type ?? 'other',
        source: r.source ?? 'unknown',
      }
    })
  } catch {
    // NeighborhoodEvent table missing — feature off. Skip.
  }

  // v2.53.6 — last 24h Atlas priority recap. Bartender starting a shift
  // wants to know what the prior shift's RF / mic environment was like:
  // any unexplained source overrides, RF-induced ghost mics, etc.
  // Excludes 'startup' (watcher boot markers, not real signal).
  let atlasPriorityRecap: string | null = null
  try {
    const dayAgoUnix = nowUnix - 24 * 3600
    const apRows = await db.all<{ event_type: string; n: number }>(sql`
      SELECT event_type, count(*) AS n
      FROM atlas_priority_events
      WHERE detected_at >= ${dayAgoUnix}
        AND event_type != 'startup'
      GROUP BY event_type
    `)
    const counts: Record<string, number> = {}
    for (const r of apRows) counts[r.event_type] = r.n

    const micActive = counts['mic_active'] ?? 0
    const rfInduced = counts['rf_induced_mic_active'] ?? 0
    const overrides = counts['source_override'] ?? 0

    if (micActive === 0 && rfInduced === 0 && overrides === 0) {
      atlasPriorityRecap = 'Last 24h Atlas priority recap: quiet (0 priority events).'
    } else {
      // Build the recap line. Order: mic-keys first (baseline), then RF
      // ghosts (worrisome), then overrides (operator-attention worthy).
      const parts: string[] = []
      if (micActive > 0) parts.push(`${micActive} mic-keys`)
      if (rfInduced > 0) parts.push(`${rfInduced} RF-induced ghost${rfInduced > 1 ? 's' : ''}`)
      if (overrides > 0) parts.push(`${overrides} manual source override${overrides > 1 ? 's' : ''}`)
      // v2.53.7 — softened tail phrasings per bartender-persona doc
      // review. "RF interference suspected, check Wireless Mics tab"
      // sounded like a red-ink order; "operator wrestled control from
      // automation" sounded like conflict went down. Bartenders are
      // anxious enough on shift; let the data carry the message.
      const tail = rfInduced > 0
        ? ' — RF interference suspected, worth a glance at the Wireless Mics tab before the rush'
        : overrides > 0
          ? ' — somebody manually picked the audio source (normal if the manager or AV tech was tweaking)'
          : ''
      atlasPriorityRecap = `Last 24h Atlas priority recap: ${parts.join(', ')}${tail}.`
    }
  } catch {
    // atlas_priority_events table missing or query failed — feature off.
  }

  // v2.53.14 — last 24h Atlas drop recap. Conditional bullet: only set
  // when at least one real zone drop fired (≥15-point drop landing ≤10).
  // Most days at most locations this is null — Atlas is stable, no
  // bullet. When it IS set, the bartender wants to know which zone+how
  // many so they can verify before the rush. atlas_drop_events has no
  // event_type column; watcher writes ONLY real drops (boot rows go in
  // atlas_priority_events.event_type='startup' — see drop watcher).
  let atlasDropRecap: string | null = null
  try {
    const dayAgoUnix = nowUnix - 24 * 3600
    const dropRows = await db.all<{ zone_number: number; zone_name: string | null; n: number }>(sql`
      SELECT zone_number, zone_name, count(*) AS n
      FROM atlas_drop_events
      WHERE detected_at >= ${dayAgoUnix}
      GROUP BY zone_number, zone_name
      ORDER BY n DESC
      LIMIT 3
    `)
    if (dropRows.length > 0) {
      const total = dropRows.reduce((acc, r) => acc + r.n, 0)
      const worst = dropRows[0]
      const worstLabel = worst.zone_name ? `${worst.zone_name} (zone ${worst.zone_number})` : `zone ${worst.zone_number}`
      atlasDropRecap = total === 1
        ? `Last 24h Atlas drops: 1 zone-gain crash in ${worstLabel} — worth a sound check before the rush.`
        : `Last 24h Atlas drops: ${total} zone-gain crashes (worst: ${worstLabel}, ${worst.n}×) — worth a sound check before the rush.`
    }
  } catch {
    // atlas_drop_events table missing or query failed — feature off.
  }

  // v2.32.25 — fleet-stale alerts. Bartender at any location can see when
  // sister locations are stuck so they can ping the operator. Soft-fail:
  // if the fleet API is down, we just skip this section.
  let fleetAlerts: string[] = []
  try {
    const port = process.env.PORT || 3001
    const res = await fetch(`http://localhost:${port}/api/fleet/status`, {
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json()
      const stuck = (data.locations || [])
        .filter((l: any) => l.staleness === 'stuck')
        .map((l: any) => `${l.displayName} (${l.versionsBehind ?? '?'} behind, last update ${l.lastAutoUpdateDate?.slice(0, 10) ?? 'never'})`)
      const warning = (data.locations || [])
        .filter((l: any) => l.staleness === 'warning')
        .map((l: any) => `${l.displayName} (${l.versionsBehind ?? '?'} behind)`)
      if (stuck.length > 0) fleetAlerts.push(`STUCK: ${stuck.join('; ')}`)
      if (warning.length > 0) fleetAlerts.push(`Falling behind: ${warning.join('; ')}`)
    }
  } catch (e: any) {
    logger.debug('[SHIFT-BRIEF] fleet status check skipped', { err: e.message })
  }

  // v2.52.17 — cap the games list. Pre-v2.52.17 fed ALL ~25 upcoming games
  // to the LLM, which (a) inflated the prompt to ~2000 tokens (= ~30s gen
  // on llama3.1:8b) and (b) caused hallucination — LLM put "Cavs @ Knicks"
  // under "Home-team games" because it lost track of which entries had
  // the [HOME TEAM] flag. Filter to: ALL home-team games + top-N
  // network-priority non-home games. Total <= 8.
  const NETWORK_PRIORITY = ['ESPN', 'ABC', 'FOX', 'TNT', 'CBS', 'NBC', 'MLB Network', 'NBA TV']
  const networkRank = (n: string | null) => {
    if (!n) return 99
    const idx = NETWORK_PRIORITY.findIndex((p) => n.toUpperCase().includes(p.toUpperCase()))
    return idx >= 0 ? idx : 99
  }
  const homeGames = upcomingGames.filter((g) => homeTeamSet.has(g.home) || homeTeamSet.has(g.away))
  const otherGames = upcomingGames
    .filter((g) => !(homeTeamSet.has(g.home) || homeTeamSet.has(g.away)))
    .sort((a, b) => {
      const r = networkRank(a.network) - networkRank(b.network)
      if (r !== 0) return r
      return (a.start ?? 0) - (b.start ?? 0)
    })
  const TOP_OTHER_GAMES = 4
  const filteredUpcomingGames = [...homeGames, ...otherGames.slice(0, TOP_OTHER_GAMES)]

  return {
    venueName: HARDWARE_CONFIG.venue.name,
    now: new Date().toLocaleString('en-US', { timeZone: HARDWARE_CONFIG.venue.timezone }),
    homeTeamNames: Array.from(homeTeamSet),
    upcomingGames: filteredUpcomingGames.map(g => ({
      matchup: `${g.away} @ ${g.home}`,
      league: g.league,
      startLocal: new Date(g.start * 1000).toLocaleString('en-US', {
        timeZone: HARDWARE_CONFIG.venue.timezone,
        hour: 'numeric', minute: '2-digit', hour12: true,
      }),
      network: g.network ?? 'unknown',
      status: g.status,
      isHomeTeam: homeTeamSet.has(g.home) || homeTeamSet.has(g.away),
    })),
    activeAllocations: activeAllocations.map(a => ({
      source: a.source?.name ?? 'unknown',
      channel: a.channelNumber,
      matchup: `${a.game?.away ?? '?'} @ ${a.game?.home ?? '?'}`,
      startLocal: a.game?.start
        ? new Date(a.game.start * 1000).toLocaleString('en-US', {
            timeZone: HARDWARE_CONFIG.venue.timezone,
            hour: 'numeric', minute: '2-digit', hour12: true,
          })
        : 'unknown',
      status: a.game?.status ?? 'unknown',
      tvs: a.tvCount,
    })),
    recentFailures: recentFailureClusters.map(r => r.message),
    // v2.53.11 — override-digest recommendations are 30-day pattern
    // observations meant for the admin dashboard, NOT bartender pre-shift
    // items. They were getting LLM-mixed into the "hardware/software
    // failures" section and surfacing "in the last 30 days" phrasing
    // that contradicts the brief's 24h scope. Kept the DB write for the
    // admin surface; just don't ship them to the bartender brief.
    newRecommendations: [],
    fleetAlerts,
    // v2.52.16 — mic status + neighborhood RF risk for the brief
    micStatusLine,
    pendingResyncBullet,
    upcomingMicRisks,
    // v2.53.6 — last 24h Atlas priority recap (mic activity summary)
    atlasPriorityRecap,
    // v2.53.14 — last 24h Atlas drop recap (conditional — null when no drops)
    atlasDropRecap,
  }
}

// ---------- LLM generation ----------

async function generateBriefViaOllama(ctx: any): Promise<string> {
  const prompt = buildPrompt(ctx)
  const startedAt = Date.now()
  const SHIFT_BRIEF_NUM_PREDICT = 320
  const resp = await fetch(`${HARDWARE_CONFIG.ollama.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: HARDWARE_CONFIG.ollama.model,
      prompt,
      stream: false,
      // v2.52.17: keep_alive=-1 mirrors v2.50.0 — keeps the model
      // resident in RAM/VRAM between requests so the second + later
      // briefs feel snappy.
      // num_predict: 200 → 320 in v2.53.6 to leave headroom for the
      // new Atlas-priority recap bullet (200 was truncating mid-failure
      // section before the Atlas line could render; 280 still cut the
      // tail; 320 reliably fits the full brief).
      keep_alive: -1,
      options: { temperature: 0.2, num_predict: SHIFT_BRIEF_NUM_PREDICT },
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!resp.ok) {
    throw new Error(`Ollama returned ${resp.status}`)
  }
  const data = await resp.json()
  void logLlmPerf({
    feature: 'shift-brief',
    model: HARDWARE_CONFIG.ollama.model,
    totalMs: Date.now() - startedAt,
    evalCount: data.eval_count,
    promptEvalCount: data.prompt_eval_count,
    doneReason: data.done_reason,
    numPredict: SHIFT_BRIEF_NUM_PREDICT,
    outcome: 'ok',
  })
  return (data.response || '').trim()
}

function buildPrompt(ctx: any): string {
  const games = ctx.upcomingGames.length > 0
    ? ctx.upcomingGames.map((g: any) =>
        `- ${g.startLocal}: ${g.matchup} (${g.league}) on ${g.network}${g.isHomeTeam ? ' [HOME TEAM]' : ''} — status=${g.status}`
      ).join('\n')
    : '- (no games scheduled in next 12 hours)'
  const active = ctx.activeAllocations.length > 0
    ? ctx.activeAllocations.map((a: any) => `- ${a.source} ch ${a.channel}: ${a.matchup} (${a.tvs} TVs, started ${a.startLocal}, ${a.status})`).join('\n')
    : '- (no games currently on)'
  const failures = ctx.recentFailures.length > 0
    ? ctx.recentFailures.map((m: string) => `- ${m}`).join('\n')
    : '- (no recent failure clusters)'
  const fleet = ctx.fleetAlerts && ctx.fleetAlerts.length > 0
    ? ctx.fleetAlerts.map((m: string) => `- ${m}`).join('\n')
    : '- (sister locations all healthy)'

  // v2.52.16 — mic status + neighborhood RF risk
  // v2.53.3 — pre-build as a complete bullet so LLM doesn't re-prefix
  // it as "Wireless mic status: Mic status: good" (the data already
  // starts with "Mic status:" — the v2.52.16 prompt rule asking the
  // LLM to "not prefix" was unreliable).
  const micBullet = `- ${ctx.micStatusLine ?? 'Mic status: no Shure receiver configured'}`
  // v2.53.2 — server-built heads-up bullets. We assemble each bullet
  // with the right phrasing + DATE here so the LLM can't paraphrase
  // "Friday (May 22)" into "tonight". Then we tell the LLM to include
  // each bullet verbatim — same pattern as the mic-status line.
  const headsUpBullets: string[] = []
  for (const r of (ctx.upcomingMicRisks || []) as any[]) {
    const artist = sanitizeForLlmContext(r.artistName)
    const venue = sanitizeForLlmContext(r.venueName)
    const dist = r.distanceMi != null ? ` (${r.distanceMi.toFixed(1)} mi away)` : ''
    if (r.eventType === 'sports') {
      // Always include sports — stadium events are universally high RF.
      headsUpBullets.push(
        `- Heads up: ${artist} at ${venue} ${r.startLocal}${dist} — stadium broadcast trucks usually cause RF noise`,
      )
    } else if (r.eventType === 'concert') {
      // Always include concerts — concert wireless rigs are RF-dense.
      headsUpBullets.push(
        `- Heads up: ${artist} at ${venue} ${r.startLocal}${dist} — concert wireless rigs may step on our mics`,
      )
    } else if (r.known || (r.distanceMi != null && r.distanceMi <= 0.5)) {
      // Band/DJ at neighbor bar — only surface if KNOWN INTERFERER or
      // very close (≤ 0.5 mi). Distance-based filter keeps the brief
      // tight when there are 5 random unknowns within 1 mi.
      const flag = r.known ? ' — known interferer from past gigs' : ''
      headsUpBullets.push(
        `- Heads up: ${artist} at ${venue} ${r.startLocal}${dist}${flag} might cause mic interference`,
      )
    }
  }
  const upcomingRisks = headsUpBullets.length > 0
    ? headsUpBullets.join('\n')
    : '(no upcoming neighborhood events worth flagging)'

  // v2.53.6 — pre-built Atlas priority recap bullet. Same verbatim
  // pattern as the mic-status + heads-up bullets so the LLM doesn't
  // rephrase the numbers.
  const atlasRecapBullet = ctx.atlasPriorityRecap
    ? `- ${ctx.atlasPriorityRecap}`
    : null
  // v2.53.14 — conditional drops bullet. ctx.atlasDropRecap is null
  // when no drops fired in the last 24h, in which case nothing appears
  // in the brief. Same server-built-verbatim treatment as priority recap.
  const atlasDropBullet = ctx.atlasDropRecap
    ? `- ${ctx.atlasDropRecap}`
    : null

  // v2.52.17: explicit home-team list in the prompt + strict rule
  // about not inventing/relabeling teams. The home-team list is the
  // ONLY source of truth for whether a game is "our team."
  const homeTeamList = (ctx.homeTeamNames || []).length > 0
    ? (ctx.homeTeamNames || []).join(', ')
    : '(no home teams configured for this bar)'

  // v2.55.32 — server-build the Home-team + Other-games sections verbatim
  // because llama3.1:8b was hallucinating "Bears @ Vikings" and "Packers
  // @ Lions" in June (no NFL season) when given just a games list. Even
  // with the explicit list and a "use the matchup string VERBATIM" rule,
  // the model substituted Green-Bay-relevant teams (the venue is Holmgren
  // Way Bar — primed by the bar context). Per Gotcha #12 / memory
  // feedback-llm-server-built-verbatim, the only reliable fix is to
  // pre-build the lines server-side and feed them as PRE-WRITTEN sections.
  const homeGamesList = (ctx.upcomingGames || []).filter((g: any) => g.isHomeTeam)
  const otherGamesList = (ctx.upcomingGames || []).filter((g: any) => !g.isHomeTeam).slice(0, 4)

  const homeGamesSection = homeGamesList.length > 0
    ? `Home-team games tonight:\n${homeGamesList.map((g: any) =>
        `- ${g.startLocal}: ${g.matchup} (${g.network})`,
      ).join('\n')}`
    : 'Home-team games tonight: none.'

  const otherGamesSection = otherGamesList.length > 0
    ? `Other games:\n${otherGamesList.map((g: any) =>
        `- ${g.startLocal}: ${g.matchup} (${g.network})`,
      ).join('\n')}`
    : 'Other games: none in the next 12 hours.'

  return `You are the shift manager at ${ctx.venueName}, a sports bar. Write a VERY concise (under 130 words) pre-shift brief for the bartender coming on. Current time: ${ctx.now}.

Our home teams (for THIS bar — anything not in this list is NOT a home-team game): ${homeTeamList}

Upcoming games (next 12 hours):
${games}

Currently playing:
${active}

Recent hardware/software failures to watch for (last 24 hours ONLY — actual device/network/routing errors from logs, not scheduling-pattern observations):
${failures}

Sister-location health (TELL THE OWNER if any are stuck):
${fleet}

Home-team games section — PRE-WRITTEN, include EXACTLY as shown as its
own section in the brief. Do NOT rephrase, do NOT add games not in this
list, do NOT swap teams, do NOT add networks not shown:
${homeGamesSection}

Other-games section — PRE-WRITTEN, include EXACTLY as shown as its own
section in the brief. Do NOT rephrase, do NOT add games not in this list,
do NOT substitute teams (even teams from this bar's home-team list), do
NOT change "Away @ Home" order:
${otherGamesSection}

Wireless mic status bullet — this is PRE-WRITTEN as a complete bullet,
include it EXACTLY as shown, no prefix, no rephrasing:
${micBullet}

${ctx.pendingResyncBullet
  ? `Pending mic resync bullet — PRE-WRITTEN, include EXACTLY as shown as its own bullet near the top of the brief. This is a HIGH-PRIORITY operational alert — the bartender MUST see it. Do NOT rephrase, do NOT shorten:\n- ${ctx.pendingResyncBullet}`
  : ''}

Neighborhood-event heads-up bullets — these are PRE-WRITTEN and you
MUST include each one in the brief EXACTLY AS WRITTEN, on its own line,
no rewording, no day-of-week swapping ("Friday" stays "Friday", do
not collapse to "tonight"). Or skip the whole section if it says
"no upcoming neighborhood events worth flagging".
${upcomingRisks}

${atlasRecapBullet
  ? `Atlas priority recap bullet — PRE-WRITTEN, include EXACTLY as shown as its own bullet, do not rephrase the numbers, do not add a label or section header (the bullet is self-labeled):\n${atlasRecapBullet}`
  : ''}

${atlasDropBullet
  ? `Atlas drops bullet — PRE-WRITTEN, include EXACTLY as shown as its own bullet, do not rephrase the numbers or zone names, do not add a label or section header (the bullet is self-labeled). This bullet only appears when real zone-gain crashes were detected; treat it as a high-signal pre-shift check item:\n${atlasDropBullet}`
  : ''}

Format:
- Start with a one-line headline for the biggest game tonight. If a home-team game appears in the Home-team games section, headline that. Otherwise pick the biggest networks game (ESPN/ABC/FOX/etc.) from the Other-games section. If both sections say "none", write "No games scheduled tonight."
- Include the PRE-WRITTEN Home-team games section EXACTLY as provided above (under its "Home-team games tonight:" heading or its "none" sentinel). Do NOT regenerate it. Do NOT add teams not in that section.
- Include the PRE-WRITTEN Other-games section EXACTLY as provided above (under its "Other games:" heading or its "none" sentinel). Do NOT regenerate it. Do NOT add teams not in that section.
- Mention any recent failures the bartender should pre-test.
- Include the pre-written mic-status bullet VERBATIM as one of the bullets. Do not add a prefix like "Wireless mic status:" — the bullet already starts with "Mic status:".
- For neighborhood-event heads-up bullets, include them VERBATIM (see the dedicated section above). Do not rephrase. Do not change "Friday (May 22)" to "tonight". Do not merge multiple bullets into one.
- If sister-location health shows STUCK locations, add ONE line: "TELL OWNER: <names> stuck on auto-update".
- Use plain text, bullets OK, no markdown headings. Be direct — no hedging phrases like "you might want to consider". The bartender is experienced.

CRITICAL: Only reference game start times that are explicitly listed above. Never invent, estimate, or round times. If a game's time is not in the data, do not mention any time for it. If a game is marked "in_progress", use the "started at <time>" from the Currently-playing section verbatim and do not reframe it as an upcoming start time.

CRITICAL: For neighborhood events (heads-up lines), use the day/time string from the data EXACTLY as written. The string is one of "tonight at <time>" / "tomorrow at <time>" / "<DayName> at <time>". If the data says "Friday at 7:30 PM", write "Friday at 7:30 PM" — do NOT rewrite it as "tonight" or "tomorrow". The bartender needs to know the correct day for an event 2+ days out.
`
}

// ---------- fallback (no LLM) ----------

function fallbackBrief(ctx: any): string {
  const lines: string[] = []
  lines.push(`**${ctx.venueName}** — ${ctx.now}`)
  lines.push('')
  const home = ctx.upcomingGames.filter((g: any) => g.isHomeTeam)
  if (home.length > 0) {
    lines.push(`HOME TEAM GAMES TONIGHT:`)
    for (const g of home) lines.push(`  ${g.startLocal}: ${g.matchup} (${g.network})`)
    lines.push('')
  }
  const other = ctx.upcomingGames.filter((g: any) => !g.isHomeTeam).slice(0, 6)
  if (other.length > 0) {
    lines.push(`Other games:`)
    for (const g of other) lines.push(`  ${g.startLocal}: ${g.matchup} (${g.network})`)
    lines.push('')
  }
  if (ctx.activeAllocations.length > 0) {
    lines.push(`Currently on:`)
    for (const a of ctx.activeAllocations) lines.push(`  ${a.source} ch ${a.channel}: ${a.matchup} (started ${a.startLocal}, ${a.tvs} TVs)`)
    lines.push('')
  }
  if (ctx.recentFailures.length > 0) {
    lines.push(`Failures in last 24h:`)
    for (const m of ctx.recentFailures) lines.push(`  ${m}`)
    lines.push('')
  }
  if (ctx.fleetAlerts && ctx.fleetAlerts.length > 0) {
    lines.push(`TELL OWNER — sister locations stuck:`)
    for (const m of ctx.fleetAlerts) lines.push(`  ${m}`)
    lines.push('')
  }
  // v2.52.16 — mic status + neighborhood RF risk in the fallback
  if (ctx.micStatusLine) {
    lines.push(ctx.micStatusLine)
  }
  // v2.55.32 — pending mic resync in the LLM-less fallback path too.
  if (ctx.pendingResyncBullet) {
    lines.push(ctx.pendingResyncBullet)
  }
  if ((ctx.upcomingMicRisks ?? []).length > 0) {
    const relevant = ctx.upcomingMicRisks.filter(
      (r: any) => r.known || (r.distanceMi != null && r.distanceMi <= 0.5),
    )
    for (const r of relevant) {
      const flag = r.known ? ' (known interferer from past gigs)' : ''
      lines.push(`Heads up: ${sanitizeForLlmContext(r.artistName)} at ${sanitizeForLlmContext(r.venueName)} at ${r.startLocal} might cause mic interference${flag}.`)
    }
  }
  // v2.53.6 — Atlas priority recap also shows on the LLM-less fallback path,
  // not just the happy path. The 24h mic-activity summary is arguably MOST
  // useful when Ollama is down — operators want to know if last shift had
  // issues even if the brief is degraded.
  if (ctx.atlasPriorityRecap) {
    lines.push(ctx.atlasPriorityRecap)
  }
  // v2.53.14 — Atlas drops bullet on the LLM-less fallback path too.
  // Conditional in the same way: only fires when real drops happened.
  if (ctx.atlasDropRecap) {
    lines.push(ctx.atlasDropRecap)
  }
  return lines.join('\n')
}
