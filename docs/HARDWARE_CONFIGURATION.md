# Hardware Configuration Guide

Complete hardware setup and configuration documentation for the Sports Bar TV Controller system.

**Last Updated:** November 2, 2025

## Table of Contents

- [System Overview](#system-overview)
- [Hardware Components](#hardware-components)
- [Network Configuration](#network-configuration)
- [Matrix Switcher Setup](#matrix-switcher-setup)
- [CEC Adapter Configuration](#cec-adapter-configuration)
- [Audio Processor Setup](#audio-processor-setup)
- [dbx ZonePRO Setup](#5-dbx-zonepro-audio-processor)
- [Device Inventory](#device-inventory)
- [Troubleshooting](#troubleshooting)

---

## System Overview

The Sports Bar TV Controller system integrates multiple hardware components to provide centralized control of audio/video distribution, TV control, and music management.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│              Control Server (Intel NUC)                  │
│                                                          │
│  - Sports Bar TV Controller Application                 │
│  - Ollama AI Engine                                     │
│  - SQLite Database                                      │
│  - Node.js Runtime                                      │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Network (Gigabit Ethernet)
                  │
    ┌─────────────┼─────────────┬──────────────┬──────────────┐
    │             │             │              │              │
┌───▼────┐  ┌────▼────┐  ┌─────▼─────┐  ┌────▼─────┐  ┌────▼─────┐
│ Wolf   │  │ Pulse-  │  │ AtlasIED  │  │ Global   │  │ Fire TV  │
│ Pack   │  │ Eight   │  │ Audio     │  │ Cache    │  │ Devices  │
│ Matrix │  │ CEC     │  │ Processor │  │ IR       │  │          │
│        │  │ Adapter │  │           │  │ Blaster  │  │          │
└───┬────┘  └────┬────┘  └─────┬─────┘  └────┬─────┘  └──────────┘
    │            │             │              │
    │            │             │              │
    ▼            ▼             ▼              ▼
┌─────────────────────────────────────────────────────────┐
│              Display & Audio Endpoints                   │
│                                                          │
│  - 25+ HDTVs (via HDMI)                                 │
│  - Audio Zones (AtlasIED outputs)                       │
│  - Cable Boxes (via IR/CEC)                             │
│  - Streaming Devices                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Hardware Components

### 1. Control Server

**Recommended Hardware:**
- **Model:** Intel NUC13ANHi5 or equivalent
- **CPU:** Intel Core i5 (4+ cores)
- **RAM:** 16GB DDR4
- **Storage:** 512GB NVMe SSD
- **Network:** Gigabit Ethernet (required)
- **OS:** Ubuntu 22.04 LTS or Debian 11+

**Network Requirements:**
- Static IP address on local network
- Access to all hardware components on same subnet
- Internet access for API services (Sports Guide, Soundtrack)

**Power:**
- UPS recommended for critical operations
- Auto-restart on power failure

---

### 2. Wolf Pack HDMI Matrix Switcher

**Model:** Wolf Pack 4K HDMI Matrix (various sizes: 8x8, 16x16, 36x36, etc.)

**Specifications:**
- **Resolution:** 4K@60Hz with HDR support
- **Control:** HTTP Web API (recommended) or TCP/UDP (legacy, unreliable)
- **Protocol:** HTTP

**IMPORTANT:** The Wolf Pack's TCP port 5000 is known to be non-functional on all tested units - it responds "OK" to any command (including garbage) but never actually switches routes. Always use the HTTP web API.

**Network Configuration:**
- **IP Address:** 192.168.1.100 (example - configure to your network)
- **Subnet Mask:** 255.255.255.0
- **Gateway:** 192.168.1.1
- **Web Interface:** `http://<ip>/` (login: admin/admin)

**HTTP API Protocol:**
- **Login:** `POST http://<ip>/login.php` with body `username=admin&password=admin` (form-encoded)
- **Route:** `GET http://<ip>/get_json_cmd.php?cmd=o2ox&prm={input_0based},{output_0based},` with session cookie
- **Response:** JSON array where index = output (0-based), value = input (0-based)
- **Verification:** Check `responseArray[output] === input` to confirm the route took effect

**Test connectivity:**
```bash
# Verify Wolf Pack web interface is reachable
curl -s -o /dev/null -w "%{http_code}" http://192.168.1.100/login.php
# Should return 200
```

**Inputs (Example Configuration):**
1. Fire TV Cube #1
2. Fire TV Cube #2
3. Fire TV Cube #3
4. Fire TV Cube #4
5. Cable Box
6. Streaming Box

**Outputs (Example Configuration):**
- Outputs 1-32: Individual TVs throughout venue
- Outputs 33-36: Audio matrix outputs (routed to audio processor)
- Configure output labels in application

**Setup Script:**
```bash
npx tsx scripts/seed-wolfpack-config.ts --name "My Bar" --ip 192.168.1.100 --model WP-36X36
```

---

### 3. Pulse-Eight USB CEC Adapter

**Model:** Pulse-Eight USB-CEC Adapter

**Purpose:**
- Control TV power (on/standby)
- Control cable boxes via HDMI-CEC
- Monitor CEC device status

**Connection:**
- USB connection to control server
- HDMI connection to Wolf Pack matrix input or output
- One adapter can control devices on the HDMI bus

**Driver Installation:**
```bash
# Install libCEC drivers (automated by installer)
sudo apt-get install libcec-dev cec-utils

# Test CEC adapter
echo 'scan' | cec-client -s -d 1

# List CEC devices
echo 'scan' | cec-client -s -d 1 | grep 'device #'
```

**CEC Addresses:**
- `0.0.0.0` - TV (primary display)
- `1.0.0.0` - Recording Device (cable box, DVR)
- `3.0.0.0` - Tuner
- `4.0.0.0` - Playback Device (streaming device)
- `5.0.0.0` - Audio System

**Supported Commands:**
- Power On: `on`
- Standby: `standby`
- Set Active Source: `as`

**Configuration in Application:**
1. Navigate to CEC Discovery page
2. Click "Scan for Devices"
3. Map discovered devices to TVs/outputs
4. Test power control

---

### 4. AtlasIED Audio Processor

**Model:** AtlasIED Atmosphere AZM4 or AZM8

**Specifications:**
- **Inputs:** 4 or 8 audio inputs
- **Outputs:** Multiple zone outputs
- **Control:** TCP/IP (custom protocol)
- **Default Port:** 5321

**Network Configuration:**
- **IP Address:** 192.168.1.50 (example - configure to your network)
- **Subnet Mask:** 255.255.255.0
- **Port:** 5321 (TCP)

**Control Protocol:**
- Method: `get`, `set`, `sub` (subscribe)
- Format: JSON-based commands
- Example: `{"method":"get","param":"/IO/Input/1/Gain","format":"str"}`

**Audio Sources:**
1. Soundtrack Your Brand (commercial music)
2. TV Audio (HDMI audio extraction)
3. Background Music
4. Microphone Input

**Zone Configuration:**
- Zone 1: Main Bar
- Zone 2: Dining Area
- Zone 3: Patio
- Zone 4: Private Room

**Integration:**
1. Configure processor IP in Audio Control Center
2. Define inputs and outputs
3. Set up routing matrix
4. Configure AI-powered gain control (optional)

---

### 5. dbx ZonePRO Audio Processor

**Models:** 640, 640m, 641, 641m, 1260, 1260m, 1261, 1261m

The M-series variants (640m, 641m, 1260m, 1261m) support 3rd-party TCP control, which is required for integration with this system.

**Specifications:**
- **Zones:** 6 (1260/1260m) or 12 (1261/1261m) output zones
- **Control:** TCP/IP (HiQnet protocol)
- **Port:** 3804
- **Protocol:** Raw HiQnet frames (NOT RS-232 framing)

**Network Configuration:**
- **IP Address:** 192.168.10.50 (example - Lucky's 1313 deployment)
- **TCP Port:** 3804
- **Node Address:** 30 (configurable in ZonePRO Designer)
- **Web Interface:** `http://<ip>/` (admin/admin) — firmware updates only, not used for control

**CRITICAL: TCP vs RS-232 Framing Difference:**

The dbx ZonePRO supports two different communication protocols depending on the transport layer. Using the wrong framing will silently fail.

| | RS-232 (Serial) | TCP (Port 3804) |
|---|---|---|
| **Prefix** | F0/64/00 | None |
| **Checksum** | Required | None |
| **Transport** | Serial port (RS-232) | TCP socket |
| **Frame** | Wrapped HiQnet | Raw HiQnet only |

**Do NOT use RS-232 framing over TCP.** Commands will be silently ignored.

**TCP Frame Format:**
```
Version(01) + Length(4 bytes) + SrcVD(2) + SrcObj(4) + DstVD(2) + DstObj(4) + MsgID(2) + Flags(2) + Payload
```

| Field | Value | Description |
|-------|-------|-------------|
| Version | `0x01` | Protocol version |
| Length | 4 bytes | Total frame length |
| Source VD | `0x0033` | 3rd-party controller identifier |
| Source Object | (mirror dest) | Mirror the destination object ID |
| Dest VD | e.g., `0x001E` | Device node address (30 = 0x001E) |
| Dest Object | e.g., `0x0105001F` | Target router object |
| MSG_ID | `0x0100` | MultiSVSet command |
| Flags | `0x0500` | Hop count 5 |

**Router Object Addressing:**

Object IDs depend on the ZonePRO Designer configuration. The general formula is `0x00010000 + (zone_0based + 1)`, but this varies per installation. Confirm object IDs using ZonePRO Designer software.

| Zone | Object ID | Description |
|------|-----------|-------------|
| Ch1 (Lucky's Main Bar) | `0x0105001F` | Router for zone 1 |
| Ch2 (Lucky's Banquet) | `0x01050020` | Router for zone 2 |

**State Variable (SV) IDs for Router Objects:**

| SV ID | Name | Data Type | Range | Description |
|-------|------|-----------|-------|-------------|
| `0x0000` | Input Source | UBYTE | 0-based index | Source selection (see mapping below) |
| `0x0001` | Fader/Volume | UWORD | 0-415 | Volume level |
| `0x0002` | Mute | UBYTE | 0 or 1 | 0=unmuted, 1=muted |

**Volume Safety:** Normal listening level is approximately 95. Do not test above 125. Maximum value is 415.

**MultiSVSet Payload Format:**
```
NumSVs(2 bytes) + SV_ID(2) + DataType(1) + Value(varies)
```

**Source Index Mapping (Lucky's 1313 Example):**

| Index | Source | Notes |
|-------|--------|-------|
| 0 | None | No source selected |
| 1 | ML1 | Mic/Line input 1 |
| 2 | ML2 | Mic/Line input 2 |
| 3 | DJ | ML3/ML4 stereo pair |
| 4 | ML4 | Mic/Line input 4 |
| 5 | ML5 | Mic/Line input 5 |
| 6 | ML6 | Unused |
| 7 | S1 (Jukebox) | S/PDIF input 1 |
| 8 | S2 (TV1) | S/PDIF input 2 |
| 9 | S3 (TV2) | S/PDIF input 3 |
| 10 | S4 (Spotify) | S/PDIF input 4 |

Source indices are 0-based and installation-specific. ML3/ML4 are a combined stereo DJ pair — selecting index 3 routes both channels.

**CRITICAL GOTCHA — Failsafe Mode:**

Opening a new TCP connection to the dbx ZonePRO triggers its built-in failsafe mode. This shifts source indices (e.g., Spotify may become S/PDIF), causing audio to route incorrectly.

**Fix:** The `DbxTcpClient` uses a `sceneOnConnect` setting to automatically recall Scene 1 on every new TCP connection. Scene recall restores normal routing after failsafe activation.

```typescript
// In packages/dbx-zonepro/ — sceneOnConnect triggers scene recall
// on each new TCP connection to counteract failsafe mode
```

**Protocol Characteristics:**
- **One-way / fire-and-forget:** No response is expected from the device
- **No keepalive:** Connections can be opened and closed per command
- **Scene recall required:** Always recall a scene after connecting to counteract failsafe

**Test Connectivity:**
```bash
# Verify TCP port is reachable
nc -zv 192.168.10.50 3804

# Check web interface (firmware updates only)
curl -s -o /dev/null -w "%{http_code}" http://192.168.10.50/
```

**Integration:**
1. Configure processor IP, port, and node address in the Audio Processor settings
2. Identify router object IDs using ZonePRO Designer software
3. Map source indices to physical inputs
4. Set `sceneOnConnect` to auto-recall Scene 1 on connection
5. Test volume, mute, and source selection per zone

---

### 6. Global Cache IR Blaster

**Model:** Global Cache iTach IP2IR

**Purpose:**
- Control cable boxes via infrared
- Control legacy devices without IP control
- Send channel change commands

**Network Configuration:**
- **IP Address:** 192.168.1.150 (example)
- **Port:** 4998 (IR control)

**IR Modules:**
- Module 1: Cable Box Zone 1
- Module 2: Cable Box Zone 2
- Module 3: Cable Box Zone 3

**Configuration:**
1. Connect IR emitters to cable boxes
2. Configure device in IR Devices page
3. Load IR codes from database
4. Test commands (power, channel change, volume)

**Supported Devices:**
- DirecTV receivers
- Cable boxes (Spectrum, Comcast, etc.)
- DVD/Blu-ray players
- Audio receivers

---

### 7. Fire TV Devices

**Model:** Fire TV Cube (3rd Gen) or Fire TV Stick 4K Max

**Purpose:**
- Streaming content (Netflix, Hulu, ESPN+, etc.)
- YouTube TV for sports
- Web browsing on TVs

**Network Configuration:**
- **Connection:** WiFi or Ethernet
- **IP Addresses:** Assign static IPs via DHCP reservation
- **ADB Port:** 5555 (for control)

**Example Configuration:**
- Fire TV Cube #1: `192.168.5.131` (Matrix Input 3)
- Fire TV Cube #2: `192.168.5.132` (Matrix Input 4)
- Fire TV Cube #3: `192.168.5.133` (Matrix Input 5)

**ADB Setup:**
```bash
# Enable ADB on Fire TV:
# Settings > My Fire TV > Developer Options > ADB Debugging > ON
# Settings > My Fire TV > Developer Options > Apps from Unknown Sources > ON

# Connect from server:
adb connect 192.168.5.131:5555

# Test connection:
adb devices

# Send command:
adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_HOME
```

**Supported Commands:**
- Launch app: `am start -n [package]/[activity]`
- Key events: `input keyevent [KEYCODE]`
- Text input: `input text "search term"`

---

## Device Inventory

### Current Hardware Inventory

| Device Type | Quantity | Model | IP Address(es) | Purpose |
|------------|----------|-------|----------------|---------|
| Control Server | 1 | Intel NUC13ANHi5 | 192.168.1.10 | Application host |
| Matrix Switcher | 1 | Wolf Pack 16x16 | 192.168.1.100 | HDMI routing |
| CEC Adapter | 1 | Pulse-Eight USB-CEC | USB (N/A) | TV/CEC control |
| Audio Processor | 1 | AtlasIED AZM8 | 192.168.1.50 | Audio routing |
| Audio Processor | 1 | dbx ZonePRO 1260m | 192.168.10.50 | Zone audio (Lucky's) |
| IR Blaster | 1 | Global Cache iTach | 192.168.1.150 | IR control |
| Fire TV Cubes | 3 | Fire TV Cube 3rd Gen | 192.168.5.131-133 | Streaming |
| HDTVs | 25 | Various | N/A | Display endpoints |
| Cable Boxes | 5 | Various | N/A | Cable TV |

### IP Address Allocations

**Management Network (192.168.1.0/24):**
- `192.168.1.1` - Network Gateway/Router
- `192.168.1.10` - Control Server (Intel NUC)
- `192.168.1.50` - AtlasIED Audio Processor
- `192.168.1.100` - Wolf Pack Matrix
- `192.168.1.150` - Global Cache IR Blaster

**Streaming Devices (192.168.5.0/24):**
- `192.168.5.131` - Fire TV Cube #1
- `192.168.5.132` - Fire TV Cube #2
- `192.168.5.133` - Fire TV Cube #3

**Best Practices:**
- Use DHCP reservations for all devices
- Document all IP changes
- Keep network diagram updated
- Use consistent IP ranges for device types

---

## Network Configuration

### Required Network Setup

**Firewall Rules:**
```bash
# Allow incoming connections to control server
# Port 3000 - Web interface
# Port 5555 - ADB (Fire TV)
# Port 23 - Telnet (Wolf Pack)
# Port 5321 - AtlasIED
# Port 3804 - dbx ZonePRO
# Port 4998 - Global Cache
```

**VLAN Setup (Optional but Recommended):**
- VLAN 10: Management (control server, admin access)
- VLAN 20: AV Equipment (matrix, audio, IR)
- VLAN 30: Streaming Devices (Fire TVs)
- VLAN 40: Display Network (TVs, if IP-enabled)

**DNS Configuration:**
- Configure DNS servers for internet access
- Required for: Sports Guide API, Soundtrack API, streaming services

**QoS (Quality of Service):**
- Priority 1: Control traffic (matrix commands, CEC)
- Priority 2: Audio streaming (Soundtrack)
- Priority 3: Video streaming (Fire TV)

---

## Troubleshooting

### Matrix Switcher Issues

**Problem:** Cannot connect to matrix
```bash
# Test network connectivity
ping 192.168.1.100

# Test HTTP web interface
curl -s -o /dev/null -w "%{http_code}" http://192.168.1.100/login.php

# If connection fails:
# 1. Check network cable
# 2. Verify IP address on matrix front panel
# 3. Check firewall rules
# 4. Restart matrix (power cycle)
```

**Problem:** Routes not switching
- Verify protocol is set to HTTP in Matrix Control settings (NOT TCP)
- TCP port 5000 is non-functional on Wolf Pack units - always use HTTP
- Check PM2 logs for `[WOLFPACK-HTTP]` messages to see verification results
- If HTTP response shows `65535` for an output, that output slot is disconnected

### CEC Adapter Issues

**Problem:** CEC devices not detected
```bash
# Check USB connection
lsusb | grep -i pulse

# Test CEC adapter
echo 'scan' | cec-client -s -d 1

# Reinstall drivers if needed
sudo apt-get install --reinstall libcec-dev cec-utils
```

**Problem:** TV power control not working
- Verify HDMI cable connection
- Check TV CEC settings (must be enabled)
- Try different CEC address
- Some TVs require "Anynet+" or "Bravia Sync" enabled

### Audio Processor Issues

**Problem:** Cannot connect to AtlasIED
```bash
# Test connectivity
nc -zv 192.168.1.50 5321

# Check processor web interface
# Navigate to: http://192.168.1.50
```

**Problem:** No audio output
- Check source routing in Audio Control Center
- Verify input levels are not muted
- Check physical connections
- Verify zone is enabled

### dbx ZonePRO Issues

**Problem:** Cannot connect to dbx ZonePRO
```bash
# Test TCP connectivity
nc -zv 192.168.10.50 3804

# If connection refused, check:
# 1. Verify IP address is correct
# 2. Ensure M-series firmware (non-M models lack TCP control)
# 3. Check if ZonePRO Designer PC is blocking the port (192.168.10.199)
```

**Problem:** Commands sent but no audio change
- Verify you are NOT using RS-232 framing (F0/64/00 prefix) over TCP
- Check that the destination object ID matches the ZonePRO Designer configuration
- Confirm the node address (VD) is correct (e.g., 0x001E for node 30)
- Check PM2 logs for `[DBX]` messages

**Problem:** Audio sources shifted after reconnecting
- This is the failsafe mode issue — TCP connections trigger failsafe
- Ensure `sceneOnConnect` is enabled in the dbx configuration
- Scene 1 must be saved in ZonePRO Designer with correct routing
- Verify scene recall is happening by checking logs for scene recall messages

**Problem:** Volume commands have no effect
- Confirm the correct SV ID (0x0001 for fader)
- Check that value is UWORD format (2 bytes) in range 0-415
- Try mute/unmute (SV 0x0002) first as a simpler test

### Fire TV Issues

**Problem:** ADB connection fails
```bash
# Reconnect to device
adb connect 192.168.5.131:5555

# If fails, restart ADB server
adb kill-server
adb start-server

# Check Fire TV ADB settings
# Settings > My Fire TV > Developer Options > ADB Debugging
```

**Problem:** Device offline
- Verify IP address (may have changed)
- Check WiFi/Ethernet connection on Fire TV
- Restart Fire TV device
- Update device record in application

### IR Blaster Issues

**Problem:** IR commands not working
- Check IR emitter placement (must face IR receiver)
- Verify correct IR code database loaded
- Test with different IR codes
- Check Global Cache network connection

---

## Maintenance Schedule

### Daily
- Monitor system health dashboard
- Check for offline devices
- Review error logs

### Weekly
- Test CEC power control
- Verify matrix routing
- Check audio zone status
- Update Fire TV devices if needed

### Monthly
- Backup configuration database
- Update firmware (if available)
- Clean IR emitters and sensors
- Test all backup/restore procedures

### Quarterly
- Full system health check
- Network security audit
- Hardware inspection
- Update documentation

---

## Hardware Expansion

### Adding TVs
1. Connect TV to available matrix output
2. Configure output label in application
3. Test HDMI signal
4. Set up CEC control (if supported)
5. Update documentation

### Adding Fire TV Devices
1. Connect Fire TV to network
2. Assign static IP via DHCP
3. Enable ADB debugging
4. Connect to matrix input
5. Add device in application
6. Test connectivity and commands

### Adding Audio Zones
1. Connect zone output on AtlasIED
2. Configure zone in Audio Control Center
3. Set up routing
4. Test audio levels
5. Configure Soundtrack player (if applicable)

---

## Support Resources

- **Wolf Pack Manual:** Check manufacturer documentation
- **Pulse-Eight Support:** https://www.pulse-eight.com/support
- **AtlasIED Documentation:** https://www.atlasied.com
- **Fire TV ADB Reference:** https://developer.amazon.com/docs/fire-tv/connecting-adb-to-device.html

---

## Safety and Best Practices

1. **Power Management**
   - Use UPS for control server
   - Label all power connections
   - Document power-on sequence

2. **Cable Management**
   - Label all HDMI cables
   - Use cable ties and management
   - Document cable runs

3. **Network Security**
   - Change default passwords
   - Use VLANs where possible
   - Restrict external access
   - Keep firmware updated

4. **Documentation**
   - Keep this document updated
   - Document all configuration changes
   - Maintain IP address spreadsheet
   - Take photos of connections

---

**Note:** This hardware configuration is based on a typical sports bar installation. Adjust IP addresses, device counts, and configurations to match your specific setup.
