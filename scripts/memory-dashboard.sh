#!/bin/bash
#
# Real-Time Memory Dashboard for Sports-Bar-TV-Controller
# Shows live memory usage with updates every 5 seconds
# Press Ctrl+C to exit

# Configuration
APP_NAME="sports-bar-tv-controller"
UPDATE_INTERVAL=5

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Function to get memory percentage
get_memory_percentage() {
  local memory_bytes=$1
  local max_memory=1048576000  # 1000MB in bytes
  echo $(( memory_bytes * 100 / max_memory ))
}

# Function to get status color
get_status_color() {
  local memory_bytes=$1
  if [ "$memory_bytes" -gt 943718400 ]; then  # >900MB
    echo -e "${RED}"
  elif [ "$memory_bytes" -gt 838860800 ]; then  # >800MB
    echo -e "${YELLOW}"
  else
    echo -e "${GREEN}"
  fi
}

# Function to create progress bar
create_progress_bar() {
  local percentage=$1
  local bar_length=50
  local filled_length=$(( percentage * bar_length / 100 ))
  local empty_length=$(( bar_length - filled_length ))

  # Choose color based on percentage
  local color
  if [ "$percentage" -gt 90 ]; then
    color="${RED}"
  elif [ "$percentage" -gt 80 ]; then
    color="${YELLOW}"
  else
    color="${GREEN}"
  fi

  printf "${color}"
  for ((i=0; i<filled_length; i++)); do printf "█"; done
  printf "${NC}"
  for ((i=0; i<empty_length; i++)); do printf "░"; done
}

# Main monitoring loop
echo -e "${BOLD}${CYAN}==================================================${NC}"
echo -e "${BOLD}${CYAN}  Sports-Bar-TV-Controller Memory Dashboard${NC}"
echo -e "${BOLD}${CYAN}==================================================${NC}"
echo -e "Updates every ${UPDATE_INTERVAL} seconds. Press Ctrl+C to exit."
echo ""

while true; do
  # Clear screen (move cursor to top)
  tput cup 4 0

  # Get PM2 process info
  PM2_INFO=$(pm2 jlist 2>/dev/null)

  if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to get PM2 process info${NC}"
    sleep "$UPDATE_INTERVAL"
    continue
  fi

  # Extract metrics
  MEMORY=$(echo "$PM2_INFO" | jq -r ".[] | select(.name==\"$APP_NAME\") | .monit.memory")
  CPU=$(echo "$PM2_INFO" | jq -r ".[] | select(.name==\"$APP_NAME\") | .monit.cpu")
  STATUS=$(echo "$PM2_INFO" | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.status")
  RESTARTS=$(echo "$PM2_INFO" | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.restart_time")
  UPTIME=$(echo "$PM2_INFO" | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.pm_uptime")

  if [ -z "$MEMORY" ] || [ "$MEMORY" = "null" ]; then
    echo -e "${RED}ERROR: Process $APP_NAME not found in PM2${NC}"
    sleep "$UPDATE_INTERVAL"
    continue
  fi

  # Calculate values
  MEMORY_MB=$((MEMORY / 1024 / 1024))
  MEMORY_PERCENT=$(get_memory_percentage "$MEMORY")
  STATUS_COLOR=$(get_status_color "$MEMORY")

  # Calculate uptime
  CURRENT_TIME=$(date +%s)
  UPTIME_SEC=$(( (CURRENT_TIME * 1000 - UPTIME) / 1000 ))
  UPTIME_HOURS=$((UPTIME_SEC / 3600))
  UPTIME_MIN=$(( (UPTIME_SEC % 3600) / 60 ))

  # Display dashboard
  echo -e "${BOLD}Current Time:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  echo -e "${BOLD}Process Status:${NC} ${STATUS_COLOR}${STATUS}${NC}"
  echo -e "${BOLD}Uptime:${NC} ${UPTIME_HOURS}h ${UPTIME_MIN}m"
  echo -e "${BOLD}Total Restarts:${NC} ${RESTARTS}"
  echo ""
  echo -e "${BOLD}=== Memory Usage ===${NC}"
  echo -e "Current: ${STATUS_COLOR}${MEMORY_MB}MB${NC} / 1000MB (${MEMORY_PERCENT}%)"
  echo -n "Progress: "
  create_progress_bar "$MEMORY_PERCENT"
  echo " ${MEMORY_PERCENT}%"
  echo ""
  echo -e "Thresholds:"
  echo -e "  ${GREEN}OK:${NC}       0-800MB"
  echo -e "  ${YELLOW}WARNING:${NC}  800-900MB"
  echo -e "  ${RED}CRITICAL:${NC} 900MB+"
  echo ""
  echo -e "${BOLD}=== CPU Usage ===${NC}"
  echo -e "Current: ${CPU}%"
  echo ""

  # Show recent memory history from log
  LOG_FILE="/home/ubuntu/Sports-Bar-TV-Controller/logs/memory-monitor.log"
  if [ -f "$LOG_FILE" ]; then
    echo -e "${BOLD}=== Recent History (Last 5 readings) ===${NC}"
    grep " | Status: " "$LOG_FILE" | tail -n 5 | while IFS='|' read -r timestamp rest; do
      # Extract memory value
      memory_value=$(echo "$rest" | grep -o 'Memory: [0-9]*MB' | awk '{print $2}')
      status_value=$(echo "$rest" | grep -o 'Status: [A-Z]*' | awk '{print $2}')

      # Color code based on status
      case "$status_value" in
        CRITICAL)
          status_color="${RED}"
          ;;
        WARNING)
          status_color="${YELLOW}"
          ;;
        *)
          status_color="${GREEN}"
          ;;
      esac

      echo -e "${timestamp} | ${status_color}${memory_value}${NC} (${status_value})"
    done
  else
    echo -e "${YELLOW}No history log found${NC}"
  fi

  echo ""
  echo -e "${CYAN}Press Ctrl+C to exit...${NC}"

  # Clear to end of screen
  tput ed

  # Wait for next update
  sleep "$UPDATE_INTERVAL"
done
