# Fire TV Controls - Setup Complete

**Date**: October 28, 2025
**Status**: ✅ **WORKING**
**Fire TV Device**: Amazon 1 (192.168.5.131:5555)

## Issue Identified

The Fire TV device "Amazon 1" was configured with an incorrect IP address that was not reachable from the server.

### The Problem

- **Configured IP**: 192.168.10.131 (wrong subnet - not reachable)
- **Actual IP**: 192.168.5.131 (correct - same subnet as server)
- **Result**: "No route to host" errors, device appeared offline

## What Was Fixed

### 1. IP Address Correction

**File**: `data/firetv-devices.json`

```json
// BEFORE:
{
  "name": "Amazon 1",
  "ipAddress": "192.168.10.131",  // ❌ Wrong subnet
  "isOnline": false,
  "adbEnabled": false
}

// AFTER:
{
  "name": "Amazon 1",
  "ipAddress": "192.168.5.131",   // ✅ Correct IP
  "isOnline": true,
  "adbEnabled": true
}
```

### 2. Network Discovery

Used nmap to scan the local network and identify the Fire TV:
```bash
nmap -p 5555 --open 192.168.5.0/24
# Found: 192.168.5.131 with port 5555 open (ADB)
```

### 3. ADB Connection Verified

```bash
adb connect 192.168.5.131:5555
# Result: already connected to 192.168.5.131:5555

adb devices
# Result: 192.168.5.131:5555    device
```

## Device Information

**Amazon 1 (Fire TV Cube)**
- **IP Address**: 192.168.5.131
- **Port**: 5555 (ADB)
- **Device Model**: AFTGAZL (Fire TV Cube)
- **Serial Number**: GT523H18527606VL
- **Software Version**: 9
- **Input Channel**: 13
- **ADB Status**: ✅ Enabled and Authorized
- **Connection**: ✅ Persistent with 30-second keep-alive

## Fire TV vs DirecTV - Technical Differences

### DirecTV Control
- **Protocol**: HTTP REST API (SHEF API)
- **Port**: 8080
- **Authentication**: External Access setting
- **Command Format**: Lowercase text commands (e.g., `power`, `guide`, `info`)
- **Connection**: Stateless HTTP requests

### Fire TV Control
- **Protocol**: ADB (Android Debug Bridge)
- **Port**: 5555
- **Authentication**: ADB authorization prompt (one-time)
- **Command Format**: Android key codes (e.g., 19=UP, 23=OK, 3=HOME)
- **Connection**: Persistent TCP socket with keep-alive

## Available Fire TV Commands

The Fire TV API supports these commands (mapped to Android key codes):

| Command | Key Code | Function |
|---------|----------|----------|
| UP | 19 | Navigate up |
| DOWN | 20 | Navigate down |
| LEFT | 21 | Navigate left |
| RIGHT | 22 | Navigate right |
| OK / SELECT | 23 | Select/Enter |
| HOME | 3 | Home screen |
| BACK | 4 | Back button |
| MENU | 82 | Menu |
| PLAY_PAUSE | 85 | Play/Pause toggle |
| PLAY | 126 | Play |
| PAUSE | 127 | Pause |
| STOP | 86 | Stop |
| REWIND | 89 | Rewind |
| FAST_FORWARD | 90 | Fast forward |
| NEXT | 87 | Next track/chapter |
| PREVIOUS | 88 | Previous track/chapter |
| VOL_UP | 24 | Volume up |
| VOL_DOWN | 25 | Volume down |
| MUTE | 164 | Mute toggle |
| POWER | 26 | Power toggle |
| SEARCH | 84 | Search |

### Special Commands

**Launch Apps**:
```json
{
  "command": "LAUNCH_APP",
  "appPackage": "com.amazon.firetv.youtube"
}
```

**Stop Apps**:
```json
{
  "command": "STOP_APP",
  "appPackage": "com.amazon.firetv.youtube"
}
```

**Wake Device**:
```json
{
  "command": "WAKE"
}
```

## Testing Results

### Connection Test
```json
{
  "success": true,
  "message": "Successfully connected to Fire TV device",
  "data": {
    "connected": true,
    "deviceModel": "AFTGAZL",
    "serialNumber": "GT523H18527606VL",
    "softwareVersion": "9",
    "keepAliveEnabled": true,
    "keepAliveInterval": "30 seconds",
    "connectionStatus": "connected"
  }
}
```

### Command Tests (All Successful ✅)
```bash
✅ HOME → Key: HOME executed successfully
✅ UP → Key: UP executed successfully
✅ OK → Key: OK executed successfully
✅ BACK → Key: BACK executed successfully
```

## Bartender Remote Integration

The bartender remote page (`/remote`) already has complete Fire TV integration:

### How It Works

1. **Device Selection**:
   - When you select Input Channel 13, the system automatically loads "Amazon 1"
   - Device info is retrieved from `data/firetv-devices.json`

2. **Command Sending**:
   - Remote buttons send commands via `/api/firetv-devices/send-command`
   - Commands use the key code mapping (e.g., UP → 19)
   - Persistent ADB connection is maintained by the connection manager

3. **Status Display**:
   - Shows device name and connection status
   - Displays success/failure messages for each command
   - Real-time feedback on button presses

### Code Flow

```typescript
// 1. Load Fire TV devices on page load
loadFireTVDevices()
  → GET /api/firetv-devices
  → Stores in firetvDevices state

// 2. Select input channel
selectInput(13)
  → Finds device with inputChannel === 13
  → Sets selectedDevice to Amazon 1

// 3. Send command (e.g., user presses UP button)
sendIRCommand('UP')
  → POST /api/firetv-devices/send-command
  → Body: { deviceId, command: 'UP', ipAddress, port }
  → Fire TV executes UP command (key code 19)
```

## Fire TV Devices in System

You have **4 Fire TV devices** configured:

| Device Name | IP Address | Port | Input Channel | Status |
|------------|------------|------|---------------|--------|
| Amazon 1 | 192.168.5.131 | 5555 | 13 | ✅ **Online** |
| Amazon 2 | 192.168.1.132 | 5555 | 14 | ⚠️ Offline |
| Amazon 3 | 192.168.1.133 | 5555 | 15 | ⚠️ Offline |
| Amazon 4 | 192.168.1.134 | 5555 | 16 | ⚠️ Offline |

**Note**: Amazon 2-4 are not currently connected (as confirmed by user).

## How to Use from Bartender Remote

1. **Navigate to Remote Page**:
   - Go to: http://YOUR_SERVER:3001/remote
   - Or use the "Bartender Remote Control" link

2. **Select Input Channel 13**:
   - Click on Input 13 in the inputs list
   - System will auto-select "Amazon 1" device

3. **Control Fire TV**:
   - Use navigation buttons (UP/DOWN/LEFT/RIGHT)
   - Press OK to select
   - Use HOME to return to home screen
   - Use BACK to go back
   - Volume controls (VOL_UP/VOL_DOWN/MUTE)

4. **Route to TV Output**:
   - After selecting Input 13, click on any TV zone
   - Input 13 (Amazon 1) will be routed to that TV

## Connection Manager Features

The Fire TV implementation uses a persistent connection manager:

### Benefits
- ✅ **Persistent Connections**: Maintains long-lived ADB connections
- ✅ **Automatic Reconnection**: Reconnects if connection drops
- ✅ **Keep-Alive**: Sends heartbeat every 30 seconds
- ✅ **Connection Pooling**: Reuses connections across multiple commands
- ✅ **Error Recovery**: Handles network issues gracefully

### Monitoring
```bash
# Check ADB connections
adb devices

# Test Fire TV manually
adb -s 192.168.5.131:5555 shell input keyevent 3  # HOME
adb -s 192.168.5.131:5555 shell input keyevent 4  # BACK
```

## Troubleshooting

### If Fire TV Stops Responding:

1. **Check ADB Connection**:
   ```bash
   adb devices
   # Should show: 192.168.5.131:5555    device
   ```

2. **Reconnect if Needed**:
   ```bash
   adb disconnect 192.168.5.131:5555
   adb connect 192.168.5.131:5555
   ```

3. **Test Connection via API**:
   ```bash
   curl -X POST http://localhost:3001/api/firetv-devices/test-connection \
     -H 'Content-Type: application/json' \
     -d '{"ipAddress":"192.168.5.131","port":5555,"deviceId":"firetv_1759187649372_qpmk1jw6o"}'
   ```

4. **Check Fire TV ADB Settings**:
   - Settings → My Fire TV → Developer Options
   - Ensure "ADB Debugging" is ON
   - Ensure "Apps from Unknown Sources" is ON (if needed)

### If Authorization Prompt Appears:

If you see "Allow USB debugging?" on the Fire TV:
- Select "Always allow from this computer"
- Click "OK"
- The connection will be authorized permanently

## Files Modified

1. **data/firetv-devices.json**
   - Updated Amazon 1 IP address: 192.168.10.131 → 192.168.5.131
   - Updated status: isOnline=true, adbEnabled=true

## Files Reviewed (No Changes Needed)

1. **src/app/api/firetv-devices/send-command/route.ts**
   - ✅ Already correct - uses ADB key codes
   - ✅ Connection manager working properly
   - ✅ All commands properly mapped

2. **src/app/remote/page.tsx**
   - ✅ Already has Fire TV integration
   - ✅ Loads Fire TV devices correctly
   - ✅ Sends commands to correct API endpoint

## Comparison: DirecTV vs Fire TV Status

| Feature | DirecTV | Fire TV |
|---------|---------|---------|
| **Status** | ✅ Working | ✅ Working |
| **Active Devices** | 1 (Direct TV 1) | 1 (Amazon 1) |
| **Protocol** | HTTP/SHEF API | ADB |
| **Port** | 8080 | 5555 |
| **Command Format** | Lowercase text | Key codes |
| **Connection** | Stateless | Persistent |
| **Issues Found** | Wrong command format | Wrong IP address |
| **Issues Fixed** | ✅ Yes | ✅ Yes |

## Next Steps

1. ✅ **Fire TV control is ready to use** from bartender remote
2. ✅ **No code changes needed** - only configuration update
3. ✅ **Persistent connection maintained** by connection manager
4. 📝 **Documentation complete** for both DirecTV and Fire TV

## Using Both Devices from Bartender Remote

You can now control both:

**DirecTV (Input 5)**:
- Select Input 5 → Controls "Direct TV 1" (192.168.5.121)
- Route to any TV output

**Fire TV (Input 13)**:
- Select Input 13 → Controls "Amazon 1" (192.168.5.131)
- Route to any TV output

Both devices work seamlessly from the same bartender remote interface!

---

**Verified Working**: October 28, 2025 at 6:50 PM CDT
**Tested Device**: Amazon 1 (Fire TV Cube at 192.168.5.131:5555)
**Test Commands**: HOME, UP, OK, BACK - All successful ✅
**Bartender Remote**: Ready to use on Input Channel 13
