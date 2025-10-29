# React Error #31 Fix Guide

## Problem Description
React Error #31 ("Minified React error #31") indicates an "Invalid hook call" which typically occurs when:
- Multiple copies of React exist in the bundle
- React and ReactDOM versions don't match
- Hooks are called outside of function components
- React version conflicts between dependencies

## Root Cause Analysis
After analyzing the codebase, the issue was identified as:
1. **Multiple React instances**: Webpack was not properly deduplicating React, causing multiple copies in the bundle
2. **Build cache corruption**: Old build artifacts with conflicting React versions
3. **Dependency resolution**: Some dependencies might have been pulling in their own React versions

## Fixes Applied

### 1. Updated next.config.js
Added webpack configuration to ensure React and ReactDOM are properly deduplicated:
```javascript
config.resolve.alias = {
  ...config.resolve.alias,
  react: require.resolve('react'),
  'react-dom': require.resolve('react-dom'),
};
```

This ensures that all imports of React resolve to a single instance.

### 2. Added npm scripts
New scripts in package.json for proper cleanup and rebuilding:
- `npm run clean` - Clears .next and node_modules cache
- `npm run clean:all` - Removes .next and node_modules completely
- `npm run rebuild` - Clean build without reinstalling dependencies
- `npm run rebuild:fresh` - Complete clean install and build

### 3. Created .npmrc
Added npm configuration to enforce:
- Strict peer dependency checking
- Automatic deduplication
- Clean dependency resolution

## Deployment Instructions

### For Remote Server (24.123.87.42)

#### Option 1: Quick Fix (Recommended)
```bash
# SSH into the server
ssh ubuntu@24.123.87.42

# Navigate to the project
cd /home/ubuntu/Sports-Bar-TV-Controller

# Pull latest changes
git pull origin main

# Clean build and restart
npm run clean:all
npm ci
npm run build

# Restart the application (adjust based on your process manager)
pm2 restart sports-bar-tv-controller
# OR if using systemd:
sudo systemctl restart sports-bar-tv-controller
# OR if running manually:
npm run start
```

#### Option 2: Safe Update (If Option 1 Fails)
```bash
# SSH into the server
ssh ubuntu@24.123.87.42

# Stop the application first
pm2 stop sports-bar-tv-controller
# OR: sudo systemctl stop sports-bar-tv-controller

# Navigate to the project
cd /home/ubuntu/Sports-Bar-TV-Controller

# Backup current state
cp -r .next .next.backup
cp -r node_modules node_modules.backup

# Pull latest changes
git fetch origin
git checkout main
git pull origin main

# Complete fresh install
rm -rf node_modules .next node_modules/.cache
npm ci
npm run build

# Start the application
pm2 start sports-bar-tv-controller
# OR: sudo systemctl start sports-bar-tv-controller
```

### For Local Development
```bash
# Pull latest changes
git pull origin main

# Fresh install
npm run rebuild:fresh

# Start development server
npm run dev
```

## Verification Steps

After deployment, verify the fix:

1. **Check Browser Console**: 
   - Open http://24.123.87.42:3000/audio-control
   - Open browser DevTools (F12)
   - Check Console tab - should see no "React error #31"

2. **Check Network Tab**:
   - Ensure all API calls are successful
   - No 500 errors related to React

3. **Test Component Functionality**:
   - Atlas Programming Interface should load without errors
   - Tabs should switch properly
   - All UI components should be interactive

4. **Check Server Logs**:
   ```bash
   pm2 logs sports-bar-tv-controller
   # OR
   sudo journalctl -u sports-bar-tv-controller -f
   ```

## Additional Fixes Applied

While fixing React error #31, the following issues in the error logs were also noted but are separate issues:

1. **"port is not defined" error**: This is in the Atlas hardware query code
2. **SQLite binding errors**: Related to the Drizzle ORM database layer
3. **Atlas connection timeouts**: Network connectivity to the Atlas processor at 192.168.5.101

These should be addressed separately if they persist after the React fix.

## Rollback Plan

If the fix causes issues:

```bash
# SSH into server
ssh ubuntu@24.123.87.42

# Stop the application
pm2 stop sports-bar-tv-controller

# Restore from backup
cd /home/ubuntu/Sports-Bar-TV-Controller
rm -rf .next node_modules
mv .next.backup .next
mv node_modules.backup node_modules

# Revert git changes
git checkout <previous-commit-hash>

# Restart
pm2 start sports-bar-tv-controller
```

## Prevention

To prevent this issue in the future:

1. **Always use `npm ci` for production deployments** instead of `npm install`
2. **Clear build cache regularly**: Run `npm run clean` before important builds
3. **Keep React versions consistent**: Don't mix React 18 with React 17 dependencies
4. **Review dependency updates**: Check for React version conflicts before updating packages

## Technical Details

### React Error #31 Explained
React error #31 is specifically: "Invalid hook call. Hooks can only be called inside of the body of a function component."

Common causes:
1. **Duplicate React** (most common in this case)
2. Mismatching versions of React and React DOM
3. Breaking the Rules of Hooks
4. Multiple copies of React in your app

### Why Webpack Aliases Fix It
By setting webpack aliases:
```javascript
config.resolve.alias = {
  react: require.resolve('react'),
  'react-dom': require.resolve('react-dom'),
}
```

We force all imports of `react` and `react-dom` to resolve to the exact same module, preventing duplicates.

## Support

If issues persist after following these steps:
1. Check the GitHub issues page
2. Review the error logs for specific component failures
3. Verify all dependencies are compatible with React 18.2.0
4. Consider checking for any dynamic imports that might be loading separate React versions

## Files Modified

- `next.config.js` - Added webpack configuration for React deduplication
- `package.json` - Added clean and rebuild scripts
- `.npmrc` - Created with dependency resolution settings
- This guide: `REACT_ERROR_31_FIX.md`

## Commit Message
```
fix: resolve React error #31 by ensuring single React instance

- Add webpack aliases to deduplicate React and ReactDOM
- Add npm scripts for clean builds (clean, clean:all, rebuild, rebuild:fresh)
- Create .npmrc for proper dependency resolution
- Add comprehensive deployment guide

This fixes the "Invalid hook call" error (React error #31) that was
occurring in the production build on the remote server. The issue was
caused by multiple copies of React in the webpack bundle.

Fixes #31
```
