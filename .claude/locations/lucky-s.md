# Lucky's Location Details

**Branch:** `location/lucky-s-1313`
**Status:** Active — has its own installation

## Setup Notes

- Has its own Rail Media configuration for channel sync
- Channel numbers differ from Graystone (different cable market)
- Needs its own `SPORTS_GUIDE_USER_ID` in `.env`

## Pulling Latest Updates

```bash
git checkout location/lucky-s-1313
git merge main
# On conflict with data files (wolfpack-devices.json, etc.) → keep Lucky's version
npm run build && pm2 restart sports-bar-tv-controller
```

### After Merging Main (April 2026+)

1. **Live Channel Mappings:** Update `NETWORK_TO_CABLE` and `NETWORK_TO_DIRECTV` in
   `apps/web/src/app/api/sports-guide/live-by-channel/route.ts` with Lucky's local
   channel numbers for regional sports networks (RSNs). ESPN uses names like
   "FanDuel SN WI", "Bucks.TV" — map these to Lucky's cable/satellite channel numbers.

2. **Wolf Pack Multi-Chassis:** If Lucky's has multiple Wolf Pack matrices, configure
   `apps/web/data/wolfpack-devices.json` then run `POST /api/wolfpack/chassis/sync`.

3. **DirecTV Devices:** Ensure `apps/web/data/directv-devices.json` has Lucky's
   DirecTV receiver IPs and ports.

4. **Ollama AI Scheduling:** Install Ollama + `llama3.1:8b` model if not already present
   for AI scheduling suggestions.

## TODO

- Document matrix type and size
- Document device IPs and input map
- Document room layout and TV count
- Add channel reference table
- Add Lucky's RSN channel mappings
