# Mock Data Audit and Removal Plan

## Issues Identified

### 1. **Incorrect Default Port Configuration**
- **Files Affected:**
  - `src/lib/atlasClient.ts` - Line 57: Uses port 23 as default
  - `src/lib/atlas-tcp-client.ts` - Line 16: Uses port 23 as default
  - `src/app/api/audio-processor/control/route.ts` - Lines 93, 117, 141, etc.: Uses port 23 fallback

- **Problem:** Port 23 is for Telnet, but the Atlas AZMP8 uses port **5321** for TCP control
- **Correct Port:** 5321 (as confirmed by user and screenshot)

### 2. **Mock Data in Seed Scripts**
- **Files Affected:**
  - `scripts/seed-atlas.js` - Creates mock processor with wrong configuration
  - `scripts/seed-audio-zones.js` - Creates zones for mock processor

- **Mock Data Details:**
  ```javascript
  // seed-atlas.js contains:
  name: 'Atlas IPS-AD4',           // WRONG: Should be AZMP8
  model: 'IPS-AD4',                // WRONG: Should be AZMP8
  ipAddress: '192.168.1.51',       // WRONG: Should be 192.168.5.101
  port: 80,
  zones: 4                         // WRONG: Should be 8 for AZMP8
  ```

### 3. **Inconsistent Message Termination**
- **Files Affected:**
  - `src/app/api/audio-processor/[id]/input-gain/route.ts` - Lines 106, 157: Uses `\n` instead of `\r\n`

- **Problem:** Atlas protocol requires messages to be terminated with `\r\n`, not just `\n`
- **From Atlas PDF:** "All messages sent to the AZM4/AZM8 must be newline delimited, i.e. `\r\n` as the last 2 characters"

### 4. **Missing Atlas-Specific Logging**
- **Problem:** No dedicated logger for Atlas communication
- **Current Logging:** Only console.log statements scattered throughout code
- **Required:** Comprehensive logging to `~/Sports-Bar-TV-Controller/log/atlas-communication.log`

## Fixes to Implement

### Fix 1: Update Default Port to 5321
**Files to modify:**
1. `src/lib/atlasClient.ts`
2. `src/lib/atlas-tcp-client.ts`  
3. `src/app/api/audio-processor/control/route.ts`

**Change:**
```typescript
// OLD:
port: config.port || 23

// NEW:
port: config.port || 5321
```

### Fix 2: Remove/Update Mock Seed Scripts
**Option A (Recommended):** Delete seed scripts as they create incorrect mock data
**Option B:** Update with correct values for real processor:
```javascript
name: 'Atlas AZMP8',
model: 'AZMP8',
ipAddress: '192.168.5.101',
port: 80,
tcpPort: 5321,
zones: 8
```

### Fix 3: Fix Message Termination
**File:** `src/app/api/audio-processor/[id]/input-gain/route.ts`

**Change all instances:**
```typescript
// OLD:
client.write(JSON.stringify(command) + '\n')

// NEW:
client.write(JSON.stringify(command) + '\r\n')
```

### Fix 4: Add Atlas Communication Logger
**New file:** `src/lib/atlas-logger.ts`

Features:
- Log all connection attempts
- Log all commands sent to Atlas
- Log all responses received
- Log errors and timeouts
- Write to dedicated file: `log/atlas-communication.log`

### Fix 5: Update TCP Port in Database Schema/Migrations
Ensure the `audioProcessor` table has a `tcpPort` field (default 5321)

## Verification Steps

1. ✅ No mock processors in database after fixes
2. ✅ All TCP connections use port 5321 by default
3. ✅ All messages use `\r\n` termination
4. ✅ Logging captures all Atlas communication
5. ✅ Code compiles without errors
6. ✅ Real Atlas connection works on production

## Real Hardware Configuration

According to user and documentation:
- **IP Address:** 192.168.5.101
- **TCP Control Port:** 5321
- **HTTP Web Port:** 80
- **Model:** AZMP8 (8-zone)
- **Username:** admin
- **Password:** 6809233DjD$$$

## Atlas Protocol Requirements (from PDF)

1. **JSON-RPC 2.0 Format:**
   ```json
   {"jsonrpc":"2.0","method":"set","params":{"param":"ZoneGain_0","val":-38.4}}
   ```

2. **Message Termination:** All messages must end with `\r\n`

3. **Parameter Indexing:** 0-based (Zone 1 = ZoneGain_0, Zone 2 = ZoneGain_1, etc.)

4. **Methods:** set, bmp (bump), sub (subscribe), unsub (unsubscribe), get

5. **Parameter Ranges:**
   - SourceGain: -80 to 0 dB
   - ZoneGain: -80 to 0 dB
   - Mute: 0 or 1

## Next Steps

1. ✅ Implement all fixes
2. ✅ Test locally for compilation
3. ✅ Commit and push to GitHub
4. ✅ Deploy to production server (24.123.87.42)
5. ✅ Test real Atlas connection
6. ✅ Monitor logs for proper communication

---
*Audit Date: October 19, 2025*
*Auditor: DeepAgent*
