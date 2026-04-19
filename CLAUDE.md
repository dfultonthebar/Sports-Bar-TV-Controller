# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ READ FIRST — REQUIRED BEFORE ANY NON-TRIVIAL WORK

Before starting any task on this repo, you MUST read these two companion
guides in addition to this file. They hold the detailed rules that were
extracted from CLAUDE.md to keep it focused. Standing Rules 5, 7, and 8
below are just SUMMARIES — the full "how to apply" lives in those guides.

1. **`docs/CLAUDE_MEMORY_GUIDE.md`** — the three memory systems
   (auto-memory, Memory Bank, CLAUDE.md), how to sync between them, when
   to save vs. not save, and how Rules 5 and 7 apply to edge cases.

2. **`docs/CLAUDE_VERSIONING_GUIDE.md`** — version-bumping rules, the
   interlock between `VERSION_SETUP_GUIDE.md` / `LOCATION_UPDATE_NOTES.md`
   / CLAUDE.md, commit strategy for release changes, how auto-update's
   Checkpoint A/B/C consume these docs.

If you haven't read both, you're missing context needed to apply Standing
Rules 5, 7, and 8 correctly — and you will silently break cross-location
sync, memory propagation, or release tracking.

---

## V2 Monorepo Architecture

This project uses **Turborepo** with npm workspaces. The codebase is organized as:

```
/
├── apps/
│   └── web/              # Next.js 16 application (main app)
├── packages/             # 36+ shared packages
│   ├── atlas/           # AtlasIED audio processor control
│   ├── auth/            # Authentication utilities
│   ├── bss-blu/         # BSS Soundweb London BLU audio processors (HiQnet)
│   ├── cache-manager/   # Caching with TTL support
│   ├── circuit-breaker/ # Opossum circuit breaker wrapper
│   ├── config/          # Shared configuration (validation, rate limits, config tracking)
│   ├── crestron/        # Crestron DM matrix switcher control (Telnet/CIP)
│   ├── data/            # Static data files
│   ├── database/        # Drizzle ORM database layer
│   ├── dbx-zonepro/     # dbx ZonePRO audio processors (RS-232/TCP)
│   ├── directv/         # DirecTV IP control
│   ├── firecube/        # Amazon Fire TV/Cube ADB control
│   ├── ir-control/      # Global Cache IR blaster control
│   ├── logger/          # Structured logging
│   ├── rate-limiting/   # API rate limiting
│   ├── soundtrack/      # Soundtrack Your Brand API
│   ├── sports-apis/     # ESPN, NFL, etc. API clients
│   ├── streaming/       # Streaming platform integrations
│   ├── tv-guide/        # TV guide services (Gracenote, Spectrum)
│   ├── ui-utils/        # Tailwind CSS utilities (cn function)
│   ├── utils/           # Shared utilities
│   ├── validation/      # Zod schemas and validators
│   └── wolfpack/        # Atlas Wolf Pack matrix control
└── turbo.json           # Turborepo configuration
```

**Import Convention:** Use `@sports-bar/<package>` for shared packages:
```typescript
import { logger } from '@sports-bar/logger'
import { cn } from '@sports-bar/ui-utils'
import { wolfpackService } from '@sports-bar/wolfpack'
```

### Key Package: @sports-bar/config

**Location:** `packages/config/`
**Purpose:** Centralized configuration management, validation schemas, rate limiting policies, and configuration change tracking.

**Exports:**
```typescript
// Validation schemas (re-exported from @sports-bar/validation)
import { z, uuidSchema, deviceIdSchema } from '@sports-bar/config/validation'

// Rate limiting policies
import { RATE_LIMIT_POLICIES, getRateLimitForEndpoint } from '@sports-bar/config'

// Fire TV configuration
import { getFireTVConfig, calculateBackoffDelay } from '@sports-bar/config'

// Configuration change tracking
import {
  ConfigChangeTracker,
  createConfigChangeTracker,
  type ConfigChangeEvent
} from '@sports-bar/config'
```

**ConfigChangeTracker:**
- Monitors configuration files for changes using file system watchers
- Calculates checksums to detect modifications
- Integrates with auto-sync system for GitHub commits
- Uses dependency injection pattern for logger and HTTP client
- Framework-agnostic implementation (no Next.js dependencies)

**Bridge Pattern:** Apps use bridge files (`apps/web/src/lib/config-change-tracker.ts`) that:
1. Import the core implementation from `@sports-bar/config`
2. Provide app-specific adapters (logger, auto-sync client)
3. Export a configured singleton instance
4. Maintain backward compatibility with existing imports

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

#### 5. Cable Box Control (IR only — CEC is deprecated)
**The Wolf Pack HDMI matrix does NOT pass CEC signals.** All cable box control uses IR via Global Cache iTach IP2IR devices. CEC code exists in the codebase from earlier development but is non-functional at all current locations and should be removed.

**Cable Box Control Method:** IR commands via Global Cache iTach IP2IR
- Channel tuning sends learned IR codes for each digit
- Power management via IR power toggle
- IR codes stored in `IRCommand` table, learned via the IR Learning Panel

**Important Files:**
- `apps/web/src/components/remotes/CableBoxRemote.tsx` - Cable box remote (IR path)
- `apps/web/src/components/BartenderRemoteSelector.tsx` - Channel preset UI

**Legacy CEC code (to be removed):** `cable-box-cec-service.ts`, `cec-commands.ts`, CEC API routes, `CECCommandLog` table writes, EverPass CEC commands. These are dead code — the Wolf Pack matrix blocks CEC passthrough, and Spectrum boxes have CEC disabled in firmware.

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

#### 8. Wolf Pack Multi-Chassis Device Driver System
**Purpose:** Support multiple Wolf Pack matrices per location (e.g., video + audio breakaway)

**Architecture: JSON + Database Hybrid**
- **JSON driver file** (`apps/web/data/wolfpack-devices.json`) = source of truth for hardware topology (IP, model, inputs, outputs, credentials)
- **Database** (`matrixConfigurations` table with `chassisId` column) = runtime state (current routes, connection status)
- **Template on main:** `{"chassis":[]}` — real data lives on location branches only

**Key Files:**
- `packages/wolfpack/src/chassis-config.ts` — `WolfpackChassisConfig` interface
- `packages/wolfpack/src/models.ts` — Shared `WOLFPACK_MODELS` constant (single source of truth)
- `apps/web/src/lib/wolfpack/chassis-loader.ts` — Reads/caches JSON driver file
- `apps/web/src/lib/wolfpack/get-active-chassis.ts` — `getActiveChassisConfig(chassisId?)` helper
- `packages/wolfpack/src/matrix-control.ts` — `routeMatrix(input, output, chassisId?)` with optional chassis

**API Routes:**
- `GET /api/wolfpack/chassis` — List all chassis from JSON + DB status
- `GET /api/wolfpack/chassis/[chassisId]` — Single chassis config + runtime state
- `POST /api/wolfpack/chassis/[chassisId]/route` — Route input→output on specific chassis
- `GET /api/wolfpack/chassis/[chassisId]/routes` — Current routes for chassis
- `POST /api/wolfpack/chassis/sync` — Sync JSON driver → DB (create/update configs)

**Backward Compatibility:** All new DB columns are nullable. All API params are optional. Without `chassisId`, the system falls back to `WHERE isActive = true` (single-chassis behavior).

**Database Columns Added:**
- `matrixConfigurations.chassisId` — Links DB row to JSON driver entry
- `matrixRoutes.chassisId` — Which chassis this route belongs to
- `wolfpackMatrixRoutings.chassisId` — Chassis-specific routing
- `wolfpackMatrixStates.chassisId` — Chassis-specific state

#### 9. Wolf Pack Multi-View Card Control (Future Implementation)
**Purpose:** Control HDTVSupply Multi-View output cards installed in Wolf Pack matrix slots
**Compatibility:** Wolf Pack matrices ONLY (8x8, 16x16, 36x36)

**Hardware:** 4K60 Quad-View Output Card - plugs into Wolf Pack output card slots

**Display Modes (8 total):**
| Mode | Description | Hex Command Byte |
|------|-------------|------------------|
| 0 | Single Window | `32 00` |
| 1 | 2-Window Split | `32 01` |
| 2 | PIP Left Top | `32 02` |
| 3 | PIP Right Bottom | `32 03` |
| 4 | 3-Window (1 top, 2 bottom) | `32 04` |
| 5 | 3-Window Alt | `32 05` |
| 6 | 3-Window PIP x2 | `32 06` |
| 7 | 4-Window Quad | `32 07` |

**Control Protocol:**
- RS-232 via USB adapter: 115200 baud, 8-bit, 1 stop, no parity
- Serial port assignment: `/dev/ttyUSB0`, `/dev/ttyUSB1`, etc.
- Commands terminate with period (`.`)
- Response: "OK" or "ERR"

**Hex Command Format:**
```
EB 90 00 11 00 ff 32 [mode] 00 01 02 03 00 00 00 00 00 00
```

**Configuration Requirements:**
- **Slot Assignment:** Specify which Wolf Pack output slots (e.g., 21-24) the card occupies
- **Serial Port:** Assign USB serial port (e.g., `/dev/ttyUSB0`) for RS-232 control
- **Input Mapping:** Which Wolf Pack inputs feed the 4 multi-view windows

**Implementation Status:** Planned - requires:
- Database table: `WolfpackMultiViewCard` (name, startSlot, endSlot, serialPort, currentMode, inputAssignments)
- Package: `packages/multiview/` for serial communication and mode control
- API routes for mode switching and input assignment
- UI component in Matrix Control page for slot/serial port configuration
- Integration with existing Wolf Pack matrix routing display

#### 10. Atlas Audio AI Learning System
**Purpose:** Passive learning from Atlas audio processor operations to discover patterns

**Architecture: 3 Layers (same as Wolf Pack learning)**
1. **Event Collector** (`packages/atlas/src/atlas-learning-collector.ts`) — fire-and-forget recording of gain adjustments, clipping, zone changes, connection state
2. **Pattern Learner** (`packages/atlas/src/atlas-pattern-learner.ts`) — periodic analysis (every 6h) discovers 6 audio-specific pattern types
3. **Enhanced Analyzer** — `atlasAIAnalyzer.analyzeWithLearning()` blends static + learned patterns into existing `AtlasAIAnalysisResult`

**Database Table:** `AtlasLearningEvent` (eventType, processorId, inputNumber, zoneNumber, gain/level fields, dayOfWeek, hourOfDay)

**Event Types:** `gain_adjustment`, `gain_adjustment_failed`, `clipping_detected`, `zone_volume_change`, `zone_mute_toggle`, `zone_source_change`, `connection_online`, `connection_offline`, `signal_snapshot`

**6 Collector Functions:**
- `recordGainAdjustment()` — after successful AI gain set (wired into `ai-gain-service.ts`)
- `recordGainAdjustmentFailure()` — after failed AI gain set
- `recordClippingEvent()` — when meter reading has `clipping=true` (wired into `atlas-meter-service.ts`)
- `recordZoneChange()` — after volume/mute/source commands (wired into `audio-processor/control/route.ts`)
- `recordConnectionChange()` — processor online/offline transitions
- `recordSignalSnapshot()` — periodic (5-min throttled) JSON summary of all input levels

**6 Pattern Analysis Functions:**
- `analyzeInputHealth()` — chronic clipping inputs
- `analyzeGainEffectiveness()` — AI gain "fighting" (moving away from target >30%)
- `analyzeTimePatterns()` — peak clipping time windows (game nights)
- `analyzeZoneUsage()` — frequently muted or over-adjusted zones
- `analyzeProcessorReliability()` — connection drop frequency
- `analyzeAdjustmentEfficiency()` — inputs requiring excessive adjustments/day

**API Routes:**
- `GET /api/atlas/ai-learning` — Learning stats + cached patterns
- `POST /api/atlas/ai-learning` — Trigger learning cycle manually

**Instrumentation:** 90s warm-up delay (staggered 30s after wolfpack's 60s), then every 6 hours

### API Route Patterns

#### Standard API Route Structure
```typescript
// apps/web/src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas, z } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  // 1. Rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  // 2. Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.someSchema)
  if (!bodyValidation.success) return bodyValidation.error

  // 3. Use validated data (NOT request.json())
  const { field1, field2 } = bodyValidation.data

  try {
    // 4. Business logic
    const result = await someService.doSomething(field1, field2)

    // 5. Return response
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    logger.error('[COMPONENT] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

#### GET Request Validation
```typescript
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  // Query params validation (NOT body validation for GET)
  const queryValidation = validateQueryParams(request, z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  }))
  if (!queryValidation.success) return queryValidation.error

  const { page = 1, limit = 20 } = queryValidation.data
  // ... rest of handler
}
```

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

### 1. Request Body Consumption Bug
**Most common bug in this codebase:**
```typescript
// ❌ This will fail!
const validation = await validateRequestBody(request, schema)
const body = await request.json() // ERROR: body stream already consumed

// ✅ Correct approach
const validation = await validateRequestBody(request, schema)
const body = validation.data
```

### 2. GET Requests Don't Have Bodies
```typescript
// ❌ Wrong
export async function GET(request: NextRequest) {
  const bodyValidation = await validateRequestBody(request, schema) // ERROR!
}

// ✅ Correct
export async function GET(request: NextRequest) {
  const queryValidation = validateQueryParams(request, schema)
}
```

### 3. PM2 Requires Rebuild After Code Changes
```bash
# CRITICAL: Use --force to bypass Turbo cache for package changes
rm -rf apps/web/.next .turbo node_modules/.cache
npx turbo run build --force
pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js
```
**Why `--force`:** Turbo caches package builds. If you change code in `packages/*/src/`, plain `npm run build` may serve the old compiled version. This caused the Wolf Pack routing pre-check fix (v2.11.7) to not take effect at Holmgren Way despite correct source code.

**Why `delete` + `start` instead of `restart`:** `pm2 restart` and `--update-env` do NOT re-read `.env` via `ecosystem.config.js`. Only `delete` + `start` forces PM2 to re-execute `require('dotenv').config()` and pick up new env variables like `LOCATION_ID`.

### 4. Database Location Mismatch
- Development: May use different database
- Production: Always `/home/ubuntu/sports-bar-data/production.db`
- Configured in: `drizzle.config.ts` and environment variables

### 5. No CEC — IR Only
- **Wolf Pack matrix does NOT pass CEC signals** — CEC cannot work at any location using the matrix
- **All cable box control uses IR** via Global Cache iTach IP2IR
- **CEC code is legacy dead weight** — do not add new CEC features, plan to remove existing CEC code

### 5a. Matrix Config Per-Location Values (CRITICAL)

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

### 6. Device Data: DB is Source of Truth
- Devices are now stored in database tables (`DirecTVDevice`, `FireTVDevice`), not JSON files
- JSON files (`data/directv-devices.json`, `data/firetv-devices.json`) are only used for initial seeding
- All CRUD operations go through `apps/web/src/lib/device-db.ts`
- To re-seed from JSON: delete rows from the DB table, restart the app
- The `@sports-bar/directv` package still reads JSON for guide fetching (known tech debt)

### 7. drizzle-kit push Fails Silently on Pre-Existing Indexes
`npx drizzle-kit push` aborts entirely when it hits an index that already exists (e.g., `ApiKey_provider_keyName_key already exists`). Any tables or columns scheduled to be created AFTER that index in the push order are silently skipped. **Always verify new columns/tables exist after push:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA table_info(TableName);"
sqlite3 /home/ubuntu/sports-bar-data/production.db ".tables"
```
If a column is missing, add it manually with `ALTER TABLE ... ADD COLUMN`.

### 8. Location Data Files Get Blanked on Merge from Main
Main has empty template JSON files (`tv-layout.json` = 61 bytes, `directv-devices.json` = 15 bytes). When merging main into a location branch, git can silently overwrite real data with these templates if there's no conflict. **After every merge from main, verify:**
```bash
wc -c apps/web/data/tv-layout.json  # Must be >500 bytes at a configured location
```
If blanked, restore: `git show HEAD~1:apps/web/data/tv-layout.json > apps/web/data/tv-layout.json`

### 9. BartenderLayout Must Include Rooms
The bartender Video tab reads both `zones` and `rooms` from the `BartenderLayout` DB table (migrated from `tv-layout.json` in v2.11.0). If `rooms` is empty or the column is missing, the room filter tabs won't appear. The auto-seeder in `seed-from-json.ts` handles this for fresh installs. For existing locations, ensure the `rooms` column exists and is populated.

## Development Workflow

### Standing Rules (MUST follow in every session)

1. **Read docs before work, update docs after.** Before starting any non-trivial task, read `CLAUDE.md` and any `/docs/*.md` files relevant to the area being touched. After completing code changes, update the relevant docs — API references if routes changed, hardware guides if device config changed, CLAUDE.md if architecture/conventions changed. If you add a new feature with no matching doc, create one under `/docs/`. Never say "docs updated" unless you actually edited the file.

2. **Always commit and push after completing work.** After a unit of work is verified working (build passes, tests confirm), commit and push to GitHub automatically — do not wait for an explicit "please commit" instruction. Follow the commit strategy below (software to `main` first, then merge to location). Still confirm before destructive git operations (force push, reset, branch delete).

3. **Never break working features during cleanup.** Before deleting anything, establish positive evidence it's unused — zero callers, zero UI references, zero scheduled jobs. When in doubt, hide from UI before deleting code. Stage refactors into small verifiable steps. After each step, confirm build + PM2 restart + core flow sanity check. Never delete DB tables in the same pass as code changes.

4. **Force-rebuild when Turbo cache lies.** If `npm run build` completes in under 1 second with `FULL TURBO` and all tasks cached, the source changes did NOT get compiled. Run `npx turbo run build --force` (or `rm -rf apps/web/.next && npm run build`) to bypass the cache. This commonly happens after switching branches or cherry-picking.

5. **When told to "remember" something, update CLAUDE.md too.** Save to local auto-memory AND add to the appropriate CLAUDE.md section, then commit+push with a version bump so the rule propagates to every location. **Full application details in `docs/CLAUDE_MEMORY_GUIDE.md` → "Rule 5".** This rule interacts with the three memory systems — read the guide before applying.

6. **Always use `scripts/auto-update.sh` for updates.** When asked to update a location or "auto update yourself", run `bash scripts/auto-update.sh --triggered-by=manual_cli`. Never manually merge main, run npm ci, or restart PM2 — the script handles conflict resolution, DB schema push, backup creation, Turbo cache busting, PM2 restart, verify-install checks, and Claude checkpoint reviews. Manual updates skip safety checks and are error-prone.

7. **Sync memory ↔ CLAUDE.md bidirectionally on every read.** When reading CLAUDE.md (especially at auto-update Checkpoint B), diff it against host auto-memory in BOTH directions: CLAUDE.md→memory (save missing rules locally), memory→CLAUDE.md (promote location-only knowledge to shared). **Full application details in `docs/CLAUDE_MEMORY_GUIDE.md` → "Rule 7"**, including how to handle stale entries and conflict resolution.

8. **Read and CONTRIBUTE to `docs/VERSION_SETUP_GUIDE.md` on every update.** On auto-update, read the entry for the target version and execute its Required Manual Steps (or flag them). When bumping a version to main, write a new entry in the same commit. When fixing a location error, append to Known Errors & Fixes. **Full application details in `docs/CLAUDE_VERSIONING_GUIDE.md` → "Standing Rule 8"**, including the split between `VERSION_SETUP_GUIDE.md` (what-to-do) and `LOCATION_UPDATE_NOTES.md` (whether-to-update).

### Version Bumping (REQUIRED — every commit to main)
**Every commit pushed to `main` MUST include a version bump in root `package.json`.** Same commit or at minimum same push. Code-change-without-bump creates debugging hell when locations report matching versions for mismatched code. Minor bump for features/migrations; patch for bug fixes/docs. **Full rules in `docs/CLAUDE_VERSIONING_GUIDE.md` → "Version Bumping".**

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
```bash
# Test CEC adapters
npm run test:hardware

# Test specific device type
npm run test:api -- --testPathPattern=cec

# Manual hardware testing via API
curl -X POST http://localhost:3001/api/cec/cable-box/test \
  -H "Content-Type: application/json" \
  -d '{"cableBoxId": "cable-box-1", "command": "power"}'
```

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

#### 8a. Sports Guide Admin Consolidation (v2.4.0, April 2026)

The admin UI for Sports Guide, Smart Scheduler, and AI Game Plan is being consolidated into a single `/sports-guide-admin` page with 8 tabs (Guide, Games, Schedule, Home Teams, Channels, Providers, Configuration, Logs). The bartender remote at `/remote` is **not** affected. See `docs/SPORTS_GUIDE_ADMIN_CONSOLIDATION.md` for the full plan and per-item disposition.

**Phase A completed in v2.4.0** — dead-weight cleanup. 16 unused API routes deleted, 7 orphaned components/pages deleted, 1 stale bootstrap script deleted, broken `/scheduler` nav link fixed to point at `/scheduling`, Leagues tab hidden in `/sports-guide-config`. Net change: 4,961 lines deleted, 12 added, zero regressions.

**Deleted routes** (never reintroduce these unless designing something new): `/api/scheduler/{status,manage,settings,system-state,test-match,distribution-plan}`, `/api/schedules/{logs,by-game}`, `/api/scheduling/{analyze,auto-reallocate}`, `/api/sports-guide/{test-providers,current-time,channels,ollama/query,scheduled}`, `/api/channel-presets/statistics`.

**Kept despite zero UI callers** (internal cron callers in `packages/scheduler/src/scheduler-service.ts`): `/api/sports-guide/cleanup-old` (line 516), `/api/scheduling/live-status` (line 885). Do not delete these without updating the caller.

**Phase B completed in v2.4.0** — new `/sports-guide-admin` page with 8 tabs wrapping existing components. Old pages still live on disk unchanged.

**Phase C completed in v2.4.1** — navigation consolidated to a single "Sports Guide" entry pointing at `/sports-guide-admin`. Next.js `redirects()` forward `/sports-guide`, `/sports-guide-config`, `/ai-gameplan`, `/scheduling` to the corresponding tabs (307 temporary redirects). Admin page honors `?tab=` query param for deep links. Dashboard home card updated.

**Phase D completed in v2.4.4** — old page files deleted (`/sports-guide`, `/sports-guide-config`, `/ai-gameplan`, `/scheduling`), the orphaned `LegacySchedulingManager.tsx` (1,314 unused lines) removed, and the `/system-admin` Scheduler tab deleted. Old URLs still work as bookmarks because the Next.js `redirects()` rules in `next.config.js` are preserved — they fire before page resolution. **Consolidation is now complete.**

#### 9. AI Scheduling Intelligence
**Purpose:** Smart scheduling recommendations using pattern analysis and local AI (Ollama)

**Key Components:**
- **Pattern Analyzer** (`packages/scheduler/src/pattern-analyzer.ts`) - Analyzes historical viewing patterns to predict optimal channel assignments
- **AI Suggestions** (`apps/web/src/app/api/scheduling/ai-suggest/route.ts`) - Uses Ollama LLM (llama3.1:8b, 90s timeout) to generate scheduling recommendations
- **Scheduling Preferences** - Per-location configuration for preferred sports, channels, and time slots
- **Default Source Configuration** - Fallback source assignments for TVs when no scheduled content is active
- **DJ Mode Control** - Override mode that locks TV assignments for special events, preventing automatic scheduling changes

**API Endpoints:**
- `GET/POST /api/scheduling/preferences` - Manage scheduling preferences
- `GET /api/scheduling/suggestions` - Get AI-powered scheduling suggestions
- `POST /api/scheduling/apply` - Apply a scheduling suggestion

**AI Game Monitor Schedule (auto-created):** The AI Auto Pilot feature (`GET /api/schedules/ai-game-plan`) requires a row in the `Schedule` table with `scheduleType='continuous'`. As of v2.3.0, this row is **auto-created on first use** if missing — no manual setup required. The auto-create looks up home team IDs from the `HomeTeam` table by case-insensitive name match for Packers/Bucks/Brewers/Badgers. If `HomeTeam` is empty, the row is still created but with `homeTeamIds: "[]"` and Auto Pilot runs without home-team prioritization. Populate the `HomeTeam` table to enable prioritization. See `docs/SCHEDULER_FIXES_APRIL_2026.md` for full details.

**ESPN Sync (automatic):** As of v2.3.0, ESPN game data is synced automatically on startup (30s after Next.js boot) and then every 60 minutes. This is wired into `apps/web/src/instrumentation.ts` via `espnSyncService.syncLeague()` from `@sports-bar/scheduler`, covering MLB, NBA, NHL, NFL, college football, men's college basketball, and women's college basketball. Data lands in the `game_schedules` table with lowercase league labels (e.g. `"mlb"`, `"nba"`). Prior to this fix, the sync existed but was never invoked — new installations had empty `game_schedules` until someone manually hit `POST /api/scheduling/sync`.

**Bartender-Schedule POST — tvOutputIds handling:** `POST /api/schedules/bartender-schedule` accepts `tvOutputIds: number[]` in the body (the matrix output channel numbers the bartender is assigning). This field is **optional** — the bartender-remote Guide tab flow creates the allocation without it and then PATCHes outputs from a prior allocation on the same device. The AI-suggestion approve flow sends outputs inline. Prior to v2.3.0 this field was silently dropped entirely and the insert hardcoded `JSON.stringify([])`, which broke the downstream allocator and auto-revert flows. If the team-name + start-time lookup against `game_schedules` fails, the route now returns 404 with a clear message pointing at the sync as the likely cause.

**Channel Guide fallback to game_schedules:** `POST /api/channel-guide` (used by the bartender remote's Guide tab) is primarily backed by The Rail Media API (`guide.thedailyrail.com`), which only covers nationally-televised games and a subset of RSN broadcasts — it misses many regional games (e.g., the Brewers game on Brewers.TV when Rail doesn't include it). As of v2.3.0, after the Rail Media loop the route queries our local `game_schedules` table for games in the same time window and injects any whose `broadcast_networks` array resolves to a user preset via the `stationToPreset` lookup (with station-alias fallback). Deduped against Rail programs by channel + team matchup. See `docs/SCHEDULER_FIXES_APRIL_2026.md` section 5 for details.

**Station alias conventions for Wisconsin RSNs:** Green Bay area Spectrum cable has TWO Wisconsin RSN channels that must be kept separate:
- **Channel 40** ("Fan Duel" preset) — main WI RSN, carries Bucks and general WI sports. ESPN and The Rail Media use station code `FSWI`. Aliases live under the `FanDuelWI` standard_name in the `station_aliases` table.
- **Channel 308** ("Bally Sports WI" preset) — **Brewers-only** overflow feed. ESPN tags these broadcasts as `Brewers.TV`. Aliases live under the `BallyWIPlus` standard_name.

Never combine them into a single alias bundle or Bucks games will wrongly route to 308. See `apps/web/src/lib/seed-from-json.ts` for the canonical alias lists that seed new installations.

**channel_guide normalizeStation:** The helper strips `HD`, `NETWORK`, `CHANNEL`, and `-TV` suffixes, and removes spaces and dashes, before matching. If adding new alias entries, ensure at least one alias in the list normalizes to the target preset's name (also normalized) so the preset-build loop can link the alias to the preset.

**Override-learn hook (v2.18.0):** When a bartender issues a manual matrix route (`POST /api/matrix/route` with `source='bartender'`) within 10 minutes of an active/pending `input_source_allocation` being created, the route handler patches that allocation's `tv_output_ids` to reflect the bartender's correction. Logic: if the new `inputNum` matches the allocation's mapped input → add `outputNum` to the list; if `outputNum` was in the list but the new input is different → remove it. Every patch writes a `SchedulerLog` row with `component='override-learn'`, operation `add`/`remove`, and full metadata (prev/new outputs, team, league, `isHomeTeam`). Home-team overrides (teams matched against the `HomeTeam` table — Brewers, Bucks, Badgers, etc.) log at `level='warn'` so operators can filter the strongest signals. Why it matters: `pattern-analyzer.ts` reads `tv_output_ids` hourly to build team-routing patterns. Since bartenders often know the room's sight-lines better than the original scheduler, their corrections within the first 10 min of a tune are the highest-quality training signal we have. Manual changes made after the 10-minute window are treated as unrelated decisions and are not learned from.

#### 9a. Live Channel Mapping (Network → Channel)
**Purpose:** Map ESPN broadcast network names to local channel numbers for live game display

**Location:** `apps/web/src/app/api/sports-guide/live-by-channel/route.ts`

**How it works:** ESPN API returns broadcast info like `"FanDuel SN WI"` or `"Bucks.TV"`. The `NETWORK_TO_CABLE` and `NETWORK_TO_DIRECTV` dictionaries map these to local channel numbers so games appear in the bartender's live games section.

**Adding New Mappings:** When a game doesn't appear in live games, check the ESPN API response for the exact network name, then add it to both mapping dictionaries in `live-by-channel/route.ts`.

**Common Mapping Issues:** ESPN uses different names than expected (e.g., `"FanDuel SN WI"` instead of `"Bally Sports Wisconsin"`). Add ALL known variants for each regional sports network.

#### 10. Holmgren Way Hardware Configuration
**Location:** Holmgren Way sports bar (current active installation)

**Source Devices (13 total):**
- **4 Spectrum Cable Boxes** - IR control via Global Cache iTach IP2IR at 192.168.4.40 (ports 1-2) and 192.168.4.41 (ports 1-2)
- **6 DirecTV Receivers** - IP control at 192.168.4.42 through 192.168.4.47, port 8080
- **3 Fire TV Cubes** - ADB control at 192.168.4.49, .50, .51, port 5555
- **1 Atmosphere TV** - ADB control at 192.168.4.48, port 5555

**Display Devices:**
- **24 Samsung TVs** - 192.168.4.1 through 192.168.4.27 (Samsung SmartThings/WoL)
- **1 VAVA Projector** - 192.168.4.15 (CAUTION: power off/sleep kills NIC, power off is blocked)
- **1 Epson Projector** - 192.168.4.14

**Audio & Lighting:**
- **AtlasIED AZM8 Audio Processor** - 192.168.4.246, TCP port 5321
- **PKnight CR011R ArtNet DMX Controller** - 192.168.4.240, universe 1

**Matrix Switching:**
- **Wolf Pack 48-port HDMI Matrix** - Outputs 37-40 are audio outputs (not video displays)

**IR Port Adjustment (CRITICAL):**
All learned IR codes have `sendir,1:1,...` hardcoded (port 1 on module 1). When sending commands, the system must replace the port address with the device's configured `globalCachePortNumber` before transmission. For multi-port Global Cache devices (iTach with 3 IR ports), sending to the wrong port means the wrong emitter fires.

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
- CEC Implementation: `/docs/CEC_CABLE_BOX_IMPLEMENTATION.md` (deprecated for Spectrum boxes)
- CEC Deprecation: `/docs/CEC_DEPRECATION_NOTICE.md`
- IR Learning Demo: `/docs/IR_LEARNING_DEMO_SCRIPT.md`
- IR Emitter Placement: `/docs/IR_EMITTER_PLACEMENT_GUIDE.md`
- CEC to IR Migration: `/docs/CEC_TO_IR_MIGRATION_GUIDE.md`
- Soundtrack Integration: `/docs/SOUNDTRACK_INTEGRATION_GUIDE.md`
- Authentication: `/docs/AUTHENTICATION_GUIDE.md`
- Wolf Pack HTTP API: `/docs/WOLFPACK_HTTP_API_REFERENCE.md`

## UI Styling Guide - Location Tab Style (Dark Theme)

When creating new dashboard components, follow the **Location tab** styling patterns. This approach uses bordered divs with dark backgrounds throughout - **no white backgrounds or Card components**.

### Core Principles
- **NO Card components** - Use bordered divs instead
- **NO white backgrounds** - All backgrounds are dark slate variants
- **Consistent borders** - Use `border-slate-700` for sections
- **Semi-transparent backgrounds** - Use opacity modifiers like `bg-slate-800/50`

### Section Container Pattern
```tsx
// Main section wrapper - matching Location tab style
<div className="rounded-lg border border-slate-700 p-6">
  <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
    <IconName className="h-5 w-5 text-blue-400" />
    Section Title
  </h3>
  {/* Content */}
</div>
```

### Summary Stats Pattern
```tsx
// Stats row with dark backgrounds
<div className="grid grid-cols-4 gap-4 mb-6">
  <div className="rounded-lg bg-slate-800/50 p-4 flex items-center gap-3">
    <IconName className="h-8 w-8 text-blue-400" />
    <div>
      <p className="text-xs text-slate-400">Label</p>
      <p className="text-2xl font-bold text-white">Value</p>
    </div>
  </div>
</div>
```

### Form Inputs Pattern
```tsx
// Select dropdowns
<SelectTrigger className="bg-slate-800 border-slate-600">

// Text inputs
<Input className="bg-slate-800 border-slate-600" placeholder="..." />

// Buttons
<Button variant="outline" className="border-slate-600 hover:bg-slate-700">
```

### Color-Coded Badges
```tsx
const COMPONENT_COLORS: Record<string, string> = {
  'scheduler-service': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'auto-reallocator': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'distribution-engine': 'bg-green-500/20 text-green-400 border-green-500/30',
}

const OPERATION_COLORS: Record<string, string> = {
  'tune': 'bg-green-500/20 text-green-400 border-green-500/30',
  'recover': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'check': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'startup': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}
```

### Level Badges with Icons
- **Error:** `bg-red-500/20 text-red-400` with XCircle icon
- **Warning:** `bg-amber-500/20 text-amber-400` with AlertTriangle icon
- **Info:** `bg-blue-500/20 text-blue-400` with Activity icon
- **Debug:** `bg-slate-500/20 text-slate-400` with Search icon

### Table Styling
```tsx
// Table header
<thead className="bg-slate-800">
  <tr><th className="text-left p-3 text-slate-300 font-medium">...</th></tr>
</thead>

// Alternating rows
<tr className={index % 2 === 0 ? "bg-slate-800/30" : "bg-slate-800/50"}>

// Error/warning row backgrounds
className="bg-red-950/30"   // Error rows
className="bg-amber-950/20" // Warning rows
```

### Filter Labels Pattern
```tsx
<div className="space-y-2">
  <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
    <Calendar className="h-3 w-3" /> Time Range
  </label>
  <Select>
    <SelectTrigger className="bg-slate-800 border-slate-600">
      <SelectValue placeholder="Select..." />
    </SelectTrigger>
    ...
  </Select>
</div>
```

### Reference Component
See `apps/web/src/components/SchedulerLogsDashboard.tsx` for a complete implementation of this styling pattern.

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
