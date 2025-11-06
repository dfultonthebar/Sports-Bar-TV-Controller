# Device Configuration Guide

**Last Updated:** November 6, 2025
**Version:** 2.0

---

## Table of Contents

1. [Overview](#overview)
2. [Fire TV Configuration](#fire-tv-configuration)
3. [DirecTV Configuration](#directv-configuration)
4. [IR Device Configuration](#ir-device-configuration)
5. [CEC Device Configuration](#cec-device-configuration)
6. [Matrix Switcher Configuration](#matrix-switcher-configuration)
7. [Audio Processor Configuration](#audio-processor-configuration)
8. [Device Best Practices](#device-best-practices)
9. [Troubleshooting Device Setup](#troubleshooting-device-setup)

---

## Overview

This guide provides detailed step-by-step instructions for configuring each type of device supported by the Sports Bar TV Controller system.

### Supported Device Types

| Device Type | Control Method | Primary Use Case |
|------------|---------------|------------------|
| Fire TV | ADB (Network) | Streaming apps (Prime, Netflix, etc.) |
| DirecTV | IP Control | Satellite TV service |
| IR Devices | Infrared | Cable boxes, legacy devices |
| CEC Devices | HDMI-CEC | Compatible cable boxes (limited) |
| Matrix Switcher | Telnet/IP | Video routing |
| Audio Processor | HTTP/IP | Audio zone control |

### Prerequisites

Before configuring any device:

- [ ] Device powered on and functional
- [ ] Device connected to network (if IP-controlled)
- [ ] Know device IP address (for network devices)
- [ ] Have device physical remote available (for IR learning)
- [ ] Admin access to Sports Bar TV Controller
- [ ] Documentation for specific device model

---

## Fire TV Configuration

### Overview

Fire TV devices (Fire TV Stick, Fire TV Cube, etc.) are controlled via ADB (Android Debug Bridge) over the network.

### Step 1: Enable Developer Mode

**On the Fire TV:**

1. Go to **Settings** (from home screen)
2. Select **My Fire TV** (or Device)
3. Select **About**
4. Click on **Serial Number** **7 times** rapidly
5. Message appears: "You are now a developer!"

### Step 2: Enable ADB Debugging

**On the Fire TV:**

1. Go back to **My Fire TV** menu
2. Select **Developer Options**
3. Turn on **ADB Debugging**
4. Turn on **Apps from Unknown Sources** (recommended)
5. Confirm both options are enabled

### Step 3: Find Fire TV IP Address

**Method 1: From Fire TV**
1. Settings → My Fire TV → About → Network
2. Note the **IP Address** (e.g., 192.168.1.50)

**Method 2: From Router**
1. Access router admin interface
2. Look for "Fire" or "Amazon" in connected devices
3. Note IP address

**Method 3: Network Scan**
```bash
# Scan network for Fire TV devices
nmap -p 5555 192.168.1.0/24
```

### Step 4: Add Device to System

**Via Admin Panel:**

1. Navigate to `/admin/firetv`
2. Click **"Add Fire TV Device"** button
3. Fill in the form:

   **Device Name:**
   - Use descriptive name: "TV 1 - Main Bar Fire TV"
   - Include location for easy identification

   **IP Address:**
   - Enter the IP noted in Step 3
   - Example: `192.168.1.50`

   **Port:**
   - Default: `5555`
   - Don't change unless specifically needed

   **Location (Optional):**
   - "Main Bar", "Dining Room", "Patio", etc.
   - Helps staff identify which TV

4. Click **"Save Device"**

### Step 5: Test Connection

**Initial Connection:**

1. Find device in list
2. Click **"Test Connection"** button
3. Wait for result

**Expected Results:**

**✅ Success:**
- Status shows "Connected"
- Green indicator appears
- Device appears in dashboard

**❌ First Connection - Authorization Required:**
- Status shows "Unauthorized"
- **Action:** Look at Fire TV screen
- **You'll see:** Authorization popup
- **Action:** Use Fire TV remote to select "Allow"
- **Action:** Check "Always allow from this computer"
- **Action:** Click OK on Fire TV
- **Then:** Click "Test Connection" again

**❌ Connection Failed:**
- See [Troubleshooting](#troubleshooting-fire-tv-setup) section

### Step 6: Configure Advanced Settings

**Optional Settings:**

**Auto-Reconnect:**
- Enable this to automatically reconnect if connection drops
- Recommended: **Enabled**

**Health Check Interval:**
- How often to check device status
- Default: 60 seconds
- Range: 30-300 seconds

**Restart on Failure:**
- Automatically restart ADB connection on failure
- Recommended: **Enabled**

**Max Retries:**
- Number of connection attempts before marking offline
- Default: 3
- Range: 1-10

### Step 7: Test Functionality

**Test Each Function:**

1. **Power Control:**
   - Send power command
   - Fire TV should wake or sleep

2. **Navigation:**
   - Send up/down/left/right commands
   - Verify Fire TV UI responds

3. **Home Button:**
   - Send home command
   - Fire TV should return to home screen

4. **App Launch:**
   - Try launching an app (e.g., Prime Video)
   - Verify app opens

### Fire TV Device Naming Best Practices

**Good Names:**
- "TV 1 - Main Bar Fire TV"
- "Patio TV 3 - Fire Stick"
- "Dining Room Left - Fire TV Cube"

**Avoid:**
- "Fire TV 1" (not descriptive)
- "Amazon Device" (ambiguous)
- Duplicate names

### Assigning Fire TV to TV Output

**If using HDMI Matrix:**

1. Note which matrix input Fire TV is connected to
2. In device configuration, set:
   - **Matrix Input:** Input number (1-16)
   - **Default Output:** TV output number (if dedicated)

**Direct HDMI Connection:**
- Note which TV the Fire TV connects to
- Document in location field

### Static IP Recommendation

**Why Use Static IP:**
- DHCP can change IP addresses
- Breaks connection when IP changes
- Requires reconfiguration

**How to Set Static IP:**

**Option 1: On Fire TV (Not Recommended - Limited)**
Fire TV doesn't support easy static IP configuration.

**Option 2: DHCP Reservation (Recommended)**
1. Access router settings
2. Find Fire TV in connected devices
3. Create DHCP reservation for its MAC address
4. This gives "permanent" IP via DHCP

### Troubleshooting Fire TV Setup

**Issue: "Connection Refused"**

**Cause:** ADB debugging not enabled

**Fix:**
1. Verify ADB debugging is on
2. Restart Fire TV
3. Re-enable ADB debugging
4. Try again

**Issue: "Host Unreachable"**

**Cause:** Wrong IP or network issue

**Fix:**
1. Ping Fire TV: `ping 192.168.1.50`
2. Verify IP on Fire TV
3. Check Fire TV connected to WiFi
4. Check network cables/switches

**Issue: "Unauthorized"**

**Cause:** Need to accept prompt on TV

**Fix:**
1. Look at TV screen
2. Accept authorization popup
3. Check "Always allow"
4. Try connection again

**Issue: "Offline" After Working**

**Cause:** IP address changed or connection lost

**Fix:**
1. Check Fire TV IP address
2. Update in admin panel if changed
3. Click "Reconnect" button
4. Consider static IP

---

## DirecTV Configuration

### Overview

DirecTV receivers with network capability can be controlled via HTTP API.

### Step 1: Enable External Access

**On DirecTV Receiver:**

1. Press **MENU** button on remote
2. Navigate to **Settings & Help**
3. Select **Settings**
4. Select **Whole-Home**
5. Select **External Device**
6. Select **External Access**
7. Change to **Enabled**
8. Note the IP address shown

### Step 2: Find Receiver IP Address

**Method 1: From DirecTV Menu**
1. MENU → Settings & Help → Settings
2. Info & Test → Network Setup
3. Note IP Address

**Method 2: From Router**
1. Look for "DirecTV" or "DIRECTV" in connected devices
2. Note IP address

### Step 3: Find Receiver ID

**On DirecTV Receiver:**
1. Press MENU → Settings & Help → Settings
2. Info & Test → System Test
3. Note **Receiver ID** (usually 0 for main receiver)

**Multiple Receivers:**
- Main receiver: ID 0
- Client receivers: ID 1, 2, 3, etc.

### Step 4: Add Device to System

**Via Admin Panel:**

1. Navigate to `/admin/directv`
2. Click **"Add DirecTV Receiver"**
3. Fill in form:

   **Device Name:**
   - "DirecTV - Dining Room"
   - Include location

   **IP Address:**
   - From Step 2 (e.g., 192.168.1.75)

   **Port:**
   - Default: `8080`
   - Don't change unless needed

   **Receiver ID:**
   - From Step 3 (usually `0`)

   **Location:**
   - Where receiver is located

4. Click **"Save Device"**

### Step 5: Test Connection

1. Find device in list
2. Click **"Test Connection"**

**Expected Results:**

**✅ Success:**
- Status: "Connected"
- Green indicator
- Ready to use

**❌ Failed:**
- See troubleshooting below

### Step 6: Test Commands

**Test Each Function:**

1. **Info Button:**
   - Send info command
   - Verify info screen appears on TV

2. **Channel Up:**
   - Send channel up command
   - Verify channel changes

3. **Channel Change:**
   - Send specific channel (e.g., 206)
   - Verify tuning works

### DirecTV Command Reference

**Common Commands:**

| Command | Function |
|---------|----------|
| power | Power on/off |
| 0-9 | Number buttons |
| dash | Dash (for sub-channels) |
| enter | Enter/OK |
| channelup | Channel up |
| channeldown | Channel down |
| prev | Previous channel |
| guide | Guide |
| info | Info/Display |
| menu | Menu |
| exit | Exit |
| back | Back |
| up, down, left, right | Navigation |
| select | Select/OK |
| red, green, yellow, blue | Color buttons |
| list | Playlist |
| record | Record |
| play | Play |
| pause | Pause |
| rew | Rewind |
| ffwd | Fast forward |

### Troubleshooting DirecTV Setup

**Issue: "Connection Timeout"**

**Cause:** External access not enabled or network issue

**Fix:**
1. Verify external access enabled
2. Ping receiver
3. Check port 8080 open
4. Restart receiver

**Issue: Commands Don't Work**

**Cause:** Wrong receiver ID or API not responding

**Fix:**
1. Verify receiver ID
2. Test with receiver ID 0
3. Check receiver firmware version
4. Restart receiver

---

## IR Device Configuration

### Overview

IR (Infrared) devices are controlled using IR blasters (Global Cache iTach IP2IR recommended).

### Prerequisites

- Global Cache iTach IP2IR on network
- IR emitters
- Original device remote (for learning codes)
- Device to control (cable box, etc.)

### Step 1: Configure iTach

**Find iTach IP:**

**Method 1: Global Cache App**
- Download "iHelp" app for iOS/Android
- App will discover iTach on network
- Note IP address

**Method 2: Router DHCP**
- Look for "GlobalCache" in connected devices
- Note IP address

**Set Static IP (Recommended):**
1. Access iTach web interface: `http://<itach-ip>`
2. Go to network settings
3. Set static IP
4. Save and reboot

### Step 2: Connect IR Emitters

**Physical Connection:**

1. **Locate iTach Ports:**
   - Port 1:1 (first output)
   - Port 1:2 (second output)
   - Port 1:3 (third output)

2. **Connect Emitter Cable:**
   - Insert emitter cable into port
   - Push until seated firmly
   - Cable should be secure

3. **Position Emitter:**
   - See IR_EMITTER_PLACEMENT_GUIDE.md for detailed instructions
   - Quick: Place 4-6 inches from device IR sensor
   - Direct line of sight
   - Aim at IR window

### Step 3: Add IR Device

**Via Admin Panel:**

1. Navigate to `/admin/ir-devices`
2. Click **"Add IR Device"**
3. Fill in form:

   **Device Name:**
   - "Cable Box 1 - Main Bar"
   - Descriptive name with location

   **iTach IP Address:**
   - IP from Step 1 (e.g., 192.168.1.100)

   **Port Number:**
   - Format: `1:1`, `1:2`, or `1:3`
   - Which iTach port emitter is connected to

   **Device Type:**
   - Select from dropdown
   - "Spectrum Cable Box", "Xfinity Cable Box", etc.
   - Or "Generic IR Device"

   **Location:**
   - Device location

4. Click **"Save Device"**

### Step 4: Learn IR Codes

**IR Learning Process:**

1. **Prepare:**
   - Have original remote ready
   - Clear area of IR interference
   - Position remote 6-12 inches from iTach

2. **Access Learning Interface:**
   - Find device in list
   - Click **"Learn IR Codes"** button

3. **Learn Each Command:**

   **For Each Button (Power, Ch+, Ch-, 0-9, etc.):**

   a. Click **"Start Learning [Command]"** button
   b. System displays: "Waiting for IR signal..."
   c. Point original remote at iTach
   d. Press and hold button on remote (1-2 seconds)
   e. System captures code: "Code captured!"
   f. System displays preview of code
   g. Click **"Test"** to verify code works
   h. If works: Click **"Save"**
   i. If doesn't work: Click **"Re-learn"**

4. **Required Commands:**
   - Power
   - Channel Up
   - Channel Down
   - Numbers 0-9
   - Enter
   - Last/Previous
   - Guide (optional)
   - Menu (optional)

5. **Save All Codes:**
   - Click **"Save All Codes"** when complete
   - Codes stored in database

### Step 5: Test IR Commands

**Test Each Code:**

1. **Visual Test:**
   - Use phone camera
   - Point at IR emitter
   - Send command
   - Should see purple/white flashing

2. **Functional Test:**
   - Send power command
   - Device should turn on/off
   - Send channel up
   - Channel should change

3. **Verify Placement:**
   - If device doesn't respond consistently
   - Adjust emitter position
   - Re-test until 100% reliable

### IR Code Management

**Backup Codes:**

**Export Codes:**
```bash
# Via admin panel
Go to /admin/ir-devices
Click device → "Export Codes"
Save JSON file
```

**Import Codes:**
```bash
# Via admin panel
Go to /admin/ir-devices
Click "Import Codes"
Upload JSON file
```

**Share Codes:**
- Same model devices can share codes
- Export from one device
- Import to others
- Saves time on learning

### IR Learning Best Practices

**For Best Results:**

1. **Environment:**
   - Dim lighting (avoid bright fluorescent)
   - Minimize IR interference
   - Close blinds if sunlight present

2. **Remote Position:**
   - 6-12 inches from iTach
   - Point directly at iTach IR sensor
   - Keep steady while pressing

3. **Button Press:**
   - Press and hold 1-2 seconds
   - Don't press too quickly
   - Use original remote (not universal)

4. **Verification:**
   - Test every code after learning
   - Test from final emitter position
   - Ensure 100% reliability

5. **Documentation:**
   - Note which codes work best
   - Document any special codes
   - Keep backup of learned codes

### Troubleshooting IR Setup

**Issue: "Failed to Learn Code"**

**Causes & Fixes:**

1. **Remote too far:** Move closer (6-12 inches)
2. **Remote pointed away:** Aim at iTach sensor
3. **Button press too short:** Hold 1-2 seconds
4. **Interference:** Turn off bright lights, close blinds
5. **Low battery:** Replace remote batteries

**Issue: "Code Learned but Device Doesn't Respond"**

**Causes & Fixes:**

1. **Emitter position:** See IR_EMITTER_PLACEMENT_GUIDE.md
2. **Wrong device:** Learned from wrong remote
3. **Code corruption:** Re-learn the code
4. **Device IR disabled:** Some devices can disable IR

**Issue: "Intermittent Response"**

**Causes & Fixes:**

1. **Emitter position:** Move closer or adjust angle
2. **Interference:** Shield from bright lights
3. **Weak signal:** Check emitter connection to iTach
4. **Multiple devices:** Ensure emitter aimed at correct device

---

## CEC Device Configuration

### Important Note

**Spectrum/Charter Cable Boxes:**
- CEC is **DISABLED** in firmware by provider
- Cannot be enabled
- **Use IR control instead** (see above)
- See CEC_DEPRECATION_NOTICE.md for details

**Compatible Devices:**
- Xfinity/Comcast cable boxes
- Some other cable providers
- Smart TVs (for power control)
- Blu-ray players
- AV receivers

### Step 1: Hardware Setup

**Required Hardware:**
- Pulse-Eight USB CEC Adapter
- USB cable to server
- HDMI cable

**Physical Connection:**

1. **Connect Adapter:**
   - USB to server USB port
   - HDMI to cable box HDMI output
   - Or insert in HDMI chain

2. **Verify Detection:**
   ```bash
   # Check adapter detected
   ls -l /dev/ttyACM*
   # Should show /dev/ttyACM0 (or higher number)
   ```

3. **Check Device:**
   ```bash
   # List CEC devices
   echo "scan" | cec-client -s -d 1
   ```

### Step 2: Add CEC Device

**Via Admin Panel:**

1. Navigate to `/admin/cec-devices`
2. Click **"Add CEC Device"**
3. Fill in form:

   **Device Name:**
   - "Cable Box 2 - Dining"
   - Descriptive name

   **Device Path:**
   - `/dev/ttyACM0` (from Step 1)
   - Or `/dev/ttyACM1` if multiple adapters

   **CEC Address:**
   - Usually `1` for playback device
   - Or `0` for TV
   - Scan will show available addresses

   **Location:**
   - Device location

4. Click **"Save Device"**

### Step 3: Test CEC Commands

**Test Commands:**

1. **Power:**
   - Send power on command
   - Device should turn on
   - Send power off
   - Device should turn off

2. **Channel Change:**
   - Send channel up
   - Verify channel changes
   - Try specific channel number

**If Commands Don't Work:**
- Device may not support CEC
- Check HDMI connection
- Verify device CEC is enabled (in device settings)
- Consider using IR control instead

### Troubleshooting CEC Setup

**Issue: Adapter Not Detected**

**Fix:**
```bash
# Unplug USB adapter
# Wait 10 seconds
# Plug back in
# Check again
ls -l /dev/ttyACM*
```

**Issue: Commands Don't Work**

**Fix:**
1. Verify HDMI connection
2. Check device supports CEC
3. Enable CEC in device settings (if available)
4. Try different HDMI port
5. Consider IR control instead

---

## Matrix Switcher Configuration

### Overview

HDMI matrix switchers route video sources to multiple displays. Wolf Pack is the recommended brand.

### Step 1: Physical Installation

**Hardware Setup:**

1. **Connect Sources:**
   - Input 1: Cable Box 1
   - Input 2: Cable Box 2
   - Input 3: Fire TV 1
   - Input 4: DirecTV
   - etc.

2. **Connect Displays:**
   - Output 1: TV 1
   - Output 2: TV 2
   - Output 3: TV 3
   - etc.

3. **Document Connections:**
   - Create mapping chart
   - Label cables
   - Update documentation

### Step 2: Network Configuration

**Configure Matrix:**

1. **Access Matrix Settings:**
   - Use front panel controls or web interface
   - Set network parameters

2. **Network Settings:**
   - **IP Address:** 192.168.1.100 (example)
   - **Subnet:** 255.255.255.0
   - **Gateway:** 192.168.1.1
   - **Use static IP**

3. **Control Settings:**
   - **Protocol:** TCP (recommended) or UDP
   - **Port:** 23 (telnet)
   - **Enable network control**

### Step 3: Test Connection

**Manual Test:**

```bash
# Test ping
ping 192.168.1.100

# Test telnet
telnet 192.168.1.100 23

# Send test command
echo "I1O1" | nc 192.168.1.100 23
# Should route Input 1 to Output 1
```

### Step 4: Add Matrix to System

**Via Admin Panel:**

1. Navigate to `/admin/matrix`
2. Click **"Add Matrix"**
3. Fill in form:

   **Matrix Name:**
   - "Main Matrix"
   - "Bar Matrix", "Dining Matrix", etc.

   **IP Address:**
   - From Step 2 (e.g., 192.168.1.100)

   **Port:**
   - 23 (default for telnet)

   **Protocol:**
   - TCP (recommended)
   - Or UDP if specified

   **Type:**
   - "Wolf Pack"
   - Or other supported type

4. Click **"Save Matrix"**

### Step 5: Configure Input/Output Mapping

**Define Inputs:**

1. Go to matrix configuration
2. Click **"Configure Inputs"**
3. For each input:
   - **Input Number:** 1, 2, 3, etc.
   - **Name:** "Cable Box 1", "Fire TV 1", etc.
   - **Device Type:** Select from list
   - **Notes:** Additional info

**Define Outputs:**

1. Click **"Configure Outputs"**
2. For each output:
   - **Output Number:** 1, 2, 3, etc.
   - **Name:** "TV 1 - Main Bar", etc.
   - **Location:** Where TV is located
   - **Default Input:** Optional

### Step 6: Test Routing

**Test Each Route:**

1. **Manual Route Test:**
   - Select Input 1
   - Select Output 1
   - Click "Route"
   - Verify TV 1 shows Input 1 content

2. **Test All Combinations:**
   - Test each input to each output
   - Verify correct video appears
   - Note any issues

### Wolf Pack Command Reference

**Command Format:**
```
I[input]O[output]
```

**Examples:**
- `I1O1` - Route Input 1 to Output 1
- `I2O5` - Route Input 2 to Output 5
- `I3O*` - Route Input 3 to all outputs
- `I*O1` - Query what's routed to Output 1

**Status Commands:**
```
Status     - Get system status
I*O*       - Get all current routes
```

---

## Audio Processor Configuration

### Overview

AtlasIED audio processors provide zone-based audio control and mixing.

### Step 1: Find Processor IP

**From Processor:**
- Check front panel display
- Or access via AtlasIED discovery tool

**From Network:**
- Check router DHCP
- Look for "Atlas" or manufacturer name

### Step 2: Configure Network

**Set Static IP:**

1. Access processor web interface
2. Go to network settings
3. Set static IP (e.g., 192.168.1.110)
4. Save and reboot

### Step 3: Add to System

**Via Admin Panel:**

1. Navigate to `/admin/audio`
2. Click **"Add Audio Processor"**
3. Fill in form:

   **Name:**
   - "Main Audio Processor"

   **IP Address:**
   - From Step 1

   **Port:**
   - Default: 80 (HTTP)

   **Model:**
   - Select AtlasIED model

4. Click **"Save"**

### Step 4: Configure Zones

**For Each Zone:**

1. **Zone Setup:**
   - Zone Number (1-12)
   - Zone Name ("Main Bar", "Patio", etc.)
   - Audio Source
   - Max Volume (safety limit)
   - Default Volume

2. **Audio Routing:**
   - Assign input sources
   - Configure mixing
   - Set priorities

### Step 5: Test Audio

**Test Each Zone:**

1. Select zone
2. Adjust volume
3. Verify audio plays
4. Test mute function
5. Test source switching

---

## Device Best Practices

### General Best Practices

1. **Use Descriptive Names:**
   - Include location
   - Include device type
   - Be consistent

2. **Document Everything:**
   - Keep physical connection diagram
   - Note IP addresses
   - Document any special configuration

3. **Use Static IPs:**
   - Prevents IP changes
   - More reliable
   - Easier to troubleshoot

4. **Label Hardware:**
   - Label cables
   - Label ports
   - Label devices

5. **Test Thoroughly:**
   - Test each device function
   - Test under load
   - Test failure scenarios

6. **Keep Backups:**
   - Export IR codes
   - Export configurations
   - Document settings

### Naming Conventions

**Recommended Format:**
```
[Device Type] - [Location] - [Number]
```

**Examples:**
- "Fire TV - Main Bar - 1"
- "Cable Box - Patio - 3"
- "DirecTV - Dining Room"

### Security Considerations

1. **Network Segmentation:**
   - Keep AV devices on separate VLAN if possible
   - Limit access to control network

2. **Access Control:**
   - Secure admin interfaces
   - Use strong passwords
   - Disable unnecessary services

3. **Firmware Updates:**
   - Keep devices updated
   - Check for security patches
   - Test updates before deploying

---

**End of Device Configuration Guide**

*For hardware setup, see HARDWARE_SETUP_GUIDE.md*
*For troubleshooting, see TROUBLESHOOTING_GUIDE.md*
*For system administration, see SYSTEM_ADMIN_GUIDE.md*
