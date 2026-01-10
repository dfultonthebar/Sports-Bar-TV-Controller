# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## V2 Monorepo Architecture

This project uses **Turborepo** with npm workspaces. The codebase is organized as:

```
/
├── apps/
│   └── web/              # Next.js 16 application (main app)
├── packages/             # 24+ shared packages
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

#### 5. CEC Cable Box Control (Important for sports bars)
**Problem:** Spectrum/Charter cable boxes have CEC disabled in firmware
**Solution:** Must use IR control (iTach IP2IR) instead of CEC for Spectrum boxes
**CEC Support:** Works with Xfinity/Comcast cable boxes, but NOT Spectrum

**CEC Service:** `apps/web/src/lib/cable-box-cec-service.ts`
- Channel tuning via HDMI-CEC user control codes
- Power management
- Pulse-Eight USB CEC adapter support (multiple adapters at `/dev/ttyACM*`)

**Channel Tuning Flow:**
1. Frontend sends channel number to `/api/channel-presets/tune`
2. API looks up cable box CEC device path
3. Builds digit sequence (e.g., "27" → ["2", "7", "ENTER"])
4. Sends CEC user control codes via `cec-client` command
5. Logs success/failure to `CECCommandLog` table

**Important Files:**
- `apps/web/src/lib/cec-commands.ts` - CEC user control code mappings
- `apps/web/src/components/remotes/CableBoxRemote.tsx` - Smart routing (CEC vs IR)
- `apps/web/src/components/BartenderRemoteSelector.tsx` - Channel preset UI

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

**dbx ZonePRO (RS-232/TCP):**
- Models: 640, 640m, 641, 641m, 1260, 1260m, 1261, 1261m
- Protocol: RS-232 (serial) or TCP (port 3804)
- Control: Zone volume, mute, source routing

**UI Location:** Device Config page → Audio Processors section
**Component:** `apps/web/src/components/AudioProcessorManager.tsx`

#### 8. Wolf Pack Multi-View Card Control (Future Implementation)
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
npm run build  # Required before restart
pm2 restart sports-bar-tv-controller
```

### 4. Database Location Mismatch
- Development: May use different database
- Production: Always `/home/ubuntu/sports-bar-data/production.db`
- Configured in: `drizzle.config.ts` and environment variables

### 5. CEC vs IR Control
- **Spectrum cable boxes:** CEC is disabled by firmware → Use IR control
- **Xfinity cable boxes:** CEC works
- **Check device type** before assuming CEC support

## Development Workflow

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

#### 6. Memory Bank System
**Purpose:** Automatic project context snapshots for resume-after-restart capability

**Location:** `apps/web/src/lib/memory-bank/`
**CLI Commands:**
```bash
npm run memory:snapshot  # Create manual snapshot
npm run memory:restore   # View latest snapshot
npm run memory:list      # List all snapshots
npm run memory:stats     # Show storage statistics
npm run memory:watch     # Watch files and auto-snapshot (has ENOSPC issues, use carefully)
```

**API Endpoints:**
- `GET /api/memory-bank/current` - Get latest snapshot
- `GET /api/memory-bank/history` - List all snapshots
- `POST /api/memory-bank/snapshot` - Create new snapshot
- `POST /api/memory-bank/restore` - Restore specific snapshot

**What Gets Captured:**
- Git status (branch, commit, modified files)
- Modified file list (unstaged, staged, untracked)
- System state (database location, port, Node version)
- Quick resume commands

**Storage:** `/memory-bank/*.md` files (auto-cleanup keeps 30 most recent)

**Use Case:** When terminal/SSH session ends, Memory Bank preserves project state. Next Claude Code session can restore context instantly.

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

## Documentation References

- API Reference: `/docs/API_REFERENCE.md`
- Hardware Setup: `/docs/HARDWARE_CONFIGURATION.md`
- CEC Implementation: `/docs/CEC_CABLE_BOX_IMPLEMENTATION.md` (deprecated for Spectrum boxes)
- CEC Deprecation: `/docs/CEC_DEPRECATION_NOTICE.md`
- IR Learning Demo: `/docs/IR_LEARNING_DEMO_SCRIPT.md`
- IR Emitter Placement: `/docs/IR_EMITTER_PLACEMENT_GUIDE.md`
- CEC to IR Migration: `/docs/CEC_TO_IR_MIGRATION_GUIDE.md`
- Memory Bank Guide: `/MEMORY_BANK_IMPLEMENTATION.md`
- RAG Server Guide: `/RAG_IMPLEMENTATION_REPORT.md`
- RAG Quick Start: `/RAG_QUICK_START.md`
- Soundtrack Integration: `/docs/SOUNDTRACK_INTEGRATION_GUIDE.md`
- Authentication: `/docs/authentication/AUTHENTICATION_GUIDE.md`
