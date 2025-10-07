
#!/bin/bash
# Performance Monitoring Script for Sports Bar TV Controller
# Monitors CPU, memory, temperature, and Ollama performance

LOG_DIR="/home/ubuntu/Sports-Bar-TV-Controller/logs"
METRICS_FILE="$LOG_DIR/performance-metrics.log"
ALERT_FILE="$LOG_DIR/performance-alerts.log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Thresholds
CPU_THRESHOLD=90
TEMP_THRESHOLD=90
MEMORY_THRESHOLD=90

# Get timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Function to log metrics
log_metric() {
    echo "[$TIMESTAMP] $1" >> "$METRICS_FILE"
}

# Function to log alerts
log_alert() {
    echo "[$TIMESTAMP] ALERT: $1" >> "$ALERT_FILE"
    # Also log to syslog for system monitoring
    logger -t sports-bar-monitor "ALERT: $1"
}

# Get CPU usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
CPU_USAGE_INT=${CPU_USAGE%.*}

# Get memory usage
MEMORY_INFO=$(free | grep Mem)
TOTAL_MEM=$(echo $MEMORY_INFO | awk '{print $2}')
USED_MEM=$(echo $MEMORY_INFO | awk '{print $3}')
MEMORY_PERCENT=$((USED_MEM * 100 / TOTAL_MEM))

# Get temperature (if sensors available)
if command -v sensors &> /dev/null; then
    TEMP=$(sensors | grep -i 'core 0' | awk '{print $3}' | sed 's/+//;s/°C//' | cut -d'.' -f1)
else
    # Fallback to thermal zone
    TEMP=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk '{print int($1/1000)}')
fi

# Get Ollama process stats
OLLAMA_PID=$(pgrep -f "ollama serve")
if [ -n "$OLLAMA_PID" ]; then
    OLLAMA_CPU=$(ps -p $OLLAMA_PID -o %cpu --no-headers | awk '{print int($1)}')
    OLLAMA_MEM=$(ps -p $OLLAMA_PID -o %mem --no-headers | awk '{print int($1)}')
    OLLAMA_STATUS="running"
else
    OLLAMA_CPU=0
    OLLAMA_MEM=0
    OLLAMA_STATUS="stopped"
fi

# Get PM2 process stats
PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[0].pm2_env.status' 2>/dev/null || echo "unknown")
PM2_CPU=$(pm2 jlist 2>/dev/null | jq -r '.[0].monit.cpu' 2>/dev/null || echo "0")
PM2_MEM=$(pm2 jlist 2>/dev/null | jq -r '.[0].monit.memory' 2>/dev/null || echo "0")
PM2_MEM_MB=$((PM2_MEM / 1024 / 1024))

# Log metrics
log_metric "CPU: ${CPU_USAGE}% | Memory: ${MEMORY_PERCENT}% | Temp: ${TEMP}°C | Ollama: ${OLLAMA_STATUS} (CPU: ${OLLAMA_CPU}%, MEM: ${OLLAMA_MEM}%) | PM2: ${PM2_STATUS} (CPU: ${PM2_CPU}%, MEM: ${PM2_MEM_MB}MB)"

# Check thresholds and alert
if [ "$CPU_USAGE_INT" -gt "$CPU_THRESHOLD" ]; then
    log_alert "High CPU usage: ${CPU_USAGE}%"
fi

if [ -n "$TEMP" ] && [ "$TEMP" -gt "$TEMP_THRESHOLD" ]; then
    log_alert "High temperature: ${TEMP}°C"
fi

if [ "$MEMORY_PERCENT" -gt "$MEMORY_THRESHOLD" ]; then
    log_alert "High memory usage: ${MEMORY_PERCENT}%"
fi

if [ "$OLLAMA_STATUS" = "stopped" ]; then
    log_alert "Ollama service is not running"
fi

# Test Ollama response time (only if running)
if [ "$OLLAMA_STATUS" = "running" ]; then
    START_TIME=$(date +%s%N)
    RESPONSE=$(curl -s -m 5 http://localhost:11434/api/tags 2>/dev/null)
    END_TIME=$(date +%s%N)
    
    if [ $? -eq 0 ]; then
        RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
        log_metric "Ollama API response time: ${RESPONSE_TIME}ms"
        
        if [ "$RESPONSE_TIME" -gt 1000 ]; then
            log_alert "Slow Ollama API response: ${RESPONSE_TIME}ms"
        fi
    else
        log_alert "Ollama API not responding"
    fi
fi

# Rotate logs if they get too large (keep last 10000 lines)
if [ -f "$METRICS_FILE" ]; then
    LINE_COUNT=$(wc -l < "$METRICS_FILE")
    if [ "$LINE_COUNT" -gt 10000 ]; then
        tail -n 5000 "$METRICS_FILE" > "$METRICS_FILE.tmp"
        mv "$METRICS_FILE.tmp" "$METRICS_FILE"
    fi
fi

if [ -f "$ALERT_FILE" ]; then
    LINE_COUNT=$(wc -l < "$ALERT_FILE")
    if [ "$LINE_COUNT" -gt 5000 ]; then
        tail -n 2500 "$ALERT_FILE" > "$ALERT_FILE.tmp"
        mv "$ALERT_FILE.tmp" "$ALERT_FILE"
    fi
fi
