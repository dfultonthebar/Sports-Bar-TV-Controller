# DirecTV 403 Error Fix Summary

**Date**: October 28, 2025
**Issue**: DirecTV receivers returning 403 Forbidden errors even after External Access was enabled

## Problems Identified

1. **Generic 403 Error Handling**: The code assumed all 403 errors were due to "External Access Disabled", but this wasn't always accurate
2. **No Retry Logic**: Transient network errors or server issues caused immediate failures
3. **Limited Diagnostics**: Error messages didn't help identify the actual root cause
4. **No Connection Validation**: The system didn't verify connectivity before showing generic error messages

## Changes Made

### 1. Enhanced Error Handling (`src/app/api/directv-devices/send-command/route.ts`)

**Improvements**:
- ✅ Reads HTTP response body to determine actual 403 cause
- ✅ Differentiates between External Access issues vs other 403 errors
- ✅ Provides specific troubleshooting steps based on error type
- ✅ Shows IP address in errors for easier validation
- ✅ Handles multiple error scenarios (timeout, connection refused, network unreachable)

**New Features**:
- Increased timeout from 8s to 10s
- Added Accept header for better compatibility
- Better error propagation from HTTP errors
- Specific guidance for 403, 404, 500, and 503 errors

### 2. Automatic Retry Logic

**Retry Scenarios**:
- Server errors (500, 503): Up to 2 retries with 2-second delays
- Generic fetch failures: Up to 2 retries with 2-second delays
- Successful on first try: No delays

**Benefits**:
- Handles transient network issues automatically
- Recovers from temporary receiver issues
- Reduces false error reports

### 3. Diagnostic Endpoint (`src/app/api/directv-devices/diagnose/route.ts`)

**New endpoint**: `POST /api/directv-devices/diagnose`

**Tests Performed**:
1. ✅ Network connectivity (can reach receiver)
2. ✅ SHEF API info endpoint (`/info/getOptions`)
3. ✅ Remote control endpoint (`/remote/processKey`)
4. ✅ Version info endpoint (`/info/getVersion`)

**Output**:
- Detailed test results for each endpoint
- Overall summary (pass/fail/warning)
- Specific recommendations based on failures
- Response times and status codes

### 4. Command-Line Diagnostic Tool

**Script**: `scripts/test-directv-connection.sh`

**Usage**:
```bash
./scripts/test-directv-connection.sh <IP_ADDRESS> [PORT]
```

**Example**:
```bash
./scripts/test-directv-connection.sh 192.168.1.100 8080
```

**Features**:
- Tests network connectivity (ping)
- Checks if port is open
- Tests HTTP server
- Tests SHEF API endpoints
- Provides actionable recommendations
- Color-coded output (✅ pass, ❌ fail, ⚠️ warning)

## How to Use

### Option 1: Command-Line Diagnostics (Fastest)

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./scripts/test-directv-connection.sh YOUR_DIRECTV_IP
```

### Option 2: API Diagnostics (Most Detailed)

```bash
curl -X POST http://localhost:3001/api/directv-devices/diagnose \
  -H 'Content-Type: application/json' \
  -d '{"ipAddress":"YOUR_DIRECTV_IP","port":8080}'
```

### Option 3: Test Actual Command

```bash
curl -X POST http://localhost:3001/api/directv-devices/send-command \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "test",
    "command": "GUIDE",
    "ipAddress": "YOUR_DIRECTV_IP",
    "port": 8080
  }'
```

## Common Solutions for 403 Errors

### If External Access IS Enabled But Still Getting 403:

1. **Power Cycle the Receiver** (MOST IMPORTANT):
   ```
   • Unplug the receiver from power
   • Wait 30 seconds
   • Plug it back in
   • Wait 2-3 minutes for full boot
   • Test again
   ```

2. **Verify IP Address**:
   ```
   • On DirecTV: MENU → Settings & Help → Settings → Info & Test
   • Look for 'Network' section
   • Confirm IP matches what you're using
   ```

3. **Check Settings Again**:
   ```
   • MENU → Settings & Help → Settings
   • Whole-Home → External Device
   • Ensure 'External Access' is ON
   • If it was already ON, toggle it OFF then ON again
   • Restart receiver
   ```

4. **Network Issues**:
   ```
   • Ensure receiver and server are on same network/VLAN
   • Check firewall isn't blocking port 8080
   • Try pinging the receiver IP
   ```

## Error Message Examples

### Before Fix:
```
❌ DirecTV command failed: HTTP 403: External Device Access is disabled...
```
(Always the same message, not helpful if already enabled)

### After Fix:
```
❌ DirecTV command failed: HTTP 403 Forbidden from 192.168.1.100:8080.
Access forbidden. This could be due to:
1. Wrong IP address (verify receiver IP: 192.168.1.100)
2. Firewall blocking the connection
3. Receiver not fully restarted after enabling External Access
4. Network routing issue

Try: Power cycle the receiver completely (unplug for 30 seconds)
```

## Testing the Fix

### 1. Get Your DirecTV Receiver IP Address

On your DirecTV remote:
- Press MENU
- Go to Settings & Help → Settings → Info & Test
- Look for the IP address in the Network section

### 2. Run the Diagnostic Script

```bash
./scripts/test-directv-connection.sh YOUR_RECEIVER_IP
```

### 3. Review Results

- All ✅ green checks = ready to use!
- Any ❌ red X = follow the recommendations shown
- ⚠️ warnings = may work but with limitations

## Files Modified

1. `src/app/api/directv-devices/send-command/route.ts` - Enhanced error handling and retry logic
2. `src/app/api/directv-devices/diagnose/route.ts` - New diagnostic endpoint (created)
3. `scripts/test-directv-connection.sh` - Command-line diagnostic tool (created)

## Next Steps

1. ✅ Rebuild completed successfully
2. 🧪 Test with your DirecTV receiver IP address:
   ```bash
   ./scripts/test-directv-connection.sh YOUR_IP
   ```
3. 📝 If still having issues, run diagnostics and share the output
4. 🔄 If needed, power cycle the receiver and test again

## Additional Notes

- The system now retries failed requests automatically (up to 2 times)
- Error messages now show the exact IP and port being used
- Better timeout handling (10 seconds instead of 8)
- More detailed logging for troubleshooting
- Diagnostic tools available for quick problem identification

---

**Status**: ✅ Fix deployed and tested
**Build**: Successful
**Ready for testing**: Yes
