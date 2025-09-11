
# Sports Bar AV Control System

A comprehensive automation system for sports bars that controls video matrices, audio processors, IR devices, streaming devices, and provides TV guide integration with real-time bi-directional synchronization.

## Features

### Device Controllers
- **Wolfpack Video Matrix**: TCP/IP control for video switching and routing
- **Atlas Atmosphere Audio**: REST API control with WebSocket feedback
- **DBX ZonePro Audio**: TCP/IP control for zone-based audio processing
- **Global Cache IR**: IR blaster control for cable boxes, streaming devices
- **Amazon Fire Cube**: ADB network control for streaming apps
- **TV Guide Integration**: Real-time program listings and sports detection

### Advanced Features
- **Bi-directional Sync**: Audio and video stay synchronized automatically
- **Web Dashboard**: Touch-friendly interface for staff control
- **Per-TV Manual Controls**: Individual TV source and volume control
- **Preset Management**: Quick-access presets for different scenarios
- **System Testing**: Comprehensive device testing and monitoring
- **Real-time Feedback**: Live status monitoring and event handling

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller

# Install dependencies
pip install -r requirements_enhanced.txt

# Create config directory
mkdir -p config
```

### 2. Configuration

Copy and edit the configuration files:

```bash
# Copy sample configurations
cp config/mappings.yaml config/mappings.yaml
cp config/test_config.json config/test_config.json

# Edit device IP addresses and credentials
nano config/mappings.yaml
nano config/test_config.json
```

### 3. Update Device Settings

Edit `main_enhanced.py` to match your device IP addresses:

```python
DEVICE_CONFIG = {
    "wolfpack": {
        "ip_address": "192.168.1.100",  # Your Wolfpack IP
        "port": 23,
        "timeout": 5
    },
    "atlas": {
        "ip_address": "192.168.1.101",  # Your Atlas IP
        "username": "admin",            # Your Atlas username
        "password": "password"          # Your Atlas password
    },
    # ... update other devices
}
```

### 4. Run the System

```bash
# Start the main application
python main_enhanced.py
```

The web dashboard will be available at `http://your-server-ip:5000`

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Dashboard │    │   AV Manager     │    │  Device Layer   │
│                 │◄──►│                  │◄──►│                 │
│ - Manual Control│    │ - Bi-dir Sync    │    │ - Wolfpack      │
│ - Presets       │    │ - Event Bus      │    │ - Atlas         │
│ - Status        │    │ - Config Mgmt    │    │ - DBX ZonePro   │
└─────────────────┘    └──────────────────┘    │ - Global Cache  │
                                                │ - Fire Cube     │
                                                │ - TV Guide      │
                                                └─────────────────┘
```

## Device Configuration

### Wolfpack Video Matrix
- **Connection**: TCP/IP (usually port 23)
- **Features**: Input/output switching, presets, status monitoring
- **Config**: Update IP address in `DEVICE_CONFIG`

### Atlas Atmosphere Audio
- **Connection**: REST API + WebSocket
- **Features**: Zone control, source routing, real-time feedback
- **Config**: Set IP, username, password in config

### DBX ZonePro Audio
- **Connection**: TCP/IP (port 23)
- **Features**: Zone levels, muting, presets
- **Config**: Update IP address in config

### Global Cache IR
- **Connection**: TCP/IP (port 4998)
- **Features**: IR control for cable boxes, streaming devices
- **Setup**: Register devices with IR codes

### Amazon Fire Cube
- **Connection**: ADB over network (port 5555)
- **Features**: App launching, navigation, media control
- **Requirements**: Enable ADB debugging on Fire Cube

## Web Dashboard Features

### Main Controls
- **Sync Toggle**: Enable/disable bi-directional sync
- **Quick Presets**: One-click scenarios (Big Game, Chill, etc.)
- **Live Status**: Real-time routing and sync status

### Per-TV Controls
- **Source Selection**: Choose input for each TV
- **Volume Control**: Individual zone volume adjustment
- **Instant Apply**: Immediate AV switching

### Status Monitoring
- **Current Routes**: Live routing table
- **Device Status**: Connection and health monitoring
- **Event Log**: Real-time system events

## Presets Configuration

Edit `config/mappings.yaml` to customize presets:

```yaml
presets:
  big_game:
    description: "All TVs to ESPN, high volume"
    routes:
      - {input: 1, output: 1, volume: 0.85}  # Main Bar
      - {input: 1, output: 2, volume: 0.85}  # Patio
      - {input: 1, output: 3, volume: 0.80}  # Dining

  custom_preset:
    description: "Your custom configuration"
    routes:
      - {input: 2, output: 1, volume: 0.70}
      # Add more routes as needed
```

## System Testing

Run comprehensive system tests:

```bash
# Run all device tests
python -m tests.system_test

# Run specific device tests
python tests/system_test.py
```

Test results include:
- Connection testing
- Communication verification
- Control command testing
- Feedback monitoring
- Integration testing

## API Endpoints

The system provides REST API endpoints:

```
GET  /api/status          # Current system status
GET  /api/inputs          # Available input sources
GET  /api/outputs         # Available output zones
POST /switch_av           # Manual AV switching
GET  /preset/<name>       # Recall preset
GET  /toggle_sync         # Toggle sync mode
```

## Troubleshooting

### Connection Issues
1. Verify device IP addresses in config
2. Check network connectivity
3. Confirm device credentials
4. Review firewall settings

### Sync Not Working
1. Check WebSocket connection to Atlas
2. Verify mapping configuration
3. Review polling interval settings
4. Check device feedback

### Dashboard Issues
1. Ensure Flask is running on port 5000
2. Check browser console for errors
3. Verify API endpoints are responding
4. Try accessing via device IP instead of localhost

## Advanced Configuration

### Custom IR Codes
Add custom IR codes in `devices/global_cache_ir.py`:

```python
self.ir_codes = {
    "your_device": {
        "POWER": "38000,1,1,342,171,21,64...",
        "CHANNEL_UP": "38000,1,1,342,171...",
        # Add more codes
    }
}
```

### Audio Zone Mapping
Customize zone mappings in `config/mappings.yaml`:

```yaml
output_to_zone_map:
  1: main_bar_zone
  2: patio_zone
  3: dining_zone
  4: private_room_zone
```

### Monitoring Settings
Adjust monitoring in `config/test_config.json`:

```json
{
  "test_settings": {
    "monitoring_duration": 60,
    "retry_attempts": 3,
    "connection_timeout": 10
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review system test results for diagnostics

---

**Sports Bar AV Control System** - Professional automation for sports entertainment venues.
