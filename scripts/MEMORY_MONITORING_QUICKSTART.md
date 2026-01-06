# Memory Monitoring Quick Start

## Quick Commands

### View Current Memory Status
```bash
pm2 status sports-bar-tv-controller
```

### View Memory Logs
```bash
# Last 20 entries
tail -n 20 /home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log

# Real-time monitoring
tail -f /home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log
```

### Run Memory Analysis
```bash
# Last 24 hours (default)
/home/ubuntu/Sports-Bar-TV-Controller/scripts/analyze-memory.sh

# Last week
/home/ubuntu/Sports-Bar-TV-Controller/scripts/analyze-memory.sh 168
```

### Launch Real-Time Dashboard
```bash
/home/ubuntu/Sports-Bar-TV-Controller/scripts/memory-dashboard.sh
```

### Check Cron Job
```bash
crontab -l | grep monitor-memory
```

## File Locations

- **Monitor Script:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/monitor-memory.sh`
- **Analysis Script:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/analyze-memory.sh`
- **Dashboard Script:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/memory-dashboard.sh`
- **Events Script:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/monitor-pm2-events.sh`
- **Memory Log:** `/home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log`
- **Events Log:** `/home/ubuntu/Sports-Bar-TV-Controller/logs/pm2-events.log`
- **Full Documentation:** `/home/ubuntu/Sports-Bar-TV-Controller/docs/MEMORY_MONITORING.md`

## Thresholds

- **OK:** 0-800MB
- **WARNING:** 800-900MB (80-90% of max)
- **CRITICAL:** >900MB (>90% of max)

## Automated Monitoring

Cron runs every 5 minutes automatically. No manual intervention needed.

## Current Status

- Restart count: 1 (was 95 before recent PM2 restart)
- Current memory: ~192MB (19% of max)
- Status: OK (Healthy)
