# @sports-bar/services

**Purpose:** Shared service-layer utilities that don't require deep database access — background-job tracking, IR-database integration, AI sports-context provider, command scheduler, sports schedule sync, automated health checks, QA generation. Services with heavy DB deps still live in `apps/web/src/lib/services/`.

**Key exports** (`src/index.ts`):
- `jobTracker`, `JobTrackerService` — in-memory job tracking for background tasks (`src/job-tracker.ts`)
- `IRDatabaseService`, `irDatabaseService` — Global Cache IR Database API client (`src/ir-database.ts`)
- `AISportsContextProvider`, `getAISportsContextProvider` — provides current game context to AI prompts (`src/ai-sports-context.ts`)
- `commandScheduler`, `CommandScheduler` — scheduled-command execution (`src/command-scheduler.ts`)
- `SportsScheduleSyncService`, `getSportsScheduleSyncService` — TheSportsDB sync (`src/sports-schedule-sync.ts`)
- `AutomatedHealthCheckService`, `getAutomatedHealthCheckService`, `HealthCheckResult` — system health checks (`src/automated-health-check.ts`)
- Plus QA generator pipeline: `qa-generator.ts`, `qa-generator-processor.ts`, `qa-uploader.ts`
- `enhanced-ai-client.ts`, `enhanced-document-search.ts`, `sports-guide-ollama-helper.ts`

**Protocol / port:** N/A — orchestration / abstraction layer.

**Used by:** `apps/web` API routes and instrumentation. Bridges `@sports-bar/sports-apis`, `@sports-bar/soundtrack`, `@sports-bar/data` together with the Anthropic SDK (`@anthropic-ai/sdk`).

**Gotchas:**
- This is the **DB-light** service layer — anything that requires extensive DB schema access should stay in `apps/web/src/lib/services/` until the database layer is fully extracted (see top-of-file comment in `src/index.ts`).
- `job-tracker` is **in-memory only** — jobs are lost on PM2 restart.
- Includes `@anthropic-ai/sdk` as a direct dependency — used by enhanced-ai-client.

**See also:**
- `@sports-bar/data` (DB helper factory consumed here)
- CLAUDE.md (general architecture; no dedicated section)
