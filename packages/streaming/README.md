# @sports-bar/streaming

**Purpose:** Streaming-apps catalog + unified API for Fire TV launch & content discovery. Single source of truth for app package names, capabilities, deep-link patterns. Plus thin integrations with ESPN, MLB, and NFHS Network public APIs.

**Key exports** (`src/index.ts`):
- Catalog (`src/streaming-apps-database.ts`):
  - `STREAMING_APPS_DATABASE`, `StreamingApp`
  - `getStreamingAppById`, `getStreamingAppsByCategory`, `getAppsWithPublicApi`, `getStreamingAppsBySport`, `searchStreamingApps`, `getPackageNameByAppId`
  - Display-name + package-name helpers: `findStreamingAppByDisplayName`, `findStreamingAppByPackageName`, `getDisplayNameForPackage` (v2.32.9 — single source of truth, replaces inline lookup maps)
- API integrations (`src/api-integrations/`):
  - `espnApi`, `isESPNApiAvailable`, `ESPNEvent`, `ESPNScoreboard`
  - `mlbApi`, `isMLBApiAvailable`, `MLBGame`, `MLBTeam`, `MLBSchedule`
  - `nfhsApi`, `isNFHSApiAvailable`, `NFHSEvent`
- Unified API (`src/unified-streaming-api.ts`): `UnifiedStreamingAPI`, `unifiedStreamingApi`, `UnifiedEvent`, `ServiceStatus`, `FireTVAdapter`, `InstalledStreamingApp`

**Protocol / port:** Catalog is data-only. External APIs use HTTPS.

**Used by:** `apps/web` Fire TV launch routes (`streamingManager.launchApp(...)`); `@sports-bar/scheduler` for streaming-exclusive game detection.

**Gotchas:**
- **Catalog `packageAliases` matters** — on Fire TV Cube AFTR / PVFTV builds Prime Video lives in `com.amazon.firebat`, not `com.amazon.avod`. v2.28.8 added `firebat` as an alias for `amazon-prime` so the launch falls through to the launcher (CLAUDE.md Gotcha #9).
- Don't trust catalog package names blindly — verify with `pm path <package>` on the target device before debugging launch failures.
- Display-name lookups are case-insensitive but space-sensitive — use the provided helpers, not ad-hoc string matching.

**See also:**
- `@sports-bar/firecube` (ADB layer this calls into)
- CLAUDE.md Gotcha #9 (Prime Video launcher-hosted)
