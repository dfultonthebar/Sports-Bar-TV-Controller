# 📅 Smart Scheduler - Quick Start Guide

## ✅ What's New

I've just added a complete **Smart TV Scheduler System** to your Sports Bar AI Assistant!

## 🎯 What It Can Do

### 1. Automatic TV Power Control
- Turn on/off any Wolfpack outputs at scheduled times
- Perfect for opening and closing times
- Uses CEC for reliable TV control

### 2. Default Channel Setting
- Set specific channels for each TV output
- Choose input source (Cable, DirecTV, Fire TV)
- Optionally specify channel number
- Great for morning setup

### 3. Smart Game Finder 🔥
**This is the killer feature!**

- Monitors your home teams (Packers, Badgers, local high schools, etc.)
- Automatically searches ALL channel guides for their games
- Prioritizes: Cable → Streaming (NFHS) → Satellite
- Automatically tunes TVs to the right channels
- Handles high school sports via NFHS streaming!

### 4. Flexible Scheduling
- **Daily**: Same time every day
- **Weekly**: Specific days of the week
- **Once**: One-time event

## 🚀 How to Use It

### Step 1: Access the Scheduler

Two ways to get there:

**Option A: From Dashboard**
1. Go to `http://localhost:3000`
2. Scroll to "Configuration & AV Management"
3. Click **📅 Smart Scheduler** (green highlighted button)

**Option B: Direct Link**
- `http://localhost:3000/scheduler`

### Step 2: Create Your First Schedule

Let me walk you through a common setup:

#### Example 1: Morning TV Setup (Basic)

1. Click **New Schedule**
2. Fill in:
   - **Name**: "Morning TV Setup"
   - **Description**: "Turn on TVs and set to ESPN"
   - **Schedule Type**: Daily
   - **Execution Time**: 09:00
   - **Enabled**: ✓ (checked)

3. TV Power Control:
   - ✓ Power On TVs
   - ☐ Power Off TVs

4. Select TV Outputs:
   - Check all the TVs you want to control
   - Example: Main Bar TV, Side Bar TV, Dining Area TV

5. Set Default Channels (if desired):
   - ✓ Enable "Set Default Channels"
   - For each TV, choose:
     - Input Source: "Cable Box 1" (for example)
     - Channel: "206" (ESPN)

6. Click **Create Schedule**

Done! Every day at 9 AM, these TVs will turn on and tune to ESPN.

#### Example 2: Weekend Game Day (With Smart Finder) 🎯

This is where it gets cool!

1. Click **New Schedule**
2. Fill in:
   - **Name**: "Weekend Game Day"
   - **Description**: "Auto-find and display home team games"
   - **Schedule Type**: Weekly
   - **Days**: Saturday, Sunday (click both)
   - **Execution Time**: 11:00

3. TV Power Control:
   - ✓ Power On TVs
   - Select your game day TVs

4. Smart Game Finder:
   - ✓ Enable "Smart Game Finder"
   - ✓ Enable "Monitor Home Teams"
   - **Select Teams**: Check Packers, Badgers, local teams, etc.
   - **Provider Priority**: Cable, Streaming, Satellite (default order)

5. Click **Create Schedule**

Now, every Saturday and Sunday at 11 AM:
- TVs turn on
- System searches for games featuring your home teams
- Automatically tunes TVs to those games
- Prioritizes cable channels, then streaming (NFHS), then satellite

#### Example 3: Friday Night High School Football

1. Click **New Schedule**
2. Fill in:
   - **Name**: "Friday Night Football"
   - **Schedule Type**: Weekly
   - **Days**: Friday
   - **Time**: 18:30 (6:30 PM)

3. Select TVs for high school games

4. Smart Game Finder:
   - ✓ Enable both options
   - **Select Teams**: Check your local high school teams
   - Provider priority will find NFHS streams automatically!

### Step 3: Test It

Don't wait for the scheduled time! Test immediately:

1. Find your new schedule in the list
2. Click the **▶ Run Now** button (green play icon)
3. Watch the magic happen!
4. Check the alert for results

## 📊 What You'll See

### Schedule Card Shows:
- Schedule name and status (Active/Disabled)
- Schedule type and execution time
- Number of TVs controlled
- Whether auto game finder is enabled
- Next scheduled run time
- Last run time and count

### Action Buttons:
- **▶ Play**: Run now (test or manual execution)
- **✏️ Edit**: Modify the schedule
- **🗑️ Delete**: Remove the schedule

## 🎮 Managing Schedules

### Edit a Schedule
1. Click the **✏️ Edit** button
2. Change any settings
3. Click **Update Schedule**

### Disable/Enable
1. Edit the schedule
2. Uncheck/check "Enabled"
3. Update

### Delete
1. Click **🗑️ Delete**
2. Confirm

## 🔍 Viewing Results

After execution, each schedule shows:
- ✅ Last executed time
- Number of times run
- TVs controlled
- Channels set
- Games found (if using game finder)

Click "View Logs" (when that's added) to see detailed execution history.

## 💡 Pro Tips

### For Best Results:

1. **Start Simple**: Begin with basic power control and default channels
2. **Test First**: Always use "Run Now" to test before relying on auto-execution
3. **Check Home Teams**: Make sure your home teams are configured in Sports Guide
4. **Set Delays**: Default 2-second delay works well, increase if needed
5. **Provider Order**: Cable first finds most games, NFHS for high school

### Common Schedules to Create:

1. **Morning Setup**: Daily 9 AM, power on + ESPN
2. **Game Day**: Weekends, enable game finder
3. **High School Fridays**: Weekly Friday 6:30 PM, NFHS priority
4. **Closing Time**: Daily 1:30 AM, power off all TVs
5. **Special Events**: Once, specific time, custom setup

## 🐛 Troubleshooting

### Schedule Not Running?
- Check it's enabled (shows "Active")
- Verify execution time is correct
- Look at "Next run" time

### TVs Not Turning On?
- Test CEC control manually first
- Check CEC configuration is set up
- Increase delay between commands

### Games Not Found?
- Verify home teams are configured
- Check team names match (system handles variations)
- Ensure channel guide APIs are working
- Check execution logs for errors

### Channels Not Changing?
- Test device control manually
- Verify IR codes are programmed
- Check input routing works

## 📚 Full Documentation

For complete details, see:
- **SMART_SCHEDULER_GUIDE.md** - Complete user guide
- **GUIDE_DATA_IMPLEMENTATION.md** - Channel guide info
- **UNIFIED_TV_CONTROL_GUIDE.md** - TV control details

## 🎉 You're Ready!

The scheduler is running in the background and will execute your schedules automatically.

**Next Steps:**
1. Create a morning setup schedule
2. Create a weekend game day schedule
3. Add your home teams if not already done
4. Test each schedule with "Run Now"
5. Let it run automatically!

---

**Questions?** Check SMART_SCHEDULER_GUIDE.md for detailed info.

**Everything is pushed to GitHub** - Latest commit includes all scheduler code!
