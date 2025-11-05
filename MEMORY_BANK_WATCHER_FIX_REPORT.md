# Memory Bank File Watcher ENOSPC Fix Report

**Date**: November 4, 2025  
**Issue**: File watcher hitting ENOSPC errors (system limit for file watchers reached)  
**Status**: RESOLVED

## Problem Summary

The Memory Bank file watcher at `/home/ubuntu/Sports-Bar-TV-Controller/src/lib/memory-bank/file-watcher.ts` was failing with ENOSPC errors:

```
Error: ENOSPC: System limit for number of file watchers reached, watch '/home/ubuntu/Sports-Bar-TV-Controller/ecosystem.config.js'
Error: ENOSPC: System limit for number of file watchers reached, watch '/home/ubuntu/Sports-Bar-TV-Controller/src'
Error: ENOSPC: System limit for number of file watchers reached, watch '/home/ubuntu/Sports-Bar-TV-Controller/docs'
Error: ENOSPC: System limit for number of file watchers reached, watch '/home/ubuntu/Sports-Bar-TV-Controller/scripts'
```

## Root Cause

Linux systems have a shared inotify watch limit (`fs.inotify.max_user_watches`) across all processes. The default limit was too low for the number of watchers needed by:
- Memory Bank file watcher
- Next.js development server
- Other Node.js processes
- IDE and development tools

## Actions Taken

### 1. Killed Old Broken Watcher Processes
```bash
kill 1003845 1007788 1016442
```

### 2. Increased System inotify Limit
- **Old limit**: 119,844 watches
- **New limit**: 524,288 watches (4.4x increase)

```bash
# Added to /etc/sysctl.conf for persistence
sudo sh -c 'echo "fs.inotify.max_user_watches=524288" >> /etc/sysctl.conf'

# Applied changes
sudo sysctl -p
```

### 3. Enhanced Error Handling
Modified `/home/ubuntu/Sports-Bar-TV-Controller/src/lib/memory-bank/file-watcher.ts` to:
- Detect ENOSPC errors specifically
- Log helpful troubleshooting information
- Provide remediation hints

### 4. Created Documentation
- Created `/home/ubuntu/Sports-Bar-TV-Controller/docs/FILE_WATCHER_TROUBLESHOOTING.md`
- Documented the fix and alternative solutions
- Included monitoring commands and references

## Test Results

### Before Fix
```
Error: ENOSPC: System limit for number of file watchers reached
```

### After Fix
```
✅ File watcher started successfully!
   Watching for changes in key project files...
   Auto-snapshot will be created on significant changes.
```

**No ENOSPC errors observed** after running for 60+ seconds.

## Files Modified

1. `/etc/sysctl.conf` - Added inotify limit increase (system-wide)
2. `/home/ubuntu/Sports-Bar-TV-Controller/src/lib/memory-bank/file-watcher.ts` - Enhanced error handling
3. `/home/ubuntu/Sports-Bar-TV-Controller/docs/FILE_WATCHER_TROUBLESHOOTING.md` - New troubleshooting guide

## Verification

```bash
# Check current limit
cat /proc/sys/fs/inotify/max_user_watches
# Output: 524288

# Start watcher
npm run memory:watch
# Status: Running successfully without errors
```

## Alternative Solutions Available

If future issues occur or system limit cannot be increased:

1. **Reduce watch patterns** - Watch fewer directories
2. **Use manual snapshots** - Run `npm run memory:snapshot` manually
3. **Use polling** - Switch to polling instead of inotify (higher CPU usage)

See `/home/ubuntu/Sports-Bar-TV-Controller/docs/FILE_WATCHER_TROUBLESHOOTING.md` for details.

## Recommendations

1. **Monitor watch usage** periodically using commands in troubleshooting guide
2. **Keep the new limit** (524,288) in `/etc/sysctl.conf` for future system reboots
3. **If adding more watchers**, consider further increasing the limit or using polling

## Conclusion

The Memory Bank file watcher ENOSPC issue has been **successfully resolved** by increasing the system inotify limit from 119,844 to 524,288 watches. The watcher now starts and runs without errors. Enhanced error handling and comprehensive documentation have been added to prevent and troubleshoot future issues.
