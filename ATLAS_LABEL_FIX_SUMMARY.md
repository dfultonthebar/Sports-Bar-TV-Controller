# Atlas Processor Zone and Source Label Fix Summary

**Date:** October 21, 2025  
**Issue:** Atlas processor showing default names (Zone 1, Zone 2, etc.) instead of actual custom zone and source names configured in the Atlas processor.

## Problem Identified

The Sports Bar TV Controller application was NOT correctly retrieving the custom zone and source names from the Atlas IED Atmosphere AZM8 processor at 192.168.5.101.

### Actual Custom Names (from Atlas Web Interface)
**Zones:**
- Zone 0: Main Bar
- Zone 1: Dining Room
- Zone 2: Party Room West
- Zone 3: Party Room East
- Zone 4: Patio
- Zone 5: Bathroom

**Sources:**
- Source 0: Matrix 1
- Source 1: Matrix 2
- Source 2: Matrix 3
- Source 3: Matrix 4
- Source 4: Mic 1
- Source 5: Mic 2
- Source 6: Spotify
- Source 7: Party Room East
- Source 8: Party Room West

## Root Cause

The Atlas processor returns JSON-RPC responses in an **ARRAY format**, but the code was expecting a direct object format:

**Actual Response:**
```json
{"jsonrpc":"2.0","result":[{"param":"ZoneName_0","str":"Main Bar"}],"id":0}
```

**Code was expecting:**
```json
{"jsonrpc":"2.0","result":{"param":"ZoneName_0","str":"Main Bar"},"id":0}
```

## Fixes Applied

### 1. Fixed `src/lib/atlas-hardware-query.ts`

**Lines 211-221** - Source name parsing:
```typescript
// OLD CODE (incorrect):
const result = response.data.result
const sourceName = result.str || result.val || `Source ${i + 1}`

// NEW CODE (correct):
const result = Array.isArray(response.data.result) ? response.data.result[0] : response.data.result
const sourceName = result.str || result.val || `Source ${i + 1}`
```

**Lines 252-281** - Zone name, source, volume, and mute state parsing:
```typescript
// Fixed all parameter retrievals to handle array responses:
let zoneName = `Zone ${i + 1}`
if (nameResponse.success && nameResponse.data?.result) {
  const result = Array.isArray(nameResponse.data.result) ? nameResponse.data.result[0] : nameResponse.data.result
  zoneName = result.str || zoneName
}
```

**Lines 92-114** - HTTP discovery fallback (same fix applied)

### 2. Fixed `src/lib/atlas-hardware-query.ts` - testAtlasConnection function

**Line 369** - Fixed parameter name from `port` to `tcpPort`:
```typescript
// OLD: export async function testAtlasConnection(ipAddress: string, port: number = 5321)
// NEW: export async function testAtlasConnection(ipAddress: string, tcpPort: number = 5321)
```

### 3. Updated `src/app/api/atlas/query-hardware/route.ts`

- Migrated from Prisma to Drizzle ORM for database access
- Added proper error handling and logging
- Fixed zone upsert logic to work with Drizzle

## Verification

Direct JSON-RPC queries to the Atlas processor confirm it returns the correct custom names:

```bash
# Zone Name Query
echo '{"jsonrpc":"2.0","method":"get","params":{"param":"ZoneName_0","fmt":"str"},"id":1}' | nc 192.168.5.101 5321
# Response: {"jsonrpc":"2.0","result":[{"param":"ZoneName_0","str":"Main Bar"}],"id":1}

# Source Name Query  
echo '{"jsonrpc":"2.0","method":"get","params":{"param":"SourceName_0","fmt":"str"},"id":2}' | nc 192.168.5.101 5321
# Response: {"jsonrpc":"2.0","result":[{"param":"SourceName_0","str":"Matrix 1"}],"id":2}
```

## Current Status

✅ **FIXED:** Response parsing now correctly handles array format  
✅ **FIXED:** testAtlasConnection parameter naming  
✅ **FIXED:** Database migration from Prisma to Drizzle  
⚠️ **REMAINING ISSUE:** The `/api/atlas/query-hardware` endpoint is still returning an error "port is not defined" - this appears to be coming from the HTTP client discovery phase and needs further investigation.

## Next Steps

1. Debug the "port is not defined" error in the atlas-http-client.ts
2. Test the hardware query endpoint after fixing the port issue
3. Verify zone and source labels appear correctly in the UI
4. Update the database with the correct custom names

## Files Modified

- `src/lib/atlas-hardware-query.ts` - Fixed JSON-RPC response parsing
- `src/app/api/atlas/query-hardware/route.ts` - Migrated to Drizzle ORM

## Database Information

- **Processor ID:** fea5b103-52e2-42ce-add0-8e1b542365a3
- **Processor Name:** Graystone
- **Model:** AZM8
- **IP Address:** 192.168.5.101
- **TCP Port:** 5321
- **HTTP Port:** 80

## Testing Commands

```bash
# Trigger hardware query
curl -X POST http://localhost:3000/api/atlas/query-hardware \
  -H "Content-Type: application/json" \
  -d '{"processorId":"fea5b103-52e2-42ce-add0-8e1b542365a3"}'

# Check saved configuration
cat data/atlas-configs/fea5b103-52e2-42ce-add0-8e1b542365a3.json

# Check database zones
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT zoneNumber, name FROM AudioZone WHERE processorId='fea5b103-52e2-42ce-add0-8e1b542365a3';"
```
