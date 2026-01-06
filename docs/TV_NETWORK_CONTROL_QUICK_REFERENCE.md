# TV Network Control - Quick Reference

**For full technical details, see**: [TV_NETWORK_CONTROL_PROTOCOLS_TECHNICAL_PLAN.md](./TV_NETWORK_CONTROL_PROTOCOLS_TECHNICAL_PLAN.md)

## Quick Brand Comparison

| Brand | Protocol | Port | Auth | Pairing Required | Difficulty |
|-------|----------|------|------|------------------|------------|
| **Samsung** | WebSocket | 8001/8002 | Token | Yes (on-screen approval) | Medium |
| **LG** | WebSocket | 3000/3001 | Client Key | Yes (on-screen approval) | Medium |
| **Sony** | HTTP REST | 80 | PSK | Yes (enter on TV) | Easy |
| **Vizio** | HTTPS REST | 7345/9000 | Token | Yes (4-digit PIN) | Medium |
| **Roku/TCL** | HTTP REST | 8060 | None | No | Very Easy |
| **Sharp** | TCP Socket | 10002 | None | No | Easy |
| **Hisense** | MQTT | 36669 | Credentials | Sometimes | Hard |

## Discovery Quick Start

### Option 1: SSDP (Fastest)

```bash
# Send multicast discovery
# 239.255.255.250:1900
# Search Target: ssdp:all
```

**Pros**: Fast, standard protocol
**Cons**: May be blocked by firewalls

### Option 2: Port Scan (Most Reliable)

```typescript
const tvPorts = [8001, 8002, 3000, 3001, 80, 7345, 8060, 10002]
scanIPRange('192.168.1.1', '192.168.1.254', tvPorts)
```

**Pros**: Works through firewalls
**Cons**: Slower (10-30 seconds)

## Pairing Cheat Sheet

### Samsung
1. Connect to `ws://TV_IP:8001/api/v2/channels/samsung.remote.control?name=<BASE64_NAME>`
2. User approves on TV screen
3. Receive `authToken` in response
4. Store token for future use

### LG
1. Connect to `ws://TV_IP:3000/`
2. Send registration JSON
3. User approves on TV (or enters 6-digit PIN)
4. Receive `client-key` in response
5. Store key for future use

### Sony
1. Navigate on TV: Settings → Network → IP Control → Pre-Shared Key
2. Enter PSK (16-20 characters)
3. Add header to all requests: `X-Auth-PSK: YourPSKHere`

### Vizio
1. PUT `https://TV_IP:9000/pairing/start` with device info
2. TV displays 4-digit PIN
3. PUT `https://TV_IP:9000/pairing/pair` with PIN
4. Receive `AUTH_TOKEN`
5. Store token, use in header: `AUTH: token`

### Roku
No pairing needed - just send HTTP requests to port 8060

## Common Commands

### Samsung (WebSocket)

```json
// Power
{"method":"ms.remote.control","params":{"Cmd":"Click","DataOfCmd":"KEY_POWER","Option":"false","TypeOfRemote":"SendRemoteKey"}}

// HDMI 1
{"method":"ms.remote.control","params":{"Cmd":"Click","DataOfCmd":"KEY_HDMI","Option":"false","TypeOfRemote":"SendRemoteKey"}}

// Volume Up
{"method":"ms.remote.control","params":{"Cmd":"Click","DataOfCmd":"KEY_VOLUP","Option":"false","TypeOfRemote":"SendRemoteKey"}}
```

### LG (WebSocket)

```json
// Power Off
{"type":"request","id":"1","uri":"ssap://system/turnOff"}

// Set Volume
{"type":"request","id":"2","uri":"ssap://audio/setVolume","payload":{"volume":20}}

// Switch Input
{"type":"request","id":"3","uri":"ssap://tv/switchInput","payload":{"inputId":"HDMI_1"}}
```

### Sony (HTTP)

```bash
# Power Off
curl -H "X-Auth-PSK: YourPSK" -H "Content-Type: application/json" \
  -d '{"id":1,"method":"setPowerStatus","version":"1.0","params":[{"status":false}]}' \
  http://TV_IP/sony/system

# Switch Input
curl -H "X-Auth-PSK: YourPSK" -H "Content-Type: application/json" \
  -d '{"id":1,"method":"setPlayContent","version":"1.0","params":[{"uri":"extInput:hdmi?port=1"}]}' \
  http://TV_IP/sony/avContent
```

### Roku (HTTP)

```bash
# Power On
curl -d '' http://TV_IP:8060/keypress/PowerOn

# HDMI 1
curl -d '' http://TV_IP:8060/keypress/InputHDMI1

# Volume Up
curl -d '' http://TV_IP:8060/keypress/VolumeUp
```

## Port Reference

| Port | Brand | Protocol | Purpose |
|------|-------|----------|---------|
| 8001 | Samsung | ws:// | Unencrypted WebSocket control |
| 8002 | Samsung | wss:// | Encrypted WebSocket control (2020+) |
| 3000 | LG | ws:// | Unencrypted WebSocket control |
| 3001 | LG | wss:// | Encrypted WebSocket control |
| 80 | Sony | HTTP | REST API control |
| 9000 | Vizio | HTTPS | Pairing |
| 7345 | Vizio | HTTPS | Control |
| 8060 | Roku | HTTP | ECP API |
| 10002 | Sharp | TCP | Aquos control |
| 10008 | Sharp | TCP | Professional displays |
| 36669 | Hisense | MQTT | Control broker |
| 1900 | All | UDP | SSDP discovery |

## Capabilities Matrix

| Brand | Power On | Power Off | Volume | Input | Power State | WOL |
|-------|----------|-----------|--------|-------|-------------|-----|
| Samsung | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ (some models) |
| LG | ❌ (need WOL) | ✅ | ✅ | ✅ | ❌ | ⚠️ (limited) |
| Sony | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (when enabled) |
| Vizio | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Roku | ✅ | ✅ | ⚠️ (up/down only) | ✅ | ❌ | ❌ |
| Sharp | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hisense | ⚠️ | ⚠️ | ✅ | ✅ | ❌ | ❌ |

✅ = Full support
⚠️ = Partial/conditional support
❌ = Not supported

## Common Issues & Solutions

### Issue: TV Not Discovered

**Solutions**:
1. Check TV is on same subnet
2. Verify SSDP not blocked by firewall
3. Try port scanning instead
4. Check TV network settings enabled

### Issue: Pairing Timeout

**Solutions**:
1. Ensure TV screen is visible to user
2. Increase timeout to 60 seconds
3. Check firewall not blocking return traffic
4. Retry with "Resend" button

### Issue: Commands Not Working

**Solutions**:
1. Verify auth token still valid
2. Check TV firmware version
3. Implement command queue (avoid concurrent requests)
4. Add 500ms delay between commands

### Issue: Power State Unknown

**Solutions**:
1. Track last command sent in database
2. Use Sony TVs (only brand with reliable power state)
3. Implement external power monitoring
4. Assume state and send commands optimistically

### Issue: Self-Signed Certificate Errors

**Solutions**:
```typescript
// Disable certificate verification for TV IPs
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})
```

## Implementation Checklist

### Phase 1: Core Discovery
- [ ] SSDP scanner with brand-specific search targets
- [ ] Port scanner with concurrency control
- [ ] Brand detection via HTTP probing
- [ ] Database schema for `NetworkTVDevice`

### Phase 2: Authentication
- [ ] Samsung WebSocket client with token storage
- [ ] LG WebOS client with client key storage
- [ ] Sony BRAVIA client with PSK support
- [ ] Secure credential storage (encrypted)

### Phase 3: Control
- [ ] Power control for each brand
- [ ] Volume control for each brand
- [ ] Input switching for each brand
- [ ] Command queue per device

### Phase 4: Integration
- [ ] Discovery wizard UI
- [ ] Real-time scan progress
- [ ] Pairing flows with countdown timers
- [ ] Matrix output assignment (drag-and-drop)

### Phase 5: Additional Brands
- [ ] Vizio SmartCast client
- [ ] Roku ECP client
- [ ] Sharp Aquos client (if needed)
- [ ] Hisense MQTT client (if needed)

## Testing Checklist

### Discovery
- [ ] SSDP discovery finds all TVs on network
- [ ] Port scan finds TVs missed by SSDP
- [ ] Brand detection works for all brands
- [ ] Progress updates in real-time

### Pairing
- [ ] Samsung pairing shows TV prompt and stores token
- [ ] LG pairing handles both approval and PIN modes
- [ ] Sony PSK entry validated
- [ ] Vizio PIN entry validated
- [ ] Timeout handling with retry

### Control
- [ ] Power on/off works for all brands
- [ ] Volume control works (absolute and relative)
- [ ] Input switching works for all HDMI ports
- [ ] Command queue prevents race conditions

### Integration
- [ ] Discovered TVs persist to database
- [ ] Credentials encrypted in storage
- [ ] Matrix assignments saved correctly
- [ ] UI shows correct connection status

## Performance Targets

| Operation | Target Time | Notes |
|-----------|-------------|-------|
| SSDP Discovery | < 5 seconds | For /24 subnet |
| Port Scan | < 30 seconds | 24 IPs × 8 ports with concurrency |
| Brand Detection | < 2 seconds | Per device |
| Pairing | < 60 seconds | Including user interaction |
| Command Execution | < 500ms | Single command |
| Power On (Network) | 2-5 seconds | Plus TV boot time |
| Power On (WOL) | 5-10 seconds | Plus TV boot time |

## Security Considerations

1. **Credential Storage**: Encrypt auth tokens/keys in database
2. **Network Segmentation**: Place TVs on dedicated VLAN
3. **Certificate Validation**: Disable only for known TV IPs
4. **Rate Limiting**: Prevent command flooding
5. **Access Control**: Require authentication for discovery/pairing
6. **Audit Logging**: Log all TV control commands

## Recommended TV Brands for Sports Bars

### Tier 1 (Best for Network Control)
1. **Sony BRAVIA Commercial** - Reliable API, power state detection, official docs
2. **Samsung Commercial** - Mature API, wide deployment, good community support
3. **LG Commercial** - Solid webOS API, good for hospitality

### Tier 2 (Good)
4. **Roku/TCL** - Simple API, no pairing needed, very common
5. **Sharp Commercial** - Simple protocol, no pairing, reliable

### Tier 3 (Acceptable)
6. **Vizio** - Works but more complex pairing
7. **Hisense** - MQTT is non-standard, inconsistent across models

### Not Recommended
- Generic/white-label brands - No documented APIs
- Very old models (pre-2016) - Limited network support

## Next Steps

1. Review full technical plan: [TV_NETWORK_CONTROL_PROTOCOLS_TECHNICAL_PLAN.md](./TV_NETWORK_CONTROL_PROTOCOLS_TECHNICAL_PLAN.md)
2. Review UX specification: [TV_DISCOVERY_UX_SPECIFICATION.md](./TV_DISCOVERY_UX_SPECIFICATION.md)
3. Review implementation notes: [TV_DISCOVERY_IMPLEMENTATION_NOTES.md](./TV_DISCOVERY_IMPLEMENTATION_NOTES.md)
4. Start with Phase 1 (Core Discovery) implementation
5. Test with real hardware as each brand client is developed
