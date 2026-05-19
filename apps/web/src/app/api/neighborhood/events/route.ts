/**
 * GET /api/neighborhood/events
 *
 * Read access to the `neighborhood_events` table. Powers operator-facing
 * neighborhood-activity views and the correlation engine's UI surface.
 *
 * Default window: last 30 days + next 30 days (sliding around `now`).
 * Operator can override with explicit `from` / `to` unix-second params.
 *
 * Query params:
 *   ?venue_id=ID                 — filter to one venue
 *   ?artist_normalized=marco     — filter to one artist (exact normalized form)
 *   ?source=bananas              — filter by source
 *   ?from=<unix>                 — override window start (unix seconds)
 *   ?to=<unix>                   — override window end (unix seconds)
 *   ?limit=N                     — paginate (default 200, max 1000)
 *
 * Response mirrors the shape used by /api/shure-rf for consistency.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'

type NeighborhoodEventRow = {
  id: string
  venue_id: string
  venue_name: string | null
  venue_category: string | null
  distance_mi: number | null
  artist_name: string
  artist_normalized: string
  start_time: number
  end_time: number | null
  event_type: string | null
  source: string
  source_url: string | null
  source_event_id: string | null
  ingested_at: number
}

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 1000

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)
    const venueId = searchParams.get('venue_id')
    const artistNormalized = searchParams.get('artist_normalized')
    const source = searchParams.get('source')

    const nowSec = Math.floor(Date.now() / 1000)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const fromSec = fromParam ? parseInt(fromParam, 10) : nowSec - THIRTY_DAYS_SEC
    const toSec = toParam ? parseInt(toParam, 10) : nowSec + THIRTY_DAYS_SEC

    if (!Number.isFinite(fromSec) || !Number.isFinite(toSec) || fromSec >= toSec) {
      return NextResponse.json(
        { success: false, error: 'Invalid from/to range' },
        { status: 400 },
      )
    }

    const limitRaw = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)
    const limit = Math.min(
      Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : DEFAULT_LIMIT,
      MAX_LIMIT,
    )

    // Join venue metadata in so the UI doesn't need to follow up with a
    // second venues-lookup call. Distance is denormalized on the venue
    // row so we get it for free.
    const rows = await db.all<NeighborhoodEventRow>(sql`
      SELECT
        e.id,
        e.venue_id,
        v.name AS venue_name,
        v.category AS venue_category,
        v.distance_mi AS distance_mi,
        e.artist_name,
        e.artist_normalized,
        e.start_time,
        e.end_time,
        e.event_type,
        e.source,
        e.source_url,
        e.source_event_id,
        e.ingested_at
      FROM NeighborhoodEvent e
      LEFT JOIN NeighborhoodVenue v ON v.id = e.venue_id
      WHERE e.start_time >= ${fromSec}
        AND e.start_time <= ${toSec}
        ${venueId ? sql`AND e.venue_id = ${venueId}` : sql``}
        ${artistNormalized ? sql`AND e.artist_normalized = ${artistNormalized}` : sql``}
        ${source ? sql`AND e.source = ${source}` : sql``}
      ORDER BY e.start_time ASC
      LIMIT ${limit}
    `)

    const events = rows.map((r) => ({
      ...r,
      start_time_iso: new Date(r.start_time * 1000).toISOString(),
      end_time_iso: r.end_time ? new Date(r.end_time * 1000).toISOString() : null,
      ingested_at_iso: new Date(r.ingested_at * 1000).toISOString(),
    }))

    return NextResponse.json({
      success: true,
      count: events.length,
      window: { from: fromSec, to: toSec },
      events,
    })
  } catch (err) {
    logger.error('[NEIGHBORHOOD-EVENTS] Failed to query neighborhood_events:', err)
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    )
  }
}
