
# Scheduler & Wolfpack Integration Enhancement

## Overview
Enhanced the TV scheduler system to integrate directly with Wolfpack (Matrix) output configuration, allowing you to designate specific TVs for automatic daily turn-on/off directly from the Matrix Control interface.

## New Features

### 1. Daily Turn-On/Off Configuration in Matrix Control

**Location**: Matrix Control → Outputs Section

Each Wolfpack output now has two new toggle options:
- **☀️ Daily Turn On** - Mark this TV for automatic morning power-on
- **🌙 Daily Turn Off** - Mark this TV for automatic nightly power-off

**How to Configure**:
1. Go to Matrix Control page
2. Click "Outputs" tab
3. For each TV output, you'll see checkboxes for:
   - Daily Turn On
   - Daily Turn Off
4. Check the appropriate boxes based on your needs
5. Save configuration

**Database Changes**:
- Added `dailyTurnOn` boolean field to `MatrixOutput` model
- Added `dailyTurnOff` boolean field to `MatrixOutput` model

### 2. Enhanced Scheduler Interface

**New API Endpoint**: `/api/matrix/outputs-schedule`

This endpoint provides:
- List of outputs configured for daily turn-on
- List of outputs configured for daily turn-off  
- List of available outputs (not assigned to daily operations)

**Scheduler Page Enhancements**:

#### Output Schedule Info Panel
When creating/editing a schedule, you now see:
- **☀️ Configured for Daily Turn-On**: Shows which TVs are set to turn on automatically
- **🌙 Configured for Daily Turn-Off**: Shows which TVs are set to turn off automatically
- **📺 Available for Custom Schedules**: Shows how many TVs are available for other schedules

#### Visual Indicators
In the output selection list, each TV shows:
- ☀️ icon if configured for daily turn-on
- 🌙 icon if configured for daily turn-off

This makes it easy to see which TVs are already assigned to daily operations.

## Use Cases

### Use Case 1: Basic Daily Operations
**Scenario**: Main bar area opens at 9 AM, closes at 2 AM

**Setup**:
1. In Matrix Control, mark main bar TV outputs with "Daily Turn On"
2. Mark same outputs with "Daily Turn Off"
3. In Scheduler:
   - Create "Morning Turn On" schedule for 8:55 AM
   - Create "Nightly Turn Off" schedule for 2:00 AM
   - Both schedules automatically include daily-configured outputs

### Use Case 2: Staggered Opening Times
**Scenario**: Main bar opens at 9 AM, side room opens at 11 AM

**Setup**:
1. In Matrix Control:
   - Mark main bar TVs with "Daily Turn On"
   - Leave side room TVs unmarked
2. In Scheduler:
   - Create "Main Bar Morning" schedule for 8:55 AM (uses daily-configured outputs)
   - Create "Side Room Opening" schedule for 10:55 AM (manually select side room outputs)

### Use Case 3: Special Event Rooms
**Scenario**: Party room only opens on weekends or by reservation

**Setup**:
1. In Matrix Control:
   - Don't mark party room TVs for daily turn-on/off
2. In Scheduler:
   - Create weekend-only schedule for party room
   - Create on-demand schedules for special events

### Use Case 4: Game Day Automation
**Scenario**: Turn on additional TVs when home team games are detected

**Setup**:
1. In Matrix Control:
   - Mark essential TVs for daily turn-on
   - Leave game-day TVs unmarked
2. In Scheduler:
   - Create game-based schedule that:
     - Monitors home teams
     - Auto-finds games
     - Turns on additional TVs when games detected

## Migration Required

⚠️ **Important**: After pulling these changes, you must run:

```bash
cd ~/Sports-Bar-TV-Controller
yarn prisma db push
```

Or manually add the fields to existing outputs:
```bash
cd ~/Sports-Bar-TV-Controller
sqlite3 prisma/dev.db "ALTER TABLE MatrixOutput ADD COLUMN dailyTurnOn BOOLEAN DEFAULT 0;"
sqlite3 prisma/dev.db "ALTER TABLE MatrixOutput ADD COLUMN dailyTurnOff BOOLEAN DEFAULT 0;"
```

## Files Modified

### Schema Changes
- ✅ `prisma/schema.prisma` - Added `dailyTurnOn` and `dailyTurnOff` fields to MatrixOutput

### Component Updates
- ✅ `src/components/MatrixControl.tsx` - Added daily turn-on/off toggles to output configuration
- ✅ `src/app/scheduler/page.tsx` - Enhanced with output schedule info display

### New API Endpoints
- ✅ `src/app/api/matrix/outputs-schedule/route.ts` - Get/update output scheduling settings

## Benefits

### 1. Centralized Configuration
- Configure daily turn-on/off right where you configure TV labels and settings
- No need to remember which TVs to select in scheduler each time

### 2. Flexible Scheduling
- Daily-configured TVs for routine operations
- Manually select additional TVs for special schedules
- Mix and match as needed

### 3. Visual Clarity
- See at a glance which TVs are assigned to daily operations
- Icons (☀️🌙) make it easy to identify configured TVs
- Prevents accidentally creating conflicting schedules

### 4. Reduced Errors
- Less manual selection = fewer mistakes
- Clear separation between daily and special schedules
- Documentation built into the interface

## Example Workflow

### Initial Setup (One-Time)
```
1. Go to Matrix Control → Outputs
2. For each TV:
   - Main Bar TVs → ✓ Daily Turn On, ✓ Daily Turn Off
   - Dining Area TVs → ✓ Daily Turn On, ✓ Daily Turn Off
   - Party Room TVs → Leave unchecked
   - Game Day TVs → Leave unchecked
3. Save Configuration
```

### Create Daily Schedules
```
1. Go to Scheduler
2. Create "Morning Setup" schedule:
   - Type: Daily
   - Time: 8:55 AM
   - Power On TVs: ✓
   - Will see: 12 TVs configured for daily turn-on
3. Create "Nightly Shutdown" schedule:
   - Type: Daily  
   - Time: 2:00 AM
   - Power Off TVs: ✓
   - Will see: 12 TVs configured for daily turn-off
4. Save both schedules
```

### Create Special Schedule
```
1. Create "Game Day Extra TVs" schedule:
   - Type: Game-based
   - Monitor Home Teams: ✓
   - Select additional game-day TVs manually
   - These won't conflict with daily schedules
```

## Testing

After setup, verify:

1. **Matrix Control**:
   - Open Outputs tab
   - Verify checkboxes saved correctly
   - Icons appear: ☀️ for turn-on, 🌙 for turn-off

2. **Scheduler**:
   - Create new schedule
   - Check "Output Schedule Info" panel appears
   - Verify daily-configured TVs listed correctly
   - Verify icons (☀️🌙) appear next to configured outputs

3. **Functionality**:
   - Save a schedule with daily-configured outputs
   - Execute schedule manually
   - Verify correct TVs power on/off

## Future Enhancements

Potential additions:
- Bulk selection: "Select all daily turn-on TVs"
- Schedule templates based on daily configuration
- Conflict detection for overlapping schedules
- Auto-generate daily schedules when outputs configured

---
**Date**: October 1, 2025  
**Status**: ✅ Ready to use (after migration)  
**Impact**: Enhanced scheduler flexibility and usability
