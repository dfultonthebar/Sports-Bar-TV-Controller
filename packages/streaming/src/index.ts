/**
 * @sports-bar/streaming - Streaming apps database and API integrations
 *
 * Core functionality for streaming service management:
 * - Streaming apps database (package names, capabilities, deep links)
 * - ESPN API integration
 * - MLB Stats API integration
 * - NFHS Network API integration
 */

// Streaming apps database
export {
  type StreamingApp,
  STREAMING_APPS_DATABASE,
  getStreamingAppById,
  getStreamingAppsByCategory,
  getAppsWithPublicApi,
  getStreamingAppsBySport,
  searchStreamingApps,
  getPackageNameByAppId
} from './streaming-apps-database'

// ESPN API
export {
  espnApi,
  isESPNApiAvailable,
  type ESPNEvent,
  type ESPNScoreboard
} from './api-integrations/espn-api'

// MLB API
export {
  mlbApi,
  isMLBApiAvailable,
  type MLBGame,
  type MLBTeam,
  type MLBSchedule
} from './api-integrations/mlb-api'

// NFHS API
export {
  nfhsApi,
  isNFHSApiAvailable,
  type NFHSEvent
} from './api-integrations/nfhs-api'

// Unified Streaming API
export {
  UnifiedStreamingAPI,
  unifiedStreamingApi,
  type UnifiedEvent,
  type ServiceStatus,
  type FireTVAdapter,
  type InstalledStreamingApp
} from './unified-streaming-api'
