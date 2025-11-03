# API Reference Guide

Complete documentation for all Sports Bar TV Controller API endpoints.

**Last Updated:** November 2, 2025
**API Version:** 1.0

## Table of Contents

- [Authentication](#authentication)
- [System Endpoints](#system-endpoints)
- [Matrix Control](#matrix-control)
- [CEC Control](#cec-control)
- [Audio Management](#audio-management)
- [Sports Guide](#sports-guide)
- [Device Management](#device-management)
- [Scheduling](#scheduling)
- [AI Features](#ai-features)
- [Deprecated Endpoints](#deprecated-endpoints)

---

## Authentication

Currently, the API does not require authentication for local network access. All endpoints are accessible via HTTP without tokens.

**Base URL:** `http://localhost:3000/api`

---

## System Endpoints

### System Health Check

Get comprehensive health status for all system components.

**Endpoint:** `GET /api/system/health`

**Response:**
```json
{
  "timestamp": "2025-11-02T10:30:00.000Z",
  "overall": {
    "status": "healthy",
    "health": 95,
    "devicesOnline": 23,
    "devicesTotal": 25,
    "activeIssues": 2
  },
  "categories": {
    "tvs": [
      {
        "id": "tv-1",
        "name": "TV 1 - Main Bar",
        "type": "tv",
        "status": "online",
        "health": 100,
        "issues": [],
        "quickActions": [
          {
            "label": "Switch Input",
            "action": "route_input",
            "params": { "output": 1 }
          }
        ]
      }
    ],
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

**Status Codes:**
- `200` - Success
- `500` - Server error

**Example:**
```bash
curl http://localhost:3000/api/system/health
```

### System Status

Get basic system status information.

**Endpoint:** `GET /api/system/status`

**Response:**
```json
{
  "success": true,
  "status": "running",
  "uptime": 86400,
  "version": "1.0.0"
}
```

### System Restart

Restart the application server.

**Endpoint:** `POST /api/system/restart`

**Response:**
```json
{
  "success": true,
  "message": "System restart initiated"
}
```

---

## Matrix Control

### Send Matrix Command

Send a direct command to the Wolf Pack HDMI matrix.

**Endpoint:** `POST /api/matrix/command`

**Request Body:**
```json
{
  "command": "I1O1",
  "ipAddress": "192.168.1.100",
  "port": 23,
  "protocol": "TCP"
}
```

**Parameters:**
- `command` (string, required) - Wolf Pack command (e.g., "I1O1" to route input 1 to output 1)
- `ipAddress` (string, required) - Matrix IP address
- `port` (number, required) - Matrix port (default: 23)
- `protocol` (string) - "TCP" or "UDP" (default: "TCP")

**Response:**
```json
{
  "success": true,
  "response": "OK",
  "command": "I1O1.",
  "message": "Command executed successfully",
  "timestamp": "2025-11-02T10:30:00.000Z"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/matrix/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "I1O1",
    "ipAddress": "192.168.1.100",
    "port": 23
  }'
```

### Get Matrix Routes

Get all active matrix routing configurations.

**Endpoint:** `GET /api/matrix/routes`

**Response:**
```json
{
  "success": true,
  "routes": [
    {
      "inputNum": 1,
      "outputNum": 1,
      "isActive": true
    },
    {
      "inputNum": 2,
      "outputNum": 2,
      "isActive": true
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/api/matrix/routes
```

### Get Matrix Configuration

Get stored matrix configuration.

**Endpoint:** `GET /api/matrix/config`

**Response:**
```json
{
  "success": true,
  "id": 1,
  "name": "Main Matrix",
  "ipAddress": "192.168.1.100",
  "port": 23,
  "protocol": "TCP",
  "isActive": true
}
```

### Test Matrix Connection

Test connection to the Wolf Pack matrix.

**Endpoint:** `POST /api/matrix/test-connection`

**Request Body:**
```json
{
  "ipAddress": "192.168.1.100",
  "port": 23
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connection successful",
  "responseTime": 45
}
```

---

## CEC Control

### Get CEC Devices

Retrieve all detected CEC devices.

**Endpoint:** `GET /api/cec/devices`

**Response:**
```json
{
  "success": true,
  "devices": [
    {
      "id": 1,
      "address": "0.0.0.0",
      "name": "TV",
      "type": "TV",
      "vendor": "Samsung",
      "powerStatus": "on",
      "activeSource": true
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/api/cec/devices
```

### Get CEC Status

Get power status of CEC devices.

**Endpoint:** `GET /api/cec/status?tvAddress=0`

**Query Parameters:**
- `tvAddress` (string) - CEC address (default: "0")

**Response:**
```json
{
  "success": true,
  "status": "on",
  "devices": [
    {
      "address": "0.0.0.0",
      "name": "TV",
      "powerStatus": "on"
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/api/cec/status?tvAddress=0
```

### Send CEC Command

Send a command to CEC devices.

**Endpoint:** `POST /api/cec/command`

**Request Body:**
```json
{
  "command": "on",
  "address": "0.0.0.0"
}
```

**Parameters:**
- `command` (string, required) - Command to send: "on", "standby", "active_source"
- `address` (string) - CEC address (default: "0.0.0.0")

**Response:**
```json
{
  "success": true,
  "message": "Command sent successfully"
}
```

### CEC Cable Box Control

Control cable boxes via HDMI-CEC.

**Endpoint:** `POST /api/cec/cable-box/tune`

**Request Body:**
```json
{
  "channel": "705",
  "deviceId": "cable-box-1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tuned to channel 705",
  "channel": "705"
}
```

### Discover CEC Cable Boxes

Scan for CEC cable box devices.

**Endpoint:** `POST /api/cec/cable-box/discover`

**Response:**
```json
{
  "success": true,
  "devices": [
    {
      "address": "1.0.0.0",
      "name": "Cable Box",
      "type": "Recording Device",
      "vendor": "Unknown"
    }
  ]
}
```

---

## Audio Management

### Soundtrack Your Brand - Now Playing

Get currently playing track information.

**Endpoint:** `GET /api/soundtrack/now-playing?playerId=PLAYER_ID`

**Query Parameters:**
- `playerId` (string, required) - Soundtrack player ID

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

**Example:**
```bash
curl "http://localhost:3000/api/soundtrack/now-playing?playerId=abc123"
```

### Get Soundtrack Configuration

Get Soundtrack Your Brand configuration.

**Endpoint:** `GET /api/soundtrack/config`

**Response:**
```json
{
  "success": true,
  "config": {
    "apiKey": "sk_***",
    "isActive": true,
    "accountName": "My Sports Bar"
  }
}
```

### Get Audio Zones

Get all configured audio zones.

**Endpoint:** `GET /api/audio-processor/zones?processorId=PROCESSOR_ID`

**Query Parameters:**
- `processorId` (string, required) - Audio processor ID

**Response:**
```json
{
  "zones": [
    {
      "id": 1,
      "processorId": "atlas-1",
      "zoneNumber": 1,
      "name": "Main Bar",
      "description": "Main bar audio zone",
      "currentSource": "soundtrack",
      "volume": 75,
      "muted": false,
      "enabled": true
    }
  ]
}
```

**Example:**
```bash
curl "http://localhost:3000/api/audio-processor/zones?processorId=atlas-1"
```

### Atlas Audio Configuration

Get or update Atlas audio processor configuration.

**Endpoint:** `GET /api/atlas/configuration?processorId=PROCESSOR_ID`

**Query Parameters:**
- `processorId` (string) - Atlas processor ID (for file-based config)
- `processorIp` (string) - Atlas processor IP (for direct hardware query)
- `param` (string) - Specific parameter to query (requires `processorIp`)

**Response (File-based):**
```json
{
  "success": true,
  "inputs": [],
  "outputs": [],
  "scenes": [],
  "messages": []
}
```

**Response (Direct Query):**
```json
{
  "success": true,
  "value": "parameter value"
}
```

**Example:**
```bash
# Get file-based configuration
curl "http://localhost:3000/api/atlas/configuration?processorId=atlas-1"

# Query hardware directly
curl "http://localhost:3000/api/atlas/configuration?processorIp=192.168.1.50&param=/IO/Input/1/Gain"
```

---

## Sports Guide

### Get Sports Programming Guide

Fetch sports programming guide from The Rail Media API.

**Endpoint:** `POST /api/sports-guide`
**Endpoint:** `GET /api/sports-guide` (same behavior)

**Request Body (Optional):**
```json
{
  "days": 7
}
```

**Parameters:**
- `days` (number) - Number of days to fetch (default: 7)

**Response:**
```json
{
  "success": true,
  "requestId": "abc123",
  "timestamp": "2025-11-02T10:30:00.000Z",
  "durationMs": 1234,
  "dataSource": "The Rail Media API",
  "apiProvider": {
    "name": "The Rail Media",
    "url": "https://guide.thedailyrail.com/api/v1",
    "userId": "user123"
  },
  "fetchMethod": "fetchDateRangeGuide (7 days)",
  "summary": {
    "listingGroupsCount": 15,
    "totalListings": 234
  },
  "data": {
    "listing_groups": [
      {
        "group_title": "NFL",
        "listings": [
          {
            "title": "Patriots vs Bills",
            "start_time": "2025-11-02T13:00:00Z",
            "channel": "CBS",
            "channel_number": "705"
          }
        ]
      }
    ]
  }
}
```

**Example:**
```bash
# GET request (default 7 days)
curl http://localhost:3000/api/sports-guide

# POST request with custom days
curl -X POST http://localhost:3000/api/sports-guide \
  -H "Content-Type: application/json" \
  -d '{"days": 3}'
```

### Get Sports Guide Channels

Get channel guide with filtering options.

**Endpoint:** `GET /api/sports-guide/channels`

**Query Parameters:**
- `start_date` (string) - Start date (ISO 8601)
- `end_date` (string) - End date (ISO 8601)
- `lineup` (string) - Filter by lineup
- `search` (string) - Search term
- `days` (number) - Number of days to fetch

**Response:**
```json
{
  "success": true,
  "guide": {
    "listing_groups": [...]
  },
  "channels": [...],
  "filters": {
    "startDate": "2025-11-02",
    "endDate": "2025-11-09",
    "lineup": null,
    "search": "NFL",
    "days": 7
  }
}
```

**Example:**
```bash
curl "http://localhost:3000/api/sports-guide/channels?search=NFL&days=3"
```

### Get Sports Guide Status

Check Sports Guide API configuration status.

**Endpoint:** `GET /api/sports-guide/status`

**Response:**
```json
{
  "success": true,
  "configured": true,
  "apiKey": "sk_***",
  "userId": "user123",
  "apiUrl": "https://guide.thedailyrail.com/api/v1"
}
```

---

## Device Management

### Get FireTV Devices

Get all configured FireTV devices.

**Endpoint:** `GET /api/firetv-devices`

**Response:**
```json
{
  "success": true,
  "devices": [
    {
      "id": "ftv-1",
      "name": "Fire TV - Main Bar",
      "ipAddress": "192.168.1.200",
      "status": "connected",
      "lastSeen": "2025-11-02T10:30:00.000Z"
    }
  ]
}
```

### Test FireTV Connection

Test connection to a FireTV device.

**Endpoint:** `POST /api/firetv-devices/test-connection`

**Request Body:**
```json
{
  "ipAddress": "192.168.1.200",
  "port": 5555
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connection successful",
  "deviceInfo": {
    "model": "AFTMM",
    "version": "Fire OS 7"
  }
}
```

### Send FireTV Command

Send ADB command to FireTV device.

**Endpoint:** `POST /api/firetv-devices/send-command`

**Request Body:**
```json
{
  "deviceId": "ftv-1",
  "command": "input keyevent KEYCODE_HOME"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Command sent successfully"
}
```

### Get IR Devices

Get all configured IR devices.

**Endpoint:** `GET /api/ir-devices`

**Response:**
```json
{
  "success": true,
  "devices": [
    {
      "id": 1,
      "name": "Cable Box 1",
      "type": "cable_box",
      "ipAddress": "192.168.1.150",
      "module": 1,
      "connector": 1
    }
  ]
}
```

---

## Scheduling

### Get Schedules

Get all scheduled events.

**Endpoint:** `GET /api/schedules`

**Response:**
```json
{
  "success": true,
  "schedules": [
    {
      "id": 1,
      "name": "Sunday NFL Package",
      "enabled": true,
      "schedule": "0 13 * * 0",
      "action": "route_input",
      "params": {
        "input": 1,
        "outputs": [1, 2, 3]
      },
      "nextRun": "2025-11-03T13:00:00.000Z"
    }
  ]
}
```

### Create Schedule

Create a new scheduled event.

**Endpoint:** `POST /api/schedules`

**Request Body:**
```json
{
  "name": "Monday Night Football",
  "enabled": true,
  "schedule": "0 20 * * 1",
  "action": "route_input",
  "params": {
    "input": 2,
    "outputs": [1, 2, 3, 4]
  }
}
```

**Response:**
```json
{
  "success": true,
  "schedule": {
    "id": 2,
    "name": "Monday Night Football",
    "enabled": true,
    "schedule": "0 20 * * 1",
    "nextRun": "2025-11-04T20:00:00.000Z"
  }
}
```

### Execute Schedule

Manually execute a schedule.

**Endpoint:** `POST /api/schedules/execute`

**Request Body:**
```json
{
  "scheduleId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Schedule executed successfully",
  "result": {
    "action": "route_input",
    "success": true
  }
}
```

---

## AI Features

### AI Enhanced Chat

Chat with the AI assistant.

**Endpoint:** `POST /api/ai/enhanced-chat`

**Request Body:**
```json
{
  "message": "How do I route input 1 to output 5?",
  "context": "matrix_control"
}
```

**Response:**
```json
{
  "success": true,
  "response": "To route input 1 to output 5, you can use the matrix command I1O5...",
  "suggestions": [
    "Would you like me to execute this command?",
    "Need help with other matrix routing?"
  ]
}
```

### AI Knowledge Query

Query the AI knowledge base.

**Endpoint:** `POST /api/ai/knowledge-query`

**Request Body:**
```json
{
  "query": "Wolf Pack matrix commands",
  "limit": 5
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "content": "Wolf Pack matrix commands use the format IxOy where x is input and y is output...",
      "source": "WOLF_PACK_MANUAL.md",
      "relevance": 0.95
    }
  ]
}
```

### AI Diagnostics

Run AI-powered diagnostics on devices.

**Endpoint:** `POST /api/devices/intelligent-diagnostics`

**Request Body:**
```json
{
  "deviceType": "firetv",
  "deviceId": "ftv-1"
}
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
        "recommendation": "Restart device or check network connection"
      }
    ],
    "healthScore": 65
  }
}
```

---

## Deprecated Endpoints

The following endpoints have been removed or replaced:

### Deprecated: /api/health
**Status:** 404 - Not Found
**Replacement:** Use `/api/system/health` instead

### Deprecated: /api/tvs
**Status:** 404 - Not Found
**Replacement:** Use `/api/matrix/routes` and `/api/cec/devices`

### Deprecated: /api/zones/audio
**Status:** 404 - Not Found
**Replacement:** Use `/api/audio-processor/zones`

### Deprecated: /api/firetv/devices
**Status:** 404 - Not Found
**Replacement:** Use `/api/firetv-devices`

### Deprecated: /api/soundtrack/status
**Status:** 404 - Not Found
**Replacement:** Use `/api/soundtrack/config` and `/api/soundtrack/now-playing`

---

## Common Response Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (endpoint or resource doesn't exist)
- `500` - Internal Server Error

---

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "details": "Additional error details if available"
}
```

---

## Rate Limiting

Currently, no rate limiting is enforced on API endpoints. This may change in future versions.

---

## WebSocket Support

WebSocket support is planned for future releases to enable real-time updates for:
- Matrix routing changes
- CEC device status
- Audio zone changes
- Now playing updates

---

## Support

For issues or questions about the API:
1. Check the main [README.md](../README.md)
2. Review the [troubleshooting guide](../DEPLOYMENT_GUIDE.md)
3. Open an issue on GitHub

---

**Note:** This API is designed for local network use. Be cautious when exposing endpoints to the internet without proper authentication and security measures.
