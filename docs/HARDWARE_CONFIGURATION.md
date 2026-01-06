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

**Model:** Wolf Pack 4K HDMI Matrix (various sizes: 8x8, 16x16, etc.)

**Specifications:**
- **Resolution:** 4K@60Hz with HDR support
- **Control:** TCP/IP (Telnet protocol)
- **Default Port:** 23 (Telnet)
- **Protocol:** TCP or UDP

**Network Configuration:**
- **IP Address:** 192.168.1.100 (example - configure to your network)
- **Subnet Mask:** 255.255.255.0
- **Gateway:** 192.168.1.1
- **Port:** 23 (TCP)

**Command Format:**
- Input to Output: `IxOy.` (e.g., `I1O1.` routes input 1 to output 1)
- All outputs to one input: `IxOA.` (e.g., `I2OA.` routes input 2 to all outputs)
- Commands must end with a period (`.`)

**Connection:**
- Connect to network via Ethernet
- Assign static IP address via web interface or front panel
- Test connectivity: `telnet 192.168.1.100 23`

**Inputs (Example Configuration):**
1. DirecTV Satellite
2. Cable Box (Main)
3. Fire TV Cube #1
4. Fire TV Cube #2
5. PlayStation 5
6. Nintendo Switch
7. PC/Laptop (HDMI)
8. Streaming Box

**Outputs (Example Configuration):**
- Outputs 1-25: Individual TVs throughout venue
- Configure output labels in application

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

### 5. Global Cache IR Blaster

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

### 6. Fire TV Devices

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

# Test Telnet connection
telnet 192.168.1.100 23

# If connection fails:
# 1. Check network cable
# 2. Verify IP address on matrix front panel
# 3. Check firewall rules
# 4. Restart matrix (power cycle)
```

**Problem:** Commands not working
- Ensure commands end with period (`.`)
- Check command format: `IxOy.`
- Verify TCP vs UDP protocol setting
- Check for network latency

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
