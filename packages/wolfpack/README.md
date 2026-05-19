# @sports-bar/wolfpack

**Purpose:** Wolf Pack HDMI matrix switcher control — HTTP + Telnet command channels, multi-chassis support, AI-powered pattern matching, and route-state tracking. Plus the model-profile catalog (WP-8X8 / 16X16 / 36X36 / 48-port).

**Key exports** (`src/index.ts`):
- `routeMatrix` — main routing entry point (`src/matrix-control.ts`)
- `routeWolfpackToMatrix`, `sendHTTPCommand`, `getMatrixRoutingState`, `queryWolfpackRouteState` — Atlas-audio-aware routing (`src/wolfpack-matrix-service.ts`)
- `WolfpackMatrixAIAnalyzer`, `WolfpackMatrixData`, `WolfpackAIInsight` — AI insight engine (`src/wolfpack-ai-analyzer.ts`)
- `wolfpackTrainingData`, `WolfpackPatternMatcher`, `WolfpackTrainingPattern` (`src/wolfpack-ai-training-data.ts`)
- `WOLFPACK_MODELS`, `getWolfpackModel`, `WolfpackModelProfile` (`src/models.ts`)
- Learning system: `runLearningCycle`, `getLearningStats`, `getLearnedPatterns`, `getLastRunTimestamp`, `recordRouteSuccess`, `recordRouteFailure`, `recordConnectionError`
- Chassis types: `WolfpackChassisConfig`, `WolfpackChassisInput`, `WolfpackChassisOutput`, `WolfpackChassisCredentials`, `WolfpackDevicesFile`

**Protocol / port:** HTTP (default web UI) **or** Telnet TCP **23**. Configured per chassis (`protocol: 'HTTP' | 'TCP' | 'UDP'` in `chassis-config.ts:39`).

**Used by:** `apps/web` matrix-routing API routes + bartender remote Video tab; `@sports-bar/scheduler` for distribution.

**Gotchas:**
- **`outputOffset` is per-location and critical** — added to every output before routing. Wrong value silently misroutes to wrong physical TVs. Single-card chassis MUST be `0`; multi-card varies by physical wiring. Enforced in `scripts/verify-install.sh` via `MATRIX_SINGLE_CARD=true` env opt-in (CLAUDE.md Gotcha #4 — full per-location table).
- Wolf Pack **does NOT pass CEC** — combined with Spectrum disabling CEC in firmware, cable boxes are IR-only (CLAUDE.md §5).
- Holmgren outputs 37-40 are audio-only (per CLAUDE.md location table).
- For multi-view cards inside Wolf Pack slots, see sibling package `@sports-bar/multiview`.

**See also:**
- `docs/WOLFPACK_HTTP_API_REFERENCE.md`
- `@sports-bar/multiview` (Quad-View cards)
- CLAUDE.md Gotcha #4 (outputOffset) and §5 (CEC dead)
