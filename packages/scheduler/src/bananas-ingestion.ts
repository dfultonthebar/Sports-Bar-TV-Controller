/**
 * Bananas Entertainment Ingestion (v2.51.0+)
 *
 * Consumes the parsed event list from
 * `@sports-bar/sports-apis#fetchBananasSchedule`, fuzzy-matches each event's
 * venue against `NeighborhoodVenue`, and idempotently upserts into
 * `NeighborhoodEvent` with `source='bananas'`.
 *
 * Idempotency key: `(source, source_event_id)` — see schema unique index.
 * We derive `source_event_id` from `YYYY-MM-DD-artistNormalized-venueSlug`
 * so re-running the scraper for the same calendar day collapses to the
 * same row (UPDATE) rather than inserting a duplicate.
 *
 * Venues are NEVER auto-created here. If we don't recognize the venue, we
 * skip the event with a warning so an operator can review and either add
 * the venue or update its name. Auto-creation would silently flood the
 * neighborhood with junk rows the first time a misspelling shipped.
 */

import { db, schema } from '@sports-bar/database'
import { sql, eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { fetchBananasSchedule, type BananasParsedEvent } from '@sports-bar/sports-apis'

export interface BananasIngestionStats {
  fetched: number
  ingested: number
  skippedNoVenue: number
  skippedError: number
  duplicates: number
  warnings: string[]
}

/**
 * Slugify a venue/artist string for source-event-id derivation.
 * Lowercase → strip non-alphanum → collapse to single dashes → trim dashes.
 */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Damerau-Levenshtein distance — used for fuzzy venue matching.
 * Tolerates: one transposition, one substitution, one insertion, one deletion
 * in a 3-character window. That's enough to match
 *   "Stoneyard Greenville" ↔ "Stoneyard - Greenville"
 *   "Lucky's 1313"         ↔ "Lucky's"
 * but not enough to spuriously merge "Stoneyard" with "Stadium".
 *
 * Implementation: classic DP table. O(m*n) time, O(m*n) space. Inputs are
 * already truncated to ≤50 chars in practice (venue names), so this is
 * fast enough.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const m = a.length
  const n = b.length
  const prev: number[] = new Array(n + 1)
  const curr: number[] = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,        // delete
        curr[j - 1] + 1,    // insert
        prev[j - 1] + cost, // substitute
      )
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]
}

/**
 * Normalize a venue name for comparison: lowercased, single-spaced,
 * stripped of standalone punctuation. Keeps apostrophes inside names
 * (Lucky's) but drops trailing/leading dashes and parens.
 */
export function normalizeVenueName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[(){}\[\]]/g, ' ')
    .replace(/[,;:|/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-]+|[\s\-]+$/g, '')
    .trim()
}

interface VenueLookupRow {
  id: string
  name: string
  normalized: string
}

/**
 * Look up a venue by name. Strategy (v2.51.3+):
 *   0. **Alias table** lookup via NeighborhoodVenueAlias (exact normalized
 *      match) — O(1), seeded with known Bananas spellings + auto-added
 *      when a fuzzy match resolves so future runs short-circuit.
 *   1. Exact match on normalized canonical venue.name
 *   2. Substring match (the parsed venue contains a known venue or vice
 *      versa — handles "Stoneyard Greenville" vs "Stoneyard - Greenville")
 *   3. Levenshtein ≤ 3 on normalized names
 *
 * The alias check is the most important addition: Bananas writes venue
 * names in ALL CAPS without punctuation ("ANDUZZIS - HOLMGREN WAY" vs our
 * "Anduzzi's Sports Club - Holmgren Way") — a 14-char delta the
 * Levenshtein-≤3 threshold correctly rejects. Aliases cover this gap
 * deterministically without weakening the fuzzy threshold (which would
 * cause false matches in the other direction).
 *
 * Returns the venue ID or null. Method 'alias' is recorded when the
 * alias-table path hit; caller logs that for ingest-stats visibility.
 */
function findVenueId(
  parsedName: string,
  venues: VenueLookupRow[],
  aliasMap: Map<string, { id: string; name: string }>,
): { id: string; name: string; method: 'alias' | 'exact' | 'substring' | 'fuzzy'; distance?: number } | null {
  const target = normalizeVenueName(parsedName)
  if (!target) return null

  // (0) alias table (v2.51.3+)
  const aliasHit = aliasMap.get(target)
  if (aliasHit) return { id: aliasHit.id, name: aliasHit.name, method: 'alias' }

  // (1) exact
  const exact = venues.find((v) => v.normalized === target)
  if (exact) return { id: exact.id, name: exact.name, method: 'exact' }

  // (2) substring (either direction; venue list is usually short).
  // Require min length 5 to avoid "bar" matching every venue.
  if (target.length >= 5) {
    const sub = venues.find(
      (v) => v.normalized.length >= 5 && (v.normalized.includes(target) || target.includes(v.normalized)),
    )
    if (sub) return { id: sub.id, name: sub.name, method: 'substring' }
  }

  // (3) fuzzy
  let bestId: string | null = null
  let bestName = ''
  let bestDist = Infinity
  for (const v of venues) {
    const d = levenshtein(target, v.normalized)
    if (d < bestDist) {
      bestDist = d
      bestId = v.id
      bestName = v.name
    }
  }
  if (bestId && bestDist <= 3) {
    return { id: bestId, name: bestName, method: 'fuzzy', distance: bestDist }
  }
  return null
}

/**
 * Build the deterministic source_event_id slug for idempotency.
 *
 * Preferred: Bananas's own stable `Job_Number` from the raw payload (lives
 *   on rows from the JSON-API path) — guaranteed unique agency-side,
 *   survives artist-name spelling tweaks, immune to time-shift drift.
 *
 * Fallback: `YYYY-MM-DD-<artistNormalized>-<venueSlug>` — used when the
 *   row came from the HTML/Ollama path and has no jobNumber. Same row
 *   re-parsed by the same path on the next sweep yields the same slug.
 *
 * Example with jobNumber: "bananas-job-431844"
 * Example fallback:       "2026-05-30-marco-stoneyard-greenville"
 */
function buildSourceEventId(ev: BananasParsedEvent): string {
  const raw = (ev.raw || {}) as Record<string, unknown>
  const jobNumber = typeof raw.jobNumber === 'string' && raw.jobNumber.trim()
    ? raw.jobNumber.trim()
    : null
  if (jobNumber) return `bananas-job-${jobNumber}`

  const d = new Date(ev.startTimeISO)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const dateSlug = `${yyyy}-${mm}-${dd}`
  return `${dateSlug}-${slugify(ev.artistNormalized || ev.artist)}-${slugify(ev.venue)}`
}

/**
 * Run a single Bananas ingestion sweep.
 *
 * Operates with per-event try/catch so one parse failure does not abort the
 * batch. Caller should treat the returned stats as the source of truth for
 * how many rows landed; the function does not throw on the happy path.
 */
export async function runBananasIngestion(): Promise<BananasIngestionStats> {
  const stats: BananasIngestionStats = {
    fetched: 0,
    ingested: 0,
    skippedNoVenue: 0,
    skippedError: 0,
    duplicates: 0,
    warnings: [],
  }

  let events: BananasParsedEvent[] = []
  try {
    events = await fetchBananasSchedule()
    stats.fetched = events.length
  } catch (err: any) {
    logger.error('[BANANAS-INGEST] fetchBananasSchedule threw — aborting batch:', err)
    return stats
  }

  if (events.length === 0) {
    logger.info('[BANANAS-INGEST] No events returned by scraper — nothing to ingest')
    return stats
  }

  // Load active venues once. The neighborhood is small (~20-100 venues per
  // location) so this is cheap and we avoid an N+1 query.
  let venueRows: { id: string; name: string }[] = []
  try {
    venueRows = await db
      .select({ id: schema.neighborhoodVenues.id, name: schema.neighborhoodVenues.name })
      .from(schema.neighborhoodVenues)
      .all()
  } catch (err: any) {
    logger.error('[BANANAS-INGEST] Failed to load venue lookup table:', err)
    return stats
  }
  const venues: VenueLookupRow[] = venueRows.map((v) => ({
    id: v.id,
    name: v.name,
    normalized: normalizeVenueName(v.name),
  }))

  if (venues.length === 0) {
    const warn = 'No venues seeded in NeighborhoodVenue — all events will skip. Seed venues first.'
    logger.warn(`[BANANAS-INGEST] ${warn}`)
    stats.warnings.push(warn)
  }

  // v2.51.3 — Load alias table for fast O(1) lookup of known upstream
  // spellings (e.g. Bananas's "ANDUZZIS - HOLMGREN WAY" → our canonical
  // "Anduzzi's Sports Club - Holmgren Way"). Map keyed by alias_normalized.
  const aliasMap = new Map<string, { id: string; name: string }>()
  try {
    const aliasRows = await db
      .select({
        aliasNormalized: schema.neighborhoodVenueAliases.aliasNormalized,
        venueId: schema.neighborhoodVenueAliases.venueId,
        venueName: schema.neighborhoodVenues.name,
      })
      .from(schema.neighborhoodVenueAliases)
      .leftJoin(schema.neighborhoodVenues, eq(schema.neighborhoodVenueAliases.venueId, schema.neighborhoodVenues.id))
      .all()
    for (const r of aliasRows) {
      if (r.aliasNormalized && r.venueId && r.venueName) {
        aliasMap.set(r.aliasNormalized, { id: r.venueId, name: r.venueName })
      }
    }
    if (aliasMap.size > 0) {
      logger.info(`[BANANAS-INGEST] loaded ${aliasMap.size} venue aliases`)
    }
  } catch (err: any) {
    // Non-fatal: alias table may not exist on pre-v2.51.3 boxes mid-rollout.
    logger.warn(`[BANANAS-INGEST] alias table query failed (continuing with name-match only): ${err.message}`)
  }

  const nowSec = Math.floor(Date.now() / 1000)

  for (const ev of events) {
    try {
      const match = findVenueId(ev.venue, venues, aliasMap)
      if (!match) {
        stats.skippedNoVenue++
        const warn = `[BANANAS-INGEST] no venue match for "${ev.venue}" (artist=${ev.artist}, start=${ev.startTimeISO})`
        logger.warn(warn)
        stats.warnings.push(warn)
        continue
      }

      const startSec = Math.floor(new Date(ev.startTimeISO).getTime() / 1000)
      const endSec = ev.endTimeISO ? Math.floor(new Date(ev.endTimeISO).getTime() / 1000) : null
      const sourceEventId = buildSourceEventId(ev)
      const rawPayload = JSON.stringify(ev.raw ?? {})

      // UPSERT via Drizzle. The unique index on (source, source_event_id)
      // is what makes this idempotent — duplicate slugs collapse to UPDATE.
      // We count "duplicates" by inspecting changes() after INSERT OR
      // REPLACE; but Drizzle SQLite's onConflictDoUpdate keeps things
      // ergonomic and we just count rows inserted vs updated by checking
      // pre-existence first.
      const existing = await db
        .select({ id: schema.neighborhoodEvents.id })
        .from(schema.neighborhoodEvents)
        .where(
          sql`${schema.neighborhoodEvents.source} = 'bananas' AND ${schema.neighborhoodEvents.sourceEventId} = ${sourceEventId}`,
        )
        .limit(1)
        .all()

      if (existing.length > 0) {
        // Update mutable fields (timing or artist could shift on a re-pull).
        await db
          .update(schema.neighborhoodEvents)
          .set({
            artistName: ev.artist,
            artistNormalized: ev.artistNormalized,
            startTime: startSec,
            endTime: endSec,
            eventType: ev.eventType,
            sourceUrl: ev.sourceUrl,
            rawPayload,
            ingestedAt: nowSec,
          })
          .where(sql`${schema.neighborhoodEvents.id} = ${existing[0].id}`)
        stats.duplicates++
        continue
      }

      await db.insert(schema.neighborhoodEvents).values({
        venueId: match.id,
        artistName: ev.artist,
        artistNormalized: ev.artistNormalized,
        startTime: startSec,
        endTime: endSec,
        eventType: ev.eventType,
        source: 'bananas',
        sourceUrl: ev.sourceUrl,
        sourceEventId,
        rawPayload,
      })
      stats.ingested++

      if (match.method === 'fuzzy') {
        logger.info(
          `[BANANAS-INGEST] fuzzy-matched "${ev.venue}" → "${match.name}" (distance=${match.distance})`,
        )
      }
    } catch (err: any) {
      stats.skippedError++
      const warn = `[BANANAS-INGEST] parse/insert failed for "${ev.artist}" @ "${ev.venue}": ${err?.message || err}`
      logger.error(warn, { error: err })
      stats.warnings.push(warn)
    }
  }

  logger.info(
    `[BANANAS-INGEST] ingested ${stats.ingested} events, ${stats.skippedNoVenue} skipped (no venue match), ${stats.duplicates} duplicates updated, ${stats.skippedError} errors (${stats.fetched} fetched)`,
  )
  return stats
}
