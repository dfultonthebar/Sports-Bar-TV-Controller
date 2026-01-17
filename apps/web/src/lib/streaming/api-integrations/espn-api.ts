/**
 * ESPN API Bridge - Re-exports from @sports-bar/streaming
 *
 * Note: ESPNTeam and ESPNCompetitor are not exported by @sports-bar/streaming.
 * The streaming package exports ESPNEvent and ESPNScoreboard only.
 * For detailed game types, use ESPNGame from @sports-bar/sports-apis.
 */
export {
  espnApi,
  isESPNApiAvailable,
  type ESPNEvent,
  type ESPNScoreboard
} from '@sports-bar/streaming'

// Local type aliases for compatibility (these match the ESPNEvent.competitions[].competitors structure)
export interface ESPNTeam {
  id: string
  name: string
  abbreviation: string
  displayName: string
  logo?: string
}

export interface ESPNCompetitor {
  id: string
  type: 'team' | 'athlete'
  homeAway: 'home' | 'away'
  team: ESPNTeam
  score?: string
}
