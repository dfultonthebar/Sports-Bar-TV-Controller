
# Soundtrack Your Brand Integration Setup

This guide will help you set up the Soundtrack Your Brand integration with your Sports Bar AI Assistant.

## Prerequisites

1. **Soundtrack Your Brand Account**
   - You need an active Soundtrack Your Brand subscription
   - Visit: https://www.soundtrackyourbrand.com/

2. **API Access**
   - Contact Soundtrack Your Brand to get API access
   - Request your API token from their support team
   - Email: support@soundtrackyourbrand.com

## Configuration Steps

### 1. Get Your API Token

1. Log into your Soundtrack Your Brand account
2. Contact their API support team to request access
3. They will provide you with an API token

### 2. Configure the System

Add your API token to the environment variables:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
echo "SOUNDTRACK_API_KEY=your_api_token_here" >> .env
```

Or edit the `.env` file directly:

```env
SOUNDTRACK_API_KEY=your_api_token_here
```

### 3. Restart the Server

```bash
pm2 restart sports-bar-ai
```

Or if running manually:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
yarn dev
```

## Using Soundtrack Your Brand

### Access the Control Interface

1. Navigate to: http://192.168.1.25:3000/soundtrack
2. Or click "Soundtrack Your Brand" from the home page under "Music & Audio"

### Features

#### Main Controls
- **Play/Pause**: Control music playback
- **Volume Control**: Adjust volume levels (0-100)
- **Station Selection**: Choose from your configured music stations
- **Now Playing**: See what's currently playing including artist, track, and album art

#### Zone Control
- Control music for each audio zone independently:
  - Main Bar
  - Pavilion
  - Party Room
  - Upstairs
  - Patio

#### Station Management
- Browse all available stations
- Switch stations instantly
- View station descriptions and genres

### API Endpoints

The following API endpoints are available:

- `GET /api/soundtrack/account` - Get account information
- `GET /api/soundtrack/stations` - List all stations
- `GET /api/soundtrack/players` - List all players (zones)
- `PATCH /api/soundtrack/players` - Update player settings
- `GET /api/soundtrack/now-playing?playerId={id}` - Get current track

## Integration with Audio Zones

The Soundtrack integration works seamlessly with your Atlas IED audio processor:

1. **Zone Mapping**: Each Soundtrack player can be mapped to an Atlas audio zone
2. **Synchronized Control**: Volume and mute controls work with both systems
3. **Source Selection**: "Spotify" source in audio zones can route to Soundtrack

## Troubleshooting

### "Failed to connect to Soundtrack Your Brand"

1. Check that your API token is correctly set in `.env`
2. Verify your API token is active by contacting Soundtrack support
3. Check network connectivity to `api.soundtrackyourbrand.com`

### "No Soundtrack players found"

1. Ensure you have created "players" or "sound zones" in your Soundtrack account
2. Check that players are online in the Soundtrack web dashboard
3. Verify API permissions include player access

### Volume Control Not Working

1. Ensure the player is online in Soundtrack's system
2. Check that the API token has write permissions
3. Verify no other system is controlling the same audio zone

## Advanced Configuration

### Mapping Audio Zones to Soundtrack Players

Edit `src/lib/soundtrack-zone-mapping.ts` to map your Atlas zones to Soundtrack players:

```typescript
export const ZONE_PLAYER_MAPPING = {
  'mainbar': 'soundtrack-player-id-1',
  'pavilion': 'soundtrack-player-id-2',
  'partyroom': 'soundtrack-player-id-3',
  'upstairs': 'soundtrack-player-id-4',
  'patio': 'soundtrack-player-id-5',
}
```

### Custom Station Scheduling

You can set up automatic station changes based on time of day by creating schedules in your Soundtrack account or by customizing the API integration.

## Support

For Soundtrack Your Brand support:
- Web: https://www.soundtrackyourbrand.com/support
- Email: support@soundtrackyourbrand.com
- API Docs: https://soundtrack.api-docs.io/

For Sports Bar AI Assistant support:
- Check the main README.md
- Review system logs at `/logs`
- Check GitHub issues: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues

## Features Roadmap

- [ ] Automatic station scheduling by time of day
- [ ] Genre-based station recommendations
- [ ] Multi-zone synchronization
- [ ] Playlist management
- [ ] Usage analytics and reporting
- [ ] Integration with TV guide for sports-specific music

---

**Note**: Soundtrack Your Brand integration requires an active subscription and API access. Contact them directly to enable API features for your account.
