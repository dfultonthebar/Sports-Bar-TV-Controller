# IR Learning System Demo Script

## Overview

This script demonstrates how to use the IR learning system to capture IR codes from a Spectrum cable box remote and control the cable box using the Global Cache iTach IP2IR.

## Prerequisites

- Global Cache iTach IP2IR connected to network
- Spectrum cable box and remote control
- IR emitter connected to iTach port 1
- Sports Bar TV Controller running on server

## Demo Scenario

We'll demonstrate learning two essential buttons:
1. **Power** - Turn cable box on/off
2. **Channel Up** - Navigate channels

## Step-by-Step Demo

### 1. Verify iTach Connectivity

First, ensure the iTach is accessible on the network:

```bash
# Test iTach connectivity
ping 192.168.1.100

# Expected: Successful ping response
# If fails: Check network cable, power adapter, IP address
```

### 2. Access IR Learning Interface

Open a web browser and navigate to the IR learning page:

```
http://your-server-ip:3001/ir-learning
```

**Expected Result:**
- Page loads showing IR Learning System
- Device selector dropdown
- iTach IP address field
- IR port selector
- Instructions panel
- Grid of buttons to learn

### 3. Configure Learning Settings

**In the web interface:**

1. **Select Device**
   - Click "Cable Box" dropdown
   - Choose "Cable Box 2" (or your Spectrum box)
   - Confirm device name appears

2. **Verify iTach Settings**
   - iTach IP: `192.168.1.100` (default)
   - IR Port: `1` (port where emitter is connected)
   - Leave defaults if correct

**Expected Result:**
- Device selected
- Progress indicator shows "0 / 27 buttons learned"
- Button grid is now active
- Export/Import buttons visible

### 4. Learn Power Button

**Step 4a: Start Learning**

1. Locate the "Power" button in the "Power" section
2. Click the "Learn" button under Power
3. Observe the status change

**Expected Result:**
- Button status changes to "Learning..." (blue)
- Alert appears: "IR Learner enabled, waiting for button press..."
- iTach LED should be flashing (indicating learning mode)

**Step 4b: Capture IR Code**

1. Pick up the Spectrum cable box remote control
2. Point the remote **directly at the iTach IR sensor**
   - Position: 6-12 inches away
   - Angle: Straight, no angle
3. Press and hold the **Power** button on the remote for 1-2 seconds
4. Release the button
5. Wait for confirmation

**Expected Result:**
- Alert changes to "Successfully learned Power"
- Button status changes to "Learned" (green)
- Checkmark icon appears
- "Test" button becomes available
- Progress updates to "1 / 27 buttons learned"

**If Timeout Occurs:**
- Error alert: "Timeout waiting for button press"
- Button status changes to "Error" (red)
- **Solution**: Click "Learn" again and press button more firmly

### 5. Test Power Button

**Step 5a: Position IR Emitter**

Before testing, ensure the IR emitter is properly positioned:

1. Locate the cable box's IR sensor (typically top-left front panel)
2. Position IR emitter 4-6 inches from sensor
3. Aim directly at sensor window
4. Secure emitter temporarily (don't stick yet)

**Step 5b: Execute Test**

1. Click the "Test" button (test tube icon) on the Power button
2. Observe the cable box

**Expected Result:**
- Cable box power toggles (on→off or off→on)
- Alert: "Test successful for Power"
- Button status remains "Learned" (green)

**If Test Fails:**
- Alert: "Test failed: [error message]"
- **Solution**:
  - Check emitter placement (move closer, adjust angle)
  - Verify cable box is powered on
  - Re-learn the button
  - Check iTach connection

### 6. Learn Channel Up Button

**Step 6a: Start Learning**

1. Scroll to "Channel" section in the button grid
2. Locate "Channel Up" button
3. Click the "Learn" button under Channel Up

**Expected Result:**
- Button status changes to "Learning..." (blue)
- Alert: "IR Learner enabled, waiting for button press..."

**Step 6b: Capture IR Code**

1. Point Spectrum remote at iTach sensor (6-12 inches)
2. Press and hold the **Channel Up** button for 1-2 seconds
3. Release and wait

**Expected Result:**
- Alert: "Successfully learned Channel Up"
- Button status: "Learned" (green)
- "Test" button available
- Progress: "2 / 27 buttons learned"

### 7. Test Channel Up Button

1. Ensure cable box is powered on
2. Note current channel number
3. Click "Test" button on Channel Up
4. Observe cable box

**Expected Result:**
- Cable box changes to next channel (e.g., 100 → 101)
- Alert: "Test successful for Channel Up"
- Channel number increases by one

### 8. Save Learned Codes

After successfully learning and testing both buttons:

1. Scroll to bottom of page
2. Click the large "Save All Codes" button

**Expected Result:**
- Button shows "Saving..."
- After 1-2 seconds: "Saved!" with checkmark
- Alert: "All codes saved successfully!"
- Button returns to normal state

### 9. Verify Database Storage

The learned codes are now stored in the database. Verify:

```bash
# SSH into server
ssh ubuntu@your-server-ip

# Query database
cd /home/ubuntu/Sports-Bar-TV-Controller
sqlite3 data/production.db

# Check IR codes
SELECT name, LENGTH(irCodes) as codeLength
FROM IRDevice
WHERE name = 'Cable Box 2';

# Expected output:
# Cable Box 2|234
# (length varies based on number of codes)

# View actual codes (optional)
SELECT name, json_extract(irCodes, '$.power') as powerCode
FROM IRDevice
WHERE name = 'Cable Box 2';

# Expected: sendir,1:1,1,38000,1,1,342,171,...
```

### 10. Test From Cable Box Remote Component

Now test the learned codes through the normal remote interface:

1. Navigate to: `http://your-server-ip:3001/remote`
2. Select "Cable Box 2" from device selector
3. The remote control interface loads

**Test Power:**
1. Click the Power button on the virtual remote
2. Cable box should toggle power

**Test Channel Up:**
1. Click the "CH ▲" button on the virtual remote
2. Cable box should change to next channel

**Expected Result:**
- Virtual remote uses learned IR codes automatically
- Commands execute successfully
- Success messages appear
- Cable box responds as expected

### 11. Export Codes (Bonus)

Save learned codes for backup or sharing:

1. Go back to: `http://your-server-ip:3001/ir-learning`
2. Select "Cable Box 2"
3. Click "Export" button

**Expected Result:**
- Browser downloads file: `Cable_Box_2_ir_codes.json`
- File contains JSON with learned codes:

```json
{
  "power": "sendir,1:1,1,38000,1,1,342,171,...",
  "channel_up": "sendir,1:1,1,38000,1,1,342,171,..."
}
```

### 12. Import Codes (Bonus)

Demonstrate importing codes to another device:

1. Select "Cable Box 3" from dropdown
2. Click "Import" button
3. Choose the exported file
4. Wait for confirmation

**Expected Result:**
- Alert: "Codes imported successfully"
- Cable Box 3 now has the same codes as Cable Box 2
- No need to re-learn for identical cable box models

## API Testing (Advanced)

### Test Learning API Directly

You can also test the learning API using curl:

```bash
# Start learning session for power button
curl -X POST http://localhost:3001/api/ir-devices/learn \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "cable-box-2",
    "command": "power",
    "iTachAddress": "192.168.1.100",
    "portNumber": 1,
    "timeout": 10000
  }'

# Expected response (waiting for button press):
# {
#   "success": true,
#   "waiting": true,
#   "message": "Waiting for button press...",
#   "sessionId": "cable-box-2-power-1699..."
# }

# After pressing button on remote:
# {
#   "success": true,
#   "message": "Successfully learned IR code for power",
#   "command": "power",
#   "irCode": "sendir,1:1,1,38000,1,1,342,171,...",
#   "deviceId": "cable-box-2",
#   "deviceName": "Cable Box 2"
# }
```

### Test Sending Learned Code

```bash
# Send learned power command
curl -X POST http://localhost:3001/api/ir-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "cable-box-2",
    "command": "sendir,1:1,1,38000,1,1,342,171,...",
    "iTachAddress": "192.168.1.100",
    "isRawCode": true
  }'

# Expected response:
# {
#   "success": true,
#   "message": "Successfully sent IR code to Cable Box 2",
#   "device": "Cable Box 2",
#   "command": "raw_ir_code"
# }
```

## Troubleshooting Demo Issues

### Issue: iTach Not Responding

**Symptoms:**
- Cannot connect to iTach
- Timeout errors

**Solutions:**
1. Verify iTach power adapter is connected
2. Check network cable is plugged in
3. Ping iTach IP address
4. Try factory reset (hold button 10 seconds)
5. Use Global Cache app to find iTach

### Issue: Learning Times Out

**Symptoms:**
- "Timeout waiting for button press"
- No code captured

**Solutions:**
1. Press remote button more firmly
2. Hold button for 1-2 seconds (not just tap)
3. Move remote closer to iTach (6 inches)
4. Point remote directly at iTach sensor
5. Avoid bright lights during learning
6. Check iTach LED is flashing (learning mode active)

### Issue: Test Button Doesn't Work

**Symptoms:**
- Code learned successfully
- Test fails
- Cable box doesn't respond

**Solutions:**
1. **Check emitter placement:**
   - Move emitter closer to cable box (4-6 inches)
   - Aim at IR sensor window (usually top-left)
   - Ensure no obstructions

2. **Verify cable box:**
   - Cable box is powered on
   - Cable box is not in standby mode
   - Try with known working remote first

3. **Re-learn the code:**
   - Click "Learn" again
   - Try from different distance (8-10 inches)
   - Press button more firmly

### Issue: Wrong Code Learned

**Symptoms:**
- Learned code does something unexpected
- Cable box responds incorrectly

**Solutions:**
1. Delete learned code
2. Re-learn with better technique:
   - Point remote more directly
   - Don't press multiple buttons
   - Hold button steadily
   - Ensure good lighting (not too bright)

## Success Criteria

✅ **Demo Successful If:**
- iTach responds to ping
- IR learning page loads correctly
- Power button learned and saved
- Channel Up button learned and saved
- Test buttons work correctly
- Codes persist after page reload
- Virtual remote uses learned codes
- Export/import works correctly

## Learning Complete Spectrum Remote

After successful demo, complete the learning process:

### Remaining Buttons to Learn

**Numbers (10 buttons):**
- digit_0, digit_1, digit_2, ... digit_9

**Navigation (5 buttons):**
- arrow_up, arrow_down, arrow_left, arrow_right, select

**Functions (5 buttons):**
- guide, menu, info, exit, last

**Channel (2 buttons):**
- channel_up ✓ (already learned)
- channel_down

**DVR (6 buttons):**
- play, pause, rewind, fast_forward, record, stop

**Volume (3 buttons - optional):**
- volume_up, volume_down, mute

**Power:**
- power ✓ (already learned)

### Time Estimate

- Learning: ~2 minutes per button
- Testing: ~30 seconds per button
- Total for all 27 buttons: ~60-75 minutes

### Best Practice Workflow

1. Learn all numbers first (0-9)
2. Test numbers with direct channel entry
3. Learn navigation buttons
4. Test navigation in guide
5. Learn functions
6. Test each function
7. Learn channel controls
8. Test channel up/down
9. Learn DVR controls (if applicable)
10. Learn volume controls (optional)
11. Export codes for backup
12. Document any issues or special notes

## Notes

- **Session Persistence**: Learned codes are saved immediately to database
- **Multiple Devices**: Can learn different codes for different cable box models
- **Sharing Codes**: Export from one device, import to identical model
- **Backup**: Export codes regularly for disaster recovery
- **Updates**: If cable box firmware updates, may need to re-learn codes

## Conclusion

This demo successfully shows:
1. ✅ IR learning from physical remote
2. ✅ Code capture and storage
3. ✅ Testing learned codes
4. ✅ Database persistence
5. ✅ Automatic code selection in remote component
6. ✅ Export/import functionality

The system is now ready for production use with Spectrum cable boxes.

---

**Demo Duration**: ~15 minutes (for power and channel up)
**Full Learning Session**: ~60-75 minutes (all 27 buttons)
**Tested On**: Spectrum 100-H Cable Box
**Date**: November 4, 2025
