/**
 * GET /api/override-learn/digest
 *
 * Aggregates SchedulerLog rows with component='override-learn' into
 * patterns operators can act on. Each row represents a bartender
 * correction within 10 minutes of a scheduled allocation — an
 * add/remove of an output from an active game's tv_output_ids.
 *
 * Read-only: does NOT run the actual override-digester (that already
 * writes recommendation rows hourly from a scheduled job). This endpoint
 * just reshapes the raw override-learn events into views the UI needs
 * AND also surfaces whatever the hourly digester has already written
 * as `component='override-digest' operation='recommend'`.
 *
 * Query params:
 *   ?days=30  lookback window (default 30, max 90)
 *
 * Response shape:
 *   {
 *     windowDays, totalEvents, generatedAt,
 *     byTeam:    [{ team, isHomeTeam, league, corrections, addCount, removeCount, lastSeen }]
 *     byOutput:  [{ outputNum, corrections, addCount, removeCount, topTeams:[{team,n}] }]
 *     byPattern: [{ team, outputNum, action, occurrences, isHomeTeam, firstSeen, lastSeen }]
 *     recentEvents: [{ ts, team, league, isHomeTeam, action, outputNum, prevOutputs, newOutputs }]
 *     existingRecommendations: [{ ts, message, level, metadata }]  // from override-digester hourly runs
 *   }
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateQueryParams, z } from '@/lib/validation'

interface OverrideMetadata {
  team?: string
  isHomeTeam?: boolean
  league?: string
  outputNum?: number
  inputNum?: number
  prevOutputs?: number[]
  newOutputs?: number[]
  bartenderId?: string
}

interface RawEvent {
  ts: number
  operation: 'add' | 'remove'
  team: string
  isHomeTeam: boolean
  league: string
  outputNum: number
  inputNum: number | null
  prevOutputs: number[]
  newOutputs: number[]
  level: string
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const queryValidation = validateQueryParams(
    request,
    z.object({
      days: z.coerce.number().int().min(1).max(90).optional(),
    }),
  )
  if (!queryValidation.success) return queryValidation.error

  const windowDays = queryValidation.data.days ?? 30
  const cutoff = Math.floor(Date.now() / 1000) - windowDays * 86400

  try {
    // 1. Raw override-learn events in the window
    const rawRows = await db
      .select({
        createdAt: schema.schedulerLogs.createdAt,
        operation: schema.schedulerLogs.operation,
        level: schema.schedulerLogs.level,
        metadata: schema.schedulerLogs.metadata,
      })
      .from(schema.schedulerLogs)
      .where(
        and(
          eq(schema.schedulerLogs.component, 'override-learn'),
          gte(schema.schedulerLogs.createdAt, cutoff),
        ),
      )
      .orderBy(desc(schema.schedulerLogs.createdAt))

    const events: RawEvent[] = []
    for (const row of rawRows) {
      if (!row.metadata) continue
      let meta: OverrideMetadata
      try {
        meta = JSON.parse(row.metadata)
      } catch {
        continue
      }
      if (typeof meta.team !== 'string' || typeof meta.outputNum !== 'number') continue
      events.push({
        ts: row.createdAt,
        operation: row.operation === 'add' ? 'add' : 'remove',
        team: meta.team,
        isHomeTeam: !!meta.isHomeTeam,
        league: meta.league ?? 'unknown',
        outputNum: meta.outputNum,
        inputNum: typeof meta.inputNum === 'number' ? meta.inputNum : null,
        prevOutputs: Array.isArray(meta.prevOutputs) ? meta.prevOutputs : [],
        newOutputs: Array.isArray(meta.newOutputs) ? meta.newOutputs : [],
        level: row.level,
      })
    }

    // 2. Aggregate by team
    const teamMap = new Map<
      string,
      {
        team: string
        isHomeTeam: boolean
        league: string
        corrections: number
        addCount: number
        removeCount: number
        lastSeen: number
      }
    >()
    for (const ev of events) {
      const entry = teamMap.get(ev.team) ?? {
        team: ev.team,
        isHomeTeam: ev.isHomeTeam,
        league: ev.league,
        corrections: 0,
        addCount: 0,
        removeCount: 0,
        lastSeen: 0,
      }
      entry.corrections += 1
      if (ev.operation === 'add') entry.addCount += 1
      else entry.removeCount += 1
      if (ev.ts > entry.lastSeen) entry.lastSeen = ev.ts
      // Promote to home-team if any event tagged it (sticky — once home, always home)
      if (ev.isHomeTeam) entry.isHomeTeam = true
      teamMap.set(ev.team, entry)
    }

    // 3. Aggregate by output (which TVs get corrected most)
    const outputMap = new Map<
      number,
      {
        outputNum: number
        corrections: number
        addCount: number
        removeCount: number
        teamCounts: Map<string, number>
      }
    >()
    for (const ev of events) {
      const entry = outputMap.get(ev.outputNum) ?? {
        outputNum: ev.outputNum,
        corrections: 0,
        addCount: 0,
        removeCount: 0,
        teamCounts: new Map(),
      }
      entry.corrections += 1
      if (ev.operation === 'add') entry.addCount += 1
      else entry.removeCount += 1
      entry.teamCounts.set(ev.team, (entry.teamCounts.get(ev.team) ?? 0) + 1)
      outputMap.set(ev.outputNum, entry)
    }

    // 4. Aggregate by (team, outputNum, action) — the "pattern" view.
    //    Same shape the hourly override-digester uses, but visible regardless
    //    of its 3-occurrence threshold.
    const patternMap = new Map<
      string,
      {
        team: string
        outputNum: number
        action: 'add' | 'remove'
        occurrences: number
        isHomeTeam: boolean
        firstSeen: number
        lastSeen: number
      }
    >()
    for (const ev of events) {
      const key = `${ev.team}\u0000${ev.outputNum}\u0000${ev.operation}`
      const entry = patternMap.get(key) ?? {
        team: ev.team,
        outputNum: ev.outputNum,
        action: ev.operation,
        occurrences: 0,
        isHomeTeam: ev.isHomeTeam,
        firstSeen: ev.ts,
        lastSeen: ev.ts,
      }
      entry.occurrences += 1
      if (ev.isHomeTeam) entry.isHomeTeam = true
      if (ev.ts < entry.firstSeen) entry.firstSeen = ev.ts
      if (ev.ts > entry.lastSeen) entry.lastSeen = ev.ts
      patternMap.set(key, entry)
    }

    // 5. Existing override-digest recommendations (from the hourly job).
    //    These are the "stable" patterns the digester promoted.
    const recRows = await db
      .select({
        createdAt: schema.schedulerLogs.createdAt,
        message: schema.schedulerLogs.message,
        level: schema.schedulerLogs.level,
        metadata: schema.schedulerLogs.metadata,
      })
      .from(schema.schedulerLogs)
      .where(
        and(
          eq(schema.schedulerLogs.component, 'override-digest'),
          eq(schema.schedulerLogs.operation, 'recommend'),
          gte(schema.schedulerLogs.createdAt, cutoff),
        ),
      )
      .orderBy(desc(schema.schedulerLogs.createdAt))
      .limit(50)

    // Sort the aggregated views for a useful default order.
    const byTeam = [...teamMap.values()].sort((a, b) => b.corrections - a.corrections)
    const byOutput = [...outputMap.values()]
      .map(o => ({
        outputNum: o.outputNum,
        corrections: o.corrections,
        addCount: o.addCount,
        removeCount: o.removeCount,
        topTeams: [...o.teamCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([team, n]) => ({ team, n })),
      }))
      .sort((a, b) => b.corrections - a.corrections)
    const byPattern = [...patternMap.values()].sort((a, b) => b.occurrences - a.occurrences)

    return NextResponse.json({
      windowDays,
      totalEvents: events.length,
      generatedAt: new Date().toISOString(),
      byTeam: byTeam.slice(0, 25),
      byOutput: byOutput.slice(0, 25),
      byPattern: byPattern.slice(0, 25),
      recentEvents: events.slice(0, 50),
      existingRecommendations: recRows.map(r => ({
        ts: r.createdAt,
        message: r.message,
        level: r.level,
        metadata: r.metadata,
      })),
    })
  } catch (err: any) {
    logger.error('[OVERRIDE-DIGEST-API] error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Digest query failed' },
      { status: 500 },
    )
  }
}
