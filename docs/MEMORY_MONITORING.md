# Memory Monitoring System

## Overview

The Sports-Bar-TV-Controller application has experienced 95 PM2 restarts, primarily due to memory-related issues. This monitoring system provides continuous tracking, analysis, and alerting for memory usage to help diagnose and prevent future crashes.

## System Components

### 1. Memory Monitor Script (`monitor-memory.sh`)

**Location:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/monitor-memory.sh`

**Purpose:** Continuously tracks PM2 process memory usage and logs metrics every 5 minutes via cron.

**What it monitors:**
- Memory usage (in MB and bytes)
- CPU usage (%)
- Process uptime
- Restart count
- Status level (OK, WARNING, CRITICAL)

**Thresholds:**
- **OK:** 0-800MB (0-80% of max)
- **WARNING:** 800-900MB (80-90% of max)
- **CRITICAL:** >900MB (>90% of max)

**Log Location:** `/home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log`

**Cron Schedule:** Every 5 minutes
```bash
*/5 * * * * /home/ubuntu/Sports-Bar-TV-Controller/scripts/monitor-memory.sh
```

**Log Format:**
```
2025-11-06T00:58:26-06:00 | Status: OK | Memory: 192MB (201371648 bytes) | CPU: 0.3% | Restarts: 95 | Uptime: 0h
```

**Features:**
- Automatic log rotation when log exceeds 50MB
- Syslog integration for CRITICAL alerts
- Rapid growth detection (>100MB in 15 minutes)

### 2. Memory Analysis Script (`analyze-memory.sh`)

**Location:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/analyze-memory.sh`

**Purpose:** Analyzes historical memory data to identify trends, spikes, and patterns.

**Usage:**
```bash
# Analyze last 24 hours (default)
./scripts/analyze-memory.sh

# Analyze last 48 hours
./scripts/analyze-memory.sh 48

# Analyze last week
./scripts/analyze-memory.sh 168
```

**What it provides:**
- Memory statistics (min, max, average, standard deviation)
- Memory growth rate
- Spike detection (>2σ above average)
- Alert summary (warnings, critical alerts)
- Restart count trends
- Memory distribution histogram
- Recent trend history

**Example Output:**
```
=== Memory Statistics ===
Minimum: 192MB
Maximum: 192MB
Average: 192.00MB
Standard Deviation: 0.00MB

=== Memory Trend ===
First reading: 192MB
Last reading: 192MB
Growth: 0MB (stable)

=== Alert Summary ===
Warnings (>800MB): 0
Critical (>900MB): 0

=== Restart Information ===
Restarts in analysis period: 0
Current restart count: 95
```

### 3. Memory Dashboard (`memory-dashboard.sh`)

**Location:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/memory-dashboard.sh`

**Purpose:** Real-time memory monitoring with visual progress bars and color-coded alerts.

**Usage:**
```bash
./scripts/memory-dashboard.sh
```

**Features:**
- Updates every 5 seconds
- Color-coded status indicators (green/yellow/red)
- ASCII progress bar showing memory percentage
- Live process status and uptime
- Recent history from log file
- CPU usage monitoring

**Display:**
```
==================================================
  Sports-Bar-TV-Controller Memory Dashboard
==================================================
Updates every 5 seconds. Press Ctrl+C to exit.

Current Time: 2025-11-06 00:58:26

Process Status: online
Uptime: 0h 15m
Total Restarts: 95

=== Memory Usage ===
Current: 192MB / 1000MB (19%)
Progress: ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 19%

Thresholds:
  OK:       0-800MB
  WARNING:  800-900MB
  CRITICAL: 900MB+

=== CPU Usage ===
Current: 0.3%

=== Recent History (Last 5 readings) ===
2025-11-06T00:58:26-06:00 | 192MB (OK)
```

### 4. PM2 Event Monitor (`monitor-pm2-events.sh`)

**Location:** `/home/ubuntu/Sports-Bar-TV-Controller/scripts/monitor-pm2-events.sh`

**Purpose:** Captures PM2 process events (restarts, stops, errors) in real-time.

**Usage:**
```bash
# Run in background
./scripts/monitor-pm2-events.sh &

# Check if running
ps aux | grep monitor-pm2-events
```

**What it captures:**
- Process restarts
- Process stops
- Error events
- Exit codes
- Kill signals
- Memory at time of event

**Log Location:** `/home/ubuntu/Sports-Bar-TV-Controller/logs/pm2-events.log`

**Note:** This script streams PM2 logs continuously. Run it in background or in a separate terminal/tmux session.

## Reading the Logs

### Memory Monitor Log

**Location:** `/home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log`

**View last 20 entries:**
```bash
tail -n 20 /home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log
```

**View only alerts:**
```bash
grep "ALERT" /home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log
```

**View critical alerts:**
```bash
grep "CRITICAL" /home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log
```

**Monitor in real-time:**
```bash
tail -f /home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log
```

### PM2 Events Log

**Location:** `/home/ubuntu/Sports-Bar-TV-Controller/logs/pm2-events.log`

**View recent events:**
```bash
tail -n 50 /home/ubuntu/Sports-Bar-TV-Controller/logs/pm2-events.log
```

**View restart events:**
```bash
grep "restart" /home/ubuntu/Sports-Bar-TV-Controller/logs/pm2-events.log
```

## Interpreting Memory Trends

### Healthy Patterns

**Stable Memory:**
- Memory stays within 400-600MB range
- No significant growth over time
- Restarts remain constant

**Gradual Growth with Resets:**
- Memory grows slowly (10-20MB per hour)
- Periodic resets to baseline after restart
- Indicates normal garbage collection

### Problematic Patterns

**Memory Leak:**
- Continuous upward trend
- Memory never returns to baseline
- Growth rate >50MB per hour
- Eventually hits 900MB+ and crashes

**Memory Spikes:**
- Sudden jumps (>200MB in 5 minutes)
- May indicate specific operations causing issues
- Correlate with PM2 event timestamps

**Rapid Growth:**
- >100MB growth in 15 minutes
- System logs "Rapid memory growth detected"
- Often precedes crash

## Alert Thresholds

### WARNING (800-900MB)

**What it means:** Memory usage is approaching the 1GB `max_memory_restart` limit configured in PM2.

**Action items:**
1. Check application logs for unusual activity
2. Review recent operations (API calls, database queries)
3. Consider manual restart if sustained >30 minutes
4. Monitor for continued growth

### CRITICAL (>900MB)

**What it means:** Memory is >90% of max, restart imminent.

**Action items:**
1. Immediate investigation required
2. Check for active long-running operations
3. Review error logs
4. Prepare for automatic PM2 restart
5. Capture heap dump if needed (see troubleshooting)

## Troubleshooting

### High Memory Usage

**Check active processes:**
```bash
pm2 describe sports-bar-tv-controller
```

**Check application logs:**
```bash
pm2 logs sports-bar-tv-controller --lines 200
```

**Check for database locks:**
```bash
# Check SQLite database
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"
```

### Capturing Heap Dump

If memory leak suspected:

```bash
# Enable Node.js heap dump
pm2 restart sports-bar-tv-controller --node-args="--max-old-space-size=2048"

# Install heapdump module if not already
cd /home/ubuntu/Sports-Bar-TV-Controller
npm install heapdump

# Trigger heap dump programmatically or use Chrome DevTools
```

### Manual Restart

```bash
# Restart application
pm2 restart sports-bar-tv-controller

# View restart count
pm2 status sports-bar-tv-controller
```

## Maintenance

### Log Rotation

Logs automatically rotate when they exceed 50MB. Old logs are saved with `.old` extension.

**Manual rotation:**
```bash
mv /home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log \
   /home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor-$(date +%Y%m%d).log
```

### Cron Job Management

**View current cron jobs:**
```bash
crontab -l
```

**Edit cron jobs:**
```bash
crontab -e
```

**Remove memory monitoring cron:**
```bash
crontab -l | grep -v "monitor-memory.sh" | crontab -
```

**Re-add memory monitoring cron:**
```bash
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/ubuntu/Sports-Bar-TV-Controller/scripts/monitor-memory.sh") | crontab -
```

### Analyzing Historical Data

**Generate weekly report:**
```bash
./scripts/analyze-memory.sh 168 > weekly-memory-report.txt
```

**Compare memory before and after code changes:**
```bash
# Before deployment
./scripts/analyze-memory.sh 24 > pre-deploy-memory.txt

# After deployment (wait 24 hours)
./scripts/analyze-memory.sh 24 > post-deploy-memory.txt

# Compare
diff pre-deploy-memory.txt post-deploy-memory.txt
```

## Integration with PM2

The monitoring system complements PM2's built-in memory management:

**PM2 Configuration** (`ecosystem.config.js`):
```javascript
{
  max_memory_restart: '1000M',  // Auto-restart at 1GB
  exp_backoff_restart_delay: 100,
  max_restarts: 10
}
```

**View PM2 metrics:**
```bash
# Live monitoring
pm2 monit

# Process info
pm2 info sports-bar-tv-controller

# Memory usage
pm2 describe sports-bar-tv-controller | grep memory
```

## Recommended Monitoring Workflow

### Daily (Automated)
- Cron runs monitor-memory.sh every 5 minutes
- Logs accumulate in memory-monitor.log
- Alerts written for WARNING/CRITICAL states

### Weekly (Manual)
```bash
# Run analysis
./scripts/analyze-memory.sh 168

# Review trends
# - Is average memory increasing week-over-week?
# - Are restarts increasing?
# - Any new spike patterns?
```

### During Deployment
```bash
# Start real-time dashboard
./scripts/memory-dashboard.sh

# In another terminal, deploy
npm run build
pm2 restart sports-bar-tv-controller

# Watch for memory spikes during restart
# Monitor for 10-15 minutes to ensure stability
```

### After Incidents
```bash
# Analyze timeframe around incident
./scripts/analyze-memory.sh 2  # Last 2 hours

# Check PM2 events
tail -n 100 /home/ubuntu/Sports-Bar-TV-Controller/logs/pm2-events.log

# Review application logs
pm2 logs sports-bar-tv-controller --lines 500
```

## System Status Summary

**Current Status (as of script creation):**
- Memory: 192MB (19% of max)
- CPU: 0.3%
- Status: OK
- Total Restarts: 95
- Cron Job: Active (every 5 minutes)

**Files:**
- Monitor script: `/home/ubuntu/Sports-Bar-TV-Controller/scripts/monitor-memory.sh`
- Analysis script: `/home/ubuntu/Sports-Bar-TV-Controller/scripts/analyze-memory.sh`
- Dashboard script: `/home/ubuntu/Sports-Bar-TV-Controller/scripts/memory-dashboard.sh`
- Events script: `/home/ubuntu/Sports-Bar-TV-Controller/scripts/monitor-pm2-events.sh`
- Memory log: `/home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log`
- Events log: `/home/ubuntu/Sports-Bar-TV-Controller/logs/pm2-events.log`

## Next Steps

1. Let the monitoring system collect data for 24-48 hours
2. Run analysis to establish baseline memory patterns
3. Identify any anomalous patterns or memory leaks
4. Correlate restarts with memory spikes
5. Investigate code paths that cause high memory usage
6. Optimize or refactor problem areas

## References

- PM2 Documentation: https://pm2.keymetrics.io/
- Node.js Memory Management: https://nodejs.org/en/docs/guides/simple-profiling/
- Memory Leak Detection: https://nodejs.org/en/docs/guides/diagnostics/memory/
