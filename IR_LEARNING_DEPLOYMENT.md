# IR Learning Feature - Deployment Guide

**Feature Version:** 2.0  
**Deployment Date:** October 17, 2025  
**Status:** Ready for Production Deployment

---

## 📋 Overview

This deployment adds comprehensive IR learning functionality to the Global Cache settings, allowing users to learn IR codes directly from physical remote controls without requiring access to the Global Cache IR Database.

---

## ✨ New Features

### 1. **IR Learning UI**
- New "IR Learning" tab in Global Cache settings
- Device selection dropdown
- Start/Stop learning controls
- Real-time learning status display
- Learned code viewer with copy functionality
- Optional function name input
- Comprehensive usage instructions

### 2. **Backend API Routes**
- `POST /api/globalcache/learn` - Start IR learning session
- `DELETE /api/globalcache/learn` - Stop IR learning session
- Real-time TCP socket communication with Global Cache devices
- Automatic timeout handling (60 seconds)
- Comprehensive error handling

### 3. **Logging System**
- Verbose console logging for all operations
- Visual log separators for easy reading
- Detailed error messages and troubleshooting info
- PM2 log integration

### 4. **Documentation**
- Complete IR Learning section in SYSTEM_DOCUMENTATION.md
- Step-by-step usage guide
- Troubleshooting section
- API endpoint documentation
- Best practices guide

---

## 🚀 Deployment Instructions

### Option 1: Using the Deployment Script (Recommended)

1. **SSH into the production server:**
   ```bash
   ssh -p 224 ubuntu@24.123.87.42
   # Password: 6809233DjD$$$
   ```

2. **Navigate to project directory:**
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   ```

3. **Run the deployment script:**
   ```bash
   ./deploy-ir-learning.sh
   ```

The script will:
- Pull latest changes from GitHub
- Install dependencies
- Build the application
- Restart PM2
- Show application status
- Display recent logs

### Option 2: Manual Deployment

1. **SSH into the production server:**
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

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Build application:**
   ```bash
   npm run build
   ```

6. **Restart PM2:**
   ```bash
   pm2 restart sports-bar-tv
   ```

7. **Verify deployment:**
   ```bash
   pm2 status sports-bar-tv
   pm2 logs sports-bar-tv --lines 50
   ```

---

## ✅ Verification Steps

### 1. **Check Application Status**
```bash
pm2 status sports-bar-tv
```

Expected: Status should be "online"

### 2. **View Recent Logs**
```bash
pm2 logs sports-bar-tv --lines 30
```

Check for:
- No build errors
- Application starting successfully
- Port 3000 listening

### 3. **Test Web Interface**

1. Open browser: http://24.123.87.42:3000
2. Navigate to Device Configuration → Global Cache
3. Verify "IR Learning" tab is present
4. Verify UI loads without errors

### 4. **Test IR Learning Feature**

**Prerequisites:**
- At least one Global Cache device added
- Device is online and reachable
- Physical remote control available

**Testing Steps:**
1. Go to Device Configuration → Global Cache → IR Learning
2. Select a Global Cache device from dropdown
3. Click "Start Learning"
4. Verify status shows "Starting IR learning mode..."
5. Point remote at Global Cache device
6. Press a button on the remote
7. Verify learned code appears in text area
8. Click "Copy" to test copy functionality
9. Verify learning status shows success message

### 5. **Check Logs for IR Learning**
```bash
pm2 logs sports-bar-tv | grep "GLOBAL CACHE"
```

Expected log output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎓 [GLOBAL CACHE] Starting IR learning
   Device ID: clx123abc...
   Timestamp: 2025-10-17T...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔌 [GLOBAL CACHE] Connected to device
📤 [GLOBAL CACHE] Sending get_IRL command
✅ [GLOBAL CACHE] IR Learner enabled
🎉 [GLOBAL CACHE] IR code learned successfully!
```

---

## 📊 Files Changed

### New Files
- `src/app/api/globalcache/learn/route.ts` - IR learning API routes
- `deploy-ir-learning.sh` - Deployment script
- `IR_LEARNING_DEPLOYMENT.md` - This deployment guide

### Modified Files
- `src/components/globalcache/GlobalCacheControl.tsx` - Added IR learning UI
- `SYSTEM_DOCUMENTATION.md` - Added comprehensive IR learning documentation

### Documentation Updates
- Section 6.5: Global Cache IR Control (new)
- IR Learning Feature guide
- API endpoint documentation
- Troubleshooting section
- Best practices

---

## 🔍 Troubleshooting

### Issue: Deployment script fails

**Solution:**
```bash
# Make script executable
chmod +x deploy-ir-learning.sh

# Run with explicit bash
bash deploy-ir-learning.sh
```

### Issue: Build fails

**Solution:**
```bash
# Clear build cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Try build again
npm run build
```

### Issue: PM2 restart fails

**Solution:**
```bash
# Check PM2 status
pm2 list

# Try stopping and starting
pm2 stop sports-bar-tv
pm2 start sports-bar-tv

# If still failing, check logs
pm2 logs sports-bar-tv
```

### Issue: IR Learning tab not visible

**Solution:**
1. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Check console for JavaScript errors
4. Verify deployment was successful

### Issue: "Connection error" during learning

**Solution:**
1. Verify Global Cache device is powered on
2. Check network connectivity to device
3. Test device in Device Management tab
4. Check device IP address and port
5. Review server logs for detailed error

---

## 📝 Post-Deployment Tasks

### 1. **Test with Real Hardware**
- [ ] Test with actual Global Cache device
- [ ] Learn multiple IR codes
- [ ] Test with different remote controls
- [ ] Verify learned codes work when transmitted
- [ ] Test timeout scenarios

### 2. **Monitor Logs**
```bash
# Watch logs in real-time
pm2 logs sports-bar-tv --follow

# Filter for Global Cache operations
pm2 logs sports-bar-tv | grep "GLOBAL CACHE"
```

### 3. **User Training**
- Document the new feature for end users
- Create usage guide or video
- Update any user documentation
- Notify users of new capability

### 4. **Performance Monitoring**
- Monitor server resource usage
- Check for memory leaks
- Monitor network traffic to Global Cache devices
- Track error rates in logs

---

## 🎯 Success Criteria

Deployment is successful when:

- [x] Code changes pushed to GitHub
- [ ] Application builds without errors
- [ ] PM2 shows "online" status
- [ ] Web interface loads correctly
- [ ] IR Learning tab is visible
- [ ] Device selection dropdown works
- [ ] Start Learning button functional
- [ ] IR code captured successfully
- [ ] Learned code displayed in UI
- [ ] Copy functionality works
- [ ] Logs show successful learning operations
- [ ] No console errors in browser
- [ ] No error logs in PM2

---

## 📞 Support

### Log Locations
- **PM2 Logs**: `~/.pm2/logs/sports-bar-tv-out.log`
- **Error Logs**: `~/.pm2/logs/sports-bar-tv-error.log`
- **Application Port**: 3000

### Useful Commands
```bash
# View all logs
pm2 logs sports-bar-tv

# View Global Cache logs only
pm2 logs sports-bar-tv | grep "GLOBAL CACHE"

# View last 100 lines
pm2 logs sports-bar-tv --lines 100

# Follow logs in real-time
pm2 logs sports-bar-tv --follow

# Application status
pm2 status

# Restart if needed
pm2 restart sports-bar-tv

# Clear logs
pm2 flush sports-bar-tv
```

### Key Files
- **Main component**: `src/components/globalcache/GlobalCacheControl.tsx`
- **API route**: `src/app/api/globalcache/learn/route.ts`
- **Documentation**: `SYSTEM_DOCUMENTATION.md` (Section 6.5)

---

## 📚 Related Documentation

- **SYSTEM_DOCUMENTATION.md** - Section 6.5: Global Cache IR Control
- **global-cache-API-iTach.pdf** - Global Cache iTach API specification
- **API-GlobalIRDB_ver1.pdf** - IR Database API documentation

---

## 🎉 Feature Benefits

1. **Eliminates Database Dependency**: No longer need Global Cache IR Database account
2. **Direct Learning**: Learn codes directly from any remote control
3. **User-Friendly**: Simple, intuitive interface
4. **Real-Time Feedback**: Immediate code display after learning
5. **Comprehensive Logging**: Easy troubleshooting and debugging
6. **Well Documented**: Complete usage guide and API documentation

---

**Deployed by:** AI Development Assistant  
**Repository:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller  
**Production Server:** 24.123.87.42:3000  
**Deployment Status:** Ready for Production ✅
