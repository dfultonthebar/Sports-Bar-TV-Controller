
#!/bin/bash
# View performance metrics and generate reports

LOG_DIR="/home/ubuntu/Sports-Bar-TV-Controller/logs"
METRICS_FILE="$LOG_DIR/performance-metrics.log"
ALERT_FILE="$LOG_DIR/performance-alerts.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Sports Bar TV Controller Performance Dashboard ===${NC}\n"

# Show current system status
echo -e "${GREEN}Current System Status:${NC}"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')"
echo "Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
if command -v sensors &> /dev/null; then
    echo "Temperature: $(sensors | grep -i 'core 0' | awk '{print $3}')"
else
    TEMP=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk '{print $1/1000}')
    echo "Temperature: ${TEMP}°C"
fi
echo ""

# Show Ollama status
echo -e "${GREEN}Ollama Status:${NC}"
if pgrep -f "ollama serve" > /dev/null; then
    OLLAMA_PID=$(pgrep -f "ollama serve")
    echo "Status: Running (PID: $OLLAMA_PID)"
    echo "CPU: $(ps -p $OLLAMA_PID -o %cpu --no-headers)%"
    echo "Memory: $(ps -p $OLLAMA_PID -o %mem --no-headers)%"
else
    echo -e "${RED}Status: Not Running${NC}"
fi
echo ""

# Show PM2 status
echo -e "${GREEN}PM2 Application Status:${NC}"
pm2 list
echo ""

# Show recent metrics (last 10 entries)
if [ -f "$METRICS_FILE" ]; then
    echo -e "${GREEN}Recent Performance Metrics (Last 10):${NC}"
    tail -n 10 "$METRICS_FILE"
    echo ""
fi

# Show recent alerts
if [ -f "$ALERT_FILE" ]; then
    ALERT_COUNT=$(wc -l < "$ALERT_FILE")
    if [ "$ALERT_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}Recent Alerts (Last 10):${NC}"
        tail -n 10 "$ALERT_FILE"
        echo ""
    else
        echo -e "${GREEN}No alerts recorded${NC}"
        echo ""
    fi
fi

# Show statistics
if [ -f "$METRICS_FILE" ]; then
    echo -e "${BLUE}Performance Statistics (Last 24 hours):${NC}"
    
    # Get entries from last 24 hours
    YESTERDAY=$(date -d "24 hours ago" '+%Y-%m-%d %H:%M:%S')
    RECENT_METRICS=$(awk -v date="$YESTERDAY" '$0 > "["date"]"' "$METRICS_FILE")
    
    if [ -n "$RECENT_METRICS" ]; then
        # Calculate average CPU
        AVG_CPU=$(echo "$RECENT_METRICS" | grep -oP 'CPU: \K[0-9.]+' | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print 0}')
        echo "Average CPU Usage: ${AVG_CPU}%"
        
        # Calculate average temperature
        AVG_TEMP=$(echo "$RECENT_METRICS" | grep -oP 'Temp: \K[0-9]+' | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print 0}')
        echo "Average Temperature: ${AVG_TEMP}°C"
        
        # Calculate average memory
        AVG_MEM=$(echo "$RECENT_METRICS" | grep -oP 'Memory: \K[0-9]+' | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print 0}')
        echo "Average Memory Usage: ${AVG_MEM}%"
        
        # Count alerts
        if [ -f "$ALERT_FILE" ]; then
            ALERT_24H=$(awk -v date="$YESTERDAY" '$0 > "["date"]"' "$ALERT_FILE" | wc -l)
            echo "Alerts in last 24h: $ALERT_24H"
        fi
    else
        echo "No metrics available for the last 24 hours"
    fi
fi

echo ""
echo -e "${BLUE}Log files location:${NC}"
echo "Metrics: $METRICS_FILE"
echo "Alerts: $ALERT_FILE"
