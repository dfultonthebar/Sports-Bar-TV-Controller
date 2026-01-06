#!/bin/bash
#
# PM2 Event Monitoring Script
# Monitors and logs PM2 process events (restarts, errors, stops)
# Run in background: ./monitor-pm2-events.sh &

# Configuration
APP_NAME="sports-bar-tv-controller"
LOG_FILE="/home/ubuntu/Sports-Bar-TV-Controller/logs/pm2-events.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

echo "$(date -Iseconds) | PM2 Event Monitor started for $APP_NAME" >> "$LOG_FILE"

# Monitor PM2 logs for restart/error events
# This streams PM2 logs and filters for important events
pm2 logs "$APP_NAME" --raw --timestamp --lines 0 2>&1 | while read -r line; do
  # Check for restart indicators
  if echo "$line" | grep -qE "restart|stopped|errored|exit code|killed"; then
    echo "$line" >> "$LOG_FILE"

    # Also capture current memory at time of event
    MEMORY=$(pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .monit.memory")
    if [ -n "$MEMORY" ] && [ "$MEMORY" != "null" ]; then
      MEMORY_MB=$((MEMORY / 1024 / 1024))
      echo "$(date -Iseconds) | Event memory: ${MEMORY_MB}MB" >> "$LOG_FILE"
    fi
  fi

  # Keep log file under 50MB by rotating if needed
  LOG_SIZE=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null)
  if [ -n "$LOG_SIZE" ] && [ "$LOG_SIZE" -gt 52428800 ]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
    echo "$(date -Iseconds) | Log rotated (previous log saved to ${LOG_FILE}.old)" >> "$LOG_FILE"
  fi
done
