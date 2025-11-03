# Fire TV Connection Manager - Quick Reference

## Quick Start

### Check Connection Status
```bash
curl http://localhost:3000/api/firetv-devices/connection-status
```

### Force Health Check
```bash
curl -X POST http://localhost:3000/api/firetv-devices/connection-status
```

### View System Health
```bash
curl http://localhost:3000/api/health | jq '.services.hardware.fireTv'
```

## Configuration Quick Reference

**Location**: `src/config/firetv-config.ts`

### Key Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Health Check Interval | 30s | How often to check device health |
| Keep-Alive Interval | 30s | How often to ping connected devices |
| Connection Timeout | 5s | Max time to wait for connection |
| Max Reconnect Attempts | 5 | Attempts before giving up |
| Initial Backoff Delay | 1s | First retry delay |
| Max Backoff Delay | 30s | Maximum retry delay |
| Downtime Alert Threshold | 5min | Alert when device down this long |
| Inactivity Timeout | 30min | Disconnect after this much inactivity |

## Connection States

| State | Meaning | Action |
|-------|---------|--------|
| `connected` | Device is responsive | Normal operation |
| `connecting` | Connection in progress | Wait for completion |
| `disconnected` | Manually disconnected | No automatic reconnect |
| `error` | Connection failed | Automatic reconnect scheduled |

## Reconnection Backoff

Exponential backoff sequence:
```
Attempt 1: 1 second
Attempt 2: 2 seconds
Attempt 3: 4 seconds
Attempt 4: 8 seconds
Attempt 5: 16 seconds
Attempt 6+: 30 seconds (max)
```

## Command Queueing

### When to Use
- Network temporarily unstable
- Device rebooting
- Brief connectivity loss

### Limits
- Max 50 commands per device
- 5-minute timeout for queued commands
- Sequential processing after reconnect

### Example
```typescript
// Queue command if device disconnected
await connectionManager.executeCommand(
  deviceId,
  () => adbClient.sendKey(23),
  { allowQueue: true }
)
```

## Log Patterns

### Healthy Connection
```
[HEALTH MONITOR] ✅ Living Room TV is HEALTHY
```

### Connection Lost
```
[HEALTH MONITOR] ❌ Living Room TV is UNHEALTHY (connection failed)
[HEALTH MONITOR] Scheduling reconnection in 1s (attempt 1/5)
```

### Successful Reconnection
```
[HEALTH MONITOR] ✅ Reconnection successful for Living Room TV
[HEALTH MONITOR] Device recovered after 15s downtime
```

### Downtime Alert
```
[HEALTH MONITOR] 🚨 ALERT: Living Room TV has been down for 5 minutes
```

## Monitoring Commands

### View Logs
```bash
# All logs
pm2 logs sports-bar-tv-controller

# Connection manager only
pm2 logs sports-bar-tv-controller | grep "CONNECTION MANAGER"

# Health monitor only
pm2 logs sports-bar-tv-controller | grep "HEALTH MONITOR"

# Errors only
pm2 logs sports-bar-tv-controller --err
```

### Check Running Processes
```bash
pm2 status
```

### Restart Service
```bash
pm2 restart sports-bar-tv-controller
```

## Troubleshooting

### Device Won't Connect

1. **Check ADB is enabled**
   - Fire TV Settings → Developer Options → ADB Debugging

2. **Verify network connectivity**
   ```bash
   ping <device-ip>
   ```

3. **Check port accessibility**
   ```bash
   nc -zv <device-ip> 5555
   ```

4. **Review logs**
   ```bash
   pm2 logs sports-bar-tv-controller | grep "CONNECTION MANAGER"
   ```

### Frequent Reconnections

1. **Check network stability**
   - WiFi signal strength
   - Router issues

2. **Verify device isn't sleeping**
   - Enable "Stay Awake" in developer options

3. **Review health check interval**
   - May need to increase if network is slow

### Commands Getting Queued

1. **Check connection status**
   ```bash
   curl http://localhost:3000/api/firetv-devices/connection-status
   ```

2. **Force reconnection**
   ```bash
   curl -X POST http://localhost:3000/api/firetv-devices/connection-status
   ```

3. **Wait for automatic reconnection**
   - System will retry with exponential backoff

## API Quick Reference

### Connection Status (All Devices)
```
GET /api/firetv-devices/connection-status
```

### Connection Status (Single Device)
```
GET /api/firetv-devices/connection-status?deviceId=firetv_123
```

### Force Health Check
```
POST /api/firetv-devices/connection-status
```

### System Health
```
GET /api/health
```

### Send Command
```
POST /api/firetv-devices/send-command
Body: {
  "deviceId": "firetv_123",
  "command": "OK",
  "ipAddress": "192.168.1.100",
  "port": 5555
}
```

## Response Examples

### Healthy Device
```json
{
  "deviceId": "firetv_123",
  "deviceName": "Living Room TV",
  "connection": {
    "status": "connected",
    "lastActivity": "2025-11-02T10:30:00Z",
    "connectionAttempts": 0
  },
  "health": {
    "isHealthy": true,
    "lastCheck": "2025-11-02T10:30:00Z",
    "reconnectAttempts": 0
  }
}
```

### Device Reconnecting
```json
{
  "deviceId": "firetv_123",
  "deviceName": "Living Room TV",
  "connection": {
    "status": "error",
    "lastActivity": "2025-11-02T10:25:00Z",
    "connectionAttempts": 3,
    "lastError": "Connection refused"
  },
  "health": {
    "isHealthy": false,
    "lastCheck": "2025-11-02T10:30:00Z",
    "error": "Connection refused",
    "reconnectAttempts": 3
  }
}
```

## Environment Variables

No environment variables required. Configuration is code-based in `src/config/firetv-config.ts`.

To customize, edit the configuration file:
```typescript
export const prodFireTVConfig: FireTVConfig = {
  healthCheck: {
    interval: 45000  // Customize as needed
  }
}
```

## Performance Tips

1. **Reduce log noise in production**
   ```typescript
   logging: {
     verbose: false,
     logKeepAlive: false
   }
   ```

2. **Adjust health check interval**
   - Slower networks: increase to 60s
   - Fast networks: decrease to 15s

3. **Monitor queue sizes**
   - Large queues indicate connectivity issues
   - Check `/api/firetv-devices/connection-status`

## Important Notes

- ✅ Health monitoring starts automatically 5 seconds after server start
- ✅ Connections are pooled and reused
- ✅ Reconnection is automatic with exponential backoff
- ✅ All errors are logged but don't crash the system
- ✅ Configuration is environment-aware (dev/prod)
- ⚠️ Max 50 commands can be queued per device
- ⚠️ Queued commands timeout after 5 minutes
- ⚠️ Inactive connections cleanup after 30 minutes

## Support Resources

- **Full Documentation**: `docs/FIRETV_CONNECTION_MANAGER.md`
- **Implementation Summary**: `docs/FIRETV_CONNECTION_IMPROVEMENTS_SUMMARY.md`
- **Logs**: `pm2 logs sports-bar-tv-controller`
- **Health Check**: `GET /api/health`
- **Connection Status**: `GET /api/firetv-devices/connection-status`
