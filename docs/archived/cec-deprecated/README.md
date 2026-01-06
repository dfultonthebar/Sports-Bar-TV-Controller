# Archived CEC Documentation

**Date Archived**: 2025-11-21
**Reason**: CEC (HDMI-CEC) TV control functionality removed from system

## Why CEC Was Removed

CEC-based television and cable box control was removed because:
1. Spectrum/Charter cable boxes have CEC disabled in firmware
2. CEC proved unreliable for commercial bar environments
3. IR control via Global Cache iTach provides better compatibility

## Migration Path

All TV and cable box control now uses **IR (Infrared) control** via Global Cache iTach IP2IR devices.

See the main documentation for:
- IR Learning Guide
- IR Device Setup
- Global Cache Configuration

## Files in This Archive

- `CEC_CABLE_BOX_CONTROL.md` - Original CEC cable box implementation guide
- `CEC_DEPRECATION_NOTICE.md` - Original deprecation notice
- `pulse-eight-integration-guide.md` - Pulse-Eight USB CEC adapter guide
- `UNIFIED_TV_CONTROL_GUIDE.md` - Combined CEC/IR control guide (now IR-only)
- `ENHANCED_TV_CONTROL_SUMMARY.md` - Enhanced CEC features summary

These files are kept for historical reference only. The functionality described here **no longer exists** in the system.
