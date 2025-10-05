
# Soundtrack Your Brand Integration Setup Guide

## Overview

The Sports Bar AI Assistant now includes full integration with Soundtrack Your Brand for professional music streaming across your venue. This guide will help you get it configured and working.

## Current Status

✅ **Integration Complete** - All code and features are implemented  
⚠️ **Configuration Needed** - You need to add your Soundtrack API key to activate the features

## What's Included

### 1. Bartender Music Control
- Bartenders can control music from the remote interface
- Real-time "Now Playing" information
- Play/Pause controls
- Volume adjustment
- Station/Playlist selection
- Admins can choose which players bartenders can access

### 2. Audio Manager Integration
- View all Soundtrack players in your account
- Control multiple zones (Main Bar, Pavilion, Party Room, Upstairs, Patio)
- See what's playing in each zone
- Centralized music management

### 3. Configuration Interface
- Easy-to-use setup page at `/soundtrack`
- Test API connection
- Select visible players for bartenders
- Reorder players for better organization

## How to Configure

### Step 1: Get Your Soundtrack API Key

1. Log into your **Soundtrack Your Brand** account
2. Go to **Account Settings** or **API Settings**
3. Generate or copy your **API Token** (Base64-encoded credentials)
4. The key will look something like: `eXVuYUR1U2hhQ0hGW...`

> **Note:** If you can't find the API settings in your Soundtrack account, contact Soundtrack Your Brand support to enable API access for your account.

### Step 2: Configure in Your System

1. **Access the Configuration Page:**
   - Navigate to: `http://192.168.1.25:3000/soundtrack`
   - Or click "Soundtrack Your Brand" from the main menu

2. **Enter Your API Key:**
   - Paste your API token in the "API Key" field
   - Click "Save API Key"
   - The system will test the connection automatically

3. **Select Bartender Players:**
   - After saving, you'll see all players from your Soundtrack account
   - Toggle "Visible" for players you want bartenders to control
   - Set display order numbers (0, 1, 2, etc.) to organize the list
   - Only visible players will appear in the Bartender Remote

### Step 3: Test the Integration

1. **Test Configuration Page:**
   ```
   http://192.168.1.25:3000/soundtrack
   ```
   - Should show your account name
   - Should list all players
   - Should allow toggling visibility

2. **Test Bartender Remote:**
   ```
   http://192.168.1.25:3000/remote
   ```
   - Click the "Music" tab at the bottom
   - Should show only visible players
   - Should display "Now Playing" information
   - Should allow play/pause and volume control

3. **Test Audio Manager:**
   ```
   http://192.168.1.25:3000/audio-manager
   ```
   - Should show Soundtrack controls for each zone
   - Should display current playback status
   - Should allow station changes

## Features

### For Administrators

**Player Management:**
- Configure which players bartenders can access
- Reorder players for logical grouping
- Test API connection
- View account information

**Multi-Zone Control:**
- Control all sound zones from Audio Manager
- See what's playing across all zones
- Quick station changes
- Volume control per zone

### For Bartenders

**Simple Remote Control:**
- Only see authorized players
- Clear "Now Playing" display with album art
- Easy play/pause buttons
- Volume up/down controls
- Browse and select playlists/stations
- No access to admin settings

## Troubleshooting

### "Soundtrack Your Brand is not configured"

**Problem:** You haven't added your API key yet  
**Solution:** Go to `/soundtrack` and add your API key

### "No players found"

**Problem:** Either the API key is invalid, or your account has no players  
**Solution:**  
- Verify the API key is correct
- Check that your Soundtrack account has active players/sound zones
- Contact Soundtrack support to verify API access

### "404 Not Found" Errors

**Problem:** API endpoints returning 404  
**Solution:**  
- Make sure you ran the latest update: `./update_from_github.sh`
- The database should have been migrated automatically
- If issues persist, regenerate Prisma client: `npx prisma generate`

### Bartender Remote Shows "API error: 404"

**Problem:** Configuration is incomplete  
**Solution:**  
1. Configure API key at `/soundtrack`
2. Select at least one player as "Visible"
3. Save changes
4. Refresh the bartender remote

## Database Schema

The integration adds two new tables:

```prisma
model SoundtrackConfig {
  id          String   @id @default(cuid())
  apiKey      String   // Your API token
  accountId   String?  // From Soundtrack API
  accountName String?  // Your business name
  status      String   // "active", "error", "untested"
  lastTested  DateTime?
  players     SoundtrackPlayer[]
}

model SoundtrackPlayer {
  id               String  @id @default(cuid())
  playerId         String  // Soundtrack player ID
  playerName       String  // Player name
  bartenderVisible Boolean @default(false)
  displayOrder     Int     @default(0)
}
```

## API Endpoints

All endpoints are in `/api/soundtrack/`:

- **GET/POST `/config`** - Configure API key and settings
- **GET/PATCH `/players`** - List and control players
- **GET `/stations`** - List available stations/playlists
- **GET `/now-playing`** - Get current track info
- **GET `/account`** - Get Soundtrack account details

## Security

- API keys are stored encrypted in the database
- Keys are never exposed in logs or frontend code
- Only masked versions (last 4 characters) are shown in UI
- Bartenders cannot see or modify API settings

## Next Steps

1. **Get your Soundtrack API key** from your account
2. **Configure it** at `http://192.168.1.25:3000/soundtrack`
3. **Select players** for bartender access
4. **Test** the bartender remote and audio manager
5. **Train bartenders** on the new music controls

## Support

**Soundtrack Your Brand Support:**
- Website: https://www.soundtrackyourbrand.com
- Email: support@soundtrackyourbrand.com
- Phone: Check your account for regional support numbers

**System Integration Questions:**
- Check documentation in the repository
- Review the AI Assistant's device configuration guides
- Contact your system administrator

## Benefits

✅ **Professional Streaming** - Licensed music for commercial use  
✅ **Easy Control** - Simple interface for bartender staff  
✅ **Multi-Zone** - Different music for different areas  
✅ **Centralized** - Manage all zones from one interface  
✅ **Integrated** - Works with your existing AV system  
✅ **Secure** - Role-based access control  
✅ **Real-Time** - Live "Now Playing" information  

---

**Last Updated:** October 1, 2025  
**Version:** 2.0.0  
**Status:** Ready for Configuration
