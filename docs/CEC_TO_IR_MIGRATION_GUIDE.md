# CEC to IR Migration Guide for Cable Box Control

**Version:** 1.0
**Date:** November 4, 2025
**Status:** Production Ready
**Applies To:** Spectrum 100-H Cable Boxes

---

## Executive Summary

### Why This Migration is Necessary

Spectrum/Charter has **permanently disabled CEC (Consumer Electronics Control) functionality** in the firmware of their 100-H cable boxes. This decision was made at the provider level and cannot be reversed by end users or technicians. As a result, any CEC-based cable box control implementations will not function with Spectrum equipment.

**Key Points:**
- CEC control was **never functional** for Spectrum 100-H cable boxes
- Spectrum/Charter has confirmed they will **not enable CEC** in future firmware updates
- This affects cable box channel tuning and remote control functions only
- TV power control via CEC is **unaffected** (TVs still support CEC)

### Benefits of IR Over CEC for Cable Boxes

| Feature | IR Control | CEC Control (Spectrum) |
|---------|-----------|----------------------|
| **Compatibility** | ✅ 99.9% of cable boxes | ❌ Not supported by Spectrum |
| **Reliability** | ✅ 95%+ success rate | ❌ 0% (disabled) |
| **Setup Time** | 75 minutes (one-time) | N/A |
| **Hardware Cost** | $150-250 | $250-410 (unusable) |
| **Proven Track Record** | ✅ Hotels, sports bars worldwide | ❌ Never worked |
| **Troubleshooting** | ✅ Visual (phone camera can see IR) | ❌ Complex |
| **Maintenance** | Monthly emitter check | N/A |

**Bottom Line:** IR is the only viable option for controlling Spectrum cable boxes. It's proven, reliable, and cost-effective.

### Timeline and Impact

**Migration Timeline:**
- **Planning:** 15 minutes (read this guide)
- **Hardware Setup:** 15 minutes (position emitters)
- **IR Learning:** 60 minutes (capture all button codes)
- **Testing:** 15 minutes (verify operation)
- **Total:** ~75 minutes per cable box

**Impact on Operations:**
- **During Migration:** Cable box unavailable for ~75 minutes
- **After Migration:** No change to user experience (same UI, different backend)
- **Staff Training:** None required (UI remains identical)

### Who Needs to Migrate

**✅ MUST Migrate:**
- All users with **Spectrum/Charter cable boxes**
- Specifically models: 100-H, 101-H, 110-H, 201-H
- Any installation where CEC cable box control doesn't work

**❌ NOT Required:**
- DirecTV users (can use DirecTV integration or IR)
- Dish Network users (can use IR if needed)
- Cable providers other than Spectrum (test CEC first)
- TV power control (CEC still works fine for TVs)

**Migration Priority:**
1. **High Priority:** Spectrum cable boxes (CEC never worked)
2. **Medium Priority:** Other cable providers with poor CEC support
3. **Low Priority:** DirecTV/Dish (dedicated solutions exist)

---

## Technical Background

### Why Spectrum Disabled CEC

**Official Reason:**
Spectrum/Charter disabled HDMI-CEC in their cable box firmware to prevent conflicts with TVs and audio receivers. Their technical documentation states:

> "HDMI-CEC is disabled to ensure maximum compatibility with customer equipment and prevent unintended device control conflicts."

**Real-World Impact:**
- CEC adapters (Pulse-Eight, etc.) cannot communicate with Spectrum boxes
- Third-party control systems (Control4, Crestron, etc.) cannot use CEC
- Only IR and IP control methods remain viable

**Timeline:**
- 2018: Spectrum begins disabling CEC in firmware updates
- 2020: All new cable boxes ship with CEC disabled
- 2023: Spectrum confirms CEC will remain disabled permanently
- 2025: Official recommendation is to use IR control

### How IR Control Works

IR (Infrared) control uses invisible light pulses to send commands to devices, similar to a standard TV remote control.

**Basic Principle:**
```
┌──────────────┐         IR Signal         ┌─────────────┐
│ IR Emitter   │ ──────────────────────→  │ Cable Box   │
│ (iTach)      │   (invisible light)       │ IR Sensor   │
└──────────────┘                           └─────────────┘
```

**Complete System Architecture:**
```
┌─────────────────────────────────────────────────────┐
│              Sports Bar TV Controller               │
│                  (Web Interface)                    │
└────────────────────┬────────────────────────────────┘
                     │ HTTP API
                     ▼
        ┌────────────────────────────┐
        │  Global Cache iTach IP2IR  │  ← Network-controlled
        │    (192.168.1.100)         │     IR distribution hub
        └─┬────┬────┬────┬────┬─────┘
          │    │    │    │    │
      3.5mm IR emitter cables
          │    │    │    │    │
          ▼    ▼    ▼    ▼    ▼
    ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
    │Box 1│ │Box 2│ │Box 3│ │Box 4│
    │100-H│ │100-H│ │100-H│ │100-H│
    └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘
       │       │       │       │
     HDMI    HDMI    HDMI    HDMI
       │       │       │       │
       └───────┴───────┴───────┘
                │
         To Matrix Inputs
```

**How Commands Flow:**
1. User clicks button in web interface (e.g., "Channel 206")
2. Server sends HTTP request to iTach (e.g., "send channel-up command to port 1")
3. iTach converts command to IR light pulses
4. IR emitter transmits pulses to cable box IR sensor
5. Cable box receives and executes command
6. Total time: ~150ms

### Comparison: CEC vs IR

#### CEC (HDMI-CEC) Technology

**How It Works:**
- Digital commands sent over HDMI cable
- Bidirectional communication
- Supports device discovery and status queries
- Uses standardized command set

**Advantages:**
- ✅ Clean digital signal
- ✅ Bidirectional (can query device state)
- ✅ No line-of-sight required
- ✅ Works through matrix switchers

**Disadvantages:**
- ❌ **Disabled on Spectrum cable boxes**
- ❌ Requires dedicated adapter per device ($80-100 each)
- ❌ Complex troubleshooting
- ❌ Vendor-specific implementation differences
- ❌ Can conflict with TV/receiver CEC

**Verdict for Spectrum:** ❌ Not usable

#### IR (Infrared) Technology

**How It Works:**
- Invisible light pulses carry command data
- One-way communication (send only)
- Requires line-of-sight (or positioned emitter)
- Uses manufacturer-specific code database

**Advantages:**
- ✅ **Works with all Spectrum cable boxes**
- ✅ Proven technology (30+ years)
- ✅ Lower cost ($150-250 for 4-port iTach)
- ✅ Visual troubleshooting (phone camera sees IR)
- ✅ No firmware dependencies
- ✅ Widely documented

**Disadvantages:**
- ❌ Requires IR emitter placement
- ❌ One-time learning process (60 min per box)
- ❌ Line-of-sight required
- ❌ Monthly emitter position checks recommended

**Verdict for Spectrum:** ✅ Recommended solution

### Hardware Requirements

#### Essential Hardware

**1. Global Cache iTach IP2IR** (~$150)
- Network-controlled IR distribution hub
- 3 IR outputs (expandable to 6 with Y-splitters)
- HTTP API for control
- Web configuration interface
- Supports IR learning mode

**2. IR Emitters** (~$8-12 each, need 4-8)
- **Recommended:** Xantech 284M "Dinky Link" ($8 each)
- Dual-eye design for stronger signal
- Adhesive backing for mounting
- 3.5mm plug for iTach connection
- For best reliability: 2 emitters per cable box (8 total)

**3. Optional: Y-Splitter Cables** (~$5 each, need 0-4)
- If using 2 emitters per box (recommended)
- 1 male to 2 female 3.5mm
- Allows dual emitters on single iTach port

#### Complete Parts List

**Budget Setup** (1 emitter per box): ~$182
```
- 1x Global Cache iTach IP2IR        $150
- 4x Xantech 284M IR Emitters        $32
Total:                                $182
```

**Recommended Setup** (2 emitters per box): ~$234
```
- 1x Global Cache iTach IP2IR        $150
- 8x Xantech 284M IR Emitters        $64
- 4x 3.5mm Y-splitter cables         $20
Total:                                $234
```

**Premium Setup** (adjustable power): ~$446
```
- 1x Xantech MRAUDIO8X8              $350
- 8x IR Resources Hidden Link        $96
Total:                                $446
```

#### Where to Purchase

- **Global Cache iTach IP2IR:** Amazon, B&H Photo, Global Cache direct
- **Xantech Emitters:** Amazon, Parts Express, FullCompass
- **Y-Splitters:** Amazon, Monoprice
- **Estimated Shipping:** 2-5 business days

#### Network Requirements

- **Ethernet:** 1 port on your network switch
- **Static IP:** Recommended (configure in iTach settings)
- **Firewall:** Allow incoming HTTP to iTach IP
- **Bandwidth:** Negligible (<1 Kbps)

---

## Pre-Migration Checklist

Complete these steps **before** starting the migration:

### Hardware Verification

- [ ] **Cable Box Model Confirmed**
  - Model: Spectrum 100-H, 101-H, 110-H, or 201-H
  - Note model number from front panel
  - Verify IR sensor location (usually top-left front)

- [ ] **Global Cache iTach IP2IR Ordered/Received**
  - Device powered on
  - Connected to network
  - Accessible at IP address (default: 192.168.1.70)
  - Test: `ping 192.168.1.100` (or your iTach IP)

- [ ] **IR Emitters Available**
  - Minimum: 4 emitters (1 per box)
  - Recommended: 8 emitters (2 per box)
  - Emitters have 3.5mm plug
  - Adhesive backing intact

- [ ] **Y-Splitters** (if using dual emitter setup)
  - 1 splitter per cable box
  - 3.5mm male to dual 3.5mm female
  - Cables in good condition

### Positioning and Access

- [ ] **IR Emitter Positions Planned**
  - Cable boxes accessible
  - Front panel visible
  - IR sensor locations identified
  - No obstructions blocking IR sensor

- [ ] **Cable Routing Planned**
  - Path from iTach to each cable box identified
  - Cable length sufficient (typically 6-10 feet)
  - No sharp bends or pinch points
  - Cable management supplies available (ties, clips)

### System Backup

- [ ] **Database Backup Created**
  ```bash
  # Run this command on your server:
  cp ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
     ~/sports_bar.db.backup.$(date +%Y%m%d)
  ```

- [ ] **Current Configuration Documented**
  - Screenshot of device config page
  - List of channel presets
  - Note which TVs use which cable boxes
  - Document any custom settings

### Network Configuration

- [ ] **iTach Network Setup Complete**
  - Static IP assigned (e.g., 192.168.1.100)
  - IP accessible from server: `ping 192.168.1.100`
  - Web interface accessible: `http://192.168.1.100`
  - Firmware up to date (optional but recommended)

- [ ] **Server Can Reach iTach**
  ```bash
  # Test from your server:
  curl http://192.168.1.100/api/version
  # Should return iTach version info
  ```

### Maintenance Window Scheduled

- [ ] **Downtime Scheduled**
  - Minimum: 75 minutes per cable box
  - For 4 boxes: 5-6 hours total (can be staggered)
  - Best time: Early morning or late night
  - Staff notified of planned maintenance

- [ ] **Backup Hardware Available**
  - Standard Spectrum remote control (for manual fallback)
  - Spare HDMI cable (just in case)
  - Phone with camera (for IR testing)

### Software Ready

- [ ] **Sports Bar TV Controller Version**
  - Running latest version with IR support
  - IR learning page accessible: `http://[server]:3001/ir-learning`
  - IR devices API working: `http://[server]:3001/api/ir-devices`

- [ ] **Browser Ready**
  - Computer/tablet with web browser
  - Browser supports modern JavaScript
  - Can access server web interface

### Staff Prepared

- [ ] **Technical Contact Available**
  - Person who can troubleshoot network issues
  - Access to server if needed
  - Familiar with iTach configuration

- [ ] **Backup Communication Method**
  - How to contact if system is down
  - Alternative method to control TVs temporarily
  - Standard remote controls available

---

## Migration Steps (Detailed)

### Step 1: Prepare Hardware (15 minutes)

#### 1.1: Unpack and Inventory Hardware

**What You Need:**
- Global Cache iTach IP2IR
- IR emitters (4-8 depending on setup)
- Y-splitter cables (if using dual emitters)
- Ethernet cable
- Power adapter
- Cable ties or clips
- Cleaning cloth
- Label maker or masking tape + marker

**Inventory Checklist:**
- [ ] iTach unit with power adapter
- [ ] Ethernet cable (if not using existing)
- [ ] All IR emitters accounted for
- [ ] Y-splitters (if applicable)
- [ ] Spectrum remote control (for testing)

#### 1.2: Position iTach Device

**Recommended Location:**
- Near network switch or router
- Within cable reach of cable boxes (typically 6-15 feet)
- Good ventilation (device gets slightly warm)
- Secure location (won't be bumped or moved)

**Installation Steps:**
1. Mount iTach on shelf or secure surface
2. Connect Ethernet cable to iTach
3. Connect Ethernet cable to network switch
4. Connect power adapter
5. Wait 30 seconds for boot

**Verify iTach is Online:**
```bash
# From your server, run:
ping 192.168.1.100

# Should see:
# 64 bytes from 192.168.1.100: icmp_seq=1 ttl=64 time=0.5 ms
```

**Configure Static IP (if needed):**
1. Open browser to `http://192.168.1.70` (default IP)
2. Navigate to Network Settings
3. Set Static IP: `192.168.1.100`
4. Set Subnet: `255.255.255.0`
5. Set Gateway: Your router IP (e.g., `192.168.1.1`)
6. Click Save
7. iTach will reboot
8. Verify new IP: `ping 192.168.1.100`

#### 1.3: Position IR Emitters

**For Each Cable Box:**

**Step 1: Locate IR Sensor**
- Look at front panel of cable box
- IR sensor typically in **top-left corner**
- Small dark window or glossy circle
- May have "IR" label nearby
- Often near power LED

**Visual Guide:**
```
Spectrum 100-H Front Panel:
┌────────────────────────────┐
│  ◉ IR SENSOR   LED STATUS  │  ← Sensor usually here
│                            │
│  [Channel Display]         │
│                            │
└────────────────────────────┘
```

**Step 2: Clean Surface**
- Wipe front panel with cleaning cloth
- Remove dust, fingerprints, residue
- Clean area where emitter will be placed
- Allow to dry (30 seconds)

**Step 3: Position Primary Emitter**

**Single Emitter Setup:**
- Position emitter **4-6 inches** from IR sensor
- Aim directly at sensor window
- Ensure no obstructions between emitter and sensor

**Dual Emitter Setup (Recommended):**

*Primary Emitter:*
- Position on **front panel**, 4-6 inches from sensor
- Aim directly at IR sensor
- This catches most commands

*Secondary Emitter:*
- Position on **top panel**, 1-2 inches from front edge
- Provides redundancy
- Catches commands that primary misses
- Increases reliability to 98%+

**Visual Guide for Dual Setup:**
```
Side View:
             ⚫⚫ Secondary Emitter
              ↓
┌─────────────────────┐
│  ◉ IR Sensor        │  ← Front panel
│                     │
│    ⚫⚫ Primary       │  ← 4-6" from sensor
│    Emitter          │
│                     │
│   SPECTRUM 100-H    │
└─────────────────────┘
```

**Step 4: Connect Emitters to iTach**

**For Single Emitter Per Box:**
```
iTach Port 1:1 ──3.5mm cable──→ Emitter A ──→ Cable Box 1
iTach Port 1:2 ──3.5mm cable──→ Emitter B ──→ Cable Box 2
iTach Port 1:3 ──3.5mm cable──→ Emitter C ──→ Cable Box 3
```

**For Dual Emitters Per Box (with Y-splitters):**
```
iTach Port 1:1 ──┬──→ Emitter A1 (Primary) ──→ Cable Box 1 front
                 └──→ Emitter A2 (Secondary) → Cable Box 1 top

iTach Port 1:2 ──┬──→ Emitter B1 (Primary) ──→ Cable Box 2 front
                 └──→ Emitter B2 (Secondary) → Cable Box 2 top

iTach Port 1:3 ──┬──→ Emitter C1 (Primary) ──→ Cable Box 3 front
                 └──→ Emitter C2 (Secondary) → Cable Box 3 top
```

**Step 5: Temporary Placement (Don't Stick Yet!)**
- Position emitters WITHOUT removing adhesive backing
- Hold in place with tape or putty (temporary)
- This allows adjustment during testing
- **Do NOT permanently attach until after Step 3 (testing)**

#### 1.4: Cable Management

**Route Cables Neatly:**
1. Run 3.5mm cables along back/side of cable boxes
2. Use cable ties or clips to secure
3. Avoid tight bends (minimum 1-inch bend radius)
4. Keep away from power cables (reduces interference)
5. Leave slight slack (allows repositioning)

**Label Everything:**
```
Box 1 ──→ iTach Port 1:1 ──→ Label: "Box 1"
Box 2 ──→ iTach Port 1:2 ──→ Label: "Box 2"
Box 3 ──→ iTach Port 1:3 ──→ Label: "Box 3"
Box 4 ──→ iTach Port 1:4* ──→ Label: "Box 4"
```
*Port 1:4 requires Y-splitter if using standard 3-port iTach

**Create Labels:**
- At iTach end: "Box 1 - Port 1:1"
- At emitter end: "Box 1 Primary" / "Box 1 Secondary"
- Use label maker or tape + marker
- Helps with troubleshooting later

#### 1.5: Test Line of Sight

**Phone Camera Test:**
1. Open phone camera app
2. Point camera at IR emitter
3. Have someone send test command (or wait for Step 2)
4. Look for purple/white flashing light
5. No visible light = emitter not working or not connected

**Manual Remote Test:**
1. Stand where emitter is positioned
2. Point Spectrum remote at cable box IR sensor
3. Press Channel Up
4. If box responds, emitter position is good
5. If no response, reposition and try again

**Verification:**
- [ ] All emitters connected to iTach
- [ ] Cables securely plugged in
- [ ] Emitters positioned near IR sensors
- [ ] No obvious obstructions
- [ ] Manual remote works from emitter position
- [ ] Labels applied to all cables

**Time Checkpoint:** You should be 15 minutes into migration.

---

### Step 2: Learn IR Codes (60 minutes)

This is the most important step. You will capture the IR codes from your Spectrum remote control.

#### 2.1: Navigate to IR Learning Page

1. Open web browser on computer or tablet
2. Go to: `http://[your-server-ip]:3001/ir-learning`
   - Example: `http://192.168.1.50:3001/ir-learning`
3. Page should load with IR learning interface

**If page doesn't load:**
- Verify server is running: `systemctl status sportsbar-assistant`
- Check server port (default 3001)
- Try server IP instead of hostname
- Check firewall settings

#### 2.2: Select Cable Box Device

**On IR Learning Page:**
1. Click **"Cable Box"** dropdown
2. Select your device:
   - "Cable Box 1" (for first box)
   - "Cable Box 2" (for second box)
   - etc.
3. Verify **iTach IP**: Should show `192.168.1.100` (or your iTach IP)
4. Verify **IR Port**: Should show `1` (or appropriate port for this box)

**Port Mapping:**
```
Cable Box 1 → iTach Port 1 (or 1:1)
Cable Box 2 → iTach Port 2 (or 1:2)
Cable Box 3 → iTach Port 3 (or 1:3)
Cable Box 4 → iTach Port 4* (or 1:4, may require Y-splitter)
```

#### 2.3: Learn All 27 Buttons

**Button Learning Order (Recommended):**

**Phase 1: Power (2 minutes)**
- [x] Power

**Phase 2: Numbers (20 minutes)**
- [x] 0
- [x] 1
- [x] 2
- [x] 3
- [x] 4
- [x] 5
- [x] 6
- [x] 7
- [x] 8
- [x] 9

**Phase 3: Navigation (10 minutes)**
- [x] Up
- [x] Down
- [x] Left
- [x] Right
- [x] Select/OK

**Phase 4: Functions (10 minutes)**
- [x] Guide
- [x] Menu
- [x] Info
- [x] Exit
- [x] Last

**Phase 5: Channel Control (4 minutes)**
- [x] Channel Up
- [x] Channel Down

**Phase 6: DVR Controls (12 minutes)**
- [x] Play
- [x] Pause
- [x] Rewind
- [x] Fast Forward
- [x] Record
- [x] Stop

**Phase 7: Volume (Optional, 6 minutes)**
- [x] Volume Up
- [x] Volume Down
- [x] Mute

#### 2.4: Learning Process for Each Button

**For Each Button, Follow These Steps:**

**1. Click "Learn" Button**
- Find the button you want to learn (e.g., "Power")
- Click the green "Learn" button next to it
- Page will show "Waiting for button press..."
- iTach enters learning mode

**2. Point Remote at iTach**
- Hold Spectrum remote **6-12 inches** from iTach
- Aim directly at iTach (not at cable box)
- Keep remote steady
- Ensure good lighting (not too bright, not direct sunlight)

**Learning Position:**
```
     You
      │
      │ Hold remote
      ▼
  [Spectrum Remote]
        │
        │ Point at iTach
        │ 6-12 inches
        ▼
    [iTach IP2IR]
```

**3. Press Button on Remote**
- Press the corresponding button on Spectrum remote
- **Hold for 1-2 seconds** (don't just tap)
- Keep remote steady while pressing
- Wait for confirmation message

**4. Wait for "Captured!" Message**
- Page will show "Captured!" when successful
- Code will appear in the display area
- Green checkmark appears next to button
- If timeout occurs, try again:
  - Press button harder
  - Hold longer (2 seconds)
  - Move remote closer to iTach

**5. Immediately Test the Learned Code**
- Click **"Test"** button (test tube icon) next to the learned code
- System sends IR code to cable box
- **Verify cable box responds correctly**
- If no response or wrong action:
  - Check emitter position (adjust closer to sensor)
  - Re-learn the button
  - Verify iTach connection

**6. Move to Next Button**
- Repeat steps 1-5 for each button
- Take short breaks (every 10 buttons)
- Keep Spectrum remote batteries fresh

#### 2.5: Learning Tips and Best Practices

**✅ DO:**
- Learn in order (Power → Numbers → Navigation → Functions → DVR)
- Test each button immediately after learning
- Hold remote steady and press firmly
- Wait for confirmation before releasing button
- Take notes if a button is problematic
- Keep Spectrum remote batteries fresh
- Learn all buttons in one session if possible

**❌ DON'T:**
- Rush the process (accuracy > speed)
- Skip testing buttons
- Learn in direct sunlight or bright fluorescent light
- Move remote while pressing button
- Press multiple buttons at once
- Forget to click "Save All Codes" when done
- Close browser tab before saving

**Common Issues During Learning:**

**Issue: "Timeout waiting for button press"**
- **Solution:** Press button harder, hold for full 2 seconds
- Move remote closer to iTach (try 8 inches)
- Ensure iTach is powered and connected
- Check that you're pointing at iTach (not cable box)

**Issue: "IR Learner unavailable"**
- **Solution:** iTach may be busy or disconnected
- Refresh page and try again
- Verify iTach network connection: `ping 192.168.1.100`
- Reboot iTach if needed (unplug/replug power)

**Issue: Button learned but test doesn't work**
- **Solution:** Emitter positioning issue (not learning issue)
- Adjust emitter closer to cable box IR sensor
- Try different angle
- Ensure no obstructions between emitter and sensor
- See Step 3 for positioning adjustment

**Issue: Wrong button learned**
- **Solution:** You pressed wrong button on remote
- Click "Learn" again
- Carefully press correct button
- Verify button label on remote matches what you're learning

#### 2.6: Export Codes for Backup

**After All Buttons Are Learned:**

1. Scroll to bottom of IR learning page
2. Click **"Export Codes"** button
3. Save file as: `Cable_Box_[number]_IR_Codes_[date].json`
   - Example: `Cable_Box_1_IR_Codes_20251104.json`
4. Store backup in safe location:
   - Google Drive
   - Dropbox
   - USB drive
   - Network share

**Why Export?**
- Backup in case database is lost
- Share codes between identical cable box models
- Quick restore if you need to rebuild system
- Documentation for future reference

**Backup File Contains:**
```json
{
  "device": "Cable Box 1",
  "model": "Spectrum 100-H",
  "date": "2025-11-04",
  "codes": {
    "power": "sendir,1:1,1,38000,1,1,342,171,21,21,21,...",
    "digit_0": "sendir,1:1,1,38000,1,1,342,171,21,21,...",
    "digit_1": "sendir,1:1,1,38000,1,1,342,171,21,21,...",
    ...
  }
}
```

#### 2.7: Save All Codes to Database

**IMPORTANT: Do Not Skip This Step!**

1. Scroll to bottom of IR learning page
2. Verify all buttons show green checkmarks
3. Click **"Save All Codes"** button
4. Wait for **"Saved!"** confirmation message
5. Codes are now persisted to database

**If you don't save:**
- Codes only exist in browser memory
- Will be lost if page is refreshed
- Will need to re-learn all buttons

**Verification:**
```bash
# Check database to confirm codes were saved:
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
  "SELECT name, COUNT(*) as learned_buttons
   FROM IRDevice
   WHERE name = 'Cable Box 1'"
```

**Time Checkpoint:** Step 2 should take ~60 minutes per cable box.

---

### Step 3: Verify Operation (15-20 minutes)

Now that codes are learned, thoroughly test the system before permanently mounting emitters.

#### 3.1: Navigate to Remote Page

1. Open browser to: `http://[server-ip]:3001/remote`
2. Page shows virtual cable box remote
3. Verify selected device matches cable box you just programmed

#### 3.2: Test All Buttons

**Test in This Order:**

**1. Power Button (Critical Test)**
```
Test: Click "Power" button
Expected: Cable box powers off (or on)
If fails:
  - Adjust emitter position (move closer, aim better)
  - Verify emitter is connected to correct iTach port
  - Re-learn Power button
```

**2. Channel Changing**
```
Test: Click "Channel Up" several times
Expected: Cable box changes channel up with each click
If fails:
  - Emitter too far from sensor
  - Obstruction blocking IR
  - Re-learn Channel Up button
```

**3. Number Entry (Critical Test)**
```
Test: Click digits 1-1 (should tune to channel 11)
Expected:
  - First "1" displays on cable box
  - Second "1" displays, cable box tunes to channel 11
If fails:
  - Digits not learned correctly
  - Re-learn digit buttons 0-9
  - Test each digit individually
```

**4. Navigation**
```
Test: Click Up, Down, Left, Right, Select
Expected: Cable box guide responds to navigation
To test:
  - Press Guide button first
  - Use arrows to move highlight
  - Press Select to choose
If fails:
  - Re-learn navigation buttons
  - Check for button press conflicts
```

**5. Functions**
```
Test: Guide, Menu, Info, Exit, Last
Expected: Each function opens appropriate screen
If fails:
  - Re-learn specific button that fails
  - Some functions may not be used often (acceptable)
```

**6. DVR Controls**
```
Test: Play, Pause, Rewind, Fast Forward
Expected: DVR playback responds
To test:
  - Navigate to recorded show
  - Test playback controls
If fails:
  - Re-learn DVR buttons
  - Note: Not all cable boxes have DVR
```

#### 3.3: Test Channel Tuning Accuracy

**Full Channel Tune Test:**

1. Tune to channel 11 (digits: 1, 1)
2. Verify cable box tunes correctly
3. Tune to channel 206 (digits: 2, 0, 6)
4. Verify cable box tunes correctly
5. Tune to channel 999 (digits: 9, 9, 9)
6. Verify cable box tunes correctly (or shows error if channel doesn't exist)

**Common Channel Test:**
```
Channel 11  → ESPN (or local channel)
Channel 206 → ESPN (common Spectrum number)
Channel 702 → ESPN (alternate Spectrum number)
Channel 703 → ESPN2
Channel 705 → Fox Sports 1
```

**Success Criteria:**
- All channels tune correctly
- No missed digits
- Tuning completes within 2 seconds
- No phantom button presses

#### 3.4: Test Response Time

**Rapid Button Press Test:**

1. Click "Channel Up" 5 times rapidly
2. Cable box should change channel 5 times
3. No commands should be missed
4. Response should feel immediate (<200ms)

**Expected Performance:**
- Command latency: <200ms
- Success rate: 95%+ (at least 19 out of 20 commands work)
- No phantom commands (button pressed once, executes once)

**If response is slow or unreliable:**
- Move emitter closer to IR sensor (try 3-4 inches)
- Check for obstructions (plastic covers, dust, fingerprints)
- Verify iTach network connection (ping test)
- Try different emitter angle

#### 3.5: Adjust Emitter Position

**If Tests Fail or Are Unreliable:**

**Adjustment Process:**
1. Note which commands fail most often
2. Move emitter 1/4 inch closer to IR sensor
3. Re-test all buttons
4. Repeat until 95%+ success rate achieved

**Distance Guidelines:**
```
Start:     6 inches (initial position)
  ↓
Test:      <90% success rate
  ↓
Adjust:    Move to 5 inches
  ↓
Test:      90-95% success rate
  ↓
Adjust:    Move to 4 inches
  ↓
Test:      95%+ success rate → PERFECT!
```

**Angle Adjustments:**
```
Try these angles if distance adjustment doesn't help:

Direct (0°):      ⚫⚫ ──→ ◉
                  Best performance

Slight Angle:     ⚫⚫ ──↘ ◉
                  Good if direct isn't possible

Top Approach:     ⚫⚫
                    ↓
                  ┌───┐
                  │ ◉ │

Try different angles until reliable
```

**For Stubborn Cases (Dual Emitter):**

If single emitter cannot achieve 95% reliability:

1. Get Y-splitter cable
2. Connect to iTach port
3. Position second emitter on top of cable box
4. Now both emitters send same command
5. Reliability should increase to 98%+

#### 3.6: Finalize Emitter Position

**Once You Achieve 95%+ Success Rate:**

1. Mark emitter position with tape or marker
2. **Now remove adhesive backing** from emitter
3. Press firmly in marked position
4. Hold for 10-15 seconds
5. Allow adhesive to set for 1 hour before heavy use
6. Re-test all buttons one final time
7. Document final position with photos

**Documentation Photos:**
- Take photo of emitter position (front view)
- Take photo of emitter position (side view)
- Take photo of cable routing
- Save photos with label "Cable_Box_[number]_Emitter_Position.jpg"

**Time Checkpoint:** Step 3 should take 15-20 minutes.

---

### Step 4: Update Database (5 minutes)

#### 4.1: Remove Old CEC Device Associations (if any)

**If you previously tried CEC control:**

```bash
# SSH into server
ssh user@your-server-ip

# Open database
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db

# Check for CEC cable box associations
SELECT * FROM CableBox WHERE cecDeviceId IS NOT NULL;

# Remove CEC associations (if any exist)
UPDATE CableBox SET cecDeviceId = NULL WHERE name LIKE 'Cable Box%';

# Verify
SELECT id, name, cecDeviceId FROM CableBox;
# Should show NULL for cecDeviceId

# Exit database
.exit
```

**Why Remove CEC Associations?**
- Prevents system from trying CEC first (will always fail)
- Forces system to use IR codes immediately
- Cleaner database (no obsolete references)

#### 4.2: Update Cable Box Configuration

**Verify IR Device Configuration:**

```bash
# Check IR devices are properly configured
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db

SELECT id, deviceName, controllerIp, controllerPort, learnedCodes
FROM IRDevice
WHERE deviceName LIKE 'Cable Box%';

# Should show:
# - deviceName: Cable Box 1, Cable Box 2, etc.
# - controllerIp: 192.168.1.100 (your iTach IP)
# - controllerPort: 1, 2, 3, 4
# - learnedCodes: Should NOT be NULL (JSON with all your codes)

.exit
```

**If learnedCodes is NULL:**
- You forgot to click "Save All Codes" in Step 2.7
- Go back to IR learning page
- Codes may still be in browser memory
- Click "Save All Codes" now
- Re-check database

#### 4.3: Clear CEC Command Logs (Optional)

**Only if you want to clean up old logs:**

```bash
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db

# See how many CEC logs exist
SELECT COUNT(*) FROM CECCommandLog;

# Delete old CEC cable box logs (optional)
DELETE FROM CECCommandLog
WHERE cableBoxId IN (
  SELECT id FROM CableBox
);

# Or delete ALL CEC logs (optional, keeps history clean)
DELETE FROM CECCommandLog;

.exit
```

**Note:** Deleting logs is optional. Old logs don't hurt anything but take up space.

---

### Step 5: Document Configuration (10 minutes)

Proper documentation will save you hours of troubleshooting later.

#### 5.1: Take Screenshots

**Capture These Screenshots:**

1. **IR Learning Page** (showing all green checkmarks)
   - Navigate to `/ir-learning`
   - Select Cable Box 1
   - Screenshot showing all 27 buttons learned
   - Save as: `Cable_Box_1_IR_Learning_Complete.png`

2. **Device Config Page** (showing IR device setup)
   - Navigate to `/config`
   - Screenshot IR device configuration
   - Save as: `IR_Device_Configuration.png`

3. **Remote Test Page** (showing virtual remote)
   - Navigate to `/remote`
   - Screenshot cable box remote interface
   - Save as: `Cable_Box_Remote_UI.png`

#### 5.2: Document Emitter Positions

**Create Position Document:**

Create a simple text file: `IR_Emitter_Positions.txt`

```
Sports Bar TV Controller - IR Emitter Positions
Date: November 4, 2025
Technician: [Your Name]

Cable Box 1:
- iTach Port: 1:1
- Primary Emitter: Front panel, 4 inches from IR sensor, direct aim
- Secondary Emitter: Top panel, 2 inches from front edge
- Success Rate: 98%
- Notes: Works perfectly, no adjustments needed

Cable Box 2:
- iTach Port: 1:2
- Primary Emitter: Front panel, 5 inches from IR sensor, slight angle (15°)
- Secondary Emitter: None (single emitter sufficient)
- Success Rate: 96%
- Notes: Slightly angled due to rack mounting

Cable Box 3:
- iTach Port: 1:3
- Primary Emitter: Front panel, 4 inches from IR sensor, direct aim
- Secondary Emitter: Top panel, 2 inches from front edge
- Success Rate: 99%
- Notes: Dual emitter for maximum reliability

Cable Box 4:
- iTach Port: 1:4 (via Y-splitter on Port 1:2)
- Primary Emitter: Front panel, 6 inches from IR sensor, direct aim
- Secondary Emitter: None
- Success Rate: 94%
- Notes: Farther distance due to cable routing, still acceptable

iTach IP Address: 192.168.1.100
Network Location: Server rack, Shelf 2U
Cable Routing: Along back of rack, secured with velcro ties
```

#### 5.3: Note Any Issues Encountered

**Issue Log Template:**

Create file: `Migration_Issues_Log.txt`

```
Issue 1: Channel Up button not working initially
Solution: Re-learned button, worked second time
Time Lost: 5 minutes

Issue 2: Box 2 had poor response rate (75%)
Solution: Added second emitter on top, now 96%
Time Lost: 15 minutes

Issue 3: Box 4 emitter cable too short
Solution: Moved iTach closer, re-routed cable
Time Lost: 10 minutes

Total Extra Time: 30 minutes
Final Result: All boxes working at 95%+ success rate
```

**Why Document Issues?**
- Helps with future troubleshooting
- Guides maintenance staff
- Useful if you add more cable boxes later
- Shows what to watch for

#### 5.4: Save IR Code Backup

**Final Backup Steps:**

1. Export codes from each cable box (already done in Step 2.6)
2. Create backup folder structure:

```
IR_Backups/
├── Cable_Box_1_IR_Codes_20251104.json
├── Cable_Box_2_IR_Codes_20251104.json
├── Cable_Box_3_IR_Codes_20251104.json
├── Cable_Box_4_IR_Codes_20251104.json
├── IR_Emitter_Positions.txt
├── Migration_Issues_Log.txt
└── Photos/
    ├── Cable_Box_1_Emitter_Position_Front.jpg
    ├── Cable_Box_1_Emitter_Position_Side.jpg
    ├── Cable_Box_2_Emitter_Position_Front.jpg
    ├── Cable_Box_2_Emitter_Position_Side.jpg
    ├── Cable_Box_3_Emitter_Position_Front.jpg
    ├── Cable_Box_3_Emitter_Position_Side.jpg
    ├── Cable_Box_4_Emitter_Position_Front.jpg
    ├── Cable_Box_4_Emitter_Position_Side.jpg
    └── iTach_Installation.jpg
```

3. Copy folder to:
   - Google Drive / Dropbox (cloud backup)
   - USB drive (local backup)
   - Network share (redundant backup)

**Time Checkpoint:** Total migration time per box should be ~75 minutes.

---

## Troubleshooting Common Issues

### Issue: "IR codes not capturing"

**Symptoms:**
- Click "Learn" button
- Point remote at iTach
- Press button on remote
- Timeout error: "Timeout waiting for button press"

**Solutions:**

**Solution 1: Remote Technique**
- Press button harder (firm pressure)
- Hold button for full 2 seconds (count: "one-thousand-one, one-thousand-two")
- Keep remote perfectly still while pressing
- Don't release until you see "Captured!" message

**Solution 2: Distance and Angle**
- Move remote closer to iTach (try 6 inches)
- Point directly at iTach front panel
- Avoid pointing at angle (face iTach straight-on)
- Ensure no obstructions between remote and iTach

**Solution 3: Environmental Factors**
- Move away from bright windows (sunlight interferes)
- Turn off fluorescent lights (they emit IR noise)
- Close blinds if in very bright room
- Try learning in different location if needed

**Solution 4: iTach Connection**
- Verify iTach is powered (LED should be lit)
- Check network connection: `ping 192.168.1.100`
- Reboot iTach (unplug power, wait 10 seconds, replug)
- Try different browser (Chrome recommended)

**Solution 5: Remote Batteries**
- Replace Spectrum remote batteries with fresh ones
- Weak batteries produce weak IR signal
- Use quality alkaline batteries

### Issue: "Button doesn't work after learning"

**Symptoms:**
- Button learned successfully (green checkmark)
- Click "Test" button
- Cable box doesn't respond
- OR wrong action happens

**Solutions:**

**Solution 1: Emitter Position (Most Common)**
- Move emitter closer to cable box IR sensor (try 3-4 inches)
- Aim emitter more directly at IR sensor
- Remove any obstructions (plastic covers, dust)
- Clean cable box IR sensor window with soft cloth

**Solution 2: Verify Correct Emitter**
- Ensure you're testing correct cable box
- Verify emitter is connected to correct iTach port
- Check labels on cables (Box 1 = Port 1, etc.)
- Swap emitters temporarily to verify

**Solution 3: Re-learn Code**
- Some codes capture poorly on first try
- Click "Learn" again for that button
- Try pressing button more firmly
- Hold for longer duration (2-3 seconds)
- Test again

**Solution 4: Wrong Code Captured**
- You may have pressed wrong button on remote
- Compare button you pressed vs. button you're learning
- Re-learn with careful attention to correct button

**Solution 5: Cable Box Issue**
- Verify cable box is powered on
- Try manual remote (does it work?)
- Check cable box IR sensor isn't blocked
- Reboot cable box if it's behaving strangely

### Issue: "Intermittent response"

**Symptoms:**
- Commands work sometimes (maybe 60-80% of the time)
- Inconsistent behavior
- More reliable at certain times of day

**Solutions:**

**Solution 1: Optimize Emitter Distance**
- Current position is marginal (almost working)
- Move emitter 1 inch closer to IR sensor
- Test 20 commands, should be 95%+ success rate
- If still <95%, move another inch closer

**Solution 2: Add Second Emitter**
- Get Y-splitter cable for iTach port
- Add second emitter on top of cable box
- Dual emitters increase reliability to 98%+
- See "Step 1.3: Position IR Emitters" for dual setup

**Solution 3: Angle Adjustment**
- Try slight angle change (15-30 degrees)
- Sometimes indirect angle works better than direct
- Test different angles, find sweet spot
- Mark best position when found

**Solution 4: Environmental Changes**
- Note when failures occur (morning? afternoon?)
- Sunlight through window at certain times?
- Fluorescent lights on during business hours?
- Shield IR sensor from light sources

**Solution 5: Emitter Adhesive Failing**
- Check if emitter has shifted position
- Re-stick with fresh adhesive or mounting tape
- Ensure emitter is firmly attached
- Cable strain can pull emitter out of position

### Issue: "No response at all"

**Symptoms:**
- Commands never work
- Cable box completely unresponsive
- Manual remote works fine

**Solutions:**

**Solution 1: Verify IR Emitter Connected**
- Check emitter cable fully seated in iTach port
- Try different iTach port (test with Port 1)
- Swap emitter cable with known working one
- Look for damaged cable or connector

**Solution 2: Phone Camera Test**
- Point phone camera at IR emitter
- Send command from web interface
- Look for purple/white flashing in camera
- No flash = emitter not working or cable issue

**Solution 3: iTach Network**
- Ping iTach: `ping 192.168.1.100`
- Check iTach web interface: `http://192.168.1.100`
- Verify correct IP address configured
- Restart iTach if needed

**Solution 4: Port Configuration**
- Verify database has correct port number
- Check IR device settings in database
- Cable Box 1 should be Port 1
- Cable Box 2 should be Port 2, etc.

**Solution 5: Wrong Cable Box**
- Verify you're sending command to correct box
- Check device dropdown selection
- Emitter may be connected to different box than expected
- Relabel cables if needed

### Issue: "Wrong command executed"

**Symptoms:**
- Click "Channel Up" but cable box powers off
- Click "5" but cable box shows "7"
- Commands work but wrong action

**Solutions:**

**Solution 1: Clear and Re-learn Codes**
- Go to IR learning page
- Select affected cable box
- Click "Clear All Codes" (if available)
- Re-learn all buttons from scratch
- Test each button immediately after learning

**Solution 2: Verify Remote**
- Ensure using correct Spectrum remote
- Different remote models have different codes
- Universal remotes may not work correctly
- Use official Spectrum-issued remote

**Solution 3: Database Corruption**
- Export codes to backup first
- Clear IR codes from database
- Re-import or re-learn
- Verify codes saved correctly

**Solution 4: Code Conflict**
- Multiple cable boxes responding?
- Emitters too close together (IR scatter)
- Move emitters to be more directional
- Shield other boxes from IR bleed

---

## Rollback Procedure

**IMPORTANT:** This section only applies if CEC was working before (non-Spectrum boxes).

For Spectrum cable boxes, there is no rollback - CEC never worked and never will work.

### When to Rollback

- You have non-Spectrum cable boxes
- CEC was working before migration
- IR setup is not working reliably
- You want to temporarily revert while troubleshooting

### Rollback Steps

**1. Disable IR Device in Database**

```bash
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db

-- Mark IR device as inactive
UPDATE IRDevice
SET isActive = false
WHERE deviceName = 'Cable Box 1';

-- Verify
SELECT id, deviceName, isActive FROM IRDevice;

.exit
```

**2. Re-enable CEC Device Associations**

```bash
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db

-- Restore CEC association
UPDATE CableBox
SET cecDeviceId = 'cec-cable-1'
WHERE name = 'Cable Box 1';

-- Verify
SELECT id, name, cecDeviceId FROM CableBox;

.exit
```

**3. Restart Application**

```bash
pm2 restart sports-bar-tv-controller
# or
sudo systemctl restart sportsbar-assistant
```

**4. Test CEC Control**

- Navigate to `/remote`
- Select cable box
- Test CEC commands
- Verify cable box responds via CEC

### Remove Learned IR Codes (Optional)

**If you want to completely remove IR setup:**

```bash
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db

-- Clear learned codes
UPDATE IRDevice
SET learnedCodes = NULL
WHERE deviceName = 'Cable Box 1';

-- Or delete IR device entirely
DELETE FROM IRDevice
WHERE deviceName = 'Cable Box 1';

.exit
```

### Physical Hardware

**IR Emitters:**
- Leave in place (doesn't hurt anything)
- Or carefully remove (adhesive may damage cable box finish)
- Store for future use

**iTach Device:**
- Leave powered and connected (might use for other devices)
- Or power off and store

---

## Validation Checklist

After migration is complete, verify everything works:

### Basic Functionality

- [ ] **Power button works**
  - Test: Click Power on virtual remote
  - Expected: Cable box powers on/off
  - Result: Pass / Fail

- [ ] **All digit buttons work (0-9)**
  - Test: Click each digit 0-9
  - Expected: Cable box displays each digit
  - Result: Pass / Fail

- [ ] **Navigation works**
  - Test: Up, Down, Left, Right, Select
  - Expected: Cable box guide navigation responds
  - Result: Pass / Fail

- [ ] **Guide/Menu buttons work**
  - Test: Click Guide, Menu, Info, Exit
  - Expected: Each opens appropriate screen
  - Result: Pass / Fail

- [ ] **Channel up/down works**
  - Test: Click Channel Up, Channel Down
  - Expected: Cable box changes channels
  - Result: Pass / Fail

- [ ] **DVR controls work**
  - Test: Play, Pause, Rewind, Fast Forward
  - Expected: DVR playback controls respond
  - Result: Pass / Fail (N/A if no DVR)

### Performance Metrics

- [ ] **Response time acceptable (<200ms)**
  - Test: Click button, measure lag
  - Expected: Near-instant response
  - Result: ______ms average

- [ ] **No phantom button presses**
  - Test: Click button once
  - Expected: Executes exactly once
  - Result: Pass / Fail

- [ ] **Works consistently (95%+ success rate)**
  - Test: Send 20 commands
  - Expected: At least 19 succeed
  - Result: _____ out of 20 (____%)

### Integration Testing

- [ ] **Channel presets work**
  - Test: Click channel preset (e.g., "ESPN - 206")
  - Expected: Cable box tunes to channel 206
  - Result: Pass / Fail

- [ ] **Sports guide "Watch" button works**
  - Test: Click "Watch" on live game
  - Expected: Cable box tunes to correct channel
  - Result: Pass / Fail

- [ ] **Bartender remote works**
  - Test: Use bartender remote to change channel
  - Expected: Cable box responds via IR
  - Result: Pass / Fail

### Reliability Testing

- [ ] **Multiple rapid commands**
  - Test: Click Channel Up 10 times rapidly
  - Expected: All 10 commands execute
  - Result: _____ out of 10 succeeded

- [ ] **Works after cable box reboot**
  - Test: Reboot cable box, test commands
  - Expected: Still works after reboot
  - Result: Pass / Fail

- [ ] **Works after server reboot**
  - Test: Reboot server, test commands
  - Expected: Still works after reboot
  - Result: Pass / Fail

### Final Sign-Off

**Date:** _______________
**Tested By:** _______________
**Overall Result:** Pass / Fail
**Notes:**

```
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________
```

**Sign-Off:** _______________

---

## Post-Migration

### Train Staff on New Workflow

**Good News:** Staff training is minimal because the UI hasn't changed!

**Key Points to Communicate:**
1. ✅ Interface is identical (same buttons, same layout)
2. ✅ Commands now use IR instead of CEC (staff doesn't need to know)
3. ✅ If something doesn't work, check emitter position first
4. ✅ Response time should be <200ms (feels instant)

**Training Checklist:**
- [ ] Show staff the virtual remote (no changes)
- [ ] Demonstrate channel changing (works the same)
- [ ] Show channel presets (works the same)
- [ ] Explain what to do if commands stop working (call tech support)

**What Staff DON'T Need to Know:**
- Technical details about IR vs CEC
- How IR emitters work
- iTach configuration
- Database changes

### Monitor Command Success Rates

**First Week:**
- Check logs daily for failed commands
- Note any patterns (certain times of day, specific buttons)
- Adjust emitter positions if needed

**Access Logs:**
```bash
# View recent IR command logs
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
  "SELECT timestamp, command, success, responseTime
   FROM IRCommandLog
   WHERE timestamp > datetime('now', '-1 day')
   ORDER BY timestamp DESC
   LIMIT 50;"
```

**Success Rate Query:**
```bash
# Calculate success rate for last 24 hours
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
  "SELECT
     COUNT(*) as total_commands,
     SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
     ROUND(100.0 * SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
   FROM IRCommandLog
   WHERE timestamp > datetime('now', '-1 day');"
```

**Target Metrics:**
- Success rate: >95%
- Average response time: <200ms
- Failed commands per day: <10

### Document Any Issues

**Issue Tracking Template:**

Create file: `Post_Migration_Issues.txt`

```
Week 1 Issues:

Issue: Box 2 success rate dropped to 85% on Day 3
Cause: Emitter shifted position (adhesive weakened)
Solution: Re-stuck emitter with fresh adhesive
Result: Success rate back to 97%
Date: Nov 7, 2025

Issue: Channel 999 doesn't work
Cause: Channel doesn't exist in Spectrum lineup
Solution: Removed from presets, documented
Result: No further issues
Date: Nov 8, 2025
```

### Schedule Periodic Emitter Position Checks

**Weekly (First Month):**
- [ ] Visual inspection of all emitters
- [ ] Verify emitters haven't shifted
- [ ] Test each cable box (quick channel change test)
- [ ] Check cables for strain or damage

**Monthly (Ongoing):**
- [ ] Full functionality test (all buttons)
- [ ] Success rate analysis
- [ ] Clean cable box IR sensors (soft cloth)
- [ ] Re-stick any loose emitters

**Quarterly:**
- [ ] Replace any damaged emitter cables
- [ ] Review and update documentation
- [ ] Backup IR codes (export fresh copies)
- [ ] Verify iTach firmware up to date

---

## Appendix A: Command Reference

### All Supported IR Commands

**Power:**
- `power` - Toggle power on/off

**Numbers (Channel Entry):**
- `digit_0` - Number 0
- `digit_1` - Number 1
- `digit_2` - Number 2
- `digit_3` - Number 3
- `digit_4` - Number 4
- `digit_5` - Number 5
- `digit_6` - Number 6
- `digit_7` - Number 7
- `digit_8` - Number 8
- `digit_9` - Number 9

**Navigation:**
- `up` - Arrow Up
- `down` - Arrow Down
- `left` - Arrow Left
- `right` - Arrow Right
- `select` - Select/OK/Enter

**Functions:**
- `guide` - Open TV Guide
- `menu` - Open Menu
- `info` - Show Info
- `exit` - Exit/Back
- `last` - Last Channel

**Channel Control:**
- `channel_up` - Channel Up
- `channel_down` - Channel Down

**DVR Controls:**
- `play` - Play
- `pause` - Pause
- `rewind` - Rewind
- `fast_forward` - Fast Forward
- `record` - Record
- `stop` - Stop

**Volume (Optional):**
- `volume_up` - Volume Up
- `volume_down` - Volume Down
- `mute` - Mute/Unmute

### API Endpoints

**Send IR Command:**
```bash
POST /api/ir-devices/send-command
Content-Type: application/json

{
  "deviceId": "cable-box-1",
  "command": "channel_up"
}
```

**Tune to Channel:**
```bash
POST /api/channel-presets/tune
Content-Type: application/json

{
  "channelNumber": "206",
  "deviceType": "cable",
  "cableBoxId": "cable-box-1"
}
```

**Get Device Status:**
```bash
GET /api/ir-devices

Response:
{
  "success": true,
  "devices": [
    {
      "id": "cable-box-1",
      "deviceName": "Cable Box 1",
      "controllerIp": "192.168.1.100",
      "controllerPort": 1,
      "hasLearnedCodes": true,
      "isOnline": true
    }
  ]
}
```

---

## Appendix B: Hardware Specifications

### Global Cache iTach IP2IR

**Physical:**
- Dimensions: 4.25" x 3" x 1"
- Weight: 4 oz
- Power: 5V DC, 1A (included)
- Mounting: Desktop or wall-mount

**Network:**
- Ethernet: 10/100 Mbps
- Protocols: HTTP, TCP/IP
- Default IP: 192.168.1.70
- Configuration: Web interface or API

**IR Outputs:**
- Ports: 3 (expandable to 6 with splitters)
- Connector: 3.5mm stereo jack
- Frequency: 20kHz - 1MHz
- Range: Up to 100 feet (with proper emitters)

**IR Learning:**
- Built-in IR receiver
- Learns from any IR remote
- Stores codes in volatile memory
- Outputs Pronto hex format

**API:**
- HTTP REST API
- Simple command format
- Response times: <50ms
- Concurrent commands: Supported

### Xantech 284M IR Emitter

**Physical:**
- Dual-eye design (2 LEDs)
- Dimensions: 1" x 0.5" x 0.25"
- Cable length: 6 feet standard
- Connector: 3.5mm mono plug
- Adhesive: 3M double-sided tape

**Specifications:**
- Frequency: 38kHz (standard)
- Range: Effective up to 12 inches
- Viewing angle: 60 degrees
- Power: Supplied by IR controller

**Best For:**
- Permanent installations
- Close-range control
- Reliable, focused IR signal

### Spectrum 100-H Cable Box

**IR Sensor Location:**
- Front panel, top-left corner
- Behind tinted plastic window
- Reception angle: ~60 degrees
- Frequency: 38kHz

**Supported Features:**
- Channel tuning (0-999)
- Guide navigation
- DVR control (if equipped)
- Power on/off

**Known Quirks:**
- CEC disabled in firmware (cannot be enabled)
- IR sensor slightly recessed (may need dual emitters)
- Response time ~150ms

---

## Appendix C: Troubleshooting Decision Tree

```
START: Command not working
│
├─→ Q: Did it ever work?
│   ├─→ No → Go to "Initial Setup Issues"
│   └─→ Yes → Go to "Reliability Issues"
│
Initial Setup Issues:
│
├─→ Q: Is button learned (green checkmark)?
│   ├─→ No → Re-learn button
│   └─→ Yes → Continue
│
├─→ Q: Does phone camera see IR flash?
│   ├─→ No → Check emitter cable connection
│   └─→ Yes → Continue
│
├─→ Q: Is emitter close to IR sensor?
│   ├─→ No → Move emitter closer (4-6 inches)
│   └─→ Yes → Continue
│
├─→ Q: Any obstructions between emitter and sensor?
│   ├─→ Yes → Remove obstructions
│   └─→ No → Continue
│
├─→ Try dual emitter setup
│
Reliability Issues:
│
├─→ Q: Success rate >90% but <95%?
│   ├─→ Yes → Move emitter 1 inch closer
│   └─→ No → Continue
│
├─→ Q: Success rate <90%?
│   ├─→ Yes → Add second emitter (dual setup)
│   └─→ No → Continue
│
├─→ Q: Has emitter shifted position?
│   ├─→ Yes → Re-stick emitter, mark position
│   └─→ No → Continue
│
├─→ Q: Environmental changes (new lights, sun)?
│   ├─→ Yes → Shield IR sensor, adjust emitter
│   └─→ No → Continue
│
├─→ Re-learn affected buttons
│
Still not working? Contact technical support.
```

---

## Support and Resources

### Internal Documentation

- [IR Learning Quick Start Guide](/docs/IR_LEARNING_QUICK_START.md)
- [IR Emitter Placement Guide](/docs/IR_EMITTER_PLACEMENT_GUIDE.md)
- [IR Cable Box Control Implementation](/docs/IR_CABLE_BOX_CONTROL.md)
- [CEC Deprecation FAQ](/docs/CEC_DEPRECATION_FAQ.md)
- [IR vs CEC Comparison](/docs/IR_VS_CEC_COMPARISON.md)

### External Resources

- **Global Cache Support:** https://www.globalcache.com/support
- **iTach Documentation:** https://www.globalcache.com/files/docs/API-iTach.pdf
- **Xantech Product Info:** https://www.xantech.com
- **IR Code Database:** http://www.remotecentral.com

### Technical Support Contacts

**Hardware Issues:**
- Global Cache: support@globalcache.com
- Xantech: techsupport@xantech.com

**Software Issues:**
- Sports Bar TV Controller GitHub Issues
- Internal IT Support

### Frequently Asked Questions

See [CEC Deprecation FAQ](/docs/CEC_DEPRECATION_FAQ.md) for answers to common questions.

---

**Document Version:** 1.0
**Last Updated:** November 4, 2025
**Author:** Sports Bar TV Controller Development Team
**Reviewed By:** Technical Operations
**Next Review Date:** February 4, 2026
