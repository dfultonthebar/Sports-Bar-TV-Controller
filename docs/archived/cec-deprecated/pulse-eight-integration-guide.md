
# Pulse-Eight USB CEC Adapter Integration Guide
## Sports Bar AI Assistant + Wolf Pack Matrix

### 🔌 Physical Connection Setup

```
[PC/Server] ──USB──┬─ [Pulse-Eight USB CEC Adapter] ──HDMI──┐
                   │                                         │
                   └─ Sports Bar AI Assistant Service       │
                                                             │
[Wolf Pack Matrix Input 12] ←──────────────────────────────┘
            │
            ├─ Output 1 → TV 1 (Main Bar Left)
            ├─ Output 2 → TV 2 (Main Bar Center) 
            ├─ Output 3 → TV 3 (Main Bar Right)
            ├─ Output 4 → TV 4 (Side Area 1)
            ├─ Output 5 → TV 5 (Side Area 2)
            └─ ... up to Output 16+
```

### ⚙️ Installation Steps

#### Step 1: Install CEC Bridge Service
```bash
# Run the installation script
sudo /home/ubuntu/install-cec-bridge.sh

# Or install manually:
sudo apt-get install cec-utils libcec4 libcec-dev
```

#### Step 2: Connect Hardware
1. **USB Connection**: Plug Pulse-Eight adapter into server via USB
2. **HDMI Connection**: Connect HDMI output to Wolf Pack Matrix Input 12
3. **Verify Detection**: Check if adapter is recognized
   ```bash
   echo "scan" | cec-client -s -d 1
   ```

#### Step 3: Configure Sports Bar AI Assistant

1. **Access Web Interface**: http://192.168.1.25:3000
2. **Navigate to**: AV Control → CEC Power Control
3. **Configuration**:
   - ✅ Enable CEC Control: `Enabled`
   - 🔌 CEC Server Input: `Input 12: CEC Controller`
   - 🌐 CEC Server IP: `192.168.1.25` (your server IP)
   - 🔧 CEC Server Port: `8080`
   - ⏱️ Power On Delay: `2000ms` (2 seconds)
   - ⏱️ Power Off Delay: `1000ms` (1 second)
4. **Save Configuration**

#### Step 4: Test Individual TV Control

**Power On TV #7:**
1. System routes: `12X7.` (CEC Input → Output 7)
2. Wait 2 seconds for signal stabilization
3. Send CEC command: `on` to TV on output 7
4. Only TV #7 powers on

**Power Off TV #3:**
1. System routes: `12X3.` (CEC Input → Output 3)  
2. Wait 1 second
3. Send CEC command: `standby` to TV on output 3
4. Only TV #3 powers off

### 🎛️ Control Methods

#### Web Interface Control
- **All TVs**: Use "System Power Control" → "All TVs"
- **Individual**: Use "Individual TV Control" → Select specific TV
- **Status Monitoring**: Real-time TV power status display

#### API Control
```bash
# Power on all TVs
curl -X POST http://192.168.1.25:3000/api/cec/power-control \
  -H "Content-Type: application/json" \
  -d '{"action":"power_on"}'

# Power on specific TVs
curl -X POST http://192.168.1.25:3000/api/cec/power-control \
  -H "Content-Type: application/json" \
  -d '{"action":"power_on","outputNumbers":[7,8,9],"individual":true}'

# Power off TV #5
curl -X POST http://192.168.1.25:3000/api/cec/power-control \
  -H "Content-Type: application/json" \
  -d '{"action":"power_off","outputNumbers":[5],"individual":true}'
```

#### Direct CEC Bridge Control
```bash
# Test CEC bridge health
curl http://192.168.1.25:8080/health

# Scan for CEC devices
curl http://192.168.1.25:8080/api/scan

# Send CEC power on to specific addresses
curl -X POST http://192.168.1.25:8080/api/command \
  -H "Content-Type: application/json" \
  -d '{"command":"on","targets":["1","2","3"]}'
```

### 🔧 Troubleshooting

#### CEC Bridge Not Working
```bash
# Check service status
sudo systemctl status cec-bridge

# Check logs
sudo journalctl -u cec-bridge -f

# Restart service
sudo systemctl restart cec-bridge

# Test CEC adapter directly
echo "scan" | cec-client -s -d 1
```

#### Wolf Pack Matrix Issues
```bash
# Test matrix connection
curl http://192.168.1.25:3000/api/matrix/test-connection

# Manual matrix command (UDP)
echo "12X7." | nc -u 192.168.1.100 4000

# Manual matrix command (TCP)  
echo "12X7." | nc 192.168.1.100 5000
```

#### TV Not Responding to CEC
1. **Check TV Settings**: Enable HDMI-CEC/HDMI Control in TV menu
2. **Check HDMI Connection**: Ensure solid connection to matrix
3. **Check Matrix Routing**: Verify input 12 routes to correct output
4. **Check Timing**: Increase power delays if needed
5. **Check CEC Address**: Some TVs use different CEC addresses

### 📊 System Workflow

#### Individual TV Power Control Process:
```
1. User clicks "Power On TV #7"
      ↓
2. Sports Bar AI sends matrix command: "12X7."  
      ↓
3. Wolf Pack routes CEC input to output 7
      ↓  
4. System waits 2 seconds for signal stabilization
      ↓
5. HTTP request to CEC bridge: POST /api/command
      ↓
6. CEC bridge executes: echo "on 7" | cec-client -s -d 1
      ↓
7. Pulse-Eight adapter sends CEC power-on to TV #7
      ↓
8. TV #7 powers on, status updated in web interface
```

#### Batch Power Control Process:
```
1. User clicks "Power On All TVs"
      ↓
2. Sports Bar AI routes CEC to all active outputs:
   - 12X1. (Main Bar Left)
   - 12X2. (Main Bar Center)  
   - 12X3. (Main Bar Right)
   - 12X4. (Side Area 1)
   - etc.
      ↓
3. System waits for all routes to stabilize  
      ↓
4. CEC broadcast command sent to all TVs
      ↓
5. All connected TVs power on simultaneously
```

### 🎯 Advanced Features

#### Custom TV Groups
Configure custom TV groups in web interface for zone-based control:
- **Main Bar Zone**: TVs 1, 2, 3
- **Side Areas**: TVs 4, 5
- **VIP Area**: TVs 6, 7
- **Patio**: TVs 8, 9

#### Scheduled Power Management
Set up automated schedules:
- **Opening Time**: Auto power-on all TVs at 11:00 AM
- **Closing Time**: Auto power-off all TVs at 2:00 AM
- **Zone-based**: Different schedules for different areas

#### Integration with Content Management
- **Source Switching**: Automatically power on TVs when routing content
- **Game Day Mode**: Power on specific TVs for sports events  
- **Audio Sync**: Coordinate with AtlasIED audio system

### 🚀 Benefits of This Setup

✅ **Centralized Control**: Single web interface for all TV power management
✅ **Precision Targeting**: Power individual TVs without affecting others  
✅ **Cost Effective**: Uses existing Wolf Pack infrastructure
✅ **Scalable**: Easy to add more TVs to the system
✅ **Reliable**: Professional-grade CEC adapter with proven technology
✅ **Remote Management**: Control from any device on the network
✅ **Status Monitoring**: Real-time feedback on TV power states
✅ **Future-Proof**: Compatible with HDMI-CEC standard across all TV brands

This integration maintains all your existing functionality while adding professional CEC power control capabilities!
