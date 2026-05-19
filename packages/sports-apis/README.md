# @sports-bar/sports-apis

**Purpose:** Unified clients for external sports-data sources — ESPN (schedule + scoreboard + teams), TheSportsDB, NFL Sunday Ticket, and The Rail Media's Sports Guide API. All wrapped in circuit-breakers + rate-limit throttlers for resilience.

**Key exports** (`src/index.ts`):
- `espnAPI`, `ESPNGame`, `ESPNScheduleResponse` (`src/espn-api.ts`)
- `espnScoreboardAPI`, `ESPNGame` as `ESPNScoreboardGame` (`src/espn-scoreboard-api.ts`)
- `espnTeamsAPI`, `ESPNTeam`, `ESPNLeague` (`src/espn-teams-api.ts`)
- `sportsDBAPI`, `SportsDBTeam`, `SportsDBEvent`, `SportsDBLeague` (`src/thesportsdb-api.ts`)
- `nflSundayTicketService`, `SundayTicketGame` (`src/nfl-sunday-ticket.ts`)
- `liveSportsService`, `UnifiedGame`, `ChannelMapping`, `ChannelLookupFn` (`src/live-sports-service.ts`)
- `enhancedLiveSportsService`, `EnhancedUnifiedGame`, `EnhancedSportsDataResponse` (`src/enhanced-live-sports-service.ts`)
- `SportsGuideApi`, `SportsGuideApiError`, `createSportsGuideApiFromEnv`, `getSportsGuideApi` — The Rail Media client (`src/sports-guide-api.ts`)

**Protocol / port:** HTTPS to public ESPN, TheSportsDB, Sunday Ticket, and Rail Media endpoints. No fixed ports — uses platform HTTP.

**Used by:** `@sports-bar/scheduler` (ESPN sync, schedule sync); `apps/web` channel-guide + sports-guide-admin routes.

**Gotchas:**
- All clients use `@sports-bar/circuit-breaker` + `@sports-bar/rate-limiting` throttlers (`espnThrottler`, `sportsDBThrottler`) — don't bypass.
- `@sports-bar/cache-manager` caches responses — invalidate carefully when debugging "stale data" issues.
- ESPN game payloads have a specific broadcast-network field; CLAUDE.md §9 + §9a document the mapping to local channel numbers. Capture the **exact** ESPN network string when adding new mappings.
- Rail Media credentials live in `.env` — see `createSportsGuideApiFromEnv`.

**See also:**
- CLAUDE.md §9 (AI Scheduling Intelligence) and §9a (Live Channel Mapping)
- `@sports-bar/circuit-breaker`, `@sports-bar/rate-limiting`
