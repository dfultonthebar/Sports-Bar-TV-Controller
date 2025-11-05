# IR Emitter Placement Guide for Spectrum Cable Boxes

## Overview

This guide provides detailed instructions for optimal IR emitter placement when controlling Spectrum cable boxes (particularly the 100-H model) using the Global Cache iTach IP2IR.

## Table of Contents

- [Understanding IR Control](#understanding-ir-control)
- [Spectrum 100-H Cable Box IR Sensor Location](#spectrum-100-h-cable-box-ir-sensor-location)
- [IR Emitter Types](#ir-emitter-types)
- [Optimal Placement Instructions](#optimal-placement-instructions)
- [Distance and Angle Guidelines](#distance-and-angle-guidelines)
- [Common Issues and Solutions](#common-issues-and-solutions)
- [Testing Signal Strength](#testing-signal-strength)
- [Multi-Device Scenarios](#multi-device-scenarios)

---

## Understanding IR Control

Infrared (IR) control works by transmitting invisible light pulses that carry command signals. For reliable control:

- **Line of Sight**: IR signals require an unobstructed path
- **Distance**: Effective range is typically 2-20 feet
- **Angle**: IR sensors have a reception cone (usually 30-60 degrees)
- **Interference**: Bright lights (especially fluorescent and direct sunlight) can interfere

---

## Spectrum 100-H Cable Box IR Sensor Location

### Front Panel IR Sensor

The Spectrum 100-H cable box has its IR sensor located on the **front panel**:

```
┌────────────────────────────────────┐
│  SPECTRUM                          │
│                                    │
│  ◉ IR SENSOR (usually top-left)   │  ← Primary IR sensor location
│                                    │
│  [Display]              LED        │
│                                    │
└────────────────────────────────────┘
```

**Typical Location**:
- **Top-left corner** of the front panel
- Behind a **dark/tinted plastic window**
- May be labeled with a small IR icon
- Usually near the power LED

**Visual Identification**:
1. Look for a small, dark, glossy rectangle or circle
2. Often has a slight indentation or window
3. Located in the upper portion of the front face
4. May have subtle "IR" text nearby

---

## IR Emitter Types

### 1. Dual-Eye Emitters (Recommended)

**Description**: Two IR LEDs in a small housing with adhesive backing

**Best For**: Permanent installations, racks, equipment closures

**Pros**:
- Strongest signal
- Dual LEDs for redundancy
- Can be precisely positioned
- Adhesive backing for secure mounting

**Placement**:
```
Cable Box Front
┌────────────────┐
│ ◉ IR Sensor    │
│ ⚫⚫ Emitter     │  ← Position 2-4 inches below sensor
└────────────────┘
```

### 2. Single Emitter Blaster

**Description**: Single IR LED, broader coverage area

**Best For**: Testing, temporary setups, wide-area coverage

**Pros**:
- Easier initial setup
- Wider coverage angle
- Good for learning mode

**Cons**:
- Less focused signal
- May require closer placement

### 3. Flasher/Blaster Panels

**Description**: Multiple LEDs covering a wider area

**Best For**: Controlling multiple devices, difficult placements

---

## Optimal Placement Instructions

### Step-by-Step Placement for Spectrum 100-H

#### 1. Locate the IR Sensor
- Power on the cable box
- Look for the IR sensor window (usually top-left front panel)
- Note any obstructions (vents, displays, etc.)

#### 2. Clean the Surface
- Wipe the area around the IR sensor with a soft, lint-free cloth
- Remove any dust, fingerprints, or residue
- If using adhesive emitters, clean the mounting surface as well

#### 3. Position the Emitter

**Option A: Direct Placement (Best)**
```
   IR Emitter
      ⚫⚫
       ↓
   ┌──────┐
   │◉ Sensor
   │      │
   │ BOX  │
   └──────┘
```
- Position emitter **2-6 inches** from IR sensor
- Aim directly at the sensor window
- Ensure **no obstructions** between emitter and sensor

**Option B: Angled Placement**
```
   IR Emitter
      ⚫⚫
       ↘
   ┌──────┐
   │◉ Sensor
   │      │
   │ BOX  │
   └──────┘
```
- Position at a **15-30 degree angle**
- Maintain **3-8 inches** distance
- Useful when direct placement isn't possible

#### 4. Secure the Emitter

**For Adhesive Emitters**:
1. Peel backing from adhesive
2. Press firmly against mounting surface
3. Hold for 10-15 seconds
4. Allow adhesive to set for 1 hour before testing

**For Non-Adhesive Emitters**:
1. Use mounting tape or putty
2. Ensure emitter won't fall or shift
3. Route cable neatly to avoid strain

#### 5. Cable Management
- Secure IR cable to prevent tension on emitter
- Use cable ties or clips
- Avoid sharp bends in the cable
- Keep cable away from power cables to reduce interference

---

## Distance and Angle Guidelines

### Recommended Distances

| Emitter Type | Minimum | Optimal | Maximum |
|-------------|---------|---------|---------|
| Dual-Eye    | 2"      | 4-6"    | 12"     |
| Single      | 3"      | 6-8"    | 18"     |
| Blaster     | 6"      | 12-18"  | 36"     |

### Angle Considerations

**Direct (0°)**: Best performance, strongest signal
- Use when possible
- Minimizes interference
- Most reliable

**Slight Angle (15-30°)**: Good performance
- Acceptable for most setups
- Useful for rack mounting
- May need closer placement

**Wide Angle (30-45°)**: Fair performance
- May have intermittent issues
- Requires testing
- Consider using dual emitters

**Extreme Angle (>45°)**: Not recommended
- Unreliable operation
- Reposition if possible
- Use IR blaster instead

---

## Common Issues and Solutions

### Issue 1: Commands Not Working

**Symptoms**: Cable box doesn't respond to IR commands

**Causes & Solutions**:

1. **Emitter Too Far**
   - Move emitter closer (try 3-4 inches)
   - Ensure direct line of sight

2. **Wrong Sensor Location**
   - Recheck IR sensor position
   - Try different placement

3. **Interference**
   - Turn off nearby fluorescent lights
   - Close blinds if in direct sunlight
   - Move away from bright LED displays

4. **Weak Signal**
   - Check iTach connection
   - Verify emitter cable is fully seated
   - Try different IR port on iTach

### Issue 2: Intermittent Response

**Symptoms**: Commands work sometimes, fail other times

**Causes & Solutions**:

1. **Marginal Placement**
   - Adjust angle for more direct aim
   - Move slightly closer
   - Ensure emitter is secure and not shifting

2. **Environmental Interference**
   - Note times when failures occur (e.g., morning sunlight)
   - Shield IR sensor from light sources
   - Reposition to avoid interference

3. **Multiple Reflections**
   - IR signal bouncing off surfaces
   - Add black felt/tape around sensor area to absorb reflections
   - Move emitter for more direct path

### Issue 3: Wrong Device Responding

**Symptoms**: Other IR devices in area respond to commands

**Causes & Solutions**:

1. **Too Much IR Spread**
   - Use focused dual-eye emitter instead of blaster
   - Position closer to intended device sensor
   - Reduce IR signal strength if iTach supports it

2. **IR Reflection**
   - Place devices farther apart
   - Shield other device sensors with tape
   - Angle emitter more directly

---

## Testing Signal Strength

### Visual Test

1. **Use a Phone Camera**:
   - Open phone camera app
   - Point camera at IR emitter
   - Send a command
   - Look for purple/white flashing (IR light visible through camera)
   - Bright, steady pulses = good signal

### Functional Test

1. **Power On/Off Test**:
   - Send power command from system
   - Cable box should respond immediately
   - No response = reposition emitter

2. **Channel Change Test**:
   - Send channel up/down commands
   - Should respond within 1 second
   - Delayed response = weak signal

3. **Rapid Command Test**:
   - Send multiple commands in quick succession
   - All should execute
   - Missed commands = positioning issue

### Diagnostic Checklist

- [ ] Emitter positioned 2-6 inches from sensor
- [ ] Direct line of sight (no obstructions)
- [ ] Emitter aimed at sensor window
- [ ] Cable firmly connected to iTach
- [ ] No bright lights interfering
- [ ] Emitter secure and not shifting
- [ ] Commands respond 100% of time
- [ ] Other devices not affected

---

## Multi-Device Scenarios

### Controlling Multiple Cable Boxes

**Scenario**: 2-3 cable boxes in same equipment rack

**Solution 1: Individual Emitters (Recommended)**
```
iTach IP2IR
├─ Port 1:1 → Cable Box 1 (Emitter A)
├─ Port 1:2 → Cable Box 2 (Emitter B)
└─ Port 1:3 → Cable Box 3 (Emitter C)
```

**Benefits**:
- Independent control
- No cross-talk
- Most reliable

**Setup**:
1. Label each emitter (A, B, C)
2. Position each 4-6" from respective box
3. Test each independently
4. Verify no interference between devices

**Solution 2: IR Blaster (Alternative)**

Use when individual emitters aren't feasible:
- Position blaster centrally
- Ensure coverage of all devices
- May require higher power setting
- Test for cross-device interference

### Equipment Rack Placement

**Best Practices**:

1. **Front-Mounted Cable Boxes**:
   - Easiest for IR control
   - Position emitter on inside of rack door
   - Align with IR sensor when door is closed

2. **Rear-Mounted Cable Boxes**:
   - More challenging
   - May need longer emitter cable
   - Consider relocating box for better access

3. **Stacked Configuration**:
   - Use individual emitters for each unit
   - Label cables clearly
   - Leave 1U space between boxes if possible

### Example Rack Layout

```
┌─────────────────────┐
│ 1U - Switch         │
├─────────────────────┤
│ 2U - Cable Box 1    │ ← Emitter 1 (Port 1:1)
│      ◉ Sensor       │
├─────────────────────┤
│ 3U - Cable Box 2    │ ← Emitter 2 (Port 1:2)
│      ◉ Sensor       │
├─────────────────────┤
│ 4U - Cable Box 3    │ ← Emitter 3 (Port 1:3)
│      ◉ Sensor       │
└─────────────────────┘
```

---

## Advanced Tips

### Maximizing Reliability

1. **Test During Learning**:
   - Learn IR codes with emitter in final position
   - Ensures codes are optimized for your setup

2. **Document Placement**:
   - Take photos of emitter positions
   - Mark positions with tape
   - Create a placement map for future reference

3. **Regular Maintenance**:
   - Check emitter position monthly
   - Clean IR sensor windows quarterly
   - Test command reliability periodically

### Troubleshooting Checklist

When commands fail:

1. ✅ Check iTach network connection
2. ✅ Verify emitter cable seated in iTach port
3. ✅ Confirm emitter hasn't shifted position
4. ✅ Test with phone camera (IR visible?)
5. ✅ Check for new light sources (interference)
6. ✅ Try learning mode again
7. ✅ Swap to different iTach port
8. ✅ Replace emitter cable if damaged

---

## Support and Resources

### Additional Help

- **IR Learning System**: `/ir-learning` page in web interface
- **Test Commands**: Use the "Test" button after learning
- **Cable Box Remote**: Test live from `/remote` page

### Spectrum 100-H Specific Notes

- Some units have **dual IR sensors** (front and side)
- Try both locations if front sensor doesn't work
- Firmware version may affect IR responsiveness
- Consider CEC control if IR proves problematic

### Global Cache iTach Resources

- **iTach Specs**: 3 IR outputs, 100ft range (in ideal conditions)
- **LED Indicator**: Flashes when sending IR
- **Port Configuration**: Ports 1:1, 1:2, 1:3
- **Network**: Ensure iTach has stable IP address

---

## Quick Reference Card

### Perfect Placement in 5 Steps

1. **Locate** IR sensor (top-left front panel)
2. **Position** emitter 4-6 inches away
3. **Aim** directly at sensor window
4. **Secure** with adhesive or mounting tape
5. **Test** commands for 100% reliability

### Troubleshooting in 3 Steps

1. **Verify** placement: closer, direct aim
2. **Eliminate** interference: lights, reflections
3. **Confirm** connections: cables, iTach power

---

## Conclusion

Proper IR emitter placement is critical for reliable Spectrum cable box control. Follow these guidelines for optimal results:

- Position emitter **4-6 inches** from IR sensor
- Maintain **direct line of sight**
- Avoid **bright light interference**
- Test **thoroughly** before finalizing placement
- Document your setup for future reference

With correct placement, your IR control system will provide years of reliable, hands-free cable box operation.
