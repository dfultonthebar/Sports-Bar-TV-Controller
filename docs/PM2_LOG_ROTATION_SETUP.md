# PM2 Log Rotation Setup Guide

**Purpose:** Configure automatic log rotation for PM2 to prevent logs from consuming disk space
**Estimated Time:** 5 minutes
**Difficulty:** Easy

---

## Why Log Rotation is Important

Without log rotation:
- Logs grow indefinitely and can fill disk space
- Large log files are slow to open and search
- System performance can degrade

Current log sizes:
- `sports-bar-tv-controller-out.log`: 8.7 MB (growing)
- Other PM2 logs: 16+ MB total

---

## Installation Steps

### 1. Install PM2 Logrotate Module

```bash
pm2 install pm2-logrotate
```

Expected output:
```
[PM2] Installing module pm2-logrotate
[PM2] Module downloaded
[PM2] Module installed and launched
```

### 2. Configure Rotation Settings

```bash
# Rotate logs when they reach 10MB
pm2 set pm2-logrotate:max_size 10M

# Keep 5 rotated files
pm2 set pm2-logrotate:retain 5

# Compress old logs to save space
pm2 set pm2-logrotate:compress true

# Rotate daily at midnight (optional)
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'

# Include workerInterval for periodic checks (every 30 seconds)
pm2 set pm2-logrotate:workerInterval 30
```

### 3. Verify Configuration

```bash
pm2 conf pm2-logrotate
```

You should see:
```json
{
  "max_size": "10M",
  "retain": 5,
  "compress": true,
  "rotateInterval": "0 0 * * *",
  "workerInterval": 30
}
```

### 4. Save PM2 Configuration

```bash
pm2 save
```

This ensures log rotation persists after system reboot.

---

## How It Works

Once configured, pm2-logrotate will:

1. **Monitor** all PM2 log files every 30 seconds
2. **Rotate** any log file that exceeds 10MB
3. **Rename** the old log (e.g., `app-out.log` → `app-out__2025-11-02-19-30-00.log`)
4. **Compress** the rotated file (e.g., → `app-out__2025-11-02-19-30-00.log.gz`)
5. **Delete** old rotated files, keeping only the 5 most recent
6. **Create** a new empty log file for the application

---

## Rotation File Naming

Rotated files follow this pattern:
```
<app-name>-<out|error>__YYYY-MM-DD-HH-mm-ss.log[.gz]
```

Examples:
- `sports-bar-tv-controller-out__2025-11-02-19-30-00.log.gz`
- `sports-bar-tv-controller-error__2025-11-02-19-30-00.log.gz`

---

## Checking Rotated Logs

### List Rotated Logs
```bash
ls -lh /home/ubuntu/.pm2/logs/*.gz
```

### View Compressed Log
```bash
# View most recent rotated log
zcat /home/ubuntu/.pm2/logs/sports-bar-tv-controller-out__*.log.gz | tail -100

# Or decompress temporarily
gunzip -c /home/ubuntu/.pm2/logs/sports-bar-tv-controller-out__*.log.gz | less
```

---

## Disk Space Calculation

With current settings:
- Active log: up to 10MB
- Rotated logs: 5 files × ~10MB (compressed to ~1-2MB each)
- **Total max space per app:** ~20MB (vs unlimited without rotation)

For the Sports Bar system with 2 main apps:
- **Before rotation:** Unlimited (currently 25MB, growing)
- **After rotation:** ~40MB maximum (controlled)

---

## Troubleshooting

### Check if Module is Running
```bash
pm2 ls
```
You should see `pm2-logrotate` in the list with status "online"

### View Module Logs
```bash
pm2 logs pm2-logrotate
```

### Restart Module
```bash
pm2 restart pm2-logrotate
```

### Uninstall (if needed)
```bash
pm2 uninstall pm2-logrotate
```

---

## Alternative: Manual Log Cleanup

If you don't want to install the module, you can manually clear logs:

```bash
# Clear all logs
pm2 flush

# Or clear specific app logs
pm2 flush sports-bar-tv-controller
```

**Warning:** This deletes all log history immediately!

---

## Advanced Configuration

### Rotate at Specific Time
```bash
# Rotate daily at 3 AM
pm2 set pm2-logrotate:rotateInterval '0 3 * * *'

# Rotate weekly on Sunday at midnight
pm2 set pm2-logrotate:rotateInterval '0 0 * * 0'
```

### Different Settings Per App
```bash
# For apps with high log volume, rotate at 5MB
pm2 set pm2-logrotate:max_size 5M

# Keep more history for critical apps
pm2 set pm2-logrotate:retain 10
```

### Disable Compression (faster, uses more space)
```bash
pm2 set pm2-logrotate:compress false
```

---

## Recommended Settings by Environment

### Development
```bash
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 3
pm2 set pm2-logrotate:compress false
```
*Larger files, less compression for easier debugging*

### Production (Current System)
```bash
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 5
pm2 set pm2-logrotate:compress true
```
*Balanced approach - recommended*

### High-Volume Production
```bash
pm2 set pm2-logrotate:max_size 5M
pm2 set pm2-logrotate:retain 10
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 */6 * * *'  # Every 6 hours
```
*Aggressive rotation for systems with heavy logging*

---

## Monitoring Log Rotation

### Check Current Log Sizes
```bash
du -h /home/ubuntu/.pm2/logs/*.log
```

### Count Rotated Files
```bash
ls -1 /home/ubuntu/.pm2/logs/*.gz | wc -l
```

### Total Log Directory Size
```bash
du -sh /home/ubuntu/.pm2/logs/
```

### Watch Rotation Happen (for testing)
```bash
# Set very small max size for testing
pm2 set pm2-logrotate:max_size 1M

# Generate logs to trigger rotation
pm2 logs sports-bar-tv-controller

# Watch for rotation in module logs
pm2 logs pm2-logrotate
```

---

## Quick Setup Commands (Copy-Paste)

```bash
# Complete setup in one go
pm2 install pm2-logrotate && \
pm2 set pm2-logrotate:max_size 10M && \
pm2 set pm2-logrotate:retain 5 && \
pm2 set pm2-logrotate:compress true && \
pm2 set pm2-logrotate:rotateInterval '0 0 * * *' && \
pm2 set pm2-logrotate:workerInterval 30 && \
pm2 save && \
echo "✓ PM2 log rotation configured successfully!"
```

---

## References

- [PM2 Logrotate Documentation](https://github.com/keymetrics/pm2-logrotate)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/log-management/)

---

**Last Updated:** November 2, 2025
**Tested On:** Ubuntu Server with PM2 v6.0.13
