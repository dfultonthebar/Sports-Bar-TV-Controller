# Stoneyard Appleton Location Details

**Branch:** `location/stoneyard-appleton`
**Market:** Appleton, WI
**Cable Provider:** Spectrum (Appleton market)
**Timezone:** America/Chicago
**Rail Media userId:** TBD (`SPORTS_GUIDE_USER_ID` in `.env` — inherit from main ecosystem.config.js default until a per-location key is issued)

## Matrix: Wolf Pack FM36S (WP-36X36)

- **IP:** 10.40.10.101
- **TCP port:** 5000 (control), **HTTP port:** 80
- **Gateway:** 10.40.10.254 / **Subnet:** 255.255.255.0 (/24)
- **Credentials:** admin / admin (default; change via matrix admin UI if hardened)
- **Chassis ID:** `wp-stoneyard-combined`

Layout and chassis params cloned verbatim from the Stoneyard Greenville sister install. Same hardware model, same network design. If you're touching anything matrix-related also look at `.claude/locations/` for whatever sister branch is most current — both Stoneyards are kept in sync.

### Input Map

| Input | Device | Control | Details |
|-------|--------|---------|---------|
| 1 | Cable 1 | IR via iTach 10.40.10.90 port 1 | Spectrum cable, IR codes cloned from Greenville |
| 2 | Cable 2 | IR via iTach 10.40.10.90 port 2 | Spectrum cable |
| 3 | Cable 3 | IR via iTach 10.40.10.90 port 3 | Spectrum cable |
| 4 | Cable 4 | IR via iTach 10.40.10.91 port 1 | Spectrum cable |
| 5 | Chive TV | IR via iTach 10.40.10.91 port 2 | Apple TV (IRDevice `ir-cable-5`, deviceType=`streaming-device`, brand=Apple) |
| 6 | Amazon 1 | IP/ADB | Fire TV Cube @ 10.40.10.92:5555 |
| 7 | Amazon 2 | IP/ADB | Fire TV Cube @ 10.40.10.93:5555 |
| 8 | Amazon 3 | IP/ADB | Fire TV Cube @ 10.40.10.94:5555 |
| 9 | Wallplate | HDMI passthrough | Wolfpack wallplate, no device control |
| 10–32 | (unused/inactive) | — | — |
| 33–36 | Matrix Audio 1–4 | Audio breakaway | Feeds Atlas AZMP8 matrix inputs |

Input 5 is labeled **"Chive TV"** (Appleton) where Greenville calls the same physical device **"Atmosphere"**. Both point at the same kind of hardware — an Apple TV driven over IR from the shared iTach at `.91` port 2.

Input 6 spreadsheet cell originally read "IR" but the address (`10.40.10.92`) is a Fire Cube device IP, not an iTach. Treated as ADB/IP like inputs 7–8.

### Output Map (20 TVs + 4 audio)

| Range | Label | Notes |
|-------|-------|-------|
| 1–20 | TV 1 — TV 20 | 20 Samsung TVs at `10.40.10.1` – `10.40.10.20`, port 8001 (SmartThings). MAC addresses and authToken unknown — will be populated by first browser-auth pairing + discovery run. |
| 21–32 | Empty | Inactive in `MatrixOutput` |
| 33–36 | Matrix Audio 1–4 | `audioOutput='audio'`, feeds Atlas AZMP8 matrix-audio inputs |

**TV brand is Samsung here (not LG like Greenville)** — this is the only significant TV-side difference from Greenville. See "Gotchas" below.

## Audio: AtlasIED AZMP8

- **Name:** Stoneyard Appleton AZMP8
- **IP:** 10.40.10.102, HTTP port 80, TCP control port 5321
- **Gateway:** 10.40.10.254 / **Subnet:** /24
- **Credentials:** `admin` / (see `AudioProcessor.password` column — cloned from Greenville's `6809233DjD$$$`; spreadsheet initial said `6809233djdan`, reconcile at first test-connection if the processor rejects auth)
- **Zones:** 8 total (150W per zone, 1200W total, Phoenix + RCA inputs + 4 matrix-audio internal buses)

### Audio Zones (Atlas outputs)

| Zone | Name | Physical grouping |
|------|------|-------------------|
| 1 | Main Bar 1 | Main Bar area speakers |
| 2 | Main Bar 2 | Main Bar area speakers |
| 3 | Main Bar 3 | Main Bar area speakers |
| 4 | Main Bar 4 | Main Bar area speakers |
| 5 | Main Bar 5 | Main Bar area speakers |
| 6 | Dining Room 1 | Dining area speakers |
| 7 | Dining Room 2 | Dining area speakers |
| 8 | Outside | Patio/exterior |

Operator's zone intent per the install spreadsheet: outputs 1–5 grouped as "Main Bar", 6–7 as "Dining Room", 8 as "Outside". Map to AudioGroups if the hardcoded zone→group split ever needs to be tweaked.

### Audio Source Map

| Atlas input | Source |
|-------------|--------|
| 5 | Juke Box (local) |
| 6 | Spotify (streaming) |
| 7 | Matrix Audio 1 ← Wolfpack output 33 |
| 8 | Matrix Audio 2 ← Wolfpack output 34 |
| 9 | Matrix Audio 3 ← Wolfpack output 35 |
| 10 | Matrix Audio 4 ← Wolfpack output 36 |

## IR Control Hardware

Two Global Cache iTach IP2IR units, each exposes 3 IR emitter ports at `$IP:4998`:

| Device ID | Name | IP | Port assignments |
|-----------|------|-----|------------------|
| `gc-10-40-10-90` | Global Cache 1 | 10.40.10.90 | Port 1→Cable 1, Port 2→Cable 2, Port 3→Cable 3 |
| `gc-10-40-10-91` | Global Cache 2 | 10.40.10.91 | Port 1→Cable 4, Port 2→Chive TV (Apple TV) |

**IR codes for the 4 Spectrum boxes are cloned verbatim from Stoneyard Greenville** — 31 commands per box × 4 boxes = 124 `IRCommand` rows. Same cable-box hardware, so the learned codes are identical. The Chive TV (Apple TV) has no IR codes yet — needs to be learned on first physical access via Device Config → IR → "Learn IR".

## Network Infrastructure Summary

| Device | IP | Notes |
|--------|----|----|
| Wolf Pack FM36S Matrix | 10.40.10.101 | Video switching |
| Atlas AZMP8 | 10.40.10.102 | Audio processor |
| iTach 1 (Global Cache 1) | 10.40.10.90 | 3 IR ports |
| iTach 2 (Global Cache 2) | 10.40.10.91 | 2 IR ports used |
| Fire TV Cube 1 | 10.40.10.92 | Input 6 |
| Fire TV Cube 2 | 10.40.10.93 | Input 7 |
| Fire TV Cube 3 | 10.40.10.94 | Input 8 |
| Samsung TVs 1–20 | 10.40.10.1 – 10.40.10.20 | Port 8001 (SmartThings) |
| Gateway | 10.40.10.254 | /24 |

## Cable channel reference

Channel presets seeded from Greenville (62 cable + 54 DirecTV). Key WI RSN numbers verified present:
- **40** → "Fan Duel" (FanDuelWI / FSWI — Bucks, general WI)
- **308** → "Bally Sports WI" (BallyWIPlus — Brewers overflow)

Appleton Spectrum and Green Bay Spectrum are same NE-Wisconsin market; presets should be correct. Local broadcast station numbers (WBAY, WFRV, WGBA, WLUK) are unverified for Appleton specifically — validate during first-day bartender testing.

## Gotchas

- **Samsung TVs require first-run pairing.** Each TV at 10.40.10.1–.20 needs a one-time SmartThings handshake to populate `NetworkTVDevice.authToken`. Without that, power/volume/input control via the bulk-power route returns "pairing required". Do this from the UI → Device Config → Network TVs → "Authorize" on each TV.
- **Atlas password mismatch risk.** Cloned Greenville's stored password. If the operator's written-down value (`6809233djdan`) is the real one, update via Audio Processor UI → Edit → password field, then test-connection.
- **Chive TV IR codes not cloned.** Greenville called its input-5 device "Atmosphere"; we renamed to "Chive TV" but kept the same IR command set as a placeholder. The Chive TV Apple TV will need its own IR codes learned. The cable-box IR codes would not work against it (different manufacturer).
- **Sister-location parity.** This install was cloned from Greenville's 2026-04-10 UI backup commit (`ab7ac092` on `origin/location/stoneyard-greenville`). If Greenville's hardware changes in a way that should propagate here, the process is: Greenville UI-backup → inspect delta → apply to Appleton manually. Do NOT merge branches.
