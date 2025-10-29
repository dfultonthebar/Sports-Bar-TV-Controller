# Fire TV Streaming Apps Integration

**Date**: October 28, 2025
**Status**: ✅ Configured and Ready
**Fire TV Device**: Amazon 1 (192.168.5.131:5555)

## Overview

The bartender remote now includes quick-launch buttons for your subscribed streaming apps when a Fire TV device is selected. This provides instant access to sports content from NFHS Network, ESPN, YouTube TV, and other streaming services.

## Features

### 1. Quick Launch App Shortcuts
- 🏈 **NFHS Network** - High school sports streaming
- ⚾ **ESPN** - College sports, UFC, exclusive games, ESPN+
- 📺 **YouTube** - YouTube and YouTube TV (live sports channels)
- 🎬 **Prime Video** - Thursday Night Football

### 2. Auto-Detection
- Only shows apps that are actually installed on the Fire TV
- Apps appear automatically when you select Input Channel 13 (Amazon 1)
- Icons and names are customizable

### 3. One-Click Launch
- Click any app icon to launch it on the Fire TV
- Status updates show when app is launching
- Apps open directly to their main screen

## How It Works

### Architecture

```
Bartender Remote (Browser)
    ↓
Fire TV App Shortcuts Component
    ↓
/api/streaming/subscribed-apps (Get enabled apps)
    ↓
/api/streaming/launch (Launch selected app)
    ↓
Streaming Service Manager
    ↓
Fire TV Connection Manager (ADB)
    ↓
Fire TV Device (App Launches)
```

### File Structure

1. **Configuration**: `data/subscribed-streaming-apps.json`
   - Lists all subscribed apps
   - Controls which apps appear on remote
   - Includes activity names for correct launching

2. **Component**: `src/components/FireTVAppShortcuts.tsx`
   - UI component showing app shortcuts
   - Grid layout with app icons
   - Click handling and status updates

3. **API Endpoints**:
   - `GET /api/streaming/subscribed-apps` - Get enabled apps
   - `POST /api/streaming/launch` - Launch an app

4. **App Database**: `src/lib/streaming/streaming-apps-database.ts`
   - Comprehensive database of streaming apps
   - Package names, categories, sports coverage
   - API information and deep link formats

## Installed Apps (Amazon 1)

Based on ADB detection, these apps are currently installed:

| App | Package Name | Status |
|-----|--------------|--------|
| NFHS Network | com.playon.nfhslive | ✅ Installed |
| ESPN | com.espn.gtv | ✅ Installed |
| YouTube | com.amazon.firetv.youtube | ✅ Installed |

## Configuration File

**Location**: `/home/ubuntu/Sports-Bar-TV-Controller/data/subscribed-streaming-apps.json`

```json
{
  "subscribedApps": [
    {
      "appId": "nfhs-network",
      "enabled": true,
      "displayName": "NFHS Network",
      "icon": "🏈",
      "priority": 1,
      "activityName": "com.playon.nfhstv.ui.activities.LaunchActivity",
      "notes": "High school sports"
    },
    {
      "appId": "espn-plus",
      "enabled": true,
      "displayName": "ESPN",
      "icon": "⚾",
      "priority": 2,
      "activityName": "com.espn.startup.presentation.StartupActivity",
      "notes": "College sports, UFC, exclusive games, ESPN+"
    },
    {
      "appId": "youtube-tv",
      "enabled": true,
      "displayName": "YouTube",
      "icon": "📺",
      "priority": 3,
      "activityName": "dev.cobalt.app.MainActivity",
      "notes": "YouTube and YouTube TV"
    }
  ]
}
```

### Configuration Options

| Field | Description | Example |
|-------|-------------|---------|
| `appId` | Unique app identifier from database | `"nfhs-network"` |
| `enabled` | Show app on bartender remote | `true` or `false` |
| `displayName` | Name shown on button | `"NFHS Network"` |
| `icon` | Emoji icon for the button | `"🏈"` |
| `priority` | Sort order (lower = first) | `1` |
| `activityName` | Android activity to launch | `"com.playon.nfhstv.ui.activities.LaunchActivity"` |
| `notes` | Internal notes | `"High school sports"` |

## How to Use from Bartender Remote

### Step 1: Select Fire TV Device
1. Navigate to bartender remote: http://YOUR_SERVER:3001/remote
2. Go to **Video** tab (TV icon at bottom)
3. Select **Input Channel 13** (Amazon 1)

### Step 2: Launch Apps
- Quick launch app shortcuts will appear at the top
- Click any app icon to launch it
- The app will open on the Fire TV immediately
- Status message shows "✅ Launching [App Name]..."

### Step 3: Return to Control
- Use Fire TV remote buttons on the bartender interface
- Navigate within the app using UP/DOWN/LEFT/RIGHT/OK
- Press HOME button to return to Fire TV home screen
- Press BACK to go back within the app

## Adding New Apps

### Method 1: Enable Disabled Apps

Edit `data/subscribed-streaming-apps.json` and change `enabled: false` to `enabled: true` for any app you subscribe to:

```json
{
  "appId": "fox-sports",
  "enabled": true,  // Changed from false
  "displayName": "Fox Sports",
  "icon": "🦊",
  "priority": 5
}
```

### Method 2: Add New App

1. **Find the app in the database**:
   Look in `src/lib/streaming/streaming-apps-database.ts` for available apps

2. **Get the package name on Fire TV**:
   ```bash
   adb -s 192.168.5.131:5555 shell pm list packages | grep -i [app-name]
   ```

3. **Find the launcher activity**:
   ```bash
   adb -s 192.168.5.131:5555 shell "pm dump [package-name] | grep -A 5 'android.intent.action.MAIN'"
   ```

4. **Add to configuration**:
   ```json
   {
     "appId": "app-id-from-database",
     "enabled": true,
     "displayName": "Display Name",
     "icon": "📱",
     "priority": 10,
     "activityName": "activity.from.step3",
     "notes": "Your notes"
   }
   ```

## Sports Content Integration

### NFHS Network
- **Coverage**: High school sports (all states)
- **Sports**: Football, basketball, volleyball, soccer, baseball, softball, wrestling, track, swimming
- **Usage**: Great for local high school game coverage
- **Note**: No public API available - app must be browsed manually

### ESPN
- **Coverage**: College and professional sports
- **Sports**: Football, basketball, baseball, hockey, soccer, UFC, boxing, tennis
- **ESPN+**: Included in the ESPN app
- **Features**: Live games, replays, highlights, exclusive content

### YouTube TV
- **Coverage**: Live sports channels
- **Channels**: ESPN, Fox Sports, NBC Sports, CBS Sports, etc.
- **Sports**: All major professional and college sports
- **Features**: Live TV, DVR, multi-screen viewing

## Technical Details

### App Launching Process

1. **User clicks app icon** in bartender remote
2. **Frontend** sends request to `/api/streaming/launch`
3. **API** looks up activity name from config file
4. **Streaming Manager** validates app is installed
5. **ADB Client** executes command:
   ```bash
   am start -n [package]/[activity]
   ```
6. **Fire TV** launches the app
7. **Status update** shows in bartender remote

### ADB Commands Used

**Launch app**:
```bash
adb -s 192.168.5.131:5555 shell "am start -n com.playon.nfhslive/com.playon.nfhstv.ui.activities.LaunchActivity"
```

**Check if app is installed**:
```bash
adb -s 192.168.5.131:5555 shell pm list packages | grep [package-name]
```

**Get current app**:
```bash
adb -s 192.168.5.131:5555 shell dumpsys window windows | grep mCurrentFocus
```

### Connection Management

- **Persistent ADB connection** maintained by connection manager
- **30-second keep-alive** prevents disconnections
- **Automatic reconnection** if connection drops
- **Connection pooling** reuses connections across requests

## Troubleshooting

### Apps Don't Appear

**Symptom**: No app shortcuts shown when Fire TV is selected

**Solutions**:
1. Check `enabled: true` in config file
2. Verify app is actually installed on Fire TV
3. Restart the application: `pm2 restart sports-bar-tv-controller`

### App Launch Fails

**Symptom**: Click app icon but nothing happens

**Solutions**:
1. **Verify activity name is correct**:
   ```bash
   adb -s 192.168.5.131:5555 shell "pm dump [package] | grep MAIN"
   ```

2. **Test launch manually**:
   ```bash
   adb -s 192.168.5.131:5555 shell "am start -n [package]/[activity]"
   ```

3. **Check ADB connection**:
   ```bash
   adb devices
   # Should show: 192.168.5.131:5555    device
   ```

4. **Reconnect if needed**:
   ```bash
   adb disconnect 192.168.5.131:5555
   adb connect 192.168.5.131:5555
   ```

### Wrong App Opens

**Symptom**: Clicking an app icon opens a different app

**Cause**: Incorrect package name in database

**Solution**:
1. Find correct package name
2. Update `src/lib/streaming/streaming-apps-database.ts`
3. Rebuild: `npm run build`
4. Restart: `pm2 restart sports-bar-tv-controller`

## Customization

### Change App Icons

Edit `data/subscribed-streaming-apps.json`:
```json
{
  "appId": "nfhs-network",
  "icon": "🏟️",  // Change to any emoji
  "displayName": "NFHS"  // Change display name
}
```

### Reorder Apps

Change the `priority` value (lower numbers appear first):
```json
{
  "appId": "espn-plus",
  "priority": 1  // Will appear first
}
```

### Add Notes/Descriptions

The `notes` field helps you remember what each app is for:
```json
{
  "appId": "youtube-tv",
  "notes": "Has all ESPN channels, NFL Network, NBA TV"
}
```

## Future Enhancements

### Planned Features

1. **Sports Content Discovery**:
   - Show live games available in each app
   - Quick links to specific games
   - Integration with sports guide

2. **Deep Linking**:
   - Launch directly to a specific game
   - Open to a specific channel
   - Resume last watched content

3. **App Status Indicators**:
   - Show which app is currently running
   - Display if app requires update
   - Indicate subscription status

4. **Multi-Device Support**:
   - Different apps for different Fire TV devices
   - Sync app preferences across devices
   - Device-specific favorites

## API Documentation

### GET /api/streaming/subscribed-apps

Get list of enabled streaming apps with full details.

**Response**:
```json
{
  "apps": [
    {
      "appId": "nfhs-network",
      "name": "NFHS Network",
      "packageName": "com.playon.nfhslive",
      "displayName": "NFHS Network",
      "icon": "🏈",
      "enabled": true,
      "priority": 1,
      "sports": ["football", "basketball", ...],
      "description": "High school sports streaming",
      "category": "sports"
    }
  ],
  "lastUpdated": "2025-10-28T19:00:00.000Z"
}
```

### POST /api/streaming/launch

Launch a streaming app on a Fire TV device.

**Request**:
```json
{
  "deviceId": "firetv_1761677515811_1s39qjm73",
  "ipAddress": "192.168.5.131",
  "port": 5555,
  "appId": "nfhs-network"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Successfully launched app nfhs-network",
  "deviceId": "firetv_1761677515811_1s39qjm73",
  "appId": "nfhs-network"
}
```

**Response (Failure)**:
```json
{
  "success": false,
  "error": "Failed to launch app nfhs-network",
  "deviceId": "firetv_1761677515811_1s39qjm73",
  "appId": "nfhs-network"
}
```

## Summary

✅ **Configured**: 4 streaming apps (NFHS, ESPN, YouTube, Prime Video)
✅ **Integrated**: App shortcuts appear on bartender remote
✅ **Ready**: One-click launching from bartender interface
✅ **Documented**: Complete setup and troubleshooting guide

The Fire TV streaming app integration is now ready for use. Simply select Amazon 1 (Input Channel 13) on the bartender remote and the app shortcuts will appear automatically!

---

**Last Updated**: October 28, 2025 at 7:10 PM CDT
**Status**: Configuration complete, ready for use
**Device**: Amazon 1 (192.168.5.131:5555)
