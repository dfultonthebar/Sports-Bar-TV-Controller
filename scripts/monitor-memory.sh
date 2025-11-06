#!/bin/bash
#
# Memory Monitoring Script for Sports-Bar-TV-Controller
# Tracks PM2 process memory usage and alerts on high consumption
# Run via cron every 5 minutes

# Configuration
APP_NAME="sports-bar-tv-controller"
LOG_FILE="/home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log"
ALERT_THRESHOLD=838860800  # 800MB in bytes (80% of 1000MB max_memory_restart)
CRITICAL_THRESHOLD=943718400  # 900MB in bytes (90% of 1000MB max_memory_restart)

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Get PM2 process info in JSON format
PM2_INFO=$(pm2 jlist 2>/dev/null)

# Check if PM2 command succeeded
if [ $? -ne 0 ]; then
  echo "$(date -Iseconds) | ERROR: Failed to get PM2 process list" >> "$LOG_FILE"
  exit 1
fi

# Extract memory for sports-bar-tv-controller
MEMORY=$(echo "$PM2_INFO" | jq -r ".[] | select(.name==\"$APP_NAME\") | .monit.memory")
CPU=$(echo "$PM2_INFO" | jq -r ".[] | select(.name==\"$APP_NAME\") | .monit.cpu")
RESTARTS=$(echo "$PM2_INFO" | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.restart_time")
UPTIME=$(echo "$PM2_INFO" | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.pm_uptime")

# Check if process was found
if [ -z "$MEMORY" ] || [ "$MEMORY" = "null" ]; then
  echo "$(date -Iseconds) | ERROR: Process $APP_NAME not found in PM2" >> "$LOG_FILE"
  exit 1
fi

# Convert memory to MB for easier reading
MEMORY_MB=$((MEMORY / 1024 / 1024))

# Calculate uptime in hours
CURRENT_TIME=$(date +%s)
UPTIME_MS=$((CURRENT_TIME * 1000 - UPTIME))
UPTIME_HOURS=$((UPTIME_MS / 1000 / 60 / 60))

# Determine status level
STATUS="OK"
if [ "$MEMORY" -gt "$CRITICAL_THRESHOLD" ]; then
  STATUS="CRITICAL"
elif [ "$MEMORY" -gt "$ALERT_THRESHOLD" ]; then
  STATUS="WARNING"
fi

# Log entry with all metrics
LOG_ENTRY="$(date -Iseconds) | Status: $STATUS | Memory: ${MEMORY_MB}MB (${MEMORY} bytes) | CPU: ${CPU}% | Restarts: ${RESTARTS} | Uptime: ${UPTIME_HOURS}h"
echo "$LOG_ENTRY" >> "$LOG_FILE"

# Additional alert logging for high memory
if [ "$STATUS" != "OK" ]; then
  echo "$(date -Iseconds) | ALERT: $STATUS - Memory usage at ${MEMORY_MB}MB / 1000MB (${STATUS} threshold exceeded)" >> "$LOG_FILE"

  # If critical, also log to syslog
  if [ "$STATUS" = "CRITICAL" ]; then
    logger -t "sports-bar-monitor" "CRITICAL: $APP_NAME memory at ${MEMORY_MB}MB (90% of max)"
  fi
fi

# Keep log file under 50MB by rotating if needed
LOG_SIZE=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null)
if [ "$LOG_SIZE" -gt 52428800 ]; then
  mv "$LOG_FILE" "${LOG_FILE}.old"
  echo "$(date -Iseconds) | Log rotated (previous log saved to ${LOG_FILE}.old)" >> "$LOG_FILE"
fi

exit 0
