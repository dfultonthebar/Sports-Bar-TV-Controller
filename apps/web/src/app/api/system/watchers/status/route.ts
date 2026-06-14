/**
 * GET /api/system/watchers/status
 *
 * Operator-visibility surface for the three RF/audio background watchers
 * running in-process: SDR (rtl_power sweep), Shure (SLX-D TCP poll), and
 * Atlas (priority + drop pollers). Returns liveness + counts so the
 * System Admin > Watchers tab can show alive/dead at a glance, instead
 * of operators having to SSH and tail pm2 logs.
 *
 * Alive heuristic (matches the [[feedback_demote_verify_actual_firing]]
 * pattern — each watcher writes an event_type='startup' row on boot, plus
 * heartbeat rows while active):
 *   alive = (most recent event_type='startup' row OR any row within the
 *           last 30 min)
 *
 * No auth — bartender's Audio tab may surface this in a future iteration
 * and the admin tab already lives inside an authenticated shell.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// "Recently alive" window — if any row was written this recently, the
// watcher is considered up regardless of whether a 'startup' row is
// present. 30 min comfortably covers the slowest watcher's heartbeat
// cadence (atlas-drop-watcher polls every 30s, SDR aggregator flushes
// every minute, Shure heartbeats every 20s while active).
const RECENT_WINDOW_SEC = 30 * 60

// 24h count window for the eventCount24h field.
const TWENTY_FOUR_HOURS_SEC = 24 * 60 * 60

interface WatcherStatus {
  alive: boolean
  lastEventAt: string | null
  lastStartupAt: string | null
  eventCount24h: number
}

/**
 * Best-effort lookup of a single watcher's status. Wrapped in try/catch
 * because at fresh installs the tables may not exist yet (the watchers
 * create their own tables on boot). A missing table is treated as
 * "watcher hasn't run" — alive=false, counts=0.
 */
async function readWatcherStatus(
  table: string,
  nowSec: number,
): Promise<WatcherStatus> {
  try {
    // Latest row of any type.
    const latestRows = (await db.all(
      sql.raw(`SELECT MAX(detected_at) AS last FROM ${table}`),
    )) as Array<{ last: number | null }>
    const lastEpoch = latestRows[0]?.last ?? 0

    // Latest startup row specifically — useful for the UI to show
    // "boot at HH:MM" + proves the watcher actually ran.
    const startupRows = (await db.all(
      sql.raw(
        `SELECT MAX(detected_at) AS last FROM ${table} WHERE event_type = 'startup'`,
      ),
    )) as Array<{ last: number | null }>
    const lastStartupEpoch = startupRows[0]?.last ?? 0

    // 24h count.
    const countRows = (await db.all(
      sql.raw(
        `SELECT count(*) AS n FROM ${table} WHERE detected_at >= ${nowSec - TWENTY_FOUR_HOURS_SEC}`,
      ),
    )) as Array<{ n: number }>
    const eventCount24h = countRows[0]?.n ?? 0

    const ageSec = lastEpoch > 0 ? nowSec - lastEpoch : Number.POSITIVE_INFINITY
    const alive = lastStartupEpoch > 0 || ageSec < RECENT_WINDOW_SEC

    return {
      alive,
      lastEventAt: lastEpoch > 0 ? new Date(lastEpoch * 1000).toISOString() : null,
      lastStartupAt:
        lastStartupEpoch > 0 ? new Date(lastStartupEpoch * 1000).toISOString() : null,
      eventCount24h,
    }
  } catch (err) {
    // Table doesn't exist or query failed — watcher hasn't booted at
    // this location yet. Don't escalate; the UI shows "no data" for
    // alive=false, count=0.
    logger.debug(
      `[WATCHERS-STATUS] ${table} read failed (treating as not-yet-run): ${(err as Error)?.message ?? err}`,
    )
    return {
      alive: false,
      lastEventAt: null,
      lastStartupAt: null,
      eventCount24h: 0,
    }
  }
}

export async function GET(request: NextRequest) {
  // DATABASE_READ = 60/min is a comfortable budget for a UI that polls
  // this endpoint every 30s.
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) return rateLimit.response

  const nowSec = Math.floor(Date.now() / 1000)

  try {
    // SDR uses sdr_carriers as its event-shaped table. The watcher
    // doesn't currently write a 'startup' row there, so alive is purely
    // recent-row driven for SDR (matches /api/sdr/status semantics).
    // Both atlas watchers write to atlas_priority_events — they share
    // the table, and the priority watcher's startup row is sufficient
    // proof the in-process timer is alive (PM2 boots them together).
    const [sdr, shure, atlas] = await Promise.all([
      readWatcherStatus('sdr_carriers', nowSec),
      readWatcherStatus('shure_rf_events', nowSec),
      readWatcherStatus('atlas_priority_events', nowSec),
    ])

    return NextResponse.json({
      success: true,
      now: new Date(nowSec * 1000).toISOString(),
      sdr,
      shure,
      atlas,
    })
  } catch (err) {
    logger.error('[WATCHERS-STATUS] unexpected error:', err)
    return NextResponse.json(
      {
        success: false,
        error: (err as Error)?.message ?? 'unknown error',
      },
      { status: 500 },
    )
  }
}
