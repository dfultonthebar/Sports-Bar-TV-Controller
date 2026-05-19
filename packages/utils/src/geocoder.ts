/**
 * Geocoder — convert a street address to lat/long via OSM Nominatim API.
 *
 * v2.51.2+ — used to populate Location.latitude/longitude when an
 * operator saves an address via the System Admin UI, so the neighborhood
 * RF prediction pipeline (Overpass venue auto-discovery) doesn't need
 * the operator to look up lat/lon manually.
 *
 * Why Nominatim:
 *   - Free, no API key, no billing setup
 *   - Same OSM project that powers our Overpass venue search
 *   - Rate-limited to 1 req/sec for free tier — fine for our use case
 *     (geocoded once per address change, not per request)
 *
 * Alternatives if Nominatim becomes flaky for a specific operator:
 *   - Google Geocoding API ($5/1000 calls, $200/mo free tier)
 *   - LocationIQ (free 5k req/day)
 *   - Add GOOGLE_GEOCODING_API_KEY env var + fallback chain later
 */

import { logger } from '@sports-bar/logger'

export interface GeocodeInput {
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  country?: string | null
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  displayName: string                 // Nominatim's canonical address string for verification
  confidence: number                  // 0-1, based on Nominatim's "importance" score
  raw: any                            // full Nominatim response — useful for debugging
}

/**
 * Geocode a structured address to lat/long.
 *
 * Returns null if Nominatim returns no results OR if the network call
 * fails. Caller should check the return + log appropriately.
 *
 * NEVER throws — geocoding failures shouldn't break the calling
 * workflow (e.g. saving a Location with a typo'd zip should still
 * save the row; lat/long just stays null).
 */
export async function geocodeAddress(input: GeocodeInput): Promise<GeocodeResult | null> {
  const parts = [input.address, input.city, input.state, input.zipCode, input.country ?? 'USA'].filter(Boolean) as string[]
  if (parts.length < 2) {
    logger.warn('[GEOCODER] insufficient address fields', { data: { input } })
    return null
  }
  const q = parts.join(', ')
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1`
  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim's usage policy REQUIRES a UA + contact identifier
        'User-Agent': 'sports-bar-tv-controller/2.51.2 (github.com/dfultonthebar/Sports-Bar-TV-Controller)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      logger.warn('[GEOCODER] Nominatim returned non-200', { data: { status: res.status, q } })
      return null
    }
    const body: any[] = await res.json()
    if (!Array.isArray(body) || body.length === 0) {
      logger.warn('[GEOCODER] Nominatim returned no results', { data: { q } })
      return null
    }
    const hit = body[0]
    const lat = parseFloat(hit.lat)
    const lon = parseFloat(hit.lon)
    if (isNaN(lat) || isNaN(lon)) {
      logger.warn('[GEOCODER] Nominatim returned non-numeric lat/lon', { data: { hit } })
      return null
    }
    return {
      latitude: lat,
      longitude: lon,
      displayName: String(hit.display_name ?? q),
      confidence: parseFloat(hit.importance ?? '0.5'),
      raw: hit,
    }
  } catch (e: any) {
    logger.warn('[GEOCODER] fetch failed', { data: { error: e.message, q } })
    return null
  }
}

/**
 * Geocode + write back to the Location row. Idempotent — if lastGeocodedAt
 * is recent AND the address hasn't changed, skips the API call.
 *
 * Caller should pass an `address-changed` flag if the operator just
 * updated address/city/state/zip — that forces a re-geocode regardless
 * of staleness.
 */
export async function geocodeAndPersist(opts: {
  db: any                              // drizzle db instance
  schema: any                          // drizzle schema
  locationId: string
  forceRegeocode?: boolean
  maxAgeDays?: number                  // default 30 — re-geocode if older than this
}): Promise<{ latitude: number; longitude: number } | null> {
  const { db, schema, locationId, forceRegeocode = false, maxAgeDays = 30 } = opts
  const { eq } = await import('drizzle-orm')

  const rows = await db.select().from(schema.locations).where(eq(schema.locations.id, locationId)).limit(1)
  if (rows.length === 0) {
    logger.warn('[GEOCODER] location not found', { data: { locationId } })
    return null
  }
  const row = rows[0]

  // Skip if recent + already populated + caller didn't force.
  if (!forceRegeocode && row.latitude !== null && row.longitude !== null && row.lastGeocodedAt) {
    const ageMs = Date.now() - new Date(row.lastGeocodedAt).getTime()
    if (ageMs < maxAgeDays * 86_400_000) {
      return { latitude: row.latitude, longitude: row.longitude }
    }
  }

  const result = await geocodeAddress({
    address: row.address,
    city: row.city,
    state: row.state,
    zipCode: row.zipCode,
  })
  if (!result) return null

  await db.update(schema.locations)
    .set({
      latitude: result.latitude,
      longitude: result.longitude,
      lastGeocodedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.locations.id, locationId))

  logger.info(`[GEOCODER] geocoded "${row.name}" to (${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}) via "${result.displayName}"`)

  return { latitude: result.latitude, longitude: result.longitude }
}
