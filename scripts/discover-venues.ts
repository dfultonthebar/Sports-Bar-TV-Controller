#!/usr/bin/env npx tsx
/**
 * discover-venues.ts — auto-discover NeighborhoodVenue candidates near
 * a fleet location using OpenStreetMap (Overpass API) + Ollama post-filter.
 *
 * v2.51.1+ — replaces hand-curated venue research for each new location.
 *
 * Usage:
 *   npx tsx scripts/discover-venues.ts --lat 44.5012 --lon -88.0626 --radius-mi 2
 *   npx tsx scripts/discover-venues.ts --location-id <UUID>  # reads lat/lon from Location row
 *   npx tsx scripts/discover-venues.ts --dry-run             # query only, don't write DB
 *
 * Workflow:
 *   1. Query Overpass API for amenity=(bar|pub|nightclub|restaurant)
 *      + leisure=stadium + tourism=concert_hall within radius
 *   2. For each candidate, ask Ollama llama3.1:8b: "Does this place
 *      book live entertainment? Yes/Maybe/No + confidence 0–1"
 *   3. INSERT rows with review_status='pending_review',
 *      discovery_source='overpass_osm', osm_tags=<JSON>,
 *      booking_confidence=<Ollama-assigned>.
 *   4. Operator reviews via admin UI → flips status to 'approved'.
 *
 * Idempotent on (name, category) unique index — re-running won't dup.
 * Rows previously declined (review_status='declined') don't re-appear
 * because the WHERE clause excludes them on subsequent runs.
 *
 * Cost: $0 (Overpass is free, Ollama is local).
 */

import { db, schema } from '@sports-bar/database'
import { eq, and } from 'drizzle-orm'

interface Args {
  lat?: number
  lon?: number
  radiusMi?: number
  locationId?: string
  dryRun?: boolean
}

function parseArgs(): Args {
  const args: Args = {}
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]
    const next = process.argv[i + 1]
    if (a === '--lat') { args.lat = parseFloat(next); i++ }
    else if (a === '--lon') { args.lon = parseFloat(next); i++ }
    else if (a === '--radius-mi') { args.radiusMi = parseFloat(next); i++ }
    else if (a === '--location-id') { args.locationId = next; i++ }
    else if (a === '--dry-run') { args.dryRun = true }
  }
  return args
}

// Haversine — miles between two lat/long points.
function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

// Query Overpass for amenity/leisure/tourism candidates within radius.
// Uses around:<radius_meters>,lat,lon syntax. Returns parsed elements.
async function queryOverpass(lat: number, lon: number, radiusMi: number): Promise<OverpassElement[]> {
  const radiusM = Math.round(radiusMi * 1609.344) // miles → meters
  // Overpass QL — query for nodes + ways + relations matching any of our
  // venue-candidate tag sets. Use `[out:json]` for JSON response.
  const query = `
    [out:json][timeout:25];
    (
      nwr["amenity"="bar"](around:${radiusM},${lat},${lon});
      nwr["amenity"="pub"](around:${radiusM},${lat},${lon});
      nwr["amenity"="nightclub"](around:${radiusM},${lat},${lon});
      nwr["amenity"="restaurant"](around:${radiusM},${lat},${lon});
      nwr["amenity"="fast_food"](around:${radiusM},${lat},${lon});
      nwr["leisure"="stadium"](around:${radiusM},${lat},${lon});
      nwr["leisure"="amusement_arcade"](around:${radiusM},${lat},${lon});
      nwr["tourism"="hotel"](around:${radiusM},${lat},${lon});
      nwr["amenity"="theatre"](around:${radiusM},${lat},${lon});
      nwr["amenity"="events_venue"](around:${radiusM},${lat},${lon});
      nwr["amenity"="community_centre"](around:${radiusM},${lat},${lon});
    );
    out center;
  `
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '*/*',
      'User-Agent': 'sports-bar-tv-controller/2.51.1 (https://github.com/dfultonthebar/Sports-Bar-TV-Controller)',
    },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${await res.text()}`)
  const json: OverpassResponse = await res.json()
  return json.elements
}

// Ollama post-filter: does this place book live entertainment (bands/DJs)?
// Returns confidence 0.0–1.0 plus a YES/MAYBE/NO label.
async function ollamaFilter(name: string, address: string, tags: Record<string, string>): Promise<{ likely: 'yes' | 'maybe' | 'no'; confidence: number; reason: string }> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
  const tagStr = Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(', ')
  const prompt = `You are evaluating whether a venue books live entertainment (bands, DJs, comedy, karaoke, weddings with DJs, etc.) — events that would deploy wireless microphones or PA systems.

Venue name: ${name}
Address: ${address}
OSM tags: ${tagStr}

Respond with exactly one of: YES, MAYBE, NO — followed by a confidence 0-1 and a short reason.

Rules:
- Stadiums, concert halls, amphitheaters, theaters → YES with high confidence
- Bars/pubs/nightclubs in a metropolitan area → YES or MAYBE (most book DJs occasionally)
- Fast food, gas stations, drive-thrus, coffee shops → NO
- Restaurants → MAYBE unless tagged with live_music=yes (then YES)
- Hotels → MAYBE (banquet halls book weddings/DJs)
- Stand-alone retail stores, pharmacies, dry cleaners → NO
- Community centers → MAYBE (book events)

Output format (one line): VERDICT|CONFIDENCE|REASON
Example: YES|0.85|Outdoor amphitheater with regular concert bookings`

  try {
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.1:8b', prompt, stream: false, keep_alive: -1 }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)
    const json: { response: string } = await res.json()
    const line = json.response.trim().split('\n')[0]
    const parts = line.split('|').map((s) => s.trim())
    const verdict = parts[0].toUpperCase()
    const confRaw = parseFloat(parts[1] || '0.5')
    const reason = parts[2] || '(no reason given)'
    const likely = verdict.startsWith('Y') ? 'yes' : verdict.startsWith('M') ? 'maybe' : 'no'
    const confidence = isNaN(confRaw) ? 0.5 : Math.max(0, Math.min(1, confRaw))
    return { likely, confidence, reason }
  } catch (e) {
    // On Ollama failure, fall back to a tag-only heuristic so the
    // discovery still works without the LLM enrichment.
    const isStadium = tags.leisure === 'stadium'
    const isConcertHall = tags.amenity === 'theatre' || tags.tourism === 'concert_hall'
    const isLiveMusic = tags.live_music === 'yes'
    const isBar = ['bar', 'pub', 'nightclub'].includes(tags.amenity || '')
    if (isStadium || isConcertHall || isLiveMusic) return { likely: 'yes', confidence: 0.9, reason: '(LLM unavailable; tag-only heuristic)' }
    if (isBar) return { likely: 'maybe', confidence: 0.6, reason: '(LLM unavailable; tag-only heuristic)' }
    return { likely: 'maybe', confidence: 0.3, reason: '(LLM unavailable; tag-only heuristic, unclear venue type)' }
  }
}

function deriveCategory(tags: Record<string, string>): string {
  if (tags.leisure === 'stadium') return 'stadium'
  if (tags.amenity === 'theatre' || tags.tourism === 'concert_hall' || tags.amenity === 'events_venue') return 'concert_hall'
  if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') return 'restaurant'
  if (tags.tourism === 'hotel') return 'restaurant' // hotels go in restaurant bucket since they book banquet events
  if (['bar', 'pub', 'nightclub'].includes(tags.amenity || '')) return 'bar'
  return 'other'
}

async function main() {
  const args = parseArgs()

  let lat = args.lat
  let lon = args.lon
  let locationId = args.locationId

  // If --location-id given, read lat/lon from Location row (TODO: requires
  // Location row to have lat/long — current schema doesn't. For now, --lat
  // and --lon are required. v2.51.2 add Location.latitude/longitude.)
  if (locationId && (lat === undefined || lon === undefined)) {
    console.error('[discover-venues] --location-id read of lat/lon not implemented yet (Location table needs lat/lon columns). Pass --lat and --lon explicitly.')
    process.exit(2)
  }

  if (lat === undefined || lon === undefined) {
    console.error('[discover-venues] need --lat and --lon (and --radius-mi, default 2)')
    process.exit(2)
  }
  const radiusMi = args.radiusMi ?? 2

  console.log(`[discover-venues] center=(${lat}, ${lon}), radius=${radiusMi} mi`)
  console.log(`[discover-venues] querying Overpass API...`)
  let elements: OverpassElement[]
  try {
    elements = await queryOverpass(lat, lon, radiusMi)
  } catch (e) {
    console.error(`[discover-venues] Overpass query failed:`, e)
    process.exit(1)
  }

  // De-dup by name (Overpass returns multiple types — node + way + relation
  // for the same logical place sometimes).
  const seen = new Set<string>()
  const candidates: { name: string; tags: Record<string, string>; lat: number; lon: number }[] = []
  for (const el of elements) {
    const name = el.tags?.name?.trim()
    if (!name) continue
    if (seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const c = el.center
    const elat = el.lat ?? c?.lat
    const elon = el.lon ?? c?.lon
    if (elat === undefined || elon === undefined) continue
    candidates.push({ name, tags: el.tags!, lat: elat, lon: elon })
  }

  console.log(`[discover-venues] Overpass returned ${elements.length} elements, ${candidates.length} unique named venues`)

  // Filter with Ollama, write to DB.
  let written = 0
  let skipped = 0
  let updated = 0
  const nowEpoch = Math.floor(Date.now() / 1000)

  for (const c of candidates) {
    const address = [c.tags['addr:housenumber'], c.tags['addr:street'], c.tags['addr:city']].filter(Boolean).join(' ') || '(no address in OSM)'
    const distMi = haversineMi(lat, lon, c.lat, c.lon)
    const { likely, confidence, reason } = await ollamaFilter(c.name, address, c.tags)

    if (likely === 'no') {
      console.log(`  ✗ ${c.name} — NO (${confidence.toFixed(2)}): ${reason}`)
      skipped++
      continue
    }

    const category = deriveCategory(c.tags)
    console.log(`  ${likely === 'yes' ? '✓' : '?'} ${c.name} [${category}, ${distMi.toFixed(2)} mi] — ${likely.toUpperCase()} (${confidence.toFixed(2)}): ${reason}`)

    if (args.dryRun) continue

    // Check if already exists by (name, category)
    const existing = await db.select().from(schema.neighborhoodVenues)
      .where(and(eq(schema.neighborhoodVenues.name, c.name), eq(schema.neighborhoodVenues.category, category)))
      .limit(1)

    if (existing.length > 0) {
      // Update OSM tags + booking confidence if higher; preserve review status
      const row = existing[0]
      if (row.reviewStatus === 'declined') {
        console.log(`     (was previously declined — leaving as-is)`)
        skipped++
        continue
      }
      await db.update(schema.neighborhoodVenues)
        .set({
          osmTags: JSON.stringify(c.tags),
          bookingConfidence: Math.max(row.bookingConfidence ?? 0, confidence),
          discoverySource: row.discoverySource === 'manual' ? 'manual' : 'overpass_osm',
          updatedAt: nowEpoch,
        })
        .where(eq(schema.neighborhoodVenues.id, row.id))
      updated++
    } else {
      await db.insert(schema.neighborhoodVenues).values({
        name: c.name,
        category,
        latitude: c.lat,
        longitude: c.lon,
        distanceMi: distMi,
        reviewStatus: 'pending_review',
        discoverySource: 'overpass_osm',
        osmTags: JSON.stringify(c.tags),
        bookingConfidence: confidence,
        notes: `Auto-discovered via Overpass+Ollama 2026-${new Date().toISOString().slice(5, 10)}. ${reason}`,
        isActive: false, // pending_review starts inactive — operator approves first
        createdAt: nowEpoch,
        updatedAt: nowEpoch,
      })
      written++
    }
  }

  console.log(`\n[discover-venues] SUMMARY: ${written} new, ${updated} updated, ${skipped} skipped (NO or declined)`)
  console.log(`[discover-venues] Review pending_review rows in admin UI to approve.`)
  if (args.dryRun) console.log(`[discover-venues] DRY RUN — no DB writes.`)
}

main().catch((e) => { console.error('[discover-venues] FATAL:', e); process.exit(1) })
