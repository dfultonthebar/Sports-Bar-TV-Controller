# Device Status Quick Reference

**Print and laminate - keep at the bar!**

---

## Status Indicator Colors

### Device Status

```
🟢 GREEN (Online)
   ├─ Device is working normally
   ├─ Connected to network
   ├─ Ready for commands
   └─ No action needed

🔴 RED (Offline)
   ├─ Device not responding
   ├─ May be powered off
   ├─ May be disconnected
   └─ CHECK AND RECONNECT

🟡 YELLOW (Warning)
   ├─ Device working but has issues
   ├─ Intermittent connection
   ├─ Performance degraded
   └─ MONITOR CLOSELY

🔵 BLUE (Selected)
   ├─ Device currently selected
   ├─ Ready for control
   ├─ Click to open remote
   └─ Normal indicator

⚪ GRAY (Disabled/Unknown)
   ├─ Device not configured
   ├─ Status unknown
   ├─ May need setup
   └─ CONTACT ADMIN
```

---

## Status Messages

### Fire TV Status

| Message | Meaning | Action |
|---------|---------|--------|
| **"Connected"** | ✅ Working normally | No action |
| **"Connecting..."** | ⏳ Establishing connection | Wait 10 seconds |
| **"Offline"** | ❌ Not responding | Reconnect or restart |
| **"Unauthorized"** | 🔒 Authorization needed | Accept prompt on TV |
| **"Connection Refused"** | ❌ ADB not enabled | Check Fire TV settings |
| **"Host Unreachable"** | ❌ Network issue | Check WiFi/network |

### Cable Box Status (IR)

| Message | Meaning | Action |
|---------|---------|--------|
| **"Ready"** | ✅ IR emitter working | No action |
| **"Command Sent"** | ✅ IR signal transmitted | Wait for response |
| **"Command Failed"** | ❌ No response | Check emitter position |
| **"iTach Offline"** | ❌ IR blaster offline | Check iTach connection |
| **"Timeout"** | ⏱️ No confirmation | Try again |

### DirecTV Status

| Message | Meaning | Action |
|---------|---------|--------|
| **"Online"** | ✅ Receiver responding | No action |
| **"Offline"** | ❌ Not responding | Check power/network |
| **"External Access Disabled"** | ❌ Feature turned off | Enable in DirecTV settings |
| **"Connection Timeout"** | ⏱️ Slow response | Check network |

### Audio Processor Status

| Message | Meaning | Action |
|---------|---------|--------|
| **"Connected"** | ✅ Processor online | No action |
| **"Offline"** | ❌ Not responding | Check power/network |
| **"Zone Muted"** | 🔇 Zone audio off | Unmute if needed |
| **"Processing"** | ⏳ Command executing | Wait |

---

## Visual Status Guide

### TV Card Display

```
┌─────────────────────────┐
│  TV 1 - Main Bar        │  ← TV name/location
│  🟢 Online              │  ← Status indicator
│  ESPN (206)             │  ← Current channel
│  🔊 Volume: 65%         │  ← Volume level
│  📺 Cable Box           │  ← Device type
│  [Control]              │  ← Action button
└─────────────────────────┘
```

### Dashboard Icons

| Icon | Meaning |
|------|---------|
| 📺 | Cable Box (TV source) |
| 🔥 | Fire TV (streaming) |
| 📡 | DirecTV (satellite) |
| 🔊 | Audio zone |
| 🎛️ | Matrix output |
| ⚙️ | System component |

### Activity Indicators

| Indicator | Meaning |
|-----------|---------|
| 🔄 | Loading/processing |
| ✅ | Success/completed |
| ❌ | Error/failed |
| ⚠️ | Warning |
| 🔴 LIVE | Live game/event |
| ⏰ | Scheduled event |

---

## Troubleshooting by Status

### 🔴 Red/Offline Status

**Quick Checks:**
1. ☐ Is device powered on?
2. ☐ Is network cable connected?
3. ☐ Can you ping device IP?
4. ☐ Try "Reconnect" button
5. ☐ Physical restart device

**Fire TV Specific:**
- Check Fire TV is on WiFi
- Check ADB debugging enabled
- Accept authorization on TV screen

**Cable Box Specific:**
- Check IR emitter positioned correctly
- Check iTach powered on and online
- Verify cable box has power

**DirecTV Specific:**
- Check "External Access" enabled
- Verify IP address correct
- Check receiver powered on

### 🟡 Yellow/Warning Status

**Possible Causes:**
- Intermittent network connection
- High latency
- Packet loss
- Overloaded device
- Configuration issue

**Action:**
- Monitor device performance
- May work but slower than normal
- Document if persistent
- Contact admin if worsens

### ⚪ Gray/Unknown Status

**Meaning:**
- Device not configured
- First time setup needed
- Status unknown
- Database issue

**Action:**
- Check admin panel
- Device may need configuration
- Contact system admin

---

## Game Status Indicators

### Live Games

```
🔴 LIVE   Game is happening now
⏰        Game starts soon (< 30 min)
📺        Game on this channel
✓         Game finished
```

### Game Time Display

```
7:30 PM ET    Eastern Time
7:00 PM       Local time (adjusted)
LIVE          Currently playing
FINAL         Game ended
Halftime      In halftime/intermission
```

---

## Audio Status

### Zone Status

| Status | Icon | Meaning |
|--------|------|---------|
| **Active** | 🔊 | Audio playing |
| **Muted** | 🔇 | Audio muted |
| **Low** | 🔉 | Volume < 30% |
| **High** | 🔊 | Volume > 70% |
| **Offline** | ❌ | Zone offline |

### Volume Levels

```
0-20%     🔈  Very quiet
21-40%    🔉  Quiet
41-60%    🔊  Normal
61-80%    🔊🔊  Loud
81-100%   🔊🔊🔊  Very loud (use caution)
```

### Audio Source

```
TV 1 Audio → Bar is hearing TV 1
Music → Soundtrack playing
Muted → No audio
Mixed → Multiple sources
```

---

## System Health Status

### Overall System Health

```
✅ All Systems Operational
   └─ 100% uptime, no issues

⚠️ Minor Issues Detected
   └─ Some non-critical problems

❌ Critical Issues
   └─ System degraded, action needed

🔧 Maintenance Mode
   └─ System updating or in maintenance
```

### Component Health

| Component | Status | Action if Red |
|-----------|--------|---------------|
| **Database** | 🟢/🔴 | Contact admin immediately |
| **PM2 Process** | 🟢/🔴 | Contact admin immediately |
| **Network** | 🟢/🟡/🔴 | Check connections |
| **Disk Space** | 🟢/🟡/🔴 | Contact admin if yellow/red |
| **Memory** | 🟢/🟡/🔴 | Normal if green, admin if red |

---

## Error Message Guide

### Common Error Messages

| Error | Severity | Action |
|-------|----------|--------|
| **"Connection refused"** | 🔴 High | Device off or misconfigured |
| **"Network unreachable"** | 🔴 High | Network issue |
| **"Timeout"** | 🟡 Medium | Retry, check network |
| **"Command failed"** | 🟡 Medium | Retry, check device |
| **"Unauthorized"** | 🟢 Low | Accept prompt (Fire TV) |
| **"Not found"** | 🟢 Low | Device not configured |
| **"Rate limited"** | 🟢 Low | Wait 10 sec, try again |

---

## When to Escalate

### 🟢 Green - No Action

**Status:** Everything working normally
**Your Action:** Continue normal operations

### 🟡 Yellow - Monitor

**Status:** Minor issues, still functional
**Your Action:**
- Note the issue
- Monitor for worsening
- Report to manager at shift end

### 🔴 Red - Take Action

**Status:** Device not working
**Your Action:**
1. Try quick fix (reconnect, restart)
2. Use physical remote as backup
3. Document issue
4. Report to manager

### ❌ Multiple Red - Escalate

**Status:** Multiple devices/system down
**Your Action:**
1. Contact manager immediately
2. Use all physical remotes
3. Don't try to fix during service
4. Document everything

---

## Quick Status Check Procedure

### Opening Shift Check (2 minutes)

```
☐ 1. Open dashboard
☐ 2. Count green vs red devices
☐ 3. All green? → Proceed normally
☐ 4. Some red? → Check those devices
☐ 5. Many red? → System issue, contact manager
```

### Mid-Shift Check (1 minute)

```
☐ 1. Quick glance at dashboard
☐ 2. Any new red/yellow?
☐ 3. Any error messages?
☐ 4. All good? → Continue
☐ 5. Issues? → Investigate or escalate
```

### End-of-Shift Check (1 minute)

```
☐ 1. Document any issues encountered
☐ 2. Note current system state
☐ 3. Report to next shift or manager
☐ 4. Log any recurring problems
```

---

## Status History & Logging

### Viewing Status History

**In System:**
1. Go to Admin → System Health
2. View device status over time
3. Check for patterns
4. Review recent issues

**Information Available:**
- When device went offline
- How long it was offline
- Error messages
- Recovery actions

---

## Best Practices

### Status Monitoring

**DO:**
- ✅ Check status at start of shift
- ✅ Glance at dashboard periodically
- ✅ Note any status changes
- ✅ Report persistent yellow/red status
- ✅ Document issues with timestamps

**DON'T:**
- ❌ Ignore red status
- ❌ Assume it will fix itself
- ❌ Troubleshoot during busy service
- ❌ Forget to inform next shift

### Using Physical Remotes

**When to switch to physical remotes:**
- Device shows red for > 5 minutes
- Multiple command failures
- System completely down
- Busy period (no time to troubleshoot)

**Remember:**
- Physical remotes are backup plan
- Always available and working
- Don't be afraid to use them
- Switch back to system when fixed

---

## Status Update Frequency

### How Often Status Updates

| Device Type | Update Frequency | Latency |
|-------------|------------------|---------|
| Fire TV | Every 60 seconds | ~1 sec |
| Cable Box (IR) | Per command | < 1 sec |
| DirecTV | Every 60 seconds | ~1 sec |
| Audio | Real-time | < 500ms |
| System | Every 30 seconds | N/A |

**Dashboard Refresh:**
- Auto-refreshes every 30 seconds
- Manual refresh: Pull down/F5
- Real-time updates for some components

---

## Printing & Distribution

**Recommended:**
1. Print this page in color
2. Laminate for durability
3. Post at bar station
4. Include in staff manual
5. Update quarterly or when system changes

**Training:**
- Review with new staff
- Quiz on status meanings
- Practice identifying issues
- Know escalation procedures

---

## Contact Info

```
Manager:      ____________________
Phone:        ____________________

System Admin: ____________________
Phone:        ____________________
On-Call:      ____________________
```

---

**Print Date: __________**
**Updated By: __________**

*For complete troubleshooting, see [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)*
*For training, see [Bartender Quick Start](BARTENDER_QUICK_START.md)*
