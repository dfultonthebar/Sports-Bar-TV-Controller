# NFHS Network "File is not defined" Error - Fix Deployment Guide

## Problem Summary
When switching to Live Data Mode and clicking "Sync with NFHS" button on the NFHS Network page, users encountered a JavaScript error: **"File is not defined"**

This prevented the NFHS Network integration from fetching live game data.

## Root Cause
The error was caused by incorrect usage of dynamic imports for the `cheerio` library in the NFHS sync API route.

When using `await import('cheerio')`, the code returns the module object, not the default export. The code was calling `cheerio.load()` directly, which doesn't exist on the module object - it should be `cheerio.default.load()`.

## Solution Applied
✅ Fixed all 5 instances of `cheerio.load()` to use `cheerio.default.load()` in `/src/app/api/nfhs/sync/route.ts`
✅ Updated `.env.example` to show correct NFHS credential format
✅ Created Pull Request #58: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/58

## Deployment Instructions for Remote Server

### Server Details
- Host: 135.131.39.26:223
- Username: ubuntu
- Project Path: /home/ubuntu/Sports-Bar-TV-Controller

### Step 1: SSH into the Server
```bash
ssh -p 223 ubuntu@135.131.39.26
# Password: 6809233DjD$$$
```

### Step 2: Navigate to Project Directory
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
```

### Step 3: Fetch and Checkout Fix Branch
```bash
# Fetch latest changes from GitHub
git fetch origin

# Checkout the fix branch
git checkout fix/nfhs-cheerio-import-error

# Pull latest changes
git pull origin fix/nfhs-cheerio-import-error
```

### Step 4: Verify NFHS Credentials in .env
Ensure the `.env` file has the correct NFHS credentials:

```bash
# Check if credentials are present
grep "NFHS_" .env
```

Expected output:
```
NFHS_USERNAME=lhoople@graystonealehouse.com
NFHS_PASSWORD=Graystone#!
NFHS_LOCATION=Green Bay, Wisconsin
```

If credentials are missing or incorrect, update them:
```bash
nano .env
# Add or update the NFHS credentials as shown above
# Save with Ctrl+O, Exit with Ctrl+X
```

### Step 5: Restart the Application
```bash
# If using PM2
pm2 restart sports-bar-ai

# OR if running with npm
pkill -f "next dev"
npm run dev &
```

### Step 6: Test the Fix
1. Open browser and navigate to: http://192.168.1.25:3000/nfhs-network
2. Click the "Live Data Mode" toggle to enable it
3. Click the "Sync with NFHS" button
4. Verify that:
   - No "File is not defined" error appears
   - The sync process starts (shows "Syncing..." message)
   - Games load successfully after sync completes

### Step 7: Merge to Main (After Testing)
Once testing is successful, merge the fix to main branch:

```bash
# Switch to main branch
git checkout main

# Merge the fix branch
git merge fix/nfhs-cheerio-import-error

# Push to GitHub
git push origin main
```

## Alternative: Deploy from GitHub Main Branch
If you prefer to merge the PR first and then deploy:

1. **On GitHub**: Review and merge Pull Request #58
2. **On Server**:
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   git checkout main
   git pull origin main
   pm2 restart sports-bar-ai  # or restart your process
   ```

## Technical Details

### Files Changed
1. **src/app/api/nfhs/sync/route.ts**
   - Fixed 5 instances of `cheerio.load()` → `cheerio.default.load()`
   - Lines affected: 123, 209, 257, 313, 426

2. **.env.example**
   - Updated NFHS credential format for clarity

### Why This Fix Works
The `cheerio` library is dynamically imported to prevent it from being bundled during the Next.js build process (which would cause build-time errors). When using dynamic imports:

**Before (Incorrect):**
```typescript
const cheerio = await import('cheerio')
const $ = cheerio.load(html)  // ❌ Error: cheerio.load is not a function
```

**After (Correct):**
```typescript
const cheerio = await import('cheerio')
const $ = cheerio.default.load(html)  // ✅ Works correctly
```

## Troubleshooting

### If the error persists after deployment:
1. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run build
   npm run start
   ```

2. **Check server logs:**
   ```bash
   pm2 logs sports-bar-ai
   # or
   tail -f logs/app.log
   ```

3. **Verify cheerio is installed:**
   ```bash
   npm list cheerio
   ```

4. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### If NFHS sync still fails:
1. **Verify credentials are correct** - Test login at https://www.nfhsnetwork.com
2. **Check NFHS Network is accessible** from the server
3. **Review API logs** for authentication errors

## Expected Behavior After Fix

### Before Fix:
- ❌ "File is not defined" error in browser console
- ❌ Sync fails immediately
- ❌ No games load in Live Data Mode

### After Fix:
- ✅ No JavaScript errors
- ✅ Sync process starts and shows progress
- ✅ NFHS authentication succeeds
- ✅ Games load from NFHS Network
- ✅ Live data displays correctly

## Support
If you encounter any issues during deployment:
1. Check the Pull Request for updates: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/58
2. Review server logs for detailed error messages
3. Ensure all environment variables are correctly configured

## Summary
This fix resolves a critical bug in the NFHS Network integration that prevented live data synchronization. The issue was a simple but important correction to how the cheerio library is imported and used in the API route.

**Status**: ✅ Fix implemented and ready for deployment
**PR**: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/58
**Branch**: fix/nfhs-cheerio-import-error
