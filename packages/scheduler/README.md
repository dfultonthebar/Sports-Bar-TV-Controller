# @sports-bar/scheduler

**Purpose:** AI-powered game scheduling and TV distribution engine — assigns games to TVs based on priority, zones, home-team bonus, and learned bartender overrides. Includes ESPN sync, Fire TV catalog walking, allocation conflict detection, and DirecTV probing.

**Key exports** (`src/index.ts`):
- `DistributionEngine`, `getDistributionEngine` — main allocation algorithm (`src/distribution-engine.ts`)
- `StateReader` — captures current input/output state (`src/state-reader.ts`)
- `PriorityCalculator` — game-priority scoring (`src/priority-calculator.ts`)
- `GamePriorityUpdater`, `gamePriorityUpdater` — bulk priority updates against DB (`src/game-priority-updater.ts`)
- `TeamNameMatcher` — fuzzy team-name matching from guide data (`src/team-name-matcher.ts`)
- `FireTVContentDetector` — streaming-exclusive game detection (`src/firetv-content-detector.ts`)
- `SmartOverride` — calculates intelligent override durations (`src/smart-override.ts`)
- `VolumeSafetyManager` — safe volume transitions for automated audio (`src/volume-safety.ts`)
- `pattern-analyzer.ts` — learns from historical overrides
- `espn-sync-service.ts` — populates `game_schedules` from ESPN
- `firetv-app-sync`, `firetv-catalog-walker` — Fire TV catalog crawl
- `conflict-detector`, `allocation-conflicts`, `auto-reallocator`, `failure-sweeper`, `override-digester`, `tournament-detector`, `network-map`, `smart-input-allocator`

**Protocol / port:** N/A — orchestration package, calls down into hardware packages.

**Used by:** `apps/web` scheduling API routes (`/api/scheduling/*`, `/api/sports-guide/*`); `instrumentation.ts` (ESPN sync on startup + 60min cron).

**Gotchas:**
- ESPN sync covers MLB/NBA/NHL/NFL/CFB/MCBB/WCBB only — leagues are lowercase in `game_schedules`.
- Channel-guide has **3+ injection paths** (walker / broadcast_networks / Rail Media) — fixing one doesn't fix the others. Verify end-to-end (CLAUDE.md memory feedback).
- AI Suggest calls Ollama with `llama3.1:8b` model, 300s timeout — iGPU acceleration recommended (CLAUDE.md §9).
- Override-learn window is 10 min — bartender's manual change inside the window patches `tv_output_ids`; outside the window it's treated as unrelated.

**See also:**
- CLAUDE.md §9 (AI Scheduling Intelligence) and §9a (Live Channel Mapping)
- `@sports-bar/sports-apis`, `@sports-bar/streaming` (dependencies)
