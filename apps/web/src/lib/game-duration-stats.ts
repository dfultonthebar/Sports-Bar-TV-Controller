/**
 * Per-sport game duration learner.
 *
 * Computes average game duration for each league from the historical
 * `game_schedules` rows that have both actualStart and actualEnd timestamps
 * set by ESPN sync. The scheduler uses this to predict `expected_free_at`
 * for new allocations, instead of the prior hardcoded 3-hour default.
 *
 * Why per-league: NFL games run ~210 min, MLB ~180, NHL ~155, NBA ~135,
 * college basketball ~115, college baseball ~175 — using a single 180-min
 * default sets a bad overlap window for many sports.
 *
 * Outlier filter is already applied at write time in espn-sync-service
 * (20 ≤ durationMinutes ≤ 360), so this reads the already-filtered column
 * directly.
 */

import { db, schema } from '@/db'
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm'

const DEFAULT_FALLBACK_SECONDS = 3 * 60 * 60 // 3 hours — for leagues with no history
const MIN_SAMPLES = 5 // Need at least 5 completed games to trust the average
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 min — league averages don't shift fast

type LeagueStats = { league: string; avgSeconds: number; sampleCount: number }

let cachedStats: Map<string, LeagueStats> | null = null
let cachedAt = 0

async function refreshStats(): Promise<Map<string, LeagueStats>> {
  const rows = await db.select({
      league: schema.gameSchedules.league,
      avgMin: sql<number>`AVG(${schema.gameSchedules.durationMinutes})`.as('avg_min'),
      n: sql<number>`COUNT(*)`.as('n'),
    })
    .from(schema.gameSchedules)
    .where(and(
      isNotNull(schema.gameSchedules.durationMinutes),
      gt(schema.gameSchedules.durationMinutes, 0),
    ))
    .groupBy(schema.gameSchedules.league)
    .all()

  const map = new Map<string, LeagueStats>()
  for (const r of rows) {
    if (!r.league || r.n < MIN_SAMPLES) continue
    map.set(r.league.toLowerCase(), {
      league: r.league,
      avgSeconds: Math.round(Number(r.avgMin) * 60),
      sampleCount: Number(r.n),
    })
  }
  return map
}

export async function getExpectedDurationSeconds(league: string | null | undefined): Promise<{
  durationSeconds: number
  source: 'learned' | 'default'
  sampleCount: number
}> {
  if (!league) return { durationSeconds: DEFAULT_FALLBACK_SECONDS, source: 'default', sampleCount: 0 }

  const now = Date.now()
  if (!cachedStats || now - cachedAt > CACHE_TTL_MS) {
    cachedStats = await refreshStats()
    cachedAt = now
  }

  const stats = cachedStats.get(league.toLowerCase())
  if (!stats) return { durationSeconds: DEFAULT_FALLBACK_SECONDS, source: 'default', sampleCount: 0 }
  return { durationSeconds: stats.avgSeconds, source: 'learned', sampleCount: stats.sampleCount }
}

/** Exposed so an admin UI / debug endpoint can show the current table. */
export async function getAllLeagueStats(): Promise<LeagueStats[]> {
  const map = await refreshStats()
  return [...map.values()].sort((a, b) => b.sampleCount - a.sampleCount)
}

/** Invalidate cache. Call from ESPN sync end-of-batch if you want instant propagation. */
export function resetDurationStatsCache() {
  cachedStats = null
  cachedAt = 0
}
