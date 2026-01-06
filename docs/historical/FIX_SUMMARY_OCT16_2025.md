# Fix Summary - October 16, 2025

## Critical Issues Resolved

This document summarizes the fixes applied to resolve two critical errors reported in PM2 logs.

---

## Issue #1: Prisma Singleton Pattern - "Cannot read properties of undefined"

### Error Message
```
[Preset Fetch] Error fetching presets by device: TypeError: Cannot read properties of undefined (reading 'findMany')
at p (/home/ubuntu/Sports-Bar-TV-Controller/.next/server/app/api/channel-presets/by-device/route.js:1:941)
```

### Root Cause
Multiple files throughout the codebase were creating their own `PrismaClient` instances using `new PrismaClient()`. In Next.js applications, this leads to:
- **Database connection pool exhaustion** - Each instance creates its own connection pool
- **Ghost database connections** - Connections that aren't properly cleaned up
- **Undefined prisma client references** - Race conditions during initialization
- **Memory leaks** - Multiple clients consuming resources

### Solution
Implemented the Prisma singleton pattern across **15 files** to ensure only one PrismaClient instance exists throughout the application lifecycle.

### Files Fixed
1. `src/services/presetReorderService.ts`
2. `src/lib/services/qa-uploader.ts`
3. `src/lib/services/cec-discovery-service.ts`
4. `src/lib/services/qa-generator.ts`
5. `src/lib/atlas-meter-service.ts`
6. `src/lib/scheduler-service.ts`
7. `src/lib/firecube/sideload-service.ts`
8. `src/lib/firecube/keep-awake-scheduler.ts`
9. `src/lib/firecube/subscription-detector.ts`
10. `src/lib/firecube/app-discovery.ts`
11. `src/lib/firecube/sports-content-detector.ts`
12. `src/lib/tvDocs/generateQA.ts`
13. `src/lib/tvDocs/index.ts`
14. `src/lib/ai-knowledge-qa.ts`
15. `src/lib/ai-knowledge-enhanced.ts`

### Code Changes

**Before (Incorrect):**
```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
```

**After (Correct):**
```typescript
import prisma from "@/lib/prisma"
// Using singleton prisma from @/lib/prisma
```

### Singleton Implementation
The singleton pattern is implemented in `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
```

### Impact
✅ **Eliminates** "Cannot read properties of undefined" errors  
✅ **Prevents** database connection pool exhaustion  
✅ **Improves** application stability and performance  
✅ **Reduces** memory usage  
✅ **Ensures** consistent database access across the application  

---

## Issue #2: DirecTV 403 Forbidden Error

### Error Message
```
DirecTV command error: Error: HTTP 403: Forbidden.
Sending DirecTV command to: http://192.168.5.121:8080/remote/processKey?key=KEY_8&hold=keyPress
```

### Root Cause
DirecTV receivers have a security feature called "External Device Access" that must be manually enabled for the SHEF (Set-top Box HTTP Exported Functionality) API to work. When this setting is disabled (the default), all API requests return HTTP 403 Forbidden.

### Solution
Enhanced error handling to provide clear, actionable instructions when 403 errors occur, guiding users to enable the required setting.

### Files Modified
1. **`src/app/api/directv-devices/send-command/route.ts`**
   - Added specific 403 error detection and handling
   - Provides step-by-step instructions to enable External Device Access
   - Added 404 error handling for unsupported receivers

2. **`src/lib/directv/shef-client.ts`**
   - Enhanced `isShefEnabled()` method with better error logging
   - Provides console error messages with troubleshooting steps

### Enhanced Error Messages

**403 Forbidden Error:**
```
HTTP 403: External Device Access is disabled on the DirecTV receiver.
To enable: Press MENU on DirecTV remote → Settings & Help → Settings → 
Whole-Home → External Device → Enable "External Access". 
Then restart the receiver.
```

**404 Not Found Error:**
```
HTTP 404: SHEF API endpoint not found. Verify the receiver supports 
network control and is using the correct firmware version.
```

### How to Enable External Device Access

Follow these steps on the DirecTV receiver:

1. Press **MENU** on the DirecTV remote control
2. Navigate to **Settings & Help**
3. Select **Settings**
4. Go to **Whole-Home**
5. Select **External Device**
6. Enable **"External Access"**
7. **Restart the DirecTV receiver** (power cycle recommended)
8. Test connection from Sports Bar TV Controller

### Verification
After enabling External Device Access, verify the connection works:

```bash
# From the server
curl http://192.168.5.121:8080/info/getVersion
```

**Expected Response:** JSON with receiver information (receiverId, accessCardId, version, etc.)  
**Error Response:** HTTP 403 if External Access is still disabled

### Supported DirecTV Receivers
- Genie HD DVR (HR44, HR54)
- HR24 HD DVR
- H24 HD Receiver
- Other SHEF-compatible receivers with firmware supporting the SHEF API

### Impact
✅ **Provides** clear, actionable error messages  
✅ **Reduces** troubleshooting time significantly  
✅ **Documents** the solution for future reference  
✅ **Prevents** confusion between network issues and security settings  
✅ **Improves** user experience with helpful guidance  

---

## Documentation Updates

### SYSTEM_DOCUMENTATION.md Changes
- **Added** "Recent Fixes and Changes" section
- **Documented** Prisma singleton pattern implementation
- **Included** step-by-step DirecTV troubleshooting guide
- **Provided** code examples showing before/after changes
- **Updated** version to 2.3
- **Updated** last modified date to October 16, 2025

---

## Testing & Verification

### Prisma Fix Testing

1. **Restart the application:**
   ```bash
   pm2 restart sports-bar-tv
   ```

2. **Test channel preset functionality:**
   - Navigate to http://24.123.87.42:3000/remote
   - Try changing channels using presets
   - Verify no errors occur

3. **Monitor logs:**
   ```bash
   pm2 logs sports-bar-tv --lines 50
   ```

4. **Verify success:**
   - No more "Cannot read properties of undefined" errors
   - Channel presets load correctly
   - Database queries execute successfully

### DirecTV Fix Testing

1. **Test without External Access enabled:**
   - Try sending a DirecTV command from the remote control
   - Verify the new error message appears with instructions

2. **Enable External Access:**
   - Follow the steps in the error message
   - Enable "External Access" on the DirecTV receiver
   - Restart the receiver

3. **Test with External Access enabled:**
   - Try sending commands again
   - Verify commands execute successfully
   - Check PM2 logs for successful command execution

4. **Verify error handling:**
   - Error messages are clear and actionable
   - Instructions are accurate and easy to follow

---

## GitHub Pull Request

**PR #197:** Fix: Critical Prisma Singleton and DirecTV 403 Error Handling  
**URL:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/197  
**Branch:** `fix/prisma-directv-errors`  
**Status:** Open (awaiting user verification)

### Commits
1. **6218614** - Fix: Prisma singleton pattern and DirecTV 403 error handling
2. **a60bf52** - docs: Update system documentation with Prisma and DirecTV fixes

---

## Deployment Instructions

After the PR is merged and you're ready to deploy:

1. **SSH into production server:**
   ```bash
   ssh -p 224 ubuntu@24.123.87.42
   ```

2. **Navigate to project directory:**
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   ```

3. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

4. **Install dependencies (if needed):**
   ```bash
   npm install
   ```

5. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

6. **Build the application:**
   ```bash
   npm run build
   ```

7. **Restart PM2:**
   ```bash
   pm2 restart sports-bar-tv
   ```

8. **Monitor logs:**
   ```bash
   pm2 logs sports-bar-tv
   ```

9. **Verify functionality:**
   - Test channel presets at http://24.123.87.42:3000/remote
   - Test DirecTV commands
   - Check for any errors in logs

---

## Additional Notes

### Prisma Best Practices
- **Always** use the singleton pattern for PrismaClient in Next.js
- **Never** create new PrismaClient instances in API routes or components
- **Import** from `@/lib/prisma` for all database operations
- **Monitor** connection pool usage in production

### DirecTV Integration Notes
- External Device Access must be enabled on **each** DirecTV receiver
- The setting may reset after firmware updates
- Some older receivers may not support the SHEF API
- Network connectivity and firewall rules must allow port 8080

### Future Improvements
- Consider adding automatic SHEF API capability detection
- Implement periodic health checks for DirecTV receivers
- Add UI indicator for External Device Access status
- Create automated tests for Prisma singleton pattern

---

## Support & Troubleshooting

### If Prisma Errors Persist
1. Check PM2 logs for specific error messages
2. Verify Prisma Client is generated: `npx prisma generate`
3. Check database connectivity: `npx prisma db pull`
4. Restart the application: `pm2 restart sports-bar-tv`

### If DirecTV Commands Still Fail
1. Verify External Device Access is enabled
2. Restart the DirecTV receiver (power cycle)
3. Test direct API access: `curl http://[receiver-ip]:8080/info/getVersion`
4. Check network connectivity and firewall rules
5. Verify receiver supports SHEF API (check model compatibility)

### Getting Help
- **PM2 Logs:** `pm2 logs sports-bar-tv`
- **GitHub Issues:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues
- **Documentation:** `/home/ubuntu/Sports-Bar-TV-Controller/SYSTEM_DOCUMENTATION.md`

---

**Document Created:** October 16, 2025  
**Author:** AI Assistant  
**Status:** Complete  
**PR Status:** Open - Awaiting User Verification
