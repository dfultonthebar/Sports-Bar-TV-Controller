# Deployment Guide - Atlas Integration Fix

**Date:** October 24, 2025  
**Pull Request:** #258  
**Branch:** `fix/atlas-dynamic-discovery`

---

## Overview

This fix resolves the Atlas integration issues where the application was using hardcoded limits instead of querying the actual hardware configuration. The application was querying for 8 zones, 8 groups, and 14 sources when the actual Atlas device only has 7 zones, 6 groups, and 9 sources.

---

## What Was Fixed

### Files Modified:
1. ✅ **NEW:** `src/app/api/atlas/discover-config/route.ts` - Configuration discovery API
2. ✅ **MODIFIED:** `src/app/api/atlas/groups/route.ts` - Dynamic group discovery
3. ✅ **MODIFIED:** `src/app/api/atlas/input-meters/route.ts` - Dynamic source discovery
4. ✅ **MODIFIED:** `src/app/api/atlas/output-meters/route.ts` - Dynamic zone/group discovery
5. ✅ **MODIFIED:** `src/components/AtlasGroupsControl.tsx` - Dynamic source discovery

### Changes:
- ❌ Removed all hardcoded loop limits (8, 14, etc.)
- ✅ Added dynamic discovery that queries until error
- ✅ Application now adapts to actual hardware configuration
- ✅ Works with any Atlas model without code changes

---

## Deployment Steps

### Option 1: Merge PR and Deploy (Recommended)

**Step 1: Review and Merge PR**
1. Go to: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/258
2. Review the changes
3. Click "Merge pull request"
4. Confirm merge

**Step 2: SSH into Remote Server**
```bash
ssh -p 2222 djd@24.123.87.42
```
Password: `6809233DjD$$$`

**Step 3: Navigate to Project Directory**
```bash
cd /path/to/Sports-Bar-TV-Controller
# (Find the exact path - likely ~/Sports-Bar-TV-Controller or /opt/Sports-Bar-TV-Controller)
```

**Step 4: Pull Latest Changes**
```bash
git pull origin main
```

**Step 5: Install Dependencies (if needed)**
```bash
npm install
```

**Step 6: Rebuild Application**
```bash
npm run build
```

**Step 7: Restart PM2**
```bash
pm2 restart all
```

**Step 8: Check Logs**
```bash
pm2 logs --lines 50
```

Look for:
- ✅ "Discovered X groups (stopped at index Y)" messages
- ✅ No errors about missing zones/groups/sources
- ✅ Successful API responses

---

### Option 2: Deploy Without Merging (Testing)

If you want to test the fix before merging:

**Step 1: SSH into Remote Server**
```bash
ssh -p 2222 djd@24.123.87.42
```

**Step 2: Navigate to Project and Switch Branch**
```bash
cd /path/to/Sports-Bar-TV-Controller
git fetch origin
git checkout fix/atlas-dynamic-discovery
```

**Step 3: Install, Build, Restart**
```bash
npm install
npm run build
pm2 restart all
pm2 logs --lines 50
```

**Step 4: Test (see Testing section below)**

**Step 5: Switch Back to Main (if needed)**
```bash
git checkout main
npm run build
pm2 restart all
```

---

## Testing After Deployment

### 1. Access Bartender Remote Page
Open in browser: `http://24.123.87.42:3000/remote` (or whatever port the app runs on)

### 2. Navigate to Audio Tab
- Click on the "Audio" tab
- Click on the "Groups" sub-tab

### 3. Verify Group Count
**Expected:** Exactly 6 groups should be displayed:
1. Bar
2. Dining
3. Red Bird
4. Party East
5. Patio
6. Bath Rooms

**Before Fix:** Would show 8 groups (including 2 non-existent ones)

### 4. Verify All Groups Show as Active
**Expected:** All 6 groups should show as "active" (not "inactive")

### 5. Verify Source Dropdown
Click on any group and check the source dropdown.

**Expected:** Exactly 9 sources should be listed:
1. Matrix 1
2. Matrix 2
3. Matrix 3
4. Matrix 4
5. Mic 1
6. Mic 2
7. Spotify
8. Party Room East
9. Party Room West

**Before Fix:** Would show 14 sources (including 5 non-existent ones)

### 6. Test Real Hardware Control
1. Select a group (e.g., "Bar")
2. Change its source (e.g., from "Matrix 1" to "Spotify")
3. **Verify:** The actual audio in the bar area changes to Spotify
4. Check the Atlas web interface (http://24.123.87.42:8888) to confirm the change

### 7. Check Browser Console
Open browser developer tools (F12) and check the Console tab.

**Expected:**
- ✅ No errors
- ✅ Messages like "Discovered 9 sources from Atlas device"
- ✅ Successful API responses

**Before Fix:**
- ❌ Errors about missing groups/zones/sources
- ❌ "No zones or groups created" messages

### 8. Check PM2 Logs
```bash
pm2 logs --lines 100
```

**Expected:**
- ✅ "Discovered X groups (stopped at index Y)" messages
- ✅ No errors about Atlas queries
- ✅ Successful API responses

---

## Troubleshooting

### Issue: "Cannot connect to Atlas device"
**Solution:**
1. Verify Atlas device is online: `ping 192.168.5.101`
2. Check Atlas web interface: http://24.123.87.42:8888
3. Verify Third Party Control is enabled in Atlas Settings
4. Check firewall rules allow port 5321

### Issue: "Groups still showing as inactive"
**Solution:**
1. Check Atlas web interface to see if groups are actually active
2. If not, activate them in Atlas: Zones page → Groups section → Click group → Set Active
3. Refresh the bartender remote page

### Issue: "Still seeing 8 groups instead of 6"
**Solution:**
1. Hard refresh browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. Clear browser cache
3. Verify you pulled the latest code: `git log --oneline -5`
4. Verify the build completed successfully: Check for `.next` directory

### Issue: "Source changes don't control hardware"
**Solution:**
1. Check PM2 logs for errors: `pm2 logs --lines 100`
2. Verify Atlas device IP is correct: 192.168.5.101
3. Test Atlas connection: `curl http://192.168.5.101:8888`
4. Check Atlas Third Party Control settings

---

## Rollback Plan

If something goes wrong, you can quickly rollback:

### Quick Rollback:
```bash
cd /path/to/Sports-Bar-TV-Controller
git checkout main
npm run build
pm2 restart all
```

### Full Rollback (if main is broken):
```bash
cd /path/to/Sports-Bar-TV-Controller
git log --oneline -10  # Find the commit before the merge
git reset --hard <commit-hash>
npm run build
pm2 restart all
```

---

## Verification Checklist

After deployment, verify:

- [ ] SSH connection to remote server works
- [ ] Application is running (check with `pm2 status`)
- [ ] Bartender remote page loads without errors
- [ ] Audio tab shows exactly 6 groups (not 8)
- [ ] All 6 groups show as "active"
- [ ] Source dropdown shows exactly 9 sources (not 14)
- [ ] Changing a group's source controls real hardware
- [ ] Browser console shows no errors
- [ ] PM2 logs show no errors
- [ ] Atlas web interface confirms changes

---

## Expected Results

### Before Fix:
- ❌ Application queried for 8 groups (2 non-existent)
- ❌ Application queried for 14 sources (5 non-existent)
- ❌ Application queried for 8 zones (1 non-existent)
- ❌ "No zones or groups created" messages
- ❌ Errors in console and logs
- ❌ Confusion about which groups are real

### After Fix:
- ✅ Application queries exactly 6 groups (all real)
- ✅ Application queries exactly 9 sources (all real)
- ✅ Application queries exactly 7 zones (all real)
- ✅ All groups show as "active"
- ✅ No errors in console or logs
- ✅ Clear, accurate display of hardware configuration
- ✅ Real hardware control works perfectly

---

## Support

If you encounter any issues during deployment:

1. **Check PM2 Logs:** `pm2 logs --lines 100`
2. **Check Browser Console:** F12 → Console tab
3. **Verify Atlas Device:** http://24.123.87.42:8888
4. **Review PR:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/258
5. **Check Documentation:**
   - `ATLAS_INTEGRATION_ANALYSIS.md`
   - `ATLAS_INTEGRATION_FIX_SUMMARY.md`

---

## Notes

- The SSH connection to the remote server was timing out during development, so these instructions assume you'll deploy manually
- The Atlas device is confirmed working and accessible at 192.168.5.101
- Third Party Control is enabled with correct IP allowlist
- All changes are backward compatible and safe to deploy
- The fix ensures the application will work with any Atlas model without code changes

---

## Success Criteria

Deployment is successful when:
1. ✅ Bartender remote page loads without errors
2. ✅ Exactly 6 groups are displayed (matching Atlas hardware)
3. ✅ All 6 groups show as "active"
4. ✅ Exactly 9 sources are available in dropdowns
5. ✅ Changing sources controls real hardware
6. ✅ No errors in browser console or PM2 logs
7. ✅ User can control audio groups from bartender remote page

**Once all criteria are met, the Atlas integration is fully fixed and working correctly!**
