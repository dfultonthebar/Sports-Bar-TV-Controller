# @sports-bar/atlas

**Purpose:** AtlasIED Atmosphere AZM4 / AZM8 audio processor control — TCP JSON-RPC for commands plus subscribed UDP meter pushes.

**Key exports** (`src/index.ts`):
- `AtlasTCPClient`, `createAtlasClient`, `executeAtlasCommand` — JSON-RPC command client (`src/atlasClient.ts`)
- `AtlasHttpClient`, `discoverAtlasConfiguration` — HTTP discovery of zones / sources / scenes (`src/atlas-http-client.ts`)
- `atlasClientManager`, `getAtlasClient`, `releaseAtlasClient` — process-wide singleton client pool (`src/atlas-client-manager.ts`)
- `queryAtlasHardwareConfiguration`, `testAtlasConnection` — hardware probing (`src/atlas-hardware-query.ts`)
- `atlas-meter-manager`, `atlas-meter-service`, `atlas-realtime-meter-service` — UDP meter subscription + caching
- AI gain analyzer / pattern learner / training data (`atlas-ai-*`, `ai-gain-service.ts`)

**Protocol / port:** TCP **5321** (JSON-RPC commands); UDP **3131** (subscribed meter pushes — `SourceMeter_N`, `ZoneMeter_N`, `GroupMeter_N` in dB). Defined in `src/config.ts`.

**Used by:** `apps/web` (matrix routing, bartender Audio tab, Atlas drop/priority watchers); `@sports-bar/scheduler` (volume-safety paths).

**Gotchas:**
- ONE persistent `ExtendedAtlasClient` per processor IP:port — always go through `atlasClientManager.getClient(...)`, never `new AtlasTCPClient(...)`. Direct construction leaks TCP sockets and bypasses the UDP-meter cache (CLAUDE.md §7, Gotcha #10).
- The singleton is hoisted to `globalThis` via `Symbol.for(...)` because Next.js bundles every route handler separately — see CLAUDE.md Gotcha #10.
- Atlas firmware exposes NO queryable "priority active" parameter (60+ candidate param names probed 2026-05-17, all returned `-32604`). Infer priority via mic-named input meter levels + unexpected `ZoneSource_X` changes.
- Atlas firmware 4.5+ adds per-priority "Custom Volume" that pins zone gain to a fixed low level during priority events — looks identical to a real drop signature. Check Atlas GUI → Sources → Priority before debugging the drop watcher.

**See also:**
- `apps/web/src/lib/atlas-drop-watcher.ts`, `atlas-priority-watcher.ts`
- `docs/by-equipment/atlasied/` (if present)
- CLAUDE.md §7 (Audio Processor Control) and §7a (RF cross-correlation)
