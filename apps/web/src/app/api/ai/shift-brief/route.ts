
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { and, eq, gte, lt, inArray, sql } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'

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
    logger.error('[SHIFT-BRIEF] Error:', error)
    // Degrade gracefully — still return something useful without the LLM
    try {
      const context = await gatherShiftContext()
      return NextResponse.json({
        success: true,
        brief: fallbackBrief(context),
        generatedAt: Date.now(),
        fromCache: false,
        llmError: error.message,
      })
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
  }
}

// ---------- context gathering ----------

async function gatherShiftContext() {
  const nowUnix = Math.floor(Date.now() / 1000)
  const twelveHoursLater = nowUnix + 12 * 3600

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

  const recentFailureClusters = await db.select()
    .from(schema.schedulerLogs)
    .where(and(
      eq(schema.schedulerLogs.component, 'failure-sweep'),
      eq(schema.schedulerLogs.operation, 'cluster'),
      gte(schema.schedulerLogs.createdAt, nowUnix - 24 * 3600),
    ))
    .orderBy(sql`${schema.schedulerLogs.createdAt} DESC`)
    .limit(5)
    .all()

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

  return {
    venueName: HARDWARE_CONFIG.venue.name,
    now: new Date().toLocaleString('en-US', { timeZone: HARDWARE_CONFIG.venue.timezone }),
    upcomingGames: upcomingGames.map(g => ({
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
    newRecommendations: newOverrideRecs.map(r => r.message),
  }
}

// ---------- LLM generation ----------

async function generateBriefViaOllama(ctx: any): Promise<string> {
  const prompt = buildPrompt(ctx)
  const resp = await fetch(`${HARDWARE_CONFIG.ollama.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: HARDWARE_CONFIG.ollama.model,
      prompt,
      stream: false,
      options: { temperature: 0.3, num_predict: 220 },
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!resp.ok) {
    throw new Error(`Ollama returned ${resp.status}`)
  }
  const data = await resp.json()
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
  const recs = ctx.newRecommendations.length > 0
    ? ctx.newRecommendations.map((m: string) => `- ${m}`).join('\n')
    : '- (no new learning recommendations)'

  return `You are the shift manager at ${ctx.venueName}, a sports bar. Write a VERY concise (under 120 words) pre-shift brief for the bartender coming on. Current time: ${ctx.now}.

Upcoming games (next 12 hours):
${games}

Currently playing:
${active}

Recent hardware/software failures to watch for:
${failures}

New learnings from bartender corrections:
${recs}

Format:
- Start with a one-line headline for the biggest game tonight.
- Call out home-team games (Brewers, Bucks, Badgers) first.
- Mention any recent failures the bartender should pre-test.
- Use plain text, bullets OK, no markdown headings. Be direct — no hedging phrases like "you might want to consider". The bartender is experienced.

CRITICAL: Only reference game start times that are explicitly listed above. Never invent, estimate, or round times. If a game's time is not in the data, do not mention any time for it. If a game is marked "in_progress", use the "started at <time>" from the Currently-playing section verbatim and do not reframe it as an upcoming start time.
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
  }
  return lines.join('\n')
}
