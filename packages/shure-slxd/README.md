# @sports-bar/shure-slxd

TypeScript Node.js client + RF interference monitoring for the **Shure SLX-D** wireless microphone receiver family (SLXD4, SLXD4D, SLXD24, **SLXD24D**, SLXD14, SLXD14D). Drives the receiver's documented ASCII line protocol on TCP port 2202.

Built specifically for sports-bar deployments adjacent to a stadium where mobile broadcast (ENG) rigs and other event-day RF traffic step on the bar's wireless mic frequencies and false-trigger the Atlas audio processor's priority/page bus. The watcher (`apps/web/src/lib/shure-rf-watcher.ts`) labels each `atlas_priority_events` row as RF-induced when telemetry from this package shows interference at the corresponding moment, so operators stop chasing ghost overrides.

---

## Quick start

```typescript
import { getShureSlxdClient } from '@sports-bar/shure-slxd'

const client = await getShureSlxdClient('rcv-main', {
  ipAddress: '192.168.x.y',
  port: 2202,                  // optional, defaults to spec value
  receiverName: 'Holmgren bar mics',
  autoReconnect: true,
})

await client.startMetering(1_000)   // 1 Hz SAMPLE pushes

client.on('stateChange', (channel, state) => {
  console.log(`ch${channel} RSSI=${state.rssiDbm}dBm TX=${state.txType}`)
})
```

The same `getShureSlxdClient(id, config)` call from any Next.js route bundle returns the same managed instance — see `shure-slxd-client-manager.ts` and CLAUDE.md Gotcha #10 (globalThis singleton).

---

## Protocol reference (SLX-D specific)

Full Shure spec: <https://pubs.shure.com/command-strings/SLXD/en-US> · PDF mirror: <https://shop.ccisolutions.com/StoreFront/jsp/pdf/SHU-SLXD_commandStrings.pdf>

### Framing

Every message is `< VERB CHAN PROP VAL... >` — literal `< ` (less-than + space) at the start, ` >` (space + greater-than) at the end, single ASCII space between tokens. ASCII encoding, no multi-byte. String values that may contain spaces are wrapped in `{…}` curly braces — e.g. `CHAN_NAME {Lead Vocal}`. No line breaks inside a message.

Outbound and inbound use the same framing. The receiver may coalesce multiple frames into one TCP packet, or split one frame across packets — the parser scans for `<`/`>` boundaries and only dispatches complete frames. Don't assume one frame per `recv()`.

### Properties (this is the complete SLX-D property set)

**Receiver scope** — channel index `0`:

| Property | Ops | Format | Range | Notes |
|---|---|---|---|---|
| `FW_VER` | GET, REP | `{x.y.z}` ASCII ≤24 chars | e.g. `{2.1.5}` | |
| `DEVICE_ID` | GET, REP | `{name}` ASCII ≤8 chars | user-set | |
| `RF_BAND` | GET, REP | ASCII ≤8 chars | `G58`, `H55`, `J52`, etc. | read-only |
| `MODEL` | GET, REP | ASCII ≤32 chars | `SLXD4`, `SLXD4D` | read-only |
| `LOCK_STATUS` | GET, REP | enum | `OFF`, `MENU`, `ALL` | front-panel lock |
| `FLASH` | GET, SET, REP | enum | `ON`, `OFF` | flashes whole rx, auto-off ~30s |

**Per-channel scope** — channel index `1` or `2` (`0` = all on GET only):

| Property | Ops | Format | Range / units | Notes |
|---|---|---|---|---|
| `CHAN_NAME` | GET, SET, REP | `{name}` ASCII ≤31 chars | display name | |
| `METER_RATE` | GET, SET, REP | 5-digit int | `0` = off, `50`–`60000` ms | per-channel |
| `AUDIO_GAIN` | GET, SET, REP | 2-digit int, offset −18 | raw `0`–`60` ⇒ −18 to +42 dB | `INC`/`DEC` supported |
| `GROUP_CHAN` | GET, REP | `xx,yy` in `{…}` | `--,--` if manual freq | read-only |
| `FREQUENCY` | GET, SET, REP | 6-digit int (kHz) | e.g. `537125` = 537.125 MHz | retunes immediately, audio click |
| `AUDIO_OUT_LVL_SWITCH` | GET, REP | enum | `MIC`, `LINE` | rear-panel switch — read-only |
| `TX_TYPE` | GET, REP | enum | `SLXD1`, `SLXD2`, `UNKNOWN` | UNKNOWN = TX off |
| `TX_BATT_BARS` | GET, REP | 1-digit | `0`–`5`, `255` = unknown | |
| `TX_BATT_MINS` | GET, REP | int | minutes; `65535`/`65534`/`65533` = sentinels | lithium TX only |

**Bulk-only** — inside `SAMPLE` messages only:
- `audPeak` — `sample[3] − 120 = dB` (peak audio level)
- `audRms` — `sample[4] − 120 = dB` (RMS audio level)
- `rfRssi` — `sample[5] − 120 = dBm` (combined RSSI; SLX-D has no per-antenna A/B split)

**NOT in SLX-D** (don't probe — confirmed absent from the protocol): `AUDIO_MUTE`, `ENCRYPTION`, `INTERFERENCE`, `RF_INT_DET`, `IP_ADDR`, `MAC_ADDR`, `SUBNET`, `GATEWAY`, `RX_NAME` (use `DEVICE_ID`), `RX_GAIN`, `SQUELCH`, `RF_LATENCY`, `AUDIO_LATENCY`, `RF_TX_LOCK`, `LOCK_PANEL` (use `LOCK_STATUS`), `BRIGHTNESS`, `LED_ENABLE`, `IDENTIFY` (use `FLASH`), `REBOOT`, `RESET`, `IR_PRESET`, `RF_BITMAP` (compute client-side from RSSI thresholds), all TX_* lock/power/mute fields, all `BATT_*` lithium telemetry beyond `BARS` and `MINS`.

### SAMPLE format (SLX-D)

```
< SAMPLE <ch> ALL <audPeak> <audRms> <rfRssi> >
```

Three numeric fields after the `ALL` flags token. Field order is **fixed**. AD/ULX/QLX use a different layout — don't reuse this parser across families. One SAMPLE per channel per `METER_RATE` tick (SLXD24D at 1000 ms = 2 SAMPLEs/sec).

### REP-on-change

Always on, no subscription. After `< GET 0 ALL >` floods the cache, any property change pushes a REP (from any source — front panel, web UI, third-party control, your own SET echoes back). Each property change emits its own frame — no batching, no length cap, expect ~12+ REPs back-to-back after a scene recall.

### Connection model

- **TCP port 2202**, ASCII.
- **Firmware ≥ 1.1.0** required for network control. The pre-flight check probes `FW_VER` and fails if older. Older receivers don't reply to `< GET 0 FW_VER >` at all so the gate is effectively self-enforcing too.
- Multiple concurrent clients allowed (~3+ documented, design for graceful failure on 5th).
- **Receiver SILENTLY DROPS** invalid/malformed/out-of-range commands. No `ERR`/`NAK` frame exists in the protocol. Validate via the matching REP echo if you need certainty.
- 30s heartbeat with 60s deadline matches the production Bitfocus reference; the receiver-side idle timeout is undocumented.
- Subscriptions (METER_RATE) do **NOT** survive reconnect — re-issue on every connect.
- **METER_RATE choice (1000 ms in this codebase):** Bitfocus recommends a 5000 ms baseline because very low rates can lock the receiver's web UI. We use **1000 ms** for game-day RF interference detection — fast enough to catch a ghost-carrier signature within ~3 samples (3 s), slow enough not to lock the receiver's web admin UI per the Bitfocus HELP guidance. Spec range is 50-60000 ms.

### Front-panel gate (CRITICAL — first-install checklist)

The receiver's front panel: `Menu → Advanced → Network → Allow Third-Party Controls → Enable`. Defaults to **BLOCKED** on new units, and can reset to BLOCKED after a firmware update. Without this enabled, port 2202 accepts the TCP connection but **silently drops every command** — looks like a network problem but isn't. If you see "connected, no state cache populating" after the seed GET, this gate is the #1 suspect.

### Frequency bands (US)

- **G58** — 470-514 MHz (most common US SKU)
- **H55** — 514-558 MHz (post-auction, less common)
- **J52** — 558-602 MHz and 614-616 MHz (other common US SKU)

Always read `RF_BAND` at startup and clamp `SET FREQUENCY` to the band; don't hardcode. Out-of-band SETs are silently dropped (see "silent drop" above).

### Auto Scan over network: **NOT POSSIBLE**

Group Scan / Channel Scan / Frequency Scan are front-panel-only or Wireless Workbench-only. No network command exists. As of 2026 Shure has added no protocol command for remote scan on SLX-D. For automated coordination you must either drive the front panel via IR or speak to WWB6 in its own (proprietary) protocol — not TCP 2202.

The software-side workaround in this package: maintain a per-band candidate-frequency table in the DB, briefly hop with `setFrequencyMhz()` while watching RSSI on each candidate, pick the lowest-noise one. **Causes an audible click on every hop** — make it a manual-trigger button ("Find clean frequency"), not automatic mid-event.

---

## Interference-detection heuristic

The receiver exposes no native "interference active" flag. We infer interference from telemetry signatures documented across Shure's troubleshooting series + RF Venue's "Top 3 Wireless Microphone Problems":

| Signature | Telemetry pattern | Confidence |
|---|---|---|
| **Co-channel interference** | `TX_TYPE = UNKNOWN` (no pilot decoded) AND `rssiDbm ≥ -85 dBm` for ≥3 consecutive samples | High — implemented |
| **TX out of range** | `TX_TYPE` present, RSSI smooth fade `-70 → -95 dBm` over seconds | Medium |
| **TX battery dead / off** | `TX_TYPE` snaps present → UNKNOWN instantly, RSSI snaps to noise floor | High |
| **Adjacent-channel bleed** | `TX_TYPE` present, RSSI high (`> -60 dBm`) and stable, audio artifacts | Hard to detect from telemetry alone — needs spectrum scan |
| **Multipath / antenna issue** | One antenna RSSI drops, the other stays — **N/A on SLX-D**, RSSI is combined |

The implemented `ACTIVATE_RSSI_DBM = -85` floor and `DEACTIVATE_RSSI_DBM = -95` hysteresis are the values RF Venue and Shure converge on for ghost-carrier detection on an unsquelched receiver.

---

## RF coordination cheatsheet (the SME briefing the codebase is built on)

**For a 2-mic SLXD24D**: both mics in the **same Group, different Channels**. The pre-defined Group is calculated to be IM-free; using different groups generates 3rd-order intermod products in-band.

**Pre-event workflow** (Shure's documented order — do not deviate):
1. Power OFF all mics (otherwise scan sees your own TX as interference).
2. Power ON all other RF noise sources that'll be present at showtime (TVs, LED walls, kitchen video, Wi-Fi).
3. Front panel → Group Scan on receiver 1 → walks all Groups, picks the one with most clear channels, assigns Channel 1.
4. For each additional receiver, set to the SAME Group, then Channel Scan to pick a different free channel.
5. IR Sync each TX: hold TX IR window within ~6 in of receiver's IR sensor, press Sync — frequency/name/encryption key transfer in ~1 sec.

**Pre-game recommendation**: rescan 30 min before doors, 1 hr before kickoff, with TVs on.

**Mid-event mitigation playbook** (tactical, <60 sec):
1. Confirm RF (not battery) — check TX battery LED first.
2. Swap to backup mic if paired.
3. Front-panel **Channel Scan** → picks next clear channel in same Group.
4. IR Sync TX to the new frequency.
5. Resume.

**The Lambeau ENG-truck scenario** (specific to Green Bay locations): ENG trucks run Part 74 licensed wireless at **250 mW** (5× our Part 15 50 mW), coordinated by the NFL GDC. The coordinated frequency list is NOT public — your only mitigation is rescan-on-kickoff with TVs on. SBE (Society of Broadcast Engineers) local frequency coordination is the formal path if it becomes recurring.

**SLX-D+** (2025 announcement) adds automatic interference detection + frequency change via ShowLink, with 2-5 sec auto-recovery. Out of scope for current SLX-D hardware but worth noting as an upgrade path.

---

## Dedicated log file

The watcher writes RF events to a **daily-rotating dedicated log file** separate from the main PM2 log, at `/home/ubuntu/sports-bar-data/logs/shure-rf-YYYY-MM-DD.log`. Operator request 2026-05-17 — RF history can be diffed across game days without grepping the entire app log. 30-day retention. Format:

```
ISO_TS | LEVEL | receiverId | ch | event | rssi_dbm | freq_mhz | tx_type | note
```

Writes are mirrored through `@sports-bar/logger` so they still surface in `pm2 logs`. The dedicated file is the source of truth for RF auditing.

---

## Architecture: why a `globalThis` singleton

Next.js App Router compiles each `apps/web/src/app/api/**/route.ts` into its own server bundle. A module-private `private static instance` field on `ShureSlxdClientManager` would yield ONE manager per bundle, each owning its own TCP socket to the receiver. Symptom: the bartender remote and admin Audio tab read different stale caches because their bundles' manager instances are listening on different sockets.

Fix: hoist the singleton to `globalThis` via `Symbol.for('@sports-bar/shure-slxd/ShureSlxdClientManager.instance')`. Every bundle's lookup hits the same slot. Per-key in-flight `Promise` lock closes the race window between two concurrent `getClient(K)` calls passing the map.get check before either could insert. Same approach + same incident history as `@sports-bar/atlas` — see CLAUDE.md Gotcha #10.

---

## Related project docs

- **Architecture / surface area:** `CLAUDE.md` §7a — how this package
  plugs into the watcher + dedicated log file + Atlas-correlation +
  bartender banner + admin tab.
- **Per-version setup runbook:** `docs/VERSION_SETUP_GUIDE.md` — the
  v2.34.0 entry has the operator's first-install checklist (VLAN,
  front-panel gate, firmware, add via Device Config).
- **API endpoints exposed:** `docs/API_REFERENCE.md` — `/api/shure-rf`
  (history), `/api/shure-rf/status` (live snapshot),
  `/api/shure-rf/preflight` (ADMIN-gated probe).
- **Per-release notes:** `docs/LOCATION_UPDATE_NOTES.md` — entries from
  v2.34.0 through v2.34.2 describe what shipped + what to verify
  post-update.

---

## References

**Spec & official docs:**
- [Shure SLX-D Command Strings (canonical HTML)](https://pubs.shure.com/command-strings/SLXD/en-US)
- [Shure SLX-D Command Strings (PDF mirror)](https://shop.ccisolutions.com/StoreFront/jsp/pdf/SHU-SLXD_commandStrings.pdf)
- [Shure SLX-D User Guide](https://pubs.shure.com/guide/SLXD/en-US)
- [Shure SLX-D Frequency Compatibility addendum](https://content-files.shure.com/Pubs/slx/slxd-digital-freq-compatibility-addendum.pdf)
- [Shure IP Ports and Protocols](https://content-files.shure.com/FileRepository/common-ip-ports-v2.pdf)
- [Shure WWB6 Ports and Protocol Information](https://service.shure.com/s/article/wwb6-ports-and-protocol-information)
- [Shure Service KB — Groups and Channels](https://service.shure.com/s/article/What-Are-Groups-and-Channels)
- [Shure Service KB — Scan function recommended method](https://service.shure.com/s/article/scan-function-recommended-method)
- [Shure Service KB — What is Squelch on a wireless receiver](https://service.shure.com/s/article/what-is-squelch-on-a-wireless-receiver)
- [Shure — Troubleshooting Wireless Dropouts in 10 Simple Steps](https://www.shure.com/en-US/performance-production/louder/troubleshooting-wireless-dropouts-10-simple-steps)
- [Shure — All About Wireless: Intermodulation Distortion](https://www.shure.com/en-US/insights/all-about-wireless-intermodulation-distortion)
- [Shure — Five Golden Rules for Antenna Placement](https://www.shure.com/en-MEA/insights/five-golden-rules-wireless-audio-antenna-placement)
- [Shure — Wireless Frequency Finder](https://www.shure.com/en-US/support/tools/frequency-finder)
- [FCC — Wireless Microphones (Part 15 vs Part 74)](https://www.fcc.gov/wireless/bureau-divisions/broadband-division/wireless-microphones)

**Reference implementation (production-tested, MIT-licensed):**
- [bitfocus/companion-module-shure-wireless](https://github.com/bitfocus/companion-module-shure-wireless) — the only public SLX-D client that's been battle-tested in live shows worldwide. Used as the protocol cross-reference for this package.

**RF coordination & deeper reading:**
- [RF Venue — Top 3 Wireless Microphone Problems](https://www.rfvenue.com/blog/2014/12/15/the-top-three-wireless-microphone-problems-and-how-to-solve-them)
- [RF Venue — Understanding and Avoiding Intermodulation Distortion](https://www.rfvenue.com/blog/2014/12/13/understanding-and-avoiding-intermodulation-distortion)
- [RF Venue — Dropouts Explored](https://www.rfvenue.com/blog/2014/12/14/dropouts-explored)
- [ProSoundWeb — Illuminating the Dark Art: A Practical Step-By-Step Guide to Success With Wireless RF](https://www.prosoundweb.com/illuminating-the-dark-art-a-practical-step-by-step-guide-to-success-with-wireless-rf/)
- [Shure — Eliminating Wireless Microphone Interference with Antenna Diversity](https://www.shure.com/en-US/insights/eliminating-wireless-microphone-interference-with-antenna-diversity)

**Sibling reference (QLX-D, GPL-3.0 — design ideas only, do not port code):**
- [kevinschmidtaudio/shure](https://github.com/kevinschmidtaudio/shure) — Python QLX-D parser; useful for the `< VERB CHAN PROP >` tokenization shape and the change-detection-emit pattern. Has neither reconnect nor frame accumulator — both bugs we close in our implementation.

---

## Glossary

- **Dropout** — brief audio loss from RF reasons (range, multipath, interference).
- **Squelch** — RSSI threshold below which receiver mutes; "open" = audio, "closed" = muted.
- **RF lockout** — receiver refuses to unmute at high RSSI because pilot/encryption handshake fails. Classic co-channel interferer signature.
- **Pilot tone** — sub-audible signal embedded in TX carrier; receiver mutes if missing.
- **Coordinated group** — pre-computed set of frequencies that are intermod-free with each other.
- **Intermod-free set** — same idea, the actual working set you deploy.
- **Walkthrough scan / walk test** — operator walks the venue with a live TX while watching RSSI for dead zones.
- **Diversity reception** — two antennas + auto-switch to defeat multipath. (SLX-D does this internally; combined RSSI is reported.)
- **Front-end overload** — receiver input amp saturated by too-close TX, causing distortion.
- **3rd-order IM (IM3)** — dominant intermod product class; strongest and closest to carriers.
- **ERP** (Effective Radiated Power) — antenna gain × TX power; what other receivers see.
- **BAS / Part 74** — licensed broadcast wireless (ENG trucks).
- **Part 15** — unlicensed off-shelf wireless (us; consumer mics).
- **ShowLink** — Shure's UHF telemetry-back-to-receiver protocol on AD/SLX-D+; not on classic SLX-D.
