#!/bin/bash

# PM2 Health Check Script for Sports Bar TV Controller
# Purpose: Monitor PM2 process health and alert on issues
# Usage: ./scripts/pm2-health-check.sh [--verbose]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VERBOSE=false
if [[ "$1" == "--verbose" ]]; then
    VERBOSE=true
fi

# Configuration
APP_NAME="sports-bar-tv-controller"
MAX_RESTARTS_WARNING=5
MAX_RESTARTS_CRITICAL=15
MAX_MEMORY_MB=512
HEALTH_CHECK_URL="http://localhost:3001"
LOG_DIR="/home/ubuntu/.pm2/logs"

echo -e "${BLUE}=== PM2 Health Check for $APP_NAME ===${NC}"
echo "Timestamp: $(date -Iseconds)"
echo ""

# Function to print status
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK")
            echo -e "${GREEN}✓${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠${NC} $message"
            ;;
        "CRITICAL")
            echo -e "${RED}✗${NC} $message"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ${NC} $message"
            ;;
    esac
}

# Check if PM2 is running
if ! pm2 list &>/dev/null; then
    print_status "CRITICAL" "PM2 is not running!"
    exit 1
fi
print_status "OK" "PM2 daemon is running"

# Get process info
PM2_INFO=$(pm2 jlist)
if ! echo "$PM2_INFO" | jq -e ".[] | select(.name == \"$APP_NAME\")" &>/dev/null; then
    print_status "CRITICAL" "$APP_NAME process not found in PM2!"
    exit 1
fi

# Extract key metrics
STATUS=$(echo "$PM2_INFO" | jq -r ".[] | select(.name == \"$APP_NAME\") | .pm2_env.status")
RESTARTS=$(echo "$PM2_INFO" | jq -r ".[] | select(.name == \"$APP_NAME\") | .pm2_env.restart_time")
UNSTABLE_RESTARTS=$(echo "$PM2_INFO" | jq -r ".[] | select(.name == \"$APP_NAME\") | .pm2_env.unstable_restarts")
MEMORY_MB=$(echo "$PM2_INFO" | jq -r ".[] | select(.name == \"$APP_NAME\") | .monit.memory" | awk '{print int($1/1024/1024)}')
CPU=$(echo "$PM2_INFO" | jq -r ".[] | select(.name == \"$APP_NAME\") | .monit.cpu")
UPTIME=$(echo "$PM2_INFO" | jq -r ".[] | select(.name == \"$APP_NAME\") | .pm2_env.pm_uptime")
PID=$(echo "$PM2_INFO" | jq -r ".[] | select(.name == \"$APP_NAME\") | .pid")

# Calculate uptime in human readable format
CURRENT_TIME=$(date +%s)000
UPTIME_SECONDS=$(( ($CURRENT_TIME - $UPTIME) / 1000 ))
UPTIME_HUMAN=$(printf '%dd %dh %dm' $(($UPTIME_SECONDS/86400)) $(($UPTIME_SECONDS%86400/3600)) $(($UPTIME_SECONDS%3600/60)))

echo -e "\n${BLUE}Process Status:${NC}"
echo "  Name: $APP_NAME"
echo "  PID: $PID"
echo "  Status: $STATUS"
echo "  Uptime: $UPTIME_HUMAN"
echo "  Restarts: $RESTARTS"
echo "  Unstable Restarts: $UNSTABLE_RESTARTS"
echo "  Memory: ${MEMORY_MB}MB"
echo "  CPU: ${CPU}%"
echo ""

# Status checks
if [[ "$STATUS" == "online" ]]; then
    print_status "OK" "Process is online"
else
    print_status "CRITICAL" "Process status is $STATUS (expected: online)"
fi

# Restart count check
if [[ $RESTARTS -eq 0 ]]; then
    print_status "OK" "No restarts since last counter reset"
elif [[ $RESTARTS -lt $MAX_RESTARTS_WARNING ]]; then
    print_status "OK" "Restart count is acceptable: $RESTARTS"
elif [[ $RESTARTS -lt $MAX_RESTARTS_CRITICAL ]]; then
    print_status "WARNING" "Restart count is elevated: $RESTARTS (warning threshold: $MAX_RESTARTS_WARNING)"
else
    print_status "CRITICAL" "Restart count is critical: $RESTARTS (critical threshold: $MAX_RESTARTS_CRITICAL)"
fi

# Unstable restart check
if [[ $UNSTABLE_RESTARTS -gt 0 ]]; then
    print_status "WARNING" "Unstable restarts detected: $UNSTABLE_RESTARTS (crashes within 15s of start)"
else
    print_status "OK" "No unstable restarts (crashes)"
fi

# Memory check
if [[ $MEMORY_MB -lt $MAX_MEMORY_MB ]]; then
    print_status "OK" "Memory usage is normal: ${MEMORY_MB}MB / ${MAX_MEMORY_MB}MB"
else
    print_status "WARNING" "Memory usage is high: ${MEMORY_MB}MB / ${MAX_MEMORY_MB}MB"
fi

# HTTP health check
echo ""
if curl -sf "$HEALTH_CHECK_URL" -o /dev/null; then
    print_status "OK" "HTTP endpoint is responding ($HEALTH_CHECK_URL)"
else
    print_status "WARNING" "HTTP endpoint check failed or no health endpoint available"
fi

# Check error logs for recent critical issues
echo ""
echo -e "${BLUE}Recent Error Log Analysis:${NC}"
ERROR_LOG="$LOG_DIR/${APP_NAME}-error.log"
if [[ -f "$ERROR_LOG" ]]; then
    ERROR_COUNT=$(tail -100 "$ERROR_LOG" | grep -c "Error:" || true)
    MODULE_NOT_FOUND=$(tail -100 "$ERROR_LOG" | grep -c "MODULE_NOT_FOUND" || true)
    ADB_ERRORS=$(tail -100 "$ERROR_LOG" | grep -c "ADB CLIENT" || true)

    if [[ $ERROR_COUNT -eq 0 ]]; then
        print_status "OK" "No recent errors in log"
    else
        print_status "INFO" "Found $ERROR_COUNT errors in last 100 lines"
    fi

    if [[ $MODULE_NOT_FOUND -gt 0 ]]; then
        print_status "WARNING" "MODULE_NOT_FOUND errors detected ($MODULE_NOT_FOUND occurrences) - build may be incomplete"
    fi

    if [[ $ADB_ERRORS -gt 0 ]]; then
        print_status "INFO" "ADB connection errors detected ($ADB_ERRORS occurrences) - Fire TV device may be offline"
    fi
else
    print_status "WARNING" "Error log file not found: $ERROR_LOG"
fi

# Log file size check
echo ""
echo -e "${BLUE}Log File Sizes:${NC}"
OUT_LOG="$LOG_DIR/${APP_NAME}-out.log"
ERR_LOG="$LOG_DIR/${APP_NAME}-error.log"

if [[ -f "$OUT_LOG" ]]; then
    OUT_SIZE=$(du -h "$OUT_LOG" | cut -f1)
    OUT_LINES=$(wc -l < "$OUT_LOG")
    echo "  Output log: $OUT_SIZE ($OUT_LINES lines)"

    # Warn if log is getting large (>50MB)
    OUT_SIZE_BYTES=$(stat -f%z "$OUT_LOG" 2>/dev/null || stat -c%s "$OUT_LOG" 2>/dev/null || echo 0)
    if [[ $OUT_SIZE_BYTES -gt 52428800 ]]; then
        print_status "WARNING" "Output log is large (>50MB) - consider log rotation"
    fi
fi

if [[ -f "$ERR_LOG" ]]; then
    ERR_SIZE=$(du -h "$ERR_LOG" | cut -f1)
    ERR_LINES=$(wc -l < "$ERR_LOG")
    echo "  Error log: $ERR_SIZE ($ERR_LINES lines)"
fi

# PM2 startup configuration check
echo ""
echo -e "${BLUE}PM2 Configuration:${NC}"
if systemctl is-enabled pm2-ubuntu &>/dev/null; then
    print_status "OK" "PM2 startup service is enabled"
    if systemctl is-active pm2-ubuntu &>/dev/null; then
        print_status "OK" "PM2 startup service is active"
    else
        print_status "WARNING" "PM2 startup service is not active"
    fi
else
    print_status "WARNING" "PM2 startup service is not enabled - app won't auto-start on reboot"
fi

# System resource check
echo ""
echo -e "${BLUE}System Resources:${NC}"
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
MEM_USED=$(free | grep Mem | awk '{printf "%.0f", ($3/$2) * 100}')
DISK_USED=$(df -h /home/ubuntu | tail -1 | awk '{print $5}' | tr -d '%')

echo "  Load average (1m): $LOAD_AVG"
echo "  Memory usage: ${MEM_USED}%"
echo "  Disk usage (/home): ${DISK_USED}%"

if (( $(echo "$LOAD_AVG > 4.0" | bc -l) )); then
    print_status "WARNING" "System load is high: $LOAD_AVG"
fi

if [[ $MEM_USED -gt 90 ]]; then
    print_status "WARNING" "System memory usage is high: ${MEM_USED}%"
fi

if [[ $DISK_USED -gt 80 ]]; then
    print_status "WARNING" "Disk usage is high: ${DISK_USED}%"
fi

# Verbose mode: show recent restart history
if [[ "$VERBOSE" == true ]]; then
    echo ""
    echo -e "${BLUE}Recent Restart History (last 10):${NC}"
    grep "$APP_NAME" /home/ubuntu/.pm2/pm2.log | grep -E "(exited|starting|online)" | tail -20 || echo "  No restart history found"
fi

echo ""
echo -e "${BLUE}=== Health Check Complete ===${NC}"
echo "Run with --verbose flag for detailed restart history"
echo ""

# Exit with appropriate code
if [[ "$STATUS" != "online" ]] || [[ $UNSTABLE_RESTARTS -gt 0 ]] || [[ $RESTARTS -ge $MAX_RESTARTS_CRITICAL ]]; then
    exit 2  # Critical
elif [[ $RESTARTS -ge $MAX_RESTARTS_WARNING ]] || [[ $MEMORY_MB -gt $MAX_MEMORY_MB ]]; then
    exit 1  # Warning
else
    exit 0  # OK
fi
