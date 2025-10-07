
# Fire Cube Integration Documentation

## Overview

The Sports Bar TV Controller now includes comprehensive Fire Cube (Amazon Fire TV) integration, allowing you to discover, manage, and control Fire TV devices on your network. This integration provides advanced features for sports bars including subscription detection, live sports content discovery, keep-awake scheduling, and app sideloading.

## Features

### 1. Automatic Discovery
- **ADB Discovery**: Uses Android Debug Bridge to find connected Fire TV devices
- **Network Scanning**: Scans local network for Fire TV devices on port 5555
- **Hybrid Mode**: Combines both methods for maximum coverage
- **Manual Addition**: Add devices by IP address if auto-discovery fails

### 2. Device Management
- View all discovered Fire Cubes
- Test connection to each device
- Edit device names and locations
- Link devices to matrix input channels
- Remove devices from the system
- Monitor device status (online/offline/error)

### 3. Subscription Detection
- Automatically detect active subscriptions for streaming services
- Supported services: ESPN+, NFHS Network, Peacock, Hulu Live TV, YouTube TV, FuboTV, MLB.TV, NBA League Pass, NHL.TV, FOX Sports, Paramount+, Sling TV
- Multiple detection methods:
  - Shared preferences analysis
  - Login file checking
  - Heuristic analysis based on app usage
- Track subscription status (active, expired, trial, unknown)

### 4. Live Sports Content Detection
- Identify available live sports programming on subscribed services
- View upcoming sports events
- Search sports content by league, team, or keyword
- Deep linking support for direct app navigation
- Real-time content updates

### 5. Keep-Awake Scheduler
- Schedule devices to stay awake during business hours (default: 7am - 1am)
- Prevents screen timeout and sleep mode
- Configurable per-device schedules
- Automatic wake-up and sleep commands
- Activity logging for troubleshooting
- Periodic keep-alive checks every 5 minutes

### 6. App Sideloading System
- Clone apps from one Fire Cube to others
- Batch installation across multiple devices
- Progress tracking for sideload operations
- Error logging and retry capabilities
- Sync apps to all devices with one click
- Preserve app settings and data (where possible)

## Getting Started

### Prerequisites

1. **Network Requirements**
   - Fire Cubes must be on the same local network as the controller
   - Port 5555 must be accessible
   - Firewall rules may need adjustment

2. **Enable ADB on Fire Cubes**
   - Navigate to: Settings → My Fire TV → Developer Options
   - Enable "ADB Debugging"
   - Enable "Apps from Unknown Sources" (for sideloading)
   - Repeat for each Fire Cube

3. **Server Requirements**
   - Android Debug Bridge (ADB) must be installed on the server
   - Install on Ubuntu/Debian: `sudo apt-get install adb`
   - Verify installation: `adb version`

### Discovery Process

1. Navigate to the Fire TV Settings page in the application
2. Click "Auto Discover" to scan your network
3. Select discovery method:
   - **ADB + Network Scan**: Most thorough (recommended)
   - **ADB Only**: Faster, requires devices already connected
   - **Network Scan Only**: Slower but doesn't require ADB connection
4. Wait for discovery to complete (typically 10-60 seconds)
5. Review discovered devices and test connections

### Manual Device Addition

If automatic discovery doesn't find a device:

1. Click "Add Manually"
2. Enter the Fire Cube's IP address
3. Optionally set a device name and location
4. Click "Add Device"

## API Endpoints

### Discovery
- `POST /api/firecube/discover` - Discover Fire Cubes on network
  - Body: `{ method: 'adb' | 'network_scan' | 'both' }`

### Device Management
- `GET /api/firecube/devices` - List all devices
- `POST /api/firecube/devices` - Add device manually
- `GET /api/firecube/devices/[id]` - Get device details
- `PATCH /api/firecube/devices/[id]` - Update device
- `DELETE /api/firecube/devices/[id]` - Remove device
- `POST /api/firecube/devices/[id]/test` - Test connection

### Apps
- `GET /api/firecube/devices/[id]/apps` - Get installed apps
- `POST /api/firecube/devices/[id]/apps` - Refresh app list

### Subscriptions
- `GET /api/firecube/devices/[id]/subscriptions` - Get subscribed apps
- `POST /api/firecube/devices/[id]/subscriptions` - Check subscriptions

### Sports Content
- `GET /api/firecube/devices/[id]/sports-content` - Get sports content
  - Query: `type=live` or `type=upcoming`
- `POST /api/firecube/devices/[id]/sports-content` - Refresh content

### Sideloading
- `POST /api/firecube/sideload` - Start sideload operation
  - Body: `{ sourceDeviceId, targetDeviceIds, packageName, action }`
- `GET /api/firecube/sideload` - Get sideload operations
  - Query: `operationId` (optional)

## ADB Commands Reference

### Device Information
```bash
adb connect <ip>:5555          # Connect to device
adb devices                     # List connected devices
adb shell getprop              # Get device properties
```

### App Management
```bash
adb shell pm list packages     # List installed packages
adb shell pm dump <package>    # Get package info
adb install -r <apk>           # Install/reinstall APK
adb uninstall <package>        # Uninstall app
```

### Control Commands
```bash
adb shell input keyevent <code>  # Send key event
adb shell monkey -p <package> 1  # Launch app
adb shell am force-stop <package> # Stop app
```

### Keep-Awake Commands
```bash
adb shell input keyevent 224     # Wake up device
adb shell settings put system screen_off_timeout 2147483647  # Disable timeout
adb shell settings put system screen_off_timeout 120000      # Reset to 2 minutes
```

## Supported Streaming Apps

### Sports Streaming Services
- **ESPN** (com.espn.score_center)
- **NFHS Network** (com.nfhs.network)
- **Peacock** (com.nbcuni.nbc.liveextra)
- **Hulu Live TV** (com.hulu.plus)
- **YouTube TV** (com.google.android.youtube.tv)
- **FuboTV** (com.fubo.android)
- **Sling TV** (com.sling)

### League-Specific Apps
- **MLB.TV** (com.bamnetworks.mobile.android.gameday.mlb)
- **NBA League Pass** (com.nba.game)
- **NHL.TV** (com.nhl.gc1112.free)
- **NFL+** (com.nflmobile.nflnow)
- **FOX Sports** (com.fox.now)
- **Paramount+** (com.cbs.ott)

## Troubleshooting

### Device Not Discovered

1. **Check ADB is enabled**
   - Settings → My Fire TV → Developer Options → ADB Debugging → ON

2. **Verify network connectivity**
   - Ensure device is on same network
   - Check IP address in device settings
   - Try manual addition with IP address

3. **Firewall issues**
   - Allow port 5555 in firewall
   - Check router settings
   - Disable VPN if active

### Connection Test Fails

1. **Connection Refused**
   - ADB not enabled on device
   - Wrong IP address
   - Device powered off
   - Network issue

2. **Timeout Error**
   - Device is offline or unreachable
   - Check IP address
   - Verify network connection
   - Try restarting device

3. **Permission Denied**
   - ADB debugging not authorized
   - Reconnect device and accept authorization prompt

### Subscription Detection Issues

1. **No subscriptions detected**
   - Apps may not be logged in
   - Subscription data stored differently than expected
   - Try manual verification in apps

2. **False positives**
   - App installed but not subscribed
   - Trial period expired
   - Shared device with multiple accounts

### Keep-Awake Not Working

1. **Device still sleeping**
   - Check schedule is enabled
   - Verify time range is correct
   - Check keep-awake logs for errors
   - Device may have power-saving features enabled

2. **Schedule not running**
   - Server may have restarted
   - Check system logs
   - Manually re-enable schedule

### Sideload Failures

1. **Installation failed**
   - "Apps from Unknown Sources" not enabled
   - Insufficient storage space
   - APK incompatible with device
   - Existing app version conflict

2. **APK backup failed**
   - App is protected/encrypted
   - Insufficient permissions
   - Storage issues

## Performance Tips

1. **Discovery**
   - Use ADB discovery for faster results
   - Network scan is more thorough but slower
   - Limit IP range for faster network scans

2. **Subscription Checking**
   - Check subscriptions during off-hours
   - Results are cached for 1 hour
   - Batch check multiple devices

3. **Sideloading**
   - Sideload during off-hours
   - Process devices in batches of 5
   - Monitor progress and retry failures

4. **Keep-Awake**
   - Schedules run automatically
   - Periodic checks every 5 minutes
   - Minimal performance impact

## Security Considerations

1. **ADB Access**
   - ADB has full device access
   - Restrict to local network only
   - Do not expose port 5555 to internet

2. **Network Isolation**
   - Use separate VLAN for Fire Cubes if possible
   - Implement firewall rules
   - Monitor access logs

3. **App Sideloading**
   - Only sideload trusted apps
   - Verify APK sources
   - Scan for malware before installation

## Integration with Existing Features

### Matrix System
- Link Fire Cubes to specific matrix input channels
- Coordinate TV and Fire Cube control
- Automated switching and control

### Scheduling
- Schedule automatic content changes
- Integrate with daily routines
- Game-time automation

### AI Assistant
The AI assistant understands Fire Cube commands:
- "Show subscriptions on main bar Fire Cube"
- "What live sports are available?"
- "Keep all Fire Cubes awake from 7am to 1am"
- "Sideload ESPN app to all devices"

## Known Limitations

1. **ADB Requirement**
   - Requires ADB to be installed on server
   - Devices must have ADB enabled
   - Some operations require root access (not implemented)

2. **Subscription Detection**
   - Not 100% accurate for all apps
   - Some apps use encrypted storage
   - API-based detection not implemented for all services

3. **Sports Content**
   - Limited to apps with accessible APIs
   - Real-time updates depend on app support
   - Deep linking may not work for all apps

4. **Sideloading**
   - Cannot transfer app data/settings for all apps
   - Some apps are protected and cannot be backed up
   - Requires sufficient storage on target devices

## Future Enhancements

Potential future features:
- Root access for advanced control
- Automated app updates
- Remote app configuration
- Voice control integration
- Multi-room audio/video distribution
- Enhanced sports content APIs
- Machine learning for content recommendations

## Support

For issues or questions:
1. Check this documentation
2. Review troubleshooting section
3. Check application logs
4. Consult Fire TV support for device-specific issues

## References

- [Android Debug Bridge (ADB) Documentation](https://developer.android.com/studio/command-line/adb)
- [Fire TV Developer Documentation](https://developer.amazon.com/docs/fire-tv/getting-started-developing-apps-and-games.html)
- [ADB Key Event Codes](https://developer.android.com/reference/android/view/KeyEvent)
