/**
 * Feature B2 — per-market Rail Media cache (hub side).
 *
 * Locations POST their OWN Rail key (userId + apiKey) to /api/game-data/rail;
 * this caches the RESPONSE keyed by `${userId}:${days}:${today}` for 30 min and
 * fetches Rail on a miss using the caller-supplied key. The key is used
 * transiently to construct a per-request SportsGuideApi and is NEVER stored or
 * logged — only the response is cached. Same-market locations (same userId)
 * share one entry; every distinct market self-registers on first pull, so a new
 * location in a new market needs zero hub setup.
 *
 * Stampede guard: an in-flight Promise is set synchronously before the first
 * await, so concurrent pulls for the same key share one Rail fetch (JS is
 * single-threaded — the setup block runs to completion before any caller yields).
 */
import { SportsGuideApi, type SportsGuideResponse } from '@sports-bar/sports-apis'

const TTL_MS = 30 * 60 * 1000
const BASE_URL = process.env.SPORTS_GUIDE_API_URL || 'https://guide.thedailyrail.com/api/v1'

interface Entry {
  response: SportsGuideResponse
  fetchedAt: number
  inFlight: Promise<SportsGuideResponse> | null
}

const cache = new Map<string, Entry>()

const todayStr = () => new Date().toISOString().split('T')[0]

export async function getRailGuide(userId: string, apiKey: string, days: number): Promise<SportsGuideResponse> {
  const key = `${userId}:${days}:${todayStr()}`
  const hit = cache.get(key)
  if (hit) {
    if (hit.inFlight) return hit.inFlight // share the in-flight fetch
    if (Date.now() - hit.fetchedAt < TTL_MS) return hit.response // fresh
  }
  const entry: Entry = hit ?? { response: { listing_groups: [] }, fetchedAt: 0, inFlight: null }
  entry.inFlight = (async () => {
    try {
      const api = new SportsGuideApi({ apiKey, userId, baseUrl: BASE_URL })
      const response = await api.fetchDateRangeGuide(days)
      entry.response = response
      entry.fetchedAt = Date.now()
      return response
    } finally {
      entry.inFlight = null
    }
  })()
  cache.set(key, entry)
  return entry.inFlight
}

/** Debug counts — never exposes keys/secrets. */
export function railCacheStats() {
  return {
    markets: new Set([...cache.keys()].map((k) => k.split(':')[0])).size,
    entries: cache.size,
  }
}
