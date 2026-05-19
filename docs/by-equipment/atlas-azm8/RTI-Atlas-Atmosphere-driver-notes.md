# RTI — Atlas Atmosphere Driver (v2.22)

**Source:** https://driverstore.rticontrol.com/driver/atlas-atmosphere-1
**Driver:** Atlas Atmosphere (current generation — the older `atlas-atmosphere` driver is deprecated)
**Driver Version:** 2.22

Useful third-party reference confirming Atmosphere protocol behavior + a couple of integrator-only gotchas that don't appear in the AtlasIED docs. Not the authoritative protocol spec.

---

## Driver Overview

The Atlas Atmosphere driver enables RTI control systems to manage AtlasIED AZM4 / AZM8 digital audio processors via Ethernet.

## Connection Details

| Setting | Default |
|---|---|
| Protocol | IP (TCP) — the JSON-RPC protocol on port 5321 documented in `AZM4-AZM8-third-party-control-protocol.md` |
| Default Address | 192.168.1.100 |
| Default Port | **5321** (configurable on device) |
| Authentication | **Third-party control must be enabled** on the AZM (Settings → Third Party Control → General → Enable) |

## Supported Devices

- AZM4 and AZM8 audio processors
- **Minimum AZM firmware: 4.0.5.6386** (this driver does not support older firmware — earlier driver `atlas-atmosphere` covered older revisions and is now deprecated)

## Key Features & Commands

The driver provides control over:

- **Gain control** for zones, mixes, and sources
- **Mute control** for zones, mixes, and sources
- **Source selection** across configured inputs (Sources 1-14 supported)
- **Scene recall** functionality
- **Raw commands** for extended functionality (analog to `Passthru` in the Crestron module)
- **Group management** across configured groups

## Parameters

Configuration requires specifying the actual configured counts on the AZM:

- Number of sources
- Number of groups
- Number of mixes
- Number of zones

Parameter IDs map to device identifiers found on the AZM under **Settings → Third Party Control → Message Table** — the same table referenced in §5 of the AtlasIED protocol manual.

---

## Known Issues & Workarounds (driver-specific — not in AtlasIED spec)

- **AZM4 group IDs offset by -4** — add 4 to the displayed ID for the Parameter ID field. (Driver indexing quirk; the underlying AZM uses its normal indexes.)
- **Sources 11-14 support added in v2.22** — earlier driver versions supported only Sources 1-10
- **Accessory A-D source assignments unavailable** — driver cannot directly assign sources to the four accessory bus-port slots (A, B, C, D on the AZM8). Workaround: configure these on the AZM web UI.
- **Driver v2.21+ requires driver re-addition for proper scene synchronization** — when upgrading from <2.21, remove and re-add the driver instance so scene names re-sync from the AZM.

---

## System Requirements

- RTI Integration Designer: **11.2+**
- XP Firmware: **22.3.31+**
- Tested on: XP-3 with firmware 23.5.11

---

## Support

Remote Technologies Inc.
+1 952-253-3100
`support@rticontrol.com`

---

## Cross-references in this codebase

- The driver default port 5321 confirms our `packages/atlas` client's port.
- The "Sources 1-14" limit is the AZM4/AZM8 maximum source count (the Third Party Message Table indexes start at 0, so 14 sources means `Source_0` .. `Source_13`).
- The driver's reliance on **firmware 4.0.5.6386+** — most Atmosphere installs in the field are now on 4.0+; the Custom Priority Volume feature in 4.5 (see `Atmosphere-firmware-release-notes.md`) operates regardless of which third-party controller is in use.
