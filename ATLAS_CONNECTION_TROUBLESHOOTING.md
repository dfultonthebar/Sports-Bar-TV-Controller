# Atlas Processor Connection Troubleshooting Guide

## Overview
This guide helps troubleshoot connection issues with AtlasIED Atmosphere audio processors (AZM4, AZM8, AZMP4, AZMP8).

## Common Issues and Solutions

### Issue 1: Invalid IP Address Format (e.g., "192.168.5.0/F90")

**Symptoms:**
- Processor shows as "offline" in red
- IP address displays with unusual suffix like "/F90"
- Connection tests fail immediately

**Root Cause:**
The IP address was entered or stored with an invalid format. The "/F90" suffix is not a valid part of an IP address.

**Solution:**
1. Click the **Test Connection** button (⚡ icon) on the processor card
2. The system will automatically clean the IP address and remove invalid suffixes
3. The cleaned IP address will be saved to the database
4. If connection succeeds, the processor status will update to "online"

**Manual Fix:**
1. Delete the processor with the invalid IP
2. Re-add it with the correct IP address format: `192.168.5.0` (without any suffix)
3. Set the port to `80` for HTTP or `443` for HTTPS

---

### Issue 2: Processor Shows as Offline

**Symptoms:**
- Processor card displays "offline" status badge
- Cannot control zones or access features

**Troubleshooting Steps:**

#### Step 1: Verify Network Connectivity
```bash
# From a computer on the same network, test basic connectivity:
ping 192.168.5.0

# Expected: Replies from the processor
# If timeout: Check physical network connection
```

#### Step 2: Test Web Interface Access
Open a web browser and try accessing:
- `http://192.168.5.0` (HTTP on port 80)
- `https://192.168.5.0` (HTTPS on port 443)

If you can access the web interface, the processor is online but the application cannot connect.

#### Step 3: Check Firewall Settings
Atlas processors use these ports:
- **Port 80**: HTTP web interface (primary)
- **Port 443**: HTTPS/SSL (cloud communications)
- **Port 2**: Control port (RS-232 over IP)

Ensure your firewall allows outbound connections to these ports.

#### Step 4: Verify IP Address Configuration
1. Check the processor's front panel display for the actual IP address
2. Compare with the IP address in the application
3. If different, update the processor configuration with the correct IP

#### Step 5: Use the Test Connection Feature
1. Navigate to Audio Control Center → Atlas System → Configuration
2. Find your processor in the list
3. Click the **⚡ Test Connection** button
4. Review the results:
   - **Success**: Status updates to "online" automatically
   - **Failure**: Check the console for detailed troubleshooting steps

---

### Issue 3: Connection Timeout

**Symptoms:**
- Test connection takes 10+ seconds and fails
- Error message: "Connection timeout - device may be offline or unreachable"

**Possible Causes:**
1. **Network Latency**: Processor is on a different subnet or behind slow routing
2. **Processor Overloaded**: Too many simultaneous connections
3. **Network Congestion**: High traffic on the network

**Solutions:**
1. **Check Network Path**:
   ```bash
   traceroute 192.168.5.0
   # or on Windows:
   tracert 192.168.5.0
   ```
   Look for high latency (>100ms) or packet loss

2. **Restart the Processor**:
   - Power cycle the Atlas processor
   - Wait 60 seconds for full boot
   - Test connection again

3. **Check for Network Loops**:
   - Verify no duplicate IP addresses on the network
   - Check for spanning tree issues if using managed switches

---

### Issue 4: Wrong Port Configuration

**Symptoms:**
- Connection fails even though processor is reachable
- Web interface works in browser but not in application

**Default Ports:**
- **AZM4/AZM8**: Port 80 (HTTP)
- **AZMP4/AZMP8**: Port 80 (HTTP)
- **Cloud-enabled models**: Port 443 (HTTPS)

**Solution:**
1. Edit the processor configuration
2. Try both port 80 and port 443
3. The Test Connection feature automatically tries both protocols

---

### Issue 5: Processor on Different Subnet

**Symptoms:**
- Processor has IP like `192.168.5.x` but your computer is on `192.168.1.x`
- Ping fails or times out

**Solutions:**

#### Option A: Add Static Route (Recommended)
```bash
# On Linux/Mac:
sudo route add -net 192.168.5.0 netmask 255.255.255.0 gw 192.168.1.1

# On Windows (as Administrator):
route add 192.168.5.0 mask 255.255.255.0 192.168.1.1
```

#### Option B: Configure Network Bridge
If both networks are on the same physical infrastructure, configure your router to bridge them.

#### Option C: Change Processor IP
Access the processor's web interface directly (if possible) and change its IP to match your subnet.

---

## Network Configuration Best Practices

### Recommended Setup
1. **Static IP Assignment**: Assign a static IP to the Atlas processor
2. **Reserved DHCP**: If using DHCP, reserve the IP based on MAC address
3. **Same Subnet**: Keep all control devices on the same subnet as the processor
4. **Quality of Service (QoS)**: Prioritize audio traffic if using VLANs

### IP Address Planning
```
Network: 192.168.1.0/24
- Router: 192.168.1.1
- Control Computer: 192.168.1.10-50
- Atlas Processors: 192.168.1.100-110
- Other AV Equipment: 192.168.1.111-200
```

---

## Advanced Diagnostics

### Check Processor Web Interface
1. Open browser to `http://[processor-ip]`
2. Look for:
   - Firmware version
   - Network settings
   - System status
   - Error logs

### Network Packet Capture
If connection issues persist, capture network traffic:
```bash
# On Linux:
sudo tcpdump -i eth0 host 192.168.5.0 -w atlas-debug.pcap

# Analyze with Wireshark to see:
# - TCP handshake completion
# - HTTP response codes
# - Network errors
```

### Check Application Logs
The application logs detailed connection attempts:
```bash
# View logs in browser console (F12)
# Look for messages like:
# "Testing connection to AtlasIED Atmosphere at 192.168.5.0:80"
# "Cleaned IP address from '192.168.5.0/F90' to '192.168.5.0'"
```

---

## API Endpoints for Manual Testing

### Test Connection Endpoint
```bash
curl -X POST http://localhost:3000/api/audio-processor/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "ipAddress": "192.168.5.0",
    "port": 80
  }'
```

**Expected Response (Success):**
```json
{
  "connected": true,
  "status": 200,
  "protocol": "http",
  "port": 80,
  "message": "Successfully connected to AtlasIED Atmosphere processor via HTTP",
  "webInterface": "http://192.168.5.0:80"
}
```

**Expected Response (Failure):**
```json
{
  "connected": false,
  "message": "Unable to connect to processor on any protocol",
  "error": "connection_failed",
  "troubleshooting": {
    "steps": [
      "1. Verify the processor is powered on and connected to the network",
      "2. Check that the IP address is correct",
      "3. Ensure the processor is on the same network or accessible via routing",
      "4. Try accessing the web interface directly in a browser",
      "5. Check firewall settings - Atlas uses ports 80 (HTTP) and 443 (HTTPS)",
      "6. Verify network connectivity with: ping 192.168.5.0"
    ]
  }
}
```

---

## Getting Help

### Information to Collect
When reporting connection issues, provide:
1. **Processor Model**: AZM4, AZM8, AZMP4, or AZMP8
2. **IP Address**: As shown in the application
3. **Network Setup**: Same subnet? Different VLAN?
4. **Test Results**: Output from Test Connection button
5. **Browser Console Logs**: Press F12, check Console tab
6. **Ping Results**: Can you ping the processor?
7. **Web Interface Access**: Can you access it in a browser?

### Contact Information
- **AtlasIED Support**: https://www.atlasied.com/support
- **Product Documentation**: https://www.atlasied.com/atmosphere-manual
- **Application Issues**: Check the GitHub repository issues

---

## Quick Reference

### Connection Test Checklist
- [ ] Processor is powered on
- [ ] Network cable is connected
- [ ] IP address is correct (no /F90 or other suffixes)
- [ ] Processor is on same network or routable
- [ ] Firewall allows ports 80 and 443
- [ ] Can ping the processor
- [ ] Can access web interface in browser
- [ ] Test Connection button shows success

### Common IP Address Formats
✅ **Valid**: `192.168.1.100`
✅ **Valid**: `10.0.0.50`
✅ **Valid**: `172.16.0.10`
❌ **Invalid**: `192.168.5.0/F90`
❌ **Invalid**: `192.168.1.100:80` (port should be separate field)
❌ **Invalid**: `192.168.1.256` (octets must be 0-255)

---

## Changelog

### Version 1.0 (October 2024)
- Initial troubleshooting guide
- Added IP address cleaning feature
- Enhanced connection testing with multiple protocols
- Increased timeout from 5s to 10s
- Added detailed error messages and troubleshooting steps
