# IR Cable Box Control Implementation Guide

**Status:** Implementation Plan
**Created:** October 29, 2025
**Target Devices:** Spectrum/Charter HR 101 World Boxes (and other cable boxes)

---

## Overview

This document provides a complete implementation plan for controlling cable boxes via infrared (IR) commands using network-controlled IR distribution systems. This approach is specifically optimized for Spectrum HR 101 "World Boxes" which are notoriously difficult for IR control due to recessed sensors.

## Why IR Control?

### Advantages Over CEC
- ✅ **Universal compatibility:** Works with 99.9% of cable boxes
- ✅ **Proven reliability:** Mature technology used in hotels, sports bars worldwide
- ✅ **Lower cost:** $190-250 vs $250-410 for CEC
- ✅ **Simpler troubleshooting:** Visual debugging (phone camera can see IR)
- ✅ **No USB dependencies:** Network-based, no device drivers
- ✅ **Works with DirecTV/DISH:** CEC often doesn't

### When to Use IR vs CEC
- ✅ **Use IR if:** DirecTV, DISH, or any cable box with poor CEC support
- ✅ **Use IR if:** Budget conscious ($190 vs $400)
- ✅ **Use IR if:** Want proven commercial-grade reliability
- ⚠️ **Use CEC if:** Need DVR playback control (pause, rewind, etc.)
- ⚠️ **Use CEC if:** Cable boxes have verified good CEC support

---

## Hardware Architecture

### Recommended Setup

```
┌─────────────────────────────────────────────────────┐
│                  Server / Controller                │
│            Sports Bar TV Controller App             │
│                  (Node.js/Express)                  │
└────────────────────┬────────────────────────────────┘
                     │ HTTP API
                     │ (192.168.x.x)
                     ▼
        ┌────────────────────────────┐
        │  Global Caché iTach IP2IR  │
        │    IR Distribution Hub     │
        │   (Network Controlled)     │
        └─┬────┬────┬────┬────┬─────┘
          │    │    │    │    │
       3.5mm cables (IR emitters)
          │    │    │    │    │
          ▼    ▼    ▼    ▼    ▼
    ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
    │Box 1│ │Box 2│ │Box 3│ │Box 4│
    │ HR  │ │ HR  │ │ HR  │ │ HR  │
    │ 101 │ │ 101 │ │ 101 │ │ 101 │
    └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘
       │       │       │       │
     HDMI    HDMI    HDMI    HDMI
       │       │       │       │
       └───────┴───────┴───────┘
                │
         To Matrix Inputs
```

### Physical Connection per Cable Box

**Standard Setup (1 emitter per box):**
```
IR Controller Port 1 → 3.5mm cable → IR Emitter → Cable Box Front Panel
```

**Reliable Setup for HR 101 (2 emitters per box - RECOMMENDED):**
```
IR Controller Port 1 → Y-splitter → Emitter A → Front lower-right
                                  → Emitter B → Top center-front
```

---

## Spectrum HR 101 World Box - Specific Solutions

### The HR 101 IR Challenge

**Known Issues:**
- IR sensor is recessed behind front panel plastic
- Poor IR sensitivity compared to other boxes
- Inconsistent sensor response
- Front panel design makes emitter placement tricky

### Dual-Emitter Solution (98%+ Reliability)

The HR 101 has **two IR sensors:**

**Primary Sensor:**
- Location: Front panel, lower-right area
- Position: About 1-2 inches from right edge
- Slightly recessed behind plastic

**Secondary Sensor:**
- Location: Top panel, center-front
- Position: About 1 inch from front edge
- Better accessibility, less sensitive

**Recommended Placement:**
```
Front View of HR 101:
┌───────────────────────────┐
│  Spectrum              LED│  ← Emitter B (backup)
│                           │
│                           │
│                    ●      │  ← Emitter A (primary)
└───────────────────────────┘
     1-2" from edge ↑
```

### IR Emitter Selection for HR 101

**Recommended Products:**

1. **Xantech 284M "Dinky Link"** (Best for HR 101)
   - Higher power output than standard
   - 3.5mm plug
   - Adhesive backing
   - Cost: ~$8 each
   - **Recommended: 8 units (2 per box)**

2. **Infrared Resources "Hidden Link"**
   - Specifically designed for recessed sensors
   - Extra-long emitter nose
   - Cost: ~$12 each
   - Best for very difficult placements

3. **Standard Emitters with Power Boost**
   - Cheaper option (~$5 each)
   - Requires IR controller with adjustable power
   - May need experimentation

### Installation Guide for HR 101

#### Step 1: Prepare Surface
```bash
# Clean the area
- Use alcohol wipe on cable box surface
- Let dry completely (30 seconds)
- Remove any existing adhesive residue
```

#### Step 2: Primary Emitter Placement
```
Position: Front panel, lower-right corner
Distance: 1-2 inches from right edge
Height: Vertically centered on front panel

Testing:
1. Place emitter (don't stick yet)
2. Test with universal remote in same position
3. If works reliably, mark spot with tape
4. Stick emitter firmly (hold 10 seconds)
```

#### Step 3: Secondary Emitter (If Needed)
```
Position: Top panel, center-front
Distance: 1 inch from front edge

Install if:
- Primary emitter has <90% success rate
- You want maximum reliability
- Cable box is in difficult location
```

#### Step 4: Cable Management
```
3.5mm IR cable routing:
- Run along back/side of cable box
- Avoid tight bends (>90° curves)
- Keep away from power cables
- Secure with cable ties or adhesive clips
- Label each cable (Box 1, Box 2, etc.)
```

### The "IR Chamber" Technique

If standard placement isn't reliable:

**Materials:**
- Black electrical tape or gaffer's tape
- Scissors

**Method:**
1. Place emitter on lower-right corner (normal position)
2. Cut small piece of tape (2" x 2")
3. Cover front panel area around emitter
4. Creates reflective "chamber" that bounces IR to recessed sensor
5. Not pretty, but very effective (95%+ reliability)

**Before:**
```
[Emitter] → ))) → (Recessed Sensor)
  Direct signal, some IR misses sensor
```

**After (with tape chamber):**
```
┌─────Tape Chamber─────┐
│ [Emitter] → ))) → )) │
│      ↓ reflections ↓ │
│    (Recessed Sensor) │
└──────────────────────┘
  All IR trapped and directed to sensor
```

---

## Hardware Recommendations

### IR Distribution Controllers

#### Option 1: Global Caché iTach IP2IR (RECOMMENDED)
**Cost:** ~$150
**Specs:**
- Network controlled (HTTP API)
- 3 IR outputs standard
- Expandable to 6 outputs with IR Y-cables
- Supports all major IR code formats
- Built-in IR learning capability
- Web configuration interface

**Pros:**
- ✅ Simple HTTP API
- ✅ Well-documented
- ✅ Proven in commercial installations
- ✅ Node.js libraries available

**Cons:**
- ❌ Fixed IR power (can't adjust per port)
- ❌ Only 3 ports without splitters

**Best for:**
- Budget-conscious installations
- Standard cable boxes
- When you don't need power adjustment

#### Option 2: Xantech MRAUDIO8X8
**Cost:** ~$300-400
**Specs:**
- 8 IR outputs
- Adjustable IR power per output
- RS-232 or network control
- Professional-grade reliability

**Pros:**
- ✅ Individual power control per zone
- ✅ More outputs (8 vs 3)
- ✅ Commercial-grade build quality
- ✅ Perfect for difficult boxes like HR 101

**Cons:**
- ❌ Higher cost
- ❌ More complex configuration
- ❌ May be overkill for simple setups

**Best for:**
- Multiple difficult cable boxes
- Professional installations
- When reliability is critical
- Mixed device types (some need more power)

#### Option 3: IRTrans Ethernet
**Cost:** ~$120
**Specs:**
- Network controlled
- 16 emitter outputs
- USB and Ethernet versions
- Open-source software available

**Pros:**
- ✅ Low cost per output
- ✅ Many outputs (16 emitters)
- ✅ Good community support

**Cons:**
- ❌ Less common in North America
- ❌ May require more setup
- ❌ Limited commercial support

### Complete Parts List (4 Cable Boxes)

#### Budget Setup (~$190)
| Item | Qty | Unit Cost | Total |
|------|-----|-----------|-------|
| Global Caché iTach IP2IR | 1 | $150 | $150 |
| 3.5mm Y-splitter cables | 2 | $5 | $10 |
| Xantech 284M IR Emitters | 4 | $8 | $32 |
| **Total** | | | **$192** |

*Single emitter per box - good for easy boxes*

#### Reliable Setup for HR 101 (~$220)
| Item | Qty | Unit Cost | Total |
|------|-----|-----------|-------|
| Global Caché iTach IP2IR | 1 | $150 | $150 |
| 3.5mm Y-splitter cables | 4 | $5 | $20 |
| Xantech 284M IR Emitters | 8 | $8 | $64 |
| **Total** | | | **$234** |

*Dual emitter per box - recommended for HR 101*

#### Premium Setup (~$400)
| Item | Qty | Unit Cost | Total |
|------|-----|-----------|-------|
| Xantech MRAUDIO8X8 | 1 | $350 | $350 |
| Infrared Resources Hidden Link | 8 | $12 | $96 |
| **Total** | | | **$446** |

*Adjustable power + premium emitters*

---

## IR Code Database

### Spectrum/Charter HR 101 Codes

**Pronto Hex Format:**
```
Power:      0000 006C 0022 0002 015B 00AD ...
Channel Up: 0000 006C 0000 0022 015B 00AD ...
Channel Down: 0000 006C 0000 0022 015B 00AD ...
0: 0000 006C 0000 0022 015B 00AD ...
1: 0000 006C 0000 0022 015B 00AD ...
... (all digits 0-9)
Up: 0000 006C 0000 0022 015B 00AD ...
Down: 0000 006C 0000 0022 015B 00AD ...
Left: 0000 006C 0000 0022 015B 00AD ...
Right: 0000 006C 0000 0022 015B 00AD ...
Select/OK: 0000 006C 0000 0022 015B 00AD ...
Guide: 0000 006C 0000 0022 015B 00AD ...
Menu: 0000 006C 0000 0022 015B 00AD ...
Exit: 0000 006C 0000 0022 015B 00AD ...
Last: 0000 006C 0000 0022 015B 00AD ...
Info: 0000 006C 0000 0022 015B 00AD ...
```

**Note:** Complete code database can be:
1. Downloaded from Global Caché's cloud database
2. Learned from existing remote
3. Found in remotecentral.com database

### Learning IR Codes

If you don't have codes:

```bash
# Using Global Caché iTach with learning mode

# Step 1: Put device in learning mode
curl http://192.168.1.100/api/learn

# Step 2: Point Spectrum remote at iTach
# Press button you want to learn

# Step 3: Retrieve learned code
curl http://192.168.1.100/api/code

# Returns Pronto hex code to save
```

---

## Software Implementation

### Database Schema

```sql
-- IR Device Configuration
CREATE TABLE IF NOT EXISTS IrDevice (
  id TEXT PRIMARY KEY,
  controllerIp TEXT NOT NULL,      -- e.g., 192.168.1.100
  controllerPort INTEGER NOT NULL, -- IR output port (1-8)
  deviceType TEXT NOT NULL,        -- 'cable_box', 'dvr', etc.
  matrixInputId TEXT,              -- Link to matrix input
  deviceName TEXT NOT NULL,        -- User-friendly name
  manufacturer TEXT,               -- e.g., 'Spectrum'
  model TEXT,                      -- e.g., 'HR 101'
  codeSet TEXT,                    -- IR code database reference
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (matrixInputId) REFERENCES MatrixInput(id)
);

-- IR Code Library
CREATE TABLE IF NOT EXISTS IrCode (
  id TEXT PRIMARY KEY,
  codeSetId TEXT NOT NULL,         -- Groups codes by device
  commandName TEXT NOT NULL,       -- 'channel_up', 'power', etc.
  prontoHex TEXT NOT NULL,         -- Pronto hex format code
  description TEXT,
  frequency INTEGER,               -- IR carrier frequency (Hz)
  repeatCount INTEGER DEFAULT 1,   -- How many times to send
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IR Command History (debugging)
CREATE TABLE IF NOT EXISTS IrCommandLog (
  id TEXT PRIMARY KEY,
  irDeviceId TEXT NOT NULL,
  commandName TEXT NOT NULL,
  prontoHex TEXT,
  success BOOLEAN,
  responseTime INTEGER,            -- ms
  errorMessage TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (irDeviceId) REFERENCES IrDevice(id)
);
```

### API Endpoints

#### Device Management
```typescript
// GET /api/ir/devices
// List all IR devices
Response: {
  success: boolean
  devices: Array<{
    id: string
    deviceName: string
    controllerIp: string
    controllerPort: number
    matrixInputId: string
    manufacturer: string
    model: string
    isOnline: boolean
  }>
}

// POST /api/ir/devices
// Register new IR device
Body: {
  deviceName: string
  controllerIp: string
  controllerPort: number
  matrixInputId: string
  manufacturer: string
  model: string
  codeSet: string
}

// PATCH /api/ir/devices/:id
// Update device configuration
Body: {
  deviceName?: string
  controllerIp?: string
  controllerPort?: number
  matrixInputId?: string
}

// DELETE /api/ir/devices/:id
// Remove device
```

#### Command Execution
```typescript
// POST /api/ir/command
// Send IR command
Body: {
  deviceId: string          // Or matrixInputId
  command: string           // 'channel_up', 'digit_5', etc.
  repeat?: number           // Number of times to send (default: 1)
}

Response: {
  success: boolean
  executionTime: number
  commandSent: string
  error?: string
}

// POST /api/ir/command/sequence
// Send sequence of commands with delays
Body: {
  deviceId: string
  commands: Array<{
    command: string
    delayAfter?: number   // ms delay before next command
  }>
}

Example - Direct channel entry (channel 105):
{
  "deviceId": "cable-box-1",
  "commands": [
    { "command": "digit_1", "delayAfter": 100 },
    { "command": "digit_0", "delayAfter": 100 },
    { "command": "digit_5", "delayAfter": 100 }
  ]
}
```

#### Code Management
```typescript
// GET /api/ir/codes/:codeSetId
// Get all codes for a device
Response: {
  success: boolean
  codeSet: string
  codes: Array<{
    commandName: string
    prontoHex: string
    description: string
  }>
}

// POST /api/ir/codes/learn
// Learn new IR code from remote
Body: {
  codeSetId: string
  commandName: string
  description?: string
}

// Response includes learned code
Response: {
  success: boolean
  commandName: string
  prontoHex: string
}
```

#### Diagnostics
```typescript
// GET /api/ir/test/:deviceId
// Test IR device connectivity and responsiveness
Response: {
  success: boolean
  controllerOnline: boolean
  lastCommandSuccess: boolean
  averageLatency: number
}

// POST /api/ir/blast-test/:deviceId
// Send test command to verify IR placement
Body: {
  command: string  // Usually 'power' or 'channel_up'
}
```

### Node.js Implementation

```typescript
// src/lib/ir-controller.ts

import axios from 'axios'
import { logger } from './logger'

export interface IrDevice {
  id: string
  controllerIp: string
  controllerPort: number
  deviceName: string
}

export interface IrCommand {
  commandName: string
  prontoHex: string
  repeat?: number
}

export class IrController {
  private devices: Map<string, IrDevice> = new Map()

  // Register IR device
  registerDevice(device: IrDevice): void {
    this.devices.set(device.id, device)
    logger.info(`Registered IR device: ${device.deviceName}`)
  }

  // Send IR command via Global Caché iTach
  async sendCommand(
    deviceId: string,
    command: IrCommand
  ): Promise<{ success: boolean; error?: string }> {
    const device = this.devices.get(deviceId)
    if (!device) {
      return { success: false, error: 'Device not found' }
    }

    try {
      const startTime = Date.now()

      // Global Caché iTach API format
      // sendir,<module>:<port>,<ID>,<frequency>,<repeat>,<offset>,<data>
      const repeat = command.repeat || 1
      const irCommand = `sendir,1:${device.controllerPort},1,${command.prontoHex},${repeat}`

      // Send to iTach via HTTP
      const response = await axios.post(
        `http://${device.controllerIp}/api/command`,
        { command: irCommand },
        { timeout: 5000 }
      )

      const executionTime = Date.now() - startTime

      logger.debug(`IR command sent to ${device.deviceName}: ${command.commandName} (${executionTime}ms)`)

      return {
        success: response.status === 200,
        executionTime
      }
    } catch (error) {
      logger.error(`Failed to send IR command to ${device.deviceName}:`, error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  // Send command sequence with delays
  async sendSequence(
    deviceId: string,
    commands: Array<{ command: IrCommand; delayAfter?: number }>
  ): Promise<{ success: boolean; failedCommands?: number }> {
    let failedCount = 0

    for (const cmd of commands) {
      const result = await this.sendCommand(deviceId, cmd.command)
      if (!result.success) {
        failedCount++
      }

      // Wait before next command
      if (cmd.delayAfter) {
        await new Promise(resolve => setTimeout(resolve, cmd.delayAfter))
      }
    }

    return {
      success: failedCount === 0,
      failedCommands: failedCount
    }
  }

  // Common command shortcuts
  async channelUp(deviceId: string): Promise<boolean> {
    const result = await this.sendCommand(deviceId, {
      commandName: 'channel_up',
      prontoHex: await this.getCode(deviceId, 'channel_up')
    })
    return result.success
  }

  async channelDown(deviceId: string): Promise<boolean> {
    const result = await this.sendCommand(deviceId, {
      commandName: 'channel_down',
      prontoHex: await this.getCode(deviceId, 'channel_down')
    })
    return result.success
  }

  async sendDigit(deviceId: string, digit: number): Promise<boolean> {
    if (digit < 0 || digit > 9) return false

    const result = await this.sendCommand(deviceId, {
      commandName: `digit_${digit}`,
      prontoHex: await this.getCode(deviceId, `digit_${digit}`)
    })
    return result.success
  }

  async tuneChannel(deviceId: string, channel: string): Promise<boolean> {
    const digits = channel.split('')
    const commands = digits.map(d => ({
      command: {
        commandName: `digit_${d}`,
        prontoHex: await this.getCode(deviceId, `digit_${d}`)
      },
      delayAfter: 100 // 100ms between digits
    }))

    const result = await this.sendSequence(deviceId, commands)
    return result.success
  }

  async power(deviceId: string): Promise<boolean> {
    const result = await this.sendCommand(deviceId, {
      commandName: 'power',
      prontoHex: await this.getCode(deviceId, 'power')
    })
    return result.success
  }

  async guide(deviceId: string): Promise<boolean> {
    const result = await this.sendCommand(deviceId, {
      commandName: 'guide',
      prontoHex: await this.getCode(deviceId, 'guide')
    })
    return result.success
  }

  // Get IR code from database
  private async getCode(deviceId: string, commandName: string): Promise<string> {
    // This would query your database
    // For now, placeholder
    return '0000 006C 0000 0022 015B 00AD ...'
  }
}

// Export singleton instance
export const irController = new IrController()
```

### API Route Implementation

```typescript
// src/app/api/ir/command/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { irController } from '@/lib/ir-controller'
import { logger } from '@/lib/logger'
import { findFirst } from '@/lib/db-helpers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId, command, repeat } = body

    if (!deviceId || !command) {
      return NextResponse.json(
        { success: false, error: 'Missing deviceId or command' },
        { status: 400 }
      )
    }

    // Get device from database
    const device = await findFirst('irDevices', {
      where: { id: deviceId }
    })

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found' },
        { status: 404 }
      )
    }

    // Get IR code from database
    const code = await findFirst('irCodes', {
      where: {
        codeSetId: device.codeSet,
        commandName: command
      }
    })

    if (!code) {
      return NextResponse.json(
        { success: false, error: `Command '${command}' not found` },
        { status: 404 }
      )
    }

    // Send IR command
    const result = await irController.sendCommand(deviceId, {
      commandName: command,
      prontoHex: code.prontoHex,
      repeat: repeat || 1
    })

    // Log command
    await insert('irCommandLogs', {
      irDeviceId: deviceId,
      commandName: command,
      prontoHex: code.prontoHex,
      success: result.success,
      responseTime: result.executionTime,
      errorMessage: result.error
    })

    return NextResponse.json({
      success: result.success,
      executionTime: result.executionTime,
      error: result.error
    })
  } catch (error: any) {
    logger.error('Error sending IR command:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

---

## Installation Procedure

### Step 1: Hardware Setup

#### Install IR Controller

1. **Mount iTach unit**
   - Near server rack or in network closet
   - Ensure network cable access
   - Power via included adapter

2. **Network Configuration**
   ```bash
   # Access iTach web interface
   # Default IP: 192.168.1.70 (or use GC tool to find it)

   # Set static IP
   http://192.168.1.70
   # Network Settings → Static IP → 192.168.1.100

   # Test connectivity
   ping 192.168.1.100
   curl http://192.168.1.100/api/version
   ```

#### Install IR Emitters (per HR 101)

1. **Primary emitter (Port 1 for Box 1):**
   ```
   Location: Front panel, lower-right
   Distance: 1-2" from right edge

   - Clean surface with alcohol
   - Remove adhesive backing
   - Position carefully
   - Press firmly for 10 seconds
   ```

2. **Secondary emitter (if using dual setup):**
   ```
   Location: Top panel, center-front
   Distance: 1" from front edge

   - Use Y-splitter on iTach port
   - Route cable to top of box
   - Stick emitter firmly
   ```

3. **Cable routing:**
   ```
   - Run 3.5mm cable along back of rack
   - Label each cable (Box 1, Box 2, etc.)
   - Secure with velcro ties
   - Keep organized
   ```

4. **Repeat for remaining boxes:**
   ```
   Box 2 → iTach Port 2
   Box 3 → iTach Port 3 (or use Y-splitter)
   Box 4 → iTach Port 4 (or use Y-splitter)
   ```

### Step 2: Test IR Communication

```bash
# Test each cable box

# Box 1 (Port 1) - Send Channel Up
curl -X POST http://192.168.1.100/api/command \
  -d 'sendir,1:1,1,38000,1,1,342,171,...' # Full Pronto code

# Watch cable box - channel should change

# Test all commands:
# - Channel Up/Down
# - Digits 0-9
# - Guide
# - Power
# - Navigation (Up/Down/Left/Right/Select)

# Document success rate:
# Try each command 10 times
# Should have 90%+ success rate
# If < 90%, adjust emitter placement
```

### Step 3: Database Setup

```bash
# Access database
sqlite3 /home/ubuntu/sports-bar-data/production.db

# Create tables (if not exists)
# Run migrations from schema section above

# Load IR code database
# Option A: Import from CSV
.mode csv
.import spectrum_hr101_codes.csv IrCode

# Option B: Manual entry for testing
INSERT INTO IrCode (id, codeSetId, commandName, prontoHex, description)
VALUES
  ('ir-code-1', 'spectrum-hr101', 'channel_up', '0000 006C 0000 0022 ...', 'Channel Up'),
  ('ir-code-2', 'spectrum-hr101', 'channel_down', '0000 006C 0000 0022 ...', 'Channel Down'),
  ('ir-code-3', 'spectrum-hr101', 'digit_0', '0000 006C 0000 0022 ...', 'Number 0'),
  -- ... etc

# Register IR devices
INSERT INTO IrDevice (id, controllerIp, controllerPort, deviceType, matrixInputId, deviceName, manufacturer, model, codeSet)
VALUES
  ('ir-dev-1', '192.168.1.100', 1, 'cable_box', 'input-1', 'Cable Box 1', 'Spectrum', 'HR 101', 'spectrum-hr101'),
  ('ir-dev-2', '192.168.1.100', 2, 'cable_box', 'input-2', 'Cable Box 2', 'Spectrum', 'HR 101', 'spectrum-hr101'),
  ('ir-dev-3', '192.168.1.100', 3, 'cable_box', 'input-3', 'Cable Box 3', 'Spectrum', 'HR 101', 'spectrum-hr101'),
  ('ir-dev-4', '192.168.1.100', 4, 'cable_box', 'input-4', 'Cable Box 4', 'Spectrum', 'HR 101', 'spectrum-hr101');
```

### Step 4: Software Integration

```bash
# Install in project
cd /home/ubuntu/Sports-Bar-TV-Controller

# Create IR controller library
# (Code from implementation section above)

# Create API endpoints
# (Code from API section above)

# Rebuild and restart
npm run build
PORT=3001 pm2 restart sports-bar-tv-controller
```

### Step 5: UI Integration

Add IR controls to TV control interface:

```tsx
// src/components/CableBoxControls.tsx

export default function CableBoxControls({ inputId }: { inputId: string }) {
  const sendCommand = async (command: string) => {
    const response = await fetch('/api/ir/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: `ir-dev-${inputId}`,
        command
      })
    })
    const result = await response.json()
    if (!result.success) {
      alert(`Command failed: ${result.error}`)
    }
  }

  const sendChannel = async (channel: string) => {
    // Send sequence of digits
    const digits = channel.split('')
    for (const digit of digits) {
      await sendCommand(`digit_${digit}`)
      await new Promise(r => setTimeout(r, 100))
    }
  }

  return (
    <div className="cable-box-controls">
      {/* Channel direct entry */}
      <div className="channel-input">
        <input
          type="text"
          placeholder="Channel #"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              sendChannel(e.currentTarget.value)
            }
          }}
        />
      </div>

      {/* Quick channel buttons */}
      <div className="quick-channels">
        <button onClick={() => sendChannel('702')}>ESPN (702)</button>
        <button onClick={() => sendChannel('703')}>ESPN2 (703)</button>
        <button onClick={() => sendChannel('705')}>FS1 (705)</button>
      </div>

      {/* Numeric keypad */}
      <div className="keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
          <button key={num} onClick={() => sendCommand(`digit_${num}`)}>
            {num}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="navigation">
        <button onClick={() => sendCommand('up')}>▲</button>
        <button onClick={() => sendCommand('down')}>▼</button>
        <button onClick={() => sendCommand('left')}>◀</button>
        <button onClick={() => sendCommand('right')}>▶</button>
        <button onClick={() => sendCommand('select')}>OK</button>
      </div>

      {/* Common functions */}
      <div className="functions">
        <button onClick={() => sendCommand('guide')}>Guide</button>
        <button onClick={() => sendCommand('menu')}>Menu</button>
        <button onClick={() => sendCommand('exit')}>Exit</button>
        <button onClick={() => sendCommand('info')}>Info</button>
        <button onClick={() => sendCommand('last')}>Last</button>
      </div>

      {/* Channel Up/Down */}
      <div className="channel-controls">
        <button onClick={() => sendCommand('channel_up')}>CH ▲</button>
        <button onClick={() => sendCommand('channel_down')}>CH ▼</button>
      </div>
    </div>
  )
}
```

---

## Troubleshooting Guide

### Issue: Commands Not Working

**Symptoms:**
- IR commands sent but cable box doesn't respond
- Intermittent response (works sometimes)

**Solutions:**

1. **Verify IR emitter placement**
   ```bash
   # Use phone camera to see if IR emitter is working
   # Point camera at emitter
   # Send test command via API
   # Should see purple/pink light flashing
   ```

2. **Check IR controller connectivity**
   ```bash
   ping 192.168.1.100
   curl http://192.168.1.100/api/version
   ```

3. **Test with direct iTach command**
   ```bash
   # Bypass app, test iTach directly
   curl -X POST http://192.168.1.100/api/command \
     -d 'sendir,1:1,1,38000,1,1,342,171,...'
   ```

4. **Verify IR code is correct**
   - Try different code from database
   - Re-learn code from working remote
   - Check frequency (should be 38kHz for Spectrum)

5. **Adjust emitter position**
   - Move 1/4" at a time
   - Test after each adjustment
   - Try dual-emitter setup

### Issue: HR 101 Specific - Poor Response

**Symptoms:**
- Works sometimes, misses commands frequently
- Success rate < 80%

**Solutions:**

1. **Add second emitter (top panel)**
   - Use Y-splitter on iTach port
   - Place second emitter on top of box
   - Improves to 95%+ reliability

2. **Use higher power emitters**
   - Replace with Xantech 284M "Dinky Link"
   - Or Infrared Resources "Hidden Link"
   - These penetrate recessed sensors better

3. **Try IR chamber technique**
   - Cover front panel with black tape
   - Creates reflective chamber
   - See "IR Chamber Technique" section above

4. **Increase repeat count**
   ```typescript
   await sendCommand(deviceId, {
     commandName: 'channel_up',
     prontoHex: code,
     repeat: 2  // Send twice
   })
   ```

### Issue: Wrong Device Responding

**Symptoms:**
- Send command to Box 1, Box 2 changes channel
- IR "bleeding" to other devices

**Solutions:**

1. **Shield emitters**
   - Ensure emitters only point at their box
   - Use black tape to create directional shield
   - Keep emitters against box surface

2. **Increase physical separation**
   - Move cable boxes farther apart (if possible)
   - Turn boxes so they don't face each other

3. **Reduce IR power**
   - If using adjustable controller
   - Lower power just enough to reach sensor
   - Reduces IR scatter

### Issue: High Latency

**Symptoms:**
- Commands take > 500ms to execute
- Noticeable delay when changing channels

**Solutions:**

1. **Check network latency**
   ```bash
   ping 192.168.1.100
   # Should be < 10ms
   ```

2. **Verify iTach not overloaded**
   - Don't send commands too rapidly
   - Add 100ms delay between commands
   - Queue commands if needed

3. **Optimize code**
   - Cache Pronto hex codes
   - Don't query database for every command
   - Use in-memory lookup

### Issue: iTach Not Responding

**Symptoms:**
- Cannot reach iTach at IP address
- Timeout errors

**Solutions:**

1. **Verify power**
   - Check power adapter connected
   - iTach LED should be on

2. **Network configuration**
   ```bash
   # Use Global Caché iHelp tool (Windows/Mac)
   # Or iTest app (iOS/Android)
   # Scan network for iTach
   # Reset to factory defaults if needed
   ```

3. **Factory reset**
   - Hold button on unit for 10 seconds
   - Will reset to default IP (192.168.1.70)
   - Reconfigure network settings

---

## Performance Benchmarks

### Expected Performance

| Metric | Target | Acceptable | Problem |
|--------|--------|------------|---------|
| Command Success Rate | 95%+ | 90%+ | <90% |
| Command Latency | <200ms | <500ms | >500ms |
| Channel Tune Time (3 digits) | <1s | <2s | >2s |
| System Uptime | 99%+ | 95%+ | <95% |

### Optimization Tips

1. **Cache IR codes in memory**
   - Don't query database for every command
   - Load all codes on startup

2. **Queue commands per device**
   - Don't send multiple commands simultaneously to same box
   - Serialize commands with delays

3. **Pre-warm connections**
   - Keep HTTP connection to iTach alive
   - Use connection pooling

4. **Monitor and log**
   - Track command success rates
   - Alert if success rate drops below 90%
   - Log latency for performance tuning

---

## Maintenance & Support

### Regular Maintenance

**Weekly:**
- [ ] Verify all cable boxes responding to IR
- [ ] Check command logs for failures
- [ ] Test channel changes on all boxes

**Monthly:**
- [ ] Clean cable box surfaces (dust can block IR)
- [ ] Check emitter adhesive (re-stick if loose)
- [ ] Verify iTach firmware up to date
- [ ] Review command success rate statistics

**Annually:**
- [ ] Replace IR emitters (preventive)
- [ ] Test all IR codes after cable box updates
- [ ] Backup IR code database
- [ ] Review and optimize IR placement

### Spare Parts

Keep on hand:
- 2x spare IR emitters (Xantech 284M)
- 1x spare 3.5mm cable
- 1x spare Y-splitter
- Alcohol wipes for surface cleaning
- Black electrical tape (for IR chamber)

### Getting IR Codes

If you need codes for different devices:

1. **remotecentral.com** - Huge IR code database
2. **Global Caché Cloud** - Built-in to iTach
3. **Learn from remote** - Use iTach learning mode
4. **LIRC Database** - Open-source IR codes
5. **Manufacturer** - Sometimes provides codes

---

## Cost-Benefit Analysis

### Total Cost of Ownership (3 Years)

| Component | Initial | Annual | 3-Year Total |
|-----------|---------|--------|--------------|
| **IR Setup** |
| Hardware | $234 | - | $234 |
| Installation | $100* | - | $100 |
| Emitter replacement | - | $30 | $90 |
| **Total IR** | | | **$424** |
| | | | |
| **CEC Setup** |
| Hardware | $410 | - | $410 |
| Installation | $150* | - | $150 |
| Adapter replacement | - | $50 | $150 |
| **Total CEC** | | | **$710** |

*Installation cost assumes DIY/self-install

### ROI Considerations

**IR Advantages:**
- Lower upfront cost ($234 vs $410)
- Lower 3-year cost ($424 vs $710)
- Easier troubleshooting/maintenance
- Works with any cable box
- Proven reliability in commercial settings

**CEC Advantages:**
- No emitter placement issues
- Digital vs analog (cleaner)
- Better for DVR playback control
- May work better with future boxes

**Recommendation for Sports Bar:**
Start with IR for cable boxes. If you later need DVR control or find specific boxes work better with CEC, you can add CEC adapters for those specific devices. The two systems can coexist.

---

## Future Enhancements

### Planned Features

1. **Auto-tune on source switch**
   - Pre-tune channel when input selected
   - Reduce channel change time for customers

2. **Favorite channels**
   - One-touch access to common sports channels
   - ESPN, ESPN2, FS1, FS2, NFL Network, etc.

3. **Schedule integration**
   - Auto-tune channels for scheduled events
   - "Tune all boxes to ESPN for Monday Night Football"

4. **Voice control via AI assistant**
   - "Change channel 3 to ESPN"
   - "Show guide on TV 5"

5. **IR health monitoring**
   - Track command success rates per device
   - Alert when device needs attention
   - Predict emitter failures

6. **Learning mode UI**
   - Admin can learn new codes via web interface
   - Point remote at sensor, click button
   - Code saved to database

### Integration Possibilities

- **Mobile app:** Remote IR control from phone
- **Slack/Teams bot:** "Set all TVs to channel 702"
- **Web hooks:** Trigger channel changes from external systems
- **EPG integration:** Display what's playing on each channel

---

## Deployment Timeline

### Phase 1: Proof of Concept (1 box)
**Time:** 2-4 hours
- [ ] Order hardware (iTach + 2 emitters)
- [ ] Install and test with 1 cable box
- [ ] Verify IR placement and reliability
- [ ] Document findings

### Phase 2: Software Development
**Time:** 8-12 hours
- [ ] Database schema and migrations
- [ ] IR controller library
- [ ] API endpoints
- [ ] Admin configuration UI
- [ ] Cable box control UI components
- [ ] Testing and debugging

### Phase 3: Hardware Expansion
**Time:** 2-3 hours
- [ ] Install emitters on remaining 3 boxes
- [ ] Test each box individually
- [ ] Optimize placements
- [ ] Document final positions

### Phase 4: Integration & Testing
**Time:** 4-6 hours
- [ ] Full system testing
- [ ] UI/UX refinement
- [ ] Performance tuning
- [ ] User acceptance testing
- [ ] Documentation

**Total Estimated Time:** 16-25 hours
**Recommended Approach:** Phase 1 first, validate approach, then proceed

---

## Conclusion

IR control via network-controlled distribution provides a reliable, cost-effective solution for cable box control in sports bar environments. The dual-emitter approach specifically addresses the Spectrum HR 101 World Box's challenging IR sensor design, achieving 95%+ reliability.

**Key Success Factors:**
1. ✅ Use dual emitters for HR 101 boxes (front + top)
2. ✅ Choose quality emitters (Xantech 284M recommended)
3. ✅ Proper placement is critical (test before permanent installation)
4. ✅ Monitor success rates and adjust as needed
5. ✅ Keep spare emitters on hand

**Recommended Next Steps:**
1. Order hardware (Global Caché iTach + emitters)
2. Test with single cable box (proof of concept)
3. If successful, proceed with software development
4. Expand to remaining boxes
5. Refine based on real-world usage

**Questions?** Refer to troubleshooting section or contact development team.

---

## Additional Resources

### Vendor Support
- **Global Caché:** https://www.globalcache.com/support
- **Xantech:** https://www.xantech.com/support
- **remotecentral.com:** IR code database

### Internal Documentation
- See also: `CEC_CABLE_BOX_CONTROL.md` (CEC alternative)
- See also: `DIRECTV_INTEGRATION.md`
- See also: `WOLFPACK_MATRIX_INTEGRATION.md`

### IR Learning Resources
- LIRC project: https://www.lirc.org/
- Pronto hex format specification
- Global Caché API documentation

---

---

## IR Learning System (NEW)

### Overview

The Sports Bar TV Controller now includes a comprehensive IR learning system that allows you to capture IR codes directly from your Spectrum remote control using the Global Cache iTach IP2IR.

### Quick Start

1. **Navigate to IR Learning Page**
   ```
   http://your-server:3001/ir-learning
   ```

2. **Select Device**
   - Choose the cable box you want to program
   - Verify iTach IP address (default: 192.168.1.100)
   - Select IR port (1-3)

3. **Learn Buttons**
   - Click "Learn" for any button
   - Point Spectrum remote at iTach IR sensor
   - Press the corresponding button on the remote
   - Wait for "Captured!" confirmation
   - Click "Test" to verify the code works

4. **Save Codes**
   - Learn all required buttons
   - Click "Save All Codes" to persist to database
   - Export codes for backup/sharing

### Supported Buttons

The IR learning system supports all standard Spectrum cable box buttons:

**Power**
- Power on/off

**Numbers**
- Digits 0-9

**Navigation**
- Up, Down, Left, Right
- Select/OK

**Functions**
- Guide, Menu, Info, Exit, Last

**Channel Control**
- Channel Up/Down

**DVR Control**
- Play, Pause, Rewind, Fast Forward
- Record, Stop

**Volume (Optional)**
- Volume Up/Down, Mute

### Import/Export Codes

**Export Codes:**
- Click "Export" button to download JSON file
- File contains all learned IR codes
- Use for backup or sharing between devices

**Import Codes:**
- Click "Import" button
- Select previously exported JSON file
- All codes will be loaded into the selected device

### Testing Learned Codes

After learning each button:

1. Click the "Test" button (test tube icon)
2. The system will send the learned IR code back to the cable box
3. Verify the cable box responds correctly
4. If the code doesn't work:
   - Re-learn the button
   - Check IR emitter placement
   - Verify iTach connection

### IR Learning Best Practices

**Optimal Learning Environment:**
- Avoid bright lights (fluorescent, direct sunlight)
- Position remote 6-12 inches from iTach sensor
- Point remote directly at iTach
- Press button firmly and hold for 1 second
- Wait for confirmation before releasing

**Troubleshooting Learning Issues:**

1. **"Timeout waiting for button press"**
   - Press button more firmly
   - Hold button longer (1-2 seconds)
   - Move remote closer to iTach
   - Check iTach LED is flashing (learning mode)

2. **"IR Learner unavailable"**
   - iTach may be in LED mode (not IR mode)
   - Reboot iTach device
   - Verify network connection
   - Try different IR port

3. **Learned code doesn't work**
   - Re-learn the button
   - Try learning from different distance
   - Verify IR emitter is properly positioned
   - Check cable box model matches

### Automatic IR Code Selection

The CableBoxRemote component now automatically uses learned IR codes:

**Priority Order:**
1. **Learned IR codes** (highest priority)
   - Uses codes captured via IR learning system
   - Most reliable for your specific remote
2. **Pre-programmed IR codes** (fallback)
   - Uses generic Spectrum codes if available
3. **CEC control** (fallback)
   - Uses CEC if IR codes not available

This ensures maximum compatibility and reliability across different Spectrum cable box models.

### Database Storage

Learned IR codes are stored in the `IRDevice` table:

```sql
-- IR codes stored as JSON in irCodes field
{
  "power": "sendir,1:1,1,38000,1,1,342,171,...",
  "channel_up": "sendir,1:1,1,38000,1,1,342,171,...",
  "digit_0": "sendir,1:1,1,38000,1,1,342,171,...",
  ...
}
```

### Related Documentation

- **IR Emitter Placement Guide:** `/docs/IR_EMITTER_PLACEMENT_GUIDE.md`
- **API Documentation:** `/docs/API_REFERENCE.md`
- **Cable Box Setup:** See "Installation Procedure" section above

---

**Document Version:** 2.0
**Last Updated:** November 4, 2025
**Author:** Sports Bar TV Controller Development Team
