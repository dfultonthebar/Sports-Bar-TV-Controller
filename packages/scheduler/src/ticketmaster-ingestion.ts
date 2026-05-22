/**
 * Ticketmaster Discovery API ingestion (v2.53.1+, task #161)
 *
 * Second neighborhood-events source after Bananas. Pulls upcoming events
 * within radius from Ticketmaster, resolves venue (alias → exact → fuzzy),
 * auto-creates new venues with `review_status='pending_review'` so the
 * operator can curate. Idempotently upserts NeighborhoodEvent rows with
 * `source='ticketmaster'`.
 *
 * Downstream consumers (preemptive-strike scheduler, shift-brief blurb,
 * correlator, RF Pattern Digest) are source-agnostic — once rows land in
 * NeighborhoodEvent, they're picked up automatically.
 *
 * Idempotency key: `(source, source_event_id)` — see unique index on
 * NeighborhoodEvent. `source_event_id` is `tm-{ticketmaster_event_id}`
 * — Ticketmaster IDs are stable across re-fetches so re-running this
 * collapses to UPDATEs rather than duplicate inserts.
 */

import { db, schema, sql, eq, and } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import {
  fetchTicketmasterEvents,
  type TicketmasterParsedEvent,
} from '@sports-bar/sports-apis'

// Holmgren default — overridable via env. Same default as the SDR
// neighborhood scrape so the two stay in sync if the operator moves
// the reference point.
const DEFAULT_LATLONG = process.env.NEIGHBORHOOD_LATLONG || '44.5012,-88.0626'
// Outer `|| N` guards against parseInt('') === NaN when the env var is
// explicitly set to empty string. The inner default catches unset env.
const DEFAULT_RADIUS_MILES = parseInt(process.env.TICKETMASTER_RADIUS_MILES || '30', 10) || 30
const DEFAULT_LOOKAHEAD_DAYS = parseInt(process.env.TICKETMASTER_LOOKAHEAD_DAYS || '14', 10) || 14

export interface TicketmasterIngestionStats {
  fetched: number
  inserted: number
  updated: number
  skipped: number
  venuesCreated: number
}

// Import the canonical venue normalizer from bananas-ingestion. Pre-v2.53.1
// the TM scraper had its own version that ALSO stripped apostrophes — but
// Bananas keeps them, so cross-source alias matching silently failed on
// "Anduzzi's" / "Lucky's" etc. Now both sources use the same normalizer
// and the alias table actually deduplicates as intended.
import { normalizeVenueName as normalizeAlias } from './bananas-ingestion'

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8 // earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * Single Ticketmaster ingestion sweep.
 *
 * Per-event try/catch: one parse/insert failure does not abort the batch.
 * Stats returned for caller visibility; function does not throw on the
 * happy path.
 */
export async function runTicketmasterIngestion(): Promise<TicketmasterIngestionStats> {
  const t0 = Date.now()
  const stats: TicketmasterIngestionStats = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    venuesCreated: 0,
  }

  let events: TicketmasterParsedEvent[] = []
  try {
    events = await fetchTicketmasterEvents({
      latlong: DEFAULT_LATLONG,
      radiusMiles: DEFAULT_RADIUS_MILES,
      lookaheadDays: DEFAULT_LOOKAHEAD_DAYS,
    })
    stats.fetched = events.length
  } catch (err: any) {
    logger.error('[TM-INGEST] fetchTicketmasterEvents threw — aborting batch:', err)
    return stats
  }

  if (events.length === 0) {
    logger.info(
      `[TM-INGEST] No events to ingest — exiting (${Date.now() - t0}ms)`,
    )
    return stats
  }

  // Build venue + alias map in one pass for O(1) lookup. Neighborhoods are
  // small (~20-100 venues per location) so loading everything is cheap and
  // avoids an N+1 query on the inner loop.
  let venuesRows: { id: string; name: string }[] = []
  try {
    venuesRows = await db
      .select({ id: schema.neighborhoodVenues.id, name: schema.neighborhoodVenues.name })
      .from(schema.neighborhoodVenues)
      .all()
  } catch (err: any) {
    logger.error('[TM-INGEST] Failed to load venue lookup table:', err)
    return stats
  }

  const aliasMap = new Map<string, string>() // alias_normalized → venue_id
  try {
    const aliasRows = await db
      .select({
        aliasNormalized: schema.neighborhoodVenueAliases.aliasNormalized,
        venueId: schema.neighborhoodVenueAliases.venueId,
      })
      .from(schema.neighborhoodVenueAliases)
      .all()
    for (const a of aliasRows) {
      if (a.aliasNormalized && a.venueId) {
        aliasMap.set(a.aliasNormalized, a.venueId)
      }
    }
  } catch (err: any) {
    // Non-fatal: alias table may not exist on a pre-v2.51.3 box mid-rollout.
    logger.warn(`[TM-INGEST] alias table query failed (continuing): ${err?.message ?? err}`)
  }
  // Seed canonical venue names as aliases (in-memory only — DB row not
  // required; falls back to the venues list itself).
  for (const v of venuesRows) {
    const norm = normalizeAlias(v.name)
    if (!aliasMap.has(norm)) aliasMap.set(norm, v.id)
  }

  const [locLatStr, locLngStr] = DEFAULT_LATLONG.split(',')
  const locLat = parseFloat(locLatStr)
  const locLng = parseFloat(locLngStr)

  for (const ev of events) {
    try {
      // Resolve venue via alias-table / canonical-name normalized lookup.
      const aliasKey = normalizeAlias(ev.venueName)
      let venueId: string | null = aliasMap.get(aliasKey) ?? null

      if (venueId == null) {
        // Auto-create with pending_review — operator curates later via UI.
        // Unlike bananas-ingestion (which refuses to auto-create), the
        // Ticketmaster API gives us lat/lng + a structured venue name so
        // we can responsibly seed the row with real coordinates.
        const distance = haversineMiles(locLat, locLng, ev.venueLat, ev.venueLng)
        const newVenue = await db
          .insert(schema.neighborhoodVenues)
          .values({
            name: ev.venueName,
            category: ev.eventType === 'sports' ? 'stadium' : 'concert_hall',
            latitude: ev.venueLat,
            longitude: ev.venueLng,
            distanceMi: distance,
            isActive: true,
            reviewStatus: 'pending_review',
            discoverySource: 'ticketmaster',
            isSelf: false,
          })
          .returning({ id: schema.neighborhoodVenues.id })

        venueId = newVenue[0]?.id ?? null
        if (venueId == null) {
          stats.skipped++
          continue
        }
        // Populate the in-memory alias map BEFORE the alias DB insert.
        // If the alias INSERT fails (e.g., race vs a partial prior run
        // that left an alias row but no matching venue, hitting the
        // unique index on alias_normalized), we still want subsequent
        // events in this sweep that reference the same venue name to
        // resolve via aliasMap rather than spawn another duplicate
        // pending_review venue row.
        aliasMap.set(aliasKey, venueId)
        // Best-effort alias write — already-exists is fine, swallow the
        // unique-constraint error rather than failing the whole event.
        try {
          await db.insert(schema.neighborhoodVenueAliases).values({
            venueId,
            aliasText: ev.venueName,
            aliasNormalized: aliasKey,
            source: 'ticketmaster',
          })
        } catch (aliasErr: any) {
          logger.warn('[TM-INGEST] Alias insert failed (probably already present)', {
            data: { aliasKey, venueId, error: aliasErr?.message ?? String(aliasErr) },
          })
        }
        stats.venuesCreated++
        logger.info('[TM-INGEST] Auto-created venue (pending review)', {
          data: { name: ev.venueName, id: venueId, distanceMi: distance.toFixed(2) },
        })
      }

      // Upsert event. Idempotency key: (source='ticketmaster', source_event_id=tm-<id>).
      const existing = await db
        .select({ id: schema.neighborhoodEvents.id })
        .from(schema.neighborhoodEvents)
        .where(
          and(
            eq(schema.neighborhoodEvents.source, 'ticketmaster'),
            eq(schema.neighborhoodEvents.sourceEventId, ev.externalId),
          ),
        )
        .limit(1)
        .all()

      const artistNormalized = ev.artistName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')

      if (existing.length > 0) {
        // Update mutable fields — timing or naming could shift on re-pull.
        await db
          .update(schema.neighborhoodEvents)
          .set({
            artistName: ev.artistName,
            artistNormalized,
            startTime: ev.startTimeUnix,
            endTime: ev.endTimeUnix,
            eventType: ev.eventType,
            sourceUrl: ev.sourceUrl,
            rawPayload: JSON.stringify(ev.rawPayload),
          })
          .where(eq(schema.neighborhoodEvents.id, existing[0].id))
        stats.updated++
      } else {
        await db.insert(schema.neighborhoodEvents).values({
          venueId,
          artistName: ev.artistName,
          artistNormalized,
          startTime: ev.startTimeUnix,
          endTime: ev.endTimeUnix,
          eventType: ev.eventType,
          source: 'ticketmaster',
          sourceUrl: ev.sourceUrl,
          sourceEventId: ev.externalId,
          rawPayload: JSON.stringify(ev.rawPayload),
        })
        stats.inserted++
      }
    } catch (e: any) {
      logger.warn('[TM-INGEST] Per-event error', {
        data: {
          externalId: ev.externalId,
          name: ev.name,
          error: e?.message ?? String(e),
        },
      })
      stats.skipped++
    }
  }

  logger.info('[TM-INGEST] Ingestion complete', {
    data: { ...stats, durationMs: Date.now() - t0 },
  })
  return stats
}
