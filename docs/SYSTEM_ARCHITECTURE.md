# System Architecture

**Sports-Bar-TV-Controller** - Comprehensive Sports Bar Automation Platform

Last Updated: November 6, 2025

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [High-Level Architecture](#high-level-architecture)
3. [Directory Structure](#directory-structure)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Module Dependencies](#module-dependencies)
6. [Component Layers](#component-layers)
7. [Integration Points](#integration-points)
8. [Scalability & Performance](#scalability--performance)

---

## Technology Stack

### Frontend

- **Framework**: Next.js 15.5.6 (App Router)
- **UI Library**: React 19.x with TypeScript
- **Styling**: Tailwind CSS 3.x + Radix UI primitives
- **State Management**: React hooks (useState, useEffect, useContext)
- **Forms**: React Hook Form with Zod validation
- **HTTP Client**: Native fetch API with custom error handling

### Backend

- **Runtime**: Node.js 20.x
- **Framework**: Next.js 15 API Routes (App Router architecture)
- **Language**: TypeScript 5.x (100% type-safe, zero errors)
- **Validation**: Zod schemas with centralized middleware
- **Rate Limiting**: Custom in-memory rate limiter
- **Security**: bcrypt, CSRF protection, input sanitization

### Database

- **Database**: SQLite 3.x
- **ORM**: Drizzle ORM 0.x (migrated from Prisma)
- **Schema Management**: Drizzle Kit
- **Location**: `/home/ubuntu/sports-bar-data/production.db`
- **Backup**: Automated daily backups with rotation

### Infrastructure

- **Process Manager**: PM2 (fork mode)
- **Port**: 3001 (production)
- **Reverse Proxy**: None (direct access)
- **Operating System**: Ubuntu Linux 5.15.0-160
- **Init System**: systemd with PM2 startup script

### Hardware Integration

- **CEC Control**: libcec + cec-client (TV power control)
- **IR Control**: Global Cache iTach IP2IR (cable box control)
- **ADB Control**: Android Debug Bridge (Fire TV devices)
- **Audio Processing**: AtlasIED DSP processors (TCP/UDP)
- **HDMI Matrix**: Wolfpack/Monoprice 16x16 (TCP/UDP)

### AI & ML

- **LLM**: Ollama with llama3.1:8b (local)
- **Embeddings**: nomic-embed-text (vector search)
- **RAG Server**: Custom document search engine
- **Voice**: None (future consideration)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Browser   │  │ Bartender   │  │   Mobile    │             │
│  │   (Admin)   │  │   Tablet    │  │   Device    │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          └─────────────────┴─────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                    PRESENTATION LAYER                          │
│  ┌──────────────────────────────────────────────────────┐    │
│  │          Next.js 15 App Router (React)               │    │
│  │  /app/admin  /app/bartender  /app/login  /app/api    │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────┬───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                      API LAYER                                 │
│  ┌──────────────────────────────────────────────────────┐    │
│  │   Rate Limiting → Validation → Authorization          │    │
│  │   /api/firetv  /api/cec  /api/ir  /api/atlas  ...    │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────┬───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                   SERVICE LAYER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   Device    │  │   Audio     │  │   Content   │           │
│  │  Services   │  │  Services   │  │  Services   │           │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
└─────────┼─────────────────┼─────────────────┼─────────────────┘
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼─────────────────┐
│                   DATA ACCESS LAYER                            │
│  ┌──────────────────────────────────────────────────────┐    │
│  │   Drizzle ORM + db-helpers (CRUD abstraction)        │    │
│  │   Schema: 40+ tables, indexed, relational            │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────┬───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                     STORAGE LAYER                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │   SQLite Database (production.db)                    │    │
│  │   /home/ubuntu/sports-bar-data/production.db         │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                  HARDWARE ABSTRACTION LAYER                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  CEC Client │  │ Global Cache│  │  ADB Client │           │
│  │   (libcec)  │  │   (iTach)   │  │ (Fire TV)   │           │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
└─────────┼─────────────────┼─────────────────┼─────────────────┘
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼─────────────────┐
│                   PHYSICAL DEVICES                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  TVs (CEC)  │  │  Cable Boxes│  │  Fire TVs   │           │
│  │  16 units   │  │  (IR + ADB) │  │  (ADB)      │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│  ┌─────────────┐  ┌─────────────┐                             │
│  │ HDMI Matrix │  │ Atlas Audio │                             │
│  │  16x16      │  │  Processor  │                             │
│  └─────────────┘  └─────────────┘                             │
└───────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
/home/ubuntu/Sports-Bar-TV-Controller/
├── src/
│   ├── app/                      # Next.js 15 App Router
│   │   ├── (authenticated)/      # Protected routes (admin, bartender)
│   │   │   ├── admin/            # Admin dashboard pages
│   │   │   ├── bartender/        # Bartender interface pages
│   │   │   └── layout.tsx        # Authenticated layout wrapper
│   │   ├── api/                  # API route handlers
│   │   │   ├── auth/             # Authentication endpoints
│   │   │   ├── firetv/           # Fire TV control
│   │   │   ├── cec/              # CEC control (TV power)
│   │   │   ├── ir-devices/       # IR control (cable boxes)
│   │   │   ├── atlas/            # Audio processing
│   │   │   ├── matrix/           # HDMI matrix routing
│   │   │   ├── channel-presets/  # Quick channel access
│   │   │   └── ...               # 50+ API endpoints
│   │   ├── login/                # Login page
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Home redirect
│   │
│   ├── components/               # React components
│   │   ├── ui/                   # Radix UI primitives
│   │   ├── remotes/              # Device remote controls
│   │   ├── firetv/               # Fire TV components
│   │   ├── streaming/            # Streaming app components
│   │   ├── ir/                   # IR device components
│   │   ├── directv/              # DirecTV components
│   │   └── ...                   # Feature-specific components
│   │
│   ├── lib/                      # Business logic & services
│   │   ├── auth/                 # Authentication services
│   │   ├── validation/           # Zod schemas & middleware
│   │   ├── rate-limiting/        # Rate limiter implementation
│   │   ├── memory-bank/          # Project context snapshots
│   │   ├── rag-server/           # RAG documentation search
│   │   ├── services/             # Background services
│   │   ├── *-client.ts           # Hardware client libraries
│   │   ├── *-service.ts          # Business logic services
│   │   └── logger.ts             # Structured logging
│   │
│   ├── db/                       # Database layer
│   │   ├── schema.ts             # Drizzle schema (40+ tables)
│   │   ├── index.ts              # Database client
│   │   └── migrations/           # SQL migrations
│   │
│   └── config/                   # Configuration files
│       ├── firetv-config.ts      # Fire TV device config
│       └── ...                   # Other configs
│
├── docs/                         # Documentation (300+ files)
├── tests/                        # Test suites
├── public/                       # Static assets
├── memory-bank/                  # Context snapshots (auto-managed)
├── drizzle.config.ts            # Database configuration
├── ecosystem.config.js          # PM2 configuration
├── next.config.js               # Next.js configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies & scripts
```

---

## Data Flow Diagrams

### 1. User Request Flow (Fire TV Control)

```
┌─────────────┐
│   Browser   │ User clicks "Launch ESPN" on TV #5
└──────┬──────┘
       │ HTTP POST /api/firetv/[id]/launch-app
       │
┌──────▼──────────────────────────────────────────┐
│  API Route: /api/firetv/[id]/launch-app/route.ts│
│  1. Rate limiting check (100 req/min)            │
│  2. Request body validation (Zod schema)         │
│  3. Authentication check (session/API key)       │
└──────┬──────────────────────────────────────────┘
       │ Validated request
       │
┌──────▼──────────────────────────────────────────┐
│  Service: adb-client.ts                          │
│  1. Check device connection status               │
│  2. Build ADB command: "am start -n ..."         │
│  3. Queue command (prevents concurrent access)   │
│  4. Execute via TCP socket to Fire TV            │
└──────┬──────────────────────────────────────────┘
       │ Success/Failure response
       │
┌──────▼──────────────────────────────────────────┐
│  Database: enhanced-logger.ts                    │
│  1. Log command execution to database            │
│  2. Update device lastSeen timestamp             │
│  3. Track analytics for System Admin            │
└──────┬──────────────────────────────────────────┘
       │ Response data
       │
┌──────▼──────┐
│  API Response│ { success: true, appLaunched: "ESPN" }
└──────┬──────┘
       │
┌──────▼──────┐
│   Browser   │ UI updates to show ESPN launched
└─────────────┘
```

### 2. Health Monitoring Flow (Performance-Optimized)

```
┌─────────────────┐
│  PM2 Scheduler  │ Cron job runs every 5 minutes
└────────┬────────┘
         │
┌────────▼────────────────────────────────────────┐
│  Service: firetv-health-monitor.ts              │
│  1. Load active devices from config (not DB)    │
│  2. Parallel health checks (Promise.allSettled) │
│  3. Parse health status from responses          │
└────────┬────────────────────────────────────────┘
         │ Batch update operation
         │
┌────────▼────────────────────────────────────────┐
│  Database: Batch status update                  │
│  1. Single transaction for all devices          │
│  2. Update status & lastSeen timestamps         │
│  3. Minimal lock contention                     │
└────────┬────────────────────────────────────────┘
         │ Optional: Alert on failures
         │
┌────────▼────────────────────────────────────────┐
│  Logger: Record health check results            │
│  (Only log failures to reduce I/O)              │
└─────────────────────────────────────────────────┘
```

### 3. Authentication Flow (PIN-based)

```
┌─────────────┐
│   Browser   │ User enters 4-digit PIN
└──────┬──────┘
       │ HTTP POST /api/auth/login
       │ { pin: "1234" }
       │
┌──────▼──────────────────────────────────────────┐
│  API Route: /api/auth/login/route.ts            │
│  1. Rate limiting (5 attempts/minute)           │
│  2. Input validation (4-digit numeric PIN)      │
└──────┬──────────────────────────────────────────┘
       │ Validated PIN
       │
┌──────▼──────────────────────────────────────────┐
│  Service: auth/pin.ts                            │
│  1. Query AuthPin table by location             │
│  2. bcrypt compare against hashed PIN           │
│  3. Check if PIN is active & not expired        │
└──────┬──────────────────────────────────────────┘
       │ PIN valid
       │
┌──────▼──────────────────────────────────────────┐
│  Service: auth/session.ts                        │
│  1. Create Session record in database           │
│  2. Generate session ID (UUID)                   │
│  3. Set expiration (24 hours)                    │
│  4. Store IP address, user agent                │
└──────┬──────────────────────────────────────────┘
       │ Session created
       │
┌──────▼──────────────────────────────────────────┐
│  API Response: Set session cookie                │
│  { success: true, role: "STAFF", sessionId: "…" }│
└──────┬──────────────────────────────────────────┘
       │
┌──────▼──────┐
│   Browser   │ Redirect to /bartender or /admin
└─────────────┘
```

### 4. IR Learning Flow (Cable Box Control)

```
┌─────────────┐
│   Browser   │ User clicks "Learn Power Button"
└──────┬──────┘
       │ HTTP POST /api/ir-devices/learn
       │ { deviceId: "cable-box-1", command: "power" }
       │
┌──────▼──────────────────────────────────────────┐
│  API Route: /api/ir-devices/learn/route.ts      │
│  1. Validate device exists in database          │
│  2. Check iTach device is online                │
└──────┬──────────────────────────────────────────┘
       │ Device validated
       │
┌──────▼──────────────────────────────────────────┐
│  Service: global-cache-api.ts                    │
│  1. Send "get_IRL,1:1" to iTach via TCP         │
│  2. iTach enters learning mode (10s timeout)    │
│  3. Wait for IR signal from physical remote     │
└──────┬──────────────────────────────────────────┘
       │ User points remote at iTach IR receiver
       │
┌──────▼──────────────────────────────────────────┐
│  Global Cache iTach Device (Hardware)            │
│  1. IR sensor captures signal                   │
│  2. Converts to Pronto hex format               │
│  3. Returns: "sendir,1:1,1,38000,1,1,342,171…"  │
└──────┬──────────────────────────────────────────┘
       │ IR code received
       │
┌──────▼──────────────────────────────────────────┐
│  Database: Update IRDevice record                │
│  UPDATE irCodes JSON field:                      │
│  { "power": "sendir,1:1,1,38000,…" }            │
└──────┬──────────────────────────────────────────┘
       │
┌──────▼──────┐
│  API Response│ { success: true, irCode: "sendir,…" }
└──────┬──────┘
       │
┌──────▼──────┐
│   Browser   │ Show "Learned!" confirmation
└─────────────┘
```

---

## Module Dependencies

### Core Dependencies Graph

```
┌─────────────────────────────────────────────────────────────┐
│                     API Routes Layer                         │
│  All routes depend on:                                       │
│  • @/lib/validation → Input validation                       │
│  • @/lib/rate-limiting → Request throttling                  │
│  • @/lib/auth → Authentication checks                        │
│  • @/lib/logger → Structured logging                         │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│                   Service Layer                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Device Services (depend on Hardware Clients)       │   │
│  │  • firetv-health-monitor → adb-client               │   │
│  │  • cable-box-cec-service → cec-client               │   │
│  │  • global-cache-api (standalone TCP client)         │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Audio Services (depend on Atlas clients)           │   │
│  │  • atlas-http-client → HTTP API                     │   │
│  │  • atlas-tcp-client → TCP control                   │   │
│  │  • atlas-realtime-meter-service → UDP metering      │   │
│  │  • ai-gain-service → atlas-http-client              │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Content Services (depend on external APIs)         │   │
│  │  • streaming/unified-streaming-api                   │   │
│  │  • sports-apis/live-sports-service                   │   │
│  │  • gracenote-service (TV guide data)                │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│                  Data Access Layer                           │
│  All services depend on:                                     │
│  • @/db (Drizzle client)                                     │
│  • @/lib/db-helpers (CRUD helpers)                           │
│  • @/db/schema (type-safe table definitions)                │
└──────────────────────────────────────────────────────────────┘
```

### Hardware Client Dependencies

```
cec-client.ts (TV Power)
  └─ Requires: libcec installed on system
  └─ Uses: /dev/ttyACM0 (CEC adapter USB device)

adb-client.ts (Fire TV)
  └─ Requires: adb binary installed
  └─ Uses: TCP socket to Fire TV IP addresses

global-cache-api.ts (IR Control)
  └─ Requires: Network access to iTach device
  └─ Uses: TCP socket on port 4998

atlas-tcp-client.ts (Audio DSP)
  └─ Requires: Network access to Atlas processor
  └─ Uses: TCP socket on port 5321

matrix-control.ts (HDMI Matrix)
  └─ Requires: Network access to Wolfpack matrix
  └─ Uses: TCP socket on port 23 (Telnet)
```

---

## Component Layers

### 1. Presentation Layer (Frontend Components)

**Location**: `/src/components/`

```
React Components Tree:
├── Layout Components
│   ├── AdminLayout.tsx (admin dashboard wrapper)
│   ├── BartenderLayout.tsx (bartender UI wrapper)
│   └── AuthGuard.tsx (protected route wrapper)
│
├── Device Control Components
│   ├── remotes/FireTVRemote.tsx
│   ├── remotes/CableBoxRemote.tsx (smart routing: IR vs CEC)
│   ├── remotes/DirecTVRemote.tsx
│   └── remotes/AtlasAudioControl.tsx
│
├── Configuration Components
│   ├── firetv/DeviceManager.tsx
│   ├── ir/IRDeviceConfig.tsx
│   ├── matrix/MatrixConfigurator.tsx
│   └── atlas/ZoneConfigurator.tsx
│
├── Shared UI Components (Radix UI)
│   ├── ui/button.tsx
│   ├── ui/dialog.tsx
│   ├── ui/select.tsx
│   └── ui/toast.tsx (notifications)
│
└── Feature Components
    ├── BartenderRemoteSelector.tsx (channel preset UI)
    ├── TVLayoutViewer.tsx (16-TV grid display)
    └── HealthMonitorDashboard.tsx (device status)
```

**Key Patterns**:
- Server Components by default (Next.js 15)
- Client Components marked with `'use client'`
- Form state managed with React Hook Form
- Real-time updates via polling (no WebSocket yet)

### 2. API Layer (Route Handlers)

**Location**: `/src/app/api/`

```
API Endpoints (50+ routes):
├── Authentication
│   ├── POST /api/auth/login (PIN authentication)
│   ├── POST /api/auth/logout
│   └── GET  /api/auth/session (session validation)
│
├── Fire TV Control
│   ├── GET    /api/firetv (list all devices)
│   ├── POST   /api/firetv/[id]/launch-app
│   ├── POST   /api/firetv/[id]/send-keyevent
│   └── GET    /api/firetv/[id]/installed-apps
│
├── CEC Control (TV Power)
│   ├── POST   /api/cec/discover (scan for CEC devices)
│   ├── POST   /api/cec/tv/power (control TV power)
│   └── GET    /api/cec/devices (list CEC adapters)
│
├── IR Control (Cable Boxes)
│   ├── POST   /api/ir-devices/send-command
│   ├── POST   /api/ir-devices/learn (IR learning mode)
│   └── GET    /api/ir-devices (list IR devices)
│
├── Audio Processing
│   ├── GET    /api/atlas/zones
│   ├── POST   /api/atlas/zones/[id]/volume
│   ├── POST   /api/atlas/zones/[id]/source
│   └── GET    /api/atlas/meters/realtime (UDP metering)
│
├── HDMI Matrix
│   ├── POST   /api/matrix/route (input → output routing)
│   ├── GET    /api/matrix/status
│   └── POST   /api/matrix/batch-route (multiple routes)
│
├── Channel Presets
│   ├── GET    /api/channel-presets
│   ├── POST   /api/channel-presets/tune
│   └── PUT    /api/channel-presets/[id]
│
└── System Management
    ├── GET    /api/health (system health check)
    ├── GET    /api/logs/recent
    └── POST   /api/system/restart (PM2 restart)
```

**Standard Middleware Chain**:
```typescript
Request → Rate Limiter → Validator → Authenticator → Handler → Response
```

### 3. Service Layer (Business Logic)

**Location**: `/src/lib/`

**Device Services**:
- `adb-client.ts` - Fire TV ADB control (command queue pattern)
- `cec-client.ts` - TV power via HDMI-CEC
- `cable-box-cec-service.ts` - DEPRECATED (use IR instead)
- `global-cache-api.ts` - IR blaster control (iTach)
- `directv-client.ts` - DirecTV IP control (SHEF protocol)

**Audio Services**:
- `atlas-http-client.ts` - HTTP API for Atlas DSP
- `atlas-tcp-client.ts` - TCP control for Atlas DSP
- `atlas-realtime-meter-service.ts` - UDP audio metering
- `ai-gain-service.ts` - AI-powered audio leveling

**Content Services**:
- `unified-tv-guide-service.ts` - TV guide aggregation
- `streaming/unified-streaming-api.ts` - Streaming app discovery
- `sports-apis/live-sports-service.ts` - Live sports schedules
- `gracenote-service.ts` - Gracenote TV data

**Utility Services**:
- `logger.ts` - Structured logging
- `enhanced-logger.ts` - Database logging for analytics
- `cache-service.ts` - In-memory caching
- `db-helpers.ts` - CRUD abstraction over Drizzle

### 4. Data Access Layer

**Location**: `/src/db/`

**Schema Organization** (40+ tables):
```
Device Management:
  • FireTVDevice, DirecTVDevice, CECDevice
  • IRDevice, GlobalCacheDevice, GlobalCachePort
  • CableBox (deprecated, use IRDevice)

Configuration:
  • MatrixConfiguration, MatrixInput, MatrixOutput
  • AudioProcessor, AudioZone, AudioGroup
  • TVLayout, MatrixConfig, SystemSettings

Content & Scheduling:
  • ChannelPreset, Schedule, ScheduleLog
  • HomeTeam, SportsEvent, SelectedLeague
  • SportsEventSyncLog

Authentication & Security:
  • Location, AuthPin, Session, AuthApiKey
  • AuditLog, SecurityValidationLog

Audio & Media:
  • AudioScene, AudioMessage, AudioInputMeter
  • SoundtrackConfig, SoundtrackPlayer
  • AtlasParameter, AtlasMeterReading

AI & Training:
  • QAEntry, TrainingDocument, IndexedFile
  • QAGenerationJob, ProcessedFile
  • ChatSession, Document

Logging & Analytics:
  • TestLog, CECCommandLog, N8nWebhookLog
  • OperationLog (via enhanced-logger)
```

**Access Patterns**:
```typescript
// Direct Drizzle access
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

const devices = await db.select()
  .from(schema.fireTVDevices)
  .where(eq(schema.fireTVDevices.status, 'online'))

// Helper abstraction
import { findFirst, findMany, create } from '@/lib/db-helpers'

const device = await findFirst('fireTVDevices', {
  where: eq(schema.fireTVDevices.id, deviceId)
})
```

---

## Integration Points

### 1. External Hardware

| Device Type | Protocol | Connection | Library/Tool |
|-------------|----------|------------|--------------|
| Fire TV | ADB over TCP | Wi-Fi (port 5555) | `adb` binary |
| Cable Box | IR (Global Cache) | Ethernet (port 4998) | TCP socket |
| TV Power | CEC (Pulse-Eight) | USB (/dev/ttyACM0) | `cec-client` |
| HDMI Matrix | TCP/Telnet | Ethernet (port 23) | TCP socket |
| Audio DSP | HTTP + TCP + UDP | Ethernet (80/5321/3131) | Multiple clients |
| DirecTV | SHEF Protocol | Ethernet (port 8080) | HTTP client |

### 2. External APIs

| Service | Purpose | Authentication | Rate Limits |
|---------|---------|----------------|-------------|
| Soundtrack Your Brand | Commercial music | API key | 100 req/min |
| TheSportsDB | Sports schedules | API key | 1000 req/day |
| ESPN API | Live sports data | None | Unknown |
| Gracenote | TV guide data | Account | Metered |
| NFHS Network | High school sports | OAuth | Unknown |

### 3. Internal Services

| Service | Purpose | Communication |
|---------|---------|---------------|
| Ollama | Local LLM | HTTP (port 11434) |
| RAG Server | Doc search | In-process |
| PM2 | Process management | IPC |
| Cron Jobs | Scheduled tasks | PM2 cron |

---

## Scalability & Performance

### Current Performance Metrics

- **API Response Time**: 50-200ms (avg)
- **Database Queries**: <10ms (indexed)
- **Concurrent Users**: 10-20 (typical bar staff)
- **Device Capacity**: 16 TVs, 16 Fire TVs, 8+ cable boxes
- **Health Check Interval**: 5 minutes (optimized from 1 minute)

### Optimization Strategies Implemented

1. **Health Monitoring Optimization**:
   - Moved from DB queries to config file reads
   - Batch database updates in single transaction
   - Parallel device checks with Promise.allSettled
   - Reduced check frequency from 1min → 5min
   - Result: 70% reduction in database load

2. **Rate Limiting**:
   - In-memory sliding window (no DB overhead)
   - Per-endpoint configurations
   - Automatic cleanup of expired entries

3. **Database Indexing**:
   - All foreign keys indexed
   - Timestamp columns indexed for logs
   - Composite indexes for common queries
   - Unique indexes to prevent duplicates

4. **Caching Strategy**:
   - Fire TV app lists cached (15 minutes)
   - Device status cached (30 seconds)
   - TV guide data cached (1 hour)
   - No cache for real-time controls

5. **Command Queue Pattern**:
   - Prevents concurrent hardware access
   - Queues commands per device
   - Timeouts prevent deadlocks
   - Used in: ADB, CEC, IR, Matrix services

### Scalability Limits

**Current Architecture**:
- Single-location deployment
- Single SQLite database (no replication)
- In-memory rate limiting (no Redis)
- No horizontal scaling

**Multi-Location Roadmap** (documented in `/docs/MULTI_LOCATION_ARCHITECTURE.md`):
- PostgreSQL migration (multi-tenancy)
- Redis for distributed caching
- API gateway for authentication
- Per-location database isolation

---

## Architecture Decision Records

### Key Decisions

1. **Next.js App Router over Pages Router**
   - Rationale: Better TypeScript support, server components, simpler data fetching
   - Trade-off: Smaller ecosystem compared to Pages Router

2. **Drizzle ORM over Prisma**
   - Rationale: Lighter weight, better SQLite support, zero overhead
   - Trade-off: Less mature ecosystem, manual migrations

3. **SQLite over PostgreSQL**
   - Rationale: Single-location deployment, simpler backups, no network overhead
   - Trade-off: Not suitable for multi-location without migration

4. **IR Control over CEC for Cable Boxes**
   - Rationale: Spectrum cable boxes have CEC disabled in firmware
   - Trade-off: Requires IR emitter placement, learning process

5. **In-Memory Rate Limiting over Redis**
   - Rationale: Single-server deployment, no external dependencies
   - Trade-off: Rate limits reset on server restart

6. **PM2 Fork Mode over Cluster Mode**
   - Rationale: SQLite doesn't support concurrent writes well
   - Trade-off: No automatic load balancing across CPU cores

---

## Related Documentation

- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Complete table documentation
- [SERVICE_ARCHITECTURE.md](./SERVICE_ARCHITECTURE.md) - Service layer details
- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md) - Security model
- [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md) - Production setup
- [CODE_PATTERNS.md](./CODE_PATTERNS.md) - Common code patterns
- [CLAUDE.md](../CLAUDE.md) - Developer quick reference
