# TV Layout Labels Fix Report

## Problem Summary
When users selected a program in the cable guide and tuned to a channel, the TV layout view's input labels were not updating to show the channel info (e.g., "Cable Box 1 - ESPN" or "Cable Box 1 - Ch 40").

## Root Cause Analysis

### Issue Location
`/src/app/api/channel-presets/tune/route.ts` (lines 190 and 111)

### The Bug
The `update()` function from `/src/lib/db-helpers.ts` requires a WHERE clause expression as the second parameter, but the code was passing a raw ID string instead.

**Incorrect Code:**
```typescript
// Line 190 - InputCurrentChannels update
await update('inputCurrentChannels', existing.id, {
  channelNumber: channelNumberStr,
  channelName,
  // ...
})

// Line 111 - ChannelPresets update
await update('channelPresets', presetId, {
  usageCount: currentPreset.usageCount + 1,
  // ...
})
```

**Generated SQL (BROKEN):**
```sql
update "InputCurrentChannel" set ... where ?
-- The WHERE clause was just a placeholder with the ID as a parameter
-- This doesn't match any specific record correctly
```

### Why It Appeared to Work
The logs showed `"rowCount": 1` and "success" messages, which was misleading. The SQL was technically executing without errors, but the WHERE clause `where ?` with a string parameter doesn't properly match records in SQLite.

## The Fix

**Corrected Code:**
```typescript
// Line 190 - InputCurrentChannels update
await update('inputCurrentChannels', eq(schema.inputCurrentChannels.id, existing.id), {
  channelNumber: channelNumberStr,
  channelName,
  // ...
})

// Line 111 - ChannelPresets update
await update('channelPresets', eq(schema.channelPresets.id, presetId as string), {
  usageCount: currentPreset.usageCount + 1,
  // ...
})
```

**Generated SQL (FIXED):**
```sql
update "InputCurrentChannel" set ... where "InputCurrentChannel"."id" = ?
-- Now has a proper WHERE clause that matches the ID column
```

## Verification

### Test Results
```bash
✓ Database correctly updates to channel 27 (ESPN)
✓ API endpoint returns channel 27 (ESPN)
✓ Database correctly updates to channel 11 (Fox)
✓ API endpoint returns channel 11 (Fox)
✓ All tests passed
```

### Data Flow Verification
1. **Tune Request** → `/api/channel-presets/tune` with `presetId` and `cableBoxId`
2. **Channel Tracking** → Updates `InputCurrentChannel` table with:
   - `inputNum`: Matrix input number (e.g., 1)
   - `channelNumber`: Channel number (e.g., "27")
   - `channelName`: Preset name (e.g., "ESPN")
   - `lastTuned`: Current timestamp
3. **API Query** → `/api/matrix/current-channels` returns updated channel map
4. **Frontend Display** → `TVLayoutView.tsx` component shows "Cable 1 - ESPN"

### Files Modified
- `/src/app/api/channel-presets/tune/route.ts` (2 fixes)

### Build & Deploy
```bash
rm -rf .next
npm run build
pm2 restart sports-bar-tv-controller
```

## Additional Findings

### Systemic Issue
The same bug pattern exists in multiple other API endpoints:
- `/src/app/api/channel-presets/update-usage/route.ts` (line 58)
- `/src/app/api/todos/[id]/complete/route.ts` (line 51)
- `/src/app/api/soundtrack/config/route.ts` (lines 128, 164)
- `/src/app/api/soundtrack/cache/route.ts` (line 37)
- `/src/app/api/audio-processor/[id]/ai-gain-control/route.ts` (line 190)
- `/src/app/api/audio-processor/test-connection/route.ts` (lines 213, 268, 313)
- `/src/app/api/audio-processor/route.ts` (line 171)
- `/src/app/api/atlas/route-matrix-to-zone/route.ts` (line 111)
- `/src/app/api/matrix/video-input-selection/route.ts` (lines 133, 145)
- And many more...

**Recommendation:** These should all be fixed in a follow-up task to prevent similar issues. The pattern should always be:
```typescript
// CORRECT
await update('tableName', eq(schema.tableName.id, recordId), data)

// INCORRECT
await update('tableName', recordId, data)
```

## Frontend Code Analysis
The `TVLayoutView.tsx` component was implemented correctly:
- Loads current channels on mount (line 121)
- Refreshes every 10 seconds (line 125-129)
- Uses channel data in `getSourceForOutput()` (lines 241-252)
- Displays format: "Cable 1 - ESPN" or "Cable 1 - Ch 27"

No frontend changes were needed.

## Summary
The issue was a malformed SQL WHERE clause caused by passing a raw ID string to the `update()` helper function instead of a proper WHERE expression. After fixing the two instances in the tune route, rebuilding, and restarting PM2, the TV layout labels now correctly update when channels are changed.

**Status:** ✅ RESOLVED

**Date:** 2025-11-14
**Build:** PM2 restart #68
