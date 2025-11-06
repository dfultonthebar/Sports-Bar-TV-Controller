#!/bin/bash
#
# Memory Analysis Script for Sports-Bar-TV-Controller
# Analyzes memory-monitor.log to generate statistics and trends
# Usage: ./analyze-memory.sh [hours] (default: 24 hours)

# Configuration
LOG_FILE="/home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log"
HOURS=${1:-24}  # Default to last 24 hours

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "Memory Analysis for Sports-Bar-TV-Controller"
echo "Analyzing last $HOURS hours"
echo "========================================"
echo ""

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
  echo -e "${RED}ERROR: Log file not found at $LOG_FILE${NC}"
  exit 1
fi

# Get cutoff time (N hours ago)
CUTOFF_TIME=$(date -d "$HOURS hours ago" -Iseconds 2>/dev/null || date -v-${HOURS}H -Iseconds 2>/dev/null)

# Extract memory readings from log (only status lines, not alerts)
MEMORY_VALUES=$(grep " | Status: " "$LOG_FILE" | grep -v "ALERT:" | awk '{
  # Extract timestamp and memory in MB
  timestamp = $1
  for (i=1; i<=NF; i++) {
    if ($i == "Memory:") {
      # Extract number before "MB"
      split($(i+1), mem, "MB")
      print timestamp, mem[1]
    }
  }
}')

# Count total entries
TOTAL_ENTRIES=$(echo "$MEMORY_VALUES" | wc -l)

if [ "$TOTAL_ENTRIES" -eq 0 ]; then
  echo -e "${YELLOW}No memory data found in log file${NC}"
  exit 0
fi

echo "Total data points: $TOTAL_ENTRIES"
echo ""

# Calculate statistics
STATS=$(echo "$MEMORY_VALUES" | awk '{
  mem = $2
  sum += mem
  if (NR == 1 || mem < min) min = mem
  if (NR == 1 || mem > max) max = mem
  values[NR] = mem
  count++
}
END {
  avg = sum / count

  # Calculate standard deviation
  for (i=1; i<=count; i++) {
    diff = values[i] - avg
    sq_diff += diff * diff
  }
  stddev = sqrt(sq_diff / count)

  print min, max, avg, stddev
}')

MIN_MEM=$(echo "$STATS" | awk '{print $1}')
MAX_MEM=$(echo "$STATS" | awk '{print $2}')
AVG_MEM=$(echo "$STATS" | awk '{printf "%.2f", $3}')
STDDEV=$(echo "$STATS" | awk '{printf "%.2f", $4}')

echo "=== Memory Statistics ==="
echo -e "${GREEN}Minimum:${NC} ${MIN_MEM}MB"
echo -e "${YELLOW}Maximum:${NC} ${MAX_MEM}MB"
echo -e "${BLUE}Average:${NC} ${AVG_MEM}MB"
echo -e "Standard Deviation: ${STDDEV}MB"
echo ""

# Calculate memory growth rate (compare first and last reading)
FIRST_MEM=$(echo "$MEMORY_VALUES" | head -n 1 | awk '{print $2}')
LAST_MEM=$(echo "$MEMORY_VALUES" | tail -n 1 | awk '{print $2}')
GROWTH=$((LAST_MEM - FIRST_MEM))

echo "=== Memory Trend ==="
echo "First reading: ${FIRST_MEM}MB"
echo "Last reading: ${LAST_MEM}MB"
if [ "$GROWTH" -gt 0 ]; then
  echo -e "${RED}Growth: +${GROWTH}MB (increasing)${NC}"
elif [ "$GROWTH" -lt 0 ]; then
  echo -e "${GREEN}Growth: ${GROWTH}MB (decreasing)${NC}"
else
  echo "Growth: 0MB (stable)"
fi
echo ""

# Identify memory spikes (values > 2 standard deviations above average)
echo "=== Memory Spikes (> 2σ above average) ==="
SPIKES=$(echo "$MEMORY_VALUES" | awk -v avg="$AVG_MEM" -v stddev="$STDDEV" '{
  mem = $2
  threshold = avg + (2 * stddev)
  if (mem > threshold) {
    print $1, mem "MB"
  }
}')

if [ -z "$SPIKES" ]; then
  echo -e "${GREEN}No significant spikes detected${NC}"
else
  echo "$SPIKES"
fi
echo ""

# Count alerts and warnings
WARNING_COUNT=$(grep -c "Status: WARNING" "$LOG_FILE")
CRITICAL_COUNT=$(grep -c "Status: CRITICAL" "$LOG_FILE")

echo "=== Alert Summary ==="
echo -e "Warnings (>800MB): ${YELLOW}${WARNING_COUNT}${NC}"
echo -e "Critical (>900MB): ${RED}${CRITICAL_COUNT}${NC}"
echo ""

# Get restart count trend
echo "=== Restart Information ==="
LATEST_RESTARTS=$(grep " | Status: " "$LOG_FILE" | tail -n 1 | grep -o "Restarts: [0-9]*" | awk '{print $2}')
EARLIEST_RESTARTS=$(grep " | Status: " "$LOG_FILE" | head -n 1 | grep -o "Restarts: [0-9]*" | awk '{print $2}')

if [ -n "$LATEST_RESTARTS" ] && [ -n "$EARLIEST_RESTARTS" ]; then
  RESTART_DELTA=$((LATEST_RESTARTS - EARLIEST_RESTARTS))
  echo "Restarts in analysis period: $RESTART_DELTA"
  echo "Current restart count: $LATEST_RESTARTS"
else
  echo "Restart data not available"
fi
echo ""

# Memory usage distribution
echo "=== Memory Distribution ==="
echo "0-400MB:   $(echo "$MEMORY_VALUES" | awk '{if ($2 <= 400) count++} END {print count+0}')"
echo "400-600MB: $(echo "$MEMORY_VALUES" | awk '{if ($2 > 400 && $2 <= 600) count++} END {print count+0}')"
echo "600-800MB: $(echo "$MEMORY_VALUES" | awk '{if ($2 > 600 && $2 <= 800) count++} END {print count+0}')"
echo -e "${YELLOW}800-900MB: $(echo "$MEMORY_VALUES" | awk '{if ($2 > 800 && $2 <= 900) count++} END {print count+0}') (WARNING)${NC}"
echo -e "${RED}900MB+:    $(echo "$MEMORY_VALUES" | awk '{if ($2 > 900) count++} END {print count+0}') (CRITICAL)${NC}"
echo ""

# Recent trend (last 10 readings)
echo "=== Recent Trend (Last 10 Readings) ==="
echo "$MEMORY_VALUES" | tail -n 10 | awk '{print $1, $2 "MB"}'
echo ""

echo "========================================"
echo "Analysis complete"
echo "========================================"
