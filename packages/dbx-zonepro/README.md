# @sports-bar/dbx-zonepro

Control dbx ZonePRO audio processors. TCP preferred, RS-232 also supported.

## Supported Models

640, 640m, 641, 641m, 1260, 1260m, 1261, 1261m.

## Protocol

| Transport | Port | Notes |
|---|---|---|
| TCP | 3804 | Preferred. NO `F0/64/00` prefix, NO checksum. Fire-and-forget — device sends no response. |
| RS-232 | (serial) | Includes `F0/64/00` prefix and checksum. |

## Router SV IDs

| ID | Field | Type |
|---|---|---|
| 0x0000 | Source | UBYTE |
| 0x0001 | Volume | UWORD (0-415) |
| 0x0002 | Mute | UBYTE |

Object IDs are device-specific — configured in ZonePRO Designer and must match what's deployed.

## Failsafe Gotcha (CRITICAL)

A new TCP connection puts the device into failsafe mode, which **shifts source indices**. Without the workaround, source 1 may map to source 2 or 3. Fix: auto-recall Scene 1 on connect (`sceneOnConnect` option in `DbxTcpClient`). The scheduler already does this; new code paths must preserve it.

## Integration

- UI: Device Config page → Audio Processors section → dbx ZonePRO tab.
- Component: `apps/web/src/components/AudioProcessorManager.tsx`.
- Locations using ZonePRO: Lucky's 1313 (1260m at 192.168.10.50).
