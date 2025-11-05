# CEC to IR Migration - Quick Reference Card

**Version:** 1.0
**Date:** November 4, 2025
**Time to Complete:** 75 minutes per cable box

---

## Why Migrate?

**Spectrum disabled CEC in firmware**
IR is the only option → 95%+ reliability

---

## What You Need

- [ ] Global Cache iTach IP2IR ($150)
- [ ] IR emitters: 4-8 units ($32-64)
- [ ] Y-splitters: 0-4 cables ($0-20)
- [ ] Spectrum remote control
- [ ] Computer with web browser
- [ ] 75 minutes per cable box

---

## 5-Step Migration Process

### Step 1: Position IR Emitters (15 min)

**1.1 Locate IR Sensor**
- Top-left corner of cable box front panel
- Small dark window or glossy circle

**1.2 Position Emitter**
- Place 4-6 inches from IR sensor
- Aim directly at sensor
- Don't stick permanently yet (wait for testing)

**1.3 Connect to iTach**
```
Box 1 → iTach Port 1:1
Box 2 → iTach Port 1:2
Box 3 → iTach Port 1:3
Box 4 → iTach Port 1:4 (or use Y-splitter)
```

**1.4 Label Cables**
- "Box 1", "Box 2", etc.

---

### Step 2: Learn IR Codes (60 min)

**2.1 Open IR Learning Page**
```
http://[your-server-ip]:3001/ir-learning
```

**2.2 Select Cable Box**
- Choose "Cable Box 1" (or appropriate box)
- Verify iTach IP: 192.168.1.100
- Verify IR Port: 1

**2.3 Learn All Buttons (27 total)**

**For Each Button:**
1. Click "Learn"
2. Point Spectrum remote at iTach (6-12 inches)
3. Press button on remote (hold 1-2 seconds)
4. Wait for "Captured!"
5. Click "Test" to verify
6. Move to next button

**Learning Order:**
- Power (1 button) → 2 min
- Numbers 0-9 (10 buttons) → 20 min
- Navigation: Up, Down, Left, Right, Select (5 buttons) → 10 min
- Functions: Guide, Menu, Info, Exit, Last (5 buttons) → 10 min
- Channel: Channel Up, Channel Down (2 buttons) → 4 min
- DVR: Play, Pause, Rewind, FF, Record, Stop (6 buttons) → 12 min
- Volume: Vol Up, Vol Down, Mute (3 buttons) → 6 min

**2.4 Export for Backup**
- Click "Export Codes"
- Save JSON file

**2.5 Save to Database**
- Click "Save All Codes" (IMPORTANT!)
- Wait for "Saved!" confirmation

---

### Step 3: Test Operation (15 min)

**3.1 Navigate to Remote Page**
```
http://[your-server-ip]:3001/remote
```

**3.2 Test All Buttons**
- [ ] Power → Cable box powers off/on
- [ ] Digits 1-1 → Cable box tunes to channel 11
- [ ] Channel Up → Cable box changes channel
- [ ] Guide → Opens TV guide
- [ ] Navigation arrows → Move through guide
- [ ] Select → Chooses highlighted item

**3.3 Verify Performance**
- Success rate: Should be 95%+
- Response time: Should feel instant (<200ms)
- No phantom presses

**3.4 Adjust if Needed**
- If <95% success: Move emitter closer (try 3-4 inches)
- If still poor: Add second emitter (dual setup)
- Test again after adjustments

---

### Step 4: Finalize Position (5 min)

**Once 95%+ Success Rate Achieved:**
1. Mark emitter position with tape
2. Remove adhesive backing
3. Press firmly in position
4. Hold for 10 seconds
5. Allow 1 hour to set
6. Re-test all buttons

---

### Step 5: Document (10 min)

- [ ] Take photos of emitter positions
- [ ] Save IR code backup
- [ ] Note any issues encountered
- [ ] Update device configuration

---

## Quick Troubleshooting

### "IR codes not capturing"
**Fix:** Press button harder, hold 2 seconds, move closer to iTach

### "Button doesn't work after learning"
**Fix:** Move emitter closer to cable box (4 inches), aim directly at sensor

### "Intermittent response"
**Fix:** Add second emitter (dual setup), move 1 inch closer

### "No response at all"
**Fix:** Check emitter cable connection, verify iTach IP: `ping 192.168.1.100`

### "Wrong command executed"
**Fix:** Clear codes, re-learn from scratch

---

## Position Guide

### Learning Position (Remote → iTach)
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

### Emitter Position (Emitter → Cable Box)
```
Front View:
┌────────────────┐
│ ◉ IR Sensor    │  ← Sensor (top-left)
│ ⚫⚫ Emitter     │  ← Position 4-6" away
│                │
│   CABLE BOX    │
└────────────────┘

Side View:
         ⚫⚫ Secondary (optional)
          ↓
┌─────────────────┐
│  ◉ Sensor       │
│                 │
│    ⚫⚫ Primary   │  ← 4-6" from sensor
│                 │
│  SPECTRUM 100-H │
└─────────────────┘
```

---

## Validation Checklist

After migration, verify:

- [ ] Power button works
- [ ] All digit buttons work (0-9)
- [ ] Navigation works (up, down, left, right, select)
- [ ] Guide/Menu buttons work
- [ ] Channel up/down works
- [ ] DVR controls work
- [ ] Response time <200ms
- [ ] Success rate 95%+
- [ ] No phantom button presses
- [ ] IR codes backed up
- [ ] Emitter position documented

---

## Time Estimate

| Task | Time |
|------|------|
| Position emitters | 15 min |
| Learn IR codes | 60 min |
| Test operation | 15 min |
| Finalize position | 5 min |
| Document | 10 min |
| **Total** | **105 min** |

**First box:** ~2 hours (includes learning curve)
**Additional boxes:** ~75 min each

---

## Success Metrics

**Target Performance:**
- Success rate: ≥95% (19 out of 20 commands work)
- Response time: <200ms (feels instant)
- Reliability: Works consistently, day after day

**If Not Meeting Targets:**
1. Adjust emitter position (closer, better aim)
2. Add second emitter (dual setup)
3. Re-learn problematic buttons
4. Check for obstructions/interference

---

## Hardware Quick Ref

### iTach IP2IR
- **IP Address:** 192.168.1.100 (or your static IP)
- **Ports:** 3 (expandable to 6 with Y-splitters)
- **Test:** `ping 192.168.1.100`

### IR Emitters (Xantech 284M)
- **Position:** 4-6 inches from sensor
- **Angle:** Direct aim (0°) preferred
- **Lifespan:** 2-3 years typical

### Spectrum Cable Box
- **IR Sensor:** Top-left front panel
- **Frequency:** 38kHz standard
- **CEC Status:** Disabled (cannot be enabled)

---

## Emergency Fallback

**If IR completely fails:**
1. Use standard Spectrum remote (manual control)
2. Check iTach network: `ping 192.168.1.100`
3. Verify emitter cables connected
4. Test with phone camera (should see IR flash)
5. Contact technical support

---

## Support Resources

**Documentation:**
- Full Guide: `/docs/CEC_TO_IR_MIGRATION_GUIDE.md`
- FAQ: `/docs/CEC_DEPRECATION_FAQ.md`
- Comparison: `/docs/IR_VS_CEC_COMPARISON.md`
- Emitter Placement: `/docs/IR_EMITTER_PLACEMENT_GUIDE.md`

**Web Interfaces:**
- IR Learning: `http://[server]:3001/ir-learning`
- Remote Test: `http://[server]:3001/remote`
- Device Config: `http://[server]:3001/config`

**Technical Support:**
- Global Cache: support@globalcache.com
- Xantech: techsupport@xantech.com
- Project Issues: GitHub

---

## Do's and Don'ts

### ✅ DO
- Learn in order (Power → Numbers → Navigation → Functions → DVR)
- Test each button immediately after learning
- Hold remote steady and press firmly (1-2 seconds)
- Export codes for backup
- Click "Save All Codes" before leaving page
- Take photos of final emitter positions
- Document any issues encountered

### ❌ DON'T
- Skip testing buttons
- Learn in direct sunlight or bright fluorescent light
- Move remote while pressing button
- Permanently stick emitter before testing
- Forget to click "Save All Codes"
- Rush the process (accuracy > speed)

---

## One-Page Workflow

```
1. POSITION EMITTERS (15 min)
   ├─ Locate IR sensor (top-left front)
   ├─ Position emitter 4-6" away
   ├─ Connect to iTach Port 1:1
   └─ Label cable "Box 1"

2. LEARN IR CODES (60 min)
   ├─ Open /ir-learning page
   ├─ Select Cable Box 1
   ├─ Learn 27 buttons (click Learn, point remote, press button, wait)
   ├─ Test each button
   ├─ Export codes
   └─ Click "Save All Codes"

3. TEST OPERATION (15 min)
   ├─ Open /remote page
   ├─ Test all buttons
   ├─ Verify 95%+ success rate
   └─ Adjust emitter if needed

4. FINALIZE (5 min)
   ├─ Mark position
   ├─ Remove adhesive backing
   ├─ Stick firmly
   └─ Re-test

5. DOCUMENT (10 min)
   ├─ Photos
   ├─ Backup
   └─ Notes

DONE! ✅
```

---

## Quick Command Reference

**Test iTach Connection:**
```bash
ping 192.168.1.100
```

**View IR Devices:**
```bash
curl http://localhost:3001/api/ir-devices
```

**Test IR Command:**
```bash
curl -X POST http://localhost:3001/api/ir-devices/send-command \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "cable-box-1", "command": "channel_up"}'
```

---

**Keep this card handy during migration!**

**Version:** 1.0
**Last Updated:** November 4, 2025
**Sports Bar TV Controller Development Team**
