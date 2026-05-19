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
  /**
   * v2.52.13 (Tier 2 AI): top-3 candidate freqs in the SLX-D G58 band
   * scored as historically QUIETEST over the last 7 days of SDR data,
   * excluding any freq this artist is predicted to affect and our
   * currently-tuned Shure freqs. Bartender-grade suggestion: "Tonight's
   * DJ tends to hit 484.7. Move Mic 2 to 491.2 — it's been clean 99% of
   * the past week."
   */
  suggestedCleanFreqs: CleanFreqSuggestion[]
}

export interface CleanFreqSuggestion {
  freqMhz: number
  avgDbm: number
  /** Minutes (over last 7 days) where this freq's max exceeded -75 dBm. */
  hotMinutes: number
  /** Total minutes observed for this freq (for hot% denominator). */
  totalMinutes: number
  /** Single-line rationale for the operator: "quiet 99% of last 7 days, avg -88 dBm". */
  rationale: string
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

// v2.52.13: SDR-aware clean-freq suggestion. Reads last 7 days of
// sdr_spectrum and scores candidate freqs in the SLX-D G58 band
// (470-514 MHz) by historical quietness. Sampled at 0.5 MHz steps
// because mic freqs are typically allocated on 50-200 kHz spacing,
// not every single 25 kHz bin.
const G58_BAND_START_MHZ = 471
const G58_BAND_END_MHZ = 513
const CANDIDATE_STEP_MHZ = 0.5
const HOT_THRESHOLD_DBM = -75
const SUGGEST_LOOKBACK_SECONDS = 7 * 24 * 3600
const SUGGEST_TOP_N = 3
const FREQ_EXCLUSION_MHZ = 0.2 // don't suggest freqs within ±0.2 MHz of a predicted-affected or in-use freq

interface FreqStatsRow {
  freq_mhz: number
  avg_dbm: number
  max_dbm: number
  hot_count: number
  total_count: number
}

/**
 * Score candidate clean freqs from 7-day sdr_spectrum data, excluding
 * predicted-affected freqs (from the artist's profile) and currently
 * in-use Shure freqs. Returns top N quietest sorted by avg dBm asc +
 * hot-minutes asc.
 */
async function suggestCleanFreqs(
  excludeFreqsMhz: number[],
): Promise<CleanFreqSuggestion[]> {
  const cutoff = Math.floor(Date.now() / 1000) - SUGGEST_LOOKBACK_SECONDS

  // Pull peak-stats for ALL bins observed in the last 7 days. We then
  // sample at our CANDIDATE_STEP_MHZ grid in JS to keep the SQL simple.
  let rows: FreqStatsRow[]
  try {
    rows = await db.all<FreqStatsRow>(sql`
      SELECT
        ROUND(freq_mhz * 2) / 2 AS freq_mhz,
        AVG(max_dbm) AS avg_dbm,
        MAX(max_dbm) AS max_dbm,
        SUM(CASE WHEN max_dbm > ${HOT_THRESHOLD_DBM} THEN 1 ELSE 0 END) AS hot_count,
        COUNT(*) AS total_count
      FROM sdr_spectrum
      WHERE detected_at >= ${cutoff}
        AND freq_mhz BETWEEN ${G58_BAND_START_MHZ} AND ${G58_BAND_END_MHZ}
      GROUP BY ROUND(freq_mhz * 2) / 2
      HAVING total_count > 10
      ORDER BY avg_dbm ASC, hot_count ASC
      LIMIT 50
    `)
  } catch {
    // sdr_spectrum doesn't exist (location without SDR) — return empty.
    return []
  }

  if (rows.length === 0) return []

  const isExcluded = (f: number) =>
    excludeFreqsMhz.some((ex) => Math.abs(f - ex) <= FREQ_EXCLUSION_MHZ)

  const top: CleanFreqSuggestion[] = []
  for (const r of rows) {
    if (isExcluded(r.freq_mhz)) continue
    const hotPct = r.total_count > 0 ? (r.hot_count / r.total_count) * 100 : 0
    const cleanPct = 100 - hotPct
    top.push({
      freqMhz: r.freq_mhz,
      avgDbm: r.avg_dbm,
      hotMinutes: r.hot_count,
      totalMinutes: r.total_count,
      rationale: `quiet ${cleanPct.toFixed(1)}% of last 7 days, avg ${r.avg_dbm.toFixed(0)} dBm`,
    })
    if (top.length >= SUGGEST_TOP_N) break
  }
  return top
}

/**
 * Pull currently-tuned Shure freqs via the globalThis client manager.
 * Same pattern as interference-correlator's getOurShureFreqsForCorrelation.
 */
async function getCurrentShureFreqs(): Promise<number[]> {
  try {
    const mgrMod: any = await import('@sports-bar/shure-slxd').catch(() => null)
    if (!mgrMod || typeof mgrMod.shureSlxdClientManager?.getSnapshots !== 'function') return []
    const snaps = mgrMod.shureSlxdClientManager.getSnapshots()
    const freqs = new Set<number>()
    for (const s of snaps) {
      for (const ch of s.channels ?? []) {
        if (typeof ch.frequencyMhz === 'number' && ch.frequencyMhz > 0) freqs.add(ch.frequencyMhz)
      }
    }
    return Array.from(freqs)
  } catch {
    return []
  }
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

  // v2.52.13: pull our currently-tuned Shure freqs once (shared across
  // all candidates). Also pull the suggested clean freqs once per
  // distinct exclusion set so we don't re-query sdr_spectrum N times
  // when N candidates all share the same set.
  const currentShureFreqs = await getCurrentShureFreqs()
  const cleanFreqsCache = new Map<string, CleanFreqSuggestion[]>()

  const candidates: PreemptiveStrikeCandidate[] = []
  for (const r of rows) {
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
    // v2.52.13: get top-3 cleanest historical freqs that avoid both
    // the artist's predicted-affected set and our in-use Shure freqs.
    // Cache by sorted exclusion key — multiple candidates with the same
    // exclusion set share one query.
    const excludeKey = [...freqs, ...currentShureFreqs].sort((a, b) => a - b).join(',')
    let suggestions = cleanFreqsCache.get(excludeKey)
    if (!suggestions) {
      suggestions = await suggestCleanFreqs([...freqs, ...currentShureFreqs])
      cleanFreqsCache.set(excludeKey, suggestions)
    }
    candidates.push({
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
      suggestedCleanFreqs: suggestions,
    })
  }

  for (const c of candidates) {
    const freqsStr = c.predictedFreqsAffected.length
      ? c.predictedFreqsAffected.map((f) => f.toFixed(1)).join(', ')
      : '(none recorded)'
    const suggestStr = c.suggestedCleanFreqs.length
      ? c.suggestedCleanFreqs.map((s) => `${s.freqMhz} MHz`).join(', ')
      : '(no SDR data yet)'
    logger.warn(
      `[PREEMPTIVE] artist '${c.artistName}' booked at '${c.venueName}' in ${c.hoursUntil.toFixed(1)}h — confidence ${c.profileConfidence.toFixed(2)}, freqs at risk [${freqsStr}]. Suggested clean: [${suggestStr}].`,
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

/**
 * v2.52.13 (Tier 4 — also enables "Find me a clean freq" button):
 * standalone helper that returns ranked clean freq suggestions
 * independent of any upcoming event. The bartender or admin UI can
 * call this on-demand: "I want to retune Mic 2 — what's the cleanest
 * freq right now based on the last 7 days?"
 *
 * Optionally pass currentlyUsedFreqs to exclude — defaults to pulling
 * from the live Shure receivers, but the UI may want to pass freqs of
 * planned future configurations.
 */
export async function findCleanFreqs(opts?: {
  excludeFreqsMhz?: number[]
  topN?: number
}): Promise<CleanFreqSuggestion[]> {
  const exclude = opts?.excludeFreqsMhz ?? (await getCurrentShureFreqs())
  const all = await suggestCleanFreqs(exclude)
  const n = opts?.topN ?? SUGGEST_TOP_N
  return all.slice(0, n)
}
