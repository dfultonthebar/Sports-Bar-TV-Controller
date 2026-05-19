/**
 * Artist Interference Profile Builder (v2.51.0+)
 *
 * Aggregates `InterferenceAttribution` rows across multiple gigs per
 * artist into a single profile row in `ArtistInterferenceProfile`. The
 * preemptive-strike pass reads these profiles to decide whether an
 * upcoming nearby booking should trigger a pre-event Shure retune.
 *
 * Aggregation per artist (180-day window):
 *   - total_gigs        = COUNT(DISTINCT NeighborhoodEvent.id)
 *   - gigs_with_interference = COUNT(DISTINCT NeighborhoodEvent.id WHERE
 *                               attribution.confidence >= 0.4)
 *   - avg_severity_dbm  = AVG(shure_rf_events.rssi_dbm) over attributed rows
 *   - predicted_freqs_affected = JSON array of distinct frequencies
 *                                (rounded to 0.1 MHz)
 *   - confidence = (gigsWithInterference / totalGigs) * min(totalGigs/10, 1.0)
 *
 * Below `minTotalGigs` (default 3) we skip the artist — insufficient
 * data to make a recommendation.
 *
 * Artists scoring confidence >= 0.6 get an Ollama-generated 2-3 sentence
 * operational recommendation written to `recommendation`.
 *
 * Idempotent: upserts on (artist_normalized, location_id) unique index.
 */

import { db, sql } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

const LOOKBACK_DAYS = 180
const DEFAULT_MIN_TOTAL_GIGS = 3
const ATTRIBUTION_CONFIDENCE_THRESHOLD = 0.4
const RECOMMENDATION_CONFIDENCE_THRESHOLD = 0.6

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL_NEIGHBORHOOD ||
  process.env.OLLAMA_MODEL ||
  'llama3.1:8b'

export interface RebuildProfilesOptions {
  locationId: string
  minTotalGigs?: number
}

export interface RebuildProfilesResult {
  artistsScanned: number
  profilesWritten: number
  recommendationsGenerated: number
}

interface ArtistRow {
  artist_normalized: string
}

interface GigAggRow {
  total_gigs: number
  gigs_with_interference: number
  first_observed: number | null
  last_observed: number | null
}

interface SeverityRow {
  avg_rssi: number | null
  freq_mhz: number | null
}

/**
 * Round to one decimal place — predicted_freqs_affected stores 0.1 MHz
 * buckets so jitter in frequency_mhz doesn't bloat the JSON list.
 */
function roundFreqToTenth(mhz: number): number {
  return Math.round(mhz * 10) / 10
}

async function callOllamaRecommendation(prompt: string): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.3, num_ctx: 2048 },
      }),
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) {
      logger.warn(
        `[ARTIST-PROFILE] Ollama HTTP ${res.status} — skipping recommendation`,
      )
      return null
    }
    const data = (await res.json()) as { response?: string }
    return (data.response ?? '').trim() || null
  } catch (err: any) {
    logger.warn(
      `[ARTIST-PROFILE] Ollama call failed — skipping recommendation: ${err.message}`,
    )
    return null
  }
}

export async function rebuildArtistProfiles(
  opts: RebuildProfilesOptions,
): Promise<RebuildProfilesResult> {
  const minTotalGigs = opts.minTotalGigs ?? DEFAULT_MIN_TOTAL_GIGS
  const locationId = opts.locationId
  const cutoff = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 24 * 3600

  // 1. Distinct artists with at least one event in the lookback window.
  const artistRows = await db.all<ArtistRow>(sql`
    SELECT DISTINCT artist_normalized
    FROM NeighborhoodEvent
    WHERE start_time >= ${cutoff}
      AND artist_normalized IS NOT NULL
      AND artist_normalized != ''
  `)

  let profilesWritten = 0
  let recommendationsGenerated = 0
  const nowSec = Math.floor(Date.now() / 1000)

  for (const { artist_normalized: artist } of artistRows) {
    // 2. Per-artist aggregates: total_gigs + gigs_with_interference.
    //    "gigs_with_interference" = neighborhood events with at least
    //    one attribution row whose confidence >= 0.4.
    const aggRow = await db.all<GigAggRow>(sql`
      SELECT
        COUNT(DISTINCT ne.id) AS total_gigs,
        COUNT(DISTINCT CASE WHEN ia_match.neighborhood_event_id IS NOT NULL THEN ne.id END) AS gigs_with_interference,
        MIN(ne.start_time) AS first_observed,
        MAX(ne.start_time) AS last_observed
      FROM NeighborhoodEvent ne
      LEFT JOIN (
        SELECT DISTINCT neighborhood_event_id
        FROM InterferenceAttribution
        WHERE confidence >= ${ATTRIBUTION_CONFIDENCE_THRESHOLD}
      ) ia_match ON ia_match.neighborhood_event_id = ne.id
      WHERE ne.artist_normalized = ${artist}
        AND ne.start_time >= ${cutoff}
    `)
    const agg = aggRow[0]
    if (!agg || agg.total_gigs < minTotalGigs) {
      continue
    }

    // 3. Severity + affected-freq aggregation over the attributed rf events.
    const sevRows = await db.all<SeverityRow>(sql`
      SELECT sre.rssi_dbm AS avg_rssi, sre.frequency_mhz AS freq_mhz
      FROM InterferenceAttribution ia
      INNER JOIN shure_rf_events sre ON sre.id = ia.rf_event_id
      INNER JOIN NeighborhoodEvent ne ON ne.id = ia.neighborhood_event_id
      WHERE ne.artist_normalized = ${artist}
        AND ia.confidence >= ${ATTRIBUTION_CONFIDENCE_THRESHOLD}
        AND ne.start_time >= ${cutoff}
    `)

    let avgSeverity: number | null = null
    const freqSet = new Set<number>()
    if (sevRows.length > 0) {
      const rssiVals = sevRows
        .map((r) => r.avg_rssi)
        .filter((v): v is number => v !== null && Number.isFinite(v))
      if (rssiVals.length > 0) {
        avgSeverity = rssiVals.reduce((a, b) => a + b, 0) / rssiVals.length
      }
      for (const r of sevRows) {
        if (r.freq_mhz !== null && Number.isFinite(r.freq_mhz)) {
          freqSet.add(roundFreqToTenth(r.freq_mhz))
        }
      }
    }
    const predictedFreqs = Array.from(freqSet).sort((a, b) => a - b)

    // 4. Confidence: hit-rate scaled by sample size. < 10 gigs penalizes
    //    linearly; >= 10 gigs is full weight.
    const hitRate = agg.gigs_with_interference / agg.total_gigs
    const sampleFactor = Math.min(agg.total_gigs / 10, 1.0)
    const confidence = hitRate * sampleFactor

    // 5. Optional Ollama recommendation for high-confidence artists.
    let recommendation: string | null = null
    if (confidence >= RECOMMENDATION_CONFIDENCE_THRESHOLD) {
      const freqsStr = predictedFreqs.length
        ? predictedFreqs.map((f) => f.toFixed(1)).join(', ')
        : '(no freq data)'
      const avgRssiStr =
        avgSeverity !== null ? `${avgSeverity.toFixed(1)} dBm` : 'unknown'
      const prompt = `Artist '${artist}' has caused wireless mic interference at ${agg.gigs_with_interference}/${agg.total_gigs} of their nearby gigs at frequencies [${freqsStr}]. Average severity ${avgRssiStr}. Write a 2-3 sentence operational recommendation for the bar owner — what to do BEFORE this artist plays nearby next time.`
      const reco = await callOllamaRecommendation(prompt)
      if (reco) {
        recommendation = reco
        recommendationsGenerated++
      }
    }

    // 6. Upsert profile via (artist_normalized, location_id) unique index.
    await db.run(sql`
      INSERT INTO ArtistInterferenceProfile (
        id, artist_normalized, location_id,
        total_gigs, gigs_with_interference, avg_severity_dbm,
        predicted_freqs_affected, first_observed, last_observed,
        recommendation, confidence, updated_at
      )
      VALUES (
        ${crypto.randomUUID()}, ${artist}, ${locationId},
        ${agg.total_gigs}, ${agg.gigs_with_interference}, ${avgSeverity},
        ${JSON.stringify(predictedFreqs)}, ${agg.first_observed}, ${agg.last_observed},
        ${recommendation}, ${confidence}, ${nowSec}
      )
      ON CONFLICT(artist_normalized, location_id) DO UPDATE SET
        total_gigs = excluded.total_gigs,
        gigs_with_interference = excluded.gigs_with_interference,
        avg_severity_dbm = excluded.avg_severity_dbm,
        predicted_freqs_affected = excluded.predicted_freqs_affected,
        first_observed = excluded.first_observed,
        last_observed = excluded.last_observed,
        recommendation = COALESCE(excluded.recommendation, ArtistInterferenceProfile.recommendation),
        confidence = excluded.confidence,
        updated_at = excluded.updated_at
    `)
    profilesWritten++
  }

  logger.info(
    `[ARTIST-PROFILE] scanned ${artistRows.length} artists, wrote ${profilesWritten} profiles, generated ${recommendationsGenerated} recommendations`,
  )

  return {
    artistsScanned: artistRows.length,
    profilesWritten,
    recommendationsGenerated,
  }
}
