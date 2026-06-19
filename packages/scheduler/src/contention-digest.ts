import { db, schema } from '@sports-bar/database'
import { eq, and, gte, desc } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

/**
 * Wave 3.7 / Hermes consumption (#349) — weekly contention roll-up.
 *
 * Reads the distribution-engine `drop` rows (games that got ZERO screens
 * because games > available inputs) from SchedulerLog over the past 7 days and
 * files ONE operator TODO per ISO week via POST /api/maintenance-todo. The
 * `dedupeKey` (one open todo per week) collapses repeat runs, so this can run
 * daily and still files at most once a week; it re-files next week after the
 * operator closes it. GitHub-synced to System Admin → Todos.
 *
 * FAIL-OPEN: only reads SchedulerLog and posts a todo; any error is caught and
 * logged. Nothing in the scheduler tune/allocate path depends on it.
 */
export async function runContentionDigest(): Promise<void> {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - 7 * 86400
    const rows = await db
      .select({
        metadata: schema.schedulerLogs.metadata,
        createdAt: schema.schedulerLogs.createdAt,
      })
      .from(schema.schedulerLogs)
      .where(
        and(
          eq(schema.schedulerLogs.component, 'distribution-engine'),
          eq(schema.schedulerLogs.operation, 'drop'),
          gte(schema.schedulerLogs.createdAt, cutoff),
        ),
      )
      .orderBy(desc(schema.schedulerLogs.createdAt))

    if (!rows.length) return

    const seen = new Set<string>()
    const games: string[] = []
    for (const r of rows) {
      let game = ''
      try {
        game = JSON.parse(r.metadata || '{}')?.game || ''
      } catch {
        /* ignore malformed metadata */
      }
      if (game && !seen.has(game)) {
        seen.add(game)
        games.push(game)
      }
    }
    if (!games.length) return

    const n = games.length
    const week = isoWeekKey(new Date())
    const title = `${n} game${n !== 1 ? 's' : ''} had no screen this week`
    const description =
      `The scheduler dropped game assignments to ZERO screens ${rows.length} time(s) in the last 7 days ` +
      `(more games than available inputs — Wave 3.6 contention). Distinct games: ` +
      `${games.slice(0, 12).join(', ')}${games.length > 12 ? ', …' : ''}. ` +
      `Review input capacity or game priorities. (SchedulerLog component=distribution-engine op=drop.)`

    const base = `http://localhost:${process.env.PORT || 3001}`
    await fetch(`${base}/api/maintenance-todo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        priority: 'MEDIUM',
        category: 'Scheduling',
        source: 'watcher',
        dedupeKey: `wave37-contention-${week}`,
      }),
    })
      .then(() => logger.info(`[CONTENTION-DIGEST] filed weekly contention TODO (${n} games, ${week})`))
      .catch((e) => logger.warn('[CONTENTION-DIGEST] todo POST failed (non-fatal):', e as any))
  } catch (err) {
    logger.warn('[CONTENTION-DIGEST] failed (non-fatal):', err as any)
  }
}

/** ISO-8601 week key, e.g. "2026-W25" — used as the per-week dedup key. */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    )
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
