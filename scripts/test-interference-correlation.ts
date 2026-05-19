#!/usr/bin/env tsx
/**
 * Test Interference Correlation (v2.51.0+)
 *
 * Inserts a mock Shure RF interference event + a mock NeighborhoodEvent
 * whose start_time is close to it (and whose venue is within range),
 * then runs the correlator and asserts that an InterferenceAttribution
 * row was created with the right confidence.
 *
 * Usage:
 *   npx tsx scripts/test-interference-correlation.ts
 *
 * Cleans up its own mock rows on success. On failure, prints the IDs
 * so they can be inspected manually.
 *
 * EXIT 0 on pass, EXIT 1 on fail.
 */

import { db, sql } from '@sports-bar/database'
import {
  correlateInterference,
  computeAttributionConfidence,
} from '../packages/scheduler/src/interference-correlator'

const TEST_PREFIX = 'test-correlator-'

async function cleanup(rfId: string, venueId: string, eventId: string) {
  // Delete in FK-safe order: attribution → event → rf event → venue.
  try {
    await db.run(sql`DELETE FROM InterferenceAttribution WHERE rf_event_id = ${rfId}`)
    await db.run(sql`DELETE FROM NeighborhoodEvent WHERE id = ${eventId}`)
    await db.run(sql`DELETE FROM shure_rf_events WHERE id = ${rfId}`)
    await db.run(sql`DELETE FROM NeighborhoodVenue WHERE id = ${venueId}`)
  } catch (err: any) {
    console.warn(`[TEST] Cleanup warning: ${err.message}`)
  }
}

async function main() {
  const now = Math.floor(Date.now() / 1000)
  const rfId = `${TEST_PREFIX}rf-${now}`
  const venueId = `${TEST_PREFIX}venue-${now}`
  const eventId = `${TEST_PREFIX}event-${now}`

  // Time offset: 600s = 10 minutes between rf detection and the
  // neighborhood gig's start. Distance 0.3 mi = Lambeau-like.
  const timeDelta = 600
  const distance = 0.3
  const rfDetectedAt = now
  const eventStartTime = now + timeDelta

  console.log('[TEST] Setting up mock data...')
  console.log(`  rfDetectedAt    = ${rfDetectedAt}`)
  console.log(`  eventStartTime  = ${eventStartTime} (Δ${timeDelta}s)`)
  console.log(`  venue.distance  = ${distance} mi`)

  try {
    // 1. Mock venue (within 1.0 mi)
    await db.run(sql`
      INSERT INTO NeighborhoodVenue (
        id, name, category, latitude, longitude, distance_mi, is_active, created_at, updated_at
      ) VALUES (
        ${venueId}, ${'Test Venue ' + now}, 'bar', 44.5013, -88.0622, ${distance}, 1, ${now}, ${now}
      )
    `)

    // 2. Mock neighborhood event for the venue
    await db.run(sql`
      INSERT INTO NeighborhoodEvent (
        id, venue_id, artist_name, artist_normalized, start_time, end_time,
        event_type, source, source_event_id, ingested_at, created_at
      ) VALUES (
        ${eventId}, ${venueId}, 'DJ MockTest', 'dj mocktest',
        ${eventStartTime}, ${eventStartTime + 3600},
        'dj', 'test', ${`${TEST_PREFIX}src-${now}`}, ${now}, ${now}
      )
    `)

    // 3. Mock shure rf_interference event
    await db.run(sql`
      INSERT INTO shure_rf_events (
        id, receiver_id, receiver_name, channel, event_type,
        rssi_dbm, frequency_mhz, tx_type, detected_at
      ) VALUES (
        ${rfId}, 'mock-receiver', 'MockShure1', 1, 'rf_interference',
        -74.5, 510.9, 'UNKNOWN', ${rfDetectedAt}
      )
    `)

    console.log('[TEST] Running correlateInterference()...')
    const result = await correlateInterference({ rfEventIds: [rfId] })
    console.log(
      `[TEST]   processed=${result.rfEventsProcessed} written=${result.attributionsWritten}`,
    )

    if (result.attributionsWritten < 1) {
      console.error('[TEST] FAIL: expected ≥1 attribution, got 0')
      console.error(`[TEST] Inspect: rf=${rfId} event=${eventId} venue=${venueId}`)
      process.exit(1)
    }

    // 4. Verify attribution row + confidence value
    const rows = await db.all<{
      id: string
      confidence: number
      time_delta_seconds: number
      distance_mi: number
      attribution_method: string
    }>(sql`
      SELECT id, confidence, time_delta_seconds, distance_mi, attribution_method
      FROM InterferenceAttribution
      WHERE rf_event_id = ${rfId} AND neighborhood_event_id = ${eventId}
    `)

    if (rows.length !== 1) {
      console.error(`[TEST] FAIL: expected exactly 1 attribution row, got ${rows.length}`)
      console.error(`[TEST] Inspect: rf=${rfId} event=${eventId} venue=${venueId}`)
      process.exit(1)
    }

    const attribution = rows[0]
    const expectedConfidence = computeAttributionConfidence(timeDelta, distance)
    console.log(`[TEST]   row.confidence       = ${attribution.confidence.toFixed(6)}`)
    console.log(`[TEST]   expected confidence  = ${expectedConfidence.toFixed(6)}`)
    console.log(`[TEST]   row.time_delta_s     = ${attribution.time_delta_seconds}`)
    console.log(`[TEST]   row.distance_mi      = ${attribution.distance_mi}`)
    console.log(`[TEST]   row.method           = ${attribution.attribution_method}`)

    if (Math.abs(attribution.confidence - expectedConfidence) > 0.0001) {
      console.error('[TEST] FAIL: confidence mismatch')
      console.error(`[TEST] Inspect: rf=${rfId} event=${eventId} venue=${venueId}`)
      process.exit(1)
    }
    if (attribution.time_delta_seconds !== timeDelta) {
      console.error(
        `[TEST] FAIL: time_delta_seconds=${attribution.time_delta_seconds} expected ${timeDelta}`,
      )
      process.exit(1)
    }
    if (Math.abs(attribution.distance_mi - distance) > 0.0001) {
      console.error(`[TEST] FAIL: distance_mi=${attribution.distance_mi} expected ${distance}`)
      process.exit(1)
    }
    if (attribution.attribution_method !== 'correlation_v1') {
      console.error(`[TEST] FAIL: attribution_method=${attribution.attribution_method}`)
      process.exit(1)
    }

    // 5. Idempotency check — running again should NOT create a duplicate.
    console.log('[TEST] Re-running correlator for idempotency...')
    await correlateInterference({ rfEventIds: [rfId] })
    const dupCheck = await db.all<{ c: number }>(sql`
      SELECT COUNT(*) AS c FROM InterferenceAttribution
      WHERE rf_event_id = ${rfId} AND neighborhood_event_id = ${eventId}
    `)
    if (dupCheck[0]?.c !== 1) {
      console.error(`[TEST] FAIL: idempotency broken — found ${dupCheck[0]?.c} rows`)
      process.exit(1)
    }
    console.log('[TEST]   idempotency OK (still 1 row)')

    console.log('[TEST] PASS')
    await cleanup(rfId, venueId, eventId)
    process.exit(0)
  } catch (err: any) {
    console.error('[TEST] EXCEPTION:', err)
    await cleanup(rfId, venueId, eventId)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[TEST] Fatal:', err)
  process.exit(1)
})
