# CEC Cable Box Control - DEPRECATED

**Date:** November 4, 2025
**Status:** DEPRECATED - REMOVED
**Replacement:** IR Learning System

## Overview

CEC-based cable box control has been **completely removed** from the Sports Bar TV Controller system. This decision was made after discovering that Spectrum/Charter cable boxes do not support CEC control in their firmware.

## Why Was CEC Removed?

### Hardware Limitation Discovery

After extensive testing and research, we confirmed that:

1. **Spectrum/Charter disables CEC in firmware** - Despite the Spectrum 100-H cable box having an HDMI connection, the CEC functionality is disabled at the firmware level
2. **No CEC response from cable boxes** - Multiple attempts to send CEC commands to Spectrum cable boxes resulted in zero response
3. **Industry practice** - Cable providers commonly disable CEC to prevent interference with their own control systems
4. **Wasted development effort** - Significant development was invested in CEC infrastructure that cannot be used with the target hardware

### Business Impact

- **77 files** contained CEC cable box code
- Multiple API endpoints were built specifically for CEC control
- Database tables were created for CEC device management
- Admin interfaces were developed for CEC configuration

All of this infrastructure is now obsolete for cable box control.

## What Was Removed

### Services & Libraries
- `/src/lib/cable-box-cec-service.ts` - Main CEC cable box service (DELETED)
- `SPECTRUM_COMMANDS` from `/src/lib/cec-commands.ts` - Spectrum-specific commands (REMOVED)

### API Endpoints (All DELETED)
- `/api/cec/cable-box/` - List cable boxes
- `/api/cec/cable-box/command` - Send CEC commands
- `/api/cec/cable-box/tune` - Tune to channel
- `/api/cec/cable-box/discover` - Discover CEC adapters
- `/api/cec/cable-box/test` - Test CEC connectivity
- `/api/cec/cable-box/run-setup` - Run setup wizard
- `/api/cec/cable-box/stats` - Get command statistics
- `/api/cec/cable-box/logs` - Get command logs

### UI Components
- `/src/components/CableBoxRemoteControl.tsx` - Old CEC remote (DELETED)
- `/src/app/admin/cec-cable-boxes/page.tsx` - CEC admin page (DELETED)
- `/src/app/cable-box-remote/page.tsx` - Updated with deprecation notice
- `/src/components/remotes/CableBoxRemote.tsx` - CEC fallback removed, IR only

### Database Changes

The following tables have been marked as **deprecated** but kept for historical data:

#### `cableBoxes` Table
- **Status:** DEPRECATED
- **Migration:** Cable boxes should now be configured in the `irDevices` table
- **Changes:** `cecDeviceId` foreign key removed (now nullable)

#### `cecDevices` Table
- **Status:** TV Power Control Only
- **Default:** `deviceType` changed from `'cable_box'` to `'tv_power'`
- **Note:** Only used for TV power control now

#### `cecCommandLogs` Table
- **Status:** TV Power Control Only
- **Note:** Historical cable box logs preserved for reference

## What Was Preserved

### TV Power Control via CEC

**CEC is still used for TV power control** and this functionality remains fully supported:

- `/src/lib/cec-service.ts` - TV power control service (KEPT)
- `/src/lib/cec-client.ts` - CEC client library (KEPT)
- `/api/cec/power-control/` - TV power API (KEPT)
- `/api/cec/config/` - CEC configuration API (KEPT)
- `/api/cec/discovery/` - TV CEC discovery (KEPT)

### All IR Control Systems

All IR-based control remains intact:
- IR device management
- IR learning system
- Global Cache integration
- IR command execution

### DirecTV & FireTV Control

All other device control methods remain fully functional:
- DirecTV IP control
- FireTV ADB control
- Matrix switching

## Migration Path

### For Existing CEC Cable Box Configurations

If you have existing cable boxes configured via CEC:

1. **Navigate to Admin > IR Devices**
2. **Add New IR Device:**
   - Device Type: Cable Box
   - Brand: Spectrum (or your provider)
   - Model: Your cable box model
   - Matrix Input: Link to the appropriate matrix input
3. **Use IR Learning System:**
   - Click "Learn IR Codes" for the device
   - Capture all necessary remote button codes
   - Save the learned codes
4. **Access via Bartender Remote:**
   - Select the appropriate matrix input
   - Cable box will now be controlled via IR

### Channel Presets

Channel presets for cable boxes now use IR control automatically:
- Device type remains "cable"
- Backend automatically uses IR devices instead of CEC
- No changes needed to existing presets

## IR Learning System Benefits

The IR learning system provides **better control** than CEC would have:

### Advantages
- **Universal compatibility** - Works with any cable box brand
- **Direct IR capture** - Learn codes from the actual remote
- **No firmware limitations** - IR works regardless of cable provider restrictions
- **More commands available** - Can learn any button on the remote
- **Reliable execution** - Direct IR blast to device

### Setup Process
1. Connect Global Cache iTach to network
2. Configure IR output port assignment
3. Point cable box remote at IR learner
4. Press and capture each button code
5. Test learned codes
6. Deploy to production

## Technical Documentation

For detailed information on the IR learning system, see:
- `/docs/IR_LEARNING_GUIDE.md` - IR learning system documentation
- `/docs/GLOBAL_CACHE_SETUP.md` - Global Cache configuration
- `/docs/CABLE_BOX_IR_MIGRATION.md` - Migration guide

## Historical Reference

The following documents remain for historical reference but describe **deprecated** functionality:

- `/docs/CEC_CABLE_BOX_IMPLEMENTATION.md` - Original CEC implementation (DEPRECATED)
- `/docs/CEC_CABLE_BOX_CONTROL.md` - CEC control guide (DEPRECATED)
- `/docs/CABLE-BOX-CEC-SETUP.md` - CEC setup guide (DEPRECATED)

## Summary

| Aspect | Status |
|--------|--------|
| CEC Cable Box Control | **REMOVED** |
| CEC TV Power Control | **ACTIVE** |
| IR Cable Box Control | **ACTIVE** (Replacement) |
| DirecTV IP Control | **ACTIVE** |
| FireTV ADB Control | **ACTIVE** |

## Questions?

If you encounter any issues during migration or have questions about IR control setup, please refer to the IR learning documentation or contact support.

---

**Last Updated:** November 4, 2025
**Authored By:** Claude AI Assistant
