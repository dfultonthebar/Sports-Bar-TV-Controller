# Data Flow Architecture

**Sports-Bar-TV-Controller Data Flow & Request Processing**

Last Updated: November 6, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Request Flow Patterns](#request-flow-patterns)
3. [Device Control Flows](#device-control-flows)
4. [Authentication Flow](#authentication-flow)
5. [Health Monitoring Flow](#health-monitoring-flow)
6. [IR Learning Flow](#ir-learning-flow)
7. [Audio Control Flow](#audio-control-flow)
8. [Matrix Routing Flow](#matrix-routing-flow)
9. [Database Operation Flows](#database-operation-flows)
10. [Background Job Flows](#background-job-flows)
11. [Error Propagation](#error-propagation)

---

## Overview

This document details how data flows through the Sports-Bar-TV-Controller system, from user interaction to hardware execution and database persistence.

### Flow Categories

| Category | Examples | Latency |
|----------|----------|---------|
| User Interactions | Launch app, change channel | 50-200ms |
| Health Monitoring | Device status checks | 1-5 seconds |
| Audio Processing | Volume changes, metering | 100-300ms |
| Background Jobs | Scheduled tasks, sync | Varies |
| Database Operations | CRUD operations | <10ms |

---

## Request Flow Patterns

### Standard API Request Flow

```
┌─────────────┐
│   Browser   │ User clicks "Launch ESPN"
└──────┬──────┘
       │ HTTP POST /api/firetv/[id]/launch-app
       │ { packageName: "com.espn.score" }
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ Next.js API Route Handler                               │
│ /src/app/api/firetv/[id]/launch-app/route.ts           │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ 1. Rate Limiting Middleware  │ withRateLimit()
│    - Check request count     │ 100 req/min limit
│    - Update sliding window   │
│    - Return 429 if exceeded  │
└──────┬───────────────────────┘
       │ ✓ Within limits
       ▼
┌──────────────────────────────┐
│ 2. Input Validation          │ validateRequestBody()
│    - Parse JSON body         │
│    - Validate with Zod       │
│    - Return 400 if invalid   │
└──────┬───────────────────────┘
       │ ✓ Valid input
       ▼
┌──────────────────────────────┐
│ 3. Authentication Check      │ getSession()
│    - Check session cookie    │
│    - Query Session table     │
│    - Return 401 if missing   │
└──────┬───────────────────────┘
       │ ✓ Authenticated
       ▼
┌──────────────────────────────┐
│ 4. Authorization Check       │ checkPermission()
│    - Verify role has access  │
│    - Return 403 if forbidden │
└──────┬───────────────────────┘
       │ ✓ Authorized (STAFF or ADMIN)
       ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Business Logic Layer                                  │
│    /src/lib/adb-client.ts                                │
│                                                           │
│    a. Query Database                                     │
│       - Get device by ID                                 │
│       - Check device status                              │
│       - Return 404 if not found                          │
│                                                           │
│    b. Hardware Interaction                               │
│       - Create ADB client instance                       │
│       - Queue command (prevent concurrent access)        │
│       - Execute: adb shell am start -n com.espn.score/...│
│       - Wait for response (timeout: 5s)                  │
│       - Parse output                                     │
│                                                           │
│    c. Database Update                                    │
│       - Update device lastSeen                           │
│       - Update device status                             │
│       - Log to enhanced logger                           │
│                                                           │
│    d. Return Result                                      │
│       - Success: { success: true, appLaunched: "ESPN" }  │
│       - Error: { success: false, error: "message" }      │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ 6. Audit Logging             │ auditLog()
│    - Log action performed    │
│    - Include user, timestamp │
│    - Store in AuditLog table │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ 7. Response Formatting       │
│    - Add headers (CORS, etc) │
│    - Set status code         │
│    - Return JSON response    │
└──────┬───────────────────────┘
       │
       ▼
┌─────────────┐
│   Browser   │ Display success/error to user
└─────────────┘
```

**Timing Breakdown**:
```
Rate Limiting: 1ms
Validation: 2ms
Authentication: 5ms
Authorization: 1ms
Database Query: 5ms
ADB Command: 100-150ms
Database Update: 5ms
Audit Logging: 5ms
Response: 1ms
─────────────────
Total: 125-175ms
```

---

## Device Control Flows

### Fire TV App Launch Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     User Action                             │
│   Bartender clicks "ESPN" button on tablet                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                  Frontend Component                          │
│   /src/components/remotes/FireTVRemote.tsx                  │
│                                                              │
│   const launchApp = async (packageName: string) => {        │
│     const response = await fetch('/api/firetv/[id]/launch', │
│       { method: 'POST', body: { packageName } }              │
│     )                                                        │
│     if (response.ok) toast.success('App launched')          │
│   }                                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    API Route Handler                         │
│   Standard middleware chain (see above)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                   ADB Service Layer                          │
│   /src/lib/adb-client.ts                                    │
│                                                              │
│   1. Get device from database                                │
│      const device = await findFirst('fireTVDevices', {...})  │
│                                                              │
│   2. Check device status                                     │
│      if (device.status === 'offline') throw DeviceOffline   │
│                                                              │
│   3. Create ADB client                                       │
│      const client = new ADBClient(device.ipAddress, 5555)   │
│                                                              │
│   4. Connect via TCP                                         │
│      await client.connect()                                  │
│                                                              │
│   5. Queue command (serialize access)                        │
│      return this.queueCommand(async () => {                 │
│        const command = `am start -n ${pkg}/.MainActivity`   │
│        return await this.executeADBCommand(command)          │
│      })                                                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                   Hardware Execution                         │
│   TCP Socket → Fire TV Device (192.168.1.100:5555)          │
│                                                              │
│   1. Send ADB command over TCP                               │
│      socket.write('am start -n com.espn.score/.MainActivity')│
│                                                              │
│   2. Fire TV executes Android command                        │
│      - Android Package Manager starts app                    │
│      - Activity lifecycle (onCreate, onStart, onResume)      │
│                                                              │
│   3. Fire TV responds                                        │
│      "Starting: Intent { cmp=com.espn.score/.MainActivity }" │
│                                                              │
│   4. Parse response                                          │
│      success = output.includes('Starting')                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                  Post-Execution Tasks                        │
│                                                              │
│   1. Update Device Status                                    │
│      await update('fireTVDevices', deviceId, {              │
│        lastSeen: new Date(),                                 │
│        status: 'online'                                      │
│      })                                                      │
│                                                              │
│   2. Enhanced Logging                                        │
│      await enhancedLogger.log({                             │
│        category: 'device',                                   │
│        action: 'launch_app',                                 │
│        deviceId,                                             │
│        success: true,                                        │
│        duration: 150                                         │
│      })                                                      │
│                                                              │
│   3. Cache Update (optional)                                 │
│      cache.set(`device:${deviceId}:status`, 'online', 30s)  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Response to Client                        │
│   { success: true, appLaunched: "ESPN" }                    │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                  Frontend Update                             │
│   - Display success toast                                    │
│   - Update UI (app is now running)                           │
│   - Optional: Refresh device status                          │
└──────────────────────────────────────────────────────────────┘
```

---

### Channel Tuning Flow (Cable Box via IR)

```
┌──────────────────────────────────────────────────────────────┐
│                    User Action                               │
│   Bartender clicks "ESPN (206)" channel preset              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              Frontend Component                              │
│   /src/components/BartenderRemoteSelector.tsx               │
│                                                              │
│   const tuneChannel = async (presetId: string) => {         │
│     await fetch('/api/channel-presets/tune', {               │
│       method: 'POST',                                        │
│       body: { presetId }                                     │
│     })                                                       │
│   }                                                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                API Route Handler                             │
│   /src/app/api/channel-presets/tune/route.ts                │
│                                                              │
│   1. Validate request                                        │
│   2. Get channel preset from database                        │
│      const preset = await findFirst('channelPresets', {...}) │
│   3. Get associated device (cable box)                       │
│   4. Route to appropriate service (IR vs DirecTV)            │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│             IR Control Service                               │
│   /src/lib/global-cache-api.ts                              │
│                                                              │
│   1. Get IR device configuration                             │
│      - iTach IP address                                      │
│      - Port number (1:1, 1:2, etc)                           │
│      - IR codes (learned or pre-programmed)                  │
│                                                              │
│   2. Build digit sequence                                    │
│      Channel "206" → ["2", "0", "6", "ENTER"]                │
│                                                              │
│   3. Get IR codes for each digit                             │
│      irCodes["2"]     → "sendir,1:1,1,38000,1,1,342,171..." │
│      irCodes["0"]     → "sendir,1:1,1,38000,1,1,342,171..." │
│      irCodes["6"]     → "sendir,1:1,1,38000,1,1,342,171..." │
│      irCodes["enter"] → "sendir,1:1,1,38000,1,1,342,171..." │
│                                                              │
│   4. Queue commands (sequential execution)                   │
│      for (const code of digitCodes) {                        │
│        await sendIRCommand(iTachAddress, code)               │
│        await delay(500ms) // Allow cable box to process      │
│      }                                                       │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│          Hardware Execution (Global Cache iTach)             │
│                                                              │
│   For each IR code:                                          │
│                                                              │
│   1. Open TCP connection to iTach (port 4998)                │
│      socket = net.connect(4998, '192.168.1.50')             │
│                                                              │
│   2. Send IR command                                         │
│      socket.write('sendir,1:1,1,38000,1,1,342,171...')      │
│                                                              │
│   3. iTach executes:                                         │
│      - Converts Pronto hex to IR signal                      │
│      - Modulates at 38kHz carrier frequency                  │
│      - Transmits via IR emitter                              │
│                                                              │
│   4. iTach responds:                                         │
│      "completeir,1:1,1" (success)                            │
│      or "ERR_01" (invalid format)                            │
│                                                              │
│   5. Wait for response (timeout: 1s)                         │
│                                                              │
│   6. Close connection                                        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│             Cable Box (Physical Device)                      │
│                                                              │
│   1. IR receiver detects signal                              │
│   2. Decodes IR command                                      │
│   3. Executes button press:                                  │
│      - "2" button                                            │
│      - "0" button                                            │
│      - "6" button                                            │
│      - "Enter" button                                        │
│   4. Tunes to channel 206                                    │
│   5. Displays channel on TV                                  │
│                                                              │
│   Note: No feedback sent to controller (one-way)            │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                Post-Execution Tasks                          │
│                                                              │
│   1. Update channel preset usage stats                       │
│      await update('channelPresets', presetId, {             │
│        usageCount: preset.usageCount + 1,                    │
│        lastUsed: new Date()                                  │
│      })                                                      │
│                                                              │
│   2. Update cable box last channel                           │
│      await update('cableBox', deviceId, {                   │
│        lastChannel: '206',                                   │
│        updatedAt: new Date()                                 │
│      })                                                      │
│                                                              │
│   3. Log command                                             │
│      await enhancedLogger.log({                             │
│        category: 'ir',                                       │
│        action: 'tune_channel',                               │
│        success: true                                         │
│      })                                                      │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                Response to Client                            │
│   { success: true, channelTuned: "206" }                    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              Frontend Update                                 │
│   - Display success message                                  │
│   - Update preset usage badge                                │
│   - Highlight active channel                                 │
└──────────────────────────────────────────────────────────────┘
```

**Timing**:
```
API Processing: 10ms
Database Queries: 10ms
IR Command Sequence:
  - Digit "2": 500ms
  - Digit "0": 500ms
  - Digit "6": 500ms
  - "Enter": 500ms
Total IR: 2000ms
Database Updates: 10ms
────────────────
Total: ~2030ms (2 seconds)
```

---

## Authentication Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    User Action                               │
│   Staff member enters 4-digit PIN on login screen           │
│   Input: "1234"                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              Frontend Login Form                             │
│   /src/app/login/page.tsx                                   │
│                                                              │
│   const handleLogin = async (pin: string) => {              │
│     const response = await fetch('/api/auth/login', {        │
│       method: 'POST',                                        │
│       body: { pin, locationId: 'default' }                   │
│     })                                                       │
│     if (response.ok) router.push('/bartender')              │
│   }                                                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│          API Route: /api/auth/login/route.ts                 │
│                                                              │
│   1. Rate Limiting (STRICT: 5 attempts/minute)               │
│      Prevents brute force attacks                            │
│                                                              │
│   2. Input Validation                                        │
│      Schema: z.object({                                      │
│        pin: z.string().length(4).regex(/^\d{4}$/),          │
│        locationId: z.string().uuid().optional()              │
│      })                                                      │
│                                                              │
│   3. Route to PIN validation service                         │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         PIN Validation Service                               │
│   /src/lib/auth/pin.ts                                      │
│                                                              │
│   1. Query active PINs for location                          │
│      const pins = await db.select()                          │
│        .from(schema.authPins)                                │
│        .where(                                               │
│          and(                                                │
│            eq(schema.authPins.locationId, locationId),      │
│            eq(schema.authPins.isActive, true)               │
│          )                                                   │
│        )                                                     │
│                                                              │
│   2. Check PIN against each record (constant-time)           │
│      for (const pinRecord of pins) {                         │
│        const isValid = await bcrypt.compare(                │
│          pin,                                                │
│          pinRecord.pinHash                                   │
│        )                                                     │
│        if (isValid) {                                        │
│          // Check expiration                                 │
│          if (pinRecord.expiresAt < now) {                   │
│            return { valid: false, reason: 'PIN expired' }   │
│          }                                                   │
│          return {                                            │
│            valid: true,                                      │
│            role: pinRecord.role,                             │
│            pinId: pinRecord.id                               │
│          }                                                   │
│        }                                                     │
│      }                                                       │
│      return { valid: false, reason: 'Invalid PIN' }         │
└──────────────────────────┬───────────────────────────────────┘
                           │ ✓ PIN valid, role: "STAFF"
                           ▼
┌──────────────────────────────────────────────────────────────┐
│        Session Creation Service                              │
│   /src/lib/auth/session.ts                                  │
│                                                              │
│   1. Generate session ID                                     │
│      const sessionId = crypto.randomUUID()                   │
│                                                              │
│   2. Calculate expiration (24 hours)                         │
│      const expiresAt = new Date(Date.now() + 24*60*60*1000) │
│                                                              │
│   3. Create session record                                   │
│      await db.insert(schema.sessions).values({              │
│        id: sessionId,                                        │
│        locationId,                                           │
│        role: 'STAFF',                                        │
│        ipAddress: request.ip,                                │
│        userAgent: request.headers.get('user-agent'),        │
│        isActive: true,                                       │
│        createdAt: new Date(),                                │
│        expiresAt,                                            │
│        lastActivity: new Date()                              │
│      })                                                      │
│                                                              │
│   4. Return session                                          │
│      return { sessionId, role: 'STAFF' }                    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         API Response with Cookie                             │
│                                                              │
│   Response Headers:                                          │
│     Set-Cookie: session_id=<sessionId>;                     │
│                 HttpOnly;                                    │
│                 SameSite=Strict;                             │
│                 MaxAge=86400;                                │
│                 Path=/                                       │
│                                                              │
│   Response Body:                                             │
│     {                                                        │
│       success: true,                                         │
│       role: "STAFF",                                         │
│       sessionId: "<sessionId>"                               │
│     }                                                        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              Audit Logging                                   │
│                                                              │
│   await db.insert(schema.auditLog).values({                 │
│     locationId,                                              │
│     sessionId,                                               │
│     action: 'LOGIN_SUCCESS',                                 │
│     resource: 'auth',                                        │
│     ipAddress: request.ip,                                   │
│     success: true,                                           │
│     timestamp: new Date()                                    │
│   })                                                         │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              Frontend Redirect                               │
│                                                              │
│   if (response.ok) {                                         │
│     // Store session info (optional)                         │
│     localStorage.setItem('role', 'STAFF')                    │
│                                                              │
│     // Redirect based on role                                │
│     if (role === 'ADMIN') {                                  │
│       router.push('/admin')                                  │
│     } else {                                                 │
│       router.push('/bartender')                              │
│     }                                                        │
│   }                                                          │
└──────────────────────────────────────────────────────────────┘
```

**Security Features**:
- bcrypt hashing (12 rounds, ~300ms)
- Constant-time comparison (prevents timing attacks)
- Rate limiting (5 attempts/min)
- Session expiration (24 hours)
- Audit logging (all attempts)
- HttpOnly cookies (prevent JS access)

---

## Health Monitoring Flow

```
┌──────────────────────────────────────────────────────────────┐
│              Scheduled Trigger (Cron)                        │
│   PM2 cron job: */5 * * * * (every 5 minutes)                │
│   or Manual API call: POST /api/health/check                │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         Singleton Health Monitor Instance                    │
│   /src/lib/firetv-health-monitor.ts                         │
│   global.firetvHealthMonitor (PM2-persisted)                │
│                                                              │
│   async runHealthCheck() {                                   │
│     // Prevent concurrent checks                             │
│     if (this.isRunning) {                                    │
│       logger.warn('Check already running, skipping')         │
│       return                                                 │
│     }                                                        │
│     this.isRunning = true                                    │
│     ...                                                      │
│   }                                                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│      Load Devices from Config File (NOT Database)           │
│                                                              │
│   const config = JSON.parse(                                 │
│     fs.readFileSync('data/firetv-devices.json', 'utf-8')    │
│   )                                                          │
│   const devices = config.devices                             │
│                                                              │
│   Performance: 0.5ms (vs 50ms database query)                │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│      Parallel Health Checks (Promise.allSettled)             │
│                                                              │
│   const results = await Promise.allSettled(                  │
│     devices.map(device => checkDeviceHealth(device))         │
│   )                                                          │
│                                                              │
│   Benefits:                                                  │
│   - All checks run concurrently (fast)                       │
│   - One failure doesn't stop others                          │
│   - Mix of successes and failures handled gracefully         │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
                  ┌────────┴────────┐
                  │                 │
         Device 1 ▼        Device 2 ▼        Device N...
    ┌──────────────────┐ ┌──────────────────┐
    │ Health Check     │ │ Health Check     │
    │                  │ │                  │
    │ 1. TCP connect   │ │ 1. TCP connect   │
    │    timeout: 2s   │ │    timeout: 2s   │
    │                  │ │                  │
    │ 2. ADB command   │ │ 2. ADB command   │
    │    "getprop"     │ │    "getprop"     │
    │                  │ │                  │
    │ 3. Parse output  │ │ 3. Parse output  │
    │    Check for:    │ │    Check for:    │
    │    - Connection  │ │    - Connection  │
    │    - Response    │ │    - Response    │
    │                  │ │                  │
    │ 4. Determine     │ │ 4. Determine     │
    │    status:       │ │    status:       │
    │    'online' or   │ │    'offline'     │
    │    'offline'     │ │                  │
    └────────┬─────────┘ └────────┬─────────┘
             │                    │
             └────────┬───────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│          Process Results (Mix of Success/Failure)            │
│                                                              │
│   const healthStatuses = results.map((result, index) => {   │
│     if (result.status === 'fulfilled') {                    │
│       return {                                               │
│         deviceId: devices[index].id,                         │
│         status: 'online',                                    │
│         lastSeen: new Date(),                                │
│         responseTime: result.value.responseTime              │
│       }                                                      │
│     } else {                                                 │
│       return {                                               │
│         deviceId: devices[index].id,                         │
│         status: 'offline',                                   │
│         error: result.reason.message                         │
│       }                                                      │
│     }                                                        │
│   })                                                         │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│       Batch Database Update (Single Transaction)            │
│                                                              │
│   await db.transaction(async (tx) => {                      │
│     for (const status of healthStatuses) {                   │
│       await tx.update(schema.fireTVDevices)                  │
│         .set({                                               │
│           status: status.status,                             │
│           lastSeen: status.lastSeen,                         │
│           updatedAt: new Date()                              │
│         })                                                   │
│         .where(eq(schema.fireTVDevices.id, status.deviceId))│
│     }                                                        │
│   })                                                         │
│                                                              │
│   Performance: Single transaction faster than N updates     │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│          Logging (Only Log Failures)                         │
│                                                              │
│   const failures = healthStatuses.filter(s => s.status ===  │
│     'offline')                                               │
│                                                              │
│   if (failures.length > 0) {                                 │
│     logger.warn('[HEALTH] Devices offline', {               │
│       count: failures.length,                                │
│       devices: failures.map(f => f.deviceId)                │
│     })                                                       │
│   }                                                          │
│                                                              │
│   Note: Don't log successes (reduce I/O)                     │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│            Update Monitor State                              │
│                                                              │
│   this.lastCheckTime = new Date()                            │
│   this.isRunning = false                                     │
│                                                              │
│   // Optional: Emit event for UI updates                     │
│   this.emit('check_complete', healthStatuses)                │
└──────────────────────────────────────────────────────────────┘
```

**Performance Optimization Summary**:

| Optimization | Before | After | Improvement |
|--------------|--------|-------|-------------|
| Device List Load | 50ms (DB) | 0.5ms (File) | 100x faster |
| Check Frequency | 1 minute | 5 minutes | 80% fewer checks |
| Database Writes | N individual | 1 transaction | 5-10x faster |
| Logging | All events | Failures only | 95% less I/O |
| **Total DB Load** | 1000 queries/min | 300 queries/min | **70% reduction** |

**Result**: Zero PM2 restarts (down from 95/day)

---

## IR Learning Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    User Action                               │
│   Admin clicks "Learn Power Button" for cable box           │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│          Frontend IR Learning UI                             │
│   (Future: /src/app/admin/ir-learning/page.tsx)             │
│                                                              │
│   const learnCommand = async (deviceId, command) => {       │
│     setStatus('waiting_for_ir')                              │
│     const response = await fetch('/api/ir-devices/learn', {  │
│       method: 'POST',                                        │
│       body: { deviceId, command, timeout: 10000 }            │
│     })                                                       │
│   }                                                          │
│                                                              │
│   UI Display:                                                │
│   "Point your remote at the IR receiver and press POWER"    │
│   [Progress indicator: 10 second timeout]                   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│     API Route: /api/ir-devices/learn/route.ts               │
│                                                              │
│   1. Validate request                                        │
│      - Device exists?                                        │
│      - iTach address configured?                             │
│      - Valid command name?                                   │
│                                                              │
│   2. Get device configuration                                │
│      const device = await findFirst('irDevices', {...})     │
│                                                              │
│   3. Call IR learning service                                │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│       IR Learning Service                                    │
│   /src/lib/global-cache-api.ts: learnIRCode()               │
│                                                              │
│   1. Open TCP connection to iTach                            │
│      socket = net.connect(4998, device.iTachAddress)        │
│                                                              │
│   2. Send learning command                                   │
│      socket.write('get_IRL,1:1\r')                          │
│                                                              │
│      Format: get_IRL,<module>:<port>                         │
│      Example: get_IRL,1:1 (module 1, port 1)                │
│                                                              │
│   3. iTach enters learning mode                              │
│      - IR receiver activates                                 │
│      - Waits for IR signal (10s timeout)                     │
│      - LED blinks indicating ready state                     │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│       User Action (Physical Remote)                          │
│                                                              │
│   1. User points Spectrum cable box remote at iTach          │
│   2. User presses POWER button                               │
│   3. Remote emits IR signal:                                 │
│      - Carrier frequency: 38kHz                              │
│      - Modulated on/off pattern                              │
│      - Duration: ~50ms                                       │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│      Global Cache iTach Processing                           │
│                                                              │
│   1. IR receiver detects signal                              │
│   2. Demodulates carrier (38kHz → baseband)                  │
│   3. Measures timing of on/off pulses                        │
│   4. Converts to Pronto hex format:                          │
│      - Lead-in                                               │
│      - Burst pairs (on time, off time)                       │
│      - Repeat count                                          │
│   5. Generates IR code string                                │
│                                                              │
│   Example output:                                            │
│   "sendir,1:1,1,38000,1,1,342,171,21,21,21,64,21,64..."    │
│                                                              │
│   Format breakdown:                                          │
│   - sendir: Command type                                     │
│   - 1:1: Module:Port                                         │
│   - 1: IR ID                                                 │
│   - 38000: Frequency (Hz)                                    │
│   - 1,1: Repeat settings                                     │
│   - 342,171,...: Burst pairs (µs timing)                     │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│       Receive and Parse IR Code                              │
│                                                              │
│   socket.on('data', (data) => {                              │
│     const response = data.toString()                         │
│                                                              │
│     if (response.startsWith('sendir,')) {                   │
│       // Success - IR code learned                           │
│       const irCode = response.trim()                         │
│       resolve(irCode)                                        │
│     } else if (response.startsWith('IR Learner Enabled')) { │
│       // Still waiting for signal                            │
│     } else if (response.startsWith('ERR')) {                │
│       // Error occurred                                      │
│       reject(new Error(response))                            │
│     }                                                        │
│   })                                                         │
│                                                              │
│   setTimeout(() => {                                         │
│     reject(new Error('Learning timeout - no signal'))       │
│   }, timeout)                                                │
└──────────────────────────┬───────────────────────────────────┘
                           │ IR Code: "sendir,1:1,1,38000..."
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         Store IR Code in Database                            │
│                                                              │
│   1. Get existing IR codes for device                        │
│      const device = await findFirst('irDevices', {...})     │
│      const irCodes = JSON.parse(device.irCodes || '{}')     │
│                                                              │
│   2. Add new code                                            │
│      irCodes[command] = learnedCode                          │
│      // e.g., irCodes["power"] = "sendir,1:1,1,38000..."    │
│                                                              │
│   3. Update database                                         │
│      await update('irDevices', deviceId, {                  │
│        irCodes: JSON.stringify(irCodes),                     │
│        updatedAt: new Date()                                 │
│      })                                                      │
│                                                              │
│   Database field (irCodes):                                  │
│   {                                                          │
│     "power": "sendir,1:1,1,38000,1,1,342,171...",           │
│     "channel_up": "sendir,1:1,1,38000,1,1,342,171...",      │
│     "channel_down": "sendir,1:1,1,38000,1,1,342,171...",    │
│     "0": "sendir,1:1,1,38000,1,1,342,171...",               │
│     "1": "sendir,1:1,1,38000,1,1,342,171...",               │
│     ...                                                      │
│   }                                                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              Response to Client                              │
│                                                              │
│   {                                                          │
│     success: true,                                           │
│     command: "power",                                        │
│     irCode: "sendir,1:1,1,38000,1,1,342,171...",            │
│     message: "IR code learned successfully"                  │
│   }                                                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│            Frontend Display Success                          │
│                                                              │
│   - Show "✓ Learned!" confirmation                           │
│   - Display IR code (truncated for UI)                       │
│   - Enable "Test" button                                     │
│   - Move to next command in sequence                         │
│                                                              │
│   Learning Sequence:                                         │
│   [✓] Power                                                  │
│   [✓] Channel Up                                             │
│   [✓] Channel Down                                           │
│   [ ] Digit 0 ← Current                                      │
│   [ ] Digit 1                                                │
│   ...                                                        │
└──────────────────────────────────────────────────────────────┘
```

**Timing**:
```
API Request: 5ms
Learning Mode: 50ms
Wait for IR Signal: Variable (user action)
iTach Processing: 100ms
Database Update: 10ms
Response: 5ms
────────────────
Total: ~170ms + user action time
```

---

## Audio Control Flow

See [SERVICE_ARCHITECTURE.md](./SERVICE_ARCHITECTURE.md) for detailed Atlas audio flow documentation.

## Matrix Routing Flow

See [SERVICE_ARCHITECTURE.md](./SERVICE_ARCHITECTURE.md) for detailed HDMI matrix flow documentation.

---

## Database Operation Flows

### Insert Operation Flow

```
┌──────────────────────────────────────────────────────────────┐
│         Application Code (Service Layer)                     │
│                                                              │
│   const newDevice = {                                        │
│     id: uuid(),                                              │
│     name: 'TV #1 Fire Cube',                                 │
│     ipAddress: '192.168.1.100',                              │
│     status: 'offline',                                       │
│     createdAt: new Date()                                    │
│   }                                                          │
│                                                              │
│   await create('fireTVDevices', newDevice)                  │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         db-helpers.ts: create()                              │
│                                                              │
│   export async function create<T extends TableName>(        │
│     tableName: T,                                            │
│     data: NewRecord<T>                                       │
│   ): Promise<InferResult<T>> {                              │
│     const table = schema[tableName]                          │
│     const result = await db.insert(table)                    │
│       .values(data)                                          │
│       .returning()                                           │
│     return result[0]                                         │
│   }                                                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         Drizzle ORM Query Builder                            │
│                                                              │
│   Generates SQL:                                             │
│   INSERT INTO FireTVDevice                                   │
│     (id, name, ipAddress, status, createdAt)                 │
│   VALUES                                                     │
│     (?, ?, ?, ?, ?)                                          │
│   RETURNING *                                                │
│                                                              │
│   Parameters bound securely (prevents SQL injection)        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         better-sqlite3 Driver                                │
│                                                              │
│   1. Prepare statement                                       │
│   2. Bind parameters                                         │
│   3. Execute statement                                       │
│   4. Return inserted row                                     │
│                                                              │
│   Performance: ~5ms (indexed table)                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         SQLite Database File                                 │
│   /home/ubuntu/sports-bar-data/production.db                │
│                                                              │
│   1. Write to WAL (Write-Ahead Log)                          │
│   2. Update B-tree index                                     │
│   3. Checkpoint periodically (WAL → main DB)                 │
│                                                              │
│   WAL Mode Benefits:                                         │
│   - Concurrent reads during writes                           │
│   - Atomic commits                                           │
│   - Crash recovery                                           │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         Return Result to Application                         │
│                                                              │
│   {                                                          │
│     id: 'abc-123-...',                                       │
│     name: 'TV #1 Fire Cube',                                 │
│     ipAddress: '192.168.1.100',                              │
│     status: 'offline',                                       │
│     createdAt: 2025-11-06T12:00:00.000Z,                     │
│     updatedAt: 2025-11-06T12:00:00.000Z                      │
│   }                                                          │
└──────────────────────────────────────────────────────────────┘
```

### Query Operation Flow (with Index)

```
┌──────────────────────────────────────────────────────────────┐
│         Application Code                                     │
│                                                              │
│   const device = await findFirst('fireTVDevices', {         │
│     where: eq(schema.fireTVDevices.ipAddress, '192.168.1.100')│
│   })                                                         │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         Drizzle ORM Query Builder                            │
│                                                              │
│   SELECT * FROM FireTVDevice                                 │
│   WHERE ipAddress = ?                                        │
│   LIMIT 1                                                    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         SQLite Query Planner                                 │
│                                                              │
│   1. Check for index on ipAddress column                     │
│   2. Use index (fast lookup, ~1ms)                           │
│      vs Table scan (slow, ~100ms for 1000 rows)              │
│   3. Execute query plan                                      │
│                                                              │
│   EXPLAIN QUERY PLAN:                                        │
│   SEARCH FireTVDevice USING INDEX                            │
│     FireTVDevice_ipAddress_unique (ipAddress=?)             │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         Result                                               │
│   Performance: <1ms (with index)                             │
└──────────────────────────────────────────────────────────────┘
```

---

## Background Job Flows

### Scheduled Health Check (Cron)

```
┌──────────────────────────────────────────────────────────────┐
│              PM2 Cron Scheduler                              │
│   ecosystem.config.js: cron_restart: '*/5 * * * *'          │
│   Triggers every 5 minutes                                   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         Health Monitor Singleton                             │
│   (See Health Monitoring Flow above)                         │
│   Checks all Fire TV devices in parallel                     │
│   Updates database with statuses                             │
└──────────────────────────────────────────────────────────────┘
```

### Sports Event Sync (Daily)

```
┌──────────────────────────────────────────────────────────────┐
│              Scheduled Trigger (Cron)                        │
│   Runs daily at 6 AM                                         │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         Sports API Service                                   │
│   /src/lib/sports-apis/live-sports-service.ts               │
│                                                              │
│   1. Get home teams from database                            │
│   2. For each team:                                          │
│      - Query TheSportsDB API                                 │
│      - Get upcoming games (next 14 days)                     │
│   3. Parse responses                                         │
│   4. Update SportsEvent table                                │
│   5. Log sync results to SportsEventSyncLog                  │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         External API Calls                                   │
│   TheSportsDB API (with circuit breaker)                     │
│   - Rate limiting (1000 req/day)                             │
│   - Retry with backoff on failure                            │
│   - Cache responses (1 hour TTL)                             │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         Database Updates                                     │
│   - Upsert events (insert or update)                         │
│   - Mark old events as past                                  │
│   - Update channel assignments                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Error Propagation

### Error Flow (Device Offline)

```
┌──────────────────────────────────────────────────────────────┐
│         Hardware Layer                                       │
│   ADB Client attempts connection                             │
│   Error: ECONNREFUSED (device offline)                       │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         Service Layer                                        │
│   /src/lib/adb-client.ts                                    │
│                                                              │
│   try {                                                      │
│     await socket.connect(ipAddress, 5555)                    │
│   } catch (error) {                                          │
│     if (error.code === 'ECONNREFUSED') {                    │
│       throw new DeviceOfflineError(deviceId)                │
│     }                                                        │
│     throw error                                              │
│   }                                                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         API Route Handler                                    │
│   /src/app/api/firetv/[id]/launch-app/route.ts              │
│                                                              │
│   try {                                                      │
│     const result = await ADBService.launchApp(...)           │
│   } catch (error) {                                          │
│     if (error instanceof DeviceOfflineError) {              │
│       logger.error('[FIRETV] Device offline', { deviceId }) │
│                                                              │
│       // Update device status                                │
│       await update('fireTVDevices', deviceId, {             │
│         status: 'offline'                                    │
│       })                                                     │
│                                                              │
│       return NextResponse.json({                            │
│         success: false,                                      │
│         error: 'Device is offline',                          │
│         code: 'DEVICE_OFFLINE'                               │
│       }, { status: 503 })                                    │
│     }                                                        │
│     // Handle other errors...                                │
│   }                                                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         Frontend Error Handling                              │
│                                                              │
│   const response = await fetch(...)                          │
│   const data = await response.json()                         │
│                                                              │
│   if (!data.success) {                                       │
│     if (data.code === 'DEVICE_OFFLINE') {                   │
│       toast.error('Device is offline. Please check device.')│
│       setDeviceStatus('offline')                             │
│     } else {                                                 │
│       toast.error(data.error)                                │
│     }                                                        │
│   }                                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Summary

### Flow Characteristics

| Flow Type | Latency | Complexity | Error Handling |
|-----------|---------|------------|----------------|
| User Interactions | 50-200ms | Medium | Retry + fallback |
| Health Monitoring | 1-5s | High | Graceful degradation |
| Database Ops | <10ms | Low | Transaction rollback |
| Background Jobs | Varies | High | Circuit breaker |
| IR Learning | ~200ms | Medium | Timeout + retry |

### Performance Optimizations

1. **Singleton Health Monitor**: Prevents duplicate instances
2. **Config File Reads**: 100x faster than database queries
3. **Batch Updates**: Single transaction for multiple updates
4. **Promise.allSettled**: Parallel operations don't block each other
5. **Command Queuing**: Prevents hardware conflicts
6. **Caching**: Reduces redundant operations

### Key Patterns

1. **Standard Middleware Chain**: Rate limit → Validate → Auth → Business logic
2. **Command Queue Pattern**: Serialize hardware access
3. **Circuit Breaker**: Protect external APIs
4. **Retry with Backoff**: Handle transient failures
5. **Graceful Degradation**: Fallback to cached/default data

---

## Related Documentation

- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - Overall system design
- [SERVICE_ARCHITECTURE.md](./SERVICE_ARCHITECTURE.md) - Service layer details
- [CODE_PATTERNS.md](./CODE_PATTERNS.md) - Design patterns
- [ARCHITECTURE_DECISION_RECORDS.md](./ARCHITECTURE_DECISION_RECORDS.md) - ADRs
- [PERFORMANCE_IMPROVEMENTS.md](./PERFORMANCE_IMPROVEMENTS.md) - Optimizations

---

*Data Flow Architecture v1.0.0*
