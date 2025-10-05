# AtlasIED Atmosphere Physical Configuration Reference

This document provides a visual reference for the physical input/output configurations of all AtlasIED Atmosphere models used in the Sports Bar AI Assistant. High-resolution rear panel images have been downloaded to verify accurate device configuration.

## Image Location
All rear panel images are stored in: `/public/atlas-models/`

## Model Configurations

### 1. AZM4 - 4-Zone Audio Processor
**Image:** `azm4-rear.png` (1280x1280px, 241.7 KB)

**Physical Connections:**
- **Balanced Inputs:** 4x XLR/Phoenix combo inputs (Input 1-4)
- **Unbalanced Inputs:** 2x RCA stereo pairs (Input 5-6)
- **Outputs:** 4x balanced XLR outputs (Zone 1-4)
- **Control:** RS-232, GPIO, Ethernet
- **Power:** IEC power connector

**Configuration Notes:**
- Total of 6 stereo input sources (4 balanced + 2 unbalanced)
- 4 independent zone outputs
- No Dante networking

---

### 2. AZM8 - 8-Zone Audio Processor
**Image:** `azm8-rear.png` (1280x1280px, 165.6 KB)

**Physical Connections:**
- **Balanced Inputs:** 6x XLR/Phoenix combo inputs (Input 1-6)
- **Unbalanced Inputs:** 2x RCA stereo pairs (Input 7-8)
- **Outputs:** 8x balanced XLR outputs (Zone 1-8)
- **Control:** RS-232, GPIO, Ethernet
- **Power:** IEC power connector

**Configuration Notes:**
- Total of 8 stereo input sources (6 balanced + 2 unbalanced)
- 8 independent zone outputs
- No Dante networking

---

### 3. AZMP4 - 4-Zone Signal Processor with 600-Watt Amplifier
**Image:** `azmp4-rear.png` (1920x220px, 206.2 KB)

**Physical Connections:**
- **Balanced Inputs:** 4x XLR/Phoenix combo inputs (Input 1-4)
- **Unbalanced Inputs:** 2x RCA stereo pairs (Input 5-6)
- **Amplified Outputs:** 4x Phoenix speaker outputs (Zone 1-4, 150W per zone)
- **Line Outputs:** 4x balanced XLR line outputs
- **Control:** RS-232, GPIO, Ethernet
- **Power:** IEC power connector with 600W amplifier

**Configuration Notes:**
- Total of 6 stereo input sources (4 balanced + 2 unbalanced)
- 4 zones with integrated 150W amplification per zone
- Includes both amplified speaker outputs AND line-level outputs
- No Dante networking

---

### 4. AZMP8 - 8-Zone Signal Processor with 1200-Watt Amplifier
**Image:** `azmp8-rear.png` (1280x1280px, 209.9 KB)

**Physical Connections:**
- **Balanced Inputs:** 6x XLR/Phoenix combo inputs (Input 1-6)
- **Unbalanced Inputs:** 2x RCA stereo pairs (Input 7-8)
- **Amplified Outputs:** 8x Phoenix speaker outputs (Zone 1-8, 150W per zone)
- **Line Outputs:** 8x balanced XLR line outputs
- **Control:** RS-232, GPIO, Ethernet
- **Power:** IEC power connector with 1200W amplifier

**Configuration Notes:**
- Total of 8 stereo input sources (6 balanced + 2 unbalanced)
- 8 zones with integrated 150W amplification per zone
- Includes both amplified speaker outputs AND line-level outputs
- No Dante networking

---

### 5. AZM4-D - 4-Zone Audio Processor with Dante
**Image:** `azm4-d-rear.png` (1920x400px, 213.6 KB)

**Physical Connections:**
- **Balanced Inputs:** 4x XLR/Phoenix combo inputs (Input 1-4)
- **Unbalanced Inputs:** 2x RCA stereo pairs (Input 5-6)
- **Outputs:** 4x balanced XLR outputs (Zone 1-4)
- **Dante Network:** 2x RJ45 Ethernet ports (Primary & Secondary)
- **Control:** RS-232, GPIO, Ethernet (separate from Dante)
- **Power:** IEC power connector

**Configuration Notes:**
- Total of 6 stereo input sources (4 balanced + 2 unbalanced)
- 4 independent zone outputs
- **Dante audio networking** for digital audio distribution
- Redundant Dante network connections

---

### 6. AZM8-D - 8-Zone Audio Processor with Dante
**Image:** `azm8-d-rear.png` (1920x743px, 250.1 KB)

**Physical Connections:**
- **Balanced Inputs:** 6x XLR/Phoenix combo inputs (Input 1-6)
- **Unbalanced Inputs:** 2x RCA stereo pairs (Input 7-8)
- **Outputs:** 8x balanced XLR outputs (Zone 1-8)
- **Dante Network:** 2x RJ45 Ethernet ports (Primary & Secondary)
- **Control:** RS-232, GPIO, Ethernet (separate from Dante)
- **Power:** IEC power connector

**Configuration Notes:**
- Total of 8 stereo input sources (6 balanced + 2 unbalanced)
- 8 independent zone outputs
- **Dante audio networking** for digital audio distribution
- Redundant Dante network connections

---

## Configuration Verification Checklist

When configuring an AtlasIED Atmosphere device in the Sports Bar AI Assistant, verify:

### Input Configuration
- [ ] Balanced inputs (XLR/Phoenix) are numbered correctly (1-4 or 1-6)
- [ ] Unbalanced inputs (RCA) are numbered correctly (5-6 or 7-8)
- [ ] Total input count matches physical connections
- [ ] Input types (balanced/unbalanced) are correctly identified

### Output Configuration
- [ ] Zone outputs match the model's zone count (4 or 8)
- [ ] Output type is correct (line-level XLR or amplified speaker)
- [ ] For AZMP models: Both amplified AND line outputs are available

### Network Configuration
- [ ] Control network IP address is configured
- [ ] For -D models: Dante network is separately configured
- [ ] For -D models: Primary and secondary Dante ports are identified

### Model-Specific Features
- [ ] Dante capability is only enabled for -D models
- [ ] Amplifier power is only specified for AZMP models
- [ ] Zone count matches model specification (4 or 8)

---

## Common Configuration Patterns

### 4-Zone Models (AZM4, AZMP4, AZM4-D)
- 4 balanced inputs (Input 1-4)
- 2 unbalanced inputs (Input 5-6)
- 4 zone outputs

### 8-Zone Models (AZM8, AZMP8, AZM8-D)
- 6 balanced inputs (Input 1-6)
- 2 unbalanced inputs (Input 7-8)
- 8 zone outputs

### Dante Models (-D suffix)
- All standard inputs/outputs PLUS
- 2x Dante network ports (redundant)
- Separate control network

### Amplified Models (AZMP prefix)
- All standard inputs PLUS
- Integrated amplification (150W per zone)
- Both speaker outputs AND line outputs available

---

## Integration with Sports Bar AI Assistant

The Sports Bar AI Assistant should accurately reflect these physical configurations:

1. **Device Discovery:** Automatically detect model type from network response
2. **Input Mapping:** Map physical inputs to logical sources (DirecTV, Fire TV, etc.)
3. **Zone Control:** Control appropriate number of zones based on model
4. **Dante Integration:** Enable Dante features only for -D models
5. **Amplifier Control:** Show amplifier controls only for AZMP models

---

## Reference Images

All images are accessible at:
- Web path: `/atlas-models/{model}-rear.png`
- File system: `/home/ubuntu/Sports-Bar-TV-Controller/public/atlas-models/{model}-rear.png`

Example usage in web interface:
```html
<img src="/atlas-models/azm4-rear.png" alt="AZM4 Rear Panel" />
```

---

## Document Information

- **Created:** September 30, 2025
- **Purpose:** Physical configuration verification for Sports Bar AI Assistant
- **Image Source:** AtlasIED official website and authorized distributors
- **Image Quality:** High-resolution PNG (1280x1280 to 1920x1920 pixels)

---

## Next Steps

1. Compare these physical configurations with the current device configuration in the Sports Bar AI Assistant
2. Verify that input/output counts match the physical hardware
3. Update device configuration interface to show accurate input/output options
4. Add visual reference images to the configuration UI for easier setup
5. Implement model-specific validation rules based on physical capabilities

