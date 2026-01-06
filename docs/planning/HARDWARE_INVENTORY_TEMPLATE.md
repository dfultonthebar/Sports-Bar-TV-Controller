# Hardware Inventory & Testing Information

**Purpose:** Collect information about available hardware for testing the modular system

**Status:** 🟡 Information Gathering Phase

**Last Updated:** October 30, 2024

---

## Audio Processors

### DBX ZonePro Series

#### Device 1
- **Model Number:** _______________
- **Serial Number:** _______________
- **Firmware Version:** _______________
- **Location:** _______________
- **Connection Type:**
  - [ ] Ethernet
  - [ ] RS-232
  - [ ] Both Available
- **Network Info:**
  - IP Address: _______________
  - Subnet Mask: _______________
  - Gateway: _______________
  - Telnet Port: _______________ (default 23)
- **Credentials:**
  - Username: _______________ (if required)
  - Password: _______________ (if required)
  - [ ] No authentication required
- **Current Usage:**
  - [ ] In Production (can't interrupt)
  - [ ] Test/Dev environment
  - [ ] Available for testing anytime
- **Access:**
  - [ ] Local network access
  - [ ] Remote access (VPN required)
  - [ ] On-site only
- **Documentation Available:**
  - [ ] User manual
  - [ ] Programming guide
  - [ ] Protocol specification
  - [ ] Need to obtain from DBX

#### Device 2 (if applicable)
- **Model Number:** _______________
- [Same fields as Device 1]

### Crestron Audio Processors (if available)

#### Device 1
- **Model Number:** _______________
- **Serial Number:** _______________
- **Firmware Version:** _______________
- **Control Method:**
  - [ ] CIP (Port 41794)
  - [ ] HTTP/REST API
  - [ ] Telnet
  - [ ] Other: _______________
- **Network Info:**
  - IP Address: _______________
  - Control Port: _______________
- **Authentication:**
  - [ ] None required
  - [ ] Username/Password
  - [ ] API Key
  - [ ] Certificate-based
- **Simpl# Program:**
  - [ ] Custom program running
  - [ ] Standard control
  - [ ] Need to upload program
  - Program Name: _______________
- **Documentation Available:**
  - [ ] User manual
  - [ ] Simpl# program code
  - [ ] Protocol specification
  - [ ] Need to obtain from Crestron

---

## Matrix Switchers

### Crestron Matrices

#### Device 1
- **Model Number:** _______________ (e.g., DM-MD8X8, HD-MD4X2-4K-E)
- **Serial Number:** _______________
- **Firmware Version:** _______________
- **Input Count:** _______________
- **Output Count:** _______________
- **Location:** _______________
- **Control Method:**
  - [ ] CIP (Port 41794)
  - [ ] HTTP/REST API
  - [ ] Telnet
  - [ ] RS-232
  - [ ] Other: _______________
- **Network Info:**
  - IP Address: _______________
  - Control Port: _______________
- **Authentication:**
  - Username: _______________
  - Password: _______________
  - [ ] None required
- **Current Usage:**
  - [ ] In Production (can't interrupt)
  - [ ] Test/Dev environment
  - [ ] Available for testing anytime
- **Access:**
  - [ ] Local network access
  - [ ] Remote access (VPN required)
  - [ ] On-site only
- **Features in Use:**
  - [ ] EDID management
  - [ ] HDCP handling
  - [ ] 4K support
  - [ ] Audio embedding/de-embedding
  - [ ] Scaling
- **Simpl# Program:**
  - [ ] Custom program running
  - [ ] Standard control
  - Program Name: _______________
- **Documentation Available:**
  - [ ] User manual
  - [ ] Programming guide
  - [ ] API documentation
  - [ ] Example code
  - [ ] Need to obtain from Crestron

#### Device 2 (if applicable)
- **Model Number:** _______________
- [Same fields as Device 1]

### Current Wolf Pack Matrices (Reference)

#### Device 1
- **Model:** Wolf Pack HDMI Matrix
- **Connection:** Telnet, Port 23
- **Status:** ✅ Currently working in production
- **Command Format:** Text-based (e.g., "SW I01 O01")

---

## Other Hardware (For Reference)

### CEC Control
- **Adapter:** Pulse-Eight USB CEC Adapter
- **Status:** ✅ Working
- **Device Path:** /dev/ttyACM0

### IR Control
- **Device:** Global Cache iTach IP2IR
- **Status:** ✅ Working
- **Protocol:** HTTP API

### Fire TV Devices
- **Status:** ✅ Working
- **Protocol:** ADB over network

### Music Streaming
- **Service:** Soundtrack Your Brand
- **Status:** ✅ Working
- **Protocol:** GraphQL API

---

## Network Information

### Production Network
- **Subnet:** _______________
- **Gateway:** _______________
- **DNS:** _______________
- **VLAN:** _______________ (if applicable)
- **Firewall Rules:** _______________

### Test Network (if separate)
- **Subnet:** _______________
- **Gateway:** _______________
- **Access Method:** _______________

### VPN Information (if required)
- **VPN Type:** _______________
- **Server:** _______________
- **Credentials:** _______________
- **Special Instructions:** _______________

---

## Testing Schedule

### Availability Windows
When can we safely test without disrupting operations?

**DBX ZonePro:**
- Days: _______________
- Time: _______________
- Duration: _______________
- Contact: _______________

**Crestron Matrix:**
- Days: _______________
- Time: _______________
- Duration: _______________
- Contact: _______________

### Testing Contacts

**Primary Contact:**
- Name: _______________
- Role: _______________
- Phone: _______________
- Email: _______________
- Best time to reach: _______________

**Secondary Contact:**
- Name: _______________
- Role: _______________
- Phone: _______________
- Email: _______________

**On-Site Access (if needed):**
- Location Address: _______________
- Contact for Access: _______________
- Security Requirements: _______________

---

## Documentation Collection

### DBX ZonePro Documentation

**Have:**
- [ ] User Manual (PDF/Link): _______________
- [ ] Quick Start Guide: _______________
- [ ] Programming Manual: _______________
- [ ] Command Reference: _______________
- [ ] Protocol Specification: _______________

**Need to Obtain:**
- [ ] _______________
- [ ] _______________

**Where to Get:**
- DBX Website: https://dbxpro.com/en/support
- Support Contact: _______________

### Crestron Documentation

**Have:**
- [ ] User Manual (PDF/Link): _______________
- [ ] Programming Guide: _______________
- [ ] API Documentation: _______________
- [ ] Simpl# Code Examples: _______________
- [ ] Module/Driver: _______________

**Need to Obtain:**
- [ ] _______________
- [ ] _______________

**Where to Get:**
- Crestron Support: https://support.crestron.com
- True Blue Account: _______________
- Support Contact: _______________

---

## Known Issues / Special Considerations

### DBX ZonePro
- Issue/Note 1: _______________
- Issue/Note 2: _______________

### Crestron Matrices
- Issue/Note 1: _______________
- Issue/Note 2: _______________

### Network/Access
- Issue/Note 1: _______________
- Issue/Note 2: _______________

---

## Sample Commands (To Fill In During Testing)

### DBX ZonePro Sample Session
```
[Telnet to device]
> [Record login sequence here]
> [Record sample commands here]
> [Record responses here]
```

### Crestron Sample Session
```
[Connection method]
> [Record authentication here]
> [Record sample commands here]
> [Record responses here]
```

---

## Packet Captures (Optional but Helpful)

If you have existing control software (Crestron Toolbox, DBX System Architect, etc.):

**DBX ZonePro:**
- [ ] Wireshark capture available
- [ ] Control software screenshots
- Location: _______________

**Crestron:**
- [ ] Wireshark capture available
- [ ] Toolbox screenshots
- Location: _______________

---

## Priority & Timeline

### Hardware Priority
Rank in order of importance (1 = highest):
1. _______________
2. _______________
3. _______________
4. _______________

### Target Dates
- Information gathering complete by: _______________
- Ready to start Phase 1 by: _______________
- Target completion date: _______________

### Success Criteria
What needs to work for this to be considered successful?
- [ ] _______________
- [ ] _______________
- [ ] _______________

---

## Notes & Questions

### Questions for Hardware Vendors:
1. _______________
2. _______________
3. _______________

### Open Questions:
1. _______________
2. _______________
3. _______________

### Additional Notes:
_______________
_______________
_______________

---

**Next Steps:**
1. Fill out this document completely
2. Collect all referenced documentation
3. Test network connectivity to devices
4. Schedule testing windows
5. Review with team
6. Update MODULAR_HARDWARE_ROADMAP.md with this info
7. Get approval to proceed with Phase 1

**Completed By:** _______________
**Date:** _______________
