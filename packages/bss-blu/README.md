# @sports-bar/bss-blu

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
