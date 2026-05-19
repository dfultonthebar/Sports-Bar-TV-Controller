# BSS Soundweb London — Direct Inject (DI) Protocol

**Models covered:** BLU-50, BLU-100, BLU-120, BLU-160, BLU-320,
BLU-800, BLU-806, BLU-806DA (plus older BLU-16/-32/-80 lineage).
**Vendor protocol name:** *Direct Inject Messaging Protocol* — referred
to in code as "DI Kit". This is a subset of HiQnet that maps directly
onto a TCP socket without HiQnet's connection-management overhead.

## Primary Sources

- *Soundweb London Interface Kit (DI Kit)*, Revision 2.6, November 2012
  — https://aca.im/driver_docs/BSS/London-DI-Kit.pdf (40-page authoritative reference)
- *Soundweb London Interface Kit*, Revision 2.7, April 2013
  — https://adn.harmanpro.com/site_elements/resources/1445_1444232538/London_DI_Kit_original.pdf
- *Third Party Control* HARMAN landing: https://help.harmanpro.com/soundweb-london-third-party-control
- *HiQnet Third Party Programmer Documentation* v2 (parent spec):
  https://adn.harmanpro.com/site_elements/resources/515_1414083576/HiQnet_Third_Party_Programmers_Guide_v2_original.pdf
- AMX NetLinx implementation (handy code reference):
  https://github.com/amclain/amx-lib-bss/blob/master/amx-lib-bss.axi

All quotes below are verbatim from the Rev 2.6 DI Kit PDF unless
otherwise noted.

## Transport

| Transport | Port     | Notes                                                                            |
|-----------|----------|----------------------------------------------------------------------------------|
| TCP/IP    | **1023** | DI message port. Devices accept multiple simultaneous TCP connections.           |
| RS-232    | serial   | 8-bit, no parity. ACK/NAK acknowledgment is required (vs Ethernet — see below). |
| UDP/IP    | **3804** | Used by London Architect for device discovery (NOT for DI control).             |

> *"As you click on a unit in this tree view, the application will
> attempt to make a TCP connection to the unit on port 1023 (the DI
> message port)."*

> *"The ACK/NAK mechanism is not used for Ethernet messages as TCP
> provides it automatically."*

## Frame Format

```
<message> = <STX> <body> <checksum byte> <ETX>
```

| Byte | Value | Name | Meaning                              |
|------|-------|------|--------------------------------------|
| STX  | `0x02`| Start of Text  | message begin                |
| ETX  | `0x03`| End of Text    | message end                  |
| ACK  | `0x06`| Acknowledge    | serial only — successful rx |
| NAK  | `0x15`| Negative ACK   | serial only — bad checksum or framing |
| ESC  | `0x1B`| Escape         | precedes substituted bytes  |

`<checksum byte>` = XOR of every byte in `<body>`, computed
**BEFORE** byte substitution.

## Byte Substitution (CRITICAL)

After computing the checksum, scan the body + checksum. Any of these
reserved bytes inside the payload must be replaced with a two-byte
escape sequence:

| Raw  | Substituted as |
|------|----------------|
| `0x02` | `0x1B 0x82` |
| `0x03` | `0x1B 0x83` |
| `0x06` | `0x1B 0x86` |
| `0x15` | `0x1B 0x95` |
| `0x1B` | `0x1B 0x9B` |

Pattern: precede with `0x1B`, then send `raw + 0x80`. The receiver
strips the `0x1B`, subtracts `0x80`, XORs into running checksum.

> *"These substitutions should be performed on the message after the
> checksum has been calculated and appended, as the checksum itself may
> be a special reserved byte and need substituting."*

## Message Body Format

```
<Body> = <DI_opcode> <node> <virtual_device> <object> <state_variable> <data>
```

Field widths:

| Field            | Width   | Notes                                                                                  |
|------------------|---------|----------------------------------------------------------------------------------------|
| `<node>`         | 16-bit  | HiQnet Node Address from London Architect's Network window. `0` = the directly-connected unit on serial. |
| `<virtual_device>` | 8-bit  | **`0x03` for all audio processing objects.**                                            |
| `<object>`       | 24-bit  | Object address from the configuration; bottom 24 bits of the full HiQnet address.      |
| `<state_variable>` | 16-bit | SV identifier — each object exposes a fixed set; see Appendix G of the DI Kit.        |
| `<data>`         | 32-bit  | Encoded per Appendix A of the DI Kit (see scaling below).                              |

> *"The address is made up from: `0xnnnnvvbbbbbb`. Where `nnnn` is the
> node address, `vv` is the virtual device number and `bbbbbb` is the
> object address."*

So the full HiQnet address `0x08 32 03 00 01 00` decomposes as
node = `0x0832`, vd = `0x03`, object = `0x000100`.

## Direct Inject Opcodes

| Hex    | Name                       | Body shape                                                          |
|--------|----------------------------|---------------------------------------------------------------------|
| `0x88` | `DI_SETSV`                 | `<node><vd><obj><sv><data 32-bit>`                                   |
| `0x89` | `DI_SUBSCRIBESV`           | `<node><vd><obj><sv><rate 32-bit, ms>`                               |
| `0x8A` | `DI_UNSUBSCRIBESV`         | `<node><vd><obj><sv><0 32-bit>`                                      |
| `0x8B` | `DI_VENUE_PRESET_RECALL`   | `<data>` — venue preset number (32-bit)                              |
| `0x8C` | `DI_PARAM_PRESET_RECALL`   | `<data>` — parameter preset number (32-bit)                          |
| `0x8D` | `DI_SETSVPERCENT`          | `<node><vd><obj><sv><percentage>`  (× 65536 scaling)                 |
| `0x8E` | `DI_SUBSCRIBESVPERCENT`    | `<node><vd><obj><sv><rate, ms>`                                      |
| `0x8F` | `DI_UNSUBSCRIBESVPERCENT`  | `<node><vd><obj><sv><0>`                                             |
| `0x90` | `DI_BUMPSVPERCENT`         | `<node><vd><obj><sv><±percentage>`  (+ = up, − = down)               |
| `0x91` | `DI_SETSTRINGSV`           | `<node><vd><obj><sv><variable-length data*>`  (≤ 32 chars, App. F)   |

`<rate>` for the subscribe opcodes is **subscription period in
milliseconds** — *"a value of 50 will produce meter updates at a rate
of 20 updates per second."* Meter rate floor is governed by the
device's internal scheduler.

## Standard SV IDs (gain object)

| SV ID | Field      |
|-------|------------|
| `0`   | Gain (dB)  |
| `1`   | Mute       |
| `2`   | Polarity   |

Meter objects, IO objects, mixers etc. have their own SV maps —
Appendix B (meters) and Appendix G (full table) of the DI Kit are
canonical. Examples from Appendix G: Cobranet Bundle = `0x11` /
`0x12` / `0x13` / `0x14` for inputs, `0x15`-`0x18` for outputs.

## Data Encoding (Appendix A summary)

### Percent scaling (`DI_SETSVPERCENT` / `DI_BUMPSVPERCENT`)

```
ValueToSend = PercentageValue * 65536
```

Examples from the DI Kit:

| Percentage | Raw 32-bit         | Hex                           |
|------------|--------------------|-------------------------------|
| 10 %       | 655360             | `0x00 0x0A 0x00 0x00`         |
| 12.5 %     | 819200             | `0x00 0x0C 0x80 0x00`         |
| 50 %       | 3276800            | `0x00 0x32 0x00 0x00`         |

### Gain (dB) scaling for `DI_SETSV` on a gain object

The DI Kit provides a piecewise scaling table — controls expose values
in dB at the wire level. The DI message tool in London Architect
generates the exact byte string for any value; copying that from the
serial-toolbar pane is the recommended way to discover scaling for any
specific object.

### Scalar linear, delay (ms), frequency (Hz)

Each uses a fixed multiplication factor for fractional precision; see
Appendix A of the Rev 2.6 DI Kit for tables.

## Example Raw Packets

From the DI Kit, setting a gain object's gain to **0 dB**:

```
0x02 0x88 0x01 0x0F 0x1B 0x83 0x00 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x84 0x03
 STX  SET  ─node─  ─vd─*  ────object 24────  ──sv 16──  ────data 32 bit────  CK  ETX
```

`0x1B 0x83` is the escape-substituted `0x03` (vd byte). `0x84` is the
post-substitution checksum.

A second example for setting a different SV:

```
0x02 0x88 0x08 0xAD 0x1B 0x83 0x00 0x00 0x11 0x00 0x00 0x00 0x00 0x00 0x00 0x3F 0x03
```

Both are verbatim from the *DI Kit — Rev 2.6 — Section 5*.

## Subscription Model

Send `DI_SUBSCRIBESV` with `<rate, ms>` and the device will push
`DI_SETSV`-shaped frames at the requested cadence reflecting the
current SV value.

**Reliability quirk (DI Kit Appendix C, Q1):**

> *"My Soundweb London devices are sending me updates once a second,
> regardless of the subscription rate and even when I have
> unsubscribed."*
> *"It is the comms part of the system that is still trying to deliver
> a message on a retry basis."*

The device assumes the controller will ACK at the comms layer (which
worked over the original Soundweb's RS-232 ACK/NAK). On TCP, the
device sees TCP-level ACKs and is satisfied; on a TCP socket that's
been closed uncleanly the device will retry once a second until the
session times out.

## ACK / NAK (RS-232 only)

| Byte | Sent by | Meaning |
|------|---------|---------|
| `0x06` ACK | device | message received, checksum valid |
| `0x15` NAK | device | bad checksum or framing — controller should retransmit |

TCP does not use these — *"TCP provides it automatically."*

## Error Frames

There is no explicit application-layer error opcode in the DI protocol.
Malformed messages on RS-232 are answered with NAK; on Ethernet they
are silently discarded (the device closes the TCP socket if the framing
violation is severe enough). Verify outcomes by subscribing to the
target SV and checking the echo.

## SV ID Conventions (Quick Reference)

- All controllable processing objects live under **virtual device
  `0x03`**.
- Object IDs are **assigned by Audio Architect when the configuration
  is compiled** — they are NOT vendor-fixed; only the SV IDs within an
  object class are vendor-fixed.
- The Audio Architect property pane → "HiQnet Address" field is the
  authoritative source; copy bytes 3-5 of the full 6-byte address as
  the 24-bit object value.
- SV ID is shown at the bottom of the property pane (decimal).
