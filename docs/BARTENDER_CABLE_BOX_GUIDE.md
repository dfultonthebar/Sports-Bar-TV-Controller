# Bartender Quick-Start Guide: Cable Box Control

**Last Updated:** 2025-10-29
**Version:** 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Accessing the Bartender Remote](#accessing-the-bartender-remote)
3. [Cable Box Control (CEC)](#cable-box-control-cec)
4. [Using Channel Presets](#using-channel-presets)
5. [Using the Sports Guide](#using-the-sports-guide)
6. [Alternative: Dedicated Cable Box Remote](#alternative-dedicated-cable-box-remote)
7. [Troubleshooting](#troubleshooting)
8. [Quick Reference](#quick-reference)

---

## Overview

The Sports Bar TV Controller now supports **automated cable box control via CEC** (Consumer Electronics Control). This allows you to change channels on any of the 4 cable boxes without needing a physical remote.

**What you can do:**
- ✅ Change channels using preset buttons (ESPN, FS1, etc.)
- ✅ Tune to specific games from the sports guide with one click
- ✅ Select which cable box to control
- ✅ Switch between multiple cable boxes easily

**No more fumbling with remotes!** Everything is controlled through the touchscreen interface.

---

## Accessing the Bartender Remote

### Option 1: Bottom Navigation (Recommended)

The bartender remote is accessible from any page using the bottom navigation bar:

1. Look for the navigation tabs at the bottom of the screen
2. Tap the **"Guide"** tab
3. You'll see the bartender channel guide interface

### Option 2: Direct URL

Navigate directly to: `http://localhost:3001/bartender`

---

## Cable Box Control (CEC)

### Understanding the Cable Box Selector

At the top of the bartender remote, you'll see a **Cable Box Control** panel (if CEC is configured):

```
┌─────────────────────────────────────────┐
│ 🔌 Cable Box Control (CEC)   [✓] Enable CEC │
├─────────────────────────────────────────┤
│ [Cable Box 1] [Cable Box 2]             │
│    Online         Online                │
│                                          │
│ [Cable Box 3] [Cable Box 4]             │
│    Offline        Online                │
└─────────────────────────────────────────┘
```

### How to Use

1. **Enable CEC Control**
   - Check the "Enable CEC" checkbox in the top-right
   - When enabled, channel changes will be sent via CEC instead of IR

2. **Select a Cable Box**
   - Tap on the cable box you want to control
   - The selected box will be highlighted in blue
   - You'll see a confirmation message showing which box is selected

3. **Check Status**
   - 🟢 **Green dot = Online** - Cable box is responding
   - 🔴 **Red dot = Offline** - Cable box is not responding (may need troubleshooting)

### Which Cable Box Controls Which Screen?

| Cable Box Name | Location | Typical Content |
|----------------|----------|-----------------|
| Cable Box 1    | Screen 1 | Main game/premium content |
| Cable Box 2    | Screen 2 | Secondary games |
| Cable Box 3    | Screen 3 | Additional games |
| Cable Box 4    | Screen 4 | Background/news |

*Note: Your setup may vary - check with the manager for your specific configuration.*

---

## Using Channel Presets

Channel presets give you **one-tap access** to frequently used channels.

### How to Use Presets

1. **Enable CEC and Select Cable Box** (see above)
2. Scroll down to the **Channel Presets** section
3. Tap any preset button (e.g., "ESPN", "FS1", "NBC Sports")
4. The selected cable box will automatically tune to that channel

### Preset Buttons Explained

Common presets you'll see:

| Preset | Channel # | Content |
|--------|-----------|---------|
| ESPN | 206 | Sports highlights, games |
| FS1 | 212 | Fox Sports games |
| NBC Sports | 220 | NHL, Premier League |
| TNT | 245 | NBA, playoffs |
| CBS Sports | 221 | College sports, NFL |
| NFL Network | 212 | Football coverage |

*Channel numbers may vary by provider - these are Spectrum defaults.*

### Status Messages

When you tap a preset, you'll see status messages:

- ✅ **"Tuning to ESPN (206) via CEC..."** - Command is being sent
- ✅ **"Now watching: ESPN"** - Channel change successful
- ❌ **"Failed: Cable box not responding"** - See [Troubleshooting](#troubleshooting)

---

## Using the Sports Guide

The sports guide shows **live and upcoming games** from all major sports leagues.

### Finding Games

1. **Enable CEC and Select Cable Box** (see above)
2. Tap the **"Show Channel Guide"** button near the top
3. Browse the list of games:
   - Games are organized by start time
   - Live games are marked with a "🔴 LIVE" badge
   - Each game shows:
     - League (NFL, NBA, NHL, etc.)
     - Teams playing
     - Start time
     - Channel

### Watching a Game

1. Find the game you want to watch
2. Tap the **"Watch"** button next to the game
3. The system will:
   - ✅ Automatically tune the selected cable box to the game's channel
   - ✅ Show a status message
   - ✅ Update the last operation time

### Filtering Games

Use the search box to filter games:

- Type a team name (e.g., "Lakers", "Chiefs")
- Type a league (e.g., "NBA", "NFL")
- Type a channel name (e.g., "ESPN")

The list will automatically filter as you type.

### Guide Example

```
┌──────────────────────────────────────────────┐
│ 🏈 NFL • Chiefs @ Bills                      │
│ ⏰ 1:00 PM ET • 📺 CBS (206)                 │
│                              [Watch] ▶       │
├──────────────────────────────────────────────┤
│ 🏀 NBA • Lakers @ Celtics • 🔴 LIVE          │
│ ⏰ 7:30 PM ET • 📺 ESPN (206)                │
│                              [Watch] ▶       │
└──────────────────────────────────────────────┘
```

---

## Alternative: Dedicated Cable Box Remote

For advanced control beyond channel changing, use the **dedicated cable box remote**:

### Accessing the Full Remote

Navigate to: `http://localhost:3001/cable-box-remote`

### Features Available

The full remote includes:

- **Number Pad** (0-9) - Enter channels manually
- **Navigation D-Pad** - Navigate menus
- **Menu Buttons** - Access Guide, Menu, Info
- **Channel Up/Down** - Surf channels
- **DVR Controls** - Rewind, Play, Pause, Fast Forward, Record
- **Quick Channels** - Preset buttons for common channels

### When to Use the Full Remote

Use the dedicated remote when you need to:
- Enter a specific channel number (e.g., "527")
- Navigate the cable box menu
- Use DVR features
- Access the cable box guide
- Perform advanced operations

---

## Troubleshooting

### Cable Box Shows "Offline"

**Problem:** Cable box has a red dot and says "Offline"

**Solutions:**
1. Check that the cable box is powered on
2. Verify the CEC adapter is plugged into the cable box's HDMI output
3. Check the USB connection from the adapter to the server
4. Navigate to `http://localhost:3001/admin/cec-devices` and click "Test Connection"
5. If still offline, contact technical support

### Channel Change Failed

**Problem:** Status shows "Failed: Cable box not responding"

**Try these steps:**
1. Verify CEC is enabled (checkbox is checked)
2. Verify a cable box is selected (highlighted in blue)
3. Check that the selected cable box shows "Online"
4. Try selecting a different cable box
5. Try disabling and re-enabling CEC
6. Refresh the page (pull down to refresh on mobile)

### Wrong Channel Changes

**Problem:** Channel changes on a different screen than expected

**Solution:**
- Double-check which cable box is selected (highlighted in blue)
- Each cable box controls a specific screen - verify you selected the correct one
- If unsure, ask your manager which cable box controls which screen

### CEC Control Section Not Showing

**Problem:** The Cable Box Control panel doesn't appear

**Possible causes:**
1. No cable boxes are configured in the system yet
2. Hardware installation is not complete
3. Database configuration issue

**Solutions:**
- Check with your manager - CEC may not be installed yet
- Navigate to `http://localhost:3001/admin/cec-devices` to see device status
- If you see "No Cable Boxes Configured", the system is still in setup mode

### Preset Button Does Nothing

**Problem:** Tapping a preset button has no effect

**Solutions:**
1. Make sure CEC is enabled (checkbox checked)
2. Make sure a cable box is selected (highlighted in blue)
3. Check that the selected cable box is "Online"
4. Wait for any previous command to finish (loading indicator)
5. Try refreshing the page

### Sports Guide "Watch" Button Not Working

**Problem:** Tapping "Watch" on a game doesn't change the channel

**Solutions:**
1. Verify the game has a channel number shown
2. Make sure CEC is enabled and a cable box is selected
3. Verify the cable box is online
4. Some streaming-only games may not have channel numbers
5. Use channel presets as a fallback

---

## Quick Reference

### Quick Start (Most Common Use Case)

**To change a channel to ESPN:**

1. ✅ Enable CEC (check the box)
2. ✅ Select a cable box (tap one)
3. ✅ Tap "ESPN" preset button
4. ✅ Wait for "Now watching: ESPN"

**Total time:** ~3 seconds

### Quick Start (Watch a Specific Game)

**To watch Lakers vs Celtics:**

1. ✅ Enable CEC (check the box)
2. ✅ Select a cable box (tap one)
3. ✅ Tap "Show Channel Guide"
4. ✅ Find "Lakers" game in the list
5. ✅ Tap "Watch" button
6. ✅ Wait for "Now watching: NBA"

**Total time:** ~5 seconds

### Status Indicators

| Indicator | Meaning |
|-----------|---------|
| 🟢 Green dot | Cable box is online and responding |
| 🔴 Red dot | Cable box is offline or not responding |
| Blue highlight | This cable box is currently selected |
| Gray box | Cable box is available but not selected |
| "via CEC" in status | Command is being sent via CEC |
| "Tuning to..." | Channel change in progress |
| "Now watching:" | Channel change successful |
| "Failed:" | Command failed - see troubleshooting |

### Common Channels Quick Reference

| Channel | Number (Spectrum) | Content |
|---------|-------------------|---------|
| ESPN | 206 | General sports |
| ESPN2 | 209 | Overflow sports |
| FS1 | 212 | Fox Sports 1 |
| FS2 | 618 | Fox Sports 2 |
| NBC Sports | 220 | NHL, EPL, etc. |
| CBS Sports | 221 | College, NFL |
| NFL Network | 212 | Football |
| NBA TV | 302 | Basketball |
| NHL Network | 303 | Hockey |
| MLB Network | 304 | Baseball |
| Golf Channel | 218 | Golf |
| Tennis Channel | 217 | Tennis |

*Channel numbers vary by cable provider and region.*

---

## Support

### Need Help?

1. **Check this guide first** - Most common issues are covered above
2. **Ask your manager** - They can verify hardware setup
3. **Technical support** - Contact the system administrator

### Admin Tools

Managers and admins can access additional tools:

- **Device Admin:** `http://localhost:3001/admin/cec-devices`
- **Monitoring Dashboard:** `http://localhost:3001/cec-monitoring`
- **Full Remote:** `http://localhost:3001/cable-box-remote`

### Reporting Issues

If you encounter a problem:

1. Note the exact error message shown
2. Note which cable box was selected
3. Note what action you were trying to perform
4. Report to your manager with these details

---

## Tips for Efficient Operation

### Best Practices

1. **Set it and forget it** - Once you enable CEC and select a cable box, it stays selected
2. **Use presets** - They're faster than the sports guide for common channels
3. **Check status** - Always verify the cable box is "Online" before starting
4. **Wait for confirmation** - Don't tap multiple times - wait for status messages
5. **One box at a time** - Change channels on one box, then switch to the next

### Peak Hours Tips

During busy times (game days, events):

1. **Pre-select cable boxes** - Set up which box controls which screen ahead of time
2. **Use quick channels** - Memorize preset buttons for common channels
3. **Bookmark the page** - Add to home screen for instant access
4. **Keep guide open** - Leave sports guide visible to see upcoming games

### Multi-Screen Setup

To set up multiple screens for a big event:

1. Select Cable Box 1, tune to main game (e.g., ESPN)
2. Select Cable Box 2, tune to secondary game (e.g., FS1)
3. Select Cable Box 3, tune to third game (e.g., NBC Sports)
4. Select Cable Box 4, tune to background content (e.g., NFL Network)

Total time: ~30 seconds to configure all 4 screens!

---

## Frequently Asked Questions

### Q: Do I need to select a cable box every time?

**A:** No. Once you select a cable box and enable CEC, it stays selected until you change it or refresh the page.

### Q: Can I control multiple cable boxes at once?

**A:** No. You can only control one cable box at a time. To change channels on multiple boxes, switch between them.

### Q: What if I don't see the CEC control panel?

**A:** The hardware may not be installed yet. Check with your manager. You can still use traditional remotes in the meantime.

### Q: Are channel numbers the same for DirecTV and Cable?

**A:** No. Channel numbers are different. The system automatically uses the correct numbers based on your device type.

### Q: Can I use this on my phone?

**A:** Yes! The interface is fully responsive and works great on phones and tablets.

### Q: What happens if two people try to control the same cable box?

**A:** The last command wins. Coordinate with other staff to avoid conflicts.

### Q: Can I still use the physical remote?

**A:** Yes. Physical remotes and CEC control work together. However, the system won't know about physical remote commands.

### Q: How do I know which screen a cable box controls?

**A:** Ask your manager for a map. Each location is different. Common setup is Cable Box 1 = Main Screen, etc.

---

**End of Quick-Start Guide**

*For technical documentation, see `CEC_CABLE_BOX_IMPLEMENTATION.md`*
*For admin configuration, see `http://localhost:3001/admin/cec-devices`*
