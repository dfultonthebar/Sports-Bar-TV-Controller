# Operations Playbook

**Last Updated:** November 6, 2025
**Version:** 1.0

**Purpose:** Daily operational procedures for sports bar staff

---

## Table of Contents

1. [Opening Procedures](#opening-procedures)
2. [Closing Procedures](#closing-procedures)
3. [Game Day Setup](#game-day-setup)
4. [Event Management](#event-management)
5. [Staff Handoff Procedures](#staff-handoff-procedures)
6. [Common Scenarios](#common-scenarios)
7. [Quality Checks](#quality-checks)

---

## Opening Procedures

### Standard Daily Opening (30 minutes before opening)

#### Step 1: System Check (5 minutes)

**Verify system is running:**
```bash
# Check from phone/tablet browser
# Navigate to: http://192.168.1.100:3001
# Should load dashboard immediately
```

**If system is down:**
1. Contact manager immediately
2. Use physical remotes as backup
3. Document the issue

#### Step 2: Power On All TVs (5-10 minutes)

**Method 1: Using the System (Preferred)**
1. Open the web interface on your device
2. Go to Home tab
3. For each TV showing "Offline" or powered off:
   - Tap the TV card
   - Tap the Power button on the remote
   - Wait for TV to power on (10-15 seconds)
   - Verify status shows "Online"

**Method 2: Bulk Power On (If Configured)**
1. Go to Admin → Quick Actions
2. Tap "Power On All TVs"
3. Wait 30 seconds
4. Verify all TVs are on from dashboard

**Method 3: Physical Remotes (Backup)**
- Use physical TV remotes if system unavailable
- Power on each TV manually

**Expected Result:**
- All TVs showing green "Online" status
- All TVs displaying video

#### Step 3: Set Default Channels (10 minutes)

**Game Day vs Regular Day:**

**Regular Day (No Major Games):**
1. Go to Guide tab
2. Select "Show Channel Guide"
3. Set main bar TVs:
   - TV 1-2: ESPN (206)
   - TV 3-4: FS1 (212) or ESPN2 (209)
   - TV 5-6: NBC Sports (220) or local news
   - Remaining TVs: Mix of sports channels

**Game Day (Multiple Games):**
- See [Game Day Setup](#game-day-setup) section below

**Using Channel Presets:**
1. Go to Guide tab
2. Select first TV/cable box from dropdown
3. Tap preset button (e.g., "ESPN")
4. Wait for confirmation
5. Repeat for each TV

**Verification:**
- Check each TV displays correct channel
- Volume levels appropriate (not muted)
- No "No Signal" messages

#### Step 4: Audio System Check (5 minutes)

**Verify Audio Zones:**
1. Go to Audio tab
2. For each zone (Main Bar, Dining, Patio):
   - Verify zone status is "Online"
   - Check volume level (50-60% typical)
   - Verify zone is not muted
   - Test audio playing

**Soundtrack Music (If Used):**
1. Go to Audio tab
2. Check "Now Playing" widget shows music
3. Verify correct playlist for time of day
4. Adjust volume if needed

**If No Audio:**
- Check audio processor status
- Verify source selection
- Check AtlasIED connection
- See Troubleshooting Guide

#### Step 5: Quick Functionality Test (5 minutes)

**Test Core Functions:**
1. Change one TV channel using preset
2. Adjust volume on one zone
3. Switch one TV input (cable to Fire TV and back)
4. Verify sports guide shows current games

**Document Any Issues:**
- Note which devices have problems
- Try quick fixes from Emergency Reference
- Report to manager if unresolved
- Prepare backup plan (physical remotes)

### Opening Checklist

Print and use this checklist:

```
DATE: __________  STAFF: __________  TIME: __________

□ System web interface accessible
□ All TVs powered on and online
□ Default channels set on all TVs
□ Audio zones working and unmuted
□ Music playing (if applicable)
□ Channel presets tested
□ Volume control tested
□ Sports guide showing games
□ Any issues documented and reported
□ Physical remotes accessible (backup)

NOTES:
_________________________________________________
_________________________________________________
_________________________________________________

HANDOFF TO: __________  TIME: __________
```

---

## Closing Procedures

### Standard Daily Closing (15-20 minutes after last call)

#### Step 1: Power Off All TVs (10 minutes)

**Method 1: Using the System**
1. Go to Home tab
2. For each TV:
   - Tap TV card
   - Tap Power button
   - Wait for TV to power off
   - Verify status changes

**Method 2: Bulk Power Off (If Configured)**
1. Go to Admin → Quick Actions
2. Tap "Power Off All TVs"
3. Wait 60 seconds
4. Verify all TVs are off

**Method 3: Physical Power Off**
- Use TV physical remotes if needed
- Or use TV power buttons directly

**Verification:**
- All TV screens are black
- No blue indicator lights on TVs
- Dashboard shows all TVs offline (if system still running)

#### Step 2: Audio System Shutdown (5 minutes)

**Soundtrack Music:**
1. Go to Audio tab
2. Pause or stop music playback
3. Or let automatic schedule turn off

**Audio Zones:**
1. Mute all zones or set volume to minimum
2. Or use scheduled automation if configured

**Note:** Audio processor typically stays on 24/7

#### Step 3: Final System Check (2 minutes)

**Verify:**
- All TVs are off
- Audio is off or very low
- No error messages on dashboard
- All devices show expected status

**Document Issues:**
- Note any problems during shift
- Report to next shift or manager
- Update issue log if maintained

#### Step 4: Security Lockup (3 minutes)

**System Access:**
- Log out from any tablets/phones
- Or leave logged in if devices are secured
- Lock any physical devices (tablets) away

**Physical Security:**
- Secure physical remotes
- Lock IR equipment room (if separate)
- Ensure server room locked

### Closing Checklist

```
DATE: __________  STAFF: __________  TIME: __________

□ All TVs powered off
□ Audio zones muted or off
□ Music stopped (if applicable)
□ No error messages on dashboard
□ Any issues documented
□ System logged out (if required)
□ Physical remotes secured
□ Server room locked

ISSUES TO REPORT:
_________________________________________________
_________________________________________________
_________________________________________________

CLOSED BY: __________  TIME: __________
```

---

## Game Day Setup

### Planning Phase (2-3 hours before games)

#### Step 1: Check Game Schedule (15 minutes)

**Review upcoming games:**
1. Go to Guide tab → "Show Channel Guide"
2. Note all games in next 4 hours
3. Identify featured games:
   - Local teams
   - Playoffs/championships
   - High-profile matchups
   - Customer requests

**Create TV Assignment Plan:**

Example for NFL Sunday:
```
TV 1-4 (Main Bar): Featured games
  TV 1: Local team (Cowboys on FOX)
  TV 2: AFC featured game (CBS)
  TV 3: NFC featured game (FOX)
  TV 4: NFL RedZone

TV 5-8 (Dining): Secondary games
  TV 5-8: Regional games or alternates

TV 9-12 (Patio): Background/overflow
  TV 9-10: ESPN/highlights
  TV 11-12: RedZone or popular games
```

#### Step 2: Configure TVs (20-30 minutes)

**For Each Assigned TV:**

1. **Navigate to Guide:**
   - Go to Guide tab
   - Search for game by team name or channel

2. **Set Channel:**
   - Find game in list
   - Tap "Watch" button
   - Select TV from dropdown
   - Confirm channel set

3. **Verify:**
   - Check TV displays correct game
   - Verify game info shows on screen
   - Note start time

**Quick Channel Setting:**
If you know channel numbers:
1. Go to Guide tab
2. Select cable box/device
3. Tap channel preset
4. Much faster than searching

**Time Estimate:**
- 12 TVs × 2 minutes each = 24 minutes
- Plus 6 minutes buffer = 30 minutes total

#### Step 3: Audio Configuration (10 minutes)

**Decide Audio Strategy:**

**Option A: Single Game Audio (Most Common)**
- Route main game audio to all zones
- Customer can hear featured game everywhere

**Setup:**
1. Go to Audio tab
2. For each zone, select audio source:
   - "TV 1 Audio" (main game)
3. Set volume appropriate for zone
4. Test audio is correct game

**Option B: Zone-Specific Audio**
- Different audio in different areas
- Example: Bar has Game A, Dining has Game B

**Setup:**
1. Configure each zone separately
2. Main Bar → TV 1 audio
3. Dining → TV 5 audio
4. Patio → TV 9 audio or music

**Option C: Music + Game Audio**
- Music during pre-game
- Switch to game audio at kickoff
- Use scheduled switching if configured

#### Step 4: Pre-Game Verification (10 minutes)

**30 Minutes Before First Kickoff:**

**Visual Check:**
- Walk through venue
- Verify each TV shows correct game/channel
- Check for any "No Signal" messages
- Verify picture quality

**Audio Check:**
- Verify correct audio in each zone
- Check volume levels appropriate
- Test that you can hear play-by-play clearly
- Adjust as needed

**Backup Plan:**
- Note location of physical remotes
- Identify which channels on which cable boxes
- Have channel numbers written down
- Know who to call for technical issues

### During Games (Real-Time Management)

#### Managing Multiple Games

**As Games End:**
1. Check Guide for next games
2. Retune finished TVs to new games
3. Announce to customers if switching games

**Customer Requests:**
1. Check if game is available
2. Find available TV
3. Set TV to requested game
4. Inform customer which TV

**Quick Changes:**
- Use channel presets for speed
- Use "Watch" button from Guide
- Keep Guide tab open on your device

#### Common Game Day Issues

**Issue: "Can you put [Game] on?"**

**Solution:**
1. Search Guide for game
2. Check if on available channel
3. Find unused TV or ask if you can switch one
4. Set TV to that channel
5. Point customer to TV location

**Issue: Multiple customers want different games**

**Solution:**
1. Assign games by:
   - Customer count at specific location
   - Importance of game (local team priority)
   - Time sensitivity (live vs replay)
2. Use multiple TVs if possible
3. Rotate games if necessary

**Issue: Wrong game on TV**

**Solution:**
1. Re-check Guide for correct channel
2. Verify cable box is responding
3. Manually tune to channel
4. If wrong game showing, may be channel mapping issue

**Issue: Game audio not synced**

**Solution:**
1. Check audio source selection
2. Verify TV audio output settings
3. Check for audio delay settings
4. May need to adjust manually

### Post-Game (After Last Game)

**Cleanup:**
1. Return TVs to default channels
2. Reset audio to normal configuration
3. Document any issues encountered
4. Update notes for next game day

---

## Event Management

### Special Events (Playoffs, Championship, UFC/Boxing)

#### Pre-Event Planning (1 week before)

**Coordination:**
1. Confirm event date and time
2. Verify channel carrying event
3. Check if PPV or special access needed
4. Plan TV and audio configuration
5. Test setup day before event

#### Event Day Setup

**Earlier Setup Time:**
- Start 4 hours before event
- Test thoroughly
- Have backup plan ready

**Primary Display:**
1. Identify best viewing TV (largest, best position)
2. Ensure reliable connection
3. Test video quality
4. Route audio to all zones

**All Other TVs:**
1. Set to same event or related content
2. Or set to pre-game shows
3. Mute or low volume on secondary TVs

**Audio Focus:**
- Route main TV audio to all zones
- Volume higher than normal
- Test audio quality
- Have volume control easily accessible

#### During Event

**Critical Period:**
- Main event time is NOT time for troubleshooting
- Any issues = immediate fallback to backup
- Physical remote backup ready

**Monitoring:**
- Watch for signal drops
- Monitor audio quality
- Be ready to switch sources if needed

**Customer Service:**
- Volume adjustment requests common
- May need to balance multiple zone volumes
- Coordinate with manager on volume policy

### Private Events/Watch Parties

#### Custom Configuration

**Pre-Event:**
1. Meet with event organizer
2. Understand their preferences:
   - Which game(s) to show
   - Audio preferences
   - TV allocation
3. Test configuration before event

**During Event:**
1. Set all TVs per plan
2. Lock configuration (prevent changes)
3. Control audio as requested
4. Point person assigned to tech

**Post-Event:**
1. Return to normal configuration
2. Document what worked well
3. Note for future events

---

## Staff Handoff Procedures

### Shift Change (5-10 minutes)

#### Outgoing Staff Responsibilities

**System Status Brief:**
```
Current system status: [Online/Issues]
TVs currently powered: [All/Specific ones]
Any current problems: [List issues]
Current audio setup: [Description]
Special requests: [Any customer requests]
```

**Document Handoff:**
1. Fill out handoff form (below)
2. Show incoming staff any issues
3. Point out any special configurations
4. Share backup plan if system issues

**Walk-Through:**
- Show incoming staff current TV setup
- Explain any custom configurations
- Point out any customers with special requests

#### Incoming Staff Responsibilities

**Verify Handoff:**
1. Review handoff form
2. Ask questions about any issues
3. Test basic functions
4. Confirm understanding

**Initial Check:**
1. View dashboard
2. Verify all expected devices online
3. Note any warnings
4. Prepare to handle any issues

### Handoff Form Template

```
SHIFT HANDOFF - [DATE] [TIME]

OUTGOING: __________  INCOMING: __________

SYSTEM STATUS:
□ Online, no issues
□ Online with issues (describe below)
□ Offline (describe below)

TV STATUS:
□ All TVs on and working
□ Some TVs off: _____________________________
□ TV issues: ________________________________

AUDIO STATUS:
□ Normal audio configuration
□ Special audio setup: ______________________
□ Audio issues: _____________________________

CURRENT GAMES/EVENTS:
_________________________________________________
_________________________________________________

CUSTOMER REQUESTS:
_________________________________________________
_________________________________________________

ONGOING ISSUES:
_________________________________________________
_________________________________________________

NOTES FOR NEXT SHIFT:
_________________________________________________
_________________________________________________

HANDOFF COMPLETED:
Outgoing signature: __________  Time: __________
Incoming signature: __________  Time: __________
```

---

## Common Scenarios

### Scenario 1: Customer Can't Hear Audio

**Situation:**
"I can't hear the game on TV 3"

**Response:**
1. Check if TV 3 audio is routed to that zone
2. Check zone volume level
3. Check zone is not muted
4. Verify correct audio source selected
5. If needed, adjust audio routing

**Prevention:**
- Document audio routing at start of shift
- Keep audio control accessible
- Test audio in all zones regularly

### Scenario 2: Urgent Channel Change Request

**Situation:**
"Breaking news! Can you put CNN on TV 5?"

**Response:**
1. Note what's currently on TV 5
2. Ask if anyone watching that TV objects
3. Find CNN channel number (preset or search)
4. Change TV 5 to CNN
5. Verify customer satisfied

**Time:** < 60 seconds

### Scenario 3: System Unresponsive During Rush

**Situation:**
Can't control TVs via system during busy period

**Response:**
1. Don't troubleshoot during rush
2. Use physical remotes immediately
3. Note issue for after rush
4. Inform manager
5. After rush, check system status

**Key Principle:**
Physical remotes are backup - use them when needed!

### Scenario 4: Game on Wrong TV

**Situation:**
Cowboys game should be on TV 1 but showing Jets game

**Response:**
1. Check Guide for correct channel
2. Verify cable box is correct one
3. Check channel mapping
4. Manually retune to correct channel
5. If persistent, may be channel lineup issue

### Scenario 5: All TVs Show "No Signal"

**Situation:**
Multiple or all TVs showing "No Signal"

**Response:**
1. Check if cable/satellite service down
2. Check HDMI matrix status (if used)
3. Check cable boxes powered on
4. Contact system admin immediately
5. Use backup cable/antenna if available

---

## Quality Checks

### Daily Quality Checks

**Morning Check (During Opening):**
- All TVs powered on successfully
- All channels set correctly
- Audio working in all zones
- No error messages

**Mid-Shift Check (Every 2 hours):**
- Verify no TVs showing "No Signal"
- Check for any error messages
- Verify audio still working
- Check system still responsive

**Closing Check:**
- All TVs powered off successfully
- Audio off or low
- System in good state for next shift
- Any issues documented

### Weekly Quality Checks

**Comprehensive Test (Slow Day):**
1. Test all channel presets
2. Test all TV power controls
3. Test audio zone switching
4. Test Guide search function
5. Test Fire TV controls (if used)
6. Test volume controls

**Report Results:**
- Note any functions not working
- Report to manager
- Schedule maintenance if needed

### Monthly Review

**Performance Review:**
1. Review issue log for patterns
2. Identify recurring problems
3. Schedule training for problem areas
4. Update procedures if needed

**Staff Feedback:**
1. Ask staff about pain points
2. Gather suggestions for improvement
3. Update procedures based on feedback
4. Share improvements with all staff

---

## Best Practices

### General Operations

1. **Start Early:** Begin setup before customers arrive
2. **Test Everything:** Don't assume it works
3. **Have Backup Plan:** Physical remotes ready
4. **Document Issues:** Write down problems
5. **Communicate:** Tell incoming shift about issues

### Customer Service

1. **Be Proactive:** Set up games before customers ask
2. **Be Responsive:** Quick channel changes appreciated
3. **Set Expectations:** Tell customers if game not available
4. **Offer Alternatives:** Suggest different TV or time

### System Management

1. **Don't Over-Complicate:** Simple is better
2. **Use Presets:** Faster than searching
3. **Learn Patterns:** Common channels, common issues
4. **Stay Calm:** System issues happen, have backup
5. **Ask for Help:** Don't struggle alone

---

## Training & Improvement

### New Staff Training

**Week 1: Shadow Experienced Staff**
- Watch opening/closing procedures
- Observe game day setup
- Learn system basics
- Practice with supervision

**Week 2: Assisted Operation**
- Perform procedures with help
- Handle simple tasks
- Learn troubleshooting
- Build confidence

**Week 3: Independent Operation**
- Perform procedures alone
- Handle most situations
- Know when to ask for help
- Ready for solo shifts

### Ongoing Improvement

**Monthly Staff Meeting:**
- Review operations procedures
- Share tips and tricks
- Address common issues
- Update procedures

**Continuous Learning:**
- Learn new features
- Practice troubleshooting
- Improve efficiency
- Share knowledge

---

## Emergency Procedures

### See Also

For emergency technical procedures, see:
- [Emergency Quick Reference](EMERGENCY_QUICK_REFERENCE.md)
- [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)

### Staff Emergency Procedures

**System Completely Down:**
1. Inform manager immediately
2. Use physical remotes for all TVs
3. Control volume from TV remotes
4. Document time and symptoms
5. Don't attempt technical fixes

**Power Outage:**
1. Wait for power restoration
2. Once power back, verify TVs turn on
3. Check if system auto-recovers
4. If not, contact manager/admin
5. Use physical remotes until system recovered

**Customer Injury/Emergency:**
1. Call manager immediately
2. Call 911 if needed
3. System operation secondary to safety

---

## Appendix: Quick Reference

### Common Channel Numbers (Spectrum Example)

| Channel | Number | Type |
|---------|--------|------|
| ESPN | 206 | Sports |
| ESPN2 | 209 | Sports |
| FS1 | 212 | Sports |
| FS2 | 618 | Sports |
| NBC Sports | 220 | Sports |
| CBS Sports | 221 | Sports |
| NFL Network | 212 | Sports |
| NBA TV | 302 | Sports |
| MLB Network | 304 | Sports |

*Numbers vary by provider - update for your location*

### System URLs

```
Main System: http://192.168.1.100:3001
  (Update with your server IP)

Sections:
  Home: /
  Guide: /guide
  Audio: /audio
  Matrix: /matrix
  Admin: /admin
```

### Contact Info Template

```
Manager: __________________ Phone: ______________
System Admin: _____________ Phone: ______________
Cable Provider: ___________ Phone: ______________
Hardware Vendor: __________ Phone: ______________
```

---

**End of Operations Playbook**

*For technical troubleshooting, see [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)*
*For bartender training, see [Bartender Quick Start](BARTENDER_QUICK_START.md)*
*For emergency procedures, see [Emergency Quick Reference](EMERGENCY_QUICK_REFERENCE.md)*
