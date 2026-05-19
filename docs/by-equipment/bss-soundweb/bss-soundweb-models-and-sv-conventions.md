# BSS Soundweb London BLU — Model Reference & SV Conventions

## Source

- BSS Soundweb London product family:
  https://bssaudio.com/en-US/product_families/soundweb-london
- DI Kit (definitive SV reference, Rev 2.6):
  https://aca.im/driver_docs/BSS/London-DI-Kit.pdf
- DI Kit (Rev 2.7, 2013):
  https://adn.harmanpro.com/site_elements/resources/1445_1444232538/London_DI_Kit_original.pdf
- AMX NetLinx library implementation (handy SV-ID cross-check):
  https://github.com/amclain/amx-lib-bss

## Family at a Glance

| Model       | Mic/Line In | Out | Dante | CobraNet | BLU-link | DI Port 1023 |
|-------------|-------------|-----|-------|----------|----------|--------------|
| BLU-50      | 8           | 8   | —     | —        | yes      | yes          |
| BLU-100     | fixed I/O   |     | —     | —        | yes      | yes          |
| BLU-120     | 12          | 8   | —     | —        | yes      | yes          |
| BLU-160     | card-based  |     | —     | optional | yes      | yes          |
| BLU-320     | card-based  |     | —     | optional | yes      | yes          |
| BLU-800     | card-based  |     | —     | optional | yes      | yes          |
| BLU-806     | card-based  |     | —     | —        | yes      | yes          |
| BLU-806DA   | card-based  |     | yes   | —        | yes      | yes          |

The DI protocol (TCP 1023) is identical across the family — what differs
is the I/O card complement and which audio bus is present (BLU-link,
CobraNet, Dante). For control-system code, treat all BLU models as one
device class.

Historical models (BLU-16, BLU-32, BLU-80) referenced in some
third-party docs (Medialon driver) use the same DI protocol and are
still supportable, though they are end-of-life.

## HiQnet Address Anatomy

A control reference is **8 bytes total**: `<node 16> <vd 8> <object 24> <sv 16>`.

| Bytes | Field             | Width | Where it comes from                                      |
|-------|-------------------|-------|----------------------------------------------------------|
| 1-2   | Node              | 16-bit| Audio Architect → Network window → device Node Address  |
| 3     | Virtual Device    | 8-bit | Always `0x03` for audio processing objects              |
| 4-6   | Object            | 24-bit| Audio Architect property pane → HiQnet Address bytes 3-5|
| 7-8   | State Variable    | 16-bit| Audio Architect property pane → SV ID (decimal)         |

> *"For all controls on audio processing objects, this is `0x03`."*
> *"The address is made up from: `0xnnnnvvbbbbbb`."* — DI Kit Rev 2.6

## SV ID Conventions

The DI Kit's **Appendix G** is the authoritative SV ID list. Selected
high-traffic objects:

### Gain (mono) — common in zone-mix configurations

| SV ID | Field      | Type    | Range            |
|-------|------------|---------|------------------|
| `0x00`| Gain       | 32-bit  | dB scaling, App A |
| `0x01`| Mute       | 32-bit  | 0 = unmuted, 1 = muted |
| `0x02`| Polarity   | 32-bit  | 0 / 1            |

### N-input Gain (stereo / multi-channel) — pattern

Each channel exposes the same `{ Gain, Mute, Polarity }` triple
sequentially starting at `0x00`, then `0x03`, then `0x06`, ...

### Meter object

Subscribe with `DI_SUBSCRIBESV` + `<rate ms>`. SV IDs `0`, `6`, `12`,
`18` for the four meter elements on an I/O card (DI Kit's "four input
meters from Input card A" example).

### Source Selector — common in bartender-style routing

Behaves like a discrete control. SV `0x00` carries the selected source
index (0-based). Set with `DI_SETSV` and a 32-bit unsigned value.

### CobraNet I/O Bundle IDs (Appendix B)

| Direction | A | B | C | D |
|-----------|---|---|---|---|
| Input     | `0x11` | `0x12` | `0x13` | `0x14` |
| Output    | `0x15` | `0x16` | `0x17` | `0x18` |

### Route to Group / Solo SVs (mixer)

> *"Route to group 2 - 3441 / Route to group 4 - 3843 / Route to
> group 3 - 3442 / Solo - 3804"* — DI Kit table

These are decimal SV IDs (1-indexed); convert to 16-bit hex before
wire transmission.

## State Variable Subscription Model

`DI_SUBSCRIBESV` / `DI_SUBSCRIBESVPERCENT` register the controller for
push notifications. The device sends a `DI_SETSV`-shaped frame at the
requested cadence reflecting the live SV value.

| Opcode used to subscribe | Push opcode sent by device | Use case                       |
|--------------------------|----------------------------|--------------------------------|
| `DI_SUBSCRIBESV`         | `DI_SETSV` with current data | Read raw SV in native units    |
| `DI_SUBSCRIBESVPERCENT`  | `DI_SETSVPERCENT` with percentage | UI sliders in 0-100% range |

Subscription rate is **milliseconds between updates** (32-bit unsigned
data field). Recommended ranges per the DI Kit:

- **Meters**: 50-100 ms (10-20 Hz) — anything faster floods the
  serial / TCP buffer.
- **Volume / mute / routing**: subscribe with rate `0xFFFFFFFF` if your
  controller only needs change-driven updates; the device will push on
  change only when this MAX value is used.
- **Polled values**: 500-2000 ms is typical.

Unsubscribe with `DI_UNSUBSCRIBESV` and `<rate>` field = `0`.

## Object IDs Are Configuration-Specific

> *"The object is a 24-bit word that is particular to an object placed
> in the configuration window. It can be discovered from the full
> HiQnet address which is obtained by clicking on the object in the
> configuration window and viewing the properties."*

This is the BSS analogue of the dbx "object IDs come from ZonePRO
Designer" caveat. Our code must hold the object IDs that correspond to
the configuration flashed on each unit. Audio Architect's "Generate
Third Party Control" report is the canonical export.

## Quirks to Plan For (cross-referenced with DI Kit FAQ)

- **TCP socket close = 1 Hz spam.** If the controller drops the socket
  without explicitly unsubscribing, the device retries every second
  until session timeout. Always send `DI_UNSUBSCRIBESV` before close.
- **Multiple controllers permitted** on TCP 1023, but each subscription
  is per-controller; the device tracks them independently.
- **No application-layer error frame.** Malformed messages are dropped
  silently on Ethernet; verify outcomes by reading back the SV.
- **Object IDs change** when an Audio Architect configuration is
  re-compiled (even minor edits can shift object IDs). After any DSP
  edit, re-export the third-party-control list and re-sync object IDs
  in our code.
- **Audio Architect uses UDP 3804** for device discovery (not 1023);
  running it alongside a DI-message tool on the same machine works
  because the ports are different.
