/**
 * GET /api/error-watch
 *
 * Returns rows from the `error_watch_events` table populated by the
 * Phase 2a autonomous error-watch service (see scripts/watchers/error-watch.sh).
 * Powers the SystemAdmin > Watchers > Error Events panel.
 *
 * Query params:
 *   ?windowHours=24         — lookback window (default 24, max 168/7d)
 *   ?signature=fk_constraint — filter to one signature label
 *   ?kind=error             — filter to one kind ('error'/'startup'/'heartbeat'); default = all kinds
 *   ?limit=200              — row cap on the events array (default 200, max 1000)
 *
 * Returns (always — empty arrays/zero are fine on a quiet box):
 *   { success, now, windowHours,
 *     summary: {
 *       heartbeatFreshSec | null,
 *       latestStartupAt | null,
 *       errorCountWindow,
 *       signatureCounts: [{signature, count}],
 *     },
 *     events: [{kind, signature, sample, sourceFile, detectedAt, detectedAtIso}]
 *   }
 *
 * On query failure (e.g., fresh box where the table doesn't exist yet)
 * returns 200 with empty payload — matches /api/system/watchers/status
 * semantics so the UI degrades cleanly during install.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  kind: string
  signature: string
  sample: string
  source_file: string | null
  detected_at: number
}

type SigCountRow = { signature: string; count: number }

const MAX_WINDOW_HOURS = 24 * 7

function emptyPayload(nowSec: number, windowHours: number) {
  return {
    success: true,
    now: new Date(nowSec * 1000).toISOString(),
    windowHours,
    summary: {
      heartbeatFreshSec: null as number | null,
      latestStartupAt: null as string | null,
      errorCountWindow: 0,
      signatureCounts: [] as SigCountRow[],
    },
    events: [] as Array<Row & { detectedAtIso: string }>,
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) return rateLimit.response

  const { searchParams } = new URL(request.url)
  const windowHours = Math.min(
    Math.max(parseInt(searchParams.get('windowHours') || '24', 10) || 24, 1),
    MAX_WINDOW_HOURS,
  )
  const signature = searchParams.get('signature')?.trim() || null
  const kind = searchParams.get('kind')?.trim() || null
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || '200', 10) || 200, 1),
    1000,
  )

  const nowSec = Math.floor(Date.now() / 1000)
  const sinceSec = nowSec - windowHours * 3600

  try {
    // Summary first — these queries always run, even if `events` is filtered.
    const heartbeatRows = (await db.all(sql`
      SELECT MAX(detected_at) AS last FROM error_watch_events WHERE kind = 'heartbeat'
    `)) as Array<{ last: number | null }>
    const lastHeartbeatEpoch = heartbeatRows[0]?.last ?? null

    const startupRows = (await db.all(sql`
      SELECT MAX(detected_at) AS last FROM error_watch_events WHERE kind = 'startup'
    `)) as Array<{ last: number | null }>
    const lastStartupEpoch = startupRows[0]?.last ?? null

    const errorCountRows = (await db.all(sql`
      SELECT COUNT(*) AS n FROM error_watch_events
      WHERE kind = 'error' AND detected_at >= ${sinceSec}
    `)) as Array<{ n: number }>
    const errorCountWindow = errorCountRows[0]?.n ?? 0

    const signatureCounts = (await db.all(sql`
      SELECT signature, COUNT(*) AS count
      FROM error_watch_events
      WHERE kind = 'error' AND detected_at >= ${sinceSec}
      GROUP BY signature
      ORDER BY count DESC
    `)) as SigCountRow[]

    // Events listing — built up incrementally with the filters.
    const events = (await db.all(sql`
      SELECT id, kind, signature, sample, source_file, detected_at
      FROM error_watch_events
      WHERE detected_at >= ${sinceSec}
        ${signature ? sql`AND signature = ${signature}` : sql``}
        ${kind ? sql`AND kind = ${kind}` : sql``}
      ORDER BY detected_at DESC
      LIMIT ${limit}
    `)) as Row[]

    return NextResponse.json({
      success: true,
      now: new Date(nowSec * 1000).toISOString(),
      windowHours,
      summary: {
        heartbeatFreshSec:
          lastHeartbeatEpoch != null ? Math.max(0, nowSec - lastHeartbeatEpoch) : null,
        latestStartupAt:
          lastStartupEpoch != null
            ? new Date(lastStartupEpoch * 1000).toISOString()
            : null,
        errorCountWindow,
        signatureCounts,
      },
      events: events.map((r) => ({
        ...r,
        detectedAtIso: new Date(r.detected_at * 1000).toISOString(),
      })),
    })
  } catch (err) {
    // Table missing (fresh install before migration ran) — degrade to empty,
    // don't 500. Same pattern as /api/system/watchers/status.
    logger.debug(
      `[ERROR-WATCH] query failed (treating as not-yet-installed): ${(err as Error)?.message ?? err}`,
    )
    return NextResponse.json(emptyPayload(nowSec, windowHours))
  }
}
