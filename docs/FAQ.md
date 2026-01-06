# Frequently Asked Questions (FAQ)

**Last Updated:** November 6, 2025

Quick answers to common questions about the Sports Bar TV Controller system.

---

## General Questions

### What is this system?

The Sports Bar TV Controller is a web-based system that lets you control all your venue's TVs, audio zones, and streaming devices from any phone, tablet, or computer. No physical remotes needed for daily operations.

### Who can use it?

- **Bartenders/Staff:** Basic TV and audio control
- **Managers:** Full system configuration
- **Admins:** Technical setup and maintenance

### Do I need to install an app?

No! It works in your web browser. Just bookmark the URL or add it to your home screen for quick access.

### What if my phone dies or I forget my device?

Any device with a web browser can access the system. Use a tablet at the bar, a computer in the office, or another staff member's phone.

---

## Access & Login

### How do I access the system?

Navigate to your system URL in any web browser:
```
http://[your-server-ip]:3001
```

Your manager will provide the exact URL.

### Do I need a password?

The system uses PIN-based authentication for admins. Bartender access may not require a PIN depending on your configuration.

### Can I use it from home?

Only if you're connected to the venue's WiFi network. The system is not accessible from the internet for security reasons.

### I forgot the admin PIN, how do I reset it?

Contact your system administrator. They can reset PINs via the database or admin panel.

---

## Daily Operations

### How do I change a TV channel?

**Method 1 (Fastest):**
1. Go to "Guide" tab
2. Select the device/TV
3. Tap a channel preset button

**Method 2:**
1. Go to "Guide" tab
2. Tap "Show Channel Guide"
3. Find the game you want
4. Tap "Watch" button
5. Select which TV

**Method 3:**
1. Select TV from home screen
2. Use remote control that appears
3. Enter channel number manually

### How do I find a specific game?

1. Go to "Guide" tab
2. Tap "Show Channel Guide"
3. Type team name, league, or channel in search box
4. Games filter as you type
5. Tap "Watch" on desired game

### How do I control volume?

**Individual TV:**
1. Select TV from home screen
2. Use volume buttons on remote

**Audio Zone:**
1. Go to "Audio" tab
2. Select the zone
3. Use volume slider

### How do I turn TVs on or off?

**Individual TV:**
1. Select TV from home screen
2. Tap power button on remote

**All TVs (if configured):**
1. Go to Admin → Quick Actions
2. Tap "Power On All" or "Power Off All"

---

## Troubleshooting

### Why is a TV showing "Offline"?

**Possible causes:**
- TV is powered off
- Device is disconnected from network
- Cable box is off
- Fire TV needs reconnecting

**Try:**
1. Click the TV card
2. Click "Test Connection" or "Reconnect"
3. If still offline, check physical power/cables
4. See [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)

### Why won't the channel change?

**For IR Cable Boxes:**
- IR emitter may be misaligned
- See [IR Emitter Placement Guide](IR_EMITTER_PLACEMENT_GUIDE.md)
- Cable box may be off or frozen

**For All Devices:**
- Check device is "Online" in dashboard
- Try the command again (may have timed out)
- Use physical remote as backup

**See:** [Troubleshooting Guide - Channel Change Failed](TROUBLESHOOTING_GUIDE.md#channel-change-failed)

### Why is there no audio?

**Check:**
1. TV not muted (look for mute icon)
2. Zone not muted (check Audio tab)
3. Volume level not at zero
4. Correct audio source selected

**See:** [Troubleshooting Guide - No Audio](TROUBLESHOOTING_GUIDE.md#no-audio-from-tvs)

### What if the system is down?

**Immediate action:**
1. Use physical remotes (backup)
2. Contact manager/system admin
3. Document when it went down

**Don't:**
- Try to fix technical issues during service
- Restart servers or equipment without authorization

**See:** [Emergency Quick Reference](EMERGENCY_QUICK_REFERENCE.md)

### What if the internet goes down?

**Good news:**
- Local TV control still works (Fire TV, cable boxes)
- Audio control still works
- HDMI matrix still works

**What stops working:**
- Sports guide updates (requires internet)
- Soundtrack music streaming (requires internet)
- Remote software updates

---

## Channel Presets

### What are channel presets?

Quick buttons that change to popular channels with one tap. Like speed dial for TV channels.

### Can I add my own presets?

Managers can add/edit presets via the admin panel. Request new presets from your manager.

### Why don't my presets work?

- Check the device is online
- Presets may be device-specific (different cable box)
- See [Channel Presets Troubleshooting](CHANNEL_PRESETS_TROUBLESHOOTING.md)

### Do channel numbers differ by cable provider?

Yes! ESPN might be channel 206 on Spectrum but channel 30 on Comcast. The system handles this automatically if configured correctly.

---

## Sports Guide

### Where does the game data come from?

The sports guide pulls live data from online sports APIs, showing NFL, NBA, MLB, NHL, NCAA, MLS, EPL, and more.

### How often does it update?

- Live games update every 5 minutes
- Scores update in real-time
- Schedule updates hourly

### Why don't I see any games?

**Check:**
1. Internet connection working
2. Correct date/time filters
3. Try refreshing the page
4. May be off-season for some sports

If persistent, contact system admin (API key issue).

### Can I see games from yesterday or tomorrow?

The guide typically shows:
- Today's games
- Tomorrow's upcoming games
- Recently finished games (last 2 hours)

---

## Device Control

### What's the difference between cable boxes, Fire TV, and DirecTV?

- **Cable Box:** Traditional cable TV, controlled by IR or CEC
- **Fire TV:** Amazon streaming device (Prime Video, Netflix, etc.)
- **DirecTV:** Satellite TV service

Different devices, different control methods, but the system handles all of them.

### Why doesn't CEC work on my Spectrum cable box?

Spectrum permanently disabled CEC in their cable box firmware. You must use IR control instead.

**See:** [CEC Deprecation FAQ](CEC_DEPRECATION_FAQ.md)

### Can I control Fire TV apps?

Yes! Select the Fire TV from the dashboard and use the remote to:
- Launch apps
- Navigate menus
- Search for content
- Control playback

### Can two people control the same TV at once?

Yes, but the last command sent wins. Coordinate with coworkers to avoid conflicts.

---

## Audio & Music

### Can I play music through the system?

If your venue uses Soundtrack Your Brand for music, yes! Control playback from the Audio tab.

### How do I route game audio to all zones?

1. Go to Audio tab
2. For each zone, set audio source to the TV with the main game
3. Adjust volume for each zone

### Can different zones have different audio?

Yes! Each zone can have its own audio source. Main bar can hear Game A while dining room hears Game B.

### Why is the audio out of sync with video?

Some audio/video delays are normal. If severe:
1. Check audio source selection
2. Verify TV audio output settings
3. Contact system admin (may need delay adjustment)

---

## Matrix Control

### What is the matrix switcher?

An HDMI matrix routes video sources (cable boxes, Fire TV) to multiple TV outputs. One cable box can feed multiple TVs.

### Do I need to use matrix control?

Usually no for daily operations. Most common tasks (channel changing) are handled automatically. Matrix control is for advanced routing.

### When would I use matrix control?

- Switching a TV between cable and Fire TV
- Routing one source to multiple TVs
- Troubleshooting "No Signal" issues

**See:** [Matrix Control Guide](SYSTEM_ADMIN_GUIDE.md#matrix-routing-configuration)

---

## Advanced Features

### What is AI gain optimization?

The system can automatically adjust audio input levels to prevent distortion and maintain consistent volume. It analyzes audio in real-time.

### Can I schedule automatic channel changes?

Yes (if configured). Example: Automatically tune to ESPN at 7 PM for Monday Night Football.

**See:** [Scheduler Quick Start](SCHEDULER_QUICK_START.md)

### Can I create custom scenes?

Yes (with admin access). Create scenes like "Game Day" that set multiple TVs and audio with one button.

---

## Error Messages

### "Connection refused"

The device isn't accepting connections. Usually means:
- Device is off
- Wrong IP address
- Network issue
- Firewall blocking connection

### "Device unauthorized"

For Fire TV: Accept the authorization prompt on the TV screen.

### "Command timed out"

Device didn't respond in time. Try again. If persistent, device may be frozen or offline.

### "Database error"

System database issue. Contact system admin immediately. Don't try to fix yourself.

---

## Mobile & Browser

### Does it work on iPhone?

Yes! Works in Safari on iPhone or iPad.

### Does it work on Android?

Yes! Works in Chrome or any modern browser on Android.

### Can I add it to my home screen?

Yes! This makes it feel like a native app:

**iPhone/iPad:**
1. Open in Safari
2. Tap share icon
3. Tap "Add to Home Screen"

**Android:**
1. Open in Chrome
2. Tap menu (3 dots)
3. Tap "Add to Home Screen"

### Why is it slow on my phone?

**Check:**
- WiFi signal strength
- Close other apps
- Clear browser cache
- Restart browser

If everyone is slow, may be server or network issue.

---

## Best Practices

### What should I do at opening?

1. Check system is online
2. Power on all TVs
3. Set default channels
4. Test audio
5. Verify core functions work

**See:** [Operations Playbook - Opening Procedures](OPERATIONS_PLAYBOOK.md#opening-procedures)

### What should I do at closing?

1. Power off all TVs
2. Stop/mute music
3. Log any issues
4. Secure devices

**See:** [Operations Playbook - Closing Procedures](OPERATIONS_PLAYBOOK.md#closing-procedures)

### How do I prepare for a big game?

1. Check game schedule (Guide tab)
2. Plan TV assignments
3. Configure all TVs 30 min before game
4. Test audio routing
5. Verify everything working

**See:** [Operations Playbook - Game Day Setup](OPERATIONS_PLAYBOOK.md#game-day-setup)

### What if I make a mistake?

Most actions are reversible:
- Changed wrong channel? Change it back
- Powered off wrong TV? Power it back on
- Wrong volume? Adjust it again

Don't worry about breaking anything!

---

## Training & Help

### How long does it take to learn?

Most bartenders are comfortable after:
- 15-30 min initial training
- 1-2 hours of supervised practice
- 1-2 shifts of real use

### Where can I get help?

1. **This FAQ** - Quick answers
2. **[Bartender Quick Start Guide](BARTENDER_QUICK_START.md)** - Complete training
3. **[Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)** - Fix problems
4. **Manager or Lead Bartender** - On-the-job help
5. **System Admin** - Technical issues

### Can I practice without affecting TVs?

Best practice is hands-on training during slow periods. You can:
- Practice on one TV
- Test functions during setup/closing
- Shadow experienced staff

### What if I forget how to do something?

Keep bookmarks to key guides on your phone:
- Bartender Quick Start
- This FAQ
- Emergency Reference

---

## System Information

### What hardware is used?

Varies by installation, commonly:
- Intel NUC or server (runs the software)
- Global Cache iTach IP2IR (IR control)
- Pulse-Eight CEC adapter (TV power)
- Wolfpack HDMI matrix (video routing)
- AtlasIED audio processor (audio zones)

### What if there's a power outage?

System should auto-recover when power returns. If not:
1. Wait 5 minutes for full boot
2. Check system status
3. Contact admin if not recovered

**See:** [Emergency Quick Reference - System After Power Loss](EMERGENCY_QUICK_REFERENCE.md#3-system-after-power-loss)

### How is data backed up?

Automatic backups run hourly. System admin manages backups.

### Can I access old backup data?

Contact system admin. Backups typically kept for 7-30 days.

---

## Security & Privacy

### Is my usage tracked?

Commands are logged for troubleshooting and audit purposes. Your actions are timestamped but this is for system health, not employee monitoring.

### Can I use it from outside the venue?

No, for security reasons. System is only accessible on the local network.

### What if I see something suspicious?

Report to manager immediately:
- Unauthorized access attempts
- Strange error messages
- Unexpected behavior
- Security warnings

---

## Getting More Help

### Documentation Quick Links

- **[Bartender Quick Start](BARTENDER_QUICK_START.md)** - Training guide
- **[Operations Playbook](OPERATIONS_PLAYBOOK.md)** - Daily procedures
- **[Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)** - Fix problems
- **[Emergency Reference](EMERGENCY_QUICK_REFERENCE.md)** - Critical procedures
- **[Documentation Index](INDEX.md)** - All documentation

### Contact Information

Fill in for your venue:

```
Manager:      ____________________
Phone:        ____________________

System Admin: ____________________
Phone:        ____________________
Email:        ____________________
```

### Reporting Issues

When reporting problems, include:
1. What you were trying to do
2. What happened instead
3. Any error messages (exact text)
4. Which device/TV
5. What you've already tried

---

## Feedback & Suggestions

Have ideas to improve the system or this documentation?

- Talk to your manager
- Suggest new features
- Report unclear documentation
- Share workflow tips

Your feedback helps make the system better for everyone!

---

**End of FAQ**

*Can't find your answer? Check the [Documentation Index](INDEX.md) for more guides.*
