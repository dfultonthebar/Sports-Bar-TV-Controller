# AtlasIED Atmosphere AZM4 / AZM8 — Physical I/O, Scenes, Priority System

**Source:** https://www.atlasied.com/ATS006332_Atmosphere_User_Manual_RevE.pdf
**Document:** Atmosphere User Manual, Rev E
**Applies to:** AZM4, AZM8, AZMP4, AZMP8 (same platform, varying I/O counts and amplification)

This is a curated extract of the sections most relevant for third-party integration (physical I/O specs, the Zone Priority page, Scenes, Routines, GPIO, accessories). For the full ~125-page manual, see the source PDF.

---

## 1. Product Overview

The AtlasIED Atmosphere family consists of zone-based DSP + control system processors aimed at restaurants, bars, hospitality, retail, fitness, and worship venues.

- **AZM4** – 4 independently controlled zones, 6 input / 4 output configuration
- **AZM8** – 8 independently controlled zones, 10 input / 8 output configuration
- **AZMP4 / AZMP8** – AZM4 / AZM8 + built-in flexible amplification (600W / 1200W)
- **AZM4-D / AZM8-D / AZMP4-D / AZMP8-D / AZMP8-DW** – Dante variants

Plug-and-play smart wall plate accessories include three audio input accessories (balanced mic/line A-XLR, dual RCA stereo summed A-RCA with 3.5mm, A-BT Bluetooth wall plate input), two controller accessories (C-V single-zone volume; C-ZSV multi-zone with source select, scene recall, message recall), and an ambient noise sensor (X-ANS) for Ambient Noise Compensation and Loud Noise Detection.

Up to 8 accessories can daisy-chain from a single bus port. Up to 16 accessories total per AZM. Maximum cable length AZM → last accessory in the chain is 1000 ft (305 m).

---

## 2. Physical I/O Summary

|              | AZM4                    | AZM8                    |
|---|---|---|
| Mic / Line Inputs (Euroblock)  | 4 | 6 (8 with future models — see note) |
| Line Outputs (Euroblock)       | 4 | 8 |
| High Priority Inputs (Euroblock)| 1 | 1 |
| RCA stereo summed inputs       | 2 | 2 |
| Accessory ports (RJ45 bus)     | A, B (2) | A, B, C, D (4) |
| GPI Inputs                     | 6 (plus 1 High-Priority) | 12 (plus 1 High-Priority) |
| GPO Outputs                    | 2 | 2 |
| Network Port                   | 1 (RJ45) | 1 (RJ45) |
| WiFi                           | Built-in (Access Point or Client) | Built-in (Access Point or Client) |

**Balanced Mic / Line Inputs:** Accepts Unbalanced Inputs: Yes
**Balanced Line Outputs:** Maximum Output Level: +20 dBu (7.75 Vrms)
**Dynamic Range (S/N):** >108 dB Unweighted 20 Hz – 20 kHz, >110 dB "A" Weighted
**Input DSP:** Gate, De-Esser, Compressor, Auto Gain, Gain, Mixer, Priority Router
**Output DSP:** Ambient Noise Compression, Limiter
**High Priority Input:** Capable of Internal Pull-up to 5VDC via User Interface

---

## 3. GPIO

### GPI Inputs

The general-purpose inputs on a 12-way Euroblock are configurable to:
- Recall a routine
- Recall a scene
- Trigger message playback
- Run a bell schedule
- Trigger a GPO preset
- Combine room

### High Priority "HP" Input

1 x Terminal "F" High Priority "HP" input function. The High-Priority input can:
- Mute all zones
- Set all zones and group levels
- Lock and alert accessory controllers
- Play a message one time or on a repeated basis

The High-Priority input bypasses all normal priority routing — it is **permanently set to the highest priority in every zone**.

### GPO Outputs

2 x GPO Control Outputs (GPO-1 & GPO-2). Voltage triggers individually named and assignable in **GPIO Outputs** page and configured in **Output Presets** page. The Output Presets page includes 5 types of voltage trigger settings: **Logic H, Logic L, Toggle, Pulse H, Pulse L**, with adjustable Pulse Time from 0.1–10.0 sec. Common "C" terminal for output ports 1 & 2.

---

## 4. Zone Priority Page (per-zone priority routing)

> *From Atmosphere User Manual page 30 — "Zone - Priority"*

The Input Priority page allows you to rank audio sources for each zone by importance to mitigate a conflict where two sources try to play at the same time. **The higher priority source will always play over the lower priority source.**

1. **The High Priority GPI is permanently set to the highest priority.**
2. **Message Player** — select the "swap" button to arrange whether Msg Player or RMS Ducker has higher priority after GPI HP input. The top selection is highest priority.
3. **Priority Input Source Selection and Priority Threshold** — when the selected priority input source's RMS levels exceed the priority threshold, the priority source will **duck the normal input source channels**.
4. **Zone routed sources are permanently set to lowest priority.**
5. The ducker dynamic settings are common for all channels and are adjustable here and also accessible via Settings → Device Settings.
6. **Priority input status indicator** — lights yellow when the priority source is actively ducking the main source. Grey when inactive.

### Effective per-zone priority order (top → bottom)

```
1. High Priority GPI (always wins)
2. Message Player  OR  RMS Ducker (Priority Input)   ← order swappable in UI
3. RMS Ducker      OR  Message Player                ← whichever wasn't picked above
4. Additional Priority Level (added in v4.0)
5. Zone routed source (the bartender-selected source — always lowest)
```

### Custom Priority Volume (firmware 4.5+)

Each priority level can now bypass the current Zone volume status in favor of a **custom fixed level**. This pins the zone gain to a configured value when the priority event fires, instead of the bartender-set gain. Operator-impact reminder: this can look identical to a "drop" event when seen by an external monitoring system — see this codebase's CLAUDE.md §7 and `feedback_atlas_firmware_4_5_custom_priority_volume.md`.

---

## 5. Scenes Overview

The Scenes tab lets you add a name and save a group of settings that can be recalled by name. **Max 20 scenes per AZM.**

Scenes can be recalled in the following ways:

- By using the Scene UI to select it by name, then select Recall Scene
- By setting it up as a GPIO Trigger Scene
- By setting it up as a Scheduled Event in the scheduler
- By triggering a scene from a C-ZSV controller
- By adding and selecting it in a virtual wall controller
- By third-party `set RecallScene_N` command (TCP 5321 — see protocol doc)

### What a Scene captures

For each output zone (you can enable/disable each zone in the scene):
- Enable / disable inclusion of the zone in this scene
- Apply source — yes/no, and which audio source
- Apply gain — yes/no, and what gain value
- Apply mute — yes/no, and what mute state
- Apply group combine state for any saved group (only applies if the group is currently combined; if not combined, this part of the scene is ignored)

### How `RecallScene` interacts with priority

A `RecallScene` action does **not bypass the priority router** — it sets the zone's source and gain. If a priority source is currently active in that zone, the priority source continues to duck the newly recalled source, and the scene's gain becomes the new "normal" level the priority will duck against. The High-Priority GPI continues to override.

---

## 6. Routines Overview

A **Routine** is a saved bundle of up to-20 grouped Actions (Scenes, Messages, GPO Presets, Bell Schedule Recalls, Room Combines) recalled or "run" as a single Action. **Max 20 routines per AZM.**

Triggers:
- GPIO Trigger Routine
- Scheduled Event in the scheduler
- C-ZSV controller Actions tab
- Virtual wall controller Actions tab
- Third-party `set RecallRoutine_N` command

---

## 7. Accessories

Up to 8 accessories per bus port (chained via CAT5e / CAT6 non-shielded), up to 16 accessories total per AZM (4 or 8). One audio wall plate (A-XLR, A-RCA, or A-BT) per bus-port maximum. Max 8 X-ANS ambient noise sensors per AZM.

### Audio input accessories

- **A-XLR** — Balanced mic/line XLR wall plate input
- **A-RCA** — Dual RCA stereo summed wall plate with 3.5mm input
- **A-BT** — Bluetooth audio wall plate input (Stereo by default from firmware 3.0)

### Control accessories

- **C-V** — Single-zone volume control. From firmware 4.0+ can control individual Mix Inputs.
- **C-ZSV** — Volume + Source Select + Scene Recall + Message Recall (24-detent push button encoder; programmable Actions tab)
- **C-T4 / C-T4BT** (firmware 4.5+) — Touch controller with volume slider and programmable buttons; -BT adds Bluetooth audio
- **X-ZPS** — Plug-and-play paging station with 4.3" touchscreen + microphone; supports Zone Paging, Group Paging, All Call Paging, built-in pre-announcement chimes
- **X-ANS** — Ambient Noise Sensor (drives Auto-ANC + Loud Noise Detection)

---

## 8. Network Configuration

- Default: DHCP via back-panel Ethernet RJ45
- Built-in WiFi can be set to **Access Point mode** (broadcasts `AtlasIED_AZM` SSID by default, password `AtlasIED`) or **Client mode** (joins existing WiFi)
- Default login: `admin` / `admin` (must be changed on first login)
- The AZM displays its current IP on the front-panel screen
- Third-party control is enabled at **Settings → Third Party Control → General → Enable**
- DNS configurable from firmware 4.1+

---

## 9. User Roles

- **Admin** — full control
- **Planner** — full control over adding, editing, deleting bells and other scheduled events (Scenes, Messages, Routines)
- **Zone Control** — change sources, volumes, and mute state in any zone; can recall Actions
- Additional access levels configurable per accessory

---

## 10. Actions, Triggers, and the Action Model

The AZM4 and AZM8 have numerous capabilities called **Actions**. An Action is defined as either:

- A **Scene**
- A **Message** playback
- A **GPO Preset**
- A **Bell Schedule Recall**
- A **Room Combine** (Group activate/deactivate)
- *(firmware 4.5+)* An **IP Command** — outbound TCP/UDP to a third-party device

Each Action can be recalled by any one of these **Triggers**:

- Web UI
- Wall controller (C-V, C-ZSV)
- Virtual wall controller (mobile QR code)
- GPI input
- Scheduled event
- Third-party command via TCP 5321 (`set RecallScene_N`, `set RecallRoutine_N`, `set PlayMessage_N`, `set RecallGpoPreset_N`)
- Other accessories (X-ZPS paging station, etc.)

This Action/Trigger separation is why our codebase prefers `RecallScene` for "snap to known good state" (e.g. the dbx ZonePRO failsafe-mode escape — recall Scene 1) instead of trying to reproduce zone gain + source + mute + group state with individual `set ZoneGain_*`, `set ZoneSource_*`, etc. commands. The atomic recall avoids the brief window where partial state is visible.

---

## 11. Power / Mounting

- AC Power Input — IEC connector, 100-240VAC ~ 50-60 Hz, universal power supply
- 1RU rack-mount form factor
- Front-panel: Push-button encoder for menu navigation; bar-graph display

---

## 12. References

- Third-party protocol details: [`AZM4-AZM8-third-party-control-protocol.md`](./AZM4-AZM8-third-party-control-protocol.md)
- Firmware version-by-version feature list: [`Atmosphere-firmware-release-notes.md`](./Atmosphere-firmware-release-notes.md)
- Crestron integration module reference: [`Crestron-Atlas-Atmosphere-command-processor-help.md`](./Crestron-Atlas-Atmosphere-command-processor-help.md)
- RTI driver reference: [`RTI-Atlas-Atmosphere-driver-notes.md`](./RTI-Atlas-Atmosphere-driver-notes.md)
- Full PDF (cached during research): `/tmp/atlas-pdfs/atmosphere-user-manual.pdf` (21.6 MB)
