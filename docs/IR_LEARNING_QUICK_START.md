# IR Learning Quick Start Guide

## 🎯 Goal
Learn IR codes from your Spectrum cable box remote in under 60 minutes.

---

## 📋 What You Need

- ✅ Spectrum cable box remote control
- ✅ Global Cache iTach IP2IR (connected to network)
- ✅ IR emitter cable (plugged into iTach port 1)
- ✅ Computer/tablet with web browser

---

## 🚀 5-Step Process

### Step 1: Open IR Learning Page

**On your computer/tablet:**
```
http://your-server-ip:3001/ir-learning
```

*Example: http://192.168.1.50:3001/ir-learning*

### Step 2: Select Your Cable Box

1. Click **"Cable Box"** dropdown
2. Choose your device (e.g., "Cable Box 2")
3. Verify **iTach IP**: `192.168.1.100`
4. Verify **IR Port**: `1`

### Step 3: Learn Each Button

**For each button (repeat 27 times):**

1. Click **"Learn"** button
2. Point Spectrum remote **at iTach** (6-12 inches away)
3. Press button on remote (hold 1-2 seconds)
4. Wait for **"Captured!"** message
5. Click **"Test"** to verify it works
6. Move to next button

**💡 Tip:** Learn in this order:
- Power (1 button)
- Numbers 0-9 (10 buttons)
- Navigation arrows + Select (5 buttons)
- Guide, Menu, Info, Exit, Last (5 buttons)
- Channel Up/Down (2 buttons)
- Play, Pause, Rewind, FF, Record, Stop (6 buttons)
- Volume Up/Down, Mute (3 buttons - optional)

### Step 4: Save Everything

1. Scroll to bottom of page
2. Click **"Save All Codes"** button
3. Wait for **"Saved!"** confirmation

### Step 5: Test Virtual Remote

1. Go to: `http://your-server-ip:3001/remote`
2. Select your cable box
3. Click any button on virtual remote
4. Verify cable box responds

✅ **Done!** Your cable box now works with IR control.

---

## 🎓 Learning Tips

### ✅ DO

- **Point remote AT iTach** when learning
- **Hold button for 1-2 seconds** (don't just tap)
- **Keep remote steady** while pressing
- **Wait for confirmation** before releasing
- **Test each button** after learning
- **Export codes** when done (backup)

### ❌ DON'T

- Don't learn in bright sunlight
- Don't press multiple buttons at once
- Don't move remote while learning
- Don't skip testing buttons
- Don't forget to click "Save All Codes"

---

## ⚡ Quick Troubleshooting

### "Timeout waiting for button press"
**Fix:** Press button harder, hold longer (1-2 seconds)

### "Test button doesn't work"
**Fix:** Adjust IR emitter closer to cable box (4-6 inches from IR sensor)

### "Wrong button learned"
**Fix:** Click "Learn" again, point remote more directly at iTach

### "Codes disappeared after page reload"
**Fix:** Click "Save All Codes" button before leaving page

---

## 📱 Position Guide

### Learning Position (You → iTach)

```
     You
      │
   Remote ───→ [iTach]
   (6-12")
```

Point Spectrum remote **directly** at iTach sensor

### Emitter Position (Emitter → Cable Box)

```
┌────────────────┐
│ ◉ IR Sensor    │  ← IR sensor (top-left)
│ ⚫⚫ Emitter     │  ← Position 4-6" away
│                │
│   CABLE BOX    │
└────────────────┘
```

Position emitter **directly** in front of cable box IR sensor

---

## ⏱️ Time Estimate

| Task | Time |
|------|------|
| Power button | 2 min |
| Numbers (0-9) | 20 min |
| Navigation | 10 min |
| Functions | 10 min |
| Channel/DVR | 16 min |
| Volume | 6 min |
| **Total** | **60-75 min** |

---

## 💾 Backup Your Work

After learning all buttons:

1. Click **"Export"** button
2. Save file: `Cable_Box_2_ir_codes.json`
3. Store safely (Google Drive, USB drive, etc.)

**To restore:**
1. Click **"Import"** button
2. Select saved JSON file
3. Done!

---

## 🆘 Need Help?

**Full Documentation:**
- Placement Guide: `/docs/IR_EMITTER_PLACEMENT_GUIDE.md`
- Demo Script: `/docs/IR_LEARNING_DEMO_SCRIPT.md`
- Cable Box Guide: `/docs/IR_CABLE_BOX_CONTROL.md`

**Quick Support:**
- Check iTach is powered on and connected
- Verify network connectivity: `ping 192.168.1.100`
- Ensure IR emitter is connected to iTach port 1
- Try different distance when learning (8-10 inches)

---

## ✅ Success Checklist

Before you finish:

- [ ] All 27 buttons learned
- [ ] Each button tested and works
- [ ] "Save All Codes" clicked
- [ ] Codes exported for backup
- [ ] Virtual remote tested
- [ ] IR emitter properly positioned
- [ ] Cable box responds to commands

---

## 🎉 You're Done!

Your cable box is now ready for IR control. The system will automatically use your learned codes whenever you control the cable box.

**No additional setup required** - just use the virtual remote as normal!

---

**Time to Complete**: 60-75 minutes
**Difficulty**: Easy
**Required Skill**: Point remote, click buttons
**Result**: Full IR control of cable box
