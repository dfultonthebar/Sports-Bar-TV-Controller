# Shure SLX-D Command Strings — Protocol Specification

**Source:** Shure Incorporated, "SLX-D Command Strings", Version 2 (2020-G)
**Primary source URL:** https://www.shure.com/en-US/docs/commandstrings/SLXD
**PDF mirror (used to extract this text):** https://shop.ccisolutions.com/StoreFront/jsp/pdf/SHU-SLXD_commandStrings.pdf
**Full user guide:** https://pubs.shure.com/view/guide/SLXD/en-US.pdf
**Captured:** 2026-05-18
**Confirmed against live Holmgren Way SLXD4D firmware 1.4.7.0** (see CLAUDE.md §7a)

This is the **canonical wire-protocol reference** for the `@sports-bar/shure-slxd` package. When in doubt about a property name, format width, or value range, this document is authoritative for SLX-D firmware up through 1.4.7.0.

---

## 1. Connection

- **Transport:** Ethernet TCP/IP (in AMX/Crestron, select "Client")
- **Port:** **2202**
- All messages are ASCII, including level/gain indicators.
- Network access requires `Menu → Advanced → Network → Allow Third-Party Controls → Enable` on the receiver front panel (default is BLOCKED — the TCP socket will accept the connection but silently drop every command without this gate enabled).

## 2. Frame Format

```
< VERB CHAN PROP VAL >
```

Note: literal angle brackets `<` `>` with **spaces between every token**, including just inside the brackets.

### Verbs

| Verb | Meaning |
|---|---|
| `GET` | Finds the status of a property. Receiver responds with a REP. |
| `SET` | Changes the status of a property. Receiver responds with a REP showing the new value. |
| `REP` | Receiver's reply to GET or SET. **Also sent automatically when most values change** — i.e. on a property change the receiver pushes a REP without prompting. Metered properties are the exception (use SAMPLE). |
| `SAMPLE` | Used for metering audio levels and other periodically-sampled properties. |

### Channel addressing

The character `x` represents the channel as ASCII digit:

| Value | Meaning |
|---|---|
| `0` | All channels |
| `1`, `2`, `3`, `4` | Individual channels (SLXD4D = 2 channels, SLXD4Q = 4 channels) |

### String value wrapping

String values are wrapped in curly braces: `{Lead Vox}`. Receiver pads to the documented fixed width with trailing spaces — e.g. `{Lead Voxyyyyyyyyyyyyyyyyyyyyyyy}` is 31 chars total.

Allowed string charset: ``A-Z, a-z, 0-9, !"#$%&'()*+,-./:;<=>?@[\]^_`~`` and space.

---

## 3. Device-Level Properties (no channel index)

### `ALL` — Discovery
- `< GET x ALL >` → receiver REPs **every** device-level and channel-x-level property, including all metered.
- When `x=0`, dumps everything.

### `FLASH` — Front-panel identify
- `< SET FLASH ON >` / `< REP FLASH ON >` — device-wide identify flash
- `< SET x FLASH ON >` — channel-x identify flash

### `MODEL` — Model name (read-only)
- `< GET MODEL >` → `< REP MODEL {SLXD4yyyyyyyyyyyyyyyyyyyyyyyyyyy} >`
- Always 32 characters, space-padded.

### `DEVICE_ID` — User-set device name
- `< GET DEVICE_ID >` / `< SET DEVICE_ID {Name1} >`
- 8 characters, space-padded. SET accepts 1-8 chars.

### `RF_BAND` — RF band designation (read-only)
- `< GET RF_BAND >` → `< REP RF_BAND {G55yyyyy} >`
- 8 characters, space-padded. Examples of band strings: G55, G58, H55, J50A, J52A.

### `LOCK_STATUS` — Front-panel/RF lock status
- `< GET LOCK_STATUS >` → `< REP LOCK_STATUS ALL >`
- Possible values: `OFF`, `MENU`, `ALL`

### `FW_VER` — Firmware version
- `< GET FW_VER >` → `< REP FW_VER {2.0.15.2yyyyyyyyyyyyyyyy} >`
- 24 characters, space-padded.
- Format: `Maj.Min.Pack.Build`.
- **Self-test failure marker:** a trailing `*` after the version (e.g. `2.0.15.2*`) means the receiver self-test failed.

---

## 4. Channel-Level Properties (require channel index `x`)

### `CHAN_NAME` — Channel name
- `< GET x CHAN_NAME >` / `< SET x CHAN_NAME {Lead Vox} >`
- REP always returns 31-character padded string in `{...}`.
- SET only accepts up to 8 characters (the displayed channel name limit).

### `AUDIO_GAIN` — Channel audio gain
- 3-character numeric, `000`–`060` in 1 dB steps.
- **Offset of 18** — reported value minus 18 = actual dB.
- Actual range: **-18 dB to +42 dB** in 1 dB steps.
- SET supports absolute (`040`), `INC N`, and `DEC N`:
  ```
  < SET x AUDIO_GAIN 40 >          → +22 dB
  < SET x AUDIO_GAIN DEC 5 >       → decrement 5 dB
  < SET x AUDIO_GAIN INC 10 >      → increment 10 dB
  ```

### `AUDIO_OUT_LVL_SWITCH` — Mic/Line output level
- `< GET x AUDIO_OUT_LVL_SWITCH >` → `< REP x AUDIO_OUT_LVL_SWITCH MIC >`
- Values: `MIC` (default) or `LINE`

### `GROUP_CHANNEL` — Group + Channel preset mapping

**This is the wire-protocol property name — NOT `GROUP_CHAN`.** (Holmgren firmware 1.4.7.0 confirmed.)

- `< GET x GROUP_CHANNEL >` → `< REP x GROUP_CHANNEL {1,1yy} >`
- 5-character string in `{...}`, format `Group,Channel`.
- `{--,--}` is the wildcard — means no group/channel preset is set (frequency was set directly). **You cannot SET to `--,--`.**
- Parse on the `,` — Group ID before, Channel ID after.
- Setting GROUP_CHANNEL also pushes a REP for FREQUENCY with the resolved value.

### `FREQUENCY` — Operating frequency
- 7-character numeric string representing **kHz** (e.g. `0578350` = 578.350 MHz).
- **Format note:** 6-digit kHz padded to 7 chars. **Not** 7-digit kHz×100. (`537125` parses as 537.125 MHz.)
- `< SET x FREQUENCY 602125 >` → also reverts `GROUP_CHANNEL` to `{--,--}` since direct frequency overrides the preset.

**FREQUENCY ↔ GROUP_CHANNEL relationship:**
- Setting FREQUENCY directly → GROUP_CHANNEL becomes `{--,--}`.
- Setting GROUP_CHANNEL → corresponding FREQUENCY is reported back.

**FD-C mode:** channels in `FD-C` (frequency-diversity combining) mode have a second pair `FREQUENCY2` / `GROUP_CHANNEL2` with identical semantics.
```
< GET x FD_MODE >
< REP x FD_MODE FD-C >
< GET x FREQUENCY2 >
< REP x FREQUENCY2 0578850 >
```

---

## 5. Metering — Periodic SAMPLE pushes

Metered properties do **NOT** auto-REP on change. You must enable a meter rate, then the receiver pushes SAMPLE frames at that interval.

### `METER_RATE` — Sampling interval
- 5-character numeric in **milliseconds**.
- `00000` = OFF (default)
- `00100` to `65535` valid (100 ms to ~65 sec)
- Bitfocus recommends ≥5000 ms baseline. The Sports-Bar project uses **1000 ms** for game-day RF detection (faster than baseline, slower than the receiver-web-UI-lockup threshold).

```
< SET x METER_RATE 01000 >        → SAMPLE every 1 second
< SET x METER_RATE 00000 >        → OFF
```

### `SAMPLE` — Specify which metered attributes to push
- Composed input groups multiple metered attributes into a single SAMPLE per channel — much more bandwidth-efficient than separate REPs.

```
< SAMPLE chNum ALL audPeak audRms rfRssi >
< SAMPLE 1 ALL 102 102 086 >
```

**Key mapping** (SAMPLE key → underlying property name):

| Key | Property | Width |
|---|---|---|
| `audPeak` | AUDIO_LEVEL_PEAK | 3 chars |
| `audRms` | AUDIO_LEVEL_RMS | 3 chars |
| `rfRssi` | RSSI | 3 chars (per antenna in full GET form) |

### `AUDIO_LEVEL_PEAK` — Peak audio level
- 3-char numeric, `000`-`120` (dBFS).
- **Actual value = reported - 120**.
- Effective range: -120 to 0 dBFS. SLX-D typically reports ~-100 to 0 dBFS.

### `AUDIO_LEVEL_RMS` — RMS audio level
- Same format and offset as AUDIO_LEVEL_PEAK.

### `RSSI` — RF Received Signal Strength
- 3-char numeric, `000`-`120` (dBm).
- **Actual value = reported - 120** dBm.
- Effective range: -120 to 0 dBm.
- **GET form (non-SAMPLE) reports per-antenna:**
  ```
  < GET x RSSI 0 >
  < REP x RSSI 1 083 >        → antenna 1
  < REP x RSSI 2 064 >        → antenna 2
  ```
- **SAMPLE form returns COMBINED RSSI** (no per-antenna A/B split) — SLX-D is the SAMPLE-side combined-RSSI receiver; do not carry ULX-D / QLX-D / AD per-antenna patterns over.

---

## 6. Side Channel — Transmitter telemetry

### `TX_MODEL` — Transmitter model

**This is the wire-protocol property name — NOT `TX_TYPE`.** (Holmgren firmware 1.4.7.0 confirmed.)

- `< GET x TX_MODEL >` → `< REP x TX_MODEL UNKNOWN >`
- Values when a transmitter IS paired and active:
  - `SLXD1` (bodypack)
  - `SLXD2` (handheld)
  - `UNKNOWN` — either no TX paired, TX off, OR an unknown carrier source is on this channel's frequency. The Sports-Bar project's ghost-carrier detection logic uses `TX_MODEL=UNKNOWN AND RSSI ≥ -85 dBm sustained` as the interference signature.

### `TX_BATT_MINS` — Battery runtime in minutes
- 5-char numeric, `00000`-`65535`.
- `00000`-`65532` — actual minutes of runtime remaining
- `65533` — battery communication warning
- `65534` — battery time still calculating
- `65535` — unknown or N/A (e.g. AA alkaline TX, no telemetry chip)

### `TX_BATT_BARS` — Battery bar indicator
- 3-char numeric.
- `000`-`005` — actual bar count (0 = empty, 5 = full)
- `255` — unknown or N/A (e.g. alkaline TX — skip low-battery detection on this value)

---

## 7. Error / Silent-Drop Behavior — Read this before extending the client

**SLX-D does NOT send an ERR frame.** Unlike the iTach protocol (which has explicit ERR_01-27), the SLX-D receiver **silently drops** any malformed or out-of-range command. There is no NAK, no error response, no log.

If you need certainty that a SET succeeded:
1. Issue the SET.
2. Wait for the REP echo of the same property.
3. If no REP arrives within a reasonable window, treat the SET as failed and retry or surface.

---

## 8. Capabilities NOT Present in This Firmware

Network-side RF scanning (Group Scan / Channel Scan / Spectrum Sweep) **does NOT exist** in SLX-D firmware 1.4.7.0. Verified at Holmgren 2026-05-18 by probing 16 candidate command variants — all returned `< REP ERR >`. Shure's own spec also lists no SCAN-related verbs.

Workarounds:
- **Front-panel Group Scan** (manual, on-receiver).
- **Wireless Workbench 6 (WWB6)** — different protocol, scan-capable.
- **`POST /api/shure-rf/find-clean-freq`** — software-side hop through a candidate-frequency list (v2.40.0+). Causes a brief audio click on each hop.

**Do not waste cycles re-probing for SCAN verbs against this firmware.**

---

## 9. Per-Property Quick Index

| Property | GET | SET | REP-on-change | SAMPLE | Width | Notes |
|---|---|---|---|---|---|---|
| ALL | ✓ | — | — | — | — | Bulk discovery |
| FLASH | — | ✓ | ✓ | — | 3 (`ON`/`OFF`) | Identify |
| MODEL | ✓ | — | — | — | 32 chars `{}` | Read-only |
| DEVICE_ID | ✓ | ✓ | ✓ | — | 8 chars `{}` | User-settable |
| RF_BAND | ✓ | — | — | — | 8 chars `{}` | Read-only |
| LOCK_STATUS | ✓ | — | ✓ | — | enum | OFF/MENU/ALL |
| FW_VER | ✓ | — | — | — | 24 chars `{}` | Trailing `*` = self-test fail |
| CHAN_NAME | ✓ | ✓ | ✓ | — | 31 chars `{}` (SET ≤8) | |
| AUDIO_GAIN | ✓ | ✓ | ✓ | — | 3 chars, offset 18 | -18 to +42 dB |
| AUDIO_OUT_LVL_SWITCH | ✓ | — | ✓ | — | enum | MIC / LINE |
| GROUP_CHANNEL | ✓ | ✓ | ✓ | — | 5 chars `{G,C}` | Setting → REPs FREQUENCY |
| FREQUENCY | ✓ | ✓ | ✓ | — | 7-char kHz | Setting → GROUP_CHANNEL `{--,--}` |
| METER_RATE | ✓ | ✓ | ✓ | — | 5 chars ms | 00000 = OFF, ≥100 valid |
| AUDIO_LEVEL_PEAK | ✓ | — | — | ✓ | 3 chars, -120 offset | dBFS |
| AUDIO_LEVEL_RMS | ✓ | — | — | ✓ | 3 chars, -120 offset | dBFS |
| RSSI | ✓ | — | — | ✓ | 3 chars, -120 offset | dBm, SAMPLE = combined |
| TX_MODEL | ✓ | — | ✓ | — | enum | SLXD1 / SLXD2 / UNKNOWN |
| TX_BATT_MINS | ✓ | — | ✓ | — | 5 chars | 65535 = unknown |
| TX_BATT_BARS | ✓ | — | ✓ | — | 3 chars | 0-5; 255 = unknown |

---

## 10. References

- Shure SLX-D Command Strings v2 (2020-G) — primary spec
- Shure SLX-D Publications site: https://pubs.shure.com/guide/SLXD
- WWB6 (Wireless Workbench 6) — Windows app for SLX-D coordination, scan, and offline frequency planning
- Bitfocus Companion `bitfocus-shure-slxd` module — third-party reference implementation (their METER_RATE ≥5000 ms baseline informs our 1000 ms game-day choice)
- Internal package: `packages/shure-slxd/` — Sports-Bar client implementation
- Project CLAUDE.md §7a — operational notes, watcher hysteresis, dedicated log file path
