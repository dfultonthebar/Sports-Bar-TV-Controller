# Code Patterns & Best Practices

**Sports-Bar-TV-Controller Design Patterns**

Last Updated: November 6, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Structural Patterns](#structural-patterns)
3. [Behavioral Patterns](#behavioral-patterns)
4. [Concurrency Patterns](#concurrency-patterns)
5. [API Design Patterns](#api-design-patterns)
6. [Database Patterns](#database-patterns)
7. [Error Handling Patterns](#error-handling-patterns)
8. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Overview

This document catalogs the design patterns used throughout the Sports-Bar-TV-Controller codebase. Following these patterns ensures consistency, maintainability, and performance.

### Pattern Categories

| Category | Count | Purpose |
|----------|-------|---------|
| Structural | 4 | Code organization |
| Behavioral | 5 | Runtime behavior |
| Concurrency | 3 | Thread safety & performance |
| API Design | 6 | Request handling |
| Database | 4 | Data access |
| Error Handling | 3 | Resilience |

---

## Structural Patterns

### 1. Singleton Pattern

**Purpose**: Ensure single shared instance of stateful services

**Implementation**:
```typescript
// /src/lib/firetv-health-monitor.ts
let healthMonitorInstance: FireTVHealthMonitor | null = null

export function getHealthMonitor(): FireTVHealthMonitor {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new FireTVHealthMonitor()
  }
  return healthMonitorInstance
}

// Usage
const monitor = getHealthMonitor()
await monitor.runHealthCheck()
```

**Used In**:
- Fire TV Health Monitor (`firetv-health-monitor.ts`)
- Atlas Client Manager (`atlas-client-manager.ts`)
- Cache Service (`cache-service.ts`)
- Logger (`logger.ts`)
- Database Connection (`db/index.ts`)

**Why Singleton?**
- Prevents multiple concurrent health checks
- Shares connection pools
- Maintains consistent state
- Reduces memory footprint

**IMPORTANT**:
- Exported as global variable for PM2 persistence
- Prevents duplicate initialization across restarts
- Critical for health monitoring stability

```typescript
// Global singleton pattern for PM2
declare global {
  var firetvHealthMonitor: FireTVHealthMonitor | undefined
}

if (!global.firetvHealthMonitor) {
  global.firetvHealthMonitor = new FireTVHealthMonitor()
}

export const healthMonitor = global.firetvHealthMonitor
```

---

### 2. Factory Pattern

**Purpose**: Centralized object creation with configuration

**Implementation**:
```typescript
// /src/lib/atlas-client-manager.ts
export class AtlasClientManager {
  private static clients = new Map<string, AtlasHTTPClient>()

  static getClient(config: AtlasConfig): AtlasHTTPClient {
    const key = `${config.ipAddress}:${config.port}`

    if (!this.clients.has(key)) {
      this.clients.set(key, new AtlasHTTPClient(config))
    }

    return this.clients.get(key)!
  }

  static removeClient(ipAddress: string): void {
    this.clients.delete(ipAddress)
  }
}

// Usage
const client = AtlasClientManager.getClient({
  ipAddress: '192.168.1.100',
  port: 80,
  username: 'admin',
  password: 'password'
})
```

**Benefits**:
- Centralized configuration
- Connection pooling
- Lifecycle management
- Testing-friendly

**Used In**:
- Atlas Client Manager
- ADB Client Factory
- Global Cache API Factory

---

### 3. Repository Pattern

**Purpose**: Abstract database operations with clean interface

**Implementation**:
```typescript
// /src/lib/db-helpers.ts
export async function findFirst<T extends TableName>(
  tableName: T,
  options: FindOptions<T>
): Promise<InferResult<T> | null> {
  const table = schema[tableName]

  let query = db.select().from(table)

  if (options.where) {
    query = query.where(options.where)
  }

  const result = await query.limit(1)
  return result[0] || null
}

export async function findMany<T extends TableName>(
  tableName: T,
  options: FindManyOptions<T>
): Promise<InferResult<T>[]> {
  const table = schema[tableName]

  let query = db.select().from(table)

  if (options.where) {
    query = query.where(options.where)
  }

  if (options.orderBy) {
    query = query.orderBy(...options.orderBy)
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  return query
}

// Usage
const device = await findFirst('fireTVDevices', {
  where: eq(schema.fireTVDevices.id, deviceId)
})

const onlineDevices = await findMany('fireTVDevices', {
  where: eq(schema.fireTVDevices.status, 'online'),
  orderBy: [asc(schema.fireTVDevices.name)],
  limit: 10
})
```

**Benefits**:
- Type-safe queries
- Consistent error handling
- Easy to test (mock repository)
- Centralized query logic

**CRUD Operations**:
- `findFirst()` - Get single record
- `findMany()` - Get multiple records
- `create()` - Insert record
- `update()` - Update record
- `delete()` - Delete record

---

### 4. Service Layer Pattern

**Purpose**: Encapsulate business logic separate from API routes

**Structure**:
```
/src/app/api/firetv/[id]/launch-app/route.ts  (API Layer)
                ↓
/src/lib/adb-client.ts                        (Service Layer)
                ↓
/src/lib/db-helpers.ts                        (Data Access Layer)
                ↓
/src/db/index.ts                              (Database Layer)
```

**Implementation**:
```typescript
// API Route: /src/app/api/firetv/[id]/launch-app/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  // 2. Validation
  const bodyValidation = await validateRequestBody(request, LaunchAppSchema)
  if (!bodyValidation.success) return bodyValidation.error

  // 3. Call service layer
  try {
    const result = await ADBService.launchApp(
      params.id,
      bodyValidation.data.packageName
    )

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    logger.error('[FIRETV] Launch app failed:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Service Layer: /src/lib/adb-client.ts
export class ADBService {
  static async launchApp(deviceId: string, packageName: string) {
    // 1. Get device from database
    const device = await findFirst('fireTVDevices', {
      where: eq(schema.fireTVDevices.id, deviceId)
    })

    if (!device) {
      throw new Error('Device not found')
    }

    // 2. Business logic
    const client = new ADBClient(device.ipAddress)
    await client.connect()

    // 3. Execute command
    const result = await client.launchApp(packageName)

    // 4. Update database
    await update('fireTVDevices', deviceId, {
      lastSeen: new Date(),
      status: 'online'
    })

    // 5. Log operation
    await enhancedLogger.log({
      category: 'device',
      action: 'launch_app',
      deviceId,
      success: true
    })

    return result
  }
}
```

**Benefits**:
- Separation of concerns
- Testable business logic
- Reusable across endpoints
- Clear dependency flow

---

## Behavioral Patterns

### 1. Command Queue Pattern

**Purpose**: Prevent concurrent access to hardware devices

**Problem**:
```typescript
// ❌ WRONG - Concurrent commands cause corruption
await adbClient.sendCommand('input keyevent 3')  // Home
await adbClient.sendCommand('input keyevent 4')  // Back
// Commands interfere with each other!
```

**Solution**:
```typescript
// ✅ CORRECT - Queue ensures sequential execution
class ADBClient {
  private commandQueue: Promise<any> = Promise.resolve()

  private queueCommand<T>(fn: () => Promise<T>): Promise<T> {
    const promise = this.commandQueue
      .then(fn, fn) // Execute regardless of previous success/failure

    this.commandQueue = promise
      .then(() => {}, () => {}) // Reset to resolved state

    return promise
  }

  async sendKeyEvent(keyCode: number): Promise<boolean> {
    return this.queueCommand(async () => {
      const command = `input keyevent ${keyCode}`
      const result = await this.executeADBCommand(command)
      return result.includes('success')
    })
  }

  async launchApp(packageName: string): Promise<boolean> {
    return this.queueCommand(async () => {
      const command = `am start -n ${packageName}/.MainActivity`
      const result = await this.executeADBCommand(command)
      return result.includes('Starting')
    })
  }
}

// Usage - Commands execute sequentially automatically
await adbClient.sendKeyEvent(3)  // Queued: position 1
await adbClient.sendKeyEvent(4)  // Queued: position 2
await adbClient.launchApp('com.espn.score')  // Queued: position 3
```

**Flow Diagram**:
```
Command 1 arrives
     ↓
  [Queue] → Execute → Complete
     ↓
Command 2 arrives (during execution)
     ↓
  [Queue] → Wait → Execute → Complete
     ↓
Command 3 arrives
     ↓
  [Queue] → Wait → Execute → Complete
```

**Used In**:
- ADB Client (`adb-client.ts`)
- CEC Client (`cec-client.ts`)
- Global Cache API (`global-cache-api.ts`)
- Matrix Control (`matrix-control.ts`)
- Atlas TCP Client (`atlas-tcp-client.ts`)

**Why Queue?**
- Hardware devices don't support concurrent commands
- Prevents command corruption
- Maintains command order
- Simple implementation

---

### 2. Observer Pattern (Event Emitter)

**Purpose**: Loosely coupled event-driven architecture

**Implementation**:
```typescript
// /src/lib/atlas-tcp-client.ts
import { EventEmitter } from 'events'

export class AtlasTCPClient extends EventEmitter {
  private socket: net.Socket | null = null

  async connect(): Promise<void> {
    this.socket = net.createConnection(this.port, this.ipAddress)

    this.socket.on('data', (data) => {
      const message = data.toString()
      this.emit('message', message)

      if (message.startsWith('ZoneGain_')) {
        this.emit('volume_change', this.parseVolumeChange(message))
      }
    })

    this.socket.on('error', (error) => {
      this.emit('error', error)
    })

    this.socket.on('close', () => {
      this.emit('disconnected')
    })
  }

  subscribe(parameter: string): void {
    this.send(`SUBSCRIBE ${parameter}`)
  }
}

// Usage
const client = new AtlasTCPClient('192.168.1.100', 5321)

client.on('volume_change', (data) => {
  console.log(`Zone ${data.zone} volume: ${data.level}`)
  // Update database
  // Update UI via WebSocket
  // Trigger automation
})

client.on('error', (error) => {
  logger.error('[ATLAS] TCP error:', error)
})

client.on('disconnected', () => {
  logger.warn('[ATLAS] Disconnected, attempting reconnect...')
  setTimeout(() => client.connect(), 5000)
})

await client.connect()
client.subscribe('ZoneGain_0')
```

**Benefits**:
- Decoupled components
- Multiple listeners
- Asynchronous events
- Real-time updates

**Used In**:
- Atlas TCP Client (real-time metering)
- File Watcher (Memory Bank)
- Circuit Breaker (state changes)

---

### 3. Strategy Pattern

**Purpose**: Select algorithm at runtime based on configuration

**Implementation**:
```typescript
// /src/components/remotes/CableBoxRemote.tsx
interface RemoteStrategy {
  sendCommand(command: string): Promise<boolean>
}

class CECStrategy implements RemoteStrategy {
  async sendCommand(command: string): Promise<boolean> {
    const response = await fetch('/api/cec/cable-box/command', {
      method: 'POST',
      body: JSON.stringify({ command })
    })
    return response.ok
  }
}

class IRStrategy implements RemoteStrategy {
  constructor(private iTachAddress: string) {}

  async sendCommand(command: string): Promise<boolean> {
    const response = await fetch('/api/ir-devices/send-command', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: this.deviceId,
        command,
        isRawCode: false
      })
    })
    return response.ok
  }
}

// Selection based on device configuration
export function CableBoxRemote({ device }: Props) {
  const strategy: RemoteStrategy = device.iTachAddress
    ? new IRStrategy(device.iTachAddress)
    : new CECStrategy()

  const handleCommand = async (command: string) => {
    const success = await strategy.sendCommand(command)
    if (!success) {
      toast.error('Command failed')
    }
  }

  return (
    <div>
      <Button onClick={() => handleCommand('power')}>Power</Button>
      <Button onClick={() => handleCommand('channel_up')}>CH+</Button>
    </div>
  )
}
```

**Benefits**:
- Runtime flexibility
- Easy to add new strategies
- Testable
- Clean abstraction

---

### 4. Circuit Breaker Pattern

**Purpose**: Prevent cascading failures and provide graceful degradation

**Implementation**:
```typescript
// /src/lib/circuit-breaker.ts
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime: number | null = null

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private halfOpenSuccessThreshold: number = 3
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // State: OPEN - Reject immediately
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime! < this.timeout) {
        throw new Error('Circuit breaker is OPEN')
      }
      // Timeout expired, try half-open
      this.state = 'HALF_OPEN'
      this.successCount = 0
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0

    if (this.state === 'HALF_OPEN') {
      this.successCount++
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.state = 'CLOSED'
        logger.info('[CIRCUIT_BREAKER] State: CLOSED (recovered)')
      }
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN'
      logger.error('[CIRCUIT_BREAKER] State: OPEN (failures exceeded threshold)')
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount
    }
  }
}

// Usage
const breaker = new CircuitBreaker(5, 60000) // 5 failures, 60s timeout

async function callExternalAPI() {
  try {
    return await breaker.execute(async () => {
      const response = await fetch('https://external-api.com/data')
      if (!response.ok) throw new Error('API error')
      return response.json()
    })
  } catch (error) {
    // Circuit open - use cached data or return error
    return getCachedData()
  }
}
```

**State Diagram**:
```
┌─────────┐
│ CLOSED  │ ← Normal operation
└────┬────┘
     │ Failure threshold reached
     ▼
┌─────────┐
│  OPEN   │ ← Reject all requests
└────┬────┘
     │ Timeout expired
     ▼
┌──────────┐
│HALF_OPEN │ ← Test if service recovered
└────┬─────┘
     │
  Success?
     │
Yes  ▼        No
   CLOSED    OPEN
```

**Used In**:
- External API calls (Soundtrack, sports APIs)
- Database connections (recovery)
- Hardware communication (reconnection)

---

### 5. Retry with Exponential Backoff

**Purpose**: Gracefully handle transient failures

**Implementation**:
```typescript
// /src/lib/retry-helper.ts
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true
  } = options

  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      // Last attempt or error not retryable
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      )

      logger.warn(
        `[RETRY] Attempt ${attempt + 1} failed, retrying in ${delay}ms`,
        { error: error.message }
      )

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

// Usage
const data = await retryWithBackoff(
  async () => {
    const response = await fetch('https://api.example.com/data')
    if (!response.ok) throw new Error('API error')
    return response.json()
  },
  {
    maxRetries: 3,
    baseDelay: 1000,
    shouldRetry: (error) => {
      // Retry on network errors and 5xx status codes
      return error.message.includes('ECONNREFUSED') ||
             error.message.includes('ETIMEDOUT') ||
             error.message.includes('5')
    }
  }
)
```

**Backoff Schedule**:
```
Attempt 1: Immediate
Attempt 2: 1000ms (1s)
Attempt 3: 2000ms (2s)
Attempt 4: 4000ms (4s)
Attempt 5: 8000ms (8s) → capped at maxDelay
```

**Used In**:
- DirecTV Client (network errors)
- Atlas HTTP Client (503 Service Unavailable)
- Streaming API (rate limits)

---

## Concurrency Patterns

### 1. Parallel Execution with Promise.allSettled

**Purpose**: Execute multiple independent operations concurrently

**Implementation**:
```typescript
// /src/lib/firetv-health-monitor.ts
async function runHealthCheck(): Promise<HealthCheckResult[]> {
  const devices = loadDevicesFromConfig() // Fast: read file, not DB

  // Execute health checks in parallel
  const results = await Promise.allSettled(
    devices.map(device => checkDeviceHealth(device))
  )

  // Process results (mix of successes and failures)
  const healthStatuses = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return {
        deviceId: devices[index].id,
        status: 'online',
        data: result.value
      }
    } else {
      return {
        deviceId: devices[index].id,
        status: 'offline',
        error: result.reason.message
      }
    }
  })

  // Batch update database (single transaction)
  await updateDeviceStatuses(healthStatuses)

  return healthStatuses
}
```

**Why Promise.allSettled?**
- Don't fail entire operation if one device is offline
- All checks complete regardless of individual failures
- Better observability (see which succeeded/failed)
- Faster than sequential checks

**Comparison**:
```typescript
// ❌ Sequential - SLOW (10 devices × 1s = 10s)
for (const device of devices) {
  await checkDeviceHealth(device)
}

// ✅ Parallel with Promise.all - FAILS on first error
await Promise.all(devices.map(d => checkDeviceHealth(d)))
// If device 1 fails, devices 2-10 are never checked

// ✅ Parallel with Promise.allSettled - BEST
await Promise.allSettled(devices.map(d => checkDeviceHealth(d)))
// All checks complete, handle failures gracefully
```

---

### 2. Debouncing

**Purpose**: Reduce excessive function calls

**Implementation**:
```typescript
// /src/lib/memory-bank/file-watcher.ts
class FileWatcher extends EventEmitter {
  private debounceTimer: NodeJS.Timeout | null = null
  private pendingChanges: FileChangeEvent[] = []
  private readonly DEBOUNCE_MS = 500

  private handleFileChange(type: string, filePath: string): void {
    // Add to pending changes
    this.pendingChanges.push({ type, path: filePath, timestamp: Date.now() })

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Set new timer
    this.debounceTimer = setTimeout(() => {
      this.flushChanges()
    }, this.DEBOUNCE_MS)
  }

  private flushChanges(): void {
    if (this.pendingChanges.length === 0) return

    // Emit batched changes
    this.emit('changes', [...this.pendingChanges])

    // Clear pending
    this.pendingChanges = []
    this.debounceTimer = null
  }
}
```

**Visual Representation**:
```
File changes:    1  2  3         4  5
                 ↓  ↓  ↓         ↓  ↓
Debounce timer: [---500ms----]  [---500ms----]
                              ↓              ↓
Emit events:              Batch(1,2,3)  Batch(4,5)
```

**Benefits**:
- Reduces snapshot creation (file watcher)
- Prevents excessive API calls
- Improves performance
- Batches related changes

---

### 3. Throttling

**Purpose**: Limit function execution rate

**Implementation**:
```typescript
// /src/lib/rate-limiting/rate-limiter.ts
class RateLimiter {
  private requests = new Map<string, number[]>()

  async checkLimit(
    identifier: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now()
    const windowStart = now - windowMs

    // Get request timestamps
    const timestamps = this.requests.get(identifier) || []

    // Remove expired timestamps (sliding window)
    const validTimestamps = timestamps.filter(t => t > windowStart)

    // Check limit
    if (validTimestamps.length >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(validTimestamps[0] + windowMs)
      }
    }

    // Add current request
    validTimestamps.push(now)
    this.requests.set(identifier, validTimestamps)

    return {
      allowed: true,
      remaining: limit - validTimestamps.length,
      resetAt: new Date(now + windowMs)
    }
  }
}

// Usage in API route
export async function POST(request: NextRequest) {
  const identifier = request.ip || 'unknown'
  const result = await rateLimiter.checkLimit(identifier, 100, 60000)

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetAt.toISOString()
        }
      }
    )
  }

  // Process request...
}
```

**Sliding Window Visualization**:
```
Time:     0    10    20    30    40    50    60    70
          │                                    │
Window:   [─────────── 60 seconds ────────────]
Requests: ✓     ✓✓    ✓           ✓✓          ✓
          ↑                                    ↑
       Old requests                      New request
       expire as window slides
```

---

## API Design Patterns

### 1. Standard API Route Structure

**Pattern**: Consistent middleware chain for all endpoints

**Structure**:
```typescript
// /src/app/api/[endpoint]/route.ts
export async function POST(request: NextRequest) {
  // 1. Rate Limiting (FIRST!)
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  // 2. Input Validation
  const bodyValidation = await validateRequestBody(request, schema)
  if (!bodyValidation.success) return bodyValidation.error

  // 3. Authentication
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 4. Authorization
  if (!hasPermission(session.role, 'endpoint:access')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 5. Business Logic
  try {
    const result = await serviceLayer.performOperation(bodyValidation.data)

    // 6. Audit Logging
    await auditLog({
      action: 'operation_performed',
      userId: session.userId,
      success: true
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    // 7. Error Handling
    logger.error('[ENDPOINT] Operation failed:', error)

    await auditLog({
      action: 'operation_failed',
      userId: session.userId,
      success: false,
      error: error.message
    })

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

**Order Matters!**
1. Rate limit BEFORE validation (prevent validation abuse)
2. Validate BEFORE authentication (fail fast)
3. Authenticate BEFORE authorization (know who)
4. Authorize BEFORE business logic (check permissions)

---

### 2. Request Body Validation Pattern

**CRITICAL BUG TO AVOID**:
```typescript
// ❌ WRONG - Body stream consumed twice!
const bodyValidation = await validateRequestBody(request, schema)
const body = await request.json() // ERROR: Body already consumed!

// ✅ CORRECT - Use validated data
const bodyValidation = await validateRequestBody(request, schema)
if (!bodyValidation.success) return bodyValidation.error
const { field1, field2 } = bodyValidation.data // Use this!
```

**Why?**
- HTTP request body is a stream (can only be read once)
- `validateRequestBody()` internally calls `request.json()`
- Second call to `request.json()` throws error

**Validation Middleware**:
```typescript
// /src/lib/validation/index.ts
export async function validateRequestBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): Promise<ValidationResult<z.infer<T>>> {
  try {
    // Read body (CONSUMES STREAM)
    const body = await request.json()

    // Validate
    const result = schema.safeParse(body)

    if (!result.success) {
      return {
        success: false,
        error: NextResponse.json({
          success: false,
          error: 'Validation failed',
          details: result.error.issues
        }, { status: 400 })
      }
    }

    return {
      success: true,
      data: result.data // Return validated, type-safe data
    }
  } catch (error) {
    return {
      success: false,
      error: NextResponse.json({
        success: false,
        error: 'Invalid JSON'
      }, { status: 400 })
    }
  }
}
```

---

### 3. GET vs POST Validation

**GET Requests** (Query Params):
```typescript
export async function GET(request: NextRequest) {
  const queryValidation = validateQueryParams(request, z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.enum(['online', 'offline']).optional()
  }))

  if (!queryValidation.success) return queryValidation.error

  const { page = 1, limit = 20, status } = queryValidation.data

  // No request.json() for GET requests!
}
```

**POST Requests** (Body):
```typescript
export async function POST(request: NextRequest) {
  const bodyValidation = await validateRequestBody(request, z.object({
    name: z.string().min(1),
    ipAddress: z.string().ip()
  }))

  if (!bodyValidation.success) return bodyValidation.error

  const { name, ipAddress } = bodyValidation.data
}
```

---

### 4. Consistent Response Format

**Success Response**:
```typescript
return NextResponse.json({
  success: true,
  data: {
    id: '123',
    name: 'Device 1'
  }
}, { status: 200 })
```

**Error Response**:
```typescript
return NextResponse.json({
  success: false,
  error: 'Device not found',
  details: {
    deviceId: '123',
    reason: 'No record in database'
  }
}, { status: 404 })
```

**Validation Error Response**:
```typescript
return NextResponse.json({
  success: false,
  error: 'Validation failed',
  details: [
    {
      field: 'ipAddress',
      message: 'Invalid IP address format'
    }
  ]
}, { status: 400 })
```

---

### 5. Dynamic Route Parameters

**Pattern**: Type-safe parameter extraction

```typescript
// /src/app/api/firetv/[id]/route.ts
interface RouteParams {
  params: { id: string }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  // Validate path parameter
  const pathValidation = validatePathParams(
    params,
    z.object({ id: z.string().uuid() })
  )

  if (!pathValidation.success) {
    return NextResponse.json(
      { error: 'Invalid device ID format' },
      { status: 400 }
    )
  }

  const { id } = pathValidation.data

  // Use validated ID
  const device = await findFirst('fireTVDevices', {
    where: eq(schema.fireTVDevices.id, id)
  })

  if (!device) {
    return NextResponse.json(
      { error: 'Device not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true, data: device })
}
```

---

### 6. Pagination Pattern

**Implementation**:
```typescript
export async function GET(request: NextRequest) {
  const queryValidation = validateQueryParams(request, z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    orderBy: z.enum(['name', 'createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc')
  }))

  if (!queryValidation.success) return queryValidation.error

  const { page, limit, orderBy, order } = queryValidation.data

  // Calculate offset
  const offset = (page - 1) * limit

  // Get total count
  const totalCount = await db
    .select({ count: sql`count(*)` })
    .from(schema.fireTVDevices)
    .then(r => r[0].count)

  // Get paginated data
  const devices = await db
    .select()
    .from(schema.fireTVDevices)
    .orderBy(
      order === 'asc'
        ? asc(schema.fireTVDevices[orderBy])
        : desc(schema.fireTVDevices[orderBy])
    )
    .limit(limit)
    .offset(offset)

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / limit)

  return NextResponse.json({
    success: true,
    data: devices,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  })
}
```

---

## Database Patterns

### 1. Transaction Pattern

**Purpose**: Ensure atomicity for multi-step operations

**Implementation**:
```typescript
// /src/lib/db-transaction.ts
import { db } from '@/db'

export async function withTransaction<T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  // SQLite auto-commit is disabled during callback
  return db.transaction(async (tx) => {
    try {
      const result = await fn(tx)
      // Auto-commit on success
      return result
    } catch (error) {
      // Auto-rollback on error
      throw error
    }
  })
}

// Usage
await withTransaction(async (tx) => {
  // 1. Create device
  const device = await tx.insert(schema.fireTVDevices).values({
    id: uuid(),
    name: 'TV #1',
    ipAddress: '192.168.1.100'
  }).returning()

  // 2. Create associated matrix route
  await tx.insert(schema.matrixRoutes).values({
    id: uuid(),
    deviceId: device[0].id,
    inputNum: 1,
    outputNum: 1
  })

  // 3. Log creation
  await tx.insert(schema.auditLog).values({
    action: 'device_created',
    resourceId: device[0].id
  })

  return device[0]
  // All succeed or all rollback
})
```

---

### 2. Batch Update Pattern

**Purpose**: Minimize database round-trips

**Implementation**:
```typescript
// ❌ SLOW - N queries
for (const device of devices) {
  await db.update(schema.fireTVDevices)
    .set({ status: 'online', lastSeen: new Date() })
    .where(eq(schema.fireTVDevices.id, device.id))
}

// ✅ FAST - 1 transaction with batch updates
await withTransaction(async (tx) => {
  for (const device of devices) {
    await tx.update(schema.fireTVDevices)
      .set({ status: 'online', lastSeen: new Date() })
      .where(eq(schema.fireTVDevices.id, device.id))
  }
  // All updates in single transaction
})

// ✅ FASTEST - Single SQL statement (if possible)
await db.update(schema.fireTVDevices)
  .set({ status: 'online', lastSeen: new Date() })
  .where(inArray(schema.fireTVDevices.id, deviceIds))
```

---

### 3. Soft Delete Pattern

**Purpose**: Preserve historical data

**Implementation**:
```typescript
// Schema addition
export const fireTVDevices = sqliteTable('FireTVDevice', {
  // ... other columns
  deletedAt: integer('deletedAt', { mode: 'timestamp' }),
  isActive: integer('isActive', { mode: 'boolean' }).default(true)
})

// Soft delete
export async function softDelete(deviceId: string): Promise<void> {
  await db.update(schema.fireTVDevices)
    .set({
      isActive: false,
      deletedAt: new Date()
    })
    .where(eq(schema.fireTVDevices.id, deviceId))
}

// Query only active devices
export async function getActiveDevices() {
  return db.select()
    .from(schema.fireTVDevices)
    .where(eq(schema.fireTVDevices.isActive, true))
}

// Restore deleted device
export async function restore(deviceId: string): Promise<void> {
  await db.update(schema.fireTVDevices)
    .set({
      isActive: true,
      deletedAt: null
    })
    .where(eq(schema.fireTVDevices.id, deviceId))
}

// Hard delete (permanent, admin only)
export async function hardDelete(deviceId: string): Promise<void> {
  await db.delete(schema.fireTVDevices)
    .where(eq(schema.fireTVDevices.id, deviceId))
}
```

---

### 4. Optimistic Locking Pattern

**Purpose**: Prevent concurrent update conflicts

**Implementation**:
```typescript
// Schema
export const fireTVDevices = sqliteTable('FireTVDevice', {
  // ... other columns
  version: integer('version').default(0).notNull()
})

// Update with version check
export async function updateDevice(
  deviceId: string,
  currentVersion: number,
  updates: Partial<FireTVDevice>
): Promise<boolean> {
  const result = await db.update(schema.fireTVDevices)
    .set({
      ...updates,
      version: currentVersion + 1,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(schema.fireTVDevices.id, deviceId),
        eq(schema.fireTVDevices.version, currentVersion)
      )
    )

  // If no rows updated, version conflict occurred
  return result.changes > 0
}

// Usage
const device = await findFirst('fireTVDevices', {
  where: eq(schema.fireTVDevices.id, deviceId)
})

const success = await updateDevice(deviceId, device.version, {
  name: 'New Name'
})

if (!success) {
  throw new Error('Device was modified by another process. Please reload and try again.')
}
```

---

## Error Handling Patterns

### 1. Structured Error Responses

**Custom Error Classes**:
```typescript
// /src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404, { resource, id })
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'UnauthorizedError'
  }
}

export class DeviceOfflineError extends AppError {
  constructor(deviceId: string) {
    super('Device is offline', 'DEVICE_OFFLINE', 503, { deviceId })
    this.name = 'DeviceOfflineError'
  }
}

// Usage
throw new NotFoundError('FireTVDevice', deviceId)
throw new DeviceOfflineError(device.id)
```

**Global Error Handler**:
```typescript
// /src/app/api/[endpoint]/route.ts
export async function POST(request: NextRequest) {
  try {
    // Business logic...
  } catch (error: any) {
    if (error instanceof AppError) {
      logger.error(`[${error.code}] ${error.message}`, error.details)

      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details
      }, { status: error.statusCode })
    }

    // Unknown error
    logger.error('[UNKNOWN_ERROR]', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
```

---

### 2. Graceful Degradation

**Pattern**: Fallback to cached/default data on failure

```typescript
async function getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
  try {
    // Try real-time check
    const status = await checkDeviceHealth(deviceId)

    // Cache successful result
    await cache.set(`device:${deviceId}:status`, status, 30000) // 30s

    return status
  } catch (error) {
    logger.warn('[DEVICE] Real-time check failed, using cached data', { deviceId })

    // Fallback to cached status
    const cachedStatus = await cache.get<DeviceStatus>(`device:${deviceId}:status`)

    if (cachedStatus) {
      return { ...cachedStatus, cached: true }
    }

    // Fallback to database record
    const device = await findFirst('fireTVDevices', {
      where: eq(schema.fireTVDevices.id, deviceId)
    })

    if (device) {
      return {
        status: device.status,
        lastSeen: device.lastSeen,
        stale: true
      }
    }

    // Last resort: return offline
    return {
      status: 'offline',
      error: 'Unable to determine status'
    }
  }
}
```

---

### 3. Error Logging with Context

**Pattern**: Structured logging with relevant context

```typescript
import { logger } from '@/lib/logger'

async function launchApp(deviceId: string, packageName: string) {
  const context = { deviceId, packageName }

  try {
    logger.info('[FIRETV] Launching app', context)

    const device = await findFirst('fireTVDevices', {
      where: eq(schema.fireTVDevices.id, deviceId)
    })

    if (!device) {
      logger.error('[FIRETV] Device not found', context)
      throw new NotFoundError('FireTVDevice', deviceId)
    }

    const client = new ADBClient(device.ipAddress)
    await client.connect()

    logger.debug('[FIRETV] ADB connected', { ...context, ipAddress: device.ipAddress })

    const result = await client.launchApp(packageName)

    logger.info('[FIRETV] App launched successfully', { ...context, result })

    return result
  } catch (error: any) {
    logger.error('[FIRETV] Launch app failed', {
      ...context,
      error: error.message,
      stack: error.stack
    })

    throw error
  }
}
```

**Log Output**:
```
2025-11-06 12:30:45 [INFO] [FIRETV] Launching app { deviceId: 'abc-123', packageName: 'com.espn.score' }
2025-11-06 12:30:46 [DEBUG] [FIRETV] ADB connected { deviceId: 'abc-123', packageName: 'com.espn.score', ipAddress: '192.168.1.100' }
2025-11-06 12:30:47 [INFO] [FIRETV] App launched successfully { deviceId: 'abc-123', packageName: 'com.espn.score', result: { success: true } }
```

---

## Anti-Patterns to Avoid

### 1. ❌ Calling request.json() After Validation

```typescript
// ❌ WRONG
const validation = await validateRequestBody(request, schema)
const body = await request.json() // ERROR: Body already consumed

// ✅ CORRECT
const validation = await validateRequestBody(request, schema)
if (!validation.success) return validation.error
const body = validation.data
```

---

### 2. ❌ Using Raw SQL Instead of ORM

```typescript
// ❌ WRONG - SQL injection risk!
const devices = await db.raw(`
  SELECT * FROM FireTVDevice
  WHERE id = '${deviceId}'
`)

// ✅ CORRECT - Parameterized query
const devices = await db.select()
  .from(schema.fireTVDevices)
  .where(eq(schema.fireTVDevices.id, deviceId))
```

---

### 3. ❌ Blocking Operations in Request Handlers

```typescript
// ❌ WRONG - Blocks event loop
export async function POST(request: NextRequest) {
  const result = someHeavyComputation() // Synchronous!
  return NextResponse.json({ result })
}

// ✅ CORRECT - Non-blocking
export async function POST(request: NextRequest) {
  const result = await someHeavyComputationAsync()
  return NextResponse.json({ result })
}
```

---

### 4. ❌ Not Using Command Queue for Hardware

```typescript
// ❌ WRONG - Concurrent commands interfere
await adbClient.sendKeyEvent(3)
await adbClient.sendKeyEvent(4)
await adbClient.sendKeyEvent(5)
// Commands execute in parallel, cause corruption

// ✅ CORRECT - Commands queued automatically
class ADBClient {
  private queue = Promise.resolve()

  queueCommand(fn) {
    const promise = this.queue.then(fn, fn)
    this.queue = promise.then(() => {}, () => {})
    return promise
  }
}
```

---

### 5. ❌ Creating Multiple Singletons

```typescript
// ❌ WRONG - New instance on every import
export function getHealthMonitor() {
  return new FireTVHealthMonitor() // New instance!
}

// ✅ CORRECT - Singleton
let instance: FireTVHealthMonitor | null = null

export function getHealthMonitor() {
  if (!instance) {
    instance = new FireTVHealthMonitor()
  }
  return instance
}
```

---

### 6. ❌ Not Handling Promise Rejections

```typescript
// ❌ WRONG - Unhandled rejection crashes app
async function updateDevice() {
  db.update(...) // No await, no catch
}

// ✅ CORRECT - Proper error handling
async function updateDevice() {
  try {
    await db.update(...)
  } catch (error) {
    logger.error('Update failed:', error)
    throw error
  }
}
```

---

### 7. ❌ Excessive Database Queries in Loops

```typescript
// ❌ WRONG - N+1 query problem
const devices = await findMany('fireTVDevices')
for (const device of devices) {
  const routes = await findMany('matrixRoutes', {
    where: eq(schema.matrixRoutes.deviceId, device.id)
  })
  // 1 query for devices + N queries for routes
}

// ✅ CORRECT - Join or batch query
const devicesWithRoutes = await db.select()
  .from(schema.fireTVDevices)
  .leftJoin(
    schema.matrixRoutes,
    eq(schema.fireTVDevices.id, schema.matrixRoutes.deviceId)
  )
// Single query with join
```

---

## Summary

### Most Important Patterns

1. **Singleton Pattern** - Health monitor, database connection
2. **Command Queue Pattern** - Hardware device control
3. **Repository Pattern** - Database access abstraction
4. **Standard API Structure** - Consistent middleware chain
5. **Circuit Breaker** - External API resilience

### Most Common Bugs to Avoid

1. Calling `request.json()` after validation
2. Not using command queue for hardware
3. SQL injection via raw queries
4. Creating multiple singleton instances
5. N+1 database query problem

### Performance Best Practices

1. Use `Promise.allSettled()` for parallel operations
2. Batch database updates in transactions
3. Implement caching with TTL
4. Use debouncing for frequent events
5. Minimize database round-trips

---

## Related Documentation

- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - Overall architecture
- [SERVICE_ARCHITECTURE.md](./SERVICE_ARCHITECTURE.md) - Service layer details
- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md) - Security patterns
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database design
- [CLAUDE.md](../CLAUDE.md) - Developer quick reference

---

*Code Patterns & Best Practices v1.0.0*
