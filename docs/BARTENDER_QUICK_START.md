# Bartender Quick Start Guide

**Last Updated:** November 6, 2025
**Version:** 2.0

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Basic TV Control](#basic-tv-control)
4. [Changing Channels](#changing-channels)
5. [Using the Sports Guide](#using-the-sports-guide)
6. [Audio Control](#audio-control)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)
9. [Quick Reference](#quick-reference)

---

## Overview

The Sports Bar TV Controller gives you complete control over all TVs, audio zones, and streaming devices from any device with a web browser - no physical remotes needed!

### What You Can Do

- Control 25+ TVs from your phone, tablet, or computer
- Change channels with one tap using presets (ESPN, FS1, NBA TV, etc.)
- Find and watch any game from the sports guide
- Control volume and audio zones
- Switch between cable, streaming services, and DirecTV
- Power TVs on/off
- Route video sources to any TV

### Accessing the System

**Local Network (On-Premises):**
```
http://192.168.1.100:3001
```
*Replace with your server's actual IP address*

**From Behind the Bar:**
- Bookmark the URL on your phone/tablet
- Add to home screen for app-like experience

---

## Getting Started

### First Time Access

1. Open your web browser (Chrome, Safari, Firefox, etc.)
2. Navigate to the system URL (check with manager)
3. You'll see the main dashboard with all TVs displayed

### Navigation

The app has a bottom navigation bar with these sections:

| Tab | Purpose |
|-----|---------|
| **Home** | Main dashboard with TV grid |
| **Guide** | Sports guide and channel presets |
| **Matrix** | Advanced HDMI routing controls |
| **Audio** | Audio zone and music controls |
| **Admin** | System administration (managers only) |

### Understanding the TV Grid

The home screen shows all your TVs in a grid layout:

```
┌─────────────┬─────────────┬─────────────┐
│ TV 1        │ TV 2        │ TV 3        │
│ Main Bar    │ Dining      │ Patio       │
│ 🟢 Online   │ 🟢 Online   │ 🔴 Offline  │
│ ESPN (206)  │ FS1 (212)   │ (No Signal) │
│ [Control]   │ [Control]   │ [Control]   │
└─────────────┴─────────────┴─────────────┘
```

**Status Indicators:**
- 🟢 **Green** = TV is online and working
- 🔴 **Red** = TV is offline or has issues
- 🟡 **Yellow** = TV has a warning

---

## Basic TV Control

### Controlling a Single TV

1. **Select a TV** - Tap on any TV card in the grid
2. **Remote Opens** - A full remote control appears
3. **Choose Action:**
   - Power on/off
   - Change volume
   - Switch input source
   - Navigate menus

### Remote Control Features

The universal remote includes:

**Power & Volume:**
- Power button (top-right)
- Volume up/down
- Mute/unmute

**Navigation:**
- Directional pad (up/down/left/right)
- OK/Select button
- Back/Return button

**Quick Actions:**
- Home button
- Menu button
- Guide button
- Info button

**Device-Specific:**
- Fire TV: App launcher, voice search
- DirecTV: Channel guide, DVR controls
- Cable Box: Number pad for direct channel entry

---

## Changing Channels

### Method 1: Channel Presets (Fastest)

Channel presets give you one-tap access to popular sports channels.

**Steps:**
1. Tap the **"Guide"** tab at the bottom
2. Select which cable box/TV to control (if multiple)
3. Scroll to **Channel Presets** section
4. Tap any preset button

**Common Presets:**

| Preset | Channel | Content |
|--------|---------|---------|
| ESPN | 206 | Live sports, highlights |
| ESPN2 | 209 | Alternate sports coverage |
| FS1 | 212 | Fox Sports games |
| FS2 | 618 | Fox Sports overflow |
| NBC Sports | 220 | NHL, Premier League |
| CBS Sports | 221 | College sports, NFL |
| TNT | 245 | NBA playoffs |
| NFL Network | 212 | Football coverage |
| NBA TV | 302 | Basketball games |
| MLB Network | 304 | Baseball games |

**Tips:**
- Presets are faster than typing channel numbers
- Common sports channels are at the top
- Tap once and wait for confirmation message

### Method 2: Sports Guide (For Specific Games)

See [Using the Sports Guide](#using-the-sports-guide) section below.

### Method 3: Manual Channel Entry

For channels without presets:

1. Open the **cable box remote** (from TV control)
2. Use the **number pad** to enter channel number
3. Press **Enter** or **OK**

Example: For channel 527:
- Tap "5"
- Tap "2"
- Tap "7"
- Tap "Enter"

---

## Using the Sports Guide

The sports guide shows live and upcoming games from all major leagues (NFL, NBA, NHL, MLB, NCAA, MLS, EPL, etc.).

### Finding a Game

1. Tap the **"Guide"** tab
2. Tap **"Show Channel Guide"** button
3. Browse the list of games

**Each game shows:**
- League and sport icon (🏈 🏀 ⚾ 🏒)
- Team names
- Start time
- Channel name and number
- 🔴 **LIVE** badge for active games

### Watching a Game

**Quick Method:**
1. Find the game you want
2. Tap the **"Watch"** button next to it
3. Select which TV/cable box to tune
4. Done! The channel changes automatically

**What Happens:**
- System looks up the channel number
- Sends tune command to cable box or streaming device
- Shows "Now watching: [Game]" confirmation
- Updates TV status

### Filtering Games

Use the search box to narrow down the list:

- Type a team name: "Lakers", "Cowboys", "Red Sox"
- Type a league: "NFL", "NBA", "NHL"
- Type a channel: "ESPN", "FOX"
- Results filter as you type

### Game Details

Tap on any game card to see:
- Full team names and records
- Betting odds (if available)
- TV coverage details
- Start time in your timezone

---

## Audio Control

### Volume Control

**Individual TV Volume:**
1. Select a TV from the grid
2. Use volume up/down buttons on remote
3. Or use volume slider

**Zone Volume (AtlasIED System):**
1. Tap **"Audio"** tab
2. Select zone (Bar, Dining, Patio, etc.)
3. Adjust zone volume with slider
4. Mute/unmute entire zone

### Music Control (Soundtrack)

If your venue uses Soundtrack Your Brand:

1. Tap **"Audio"** tab
2. See **Now Playing** widget
3. Controls available:
   - Play/Pause
   - Next track
   - View playlist
   - Schedule controls

### Setting Audio for Events

For big games, you may want audio from one TV through all speakers:

1. Identify which TV has the main game
2. Go to **Audio** → **Zones**
3. Select zone
4. Choose audio source (e.g., "TV 1 - Main Bar")
5. Adjust volume as needed

---

## Common Tasks

### Task: Set Up All TVs for Game Day

**Scenario:** Sunday NFL games, need multiple games on different TVs

**Steps:**
1. Go to **"Guide"** tab
2. Check which games are available
3. For each game:
   - Tap **"Watch"**
   - Select which TV (TV 1, TV 2, etc.)
   - Confirm channel changed
4. Repeat for all TVs
5. Verify each TV from home screen

**Time:** ~2 minutes to set up 6+ TVs

### Task: Switch Between Cable and Streaming

**Scenario:** Switch TV 1 from cable (ESPN) to Fire TV (Prime Video)

**Steps:**
1. Select **TV 1** from home screen
2. Tap **"Switch Input"** button
3. Choose **"Fire TV"** from list
4. TV switches input automatically
5. Use Fire TV remote to launch app

**Alternative Method (Matrix Routing):**
1. Go to **"Matrix"** tab
2. Find TV 1 output
3. Select different input source
4. Apply routing

### Task: Find and Watch a Specific Game

**Scenario:** Customer asks for the Lakers game

**Steps:**
1. Tap **"Guide"** tab
2. Type "Lakers" in search box
3. Find the Lakers game
4. Tap **"Watch"** button
5. Select which TV to use
6. Confirm it's playing

**Time:** ~15 seconds

### Task: Power On All TVs

**Scenario:** Opening time, need to turn on all TVs

**Option 1 - Individual:**
1. Go to home screen
2. Tap each TV card
3. Tap power button on remote
4. Repeat for each TV

**Option 2 - Bulk (if configured):**
1. Go to **Admin** → **Quick Actions**
2. Tap **"Power On All TVs"**
3. Wait for confirmation
4. Verify from home screen

### Task: Troubleshoot a Non-Responsive TV

**Scenario:** TV 3 shows offline or not responding

**Steps:**
1. Check TV card status on home screen
2. Note the error message
3. Tap **"View Details"**
4. Try **"Test Connection"**
5. If still offline, see [Troubleshooting](#troubleshooting)

---

## Troubleshooting

### TV Shows Offline

**Symptoms:**
- Red status indicator
- "Offline" or "Unreachable" message

**Solutions:**
1. Check if TV is powered on
2. Verify network connection (for smart TVs/Fire TV)
3. Check cables (HDMI, power)
4. Try **"Reconnect"** button in TV details
5. Restart the device from admin panel

**For Fire TV Devices:**
- Go to **Admin** → **Fire TV Devices**
- Find the device
- Tap **"Restart ADB"**
- Wait 30 seconds
- Check if back online

### Channel Change Failed

**Symptoms:**
- Error message: "Failed to change channel"
- TV doesn't respond to preset buttons

**Solutions:**

**For IR Devices (Cable Boxes):**
1. Check IR emitter is in place
2. Verify cable box is powered on
3. Try the channel change again
4. Check IR emitter placement (see IR_EMITTER_PLACEMENT_GUIDE.md)

**For CEC Devices:**
1. Check CEC adapter is connected
2. Verify device is online in admin panel
3. Test CEC connection
4. Try alternative control method (IR)

**For Streaming Devices:**
1. Verify device is online
2. Check network connection
3. Restart device if needed

### No Audio

**Symptoms:**
- Video playing but no sound
- Volume changes don't work

**Solutions:**
1. Check TV isn't muted (look for mute icon)
2. Verify audio zone isn't muted
3. Check volume level (try increasing)
4. Verify correct audio source is selected
5. Check physical connections

**For AtlasIED Zones:**
1. Go to **Audio** → **Zones**
2. Check zone status
3. Verify source is selected
4. Test with audio level adjustment
5. Check processor connection (admin)

### Sports Guide Empty

**Symptoms:**
- No games showing in sports guide
- "No games found" message

**Solutions:**
1. Check internet connection
2. Try refreshing the page (pull down)
3. Verify date/time filters aren't too restrictive
4. Check with manager if API keys are configured

### Wrong Channel Changes

**Symptoms:**
- Different TV changes channel than expected
- Multiple TVs respond to one command

**Solutions:**
1. Verify you selected the correct cable box/TV
2. Check device mappings in admin panel
3. For IR devices, check emitter placement
4. Verify there's no IR interference between devices

---

## Quick Reference

### Most Common Operations

**Change Channel (Preset):**
1. Guide tab → Select device → Tap preset
2. Time: ~5 seconds

**Change Channel (Specific Game):**
1. Guide tab → Show Channel Guide → Find game → Watch
2. Time: ~15 seconds

**Control Volume:**
1. Select TV → Remote → Volume buttons
2. Time: ~3 seconds

**Switch Input:**
1. Select TV → Switch Input → Choose source
2. Time: ~10 seconds

**Power On/Off:**
1. Select TV → Remote → Power button
2. Time: ~5 seconds

### Status Indicators Reference

| Indicator | Meaning |
|-----------|---------|
| 🟢 Green | Device online and working |
| 🔴 Red | Device offline or error |
| 🟡 Yellow | Device has warning |
| 🔵 Blue | Device selected/active |
| 🔴 LIVE | Game is currently in progress |
| ⏰ | Game starting soon |
| 📺 | Channel information |

### Channel Numbers Quick Reference

**Spectrum Cable (Example - may vary by location):**

| Channel | Number | Type |
|---------|--------|------|
| ESPN | 206 | Sports |
| ESPN2 | 209 | Sports |
| ESPNU | 208 | College |
| FS1 | 212 | Sports |
| FS2 | 618 | Sports |
| NBC Sports | 220 | Sports |
| CBS Sports | 221 | Sports |
| TNT | 245 | Sports/Entertainment |
| TBS | 247 | Sports/Entertainment |
| NFL Network | 212 | Football |
| NBA TV | 302 | Basketball |
| NHL Network | 303 | Hockey |
| MLB Network | 304 | Baseball |
| Golf Channel | 218 | Golf |

*Channel numbers vary by cable provider - confirm with your system*

### Common Keyboard Shortcuts

When using from a computer:

| Shortcut | Action |
|----------|--------|
| `Ctrl + H` | Go to Home |
| `Ctrl + G` | Go to Guide |
| `Ctrl + M` | Go to Matrix |
| `Ctrl + A` | Go to Audio |
| `Ctrl + R` | Refresh current page |
| `Escape` | Close current dialog/remote |

### Emergency Contacts

```
Manager: _________________________________
Phone:   _________________________________

System Admin: ____________________________
Phone:        ____________________________

If system is completely down:
1. Check with manager
2. Use physical remotes as backup
3. Contact system admin
```

---

## Tips for Efficient Operation

### Best Practices

1. **Bookmark the URL** - Add to your phone's home screen
2. **Use Presets** - Faster than manual channel entry
3. **Check Status First** - Verify device is online before commanding
4. **One Action at a Time** - Wait for confirmation before next command
5. **Learn the Layout** - Memorize which TV is which location

### During Peak Hours

**Before Rush:**
- Set up TVs for scheduled games
- Test each TV is working
- Verify audio zones are configured
- Have backup plan (physical remotes accessible)

**During Service:**
- Keep the app open on your phone
- Quick changes from channel presets
- Use sports guide for customer requests
- Coordinate with other staff on TV assignments

### Multi-Game Events

**Example: Sunday NFL**

Planning strategy:
1. Review schedule before doors open
2. Assign primary game to main bar TVs
3. Assign local/popular teams to prominent locations
4. Use remaining TVs for RedZone/alternates
5. Adjust during games based on customer interest

**Quick Setup:**
- Main Bar TVs (1-4): NFL games
- Dining Room TVs (5-8): Mix of games
- Patio TVs (9-12): Background/RedZone
- Time to configure: ~3-5 minutes

---

## Training Checklist

### New Staff Onboarding

Before solo operation, staff should be able to:

- [ ] Access the system on phone/tablet
- [ ] Navigate between main tabs
- [ ] Find and identify TVs by location
- [ ] Change channel using presets
- [ ] Use sports guide to find a game
- [ ] Control TV volume
- [ ] Power a TV on/off
- [ ] Switch TV input sources
- [ ] Understand status indicators
- [ ] Know who to contact for help

### Practice Exercises

**Exercise 1:** Find and watch the Cowboys game
1. Open sports guide
2. Search for "Cowboys"
3. Select game
4. Choose TV
5. Verify channel changed

**Exercise 2:** Set up 3 TVs for different games
1. Identify games from sports guide
2. Assign games to specific TVs
3. Use presets or watch buttons
4. Verify all three TVs showing correct games

**Exercise 3:** Troubleshoot an offline TV
1. Identify offline TV
2. Check details
3. Attempt reconnection
4. Test basic functions
5. Escalate if needed

---

## Advanced Features

### Scene Automation (If Configured)

Some systems support pre-configured scenes:

- **"Game Day"** - All TVs to sports channels
- **"Happy Hour"** - Music on, select TVs on news
- **"Closing"** - All TVs off, audio zones off

**To Use:**
1. Go to **Admin** → **Scenes** (or Quick Actions)
2. Select desired scene
3. Confirm execution
4. Wait for completion

### Scheduling

Schedule automatic TV control:

**Use Cases:**
- Power on TVs at opening time
- Switch to specific channels for scheduled games
- Power off TVs at closing

**To Create Schedule:**
1. Go to **Admin** → **Scheduler**
2. Create new schedule
3. Set time and action
4. Save and enable

### Voice Control (Future Feature)

Some venues may add voice control:
- "Show Lakers game on TV 1"
- "Change all TVs to ESPN"
- "Turn up volume on main bar"

Check with manager if available.

---

## Support & Additional Resources

### Documentation

- **Full System Admin Guide:** SYSTEM_ADMIN_GUIDE.md
- **Troubleshooting Guide:** TROUBLESHOOTING_GUIDE.md
- **Device Configuration:** DEVICE_CONFIGURATION_GUIDE.md
- **Operations Playbook:** OPERATIONS_PLAYBOOK.md
- **FAQ:** FAQ.md

### Getting Help

**During Shift:**
1. Check this guide first
2. Ask manager or lead bartender
3. Try alternative methods (physical remote)
4. Document issue for admin

**Reporting Issues:**

When reporting problems, include:
- Which TV/device (name or number)
- What you were trying to do
- Exact error message
- What you've already tried
- When it started happening

**System Admin Contact:**
- Check printed emergency contact sheet
- Usually available during business hours
- For emergencies only outside business hours

---

## Frequently Asked Questions

### Can I control TVs from my personal phone?

Yes, as long as you're connected to the venue's WiFi network. Bookmark the URL for quick access.

### What if I make a mistake?

Don't worry! Most actions are reversible:
- Wrong channel? Just change it again
- Powered off by accident? Power back on
- Wrong TV? Control the correct one

### Do I need special permissions?

Basic bartender functions are available to all staff. Admin functions require manager access.

### Can two people control the same TV?

Yes, but the last command wins. Coordinate with other staff to avoid conflicts.

### What if the internet goes down?

- Local device control still works (Fire TV, cable boxes)
- Sports guide won't update (requires internet)
- Music streaming won't work (requires internet)
- Use physical remotes if needed

### How often does the sports guide update?

- Games refresh every 5 minutes
- Live scores update in real-time
- Schedule data updates hourly

---

**End of Quick Start Guide**

**Quick Training Summary:** With 15-30 minutes of hands-on practice, most bartenders can confidently operate the core features. Focus on channel presets and sports guide first - these handle 90% of daily needs.

*For technical setup and configuration, see the System Admin Guide.*
*For detailed troubleshooting, see the Troubleshooting Guide.*
