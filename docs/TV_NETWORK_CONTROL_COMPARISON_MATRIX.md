# TV Network Control - Brand Comparison Matrix

## Quick Decision Guide

**Best Overall**: Sony BRAVIA Commercial (reliable API, power state detection, official docs)
**Best for Consumer TVs**: Samsung (most common, mature API)
**Easiest Implementation**: Roku/TCL (no pairing, simple HTTP)
**Best for Hospitality**: LG webOS Commercial (designed for hotels/restaurants)

---

## Technical Specifications Matrix

| Feature | Samsung | LG | Sony | Vizio | Roku/TCL | Sharp | Hisense |
|---------|---------|-----|------|-------|----------|-------|---------|
| **Protocol** | WebSocket | WebSocket | HTTP REST | HTTPS REST | HTTP REST | TCP Socket | MQTT |
| **Primary Port** | 8001/8002 | 3000/3001 | 80 | 7345 | 8060 | 10002 | 36669 |
| **Encrypted** | Yes (8002) | Yes (3001) | No | Yes | No | No | No |
| **Format** | JSON | JSON | JSON-RPC | JSON | XML | ASCII | JSON |
| **Auth Method** | Token | Client Key | PSK | Token | None | None | User/Pass |
| **Pairing Required** | Yes | Yes | Yes | Yes | No | No | Sometimes |
| **PIN Entry** | No | Sometimes | Yes (PSK) | Yes (4-digit) | No | No | Yes (4-digit) |
| **Documentation** | Unofficial | Unofficial | Official | Unofficial | Official | Official | Unofficial |

---

## Capabilities Matrix

### Power Control

| Brand | Power On | Power Off | Power State Detection | WOL Support | Notes |
|-------|----------|-----------|----------------------|-------------|-------|
| Samsung | ✅ | ✅ | ❌ | ⚠️ (2018+) | Cannot detect when off |
| LG | ⚠️ (WOL) | ✅ | ❌ | ⚠️ (limited) | Requires WOL for power on |
| Sony | ✅ | ✅ | ✅ | ✅ | Only brand with reliable state |
| Vizio | ✅ | ✅ | ✅ | ❌ | State detection works |
| Roku/TCL | ✅ | ✅ | ❌ | ❌ | Roku TVs only (not sticks) |
| Sharp | ✅ | ✅ | ✅ | ✅ | Commercial models |
| Hisense | ⚠️ | ⚠️ | ❌ | ❌ | Toggle only |

### Volume Control

| Brand | Set Absolute | Volume Up/Down | Mute | Get Current | Notes |
|-------|--------------|----------------|------|-------------|-------|
| Samsung | ✅ | ✅ | ✅ | ✅ | Full control |
| LG | ✅ | ✅ | ✅ | ✅ | Full control |
| Sony | ✅ | ✅ | ✅ | ✅ | Full control |
| Vizio | ✅ | ✅ | ✅ | ✅ | Full control |
| Roku/TCL | ❌ | ✅ | ✅ | ❌ | Only up/down/mute |
| Sharp | ✅ | ✅ | ✅ | ✅ | Full control |
| Hisense | ✅ | ✅ | ✅ | ⚠️ | Limited |

### Input Switching

| Brand | Switch Input | List Inputs | Current Input | Direct HDMI Access | Notes |
|-------|--------------|-------------|---------------|-------------------|-------|
| Samsung | ✅ | ✅ | ✅ | ✅ | Full support |
| LG | ✅ | ✅ | ✅ | ✅ | Full support |
| Sony | ✅ | ✅ | ✅ | ✅ | Full support |
| Vizio | ✅ | ❌ | ✅ | ✅ | Cannot list inputs |
| Roku/TCL | ✅ | ❌ | ✅ | ✅ | TVs only |
| Sharp | ✅ | ❌ | ✅ | ✅ | Simple commands |
| Hisense | ✅ | ❌ | ❌ | ✅ | Basic support |

### Additional Features

| Brand | App Launch | Remote Keys | Picture Settings | Device Info | Notes |
|-------|------------|-------------|------------------|-------------|-------|
| Samsung | ✅ | ✅ | ✅ | ✅ | Comprehensive API |
| LG | ✅ | ✅ | ✅ | ✅ | Comprehensive API |
| Sony | ✅ | ✅ | ✅ | ✅ | Comprehensive API |
| Vizio | ⚠️ (Cast) | ✅ | ⚠️ | ⚠️ | Limited |
| Roku/TCL | ✅ | ✅ | ❌ | ✅ | Apps only |
| Sharp | ❌ | ❌ | ✅ | ⚠️ | Commercial focus |
| Hisense | ❌ | ✅ | ❌ | ❌ | Basic |

---

## Discovery & Detection

### SSDP Support

| Brand | SSDP Response | Search Target | Reliability | Notes |
|-------|---------------|---------------|-------------|-------|
| Samsung | ✅ | `urn:samsung.com:device:RemoteControlReceiver:1` | High | Standard implementation |
| LG | ✅ | `urn:lge-com:service:webos-second-screen:1` | High | Standard implementation |
| Sony | ✅ | `urn:schemas-sony-com:service:ScalarWebAPI:1` | High | Standard implementation |
| Vizio | ✅ | `urn:dial-multiscreen-org:service:dial:1` | Medium | DIAL protocol |
| Roku | ✅ | `roku:ecp` | High | Standard implementation |
| Sharp | ⚠️ | `ssdp:all` | Low | Generic UPnP only |
| Hisense | ⚠️ | `ssdp:all` | Low | Inconsistent |

### Brand Detection Methods

| Brand | HTTP Probe | Port Signature | Banner Detection | Confidence |
|-------|------------|----------------|------------------|------------|
| Samsung | `/api/v2/` on 8001 | 8001/8002 open | None | High |
| LG | `/` on 3000 | 3000/3001 open | `Server: LG` | High |
| Sony | `/sony/system` | 80 open | JSON-RPC response | High |
| Vizio | `/pairing/list` on 9000 | 7345/9000 open | HTTPS cert | Medium |
| Roku | `/query/device-info` | 8060 open | XML response | High |
| Sharp | Port probe | 10002/10008 open | Telnet banner | Medium |
| Hisense | Port probe | 36669 open | MQTT banner | Low |

---

## Security & Authentication

### Certificate Handling

| Brand | Certificate Type | Validation Required | Hostname Match | Notes |
|-------|------------------|---------------------|----------------|-------|
| Samsung | Self-signed (8002) | No | No | Must disable verification |
| LG | Self-signed (3001) | No | No | Must disable verification |
| Sony | None (HTTP) | N/A | N/A | Unencrypted |
| Vizio | Self-signed | No | No | Must disable verification |
| Roku | None (HTTP) | N/A | N/A | Unencrypted |
| Sharp | None (TCP) | N/A | N/A | Raw socket |
| Hisense | None (MQTT) | No | No | Optional SSL |

### Credential Storage

| Brand | Credential Type | Length | Expiry | Re-pairing Trigger |
|-------|----------------|--------|--------|-------------------|
| Samsung | Auth Token | ~50 chars | Never | TV reset, firmware update |
| LG | Client Key | ~100 chars | Never | TV reset, firmware update |
| Sony | Pre-Shared Key | 16-20 chars | Never | User changes PSK |
| Vizio | Auth Token | ~50 chars | Never | TV reset |
| Roku | None | N/A | N/A | N/A |
| Sharp | None | N/A | N/A | N/A |
| Hisense | Username/Password | Varies | Never | User changes |

---

## Implementation Complexity

### Development Effort

| Brand | Discovery | Pairing | Control | Testing | Total | Priority |
|-------|-----------|---------|---------|---------|-------|----------|
| Samsung | 2 hours | 4 hours | 3 hours | 2 hours | **11 hours** | 1 |
| LG | 2 hours | 5 hours | 3 hours | 2 hours | **12 hours** | 2 |
| Sony | 2 hours | 2 hours | 2 hours | 1 hour | **7 hours** | 3 |
| Vizio | 2 hours | 4 hours | 3 hours | 2 hours | **11 hours** | 5 |
| Roku | 1 hour | 0 hours | 2 hours | 1 hour | **4 hours** | 4 |
| Sharp | 1 hour | 0 hours | 2 hours | 1 hour | **4 hours** | 6 |
| Hisense | 2 hours | 3 hours | 4 hours | 2 hours | **11 hours** | 7 |

### Code Complexity

| Brand | Lines of Code (Est.) | Dependencies | Quirks | Maintenance |
|-------|---------------------|--------------|--------|-------------|
| Samsung | ~400 | `ws`, `buffer` | Version differences | Medium |
| LG | ~500 | `ws` | PIN vs approval modes | Medium |
| Sony | ~300 | `axios` | None | Low |
| Vizio | ~400 | `axios`, `https` | HASHVAL calculation | Medium |
| Roku | ~200 | `axios`, `xml2js` | None | Low |
| Sharp | ~200 | `net` | Port variations | Low |
| Hisense | ~400 | `mqtt` | Model differences | High |

---

## Reliability & Stability

### Connection Stability

| Brand | Persistent Connection | Reconnect Logic | Command Queue | Error Handling |
|-------|----------------------|----------------|---------------|----------------|
| Samsung | Required (WebSocket) | Must implement | Recommended | Good |
| LG | Required (WebSocket) | Must implement | Recommended | Good |
| Sony | Per-request (HTTP) | Not needed | Recommended | Excellent |
| Vizio | Per-request (HTTPS) | Not needed | Recommended | Good |
| Roku | Per-request (HTTP) | Not needed | Optional | Excellent |
| Sharp | Per-request (TCP) | Not needed | Optional | Good |
| Hisense | Persistent (MQTT) | Must implement | Required | Poor |

### Known Issues

| Brand | Common Issues | Workarounds | Severity |
|-------|---------------|-------------|----------|
| Samsung | Token lost on firmware update | Re-pair flow | Medium |
| Samsung | 2020+ require secure WebSocket | Version detection | Low |
| LG | WOL needed for power on | Use WOL packet | Medium |
| LG | 2022+ models use 6-digit PIN | PIN entry UI | Low |
| Sony | PSK must be entered on TV | Clear instructions | Low |
| Vizio | Self-signed cert changes | Disable verification | Low |
| Roku | No absolute volume control | Track relative changes | Medium |
| Roku | Only works on Roku TVs, not sticks | Device detection | High |
| Sharp | Different ports per model series | Port detection | Medium |
| Hisense | Auth varies by model/firmware | Try default creds first | High |

---

## Commercial vs Consumer Models

### Commercial Display Advantages

| Feature | Consumer TV | Commercial Display | Benefit for Sports Bars |
|---------|-------------|-------------------|------------------------|
| **Operating Hours** | 8-10 hours/day | 16-24 hours/day | Longer lifespan |
| **Network Control** | May need enabling | Always available | Easier deployment |
| **Documentation** | Reverse-engineered | Official API docs | Reliable implementation |
| **RS-232 Serial** | Rare | Standard | Fallback control method |
| **Warranty** | 1-2 years | 3-5 years | Lower replacement costs |
| **Brightness** | 250-400 nits | 500-700 nits | Better in bright bars |
| **Lockout Features** | Basic | Comprehensive | Prevent customer tampering |
| **Remote Management** | Limited | Full control panel | Centralized management |

### Hospitality Mode Features

**Available on**:
- Samsung Commercial displays
- LG Commercial displays (Pro:Centric)
- Sony BRAVIA Professional displays

**Features**:
- Channel lockout (restrict access)
- Volume limits (enforce min/max)
- Auto power-on schedules
- Source locking (prevent input changes)
- Custom branding (replace logo/splash)
- Remote management dashboard
- Group control

**Note**: Hospitality mode may affect API availability. Check documentation.

---

## Sports Bar Deployment Scenarios

### Scenario 1: All Same Brand (Best Case)

**Example**: 24 Samsung commercial displays

| Aspect | Assessment |
|--------|------------|
| **Discovery** | Fast (single SSDP query) |
| **Pairing** | One-time setup per TV |
| **Control** | Consistent API |
| **Maintenance** | Simple (one codebase) |
| **Recommendation** | ⭐⭐⭐⭐⭐ Ideal |

### Scenario 2: Mixed Brands (Common)

**Example**: 10 Samsung, 8 LG, 6 Sony

| Aspect | Assessment |
|--------|------------|
| **Discovery** | Multiple methods needed |
| **Pairing** | Different flows per brand |
| **Control** | Abstract interface required |
| **Maintenance** | Complex (multiple codebases) |
| **Recommendation** | ⭐⭐⭐ Acceptable |

### Scenario 3: Unknown/Generic Brands (Worst Case)

**Example**: Various off-brand TVs

| Aspect | Assessment |
|--------|------------|
| **Discovery** | Hit-or-miss |
| **Pairing** | May not be possible |
| **Control** | No documented API |
| **Maintenance** | Very difficult |
| **Recommendation** | ⭐ Use IR control instead |

---

## Feature Comparison for Sports Bar Use Cases

### Use Case: Scheduled Channel Changes

| Brand | Suitability | Notes |
|-------|-------------|-------|
| Samsung | ⭐⭐⭐⭐ | Good - can change inputs/apps |
| LG | ⭐⭐⭐⭐ | Good - can change inputs/apps |
| Sony | ⭐⭐⭐⭐⭐ | Excellent - reliable state detection |
| Vizio | ⭐⭐⭐ | Acceptable - works but limited app control |
| Roku/TCL | ⭐⭐⭐⭐ | Good - easy input switching |
| Sharp | ⭐⭐⭐ | Acceptable - basic input switching |

### Use Case: Volume Automation

| Brand | Suitability | Notes |
|-------|-------------|-------|
| Samsung | ⭐⭐⭐⭐⭐ | Excellent - set exact levels |
| LG | ⭐⭐⭐⭐⭐ | Excellent - set exact levels |
| Sony | ⭐⭐⭐⭐⭐ | Excellent - set exact levels |
| Vizio | ⭐⭐⭐⭐ | Good - set exact levels |
| Roku/TCL | ⭐⭐ | Poor - only up/down/mute |
| Sharp | ⭐⭐⭐⭐ | Good - set exact levels |

### Use Case: Power Management

| Brand | Suitability | Notes |
|-------|-------------|-------|
| Samsung | ⭐⭐⭐ | Acceptable - no state detection |
| LG | ⭐⭐ | Poor - requires WOL for power on |
| Sony | ⭐⭐⭐⭐⭐ | Excellent - reliable power state |
| Vizio | ⭐⭐⭐⭐ | Good - state detection works |
| Roku/TCL | ⭐⭐⭐ | Acceptable - no state detection |
| Sharp | ⭐⭐⭐⭐ | Good - state detection works |

### Use Case: Multi-Zone Audio Integration

| Brand | Suitability | Notes |
|-------|-------------|-------|
| Samsung | ⭐⭐⭐⭐ | Good - precise volume control |
| LG | ⭐⭐⭐⭐⭐ | Excellent - can read current levels |
| Sony | ⭐⭐⭐⭐⭐ | Excellent - can read current levels |
| Vizio | ⭐⭐⭐⭐ | Good - precise volume control |
| Roku/TCL | ⭐ | Poor - no absolute volume |
| Sharp | ⭐⭐⭐⭐ | Good - precise volume control |

---

## Recommended Brand Priority for Implementation

### Phase 1 (Critical - Implement First)

1. **Samsung** - Most common in sports bars, mature API
2. **Sony** - Most reliable API, power state detection
3. **LG** - Common in hospitality, good webOS API

### Phase 2 (Important - Implement Next)

4. **Roku/TCL** - Very common, easiest to implement
5. **Vizio** - Growing market share

### Phase 3 (Optional - Implement If Needed)

6. **Sharp** - Commercial displays only
7. **Hisense** - Low market share, complex API

---

## Cost-Benefit Analysis

### Development Cost (Developer Hours)

| Brand | Discovery | Pairing | Control | Testing | Docs | Total |
|-------|-----------|---------|---------|---------|------|-------|
| Samsung | 2h | 4h | 3h | 2h | 1h | **12h** |
| LG | 2h | 5h | 3h | 2h | 1h | **13h** |
| Sony | 2h | 2h | 2h | 1h | 1h | **8h** |
| Vizio | 2h | 4h | 3h | 2h | 1h | **12h** |
| Roku | 1h | 0h | 2h | 1h | 1h | **5h** |
| Sharp | 1h | 0h | 2h | 1h | 1h | **5h** |
| **Total** | | | | | | **55h** |

### Market Coverage (US Sports Bars)

| Brand | Market Share | TVs Covered (100-bar sample) |
|-------|--------------|------------------------------|
| Samsung | 35% | ~840 TVs |
| LG | 25% | ~600 TVs |
| Sony | 15% | ~360 TVs |
| Vizio | 10% | ~240 TVs |
| Roku/TCL | 10% | ~240 TVs |
| Other | 5% | ~120 TVs |

**ROI Calculation**:
- Implementing Samsung + LG + Sony = 33 hours, covers 75% of TVs
- Adding Roku + Vizio = 17 hours, covers additional 20%
- Total: 50 hours for 95% coverage

---

## Testing Requirements

### Per-Brand Test Matrix

| Test Case | Samsung | LG | Sony | Vizio | Roku | Sharp | Hisense |
|-----------|---------|-----|------|-------|------|-------|---------|
| **Discovery** | | | | | | | |
| SSDP discovery | ✓ | ✓ | ✓ | ✓ | ✓ | - | - |
| Port scan discovery | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Brand detection | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Pairing** | | | | | | | |
| Initial pairing | ✓ | ✓ | ✓ | ✓ | - | - | ✓ |
| Credential storage | ✓ | ✓ | ✓ | ✓ | - | - | ✓ |
| Re-pairing | ✓ | ✓ | ✓ | ✓ | - | - | ✓ |
| Timeout handling | ✓ | ✓ | ✓ | ✓ | - | - | ✓ |
| **Control** | | | | | | | |
| Power on | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Power off | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Power state | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Volume set | ✓ | ✓ | ✓ | ✓ | - | ✓ | ✓ |
| Volume up/down | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mute | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Input switch | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Reliability** | | | | | | | |
| Command queue | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Error handling | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Connection recovery | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Concurrent requests | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Hardware Test Requirements

| Test Type | Equipment Needed | Duration |
|-----------|-----------------|----------|
| **Samsung Tests** | 1 Samsung TV (2020+) | 2 hours |
| **LG Tests** | 1 LG TV (2020+) | 2 hours |
| **Sony Tests** | 1 Sony BRAVIA | 1 hour |
| **Vizio Tests** | 1 Vizio SmartCast TV | 2 hours |
| **Roku Tests** | 1 TCL Roku TV | 1 hour |
| **Sharp Tests** | 1 Sharp Aquos display | 1 hour |
| **Integration Tests** | All above | 4 hours |
| **Total** | 6 TVs | **13 hours** |

---

## Decision Matrix

### For New Deployments (Buying TVs)

**Recommendation**: Sony BRAVIA Commercial

**Reasons**:
1. Most reliable network API
2. Power state detection (unique)
3. Official documentation
4. Commercial warranty
5. Easiest implementation

**Alternative**: Samsung Commercial if budget constrained

### For Existing Deployments (Mixed Brands)

**Priority Order**:
1. Implement Samsung (35% coverage)
2. Implement LG (60% total coverage)
3. Implement Sony (75% total coverage)
4. Implement Roku/TCL (85% total coverage)
5. Fall back to IR for remaining TVs

### For Budget-Conscious Projects

**Recommendation**: Roku/TCL

**Reasons**:
1. Lowest implementation cost (5 hours)
2. No pairing required
3. Very reliable API
4. Good market availability
5. Low purchase price

**Limitation**: Volume control is only up/down/mute

---

## Final Recommendations

### Best Overall Solution

**Multi-Brand Support with Priority Implementation**:

1. **Phase 1**: Samsung + Sony + LG (33 hours, 75% coverage)
2. **Phase 2**: Roku + Vizio (17 hours, 95% coverage)
3. **Fallback**: IR control for unsupported brands (5% coverage)

### Simplest Solution

**Single Brand Deployment**:

- Choose **Sony BRAVIA Commercial** for new installations
- Implement Sony client only (8 hours)
- 100% coverage, most reliable control

### Budget Solution

**Consumer TVs with Network Control**:

- Choose **TCL Roku TVs** for cost effectiveness
- Implement Roku client only (5 hours)
- Good enough for most sports bar use cases
- Accept limitation of relative-only volume control

---

## Related Documents

- **Full Technical Details**: [TV_NETWORK_CONTROL_PROTOCOLS_TECHNICAL_PLAN.md](./TV_NETWORK_CONTROL_PROTOCOLS_TECHNICAL_PLAN.md)
- **Quick Reference**: [TV_NETWORK_CONTROL_QUICK_REFERENCE.md](./TV_NETWORK_CONTROL_QUICK_REFERENCE.md)
- **UX Specification**: [TV_DISCOVERY_UX_SPECIFICATION.md](./TV_DISCOVERY_UX_SPECIFICATION.md)
- **Implementation Notes**: [TV_DISCOVERY_IMPLEMENTATION_NOTES.md](./TV_DISCOVERY_IMPLEMENTATION_NOTES.md)
