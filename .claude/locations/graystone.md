# Graystone Location Details

**Branch:** `location/graystone`
**Market:** Green Bay, WI
**Cable Provider:** Spectrum/Charter (CEC disabled in firmware — must use IR)
**Rail Media userId:** 258351 (env: `SPORTS_GUIDE_USER_ID`)

## Matrix: Wolf Pack WP-36X36

**IP:** 192.168.5.100

### Input Map

| Inputs | Device | Control Type | Details |
|--------|--------|-------------|---------|
| 1-4 | Cable Box 1-4 | IR (iTach IP2IR) | Spectrum boxes, CEC disabled |
| 5-12 | DirecTV 1-8 | IP control | 192.168.5.121-128 |
| 13-16 | Amazon 1-4 | Fire TV/ADB | 192.168.5.131-134 |
| 17 | Atmosphere | Atlas AZM8 | Audio processor |
| 18-20 | Wall Plate 1-3 | HDMI passthrough | Customer inputs |
| 21-36 | Unused | — | Available for expansion |

### Output Map (24 TVs)

| Room | TVs | Notes |
|------|-----|-------|
| Dining Room | TVs 1-7 | 7 TVs |
| Main Bar | TVs 8-18, 21 | 12 TVs |
| Niagra Room | TVs 19-20 | 2 TVs |
| Redbird Room | TVs 22-24 | 3 TVs |

## IR Control Hardware

- **iTach 1** (ID: `f9d60b91`): Ports 1-3 → Cable Boxes 1-3
- **iTach 2** (ID: `6f5d1b25`): Port 1 → Cable Box 4

## Channel Reference (Spectrum)

| Channel | Number |
|---------|--------|
| ESPN | 27 |
| ESPN2 | 28 |
| TNT | 29 |
| Big Ten Network | 39 |
| FS1 | 75 |

## Channel Reference (DirecTV)

| Channel | Number |
|---------|--------|
| ESPN | 140 |
| ESPN2 | 143 |
| FS1 | 150 |

## Audio

- **Atlas AZM8** processor on matrix input 17
- Provides background audio / Atmosphere channel
