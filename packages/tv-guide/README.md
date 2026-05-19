# @sports-bar/tv-guide

**Purpose:** Professional TV guide data normalization and aggregation. Pulls from Gracenote (Nielsen) and Spectrum Business, then exposes a unified channel+program shape.

**Key exports** (`src/index.ts`):
- `gracenoteService`, `GracenoteChannel`, `GracenoteProgram`, `GracenoteGuideData`, `GracenoteConfig` (`src/gracenote-service.ts`)
- `spectrumBusinessApiService`, `SpectrumBusinessChannel`, `SpectrumBusinessProgram`, `SpectrumBusinessGuideData`, `SpectrumServicePackage`, `SpectrumBusinessConfig` (`src/spectrum-business-api.ts`)
- `unifiedTVGuideService`, `UnifiedChannel`, `UnifiedProgram`, `UnifiedGuideData` (`src/unified-tv-guide-service.ts`) — combines all providers
- `src/api-keys.ts` — provider API-key management

**Protocol / port:** HTTPS to each provider's API. No fixed ports — uses platform HTTP.

**Used by:** `apps/web` channel-guide / sports-guide routes for richer program metadata than ESPN alone provides.

**Gotchas:**
- Both providers require **paid commercial credentials** — Gracenote (Nielsen) and Spectrum Business APIs are not free public APIs. Keys live in `.env` via `api-keys.ts`.
- The "unified" shape is the canonical interface consumers should use — calling provider services directly couples you to their changing schemas.
- This package is **TV-guide metadata only** — it doesn't tune channels or talk to receivers. For that see `@sports-bar/directv` or `@sports-bar/ir-control`.

**See also:**
- `@sports-bar/sports-apis` (sports-specific schedule sources — used alongside this for game-time channel injection)
- CLAUDE.md §9 (AI Scheduling — guide consumers)
