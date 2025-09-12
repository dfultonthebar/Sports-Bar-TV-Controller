# Sports Bar TV Controller - Hardware Requirements & Recommendations

## 📋 Overview

This document provides detailed hardware requirements and recommendations for deploying the Sports Bar TV Controller system in a professional sports bar environment.

## 🖥️ Control System Hardware

### Primary Control Computer

#### Minimum Requirements
- **CPU**: Intel i3 or AMD Ryzen 3 (2+ cores, 2.4GHz+)
- **RAM**: 4GB DDR4
- **Storage**: 64GB SSD
- **Network**: Gigabit Ethernet
- **OS**: Ubuntu 22.04 LTS support

#### Recommended Specifications
- **CPU**: Intel i5-12400 or AMD Ryzen 5 5600G (6+ cores, 3.0GHz+)
- **RAM**: 16GB DDR4-3200
- **Storage**: 512GB NVMe SSD
- **Network**: Dual Gigabit Ethernet (redundancy)
- **Power**: UPS backup power supply

#### Recommended Hardware Models

**Intel NUC Series** (Recommended)
```
Model: Intel NUC 12 Pro (NUC12WSHi5)
- CPU: Intel Core i5-1240P (12 cores, up to 4.4GHz)
- RAM: 16GB DDR4-3200 SO-DIMM
- Storage: 512GB M.2 NVMe SSD
- Network: 2x Gigabit Ethernet, WiFi 6E
- Size: 4.6" x 4.4" x 1.4"
- Power: 90W external adapter
- Price: ~$600-800
```

**Alternative: Raspberry Pi 4** (Budget Option)
```
Model: Raspberry Pi 4 Model B (8GB)
- CPU: ARM Cortex-A72 quad-core 1.8GHz
- RAM: 8GB LPDDR4
- Storage: 128GB microSD Class 10 + USB 3.0 SSD
- Network: Gigabit Ethernet, WiFi 5
- GPIO: 40-pin for hardware integration
- Price: ~$200-300 complete setup
```

**Enterprise Option: Dell OptiPlex**
```
Model: Dell OptiPlex 7090 Micro
- CPU: Intel Core i5-11500T (6 cores, up to 3.9GHz)
- RAM: 16GB DDR4-3200
- Storage: 512GB M.2 NVMe SSD
- Network: Gigabit Ethernet, WiFi 6
- Warranty: 3-year ProSupport
- Price: ~$800-1200
```

### UPS and Power Management

**Recommended UPS Systems**
```
APC Smart-UPS SMC1500-2U
- Capacity: 1500VA/900W
- Runtime: 15-30 minutes at full load
- Features: Network management, LCD display
- Rack mount: 2U form factor
- Price: ~$400-500

CyberPower CP1500PFCLCD
- Capacity: 1500VA/1000W
- Runtime: 10-20 minutes at full load
- Features: Pure sine wave, LCD display
- Desktop/tower form factor
- Price: ~$200-300
```

## 📺 Display Hardware

### Commercial Displays

#### Recommended TV Models

**Samsung QM Series** (Professional)
```
Model: Samsung QM75R 75" 4K Commercial Display
- Resolution: 3840x2160 (4K UHD)
- Brightness: 500 nits
- Network: Ethernet, WiFi, RS-232
- Control: Samsung MagicInfo, REST API
- Mounting: VESA 600x400
- Warranty: 3-year commercial
- Price: ~$2000-2500
```

**LG UM Series** (Professional)
```
Model: LG 75UM3E 75" 4K Commercial Display
- Resolution: 3840x2160 (4K UHD)
- Brightness: 500 nits
- Network: Ethernet, WiFi, RS-232
- Control: LG webOS, REST API
- Features: 24/7 operation rated
- Price: ~$1800-2200
```

**Sony FW Series** (Professional)
```
Model: Sony FW-75BZ40H 75" 4K Commercial Display
- Resolution: 3840x2160 (4K UHD)
- Brightness: 700 nits (high brightness)
- Network: Ethernet, WiFi
- Control: Sony Pro Bravia API
- Features: Android TV platform
- Price: ~$2500-3000
```

#### Consumer TV Options (Budget)

**Samsung TU Series**
```
Model: Samsung TU8000 75" 4K Smart TV
- Resolution: 3840x2160 (4K UHD)
- Network: Ethernet, WiFi
- Control: Samsung SmartThings API
- Features: Tizen OS, voice control
- Price: ~$800-1200
```

### Display Mounting

**Wall Mounts**
```
Chief XTM1U X-Large Tilt Mount
- VESA: Up to 800x600
- Weight: Up to 250 lbs
- Tilt: +15° to -5°
- Price: ~$200-300

Peerless ST680 Tilt Mount
- VESA: Up to 800x600
- Weight: Up to 300 lbs
- Tilt: +15° to -5°
- Price: ~$150-250
```

**Ceiling Mounts**
```
Chief CMS440 Ceiling Mount
- VESA: Up to 800x600
- Weight: Up to 250 lbs
- Adjustment: Tilt, swivel, rotate
- Price: ~$400-600
```

## 🎵 Audio System Hardware

### Audio Processors

**DBX ZonePro Series** (Recommended)
```
Model: DBX ZonePro 1260m
- Inputs: 12 analog, 8 digital
- Outputs: 6 analog zones
- Control: Ethernet, RS-232, USB
- Features: DSP, feedback suppression, auto-mixing
- Rack: 1U rackmount
- Price: ~$2000-2500
```

**BSS Audio Soundweb London**
```
Model: BSS BLU-806
- Inputs: 8 analog
- Outputs: 6 analog
- Control: Ethernet (Dante network)
- Features: Advanced DSP, CobraNet
- Rack: 1U rackmount
- Price: ~$3000-4000
```

### Amplifiers

**Crown XTi Series**
```
Model: Crown XTi 6002
- Power: 2100W @ 4Ω per channel
- Channels: 2
- Control: Ethernet, USB
- Features: DSP, protection circuits
- Rack: 2U rackmount
- Price: ~$800-1200
```

**QSC GX Series**
```
Model: QSC GX7
- Power: 725W @ 8Ω per channel
- Channels: 2
- Features: Lightweight, reliable
- Rack: 2U rackmount
- Price: ~$400-600
```

### Speakers

**Ceiling Speakers**
```
JBL Control 24CT
- Power: 70V/100V transformer
- Frequency: 65Hz-20kHz
- Size: 8" woofer, 1" tweeter
- Installation: Drop ceiling mount
- Price: ~$150-200 per pair
```

**Wall Speakers**
```
Bose FreeSpace DS 40SE
- Power: 8Ω/70V/100V
- Frequency: 58Hz-16kHz
- Size: 4.5" full-range driver
- Installation: Surface mount
- Price: ~$200-300 per pair
```

## 🎮 Streaming Device Hardware

### Amazon Fire TV

**Fire TV Cube** (Recommended)
```
Model: Fire TV Cube (3rd Gen)
- Resolution: 4K Ultra HD, HDR10+
- Processor: Hexa-core 2.2GHz + 1.9GHz
- RAM: 2GB
- Storage: 16GB
- Network: WiFi 6, Ethernet adapter available
- Control: Alexa voice, IR, HDMI-CEC
- Price: ~$140
```

**Fire TV Stick 4K Max**
```
Model: Fire TV Stick 4K Max
- Resolution: 4K Ultra HD, HDR10+
- Processor: Quad-core 1.8GHz
- RAM: 2GB
- Storage: 8GB
- Network: WiFi 6
- Control: Voice remote, mobile app
- Price: ~$55
```

### Apple TV

**Apple TV 4K** (Premium Option)
```
Model: Apple TV 4K (3rd Gen)
- Resolution: 4K Ultra HD, HDR10+, Dolby Vision
- Processor: A15 Bionic chip
- RAM: 4GB
- Storage: 64GB/128GB
- Network: WiFi 6, Gigabit Ethernet
- Control: Siri Remote, iOS app
- Price: ~$180-200
```

### Roku

**Roku Ultra**
```
Model: Roku Ultra (2022)
- Resolution: 4K Ultra HD, HDR10+, Dolby Vision
- Processor: Quad-core ARM
- RAM: 1GB
- Storage: 256MB + microSD slot
- Network: WiFi 5, Ethernet
- Control: Voice remote, mobile app
- Price: ~$100
```

## 🔌 Video Distribution Hardware

### HDMI Matrix Switchers

**Atlona AT-UHD-EX-70-2PS** (Recommended)
```
Specifications:
- Matrix: 8x8 HDMI
- Resolution: 4K@60Hz 4:4:4
- Distance: Up to 230ft over Cat6
- Control: Ethernet, RS-232, IR
- Features: EDID management, CEC
- Rack: 1U rackmount
- Price: ~$3000-4000
```

**Extron DXP 84 HDMI 4K**
```
Specifications:
- Matrix: 8x4 HDMI
- Resolution: 4K@60Hz 4:2:0
- Control: Ethernet, RS-232
- Features: Advanced EDID, audio embedding
- Rack: 1U rackmount
- Price: ~$2500-3500
```

**Monoprice Blackbird 4K** (Budget)
```
Specifications:
- Matrix: 8x8 HDMI
- Resolution: 4K@60Hz 4:2:0
- Control: IR, RS-232
- Features: Basic switching
- Rack: 2U rackmount
- Price: ~$800-1200
```

### HDMI Extenders

**Atlona AT-UHD-EX-70C-KIT**
```
Specifications:
- Distance: Up to 230ft over Cat6
- Resolution: 4K@60Hz 4:4:4
- Features: PoE, bidirectional IR
- Installation: Wall-mount transmitter/receiver
- Price: ~$400-500 per set
```

## 🌐 Network Infrastructure

### Network Switches

**UniFi Dream Machine Pro** (All-in-One)
```
Specifications:
- Ports: 8x Gigabit + 2x 10G SFP+
- Features: Router, firewall, controller
- PoE: PoE+ available on select ports
- Management: UniFi Network Controller
- Rack: 1U rackmount
- Price: ~$400-500
```

**Netgear GS728TP** (Managed Switch)
```
Specifications:
- Ports: 24x Gigabit PoE+ + 4x 10G SFP+
- PoE Budget: 380W
- Features: VLAN, QoS, SNMP
- Management: Web interface
- Rack: 1U rackmount
- Price: ~$600-800
```

### Wireless Access Points

**UniFi Access Point WiFi 6**
```
Model: UniFi U6 Pro
- Standard: WiFi 6 (802.11ax)
- Speed: Up to 5.3 Gbps
- Coverage: Up to 6,000 sq ft
- Power: PoE+ (802.3at)
- Management: UniFi Network Controller
- Price: ~$180-220
```

### Network Cables

**Cat6a Ethernet Cable**
```
Specifications:
- Category: Cat6a (10 Gigabit rated)
- Length: Various (50ft, 100ft, 150ft)
- Shielding: STP (Shielded Twisted Pair)
- Connectors: RJ45 gold-plated
- Price: ~$1-2 per foot
```

## 🔧 Installation Hardware

### Rack Equipment

**Network Rack**
```
StarTech 12U Wall Mount Rack
- Size: 12U (21" deep)
- Features: Locking door, cable management
- Weight capacity: 200 lbs
- Installation: Wall mount
- Price: ~$200-300
```

**Equipment Rack**
```
Middle Atlantic ERK-2725
- Size: 27U (25" deep)
- Features: Adjustable rails, ventilation
- Weight capacity: 1000 lbs
- Installation: Floor standing
- Price: ~$800-1200
```

### Cable Management

**Cable Trays**
```
Panduit Wyr-Grid Cable Tray
- Material: Steel with powder coat
- Sizes: 4", 6", 12" widths
- Features: Snap-on fittings
- Installation: Ceiling/wall mount
- Price: ~$50-100 per 10ft section
```

**Conduit**
```
Carlon ENT Flexible Conduit
- Material: Non-metallic
- Sizes: 1/2", 3/4", 1"
- Features: Flexible, easy installation
- Use: In-wall cable runs
- Price: ~$0.50-1.00 per foot
```

## 💰 Budget Planning

### Small Sports Bar (4-6 TVs)
```
Control System:
- Intel NUC + UPS: $1,000
- Network switch: $300
- WiFi access point: $200

Display System:
- 6x Consumer 65" TVs: $4,800
- 6x Wall mounts: $900
- 3x Fire TV Cube: $420

Audio System:
- Basic mixer/amplifier: $800
- 12x Ceiling speakers: $1,800
- Installation materials: $500

Total: ~$10,720
```

### Medium Sports Bar (8-12 TVs)
```
Control System:
- Intel NUC + UPS: $1,200
- Managed switch: $600
- 2x WiFi access points: $400

Display System:
- 10x Commercial 75" TVs: $20,000
- 10x Wall mounts: $2,000
- 5x Fire TV Cube: $700
- 8x4 HDMI matrix: $3,500

Audio System:
- DBX ZonePro processor: $2,500
- 2x Crown amplifiers: $2,000
- 20x Ceiling speakers: $3,000
- Installation materials: $1,000

Total: ~$36,900
```

### Large Sports Bar (15+ TVs)
```
Control System:
- Dell OptiPlex + UPS: $1,500
- Enterprise switch: $1,200
- 3x WiFi access points: $600

Display System:
- 16x Commercial 75" TVs: $32,000
- 16x Wall/ceiling mounts: $4,000
- 8x Fire TV Cube: $1,120
- 16x8 HDMI matrix: $8,000
- HDMI extenders: $4,000

Audio System:
- BSS Audio processor: $4,000
- 4x Crown amplifiers: $4,000
- 32x Ceiling speakers: $4,800
- Professional installation: $5,000

Network Infrastructure:
- Rack equipment: $2,000
- Cable management: $3,000
- Professional installation: $8,000

Total: ~$83,220
```

## 🔧 Installation Considerations

### Professional Installation
- **Electrical**: Licensed electrician for power runs
- **Network**: Certified network technician for cable runs
- **Audio/Video**: Professional AV installer for equipment setup
- **Permits**: Check local requirements for commercial installations

### Maintenance Contracts
- **Equipment**: Extended warranties on commercial displays
- **Network**: Managed service provider for network monitoring
- **Software**: Support contract for system updates and troubleshooting

### Future Expansion
- **Scalability**: Plan for additional displays and zones
- **Technology**: Consider upgrade paths for 8K, new streaming services
- **Integration**: Plan for additional systems (POS, security, lighting)

---

This hardware guide provides the foundation for a professional sports bar TV control system. Adjust specifications based on your specific venue size, budget, and requirements.
