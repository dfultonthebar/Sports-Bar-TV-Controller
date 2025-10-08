# Troubleshooting: Port Conflicts with PM2

## Overview

When reinstalling the Sports Bar TV Controller, you may encounter port conflicts if old PM2 processes are still running. This guide explains how to identify and resolve these issues.

## Symptoms

- Installation completes but the app shows as "errored" in PM2
- Error message: `EADDRINUSE: address already in use :::3000`
- Multiple PM2 processes with similar names (e.g., `sports-bar-tv-con…` and `sportsbar-assistant`)
- App restarts repeatedly but never comes online

## Root Cause

PM2 processes persist independently of the application files. When you:
1. Remove the installation directory (`rm -rf ~/Sports-Bar-TV-Controller`)
2. Run a fresh install

The old PM2 process continues running and holds port 3000, preventing the new installation from starting.

## Quick Fix

If you're experiencing a port conflict right now, run these commands:

```bash
# List all PM2 processes to identify the old one
pm2 list

# Delete the old process (replace with actual name from pm2 list)
pm2 delete sports-bar-tv-con

# Restart the new process
pm2 restart sportsbar-assistant

# Verify it's running
pm2 status

# Save the PM2 configuration
pm2 save
```

## Detailed Diagnosis

### Step 1: Check PM2 Processes

```bash
pm2 list
```

Look for multiple processes with similar names or any process in "errored" state.

### Step 2: Check Port Usage

```bash
# Using netstat
sudo netstat -tulpn | grep :3000

# Or using ss
sudo ss -tulpn | grep :3000

# Or using lsof
sudo lsof -i :3000
```

This shows what's actually using port 3000.

### Step 3: Check PM2 Logs

```bash
# View logs for the errored process
pm2 logs sportsbar-assistant

# Or view all logs
pm2 logs
```

Look for `EADDRINUSE` errors.

## Complete Cleanup

If you want to completely clean up all PM2 processes and start fresh:

```bash
# Stop all PM2 processes
pm2 stop all

# Delete all PM2 processes
pm2 delete all

# Clear PM2 saved configuration
pm2 save --force

# Verify nothing is running
pm2 list

# Now reinstall or restart your app
cd ~/Sports-Bar-TV-Controller
pm2 start npm --name sportsbar-assistant -- start
pm2 save
```

## Prevention

The installer has been updated (as of October 2024) to automatically detect and clean up conflicting PM2 processes before starting new ones. If you're using the latest installer, this issue should be prevented automatically.

### What the Installer Does Now

1. **Scans for existing processes**: Checks for any PM2 processes matching "sportsbar" or "sports-bar-tv"
2. **Checks port 3000**: Identifies processes that might be using the default Next.js port
3. **Cleans up automatically**: Stops and deletes conflicting processes before starting the new one
4. **Verifies port availability**: Ensures port 3000 is free before attempting to start

### Manual Reinstall Best Practice

If you're manually reinstalling (not using the installer script):

```bash
# 1. Stop and delete old PM2 processes FIRST
pm2 stop sportsbar-assistant 2>/dev/null || true
pm2 delete sportsbar-assistant 2>/dev/null || true

# 2. Remove old installation
rm -rf ~/Sports-Bar-TV-Controller

# 3. Run fresh install
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
```

## Understanding PM2 Process Persistence

PM2 is designed to keep processes running even when:
- You delete the application files
- You log out and back in
- The system reboots (if PM2 startup is configured)

This is normally a feature (keeps your app running), but during reinstalls it can cause conflicts.

### PM2 Process Lifecycle

```
Files Deleted → PM2 Process Still Running → Port Still Occupied
     ↓                    ↓                         ↓
New Install → New PM2 Process → Port Conflict Error
```

## Advanced Troubleshooting

### Check PM2 Process Details

```bash
# Get detailed JSON info about all processes
pm2 jlist

# Pretty print with jq
pm2 jlist | jq '.'

# Find processes using specific ports
pm2 jlist | jq '.[] | select(.pm2_env.PORT == "3000")'
```

### Check PM2 Startup Configuration

```bash
# View PM2 startup configuration
pm2 startup

# Disable PM2 startup (if needed)
pm2 unstartup

# Re-enable with correct configuration
pm2 startup
```

### Reset PM2 Completely

If PM2 itself is behaving strangely:

```bash
# Stop PM2 daemon
pm2 kill

# Remove PM2 configuration
rm -rf ~/.pm2

# Reinstall PM2
npm install -g pm2

# Restart your app
cd ~/Sports-Bar-TV-Controller
pm2 start npm --name sportsbar-assistant -- start
pm2 save
```

## Common Scenarios

### Scenario 1: Multiple Reinstalls

**Problem**: You've reinstalled multiple times and have several old processes.

**Solution**:
```bash
# Delete all processes matching our app
pm2 delete all

# Or selectively delete
pm2 list
pm2 delete sports-bar-tv-con
pm2 delete sportsbar-assistant
pm2 delete sportsbar-assistant-old

# Start fresh
pm2 start npm --name sportsbar-assistant -- start
pm2 save
```

### Scenario 2: Different Port

**Problem**: You want to run on a different port to avoid conflicts.

**Solution**:
```bash
# Edit .env file
cd ~/Sports-Bar-TV-Controller
nano .env

# Add or modify:
PORT=3001

# Restart PM2 process
pm2 restart sportsbar-assistant
```

### Scenario 3: PM2 Not Found After Install

**Problem**: Installer completes but `pm2` command not found.

**Solution**:
```bash
# Reload shell configuration
source ~/.profile

# Or log out and back in

# Verify PM2 is in PATH
which pm2
echo $PATH | grep npm-global
```

## Getting Help

If you're still experiencing issues:

1. **Check the installation log**: `/tmp/sportsbar-install-*.log`
2. **Check PM2 logs**: `pm2 logs sportsbar-assistant`
3. **Verify system requirements**: Node.js 20+, Ubuntu/Debian
4. **Check GitHub Issues**: [Sports Bar TV Controller Issues](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues)

## Related Documentation

- [Installation Guide](../README.md#installation)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Uninstall Guide](../README.md#uninstallation)

## Summary

**Key Takeaways**:
- PM2 processes persist independently of application files
- Always clean up old PM2 processes before reinstalling
- The latest installer handles this automatically
- Use `pm2 list` and `pm2 delete` to manage processes manually
- Port conflicts are easy to fix once you understand the cause

**Quick Commands**:
```bash
# Check status
pm2 list

# Fix conflict
pm2 delete <old-process-name>
pm2 restart sportsbar-assistant

# Complete reset
pm2 delete all
pm2 save --force
```
