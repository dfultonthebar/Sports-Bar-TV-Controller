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
      // v2.52.20 fix (audit M2): include source='shure' explicitly
      // rather than relying on the column default. The default keeps
      // working but if the schema is ever recreated without a default
      // (re-migration, fresh install glitch) this silently failed.
      // Explicit is defensive + matches the SDR pass on line 316.
      await db.run(sql`
        INSERT INTO InterferenceAttribution (
          id, rf_event_id, neighborhood_event_id,
          time_delta_seconds, distance_mi, confidence,
          attribution_method, source, created_at
        )
        VALUES (
          ${crypto.randomUUID()}, ${rf.id}, ${ne.id},
          ${dt}, ${dist}, ${confidence},
          'correlation_v1', 'shure', ${nowSec}
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

// =============================================================================
// v2.52.12: SDR ↔ NeighborhoodEvent correlator
// =============================================================================
//
// Parallel pipeline to the Shure correlator above, reading the
// sdr_carriers table instead of shure_rf_events. Two reasons to
// have both:
//
//   1. Wider band: the SDR sweeps 470-516 MHz seeing transmitters
//      Shure's receivers aren't even tuned to. So we may correlate
//      events that the Shure-only path misses entirely.
//
//   2. Independent confirmation: when BOTH the Shure and SDR see
//      activity coinciding with an artist's event, ArtistInterference
//      Profile confidence climbs faster (artist-profile-builder
//      aggregates both into per-artist counters).
//
// CRITICAL NARROWING: sdr_carriers fires for every transmitter we
// detect, including the giant WCWF UHF14 broadcast that's continuous.
// We don't want to attribute "Anduzzi's 8pm gig" to WCWF being on the
// air at 8pm. So this pass filters to SDR carriers within ±0.1 MHz
// of one of OUR Shure receiver freqs — i.e., transmitters that could
// actually interfere with our wireless mics. The Shure receiver freqs
// are pulled from shureSlxdClientManager's live snapshot (already
// hoisted to globalThis per Gotcha #10).
//
// De-dup: for each (NeighborhoodEvent, Shure freq), pick the SDR
// carrier closest in time to event start. Multiple sdr_carriers
// during one DJ set at the same freq collapse to one attribution.

const SDR_FREQ_MATCH_MHZ = 0.10
const SDR_LOOKBACK_SECONDS = 7 * 24 * 3600

interface SdrCarrierRow {
  id: string
  freq_mhz: number
  peak_dbm: number | null
  detected_at: number
}

/**
 * Get our Shure receiver freqs to filter SDR carriers by. Wrapped in
 * try/catch because shureSlxdClientManager may not exist on locations
 * without a Shure receiver — fall back to empty list and skip the SDR
 * correlation entirely there.
 */
async function getOurShureFreqsForCorrelation(): Promise<number[]> {
  try {
    // Dynamic import — packages/scheduler shouldn't have a hard
    // dependency on the shure-slxd package, since not every location
    // has a Shure receiver. If the import fails (no shure-slxd
    // installed at this location), return empty.
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

export async function correlateSdrInterference(
  opts: CorrelateOptions = {},
): Promise<CorrelateResult> {
  const sinceEpoch =
    opts.sinceEpoch ?? Math.floor(Date.now() / 1000) - SDR_LOOKBACK_SECONDS

  const ourFreqs = await getOurShureFreqsForCorrelation()
  if (ourFreqs.length === 0) {
    logger.info('[CORRELATOR-SDR] no Shure freqs known — skipping SDR pass')
    return { rfEventsProcessed: 0, attributionsWritten: 0 }
  }

  // Pull SDR carriers within freq-window of each of our Shure freqs.
  // event_type='carrier_active' is the canonical rising-edge event;
  // heartbeats during sustained carriers are de-duped below.
  const freqClauses = ourFreqs.map(
    (f) => sql`(freq_mhz BETWEEN ${f - SDR_FREQ_MATCH_MHZ} AND ${f + SDR_FREQ_MATCH_MHZ})`,
  )
  const carriers = await db.all<SdrCarrierRow>(sql`
    SELECT id, freq_mhz, peak_dbm, detected_at
    FROM sdr_carriers
    WHERE event_type = 'carrier_active'
      AND detected_at >= ${sinceEpoch}
      AND (${sql.join(freqClauses, sql` OR `)})
    ORDER BY detected_at DESC
  `)

  if (carriers.length === 0) {
    logger.info('[CORRELATOR-SDR] processed 0 carriers, wrote 0 attributions')
    return { rfEventsProcessed: 0, attributionsWritten: 0 }
  }

  const minTime = Math.min(...carriers.map((r) => r.detected_at))
  const maxTime = Math.max(...carriers.map((r) => r.detected_at))

  const candidateEvents = await db.all<NeighborhoodEventRow>(sql`
    SELECT ne.id, ne.venue_id, ne.start_time, ne.artist_normalized, nv.distance_mi
    FROM NeighborhoodEvent ne
    INNER JOIN NeighborhoodVenue nv ON nv.id = ne.venue_id
    WHERE nv.is_active = 1
      AND nv.distance_mi IS NOT NULL
      AND nv.distance_mi <= ${MAX_DISTANCE_MI}
      AND ne.start_time >= ${minTime - TIME_WINDOW_SECONDS}
      AND ne.start_time <= ${maxTime + TIME_WINDOW_SECONDS}
  `)

  // De-dup: per (NeighborhoodEvent, Shure freq), pick the SDR carrier
  // closest in time. Map key = `${neId}:${freqIdx}`.
  const bestPerPair = new Map<string, { carrier: SdrCarrierRow; ne: NeighborhoodEventRow; freqIdx: number; dt: number }>()
  for (const c of carriers) {
    // Find which of our freqs this carrier belongs to
    let freqIdx = -1
    for (let i = 0; i < ourFreqs.length; i++) {
      if (Math.abs(c.freq_mhz - ourFreqs[i]) <= SDR_FREQ_MATCH_MHZ) {
        freqIdx = i
        break
      }
    }
    if (freqIdx < 0) continue

    for (const ne of candidateEvents) {
      const dt = Math.abs(c.detected_at - ne.start_time)
      if (dt > TIME_WINDOW_SECONDS) continue
      const key = `${ne.id}:${freqIdx}`
      const prev = bestPerPair.get(key)
      if (!prev || dt < prev.dt) {
        bestPerPair.set(key, { carrier: c, ne, freqIdx, dt })
      }
    }
  }

  let attributionsWritten = 0
  const nowSec = Math.floor(Date.now() / 1000)
  for (const { carrier, ne, dt } of bestPerPair.values()) {
    if (ne.distance_mi === null) continue
    const confidence = computeAttributionConfidence(dt, ne.distance_mi)
    await db.run(sql`
      INSERT INTO InterferenceAttribution (
        id, rf_event_id, neighborhood_event_id,
        time_delta_seconds, distance_mi, confidence,
        attribution_method, source, created_at
      )
      VALUES (
        ${crypto.randomUUID()}, ${carrier.id}, ${ne.id},
        ${dt}, ${ne.distance_mi}, ${confidence},
        'correlation_v1', 'sdr', ${nowSec}
      )
      ON CONFLICT(rf_event_id, neighborhood_event_id) DO UPDATE SET
        confidence = excluded.confidence,
        time_delta_seconds = excluded.time_delta_seconds,
        distance_mi = excluded.distance_mi,
        source = excluded.source
    `)
    attributionsWritten++
  }

  logger.info(
    `[CORRELATOR-SDR] processed ${carriers.length} carriers (${ourFreqs.length} Shure freqs, ${candidateEvents.length} candidate events), wrote ${attributionsWritten} attributions`,
  )

  return { rfEventsProcessed: carriers.length, attributionsWritten }
}

/**
 * Run BOTH Shure and SDR correlation passes. Scheduler should call
 * this. Errors in either pass are logged but don't prevent the other.
 */
export async function correlateAllInterference(
  opts: CorrelateOptions = {},
): Promise<{ shure: CorrelateResult; sdr: CorrelateResult }> {
  const shure = await correlateInterference(opts).catch((err) => {
    logger.error('[CORRELATOR] Shure pass failed:', err)
    return { rfEventsProcessed: 0, attributionsWritten: 0 }
  })
  const sdr = await correlateSdrInterference(opts).catch((err) => {
    logger.error('[CORRELATOR-SDR] SDR pass failed:', err)
    return { rfEventsProcessed: 0, attributionsWritten: 0 }
  })
  return { shure, sdr }
}
