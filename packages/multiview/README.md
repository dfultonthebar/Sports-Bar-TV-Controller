# @sports-bar/multiview

Control HDTVSupply 4K60 Quad-View output cards installed in Wolf Pack matrix slots (8x8, 16x16, 36x36 chassis).

## Hardware

4K60 Quad-View Output Card — plugs into Wolf Pack output card slots. Up to 4 inputs displayed simultaneously per card.

## Display Modes

| Mode byte | Layout |
|---|---|
| 0 | Single window |
| 1 | 2-window split |
| 2 | PIP left-top |
| 3 | PIP right-bottom |
| 4 | 3-window (1 top, 2 bottom) |
| 5 | 3-window alt |
| 6 | 3-window + PIP×2 |
| 7 | 4-window quad |

## Control Protocol

- RS-232 via USB adapter: 115200 baud, 8N1, no parity.
- Serial port assignment per device: `/dev/ttyUSB0`, `/dev/ttyUSB1`, etc.
- Commands terminate with `.` (period). Response: `OK` or `ERR`.

## Hex Frame

```
EB 90 00 11 00 ff 32 [mode] 00 01 02 03 00 00 00 00 00 00
```

`[mode]` is the byte from the table above. Bytes `01 02 03` are the input assignments for windows 2-4 (window 1 is implicit).

## Configuration

| Setting | Purpose |
|---|---|
| Slot assignment | Which Wolf Pack output slots the card occupies (e.g. 21-24). |
| Serial port | USB serial port for RS-232 control. |
| Input mapping | Which Wolf Pack inputs feed the 4 multi-view windows. |

## Integration

- DB: `WolfpackMultiViewCard` (name, startSlot, endSlot, serialPort, currentMode, inputAssignments).
- UI: Matrix Control page slot/serial config.
- Service: `multiview-service.ts` (queue + retry + structured logging).
