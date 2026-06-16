/**
 * Feature B2 (location side) — pull this location's Rail guide via the hub.
 *
 * Sends THIS location's own SPORTS_GUIDE_USER_ID + SPORTS_GUIDE_API_KEY to the
 * hub, which caches per-market. Returns the SportsGuideResponse, or `null` on any
 * failure (caller then falls back to a direct Rail fetch — today's behavior).
 * Activated only when RAIL_HUB_ENABLED=true.
 */
import { logger } from '@sports-bar/logger'
import type { SportsGuideResponse } from '@sports-bar/sports-apis'

const HUB_GAME_URL = process.env.HUB_GAME_URL || 'http://100.124.165.26:3010'

export async function fetchRailViaHub(days: number): Promise<SportsGuideResponse | null> {
  const userId = process.env.SPORTS_GUIDE_USER_ID
  const apiKey = process.env.SPORTS_GUIDE_API_KEY
  if (!userId || !apiKey) {
    logger.warn('[HUB-RAIL-PULL] no SPORTS_GUIDE_USER_ID/API_KEY set; using direct Rail')
    return null
  }
  try {
    const res = await fetch(`${HUB_GAME_URL}/api/game-data/rail`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, apiKey, days }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      logger.warn(`[HUB-RAIL-PULL] hub returned ${res.status}; using direct Rail`)
      return null
    }
    const data = (await res.json()) as { ok?: boolean; guide?: SportsGuideResponse }
    if (!data?.ok || !Array.isArray(data.guide?.listing_groups)) {
      logger.warn('[HUB-RAIL-PULL] malformed hub response; using direct Rail')
      return null
    }
    return data.guide!
  } catch (err) {
    logger.warn(`[HUB-RAIL-PULL] hub unreachable (${(err as Error)?.message ?? err}); using direct Rail`)
    return null
  }
}
