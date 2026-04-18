/**
 * Override-Learn Digester
 *
 * Hourly batch job that reads recent `SchedulerLog` rows with
 * component='override-learn' and looks for patterns worth promoting from
 * individual per-tune corrections into durable recommendations.
 *
 * Input signal: the override-learn hook in /api/matrix/route writes one
 * SchedulerLog row per bartender correction within 10 min of a scheduled
 * allocation — add/remove of an output from an active game's
 * tv_output_ids. Tonight at Lucky's 1313, TV 11 was added to a Brewers
 * allocation then removed — one row each, both tagged as home-team
 * overrides.
 *
 * What this digester produces:
 *   1. A summary SchedulerLog entry (component='override-digest',
 *      operation='summarize') every hour with the top recurring
 *      corrections in the last 30 days. Visible in the live watcher.
 *   2. Per-team/per-output "stable" patterns (3+ identical corrections
 *      across separate allocations) logged at level='warn' so operators
 *      can see them and decide whether to update default tv_output_ids.
 *
 * Why not auto-apply? The digester DELIBERATELY doesn't mutate defaults —
 * it surfaces the recommendation. A bartender moving TV 11 onto the
 * Brewers once may have been correct for that night's crowd, not a
 * permanent layout truth. Requiring 3 corrections across different
 * allocations filters single-night adjustments from durable preferences.
 *
 * Non-goals:
 *   - Doesn't touch allocation.tv_output_ids (the per-tune hook does that).
 *   - Doesn't replace pattern-analyzer, which reads the FINAL post-override
 *     tv_output_ids hourly to feed AI Suggest. This digester reads the
 *     DELTA (add/remove events) to surface durable corrections.
 */

import { db, sql } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { v4 as uuidv4 } from 'uuid'

const LOOKBACK_DAYS = 30
const MIN_OCCURRENCES = 3

interface OverridePattern {
  team: string
  isHomeTeam: boolean
  outputNum: number
  action: 'add' | 'remove'
  occurrences: number
  firstSeen: number
  lastSeen: number
}

export async function runOverrideDigest(): Promise<{
  patterns: OverridePattern[]
  totalEventsScanned: number
}> {
  const cutoff = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 86400

  // Pull every override-learn event in the window. Metadata JSON carries
  // team + isHomeTeam + outputNum; operation is 'add' or 'remove'.
  const rows = await db.all(sql`
    SELECT operation, metadata
    FROM SchedulerLog
    WHERE component = 'override-learn'
      AND createdAt >= ${cutoff}
  `) as Array<{ operation: string; metadata: string | null }>

  // Aggregate by (team, outputNum, action). We bucket add and remove
  // separately because a team that's REPEATEDLY added onto output 5 is a
  // different signal from a team repeatedly removed from output 5.
  const buckets = new Map<string, OverridePattern>()

  for (const row of rows) {
    if (!row.metadata) continue
    let meta: any
    try { meta = JSON.parse(row.metadata) } catch { continue }
    if (typeof meta?.outputNum !== 'number' || typeof meta?.team !== 'string') continue

    const action = row.operation === 'add' ? 'add' : 'remove'
    const key = `${meta.team}\u0000${meta.outputNum}\u0000${action}`
    const existing = buckets.get(key)
    const now = Math.floor(Date.now() / 1000)
    if (existing) {
      existing.occurrences += 1
      existing.lastSeen = now
    } else {
      buckets.set(key, {
        team: meta.team,
        isHomeTeam: !!meta.isHomeTeam,
        outputNum: meta.outputNum,
        action,
        occurrences: 1,
        firstSeen: now,
        lastSeen: now,
      })
    }
  }

  const all = Array.from(buckets.values())
  const stable = all.filter(p => p.occurrences >= MIN_OCCURRENCES)
    .sort((a, b) => b.occurrences - a.occurrences)

  const nowUnix = Math.floor(Date.now() / 1000)
  const correlationId = uuidv4()

  // Write the summary — one row regardless of pattern count so operators
  // can see the digester is alive on the live watcher.
  await db.run(sql`
    INSERT INTO SchedulerLog
      (id, correlationId, component, operation, level, message, success, metadata, createdAt)
    VALUES (
      ${uuidv4()},
      ${correlationId},
      'override-digest',
      'summarize',
      'info',
      ${`Scanned ${rows.length} override events over ${LOOKBACK_DAYS}d → ${stable.length} stable patterns (≥${MIN_OCCURRENCES} occurrences)`},
      1,
      ${JSON.stringify({ totalEvents: rows.length, stablePatterns: stable.length, lookbackDays: LOOKBACK_DAYS, minOccurrences: MIN_OCCURRENCES })},
      ${nowUnix}
    )
  `)

  // One row per stable pattern, at warn for home-team patterns so they
  // surface prominently in the SchedulerLogsDashboard filter.
  for (const p of stable) {
    const level = p.isHomeTeam ? 'warn' : 'info'
    const verb = p.action === 'add' ? 'repeatedly added to' : 'repeatedly removed from'
    const msg = `${p.team}${p.isHomeTeam ? ' (home team)' : ''} ${verb} output ${p.outputNum} — ${p.occurrences}× in ${LOOKBACK_DAYS}d. Consider updating default tv_output_ids.`
    await db.run(sql`
      INSERT INTO SchedulerLog
        (id, correlationId, component, operation, level, message, deviceId, success, metadata, createdAt)
      VALUES (
        ${uuidv4()},
        ${correlationId},
        'override-digest',
        'recommend',
        ${level},
        ${msg},
        ${String(p.outputNum)},
        1,
        ${JSON.stringify(p)},
        ${nowUnix}
      )
    `)
  }

  logger.info(`[OVERRIDE-DIGEST] Scanned ${rows.length} events, flagged ${stable.length} stable patterns`)
  return { patterns: stable, totalEventsScanned: rows.length }
}
