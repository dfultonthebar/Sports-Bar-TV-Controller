
# Unified TV Control System
## CEC + IR with Brand-Specific Timing & Intelligent Fallback

### Overview

The Unified TV Control System is a comprehensive solution that combines HDMI-CEC and IR (Infrared) control methods with intelligent fallback mechanisms and brand-specific timing optimizations. This system provides maximum reliability and compatibility across all TV brands.

---

## Key Features

### 🎯 **Unified Control Interface**
- Single interface to control all TVs regardless of brand or control method
- Automatic method selection based on device capabilities
- Real-time command history and status monitoring
- Batch control for multiple TVs simultaneously

### ⚡ **CEC (HDMI-CEC) Control**
- Fast, direct control via HDMI-CEC protocol
- Extended command set:
  - Power (on/off/standby)
  - Volume (up/down/mute)
  - Navigation (up/down/left/right/select/menu)
  - Playback (play/pause/stop/FF/rewind)
  - Input switching
  - System queries (power status, device name)

### 📡 **IR Control**
- Infrared control via Global Cache iTach
- Support for hundreds of device models
- Precise IR code database for major brands
- Backup method when CEC is unavailable

### 🔄 **Intelligent Fallback**
- Automatic retry with alternative method if primary fails
- Example: CEC fails → automatically tries IR
- Configurable retry logic and timeouts
- Fallback indication in UI and logs

### ⏱️ **Brand-Specific Timing**
- Optimized delays for each TV manufacturer
- Accounts for different response times
- Prevents command conflicts and missed commands
- Configurable per-brand timing profiles

---

## Supported TV Brands

### Excellent CEC Support
- **Sony** (BRAVIA Sync) - 3000ms power on delay
- **Samsung** (Anynet+) - 2500ms power on delay
- **LG** (SimpLink) - 3500ms power on delay
- **TCL** (T-Link) - 2000ms power on delay
- **Panasonic** (VIERA Link) - 3000ms power on delay
- **Philips** (EasyLink) - 2500ms power on delay

### Good CEC Support
- **Hisense** - 2000ms power on delay
- **Insignia** (Fire TV Edition) - 2000ms power on delay
- **Toshiba** (CE-Link) - 2500ms power on delay

### Limited CEC (Recommend Hybrid/IR)
- **Vizio** (SmartCast) - Inconsistent CEC, prefer IR for volume
- **Sharp** (Aquos Link) - CEC power OK, IR for volume
- **Element** - Minimal CEC, IR recommended
- **Westinghouse** - IR recommended

---

## Brand-Specific Configurations

### Sony Configuration
```typescript
{
  cecPowerOnDelay: 3000ms,
  cecPowerOffDelay: 1500ms,
  cecVolumeDelay: 200ms,
  supportsWakeOnCec: true,
  supportsCecVolumeControl: true,
  preferredControlMethod: 'CEC',
  quirks: [
    'BRAVIA Sync must be enabled',
    'May require 2-3 second delay for power on',
    'Excellent CEC compliance'
  ]
}
```

### Samsung Configuration
```typescript
{
  cecPowerOnDelay: 2500ms,
  cecPowerOffDelay: 1000ms,
  cecVolumeDelay: 150ms,
  supportsWakeOnCec: true,
  supportsCecVolumeControl: true,
  preferredControlMethod: 'CEC',
  quirks: [
    'Anynet+ must be enabled',
    'Older models may not wake via CEC',
    'Frame TVs have Art Mode considerations'
  ]
}
```

### Vizio Configuration (Hybrid)
```typescript
{
  cecPowerOnDelay: 2500ms,
  cecPowerOffDelay: 1500ms,
  cecVolumeDelay: 300ms,
  supportsWakeOnCec: false,
  supportsCecVolumeControl: false,
  preferredControlMethod: 'HYBRID',
  quirks: [
    'CEC support can be inconsistent',
    'Use IR for volume control',
    'SmartCast TVs have limited CEC'
  ]
}
```

---

## API Endpoints

### 1. Unified TV Control
**POST** `/api/unified-tv-control`

Control single or multiple TVs with automatic method selection and fallback.

**Request Body:**
```json
{
  "deviceId": "tv-output-1",
  "command": "power_on",
  "forceMethod": "CEC",  // Optional: 'CEC' or 'IR'
  "sequential": false,    // For batch control
  "delayBetween": 1000   // For sequential batch control
}
```

**Batch Control:**
```json
{
  "deviceIds": ["tv-1", "tv-2", "tv-3"],
  "command": "power_on",
  "sequential": true,
  "delayBetween": 1000
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "method": "CEC",
    "message": "CEC command power_on sent successfully",
    "fallbackUsed": false
  },
  "timestamp": "2025-10-01T12:34:56.789Z"
}
```

### 2. Enhanced CEC Control
**POST** `/api/cec/enhanced-control`

Send extended CEC commands with brand-specific timing.

**Request Body:**
```json
{
  "command": "volume_up",
  "outputNumber": 5,
  "parameters": {}  // Optional parameters for some commands
}
```

**Response:**
```json
{
  "success": true,
  "command": "volume_up",
  "opcode": "volup",
  "hexCode": "0x41",
  "outputNumber": 5,
  "delay": 200,
  "brandConfig": {
    "brand": "Sony",
    "timing": {
      "powerOn": 3000,
      "powerOff": 1500,
      "volume": 200,
      "inputSwitch": 2000
    }
  }
}
```

### 3. Get Available CEC Commands
**GET** `/api/cec/enhanced-control`

List all available CEC commands by category.

**Response:**
```json
{
  "success": true,
  "commands": {
    "power": [...],
    "volume": [...],
    "navigation": [...],
    "playback": [...],
    "system": [...]
  },
  "categories": ["power", "volume", "navigation", "playback", "system"]
}
```

### 4. Get TV Brand Configurations
**GET** `/api/tv-brands?brand=Sony`

Get brand-specific configuration and timing.

**Response:**
```json
{
  "success": true,
  "brand": "Sony",
  "config": {
    "cecPowerOnDelay": 3000,
    "cecPowerOffDelay": 1500,
    "supportsWakeOnCec": true,
    "preferredControlMethod": "CEC",
    "quirks": [...]
  }
}
```

---

## Available Commands

### Power Commands
- `power_on` - Turn TV on
- `power_off` - Turn TV off
- `standby` - Put TV in standby mode

### Volume Commands
- `volume_up` - Increase volume
- `volume_down` - Decrease volume
- `mute` - Toggle mute
- `unmute` - Unmute audio
- `volume_toggle_mute` - Toggle mute state

### Navigation Commands
- `up` - Navigate up
- `down` - Navigate down
- `left` - Navigate left
- `right` - Navigate right
- `select` - Select/OK
- `exit` - Exit menu
- `root_menu` - Open root menu
- `setup_menu` - Open setup menu
- `contents_menu` - Open contents menu
- `favorite_menu` - Open favorites

### Playback Commands
- `play` - Play
- `pause` - Pause
- `stop` - Stop
- `fast_forward` - Fast forward
- `rewind` - Rewind
- `record` - Record (if supported)

### Input/Source Commands
- `set_stream_path` - Set active input
- `active_source` - Declare as active source
- `inactive_source` - Declare as inactive source

### System Query Commands
- `give_device_power_status` - Query power status
- `give_osd_name` - Query device name
- `give_physical_address` - Query physical address
- `request_active_source` - Request active source

---

## Usage Examples

### Example 1: Simple Power Control
```typescript
// Power on a specific TV
const response = await fetch('/api/unified-tv-control', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceId: 'tv-main-bar-1',
    command: 'power_on'
  })
})
```

### Example 2: Force IR Control
```typescript
// Use IR instead of CEC
const response = await fetch('/api/unified-tv-control', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceId: 'tv-vizio-1',
    command: 'volume_up',
    forceMethod: 'IR'  // Force IR for Vizio volume
  })
})
```

### Example 3: Batch Sequential Control
```typescript
// Power on all TVs sequentially (more reliable)
const response = await fetch('/api/unified-tv-control', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceIds: ['tv-1', 'tv-2', 'tv-3', 'tv-4'],
    command: 'power_on',
    sequential: true,
    delayBetween: 2000  // 2 second delay between each
  })
})
```

### Example 4: Extended CEC Commands
```typescript
// Send navigation command
const response = await fetch('/api/cec/enhanced-control', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: 'select',  // Press OK/Select
    outputNumber: 3
  })
})
```

### Example 5: Query Device Status
```typescript
// Get power status of a TV
const response = await fetch('/api/cec/enhanced-control', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: 'give_device_power_status',
    outputNumber: 5
  })
})
```

---

## Control Flow

### Single Device Control Flow
```
1. User selects device and command
2. System identifies device capabilities (CEC/IR)
3. System retrieves brand configuration
4. System determines optimal control method
5. Matrix routes CEC input to output (if CEC)
6. Wait for brand-specific delay
7. Send command via selected method
8. If failure, attempt fallback method
9. Return result to user
```

### Batch Control Flow
```
1. User selects multiple devices and command
2. Choose parallel or sequential mode
3. For each device:
   - Route CEC input (if applicable)
   - Wait for brand-specific delay
   - Send command
   - Log result
4. If sequential: wait between devices
5. Return aggregated results
```

---

## Intelligent Fallback Logic

### CEC → IR Fallback
```typescript
1. Attempt CEC command
2. If CEC fails:
   - Check if device supports IR
   - If yes: Send IR command
   - Mark as "FALLBACK" method
   - Return result with fallback flag
3. If both fail:
   - Return error
   - Log for troubleshooting
```

### IR → CEC Fallback
```typescript
1. Attempt IR command
2. If IR fails:
   - Check if device supports CEC
   - If yes: Route matrix + send CEC
   - Mark as "FALLBACK" method
   - Return result with fallback flag
3. If both fail:
   - Return error
   - Suggest manual intervention
```

---

## Best Practices

### 1. TV Setup
- Enable HDMI-CEC on all TVs (varies by brand name)
- Connect Pulse-Eight CEC adapter to matrix input 12
- Configure TV brands in device settings for optimal timing
- Test both CEC and IR for each TV initially

### 2. Command Timing
- Use brand-specific delays (automatically applied)
- For batch operations, prefer sequential mode
- Allow 2-3 seconds between commands for reliability
- Monitor command history for failures

### 3. Method Selection
- Trust AUTO mode for most scenarios
- Force CEC for power and input switching
- Force IR for volume on problematic brands (Vizio, Sharp)
- Use HYBRID mode for brands with partial CEC support

### 4. Troubleshooting
- Check CEC is enabled on TV
- Verify matrix routing is working
- Test CEC bridge connection (port 8080)
- Review brand quirks in UI
- Check command history for patterns
- Try alternative method manually

### 5. Opening/Closing Procedures
```typescript
// Opening (11:00 AM)
// Sequential power-on for reliability
await unifiedControl({
  deviceIds: allTVs,
  command: 'power_on',
  sequential: true,
  delayBetween: 3000
})

// Closing (2:00 AM)
// Fast parallel power-off
await unifiedControl({
  deviceIds: allTVs,
  command: 'power_off',
  sequential: false
})
```

---

## Integration with Existing Systems

### AtlasIED Audio Integration
Coordinate TV power with audio zone activation:
```typescript
// Power on TV + activate audio zone
await Promise.all([
  unifiedTVControl({ deviceId: 'tv-1', command: 'power_on' }),
  atlasAudioControl({ zone: 1, action: 'activate' })
])
```

### Wolf Pack Matrix Integration
The unified control automatically handles matrix routing:
- Routes CEC input to target TV output
- Waits for brand-specific stabilization delay
- Sends CEC command
- No manual routing required

### Sports Guide Integration
Launch games on specific TVs:
```typescript
// Route game to TV and power on
await unifiedTVControl({ 
  deviceId: 'tv-main-3', 
  command: 'power_on' 
})
// Matrix will route game input automatically
```

---

## Monitoring & Logs

### Command History
- Last 10 commands per session
- Shows: device, command, method, result, timestamp
- Fallback indicators for troubleshooting
- Export logs for analysis

### Status Indicators
- 🟢 Green: Command successful (CEC)
- 🔵 Blue: Command successful (IR)
- 🟡 Yellow: Fallback used
- 🔴 Red: Command failed

### Health Checks
- CEC bridge connectivity (port 8080)
- Matrix connectivity
- Device response times
- Command success rates

---

## Troubleshooting Guide

### Issue: CEC not working
**Solutions:**
1. Enable HDMI-CEC on TV (check brand-specific name)
2. Verify CEC bridge is running (port 8080)
3. Check matrix routing to correct output
4. Increase brand-specific power-on delay
5. Try IR fallback

### Issue: IR not working
**Solutions:**
1. Verify Global Cache iTach connection
2. Check IR emitter placement on TV
3. Confirm correct codeset for TV model
4. Test IR codes in IR device control panel
5. Try CEC fallback

### Issue: TV won't wake from standby
**Solutions:**
1. Check brand supports CEC wake (see brand config)
2. Use IR for power-on instead (Vizio, Element)
3. Increase power-on delay for brand
4. Verify TV is in standby, not fully off

### Issue: Volume control inconsistent
**Solutions:**
1. Check if brand supports CEC volume
2. Force IR method for volume commands
3. Ensure IR emitter is positioned correctly
4. Reduce volume delay if commands are too slow

### Issue: Batch commands failing
**Solutions:**
1. Switch to sequential mode
2. Increase delay between commands
3. Reduce batch size
4. Check for network congestion

---

## Future Enhancements

- [ ] Auto-detect TV brands via CEC OSD name query
- [ ] Machine learning for optimal timing per device
- [ ] Scheduled command sequences
- [ ] Integration with room scheduling system
- [ ] Voice control integration
- [ ] Mobile app for remote control
- [ ] TV power usage monitoring
- [ ] Advanced diagnostics dashboard

---

## Support

For issues or questions:
- Check command history for error patterns
- Review brand quirks and recommendations
- Test alternative control method
- Contact system administrator
- Check logs at `/logs/tv-control.log`

---

**Version:** 1.0  
**Last Updated:** October 1, 2025  
**Maintained by:** Sports Bar AI Assistant Team
