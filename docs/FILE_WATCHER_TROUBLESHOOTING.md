# File Watcher Troubleshooting Guide

## ENOSPC Error: System Limit for File Watchers Reached

### Problem
The Memory Bank file watcher fails with ENOSPC errors:
```
Error: ENOSPC: System limit for number of file watchers reached, watch '/path/to/file'
```

### Root Cause
Linux systems have a default inotify watch limit (`fs.inotify.max_user_watches`) that is shared across ALL processes. The default limit (typically 8192-128000) can be exhausted by:
- Multiple Node.js processes (Next.js dev server, file watchers, etc.)
- Other development tools (IDEs, build tools)
- The Memory Bank file watcher

### Solution: Increase System Limit

#### 1. Check Current Limit
```bash
cat /proc/sys/fs/inotify/max_user_watches
```

#### 2. Increase Limit Permanently
```bash
# Add to sysctl.conf
sudo sh -c 'echo "fs.inotify.max_user_watches=524288" >> /etc/sysctl.conf'

# Apply changes
sudo sysctl -p

# Verify new limit
cat /proc/sys/fs/inotify/max_user_watches
```

#### 3. Increase Limit Temporarily (Until Reboot)
```bash
sudo sysctl fs.inotify.max_user_watches=524288
```

### Fix Applied: November 4, 2025

**Old Limit**: 119,844  
**New Limit**: 524,288  
**Result**: File watcher now starts successfully without ENOSPC errors

### Alternative Solutions (If System Limit Increase Fails)

If you cannot increase the system limit or still encounter issues:

#### Option 1: Reduce Watch Patterns
Edit `/home/ubuntu/Sports-Bar-TV-Controller/src/lib/memory-bank/file-watcher.ts`:

```typescript
includePatterns: [
  // Only watch critical source files
  'src/app/**/*.{ts,tsx}',
  'src/lib/**/*.{ts,tsx}',
  'src/components/**/*.{ts,tsx}',
  'package.json',
  'next.config.js',
]
```

#### Option 2: Use Manual Snapshots
Disable the file watcher and use manual snapshots instead:

```bash
# Create snapshot manually
npm run memory:snapshot

# View memory bank
npm run memory:view
```

#### Option 3: Use Polling Instead of Native Watchers
Edit file-watcher.ts to add polling option:

```typescript
this.watcher = chokidar.watch(watchPaths, {
  // ... existing options ...
  usePolling: true,  // Use polling instead of native file watchers
  interval: 1000,    // Poll every 1 second
});
```

**Note**: Polling uses more CPU but doesn't require inotify watches.

### Error Handling Enhancement

The file watcher now includes improved error handling for ENOSPC errors:
- Detects ENOSPC errors specifically
- Logs helpful troubleshooting information
- Suggests remediation steps

### Monitoring Watch Usage

To see how many watches are currently in use:

```bash
# Count watches per process
for foo in /proc/*/fd/*; do readlink -f $foo; done | grep inotify | sort | uniq -c | sort -nr

# Get total watches in use (approximate)
find /proc/*/fd/* -lname 'anon_inode:inotify' 2>/dev/null | wc -l
```

### References
- [inotify man page](https://man7.org/linux/man-pages/man7/inotify.7.html)
- [Chokidar documentation](https://github.com/paulmillr/chokidar)
- System limit file: `/proc/sys/fs/inotify/max_user_watches`
