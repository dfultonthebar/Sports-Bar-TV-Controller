
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'
import fs from 'fs/promises'
import path from 'path'

// Weekly owner summary. Monday 6am CDT cron (see scheduler-service.ts)
// writes apps/web/data/reports/week-YYYY-WW.md. Also exposed as
// GET /api/ai/weekly-summary?week=YYYY-Www so the owner can see it on
// demand. Generates a factual markdown report backed by our own logs —
// no LLM needed for the data; LLM is only used to write the
// "commentary" paragraph at the top.

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const weekParam = request.nextUrl.searchParams.get('week')
    const { weekStart, weekEnd, weekLabel } = parseWeek(weekParam)
    const report = await generateWeeklyReport(weekStart, weekEnd, weekLabel)
    return NextResponse.json({ success: true, ...report })
  } catch (error: any) {
    logger.error('[WEEKLY-SUMMARY] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Write the report to disk (this is what the Monday cron hits).
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const weekParam = request.nextUrl.searchParams.get('week')
    const { weekStart, weekEnd, weekLabel } = parseWeek(weekParam)
    const report = await generateWeeklyReport(weekStart, weekEnd, weekLabel)

    const outDir = path.join(process.cwd(), 'data', 'reports')
    await fs.mkdir(outDir, { recursive: true })
    const outPath = path.join(outDir, `week-${weekLabel}.md`)
    await fs.writeFile(outPath, report.markdown, 'utf-8')

    logger.info(`[WEEKLY-SUMMARY] Wrote ${outPath}`)
    return NextResponse.json({ success: true, writtenTo: outPath, ...report })
  } catch (error: any) {
    logger.error('[WEEKLY-SUMMARY] Error writing report:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// ---------- report generator ----------

interface WeeklyReport {
  weekLabel: string
  weekStart: number
  weekEnd: number
  commentary: string
  markdown: string
  stats: {
    gamesAired: number
    homeTeamGamesAired: number
    uniqueTeams: number
    totalTvHours: number
    topTeams: Array<{ team: string; games: number; tvHours: number }>
    bartenderOverrides: number
    stableOverridePatterns: number
    failureClusters: number
    aiSuggestCalls: number
  }
}

async function generateWeeklyReport(weekStart: number, weekEnd: number, weekLabel: string): Promise<WeeklyReport> {
  // Every allocation that was active during this week counts toward
  // "games aired." Not strictly correct (a game may have ended early)
  // but close enough for a coarse weekly picture.
  const allocs = await db.select({
      id: schema.inputSourceAllocations.id,
      gameId: schema.inputSourceAllocations.gameScheduleId,
      allocatedAt: schema.inputSourceAllocations.allocatedAt,
      freedAt: schema.inputSourceAllocations.actuallyFreedAt,
      expectedFreeAt: schema.inputSourceAllocations.expectedFreeAt,
      tvCount: schema.inputSourceAllocations.tvCount,
      scheduledBy: schema.inputSourceAllocations.scheduledBy,
      status: schema.inputSourceAllocations.status,
      homeTeam: schema.gameSchedules.homeTeamName,
      awayTeam: schema.gameSchedules.awayTeamName,
      league: schema.gameSchedules.league,
    })
    .from(schema.inputSourceAllocations)
    .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
    .where(and(
      gte(schema.inputSourceAllocations.allocatedAt, weekStart),
      lt(schema.inputSourceAllocations.allocatedAt, weekEnd),
    ))
    .all()

  const homeTeamRows = await db.select({ name: schema.homeTeams.teamName })
    .from(schema.homeTeams)
    .all()
  const homeTeamSet = new Set(homeTeamRows.map(h => h.name))

  const overrideEvents = await countByCondition(
    and(
      eq(schema.schedulerLogs.component, 'override-learn'),
      gte(schema.schedulerLogs.createdAt, weekStart),
      lt(schema.schedulerLogs.createdAt, weekEnd),
    )
  )
  const stableOverrideRecs = await countByCondition(
    and(
      eq(schema.schedulerLogs.component, 'override-digest'),
      eq(schema.schedulerLogs.operation, 'recommend'),
      gte(schema.schedulerLogs.createdAt, weekStart),
      lt(schema.schedulerLogs.createdAt, weekEnd),
    )
  )
  const failureClusters = await countByCondition(
    and(
      eq(schema.schedulerLogs.component, 'failure-sweep'),
      eq(schema.schedulerLogs.operation, 'cluster'),
      gte(schema.schedulerLogs.createdAt, weekStart),
      lt(schema.schedulerLogs.createdAt, weekEnd),
    )
  )
  const aiSuggestCalls = await countByCondition(
    and(
      eq(schema.schedulerLogs.component, 'ai-suggest'),
      gte(schema.schedulerLogs.createdAt, weekStart),
      lt(schema.schedulerLogs.createdAt, weekEnd),
    )
  )

  // Team rollup
  const perTeam = new Map<string, { games: number; tvHours: number }>()
  let totalTvHours = 0
  for (const a of allocs) {
    const duration = (a.freedAt ?? a.expectedFreeAt ?? a.allocatedAt + 10800) - a.allocatedAt
    const hours = (duration / 3600) * (a.tvCount || 0)
    totalTvHours += hours
    for (const team of [a.homeTeam, a.awayTeam]) {
      if (!team) continue
      const v = perTeam.get(team) || { games: 0, tvHours: 0 }
      v.games += 0.5  // count each game half per team, sum = #games
      v.tvHours += hours / 2
      perTeam.set(team, v)
    }
  }
  const topTeams = Array.from(perTeam.entries())
    .map(([team, v]) => ({ team, games: Math.round(v.games), tvHours: Math.round(v.tvHours * 10) / 10 }))
    .sort((a, b) => b.tvHours - a.tvHours)
    .slice(0, 10)

  const homeTeamGames = allocs.filter(a => homeTeamSet.has(a.homeTeam!) || homeTeamSet.has(a.awayTeam!)).length

  const stats = {
    gamesAired: allocs.length,
    homeTeamGamesAired: homeTeamGames,
    uniqueTeams: perTeam.size,
    totalTvHours: Math.round(totalTvHours * 10) / 10,
    topTeams,
    bartenderOverrides: overrideEvents,
    stableOverridePatterns: stableOverrideRecs,
    failureClusters,
    aiSuggestCalls,
  }

  const commentary = await generateCommentaryViaOllama(stats, weekLabel)
  const markdown = formatMarkdown(weekLabel, weekStart, weekEnd, stats, commentary)

  return { weekLabel, weekStart, weekEnd, commentary, markdown, stats }
}

async function generateCommentaryViaOllama(stats: any, weekLabel: string): Promise<string> {
  try {
    const prompt = `You are the owner's analyst summarizing operations at ${HARDWARE_CONFIG.venue.name} for the week of ${weekLabel}. Given these stats, write 2-3 sentences calling out the most interesting thing the owner should notice. No generic praise; lead with surprises or trends. Plain prose, under 80 words.

Games aired: ${stats.gamesAired}
Home-team games: ${stats.homeTeamGamesAired}
Total TV-hours of sports: ${stats.totalTvHours}
Top teams by TV-hours: ${stats.topTeams.slice(0, 3).map((t: any) => `${t.team} (${t.tvHours}h)`).join(', ')}
Bartender override events: ${stats.bartenderOverrides}
Stable learning patterns this week: ${stats.stableOverridePatterns}
Recurring failure clusters: ${stats.failureClusters}
AI Suggest uses: ${stats.aiSuggestCalls}
`
    const resp = await fetch(`${HARDWARE_CONFIG.ollama.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: HARDWARE_CONFIG.ollama.model,
        prompt,
        stream: false,
        options: { temperature: 0.4, num_predict: 180 },
      }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!resp.ok) return '(LLM unavailable — see stats below)'
    const data = await resp.json()
    return (data.response || '').trim() || '(empty commentary)'
  } catch {
    return '(LLM unavailable — see stats below)'
  }
}

function formatMarkdown(
  weekLabel: string,
  weekStart: number,
  weekEnd: number,
  stats: any,
  commentary: string
): string {
  const startDate = new Date(weekStart * 1000).toLocaleDateString('en-US', { timeZone: HARDWARE_CONFIG.venue.timezone })
  const endDate = new Date(weekEnd * 1000).toLocaleDateString('en-US', { timeZone: HARDWARE_CONFIG.venue.timezone })
  const lines: string[] = []
  lines.push(`# ${HARDWARE_CONFIG.venue.name} — Week ${weekLabel}`)
  lines.push(`_${startDate} – ${endDate}_`)
  lines.push('')
  lines.push('## Overview')
  lines.push(commentary)
  lines.push('')
  lines.push('## Numbers')
  lines.push(`- **Games aired:** ${stats.gamesAired} (${stats.homeTeamGamesAired} home-team)`)
  lines.push(`- **Unique teams shown:** ${stats.uniqueTeams}`)
  lines.push(`- **Total TV-hours of sports:** ${stats.totalTvHours}`)
  lines.push(`- **Bartender corrections logged:** ${stats.bartenderOverrides}`)
  lines.push(`- **New stable learning patterns:** ${stats.stableOverridePatterns}`)
  lines.push(`- **Recurring failure clusters caught:** ${stats.failureClusters}`)
  lines.push(`- **AI Suggest used:** ${stats.aiSuggestCalls} times`)
  lines.push('')
  if (stats.topTeams.length > 0) {
    lines.push('## Top teams by TV-hours')
    lines.push('| Team | Games | TV-hours |')
    lines.push('|------|-------|----------|')
    for (const t of stats.topTeams) {
      lines.push(`| ${t.team} | ${t.games} | ${t.tvHours} |`)
    }
    lines.push('')
  }
  lines.push('---')
  lines.push(`_Generated ${new Date().toLocaleString('en-US', { timeZone: HARDWARE_CONFIG.venue.timezone })} by the Sports-Bar-TV-Controller weekly summary service (v2.21.0)._`)
  return lines.join('\n')
}

// ---------- helpers ----------

async function countByCondition(where: any): Promise<number> {
  const rows = await db.select({ n: sql<number>`COUNT(*)`.as('n') })
    .from(schema.schedulerLogs)
    .where(where)
    .all()
  return Number(rows[0]?.n ?? 0)
}

function parseWeek(weekParam: string | null) {
  // If missing, pick the ISO week that just ended (Monday through Sunday).
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0=Sun, 1=Mon
  // Find the most recent Monday 00:00 UTC
  const daysSinceMonday = (dayOfWeek + 6) % 7
  const lastMonday = new Date(now.getTime() - daysSinceMonday * 86400_000)
  lastMonday.setUTCHours(0, 0, 0, 0)
  const previousMonday = new Date(lastMonday.getTime() - 7 * 86400_000)

  // If they asked for "last week" (no param), use previousMonday..lastMonday
  let weekStartDate = previousMonday
  if (weekParam) {
    const m = /^(\d{4})-W(\d{2})$/.exec(weekParam)
    if (m) {
      weekStartDate = isoWeekToMonday(parseInt(m[1], 10), parseInt(m[2], 10))
    }
  }
  const weekEndDate = new Date(weekStartDate.getTime() + 7 * 86400_000)
  const weekLabel = isoWeekLabel(weekStartDate)
  return {
    weekStart: Math.floor(weekStartDate.getTime() / 1000),
    weekEnd: Math.floor(weekEndDate.getTime() / 1000),
    weekLabel,
  }
}

function isoWeekLabel(d: Date): string {
  const y = d.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(y, 0, 4))
  const firstMonday = new Date(firstThursday.getTime() - ((firstThursday.getUTCDay() + 6) % 7) * 86400_000)
  const week = Math.floor((d.getTime() - firstMonday.getTime()) / (7 * 86400_000)) + 1
  return `${y}-W${String(week).padStart(2, '0')}`
}

function isoWeekToMonday(year: number, week: number): Date {
  const firstThursday = new Date(Date.UTC(year, 0, 4))
  const firstMonday = new Date(firstThursday.getTime() - ((firstThursday.getUTCDay() + 6) % 7) * 86400_000)
  return new Date(firstMonday.getTime() + (week - 1) * 7 * 86400_000)
}
