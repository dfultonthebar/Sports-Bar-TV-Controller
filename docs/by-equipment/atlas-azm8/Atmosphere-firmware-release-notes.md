# AtlasIED Atmosphere — Platform Firmware Release Notes

**Source:** https://www.atlasied.com/ATS007022J-Atmosphere-Firmware-Release-Notes.pdf
**Document:** Atmosphere™ Platform Firmware Release Notes
**Revision:** ATS007022 RevL, 7/25 (©2025 Atlas Sound LP)
**Applies to:** AZM4, AZM8, AZMP4, AZMP8, AZM4-D, AZM8-D, AZMP4-D, AZMP8-D, AZMP8-DW

---

## Version 4.5 (July 2025)

- Support for new control accessories:
  - **C-T4**: Touch controller with volume slider and programmable buttons
  - **C-T4BT**: Touch controller with volume slider, programmable buttons, and Bluetooth audio
- **IP Commands**: new Action type
  - Send TCP/UDP network commands to third party devices
  - Create up to 100 IP Command actions
  - Each IP Command can contain multiple stacked commands, with optional delay
- Introducing advanced **System Logic** customization:
  - Create custom logic based on the status of the system
  - Create nested logic using AND / OR / NOT logic
  - Create custom comparator logic for the following items: **fader level, signal level, mute status, active source, signal clipping, message playing, priority detection, Bluetooth pair state, GPI status, motion detection, paging details**
- **Custom Priority volume levels** ⭐ (this is the feature called out in our memory note `feedback_atlas_firmware_4_5_custom_priority_volume.md`)
  - Each priority level now has the ability to **bypass the current Zone volume status in favor of a custom fixed level**
  - Allows paging, messages, and more to pass through at consistent levels
- GPI can now trigger on both rising and falling edge in a new **"toggle"** state option
- GPI can now trigger an audio Message to **play indefinitely until trigger is false**
- Added **Atlas + Fyne FS series** speaker tunings
- Miscellaneous optimizations, improvements, and fixes

> **Operator-impact note for this codebase** — Custom Priority Volume in 4.5+ pins zone gain to a fixed low level during priority events. The signature (sudden drop to a fixed low level, then snap back) **looks identical to a real Atlas drop event** seen by our drop watcher. ALWAYS check **Atlas GUI → Sources → Priority** for a configured Custom Volume before treating drop spam as a watcher bug. See memory `feedback_atlas_firmware_4_5_custom_priority_volume.md` and the v2.42.1 watcher fix.

---

## Version 4.1 (March 2025)

- DNS network settings now configurable for Ethernet connections
- Additional Atmosphere Cloud telemetries, performance/reliability improvements
- Sound Masking volume control is now adjustable on mobile Virtual Wall Controllers
- Support for AZM/AZMP hardware manufactured after March 2025
- Miscellaneous optimizations, improvements, and fixes

---

## Version 4.0 (October 2024)

- Introducing **Atmosphere Cloud** remote access and monitoring
  - Create custom cloud portal for your organization
  - Directly access AZM web interface from a remote location
  - Dashboard control and monitoring of AZM systems
  - Add multiple users with flexible access rights
  - Fault and incident monitoring with notifications
- **Additional priority input level added to every Zone**
- C-V controllers can now control individual Mix Inputs
- Controller emulators mimic the user interface of C-ZSV and X-ZPS controllers in web GUI
- Miscellaneous optimizations, improvements, and fixes

---

## Version 3.6 (August 2024)

- AS Series added to Speaker Tunings library
- FC Series added to Speaker Tunings library
- Support for new Dante models:
  - **AZM4-D**: 4-zone processor with Dante
  - **AZM8-D**: 8-zone processor with Dante
  - **AZMP4-D**: 4-zone processor with amplification and Dante
  - **AZMP8-D**: 8-zone processor with amplification and Dante
  - **AZMP8-DW**: 8-zone processor with amplification and Dante in on-wall cabinet
- Ability to reorder Actions on controller accessories
- Web GUI communications improved to work with firewalls and tunnel solutions
- Added reverse mode behavior for ANC, and sound masking ANC support
- Miscellaneous optimizations, improvements, and fixes

---

## Version 3.5 (March 2024)

- Increase number of mixes on AZM8/AZMP8 from 4 to 8
- Increase number of Messages from 20 to 100
- Additional language support on QR virtual controllers and X-ZPS paging accessory: German, French, Spanish, Chinese, Korean, Japanese
- **Audio Routes** allows spare outputs to be routed to Zones, Sources, and other tap locations
- Masking Enhanced Privacy support on C-ZSV and X-ZPS accessories
- Option to disallow volume control on all controllers
- Remote Bluetooth Pairing/Disconnect support on QR virtual controllers
- Amplifier Deep Sleep for further power savings (AZMP models only)
- Configuration Import now accepts config files created from all previous firmware versions
- Miscellaneous optimizations, improvements, and fixes

---

## Version 3.1 (July 2023)

- Icon support in GUI for Zones, Sources, and Groups
- Icon support for X-ZPS Paging Stations
- Miscellaneous optimizations, improvements, and fixes

---

## Version 3.0 (May 2023)

- Support for **AZMP4 and AZMP8** amplified system processors
  - Built-in Flexible Amplification: AZMP4 - 600W, AZMP8 - 1200W
  - Integrated intelligence, protection and advanced monitoring
  - All previous AZM features and functions work identically in AZMP powered models
  - Built-in Monitor Speaker
- Support for **X-ZPS Paging Accessory**
  - Plug and Play Paging Station with 4.3" Touchscreen and Microphone
  - Zone Paging, Group Paging, All Call Paging
  - Built-in pre-announcement chimes
  - Full system controller
- **Sound Masking** (Official Release)
  - Pink / White noise, Tilter Filter, traditional GEQ, and Perfect Fit GEQ
  - Weekly Scheduler with daily ramp up / down times
  - Enhanced Privacy supported through GPI and mobile Virtual Wall Controllers
- **System Self Test** and email notification (AZMP only)
  - Automatically put the system through a self test and compare results to initial commissioning results
  - Measure DSP, Amp, and Speaker Load performance
  - Notify system admins of any anomaly
- Automatically create Source when Audio Accessory is connected
- A-BT Bluetooth Accessory can now transmit Stereo audio (now default)
- Streamlined Virtual Wall Controller to only show relevant controls
- Additional API parameters added for individual Mix Sources
- Any Action can now be triggered via Bell Scheduler
- Miscellaneous optimizations, improvements, and fixes

---

## Version 2.8 (November 2022)

- Offline Controller support and matching
- Sound Masking (Beta)
- Support for upcoming AZM models that include an external WiFi connector
- Miscellaneous optimizations, improvements, and fixes

---

## Version 2.7 (September 2022)

- Improved customization of C-ZSV wall controller
- Preparation for accessories built after September 2022
- Miscellaneous optimizations, improvements, and fixes

---

## Version 2.6 (July 2022)

- Startup behavior
- Improved performance of ambient noise sensor (X-ANS)
- Miscellaneous optimizations, improvements, and fixes

---

## Version 2.5 (March 2022)

- **Third party control** ⭐ (introduction of the JSON-RPC TCP 5321 / UDP 3131 protocol documented in `AZM4-AZM8-third-party-control-protocol.md`)
- Loud noise detection
- Tone control added to C-ZSV, and mobile VWC (Virtual Wall Controller)
- Source level control added to C-V, C-ZSV, and mobile VWC
- Video help section added
- Speaker tuning for SHS-3T2 and SHS-LF
- QR code dark theme on C-ZSV
- AtlasIED branded QR codes
- Signal indicators added to channel / port drop-down menus
- Hi-Priority indicator on VWC
- Ability to add notes to days on the calendar in scheduler
- Message length increased from 15 to 30 min
- Tone control added to front panel
- Device power cycle scheduler
- Source level control added to front panel
- Improved Auto-ANC performance
- Miscellaneous optimizations, improvements, and fixes

---

## Version 2.1 (June 2021)

- 24-hour clock support
- Miscellaneous optimizations, improvements, and fixes

---

## Version 2.0 (May 2021)

- Stereo support
- Subwoofer support
- Room combine
- Bell scheduler
- Accessory self-heal
- Routines
- Improved mixes
- Virtual Wall Controller 2.0
- Updated UI
- Updated ZSV
- Miscellaneous optimizations, improvements, and fixes

---

## Version 1.3 (February 2021)

- Manufacturing and hardware maintenance support
- Miscellaneous optimizations, improvements, and fixes

---

## Version 1.2 (November 2020)

- Manufacturing and hardware maintenance support
- Miscellaneous optimizations, improvements, and fixes

---

## Version 1.1 (September 2020) — Initial Release

- Atmosphere Hello World!
- 2x Core DSP Units
- 6x Accessories
- Full Input DSP
- Full Output DSP
- Auto ANC
- Speaker Tunings
- Tilter Filter
- Message Player
- QR-Based Virtual Wall Controller
- Scheduler and Events
- Scenes
- GPIO
- GPI Hi-Priority
- Mixes
- Connection Diagram
- User Accounts
- Web Interface
