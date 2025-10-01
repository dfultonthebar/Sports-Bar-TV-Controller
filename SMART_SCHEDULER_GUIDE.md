# Smart TV Scheduler System

## 🎯 Overview

The Smart Scheduler System automates TV control and game detection for your sports bar. It can:

1. **Power Control** - Automatically turn TVs on/off at scheduled times
2. **Default Channels** - Set specific channels for each TV output
3. **Smart Game Finder** - Automatically detect home team games and tune to them
4. **Flexible Scheduling** - Daily, weekly, or one-time schedules

## 🚀 Quick Start

### Access the Scheduler

1. Go to your Sports Bar dashboard: `http://localhost:3000`
2. Click on **📅 Smart Scheduler** in the Configuration section
3. Or directly visit: `http://localhost:3000/scheduler`

### Create Your First Schedule

1. Click **New Schedule**
2. Enter a name (e.g., "Morning TV Setup")
3. Select schedule type (Daily, Weekly, or Once)
4. Set execution time (e.g., 09:00 AM)
5. Select which TV outputs to control
6. Configure options (see below)
7. Click **Create Schedule**

## 📋 Schedule Options

### 1. TV Power Control

**Power On TVs**
- Automatically turns on selected TVs using CEC commands
- Runs before channel setting (if both enabled)

**Power Off TVs**
- Automatically turns off selected TVs
- Useful for closing time schedules

**Select TV Outputs**
- Choose which Wolfpack outputs (TVs) to control
- Can select multiple outputs
- Must select at least one

### 2. Default Channels

**Set Default Channels**
- Enable this to tune TVs to specific channels
- For each selected output, choose:
  - **Input Source**: Cable Box, DirecTV, Fire TV, etc.
  - **Channel**: Channel number to tune to (optional)

**Example Use Cases:**
- Morning setup: All main TVs to ESPN (e.g., Channel 206)
- Lunch hours: Switch to news channels
- Evening: Default to sports channels

### 3. Smart Game Finder 🎯

The intelligent feature that automatically finds and tunes to home team games!

**How It Works:**

1. **Monitor Home Teams**
   - Select which home teams to monitor
   - Teams configured in your Sports Guide
   - Examples: Green Bay Packers, Wisconsin Badgers, local high school teams

2. **Automatic Game Detection**
   - Searches all available channel guides (Cable, DirecTV, Streaming)
   - Finds games featuring your home teams
   - Prioritizes by provider order (Cable first, then Streaming, then Satellite)

3. **Smart Tuning**
   - Automatically assigns games to available TVs
   - Routes the correct input (Cable, DirecTV, NFHS streaming)
   - Changes to the correct channel

**Provider Priority:**
1. **Cable** - Checked first (Spectrum, etc.)
2. **Streaming** - Second priority (NFHS for high school, ESPN+, etc.)
3. **Satellite** - Last option (DirecTV)

**High School Sports:**
- Automatically detects NFHS Network streams
- Routes to Fire TV or streaming input
- Launches the appropriate app/stream

## 🕐 Schedule Types

### Daily
Runs every day at the specified time.

**Example:** "Morning TV Setup" - 9:00 AM daily
- Turn on all TVs
- Set main bar TVs to ESPN

### Weekly
Runs on specific days of the week.

**Example:** "Weekend Game Day" - Saturday & Sunday at 11:00 AM
- Turn on all TVs
- Enable smart game finder
- Monitor home teams

### Once
Runs one time at a specific date/time.

**Example:** "Championship Game" - February 12, 2025 at 5:30 PM
- Turn on specific TVs
- Tune to championship game channel

## 📊 Execution Flow

When a schedule runs, it follows this order:

1. **Power On TVs** (if enabled)
   - Sends CEC power on commands to selected outputs
   - Waits configured delay between commands (default 2 seconds)

2. **Find Games** (if Smart Game Finder enabled)
   - Searches for home team games in all channel guides
   - Identifies which channels have your teams' games
   - Assigns games to outputs based on priority

3. **Set Channels**
   - Routes inputs to outputs via Wolfpack matrix
   - Sends channel change commands to input devices
   - Waits delay between each command

4. **Log Results**
   - Records execution details
   - Shows how many TVs controlled, channels set, games found
   - Logs any errors for troubleshooting

## 🎮 Manual Execution

You can manually run any schedule:

1. Go to the Scheduler page
2. Find the schedule you want to run
3. Click the **▶ Run Now** button
4. View results in the alert message

This is useful for:
- Testing new schedules
- Running game day setup early
- Quick TV control without waiting for scheduled time

## 📝 Editing Schedules

1. Click the **✏️ Edit** button on any schedule
2. Modify any settings
3. Click **Update Schedule**
4. Changes take effect immediately

## 🗑️ Deleting Schedules

1. Click the **🗑️ Delete** button on any schedule
2. Confirm deletion
3. Schedule is permanently removed

## 📊 Viewing Execution History

Each schedule shows:
- **Last Run**: When it was last executed
- **Execution Count**: How many times it has run
- **Next Run**: When it will run next (if enabled)

Detailed logs include:
- TVs controlled
- Channels set
- Games found
- Any errors encountered

## ⚙️ Configuration Tips

### For Morning Setup
```
Name: Morning TV Setup
Type: Daily
Time: 9:00 AM
Power On: Yes
Selected Outputs: All main bar TVs
Default Channels: ESPN, ESPN2, Fox Sports
```

### For Game Day (Weekend)
```
Name: Weekend Game Day
Type: Weekly
Days: Saturday, Sunday
Time: 11:00 AM
Power On: Yes
Auto Find Games: Yes
Monitor Home Teams: Yes (Packers, Badgers, etc.)
Provider Priority: Cable, Streaming, Satellite
```

### For High School Games
```
Name: Friday Night Football
Type: Weekly
Days: Friday
Time: 6:30 PM
Power On: Yes
Auto Find Games: Yes
Monitor Home Teams: Yes (Local high school teams)
Provider Priority: Streaming (NFHS), Cable, Satellite
```

### For Closing Time
```
Name: Closing Time TV Off
Type: Daily
Time: 1:30 AM
Power Off: Yes
Selected Outputs: All TVs
```

## 🔧 Advanced Settings

### Execution Order
- **Outputs First**: Powers on TVs, then sets channels (recommended)
- **Channels First**: Sets channels, then powers on TVs

### Delay Between Commands
- Default: 2000 milliseconds (2 seconds)
- Allows time for TVs and devices to respond
- Increase if you experience timing issues

## 🐛 Troubleshooting

### Schedule Not Running?
1. Check that schedule is **Enabled** (Active status)
2. Verify execution time is correct
3. Check Next Run time matches your expectation
4. Look for errors in execution logs

### TVs Not Powering On?
1. Verify CEC is configured correctly
2. Check that CEC input channel is set
3. Test CEC control manually first
4. Increase delay between commands

### Channels Not Changing?
1. Verify input devices are configured (Cable, DirecTV, etc.)
2. Check that IR codes are programmed
3. Test channel changing manually
4. Ensure correct input is routed to output

### Game Finder Not Working?
1. Verify home teams are configured in Sports Guide
2. Check that team names match guide data
3. Verify channel guide APIs are working
4. Check execution logs for specific errors

## 📱 API Endpoints

For developers or advanced automation:

```bash
# List all schedules
GET /api/schedules

# Get specific schedule
GET /api/schedules/:id

# Create schedule
POST /api/schedules
Body: { name, description, scheduleType, executionTime, ... }

# Update schedule
PUT /api/schedules/:id
Body: { any fields to update }

# Delete schedule
DELETE /api/schedules/:id

# Execute schedule manually
POST /api/schedules/execute
Body: { scheduleId: "schedule-id" }

# Get execution logs
GET /api/schedules/logs?scheduleId=...&limit=50
```

## 🔌 Integration

### With Matrix Control
Schedules automatically use your Wolfpack matrix configuration to route inputs to outputs.

### With CEC Control
Power commands use CEC when configured, with automatic fallback to IR if needed.

### With Device Config
Channel changing uses device-specific control methods (IR codes, network control, etc.).

### With Sports Guide
Game finder searches your configured TV providers and channel guide data.

### With Home Teams
Smart game finder uses your configured home teams to find relevant games.

## 🎯 Best Practices

1. **Test Schedules First**: Use "Run Now" to test before enabling automatic execution

2. **Start Simple**: Begin with basic power control and default channels, add game finder later

3. **Check Timing**: Ensure schedules don't conflict (e.g., two schedules at same time)

4. **Monitor Logs**: Review execution history to catch and fix issues early

5. **Use Descriptive Names**: "Saturday Game Day" is better than "Schedule 1"

6. **Set Appropriate Delays**: Give devices time to respond (2-3 seconds recommended)

7. **Backup Your Config**: Use GitHub Sync to backup your schedules regularly

## 📞 Support

### Common Questions

**Q: Can I have multiple schedules running at once?**
A: Yes, but ensure they don't conflict (same TVs at same time)

**Q: How accurate is the game finder?**
A: It searches all configured channel guides and matches team names (including variations)

**Q: What if a schedule fails?**
A: Check execution logs for specific errors. The system will try again at next scheduled time.

**Q: Can I control individual TVs differently?**
A: Yes! Create separate schedules for different TV groups with different settings.

**Q: Does this work with streaming devices?**
A: Yes! Fire TV and other streaming inputs are supported for channel routing.

## 🚀 Future Enhancements

Planned features:
- Scene-based scheduling (pre-configured AV scenes)
- Weather-based schedule adjustments
- Holiday schedule automation
- Mobile app notifications
- Integration with point-of-sale systems

## 📚 Related Documentation

- `UNIFIED_TV_CONTROL_GUIDE.md` - TV power and control
- `GUIDE_DATA_IMPLEMENTATION.md` - Channel guide integration
- `ATLAS_IO_CONFIGURATION_SUMMARY.md` - Audio system control
- `CEC_IMPLEMENTATION_SUMMARY.md` - CEC TV power control

---

**Version**: 1.0  
**Last Updated**: October 1, 2025  
**Author**: Sports Bar AI Assistant Team
