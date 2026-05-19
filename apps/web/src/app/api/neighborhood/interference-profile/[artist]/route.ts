/**
 * GET /api/neighborhood/interference-profile/[artist]
 *
 * Returns the ArtistInterferenceProfile for the given artist at the
 * current LOCATION_ID, plus the last 10 NeighborhoodEvents booked
 * under that artist name and any InterferenceAttribution rows tied
 * to those events.
 *
 * The `[artist]` path param is the `artist_normalized` value (lower-
 * cased, trimmed, collapsed whitespace). Callers should URL-encode it
 * — multi-word artist names contain spaces.
 *
 * Query params (optional):
 *   ?eventLimit=N  — how many recent neighborhood events to include
 *                    (default 10, max 50)
 *
 * Powers the operator-facing "what does this artist do to our mics?"
 * detail panel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateQueryParams } from '@/lib/validation'

const querySchema = z.object({
  eventLimit: z.coerce.number().int().min(1).max(50).default(10),
})

type ProfileRow = {
  id: string
  artist_normalized: string
  location_id: string
  total_gigs: number
  gigs_with_interference: number
  avg_severity_dbm: number | null
  predicted_freqs_affected: string | null
  first_observed: number | null
  last_observed: number | null
  recommendation: string | null
  confidence: number
  updated_at: number
}

type EventRow = {
  id: string
  venue_id: string
  venue_name: string | null
  distance_mi: number | null
  artist_name: string
  artist_normalized: string
  start_time: number
  end_time: number | null
  event_type: string | null
  source: string
  source_url: string | null
}

type AttributionRow = {
  id: string
  rf_event_id: string
  neighborhood_event_id: string
  time_delta_seconds: number
  distance_mi: number
  confidence: number
  attribution_method: string
  created_at: number
  rf_detected_at: number | null
  rf_frequency_mhz: number | null
  rf_rssi_dbm: number | null
  rf_receiver_name: string | null
  rf_channel: number | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artist: string }> },
) {
  // DATABASE_READ — pure SELECT, no hardware roundtrips. Frequently
  // polled when an operator drills into a single artist row from the
  // upcoming-strikes panel.
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) return rateLimit.response

  const queryValidation = validateQueryParams(request, querySchema)
  if (!queryValidation.success) return queryValidation.error
  const { eventLimit } = queryValidation.data

  const { artist: artistParam } = await params
  const artist = decodeURIComponent(artistParam || '').trim().toLowerCase()
  if (!artist) {
    return NextResponse.json(
      { success: false, error: 'Missing artist parameter' },
      { status: 400 },
    )
  }

  const locationId = process.env.LOCATION_ID
  if (!locationId) {
    return NextResponse.json(
      { success: false, error: 'LOCATION_ID env not set' },
      { status: 500 },
    )
  }

  try {
    // 1. Profile row (may be null — artist hasn't crossed minTotalGigs yet).
    const profileRows = await db.all<ProfileRow>(sql`
      SELECT id, artist_normalized, location_id, total_gigs,
             gigs_with_interference, avg_severity_dbm, predicted_freqs_affected,
             first_observed, last_observed, recommendation, confidence, updated_at
      FROM ArtistInterferenceProfile
      WHERE artist_normalized = ${artist}
        AND location_id = ${locationId}
      LIMIT 1
    `)
    const profileRow = profileRows[0] ?? null
    const profile = profileRow
      ? {
          ...profileRow,
          predicted_freqs_affected: profileRow.predicted_freqs_affected
            ? safeParseArray(profileRow.predicted_freqs_affected)
            : [],
        }
      : null

    // 2. Last N neighborhood events for this artist (any venue) joined to
    //    venue name + distance.
    const events = await db.all<EventRow>(sql`
      SELECT ne.id, ne.venue_id, nv.name AS venue_name, nv.distance_mi,
             ne.artist_name, ne.artist_normalized, ne.start_time, ne.end_time,
             ne.event_type, ne.source, ne.source_url
      FROM NeighborhoodEvent ne
      LEFT JOIN NeighborhoodVenue nv ON nv.id = ne.venue_id
      WHERE ne.artist_normalized = ${artist}
      ORDER BY ne.start_time DESC
      LIMIT ${eventLimit}
    `)

    // 3. Attributions tied to those events, joined to the underlying rf rows.
    let attributions: AttributionRow[] = []
    if (events.length > 0) {
      const eventIds = events.map((e) => e.id)
      attributions = await db.all<AttributionRow>(sql`
        SELECT ia.id, ia.rf_event_id, ia.neighborhood_event_id,
               ia.time_delta_seconds, ia.distance_mi, ia.confidence,
               ia.attribution_method, ia.created_at,
               sre.detected_at AS rf_detected_at,
               sre.frequency_mhz AS rf_frequency_mhz,
               sre.rssi_dbm AS rf_rssi_dbm,
               sre.receiver_name AS rf_receiver_name,
               sre.channel AS rf_channel
        FROM InterferenceAttribution ia
        INNER JOIN shure_rf_events sre ON sre.id = ia.rf_event_id
        WHERE ia.neighborhood_event_id IN (${sql.join(
          eventIds.map((id) => sql`${id}`),
          sql.raw(','),
        )})
        ORDER BY ia.confidence DESC, ia.createdAt DESC
      `)
    }

    return NextResponse.json({
      success: true,
      locationId,
      artist,
      profile,
      events,
      attributions,
    })
  } catch (err: any) {
    logger.error(`[NEIGHBORHOOD-PROFILE] Query failed for artist '${artist}':`, err)
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Unknown error' },
      { status: 500 },
    )
  }
}

function safeParseArray(json: string): number[] {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'number') : []
  } catch {
    return []
  }
}
