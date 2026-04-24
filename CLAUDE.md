# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ READ FIRST — REQUIRED BEFORE ANY NON-TRIVIAL WORK

Standing Rules 5, 7, and 8 below are SUMMARIES. Full application lives in:

1. **`docs/CLAUDE_MEMORY_GUIDE.md`** — three memory systems, sync rules, edge cases for Rules 5 & 7.
2. **`docs/CLAUDE_VERSIONING_GUIDE.md`** — version bumping, the three release docs interlock, Checkpoint A/B/C usage, Rule 8.

---

## V2 Monorepo Architecture

Turborepo + npm workspaces. `apps/web/` (Next.js 16) consumes `packages/*` (37 shared packages — `ls packages/` for the live list). Hardware control packages are named after the device family they wrap: `atlas`, `wolfpack`, `crestron`, `bss-blu`, `dbx-zonepro`, `directv`, `firecube`, `ir-control`, `multiview`. Cross-cutting packages: `auth`, `cache-manager`, `circuit-breaker`, `config`, `database`, `logger`, `rate-limiting`, `streaming`, `tv-guide`, `sports-apis`, `validation`, `ui-utils`, `utils`.

**Import convention:** `@sports-bar/<package>` (e.g. `import { logger } from '@sports-bar/logger'`).

**Notable:** `@sports-bar/config` centralizes validation schemas, rate-limit policies, Fire TV config, and `ConfigChangeTracker`. Apps use bridge files (e.g. `apps/web/src/lib/config-change-tracker.ts`) to inject app-specific adapters. Full API: `packages/config/README.md`.

## Build & Development Commands

### Local Development
```bash
npm run dev              # Start development server at http://localhost:3000
npm run build            # Production build (Turborepo builds all packages)
npm start                # Start production server
```

### Production Deployment (PM2)
```bash
pm2 start ecosystem.config.js        # Start with PM2
pm2 restart sports-bar-tv-controller # Restart after changes
pm2 logs sports-bar-tv-controller    # View logs
pm2 status                           # Check process status
```
**Port:** Production runs on port 3001 (configured in ecosystem.config.js)
**Database:** Production SQLite database is at `/home/ubuntu/sports-bar-data/production.db`

### IMPORTANT: Rebuild and Restart After Code Changes
**After making any code changes in `apps/web/src` or `packages/`, you MUST rebuild and restart PM2:**
```bash
# Step 1: Clear Next.js cache (recommended)
rm -rf apps/web/.next

# Step 2: Rebuild the application (Turborepo handles dependencies)
npm run build

# Step 3: Restart PM2
pm2 restart sports-bar-tv-controller
```

**Why this is required:**
- Next.js caches compiled code in `apps/web/.next/` directory
- PM2 runs the production build, not the development server
- Without rebuilding, code changes won't take effect
- Turborepo caches build artifacts - clears automatically when source changes

### Database Operations
```bash
npm run db:generate      # Generate Drizzle migrations from schema changes
npm run db:push          # Push schema changes to database (no migration files)
npm run db:studio        # Open Drizzle Studio database GUI
```

**Database Architecture:**
- ORM: Drizzle ORM with SQLite
- Schema: `apps/web/src/db/schema.ts` (single file, ~85 tables)
- Database Package: `packages/database/` - shared database layer
- Production DB: `/home/ubuntu/sports-bar-data/production.db` (configured in drizzle.config.ts)
- No Prisma migrations - uses Drizzle Kit for schema management

### Testing
```bash
npm test                    # Run unit tests
npm run test:watch          # Watch mode for unit tests
npm run test:integration    # Run all integration tests
npm run test:hardware       # Test specific hardware (CEC, IR, Matrix)
npm run test:api            # Test API endpoints
npm run test:database       # Test database operations
npm run test:all            # Run both unit and integration tests
npm run test:coverage       # Generate coverage report
```

**Test Structure:**
- Unit tests: `src/**/__tests__/*.test.ts`
- Integration tests: `tests/integration/*.test.ts`
- Test scenarios: `tests/scenarios/*.test.ts`

## High-Level Architecture

### Next.js 16 App Router Architecture
**Framework:** Next.js 16.1.1 with App Router (not Pages Router)
- All routes in `apps/web/src/app/*` follow App Router conventions
- API routes: `apps/web/src/app/api/**` with route.ts files
- Pages: `apps/web/src/app/**/page.tsx` files
- Layouts: `apps/web/src/app/**/layout.tsx` files

**Next.js 16 Breaking Changes (from v15):**
- Turbopack is now the default bundler; use `--webpack` flag for webpack-dependent packages like `next-pwa`
- `eslint` config in next.config.js is removed; run ESLint separately
- The `next lint` command is removed; use `eslint .` directly
- Request APIs (`cookies()`, `headers()`, `params`) are now fully async (synchronous access removed)

### Core Systems

#### 1. Hardware Control Layer
**Location:** Shared packages and `apps/web/src/lib/` services
**Key Packages:**
- `@sports-bar/atlas` - AtlasIED audio processor control
- `@sports-bar/wolfpack` - Atlas Wolf Pack matrix control
- `@sports-bar/crestron` - Crestron DM matrix switcher control
- `@sports-bar/bss-blu` - BSS Soundweb London audio processors
- `@sports-bar/dbx-zonepro` - dbx ZonePRO audio processors
- `@sports-bar/directv` - DirecTV IP control
- `@sports-bar/firecube` - Amazon Fire TV ADB control
- `@sports-bar/ir-control` - IR blaster control (iTach IP2IR)

**DirecTV Device Loader:** `apps/web/src/lib/directv-device-loader.ts` loads DirecTV receiver configs from `apps/web/data/directv-devices.json`. Used by DirecTV API routes to resolve device IPs and port numbers.

**Command Queue Pattern:**
All hardware services use a command queue pattern to prevent concurrent access issues:
```typescript
private queueCommand(devicePath: string, fn: () => Promise<T>): Promise<T>
```

#### 2. Validation & Security Architecture
**Location:** `packages/validation/` and `packages/rate-limiting/`

**Request Validation Pattern (CRITICAL):**
```typescript
// ❌ WRONG - Duplicate request.json() call
const bodyValidation = await validateRequestBody(request, schema)
const body = await request.json() // ERROR: Body already consumed!

// ✅ CORRECT - Use validated data
const bodyValidation = await validateRequestBody(request, schema)
if (!bodyValidation.success) return bodyValidation.error
const body = bodyValidation.data // Use this!
```

**Common Bug:** The `validateRequestBody()` middleware consumes the HTTP request body stream. Never call `request.json()` after validation - always use `bodyValidation.data`.

**Validation Utilities:**
- `validateRequestBody()` - POST/PUT/PATCH body validation
- `validateQueryParams()` - GET query string validation
- `validatePathParams()` - Dynamic route parameter validation
- Schemas: `packages/validation/src/schemas.ts` - Centralized Zod schemas

**Rate Limiting:**
All API endpoints are rate-limited using `packages/rate-limiting/src/middleware.ts`:
```typescript
const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
if (!rateLimit.allowed) return rateLimit.response
```

#### 3. Database Architecture
**ORM:** Drizzle ORM (not Prisma - migration completed)
**Schema:** Single file at `apps/web/src/db/schema.ts` (~85 tables)
**Database Package:** `packages/database/` - Shared database layer with re-exports
**Helpers:** `apps/web/src/lib/db-helpers.ts` - CRUD operations (findFirst, findMany, create, update, delete)

**Key Tables:**
- `FireTVDevice`, `DirecTVDevice`, `IRDevice` - Device management
- `CableBox`, `CECDevice` - CEC cable box control
- `ChannelPreset` - Quick channel access
- `MatrixConfiguration`, `MatrixRoute` - HDMI matrix routing
- `User`, `Session`, `ApiKey` - Authentication
- `CECCommandLog`, `CommandLog` - Audit trails
- `AtlasZone`, `AtlasProcessor` - Audio control

**Database Access Pattern:**
```typescript
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

// Query
const devices = await db.select().from(schema.fireTVDevices).where(eq(schema.fireTVDevices.status, 'online'))

// Using helpers
import { findFirst, findMany, create } from '@/lib/db-helpers'
const device = await findFirst('fireTVDevices', { where: eq(schema.fireTVDevices.id, deviceId) })
```

#### Device Data Migration (JSON → Database)
**Status:** Complete as of March 2026

Device configuration has been migrated from JSON files to database tables:

| Device Type | Old Source | New Source | DB Table | Helper Module |
|-------------|-----------|-----------|----------|---------------|
| DirecTV receivers | `data/directv-devices.json` | Database | `DirecTVDevice` | `apps/web/src/lib/device-db.ts` |
| Fire TV devices | `data/firetv-devices.json` | Database | `FireTVDevice` | `apps/web/src/lib/device-db.ts` |
| Station aliases | Hardcoded in channel-guide route | Database | `station_aliases` | Cached DB query in channel-guide |
| Channel overrides | Hardcoded in channel-guide route | Database | `local_channel_overrides` | Cached DB query in channel-guide |
| Channel presets | Hardcoded dicts in routes | Database | `ChannelPreset` | Seeded from `data/channel-presets-{cable,directv}.json` |

**Auto-Seed on First Startup:** When the app starts and device/preset tables are empty, it automatically seeds from JSON files (`data/directv-devices.json`, `data/firetv-devices.json`, `data/channel-presets-cable.json`, `data/channel-presets-directv.json`). This ensures locations pulling the code update don't lose their devices or channel presets. See `apps/web/src/lib/seed-from-json.ts`. The channel-preset JSON files are per-location (committed on the location branch) and seed the `ChannelPreset` table only when it's empty — after that the DB is the source of truth.

**Centralized Hardware Config:** `apps/web/src/lib/hardware-config.ts` contains all device IPs, ports, and processor IDs. Update this file when hardware changes — no more hunting through 15+ files.

**Important:** The JSON files still exist on location branches as seed data. After first startup, the database is the source of truth. Edits made through the UI go to DB only.

#### 4. Logging Architecture
**Logger Package:** `packages/logger/`
```typescript
import { logger } from '@sports-bar/logger'

logger.info('[COMPONENT] Message', { context: 'data' })
logger.error('[COMPONENT] Error:', error)
logger.debug('[COMPONENT] Debug info')
```

**Enhanced Logging:** `packages/logger/src/enhanced-logger.ts` - Stores logs in database for System Admin analytics
**Component Tags:** Use `[COMPONENT]` prefix for searchable log filtering (e.g., `[CEC]`, `[MATRIX]`, `[IR]`)

#### 5. Cable Box Control (IR only — CEC dead, do not extend)
Wolf Pack matrix does NOT pass CEC + Spectrum disables CEC in firmware → all cable box control is IR via Global Cache iTach IP2IR. IR codes live in the `IRCommand` table, learned via the IR Learning Panel. UI: `apps/web/src/components/remotes/CableBoxRemote.tsx` + `BartenderRemoteSelector.tsx`. Do not add new CEC features.

#### 6. Crestron Matrix Switcher Control
**Package:** `packages/crestron/`
**Purpose:** Control Crestron DigitalMedia (DM) matrix switchers for video routing

**Supported Models (18 total across 4 series):**
- **DM-MD Series:** DM-MD8X8, DM-MD16X16, DM-MD32X32, DM-MD64X64, DM-MD128X128
- **HD-MD Series:** HD-MD8X8, HD-MD8X4, HD-MD6X2, HD-MD4X2, HD-MD4X1
- **DMPS Series:** DMPS3-4K-350-C, DMPS3-4K-250-C, DMPS3-4K-150-C
- **NVX Series:** DM-NVX-350, DM-NVX-351, DM-NVX-352, DM-NVX-360, DM-NVX-363

**Control Protocols:**
- Telnet (port 23) - Primary, simplest for routing
- CTP (port 41795) - Crestron Terminal Protocol
- CIP (port 41794) - Crestron Internet Protocol

**Key Commands:**
```
SETAVROUTE input output    # Route input to output (video + audio)
SETVIDEOROUTE input output # Route video only
SETAUDIOROUTE input output # Route audio only (audio breakaway)
DUMPDMROUTEI              # Get current routing state
```

**Output Slot Offset:** DM matrices use offset numbering:
- 8x8/16x16: Output slots start at 17
- 32x32: Output slots start at 33
- 64x64: Output slots start at 65

**API Routes:**
- `GET/POST /api/crestron/matrices` - List/create matrices
- `GET/PUT/DELETE /api/crestron/matrices/[id]` - Individual matrix CRUD
- `POST /api/crestron/matrices/[id]/test` - Connection test

**UI Location:** Matrix Control page → "Crestron DM" tab
**Component:** `apps/web/src/components/CrestronMatrixManager.tsx`

**Database Table:** `CrestronMatrix` (id, name, model, ipAddress, port, status, inputs, outputs)

#### 7. Audio Processor Control
**Packages:** `packages/bss-blu/`, `packages/dbx-zonepro/`, `packages/atlas/`

**BSS Soundweb London (HiQnet Protocol):**
- Models: BLU-50, BLU-100, BLU-120, BLU-160, BLU-320, BLU-800, BLU-806, BLU-806DA
- Protocol: HiQnet over TCP (port 1023)
- Features: Dante/CobraNet support on some models
- Control: Zone volume, mute, source selection

**dbx ZonePRO (TCP/RS-232):**
- Models: 640, 640m, 641, 641m, 1260, 1260m, 1261, 1261m
- Protocol: TCP (port 3804) preferred, RS-232 (serial) also supported
- Control: Zone volume, mute, source routing, scene recall
- **CRITICAL:** TCP framing is different from RS-232 — NO F0/64/00 prefix, NO checksum over TCP
- Router SV IDs: 0x0000=Source (UBYTE), 0x0001=Volume (UWORD 0-415), 0x0002=Mute (UBYTE)
- Object ID formula: device-specific, configured in ZonePRO Designer
- **Failsafe gotcha:** New TCP connections trigger failsafe mode which shifts source indices. Fix: auto-recall Scene 1 on connect (`sceneOnConnect` in DbxTcpClient)
- Fire-and-forget protocol: no response expected from device

**UI Location:** Device Config page → Audio Processors section
**Component:** `apps/web/src/components/AudioProcessorManager.tsx`

#### 8. Wolf Pack Multi-View Card Control
**Package:** `packages/multiview/` (commands, serial-client, multiview-service)
**Purpose:** Control HDTVSupply 4K60 Quad-View output cards in Wolf Pack matrix slots (8x8, 16x16, 36x36).
**Protocol:** RS-232 via USB (115200 baud, 8N1). 8 display modes (single → quad). Hex frame: `EB 90 00 11 00 ff 32 [mode] 00 01 02 03 00 00 00 00 00 00`. Mode bytes 0-7 (single, 2-split, PIP-LT, PIP-RB, 3-win, 3-win-alt, 3-PIPx2, quad).
**DB:** `WolfpackMultiViewCard` (name, startSlot, endSlot, serialPort, currentMode, inputAssignments).

### API Route Patterns

Standard order: `withRateLimit` → `validateRequestBody`/`validateQueryParams` → use `bodyValidation.data` (NEVER `request.json()` after) → business logic → `NextResponse.json({success, data/error})` → catch logs `[COMPONENT]` tag. POST validates body, GET validates query params. See `apps/web/src/app/api/matrix/current-channels/route.ts` or `apps/web/src/app/api/schedules/bartender-schedule/route.ts` for canonical examples.

### Authentication System
**Location:** `packages/auth/`
**Strategy:** NextAuth.js 4.24.11 with custom PIN-based authentication
**Session Storage:** Database sessions (not JWT)

**Key Files (in packages/auth/src/):**
- `middleware.ts` - Route protection
- `pin.ts` - PIN validation
- `session.ts` - Session management
- `api-key.ts` - API key authentication (for external integrations)

**Protected Routes:** `apps/web/src/app/login/` handles authentication UI

### Audio Control & Soundtrack Integration
**AtlasIED Integration:** `packages/atlas/`
- Real-time audio level monitoring
- AI-powered gain optimization
- Zone-specific control

**Soundtrack Your Brand:** Commercial music streaming for bars
- API integration: `packages/soundtrack/`
- Now playing display
- Play/pause control from bartender remote

### Frontend Component Architecture
**UI Library:** Radix UI + Tailwind CSS
**State Management:** React hooks (no Redux/Zustand)
**UI Utilities:** `packages/ui-utils/` - Tailwind CSS utility functions (cn)
**Component Structure:**
- `apps/web/src/components/ui/` - Reusable UI primitives
- `apps/web/src/components/remotes/` - Device-specific remote controls
- `apps/web/src/components/streaming/`, `directv/`, `ir/` - Device type components

**Smart Component Pattern (CableBoxRemote):**
```typescript
// Detects device type and routes to appropriate API
const isCECDevice = !iTachAddress && deviceId.startsWith('cable-box')
const endpoint = isCECDevice ? '/api/cec/cable-box/command' : '/api/ir-devices/send-command'
```

## Common Gotchas

### 1. Body Stream Already Consumed
`validateRequestBody()` reads the request body. Never call `request.json()` after — use `validation.data`. POST/PUT only; GET has no body, use `validateQueryParams()`.

### 2. PM2 Restart vs Delete+Start
`pm2 restart` does NOT re-read `.env` via `ecosystem.config.js` — only `delete` + `start` does. Use restart for code-only changes after rebuild; delete+start when env vars or ecosystem config changed. Force-rebuild before restarting if package-source changed: `rm -rf apps/web/.next .turbo node_modules/.cache && npx turbo run build --force` (Turbo cache misses package changes — caused the v2.11.7 routing fix to not take effect at Holmgren).

### 3. Production DB Path
Always `/home/ubuntu/sports-bar-data/production.db`. Set in `drizzle.config.ts` + env. Dev may differ.

### 4. Matrix Config Per-Location Values (CRITICAL — outputOffset)

`MatrixConfiguration.outputOffset` is ADDED to every output number before
routing commands go to the Wolf Pack. If set wrong, routing silently lands
on the wrong physical TVs with no error — just confused operators. Lucky's
1313 shipped in April 2026 with `outputOffset=26` on a single-card WP-36X36,
sending every "output 1" request to physical output 27 for weeks before
being caught.

**Expected values by card layout (NOT by model string):**

The WP-8X8, WP-16X16, and WP-36X36 chassis are all sold in BOTH single-card
and multi-card configurations — the model string alone does not tell you
which. Card layout is set per-location by the installer.

| Card layout | outputOffset | audioOutputCount notes |
|---|---|---|
| **Single-card** (one card fills all outputs) | **MUST be 0** | 0 if audio routes via Atlas/dbx/BSS DSP; non-zero only if Wolf Pack outputs are wired to speakers |
| **Multi-card** (chassis populated with multiple daughter cards) | Per-card, depends on physical wiring | Per-location |

**Per-location reference** (updated 2026-04-18 after operator verification):

| Location | Model | Layout | outputOffset | audioOutputCount | Notes |
|---|---|---|---|---|---|
| Stoneyard Greenville | Wolf Pack WP-36X36 | **Multi-card** | Per card | 4 | |
| Stoneyard Appleton | Wolf Pack | **Multi-card** | Per card | 4 | |
| Holmgren Way | Wolf Pack 48-port | **Multi-card** | Per card layout | 4 | Outputs 37-40 are audio-only (CLAUDE.md §10) |
| Graystone | Wolf Pack WP-36X36 | **Multi-card** | +32 for audio card | 4 | Comment in `wolfpack-matrix-service.ts:275` |
| Lucky's 1313 | Wolf Pack WP-36X36 | **Single-card** | **0 (enforced)** | **0** | Audio via dbx ZonePRO 1260m @ 192.168.10.50 |
| Leg Lamp | Wolf Pack | **Single-card** | **0 (enforced)** | 0 | |

**How enforcement is opted in:**

Single-card locations declare themselves by setting `MATRIX_SINGLE_CARD=true`
in the location's `.env`. When this flag is set, `scripts/verify-install.sh`'s
`matrix_config` layer will FAIL the install if `outputOffset != 0`, rolling
back the auto-update before bad values ship. Multi-card locations leave the
flag unset (the default) and any offset is accepted.

This was changed from a model-name-based check after Graystone's multi-card
WP-36X36 failed verify with "offset=32 on WP-36X36 (expected 0)" — the old
check assumed every WP-36X36 was single-card. Opt-in via env is explicit
and lets operators match the check to physical wiring regardless of model.

- `apps/web/src/instrumentation.ts` logs `[MATRIX-CONFIG] ⚠` at startup if a single-card model has non-zero offset (separate legacy check, still useful as a runtime warning).
- Multi-card locations are not auto-verified (their values are wiring-specific) — operator must maintain the row in this table when adding/moving cards.

**When adding a new location**, add a row to the per-location table above
BEFORE the first auto-update merges it into this file. When changing physical
cabling on an existing Wolf Pack, update both the live DB value AND the row
here.

### 5. Device Data: DB is Source of Truth
- Devices are now stored in database tables (`DirecTVDevice`, `FireTVDevice`), not JSON files
- JSON files (`data/directv-devices.json`, `data/firetv-devices.json`) are only used for initial seeding
- All CRUD operations go through `apps/web/src/lib/device-db.ts`
- To re-seed from JSON: delete rows from the DB table, restart the app
- The `@sports-bar/directv` package still reads JSON for guide fetching (known tech debt)

### 6. drizzle-kit push Fails Silently on Pre-Existing Indexes
`npx drizzle-kit push` aborts entirely when it hits an index that already exists (e.g., `ApiKey_provider_keyName_key already exists`). Any tables or columns scheduled to be created AFTER that index in the push order are silently skipped. **Always verify new columns/tables exist after push:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA table_info(TableName);"
sqlite3 /home/ubuntu/sports-bar-data/production.db ".tables"
```
If a column is missing, add it manually with `ALTER TABLE ... ADD COLUMN`.

### 7. Location Data Files Get Blanked on Merge from Main
Main has empty template JSON files (`tv-layout.json` = 61 bytes, `directv-devices.json` = 15 bytes). When merging main into a location branch, git can silently overwrite real data with these templates if there's no conflict. **After every merge from main, verify:**
```bash
wc -c apps/web/data/tv-layout.json  # Must be >500 bytes at a configured location
```
If blanked, restore: `git show HEAD~1:apps/web/data/tv-layout.json > apps/web/data/tv-layout.json`

### 8. BartenderLayout Must Include Rooms
The bartender Video tab reads both `zones` and `rooms` from the `BartenderLayout` DB table (migrated from `tv-layout.json` in v2.11.0). If `rooms` is empty or the column is missing, the room filter tabs won't appear. The auto-seeder in `seed-from-json.ts` handles this for fresh installs. For existing locations, ensure the `rooms` column exists and is populated.

### 9. Prime Video on Fire TV Cubes is hosted by the launcher, not a separate APK
On Fire TV Cube 2nd gen (model **AFTR**, Fire OS 7.7) and other PVFTV-build Cubes, **`com.amazon.avod` is NOT installed as a standalone app** — `pm list packages` will not show it. Prime Video is hosted entirely inside the Fire TV launcher (`com.amazon.firebat`). What `Settings → Applications → Manage Installed Applications` shows as "Prime Video" with version `PVFTV-215.5200-L` IS the launcher itself; Amazon brands the launcher entry as "Prime Video" in the user-facing list.

**Don't waste time hunting for the AVOD package.** v2.28.8 added `com.amazon.firebat` as a `packageAlias` for the `amazon-prime` catalog entry (`packages/streaming/src/streaming-apps-database.ts`). When `streamingManager.launchApp('amazon-prime')` runs on a Cube without `com.amazon.avod`, it falls through to firebat. `adb-client.launchApp()` then resolves `cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER com.amazon.firebat` to `com.amazon.firebat/com.amazon.firebatcore.deeplink.DeepLinkRoutingActivity`, which routes to `livingroom.landing.LandingActivity` (the Prime Video browse screen — exact same activity the home-screen tile invokes).

If a future Cube model ships Prime Video under yet another package name, the diagnostic flow is:
1. Confirm device truly lacks `com.amazon.avod`: `pm path com.amazon.avod` returns failure.
2. Have an operator open Prime Video manually on the device, then capture `dumpsys window windows | grep mCurrentFocus` to see the foreground activity.
3. Confirm the package is launchable: `cmd package resolve-activity --brief -c android.intent.category.LEANBACK_LAUNCHER <package>` returns a real activity.
4. Add the package to `packageAliases` for `amazon-prime` in the streaming catalog.

The same reasoning applies to **other Amazon-branded apps that may be launcher-hosted on certain Fire OS builds** (Amazon Music, Photos). Don't trust the catalog package name as authoritative — trust what `pm path` returns on the actual device.

## Development Workflow

### Standing Rules (MUST follow in every session)

1. **Read docs before work, update docs after.** Read CLAUDE.md + relevant `/docs/*.md` before non-trivial work. After code changes update matching docs (API_REFERENCE if routes changed, HARDWARE_CONFIGURATION if devices, CLAUDE.md if architecture). New feature → new doc. Never claim "docs updated" without actually editing.

2. **Commit + push after completing work.** Verified working (build passes, tests confirm) → commit + push automatically. Software-to-main first, then merge to location. Confirm before destructive git ops (force push, reset, branch delete).

3. **Never break working features during cleanup.** Positive evidence of zero callers/UI refs/scheduled jobs before deleting. When in doubt hide from UI before deleting code. Stage refactors into small verifiable steps; build + PM2 restart + sanity check between each. Never delete DB tables in the same pass as code.

4. **Force-rebuild when Turbo cache lies.** `npm run build` finishes <1s with FULL TURBO + all cached → source did NOT compile. Use `npx turbo run build --force` (or `rm -rf apps/web/.next .turbo && npm run build`) after switching branches or cherry-picking.

5. **"Remember" → update CLAUDE.md too.** Local auto-memory + matching CLAUDE.md section + version bump + commit+push. Details: `docs/CLAUDE_MEMORY_GUIDE.md` → Rule 5.

6. **Always use `scripts/auto-update.sh`.** `bash scripts/auto-update.sh --triggered-by=manual_cli`. Never manual merge/npm ci/PM2 restart — script handles conflicts, DB schema push, backup, Turbo bust, PM2, verify, checkpoints.

7. **Sync memory ↔ CLAUDE.md bidirectionally.** At Checkpoint B + every CLAUDE.md read, diff both ways: CLAUDE.md→memory (save missing rules), memory→CLAUDE.md (promote shared knowledge). Details: `docs/CLAUDE_MEMORY_GUIDE.md` → Rule 7.

8. **Read + CONTRIBUTE to `docs/VERSION_SETUP_GUIDE.md` every update.** At auto-update read target version's Required Manual Steps + execute (or flag). Bumping → write new entry in the same commit. Fixing location error → append to Known Errors & Fixes. Details: `docs/CLAUDE_VERSIONING_GUIDE.md` → Standing Rule 8.

### Version Bumping (REQUIRED — every commit to main)
Every commit to `main` MUST include a `package.json` version bump (same commit or same push). Code-change-without-bump → locations report matching versions for mismatched code → undebuggable. Minor for features/migrations; patch for bug fixes/docs. Details: `docs/CLAUDE_VERSIONING_GUIDE.md`.

### Making Schema Changes
```bash
# 1. Edit apps/web/src/db/schema.ts
# 2. Generate migration
npm run db:generate

# 3. Apply to database
npm run db:push

# 4. Rebuild app
npm run build

# 5. Restart PM2
pm2 restart sports-bar-tv-controller
```

### Adding New API Endpoints
1. Create route file: `apps/web/src/app/api/your-endpoint/route.ts`
2. Add validation schema to `packages/validation/src/schemas.ts` if needed
3. Add rate limit config to `packages/rate-limiting/src/rate-limiter.ts` if needed
4. Follow the standard API route pattern (see above)
5. Test with appropriate test file in `/tests/integration/`

### Testing Hardware Integrations
`npm run test:hardware` (Wolf Pack/IR/CEC adapters), `npm run test:api -- --testPathPattern=<area>` for targeted route tests. Live device probes go through the existing API routes (e.g. `/api/firetv-devices/[id]/current-app`, `/api/wolfpack/route`) — don't write per-device curl examples here, they rot.

## Key Configuration Files

- `ecosystem.config.js` - PM2 configuration (port 3001, production mode)
- `turbo.json` - Turborepo configuration
- `apps/web/drizzle.config.ts` - Database configuration
- `apps/web/next.config.js` - Next.js configuration
- `.env` or environment variables - API keys, database URL
- `packages/validation/src/schemas.ts` - Centralized validation schemas
- `packages/rate-limiting/src/rate-limiter.ts` - Rate limit configurations

#### 6. Memory Bank System (resume-after-restart snapshots)
Per-host project-state snapshot tool at `apps/web/src/lib/memory-bank/`. Captures git status, modified files, system state. Primarily an operator tool for "SSH session died, what was I doing?" use case. CLI: `npm run memory:snapshot`, `memory:restore`, `memory:list`. API under `/api/memory-bank/*`. **Full details (CLI commands, API endpoints, relationship to the other two memory systems — Claude auto-memory and CLAUDE.md itself) in `docs/CLAUDE_MEMORY_GUIDE.md`.**

#### 7. RAG Documentation Server
**Purpose:** Local documentation search and Q&A using Ollama LLM

**Location:** `apps/web/src/lib/rag-server/`
**Requirements:** Ollama with llama3.1:8b and nomic-embed-text models

**CLI Commands:**
```bash
npm run rag:scan         # Scan all docs into vector store
npm run rag:scan:clear   # Clear vector store and rescan
npm run rag:test         # Test query against indexed docs
```

**API Endpoints:**
- `GET /api/rag/stats` - Vector store statistics
- `POST /api/rag/query` - Query documentation (with optional tech filter)
- `POST /api/rag/rebuild` - Rebuild vector store
- `GET /api/rag/docs` - List indexed documents

**Architecture:**
1. **Document Scanner** (`doc-processor.ts`) - Scans `/docs` folder, chunks documents (750 tokens, 100 overlap)
2. **Vector Store** (`vector-store.ts`) - Stores embeddings with metadata (tech tags, file types)
3. **Query Engine** (`query-engine.ts`) - Retrieves top-k similar chunks, generates LLM answer
4. **Ollama Client** (`ollama-client.ts`) - Interfaces with local Ollama server (port 11434)

**Supported Formats:** Markdown (.md), PDF (.pdf), HTML (.html)

**Usage Example:**
```typescript
import { queryDocs } from '@/lib/rag-server/query-engine'

const result = await queryDocs({
  query: "How do I configure CEC cable box control?",
  tech: "cec" // Optional filter
})
// result.answer: Generated answer from LLM
// result.sources: Source documents used
```

**Tech Tags:** Auto-detected from file content (ai, cec, ir, hardware, testing, auth, etc.)

**Performance:** ~200ms for similarity search, 2-5s for LLM answer generation

#### 8. IR Learning System
**Purpose:** Capture IR codes from physical remotes for cable box control

**Hardware Required:** Global Cache iTach IP2IR

**UI Component:** `apps/web/src/components/ir/IRLearningPanel.tsx`
**API Endpoint:** `apps/web/src/app/api/ir/learn/route.ts`

**Access:** Device Config page → IR tab → Select device → Click "Learn IR" button

**API Endpoints:**
- `POST /api/ir/learn` - Start learning session for a command
- `POST /api/ir/commands/send` - Send learned IR command
- `GET /api/ir/devices/{deviceId}/commands` - Get all commands for device
- `POST /api/ir/commands` - Create new command placeholder
- `DELETE /api/ir/commands/{commandId}` - Delete command

**Learning Flow:**
1. User clicks "Learn" button in IRLearningPanel for a specific command
2. Frontend calls `/api/ir/learn` with device ID, command ID, Global Cache device ID
3. Backend connects to iTach device and sends `get_IRL` command
4. iTach enters learning mode and waits for IR signal (60 second timeout)
5. User points physical remote at iTach IR sensor and presses button
6. iTach captures complete IR code (e.g., `sendir,1:1,1,37764,1,1,342,171,21,83...`)
7. Backend validates code is complete (ends with number, has 6+ segments)
8. Code saved to `IRCommand` table with command ID
9. Frontend reloads command list to show learned code

**Database Schema:**
```typescript
// schema.irCommands table
{
  id: string
  deviceId: string        // Foreign key to IRDevice
  functionName: string    // Command name (e.g., "power", "channel_up")
  irCode: string          // Complete sendir command
  category: string        // "Power", "Volume", "Channel", etc.
  createdAt: string
}
```

**Important:** IR codes must be COMPLETE. Truncated codes will cause `ERR_2:1,010` errors from iTach device. The learning API properly buffers TCP data to ensure complete codes are captured.

**Spectrum Cable Box Note:** Spectrum/Charter disables CEC in firmware. IR learning is the ONLY way to control Spectrum boxes.

#### 8a. Sports Guide Admin Consolidation
Consolidation complete (v2.4.0–v2.4.4). All admin UI lives at `/sports-guide-admin` with 8 tabs. Old URLs (`/sports-guide`, `/sports-guide-config`, `/ai-gameplan`, `/scheduling`) redirect via `next.config.js`. Bartender remote `/remote` is unaffected. **Do not reintroduce** the deleted API routes (full list in `docs/SPORTS_GUIDE_ADMIN_CONSOLIDATION.md`). Two routes look orphaned but ARE called by internal cron in `packages/scheduler/src/scheduler-service.ts` — keep: `/api/sports-guide/cleanup-old` and `/api/scheduling/live-status`.

#### 9. AI Scheduling Intelligence
**Components:** `pattern-analyzer.ts` (historical viewing → optimal channel assignment), `ai-suggest/route.ts` (Ollama llama3.1:8b, 90s timeout), per-location scheduling preferences, default source config, DJ mode (locks TVs during special events).
**API:** `GET/POST /api/scheduling/preferences`, `GET /api/scheduling/suggestions`, `POST /api/scheduling/apply`.

**ESPN sync** runs from `apps/web/src/instrumentation.ts` on startup (30s delay) + every 60min. Covers MLB/NBA/NHL/NFL/CFB/MCBB/WCBB → `game_schedules` table (lowercase league labels). AI Game Monitor's `Schedule` row auto-creates on first use; populate `HomeTeam` table for home-team prioritization (Packers/Bucks/Brewers/Badgers).

**bartender-schedule POST** accepts optional `tvOutputIds: number[]`. Guide tab flow creates allocation then PATCHes; AI-suggest approve sends inline. Lookup: `homeTeamName + awayTeamName + ±1hr window` (special-event fallback when client sends `awayTeam="Unknown"` or `""` v2.32.11). Fails 404 with a sync-pointer message if no match.

**Channel Guide fallback (v2.3.0+):** Rail Media misses regional games (e.g., Brewers on Brewers.TV). After the Rail loop, `POST /api/channel-guide` queries `game_schedules` in the same window and injects any whose `broadcast_networks` resolve to a preset via `stationToPreset` (+ station-alias fallback). Dedup vs Rail by channel + team. `normalizeStation` strips `HD`/`NETWORK`/`CHANNEL`/`-TV` + spaces + dashes — new aliases must normalize to the target preset name.

**WI RSN split (CRITICAL):** `Channel 40` = `FanDuelWI` (Bucks + general WI; ESPN code `FSWI`). `Channel 308` = `BallyWIPlus` (Brewers-only; ESPN tag `Brewers.TV`). Never combine alias bundles or Bucks games route wrong. Canonical lists in `apps/web/src/lib/seed-from-json.ts`.

**Override-learn (v2.18.0):** Manual `/api/matrix/route` with `source='bartender'` within 10min of an alloc → patches alloc's `tv_output_ids` (add if input matches, remove if input differs). SchedulerLog row written with `component='override-learn'`, op `add|remove`, metadata (team/league/isHomeTeam/prev/new). Home-team overrides log at `level='warn'`. `pattern-analyzer.ts` reads these hourly. After 10min window the bartender's change is treated as unrelated, not learned.

#### 9a. Live Channel Mapping (Network → Channel)
`apps/web/src/app/api/sports-guide/live-by-channel/route.ts` holds `NETWORK_TO_CABLE` + `NETWORK_TO_DIRECTV` dicts mapping ESPN broadcast names (e.g. `"FanDuel SN WI"`, `"Brewers.TV"`) → local channel numbers. When a game doesn't appear in live games, capture ESPN's exact network string + add ALL variants to both dicts.

#### 10. Per-location hardware references
Hardware IPs/ports/quirks live per-location in `.claude/locations/<branch>.md` (e.g. `holmgren-way.md`, `graystone.md`, `lucky-s.md`). DB is the source of truth; those files are quick references for operators + Claude. Do NOT put per-location IPs in this file — they drift across locations and pollute the shared template.

**IR port adjustment (applies everywhere):** Learned IR codes have `sendir,1:1,...` hardcoded. The runtime substitutes the device's `globalCachePortNumber` before transmission. For multi-port iTach devices, port assignment matters or the wrong emitter fires.

## Multi-Location Deployment

This system supports multiple sports bar locations. Each location runs its own installation with location-specific data on dedicated git branches.

### Location Branch Convention

| Branch | Purpose |
|--------|---------|
| `main` | Shared code with empty data templates |
| `location/graystone` | Graystone (Green Bay, WI) data |
| `location/holmgren-way` | Holmgren Way (current installation) data |
| `location/lucky-s-1313` | Lucky's data |

### Location-Specific Files (empty templates on main)

These files are replaced with real data on location branches. On `main`
they exist as empty templates that `seed-from-json.ts` handles gracefully
(no-ops) so a fresh clone starts clean. **Never commit populated versions
to `main`** — see the reconciliation commit `7f13fbe7` (2026-04-14) for
the history of what happens when this rule gets broken.

- `apps/web/data/tv-layout.json` — `{"name":"Bar Layout","zones":[],"tvPositions":[],"rooms":[]}`
- `apps/web/data/directv-devices.json` — `{"devices":[]}` (seed-only input; DB is source of truth after first run)
- `apps/web/data/firetv-devices.json` — `{"devices":[]}` (seed-only input)
- `apps/web/data/device-subscriptions.json` — `{"devices":[]}`
- `apps/web/data/wolfpack-devices.json` — `{"chassis":[]}`
- `apps/web/data/channel-presets-cable.json` — `{"presets":[]}` (seeds ChannelPreset table on first run, per-location)
- `apps/web/data/channel-presets-directv.json` — `{"presets":[]}` (same)
- `apps/web/data/everpass-devices.json` — `{"devices":[]}` (if present)
- `apps/web/data/atlas-configs/` — Audio processor configs (gitignored, never on main)
- `apps/web/public/uploads/layouts/` — Floor plan images (gitignored)
- `data/` mirrors at repo root — Root copies of the above (gitignored via `data/*.json` with `!data/*.template.json` exception)
- `.env` — `LOCATION_ID`, `LOCATION_NAME`, `AUTH_COOKIE_SECURE`, `SPORTS_GUIDE_USER_ID`, API keys (gitignored)

### Auth bootstrap (critical per-location step)

Per-location install also requires seeding the `Location` row and
`AuthPin` rows in `production.db`, plus setting `LOCATION_ID` in `.env`,
or every login attempt returns "Invalid PIN". See
`docs/NEW_LOCATION_SETUP.md` for the full runbook and use
`scripts/bootstrap-new-location.sh` to automate steps 4-5:

```bash
bash scripts/bootstrap-new-location.sh \
  --name "Your Bar Name" \
  --admin-pin 7819 \
  --staff-pin 1234
```

The script is idempotent — safe to re-run. It creates the Location row
if missing, seeds STAFF and ADMIN PINs if missing, and writes
`LOCATION_ID` / `AUTH_COOKIE_SECURE=false` into `.env`. `AUTH_COOKIE_SECURE`
must be `false` on HTTP-only LAN deployments; browsers silently drop
`Secure` cookies on `http://` origins, so setting it `true` on HTTP
causes login to "succeed" but every subsequent request to look
unauthenticated.

### Workflow: Pulling Code Updates to a Location

**Preferred:** let `scripts/auto-update.sh` handle it. The orchestrator
has a `LOCATION_PATHS_OURS` conflict auto-resolver that keeps the
location's data files and applies main's software changes, backed up by
Claude Code CLI review at three checkpoints. Configure and enable it
via the Sync tab UI. See `docs/AUTO_UPDATE_SYSTEM_PLAN.md`.

**Manual fallback** (when auto-update isn't available):

```bash
git checkout location/<name>
git fetch origin
git merge origin/main
# On conflict with data files → keep the location version:
#   git checkout --ours apps/web/data/<file>
#   git checkout --theirs package-lock.json package.json
npm ci
npx drizzle-kit push --config drizzle.config.ts  # Create any new DB tables
npm run build
pm2 restart sports-bar-tv-controller --update-env
# Check logs for auto-seed: pm2 logs sports-bar-tv-controller --lines 20
# Look for: "[SEED] Seeded X DirecTV devices from JSON"
```

### Commit Strategy (IMPORTANT — this was broken historically and led to the v2.4.x drift)
- **Software changes** (code in `apps/web/src/`, `packages/`, docs, scripts) → commit to `main` first, then merge into location branches
- **Location-specific data** (device IPs, configs in `apps/web/data/*.json`, `.env`, layout images) → commit ONLY to the location branch
- **Never merge location branches back into main** — location data must not leak to other locations
- When making changes on a location branch, always split: software first to main, then merge main into location, then commit location data
- **If you find yourself editing a software file on a location branch**, stop, cherry-pick the change to main first, push main, then merge main into location. The reconciliation work in commit `7f13fbe7` is what happens when you don't.
- **Always pull before pushing to main** — run `git fetch origin main && git merge origin/main` before committing and pushing to `main`. Other locations or sessions may have pushed changes while you were working. Pushing without pulling risks rejected pushes or overwrites.

### Shared Location Reference Docs

See `.claude/locations/` for per-location details (device IPs, input maps, channel numbers).

## Documentation References

- API Reference: `/docs/API_REFERENCE.md`
- Hardware Setup: `/docs/HARDWARE_CONFIGURATION.md`
- IR Learning Demo: `/docs/IR_LEARNING_DEMO_SCRIPT.md`
- IR Emitter Placement: `/docs/IR_EMITTER_PLACEMENT_GUIDE.md`
- CEC → IR Migration (historical): `/docs/CEC_TO_IR_MIGRATION_GUIDE.md`
- Soundtrack Integration: `/docs/SOUNDTRACK_INTEGRATION_GUIDE.md`
- Authentication: `/docs/AUTHENTICATION_GUIDE.md`
- Wolf Pack HTTP API: `/docs/WOLFPACK_HTTP_API_REFERENCE.md`
- OBSBOT Tail 2 Plan: `/docs/OBSBOT_TAIL_2_PLAN.md`
- UI Styling Guide (dark theme): `/docs/UI_STYLING.md` — recommended pattern for new dashboard components.

## Bartender Remote - iPad/Tablet UI

**IMPORTANT:** The bartender remote (`/remote` on port 3002) is used on iPads and tablets behind the bar. All bartender-facing UI must be touch-screen friendly:

- **Minimum touch targets:** 44x44px (Apple Human Interface Guidelines)
- **Checkboxes:** At least `h-5 w-5`, wrapped in tappable containers with `py-2 px-3` padding
- **Buttons:** Generous padding, never icon-only without adequate tap area
- **Text size:** `text-sm` minimum for interactive elements (not `text-xs`)
- **Spacing:** `gap-2` minimum between tappable elements to prevent accidental taps
- **Port 3002 (Nginx proxy):** Nginx reverse proxy on port 3002 forwards to the Next.js app on port 3001, but restricts access to bartender-facing routes only (e.g., `/remote`, `/api/` endpoints needed by the remote). Admin pages like `/device-config`, `/matrix`, `/system` are blocked at the proxy level so bartenders cannot access them.
- **Bartender Proxy:** `apps/web/bartender-proxy.js` is a Node.js proxy alternative to Nginx for bartender route isolation
- **Test viewport:** ~768px-1024px width for tablet layouts
- **Music Tab:** Shows all playlists with artwork tiles, Now Playing displays album art
