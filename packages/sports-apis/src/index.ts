/**
 * @sports-bar/sports-apis
 *
 * Sports API integrations for Sports Bar TV Controller
 * Provides unified access to ESPN, TheSportsDB, and NFL Sunday Ticket data
 */

// ESPN API
export { espnAPI, type ESPNGame, type ESPNScheduleResponse } from './espn-api'

// ESPN Scoreboard API
export { espnScoreboardAPI, type ESPNGame as ESPNScoreboardGame } from './espn-scoreboard-api'

// ESPN Teams API
export { espnTeamsAPI, type ESPNTeam, type ESPNLeague } from './espn-teams-api'

// TheSportsDB API
export { sportsDBAPI, type SportsDBTeam, type SportsDBEvent, type SportsDBLeague } from './thesportsdb-api'

// NFL Sunday Ticket Service
export { nflSundayTicketService, type SundayTicketGame } from './nfl-sunday-ticket'

// Live Sports Service (combined)
export { liveSportsService, type UnifiedGame, type ChannelMapping, type ChannelLookupFn } from './live-sports-service'

// Enhanced Live Sports Service
export { enhancedLiveSportsService, type EnhancedUnifiedGame, type EnhancedSportsDataResponse } from './enhanced-live-sports-service'

// Sports Guide API (The Rail Media)
export {
  SportsGuideApi,
  SportsGuideApiError,
  createSportsGuideApiFromEnv,
  getSportsGuideApi,
  type SportsGuideListing,
  type SportsGuideListingGroup,
  type SportsGuideResponse,
  type SportsGuideApiConfig
} from './sports-guide-api'

// Bananas Entertainment Scraper (v2.51.0 Neighborhood RF Prediction)
export {
  fetchBananasSchedule,
  normalizeArtistName,
  type BananasParsedEvent
} from './bananas-scraper'

// Ticketmaster Discovery API Scraper (v2.53.1+ Neighborhood RF Prediction, task #161)
export {
  fetchTicketmasterEvents,
  type TicketmasterParsedEvent,
  type TicketmasterFetchOptions
} from './ticketmaster-scraper'
