# Channel Preset Fix - October 4, 2025

## Issue
Channel presets were not showing up on the bartender remote page at `/remote`.

## Root Cause
The database was reset with `prisma migrate reset --force`, which cleared all data including channel presets. The ChannelPreset table existed but was empty.

## Investigation Steps
1. Verified the ChannelPreset table structure in Prisma schema
2. Checked the API endpoints (`/api/channel-presets/by-device`)
3. Discovered the database file mismatch:
   - `.env` pointed to `./prisma/dev.db`
   - Initial attempts inserted data into `prisma/data/sports_bar.db` (wrong file)
4. Corrected the database target and inserted presets into `prisma/dev.db`

## Solution
Populated the ChannelPreset table with 29 common sports channel presets:

### Cable Presets (14 channels)
- ESPN (206)
- ESPN2 (209)
- Fox Sports 1 (219)
- NFL Network (212)
- NBA TV (216)
- MLB Network (213)
- NHL Network (215)
- Fox Sports 2 (618)
- TNT (245)
- TBS (247)
- ABC (7)
- CBS (4)
- NBC (5)
- FOX (11)

### DirecTV Presets (15 channels)
- All cable channels above
- NFL RedZone (212)

## Verification
- API endpoint `/api/channel-presets/by-device?deviceType=cable` returns 14 presets
- API endpoint `/api/channel-presets/by-device?deviceType=directv` returns 15 presets
- Bartender remote page at `/remote` is accessible (HTTP 200)
- Presets are now visible in the ChannelPresetGrid component

## Database Configuration
- Database file: `prisma/dev.db`
- Connection string in `.env`: `DATABASE_URL="file:./prisma/dev.db"`

## Future Considerations
1. Consider creating a seed script in `prisma/seed.ts` to automatically populate presets after migrations
2. Document the preset management process for bartenders
3. Add a UI for managing presets in the admin panel
4. Consider backing up the database before running migrations

## Files Modified
- `prisma/dev.db` - Added 29 channel preset records

## Testing
To verify presets are working:
1. Visit http://135.131.39.26:223/remote
2. Look for the "Quick Channel Access" section
3. Presets should display as blue buttons with channel names and numbers
