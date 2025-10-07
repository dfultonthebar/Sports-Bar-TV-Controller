
# DirecTV Integration Documentation

## Overview

The Sports Bar TV Controller now includes comprehensive DirecTV integration, allowing you to discover, manage, and control DirecTV set-top boxes on your network.

## Features

### 1. Automatic Discovery
- **SSDP Discovery**: Uses UPnP/SSDP protocol to find DirecTV boxes
- **Port Scanning**: Scans network for devices on port 8080
- **Hybrid Mode**: Combines both methods for maximum coverage

### 2. Box Management
- View all discovered DirecTV boxes
- Test connection to each box
- Edit box locations
- Remove boxes from the system
- Manual box addition by IP address

### 3. Model Detection
- Automatically identifies box models (HR24, HR34, HR44, etc.)
- Detects Genie servers vs. clients
- Identifies capabilities and SHEF version

### 4. Channel Guide
- Pull channel lineup from any DirecTV box
- Search and filter channels
- Categorize channels (sports, news, entertainment, etc.)
- Shared guide data across all boxes

### 5. Control Commands
- Remote key simulation (navigation, playback, etc.)
- Channel tuning
- Power control
- Information queries
- Support for Whole-Home client addressing

## Getting Started

### Prerequisites

1. **Network Requirements**
   - DirecTV boxes must be on the same local network
   - Port 8080 must be accessible
   - Firewall rules may need adjustment

2. **Enable SHEF on DirecTV Boxes**
   - Press MENU on your DirecTV remote
   - Navigate to: Settings & Help → Settings → Whole-Home
   - Select "External Device"
   - Set "External Access" to "Allow"
   - Repeat for each box

### Discovery Process

1. Navigate to the DirecTV page in the application
2. Click "Auto Discover" to scan your network
3. Wait for discovery to complete (typically 10-30 seconds)
4. Review discovered boxes and test connections

### Manual Box Addition

If automatic discovery doesn't find a box:

1. Click "Add Box Manually"
2. Enter the box's IP address
3. Optionally set a location name
4. Click "Add Box"

## API Endpoints

### Discovery
- `POST /api/directv/discover` - Discover boxes on network
  - Body: `{ method: 'ssdp' | 'port_scan' | 'both' }`

### Box Management
- `GET /api/directv/boxes` - List all boxes
- `POST /api/directv/boxes` - Add box manually
- `GET /api/directv/boxes/[id]` - Get box details
- `PATCH /api/directv/boxes/[id]` - Update box
- `DELETE /api/directv/boxes/[id]` - Remove box
- `POST /api/directv/boxes/[id]/test` - Test connection

### Control
- `POST /api/directv/control/[id]` - Send command to box
  - Body: `{ commandType, commandName, parameters }`

### Channel Guide
- `GET /api/directv/guide/channels` - Get channel list
- `POST /api/directv/guide/refresh` - Refresh guide data

## SHEF API Reference

### Base URL
All commands use: `http://[BOX_IP]:8080`

### Common Endpoints

#### Get Version
```
GET /info/getVersion
```
Returns SHEF version and system time.

#### Get Tuned Channel
```
GET /tv/getTuned?clientAddr=0
```
Returns currently tuned program information.

#### Tune to Channel
```
GET /tv/tune?major=206&clientAddr=0
```
Changes to specified channel.

#### Process Remote Key
```
GET /remote/processKey?key=guide&clientAddr=0
```
Simulates remote button press.

### Remote Keys
- Navigation: `up`, `down`, `left`, `right`, `select`
- Menu: `menu`, `guide`, `info`, `exit`, `back`
- Channels: `chanup`, `chandown`, `prev`
- Numbers: `0-9`, `dash`, `enter`
- Playback: `play`, `pause`, `rew`, `ffwd`, `stop`, `record`
- Power: `poweron`, `poweroff`
- Colors: `red`, `green`, `yellow`, `blue`

### Client Addressing (Genie Systems)

For Genie servers with multiple clients:
- Server: `clientAddr=0`
- Clients: `clientAddr=[MAC_ADDRESS]` (without colons, uppercase)

Get client list:
```
GET /info/getLocations
```

## Supported Models

### Genie Servers
- **HR34**: Original Genie, 5 tuners
- **HR44**: Genie HD DVR, built-in Wi-Fi
- **HR54**: Latest Genie, 4K support
- **HS17**: Genie 2, streaming-focused

### Genie Clients
- **C31**: Basic client
- **C41**: Wireless-capable client
- **C51**: 4K client
- **C61**: Latest 4K client

### HD DVRs
- **HR20-HR24**: Standard HD DVRs

### HD Receivers
- **H21-H25**: Non-DVR receivers

## Troubleshooting

### Box Not Discovered

1. **Check SHEF is enabled**
   - Menu → Settings → Whole-Home → External Device → Allow

2. **Verify network connectivity**
   - Ensure box is on same network
   - Check IP address in box settings
   - Test with manual addition

3. **Firewall issues**
   - Allow port 8080 in firewall
   - Check router settings

### Connection Test Fails

1. **403 Forbidden Error**
   - SHEF not enabled on box
   - Enable in box settings

2. **Timeout Error**
   - Box is offline or unreachable
   - Check IP address
   - Verify network connection

3. **Connection Refused**
   - Wrong IP address
   - Box powered off
   - Network issue

### Commands Not Working

1. **Check SHEF version**
   - Some commands require specific versions
   - Older boxes may not support all features

2. **Verify model compatibility**
   - Some commands are model-specific
   - Check command documentation

3. **Client addressing**
   - For Genie clients, use correct MAC address
   - Get addresses from `/info/getLocations`

## Channel Guide

### Refreshing the Guide

1. Select an online DirecTV box
2. Click "Refresh Guide"
3. Wait for scan to complete (may take several minutes)
4. Guide data is shared across all boxes

### Channel Categories

Channels are automatically categorized:
- **Sports** (200-299): ESPN, Fox Sports, etc.
- **News** (350-399): CNN, Fox News, etc.
- **Movies** (500-599): HBO, Showtime, etc.
- **Premium** (600-699): Premium channels
- **Local** (2-99): Local broadcast channels
- **Entertainment**: Everything else

### Searching Channels

Use the search box to find channels by:
- Channel name
- Callsign
- Network name

## Integration with Existing Features

### TV Control
DirecTV boxes can be linked to specific TVs in the matrix system for coordinated control.

### Scheduling
Schedule automatic channel changes for game times or daily routines.

### AI Assistant
The AI assistant understands DirecTV commands:
- "Tune DirecTV box in main bar to ESPN"
- "What channel is the game on?"
- "Show me all sports channels"

## Security Considerations

1. **No Authentication**
   - SHEF API has no authentication
   - Restrict to local network only

2. **Network Isolation**
   - Do not expose port 8080 to internet
   - Use firewall rules for protection

3. **Access Control**
   - Only enable SHEF when needed
   - Monitor access logs

## Performance Tips

1. **Discovery**
   - Use port scan for faster results
   - SSDP may be slower but more reliable

2. **Channel Guide**
   - Refresh during off-hours
   - Guide data is cached and shared

3. **Commands**
   - Commands are fast (< 500ms typically)
   - Avoid excessive rapid commands

## Known Limitations

1. **DVR Commands Deprecated**
   - Playlist and playback commands removed in SHEF 1.3
   - No programmatic DVR control

2. **Documentation Outdated**
   - Official SHEF docs from 2011
   - Newer models may have changes

3. **Model Detection**
   - Some models difficult to distinguish
   - May require manual identification

## Future Enhancements

Potential future features:
- DVR recording management (if API becomes available)
- Program recommendations
- Viewing history tracking
- Multi-room audio/video distribution
- Integration with streaming services

## Support

For issues or questions:
1. Check this documentation
2. Review troubleshooting section
3. Check application logs
4. Consult DirecTV support for box-specific issues

## References

- [DirecTV SHEF Command Set v1.3.C](https://blog.solidsignal.com/docs/DTV-MD-0359-DIRECTV_SHEF_Command_Set-V1.3.C.pdf)
- [DirecTV Remote API](https://whitlockjc.github.io/directv-remote-api/)
- [MythTV DirecTV Control](https://www.mythtv.org/wiki/Controlling_DirecTV_Set_Top_Box_(STB)_via_Network)
