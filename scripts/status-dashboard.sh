#!/usr/bin/env bash
# =============================================================================
# Sports Bar TV Controller — Boot Status Dashboard
# Displays system/app status in a color-coded terminal dashboard.
# Refreshes every 5 seconds. Press Ctrl+C or 'q' to exit to shell.
# =============================================================================

set -euo pipefail

# --- Colors & Formatting ---
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BG_BLUE='\033[44m'
BG_RED='\033[41m'
BG_GREEN='\033[42m'

REFRESH_INTERVAL=5
APP_NAME="sports-bar-tv-controller"
APP_PORT=3001

# Clean exit on Ctrl+C
trap 'printf "\n${RESET}"; tput cnorm 2>/dev/null; echo "Dashboard exited. You are at the shell."; exit 0' INT TERM

# Hide cursor for cleaner display
tput civis 2>/dev/null || true

# --- Helper: progress bar (appends to BUF) ---
bar() {
    local pct=$1 width=30 label=$2
    local filled=$(( pct * width / 100 ))
    local empty=$(( width - filled ))
    local color="${GREEN}"
    (( pct > 70 )) && color="${YELLOW}"
    (( pct > 90 )) && color="${RED}"
    local bar_str="${color}["
    local i
    for (( i=0; i<filled; i++ )); do bar_str+='█'; done
    for (( i=0; i<empty; i++ )); do bar_str+='░'; done
    bar_str+="]${RESET}"
    BUF+="$(printf "  %-12s %b %3d%%\n" "$label" "$bar_str" "$pct")"$'\n'
}

# --- Helper: section header (appends to BUF) ---
section() {
    BUF+="$(printf "${BOLD}${CYAN}─── %s ───${RESET}" "$1")"$'\n'
}

# Clear screen once on first run
FIRST_RUN=true

# --- Helper: clear to end of line ---
EL=$(tput el 2>/dev/null || printf '\033[K')

# --- Main loop ---
while true; do
    # Only clear on first run; after that, just home the cursor
    if $FIRST_RUN; then
        clear
        FIRST_RUN=false
    else
        tput home 2>/dev/null || printf '\033[H'
    fi

    # Collect data
    HOST=$(hostname 2>/dev/null || echo "unknown")
    NOW=$(date '+%Y-%m-%d %H:%M:%S')
    UP=$(uptime -p 2>/dev/null || uptime | sed 's/.*up /up /' | sed 's/,.*load.*//')

    # IP addresses
    LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -z "$LAN_IP" ] && LAN_IP="N/A"
    TS_IP=$(tailscale ip -4 2>/dev/null || echo "N/A")

    # Tailscale status
    if command -v tailscale &>/dev/null; then
        TS_STATUS=$(tailscale status --self 2>/dev/null | head -1 || echo "")
        if [ -n "$TS_STATUS" ]; then
            TS_STATE="${GREEN}Connected${RESET}"
        else
            TS_STATE="${RED}Disconnected${RESET}"
        fi
    else
        TS_STATE="${DIM}Not installed${RESET}"
    fi

    # PM2 app status
    PM2_JSON=$(pm2 jlist 2>/dev/null || echo "[]")
    PM2_STATUS="stopped"
    PM2_PID="-"
    PM2_MEM="-"
    PM2_UP="-"
    PM2_RESTARTS="-"
    PM2_CPU="-"

    if echo "$PM2_JSON" | python3 -c "import sys,json; apps=json.load(sys.stdin); [exit(0) for a in apps if a.get('name')=='$APP_NAME']; exit(1)" 2>/dev/null; then
        PM2_STATUS=$(echo "$PM2_JSON" | python3 -c "
import sys,json
apps=json.load(sys.stdin)
for a in apps:
    if a.get('name')=='$APP_NAME':
        print(a.get('pm2_env',{}).get('status','unknown'))
        break
" 2>/dev/null || echo "unknown")
        PM2_PID=$(echo "$PM2_JSON" | python3 -c "
import sys,json
apps=json.load(sys.stdin)
for a in apps:
    if a.get('name')=='$APP_NAME':
        print(a.get('pid','-'))
        break
" 2>/dev/null || echo "-")
        PM2_MEM=$(echo "$PM2_JSON" | python3 -c "
import sys,json
apps=json.load(sys.stdin)
for a in apps:
    if a.get('name')=='$APP_NAME':
        mem=a.get('monit',{}).get('memory',0)
        print(f'{mem/1024/1024:.0f} MB')
        break
" 2>/dev/null || echo "-")
        PM2_CPU=$(echo "$PM2_JSON" | python3 -c "
import sys,json
apps=json.load(sys.stdin)
for a in apps:
    if a.get('name')=='$APP_NAME':
        print(str(a.get('monit',{}).get('cpu',0))+'%')
        break
" 2>/dev/null || echo "-")
        PM2_UP=$(echo "$PM2_JSON" | python3 -c "
import sys,json,time
apps=json.load(sys.stdin)
for a in apps:
    if a.get('name')=='$APP_NAME':
        ts=a.get('pm2_env',{}).get('pm_uptime',0)
        if ts:
            d=int(time.time()*1000)-ts
            hrs=d//3600000; mins=(d%3600000)//60000
            print(f'{hrs}h {mins}m')
        else:
            print('-')
        break
" 2>/dev/null || echo "-")
        PM2_RESTARTS=$(echo "$PM2_JSON" | python3 -c "
import sys,json
apps=json.load(sys.stdin)
for a in apps:
    if a.get('name')=='$APP_NAME':
        print(a.get('pm2_env',{}).get('restart_time',0))
        break
" 2>/dev/null || echo "-")
    fi

    # Status color for PM2
    case "$PM2_STATUS" in
        online)  PM2_COLOR="${BG_GREEN}${WHITE} ONLINE ${RESET}" ;;
        stopped) PM2_COLOR="${BG_RED}${WHITE} STOPPED ${RESET}" ;;
        errored) PM2_COLOR="${BG_RED}${WHITE} ERRORED ${RESET}" ;;
        *)       PM2_COLOR="${YELLOW} ${PM2_STATUS^^} ${RESET}" ;;
    esac

    # System resource usage
    CPU_PCT=$(top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print int($2 + $4)}' || echo "0")
    MEM_PCT=$(free 2>/dev/null | awk '/Mem:/{printf "%.0f", $3/$2*100}' || echo "0")
    DISK_PCT=$(df / 2>/dev/null | awk 'NR==2{gsub(/%/,""); print $5}' || echo "0")

    # Disk details
    DISK_USED=$(df -h / 2>/dev/null | awk 'NR==2{print $3}' || echo "?")
    DISK_TOTAL=$(df -h / 2>/dev/null | awk 'NR==2{print $2}' || echo "?")
    MEM_USED=$(free -h 2>/dev/null | awk '/Mem:/{print $3}' || echo "?")
    MEM_TOTAL=$(free -h 2>/dev/null | awk '/Mem:/{print $2}' || echo "?")

    # Recent logs (capture once)
    if command -v pm2 &>/dev/null; then
        LOG_LINES=$(pm2 logs "$APP_NAME" --nostream --lines 5 2>/dev/null | tail -5)
    else
        LOG_LINES="(pm2 not available)"
    fi

    # =========================================================================
    # BUILD BUFFER — all output goes into BUF, then printed at once
    # =========================================================================

    COLS=$(tput cols 2>/dev/null || echo 80)
    LINE=$(printf '═%.0s' $(seq 1 "$COLS"))
    BUF=""

    BUF+="$(printf "${BG_BLUE}${WHITE}${BOLD}%-${COLS}s${RESET}" "  SPORTS BAR TV CONTROLLER — STATUS DASHBOARD")"$'\n'
    BUF+="$(printf "${DIM}  %s  |  Refreshes every ${REFRESH_INTERVAL}s  |  Press ${BOLD}q${RESET}${DIM} or ${BOLD}Ctrl+C${RESET}${DIM} to exit${RESET}" "$NOW")${EL}"$'\n'
    BUF+="$(printf "${CYAN}%s${RESET}" "$LINE")"$'\n'

    # Machine Info
    section "MACHINE"
    BUF+="$(printf "  %-14s ${WHITE}%s${RESET}" "Hostname:" "$HOST")${EL}"$'\n'
    BUF+="$(printf "  %-14s ${WHITE}%s${RESET}" "LAN IP:" "$LAN_IP")${EL}"$'\n'
    BUF+="$(printf "  %-14s ${WHITE}%s${RESET}" "Tailscale IP:" "$TS_IP")${EL}"$'\n'
    BUF+="$(printf "  %-14s ${WHITE}%s${RESET}" "Uptime:" "$UP")${EL}"$'\n'
    BUF+="$(printf "  %-14s %b" "Tailscale:" "$TS_STATE")${EL}"$'\n'
    BUF+="${EL}"$'\n'

    # App Status
    section "APPLICATION"
    BUF+="$(printf "  %-14s %b" "Status:" "$PM2_COLOR")${EL}"$'\n'
    BUF+="$(printf "  %-14s ${WHITE}%s${RESET}" "PID:" "$PM2_PID")${EL}"$'\n'
    BUF+="$(printf "  %-14s ${WHITE}%s${RESET}" "CPU:" "$PM2_CPU")${EL}"$'\n'
    BUF+="$(printf "  %-14s ${WHITE}%s${RESET}" "Memory:" "$PM2_MEM")${EL}"$'\n'
    BUF+="$(printf "  %-14s ${WHITE}%s${RESET}" "App Uptime:" "$PM2_UP")${EL}"$'\n'
    BUF+="$(printf "  %-14s ${WHITE}%s${RESET}" "Restarts:" "$PM2_RESTARTS")${EL}"$'\n'
    BUF+="$(printf "  %-14s ${BOLD}${GREEN}http://%s:%s${RESET}" "URL:" "$LAN_IP" "$APP_PORT")${EL}"$'\n'
    BUF+="${EL}"$'\n'

    # Resource Usage
    section "RESOURCES"
    bar "$CPU_PCT" "CPU"
    bar "$MEM_PCT" "Memory ($MEM_USED/$MEM_TOTAL)"
    bar "$DISK_PCT" "Disk ($DISK_USED/$DISK_TOTAL)"
    BUF+="${EL}"$'\n'

    # Recent logs
    section "RECENT LOGS"
    while IFS= read -r line; do
        BUF+="$(printf "  ${DIM}%s${RESET}" "$line")${EL}"$'\n'
    done <<< "$LOG_LINES"
    BUF+="${EL}"$'\n'

    BUF+="$(printf "${CYAN}%s${RESET}" "$LINE")"$'\n'
    BUF+="$(printf "${DIM}  Press ${BOLD}q${RESET}${DIM} or ${BOLD}Ctrl+C${RESET}${DIM} to exit to shell${RESET}")${EL}"$'\n'

    # Clear any leftover lines from previous render
    BUF+="$(tput ed 2>/dev/null || printf '\033[J')"

    # Print entire buffer at once — no flicker
    printf '%b' "$BUF"

    # Wait for interval, but allow 'q' to quit immediately
    read -rsn1 -t "$REFRESH_INTERVAL" key 2>/dev/null || true
    if [[ "${key:-}" == "q" || "${key:-}" == "Q" ]]; then
        printf "\n${RESET}"
        tput cnorm 2>/dev/null || true
        echo "Dashboard exited. You are at the shell."
        exit 0
    fi
done
