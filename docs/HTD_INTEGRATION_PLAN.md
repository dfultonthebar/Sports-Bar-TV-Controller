# HTD Audio System Integration Plan

## Overview

This document outlines the implementation plan for adding HTD (Home Theater Direct) whole-house audio system control to the Sports Bar TV Controller.

## HTD Product Lines Supported

| Product | Zones | Connection Methods |
|---------|-------|-------------------|
| MC-66/MCA-66 | 6 | TCP via Gateway, RS-232 |
| Lync 6 v3 | 6 | TCP via Gateway (WGW-SLX), RS-232, WebSocket |
| Lync 12 v3 | 12 | TCP via Gateway (WGW-SLX), RS-232, WebSocket |

## Protocol Documentation

### Official Resources
- [MCA-66/MC-66 Hex Codes PDF](https://www.htd.com/site/ownersmanual/mca66_mc66_hex_codes.pdf)
- [Lync Hex Codes PDF](https://www.htd.com/site/ownersmanual/lync_hex_codes.pdf)
- [HTD Downloads Page](https://www.htd.com/downloads)

### Existing Open Source Implementations
- [htd-home-assistant](https://github.com/hikirsch/htd-home-assistant) - Home Assistant integration
- [htd-lync](https://github.com/dustinmcintire/htd-lync) - Python library for Lync
- [htd-mca-66-api](https://github.com/lounsbrough/htd-mca-66-api) - PHP REST API

---

## Protocol Specification

### Command Format (MCA-66/MC-66)

Binary command structure (6 bytes):
```
Byte 0: 0x02 (start byte)
Byte 1: 0x00 (constant)
Byte 2: Zone (1-6 for MCA-66, 1-12 for Lync)
Byte 3: Command Code
Byte 4: Data Code
Byte 5: Checksum (sum of bytes 0-4, masked to 1 byte)
```

### Command Codes

| Command Code | Description |
|-------------|-------------|
| 0x04 | Control command |
| 0x06 | Query zone states |

### Data Codes (for Command Code 0x04)

| Data Code | Function |
|-----------|----------|
| 0x03-0x08 | Set Source 1-6 |
| 0x09 | Volume Up |
| 0x0A | Volume Down |
| 0x20 (32) | Power On (single zone) |
| 0x21 (33) | Power Off (single zone) |
| 0x22 (34) | Mute Toggle |
| 0x26 (38) | Bass Up |
| 0x27 (39) | Bass Down |
| 0x28 (40) | Treble Up |
| 0x29 (41) | Treble Down |
| 0x2A (42) | Balance Right |
| 0x2B (43) | Balance Left |
| 0x38 (56) | Power On (all zones) |
| 0x39 (57) | Power Off (all zones) |

### Example Command: Power On Zone 1
```
0x02 0x00 0x01 0x04 0x20 0x27
│    │    │    │    │    └── Checksum (0x02+0x00+0x01+0x04+0x20 = 0x27)
│    │    │    │    └── Data: Power On single zone
│    │    │    └── Command: Control
│    │    └── Zone 1
│    └── Constant
└── Start byte
```

### Volume Conversion
- Controller raw range: 196-256 (0 wraps to 256)
- Percentage range: 0-100%
- To percentage: `percent = round((raw - 196) / 60 * 100)`
- To raw: `raw = round(percent / 100 * 60 + 196) % 256`

### Gateway Connection
- **WGW-SLX**: Current network gateway (required for voice/automation)
- **Default TCP Port**: Configurable (typically 8000 or custom)
- **RS-232**: 57600 baud, 8N1 (for direct serial connection)

---

## Package Architecture

### Directory Structure
```
packages/htd/
├── src/
│   ├── index.ts                    # Main exports
│   ├── types.ts                    # TypeScript interfaces
│   ├── config.ts                   # Protocol constants, model configs
│   ├── htd-tcp-client.ts           # TCP socket client
│   ├── htd-serial-client.ts        # RS-232 serial client
│   ├── htd-control-service.ts      # High-level control service
│   └── htd-protocol.ts             # Command encoding/decoding
├── package.json
├── tsconfig.json
└── README.md
```

### Type Definitions (`types.ts`)

```typescript
export type HTDModel = 'MC-66' | 'MCA-66' | 'Lync6' | 'Lync12';

export interface HTDModelConfig {
  name: string;
  zones: number;
  sources: number;
  hasBluetooth: boolean;
  supportsWebSocket: boolean;
}

export interface HTDDeviceConfig {
  id: string;
  name: string;
  model: HTDModel;
  connectionType: 'tcp' | 'serial';
  // TCP settings
  ipAddress?: string;
  port?: number;
  // Serial settings
  serialPort?: string;
  baudRate?: number;
}

export interface HTDZoneState {
  zone: number;
  power: boolean;
  muted: boolean;
  volume: number;      // 0-100%
  rawVolume: number;   // 196-256
  source: number;      // 1-6
  bass: number;        // -7 to +7
  treble: number;      // -7 to +7
  balance: number;     // -7 to +7 (- = left, + = right)
}

export interface HTDCommand {
  zone: number;
  commandCode: number;
  dataCode: number;
}

export interface HTDControlEvents {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  zoneUpdate: (state: HTDZoneState) => void;
}
```

### Protocol Implementation (`htd-protocol.ts`)

```typescript
export const HTD_COMMANDS = {
  QUERY_ZONES: 0x06,
  CONTROL: 0x04,
} as const;

export const HTD_DATA = {
  SOURCE_BASE: 0x02,  // Source N = 0x02 + N
  VOLUME_UP: 0x09,
  VOLUME_DOWN: 0x0A,
  POWER_ON_ZONE: 0x20,
  POWER_OFF_ZONE: 0x21,
  MUTE_TOGGLE: 0x22,
  BASS_UP: 0x26,
  BASS_DOWN: 0x27,
  TREBLE_UP: 0x28,
  TREBLE_DOWN: 0x29,
  BALANCE_RIGHT: 0x2A,
  BALANCE_LEFT: 0x2B,
  POWER_ON_ALL: 0x38,
  POWER_OFF_ALL: 0x39,
} as const;

export function buildCommand(zone: number, cmd: number, data: number): Buffer {
  const bytes = [0x02, 0x00, zone, cmd, data];
  const checksum = bytes.reduce((sum, b) => sum + b, 0) & 0xFF;
  return Buffer.from([...bytes, checksum]);
}

export function parseZoneState(data: Buffer, zone: number): HTDZoneState {
  // Parse 14-byte zone response
  // Implementation based on protocol spec
}

export function volumeToPercent(raw: number): number {
  const adjusted = raw === 0 ? 256 : raw;
  return Math.max(0, Math.min(100, Math.round((adjusted - 196) / 60 * 100)));
}

export function percentToVolume(percent: number): number {
  const raw = Math.round(percent / 100 * 60 + 196);
  return Math.max(196, Math.min(256, raw)) % 256;
}
```

### Control Service (`htd-control-service.ts`)

```typescript
export class HTDControlService extends EventEmitter {
  private client: HTDTcpClient | HTDSerialClient | null = null;
  private zoneStates: Map<number, HTDZoneState> = new Map();
  private config: HTDDeviceConfig;

  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  isConnected(): boolean;

  // Zone Control
  async setZonePower(zone: number, on: boolean): Promise<void>;
  async setAllZonesPower(on: boolean): Promise<void>;
  async volumeUp(zone: number): Promise<void>;
  async volumeDown(zone: number): Promise<void>;
  async setVolume(zone: number, percent: number): Promise<void>;
  async toggleMute(zone: number): Promise<void>;
  async setSource(zone: number, source: number): Promise<void>;

  // Tone Control
  async bassUp(zone: number): Promise<void>;
  async bassDown(zone: number): Promise<void>;
  async trebleUp(zone: number): Promise<void>;
  async trebleDown(zone: number): Promise<void>;
  async balanceLeft(zone: number): Promise<void>;
  async balanceRight(zone: number): Promise<void>;

  // State Query
  async refreshZoneStates(): Promise<HTDZoneState[]>;
  getZoneState(zone: number): HTDZoneState | undefined;
}

// Service Factory (connection pooling)
const activeServices: Map<string, HTDControlService> = new Map();

export function getHTDService(config: HTDDeviceConfig): HTDControlService;
export function disconnectHTDService(deviceId: string): void;
export function disconnectAllHTDServices(): void;
```

---

## Database Schema

No schema changes required. Uses existing `audioProcessors` table with:

```typescript
{
  processorType: 'htd',  // New processor type
  model: 'Lync12' | 'Lync6' | 'MCA-66' | 'MC-66',
  connectionType: 'ethernet' | 'rs232',
  ipAddress: string,     // For TCP
  port: number,          // Default: 8000
  serialPort: string,    // For RS-232 (e.g., /dev/ttyUSB0)
  baudRate: 57600,       // RS-232 baud rate
  zones: 6 | 12,         // Based on model
}
```

---

## API Routes

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/htd` | List all HTD devices |
| POST | `/api/htd` | Create HTD device |
| GET | `/api/htd/[id]` | Get device details |
| PUT | `/api/htd/[id]` | Update device config |
| DELETE | `/api/htd/[id]` | Delete device |
| POST | `/api/htd/[id]/test` | Test connection |
| GET | `/api/htd/[id]/zones` | Get all zone states |
| POST | `/api/htd/control` | Zone control commands |

### Control Endpoint Schema

```typescript
// POST /api/htd/control
{
  deviceId: string;
  command: 'power' | 'powerAll' | 'volumeUp' | 'volumeDown'
         | 'setVolume' | 'mute' | 'setSource'
         | 'bassUp' | 'bassDown' | 'trebleUp' | 'trebleDown'
         | 'balanceLeft' | 'balanceRight';
  zone?: number;      // 1-12 (required except for powerAll)
  value?: number;     // For setVolume (0-100), setSource (1-6)
}
```

---

## UI Components

### HTD Device Manager
Location: `apps/web/src/components/HTDManager.tsx`

Features:
- Add/edit/delete HTD devices
- Model selection (MC-66, MCA-66, Lync 6, Lync 12)
- Connection type toggle (TCP/Serial)
- Connection test functionality

### HTD Zone Control
Location: `apps/web/src/components/HTDZoneControl.tsx`

Features:
- Zone grid showing all zones
- Power on/off per zone and all zones
- Volume slider with real-time feedback
- Source selector dropdown
- Mute toggle
- Bass/treble/balance controls (expandable)

---

## Implementation Phases

### Phase 1: Core Package (packages/htd)
- [ ] Create package structure
- [ ] Implement protocol encoding/decoding
- [ ] Implement TCP client
- [ ] Implement control service
- [ ] Add unit tests

### Phase 2: Serial Support
- [ ] Implement serial client
- [ ] Test with actual RS-232 connection
- [ ] Handle serial port detection

### Phase 3: API Routes
- [ ] Create CRUD endpoints
- [ ] Create control endpoint
- [ ] Add validation schemas
- [ ] Add rate limiting

### Phase 4: UI Components
- [ ] Create HTDManager component
- [ ] Create HTDZoneControl component
- [ ] Add to Audio Processors section in Device Config

### Phase 5: Integration
- [ ] Add HTD to AudioProcessorManager
- [ ] Update documentation
- [ ] End-to-end testing

---

## Testing Strategy

### Unit Tests
- Protocol encoding/decoding
- Volume conversion formulas
- Command building
- Response parsing

### Integration Tests
- TCP connection to mock server
- Serial port communication
- Service lifecycle management

### Hardware Tests
- Real device connection
- Zone control verification
- State polling accuracy

---

## References

- HTD Official Downloads: https://www.htd.com/downloads
- htd_client Python package (used by Home Assistant integration)
- Community forums: AVS Forum, CocoonTech

---

## Estimated Effort

| Phase | Scope |
|-------|-------|
| Phase 1 | Core package implementation |
| Phase 2 | Serial support |
| Phase 3 | API routes |
| Phase 4 | UI components |
| Phase 5 | Integration and testing |

---

## Notes

1. **Gateway Requirement**: For network control, the WGW-SLX gateway is required. Direct serial connection bypasses this.

2. **Command Delay**: The controller can be overwhelmed by rapid commands. Implement a default delay of 100ms between commands.

3. **Volume Steps**: Volume can only be adjusted incrementally (up/down). To set an absolute volume, calculate the number of steps needed and send multiple commands.

4. **Zone Naming**: Zone names are configured in the HTD app, not accessible via protocol. Store custom names in the database.

5. **Party Mode**: Available via physical keypads but not directly via serial protocol. Implement by setting all zones to same source.
