# Amazon Fire TV System - Comprehensive Q&A Sheet

**Project:** Sports Bar TV Controller  
**System Component:** Amazon Fire TV Integration  
**Document Version:** 2.0  
**Last Updated:** October 16, 2025  
**Purpose:** AI Training and Reference Documentation for AI Hub

---

## Table of Contents
1. [Device Setup and Configuration](#device-setup-and-configuration)
2. [IP Address and Port Requirements](#ip-address-and-port-requirements)
3. [ADB Bridge Setup and Configuration](#adb-bridge-setup-and-configuration)
4. [Matrix Input Channel Configuration](#matrix-input-channel-configuration)
5. [Subscription Polling Functionality](#subscription-polling-functionality)
6. [Remote Control Commands](#remote-control-commands)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [Common Troubleshooting Issues](#common-troubleshooting-issues)
9. [Integration with Wolfpack Matrix Switcher](#integration-with-wolfpack-matrix-switcher)
10. [Form Submission and Device Management](#form-submission-and-device-management)
11. [Streaming Apps and Sports Content](#streaming-apps-and-sports-content)
12. [Advanced Topics and Automation](#advanced-topics-and-automation)

---

## Device Setup and Configuration

### Q: What is the Fire TV Cube currently deployed in the Sports Bar TV Controller system?
**A:** The production Fire TV Cube is deployed with the following specifications:
- **IP Address:** 192.168.5.131
- **Port:** 5555 (default ADB port)
- **Device Model:** AFTGAZL (Amazon Fire TV Cube, 3rd Generation - 2022)
- **Android Version:** 9 (Fire OS 7+ based on Android 9)
- **Network:** Connected via Wi-Fi 6 or Gigabit Ethernet
- **ADB Status:** Enabled and connected
- **Connection Status:** Fully operational as of October 16, 2025
- **Server:** Managed from 192.168.5.100:224 (SSH server)

### Q: What are the Fire TV Cube hardware specifications?
**A:** Fire TV Cube (3rd Gen - AFTGAZL) specifications:
- **Processor:** Octa-core ARM-based processor
- **RAM:** 2GB
- **Storage:** 16GB internal
- **Operating System:** Fire OS 7+ (Based on Android 9)
- **Network:** Wi-Fi 6, Gigabit Ethernet port
- **Ports:** HDMI 2.1 output, Micro USB, Ethernet, IR extender
- **Video:** 4K Ultra HD, HDR, HDR10+, Dolby Vision
- **Audio:** Dolby Atmos support
- **Features:** Hands-free Alexa, Built-in speaker, IR blaster for TV control, HDMI-CEC support

### Q: What types of Fire TV devices are supported by the system?
**A:** The system supports the following Fire TV device types:
- **Fire TV Cube** (Current production device: AFTGAZL)
- **Fire TV Stick**
- **Fire TV Stick 4K Max**
- **Standard Fire TV**

All devices must have ADB (Android Debug Bridge) debugging enabled for remote control functionality.

### Q: What information is required to add a Fire TV device?
**A:** To add a Fire TV device, you need:
1. **Device Name** - Custom label for identification (e.g., "Bar Main TV", "Fire TV Cube Bar")
2. **IP Address** - Network address of the Fire TV device (e.g., 192.168.5.131)
3. **Port** - ADB port number (default: 5555)
4. **Device Type** - Select from supported Fire TV models (Cube, Stick, Stick 4K Max, Standard)
5. **Matrix Input Channel** (Optional) - Associate with matrix switcher input (1-32)

### Q: How is device data stored and persisted?
**A:** Fire TV device configurations are stored with the following details:
- **Primary Storage:** `/data/firetv-devices.json` on the controller server
- **Format:** JSON file with array of device objects
- **Persistence:** Data persists across application restarts
- **Backup Schedule:** Automated daily backups at 3:00 AM
- **Backup Location:** `/backups/` directory with timestamped files
- **Version Control:** Configuration tracked in GitHub repository
- **Server Location:** /home/ubuntu/Sports-Bar-TV-Controller/data/

### Q: What validation is performed when adding a device?
**A:** The system validates:
1. **Name** - Must not be empty, must be a string
2. **IP Address** - Must match valid IPv4 format (xxx.xxx.xxx.xxx)
   - Regex: `^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$`
   - Each octet must be 0-255
3. **Port** - Must be between 1 and 65535
4. **Duplicate Check** - Prevents duplicate IP address + port combinations
5. **Device Type** - Must be one of the supported types
6. **Matrix Input** - If provided, must be valid channel number (1-32)

---

## IP Address and Port Requirements

### Q: What is the IP address of the production Fire TV Cube?
**A:** The production Fire TV Cube is configured at:
- **IP Address:** 192.168.5.131
- **Port:** 5555
- **Network:** Local network segment 192.168.5.x
- **Address Type:** Should be static or DHCP reservation
- **Accessibility:** Must be reachable from controller server at 192.168.5.100

### Q: What is the default port for Fire TV ADB connection?
**A:** The default ADB port for Fire TV devices is **5555**. This port is used for Android Debug Bridge communication over the network.

### Q: Can I use a different port for Fire TV?
**A:** Yes, you can specify a custom port when adding a device. However:
- Most Fire TV devices use port 5555 by default
- Custom ports require manual ADB configuration on the Fire TV device
- The port must be accessible on your network (not blocked by firewalls)
- Custom ports must be configured in Fire TV Developer Options
- Port forwarding may be required if on different network segments

### Q: How do I find my Fire TV's IP address?
**A:** To find your Fire TV IP address:
1. Go to **Settings** on Fire TV
2. Navigate to **My Fire TV** or **Device**
3. Select **About**
4. Select **Network**
5. Note the IP address displayed (e.g., 192.168.5.131)

**Alternative Method:**
1. From controller server: `adb devices` (if already connected)
2. Check router DHCP leases
3. Use network scanner: `nmap -sn 192.168.5.0/24`

### Q: What network requirements must be met?
**A:** Network requirements:
1. **Same Network:** Fire TV must be on the same network as controller server (192.168.5.x)
2. **Firewall Rules:** No firewall blocking port 5555 (or custom ADB port)
3. **Static IP:** Strongly recommended (or DHCP reservation) to prevent address changes
4. **Network Latency:** Should be low (< 50ms) for responsive control
5. **VLAN Access:** Ensure no VLAN isolation between controller and Fire TV devices
6. **Bandwidth:** Sufficient bandwidth for streaming (25+ Mbps recommended for 4K)

### Q: Does the Fire TV need to be assigned a static IP?
**A:** While not strictly required, **static IP addresses are strongly recommended**:
- **Production Device:** 192.168.5.131 should have static assignment
- **Pros:** Prevents configuration changes when device reboots
- **Alternatives:** Use DHCP reservation based on MAC address
- **Dynamic IP Issues:** Device will become unreachable if IP changes
- **Best Practice:** Assign static IPs to all Fire TV devices in sports bar environment
- **Configuration:** Set in Fire TV Settings → Network or on DHCP server

---

## ADB Bridge Setup and Configuration

### Q: What is ADB and why is it required?
**A:** ADB (Android Debug Bridge) is a command-line tool that allows communication with Android devices:
- **Purpose:** Enables remote control of Fire TV via network commands
- **Protocol:** TCP/IP connection on port 5555
- **Capabilities:** Send keystrokes, launch apps, retrieve device info, execute shell commands
- **Required For:** All Fire TV control features in the system
- **Version:** Controller server has ADB version 1.0.41 (Version 28.0.2-debian)
- **Installation:** Already installed on production server at `/usr/bin/adb`

### Q: What is the current ADB configuration on the production server?
**A:** Production ADB configuration:
- **ADB Path:** `/usr/bin/adb`
- **ADB Version:** 1.0.41 (Version 28.0.2-debian)
- **Installation Location:** `/usr/lib/android-sdk/platform-tools/adb`
- **Connection Status:** Active and connected to 192.168.5.131:5555
- **Device State:** "device" (fully operational)
- **Server:** Running on 192.168.5.100:224 (SSH accessible)
- **Project Path:** /home/ubuntu/Sports-Bar-TV-Controller

### Q: How do I enable ADB debugging on a Fire TV device?
**A:** Step-by-step ADB enablement:

1. **Enable Developer Options:**
   - Go to **Settings** → **My Fire TV** → **About**
   - Click on the device name **7 times** rapidly
   - "Developer Options" will now appear in Settings menu

2. **Enable ADB Debugging:**
   - Go to **Settings** → **My Fire TV** → **Developer Options**
   - Turn on **ADB Debugging**
   - Confirm the warning dialog ("Allow ADB debugging?")

3. **Enable Network ADB:**
   - In **Developer Options**, ensure "Network debugging" is allowed
   - Fire TV Cube models have network debugging enabled by default
   - Some older models may require USB debugging first

4. **First Connection Authorization:**
   - First ADB connection will show authorization prompt on TV screen
   - Select "Always allow from this computer" checkbox
   - Tap "OK" to authorize

### Q: How can I verify ADB is enabled and connected?
**A:** Verification methods:

**From Fire TV:**
- Check **Settings** → **My Fire TV** → **Developer Options** → **ADB Debugging** is ON
- Look for "ADB Debugging Connected" notification icon

**From Controller Server:**
```bash
# Check connection status
adb devices

# Expected output:
# List of devices attached
# 192.168.5.131:5555	device

# Test device communication
adb -s 192.168.5.131:5555 shell getprop ro.product.model
# Expected output: AFTGAZL

# Check device state
adb -s 192.168.5.131:5555 get-state
# Expected output: device
```

**From UI:**
- Use the "Test Connection" button in the Fire TV device card
- Status indicator shows green checkmark when connected
- Device card displays "Online" status

### Q: What ADB commands are available for Fire TV control?
**A:** Comprehensive ADB command reference:

**Connection Management:**
```bash
# Connect to Fire TV Cube
adb connect 192.168.5.131:5555

# Disconnect from Fire TV Cube
adb disconnect 192.168.5.131:5555

# List all connected devices
adb devices

# Check connection status
adb -s 192.168.5.131:5555 get-state
```

**Device Information:**
```bash
# Get device model
adb -s 192.168.5.131:5555 shell getprop ro.product.model
# Output: AFTGAZL

# Get Android/Fire OS version
adb -s 192.168.5.131:5555 shell getprop ro.build.version.release
# Output: 9

# Get all system properties
adb -s 192.168.5.131:5555 shell getprop
```

**Navigation & Control:**
```bash
# Send key events
adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_HOME       # Home
adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_BACK       # Back
adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_UP    # Up
adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_DOWN  # Down
adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_CENTER # Select
adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_MEDIA_PLAY_PAUSE

# Send text input
adb -s 192.168.5.131:5555 shell input text "Search query"
```

**Application Management:**
```bash
# List all installed packages
adb -s 192.168.5.131:5555 shell pm list packages

# Get current focused app
adb -s 192.168.5.131:5555 shell dumpsys window | grep -i "mCurrentFocus"
# Output: mCurrentFocus=Window{4e839c5 u0 com.amazon.tv.launcher/...}

# Launch an app
adb -s 192.168.5.131:5555 shell am start -n com.netflix.ninja/.MainActivity
```

### Q: What happens if ADB is not enabled or available?
**A:** Fallback behavior:
1. **Connection Test:** Will report device as unreachable
2. **Command Execution:** Commands will fail with error messages
3. **Simulation Mode:** System can simulate commands for testing (90% success rate)
4. **User Guidance:** Error messages provide setup instructions
5. **Recommendations:** System suggests enabling ADB in error responses
6. **Status Indicator:** Device shows as "Offline" with red badge in UI

### Q: How do I troubleshoot ADB connection issues?
**A:** Troubleshooting steps:

1. **Verify Network Connectivity:**
   ```bash
   ping 192.168.5.131
   ```

2. **Check Port Accessibility:**
   ```bash
   telnet 192.168.5.131 5555
   # or
   nc -zv 192.168.5.131 5555
   ```

3. **Restart ADB Server:**
   ```bash
   adb kill-server
   adb start-server
   adb connect 192.168.5.131:5555
   ```

4. **Check Fire TV ADB Status:**
   - Settings → My Fire TV → Developer Options → ADB Debugging (must be ON)

5. **Reauthorize Connection:**
   - If device shows as "unauthorized": Look for authorization prompt on TV
   - Select "Always allow from this computer"

6. **Restart Fire TV:**
   - Unplug Fire TV Cube for 10 seconds
   - Plug back in and wait for full boot
   - Reconnect ADB

---

## Matrix Input Channel Configuration

### Q: What is a matrix input channel and how does it relate to Fire TV?
**A:** A matrix input channel connects Fire TV to the Wolfpack HDMI matrix switcher:
- **Purpose:** Routes Fire TV output to specific TV displays in sports bar
- **Range:** Channels 1-32 available on Wolfpack matrix
- **Format:** "Input [N]: [Label] ([Type])" (e.g., "Input 13: Fire TV Bar (HDMI)")
- **Configuration:** Assigned during Fire TV device creation or updated later
- **Physical Connection:** Fire TV HDMI output → Matrix Input port
- **Routing Control:** Matrix can route this input to any of 32 output displays

### Q: What matrix input is the production Fire TV Cube assigned to?
**A:** Based on testing data:
- **Matrix Input Channel:** 13
- **Input Label:** "Input 13: Input 13 (HDMI)"
- **Physical Connection:** Fire TV Cube HDMI out → Matrix Input 13
- **Routing Capability:** Can be routed to any output (TV) 1-32
- **Control Integration:** Accessible via matrix control API and bartender remote

### Q: How do I assign a Fire TV device to a matrix input channel?
**A:** Assignment process:

**During Device Creation:**
1. Fill in device name, IP address, port, and device type
2. Select matrix input channel from dropdown (channels 1-32)
3. Save device configuration
4. Input assignment stored in device record

**After Creation:**
1. Locate device in Fire TV device list
2. Click "Edit" button (green pencil icon)
3. Update "Matrix Input Channel" dropdown
4. Save changes

**API Method:**
```bash
PUT /api/firetv-devices
{
  "id": "device_id",
  "inputChannel": "13"
}
```

### Q: Can multiple Fire TV devices use the same matrix input?
**A:** No, each matrix input should only have one source device:
- **Physical Limitation:** One HDMI cable per input port
- **Routing Conflict:** Multiple devices on same input would cause confusion
- **Best Practice:** Assign unique input channel to each Fire TV
- **Validation:** System should prevent duplicate input assignments
- **Documentation:** Maintain input assignment map (device → input → TVs)

### Q: How does matrix channel assignment affect device control?
**A:** Matrix integration benefits:

**Unified Control:**
- Route Fire TV to any TV output from single interface
- Control which TVs display Fire TV content
- Switch between different Fire TVs on different displays

**Bartender Remote Integration:**
- Quick access buttons route Fire TV to specific TVs
- One-click routing for common scenarios
- Status display shows active routes

**Automated Routing:**
- Schedule Fire TV content to specific displays
- Auto-route for game times or events
- Coordinate multiple Fire TVs for multi-game viewing

**Status Display:**
- See which Fire TV is active on which TV
- Visual representation of signal flow
- Quick troubleshooting of routing issues

---

## Subscription Polling Functionality

### Q: What is subscription polling and what does it do?
**A:** Subscription polling retrieves device status and app information:
- **Primary Purpose:** Monitor Fire TV connectivity and device state
- **Secondary Purpose:** Retrieve subscription/app information (planned)
- **Trigger:** Manual - user clicks "Subscriptions" button on device card
- **Data Retrieved:** Connection status, device info, installed apps
- **Display:** Subscriptions panel with device details
- **Network Test:** Verifies device is reachable and responding

### Q: What happens when I click "Poll Subscriptions"?
**A:** Polling process:

1. **UI Changes:**
   - Subscriptions panel opens with device name
   - "Poll Subscriptions" button shown
   - Initial state: "No Subscription Data"

2. **Polling Initiation:**
   - Click "Poll Subscriptions" button
   - Loading spinner displays: "Pulling device subscriptions..."
   - API call sent to `/api/firetv-devices/subscriptions/poll`

3. **Backend Processing:**
   - Attempts ADB connection to device
   - Executes `pm list packages` command
   - Queries for specific apps (NFL, ESPN, streaming services)
   - Extracts subscription/app data

4. **Results Display:**
   - **Success:** Shows installed apps and subscription status
   - **Failure:** Red error message with troubleshooting suggestions
   - Panel updates with results or error state

### Q: What subscription data can be retrieved?
**A:** Available subscription information:

**NFL/Sports Apps:**
- NFL Game Pass subscription status
- NFL RedZone access
- NFL Network availability
- Package names: `com.nfl.gamepass`, `com.nfl.mobile`

**Streaming Services:**
- Installed streaming apps
- App versions
- Package installation status

**Device Information:**
- Installed package list
- System app information
- User-installed apps vs system apps

**Status Information:**
- Online/offline state
- ADB connectivity
- Last successful communication timestamp

### Q: What if the device doesn't have the NFL app installed?
**A:** Handling missing apps:
- Polling completes successfully but returns "No NFL app found"
- Other streaming apps still detected and displayed
- Recommendations provided to install missing apps
- Can still control device via remote commands
- App launcher can initiate app store to install

### Q: Does subscription polling work without ADB enabled?
**A:** Limited functionality without ADB:
- **Network Test:** Can detect if device is reachable (ping test)
- **Port Check:** Can verify port 5555 responds
- **Full Details:** Requires ADB for app list, subscription data
- **Fallback:** Shows basic connectivity status only
- **Error Message:** Informs user ADB is required for complete data
- **Recommendation:** Enable ADB for full subscription polling features

---

## Remote Control Commands

### Q: What types of remote control commands are supported?
**A:** Fire TV supports comprehensive remote control via ADB:

**Navigation Commands:**
- **UP** - KEYCODE_DPAD_UP (19)
- **DOWN** - KEYCODE_DPAD_DOWN (20)
- **LEFT** - KEYCODE_DPAD_LEFT (21)
- **RIGHT** - KEYCODE_DPAD_RIGHT (22)
- **OK/SELECT** - KEYCODE_DPAD_CENTER (23)
- **BACK** - KEYCODE_BACK (4)
- **HOME** - KEYCODE_HOME (3)
- **MENU** - KEYCODE_MENU (82)

**Media Controls:**
- **PLAY_PAUSE** - KEYCODE_MEDIA_PLAY_PAUSE (85)
- **PLAY** - KEYCODE_MEDIA_PLAY (126)
- **PAUSE** - KEYCODE_MEDIA_PAUSE (127)
- **STOP** - KEYCODE_MEDIA_STOP (86)
- **REWIND** - KEYCODE_MEDIA_REWIND (89)
- **FAST_FORWARD** - KEYCODE_MEDIA_FAST_FORWARD (90)

**Volume Controls:**
- **VOL_UP** - KEYCODE_VOLUME_UP (24)
- **VOL_DOWN** - KEYCODE_VOLUME_DOWN (25)
- **MUTE** - KEYCODE_VOLUME_MUTE (164)

**Power Controls:**
- **SLEEP** - KEYCODE_SLEEP (223)
- **WAKEUP** - KEYCODE_WAKEUP (224)

### Q: How do I send a remote control command to a Fire TV device?
**A:** Command sending process:

**Via UI:**
1. Navigate to Fire TV control panel
2. Locate target device card
3. Click desired command button (Home, Back, navigation, etc.)
4. Watch for success/error notification
5. Command executes on Fire TV immediately

**Via API:**
```bash
POST /api/firetv-devices/send-command
Content-Type: application/json

{
  "deviceId": "firetv_device_id",
  "ipAddress": "192.168.5.131",
  "port": 5555,
  "command": "HOME"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Fire TV command executed successfully",
  "command": "input keyevent 3",
  "executedAt": "2025-10-16T12:00:00.000Z"
}
```

### Q: What is the typical response time for commands?
**A:** Expected response times:
- **Local Network (Ideal):** 100-300ms
- **With ADB Bridge:** 500-1500ms typical
- **Network Congestion:** Up to 2000ms
- **Simulation Mode:** 500-1500ms (artificial delay)
- **Timeout Threshold:** 10 seconds maximum
- **Factors Affecting Speed:**
  - Network latency between server and Fire TV
  - Fire TV device load/performance
  - Command complexity
  - ADB server responsiveness

### Q: How are failed commands handled?
**A:** Error handling mechanisms:

**Timeout Detection:**
- 10-second timeout for unresponsive devices
- Automatic failure after timeout
- Error message displayed to user

**Error Messages:**
- Detailed description of failure reason
- Specific troubleshooting suggestions
- Network connectivity guidance
- ADB status recommendations

**Retry Logic:**
- User can manually retry failed commands
- No automatic retry (prevents command flooding)
- UI remains responsive during failures

**Status Indicators:**
- Loading spinner during command execution
- Green success notification on completion
- Red error notification on failure
- Command history tracks all attempts

### Q: Can I send custom ADB commands?
**A:** Yes, custom command support available:

**Supported Custom Commands:**
- Raw ADB shell commands
- Input text for search
- App package launches
- System property queries

**Example Custom Commands:**
```bash
# Type text
input text "search query"

# List installed apps
pm list packages

# Get device properties
getprop

# Check current app
dumpsys window | grep mCurrentFocus

# Launch app by package
am start -n com.netflix.ninja/.MainActivity
```

**Safety Restrictions:**
- Commands validated against allowed patterns
- Potentially harmful commands blocked
- Root access commands rejected
- File system modification prevented

---

## API Endpoints Reference

### Q: What API endpoints are available for Fire TV management?
**A:** Complete API endpoint reference:

#### **GET /api/firetv-devices**
**Purpose:** Retrieve all configured Fire TV devices  
**Method:** GET  
**Authentication:** None (local network)  

**Response:**
```json
{
  "devices": [
    {
      "id": "firetv_1697385600_xyz123",
      "name": "Fire TV Cube Bar",
      "ipAddress": "192.168.5.131",
      "port": 5555,
      "deviceType": "Fire TV Cube",
      "inputChannel": "13",
      "isOnline": true,
      "adbEnabled": true,
      "addedAt": "2025-10-15T10:30:00.000Z",
      "updatedAt": "2025-10-16T08:00:00.000Z"
    }
  ]
}
```

#### **POST /api/firetv-devices**
**Purpose:** Add a new Fire TV device  
**Method:** POST  

**Request Body:**
```json
{
  "name": "Fire TV Cube Bar",
  "ipAddress": "192.168.5.131",
  "port": 5555,
  "deviceType": "Fire TV Cube",
  "inputChannel": "13"
}
```

**Validation Rules:**
- `name`: Required, non-empty string
- `ipAddress`: Required, must match IPv4 format
- `port`: Required, 1-65535
- `deviceType`: Required, must be valid Fire TV type
- `inputChannel`: Optional, 1-32 if provided
- Checks for duplicate IP+port combinations

**Success Response (201):**
```json
{
  "message": "Fire TV device added successfully",
  "device": {
    "id": "firetv_1697385600_xyz123",
    "name": "Fire TV Cube Bar",
    "ipAddress": "192.168.5.131",
    "port": 5555,
    "deviceType": "Fire TV Cube",
    "inputChannel": "13",
    "isOnline": false,
    "adbEnabled": false,
    "addedAt": "2025-10-16T10:30:00.000Z"
  }
}
```

**Error Response (400):**
```json
{
  "error": "Invalid IP address format"
}
```

**Error Response (409):**
```json
{
  "error": "Device with this IP address and port already exists"
}
```

#### **PUT /api/firetv-devices**
**Purpose:** Update existing Fire TV device  
**Method:** PUT  

**Request Body:**
```json
{
  "id": "firetv_1697385600_xyz123",
  "name": "Fire TV Cube Bar - Updated",
  "ipAddress": "192.168.5.131",
  "port": 5555,
  "deviceType": "Fire TV Cube",
  "inputChannel": "13"
}
```

**Success Response (200):**
```json
{
  "message": "Fire TV device updated successfully",
  "device": {
    "id": "firetv_1697385600_xyz123",
    "name": "Fire TV Cube Bar - Updated",
    "updatedAt": "2025-10-16T11:45:00.000Z"
  }
}
```

#### **DELETE /api/firetv-devices**
**Purpose:** Remove a Fire TV device  
**Method:** DELETE  
**Query Parameter:** `id` (device identifier)  

**Request:**
```
DELETE /api/firetv-devices?id=firetv_1697385600_xyz123
```

**Success Response (200):**
```json
{
  "message": "Fire TV device deleted successfully",
  "deletedDevice": {
    "name": "Fire TV Cube Bar",
    "ipAddress": "192.168.5.131"
  }
}
```

#### **POST /api/firetv-devices/send-command**
**Purpose:** Send remote control command to Fire TV  
**Method:** POST  

**Request Body (Key Command):**
```json
{
  "deviceId": "firetv_1697385600_xyz123",
  "ipAddress": "192.168.5.131",
  "port": 5555,
  "command": "HOME"
}
```

**Request Body (App Launch):**
```json
{
  "deviceId": "firetv_1697385600_xyz123",
  "ipAddress": "192.168.5.131",
  "port": 5555,
  "appPackage": "com.espn.score_center"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Fire TV command executed successfully",
  "deviceId": "firetv_1697385600_xyz123",
  "command": "input keyevent 3",
  "originalCommand": "HOME",
  "sentAt": "2025-10-16T12:00:00.000Z",
  "responseTime": "245ms",
  "data": {
    "command": "input keyevent 3",
    "device": "192.168.5.131:5555",
    "executedAt": "2025-10-16T12:00:00.000Z",
    "response": "Command executed successfully"
  }
}
```

**Error Response (500):**
```json
{
  "success": false,
  "message": "Failed to execute command",
  "error": "Device not reachable",
  "deviceId": "firetv_1697385600_xyz123"
}
```

#### **POST /api/firetv-devices/test-connection**
**Purpose:** Test connectivity to Fire TV device  
**Method:** POST  

**Request Body:**
```json
{
  "ipAddress": "192.168.5.131",
  "port": 5555,
  "deviceId": "firetv_1697385600_xyz123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Fire TV device connected via ADB",
  "deviceId": "firetv_1697385600_xyz123",
  "testedAt": "2025-10-16T12:00:00.000Z",
  "target": "192.168.5.131:5555",
  "data": {
    "method": "ADB Bridge",
    "ip": "192.168.5.131",
    "port": 5555,
    "adbEnabled": true,
    "deviceInfo": {
      "model": "AFTGAZL",
      "version": "Fire OS 7.6.6.8",
      "androidVersion": "9"
    },
    "responseTime": "156ms"
  }
}
```

**Error Response (500):**
```json
{
  "success": false,
  "message": "Failed to connect to Fire TV device",
  "error": "Connection timeout",
  "deviceId": "firetv_1697385600_xyz123",
  "target": "192.168.5.131:5555"
}
```

#### **POST /api/firetv-devices/subscriptions/poll**
**Purpose:** Poll device for subscription/app information  
**Method:** POST  

**Request Body:**
```json
{
  "deviceId": "firetv_1697385600_xyz123",
  "ipAddress": "192.168.5.131",
  "port": 5555
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Subscriptions polled successfully",
  "deviceId": "firetv_1697385600_xyz123",
  "polledAt": "2025-10-16T12:00:00.000Z",
  "subscriptions": {
    "nflGamePass": {
      "installed": true,
      "package": "com.nfl.gamepass",
      "hasSubscription": true,
      "features": ["NFL RedZone", "Game Pass Premium"]
    },
    "streamingApps": [
      {
        "name": "ESPN",
        "package": "com.espn.score_center",
        "installed": true
      },
      {
        "name": "Netflix",
        "package": "com.netflix.ninja",
        "installed": true
      }
    ]
  }
}
```

---

## Common Troubleshooting Issues

### Q: Fire TV device shows as offline in the UI. How do I fix this?
**A:** Comprehensive troubleshooting guide:

**Step 1: Verify Device Power**
- Check Fire TV Cube LED indicator (should be solid white when on)
- Press button on Alexa remote to wake device
- Verify TV shows Fire TV home screen

**Step 2: Check Network Connectivity**
```bash
# From controller server (192.168.5.100)
ping 192.168.5.131

# Expected: Replies with low latency (< 50ms)
# Problem: "Destination Host Unreachable" or timeout
```

**If Ping Fails:**
- Verify Fire TV network settings (Settings → Network)
- Check Fire TV is on 192.168.5.x network
- Verify no VLAN isolation
- Check router for DHCP issues
- Confirm IP address hasn't changed

**Step 3: Verify ADB Status on Fire TV**
```
Settings → My Fire TV → Developer Options → ADB Debugging
```
- Must show "ON"
- If OFF, turn ON and retry
- May need to re-enable after Fire TV updates

**Step 4: Test ADB Connection from Server**
```bash
# SSH to controller server
ssh ubuntu@192.168.5.100 -p 224

# Test ADB connection
adb connect 192.168.5.131:5555

# Check device list
adb devices

# Expected output:
# 192.168.5.131:5555	device

# If shows "offline" or "unauthorized":
adb disconnect 192.168.5.131:5555
sleep 2
adb connect 192.168.5.131:5555
```

**Step 5: Check Firewall/Port Access**
```bash
# Test port 5555 accessibility
telnet 192.168.5.131 5555

# Or using netcat
nc -zv 192.168.5.131 5555

# Expected: Connection successful
# Problem: "Connection refused" or timeout
```

**Step 6: Use UI Test Connection**
- Click "Test Connection" button on device card
- Review detailed error message
- Follow suggested troubleshooting steps

**Step 7: Restart Sequence (if all else fails)**
1. Restart Fire TV Cube (unplug 30 seconds)
2. Wait 2 minutes for full boot
3. Restart ADB server: `adb kill-server && adb start-server`
4. Reconnect: `adb connect 192.168.5.131:5555`
5. Restart Sports Bar Controller: `pm2 restart sports-bar-tv`
6. Test connection from UI

### Q: Commands are sent but Fire TV doesn't respond. What should I check?
**A:** Command response troubleshooting:

**Issue 1: Commands Fail Immediately**
- **Cause:** ADB connection lost
- **Solution:** Run connection test, reconnect ADB
- **Check:** `adb devices` shows device as "device" not "offline"

**Issue 2: Commands Timeout**
- **Cause:** Network latency or device overload
- **Check Network:** `ping 192.168.5.131` (should be < 50ms)
- **Check Device Load:** Fire TV may have too many background apps
- **Solution:** Close apps, restart Fire TV

**Issue 3: Commands Execute but No Effect**
- **Cause:** Fire TV in wrong state/app
- **Example:** PLAY command sent but no video playing
- **Solution:** Navigate to correct app/state first
- **Try:** Send HOME command, then retry

**Issue 4: Specific Commands Don't Work**
- **Cause:** Command not supported by Fire TV or current app
- **Example:** Volume commands may not work on all Fire TV models
- **Solution:** Test with basic commands (HOME, BACK)
- **Verify:** Use different command to confirm connectivity

**Issue 5: Simulation Mode Active**
- **Symptom:** Commands show success but don't affect device
- **Cause:** ADB bridge service not running
- **Check Logs:** Look for "simulation mode" messages
- **Solution:** Install/start ADB bridge service

**Diagnostic Commands:**
```bash
# Check current Fire TV app
adb -s 192.168.5.131:5555 shell dumpsys window | grep mCurrentFocus

# Verify ADB shell access
adb -s 192.168.5.131:5555 shell echo "test"

# Check device responsiveness
adb -s 192.168.5.131:5555 shell getprop ro.product.model
```

### Q: Form submission was failing with perpetual loading. How was this fixed?
**A:** Form submission bug details (Fixed October 15, 2025):

**Original Problem:**
- "Add Fire TV Device" button stuck in loading state
- Form submission failed silently after clicking submit
- Device not saved to configuration
- User had to refresh page to retry
- No error message displayed

**Root Causes Identified:**
1. **API Endpoint Mismatch:**
   - Frontend called `/api/firecube/devices` (old endpoint)
   - Backend expected `/api/firetv-devices` (new endpoint)
   - Result: 404 errors, silent failures

2. **State Management Issue:**
   - Loading state set to true on submit
   - Error handling didn't reset loading state
   - Button remained disabled permanently

3. **Missing Error Feedback:**
   - Errors caught but not displayed to user
   - No indication why submission failed

**Fixes Applied:**

**File: pages/firetv/index.tsx**
- Updated device fetch: `GET /api/firetv-devices`
- Added proper error handling
- Improved loading state management

**File: src/components/firecube/DiscoveryPanel.tsx**
- Changed endpoint: `/api/firetv-devices` (POST)
- Added default device name if empty
- Improved error messages
- Reset loading state on error

**File: src/components/firecube/DeviceCard.tsx**
- Updated delete endpoint: `/api/firetv-devices?id=`
- Updated update endpoint: `/api/firetv-devices` (PUT)

**File: src/components/firecube/DeviceList.tsx**
- Consistent endpoint usage
- Better error handling

**Testing Results:**
- ✅ Form submission works correctly
- ✅ Devices saved to configuration
- ✅ Success message displayed
- ✅ Device appears in list immediately
- ✅ Error messages show when validation fails
- ✅ Loading states clear properly

**Current Status:** All form functionality operational

### Q: What was the CSS styling bug and how was it fixed?
**A:** UI Styling Bug (Fixed October 15, 2025):

**Original Problem:**
- Input fields invisible on dark background
- No text visible when typing
- Invalid CSS syntax throughout file
- Poor focus state indication

**Specific Issues:**
1. **Invisible Input Fields:**
   - No background color specified
   - White text on white/transparent background
   - Placeholder text also invisible

2. **Invalid CSS Syntax:**
   - Multiple instances of: `bg-slate-800 or bg-slate-900`
   - "or" is not valid Tailwind CSS
   - Broke class application
   - 24+ locations affected

3. **Missing Focus States:**
   - No visual feedback when field focused
   - User couldn't tell which field was active

**Fixes Applied:**

**Input Field Styling:**
```typescript
// BEFORE (invisible):
className="w-full px-3 py-2 border border-slate-700 rounded-md"

// AFTER (visible):
className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 
           rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 
           focus:border-transparent"
```

**Changes:**
- Added `bg-slate-700` - visible dark background
- Added `text-white` - white text color
- Changed border to `border-slate-600` - better contrast
- Added focus ring: `focus:ring-orange-500`
- Added `focus:border-transparent`

**Invalid CSS Fixed:**
- Removed all "or" syntax
- Changed to: `bg-slate-800`
- Applied to 24+ locations
- Added proper border colors

**Button Validation Enhanced:**
- Added `disabled:cursor-not-allowed`
- Improved disabled state opacity
- Better visual feedback

**Testing Results:**
- ✅ All input fields visible
- ✅ Text clearly readable while typing
- ✅ Focus states work correctly
- ✅ Dropdown options visible
- ✅ Consistent dark theme styling

---

## Integration with Wolfpack Matrix Switcher

### Q: How does Fire TV integrate with the Wolfpack matrix switcher?
**A:** Complete integration overview:

**Physical Setup:**
- Fire TV Cube HDMI output → Wolfpack Matrix Input 13
- Matrix can route Input 13 to any of 32 TV outputs
- Matrix controlled separately via RS-232 or network

**Logical Integration:**
- Fire TV device assigned to matrix input channel in configuration
- System tracks which Fire TV maps to which input
- Routing commands coordinate Fire TV and matrix control
- Unified UI for both Fire TV control and matrix routing

**Integration Points:**
1. **Matrix Input Assignment:** Fire TV assigned to Input 13
2. **Routing API:** Route Input 13 to desired output(s)
3. **Unified Interface:** Single UI for Fire TV + matrix control
4. **Bartender Remote:** Quick preset routing buttons
5. **Status Display:** Visual indication of active routes

**Use Cases:**
- Route Fire TV to main bar TV for game
- Switch Fire TV between multiple displays
- Show same Fire TV content on multiple TVs simultaneously
- Quick switching between Fire TV and other sources

### Q: What is the current matrix configuration for the Fire TV Cube?
**A:** Production matrix configuration:
- **Fire TV Device:** Fire TV Cube at 192.168.5.131
- **Matrix Input:** Channel 13
- **Input Label:** "Input 13 (HDMI)"
- **Physical Connection:** Fire TV HDMI out → Matrix Input 13 port
- **Available Outputs:** Can route to any output 1-32
- **Common Routes:** Configured via bartender remote presets
- **Matrix Model:** Wolfpack 32x32 HDMI Matrix Switcher

### Q: How do I route Fire TV content to a specific TV?
**A:** Routing methods:

**Method 1: Matrix Control Tab**
1. Navigate to Video Matrix or Matrix Control section
2. Select target output (TV display) - choose from outputs 1-32
3. Select Fire TV's input channel (13) from source dropdown
4. Click "Route" or "Apply" button
5. Fire TV content appears on selected TV within seconds

**Method 2: Bartender Remote**
1. Go to Remote Control → Bartender Remote tab
2. Select target TV output from grid
3. Click "Fire TV" source button
4. Preset routing executes automatically

**Method 3: API Direct Call**
```bash
POST /api/matrix/route
Content-Type: application/json

{
  "input": 13,      # Fire TV Cube matrix input
  "output": 33,     # Target TV output
  "action": "route"
}
```

**Method 4: Bulk Routing (Multiple TVs)**
```bash
POST /api/matrix/route-multiple
Content-Type: application/json

{
  "input": 13,
  "outputs": [33, 34, 35],  # Route to multiple TVs
  "action": "route"
}
```

### Q: Can I control Fire TV and route it simultaneously?
**A:** Yes, coordinated control available:

**Workflow Example:**
1. Route Fire TV to desired TV(s) via matrix API
2. Send Fire TV commands to launch app (e.g., ESPN)
3. Navigate to specific content using remote commands
4. Adjust matrix routing as needed

**API Coordination:**
```javascript
// Step 1: Route Fire TV to TV #33
await fetch('/api/matrix/route', {
  method: 'POST',
  body: JSON.stringify({ input: 13, output: 33 })
});

// Step 2: Launch ESPN on Fire TV
await fetch('/api/firetv-devices/send-command', {
  method: 'POST',
  body: JSON.stringify({
    deviceId: 'device_id',
    appPackage: 'com.espn.score_center'
  })
});

// Step 3: Navigate to specific game
await fetch('/api/firetv-devices/send-command', {
  method: 'POST',
  body: JSON.stringify({
    deviceId: 'device_id',
    command: 'DOWN'  // Navigate to game
  })
});
```

**Benefits:**
- Automated game day setup
- One-button routing + content selection
- Coordinated multi-TV display
- Reduced manual steps for staff

### Q: How do I see which Fire TV is active on which TV?
**A:** Status viewing methods:

**Matrix Control Dashboard:**
- Visual grid showing all input-output connections
- Color-coded active routes
- Fire TV (Input 13) highlights when routed
- Shows all outputs currently displaying Fire TV

**Device Status Card:**
- Fire TV device card shows routing status
- Example: "Active on Outputs: 33, 34"
- Real-time update when routes change

**API Query:**
```bash
GET /api/matrix/routes

Response:
{
  "routes": [
    {
      "input": 13,
      "inputLabel": "Fire TV Cube",
      "outputs": [33, 34, 35],
      "outputLabels": ["Bar TV 1", "Bar TV 2", "Dining TV"]
    }
  ]
}
```

**Bartender Remote:**
- Visual representation of active sources
- Highlighted buttons show active routes
- Quick reference for staff

---

## Form Submission and Device Management

### Q: How do I add a new Fire TV device using the form?
**A:** Complete step-by-step guide:

**Step 1: Access Fire TV Control**
- Open Sports Bar TV Controller web interface
- Navigate to "Remote Control" or "Fire TV Control" section
- Look for "Add Fire TV Device" or "+" button
- Click to open device creation form

**Step 2: Fill Device Information**

**Required Fields:**
1. **Device Name:** Enter descriptive name
   - Example: "Bar Main TV", "Dining Area Fire TV", "Fire TV Cube Bar"
   - Used for identification in UI
   - Should be unique for clarity

2. **IP Address:** Enter Fire TV network address
   - Example: 192.168.5.131
   - Must be valid IPv4 format
   - Find in Fire TV Settings → Network
   - Recommend static IP or DHCP reservation

3. **Port:** Enter ADB port (default 5555)
   - Usually leave as 5555
   - Only change if custom ADB port configured
   - Must be 1-65535

4. **Device Type:** Select from dropdown
   - Fire TV Cube (recommended for bars)
   - Fire TV Stick
   - Fire TV Stick 4K Max
   - Standard Fire TV
   - Affects available features

**Optional Fields:**
5. **Matrix Input Channel:** Select if using matrix switcher
   - Channels 1-32 available
   - Example: Select "13" for Input 13
   - Can be added/changed later

**Step 3: Submit Form**
- Click "Add Device" or "Save" button
- Wait for confirmation (1-3 seconds)
- Success message: "Fire TV device added successfully"
- Device appears in device list immediately

**Step 4: Verify Addition**
- Device shows in Fire TV device list
- Status indicator appears (online/offline)
- "Test Connection" button available
- Can now send commands to device

**Step 5: Test Connection**
- Click "Test Connection" button
- Wait for result (2-5 seconds)
- Success: Green checkmark, "Connected via ADB"
- Failure: Error message with troubleshooting steps

### Q: What validation errors might I encounter?
**A:** Common validation errors and solutions:

**"Device name is required"**
- **Cause:** Name field left empty
- **Solution:** Enter any descriptive name
- **Minimum:** 1 character
- **Recommended:** Descriptive name (e.g., "Bar TV 1")

**"Invalid IP address format"**
- **Cause:** IP doesn't match IPv4 pattern
- **Valid Examples:** 192.168.5.131, 10.0.0.50, 172.16.0.10
- **Invalid Examples:** 192.168.5, 192.168.5.256, abc.def.ghi.jkl
- **Solution:** Verify IP from Fire TV Settings → Network

**"Port must be between 1 and 65535"**
- **Cause:** Port number out of valid range
- **Solution:** Use 5555 (default) or valid custom port
- **Note:** Ports below 1024 may require special permissions

**"Device with this IP address and port already exists"**
- **Cause:** Another device already configured with same IP+port
- **Solution:** Check existing devices, use different IP or port
- **Note:** Each device must have unique IP+port combination

**"Invalid matrix input channel"**
- **Cause:** Channel number not in range 1-32
- **Solution:** Select valid channel from dropdown
- **Alternative:** Leave blank if not using matrix

### Q: How do I edit an existing Fire TV device?
**A:** Device editing process:

**Step 1: Locate Device**
- Find device in Fire TV device list
- Device shows current name, IP, status

**Step 2: Open Edit Mode**
- Click "Edit" button (green pencil icon)
- Edit form opens with current values populated
- All fields editable except device ID

**Step 3: Modify Fields**
- Change any field: name, IP, port, type, matrix input
- Validation applies same as device creation
- Can't create duplicate IP+port combinations

**Step 4: Save Changes**
- Click "Update Device" or "Save" button
- Changes saved immediately
- Success message displayed
- Device list updates with new information

**Step 5: Verify Changes**
- Check device card shows updated info
- Test connection if IP or port changed
- Verify matrix routing if input channel changed

**What Can Be Updated:**
- Device name
- IP address (requires reconnection)
- Port (requires reconnection)
- Device type
- Matrix input channel
- Original creation timestamp preserved

**What Cannot Be Updated:**
- Device ID (auto-generated, permanent)
- Creation timestamp

### Q: How do I delete a Fire TV device?
**A:** Device deletion process:

**Step 1: Locate Device**
- Find device in Fire TV device list
- Verify it's the correct device to delete

**Step 2: Initiate Deletion**
- Click red "Delete" or trash icon
- Confirmation dialog appears

**Step 3: Confirm Deletion**
- Dialog asks: "Are you sure you want to delete [device name]?"
- Read warning: "This action cannot be undone"
- Click "Confirm" or "Delete"

**Step 4: Deletion Complete**
- Device removed from list immediately
- Success message: "Fire TV device deleted successfully"
- Configuration file updated
- Backup includes deleted device (for recovery)

**API Method:**
```bash
DELETE /api/firetv-devices?id=firetv_1697385600_xyz123

Response:
{
  "message": "Fire TV device deleted successfully",
  "deletedDevice": {
    "name": "Bar TV 1",
    "ipAddress": "192.168.5.131"
  }
}
```

**Recovery Options:**
- Restore from automated backup (in /backups/)
- Re-add device manually with same configuration
- No built-in "undo" feature

**Important Notes:**
- Physical Fire TV device unaffected (still functional)
- Only removes from controller configuration
- Matrix routing unaffected (physical HDMI remains)
- Can re-add same device anytime

---

## Streaming Apps and Sports Content

### Q: What streaming apps are pre-configured for the Fire TV system?
**A:** Complete streaming app library:

**Major Sports Streaming Apps:**
- **ESPN** - `com.espn.score_center` - Live sports, highlights, analysis
- **FOX Sports** - `com.fox.now` - Live games, NFL, MLB, soccer
- **NBC Sports** - `com.nbc.nbcsports.liveextra` - Olympics, NHL, Premier League
- **Paramount+** (CBS Sports) - `com.cbs.ott` - NFL, Champions League, golf
- **Hulu Live TV** - `com.hulu.plus` - Live sports channels
- **YouTube TV** - `com.google.android.youtube.tv` - Live TV with sports
- **Sling TV** - `com.sling` - Live sports channels
- **FuboTV** - `com.fubo.android` - Sports-focused streaming

**League-Specific Apps:**
- **MLB.TV** - `com.bamnetworks.mobile.android.gameday.mlb` - Live baseball
- **NBA League Pass** - `com.nba.game` - Live basketball games
- **NHL.TV** - `com.nhl.gc1112.free` - Live hockey games
- **NFL+** - `com.nflmobile.nflnow` - NFL games and content
- **NFL Game Pass** - `com.nfl.gamepass` - NFL replays and archives

**Premium Entertainment:**
- **Netflix** - `com.netflix.ninja` - Movies and TV shows
- **Prime Video** - `com.amazon.avod.thirdpartyclient` - Amazon originals and content
- **Max (HBO)** - `com.hbo.hbonow` - HBO content, sports
- **Disney+** - `com.disney.disneyplus` - Disney, Marvel, Star Wars, ESPN+ content

**News & Information:**
- **CNN** - `com.cnn.mobile.android.phone`
- **FOX News** - `com.foxnews.android`
- **NBC News** - `com.nbcuni.nbc.liveextra`

**Social & Video:**
- **YouTube** - `com.google.android.youtube.tvkids`
- **Plex** - `com.plexapp.android` - Personal media server

### Q: How do I launch a specific app on Fire TV?
**A:** Multiple app launch methods:

**Method 1: UI Quick Access Buttons**
1. Navigate to Fire TV control panel
2. Locate "Quick Access Sports Apps" section
3. Click app icon (ESPN, FOX Sports, YouTube TV, etc.)
4. App launches automatically on Fire TV
5. Takes 2-5 seconds to launch

**Method 2: App Category Browser**
1. Select device in Fire TV control panel
2. Click "Apps" or app launcher button
3. Filter by category: Sports, Entertainment, News, Premium
4. Click desired app to launch
5. Sports category default for bar environment

**Method 3: API Launch Command**
```bash
POST /api/firetv-devices/send-command
Content-Type: application/json

{
  "deviceId": "device_id",
  "ipAddress": "192.168.5.131",
  "port": 5555,
  "appPackage": "com.espn.score_center"
}
```

**Method 4: Direct ADB Command**
```bash
# Launch ESPN
adb -s 192.168.5.131:5555 shell monkey -p com.espn.score_center 1

# Launch Netflix
adb -s 192.168.5.131:5555 shell monkey -p com.netflix.ninja 1

# Alternative method
adb -s 192.168.5.131:5555 shell am start -n com.espn.score_center/.MainActivity
```

**Quick Access Sports Commands:**
- ESPN: `monkey -p com.espn.score_center 1`
- FOX Sports: `monkey -p com.fox.now 1`
- YouTube TV: `monkey -p com.google.android.youtube.tv 1`
- NFL+: `monkey -p com.nflmobile.nflnow 1`
- NBA League Pass: `monkey -p com.nba.game 1`
- MLB.TV: `monkey -p com.bamnetworks.mobile.android.gameday.mlb 1`

### Q: How do I find the package name of an app not in the list?
**A:** Package name discovery methods:

**Method 1: ADB Query (Recommended)**
```bash
# List all installed packages
adb -s 192.168.5.131:5555 shell pm list packages

# Search for specific app (case insensitive)
adb -s 192.168.5.131:5555 shell pm list packages | grep -i espn
# Output: package:com.espn.score_center

# List only user-installed apps (exclude system)
adb -s 192.168.5.131:5555 shell pm list packages -3
```

**Method 2: Get Currently Running App**
```bash
# Shows package name of current foreground app
adb -s 192.168.5.131:5555 shell dumpsys window | grep mCurrentFocus

# Example output:
# mCurrentFocus=Window{abc123 u0 com.netflix.ninja/com.netflix.MainActivity}
# Package name: com.netflix.ninja
```

**Method 3: Online Resources**
- Search "Fire TV [app name] package name"
- Check APK download sites (APKMirror, APKPure) - list package names
- Amazon App Store URLs often include package name
- Fire TV developer documentation

**Method 4: Fire TV Shell**
```bash
# Interactive shell
adb -s 192.168.5.131:5555 shell

# From shell, list packages
pm list packages | grep -i [search term]
```

**Common Package Naming Patterns:**
- ESPN apps: `com.espn.*`
- FOX apps: `com.fox.*`
- NBC apps: `com.nbc.*`
- League apps: `com.nfl.*`, `com.nba.*`, `com.mlb.*`, `com.nhl.*`
- Netflix: `com.netflix.ninja` (not com.netflix.android)
- Amazon apps: `com.amazon.*`

### Q: How do I stop a running app on Fire TV?
**A:** App termination methods:

**Method 1: Force Stop via ADB**
```bash
# Force stop Netflix
adb -s 192.168.5.131:5555 shell am force-stop com.netflix.ninja

# Force stop ESPN
adb -s 192.168.5.131:5555 shell am force-stop com.espn.score_center
```

**Method 2: API Force Stop**
```javascript
POST /api/firetv-devices/send-command
{
  "deviceId": "device_id",
  "command": "am force-stop com.netflix.ninja"
}
```

**Method 3: Return to Home**
- Send HOME command
- App continues in background
- Fire TV home screen displays
- App can be resumed from recent apps

**Method 4: Clear Recent Apps**
```bash
# Long press HOME button on remote
# Or via ADB
adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_APP_SWITCH

# Then send DOWN and SELECT to close
```

**Method 5: Restart Fire TV**
```bash
# Reboot device (closes all apps)
adb -s 192.168.5.131:5555 shell reboot
# Note: Requires device authorization
```

**What Happens When App Stopped:**
- App terminates completely
- Memory freed
- Must relaunch to use again
- User data/session may be cleared
- Useful for troubleshooting frozen apps

---

## Advanced Topics and Automation

### Q: Can I automate Fire TV actions on a schedule?
**A:** Yes, multiple automation methods available:

**Method 1: Cron Jobs (Linux)**
```bash
# Edit crontab
crontab -e

# Launch ESPN at 7 PM daily (19:00)
0 19 * * * curl -X POST http://localhost:3000/api/firetv-devices/send-command \
-H "Content-Type: application/json" \
-d '{"deviceId":"device_id","ipAddress":"192.168.5.131","port":5555,"appPackage":"com.espn.score_center"}'

# Launch FOX Sports on Sundays at 1 PM (NFL games)
0 13 * * 0 curl -X POST http://localhost:3000/api/firetv-devices/send-command \
-H "Content-Type: application/json" \
-d '{"deviceId":"device_id","appPackage":"com.fox.now"}'

# Return to home screen at closing time (2 AM)
0 2 * * * curl -X POST http://localhost:3000/api/firetv-devices/send-command \
-H "Content-Type: application/json" \
-d '{"deviceId":"device_id","command":"HOME"}'
```

**Method 2: Node.js Scheduling**
```javascript
const schedule = require('node-schedule');

// Launch ESPN every day at 7 PM
schedule.scheduleJob('0 19 * * *', async function(){
  await fetch('http://localhost:3000/api/firetv-devices/send-command', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      deviceId: 'device_id',
      ipAddress: '192.168.5.131',
      port: 5555,
      appPackage: 'com.espn.score_center'
    })
  });
});
```

**Method 3: Bash Script with Scheduling**
```bash
#!/bin/bash
# /home/ubuntu/scripts/firetv-game-day.sh

# Launch streaming apps for game day
curl -X POST http://localhost:3000/api/firetv-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"device_id","appPackage":"com.espn.score_center"}'

sleep 5

# Route to main bar TV
curl -X POST http://localhost:3000/api/matrix/route \
  -H "Content-Type: application/json" \
  -d '{"input":13,"output":33}'
```

**Schedule with cron:**
```bash
# Every Sunday at 12:45 PM (before 1 PM NFL games)
45 12 * * 0 /home/ubuntu/scripts/firetv-game-day.sh
```

**Use Cases:**
- Launch sports apps before games
- Return to home screen after hours
- Automated content switching
- Pre-event setup
- Post-event cleanup

**Future Enhancement:**
- Built-in scheduling UI (planned)
- Game day automation presets
- Event-triggered actions
- Integration with sports API schedules

### Q: Can I send text input to Fire TV for search functionality?
**A:** Yes, text input supported with limitations:

**Method 1: API Text Input**
```bash
POST /api/firetv-devices/send-command
{
  "deviceId": "device_id",
  "command": "input text \"NFL highlights\""
}
```

**Method 2: Direct ADB Text Input**
```bash
# Simple search query
adb -s 192.168.5.131:5555 shell input text "NFL"

# Multi-word query (use quotes in command)
adb -s 192.168.5.131:5555 shell input text "NFL\ highlights"

# URL encoding for special characters
adb -s 192.168.5.131:5555 shell input text "Bills%20vs%20Chiefs"
```

**Limitations and Considerations:**

**Character Restrictions:**
- Spaces require escaping: `\ ` or `%20`
- Special characters may need URL encoding
- Some characters not supported: `& | < > ; " '`
- Length limit: ~100 characters typical

**Context Requirements:**
- Search field must be focused/active
- Not all apps accept text input
- Some apps have custom keyboards
- Fire TV voice search may be easier

**Alternatives:**
- Use voice search command: `KEYCODE_SEARCH`
- Navigate to search manually
- Launch app directly instead of searching
- Use app-specific search if available

**Example Workflow:**
```bash
# 1. Launch Netflix
adb -s 192.168.5.131:5555 shell monkey -p com.netflix.ninja 1

# 2. Wait for app to load
sleep 3

# 3. Navigate to search
adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_SEARCH

# 4. Enter search text
adb -s 192.168.5.131:5555 shell input text "Action\ Movies"

# 5. Confirm search
adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_DPAD_CENTER
```

### Q: What diagnostic information can I retrieve from Fire TV?
**A:** Comprehensive diagnostics available:

**System Properties:**
```bash
# All system properties
adb -s 192.168.5.131:5555 shell getprop

# Specific properties
adb -s 192.168.5.131:5555 shell getprop ro.product.model
# Output: AFTGAZL

adb -s 192.168.5.131:5555 shell getprop ro.build.version.release
# Output: 9

adb -s 192.168.5.131:5555 shell getprop ro.serialno
# Output: [device serial number]

adb -s 192.168.5.131:5555 shell getprop ro.product.manufacturer
# Output: Amazon
```

**Network Information:**
```bash
# IP address and network details
adb -s 192.168.5.131:5555 shell ifconfig wlan0

# All network interfaces
adb -s 192.168.5.131:5555 shell ip addr show

# Network connectivity test
adb -s 192.168.5.131:5555 shell ping -c 4 8.8.8.8
```

**Storage Information:**
```bash
# Disk space usage
adb -s 192.168.5.131:5555 shell df -h

# Specific partition
adb -s 192.168.5.131:5555 shell df -h /data
```

**Running Processes:**
```bash
# Current foreground app
adb -s 192.168.5.131:5555 shell dumpsys window | grep mCurrentFocus

# All running services
adb -s 192.168.5.131:5555 shell dumpsys activity services

# Process list
adb -s 192.168.5.131:5555 shell ps
```

**Memory Information:**
```bash
# Memory usage
adb -s 192.168.5.131:5555 shell dumpsys meminfo

# Free memory
adb -s 192.168.5.131:5555 shell free
```

**Battery/Power (if applicable):**
```bash
# Battery status
adb -s 192.168.5.131:5555 shell dumpsys battery

# Power stats
adb -s 192.168.5.131:5555 shell dumpsys power
```

**Installed Apps:**
```bash
# All packages
adb -s 192.168.5.131:5555 shell pm list packages

# User-installed only
adb -s 192.168.5.131:5555 shell pm list packages -3

# System packages only
adb -s 192.168.5.131:5555 shell pm list packages -s

# Package details
adb -s 192.168.5.131:5555 shell dumpsys package com.netflix.ninja
```

**Device Uptime:**
```bash
# System uptime
adb -s 192.168.5.131:5555 shell uptime
# Output: up 5 days, 12:34:56
```

**Useful for Troubleshooting:**
- Performance issues: Check memory/CPU
- Connectivity problems: Check network info
- App crashes: Check running processes
- Storage full: Check disk space
- System updates: Check OS version

---

## Best Practices and Deployment Guidelines

### Q: What are the best practices for Fire TV deployment in a sports bar?
**A:** Comprehensive deployment guide:

**1. Network Infrastructure**

**IP Address Management:**
- Assign static IPs to all Fire TV devices
- Or use DHCP reservations based on MAC addresses
- Document all IP assignments in spreadsheet
- Production device: 192.168.5.131 (Fire TV Cube)
- Plan IP scheme: 192.168.5.131-140 for Fire TVs

**Network Configuration:**
- Dedicated network segment for streaming devices (optional)
- QoS enabled for streaming traffic priority
- Bandwidth: Minimum 25 Mbps per 4K stream
- Low latency: < 50ms to Fire TV devices
- No VLAN isolation between controller and Fire TVs

**Firewall Rules:**
- Allow ADB port 5555 between controller and Fire TVs
- Block external access to ADB ports (security)
- Allow streaming service traffic (ESPN, Netflix, etc.)

**2. Device Configuration**

**Fire TV Setup:**
- Enable ADB debugging on all devices
- Disable automatic updates (schedule for off-hours)
- Set display output to match TV capabilities (4K, HDR)
- Configure network: Ethernet preferred over WiFi
- Disable screen saver or set to reasonable timeout
- Turn off automatic sleep during business hours

**Developer Options:**
- ADB Debugging: ON (required)
- Apps from Unknown Sources: OFF (security)
- USB Debugging: OFF (not needed for network ADB)
- Stay Awake: ON (prevents sleep while charging)

**3. Documentation**

**Essential Records:**
- Device inventory with serial numbers
- IP address assignments map
- Matrix input channel mappings
- Physical location labels
- Purchase dates and warranty info

**Network Diagram:**
```
Fire TV Cube (192.168.5.131) → Matrix Input 13 → Outputs 33-35
Fire TV Stick (192.168.5.132) → Matrix Input 14 → Outputs 36-38
...
```

**Troubleshooting Log:**
- Date/time of issues
- Error messages observed
- Solutions applied
- Effectiveness of solutions

**4. Operational Procedures**

**Daily Checks:**
- Verify all Fire TVs show "online" in UI
- Test connection to each device
- Check for software update notifications
- Verify streaming apps still logged in

**Weekly Maintenance:**
- Export device configuration backup
- Review error logs for patterns
- Test matrix routing to all TVs
- Verify app subscriptions active

**Pre-Event Preparation:**
- Test all Fire TVs 1 hour before games
- Pre-launch required streaming apps
- Verify correct content accessible
- Test matrix routing to game-viewing TVs
- Have backup plan ready

**5. App Management**

**Pre-Installed Apps:**
- Install all required sports apps
- Login to all streaming services
- Test each app launches correctly
- Save login credentials securely
- Configure app settings (quality, autoplay)

**Subscription Management:**
- Maintain list of all subscriptions
- Track renewal dates
- Verify coverage areas (blackouts)
- Test access before games
- Have backup streaming options

**6. Security Measures**

**Access Control:**
- Limit physical access to Fire TV devices
- Secure remote locations (locked cabinets)
- Controller server access restricted
- SSH keys for server access
- Strong passwords for streaming accounts

**Network Security:**
- Fire TVs on isolated VLAN (optional)
- Firewall rules blocking external ADB access
- Regular security updates applied
- Monitor for unauthorized access attempts

**7. Backup and Recovery**

**Configuration Backups:**
- Daily automated backups at 3:00 AM
- Manual backup before changes
- Backup location: /backups/ with timestamps
- Off-site backup copy weekly
- Test restore procedure quarterly

**Device Replacement Plan:**
- Keep spare Fire TV configured
- Document setup procedure
- Replacement time: < 30 minutes
- Test spare device monthly

**8. Performance Optimization**

**Device Optimization:**
- Close unused apps regularly
- Clear cache monthly
- Restart Fire TV weekly during off-hours
- Monitor storage space (>2GB free)
- Update apps during maintenance windows

**Network Optimization:**
- Monitor bandwidth usage
- Identify network bottlenecks
- Optimize QoS rules
- Regular speed tests
- Router firmware updates

**9. Staff Training**

**Training Topics:**
- How to add new Fire TV device
- How to test connection
- How to launch apps via UI
- How to route Fire TV to TVs
- Basic troubleshooting steps

**Quick Reference Cards:**
- Print quick reference for bar staff
- Include common tasks
- Emergency contact info
- Backup procedures
- Troubleshooting flowchart

**10. Monitoring and Alerts**

**Health Monitoring:**
- Automated connection tests
- Alert on device offline
- Track command success rates
- Monitor network latency
- App crash detection

**Alert Thresholds:**
- Device offline > 5 minutes: Alert
- Command failure rate > 10%: Warning
- Network latency > 100ms: Warning
- Storage < 1GB free: Alert

### Q: How many Fire TV devices can the system manage?
**A:** Scalability considerations:

**Technical Limits:**
- **No Hard Code Limit:** System can manage unlimited devices theoretically
- **Practical Limit:** 32 devices (limited by matrix inputs)
- **Tested Configuration:** Up to 10 devices without performance issues
- **Recommended Maximum:** 15 devices for optimal performance

**Performance Factors:**
- **Network Bandwidth:** Each 4K stream requires ~25 Mbps
- **Server Resources:** Controller server can handle 20+ devices
- **Matrix Capacity:** Wolfpack 32x32 matrix = 32 possible Fire TV inputs
- **ADB Connections:** Can maintain many simultaneous connections

**Scaling Recommendations:**
- Monitor server CPU/memory with 10+ devices
- Consider load balancing for 20+ devices
- Plan network capacity (bandwidth, switch ports)
- Document all device configurations
- Test performance before adding more devices

**Sports Bar Typical Setup:**
- Small bar (5-10 TVs): 2-3 Fire TV devices
- Medium bar (15-20 TVs): 4-6 Fire TV devices
- Large bar (30+ TVs): 8-12 Fire TV devices
- Production: Currently 1 Fire TV Cube at 192.168.5.131

### Q: What should I monitor for Fire TV system health?
**A:** Comprehensive health monitoring checklist:

**1. Connectivity Monitoring**

**Key Metrics:**
- All Fire TVs show "online" status: ✅ Target 100%
- Connection test success rate: ✅ Target >95%
- Response times: ✅ Target <500ms
- ADB connection stability: ✅ No disconnections

**Monitoring Methods:**
```bash
# Automated health check script
#!/bin/bash
# /home/ubuntu/scripts/firetv-health-check.sh

DEVICE_IP="192.168.5.131"
DEVICE_PORT="5555"

# Test ping
ping -c 1 $DEVICE_IP > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Fire TV reachable"
else
  echo "❌ Fire TV unreachable"
  exit 1
fi

# Test ADB connection
adb devices | grep "$DEVICE_IP:$DEVICE_PORT" | grep "device" > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ ADB connected"
else
  echo "❌ ADB disconnected - attempting reconnect"
  adb connect $DEVICE_IP:$DEVICE_PORT
fi

# Test command execution
adb -s $DEVICE_IP:$DEVICE_PORT shell getprop ro.product.model > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Commands responding"
else
  echo "❌ Command execution failed"
fi
```

**Schedule with cron:**
```bash
# Run health check every 5 minutes
*/5 * * * * /home/ubuntu/scripts/firetv-health-check.sh >> /var/log/firetv-health.log
```

**2. Device Status Monitoring**

**Critical Indicators:**
- ADB debugging remains enabled: Check daily
- Fire TV software up to date: Check weekly
- No error messages in device status: Monitor continuously
- Storage space available: >2GB free recommended

**Status Checks:**
```bash
# Check storage space
adb -s 192.168.5.131:5555 shell df -h /data

# Check Fire OS version
adb -s 192.168.5.131:5555 shell getprop ro.build.version.name

# Check uptime
adb -s 192.168.5.131:5555 shell uptime
```

**3. Performance Monitoring**

**Performance Metrics:**
- Command execution time: <2 seconds target
- App launch time: <5 seconds target
- No timeouts: <1% failure rate acceptable
- Memory usage: <80% utilized

**Performance Tests:**
```bash
# Time command execution
time adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_HOME

# Check memory usage
adb -s 192.168.5.131:5555 shell dumpsys meminfo | grep "Total RAM"
```

**4. Matrix Integration Monitoring**

**Routing Checks:**
- Fire TV routes correctly to TVs: Test daily before events
- No routing conflicts: Verify input assignments unique
- Input assignments correct: Document and verify
- Physical connections secure: Check monthly

**Routing Test:**
```bash
# Test matrix routing
curl -X POST http://localhost:3000/api/matrix/route \
  -H "Content-Type: application/json" \
  -d '{"input":13,"output":33}'

# Verify routing
curl http://localhost:3000/api/matrix/routes
```

**5. System Log Monitoring**

**Log Locations:**
```bash
# PM2 application logs
~/.pm2/logs/sports-bar-tv-out.log
~/.pm2/logs/sports-bar-tv-error.log

# Fire TV health check logs
/var/log/firetv-health.log

# System logs
/var/log/syslog
```

**Important Log Patterns:**
- "Fire TV device offline" - Connectivity issue
- "ADB connection error" - ADB debugging may be disabled
- "Command timeout" - Network or device performance issue
- "Connection refused" - Device unreachable or ADB disabled

**Log Monitoring:**
```bash
# Watch for errors in real-time
tail -f ~/.pm2/logs/sports-bar-tv-error.log | grep "Fire TV"

# Count recent errors
grep "Fire TV" ~/.pm2/logs/sports-bar-tv-error.log | tail -100 | wc -l
```

**6. Alert Configuration**

**Alert Thresholds:**
- Device offline >5 minutes: **CRITICAL** - Send alert
- Command failure rate >10%: **WARNING** - Investigate
- Network latency >100ms: **WARNING** - Check network
- Storage <1GB: **WARNING** - Clear cache
- Multiple connection failures: **CRITICAL** - Check ADB

**Alert Script Example:**
```bash
#!/bin/bash
# /home/ubuntu/scripts/firetv-alert.sh

DEVICE_IP="192.168.5.131"
ALERT_EMAIL="admin@sportsbar.com"

# Test connection
ping -c 1 $DEVICE_IP > /dev/null
if [ $? -ne 0 ]; then
  echo "Fire TV Cube at $DEVICE_IP is unreachable!" | \
  mail -s "ALERT: Fire TV Offline" $ALERT_EMAIL
fi
```

**7. Dashboard Metrics**

**Recommended Dashboard:**
- Device online/offline status (green/red indicators)
- Last successful connection timestamp
- Command success rate (last 100 commands)
- Network latency graph (last 24 hours)
- Storage space remaining
- Active matrix routes

**Monitoring Tools:**
- Built-in UI status indicators
- Custom monitoring dashboard (planned)
- PM2 monitoring: `pm2 monit`
- System monitoring: htop, iftop

---

## Document Metadata

**Document Information:**
- **Version:** 2.0
- **Created:** October 15, 2025
- **Last Updated:** October 16, 2025
- **Created By:** Sports Bar TV Controller AI System
- **Purpose:** AI Hub training and comprehensive system reference

**Coverage Summary:**
- ✅ Device Setup and Configuration (Production specs included)
- ✅ IP Address and Port Requirements (192.168.5.131 documented)
- ✅ ADB Bridge Setup and Configuration (Current server config)
- ✅ Matrix Input Channel Configuration (Input 13 documented)
- ✅ Subscription Polling Functionality
- ✅ Remote Control Commands (Complete keycode reference)
- ✅ API Endpoints Reference (Full REST API documentation)
- ✅ Common Troubleshooting Issues (Real-world solutions)
- ✅ Integration with Wolfpack Matrix Switcher
- ✅ Form Submission and Device Management (Bug fixes documented)
- ✅ Streaming Apps and Sports Content (Complete app library)
- ✅ Advanced Topics and Automation (Scheduling, diagnostics)
- ✅ Best Practices and Deployment Guidelines

**Total Q&A Pairs:** 95+

**Related Documentation:**
- `/home/ubuntu/firetv_ads_bridge_setup.md` - ADB bridge setup report
- `/home/ubuntu/firetv_testing_findings.md` - Form fix and testing report
- `/home/ubuntu/Sports-Bar-TV-Controller/SYSTEM_DOCUMENTATION.md` - Main system documentation
- GitHub Repository: https://github.com/dfultonthebar/Sports-Bar-TV-Controller

**Production Environment:**
- **Server:** 192.168.5.100:224 (SSH accessible)
- **Fire TV Cube:** 192.168.5.131:5555 (AFTGAZL, ADB enabled)
- **Matrix Input:** Channel 13
- **Project Path:** /home/ubuntu/Sports-Bar-TV-Controller
- **Status:** Fully operational as of October 16, 2025

**Feedback and Updates:**
For corrections, additions, or updates to this documentation:
- Submit through AI Hub
- Create GitHub issue
- Update via SSH to server

---

*End of Amazon Fire TV System Q&A Sheet - Version 2.0*
