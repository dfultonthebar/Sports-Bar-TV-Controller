# DirecTV Box Status Report
**Investigation Date:** November 19, 2025
**Report Generated:** 2025-11-19T17:05:10Z
**Server:** 192.168.5.99 (Sports-Bar-TV-Controller)

---

## Executive Summary

**Status Overview:**
- **Online:** 2/8 devices (25%)
- **Offline:** 6/8 devices (75%)
- **Partially Reachable:** 2 devices respond to ping but have SHEF API disabled

**Critical Findings:**
1. Only devices on the **192.168.5.x** subnet are fully accessible (2/3 devices)
2. Devices on the **192.168.1.x** subnet have network/configuration issues (0/5 devices operational)
3. Two devices (TV 5 & TV 8) are online but have **port 8080 closed** (SHEF API disabled)
4. Three devices on 192.168.1.x appear to be **offline or have incorrect IP addresses**
5. One device on 192.168.5.x (TV 3) is **completely offline**

---

## Network Architecture Analysis

### Current Server Configuration
```
Interface: enp86s0
IP Address: 192.168.5.99/24
Gateway: 192.168.5.254
Routing Table:
  - 192.168.5.0/24 (local subnet) ✓ Accessible
  - 192.168.1.0/24 (remote subnet) ⚠️ Routed via gateway
```

### Subnet Distribution
| Subnet | Total Devices | Online | Offline | Success Rate |
|--------|---------------|--------|---------|--------------|
| 192.168.5.x | 3 | 2 | 1 | 66.7% |
| 192.168.1.x | 5 | 0 | 5 | 0% |

**Analysis:** The server is on 192.168.5.x and can only reliably communicate with devices on the same subnet. Devices on 192.168.1.x are either on a different physical network segment or behind a gateway that may have routing/firewall restrictions.

---

## Per-Device Analysis

### ✅ Direct TV 1 (192.168.5.121:8080) - **ONLINE**
**Receiver Type:** h24/100 (Standard HD Receiver)
**Input Channel:** 5
**Subnet:** 192.168.5.x (local)

**Test Results:**
- ✓ Ping: Success (2.77ms)
- ✓ Port 8080: Open
- ✓ SHEF API: Responding (2735ms)

**Device Information:**
- **Access Card ID:** 0018-3267-7643
- **Receiver ID:** 0354 1450 5525
- **Software Version:** 0xf3e
- **SHEF API Version:** 1.12
- **System Time:** 1763572162 (Unix timestamp)
- **Current Channel:** 9561 (NFLHD - "Upcoming: Jaguars @ Cardinals")
- **Channel Type:** Pay-Per-View (PPV)
- **Recording Status:** Not recording

**API Capabilities:**
- /info/getVersion ✓
- /info/getOptions ✓
- /info/getLocations ✓
- /info/mode ✓
- /tv/getTuned ✓
- /remote/processKey ✓
- /tv/tune ✓
- /tv/getProgInfo ✗ (Forbidden - requires channel parameter)

**Diagnosis:** Device is fully operational. All SHEF API endpoints responding correctly.

---

### ✅ Direct TV 2 (192.168.5.122:8080) - **ONLINE**
**Receiver Type:** h24/100 (Standard HD Receiver)
**Input Channel:** 6
**Subnet:** 192.168.5.x (local)

**Test Results:**
- ✓ Ping: Success (2.76ms)
- ✓ Port 8080: Open
- ✓ SHEF API: Responding (382ms)

**Device Information:**
- **Access Card ID:** 0018-1782-1356
- **Receiver ID:** 0354 1524 6517
- **Software Version:** 0xf3e
- **SHEF API Version:** 1.12
- **System Time:** 1763572164 (Unix timestamp)
- **Current Channel:** 11 (WLUK - "Access Daily With Mario & Kit")
- **Channel Type:** Standard broadcast (TV-PG)
- **Recording Status:** Not recording

**API Capabilities:**
- /info/getVersion ✓
- /info/getOptions ✓
- /info/getLocations ✓
- /info/mode ✓
- /tv/getTuned ✓
- /remote/processKey ✓
- /tv/tune ✓
- /tv/getProgInfo ✗ (Forbidden - requires channel parameter)

**Diagnosis:** Device is fully operational. All SHEF API endpoints responding correctly. This box has the fastest response time (382ms vs 2735ms for TV 1).

---

### ❌ Direct TV 3 (192.168.5.123:8080) - **OFFLINE**
**Receiver Type:** h24/100 (Standard HD Receiver)
**Input Channel:** 7
**Subnet:** 192.168.5.x (local)

**Test Results:**
- ✗ Ping: Failed (no response)
- ✗ Port 8080: No route to host
- ✗ SHEF API: Not tested (device unreachable)

**Diagnosis:** Device is completely offline or powered off. Since it's on the same subnet as the working devices (192.168.5.x), the IP address is likely correct. **Action Required:** Check physical device - may be unplugged or powered off.

---

### ❌ Direct TV 4 (192.168.1.124:8080) - **OFFLINE**
**Receiver Type:** Genie HD DVR
**Input Channel:** 8
**Subnet:** 192.168.1.x (remote)

**Test Results:**
- ✗ Ping: Failed (command failed)
- ✗ Port 8080: Connection failed
- ✗ SHEF API: Not tested (device unreachable)

**Diagnosis:** Device is not responding to network requests. Could be:
1. Powered off or disconnected
2. IP address has changed
3. Device is on a separate physical network segment
4. Gateway/router is blocking traffic between subnets

**Action Required:** Verify device IP address on the receiver's menu (Menu > Settings > Info & Test > Network).

---

### ⚠️ Direct TV 5 (192.168.1.125:8080) - **PARTIAL CONNECTIVITY**
**Receiver Type:** Genie HD DVR
**Input Channel:** 9
**Subnet:** 192.168.1.x (remote)

**Test Results:**
- ✓ Ping: Success (15.3ms) - **Device is online!**
- ✗ Port 8080: **Connection refused** (port closed)
- ✗ SHEF API: Not responding (port blocked)

**Diagnosis:** Device is online and reachable on the network, but **SHEF API is disabled**. Port 8080 is actively refusing connections, meaning the device is listening but has the API feature turned off.

**Root Cause:** DirecTV SHEF (Set-top-box Home Entertainment Format) API must be manually enabled in receiver settings.

**Action Required:**
1. Access receiver settings: **Menu > Settings > Whole-Home > External Device**
2. Enable **"SHEF"** or **"Network Remote Control"**
3. Verify port 8080 opens after enabling
4. Reboot receiver if necessary

---

### ❌ Direct TV 6 (192.168.1.126:8080) - **OFFLINE**
**Receiver Type:** Genie HD DVR
**Input Channel:** 10
**Subnet:** 192.168.1.x (remote)

**Test Results:**
- ✗ Ping: Failed (command failed)
- ✗ Port 8080: Connection failed
- ✗ SHEF API: Not tested (device unreachable)

**Diagnosis:** Same as Direct TV 4 - device is not responding to network requests.

**Action Required:** Verify device IP address and power status.

---

### ❌ Direct TV 7 (192.168.1.127:8080) - **OFFLINE**
**Receiver Type:** Genie HD DVR
**Input Channel:** 11
**Subnet:** 192.168.1.x (remote)

**Test Results:**
- ✗ Ping: Failed (command failed)
- ✗ Port 8080: Connection failed
- ✗ SHEF API: Not tested (device unreachable)

**Diagnosis:** Same as Direct TV 4 & 6 - device is not responding to network requests.

**Action Required:** Verify device IP address and power status.

---

### ⚠️ Direct TV 8 (192.168.1.128:8080) - **PARTIAL CONNECTIVITY**
**Receiver Type:** Genie HD DVR
**Input Channel:** 12
**Subnet:** 192.168.1.x (remote)

**Test Results:**
- ✓ Ping: Success (51.9ms) - **Device is online!**
- ✗ Port 8080: **Connection refused** (port closed)
- ✗ SHEF API: Not responding (port blocked)

**Diagnosis:** Same as Direct TV 5 - device is online but **SHEF API is disabled**.

**Action Required:** Enable SHEF API in receiver settings (see Direct TV 5 instructions above).

---

## Root Cause Analysis

### Primary Issues Identified

#### 1. **SHEF API Disabled** (2 devices: TV 5, TV 8)
**Affected Devices:** Direct TV 5 (192.168.1.125), Direct TV 8 (192.168.1.128)

**Symptoms:**
- Devices respond to ping ✓
- Port 8080 refuses connections ✗
- Network connectivity is functional

**Root Cause:** DirecTV receivers ship with SHEF API **disabled by default** for security. The external network control feature must be manually enabled in settings.

**Fix:** Enable SHEF on each receiver:
```
Menu > Settings > Whole-Home > External Device > SHEF: Enable
OR
Settings > Network > Network Remote Control: Enable
```

**Expected Result:** Port 8080 will open and API will respond.

---

#### 2. **Network Connectivity Issues** (4 devices: TV 3, TV 4, TV 6, TV 7)
**Affected Devices:** Direct TV 3 (192.168.5.123), Direct TV 4 (192.168.1.124), Direct TV 6 (192.168.1.126), Direct TV 7 (192.168.1.127)

**Symptoms:**
- Devices do not respond to ping ✗
- No network connectivity ✗
- API unreachable ✗

**Possible Causes:**
1. **Devices are powered off** - Most likely for TV 3 (same subnet as working devices)
2. **IP addresses have changed** - DHCP may have reassigned IPs
3. **Different physical network** - 192.168.1.x devices may be on separate VLAN/switch
4. **Network cable disconnected** - Physical connectivity issue

**Fix Steps:**
1. Check if receivers are powered on
2. Verify IP addresses on each receiver:
   ```
   Menu > Settings > Info & Test > Network > IP Address
   ```
3. Update `/home/ubuntu/Sports-Bar-TV-Controller/data/directv-devices.json` with correct IPs
4. Check network cables and switch ports
5. Verify gateway (192.168.5.254) has route to 192.168.1.0/24 subnet

---

#### 3. **Subnet Isolation** (192.168.1.x vs 192.168.5.x)
**Problem:** Server at 192.168.5.99 can only reliably access devices on 192.168.5.x subnet.

**Current Routing:**
```bash
$ ip route
default via 192.168.5.254 dev enp86s0
192.168.5.0/24 dev enp86s0 (local subnet)
```

**Analysis:**
- Server has route to 192.168.1.x via default gateway (192.168.5.254)
- Some devices on 192.168.1.x respond to ping (TV 5 & TV 8)
- This indicates gateway IS routing between subnets
- **BUT**: High ping times (15-51ms) suggest traffic is going through multiple hops

**Recommendation:** Consider moving all DirecTV receivers to the same subnet (192.168.5.x) for optimal performance and simplified management. If separate subnets are required, ensure:
1. Gateway properly routes between subnets
2. Firewall rules allow port 8080 traffic
3. No VLAN isolation between subnets

---

## DirecTV SHEF API Documentation

Based on the API query results, here are the available endpoints:

### Supported Endpoints

#### Device Information
| Endpoint | Description | Required Parameters | Response Time |
|----------|-------------|---------------------|---------------|
| `/info/getVersion` | Software version, receiver ID, access card | None | ~500-2700ms |
| `/info/getOptions` | List all available API endpoints | None | ~400-2800ms |
| `/info/getSerialNum` | STB serial number | None | Unknown |
| `/info/getLocations` | Available client locations | None | ~400-2800ms |
| `/info/mode` | Current STB mode/state | None | ~400-2800ms |

#### Channel Control
| Endpoint | Description | Required Parameters | Response Time |
|----------|-------------|---------------------|---------------|
| `/tv/getTuned` | Currently tuned channel info | None | ~400-2800ms |
| `/tv/tune` | Change channel | `major` (channel number) | Unknown |
| `/tv/getProgInfo` | Program info for specific channel | `major` (channel number) | N/A (403 without params) |

#### Remote Control
| Endpoint | Description | Required Parameters | Response Time |
|----------|-------------|---------------------|---------------|
| `/remote/processKey` | Send remote control key | `key` (e.g., KEY_INFO) | Unknown |
| `/serial/processCommand` | Send serial command | `cmd` (hex command) | Unknown |

### Example API Calls

```bash
# Get device version
curl http://192.168.5.121:8080/info/getVersion

# Get currently tuned channel
curl http://192.168.5.121:8080/tv/getTuned

# Change to channel 206 (ESPN)
curl "http://192.168.5.121:8080/tv/tune?major=206"

# Send INFO key press
curl "http://192.168.5.121:8080/remote/processKey?key=KEY_INFO&hold=keyPress"

# Get program info for channel 212 (NFL RedZone)
curl "http://192.168.5.121:8080/tv/getProgInfo?major=212"
```

---

## Recommendations

### Immediate Actions (Priority 1)

1. **Enable SHEF API on TV 5 & TV 8** ⚠️ Critical
   - Impact: +2 devices online (50% improvement)
   - Effort: 5 minutes per device
   - Steps:
     1. Navigate to receiver menu
     2. Enable SHEF/Network Remote Control
     3. Verify port 8080 opens
     4. Test API connectivity

2. **Check Power Status of TV 3** 🔌
   - Impact: +1 device potentially online
   - Effort: 1 minute
   - Device is on same subnet as working devices, likely just powered off

3. **Verify IP Addresses for TV 4, 6, 7** 📍
   - Impact: +3 devices potentially online
   - Effort: 5 minutes per device
   - Steps:
     1. Access receiver: Menu > Settings > Info & Test > Network
     2. Record actual IP address
     3. Update `directv-devices.json` with correct IPs
     4. Re-test connectivity

### Medium-Term Actions (Priority 2)

4. **Standardize Network Configuration** 🌐
   - Move all DirecTV receivers to 192.168.5.x subnet
   - Benefits:
     - Simplified routing (no gateway hops)
     - Lower latency (2-3ms vs 15-50ms)
     - Easier troubleshooting
     - More reliable connectivity

5. **Implement Automated Health Checks** 🔍
   - Schedule periodic connectivity tests
   - Alert on device failures
   - Log network changes
   - Track uptime statistics

6. **Document Network Topology** 📋
   - Create network diagram showing:
     - Server location (192.168.5.99)
     - DirecTV receiver locations
     - Switch/router configuration
     - VLAN assignments (if any)

### Long-Term Actions (Priority 3)

7. **Consider IP Reservation (Static IPs)** 🔒
   - Prevents DHCP reassignment issues
   - More reliable service
   - Recommended for all 8 receivers

8. **Upgrade Firmware** 💾
   - Both online receivers run software version 0xf3e
   - Check for newer versions that may improve API stability

9. **Explore Genie Whole-Home Features** 🏠
   - Devices 4-8 are Genie DVRs with whole-home capabilities
   - May have additional API features not available on h24/100 receivers
   - Could enable centralized control through main Genie server

---

## Configuration File Update Needed

**File:** `/home/ubuntu/Sports-Bar-TV-Controller/data/directv-devices.json`

### Recommended Changes

```json
{
  "devices": [
    {
      "id": "directv_1759187217790",
      "name": "Direct TV 1",
      "ipAddress": "192.168.5.121",
      "port": 8080,
      "receiverType": "h24/100",
      "inputChannel": 5,
      "isOnline": true,
      "notes": "VERIFIED ONLINE - Software v0xf3e - Access Card 0018-3267-7643"
    },
    {
      "id": "directv_1759187265011",
      "name": "Direct TV 2",
      "ipAddress": "192.168.5.122",
      "port": 8080,
      "receiverType": "h24/100",
      "inputChannel": 6,
      "isOnline": true,
      "notes": "VERIFIED ONLINE - Software v0xf3e - Access Card 0018-1782-1356"
    },
    {
      "id": "directv_1759187398411",
      "name": "Direct TV 3",
      "ipAddress": "192.168.5.123",
      "port": 8080,
      "receiverType": "h24/100",
      "inputChannel": 7,
      "isOnline": false,
      "notes": "OFFLINE - Check power status - Same subnet as working devices"
    },
    {
      "id": "directv_1759187444390",
      "name": "Direct TV 4",
      "ipAddress": "192.168.1.124",
      "port": 8080,
      "receiverType": "Genie HD DVR",
      "inputChannel": 8,
      "isOnline": false,
      "notes": "OFFLINE - Verify IP address on receiver menu"
    },
    {
      "id": "directv_1759187476373",
      "name": "Direct TV 5",
      "ipAddress": "192.168.1.125",
      "port": 8080,
      "receiverType": "Genie HD DVR",
      "inputChannel": 9,
      "isOnline": false,
      "notes": "PARTIAL - Ping OK (15ms) - SHEF API DISABLED - Enable in settings"
    },
    {
      "id": "directv_1759187508606",
      "name": "Direct TV 6",
      "ipAddress": "192.168.1.126",
      "port": 8080,
      "receiverType": "Genie HD DVR",
      "inputChannel": 10,
      "isOnline": false,
      "notes": "OFFLINE - Verify IP address on receiver menu"
    },
    {
      "id": "directv_1759187540487",
      "name": "Direct TV 7",
      "ipAddress": "192.168.1.127",
      "port": 8080,
      "receiverType": "Genie HD DVR",
      "inputChannel": 11,
      "isOnline": false,
      "notes": "OFFLINE - Verify IP address on receiver menu"
    },
    {
      "id": "directv_1759187570875",
      "name": "Direct TV 8",
      "ipAddress": "192.168.1.128",
      "port": 8080,
      "receiverType": "Genie HD DVR",
      "inputChannel": 12,
      "isOnline": false,
      "notes": "PARTIAL - Ping OK (52ms) - SHEF API DISABLED - Enable in settings"
    }
  ]
}
```

---

## Technical Details

### Network Latency Analysis
| Device | Subnet | Ping Time | Status | Analysis |
|--------|--------|-----------|--------|----------|
| TV 1 | 192.168.5.x | 2.77ms | ✓ Online | Excellent - local subnet |
| TV 2 | 192.168.5.x | 2.76ms | ✓ Online | Excellent - local subnet |
| TV 3 | 192.168.5.x | N/A | ✗ Offline | Device powered off? |
| TV 5 | 192.168.1.x | 15.3ms | ⚠️ Partial | 5.5x slower - gateway hop |
| TV 8 | 192.168.1.x | 51.9ms | ⚠️ Partial | 18.8x slower - multiple hops? |

**Insight:** Even when 192.168.1.x devices are reachable, they have significantly higher latency (15-52ms vs 2-3ms). This suggests traffic is being routed through gateway and possibly multiple network devices.

### Software Version Analysis
- **Both online receivers:** Software version 0xf3e (hexadecimal)
- **SHEF API Version:** 1.12
- **Status:** Current versions appear stable
- **Note:** SHEF API includes warning in response: *"Warning: This command may change or be disabled in the future."*

### Receiver Model Differences
| Model | Count | Description | Capabilities |
|-------|-------|-------------|--------------|
| h24/100 | 3 | Standard HD Receiver | Basic HD, no DVR |
| Genie HD DVR | 5 | Advanced DVR | HD, DVR, Whole-Home, multiple tuners |

**Observation:** The Genie DVRs (devices 4-8) are on the problematic 192.168.1.x subnet. These are likely the main/primary receivers with more features. Getting these online should be the priority.

---

## Success Metrics

### Current State
- **API Accessible:** 2/8 (25%)
- **Network Reachable:** 4/8 (50%)
- **Fully Operational:** 2/8 (25%)

### Target State (After Fixes)
- **API Accessible:** 8/8 (100%)
- **Network Reachable:** 8/8 (100%)
- **Fully Operational:** 8/8 (100%)

### Quick Win Potential
By fixing SHEF API on TV 5 & TV 8: **50% operational** (4/8 devices)
By verifying IPs on TV 4, 6, 7: **87.5% operational** (7/8 devices)
By checking power on TV 3: **100% operational** (8/8 devices)

---

## Appendix: Raw Test Data

### Full Ping Results
```
TV 1 (192.168.5.121): Success - 2.77ms
TV 2 (192.168.5.122): Success - 2.76ms
TV 3 (192.168.5.123): Failed - Command failed
TV 4 (192.168.1.124): Failed - Command failed
TV 5 (192.168.1.125): Success - 15.3ms
TV 6 (192.168.1.126): Failed - Command failed
TV 7 (192.168.1.127): Failed - Command failed
TV 8 (192.168.1.128): Success - 51.9ms
```

### Port 8080 Status
```
TV 1 (192.168.5.121): OPEN
TV 2 (192.168.5.122): OPEN
TV 3 (192.168.5.123): No route to host
TV 4 (192.168.1.124): Connection failed
TV 5 (192.168.1.125): REFUSED (closed)
TV 6 (192.168.1.126): Connection failed
TV 7 (192.168.1.127): Connection failed
TV 8 (192.168.1.128): REFUSED (closed)
```

### SHEF API Response Times
```
TV 1 (192.168.5.121):
  - getVersion: 2735ms (first request, cold cache)
  - getOptions: ~2800ms
  - getTuned: ~2700ms

TV 2 (192.168.5.122):
  - getVersion: 382ms (faster, warm cache?)
  - getOptions: ~400ms
  - getTuned: ~400ms
```

---

## Investigation Scripts Created

Two diagnostic scripts were created during this investigation:

### 1. `/home/ubuntu/Sports-Bar-TV-Controller/scripts/test-all-directv-boxes.ts`
- Comprehensive connectivity testing
- Ping, port, and API tests for all 8 devices
- Root cause analysis
- Recommendations engine

### 2. `/home/ubuntu/Sports-Bar-TV-Controller/scripts/query-online-directv.ts`
- Detailed SHEF API endpoint testing
- Device information extraction
- Current channel/program data
- API capability discovery

**Usage:**
```bash
# Test all DirecTV boxes
npx tsx scripts/test-all-directv-boxes.ts

# Query online boxes for details
npx tsx scripts/query-online-directv.ts
```

---

## Contact for Next Steps

**Recommended Action:** Please physically access DirecTV receivers and:
1. Enable SHEF API on TV 5 & TV 8 (immediate +2 devices)
2. Check if TV 3 is powered on (potential +1 device)
3. Verify IP addresses on TV 4, 6, 7 (potential +3 devices)

Once these steps are completed, re-run the diagnostic scripts to verify improvements.

---

**Report End**
