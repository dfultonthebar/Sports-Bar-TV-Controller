# @sports-bar/crestron

Control Crestron DigitalMedia (DM) matrix switchers for video routing. Telnet, CTP, and CIP protocols supported; Telnet is the default and simplest for routing.

## Supported Models (18 across 4 series)

- **DM-MD:** DM-MD8X8, DM-MD16X16, DM-MD32X32, DM-MD64X64, DM-MD128X128
- **HD-MD:** HD-MD8X8, HD-MD8X4, HD-MD6X2, HD-MD4X2, HD-MD4X1
- **DMPS:** DMPS3-4K-350-C, DMPS3-4K-250-C, DMPS3-4K-150-C
- **NVX:** DM-NVX-350, DM-NVX-351, DM-NVX-352, DM-NVX-360, DM-NVX-363

## Protocols + Ports

| Protocol | Port | Notes |
|---|---|---|
| Telnet | 23 | Primary. Simplest text commands. |
| CTP (Crestron Terminal Protocol) | 41795 | Lightweight binary. |
| CIP (Crestron Internet Protocol) | 41794 | Full SIMPL+ control. |

## Key Commands (Telnet)

```
SETAVROUTE   input output    # Route input → output (video + audio)
SETVIDEOROUTE input output   # Video only
SETAUDIOROUTE input output   # Audio only (audio breakaway)
DUMPDMROUTEI                 # Get current routing state
```

## Output Slot Offset (DM matrices)

DM matrices number outputs starting after the input block:

| Chassis | Output slot start |
|---|---|
| 8x8 / 16x16 | 17 |
| 32x32 | 33 |
| 64x64 | 65 |

Add the offset before issuing routing commands to a DM matrix.

## API + UI

- `GET/POST /api/crestron/matrices` — list/create
- `GET/PUT/DELETE /api/crestron/matrices/[id]` — CRUD
- `POST /api/crestron/matrices/[id]/test` — connection test
- UI: Matrix Control page → "Crestron DM" tab
- Component: `apps/web/src/components/CrestronMatrixManager.tsx`
- DB: `CrestronMatrix` (id, name, model, ipAddress, port, status, inputs, outputs)
