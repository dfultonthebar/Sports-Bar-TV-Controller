# @sports-bar/bss-blu

> ⚠ **PROTOCOL STUB — zone control commands are no-ops.** As of v2.54.12, the high-level zone control methods (`setZoneMute`, `setZoneGain`, `setZoneSource`, `getDeviceState`) in `src/bss-service.ts` return success **without sending any HiQnet command to the device**. They log and return `true`/defaults. The TCP socket connects, but zone-level control is not wired through to the HiQnet protocol. **Do NOT deploy BSS hardware at a new location expecting functional zone control without first implementing these methods.** The Atlas / dbx-zonepro packages have working zone control if you need an alternative DSP.

Control BSS Soundweb London BLU audio processors via the HiQnet protocol over TCP.

## Supported Models

BLU-50, BLU-100, BLU-120, BLU-160, BLU-320, BLU-800, BLU-806, BLU-806DA. Some models add Dante or CobraNet for digital audio networking.

## Protocol

- HiQnet over TCP, port **1023**.
- Object IDs configured in BSS Audio Architect — match what's deployed on the device.
- Control surface: zone volume, mute, source selection.

## Integration

- UI: Device Config page → Audio Processors section → BSS Soundweb tab.
- Component: `apps/web/src/components/AudioProcessorManager.tsx`.
