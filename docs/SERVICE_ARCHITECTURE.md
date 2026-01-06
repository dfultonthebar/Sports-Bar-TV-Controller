# Service Architecture Documentation

**Sports-Bar-TV-Controller Service Layer**

Last Updated: November 6, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Device Control Services](#device-control-services)
3. [Audio Processing Services](#audio-processing-services)
4. [Content & Integration Services](#content--integration-services)
5. [Utility & Infrastructure Services](#utility--infrastructure-services)
6. [Common Service Patterns](#common-service-patterns)
7. [Service Dependency Graph](#service-dependency-graph)
8. [Error Handling Strategies](#error-handling-strategies)

---

## Overview

The service layer encapsulates business logic and hardware integration. All services follow consistent patterns for error handling, logging, and command queuing.

### Service Categories

| Category | Count | Purpose |
|----------|-------|---------|
| Device Control | 8 | Hardware device communication |
| Audio Processing | 5 | AtlasIED audio DSP control |
| Content Services | 6 | TV guide, streaming, sports data |
| Utility Services | 10 | Logging, caching, validation |
| Background Services | 4 | Scheduled tasks, monitoring |

---

## Device Control Services

### ADB Client (`/src/lib/firecube/adb-client.ts`)

**Purpose**: Fire TV device control via Android Debug Bridge

**Class**: `ADBClient`

**Constructor**:
```typescript
constructor(ipAddress: string, port: number = 5555, options: ADBConnectionOptions)
```

**Key Methods**:
- `connect(): Promise<boolean>` - Establish ADB connection
- `disconnect(): Promise<void>` - Close connection
- `executeShellCommand(command: string): Promise<string>` - Execute shell command
- `launchApp(packageName: string): Promise<boolean>` - Launch application
- `sendKeyEvent(keyCode: number): Promise<boolean>` - Send remote key
- `getInstalledPackages(): Promise<string[]>` - List installed apps
- `checkConnectionStatus(): Promise<boolean>` - Verify connection

**Features**:
- **Command Queue**: Prevents concurrent command execution
- **Keep-Alive**: Automatic connection maintenance (30s interval)
- **Auto-Reconnect**: Reconnects after 3 consecutive failures
- **Timeout Protection**: 5-second command timeout

**Dependencies**:
- `adb` binary (system)
- `@/lib/logger`

**Error Handling**:
```typescript
try {
  await adbClient.connect()
} catch (error) {
  if (error.message.includes('adb') && error.message.includes('not found')) {
    // ADB not installed
  }
  if (error.message.includes('timeout')) {
    // Connection timeout
  }
  if (error.message.includes('offline')) {
    // Device offline
  }
}
```

---

### Global Cache API (`/src/lib/global-cache-api.ts`)

**Purpose**: IR blaster control via Global Cache iTach IP2IR

**Exported Functions**:
- `sendIRCommand(deviceId, command)` - Send pre-programmed IR code
- `sendRawIRCommand(iTachAddress, rawCode)` - Send learned IR code
- `learnIRCode(iTachAddress, port, timeout)` - Capture IR signal
- `testConnection(iTachAddress)` - Verify iTach connectivity

**IR Code Format** (Pronto Hex):
```
sendir,1:1,1,38000,1,1,342,171,21,21,21,64,21,64,21...
│      │ │ │     │ │ └─ Burst pairs
│      │ │ │     │ └─ On/Off times
│      │ │ │     └─ Repeat count
│      │ │ └─ Carrier frequency (Hz)
│      │ └─ IR ID
│      └─ Module:Port
└─ Command type
```

**Connection Protocol**: TCP on port 4998

**Command Flow**:
```
1. Open TCP socket to iTach (port 4998)
2. Send IR command string
3. Wait for "completeir" response
4. Close socket
5. Log result to database
```

**Error Codes**:
- `ERR_01` - Invalid command format
- `ERR_02` - Invalid module/port
- `ERR_03` - IR database lookup failed
- `ERR_TIMEOUT` - No response from iTach

---

### CEC Client (`/src/lib/cec-client.ts`)

**Purpose**: TV power control via HDMI-CEC (Pulse-Eight adapters)

**Important**: ONLY used for TV power control. Cable box CEC is deprecated.

**Exported Functions**:
- `sendCECCommandDetailed(command, address, options)` - Send CEC command
- `scanCECDevices(devicePath)` - Discover CEC devices on HDMI bus
- `powerOnTV(address, options)` - Turn TV on
- `powerOffTV(address, options)` - Turn TV off

**CEC Commands**:
```typescript
// Power commands
'on 0'      // Power on TV address 0
'standby 0' // Power off TV address 0
'tx 40:44:40' // Raw power on command

// Discovery
'scan'      // Scan CEC bus for devices
```

**Device Path**: `/dev/ttyACM0` (Pulse-Eight USB adapter)

**Command Queue**: Prevents concurrent CEC access (causes corruption)

**Response Parsing**:
```typescript
interface CECResponse {
  success: boolean
  deviceResponded: boolean
  output: string
  powerStatus?: 'on' | 'standby' | 'unknown'
  error?: string
}
```

**Logging**: All commands logged to `CECCommandLog` table

---

### DirecTV Client (`/src/lib/directv/shef-client.ts`)

**Purpose**: DirecTV receiver control via SHEF protocol

**Protocol**: HTTP REST on port 8080

**Key Endpoints**:
- `GET /tv/getTuned` - Current channel info
- `GET /tv/tune?major=206` - Tune to channel
- `GET /remote/processKey?key=power` - Send remote key
- `GET /info/getLocations` - List receivers

**Methods**:
- `tuneToChannel(major: number, minor?: number)`
- `sendKey(keyCode: string)`
- `getCurrentChannel()`
- `getDeviceInfo()`

**Error Handling**:
- Network errors: Retry 3 times with backoff
- Invalid channel: Return error without retry
- Offline device: Mark as offline in database

---

### Matrix Control (`/src/lib/matrix-control.ts`)

**Purpose**: HDMI matrix switching (Wolfpack 16x16)

**Protocol**: TCP Telnet on port 23

**Commands**:
```bash
MT00SW01 # Route input 1 to output 1
MT00SW01:02:03 # Route input 1 to outputs 1,2,3
MT00PWON # Power on matrix
MT00PWOF # Power off matrix
MT00STAT # Get current routing status
```

**Methods**:
- `routeInput(input: number, output: number): Promise<boolean>`
- `batchRoute(routes: Route[]): Promise<BatchResult>`
- `getMatrixStatus(): Promise<MatrixStatus>`
- `powerOnMatrix(): Promise<boolean>`

**Batch Routing Optimization**:
```typescript
// Instead of 16 sequential commands
for (let i = 1; i <= 16; i++) {
  await routeInput(input, i) // SLOW: 16 network round-trips
}

// Use batch command
await batchRoute([
  { input: 1, outputs: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16] }
]) // FAST: 1 network round-trip
```

**Database Updates**: `MatrixRoute` table updated after each routing

---

## Audio Processing Services

### Atlas HTTP Client (`/src/lib/atlas-http-client.ts`)

**Purpose**: AtlasIED HTTP API for control and configuration

**Base URL**: `http://{ipAddress}:{port}` (default port 80)

**Authentication**: HTTP Basic Auth (username/password)

**Key Methods**:
- `login(): Promise<boolean>` - Authenticate session
- `setZoneVolume(zone, level): Promise<void>` - Set volume (0-100)
- `setZoneMute(zone, muted): Promise<void>` - Mute control
- `setZoneSource(zone, source): Promise<void>` - Input routing
- `getZoneStatus(zone): Promise<ZoneStatus>` - Get zone state
- `getInputLevels(): Promise<InputLevel[]>` - Get all input meters

**Endpoints Used**:
```
POST /api/login
GET  /api/zones
POST /api/zones/{id}/volume
POST /api/zones/{id}/mute
POST /api/zones/{id}/source
GET  /api/meters/inputs
```

**Error Handling**:
- 401 Unauthorized: Retry login
- 503 Service Unavailable: Processor busy, retry after 1s
- Timeout: Fail after 10s

---

### Atlas TCP Client (`/src/lib/atlas-tcp-client.ts`)

**Purpose**: AtlasIED TCP control protocol (low-level)

**Protocol**: TCP on port 5321

**Command Format**:
```
GET ParameterName\r\n
SET ParameterName Value\r\n
SUBSCRIBE ParameterName\r\n
```

**Examples**:
```typescript
// Get zone 0 volume
await send('GET ZoneGain_0')
// Response: "ZoneGain_0 val 50"

// Set zone mute
await send('SET ZoneMute_0 1')
// Response: "OK"

// Subscribe to real-time updates
await send('SUBSCRIBE ZoneGain_0')
// Future changes pushed automatically
```

**Keep-Alive**: Sends `PING` every 30s

**Parameter Types**:
- `ZoneGain_{n}` - Zone volume (0-100)
- `ZoneMute_{n}` - Zone mute (0/1)
- `ZoneSource_{n}` - Zone source (0-15)
- `SourceMute_{n}` - Source mute (0/1)
- `InputGain_{n}` - Input gain (-60 to +12 dB)

---

### Atlas Realtime Meter Service (`/src/lib/atlas-realtime-meter-service.ts`)

**Purpose**: UDP audio metering (real-time levels)

**Protocol**: UDP on port 3131

**Data Format** (binary):
```
Byte 0-3:   Magic number (0x41544C53 = "ATLS")
Byte 4-7:   Sequence number
Byte 8-11:  Meter count
Byte 12+:   Meter data (8 bytes per meter)
  [0-3]: Meter ID
  [4-7]: Level (float, dBFS)
```

**Methods**:
- `startMetering(): void` - Start UDP listener
- `stopMetering(): void` - Stop listener
- `getLatestLevels(): MeterReading[]` - Get current levels
- `subscribeToMeter(meterId, callback): void` - Real-time updates

**Performance**: 100ms update interval, ~10 meters/sec

**Database Logging**: Disabled by default (too high frequency)

---

### AI Gain Service (`/src/lib/ai-gain-service.ts`)

**Purpose**: Automatic audio level optimization

**Algorithm**:
```typescript
1. Monitor input levels via UDP metering
2. Compare to target level (default -20 dBFS)
3. Calculate gain adjustment needed
4. Apply gradual adjustment (max ±3 dB per step)
5. Wait 5 seconds for audio to settle
6. Repeat if still outside threshold
```

**Configuration**:
- Target Level: -20 dBFS (adjustable)
- Threshold: ±5 dB (when to adjust)
- Max Adjustment: ±3 dB per step
- Adjustment Interval: 5 seconds

**Safety Limits**:
- Min Gain: -60 dB (prevent muting)
- Max Gain: +12 dB (prevent distortion)
- Clipping Detection: Stop adjusting if clipping

**Logging**: All adjustments logged to `AIGainAdjustmentLog`

---

## Content & Integration Services

### Unified TV Guide Service (`/src/lib/unified-tv-guide-service.ts`)

**Purpose**: Aggregate TV guide data from multiple sources

**Data Sources**:
1. Gracenote API (primary)
2. TheSportsDB (sports events)
3. ESPN API (live sports)
4. Local cache (offline fallback)

**Methods**:
- `getChannelGuide(channel, startTime, endTime): Promise<Program[]>`
- `searchPrograms(query): Promise<Program[]>`
- `getSportsEvents(league, date): Promise<Event[]>`
- `syncSchedule(): Promise<void>`

**Caching Strategy**:
- Cache TTL: 1 hour
- Cache key: `guide:{channel}:{date}`
- Invalidation: On API sync

---

### Streaming API (`/src/lib/streaming/unified-streaming-api.ts`)

**Purpose**: Discover live streaming apps and deep links

**Supported Apps**:
- ESPN+ (com.espn.score)
- MLB.TV (com.bamnetworks.mlbtv)
- NFL+ (com.nfl.mobile)
- NBA League Pass (com.nba.app)
- NHL.TV (com.nhl.gc)
- NFHS Network (com.nfhsnetwork.nfhs)

**Methods**:
- `getStreamingApps(): Promise<App[]>`
- `findGameStream(team, date): Promise<DeepLink[]>`
- `launchStream(deviceId, deepLink): Promise<boolean>`

**Deep Link Format**:
```
espn://live/game/{gameId}
mlbtv://watch/{contentId}
nfl://game/{gameId}
```

---

### Sports APIs Service (`/src/lib/sports-apis/live-sports-service.ts`)

**Purpose**: Live sports schedule aggregation

**API Integrations**:
- TheSportsDB: Free sports schedules
- ESPN API: Live scores and schedules
- NFL Sunday Ticket: NFL RedZone

**Methods**:
- `getUpcomingGames(team): Promise<Game[]>`
- `syncHomeTeamSchedule(): Promise<void>`
- `getGamesByDate(date): Promise<Game[]>`
- `getTodaysGames(): Promise<Game[]>`

**Database Sync**:
- Runs daily at 6 AM
- Syncs next 14 days
- Updates `SportsEvent` table
- Logs to `SportsEventSyncLog`

---

## Utility & Infrastructure Services

### Logger (`/src/lib/logger.ts`)

**Purpose**: Structured logging to console

**Log Levels**: debug, info, warn, error

**Usage**:
```typescript
import { logger } from '@/lib/logger'

logger.info('[COMPONENT] Message', { context: 'data' })
logger.error('[COMPONENT] Error:', error)
logger.debug('[COMPONENT] Debug info')
```

**Component Tags**: Use `[COMPONENT]` prefix for filtering

---

### Enhanced Logger (`/src/lib/enhanced-logger.ts`)

**Purpose**: Database-backed logging for analytics

**Methods**:
```typescript
await enhancedLogger.log({
  level: 'info',
  category: 'device',
  source: 'firetv-health-monitor',
  action: 'health_check',
  message: 'Device health check completed',
  details: { status: 'online', responseTime: 150 },
  deviceType: 'firetv',
  deviceId: 'device-1',
  success: true,
  duration: 150
})
```

**Log Categories**:
- `device` - Device operations
- `audio` - Audio processing
- `cec` - CEC commands
- `ir` - IR commands
- `auth` - Authentication
- `system` - System events

**Database Table**: `OperationLog` (via Prisma legacy support)

---

### Cache Service (`/src/lib/cache-service.ts`)

**Purpose**: In-memory caching with TTL

**Methods**:
- `set(key, value, ttl): void` - Cache value
- `get<T>(key): T | null` - Retrieve cached value
- `delete(key): void` - Invalidate cache
- `clear(): void` - Clear all cache

**TTL Examples**:
- Fire TV apps: 15 minutes
- Device status: 30 seconds
- TV guide data: 1 hour

**Memory Limit**: Auto-cleanup when >100MB

---

### Validation Middleware (`/src/lib/validation/`)

**Purpose**: Request validation with Zod schemas

**Files**:
- `index.ts` - Validation functions
- `schemas.ts` - Centralized Zod schemas

**Functions**:
```typescript
// Body validation (POST/PUT/PATCH)
const bodyValidation = await validateRequestBody(request, schema)
if (!bodyValidation.success) return bodyValidation.error
const body = bodyValidation.data // Type-safe!

// Query params (GET)
const queryValidation = validateQueryParams(request, schema)

// Path params (dynamic routes)
const pathValidation = validatePathParams({ id }, schema)
```

**Common Schemas**:
```typescript
ValidationSchemas.firetvLaunchApp
ValidationSchemas.matrixRoute
ValidationSchemas.atlasZoneControl
ValidationSchemas.channelPresetCreate
```

---

### Rate Limiting (`/src/lib/rate-limiting/`)

**Purpose**: Request throttling (in-memory)

**Configurations**:
```typescript
RateLimitConfigs.DEFAULT      // 100 req/min
RateLimitConfigs.STRICT       // 10 req/min (auth)
RateLimitConfigs.HARDWARE     // 50 req/min (device control)
RateLimitConfigs.GENEROUS     // 1000 req/min (public reads)
```

**Usage**:
```typescript
const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
if (!rateLimit.allowed) return rateLimit.response
```

**Algorithm**: Sliding window with automatic cleanup

---

## Common Service Patterns

### 1. Command Queue Pattern (Prevents Concurrent Access)

```typescript
class ADBClient {
  private commandQueue: Promise<any> = Promise.resolve()

  private queueCommand<T>(fn: () => Promise<T>): Promise<T> {
    const promise = this.commandQueue.then(fn, fn)
    this.commandQueue = promise.then(() => {}, () => {})
    return promise
  }

  async executeShellCommand(cmd: string): Promise<string> {
    return this.queueCommand(async () => {
      // Execute command sequentially
      const result = await this.executeADBCommand(cmd)
      return result
    })
  }
}
```

**Used In**: ADBClient, CECClient, MatrixControl, GlobalCacheAPI

---

### 2. Singleton Pattern (Shared Instances)

```typescript
let atlasClientInstance: AtlasHTTPClient | null = null

export function getAtlasClient(ipAddress: string): AtlasHTTPClient {
  if (!atlasClientInstance) {
    atlasClientInstance = new AtlasHTTPClient(ipAddress)
  }
  return atlasClientInstance
}
```

**Used In**: AtlasClientManager, CacheService, Logger

---

### 3. Retry with Exponential Backoff

```typescript
async function retryableRequest<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries - 1) throw error

      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}
```

**Used In**: DirecTVClient, AtlasHTTPClient, StreamingAPI

---

### 4. Health Monitoring Pattern

```typescript
interface HealthCheckResult {
  deviceId: string
  status: 'online' | 'offline' | 'error'
  lastSeen: Date
  responseTime: number
  errorMessage?: string
}

async function checkDeviceHealth(device: Device): Promise<HealthCheckResult> {
  const start = Date.now()

  try {
    const response = await pingDevice(device.ipAddress)
    return {
      deviceId: device.id,
      status: 'online',
      lastSeen: new Date(),
      responseTime: Date.now() - start
    }
  } catch (error) {
    return {
      deviceId: device.id,
      status: 'offline',
      lastSeen: device.lastSeen,
      responseTime: Date.now() - start,
      errorMessage: error.message
    }
  }
}
```

**Used In**: FireTVHealthMonitor, AtlasConnectionMonitor

---

### 5. Event Subscription Pattern (Real-time Updates)

```typescript
class AtlasTCPClient extends EventEmitter {
  subscribe(parameter: string): void {
    this.send(`SUBSCRIBE ${parameter}`)

    // Listen for updates
    this.on('parameter_update', (data) => {
      if (data.parameter === parameter) {
        // Handle update
      }
    })
  }

  unsubscribe(parameter: string): void {
    this.send(`UNSUBSCRIBE ${parameter}`)
    this.removeAllListeners('parameter_update')
  }
}
```

**Used In**: AtlasTCPClient, AtlasRealtimeMeterService

---

## Service Dependency Graph

```
┌─────────────────┐
│  API Routes     │
└────────┬────────┘
         │
         ├─────────────────────────────────────────┐
         │                                         │
┌────────▼────────────────┐              ┌─────────▼────────┐
│  Device Control         │              │  Auth Services   │
│  - ADBClient            │              │  - PIN           │
│  - GlobalCacheAPI       │              │  - Session       │
│  - CECClient            │              │  - API Key       │
│  - MatrixControl        │              └─────────┬────────┘
└────────┬────────────────┘                        │
         │                                         │
┌────────▼────────────────┐              ┌─────────▼────────┐
│  Audio Services         │              │  Validation      │
│  - AtlasHTTPClient      │              │  - Zod Schemas   │
│  - AtlasTCPClient       │              │  - Middleware    │
│  - MeterService         │              └─────────┬────────┘
│  - AIGainService        │                        │
└────────┬────────────────┘              ┌─────────▼────────┐
         │                               │  Rate Limiting   │
┌────────▼────────────────┐              └──────────────────┘
│  Content Services       │
│  - TVGuideService       │
│  - StreamingAPI         │
│  - SportsAPI            │
└────────┬────────────────┘
         │
┌────────▼────────────────┐
│  Utility Services       │
│  - Logger               │
│  - EnhancedLogger       │
│  - CacheService         │
│  - DBHelpers            │
└────────┬────────────────┘
         │
┌────────▼────────────────┐
│  Database Layer         │
│  - Drizzle ORM          │
│  - SQLite               │
└─────────────────────────┘
```

---

## Error Handling Strategies

### Network Errors

```typescript
try {
  await makeNetworkRequest()
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    // Device offline
    await markDeviceOffline(deviceId)
  } else if (error.code === 'ETIMEDOUT') {
    // Timeout - retry
    await retryRequest()
  } else if (error.code === 'ENOTFOUND') {
    // DNS error - invalid IP
    throw new Error('Invalid device IP address')
  }
}
```

### Hardware Command Errors

```typescript
try {
  await sendCECCommand('on 0')
} catch (error) {
  if (error.message.includes('No device available')) {
    // CEC adapter disconnected
    logger.error('[CEC] Adapter not found. Check USB connection.')
  } else if (error.message.includes('timeout')) {
    // Device not responding
    logger.warn('[CEC] Device timeout. TV may be unresponsive.')
  }

  // Log to database for troubleshooting
  await logFailedCommand(deviceId, error)
}
```

### Validation Errors

```typescript
const validation = await validateRequestBody(request, schema)

if (!validation.success) {
  // Return 400 Bad Request with details
  return NextResponse.json({
    success: false,
    error: 'Validation failed',
    details: validation.error.issues
  }, { status: 400 })
}
```

---

## Related Documentation

- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - Overall architecture
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database design
- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md) - Security model
- [CODE_PATTERNS.md](./CODE_PATTERNS.md) - Code patterns
- [CLAUDE.md](../CLAUDE.md) - Developer guide
