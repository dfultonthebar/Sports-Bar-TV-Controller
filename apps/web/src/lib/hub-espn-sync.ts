/**
 * Feature B1 (location side) — pull the central ESPN game cache from the hub.
 *
 * Returns the per-league raw games, or `null` if the hub is unreachable/malformed
 * (the caller then falls back to the local ESPN sync — today's behavior). No auth:
 * read-only non-PII game schedules, hub is tailnet-only. Activated only when
 * ESPN_HUB_ENABLED=true; otherwise this is never called.
 */
import { logger } from '@sports-bar/logger'

const HUB_GAME_URL = process.env.HUB_GAME_URL || 'http://100.124.165.26:3010'

export interface HubLeagueGames {
  sport: string
  league: string
  games: any[]
  gameCount: number
  updatedAt: number
}

export async function pullEspnFromHub(): Promise<HubLeagueGames[] | null> {
  try {
    const res = await fetch(`${HUB_GAME_URL}/api/game-data/espn`, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      logger.warn(`[HUB-ESPN-PULL] hub returned ${res.status}; using local ESPN sync`)
      return null
    }
    const data = (await res.json()) as { ok?: boolean; leagues?: HubLeagueGames[] }
    if (!data?.ok || !Array.isArray(data.leagues)) {
      logger.warn('[HUB-ESPN-PULL] hub response malformed; using local ESPN sync')
      return null
    }
    return data.leagues
  } catch (err) {
    logger.warn(`[HUB-ESPN-PULL] hub unreachable (${(err as Error)?.message ?? err}); using local ESPN sync`)
    return null
  }
}
