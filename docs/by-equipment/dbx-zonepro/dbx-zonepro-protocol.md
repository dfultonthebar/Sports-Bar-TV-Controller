# dbx ZonePRO — Third Party Control Protocol

**Models covered:** ZonePRO 640, 640m, 641, 641m, 1260, 1260m, 1261, 1261m
**Protocol family:** Harman / dbx 3rd Party Control over HiQnet message framing (subset)

## Primary Source

Title: *dbx ZonePRO 3rd Party Programmers Protocol Guide*
URL: https://dbxpro.com/en-US/site_elements/zonepro-protocol-guide
(served by dbx as a Word `.doc` referenced from `dbxpro.com`)

Supporting:
- Installation Guide (640/640m/641/641m/1260/1260m): https://dbxpro.com/en-US/site_elements/zonepro-install-guide-english
- RS-232 Adaptor Tech Data: https://dbxpro.com/en-US/product_documents/rs-232adaptorspdf → https://adn.harmanpro.com/product_documents/documents/471_1323905875/RS-232Adaptors_original.pdf
- ZonePRO 1260/1261 user manual: https://audiovias.com/descarga/272/dbx-manuales/7420/dbx-zonepro1260-1261-manual-de-usuario.pdf
- Field-discovered failsafe note: `packages/dbx-zonepro/README.md` (this repo)

## Transport

| Transport | Port    | Framing characteristics                                                                            |
|-----------|---------|----------------------------------------------------------------------------------------------------|
| TCP/IP    | **3804**| **No `FS` byte, no `FC` byte, no checksum.** TCP handles delivery; no PING/ACK/NAK/RESYNC at app layer. Fire-and-forget. |
| RS-232    | serial  | 57.6 kbps, 8N1. Includes `0xF0` (Resync-ACK), `0x64` (Frame Start), `0x00` (Frame Count), and a CCITT-8 CRC over the frame. |

Byte order is **Big Endian** (most significant byte first) on the wire for every multi-byte field.

The same payload is wrapped differently on each transport; this is the canonical reason `packages/dbx-zonepro/` strips the `F0/64/00` prefix and checksum when writing to TCP and adds them when writing to the serial socket.

## Message Framing (RS-232)

```
[ 0xF0 ][ 0x64 ][ 0x00 ][ 21-byte header ][ payload ][ CCITT-8 CRC ]
  Resync   Frame   Frame
  ACK      Start   Count   (open-loop, no acknowledgement required)
```

Checksum (per the protocol guide):

```c
UCHAR update_bcc(UCHAR current_bcc, UCHAR new_byte) {
    return Network_CCITT_8_Table[current_bcc ^ new_byte];
}
// initialize current_bcc = 0xFF, fold every header+payload byte
```

## 21-Byte Message Header

| Field            | Size  | Notes                                                                  |
|------------------|-------|------------------------------------------------------------------------|
| Protocol Version | 1     | currently `0x01`                                                       |
| Length           | 4 (ULONG) | message size from Version through end of payload                   |
| Source           | 6     | `[UWORD Device : ULONG Object]`                                        |
| Destination      | 6     | `[UWORD Device : ULONG Object]`                                        |
| Message ID       | 2 (UWORD) | command type — see below                                           |
| Flags            | 2 (UWORD) | bit 0 ReqAck, bit 1 Ack, bit 2 Information, bit 3 Error, bit 4 Event, bits 8-15 Hop Count |

## Common Message IDs

| Hex      | Name           | Use                                                       |
|----------|----------------|-----------------------------------------------------------|
| `0x0000` | Discovery      | locate devices on network                                 |
| `0x0100` | MultiSVSet     | set one or more state variables (canonical SET command)   |
| `0x0103` | Get            | read a state variable                                     |
| `0x011E` | GetObjectList  | enumerate objects on a device                             |
| `0x0113` | SubscribeAll   | subscribe to all SVs of an object (push updates)          |
| `0x0114` | UnsubscribeAll | inverse of `0x0113`                                       |
| `0x9001` | Recall Scene   | payload is a UWORD scene number (1-50)                    |

## MultiSVSet payload (`0x0100`)

```
NumSVs (UWORD) ┬─ SV_ID (UWORD) ── DataType (UBYTE) ── SV_Val (varies)
              └─ … × N
```

Data type codes (from the guide):

| Code | Type   | Range       |
|------|--------|-------------|
| `1`  | UBYTE  | 0-255       |
| `3`  | UWORD  | 0-65535     |

## Router state variables

These are the SV IDs used by the standard ZonePRO router object — the
package wraps them as the operator-facing primitives:

| SV ID     | Field   | Type            |
|-----------|---------|-----------------|
| `0x0000`  | Source  | UBYTE           |
| `0x0001`  | Volume  | UWORD (0-415)   |
| `0x0002`  | Mute    | UBYTE (0/1)     |

Per the ZonePRO Designer mixer reference: Lobby Mic Gain = `0x0000`,
Master Fader = `0x000C`, Master Mute = `0x000D` — useful when working
with mixer SVs rather than router SVs.

## Object ID

> *"The easiest way to get the Object ID in decimal format is to click on
> the device in the ZonePRO program screen and press `<Ctrl>+<Shift>+<o>`.
> When sending, use byte order: b3, b2, b1, b0."* — protocol guide

Object IDs are deployment-specific — they are baked when ZonePRO Designer
compiles the configuration. The values in our code MUST match what's
flashed on the device. There is no protocol-side way to discover them
short of `0x011E` GetObjectList.

## Keepalive (RS-232 only)

Send `0xF0 0x8C` every 1 second over the serial connection. If 2.5 s
pass with no traffic the unit triggers resync.

## Resync (RS-232 only)

If the unit emits **261 × `0xFF`** in a row the controller is out of
sync. Recover by sending **16 × `0xFF`** followed by **261 × `0xF0`**.

None of these heartbeat/resync mechanics apply over TCP — TCP's own
keepalive + retransmit obviate them.

## Scenes & Recall (`0x9001`)

Payload: single UWORD scene number (1-50 supported on 1260/1261 per the
user manual; `0` is reserved as default). Recalling a scene re-applies
all stored module parameters and zone-controller bindings.

Subscribed parameters return their post-recall values via a
`MultiSVSet` push from the device.

## Scene 1 / Failsafe Behavior (FIELD-DISCOVERED — CRITICAL)

The public protocol guide does **not** call this out, but field testing
documented in `packages/dbx-zonepro/README.md` (and reinforced by the
Lucky's 1313 install at 192.168.10.50) shows:

- Opening a fresh TCP connection puts the device into a transient
  "failsafe" state in which **source indices shift by one or two**
  (source 1 may map to source 2 or 3). The protocol returns no error,
  and Volume/Mute commands work normally — only the Source field is
  affected, which makes the symptom maddening.
- The workaround is to **auto-recall Scene 1 (`0x9001` with payload
  `0x0001`) immediately on connect** before any routing commands.
  `DbxTcpClient` exposes this as `sceneOnConnect`. The scheduler honors
  it; any new code path that opens a TCP socket to a ZonePRO **must
  preserve this**.
- The protocol guide mentions a factory-reset clears the loaded scene
  back to Scene 1 — the failsafe state appears to share heritage with
  that reset path. Scene 1 is, by dbx convention, the canonical "known
  good" state and is what new installs should configure first.

## Notes for code in this repo

- `packages/dbx-zonepro/src` strips the `0xF0 0x64 0x00` prefix and the
  CCITT-8 CRC when writing to TCP, and adds them on RS-232.
- Object IDs are configured in ZonePRO Designer per deployment and must
  match what's deployed on the device — they cannot be discovered short
  of `0x011E`.
- Big-endian on the wire for every multi-byte field.
- `sceneOnConnect: 1` is non-optional in production.
