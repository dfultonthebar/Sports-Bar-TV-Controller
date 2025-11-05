# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

### Local Development
```bash
npm run dev              # Start development server at http://localhost:3000
npm run build            # Production build (Next.js standalone mode)
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

### Database Operations
```bash
npm run db:generate      # Generate Drizzle migrations from schema changes
npm run db:push          # Push schema changes to database (no migration files)
npm run db:studio        # Open Drizzle Studio database GUI
```

**Database Architecture:**
- ORM: Drizzle ORM with SQLite
- Schema: `/src/db/schema.ts` (single file, ~40 tables)
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

### Next.js 15 App Router Architecture
**Framework:** Next.js 15.5.6 with App Router (not Pages Router)
- All routes in `/src/app/*` follow App Router conventions
- API routes: `/src/app/api/**` with route.ts files
- Pages: `/src/app/**/page.tsx` files
- Layouts: `/src/app/**/layout.tsx` files

### Core Systems

#### 1. Hardware Control Layer
**Location:** `/src/lib/` services
**Key Services:**
- `cable-box-cec-service.ts` - Pulse-Eight USB CEC adapter control for cable boxes
- `cec-client.ts` - HDMI-CEC TV power control
- `global-cache-api.ts` - IR blaster control (iTach IP2IR)
- `directv-client.ts` - DirecTV IP control
- `adb-client.ts` - Amazon Fire TV ADB control
- `atlas-*.ts` - AtlasIED audio processor control

**Command Queue Pattern:**
All hardware services use a command queue pattern to prevent concurrent access issues:
```typescript
private queueCommand(devicePath: string, fn: () => Promise<T>): Promise<T>
```

#### 2. Validation & Security Architecture
**Location:** `/src/lib/validation/` and `/src/lib/rate-limiting/`

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
- Schemas: `/src/lib/validation/schemas.ts` - Centralized Zod schemas

**Rate Limiting:**
All API endpoints are rate-limited using `/src/lib/rate-limiting/middleware.ts`:
```typescript
const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
if (!rateLimit.allowed) return rateLimit.response
```

#### 3. Database Architecture
**ORM:** Drizzle ORM (not Prisma - migration completed)
**Schema:** Single file at `/src/db/schema.ts` (~40 tables)
**Helpers:** `/src/lib/db-helpers.ts` - CRUD operations (findFirst, findMany, create, update, delete)

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
**Structured Logging:** `/src/lib/logger.ts`
```typescript
import { logger } from '@/lib/logger'

logger.info('[COMPONENT] Message', { context: 'data' })
logger.error('[COMPONENT] Error:', error)
logger.debug('[COMPONENT] Debug info')
```

**Enhanced Logging:** `/src/lib/enhanced-logger.ts` - Stores logs in database for System Admin analytics
**Component Tags:** Use `[COMPONENT]` prefix for searchable log filtering (e.g., `[CEC]`, `[MATRIX]`, `[IR]`)

#### 5. CEC Cable Box Control (Important for sports bars)
**Problem:** Spectrum/Charter cable boxes have CEC disabled in firmware
**Solution:** Must use IR control (iTach IP2IR) instead of CEC for Spectrum boxes
**CEC Support:** Works with Xfinity/Comcast cable boxes, but NOT Spectrum

**CEC Service:** `/src/lib/cable-box-cec-service.ts`
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
- `/src/lib/cec-commands.ts` - CEC user control code mappings
- `/src/components/remotes/CableBoxRemote.tsx` - Smart routing (CEC vs IR)
- `/src/components/BartenderRemoteSelector.tsx` - Channel preset UI

### API Route Patterns

#### Standard API Route Structure
```typescript
// /src/app/api/example/route.ts
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
**Location:** `/src/lib/auth/`
**Strategy:** NextAuth.js 4.24.11 with custom PIN-based authentication
**Session Storage:** Database sessions (not JWT)

**Key Files:**
- `middleware.ts` - Route protection
- `pin.ts` - PIN validation
- `session.ts` - Session management
- `api-key.ts` - API key authentication (for external integrations)

**Protected Routes:** `/src/app/login/` handles authentication UI

### Audio Control & Soundtrack Integration
**AtlasIED Integration:** `/src/lib/atlas-*.ts` services
- Real-time audio level monitoring
- AI-powered gain optimization
- Zone-specific control

**Soundtrack Your Brand:** Commercial music streaming for bars
- API integration: `/src/lib/soundtrack-api.ts`
- Now playing display
- Play/pause control from bartender remote

### Frontend Component Architecture
**UI Library:** Radix UI + Tailwind CSS
**State Management:** React hooks (no Redux/Zustand)
**Component Structure:**
- `/src/components/ui/` - Reusable UI primitives
- `/src/components/remotes/` - Device-specific remote controls
- `/src/components/streaming/`, `/src/components/directv/`, `/src/components/ir/` - Device type components

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
# 1. Edit /src/db/schema.ts
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
1. Create route file: `/src/app/api/your-endpoint/route.ts`
2. Add validation schema to `/src/lib/validation/schemas.ts` if needed
3. Add rate limit config to `/src/lib/rate-limiting/rate-limiter.ts` if needed
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
- `drizzle.config.ts` - Database configuration
- `next.config.js` - Next.js configuration
- `.env` or environment variables - API keys, database URL
- `/src/lib/validation/schemas.ts` - Centralized validation schemas
- `/src/lib/rate-limiting/rate-limiter.ts` - Rate limit configurations

#### 6. Memory Bank System
**Purpose:** Automatic project context snapshots for resume-after-restart capability

**Location:** `/src/lib/memory-bank/`
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

**Location:** `/src/lib/rag-server/`
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

**Location:** `/src/lib/ir-learning/` and `/src/app/api/ir-devices/learn/`
**Hardware Required:** Global Cache iTach IP2IR

**API Endpoints:**
- `POST /api/ir-devices/learn` - Start learning session
- `POST /api/ir-devices/send-command` - Send learned code (supports `isRawCode: true`)
- `GET /api/ir-devices` - List devices with learned codes

**Learning Flow:**
1. Frontend calls `/api/ir-devices/learn` with device ID, command name, iTach address
2. Backend sends `get_IRL` to iTach to enter learning mode
3. iTach waits for IR signal from physical remote (10s timeout)
4. Backend receives IR code (e.g., `sendir,1:1,1,38000,1,1,342,171,...`)
5. Code saved to database in `IRDevice.irCodes` JSON field
6. Frontend can test code by sending via `/api/ir-devices/send-command`

**Database Schema:**
```typescript
// schema.irDevices table
{
  id: string
  name: string
  iTachAddress: string
  portNumber: number
  irCodes: text // JSON: { "power": "sendir,...", "channel_up": "sendir,...", ... }
}
```

**Smart Remote Integration:**
The `CableBoxRemote` component automatically detects if `irCodes` exist and uses learned codes:
```typescript
if (device.irCodes && device.irCodes[command]) {
  // Use learned IR code
  await sendCommand({ isRawCode: true, command: device.irCodes[command] })
} else {
  // Fall back to pre-programmed codes or CEC
}
```

**Frontend UI Status:** Backend API complete, frontend UI at `/ir-learning` needs to be created
**See:** `/docs/IR_LEARNING_DEMO_SCRIPT.md` for complete implementation specification

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
