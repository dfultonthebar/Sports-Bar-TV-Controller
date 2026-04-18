# Troubleshooting: Fire TV App Shortcuts Not Showing

## Issue
App shortcuts don't appear on the bartender remote when selecting Fire TV device.

## Solution Steps

### 1. Clear Browser Cache (Most Common Fix)

The browser may be showing a cached version of the page. **Hard refresh**:

- **Windows/Linux**: Press `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: Press `Cmd + Shift + R` or `Cmd + Option + R`
- **Alternative**: Clear browser cache completely:
  - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
  - Firefox: Settings → Privacy → Clear Data → Cached Web Content
  - Safari: Develop → Empty Caches

### 2. Verify You're on the Correct Tab

The app shortcuts only appear on the **Video** tab:

1. Open bartender remote: http://YOUR_SERVER:3001/remote
2. Click the **Video** icon (TV icon) at the bottom navigation
3. Select **Input Channel 13** (Amazon 1)
4. App shortcuts should appear at the TOP of the screen

### 3. Check Fire TV Device Selection

The shortcuts only show when a Fire TV device is selected:

1. Make sure you've clicked on **Input 13** in the inputs list
2. Look for "Selected: Input 13 → Amazon 1 (Amazon Fire TV - IP Control)" in the status bar
3. The device must have `deviceType: "Fire TV Cube"` (not DirecTV)

### 4. Verify API is Working

Test the API endpoint:

```bash
curl http://localhost:3001/api/streaming/subscribed-apps
```

Expected response:
```json
{
  "apps": [
    {
      "appId": "nfhs-network",
      "displayName": "NFHS Network",
      "icon": "🏈",
      ...
    }
  ]
}
```

### 5. Check Server Status

```bash
pm2 status sports-bar-tv-controller
```

Should show: `status: online`

If not online:
```bash
pm2 restart sports-bar-tv-controller
```

### 6. Rebuild if Necessary

If still not working:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npm run build
pm2 restart sports-bar-tv-controller
```

Then **hard refresh your browser**.

## What the App Shortcuts Look Like

When working correctly, you should see:

```
┌─────────────────────────────────────────┐
│  📺 Quick Launch Apps    Amazon 1       │
├─────────────────────────────────────────┤
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐       │
│  │ 🏈 │  │ ⚾ │  │ 📺 │  │ 🎬 │       │
│  │NFHS│  │ESPN│  │YT  │  │PV  │       │
│  └────┘  └────┘  └────┘  └────┘       │
└─────────────────────────────────────────┘
```

## Still Not Working?

### Check Browser Console

1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for errors related to:
   - `FireTVAppShortcuts`
   - `/api/streaming/subscribed-apps`
   - Component loading errors

### Check Network Tab

1. Open Developer Tools (F12)
2. Go to Network tab
3. Reload the page
4. Look for request to `/api/streaming/subscribed-apps`
5. Check if it returns 200 OK with app data

### Verify File Exists

```bash
ls -la /home/ubuntu/Sports-Bar-TV-Controller/src/components/FireTVAppShortcuts.tsx
```

Should show the file exists.

### Check Build Output

```bash
ls -la /home/ubuntu/Sports-Bar-TV-Controller/.next/
```

Should show recent build timestamp.

## Common Issues

### "I see the Video tab but no app shortcuts"

- **Solution**: Hard refresh browser (Ctrl+Shift+R)
- The page is cached, browser needs to reload

### "Input 13 is selected but nothing shows"

- **Check**: Is device type "Fire TV Cube"?
  ```bash
  curl http://localhost:3001/api/firetv-devices
  ```
- **Fix**: Device must have `deviceType` field that is NOT "DirecTV"

### "API returns empty apps array"

- **Check**: Configuration file
  ```bash
  cat /home/ubuntu/Sports-Bar-TV-Controller/data/subscribed-streaming-apps.json
  ```
- **Fix**: Ensure apps have `enabled: true`

### "Component loads but apps don't launch"

- **Check**: ADB connection
  ```bash
  adb devices
  ```
- **Fix**: Reconnect Fire TV
  ```bash
  adb connect 192.168.5.131:5555
  ```

## Quick Verification Test

Run these commands in sequence:

```bash
# 1. Check server is running
pm2 status sports-bar-tv-controller

# 2. Check API works
curl http://localhost:3001/api/streaming/subscribed-apps | python3 -m json.tool

# 3. Check Fire TV config
curl http://localhost:3001/api/firetv-devices | python3 -m json.tool

# 4. Check ADB connection
adb devices
```

All should return successful results.

## Manual Test

1. **Open new private/incognito browser window** (to avoid cache)
2. Navigate to: http://YOUR_SERVER:3001/remote
3. Click **Video** tab at bottom
4. Click **Input 13** in the list
5. Look at the TOP of the screen for app shortcuts

If you see them in private/incognito mode but not in regular mode, it's definitely a cache issue - clear your browser cache!
