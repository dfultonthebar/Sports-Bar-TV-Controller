# 🚨 URGENT: Deployment Guide for Input Gain 500 Error Fix

**Date:** October 19, 2025  
**PR:** [#213](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/213)  
**Severity:** 🔥 CRITICAL  
**Estimated Deployment Time:** 5-10 minutes

---

## 📋 Executive Summary

This deployment fixes the **500 Internal Server Error** occurring on the input gain API endpoints that was preventing users from adjusting audio input levels. The fix updates all audio processor dynamic routes to properly handle async params for Next.js 15+ compatibility.

### Issues Resolved
- ✅ **500 errors on `/api/audio-processor/atlas-001/input-gain`**
- ✅ **Input gain sliders not functioning**
- ✅ **Configuration save operations failing**
- ✅ **Mock data verification completed**

---

## 🎯 Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] Access to remote server: `24.123.187.42` (port 224)
- [ ] SSH credentials ready
- [ ] PR #213 reviewed and approved
- [ ] Backup of current database (optional but recommended)
- [ ] PM2 is running on the server

---

## 🚀 Deployment Steps

### Step 1: Access Remote Server

```bash
ssh -p 224 ubuntu@24.123.187.42
# Password: 6809233DjD$$$
```

### Step 2: Navigate to Application Directory

```bash
cd ~/Sports-Bar-TV-Controller
```

### Step 3: Check Current Status

```bash
# Check current git status
git status

# Check current branch
git branch

# Check PM2 status
pm2 list
```

### Step 4: Merge PR and Pull Changes

**Option A: Merge via GitHub UI (Recommended)**
1. Go to https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/213
2. Review the changes
3. Click "Merge pull request"
4. Confirm the merge

Then on the server:
```bash
git checkout main
git pull origin main
```

**Option B: Merge via Command Line**
```bash
git fetch origin
git checkout main
git merge origin/fix/input-gain-500-error
```

### Step 5: Verify Changes

```bash
# Check that the fix is applied
git log --oneline -5

# Verify the modified files exist
ls -la src/app/api/audio-processor/[id]/input-gain/route.ts
```

### Step 6: Install Dependencies (if needed)

```bash
# Only if package.json was updated
npm install
```

### Step 7: Rebuild Application

```bash
npm run build
```

**Expected Output:**
```
✓ Compiled successfully
✓ Creating an optimized production build
```

### Step 8: Restart PM2

```bash
pm2 restart sportsbar-assistant
pm2 logs sportsbar-assistant --lines 50
```

### Step 9: Verify Deployment

```bash
# Test the API endpoint
curl -X GET http://localhost:3000/api/audio-processor/atlas-001/input-gain

# Check PM2 status
pm2 status

# Monitor logs for errors
pm2 logs sportsbar-assistant --lines 100
```

---

## ✅ Verification & Testing

### 1. API Health Check

```bash
# Should return 200 OK (not 500)
curl -X GET http://localhost:3000/api/audio-processor/atlas-001/input-gain
```

**Expected Response:**
```json
{
  "success": true,
  "processor": {
    "id": "atlas-001",
    "name": "...",
    "model": "AZMP8"
  },
  "gainSettings": [...]
}
```

### 2. Test Input Gain Adjustment

```bash
curl -X POST http://localhost:3000/api/audio-processor/atlas-001/input-gain \
  -H "Content-Type: application/json" \
  -d '{"inputNumber": 1, "gain": -10}'
```

**Expected Response:**
```json
{
  "success": true,
  "inputNumber": 1,
  "gain": -10,
  "message": "Input 1 gain set to -10dB"
}
```

### 3. Browser Testing

1. Open browser: `http://24.123.187.42:3000`
2. Navigate to **Audio Control** page
3. Go to **Atlas System** tab
4. Click **Configuration** button
5. Try adjusting input gain sliders
6. Verify no 500 errors in browser console (F12)

### 4. Atlas Communication Test

Check the Atlas communication logs:
```bash
tail -f ~/Sports-Bar-TV-Controller/log/atlas-communication.log
```

Look for:
- ✅ Successful TCP connections to Atlas (192.168.5.101:5321)
- ✅ Proper JSON-RPC commands being sent
- ✅ Valid responses from Atlas processor

---

## 🔍 Troubleshooting

### Issue: Build Fails

**Symptoms:** `npm run build` returns errors

**Solution:**
```bash
# Clear build cache
rm -rf .next

# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: PM2 Won't Restart

**Symptoms:** `pm2 restart` fails or shows errors

**Solution:**
```bash
# Stop all PM2 processes
pm2 stop all

# Start fresh
pm2 start ecosystem.config.js

# Or use npm script
npm start
```

### Issue: 500 Errors Still Occurring

**Symptoms:** Input gain endpoint still returns 500

**Possible Causes:**
1. Code not properly pulled
2. Build not completed successfully
3. PM2 not restarted
4. Database connection issues

**Solution:**
```bash
# Verify the fix is in the code
grep -A 5 "const params = await context.params" src/app/api/audio-processor/[id]/input-gain/route.ts

# If not found, pull again
git fetch --all
git reset --hard origin/main
npm run build
pm2 restart all
```

### Issue: Atlas Processor Not Responding

**Symptoms:** Timeouts or connection errors to Atlas

**Solution:**
```bash
# Verify Atlas IP address in database
sqlite3 data/sportsbar.db "SELECT id, name, ipAddress, port FROM AudioProcessor;"

# Test Atlas connectivity
ping 192.168.5.101

# Test TCP port
nc -zv 192.168.5.101 5321
```

---

## 📊 Rollback Plan

If the deployment causes issues, follow these steps to rollback:

### Step 1: Revert to Previous Commit

```bash
cd ~/Sports-Bar-TV-Controller

# Find the previous commit
git log --oneline -5

# Revert to previous commit (replace COMMIT_HASH)
git reset --hard COMMIT_HASH

# Example:
# git reset --hard 7071ab2
```

### Step 2: Rebuild

```bash
npm run build
```

### Step 3: Restart PM2

```bash
pm2 restart sportsbar-assistant
```

### Step 4: Verify

```bash
curl http://localhost:3000/
pm2 logs sportsbar-assistant --lines 50
```

---

## 📝 Post-Deployment Tasks

After successful deployment:

- [ ] Test all input gain controls on Atlas System tab
- [ ] Verify no 500 errors in browser console
- [ ] Check PM2 logs for any warnings
- [ ] Verify Atlas communication logs show successful connections
- [ ] Test configuration save/download functionality
- [ ] Inform users that input gain controls are now working
- [ ] Monitor application for next 30 minutes

---

## 📞 Support & Contact

### If Issues Arise:

1. **Check Logs:**
   ```bash
   pm2 logs sportsbar-assistant --lines 200
   tail -f log/atlas-communication.log
   tail -f log/error.log
   ```

2. **Gather Debug Info:**
   ```bash
   pm2 info sportsbar-assistant
   git log --oneline -10
   npm list next
   ```

3. **GitHub Issues:**
   - Open an issue: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues
   - Reference PR #213

### Atlas Processor Details

For reference during troubleshooting:

- **IP Address:** 192.168.5.101 (verify on production)
- **TCP Port:** 5321
- **HTTP Port:** 80
- **Model:** AZMP8 (8 zones)
- **Username:** admin
- **Password:** 6809233DjD$$$

---

## 🎉 Success Criteria

Deployment is successful when:

- ✅ Application builds without errors
- ✅ PM2 shows process running (green)
- ✅ GET `/api/audio-processor/atlas-001/input-gain` returns 200
- ✅ POST to input-gain endpoint returns 200
- ✅ Input gain sliders work in browser
- ✅ No 500 errors in browser console
- ✅ Atlas communication logs show successful commands
- ✅ No error messages in PM2 logs

---

## 📚 Related Documentation

- **Pull Request:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/213
- **Atlas Protocol Manual:** `ATS006993-B-AZM4-AZM8-3rd-Party-Control.pdf`
- **Previous Fixes:** `FIXES_APPLIED.md`
- **Mock Data Audit:** `MOCK_DATA_AUDIT.md`

---

**Deployment prepared by:** DeepAgent AI  
**Last updated:** October 19, 2025  
**Version:** 1.0
