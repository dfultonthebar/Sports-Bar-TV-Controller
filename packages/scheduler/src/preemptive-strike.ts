/**
 * Preemptive Strike (v2.51.0+)
 *
 * Reads upcoming `NeighborhoodEvent` rows in the next `horizonHours`,
 * joins them against high-confidence `ArtistInterferenceProfile` rows
 * for our `locationId`, and logs a `[PREEMPTIVE]` warning for each
 * upcoming gig whose artist is a known interferer.
 *
 * STAGE 1 ONLY — this module DOES NOT retune Shure mics. It logs +
 * returns candidate alerts; a future stage 2 will read those and
 * actually retune. Keeping retune behavior out for now means we can
 * deploy the prediction pipeline first and let operators eyeball the
 * recommendations before automating action.
 *
 * Confidence threshold: 0.6. Below that we treat the data as
 * suggestive rather than actionable.
 */

import { db, sql } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

const DEFAULT_HORIZON_HOURS = 12
const ACTIONABLE_CONFIDENCE = 0.6

export interface PreemptiveStrikeOptions {
  locationId: string
  horizonHours?: number
}

export interface PreemptiveStrikeCandidate {
  neighborhoodEventId: string
  artistNormalized: string
  artistName: string
  venueName: string
  venueDistanceMi: number | null
  startTime: number
  hoursUntil: number
  profileConfidence: number
  predictedFreqsAffected: number[]
  recommendation: string | null
  avgSeverityDbm: number | null
  totalGigs: number
  gigsWithInterference: number
}

interface UpcomingRow {
  ne_id: string
  artist_normalized: string
  artist_name: string
  start_time: number
  venue_name: string
  distance_mi: number | null
  profile_confidence: number
  predicted_freqs_affected: string | null
  recommendation: string | null
  avg_severity_dbm: number | null
  total_gigs: number
  gigs_with_interference: number
}

export async function runPreemptiveStrike(
  opts: PreemptiveStrikeOptions,
): Promise<PreemptiveStrikeCandidate[]> {
  const horizonHours = opts.horizonHours ?? DEFAULT_HORIZON_HOURS
  const locationId = opts.locationId
  const nowSec = Math.floor(Date.now() / 1000)
  const horizonSec = nowSec + horizonHours * 3600

  // Join upcoming neighborhood events with high-confidence artist
  // profiles for our location. Filter at query time so we don't waste
  // round-trips for non-actionable artists.
  const rows = await db.all<UpcomingRow>(sql`
    SELECT
      ne.id AS ne_id,
      ne.artist_normalized,
      ne.artist_name,
      ne.start_time,
      nv.name AS venue_name,
      nv.distance_mi,
      aip.confidence AS profile_confidence,
      aip.predicted_freqs_affected,
      aip.recommendation,
      aip.avg_severity_dbm,
      aip.total_gigs,
      aip.gigs_with_interference
    FROM NeighborhoodEvent ne
    INNER JOIN NeighborhoodVenue nv ON nv.id = ne.venue_id
    INNER JOIN ArtistInterferenceProfile aip
      ON aip.artist_normalized = ne.artist_normalized
      AND aip.location_id = ${locationId}
    WHERE ne.start_time > ${nowSec}
      AND ne.start_time < ${horizonSec}
      AND aip.confidence >= ${ACTIONABLE_CONFIDENCE}
    ORDER BY ne.start_time ASC
  `)

  const candidates: PreemptiveStrikeCandidate[] = rows.map((r) => {
    const hoursUntil = (r.start_time - nowSec) / 3600
    let freqs: number[] = []
    if (r.predicted_freqs_affected) {
      try {
        const parsed = JSON.parse(r.predicted_freqs_affected)
        if (Array.isArray(parsed)) {
          freqs = parsed.filter((v) => typeof v === 'number')
        }
      } catch {
        // Bad JSON — leave freqs empty rather than crashing the strike pass.
      }
    }
    return {
      neighborhoodEventId: r.ne_id,
      artistNormalized: r.artist_normalized,
      artistName: r.artist_name,
      venueName: r.venue_name,
      venueDistanceMi: r.distance_mi,
      startTime: r.start_time,
      hoursUntil,
      profileConfidence: r.profile_confidence,
      predictedFreqsAffected: freqs,
      recommendation: r.recommendation,
      avgSeverityDbm: r.avg_severity_dbm,
      totalGigs: r.total_gigs,
      gigsWithInterference: r.gigs_with_interference,
    }
  })

  for (const c of candidates) {
    const freqsStr = c.predictedFreqsAffected.length
      ? c.predictedFreqsAffected.map((f) => f.toFixed(1)).join(', ')
      : '(none recorded)'
    logger.warn(
      `[PREEMPTIVE] artist '${c.artistName}' booked at '${c.venueName}' in ${c.hoursUntil.toFixed(1)}h — confidence ${c.profileConfidence.toFixed(2)}, freqs [${freqsStr}]. Recommend pre-scan + retune.`,
    )
  }

  if (candidates.length === 0) {
    logger.info(
      `[PREEMPTIVE] no preemptive-strike candidates in next ${horizonHours}h for location ${locationId}`,
    )
  } else {
    logger.info(
      `[PREEMPTIVE] ${candidates.length} candidate(s) in next ${horizonHours}h for location ${locationId}`,
    )
  }

  return candidates
}
