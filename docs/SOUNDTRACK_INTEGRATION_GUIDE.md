# Soundtrack Your Brand Integration Guide

## Overview

The Sports Bar AI Assistant now includes full integration with Soundtrack Your Brand for professional business music management. This allows bartenders to control playlists and administrators to manage API access through intuitive interfaces.

## Features

### For Administrators

#### Configuration Management
- **Location**: Device Configuration → Soundtrack Tab
- **Access**: Navigate to `/device-config` and select the "Soundtrack" tab

**Configuration Steps:**
1. Obtain your API token from [Soundtrack Your Brand Dashboard](https://business.soundtrackyourbrand.com)
2. Go to Settings → API Access in your Soundtrack account
3. Generate or copy your API token
4. Enter the token in the configuration page
5. Click "Test" to verify the connection
6. Click "Save Configuration" to store the credentials

**Features:**
- Secure token storage in the database
- Connection testing before saving
- Account information display (business name, account ID)
- Token masking for security
- Easy removal of configuration

### For Bartenders

#### Music Control Interface
- **Location**: Bartender Remote → Music Tab
- **Access**: Navigate to `/remote` and select the "Music" tab

**Available Controls:**

1. **Playback Control**
   - Start/Stop music playback
   - Large, easy-to-use buttons
   - Real-time playback status

2. **Playlist/Station Selection**
   - Browse all available playlists
   - View playlist details (genre, mood, description)
   - One-click playlist switching
   - Visual indicator of current playlist

3. **Volume Control**
   - Increase/decrease volume in 5% increments
   - Real-time volume display
   - Quick-access volume buttons

4. **Now Playing Display**
   - Track title and artist
   - Album information
   - Album artwork (when available)
   - Current playlist/station name

## API Documentation

### Soundtrack Your Brand API

The integration uses the official Soundtrack Your Brand GraphQL API (v2):
- **Base URL**: `https://api.soundtrackyourbrand.com/v2`
- **Authentication**: Basic authentication with API token
- **Protocol**: GraphQL over HTTPS

**Supported Features:**
- Player/Sound zone management
- Playlist/Station browsing and switching
- Volume control
- Now playing information
- Account information retrieval

### Database Schema

```prisma
model SoundtrackConfig {
  id          String   @id @default(cuid())
  apiKey      String   // Soundtrack Your Brand API token
  accountId   String?  // Soundtrack account ID
  accountName String?  // Business name from Soundtrack
  status      String   @default("active") // "active", "error", "untested"
  lastTested  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## API Endpoints

### Configuration Endpoints

#### GET /api/soundtrack/config
Retrieve current configuration (API key is masked)

**Response:**
```json
{
  "config": {
    "apiKey": "••••••••••••1234",
    "accountId": "QWNjb3...",
    "accountName": "Sports Bar Inc.",
    "isConfigured": true,
    "status": "active"
  },
  "accountInfo": {
    "id": "QWNjb3...",
    "businessName": "Sports Bar Inc."
  }
}
```

#### POST /api/soundtrack/config
Save new configuration

**Request:**
```json
{
  "apiKey": "your_api_token_here",
  "accountId": "optional_account_id",
  "accountName": "optional_business_name",
  "status": "active"
}
```

#### DELETE /api/soundtrack/config
Remove configuration

#### POST /api/soundtrack/test
Test API connection without saving

**Request:**
```json
{
  "apiKey": "your_api_token_here"
}
```

### Music Control Endpoints

#### GET /api/soundtrack/players
List all available sound zones/players

**Response:**
```json
{
  "success": true,
  "players": [
    {
      "id": "player_id",
      "name": "Main Bar",
      "isPlaying": true,
      "volume": 75,
      "currentStation": {
        "id": "station_id",
        "name": "Upbeat Pop"
      }
    }
  ]
}
```

#### PATCH /api/soundtrack/players
Update player settings

**Request:**
```json
{
  "playerId": "player_id",
  "playing": true,
  "volume": 80,
  "stationId": "station_id"
}
```

#### GET /api/soundtrack/stations
List available playlists/stations

**Response:**
```json
{
  "success": true,
  "stations": [
    {
      "id": "station_id",
      "name": "Upbeat Pop",
      "description": "High-energy pop hits",
      "genre": "Pop",
      "mood": "Energetic"
    }
  ]
}
```

#### GET /api/soundtrack/now-playing?playerId=player_id
Get currently playing track

**Response:**
```json
{
  "success": true,
  "nowPlaying": {
    "track": {
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "albumArt": "https://..."
    },
    "station": {
      "id": "station_id",
      "name": "Station Name"
    },
    "startedAt": "2025-09-30T12:00:00Z"
  }
}
```

## Security Considerations

1. **Token Storage**: API tokens are stored securely in the database
2. **Token Masking**: Tokens are masked in all API responses
3. **Access Control**: Configuration requires admin access to device-config page
4. **Bartender Access**: Music control is available to bartenders without exposing tokens

## Troubleshooting

### Configuration Issues

**Problem**: "Connection test failed"
- **Solution**: Verify your API token is correct
- Check that your Soundtrack account is active
- Ensure internet connectivity

**Problem**: "Soundtrack Your Brand not configured"
- **Solution**: Complete the configuration in device-config page
- Save the configuration after testing

### Music Control Issues

**Problem**: "No Soundtrack players found"
- **Solution**: Verify players are set up in your Soundtrack account
- Check that configuration is saved properly
- Refresh the page

**Problem**: "Failed to load Soundtrack data"
- **Solution**: Check configuration status in device-config
- Verify API token hasn't expired
- Contact Soundtrack support if needed

## Best Practices

1. **Regular Testing**: Test the API connection periodically in device-config
2. **Token Security**: Never share your API token publicly
3. **Playlist Organization**: Organize playlists in Soundtrack dashboard for easier bartender access
4. **Volume Levels**: Set appropriate default volumes in Soundtrack dashboard

## Getting Support

- **Soundtrack API Documentation**: [https://soundtrack.api-docs.io/](https://soundtrack.api-docs.io/)
- **Soundtrack Support**: Contact through your Soundtrack dashboard
- **System Issues**: Check application logs in `/logs` page

## Future Enhancements

Planned features for future releases:
- Multi-zone audio routing
- Scheduled playlist changes
- Playlist recommendations based on time/events
- Integration with sports events for automatic music selection
- Volume automation based on crowd levels
