/**
 * Interference Correlator (v2.51.0+)
 *
 * Joins Shure RF interference events (`shure_rf_events`) with nearby
 * neighborhood venue events (`NeighborhoodEvent`) and writes per-pair
 * attribution rows into `InterferenceAttribution`. A later step
 * (artist-profile-builder) aggregates those attributions into per-artist
 * confidence profiles, which the preemptive-strike pass reads.
 *
 * Match criteria:
 *   - rf_event.event_type = 'rf_interference'
 *   - |rf_event.detected_at - neighborhood_event.start_time| <= 1800s (±30 min)
 *   - neighborhood_event.venue.distance_mi <= 1.0
 *
 * Confidence (per pair, single-event):
 *   (1 - time_delta/1800) * (1 - distance/1.0) * 0.85
 *
 * Cap at 0.85 — a single match never "proves" anything; only multi-gig
 * profiles approach high confidence. Tuneable later.
 *
 * Idempotent: upserts on the (rf_event_id, neighborhood_event_id) unique
 * index. Re-running adjusts confidence + time_delta_seconds in place.
 */

import { db, schema, eq, and, gte, sql } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

const TIME_WINDOW_SECONDS = 1800 // ±30 min
const MAX_DISTANCE_MI = 1.0
const SINGLE_EVENT_CONFIDENCE_CAP = 0.85
const DEFAULT_LOOKBACK_SECONDS = 7 * 24 * 3600 // 7 days

export interface CorrelateOptions {
  rfEventIds?: string[]
  sinceEpoch?: number
}

export interface CorrelateResult {
  rfEventsProcessed: number
  attributionsWritten: number
}

interface RfEventRow {
  id: string
  detected_at: number
  frequency_mhz: number | null
  rssi_dbm: number | null
}

interface NeighborhoodEventRow {
  id: string
  venue_id: string
  start_time: number
  artist_normalized: string
  distance_mi: number | null
}

/**
 * Compute single-event confidence from (time delta, distance).
 * Both factors are linear 1.0 → 0.0 as they approach their max, then
 * multiplied + capped. Exposed for tests.
 */
export function computeAttributionConfidence(
  timeDeltaSeconds: number,
  distanceMi: number,
): number {
  const tFactor = Math.max(0, 1 - timeDeltaSeconds / TIME_WINDOW_SECONDS)
  const dFactor = Math.max(0, 1 - distanceMi / MAX_DISTANCE_MI)
  const raw = tFactor * dFactor * SINGLE_EVENT_CONFIDENCE_CAP
  return Math.min(SINGLE_EVENT_CONFIDENCE_CAP, Math.max(0, raw))
}

export async function correlateInterference(
  opts: CorrelateOptions = {},
): Promise<CorrelateResult> {
  const sinceEpoch =
    opts.sinceEpoch ?? Math.floor(Date.now() / 1000) - DEFAULT_LOOKBACK_SECONDS

  // 1. Candidate rf events. Either an explicit ID list (e.g. fresh
  //    detection just wrote a row and wants to attribute it immediately)
  //    or a time window.
  let rfRows: RfEventRow[]
  if (opts.rfEventIds && opts.rfEventIds.length > 0) {
    rfRows = await db.all<RfEventRow>(sql`
      SELECT id, detected_at, frequency_mhz, rssi_dbm
      FROM shure_rf_events
      WHERE event_type = 'rf_interference'
        AND id IN (${sql.join(
          opts.rfEventIds.map((id) => sql`${id}`),
          sql.raw(','),
        )})
    `)
  } else {
    rfRows = await db.all<RfEventRow>(sql`
      SELECT id, detected_at, frequency_mhz, rssi_dbm
      FROM shure_rf_events
      WHERE event_type = 'rf_interference'
        AND detected_at >= ${sinceEpoch}
      ORDER BY detected_at DESC
    `)
  }

  if (rfRows.length === 0) {
    logger.info('[CORRELATOR] processed 0 rf events, wrote 0 attributions')
    return { rfEventsProcessed: 0, attributionsWritten: 0 }
  }

  // 2. For the overall scan window, pull candidate neighborhood events
  //    joined to their venue, filtered to <= MAX_DISTANCE_MI. Bound the
  //    time range by the rf row min/max ± TIME_WINDOW_SECONDS so we don't
  //    scan the whole neighborhood_event table for a small batch.
  const rfMinTime = Math.min(...rfRows.map((r) => r.detected_at))
  const rfMaxTime = Math.max(...rfRows.map((r) => r.detected_at))
  const neighborhoodWindowStart = rfMinTime - TIME_WINDOW_SECONDS
  const neighborhoodWindowEnd = rfMaxTime + TIME_WINDOW_SECONDS

  const candidateEvents = await db.all<NeighborhoodEventRow>(sql`
    SELECT ne.id, ne.venue_id, ne.start_time, ne.artist_normalized, nv.distance_mi
    FROM NeighborhoodEvent ne
    INNER JOIN NeighborhoodVenue nv ON nv.id = ne.venue_id
    WHERE nv.is_active = 1
      AND nv.distance_mi IS NOT NULL
      AND nv.distance_mi <= ${MAX_DISTANCE_MI}
      AND ne.start_time >= ${neighborhoodWindowStart}
      AND ne.start_time <= ${neighborhoodWindowEnd}
  `)

  let attributionsWritten = 0
  const nowSec = Math.floor(Date.now() / 1000)

  // 3. For each rf event, scan candidate neighborhood events for matches.
  //    O(N*M) but both lists are small in practice (N rf events in a
  //    7-day window, M neighborhood events within ±30 min of those).
  for (const rf of rfRows) {
    for (const ne of candidateEvents) {
      const dt = Math.abs(rf.detected_at - ne.start_time)
      if (dt > TIME_WINDOW_SECONDS) continue
      const dist = ne.distance_mi
      if (dist === null || dist > MAX_DISTANCE_MI) continue

      const confidence = computeAttributionConfidence(dt, dist)

      // Upsert via the unique (rf_event_id, neighborhood_event_id) index.
      // Re-running adjusts confidence / time_delta only.
      await db.run(sql`
        INSERT INTO InterferenceAttribution (
          id, rf_event_id, neighborhood_event_id,
          time_delta_seconds, distance_mi, confidence,
          attribution_method, created_at
        )
        VALUES (
          ${crypto.randomUUID()}, ${rf.id}, ${ne.id},
          ${dt}, ${dist}, ${confidence},
          'correlation_v1', ${nowSec}
        )
        ON CONFLICT(rf_event_id, neighborhood_event_id) DO UPDATE SET
          confidence = excluded.confidence,
          time_delta_seconds = excluded.time_delta_seconds,
          distance_mi = excluded.distance_mi
      `)
      attributionsWritten++
    }
  }

  logger.info(
    `[CORRELATOR] processed ${rfRows.length} rf events, wrote ${attributionsWritten} attributions`,
  )

  return { rfEventsProcessed: rfRows.length, attributionsWritten }
}
