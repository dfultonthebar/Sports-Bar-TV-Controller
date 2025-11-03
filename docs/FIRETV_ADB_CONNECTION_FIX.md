# Fire TV ADB Connection Fix - November 2, 2025

## Issue Summary

**Device:** Amazon 1 Fire TV Cube at 192.168.5.131:5555
**Error:** `device '192.168.5.131:5555' not found`
**Symptom:** Keep-alive ping failures intermittently

## Root Cause Analysis

The issue was caused by the **ADB server daemon losing track of the device connection**, even though:
- The device was powered on and network-accessible
- ADB debugging was enabled
- Port 5555 was open and reachable
- The device was registered in the application database

This is a known behavior with ADB where the daemon can lose connection state, especially after:
- Network interruptions
- Server restarts
- Extended periods of inactivity
- ADB server crashes or restarts

## Diagnosis Steps Performed

### 1. Network Layer Verification
```bash
ping -c 3 192.168.5.131
# Result: SUCCESS - Device is reachable (0% packet loss)
```

### 2. ADB Port Verification
```bash
timeout 3 bash -c "echo > /dev/tcp/192.168.5.131/5555"
# Result: SUCCESS - Port 5555 is open
```

### 3. ADB Installation Check
```bash
adb version
# Result: Android Debug Bridge version 1.0.41 (installed)
```

### 4. Current Connection Status
```bash
adb devices -l
# Result: Device showed as connected but commands were failing
```

### 5. Application Logs Analysis
```bash
pm2 logs sports-bar-tv-controller --lines 100 | grep -i "firetv\|adb"
```

**Key findings:**
- Keep-alive pings were failing intermittently with "device not found"
- Health monitor was detecting the failures
- Auto-reconnection was triggering but not resolving the issue
- The ADB daemon had lost track of the device connection

## Resolution

### Step 1: Restart ADB Server
```bash
adb kill-server
adb start-server
```

This clears the ADB daemon's connection state and allows for a fresh connection.

### Step 2: Reconnect to Device
```bash
adb connect 192.168.5.131:5555
```

Result: `connected to 192.168.5.131:5555`

### Step 3: Verify Connection
```bash
adb -s 192.168.5.131:5555 shell "echo 'Connection test successful'"
```

Result: Connection verified successfully

### Step 4: Monitor Keep-Alive Status
Monitored application logs for 35+ seconds to verify keep-alive pings were working:

```
[ADB CLIENT] Keep-alive ping successful for 192.168.5.131:5555
[HEALTH MONITOR] ✅ Amazon 1 is HEALTHY
```

## Current Status

### Connection Status: RESOLVED ✓

```
Device: 192.168.5.131:5555
Model: AFTGAZL (Fire TV Cube)
Serial: GT523H18527606VL
Android Version: 9
Status: device (connected)
Transport ID: 1
```

### System Health
- **Keep-alive pings:** Working (every 30 seconds)
- **Health monitor:** Running (checks every 60 seconds)
- **Connection status:** HEALTHY
- **Auto-reconnection:** Available if needed

## Prevention & Monitoring

### Automated Fix Script
Created `/home/ubuntu/Sports-Bar-TV-Controller/scripts/fix-firetv-adb.sh` for quick diagnosis and resolution of future ADB connection issues.

**Usage:**
```bash
# For default device (192.168.5.131:5555)
./scripts/fix-firetv-adb.sh

# For custom device
./scripts/fix-firetv-adb.sh <IP_ADDRESS> <PORT>
```

### Monitoring Mechanisms

The system has multiple layers of connection monitoring:

1. **Keep-Alive Pings (30s interval)**
   - Location: `/home/ubuntu/Sports-Bar-TV-Controller/src/lib/firecube/adb-client.ts`
   - Function: Sends lightweight `echo keepalive` command
   - Auto-reconnect: After 3 consecutive failures

2. **Health Monitor (60s interval)**
   - Location: `/home/ubuntu/Sports-Bar-TV-Controller/src/services/firetv-health-monitor.ts`
   - Function: Performs health checks on all devices
   - Auto-reconnect: Exponential backoff (max 5 attempts)

3. **Connection Manager**
   - Location: `/home/ubuntu/Sports-Bar-TV-Controller/src/services/firetv-connection-manager.ts`
   - Function: Manages connection pool and lifecycle
   - Auto-cleanup: Removes stale connections after 30 minutes

## Recommendations

### If Issue Recurs

1. **Quick Fix:** Run the automated fix script
   ```bash
   /home/ubuntu/Sports-Bar-TV-Controller/scripts/fix-firetv-adb.sh
   ```

2. **Manual Fix:**
   ```bash
   # Restart ADB server
   adb kill-server && adb start-server

   # Reconnect to device
   adb connect 192.168.5.131:5555

   # Verify
   adb devices -l
   ```

3. **Check Logs:**
   ```bash
   pm2 logs sports-bar-tv-controller --lines 50 | grep -E "ADB|FIRETV|HEALTH"
   ```

### Long-Term Solutions

1. **Static ADB Connections:** Consider keeping a persistent ADB server with devices always connected
2. **Network Stability:** Ensure Fire TV has a stable network connection (consider static IP)
3. **ADB Debugging:** Keep ADB debugging permanently enabled on Fire TV
4. **Monitoring Alerts:** Add notifications for connection failures
5. **Scheduled Restarts:** Consider periodic ADB server restarts (e.g., weekly) as preventive maintenance

## Technical Details

### System Architecture

```
Application Layer (Next.js)
    ↓
Connection Manager (Singleton)
    ↓
ADB Client (Per Device)
    ↓
ADB Server Daemon (Port 5037)
    ↓
Fire TV Device (Port 5555)
```

### Connection Flow

1. Application requests device connection
2. Connection Manager checks for existing connection
3. If not exists, creates new ADB Client instance
4. ADB Client executes `adb connect <IP>:<PORT>`
5. Keep-alive mechanism starts (30s intervals)
6. Health monitor validates connection (60s intervals)

### Error Recovery

The system has a multi-tier error recovery system:

1. **Level 1:** Keep-alive auto-reconnect (after 3 failures)
2. **Level 2:** Health monitor forced reconnect (exponential backoff)
3. **Level 3:** Manual intervention via fix script
4. **Level 4:** Server restart (if ADB daemon is corrupted)

## Related Files

- `/home/ubuntu/Sports-Bar-TV-Controller/src/lib/firecube/adb-client.ts` - ADB client implementation
- `/home/ubuntu/Sports-Bar-TV-Controller/src/services/firetv-connection-manager.ts` - Connection pooling
- `/home/ubuntu/Sports-Bar-TV-Controller/src/services/firetv-health-monitor.ts` - Health monitoring
- `/home/ubuntu/Sports-Bar-TV-Controller/data/firetv-devices.json` - Device registry
- `/home/ubuntu/Sports-Bar-TV-Controller/scripts/fix-firetv-adb.sh` - Automated fix script

## Conclusion

The ADB connection issue has been successfully diagnosed and resolved. The root cause was the ADB server daemon losing track of the device connection, which was fixed by restarting the ADB server and reconnecting to the device.

The system now has:
- Active connection monitoring (30s keep-alive, 60s health checks)
- Automated reconnection mechanisms
- Quick-fix script for manual intervention
- Comprehensive logging for diagnostics

The connection is currently stable and healthy.
