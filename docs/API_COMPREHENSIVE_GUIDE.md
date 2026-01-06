# API Comprehensive Guide

**Sports Bar TV Controller - Complete API Reference**

**Version:** 1.0
**Last Updated:** November 6, 2025
**Total Endpoints:** 250
**Base URL (Production):** `http://localhost:3001/api`
**Base URL (Development):** `http://localhost:3000/api`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Request Validation](#request-validation)
5. [Common Response Formats](#common-response-formats)
6. [API Categories](#api-categories)
7. [New Features (Nov 2025)](#new-features-nov-2025)
8. [Testing Examples](#testing-examples)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)

---

## Overview

The Sports Bar TV Controller provides a comprehensive REST API for managing:
- **Device Control**: Fire TV, DirecTV, IR devices, CEC devices
- **Video Routing**: Wolf Pack HDMI matrix switching
- **Audio Control**: AtlasIED audio processors, Soundtrack streaming
- **Sports Programming**: Multi-provider sports guide integration
- **Channel Management**: Quick-access channel presets
- **Scheduling**: Automated device control and routing
- **AI Features**: Intelligent diagnostics, log analysis, optimization
- **System Management**: Health monitoring, logging, configuration

### Key Features

- ✅ **250 API endpoints** across 21 categories
- ✅ **Rate limiting** on all endpoints (16 configurations)
- ✅ **Input validation** using Zod schemas (68 schemas)
- ✅ **Authentication** via PIN or API keys
- ✅ **Real-time monitoring** for device health
- ✅ **AI-powered** diagnostics and optimization
- ✅ **100% TypeScript** with zero errors

---

## Authentication

### Authentication Methods

#### 1. PIN Authentication (Web UI)
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin": "1234"}'
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-1",
    "role": "bartender"
  },
  "sessionToken": "abc123..."
}
```

#### 2. API Key Authentication (External Integrations)
```bash
curl http://localhost:3001/api/system/health \
  -H "X-API-Key: your-api-key-here"
```

### Protected Endpoints

- **Write Operations** (POST, PUT, DELETE) - Require authentication
- **Read Operations** (GET) - Most accessible without auth for local network convenience
- **Sensitive Operations** - Always require authentication

### Session Management

**Get Current Session:**
```bash
GET /api/auth/session
```

**Logout:**
```bash
POST /api/auth/logout
```

---

## Rate Limiting

All API endpoints are rate-limited using a sliding window algorithm.

### Rate Limit Configurations

| Config | Limit | Duration | Use Case |
|--------|-------|----------|----------|
| **DEFAULT** | 30 | 60s | Standard endpoints |
| **AUTH** | 10 | 60s | Authentication endpoints |
| **AI** | 5 | 60s | AI-powered features |
| **HARDWARE** | 60 | 60s | Device control |
| **EXPENSIVE** | 2 | 60s | Resource-intensive ops |
| **SPORTS_DATA** | 30 | 60s | Sports guide queries |
| **DATABASE_READ** | 60 | 60s | Log/data queries |
| **DATABASE_WRITE** | 30 | 60s | Data modifications |
| **FILE_OPS** | 20 | 60s | File operations |
| **GIT** | 10 | 60s | Git operations |
| **EXTERNAL** | 20 | 60s | External API calls |
| **SCHEDULER** | 30 | 60s | Scheduling operations |
| **SYSTEM** | 100 | 60s | System health checks |
| **WEBHOOK** | 100 | 60s | Webhook endpoints |
| **TESTING** | 50 | 60s | Test endpoints |

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1699286400
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 45
}
```

---

## Request Validation

All endpoints use Zod schemas for request validation.

### Validation Examples

#### POST Request with Body Validation

```typescript
// ✅ CORRECT
const bodyValidation = await validateRequestBody(request, schema)
if (!bodyValidation.success) return bodyValidation.error
const body = bodyValidation.data // Use this!

// ❌ WRONG - This will fail
const bodyValidation = await validateRequestBody(request, schema)
const body = await request.json() // ERROR: Body already consumed!
```

#### GET Request with Query Validation

```typescript
// ✅ CORRECT
const queryValidation = validateQueryParams(request, schema)
if (!queryValidation.success) return queryValidation.error
const { page, limit } = queryValidation.data

// ❌ WRONG
const bodyValidation = await validateRequestBody(request, schema) // ERROR: GET has no body!
```

### Common Validation Schemas

**Device ID:**
```typescript
z.string().min(1).regex(/^[a-z0-9-]+$/)
```

**IP Address:**
```typescript
z.string().ip() // or z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)
```

**Channel Number:**
```typescript
z.string().regex(/^\d{1,5}$/)
```

**Pagination:**
```typescript
z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
})
```

---

## Common Response Formats

### Success Response

```json
{
  "success": true,
  "data": { /* response data */ }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
```

### Validation Error

```json
{
  "success": false,
  "error": "Validation failed",
  "issues": [
    {
      "path": ["deviceId"],
      "message": "Device ID is required"
    }
  ]
}
```

### HTTP Status Codes

- **200** - Success
- **201** - Created
- **400** - Bad Request (validation error)
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **429** - Rate Limit Exceeded
- **500** - Internal Server Error

---

## API Categories

### 1. Authentication (11 endpoints)

**Rate Limit:** AUTH (10/min)

**Key Endpoints:**
- `POST /api/auth/login` - PIN authentication
- `POST /api/auth/logout` - End session
- `GET /api/auth/session` - Current session
- `GET /api/auth/api-keys` - List API keys
- `POST /api/auth/api-keys` - Create API key
- `GET /api/auth/audit-log` - Auth logs

**Example - Login:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin": "1234"}'
```

---

### 2. Fire TV Devices (8 endpoints)

**Rate Limit:** HARDWARE (60/min)

**Key Endpoints:**
- `GET /api/firetv-devices` - List devices
- `POST /api/firetv-devices` - Add device
- `POST /api/firetv-devices/send-command` - Send ADB command
- `POST /api/firetv-devices/test-connection` - Test connection
- `GET /api/firetv-devices/connection-status` - **NEW** Health monitoring

**Example - Send Command:**
```bash
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "ftv-1",
    "command": "input keyevent KEYCODE_HOME"
  }'
```

**Example - Get Health Status:**
```bash
# All devices
curl http://localhost:3001/api/firetv-devices/connection-status

# Specific device
curl "http://localhost:3001/api/firetv-devices/connection-status?deviceId=ftv-1"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "deviceId": "ftv-1",
        "deviceName": "Fire TV - Main Bar",
        "deviceAddress": "192.168.1.200:5555",
        "connection": {
          "status": "connected",
          "lastActivity": "2025-11-06T10:30:00Z",
          "connectionAttempts": 1,
          "lastError": null
        },
        "health": {
          "isHealthy": true,
          "lastCheck": "2025-11-06T10:29:45Z",
          "error": null,
          "reconnectAttempts": 0
        }
      }
    ],
    "statistics": {
      "totalDevices": 5,
      "healthyDevices": 4,
      "unhealthyDevices": 1,
      "totalChecks": 1234,
      "totalErrors": 2
    }
  }
}
```

---

### 3. DirecTV Devices (12 endpoints)

**Rate Limit:** HARDWARE (60/min)

**Key Endpoints:**
- `GET /api/directv-devices` - List devices
- `POST /api/directv-devices/send-command` - Send command
- `POST /api/directv-devices/smart-channel-change` - AI channel change
- `POST /api/directv-devices/diagnose` - Run diagnostics
- `GET /api/directv-devices/ai-insights` - AI insights

**Example - Channel Change:**
```bash
curl -X POST http://localhost:3001/api/directv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "dtv-1",
    "command": "tune",
    "channel": "705"
  }'
```

---

### 4. IR Devices & Global Cache (41 endpoints)

**Rate Limit:** HARDWARE (60/min)

**Key Endpoints:**
- `GET /api/ir-devices` - List devices
- `POST /api/ir-devices/send-command` - Send IR command
- `POST /api/ir-devices/learn` - **NEW** Learn IR code from remote
- `GET /api/ir-devices/search-codes` - Search code database
- `GET /api/ir/database/brands` - List device brands
- `POST /api/globalcache/learn` - Learn via iTach

**Example - Send IR Command:**
```bash
curl -X POST http://localhost:3001/api/ir-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "ir-1",
    "command": "power",
    "iTachAddress": "192.168.1.150"
  }'
```

**Example - Learn IR Code (NEW):**
```bash
curl -X POST http://localhost:3001/api/ir-devices/learn \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "ir-1",
    "commandName": "power",
    "iTachAddress": "192.168.1.150",
    "module": 1,
    "connector": 1
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "IR code learned successfully",
  "irCode": "sendir,1:1,1,38000,1,1,342,171,21,64,21,64,21,64,..."
}
```

---

### 5. CEC Control (13 endpoints)

**Rate Limit:** HARDWARE (60/min)
**Note:** ⚠️ Deprecated for Spectrum cable boxes (use IR instead)

**Key Endpoints:**
- `GET /api/cec/devices` - List CEC devices
- `POST /api/cec/command` - Send CEC command
- `POST /api/cec/power-control` - TV power control
- `POST /api/cec/scan` - Scan for devices

**Example:**
```bash
curl -X POST http://localhost:3001/api/cec/power-control \
  -H "Content-Type: application/json" \
  -d '{
    "tvAddress": "0",
    "command": "on"
  }'
```

---

### 6. Matrix & Video Routing (17 endpoints)

**Rate Limit:** HARDWARE (60/min)

**Key Endpoints:**
- `POST /api/matrix/command` - Send matrix command
- `GET /api/matrix/routes` - Get active routes
- `POST /api/matrix/route` - Route input to output
- `POST /api/wolfpack/route-to-matrix` - Wolf Pack routing

**Example - Route Input to Output:**
```bash
curl -X POST http://localhost:3001/api/matrix/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "I1O5",
    "ipAddress": "192.168.1.100",
    "port": 23,
    "protocol": "TCP"
  }'
```

**Response:**
```json
{
  "success": true,
  "response": "OK",
  "command": "I1O5.",
  "message": "Command executed successfully"
}
```

---

### 7. Audio Control (28 endpoints)

**Rate Limit:** HARDWARE (60/min)

**Key Endpoints:**
- `GET /api/audio-processor/zones` - Get zones
- `POST /api/audio-processor/control` - Send command
- `GET /api/atlas/configuration` - Atlas config
- `POST /api/atlas/ai-analysis` - AI audio analysis
- `GET /api/atlas/input-meters` - Input meters

**Example - Set Zone Volume:**
```bash
curl -X POST http://localhost:3001/api/audio-processor/control \
  -H "Content-Type: application/json" \
  -d '{
    "processorId": "atlas-1",
    "zone": 1,
    "action": "setVolume",
    "value": 75
  }'
```

---

### 8. Soundtrack Integration (8 endpoints)

**Rate Limit:** EXTERNAL (20/min)

**Key Endpoints:**
- `GET /api/soundtrack/now-playing` - Current track
- `GET /api/soundtrack/players` - List players
- `POST /api/soundtrack/config` - Update config

**Example - Now Playing:**
```bash
curl "http://localhost:3001/api/soundtrack/now-playing?playerId=abc123"
```

**Response:**
```json
{
  "success": true,
  "nowPlaying": {
    "track": {
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "albumArt": "https://..."
    },
    "playing": true,
    "position": 45,
    "duration": 180
  }
}
```

---

### 9. Sports Guide & Entertainment (21 endpoints)

**Rate Limit:** SPORTS_DATA (30/min)

**Key Endpoints:**
- `GET /api/sports-guide` - Get programming guide
- `GET /api/sports-guide/channels` - Channel guide
- `GET /api/sports-guide/scheduled` - Scheduled games
- `GET /api/sports/upcoming` - Upcoming games

**Example - Get 7-Day Guide:**
```bash
curl http://localhost:3001/api/sports-guide
```

**Example - Custom Days:**
```bash
curl -X POST http://localhost:3001/api/sports-guide \
  -H "Content-Type: application/json" \
  -d '{"days": 3}'
```

---

### 10. Channel Management (10 endpoints)

**Rate Limit:** SPORTS_DATA (30/min)

**Key Endpoints:**
- `GET /api/channel-presets` - List presets
- `POST /api/channel-presets` - Create preset
- `POST /api/channel-presets/tune` - Tune to channel
- `GET /api/channel-presets/statistics` - Usage stats

**Example - Tune to Channel:**
```bash
curl -X POST http://localhost:3001/api/channel-presets/tune \
  -H "Content-Type: application/json" \
  -d '{
    "presetId": "preset-123",
    "channelNumber": "705",
    "deviceType": "cable"
  }'
```

---

### 11. Scheduling & Automation (14 endpoints)

**Rate Limit:** SCHEDULER (30/min)

**Key Endpoints:**
- `GET /api/schedules` - List schedules
- `POST /api/schedules` - Create schedule
- `POST /api/schedules/execute` - Execute now
- `GET /api/scheduler/status` - Scheduler status

**Example - Create Schedule:**
```bash
curl -X POST http://localhost:3001/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunday NFL Package",
    "enabled": true,
    "schedule": "0 13 * * 0",
    "action": "route_input",
    "params": {
      "input": 1,
      "outputs": [1, 2, 3, 4]
    }
  }'
```

---

### 12. AI & Analytics (17 endpoints)

**Rate Limit:** AI (5/min) - Strict limit for resource-intensive operations

**Key Endpoints:**
- `POST /api/devices/intelligent-diagnostics` - AI diagnostics
- `POST /api/devices/ai-analysis` - Device analysis
- `POST /api/logs/ai-analysis` - Log analysis
- `POST /api/atlas/ai-analysis` - Audio analysis
- `POST /api/ai-assistant/analyze-logs` - Assistant log analysis
- `POST /api/ai-assistant/search-code` - Code search

**Example - Device Diagnostics:**
```bash
curl -X POST http://localhost:3001/api/devices/intelligent-diagnostics \
  -H "Content-Type: application/json" \
  -d '{
    "deviceType": "firetv",
    "deviceId": "ftv-1"
  }'
```

**Response:**
```json
{
  "success": true,
  "diagnostics": {
    "status": "issues_found",
    "issues": [
      {
        "severity": "medium",
        "description": "Device not responding",
        "recommendation": "Restart device or check network"
      }
    ],
    "healthScore": 65
  }
}
```

---

### 13. System Management (13 endpoints)

**Rate Limit:** SYSTEM (100/min) - High limit for health checks

**Key Endpoints:**
- `GET /api/system/health` - **Comprehensive health check**
- `GET /api/system/status` - System status
- `POST /api/system/restart` - Restart server
- `GET /api/health` - Simple health check

**Example - Health Check:**
```bash
curl http://localhost:3001/api/system/health
```

**Response:**
```json
{
  "timestamp": "2025-11-06T10:30:00Z",
  "overall": {
    "status": "healthy",
    "health": 95,
    "devicesOnline": 23,
    "devicesTotal": 25,
    "activeIssues": 2
  },
  "categories": {
    "tvs": [...],
    "cableBoxes": [...],
    "audioZones": [...],
    "matrix": [...],
    "other": [...]
  },
  "aiSuggestions": [
    {
      "priority": "high",
      "message": "2 device(s) are offline or having issues.",
      "action": "view_issues"
    }
  ]
}
```

---

### 14. Logging & Monitoring (17 endpoints)

**Rate Limit:** DATABASE_READ (60/min)

**Key Endpoints:**
- `GET /api/logs/recent` - Recent logs
- `GET /api/logs/error` - Error logs
- `GET /api/logs/analytics` - Log analytics
- `GET /api/logs/device-interaction` - Device logs
- `POST /api/logs/ai-analysis` - AI log analysis

**Example - Recent Logs:**
```bash
curl "http://localhost:3001/api/logs/recent?limit=50"
```

---

### 15. Memory Bank & RAG (10 endpoints) - **NEW**

**Rate Limit:** DEFAULT (30/min)

**Memory Bank Endpoints:**
- `GET /api/memory-bank/current` - **NEW** Latest snapshot
- `GET /api/memory-bank/history` - **NEW** Snapshot history
- `POST /api/memory-bank/snapshot` - **NEW** Create snapshot
- `GET /api/memory-bank/restore/[id]` - **NEW** Restore snapshot

**RAG Endpoints:**
- `GET /api/rag/stats` - **NEW** Vector store stats
- `POST /api/rag/query` - **NEW** Query documentation with Ollama
- `POST /api/rag/rebuild` - **NEW** Rebuild vector store
- `GET /api/rag/docs` - **NEW** List indexed docs

**Example - Memory Bank Snapshot:**
```bash
curl http://localhost:3001/api/memory-bank/current
```

**Example - RAG Query:**
```bash
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I configure IR learning?",
    "tech": "ir",
    "topK": 5
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "answer": "To configure IR learning, you need to...",
    "sources": [
      {
        "file": "IR_LEARNING_DEMO_SCRIPT.md",
        "content": "...",
        "relevance": 0.95
      }
    ],
    "confidence": 0.92
  }
}
```

---

### 16. File Operations (16 endpoints)

**Rate Limit:** FILE_OPS (20/min)

**Key Endpoints:**
- `POST /api/backup` - Create backup
- `POST /api/upload` - Upload file
- `GET /api/bartender/layout` - Get layout
- `POST /api/bartender/layout/upload` - Upload layout

---

### 17. Git & GitHub (5 endpoints)

**Rate Limit:** GIT (10/min)

**Key Endpoints:**
- `GET /api/git/status` - Git status
- `POST /api/git/commit-push` - Commit and push
- `POST /api/git/pull` - Pull changes
- `POST /api/github/push-config` - Push config to GitHub

---

### 18. Streaming Platforms (9 endpoints)

**Rate Limit:** EXTERNAL (20/min)

**Key Endpoints:**
- `POST /api/streaming/launch` - Launch streaming app
- `GET /api/streaming/apps/detect` - Detect apps
- `GET /api/streaming-platforms/status` - Platform status

---

### 19. Testing (4 endpoints)

**Rate Limit:** TESTING (50/min)

**Key Endpoints:**
- `POST /api/tests/run` - Run tests
- `GET /api/tests/logs` - Test logs
- `POST /api/tests/wolfpack/connection` - Test Wolf Pack
- `POST /api/tests/wolfpack/switching` - Test switching

---

### 20. Todo Management (7 endpoints)

**Rate Limit:** DEFAULT (30/min)

**Key Endpoints:**
- `GET /api/todos` - List todos
- `POST /api/todos` - Create todo
- `POST /api/todos/[id]/complete` - Mark complete
- `GET /api/todos/[id]/documents` - Get documents

---

### 21. Other Endpoints (9 endpoints)

Various endpoints for specialized features:
- `POST /api/chat` - AI chat
- `POST /api/enhanced-chat` - Enhanced AI chat
- `GET /api/cache/stats` - Cache statistics
- `POST /api/web-search` - Web search
- `GET /api/circuit-breaker/status` - Circuit breaker status
- `GET /api/ai-system/status` - AI system status
- `POST /api/n8n/webhook` - n8n webhook

---

## New Features (Nov 2025)

### 1. Fire TV Health Monitoring

**Endpoint:** `GET /api/firetv-devices/connection-status`

**Features:**
- Real-time connection status
- Health monitoring with reconnect attempts
- Statistics tracking
- Memory leak fixed (Nov 4, 2025)

### 2. IR Learning System

**Endpoint:** `POST /api/ir-devices/learn`

**Features:**
- Learn IR codes from physical remotes
- Global Cache iTach IP2IR integration
- Store learned codes in database
- Test learned codes immediately

**Use Case:** Essential for Spectrum cable boxes (CEC disabled by firmware)

### 3. Memory Bank System

**Endpoints:**
- `GET /api/memory-bank/current`
- `GET /api/memory-bank/history`
- `POST /api/memory-bank/snapshot`

**Features:**
- Automatic project context snapshots
- Resume-after-restart capability
- Git status preservation
- File change tracking

### 4. RAG Documentation System

**Endpoint:** `POST /api/rag/query`

**Features:**
- Query documentation using Ollama LLM
- Vector similarity search
- Tech-specific filtering
- Source attribution

**Requirements:**
- Ollama with llama3.1:8b model
- nomic-embed-text for embeddings

---

## Testing Examples

### 1. Complete Fire TV Workflow

```bash
# List devices
curl http://localhost:3001/api/firetv-devices

# Test connection
curl -X POST http://localhost:3001/api/firetv-devices/test-connection \
  -H "Content-Type: application/json" \
  -d '{"ipAddress": "192.168.1.200", "port": 5555}'

# Send command
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "ftv-1", "command": "input keyevent KEYCODE_HOME"}'

# Check health
curl "http://localhost:3001/api/firetv-devices/connection-status?deviceId=ftv-1"
```

### 2. Matrix Routing Workflow

```bash
# Get current routes
curl http://localhost:3001/api/matrix/routes

# Route input 1 to output 5
curl -X POST http://localhost:3001/api/matrix/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "I1O5",
    "ipAddress": "192.168.1.100",
    "port": 23
  }'

# Verify routing
curl http://localhost:3001/api/matrix/routes
```

### 3. IR Learning Workflow

```bash
# Start learning session
curl -X POST http://localhost:3001/api/ir-devices/learn \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "ir-1",
    "commandName": "power",
    "iTachAddress": "192.168.1.150",
    "module": 1,
    "connector": 1
  }'

# Point remote at IR receiver and press button (within 10 seconds)

# Test learned code
curl -X POST http://localhost:3001/api/ir-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "ir-1",
    "command": "power",
    "isRawCode": true
  }'
```

### 4. Sports Guide Workflow

```bash
# Get 7-day guide
curl http://localhost:3001/api/sports-guide

# Filter by team
curl "http://localhost:3001/api/sports-guide/channels?search=Patriots"

# Get scheduled games
curl http://localhost:3001/api/sports-guide/scheduled
```

### 5. RAG Documentation Query

```bash
# Query documentation
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I configure a Fire TV device?",
    "tech": "hardware",
    "topK": 3
  }'

# Get RAG stats
curl http://localhost:3001/api/rag/stats
```

### 6. System Health Check

```bash
# Comprehensive health check
curl http://localhost:3001/api/system/health

# Simple health check
curl http://localhost:3001/api/health

# System status
curl http://localhost:3001/api/system/status
```

---

## Error Handling

### Common Errors

#### 1. Validation Error (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "issues": [
    {
      "path": ["ipAddress"],
      "message": "Invalid IP address format"
    }
  ]
}
```

#### 2. Rate Limit Exceeded (429)
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 45
}
```

#### 3. Authentication Required (401)
```json
{
  "success": false,
  "error": "Authentication required",
  "message": "Please log in to access this endpoint"
}
```

#### 4. Device Not Found (404)
```json
{
  "success": false,
  "error": "Device not found",
  "deviceId": "ftv-999"
}
```

#### 5. Hardware Communication Error (500)
```json
{
  "success": false,
  "error": "Failed to communicate with device",
  "details": "Connection timeout after 5 seconds"
}
```

### Error Recovery Strategies

**Connection Errors:**
```bash
# Test connection first
curl -X POST http://localhost:3001/api/firetv-devices/test-connection \
  -H "Content-Type: application/json" \
  -d '{"ipAddress": "192.168.1.200", "port": 5555}'

# If test fails, check device status
curl http://localhost:3001/api/firetv-devices/connection-status
```

**Rate Limit Errors:**
```bash
# Check rate limit headers
curl -v http://localhost:3001/api/sports-guide

# Response includes:
# X-RateLimit-Remaining: 0
# X-RateLimit-Reset: 1699286400

# Wait for reset or reduce request frequency
```

---

## Best Practices

### 1. Use Appropriate Rate Limits

```bash
# Hardware operations - High frequency allowed (60/min)
curl http://localhost:3001/api/firetv-devices/send-command

# AI operations - Low frequency (5/min)
curl http://localhost:3001/api/devices/intelligent-diagnostics
```

### 2. Validate Before Sending

```bash
# Test connection before sending commands
curl -X POST http://localhost:3001/api/firetv-devices/test-connection \
  -d '{"ipAddress": "192.168.1.200", "port": 5555}'

# Then send command
curl -X POST http://localhost:3001/api/firetv-devices/send-command \
  -d '{"deviceId": "ftv-1", "command": "..."}'
```

### 3. Monitor Health Status

```bash
# Regular health checks
curl http://localhost:3001/api/system/health

# Device-specific health
curl "http://localhost:3001/api/firetv-devices/connection-status?deviceId=ftv-1"
```

### 4. Use Pagination for Large Datasets

```bash
# Paginate logs
curl "http://localhost:3001/api/logs/recent?page=1&limit=50"
curl "http://localhost:3001/api/logs/recent?page=2&limit=50"
```

### 5. Leverage AI Features

```bash
# AI diagnostics for troubleshooting
curl -X POST http://localhost:3001/api/devices/intelligent-diagnostics \
  -d '{"deviceType": "firetv", "deviceId": "ftv-1"}'

# AI log analysis for patterns
curl -X POST http://localhost:3001/api/logs/ai-analysis \
  -d '{"startDate": "2025-11-01", "endDate": "2025-11-06"}'
```

### 6. Use Memory Bank for Context

```bash
# Get latest project state
curl http://localhost:3001/api/memory-bank/current

# Create snapshot before major changes
curl -X POST http://localhost:3001/api/memory-bank/snapshot
```

### 7. Query Documentation via RAG

```bash
# Instead of searching docs manually
curl -X POST http://localhost:3001/api/rag/query \
  -d '{
    "query": "How do I troubleshoot Fire TV connection issues?",
    "tech": "hardware"
  }'
```

---

## Performance Considerations

### Recent Optimizations (Nov 2025)

1. **Fire TV Health Monitor Fix** (Nov 4, 2025)
   - Fixed memory leak
   - Reduced polling frequency
   - Improved error handling
   - Performance boost: 95 restarts eliminated

2. **Rate Limiting**
   - In-memory storage (Map-based)
   - Automatic cleanup every 5 minutes
   - Minimal overhead (<1ms per request)

3. **Validation**
   - Zod validation: ~0.5-2ms per request
   - Cached schema compilation
   - Early validation failure (fast fail)

### Database Performance

- **ORM:** Drizzle with SQLite
- **Connection pooling:** Enabled
- **Indexed queries:** Common queries indexed
- **Query time:** <10ms for most queries

---

## Support & Troubleshooting

### Documentation References

- **API Reference:** `/docs/API_REFERENCE.md`
- **API Categorization:** `/docs/API_ENDPOINT_CATEGORIZATION.md`
- **API Audit Report:** `/docs/API_DOCUMENTATION_AUDIT_REPORT.md`
- **Hardware Setup:** `/docs/HARDWARE_CONFIGURATION.md`
- **IR Learning Guide:** `/docs/IR_LEARNING_DEMO_SCRIPT.md`
- **Memory Bank Guide:** `/MEMORY_BANK_IMPLEMENTATION.md`
- **RAG Guide:** `/RAG_IMPLEMENTATION_REPORT.md`

### Common Issues

**Issue:** Fire TV not responding
```bash
# Check connection status
curl "http://localhost:3001/api/firetv-devices/connection-status?deviceId=ftv-1"

# Test connection
curl -X POST http://localhost:3001/api/firetv-devices/test-connection \
  -d '{"ipAddress": "192.168.1.200", "port": 5555}'

# Run diagnostics
curl -X POST http://localhost:3001/api/devices/intelligent-diagnostics \
  -d '{"deviceType": "firetv", "deviceId": "ftv-1"}'
```

**Issue:** Spectrum cable box not responding to CEC
```bash
# CEC is disabled by Spectrum firmware - Use IR instead
curl -X POST http://localhost:3001/api/ir-devices/learn \
  -d '{
    "deviceId": "ir-cable-1",
    "commandName": "power",
    "iTachAddress": "192.168.1.150"
  }'
```

**Issue:** Rate limit exceeded
```bash
# Check remaining requests
curl -v http://localhost:3001/api/sports-guide | grep X-RateLimit

# Wait for reset or reduce frequency
```

---

## OpenAPI Specification

**Status:** Not yet generated

**Recommendation:** Generate OpenAPI 3.0 specification for:
- API client generation
- Postman/Insomnia collections
- Interactive documentation (Swagger UI)
- Contract testing

**Tools to Consider:**
- `zod-to-openapi` - Generate from Zod schemas
- `swagger-autogen` - Auto-generate from routes
- Manual YAML specification

---

## Changelog

### November 6, 2025
- ✅ Comprehensive API documentation created
- ✅ 250 endpoints cataloged
- ✅ Rate limiting documented
- ✅ Validation schemas documented
- ✅ New features documented (IR learning, Memory Bank, RAG)

### November 4, 2025
- ✅ Fire TV health monitor memory leak fixed
- ✅ Performance optimization completed
- ✅ 95 restarts eliminated

### November 2, 2025
- ✅ TypeScript perfection achieved (0 errors)
- ✅ API_REFERENCE.md initial version

---

**Last Updated:** November 6, 2025
**Documentation Version:** 1.0
**API Version:** 1.0
**Status:** ✅ Complete

---

For questions or issues, please refer to the main [README.md](../README.md) or open an issue on GitHub.
