# Cable Box CEC Setup Guide

## Overview

This system uses **Pulse-Eight USB-CEC adapters** to control cable boxes via HDMI-CEC protocol. Each cable box requires its own dedicated Pulse-Eight adapter.

## Current Status

- **Adapters Installed**: 1 (at `/dev/ttyACM0`)
- **Adapters Needed**: 4 total
- **Pending**: 3 additional adapters (shipping)

## System Architecture

```
Cable Box 1 ←→ Pulse-Eight Adapter 1 (/dev/ttyACM0) ←→ Ubuntu Server
Cable Box 2 ←→ Pulse-Eight Adapter 2 (/dev/ttyACM1) ←→ Ubuntu Server
Cable Box 3 ←→ Pulse-Eight Adapter 3 (/dev/ttyACM2) ←→ Ubuntu Server
Cable Box 4 ←→ Pulse-Eight Adapter 4 (/dev/ttyACM3) ←→ Ubuntu Server
```

## When New Adapters Arrive

### Step 1: Physical Installation

1. **Connect each Pulse-Eight adapter**:
   - Plug USB cable into Ubuntu server
   - Connect HDMI cable from adapter to cable box's HDMI port
   - Ensure cable box is powered on

2. **Verify device detection**:
   ```bash
   ls -la /dev/ttyACM*
   ```

   You should see:
   ```
   /dev/ttyACM0  # First adapter (already installed)
   /dev/ttyACM1  # Second adapter (new)
   /dev/ttyACM2  # Third adapter (new)
   /dev/ttyACM3  # Fourth adapter (new)
   ```

3. **List all CEC adapters**:
   ```bash
   cec-client -l
   ```

   This will show all detected Pulse-Eight adapters with their device paths.

### Step 2: Database Configuration

The database already has cable boxes configured for the correct device paths:
- `cable-box-1` → `/dev/ttyACM1`
- `cable-box-2` → `/dev/ttyACM2`
- `cable-box-3` → `/dev/ttyACM3`
- `cable-box-4` → `/dev/ttyACM4`

**Note**: `/dev/ttyACM0` is currently used for TV power control. When all 4 cable box adapters arrive, they should be assigned to `/dev/ttyACM1` through `/dev/ttyACM4`.

If you need to update the device paths, run:
```bash
tsx scripts/fix-cable-box-paths.ts
```

### Step 3: Test Each Cable Box

Test each cable box individually to verify CEC control:

#### Test Cable Box 1
```bash
curl -X POST http://localhost:3001/api/cec/cable-box/tune \
  -H "Content-Type: application/json" \
  -d '{"cableBoxId":"cable-box-1","channel":"206"}'
```

#### Test Cable Box 2
```bash
curl -X POST http://localhost:3001/api/cec/cable-box/tune \
  -H "Content-Type: application/json" \
  -d '{"cableBoxId":"cable-box-2","channel":"206"}'
```

#### Test Cable Box 3
```bash
curl -X POST http://localhost:3001/api/cec/cable-box/tune \
  -H "Content-Type: application/json" \
  -d '{"cableBoxId":"cable-box-3","channel":"206"}'
```

#### Test Cable Box 4
```bash
curl -X POST http://localhost:3001/api/cec/cable-box/tune \
  -H "Content-Type: application/json" \
  -d '{"cableBoxId":"cable-box-4","channel":"206"}'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Successfully tuned to channel 206 (device acknowledged)",
  "executionTime": 2500,
  "deviceResponded": true,
  "channel": "206"
}
```

### Step 4: Test Connection Status

Check if each cable box is responding to CEC commands:

```bash
curl -X POST http://localhost:3001/api/cec/cable-box/test \
  -H "Content-Type: application/json" \
  -d '{"cableBoxId":"cable-box-1"}'
```

Repeat for cable-box-2, cable-box-3, and cable-box-4.

### Step 5: Verify Logging

#### Check Enhanced Logger
```bash
tail -f /home/ubuntu/Sports-Bar-TV-Controller/logs/cec-operations.log
```

You should see structured JSON logs for each CEC command with:
- `category: "cec"`
- `source: "cable-box-cec-service"`
- `deviceResponded: true/false`
- `success: true/false`
- `duration: <milliseconds>`

#### Check System Admin Dashboard

1. Navigate to: `http://localhost:3001/system-admin`
2. Go to **Logs** section
3. Filter by: **"CEC Control (TVs & Cable Boxes)"**
4. Verify cable box commands appear with:
   - Cable box name
   - Channel tuned
   - Execution time
   - Device response status

#### Check Database Logs
```bash
curl http://localhost:3001/api/logs/analytics?category=cec
```

This will return analytics including:
- Total commands
- Success/failure rates
- Average response times
- Error patterns
- AI recommendations

## Features Implemented

### 1. Response Detection ✅
Every CEC command now returns detailed response information:
- `deviceResponded`: Whether the cable box acknowledged the command
- `output`: Raw CEC client output for debugging
- `executionTime`: How long the command took

### 2. Dual Logging System ✅
All commands are logged to TWO locations:

**CECCommandLog Table** (Database):
- CEC-specific analytics
- Command history per device
- Response times
- Error tracking

**Enhanced Logger** (File System):
- Centralized log files in `/logs/cec-operations.log`
- Structured JSON format
- Available in System Admin dashboard
- Ready for AI analysis

### 3. Bartender Remote CEC Integration ✅
The bartender remote now:
- Automatically detects cable boxes by `inputType: 'Cable'`
- Routes cable box commands to CEC API (not IR)
- Shows execution time and success/failure status
- Falls back to IR for other devices (DirecTV, etc.)

## Troubleshooting

### Issue: Device not found at `/dev/ttyACMX`

**Solution**:
1. Check USB connection
2. Verify with `ls -la /dev/ttyACM*`
3. Check with `cec-client -l`
4. Ensure user has permissions: `sudo usermod -a -G dialout ubuntu`

### Issue: Command times out after 5 seconds

**Possible causes**:
- Cable box is off or in standby
- HDMI cable not connected properly
- CEC disabled on cable box (check cable box settings)
- Wrong device path

**Solution**:
1. Verify cable box is powered on
2. Check HDMI connection
3. Test with: `echo 'scan' | cec-client -s /dev/ttyACMX`

### Issue: `deviceResponded: false`

**Explanation**:
The command was sent successfully but the cable box didn't acknowledge it. This can happen if:
- The cable box doesn't support CEC commands
- The CEC bus is busy
- The cable box is processing another command

**This is normal** for some cable boxes. The command may still work even without acknowledgment.

## Testing Checklist

When all adapters arrive, run through this checklist:

- [ ] All 4 adapters detected at `/dev/ttyACM1-4`
- [ ] `cec-client -l` shows all 4 adapters
- [ ] Database has correct device path mappings
- [ ] Test tune command works for each cable box
- [ ] Test connection status returns success
- [ ] Logs appear in `/logs/cec-operations.log`
- [ ] Logs appear in System Admin dashboard
- [ ] Database analytics work at `/api/logs/analytics?category=cec`
- [ ] Bartender remote can control cable boxes
- [ ] Channel changes show execution time
- [ ] Multiple rapid commands queue properly (no conflicts)

## API Reference

### List All Cable Boxes
```bash
GET /api/cec/cable-box
```

### Tune to Channel
```bash
POST /api/cec/cable-box/tune
Content-Type: application/json

{
  "cableBoxId": "cable-box-1",
  "channel": "206"
}
```

### Send Navigation Command
```bash
POST /api/cec/cable-box/navigate
Content-Type: application/json

{
  "cableBoxId": "cable-box-1",
  "command": "menu"  // or: up, down, left, right, select, back
}
```

### Test Connection
```bash
POST /api/cec/cable-box/test
Content-Type: application/json

{
  "cableBoxId": "cable-box-1"
}
```

### Get Command History
```bash
GET /api/cec/cable-box/history?cableBoxId=cable-box-1&limit=50
```

## Support

For issues or questions:
1. Check logs at `/logs/cec-operations.log`
2. Check System Admin dashboard for error patterns
3. Review AI recommendations in analytics endpoint
4. Test with raw `cec-client` commands to isolate issues

## Files Modified

All CEC cable box functionality implemented in:
- `src/lib/cable-box-cec-service.ts` - Core CEC control service
- `src/app/api/cec/cable-box/*` - API endpoints
- `src/components/BartenderRemoteControl.tsx` - Bartender UI integration
- `src/lib/enhanced-logger.ts` - Logging system
- `scripts/fix-cable-box-paths.ts` - Setup utility script
