/**
 * GET /api/admin/venues/pending
 *
 * List NeighborhoodVenue rows with review_status='pending_review'.
 * Powers the operator review surface (today: a CLI helper; later: an
 * admin UI page) for triaging auto-discovered venues from Ticketmaster
 * (v2.53.1+) and Overpass OSM (v2.51.0+).
 *
 * Each pending venue can be:
 *  - Approved → review_status='approved', stays active, future events
 *    keep flowing in
 *  - Declined → is_active=false, future events still resolve via alias
 *    but are filtered out downstream (shift-brief, preemptive-strike
 *    both require is_active=1)
 *  - Merged → events get re-pointed to a target venue, the source
 *    venue is deactivated
 *
 * Query params:
 *   ?source=ticketmaster | overpass_osm | bananas | ...  — filter by discovery
 *   ?category=stadium | concert_hall | bar | restaurant  — filter by venue type
 *   ?limit=N                                              — default 50, max 500
 *
 * v2.53.4 (task #182): backend half of the review workflow. UI is a
 * separate version.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { and, eq, sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth } from '@/lib/auth'
import { logger } from '@sports-bar/logger'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response
  const authCheck = await requireAuth(request, 'ADMIN', { auditAction: 'venues_pending_list' })
  if (!authCheck.allowed) return authCheck.response!

  try {
    const sourceParam = request.nextUrl.searchParams.get('source')
    const categoryParam = request.nextUrl.searchParams.get('category')
    const limitParam = request.nextUrl.searchParams.get('limit')
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(limitParam || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    )

    const conditions = [eq(schema.neighborhoodVenues.reviewStatus, 'pending_review')]
    if (sourceParam) {
      conditions.push(eq(schema.neighborhoodVenues.discoverySource, sourceParam))
    }
    if (categoryParam) {
      conditions.push(eq(schema.neighborhoodVenues.category, categoryParam))
    }

    // Per-venue event-count tells the operator if this venue has actually
    // produced events (worth approving) or is just sitting in the queue
    // empty (probably worth declining).
    const venues = await db.all<{
      id: string
      name: string
      category: string
      distance_mi: number | null
      discovery_source: string
      created_at: number
      event_count: number
      latest_event_name: string | null
      latest_event_start: number | null
    }>(sql`
      SELECT
        nv.id,
        nv.name,
        nv.category,
        nv.distance_mi,
        nv.discovery_source,
        nv.created_at,
        (SELECT count(*) FROM NeighborhoodEvent ne WHERE ne.venue_id = nv.id) AS event_count,
        (SELECT artist_name FROM NeighborhoodEvent ne WHERE ne.venue_id = nv.id ORDER BY start_time DESC LIMIT 1) AS latest_event_name,
        (SELECT start_time FROM NeighborhoodEvent ne WHERE ne.venue_id = nv.id ORDER BY start_time DESC LIMIT 1) AS latest_event_start
      FROM NeighborhoodVenue nv
      WHERE nv.review_status = 'pending_review'
        AND nv.is_active = 1
        ${sourceParam ? sql`AND nv.discovery_source = ${sourceParam}` : sql``}
        ${categoryParam ? sql`AND nv.category = ${categoryParam}` : sql``}
      ORDER BY event_count DESC, nv.created_at DESC
      LIMIT ${limit}
    `)

    return NextResponse.json({
      success: true,
      count: venues.length,
      venues: venues.map((v) => ({
        id: v.id,
        name: v.name,
        category: v.category,
        distanceMi: v.distance_mi,
        discoverySource: v.discovery_source,
        createdAt: v.created_at,
        eventCount: v.event_count,
        latestEvent: v.latest_event_name
          ? { name: v.latest_event_name, startTime: v.latest_event_start }
          : null,
      })),
    })
  } catch (e: any) {
    logger.error('[ADMIN-VENUES] List failed', { data: { error: e?.message ?? String(e) } })
    return NextResponse.json(
      { success: false, error: e?.message ?? 'Internal error' },
      { status: 500 },
    )
  }
}
