# Channel Filtering Implementation

## Overview
This document describes the device-specific channel filtering implementation for the bartender remote control system.

## Purpose
Ensure that when bartenders select a device (cable box or DirecTV), they only see channels and programming available on that specific device type. This prevents confusion and streamlines the channel selection process.

## Implementation Details

### 1. API-Level Filtering (channel-guide/route.ts)

**Location:** `/src/app/api/channel-guide/route.ts`

**Changes Made:**
- **Strict Device Type Filtering**: The API now only creates channel entries when they match the requested device type
- **Cable Channels**: Only includes channels from `listing.channel_numbers?.CAB` when deviceType is 'cable'
- **DirecTV/Satellite Channels**: Only includes channels from `listing.channel_numbers?.SAT` when deviceType is 'satellite'
- **Skip Non-Matching Listings**: If a listing doesn't have channels for the requested device type, it's completely skipped (not shown)

**Key Code Changes:**
```typescript
// CRITICAL: Only create channels that match the requested device type
if (deviceType === 'satellite') {
  // DirecTV/Satellite - ONLY if SAT channels exist
  if (listing.channel_numbers?.SAT) {
    // Create satellite channel
  }
} else if (deviceType === 'cable') {
  // Cable - ONLY if CAB channels exist
  if (listing.channel_numbers?.CAB) {
    // Create cable channel
  }
}

// CRITICAL: Skip this listing if no matching channel was found
if (!channelInfo) {
  continue // Skip to next listing
}
```

**Benefits:**
- Clean separation of cable and DirecTV channels
- No cross-contamination of channel data
- Reduced data payload (only relevant channels are sent)
- Comprehensive logging for debugging

### 2. UI-Level Enhancements (EnhancedChannelGuideBartenderRemote.tsx)

**Location:** `/src/components/EnhancedChannelGuideBartenderRemote.tsx`

**Changes Made:**

#### A. Visual Indicators
- **Device Type Badge**: Shows which device type is currently selected (Cable/DirecTV/Streaming)
- **Channel Count Badge**: Displays the number of channels and programs available for the selected device type
- **Color-Coded Badges**: 
  - Blue for Satellite/DirecTV
  - Green for Cable
  - Purple for Streaming

#### B. Clear Guide Data on Device Switch
- When switching between inputs (devices), the guide data is cleared
- This prevents showing stale data from the previous device type
- Search query is reset to avoid confusion

#### C. Informative "No Results" Message
- When no programs are found, displays device-specific information
- Explains that filtering is active
- Clarifies which channels are hidden (e.g., "DirecTV channels are hidden" when cable is selected)

### 3. Data Flow

```
User Selects Input → Device Type Detected → Guide Cleared → API Called with Device Type
                                                                        ↓
                                                Rail API Fetches All Listings
                                                                        ↓
                                            Filter by CAB or SAT lineup type
                                                                        ↓
                                            Only matching channels returned
                                                                        ↓
                                        UI displays filtered channels/programs
```

## Device Type Detection

The system automatically detects device type based on:
1. **DirecTV Devices**: If `direcTVDevices` contains a device mapped to the input → `'satellite'`
2. **Fire TV Devices**: If `fireTVDevices` contains a device mapped to the input → `'streaming'`
3. **Cable Devices**: If input type contains "cable" OR it's an IR device → `'cable'`

## Rail API Integration

The Rail Media API provides channel listings with lineup-specific channel numbers:
- `listing.channel_numbers.SAT`: DirecTV/Satellite channel numbers
- `listing.channel_numbers.CAB`: Cable channel numbers
- `listing.channel_numbers.STRM`: Streaming service availability (if applicable)

## Testing Checklist

### Local Testing
- [ ] Build the project successfully (`npm run build`)
- [ ] Start development server (`npm run dev`)
- [ ] Select a cable box input
- [ ] Open channel guide
- [ ] Verify only cable channels are shown
- [ ] Switch to a DirecTV input
- [ ] Verify guide clears and shows only DirecTV channels
- [ ] Test search functionality
- [ ] Verify "no results" message shows filtering information

### Remote Server Testing
- [ ] Deploy to remote server
- [ ] Test cable box channel filtering
- [ ] Test DirecTV channel filtering
- [ ] Test with real devices
- [ ] Verify channel tuning works correctly
- [ ] Test with multiple users simultaneously

## Deployment Instructions

### 1. Local Testing
```bash
cd /home/ubuntu/github_repos/Sports-Bar-TV-Controller
npm run build
npm run dev
```

### 2. Deploy to Remote Server
```bash
# SSH into the server
sshpass -p '6809233DjD$$$' ssh -p 224 \
  -o StrictHostKeyChecking=no \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  ubuntu@24.123.87.42

# Navigate to project directory
cd ~/Sports-Bar-TV-Controller

# Pull latest changes
git pull origin main

# Install dependencies (if needed)
npm install

# Build the project
npm run build

# Restart the application
pm2 restart all

# Or restart the systemd service (if applicable)
sudo systemctl restart sports-bar-tv-controller
```

## Troubleshooting

### Issue: Channels from wrong device type are showing
**Solution:** Check the Rail API response to ensure it contains the correct lineup data (SAT vs CAB)

### Issue: No channels showing at all
**Solution:** 
1. Check if the Rail API is returning data
2. Verify the device type detection logic
3. Check API logs for filtering messages

### Issue: Guide doesn't refresh when switching devices
**Solution:** Verify that `handleInputSelection` is clearing `guideData` state

## Future Enhancements

1. **Channel Caching**: Cache channel data per device type to reduce API calls
2. **Favorite Channels**: Allow bartenders to mark favorite channels per device type
3. **Channel Comparison**: Show which programs are available on both cable and DirecTV
4. **Smart Suggestions**: Suggest which device to use based on channel availability

## Related Files

- `/src/app/api/channel-guide/route.ts` - API endpoint for channel guide
- `/src/components/EnhancedChannelGuideBartenderRemote.tsx` - Main UI component
- `/src/components/ChannelPresetGrid.tsx` - Channel preset buttons (already filtered)
- `/src/lib/sportsGuideApi.ts` - Rail API integration
- `/src/db/schema.ts` - Database schema (channelPresets table)

## Version History

- **v1.0** (October 27, 2025): Initial implementation of device-specific channel filtering
  - Strict API-level filtering by device type
  - UI enhancements with visual indicators
  - Clear guide data on device switch
  - Informative "no results" messages

## Contact

For questions or issues with this implementation, please refer to the GitHub repository:
https://github.com/dfultonthebar/Sports-Bar-TV-Controller
