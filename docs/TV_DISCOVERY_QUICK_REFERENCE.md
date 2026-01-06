# TV Discovery Workflow - Quick Reference Guide

## Quick Navigation

- [Discovery Flow](#discovery-flow)
- [Error Messages](#error-messages-quick-ref)
- [API Endpoints](#api-quick-ref)
- [Brand-Specific Notes](#brand-notes)
- [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Discovery Flow

```
┌─────────────────────────────────────────────────┐
│          TV DISCOVERY WORKFLOW                  │
└─────────────────────────────────────────────────┘

Step 1: Method Selection
   ○ IP Range (192.168.5.1 - 192.168.5.24)
   ○ CIDR Notation (192.168.5.0/24)
   ○ Subnet Auto-Scan
        ↓
Step 2: Configuration
   • Select ports to scan
   • Set timeout (1-10s)
   • Advanced options
        ↓
Step 3: Scanning
   Progress: ████████░░░░░░  50%
   Currently: 192.168.5.12
   Found: 3 devices
        ↓
Step 4: Review Results
   [✓] Samsung QN65Q80T
   [✓] LG OLED55C1PUB
   [✓] Sony XBR-55X900H
        ↓
Step 5: Pairing (if needed)
   Samsung/Vizio:  Enter 4-digit PIN
   LG:             Accept on TV screen
   Sony:           Enter PSK from TV settings
        ↓
Step 6: Matrix Assignment
   Method 1: Auto-assign by CEC name (Recommended)
   Method 2: Manual drag-and-drop
        ↓
Step 7: Test & Save
   Test power control
   Save to database
        ↓
✓ Complete!
```

---

## Screen State Reference

### Discovery Config - IP Range

```
┌─────────────────────────────────────────────────┐
│ Configure IP Range Scan              [←] [X]   │
├─────────────────────────────────────────────────┤
│ Start IP:  [192.168.5.__1]         ✓           │
│ End IP:    [192.168.5._24]         ✓           │
│                                                 │
│ Ports: [✓] 8001  [✓] 3000  [✓] 20060           │
│        [✓] 7345  [✓] 9080                      │
│                                                 │
│ Timeout: [2] sec   Concurrent: [5] IPs         │
│                                                 │
│ Estimated time: ~10 seconds                    │
│                                                 │
│ [Cancel]              [Start Discovery]        │
└─────────────────────────────────────────────────┘
```

### Active Scan

```
┌─────────────────────────────────────────────────┐
│ Discovering TVs...                              │
├─────────────────────────────────────────────────┤
│ Range: 192.168.5.1 - 192.168.5.24              │
│                                                 │
│ Progress: ████████████░░░░░  50% (12/24)       │
│ Currently: 192.168.5.12                         │
│                                                 │
│ ┌─ Detected (3) ─────────────────────────┐     │
│ │ [✓] Samsung QN65Q80T                   │     │
│ │     192.168.5.5 | ⚠ Needs Pairing      │     │
│ │                                         │     │
│ │ [✓] LG OLED55C1PUB                     │     │
│ │     192.168.5.8 | ⚠ Needs Pairing      │     │
│ │                                         │     │
│ │ [✓] Sony XBR-55X900H                   │     │
│ │     192.168.5.11 | ✓ Ready             │     │
│ └─────────────────────────────────────────┘     │
│                                                 │
│ Time: 00:08  |  Remaining: 00:07               │
│ [Cancel Scan]                                   │
└─────────────────────────────────────────────────┘
```

### Pairing - Samsung

```
┌─────────────────────────────────────────────────┐
│ Pairing Samsung TV (1/2)             [←] [X]   │
├─────────────────────────────────────────────────┤
│ Samsung QN65Q80T | 192.168.5.5                 │
│                                                 │
│ 📺 Check TV screen for PIN:                    │
│    ╔════════════════════════╗                  │
│    ║ Allow connection from: ║                  │
│    ║ Sports Bar Controller  ║                  │
│    ║ PIN: 1234              ║                  │
│    ║ [Allow]  [Deny]        ║                  │
│    ╚════════════════════════╝                  │
│                                                 │
│ Enter PIN: [_] [_] [_] [_]                     │
│                                                 │
│ ⏱ Timeout: 60 sec                              │
│                                                 │
│ [Cancel] [Resend]           [Verify PIN]       │
└─────────────────────────────────────────────────┘
```

### Pairing - LG

```
┌─────────────────────────────────────────────────┐
│ Pairing LG TV (2/2)                  [←] [X]   │
├─────────────────────────────────────────────────┤
│ LG OLED55C1PUB | 192.168.5.8                   │
│                                                 │
│ 📺 Accept on TV screen:                        │
│    ╔════════════════════════╗                  │
│    ║ Connection Request     ║                  │
│    ║ Sports Bar Controller  ║                  │
│    ║ wants to connect       ║                  │
│    ║ [Accept]  [Reject]     ║                  │
│    ╚════════════════════════╝                  │
│                                                 │
│ [Spinning indicator]                            │
│ Waiting for user to accept on TV...            │
│                                                 │
│ ⏱ Timeout: 45 sec                              │
│                                                 │
│ [Cancel]  [Resend Request]                     │
└─────────────────────────────────────────────────┘
```

### Manual Assignment

```
┌───────────────────────────────────────────────────────────┐
│ Manual TV Assignment                         [←] [X]      │
├───────────────────────────────────────────────────────────┤
│ ┌─ TVs ─────────┐  ┌─ Matrix Outputs ─────────────────┐ │
│ │               │  │                                   │ │
│ │ 📺 Samsung    │  │ Output 1: Main Bar               │ │
│ │    .5.5       │  │ [Drop TV here]                   │ │
│ │    [Drag →]   │  │ [Test Power]                     │ │
│ │               │  │                                   │ │
│ │ 📺 LG         │  │ Output 2: Pool Table             │ │
│ │    .5.8       │  │ ┌──────────────────────────────┐ │ │
│ │    [Drag →]   │  │ │ 📺 Sony XBR-55X900H          │ │ │
│ │               │  │ │    192.168.5.11              │ │ │
│ │ 📺 Sony       │  │ └──────────────────────────────┘ │ │
│ │    .5.11      │  │ [Test Power]                     │ │
│ │    Assigned ✓ │  │                                   │ │
│ │               │  │ Output 3: Booth                  │ │
│ └───────────────┘  │ [Drop TV here]                   │ │
│ Assigned: 1/3     │ [Test Power]                     │ │
│                   └───────────────────────────────────┘ │
│ [Clear All]                      [Save Assignments]     │
└───────────────────────────────────────────────────────────┘
```

---

## Error Messages Quick Ref

### Configuration Errors

| Code | Message | Solution |
|------|---------|----------|
| INVALID_IP | Invalid IP address format | Use format: 192.168.1.100 |
| INVALID_IP_RANGE | End IP must be >= Start IP | Swap IPs or fix range |
| DIFFERENT_SUBNETS | IPs in different subnets | Use same subnet or CIDR |
| NO_PORTS_SELECTED | No ports selected | Check at least one port |
| INVALID_CIDR | Invalid CIDR notation | Use format: 192.168.1.0/24 |
| SUBNET_TOO_LARGE | Subnet > /16 | Use smaller subnet or IP range |

### Discovery Errors

| Code | Message | Solution |
|------|---------|----------|
| NO_TVS_FOUND | No TVs detected | Power on TVs, check network control |
| SCAN_TIMEOUT | Scan timed out | Reduce range or increase timeout |
| NETWORK_ERROR | Network unreachable | Check server network connection |

### Pairing Errors

| Code | Message | Solution |
|------|---------|----------|
| PAIRING_TIMEOUT | TV did not respond (60s) | Ensure TV is on, retry |
| PAIRING_REJECTED | Pairing denied on TV | Press Allow/Accept on TV |
| INVALID_PIN | Invalid PIN format | Enter 4-digit PIN from TV |
| PIN_MISMATCH | PIN verification failed | Check PIN, re-enter |
| AUTH_TOKEN_EXPIRED | Token expired | Re-pair TV |

### Connection Errors

| Code | Message | Solution |
|------|---------|----------|
| TV_UNREACHABLE | Cannot reach TV | Check TV power and network |
| CONNECTION_REFUSED | TV refused connection | Enable network control in TV |
| UNSUPPORTED_TV | TV doesn't support IP control | Use CEC or IR instead |

### Assignment Errors

| Code | Message | Solution |
|------|---------|----------|
| DUPLICATE_ASSIGNMENT | TV already assigned | Remove existing assignment |
| OUTPUT_ALREADY_ASSIGNED | Output has TV assigned | Remove existing TV |
| POWER_TEST_FAILED | Power test failed | Check matrix routing |

---

## API Quick Ref

### Scan Network

```http
POST /api/tv-discovery/scan
Content-Type: application/json

{
  "method": "ip_range",
  "config": {
    "startIP": "192.168.5.1",
    "endIP": "192.168.5.24",
    "ports": [8001, 3000, 20060],
    "timeout": 2000,
    "concurrentScans": 5
  }
}
```

### Get Scan Status

```http
GET /api/tv-discovery/scan/{scanId}/status

Response:
{
  "status": "scanning",
  "progress": {
    "current": 12,
    "total": 24,
    "percentage": 50,
    "currentIP": "192.168.5.12"
  },
  "discovered": [...]
}
```

### Initiate Pairing

```http
POST /api/tv-discovery/pair
Content-Type: application/json

{
  "ipAddress": "192.168.5.5",
  "port": 8001,
  "brand": "Samsung"
}

Response:
{
  "pairingId": "pair-456",
  "requiresPIN": true,
  "timeout": 60
}
```

### Verify PIN

```http
POST /api/tv-discovery/pair/{pairingId}/verify
Content-Type: application/json

{
  "pin": "1234"
}

Response:
{
  "success": true,
  "deviceId": "tv-789",
  "authToken": "ey...",
  "capabilities": {...}
}
```

### Assign to Matrix

```http
POST /api/tv-discovery/assign
Content-Type: application/json

{
  "assignments": [
    {
      "deviceId": "tv-789",
      "matrixOutputId": "output-1"
    }
  ],
  "testPower": true
}
```

---

## Brand Notes

### Samsung

- **Ports**: 8001 (default), 8002 (SSL)
- **Pairing**: 4-digit PIN on TV screen
- **Timeout**: 60 seconds
- **API**: WebSocket-based
- **Settings**: Enable "External Device Manager"
- **Quirks**: Frame TVs may have Art Mode active

### LG WebOS

- **Ports**: 3000 (default), 3001 (SSL)
- **Pairing**: Accept/Reject prompt (no PIN)
- **Timeout**: 45 seconds
- **API**: WebSocket-based
- **Settings**: Enable "LG Connect Apps"
- **Quirks**: OLED models may have longer power-on delay

### Sony BRAVIA

- **Ports**: 20060 (default)
- **Pairing**: PSK (Pre-Shared Key) from settings
- **Timeout**: N/A (PSK stored on TV)
- **API**: HTTP REST
- **Settings**: Enable "IP Control" + set PSK
- **Quirks**: Some models require BRAVIA Sync enabled

### Vizio SmartCast

- **Ports**: 7345 (default), 9000 (cast)
- **Pairing**: 4-digit PIN on TV screen
- **Timeout**: 60 seconds
- **API**: HTTP REST
- **Settings**: Enable "Cast" in network settings
- **Quirks**: Inconsistent CEC support, prefer IP control

### TCL Roku TV

- **Ports**: 9080 (default), 8060 (ECP)
- **Pairing**: Not required for basic control
- **API**: ECP (External Control Protocol)
- **Settings**: Enable "External Control"
- **Quirks**: Limited power control via IP

---

## Keyboard Shortcuts

### Discovery Config Screen

- `Tab` / `Shift+Tab` - Navigate fields
- `Enter` - Start discovery
- `Escape` - Cancel/close

### Scan Progress Screen

- `Escape` - Cancel scan
- `Space` - Pause/resume scan (future)

### Pairing Screen

- `1-9` - Enter PIN digit
- `Tab` - Move to next PIN field
- `Enter` - Verify PIN
- `Escape` - Cancel pairing

### Manual Assignment

- `Space` - Pick up/drop TV (when focused)
- `Arrow keys` - Navigate drop zones
- `Enter` - Test power on focused output
- `Delete` - Remove assignment
- `Ctrl+S` - Save assignments

---

## Status Badge Reference

| Badge | Meaning | Action Required |
|-------|---------|-----------------|
| ✓ Ready | TV paired and ready | None |
| ⚠ Needs Pairing | Authentication required | Complete pairing |
| ❌ Failed | Pairing/test failed | Troubleshoot |
| ❓ Unknown | Brand not detected | Override brand |
| ⏳ Pending | Waiting for response | Wait or cancel |
| 🔄 Testing | Power test in progress | Wait |

---

## Confidence Score Guide

| Score | Meaning | Recommended Action |
|-------|---------|-------------------|
| 95-100% | Exact match | Auto-assign |
| 85-94% | Strong match | Review and confirm |
| 70-84% | Possible match | Verify manually |
| < 70% | Uncertain | Manual assignment |

---

## Common Port Numbers

| Brand | Port | Protocol | Purpose |
|-------|------|----------|---------|
| Samsung | 8001 | WebSocket | Control API |
| Samsung | 8002 | WSS | Control API (SSL) |
| LG | 3000 | WebSocket | WebOS API |
| LG | 3001 | WSS | WebOS API (SSL) |
| Sony | 20060 | HTTP | BRAVIA API |
| Vizio | 7345 | HTTP | SmartCast API |
| Vizio | 9000 | HTTP | Cast API |
| TCL Roku | 8060 | HTTP | ECP API |
| TCL Roku | 9080 | HTTP | Legacy control |

---

## Timing Reference

### Recommended Timeouts

| Operation | Default | Min | Max | Notes |
|-----------|---------|-----|-----|-------|
| IP scan per host | 2s | 1s | 10s | Balance speed vs reliability |
| Concurrent scans | 5 | 1 | 20 | Higher = faster but more load |
| Pairing timeout | 60s | 30s | 120s | User needs time to walk to TV |
| LG pairing | 45s | 30s | 90s | No PIN entry needed |
| Power test | 5s | 2s | 10s | TV response time |

### Estimated Scan Times

| Range | IPs | Concurrent | Timeout | Estimated |
|-------|-----|------------|---------|-----------|
| /32 (1 IP) | 1 | 1 | 2s | ~2s |
| Small (1-24) | 24 | 5 | 2s | ~10s |
| Medium (1-50) | 50 | 5 | 2s | ~20s |
| Large (1-100) | 100 | 10 | 2s | ~20s |
| /24 subnet | 254 | 10 | 2s | ~50s |

---

## Troubleshooting Decision Tree

```
TV not detected?
├─ Is TV powered on?
│  ├─ No → Power on TV and retry
│  └─ Yes → Continue
│
├─ Is network control enabled?
│  ├─ Samsung: External Device Manager ON?
│  ├─ LG: LG Connect Apps enabled?
│  ├─ Sony: IP Control enabled?
│  └─ Check TV settings menu
│
├─ Is IP address in scan range?
│  ├─ Check TV network settings
│  └─ Verify subnet matches
│
├─ Are correct ports selected?
│  ├─ Samsung: 8001
│  ├─ LG: 3000
│  ├─ Sony: 20060
│  └─ Try "All Ports" option
│
└─ Firewall blocking?
   ├─ Test with: curl http://{ip}:{port}
   └─ Check router/server firewall

Pairing timeout?
├─ Was TV screen showing prompt?
│  ├─ No → Retry pairing
│  └─ Yes → Continue
│
├─ Did user press Allow/Accept?
│  ├─ No → Press Allow and retry
│  └─ Yes → Continue
│
├─ PIN entered correctly?
│  ├─ Check for typos
│  └─ Try again with correct PIN
│
└─ Network interruption?
   └─ Check Wi-Fi/Ethernet stability

Power test failed?
├─ Is TV assigned to correct output?
│  └─ Verify matrix routing
│
├─ Is CEC enabled on TV?
│  └─ Enable HDMI-CEC in TV settings
│
├─ Try IP power command instead
│  └─ Use paired IP control
│
└─ Test manually with matrix control
   └─ Switch input and observe
```

---

## Database Schema Quick Ref

```sql
-- NetworkTVDevice table
CREATE TABLE NetworkTVDevice (
  id TEXT PRIMARY KEY,
  ipAddress TEXT UNIQUE NOT NULL,
  port INTEGER NOT NULL,
  brand TEXT NOT NULL,
  model TEXT,
  displayName TEXT NOT NULL,
  authToken TEXT,               -- Encrypted
  pairingStatus TEXT,           -- unpaired|paired|expired
  matrixOutputId TEXT,          -- FK to MatrixOutput
  status TEXT,                  -- online|offline|error
  discoveryMethod TEXT,         -- ip_scan|cidr_scan|manual
  discoveryConfidence TEXT,     -- high|medium|low
  supportsPower BOOLEAN,
  supportsVolume BOOLEAN,
  supportsInput BOOLEAN,
  supportsApps BOOLEAN,
  lastSeen TIMESTAMP,
  discoveredAt TIMESTAMP,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);

-- MatrixOutput update (add FK)
ALTER TABLE MatrixOutput ADD COLUMN
  networkTVDeviceId TEXT REFERENCES NetworkTVDevice(id);
```

---

## Testing Checklist

### Pre-Flight

- [ ] Server has network access to TV subnet
- [ ] At least one TV is powered on
- [ ] TV network control is enabled
- [ ] Firewall allows outbound connections

### Discovery Testing

- [ ] IP range scan completes
- [ ] CIDR scan completes
- [ ] Auto-subnet detects correctly
- [ ] TVs appear in results
- [ ] Brand detection is accurate
- [ ] Confidence scores are reasonable

### Pairing Testing

- [ ] Samsung PIN entry works
- [ ] LG accept/reject works
- [ ] Sony PSK entry works
- [ ] Timeout handling works
- [ ] Retry after failure works
- [ ] Auth tokens are stored securely

### Assignment Testing

- [ ] Auto-assign suggestions are accurate
- [ ] Manual drag-and-drop works
- [ ] Power tests execute correctly
- [ ] Database saves correctly
- [ ] Duplicate detection works

### Error Handling

- [ ] No TVs found displays properly
- [ ] Pairing timeout shows error
- [ ] Network errors are caught
- [ ] Validation errors appear inline
- [ ] User can recover from all errors

---

## Performance Benchmarks

### Target Times (24 TV bar)

| Task | Target | Acceptable | Slow |
|------|--------|------------|------|
| IP scan | 10s | 20s | >30s |
| Single pairing | 15s | 30s | >60s |
| All pairings (8 TVs) | 5min | 10min | >15min |
| Auto-assign | <1s | 2s | >5s |
| Power test | 3s | 5s | >10s |
| Save to DB | <500ms | 1s | >2s |

### Resource Limits

- Max concurrent scans: 20
- Max scan range: /16 (65,536 IPs)
- Max pairing queue: 50 TVs
- Database connections: 10 pool
- WebSocket connections: 1 per TV

---

## Quick Start Example

### Scenario: Setup 4 TVs in 5 minutes

1. **Click "Discover TVs"** in Device Config
2. **Select "IP Range"**
3. **Enter**: 192.168.5.1 - 192.168.5.10
4. **Click "Start Discovery"** (wait ~5 seconds)
5. **Review**: 4 TVs found
6. **Select all**, **Click "Continue to Pairing"**
7. **Walk to TV 1**, see PIN "1234", enter, click Verify
8. **Walk to TV 2**, see PIN "5678", enter, click Verify
9. **Walk to TV 3**, see PIN "9012", enter, click Verify
10. **Walk to TV 4**, see PIN "3456", enter, click Verify
11. **Click "Auto-assign by CEC name"**
12. **Review suggestions**, all look good
13. **Click "Assign Selected"**
14. **Wait for power tests** (all pass)
15. **Click "Save & Close"**
16. **Done!** 4 TVs ready in ~5 minutes

---

**Quick Reference Version 1.0**
**Last Updated**: 2025-11-21
**Related Docs**: TV_DISCOVERY_UX_SPECIFICATION.md
