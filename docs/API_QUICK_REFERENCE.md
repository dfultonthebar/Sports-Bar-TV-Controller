# API Quick Reference

Fast reference for commonly used Sports Bar TV Controller API endpoints.

## Base URL
```
http://localhost:3000/api
```

---

## Most Common Endpoints

### System Health
```bash
# Get complete system health status
GET /api/system/health
```

### Matrix Control
```bash
# Send matrix command (route input to output)
POST /api/matrix/command
Body: {"command":"I1O1", "ipAddress":"192.168.1.100", "port":23}

# Get all active routes
GET /api/matrix/routes
```

### CEC Control
```bash
# Get all CEC devices
GET /api/cec/devices

# Get device power status
GET /api/cec/status?tvAddress=0

# Send power command
POST /api/cec/command
Body: {"command":"on", "address":"0.0.0.0"}
```

### Sports Guide
```bash
# Get sports programming (7 days)
POST /api/sports-guide
Body: {"days":7}

# Search for specific sports
GET /api/sports-guide/channels?search=NFL&days=3
```

### Audio Control
```bash
# Get now playing
GET /api/soundtrack/now-playing?playerId=PLAYER_ID

# Get audio zones
GET /api/audio-processor/zones?processorId=atlas-1
```

### Device Management
```bash
# List Fire TV devices
GET /api/firetv-devices

# Send Fire TV command
POST /api/firetv-devices/send-command
Body: {"deviceId":"ftv-1", "command":"input keyevent KEYCODE_HOME"}
```

---

## Quick Test Commands

### Test System
```bash
curl http://localhost:3000/api/system/health | jq '.overall'
```

### Route Matrix Input
```bash
curl -X POST http://localhost:3000/api/matrix/command \
  -H "Content-Type: application/json" \
  -d '{"command":"I1O1","ipAddress":"192.168.1.100","port":23}' | jq
```

### Power On TV via CEC
```bash
curl -X POST http://localhost:3000/api/cec/command \
  -H "Content-Type: application/json" \
  -d '{"command":"on","address":"0.0.0.0"}' | jq
```

### Get Today's Sports
```bash
curl http://localhost:3000/api/sports-guide | jq '.summary'
```

---

## Response Codes
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Server Error

---

## See Full Documentation
- [Complete API Reference](./API_REFERENCE.md)
- [Hardware Configuration](./HARDWARE_CONFIGURATION.md)
