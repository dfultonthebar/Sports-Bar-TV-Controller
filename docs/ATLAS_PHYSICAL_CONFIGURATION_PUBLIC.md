
# AtlasIED Atmosphere Physical Input/Output Configuration

## Overview

This document provides a detailed reference of the physical inputs and outputs for each AtlasIED Atmosphere audio processor model, based on official specifications and rear panel analysis.

## Model Comparison

### Input Configuration Summary

| Model | Zones | Balanced Inputs | RCA Inputs | Dante Inputs | Matrix Audio | Total Sources |
|-------|-------|----------------|------------|--------------|--------------|---------------|
| **AZM4** | 4 | 4 (Phoenix) | 2 (RCA) | - | 4 | 10 |
| **AZM8** | 8 | 6 (Phoenix) | 2 (RCA) | - | 4 | 12 |
| **AZMP4** | 4 | 4 (Phoenix) | 2 (RCA) | - | 4 | 10 |
| **AZMP8** | 8 | 6 (Phoenix) | 2 (RCA) | - | 4 | 12 |
| **AZM4-D** | 4 | 4 (Phoenix) | 2 (RCA) | 2 (Dante) | 4 | 12 |
| **AZM8-D** | 8 | 6 (Phoenix) | 2 (RCA) | 2 (Dante) | 4 | 14 |

## Detailed Model Specifications

### AZM4 - 4-Zone Audio Processor

**Physical Inputs:**
- **Input 1** - Balanced Phoenix (Priority Input) ⚡
- **Input 2** - Balanced Phoenix ⚡
- **Input 3** - Balanced Phoenix ⚡
- **Input 4** - Balanced Phoenix ⚡
- **Input 5** - Unbalanced RCA (Left) 🔊
- **Input 6** - Unbalanced RCA (Right) 🔊

**Internal Matrix Audio:**
- Matrix Audio 1-4 (Internal routing) 🔄

**Outputs:**
- Zone 1-4 Line-Level Outputs (Phoenix)

**Features:**
- Priority control on Input 1
- Web-based control interface
- RS-232 and TCP/IP control
- 4 audio zones with independent mixing

---

### AZM8 - 8-Zone Audio Processor

**Physical Inputs:**
- **Input 1** - Balanced Phoenix (Priority Input) ⚡
- **Input 2** - Balanced Phoenix ⚡
- **Input 3** - Balanced Phoenix ⚡
- **Input 4** - Balanced Phoenix ⚡
- **Input 5** - Balanced Phoenix ⚡
- **Input 6** - Balanced Phoenix ⚡
- **Input 7** - Unbalanced RCA (Left) 🔊
- **Input 8** - Unbalanced RCA (Right) 🔊

**Internal Matrix Audio:**
- Matrix Audio 1-4 (Internal routing) 🔄

**Outputs:**
- Zone 1-8 Line-Level Outputs (Phoenix)

**Features:**
- Priority control on Input 1
- Web-based control interface
- RS-232 and TCP/IP control
- 8 audio zones with independent mixing

---

### AZMP4 - 4-Zone Signal Processor with 600W Amplifier

**Physical Inputs:**
- **Input 1** - Balanced Phoenix (Priority Input) ⚡
- **Input 2** - Balanced Phoenix ⚡
- **Input 3** - Balanced Phoenix ⚡
- **Input 4** - Balanced Phoenix ⚡
- **Input 5** - Unbalanced RCA (Left) 🔊
- **Input 6** - Unbalanced RCA (Right) 🔊

**Internal Matrix Audio:**
- Matrix Audio 1-4 (Internal routing) 🔄

**Outputs:**
- Zone 1-4 **Amplified** Outputs (150W @ 70V/100V per zone)
- Zone 1-4 **Line-Level** Outputs (Pre-amp)

**Features:**
- Dual outputs per zone (amplified + line-level)
- 600W total amplification (150W per zone)
- Priority control on Input 1
- 70V/100V transformer-isolated outputs

---

### AZMP8 - 8-Zone Signal Processor with 1200W Amplifier

**Physical Inputs:**
- **Input 1** - Balanced Phoenix (Priority Input) ⚡
- **Input 2** - Balanced Phoenix ⚡
- **Input 3** - Balanced Phoenix ⚡
- **Input 4** - Balanced Phoenix ⚡
- **Input 5** - Balanced Phoenix ⚡
- **Input 6** - Balanced Phoenix ⚡
- **Input 7** - Unbalanced RCA (Left) 🔊
- **Input 8** - Unbalanced RCA (Right) 🔊

**Internal Matrix Audio:**
- Matrix Audio 1-4 (Internal routing) 🔄

**Outputs:**
- Zone 1-8 **Amplified** Outputs (150W @ 70V/100V per zone)
- Zone 1-8 **Line-Level** Outputs (Pre-amp)

**Features:**
- Dual outputs per zone (amplified + line-level)
- 1200W total amplification (150W per zone)
- Priority control on Input 1
- 70V/100V transformer-isolated outputs

---

### AZM4-D - 4-Zone Audio Processor with Dante

**Physical Inputs:**
- **Input 1** - Balanced Phoenix (Priority Input) ⚡
- **Input 2** - Balanced Phoenix ⚡
- **Input 3** - Balanced Phoenix ⚡
- **Input 4** - Balanced Phoenix ⚡
- **Input 5** - Unbalanced RCA (Left) 🔊
- **Input 6** - Unbalanced RCA (Right) 🔊

**Dante Network Audio:**
- Dante Input 1-2 (RJ45 network audio) 🌐

**Internal Matrix Audio:**
- Matrix Audio 1-4 (Internal routing) 🔄

**Outputs:**
- Zone 1-4 Line-Level Outputs (Phoenix)
- Dante Output 1-2 (RJ45 network audio)

**Network Ports:**
- 2x Dante network ports (Primary + Secondary for redundancy)
- 2x Control network ports

**Features:**
- Dante network audio integration
- Redundant Dante network
- Priority control on Input 1
- Web-based control interface

---

### AZM8-D - 8-Zone Audio Processor with Dante

**Physical Inputs:**
- **Input 1** - Balanced Phoenix (Priority Input) ⚡
- **Input 2** - Balanced Phoenix ⚡
- **Input 3** - Balanced Phoenix ⚡
- **Input 4** - Balanced Phoenix ⚡
- **Input 5** - Balanced Phoenix ⚡
- **Input 6** - Balanced Phoenix ⚡
- **Input 7** - Unbalanced RCA (Left) 🔊
- **Input 8** - Unbalanced RCA (Right) 🔊

**Dante Network Audio:**
- Dante Input 1-2 (RJ45 network audio) 🌐

**Internal Matrix Audio:**
- Matrix Audio 1-4 (Internal routing) 🔄

**Outputs:**
- Zone 1-8 Line-Level Outputs (Phoenix)
- Dante Output 1-2 (RJ45 network audio)

**Network Ports:**
- 2x Dante network ports (Primary + Secondary for redundancy)
- 2x Control network ports

**Features:**
- Dante network audio integration
- Redundant Dante network
- Priority control on Input 1
- Web-based control interface

---

## Input Type Definitions

### Balanced Inputs (Phoenix Connectors)
- Professional mic/line level inputs
- Phoenix screw terminal connectors
- Differential signal transmission
- Superior noise rejection
- Ideal for: Microphones, professional audio sources, long cable runs
- **Icon:** ⚡

### Unbalanced Inputs (RCA Connectors)
- Consumer-level stereo inputs
- Standard RCA jacks (red/white or L/R)
- Single-ended signal transmission
- Good for short cable runs
- Ideal for: Consumer audio devices, media players, background music sources
- **Icon:** 🔊

### Dante Network Inputs (RJ45)
- Digital audio over IP network
- Standard Cat5e/Cat6 cabling
- Multi-channel, low-latency audio
- Supports redundant network topology
- Ideal for: Distributed audio systems, integration with other Dante devices
- **Icon:** 🌐
- **Only available on: AZM4-D, AZM8-D**

### Matrix Audio (Internal)
- Internal audio routing buses
- Software-configurable mixing
- Can combine multiple inputs
- Useful for complex routing scenarios
- **Icon:** 🔄

---

## Priority Input Feature

**Input 1** on all models has a special **Priority** function:

- Can automatically duck (reduce volume of) other inputs
- Ideal for: Paging systems, emergency announcements, important notifications
- Configurable priority level and duck amount
- Can be configured to completely mute other sources

---

## Output Configurations

### Line-Level Outputs (Non-Amplified Models)
- AZM4, AZM8, AZM4-D, AZM8-D
- Phoenix screw terminal outputs
- Requires external amplification
- +4dBu balanced output

### Amplified Outputs (AZMP Models)
- AZMP4, AZMP8
- **Dual outputs per zone:**
  - **Amplified Output:** 150W @ 70V/100V (Phoenix)
  - **Line-Level Output:** Pre-amp signal for additional amplification
- Transformer-isolated 70V/100V outputs
- Can drive speakers directly or use line output for external amps

---

## Rear Panel Images

All rear panel images are available at:
- `/atlas-models/azm4-rear.png`
- `/atlas-models/azm8-rear.png`
- `/atlas-models/azmp4-rear.png`
- `/atlas-models/azmp8-rear.png`
- `/atlas-models/azm4-d-rear.png`
- `/atlas-models/azm8-d-rear.png`

---

## Configuration Verification Checklist

When configuring an AtlasIED Atmosphere processor in the Sports Bar AI Assistant, verify:

- [ ] Correct number of physical inputs for the model
  - **4-zone models:** 6 total (4 balanced + 2 RCA)
  - **8-zone models:** 8 total (6 balanced + 2 RCA)
  - **-D models:** Add 2 Dante inputs
- [ ] All 4 Matrix Audio buses are available
- [ ] Correct number of zone outputs matches zone count
- [ ] AZMP models show both amplified AND line-level outputs
- [ ] Input 1 is marked as Priority Input
- [ ] RCA inputs are labeled as unbalanced (Input 5-6 for 4-zone, Input 7-8 for 8-zone)
- [ ] Dante inputs only appear on -D models

---

## Sports Bar Application Examples

### Typical Input Assignments

**Sports Bar with AZM8:**
- **Input 1 (Balanced):** Paging microphone (priority)
- **Input 2 (Balanced):** DJ mixer
- **Input 3 (Balanced):** Jukebox/music system
- **Input 4 (Balanced):** Sports TV audio feed 1
- **Input 5 (Balanced):** Sports TV audio feed 2
- **Input 6 (Balanced):** Sports TV audio feed 3
- **Input 7 (RCA):** Background music player (L)
- **Input 8 (RCA):** Background music player (R)

### Zone Assignment Example

- **Zone 1:** Main bar area
- **Zone 2:** Dining room 1
- **Zone 3:** Dining room 2
- **Zone 4:** Patio
- **Zone 5:** Game room
- **Zone 6:** Private dining
- **Zone 7:** Restroom corridor
- **Zone 8:** Kitchen

Each zone can independently select any input source and control volume/EQ.

---

*Document created: September 30, 2025*  
*AtlasIED Atmosphere Audio Processors - Physical Configuration Reference*
