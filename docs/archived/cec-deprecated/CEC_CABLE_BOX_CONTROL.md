# CEC Cable Box Control via Pulse-Eight Adapters

> **⚠️ DEPRECATED - November 4, 2025**
>
> **DO NOT IMPLEMENT - CEC cable box control is NOT POSSIBLE with Spectrum equipment.**
>
> After extensive testing, it was confirmed that Spectrum/Charter disables CEC in their cable box firmware.
>
> **Use IR control instead.** See `/docs/CEC_DEPRECATION_NOTICE.md` for details.
>
> ---
>
> **This document is kept for historical reference only.**

**Status:** ❌ DEPRECATED - Not Implemented (Hardware Limitation Discovered)
**Created:** October 29, 2025 (Deprecated November 4, 2025)
**System Compatibility:** Wolfpack Matrix with Pulse-Eight USB-CEC Adapters

---

## Overview

This document outlines the architecture and implementation plan for controlling cable boxes using Pulse-Eight USB-CEC adapters. This approach enables direct CEC command injection into HDMI signals before they reach the matrix switcher, providing reliable control regardless of active routing.

## Current System Status

### Existing Hardware
- **CEC Library:** libCEC 6.0.2 (installed)
- **Detected Adapter:** 1x Pulse-Eight USB-CEC Adapter
  - Device: `/dev/ttyACM0`
  - Firmware: Version 12 (April 28, 2020)
  - Vendor ID: 2548
  - Product ID: 1002

### Control Methods Currently in Use
- **Fire TV Devices:** ADB over network (working, preferred method)
- **TVs (Outputs):** CEC through matrix (limited, primarily for power)

---

## Proposed Architecture

### Hardware Setup (Per Cable Box)

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│ Cable Box   │HDMI  │ Pulse-Eight      │HDMI  │  Wolfpack   │
│ HDMI Output │─────>│ USB-CEC Adapter  │─────>│   Matrix    │
│             │      │                  │      │   Input     │
└─────────────┘      └────────┬─────────┘      └─────────────┘
                             │ USB
                             │
                             ▼
                    ┌─────────────────┐
                    │ Server          │
                    │ /dev/ttyACMx    │
                    │ Sports Bar App  │
                    └─────────────────┘
```

### Signal Flow
1. **Cable box** outputs HDMI signal
2. **Pulse-Eight adapter** passes through HDMI + injects CEC commands via USB
3. **Matrix** routes video to selected TVs
4. **Server** sends CEC commands to specific adapter via USB

### Key Advantages
- ✅ **Pre-matrix injection:** Commands sent before matrix routing
- ✅ **Independent control:** Each cable box has dedicated adapter
- ✅ **Reliable addressing:** No CEC address conflicts
- ✅ **Route-independent:** Control works regardless of active output
- ✅ **Existing infrastructure:** Server, cabling mostly in place

---

## Hardware Requirements

### For 4 Cable Boxes (Typical Installation)

| Item | Quantity | Est. Cost | Notes |
|------|----------|-----------|-------|
| Pulse-Eight USB-CEC Adapter | 4 | $200-320 | ~$50-80 each |
| Short HDMI Cables (1-3ft) | 4 | $20-40 | Cable box to adapter |
| USB Hub (powered, 7-port) | 1 | $30-50 | If server USB ports limited |
| **Total** | | **$250-410** | |

### Pulse-Eight Adapter Specifications
- **Model:** USB-CEC Adapter
- **Connections:** HDMI In, HDMI Out, USB Type-B
- **Supported CEC:** Full CEC 1.4 specification
- **Pass-through:** 4K @ 60Hz, HDR, HDCP 2.2
- **Power:** USB bus-powered (no external adapter needed)
- **Latency:** None (zero frame delay)

### USB Device Naming Convention
When multiple adapters are connected:
```bash
/dev/ttyACM0  →  Cable Box 1 (Matrix Input X)
/dev/ttyACM1  →  Cable Box 2 (Matrix Input Y)
/dev/ttyACM2  →  Cable Box 3 (Matrix Input Z)
/dev/ttyACM3  →  Cable Box 4 (Matrix Input W)
```

**Important:** Create udev rules to ensure consistent device naming based on USB port or serial number.

---

## CEC Command Capabilities

### Basic Navigation
- **Arrow Keys:** Up, Down, Left, Right
- **Select/OK:** Enter/confirm
- **Back/Exit:** Return to previous menu
- **Menu:** Open main menu
- **Info:** Display program information

### Channel Control
- **Direct Entry:** Numeric keypad (0-9)
- **Channel Up/Down:** Sequential channel navigation
- **Last Channel:** Return to previous channel
- **Guide:** Open channel guide

### Playback Control (DVR-equipped boxes)
- **Play/Pause**
- **Stop**
- **Rewind/Fast Forward**
- **Record**
- **Skip Forward/Backward**

### Power & Volume
- **Power On/Off/Toggle**
- **Standby Mode**
- **Volume Up/Down**
- **Mute/Unmute**

### Cable Box-Specific Variations
Different cable providers may support different CEC command sets:
- **Xfinity/Comcast:** Generally good CEC support
- **Spectrum/Charter:** Good support, some models better than others
- **DirecTV:** Limited CEC support (may need IR instead)
- **DISH Network:** Limited CEC support (may need IR instead)

---

## Software Architecture

### Database Schema Addition

```sql
-- CEC Device Configuration Table
CREATE TABLE IF NOT EXISTS CecDevice (
  id TEXT PRIMARY KEY,
  devicePath TEXT NOT NULL,           -- e.g., /dev/ttyACM0
  deviceType TEXT NOT NULL,           -- 'cable_box', 'dvr', etc.
  matrixInputId TEXT,                 -- Link to matrix input
  deviceName TEXT NOT NULL,           -- User-friendly name
  cecAddress TEXT,                    -- CEC logical address (if known)
  vendorId TEXT,                      -- USB vendor ID
  productId TEXT,                     -- USB product ID
  serialNumber TEXT,                  -- Adapter serial number
  firmwareVersion TEXT,               -- Adapter firmware
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (matrixInputId) REFERENCES MatrixInput(id)
);

-- CEC Command History (for debugging)
CREATE TABLE IF NOT EXISTS CecCommandLog (
  id TEXT PRIMARY KEY,
  cecDeviceId TEXT NOT NULL,
  command TEXT NOT NULL,              -- CEC command sent
  cecCode TEXT,                       -- Raw CEC code (e.g., "44:41")
  success BOOLEAN,
  responseTime INTEGER,               -- ms
  errorMessage TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (cecDeviceId) REFERENCES CecDevice(id)
);
```

### API Endpoints

#### Device Management
```typescript
// GET /api/cec/devices
// List all CEC devices and their status
Response: {
  success: boolean
  devices: Array<{
    id: string
    devicePath: string
    deviceName: string
    matrixInputId: string
    isConnected: boolean
    firmwareVersion: string
  }>
}

// POST /api/cec/devices
// Register a new CEC device
Body: {
  devicePath: string
  deviceName: string
  matrixInputId: string
}

// PATCH /api/cec/devices/:id
// Update CEC device configuration
Body: {
  deviceName?: string
  matrixInputId?: string
  isActive?: boolean
}
```

#### Command Execution
```typescript
// POST /api/cec/command
// Send CEC command to specific device
Body: {
  deviceId: string          // Or matrixInputId
  command: string           // 'channel_up', 'key_select', etc.
  params?: {
    channel?: string        // For direct channel entry
    repeat?: number         // For multi-press commands
  }
}

Response: {
  success: boolean
  executionTime: number
  cecCode?: string
  error?: string
}

// POST /api/cec/command/batch
// Send multiple commands in sequence
Body: {
  deviceId: string
  commands: Array<{
    command: string
    params?: object
    delayAfter?: number   // ms delay before next command
  }>
}
```

#### Diagnostics
```typescript
// GET /api/cec/scan
// Scan for connected Pulse-Eight adapters
Response: {
  success: boolean
  adapters: Array<{
    devicePath: string
    vendorId: string
    productId: string
    serialNumber: string
    firmwareVersion: string
  }>
}

// POST /api/cec/test/:deviceId
// Test CEC communication with a device
Response: {
  success: boolean
  responsive: boolean
  latency: number
  supportedCommands?: string[]
}
```

### Node.js CEC Integration

```typescript
// src/lib/cec-controller.ts

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface CecDevice {
  id: string
  devicePath: string
  name: string
}

export class CecController {
  private devices: Map<string, CecDevice> = new Map()

  // Initialize CEC adapter
  async initDevice(devicePath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `echo 'scan' | cec-client -d 1 -s ${devicePath}`
      )
      return stdout.includes('device')
    } catch (error) {
      console.error(`Failed to init CEC device ${devicePath}:`, error)
      return false
    }
  }

  // Send CEC command
  async sendCommand(
    devicePath: string,
    cecCommand: string
  ): Promise<{ success: boolean; output?: string }> {
    try {
      const { stdout, stderr } = await execAsync(
        `echo '${cecCommand}' | cec-client -d 1 -s ${devicePath}`,
        { timeout: 5000 }
      )

      return {
        success: !stderr.includes('ERROR'),
        output: stdout
      }
    } catch (error) {
      return {
        success: false,
        output: (error as Error).message
      }
    }
  }

  // Common command shortcuts
  async channelUp(devicePath: string): Promise<boolean> {
    const result = await this.sendCommand(devicePath, 'tx 40:44:09')
    return result.success
  }

  async channelDown(devicePath: string): Promise<boolean> {
    const result = await this.sendCommand(devicePath, 'tx 40:44:0A')
    return result.success
  }

  async sendDigit(devicePath: string, digit: number): Promise<boolean> {
    if (digit < 0 || digit > 9) return false
    // CEC digit codes: 0x20-0x29 for 0-9
    const cecCode = (0x20 + digit).toString(16)
    const result = await this.sendCommand(devicePath, `tx 40:44:${cecCode}`)
    return result.success
  }

  async selectButton(devicePath: string): Promise<boolean> {
    const result = await this.sendCommand(devicePath, 'tx 40:44:00')
    return result.success
  }

  async sendArrow(
    devicePath: string,
    direction: 'up' | 'down' | 'left' | 'right'
  ): Promise<boolean> {
    const codes = {
      up: '01',
      down: '02',
      left: '03',
      right: '04'
    }
    const result = await this.sendCommand(
      devicePath,
      `tx 40:44:${codes[direction]}`
    )
    return result.success
  }
}
```

### CEC Command Reference

Common CEC opcodes for cable box control:

```typescript
export const CEC_COMMANDS = {
  // Navigation
  SELECT: '00',
  UP: '01',
  DOWN: '02',
  LEFT: '03',
  RIGHT: '04',

  // Menu
  ROOT_MENU: '09',
  EXIT: '0D',

  // Channel
  CHANNEL_UP: '09',
  CHANNEL_DOWN: '0A',

  // Numbers
  NUMBER_0: '20',
  NUMBER_1: '21',
  NUMBER_2: '22',
  NUMBER_3: '23',
  NUMBER_4: '24',
  NUMBER_5: '25',
  NUMBER_6: '26',
  NUMBER_7: '27',
  NUMBER_8: '28',
  NUMBER_9: '29',

  // Playback (DVR)
  PLAY: '44',
  PAUSE: '46',
  STOP: '45',
  REWIND: '48',
  FAST_FORWARD: '49',
  RECORD: '47',

  // Power
  POWER: '40',
  POWER_ON: '04',
  POWER_OFF: '36',

  // Volume
  VOLUME_UP: '41',
  VOLUME_DOWN: '42',
  MUTE: '43'
}
```

---

## Installation Procedure

### 1. Hardware Installation (Per Cable Box)

1. **Disconnect cable box HDMI:**
   - Unplug HDMI cable from cable box to matrix

2. **Connect Pulse-Eight adapter:**
   ```
   Cable Box HDMI Out → Pulse-Eight HDMI In
   Pulse-Eight HDMI Out → Matrix Input (original cable)
   Pulse-Eight USB → Server USB port (or hub)
   ```

3. **Verify video pass-through:**
   - Video should appear normally on TVs
   - No quality loss or delay

### 2. USB Device Detection

```bash
# List all CEC adapters
cec-client -l

# Should show each adapter:
# device:              1
# com port:            /dev/ttyACM0
# ...
# device:              2
# com port:            /dev/ttyACM1
# etc.
```

### 3. Create udev Rules (Persistent Device Names)

```bash
# Create udev rule file
sudo nano /etc/udev/rules.d/99-pulse-eight-cec.rules
```

Add rules based on USB port or serial number:
```udev
# Map by USB port location
SUBSYSTEM=="tty", KERNELS=="1-1.1", SYMLINK+="cec-cable-box-1"
SUBSYSTEM=="tty", KERNELS=="1-1.2", SYMLINK+="cec-cable-box-2"
SUBSYSTEM=="tty", KERNELS=="1-1.3", SYMLINK+="cec-cable-box-3"
SUBSYSTEM=="tty", KERNELS=="1-1.4", SYMLINK+="cec-cable-box-4"

# Or map by serial number (preferred)
SUBSYSTEM=="tty", ATTRS{serial}=="12345678", SYMLINK+="cec-cable-box-1"
SUBSYSTEM=="tty", ATTRS{serial}=="87654321", SYMLINK+="cec-cable-box-2"
```

Reload udev rules:
```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### 4. Test Each Adapter

```bash
# Test adapter 1
echo "scan" | cec-client -d 1 -s /dev/ttyACM0

# Send test command (channel up)
echo "tx 40:44:09" | cec-client -d 1 -s /dev/ttyACM0

# Monitor CEC traffic
cec-client -d 8 -s /dev/ttyACM0
```

### 5. Database Configuration

```bash
# Access database
sqlite3 /home/ubuntu/sports-bar-data/production.db

# Register CEC devices
INSERT INTO CecDevice (id, devicePath, deviceType, matrixInputId, deviceName)
VALUES
  ('cec-1', '/dev/ttyACM0', 'cable_box', 'input-1', 'Cable Box 1'),
  ('cec-2', '/dev/ttyACM1', 'cable_box', 'input-2', 'Cable Box 2'),
  ('cec-3', '/dev/ttyACM2', 'cable_box', 'input-3', 'Cable Box 3'),
  ('cec-4', '/dev/ttyACM3', 'cable_box', 'input-4', 'Cable Box 4');
```

---

## UI Integration Points

### Admin Configuration Page

**Location:** `/admin/devices/cec`

**Features:**
- List all detected Pulse-Eight adapters
- Map adapters to matrix inputs
- Test CEC communication
- View command history/logs
- Configure device names

**UI Components:**
```tsx
<CecDeviceCard>
  - Device name (editable)
  - Connection status (green/red indicator)
  - Matrix input mapping (dropdown)
  - Test buttons (channel up/down, select)
  - Command latency display
  - Last command timestamp
</CecDeviceCard>
```

### TV Control Interface Enhancement

Add cable box controls to existing TV control UI:

```tsx
<CableBoxControls inputId={selectedInput}>
  <NumericKeypad>
    {/* Direct channel entry */}
    <Button onClick={() => sendDigit(1)}>1</Button>
    <Button onClick={() => sendDigit(2)}>2</Button>
    {/* ... */}
  </NumericKeypad>

  <NavigationPad>
    <Button onClick={() => sendArrow('up')}>↑</Button>
    <Button onClick={() => sendArrow('left')}>←</Button>
    <Button onClick={() => selectButton()}>OK</Button>
    <Button onClick={() => sendArrow('right')}>→</Button>
    <Button onClick={() => sendArrow('down')}>↓</Button>
  </NavigationPad>

  <ChannelButtons>
    <Button onClick={() => channelUp()}>CH ▲</Button>
    <Button onClick={() => channelDown()}>CH ▼</Button>
  </ChannelButtons>
</CableBoxControls>
```

### Bartender Remote Addition

Add simplified cable box controls to bartender remote for quick channel changes.

---

## Troubleshooting Guide

### Issue: Adapter Not Detected

**Symptoms:**
- Device doesn't appear in `cec-client -l`
- `/dev/ttyACMx` not created

**Solutions:**
1. Check USB connection is secure
2. Try different USB port
3. Check dmesg for USB errors: `dmesg | tail -20`
4. Verify adapter has power (LED indicator)
5. Test on different server/computer

### Issue: Commands Not Working

**Symptoms:**
- Commands sent but no response from cable box
- "TRANSMIT_FAILED" in cec-client output

**Solutions:**
1. Verify HDMI cables are CEC-capable (not all are)
2. Check cable box CEC setting is enabled
3. Test with cec-client interactive mode
4. Try different CEC commands
5. Check for CEC address conflicts

### Issue: Intermittent Communication

**Symptoms:**
- Commands work sometimes, fail other times
- High latency

**Solutions:**
1. Check USB hub power (may need powered hub)
2. Reduce CEC traffic (add delays between commands)
3. Update Pulse-Eight firmware
4. Check for USB interference
5. Verify matrix isn't blocking CEC

### Issue: Wrong Device Responding

**Symptoms:**
- Command sent to device 1, device 2 responds

**Solutions:**
1. Verify udev rules are correct
2. Check device path mapping in database
3. Reconnect adapters to establish correct order
4. Use serial number-based udev rules instead of port-based

---

## Performance Considerations

### Command Latency
- **Typical:** 50-200ms per command
- **Acceptable:** < 500ms
- **Problem:** > 1000ms

### Command Reliability
- **Single commands:** 95%+ success rate expected
- **Sequential commands:** Add 100-200ms delay between
- **Failed commands:** Retry once automatically

### Concurrent Control
- Each adapter operates independently
- No limit on simultaneous commands to different boxes
- Same box: serialize commands (queue system)

---

## Cost-Benefit Analysis

### Advantages Over Alternative Methods

| Method | Cost | Reliability | Latency | Flexibility |
|--------|------|-------------|---------|-------------|
| **Pulse-Eight CEC** | $250-410 | High (95%+) | Low (50-200ms) | Full navigation |
| IR Blasters | $100-200 | Medium (80-90%) | Medium (200-500ms) | Full, but line-of-sight |
| Cable Provider APIs | Free | Varies | High (1-5s) | Limited |
| Network Control | N/A | N/A | N/A | Most boxes don't support |

### When to Choose CEC
- ✅ Cable boxes support CEC
- ✅ Budget allows for adapters
- ✅ Want reliable, fast control
- ✅ Need full navigation capabilities
- ✅ Matrix setup already in place

### When to Consider Alternatives
- ❌ Cable boxes have poor/no CEC support → Use IR blasters
- ❌ Budget very constrained → Try provider APIs first
- ❌ Only need channel changes → IR may be simpler
- ❌ Cable provider offers good API → Use API integration

---

## Future Enhancements

### Planned Features
1. **Auto-channel tuning on source switch**
   - Pre-tune channel when bartender selects input
   - Reduce channel change delays

2. **DVR integration**
   - Record programs via CEC
   - Manage recordings
   - Playback control

3. **Channel favorite presets**
   - One-touch channel access
   - Popular channels quick-select
   - Sport-specific channel groups

4. **CEC monitoring**
   - Track command success rates
   - Alert on device failures
   - Performance analytics

5. **Multi-command macros**
   - Custom command sequences
   - E.g., "Guide → Search → Sports"
   - Saved routines

### Integration Possibilities
- **Schedule system:** Auto-tune channels for scheduled events
- **AI assistant:** Voice commands for channel changes
- **Mobile app:** Remote cable box control
- **Guide data:** Enhance with EPG integration

---

## Testing Checklist

Before deploying to production:

### Hardware Tests
- [ ] All adapters detected by cec-client
- [ ] Video pass-through quality verified (4K if applicable)
- [ ] No audio/video delay introduced
- [ ] USB connections stable (no disconnects)
- [ ] udev rules create consistent device names

### Software Tests
- [ ] Database schema created successfully
- [ ] API endpoints respond correctly
- [ ] All CEC commands work on each box
- [ ] Command latency < 500ms
- [ ] Error handling works (disconnected adapter)
- [ ] Logs capture command history

### User Interface Tests
- [ ] Admin page lists all adapters
- [ ] Device mapping UI functional
- [ ] Test buttons work
- [ ] Status indicators accurate
- [ ] TV control page shows cable box controls
- [ ] Numeric keypad sends digits correctly

### Integration Tests
- [ ] Matrix switching doesn't affect CEC
- [ ] Multiple adapters work simultaneously
- [ ] Commands queue properly for same device
- [ ] System survives adapter disconnect/reconnect
- [ ] Restart/reboot preserves configuration

---

## Support & Resources

### Pulse-Eight Documentation
- Official site: https://www.pulse-eight.com
- CEC specification: https://www.hdmi.org/cec
- libCEC documentation: https://github.com/Pulse-Eight/libcec

### CEC Command References
- CEC User Control Codes: CEC Spec 13.13
- Common manufacturer implementations
- Cable box specific variations

### Internal Documentation
- See also: `CEC_IMPLEMENTATION_SUMMARY.md`
- See also: `pulse-eight-integration-guide.md`
- See also: `CEC_TV_DISCOVERY_GUIDE.md`

---

## Deployment Timeline Estimate

Assuming 1 developer, phased implementation:

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| **Phase 1: Hardware** | Install 3 more adapters, test, configure udev | 2-4 hours |
| **Phase 2: Database** | Schema, migrations, seed data | 2 hours |
| **Phase 3: Backend** | CEC controller class, API endpoints | 4-6 hours |
| **Phase 4: Admin UI** | Configuration page, device management | 4-6 hours |
| **Phase 5: Control UI** | Add cable box controls to TV interface | 3-4 hours |
| **Phase 6: Testing** | Full system testing, bug fixes | 4-6 hours |
| **Total** | | **19-28 hours** |

**Suggested Approach:** Implement incrementally
1. Start with one cable box (already have 1 adapter)
2. Test thoroughly with single box
3. Scale to remaining 3 boxes
4. Refine based on real-world usage

---

## Conclusion

CEC control via Pulse-Eight adapters provides a robust, reliable solution for cable box control in commercial sports bar environments. The pre-matrix injection approach solves common CEC routing issues, and the USB interface enables precise, programmable control.

**Recommended:** Proceed with implementation when budget allows. Start with single-box pilot to validate approach, then scale to full deployment.

**Questions?** Contact the development team or refer to existing CEC integration documentation.
