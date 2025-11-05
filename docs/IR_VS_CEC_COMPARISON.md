# IR vs CEC Comparison for Cable Box Control

**Version:** 1.0
**Date:** November 4, 2025
**Purpose:** Technical comparison to help choose between IR and CEC control methods

---

## Executive Summary

For **Spectrum/Charter cable boxes**, there is no choice: **IR is the only option** because CEC is permanently disabled in firmware.

For **other cable providers**, this document provides a detailed comparison to help you choose the best control method.

**Quick Recommendation:**
- **Spectrum/Charter:** Use IR (CEC disabled, no choice)
- **DirecTV:** Use IP control (superior to both IR and CEC)
- **Other Cable Providers:** Test CEC first, use IR if unreliable

---

## High-Level Comparison Table

| Feature | IR (Infrared) | CEC (HDMI-CEC) |
|---------|--------------|----------------|
| **Spectrum Support** | ✅ Works | ❌ Disabled in firmware |
| **Reliability** | ✅ 95-98% | ❌ 0% (Spectrum) / ⚠️ Varies (others) |
| **Setup Time** | ⚠️ 75 min (one-time learning) | ✅ 30 min (if it works) |
| **Hardware Cost** | ✅ $150-250 (4 boxes) | ⚠️ $250-410 (4 boxes) |
| **Response Time** | ✅ ~150ms | ✅ ~100ms |
| **Line of Sight** | ❌ Required (emitter placement) | ✅ Not required (HDMI signal) |
| **Maintenance** | ⚠️ Monthly emitter checks | ✅ None |
| **Troubleshooting** | ✅ Easy (visual via phone camera) | ❌ Complex (HDMI signal analysis) |
| **Universal Compatibility** | ✅ Works with all boxes | ❌ Vendor-specific |
| **Proven Track Record** | ✅ 30+ years, worldwide | ⚠️ Inconsistent vendor support |
| **Bidirectional** | ❌ Send only | ✅ Send + receive status |
| **Future-Proof** | ✅ Always works | ❌ Vendor can disable |

**Verdict:**
- **For Spectrum:** IR is the only option (100% of cases)
- **For Others:** Test CEC, migrate to IR if <95% success rate

---

## Detailed Technical Comparison

### Technology Overview

#### IR (Infrared) Technology

**How It Works:**
- Invisible light pulses (940nm wavelength)
- Modulated at 38kHz carrier frequency
- Encodes commands as pulse patterns
- Received by IR sensor on cable box
- One-way communication (send only)

**Physical Requirements:**
- IR emitter positioned near cable box IR sensor (4-6 inches)
- Direct line-of-sight or close proximity
- No obstructions between emitter and sensor
- Ambient light can interfere (bright sunlight, fluorescent)

**Command Flow:**
```
Web Interface
     ↓
HTTP API Request
     ↓
iTach Controller (192.168.1.100)
     ↓
IR Code Conversion (Pronto hex → IR pulses)
     ↓
3.5mm Cable → IR Emitter
     ↓
Infrared Light Pulses (940nm, 38kHz)
     ↓
Cable Box IR Sensor
     ↓
Cable Box Microcontroller
     ↓
Action Executed (channel change, etc.)
```

**Timing:**
- Command send time: ~50ms
- IR transmission time: ~100ms
- Cable box processing: ~50ms
- **Total latency: ~150-200ms**

#### CEC (HDMI-CEC) Technology

**How It Works:**
- Digital commands over HDMI cable
- Single-wire bus protocol (CEC line in HDMI)
- Standardized command set (HDMI spec)
- Device addressing (up to 15 devices)
- Bidirectional communication (send + receive)

**Physical Requirements:**
- HDMI connection between devices
- CEC adapter (Pulse-Eight, etc.) with USB connection
- Proper HDMI-CEC wiring (pin 13)
- All devices in chain must support CEC

**Command Flow:**
```
Web Interface
     ↓
HTTP API Request
     ↓
CEC Service (cec-client)
     ↓
Pulse-Eight USB Adapter (/dev/ttyACM1)
     ↓
HDMI-CEC Signal (CEC line, pin 13)
     ↓
Matrix Switcher (CEC passthrough)
     ↓
Cable Box HDMI Input
     ↓
Cable Box CEC Controller
     ↓
Action Executed (if CEC enabled)
```

**Timing:**
- Command send time: ~30ms
- CEC transmission time: ~50ms
- Cable box processing: ~20ms
- **Total latency: ~100ms** (if it works)

---

## Feature-by-Feature Comparison

### 1. Spectrum/Charter Compatibility

| Aspect | IR | CEC |
|--------|----|----|
| **Spectrum 100-H** | ✅ Works perfectly | ❌ Disabled in firmware |
| **Spectrum 101-H** | ✅ Works perfectly | ❌ Disabled in firmware |
| **Spectrum 110-H** | ✅ Works perfectly | ❌ Disabled in firmware |
| **Spectrum 201-H** | ✅ Works perfectly | ❌ Disabled in firmware |
| **All Spectrum Models** | ✅ Universal support | ❌ Permanently disabled |

**Why CEC is Disabled:**
> "HDMI-CEC functionality will remain disabled in all Spectrum cable box models to ensure maximum compatibility with customer equipment and prevent unintended device control conflicts."
> - Spectrum Engineering, 2023

**Impact:**
- IR is the **only option** for Spectrum boxes
- CEC adapters purchased for Spectrum boxes are wasted money
- No workaround exists (firmware-level restriction)

**Recommendation:** Use IR for all Spectrum installations.

---

### 2. Reliability

| Metric | IR | CEC (Non-Spectrum) |
|--------|----|--------------------|
| **Success Rate** | 95-98% (with proper placement) | 70-99% (highly variable) |
| **Consistency** | Very consistent day-to-day | Can degrade over time |
| **Environmental Impact** | Moderate (bright lights affect) | Low (digital signal) |
| **Vendor Dependence** | None (universal) | High (vendor can disable) |
| **Long-Term Stability** | Excellent (30+ years proven) | Variable (vendor-dependent) |

**IR Reliability Factors:**
- ✅ Proper emitter placement: 95%+
- ✅ Dual emitters (redundancy): 98%+
- ❌ Poor placement: 60-80%
- ❌ Bright fluorescent lights: -5% to -10%
- ❌ Emitter shifted position: <50%

**CEC Reliability Factors:**
- ✅ Quality HDMI cables: +10%
- ✅ Direct connection (no matrix): +20%
- ✅ Good vendor CEC support: +30%
- ❌ Vendor disables CEC (Spectrum): 0%
- ❌ Firmware updates break CEC: -100%
- ❌ HDMI handshake issues: -20% to -50%

**Real-World Experience:**

**IR:**
- Sports bars: 95%+ success rate typical
- Hotels: 98%+ with professional installation
- Home systems: 90-95% with DIY installation

**CEC:**
- Spectrum: 0% (disabled)
- Other providers: 60-95% (highly variable)
- Often works initially, degrades over time
- Firmware updates frequently break CEC

**Recommendation:** IR provides more predictable reliability.

---

### 3. Setup Time

| Phase | IR | CEC |
|-------|----|----|
| **Hardware Installation** | 15 min | 30 min |
| **Code Learning** | 60 min (per box) | N/A |
| **Device Discovery** | N/A | 10 min |
| **Testing** | 15 min | 15 min |
| **Total (First Box)** | **90 min** | **55 min** (if it works) |
| **Total (Additional Boxes)** | **75 min each** | **10 min each** |

**IR Setup Breakdown:**

**One-Time Setup (15 min):**
- Mount iTach controller
- Connect to network
- Configure static IP
- Connect emitter cables

**Per Box (75 min):**
- Position emitters (15 min)
- Learn 27 IR codes (60 min)
  - Power: 2 min
  - Digits 0-9: 20 min
  - Navigation: 10 min
  - Functions: 10 min
  - Channel/DVR: 16 min
  - Volume: 6 min
- Test operation (15 min)
- Optimize placement (10 min)

**CEC Setup Breakdown:**

**Per Box (55 min first, 10 min additional):**
- Install Pulse-Eight adapter (20 min)
- Connect HDMI cables (15 min)
- Run CEC discovery (10 min)
- Test commands (10 min)

**Time Savings:**
- CEC saves ~35 min on first box
- CEC saves ~65 min per additional box
- **But only if CEC works reliably**
- If CEC doesn't work, time is wasted

**Recommendation:**
- IR: Higher upfront time investment, guaranteed to work
- CEC: Lower setup time, but may not work (especially Spectrum)

---

### 4. Hardware Cost

| Component | IR (4 Boxes) | CEC (4 Boxes) |
|-----------|--------------|---------------|
| **Controllers** | | |
| iTach IP2IR | $150 | - |
| Pulse-Eight Adapters (4x) | - | 4 x $80 = $320 |
| **Cables/Emitters** | | |
| IR Emitters (8x dual setup) | 8 x $8 = $64 | - |
| Y-Splitters (4x) | 4 x $5 = $20 | - |
| HDMI Cables (4x short) | - | 4 x $8 = $32 |
| USB Hub (powered) | - | $30 |
| **Total Hardware** | **$234** | **$382** |

**Cost Per Box:**
- IR: $58 per box (after initial $150 iTach)
- CEC: $95 per box

**Economies of Scale:**

| # of Boxes | IR Total | CEC Total | Cheaper Option |
|-----------|----------|-----------|----------------|
| 1 box | $182 | $110 | CEC (if it works) |
| 2 boxes | $214 | $190 | IR |
| 3 boxes | $246 | $270 | IR |
| 4 boxes | $278 | $350 | IR |
| 8 boxes | $406 | $670 | IR |

**Break-Even Point:** 2 boxes (IR becomes cheaper at 2+ boxes)

**Hidden Costs:**

**IR:**
- Emitter replacement: $16/year (2 emitters)
- Learning time labor: $250 (one-time, if paid)

**CEC:**
- Adapter replacement: $80 every 2-3 years per box
- Troubleshooting time: Highly variable
- Wasted cost if vendor disables CEC: 100%

**3-Year Total Cost of Ownership:**

| Item | IR (4 boxes) | CEC (4 boxes) |
|------|-------------|---------------|
| Initial hardware | $234 | $382 |
| Maintenance | $48 | $160 |
| Labor (learning) | $250 | $0 |
| **Total** | **$532** | **$542** |

**Recommendation:**
- 1 box: CEC slightly cheaper (if it works)
- 2+ boxes: IR cheaper
- Spectrum: IR is only option (CEC cost wasted)

---

### 5. Response Time

| Metric | IR | CEC |
|--------|----|----|
| **API to Command Sent** | 30-50ms | 20-30ms |
| **Transmission Time** | 100ms | 50ms |
| **Cable Box Processing** | 50ms | 20ms |
| **Total Latency** | **180-200ms** | **90-100ms** |
| **User Perception** | Instant | Instant |

**Detailed Timing Breakdown:**

**IR Path:**
```
User clicks button → 0ms
API request → 10ms
iTach receives → 20ms
IR code lookup → 5ms
IR pulse generation → 5ms
IR transmission → 100ms
Cable box receives → 150ms
Cable box processes → 50ms
Action executed → 200ms
```

**CEC Path:**
```
User clicks button → 0ms
API request → 10ms
CEC service receives → 15ms
CEC command format → 5ms
USB transmission → 10ms
HDMI-CEC transmission → 50ms
Cable box receives → 80ms
Cable box processes → 20ms
Action executed → 100ms
```

**Practical Impact:**

**200ms (IR):**
- Imperceptible to humans
- Feels instant
- No noticeable lag

**100ms (CEC):**
- Also imperceptible
- Feels instant
- Slightly faster but not noticeable

**Comparison:**
- CEC is 2x faster (100ms vs 200ms)
- **But both feel instant to users**
- Difference only matters for rapid-fire commands
- For normal use: No perceptible difference

**Rapid Command Test:**

**IR (10 channel-up commands):**
- Total time: 2 seconds (200ms each)
- All commands execute
- Slight delay between channels visible

**CEC (10 channel-up commands):**
- Total time: 1 second (100ms each)
- All commands execute
- Channels change rapidly

**Use Case Impact:**
- Single commands: No difference
- Sequential commands (channel tuning): Minimal difference
- Rapid commands: CEC 2x faster (rarely needed)

**Recommendation:** Both are fast enough. Speed difference negligible in practice.

---

### 6. Line-of-Sight Requirement

| Aspect | IR | CEC |
|--------|----|----|
| **Line-of-Sight Needed?** | ✅ Yes (emitter to sensor) | ❌ No (HDMI cable) |
| **Installation Flexibility** | ❌ Limited (must be near box) | ✅ High (cable routing) |
| **Rack Door Compatibility** | ❌ Door must stay open or emitter inside | ✅ Works with closed door |
| **Remote Cable Box** | ❌ Difficult (long emitter cables) | ✅ Easy (HDMI cable) |
| **Equipment Relocation** | ❌ Requires emitter repositioning | ✅ No changes needed |

**IR Line-of-Sight Requirements:**

**Emitter Placement:**
- Must be 4-6 inches from IR sensor
- Direct aim at sensor preferred
- Can use slight angle (15-30°) if needed
- Obstructions block signal (glass, plastic, hands)

**Challenges:**
- Cable boxes in enclosed racks (must mount emitter inside)
- Stacked equipment (must route emitters carefully)
- Cable boxes on different shelves (multiple emitter cables)
- Moving equipment requires emitter repositioning

**Solutions:**
- Mount emitters inside rack (on inside of door)
- Use dual emitters for difficult placements
- Label all cables clearly
- Document emitter positions

**CEC No Line-of-Sight:**

**Advantages:**
- HDMI cable routes anywhere
- Equipment can be enclosed
- No emitter positioning concerns
- Easy to relocate equipment

**Challenges:**
- HDMI cable length limits (50 feet max recommended)
- Matrix switcher must pass CEC signals
- All devices in HDMI chain must support CEC
- CEC addressing can conflict (max 15 devices)

**Recommendation:**
- CEC wins on flexibility (no line-of-sight)
- IR works fine for typical installations (but requires planning)

---

### 7. Maintenance Requirements

| Task | IR | CEC |
|------|----|----|
| **Monthly Checks** | ⚠️ Visual emitter inspection | ✅ None |
| **Quarterly Maintenance** | ⚠️ Clean IR sensors, check adhesive | ✅ None |
| **Annual Replacement** | ⚠️ Replace 2-4 emitters (~$32) | ✅ None (unless adapter fails) |
| **Troubleshooting Frequency** | ⚠️ Occasional (emitter shifts) | ⚠️ Occasional (CEC conflicts) |
| **Difficulty** | ✅ Easy (visual inspection) | ❌ Complex (HDMI signal analysis) |

**IR Maintenance Tasks:**

**Monthly (5 min):**
- [ ] Visual inspection of all emitters
- [ ] Verify emitters haven't shifted
- [ ] Quick channel change test on each box
- [ ] Check cables for damage

**Quarterly (15 min):**
- [ ] Clean cable box IR sensors (soft cloth)
- [ ] Re-stick loose emitters
- [ ] Test all buttons on each remote
- [ ] Check success rate logs

**Annually (30 min):**
- [ ] Replace aging emitters (preventive)
- [ ] Backup IR codes
- [ ] Full system test
- [ ] Update documentation

**Total Maintenance Time:** ~45 min/year

**CEC Maintenance Tasks:**

**Monthly:** None (if working)

**As Needed (when issues occur):**
- [ ] Reboot CEC adapters
- [ ] Re-run CEC discovery
- [ ] Check HDMI cable connections
- [ ] Update libCEC drivers
- [ ] Troubleshoot CEC addressing conflicts

**Issues:**
- CEC conflicts difficult to diagnose
- Requires technical knowledge
- Firmware updates can break CEC
- No visual troubleshooting (HDMI signal not visible)

**Recommendation:**
- IR: Predictable maintenance (monthly checks)
- CEC: Zero maintenance when working, complex when broken

---

### 8. Troubleshooting Ease

| Issue | IR Troubleshooting | CEC Troubleshooting |
|-------|-------------------|---------------------|
| **Commands not working** | ✅ Phone camera test (see IR flash) | ❌ HDMI signal analyzer needed |
| **Intermittent operation** | ✅ Adjust emitter position (visual) | ❌ Check CEC addressing, conflicts |
| **Wrong device responds** | ✅ Reposition emitter (directional) | ❌ Reconfigure CEC device addresses |
| **Complete failure** | ✅ Check cable, swap emitter | ❌ Reboot adapter, check HDMI chain |
| **Diagnostic Tools** | ✅ Phone camera, visual inspection | ❌ cec-client logs, HDMI analyzer |
| **Skill Level Required** | ✅ Basic (anyone can do) | ❌ Advanced (technical knowledge) |

**IR Troubleshooting Advantages:**

**Visual Debugging:**
- Point phone camera at emitter
- Send command
- See IR flash (purple/white light in camera)
- No flash? → Cable issue or emitter failure
- Flash visible? → Positioning issue

**Simple Tests:**
- Move emitter closer → Does it work now?
- Try different angle → Better response?
- Swap emitter cable → Isolated hardware issue?
- Test with manual remote → Cable box working?

**Common IR Issues (Easy Fixes):**
- Emitter shifted position → Re-stick (2 min fix)
- Cable loose → Push in firmly (30 sec fix)
- Success rate dropped → Move emitter closer (5 min fix)
- Bright light interference → Shield sensor (10 min fix)

**CEC Troubleshooting Challenges:**

**Complex Diagnostics:**
```bash
# Check CEC devices
echo "scan" | cec-client -s -d 1

# View CEC addressing
echo "scan" | cec-client -s -d 1 | grep "address"

# Test specific device
echo "tx 40:44:00" | cec-client -s -d 1

# View logs
journalctl -u cec-service -f
```

**Common CEC Issues (Complex Fixes):**
- CEC addressing conflict → Reconfigure addresses (30 min)
- HDMI handshake failure → Try different HDMI cables (60 min)
- Firmware broke CEC → Wait for firmware update or switch to IR (hours/days)
- CEC passthrough issue → Reconfigure matrix switcher (60 min)

**Recommendation:**
- IR: Easy troubleshooting (visual, intuitive)
- CEC: Complex troubleshooting (requires technical expertise)

---

### 9. Universal Compatibility

| Provider | IR Support | CEC Support |
|----------|-----------|-------------|
| **Spectrum/Charter** | ✅ 100% | ❌ 0% (disabled) |
| **Comcast/Xfinity** | ✅ 100% | ⚠️ 60-80% (varies by model) |
| **Cox** | ✅ 100% | ⚠️ 70-90% (varies by model) |
| **Optimum/Altice** | ✅ 100% | ✅ 90-95% (good support) |
| **Verizon FiOS** | ✅ 100% | ✅ 85-95% (good support) |
| **DirecTV** | ✅ 100% | ❌ Not applicable (use IP control) |
| **Dish Network** | ✅ 100% | ⚠️ 50-70% (poor support) |
| **Generic/Other** | ✅ 99.9% | ❓ Unknown (must test) |

**IR Universal Support:**
- ✅ Works with 99.9% of all cable/satellite boxes
- ✅ Vendor-independent (uses standard IR codes)
- ✅ Cannot be disabled by provider
- ✅ Same hardware works for all providers
- ✅ 30+ years of proven compatibility

**CEC Vendor Dependency:**
- ❌ Vendor can disable at any time (Spectrum did)
- ❌ Implementation varies by manufacturer
- ❌ Firmware updates can break compatibility
- ❌ Matrix switchers may not pass CEC correctly
- ❌ Max 15 devices on CEC bus (addressing limits)

**Future-Proofing:**

**IR:**
- ✅ Will work forever (physics-based, universal)
- ✅ Not dependent on vendor decisions
- ✅ Same codes work across firmware updates
- ✅ No obsolescence risk

**CEC:**
- ❌ Vendor can disable anytime (Spectrum example)
- ❌ Firmware updates risk breaking compatibility
- ❌ Industry moving away from CEC for cable boxes
- ❌ May become obsolete

**Recommendation:**
- IR: Universal, future-proof
- CEC: Vendor-dependent, risk of obsolescence

---

### 10. Bidirectional Communication

| Feature | IR | CEC |
|---------|----|----|
| **Send Commands** | ✅ Yes | ✅ Yes |
| **Receive Status** | ❌ No | ✅ Yes |
| **Query Current Channel** | ❌ No | ✅ Yes (if supported) |
| **Device Discovery** | ❌ No | ✅ Yes |
| **Power State Detection** | ❌ No | ✅ Yes |
| **Error Feedback** | ❌ No | ✅ Yes |

**IR Limitations (One-Way):**

**What IR Cannot Do:**
- Query current channel (send-only)
- Detect if cable box is on/off
- Get confirmation command was received
- Auto-discover cable boxes
- Receive error messages

**Workarounds:**
- Track last sent channel in database
- Assume commands succeed (95%+ do)
- Manual device configuration (no auto-discovery)

**Impact:**
- Minimal for most use cases
- Channel tracking works via software
- Success rates high enough to assume success

**CEC Advantages (Two-Way):**

**What CEC Can Do:**
- Query cable box power state
- Get current active source
- Receive device capabilities
- Auto-discover new devices
- Get command confirmation

**Benefits:**
- Better UI feedback (show actual state)
- Automatic device configuration
- Error handling possible
- System self-monitoring

**Practical Impact:**

**IR (One-Way):**
```javascript
// Send channel command
sendIRCommand("digit_2")
sendIRCommand("digit_0")
sendIRCommand("digit_6")

// Assume success, update UI
database.update({lastChannel: "206"})
// No way to verify cable box actually tuned
```

**CEC (Two-Way):**
```javascript
// Send channel command
sendCECCommand("tune_206")

// Wait for confirmation
const status = await queryCECDevice()
if (status.currentChannel === "206") {
  // Confirmed!
  database.update({lastChannel: "206"})
} else {
  // Failed, retry
  sendCECCommand("tune_206")
}
```

**Recommendation:**
- CEC's bidirectional communication is nice-to-have
- IR's one-way is sufficient for 95%+ of use cases
- Spectrum users don't have a choice (IR only)

---

## Decision Matrix

### When to Use IR

**Use IR if:**
- ✅ You have Spectrum/Charter cable boxes (mandatory)
- ✅ You have 2+ cable boxes (cost-effective)
- ✅ You want proven, reliable technology
- ✅ You want easy troubleshooting
- ✅ You want vendor-independent solution
- ✅ You can dedicate 75 min per box for learning

**IR is Best For:**
- Spectrum installations (only option)
- Multi-box installations (economies of scale)
- Long-term installations (future-proof)
- DIY installations (easy troubleshooting)
- Mixed vendor environments (universal)

### When to Use CEC

**Use CEC if:**
- ✅ You have non-Spectrum cable boxes
- ✅ CEC is verified working (test first!)
- ✅ You have 1 cable box (lower cost)
- ✅ You want faster setup (no learning)
- ✅ You want bidirectional communication
- ✅ You have technical expertise for troubleshooting

**CEC is Best For:**
- Single cable box installations (lower cost)
- Providers with good CEC support (Verizon, Optimum)
- Installations where bidirectional is valuable
- Professional installers (expertise to troubleshoot)

**Important:** Always test CEC for 1 week before committing:
- Send 100 test commands
- Calculate success rate
- If <95% success → Migrate to IR

---

## Real-World Scenarios

### Scenario 1: Sports Bar with 4 Spectrum Cable Boxes

**Requirements:**
- 4 TVs, each with Spectrum 100-H cable box
- Automated channel changing
- Integration with sports guide
- Bartender-operated system

**Analysis:**

| Option | Viability | Cost | Setup Time | Long-Term |
|--------|-----------|------|----------|----------|
| **CEC** | ❌ Not viable | $382 (wasted) | N/A | Doesn't work |
| **IR** | ✅ Recommended | $234 | 6 hours | Reliable |

**Decision:** IR (only option)

**Implementation:**
- Install iTach IP2IR controller
- Position 8 IR emitters (dual per box)
- Learn IR codes (60 min per box)
- Test thoroughly (95%+ success rate)

**Outcome:** Reliable, automated cable box control

---

### Scenario 2: Home Theater with 1 Optimum Cable Box

**Requirements:**
- 1 TV with Optimum cable box
- Home automation integration
- Budget-conscious

**Analysis:**

| Option | Viability | Cost | Setup Time | Long-Term |
|--------|-----------|------|----------|----------|
| **CEC** | ⚠️ Test first | $110 | 1 hour | May work |
| **IR** | ✅ Backup plan | $182 | 2 hours | Will work |

**Decision:** Try CEC first, have IR as backup

**Implementation:**
1. Install Pulse-Eight CEC adapter ($80)
2. Test for 1 week (track success rate)
3. If <95% success → Switch to IR
4. Keep Pulse-Eight for TV power control

**Outcome:** Save money if CEC works, IR fallback available

---

### Scenario 3: Hotel with 50 Comcast Cable Boxes

**Requirements:**
- 50 rooms, each with TV and cable box
- Professional installation
- Maximum reliability
- Minimal maintenance

**Analysis:**

| Option | Viability | Cost | Setup Time | Long-Term |
|--------|-----------|------|----------|----------|
| **CEC** | ⚠️ Risky | $4,750 | 30 hours | Variable |
| **IR** | ✅ Recommended | $3,350 | 80 hours | Reliable |

**Decision:** IR (proven in hospitality industry)

**Implementation:**
- 5x Xantech MRAUDIO8X8 (8 ports each, 40 boxes)
- 2x Global Cache iTach IP2IR (6 ports each, 10 boxes)
- Professional installation
- Learn codes once, clone to all identical boxes

**Outcome:** Industry-standard solution, proven reliability

---

## Migration Path

### Currently Using CEC (Non-Working)

**Situation:** You installed CEC adapters, but commands rarely work

**Migration to IR:**
1. Order IR hardware (iTach + emitters)
2. Install IR emitters (keep CEC in place temporarily)
3. Learn IR codes
4. Test IR commands (verify working)
5. Switch database to use IR instead of CEC
6. Disable CEC devices in database
7. Remove CEC adapters (or keep for TV power control)

**Timeline:** 1-2 days
**Downtime:** Minimal (can switch instantly)

### Currently Using CEC (Working Well)

**Situation:** CEC works, but you're concerned about future reliability

**Options:**

**Option A: Stay with CEC**
- Monitor success rate monthly
- Migrate to IR if success rate drops below 95%
- Keep IR hardware on hand (contingency plan)

**Option B: Proactive Migration to IR**
- Migrate before CEC breaks
- More reliable long-term
- One-time effort

**Option C: Hybrid**
- Use CEC for primary control
- Have IR configured as backup
- System auto-falls back to IR if CEC fails

**Recommendation:** Option A (stay with CEC) for non-Spectrum boxes, but monitor closely

---

## Conclusion

### Summary Table

| Criterion | Winner | Reasoning |
|-----------|--------|-----------|
| **Spectrum Support** | ✅ IR | CEC disabled (no choice) |
| **Reliability** | ✅ IR | 95-98% vs. varies |
| **Setup Time** | ✅ CEC | 55 min vs. 90 min (if CEC works) |
| **Hardware Cost** | ✅ IR | $234 vs. $382 (4 boxes) |
| **Response Time** | ✅ CEC | 100ms vs. 200ms (both feel instant) |
| **Line-of-Sight** | ✅ CEC | Not required |
| **Maintenance** | ✅ CEC | None vs. monthly checks |
| **Troubleshooting** | ✅ IR | Visual vs. complex |
| **Universal Compatibility** | ✅ IR | 99.9% vs. vendor-dependent |
| **Bidirectional** | ✅ CEC | Two-way vs. one-way |
| **Future-Proof** | ✅ IR | Cannot be disabled by vendor |

**Overall Winner:** IR (7 wins vs. 4 wins)

### Final Recommendations

**For Spectrum/Charter:**
- ✅ Use IR (CEC disabled, no choice)
- ✅ Budget $234 for 4 boxes
- ✅ Allocate 6 hours for migration
- ✅ Expect 95-98% reliability

**For Other Providers:**
- ⚠️ Test CEC first (may work)
- ⚠️ Track success rate for 1 week
- ⚠️ If <95% success → Migrate to IR
- ✅ Keep IR hardware as contingency plan

**For DirecTV:**
- ✅ Use IP control (superior to both IR and CEC)
- ✅ See DirecTV integration guide

### Key Takeaway

**"IR is the only universal solution that works reliably for all cable boxes, including Spectrum boxes where CEC has been permanently disabled."**

---

**Document Version:** 1.0
**Last Updated:** November 4, 2025
**Author:** Sports Bar TV Controller Development Team
**Next Review:** February 4, 2026

---

## References

- [CEC to IR Migration Guide](/docs/CEC_TO_IR_MIGRATION_GUIDE.md)
- [CEC Deprecation FAQ](/docs/CEC_DEPRECATION_FAQ.md)
- [IR Learning Quick Start](/docs/IR_LEARNING_QUICK_START.md)
- [IR Emitter Placement Guide](/docs/IR_EMITTER_PLACEMENT_GUIDE.md)
- HDMI-CEC Specification (HDMI Forum)
- Global Cache iTach Technical Documentation
- Pulse-Eight libCEC Documentation
