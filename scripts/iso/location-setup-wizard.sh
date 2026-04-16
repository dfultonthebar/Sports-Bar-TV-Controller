#!/bin/bash
#
# Sports Bar TV Controller - Location Setup Wizard v3.0
#
# Interactive auto-discovery wizard for new bar installations.
# Scans the local network for all AV equipment, then walks the
# installer through configuration and Wolf Pack input/output mapping.
#
# Usage:
#   sudo bash location-setup-wizard.sh              # Full interactive wizard
#   sudo bash location-setup-wizard.sh --dry-run    # Show what would be done
#   sudo bash location-setup-wizard.sh --scan-only  # Network scan only
#   source location-setup-wizard.sh --source-only   # Load functions for testing
#
# Requires: adb, curl, sqlite3, git (all included in ISO v3.0)
#

set -uo pipefail
# NOTE: NOT using set -e because parallel network scans and probe failures
# would cause the script to exit. Each function handles its own errors.

# ─── Colors & Formatting ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*" >&2; }
info() { echo -e "${CYAN}[i]${NC} $*"; }
step() { echo -e "\n${BOLD}${GREEN}=== $* ===${NC}\n"; }

# ─── Configuration ───────────────────────────────────────────────────────────
APP_DIR="/home/ubuntu/Sports-Bar-TV-Controller"
DATA_DIR="${APP_DIR}/apps/web/data"
DB_FILE="/home/ubuntu/sports-bar-data/production.db"
ENV_FILE="${APP_DIR}/.env"
LOG_FILE="/var/log/location-setup-wizard.log"
DONE_MARKER="/var/lib/sports-bar-wizard-done"
WIZARD_VERSION="3.0"

# Scan settings
SCAN_TIMEOUT=1        # seconds per TCP probe
HTTP_TIMEOUT=2        # seconds per HTTP identification
MAX_CONCURRENT=50     # parallel probes
SCAN_SUBNET=""        # detected during wizard_network
LOCAL_IP=""           # detected during wizard_network

# Flags
DRY_RUN=false
SCAN_ONLY=false
SOURCE_ONLY=false

# Discovered device arrays (populated by scan)
declare -a FOUND_WOLFPACK=()
declare -a FOUND_GLOBALCACHE=()
declare -a FOUND_ATLAS=()
declare -a FOUND_DIRECTV=()
declare -a FOUND_FIRETV=()
declare -a FOUND_SAMSUNG=()
declare -a FOUND_LG=()
declare -a FOUND_ROKU=()
declare -a FOUND_VIZIO=()
declare -a FOUND_CRESTRON=()
declare -a FOUND_BSS=()
declare -a FOUND_DBX=()

# Configured device tracking (for routing map)
declare -A WP_INPUTS=()    # input_num -> "device_name (ip)"
declare -A WP_OUTPUTS=()   # output_num -> "tv_name (ip)"

# ─── Parse Arguments ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)    DRY_RUN=true; shift ;;
        --scan-only)  SCAN_ONLY=true; shift ;;
        --source-only) SOURCE_ONLY=true; shift ;;
        --help|-h)
            echo "Usage: sudo bash $0 [--dry-run] [--scan-only] [--source-only]"
            echo ""
            echo "Options:"
            echo "  --dry-run      Show what would be done without writing files"
            echo "  --scan-only    Run network scan and display results, then exit"
            echo "  --source-only  Load functions without running (for testing)"
            exit 0 ;;
        *) err "Unknown option: $1"; exit 1 ;;
    esac
done

# ─── Utility Functions ───────────────────────────────────────────────────────

prompt_yes_no() {
    local question="$1"
    local default="${2:-y}"
    local prompt_str
    if [[ "$default" == "y" ]]; then
        prompt_str="(Y/n)"
    else
        prompt_str="(y/N)"
    fi
    while true; do
        read -rp "  ${question} ${prompt_str}: " answer
        answer="${answer:-$default}"
        case "${answer,,}" in
            y|yes) return 0 ;;
            n|no)  return 1 ;;
            *) echo "  Please enter y or n." ;;
        esac
    done
}

prompt_input() {
    local question="$1"
    local default="${2:-}"
    local result
    if [[ -n "$default" ]]; then
        read -rp "  ${question} [${default}]: " result
        echo "${result:-$default}"
    else
        read -rp "  ${question}: " result
        echo "$result"
    fi
}

prompt_select() {
    local question="$1"
    shift
    local options=("$@")
    echo "  ${question}"
    local i=1
    for opt in "${options[@]}"; do
        echo "    ${i}. ${opt}"
        ((i++))
    done
    while true; do
        read -rp "  Selection [1]: " choice
        choice="${choice:-1}"
        if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#options[@]} )); then
            echo "$choice"
            return 0
        fi
        echo "  Invalid selection. Enter 1-${#options[@]}."
    done
}

# Extract last octet from IP address (e.g., 192.168.5.42 → 42)
ip_last_octet() {
    echo "${1##*.}"
}

# Sort an array of "ip|..." entries by IP last octet (ascending)
sort_by_ip() {
    local -n arr_ref=$1
    local sorted
    sorted=$(for entry in "${arr_ref[@]}"; do
        local ip=$(echo "$entry" | cut -d'|' -f1)
        local octet=$(ip_last_octet "$ip")
        printf "%03d|%s\n" "$octet" "$entry"
    done | sort -n | cut -d'|' -f2-)
    arr_ref=()
    while IFS= read -r line; do
        [[ -n "$line" ]] && arr_ref+=("$line")
    done <<< "$sorted"
}

# Test TCP port connectivity (returns 0 if open)
probe_port() {
    local ip="$1"
    local port="$2"
    local timeout="${3:-$SCAN_TIMEOUT}"
    timeout "$timeout" bash -c "echo >/dev/tcp/${ip}/${port}" 2>/dev/null
}

# HTTP GET with timeout, returns body
http_get() {
    local url="$1"
    local timeout="${2:-$SCAN_TIMEOUT}"
    curl -s --connect-timeout "$timeout" --max-time "$((timeout + 1))" "$url" 2>/dev/null
}

# Run sqlite3 command on production DB
run_sql() {
    local sql="$1"
    if [[ "$DRY_RUN" == true ]]; then
        info "DRY RUN SQL: ${sql:0:100}..."
        return 0
    fi
    sqlite3 "$DB_FILE" "$sql" 2>/dev/null
}

# Write a file (respects dry-run)
write_file() {
    local path="$1"
    local content="$2"
    if [[ "$DRY_RUN" == true ]]; then
        info "DRY RUN: Would write ${path}"
        echo "$content" | head -5
        echo "  ..."
        return 0
    fi
    mkdir -p "$(dirname "$path")"
    echo "$content" > "$path"
    chown ubuntu:ubuntu "$path" 2>/dev/null || true
    log "Written: ${path}"
}

# ─── Network Detection ──────────────────────────────────────────────────────

detect_local_ip() {
    # Prefer ethernet > wifi > any non-loopback, non-tailscale
    local ip=""
    # Try ethernet interfaces first
    for iface in $(ip -o -4 addr show | awk '{print $2}' | grep -E '^(eth|enp|eno)' | head -5); do
        ip=$(ip -o -4 addr show dev "$iface" 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1)
        [[ -n "$ip" ]] && echo "$ip" && return 0
    done
    # Try wifi
    for iface in $(ip -o -4 addr show | awk '{print $2}' | grep -E '^(wl|wlan)' | head -5); do
        ip=$(ip -o -4 addr show dev "$iface" 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1)
        [[ -n "$ip" ]] && echo "$ip" && return 0
    done
    # Fallback: any non-loopback, non-docker, non-tailscale
    ip=$(ip -o -4 addr show | grep -v -E '(127\.|172\.17\.|100\.64\.|100\.100\.)' | awk '{print $4}' | cut -d/ -f1 | head -1)
    echo "${ip:-127.0.0.1}"
}

detect_gateway() {
    ip route show default 2>/dev/null | awk '{print $3}' | head -1
}

detect_subnet() {
    local ip="$1"
    echo "${ip%.*}"
}

# ─── Network Scanner ────────────────────────────────────────────────────────

# Phase 1: Fast TCP port probe for a single IP + single port
# Writes "ip|port" to results file if port is open
probe_single() {
    local ip="$1"
    local port="$2"
    local tmpfile="$3"
    if timeout "$SCAN_TIMEOUT" bash -c "echo >/dev/tcp/${ip}/${port}" 2>/dev/null; then
        echo "${ip}|${port}" >> "$tmpfile"
    fi
}

# Phase 2: Identify what type of device is at ip:port
identify_device() {
    local ip="$1"
    local port="$2"
    local tmpfile="$3"

    case "$port" in
        80)
            local body
            body=$(curl -s --connect-timeout "$HTTP_TIMEOUT" --max-time 3 "http://${ip}/login.php" 2>/dev/null || true)
            if [[ "$body" == *"Wolf"* ]] || [[ "$body" == *"HDMI"* ]] || [[ "$body" == *"Matrix"* ]] || [[ "$body" == *"wolf"* ]]; then
                echo "wolfpack|${ip}|80|HTTP OK" >> "$tmpfile"
            fi
            ;;
        4998)
            echo "globalcache|${ip}|4998|Connected" >> "$tmpfile"
            ;;
        5321)
            echo "atlas|${ip}|5321|Connected" >> "$tmpfile"
            ;;
        8080)
            local resp
            resp=$(curl -s --connect-timeout "$HTTP_TIMEOUT" --max-time 3 "http://${ip}:8080/info/getVersion" 2>/dev/null || true)
            if [[ -n "$resp" ]] && [[ "$resp" != *"404"* ]]; then
                echo "directv|${ip}|8080|SHEF OK" >> "$tmpfile"
            fi
            ;;
        5555)
            echo "firetv|${ip}|5555|ADB Port Open" >> "$tmpfile"
            ;;
        8001)
            local resp
            resp=$(curl -s --connect-timeout "$HTTP_TIMEOUT" --max-time 3 "http://${ip}:8001/api/v2/" 2>/dev/null || true)
            if [[ "$resp" == *"device"* ]] || [[ "$resp" == *"name"* ]] || [[ "$resp" == *"Samsung"* ]]; then
                echo "samsung|${ip}|8001|SmartView OK" >> "$tmpfile"
            fi
            ;;
        8060)
            local resp
            resp=$(curl -s --connect-timeout "$HTTP_TIMEOUT" --max-time 3 "http://${ip}:8060/query/device-info" 2>/dev/null || true)
            if [[ "$resp" == *"device-info"* ]] || [[ "$resp" == *"model"* ]]; then
                echo "roku|${ip}|8060|ECP OK" >> "$tmpfile"
            fi
            ;;
        3000)
            echo "lg|${ip}|3000|WebOS Port Open" >> "$tmpfile"
            ;;
        7345)
            echo "vizio|${ip}|7345|SmartCast Port Open" >> "$tmpfile"
            ;;
        41795)
            echo "crestron|${ip}|41795|CTP OK" >> "$tmpfile"
            ;;
        41794)
            echo "crestron|${ip}|41794|CIP OK" >> "$tmpfile"
            ;;
        1023)
            echo "bss|${ip}|1023|HiQnet OK" >> "$tmpfile"
            ;;
        3804)
            echo "dbx|${ip}|3804|Connected" >> "$tmpfile"
            ;;
    esac
}

scan_subnet_full() {
    local subnet="$1"
    local tmpdir
    tmpdir=$(mktemp -d)
    local open_ports="${tmpdir}/open_ports"
    local results="${tmpdir}/results"
    touch "$open_ports" "$results"

    # Device ports to scan
    local PORTS=(80 4998 5321 8080 5555 8001 8060 3000 7345 41795 41794 1023 3804)

    # ── Phase 1: Fast TCP sweep ──────────────────────────────────────────
    echo -e "  ${BOLD}Phase 1:${NC} Fast port sweep on ${subnet}.1-254..."
    echo -e "  ${DIM}(${#PORTS[@]} ports × 254 IPs, ${SCAN_TIMEOUT}s timeout, ${MAX_CONCURRENT} concurrent)${NC}"

    # Build list of all ip:port pairs and scan in parallel via xargs
    local probe_list="${tmpdir}/probe_list"
    for i in $(seq 1 254); do
        local ip="${subnet}.${i}"
        for port in "${PORTS[@]}"; do
            echo "${ip} ${port}"
        done
    done > "$probe_list"

    local total
    total=$(wc -l < "$probe_list")
    echo "  Probing ${total} targets with xargs -P ${MAX_CONCURRENT}..."

    export -f probe_single
    export SCAN_TIMEOUT
    cat "$probe_list" | xargs -P "${MAX_CONCURRENT}" -n 2 bash -c '
        probe_single "$1" "$2" "'"$open_ports"'"
    ' _

    echo "  Scanning... 254/254 IPs — done!"

    local hits
    hits=$(wc -l < "$open_ports" 2>/dev/null || echo 0)
    log "Found ${hits} open port(s)"

    # ── Phase 2: Identify devices on open ports ──────────────────────────
    if [[ "$hits" -gt 0 ]]; then
        echo -e "  ${BOLD}Phase 2:${NC} Identifying ${hits} device(s)..."

        while IFS='|' read -r ip port; do
            ( identify_device "$ip" "$port" "$results" ) &
        done < "$open_ports"
        wait || true

        log "Device identification complete"
    fi
    echo ""

    # Parse results into arrays
    while IFS='|' read -r type ip port status; do
        [[ -z "$type" ]] && continue
        case "$type" in
            wolfpack)    FOUND_WOLFPACK+=("${ip}|${port}|${status}") ;;
            globalcache) FOUND_GLOBALCACHE+=("${ip}|${port}|${status}") ;;
            atlas)       FOUND_ATLAS+=("${ip}|${port}|${status}") ;;
            directv)     FOUND_DIRECTV+=("${ip}|${port}|${status}") ;;
            firetv)      FOUND_FIRETV+=("${ip}|${port}|${status}") ;;
            samsung)     FOUND_SAMSUNG+=("${ip}|${port}|${status}") ;;
            roku)        FOUND_ROKU+=("${ip}|${port}|${status}") ;;
            lg)          FOUND_LG+=("${ip}|${port}|${status}") ;;
            vizio)       FOUND_VIZIO+=("${ip}|${port}|${status}") ;;
            crestron)    FOUND_CRESTRON+=("${ip}|${port}|${status}") ;;
            bss)         FOUND_BSS+=("${ip}|${port}|${status}") ;;
            dbx)         FOUND_DBX+=("${ip}|${port}|${status}") ;;
        esac
    done < "$results"

    rm -rf "$tmpdir"
}

# Identify Fire TV devices via ADB (after port scan found port 5555 open)
identify_firetv_devices() {
    if [[ ${#FOUND_FIRETV[@]} -eq 0 ]]; then return; fi
    if ! command -v adb &>/dev/null; then
        warn "ADB not installed — cannot identify Fire TV devices"
        return
    fi

    info "Connecting to Fire TV devices via ADB..."
    local updated=()
    for entry in "${FOUND_FIRETV[@]}"; do
        local ip=$(echo "$entry" | cut -d'|' -f1)
        # Try ADB connect
        adb connect "${ip}:5555" &>/dev/null || true
        sleep 1
        local model
        model=$(adb -s "${ip}:5555" shell getprop ro.product.model 2>/dev/null | tr -d '\r' || echo "Unknown")
        local manufacturer
        manufacturer=$(adb -s "${ip}:5555" shell getprop ro.product.manufacturer 2>/dev/null | tr -d '\r' || echo "Unknown")

        local device_type="Fire TV"
        if [[ "$model" == *"AFTA"* ]] || [[ "$model" == *"AFTR"* ]] || [[ "$model" == *"AFTMM"* ]]; then
            device_type="Fire TV Cube"
        elif [[ "$model" == *"AFTM"* ]] || [[ "$model" == *"AFTKA"* ]]; then
            device_type="Fire TV Stick 4K"
        fi

        # Check for Atmosphere TV app
        local is_atmosphere=false
        if adb -s "${ip}:5555" shell pm list packages 2>/dev/null | grep -qi "atmosphere"; then
            is_atmosphere=true
            device_type="Atmosphere TV"
        fi

        updated+=("${ip}|5555|${device_type} (${model})|${is_atmosphere}")
    done
    FOUND_FIRETV=("${updated[@]}")
}

# ─── Display Scan Results ────────────────────────────────────────────────────

display_scan_results() {
    local total=0
    for arr in FOUND_WOLFPACK FOUND_GLOBALCACHE FOUND_ATLAS FOUND_DIRECTV FOUND_FIRETV \
               FOUND_SAMSUNG FOUND_LG FOUND_ROKU FOUND_VIZIO FOUND_CRESTRON FOUND_BSS FOUND_DBX; do
        local -n ref=$arr
        total=$((total + ${#ref[@]}))
    done

    if [[ $total -eq 0 ]]; then
        warn "No devices discovered on the network."
        echo ""
        return
    fi

    echo -e "  ${BOLD}DISCOVERED DEVICES:${NC}"
    echo -e "  ${DIM}┌──────────────────────────────────────────────────────────────┐${NC}"
    printf "  ${DIM}│${NC} ${BOLD}%-20s %-16s %-6s %-20s${NC} ${DIM}│${NC}\n" "TYPE" "IP" "PORT" "STATUS"
    echo -e "  ${DIM}├──────────────────────────────────────────────────────────────┤${NC}"

    for entry in "${FOUND_WOLFPACK[@]+"${FOUND_WOLFPACK[@]}"}"; do
        [[ -z "$entry" ]] && continue
        IFS='|' read -r ip port status <<< "$entry"
        printf "  ${DIM}│${NC} ${GREEN}%-20s${NC} %-16s %-6s %-20s ${DIM}│${NC}\n" "Wolf Pack Matrix" "$ip" "$port" "$status"
    done
    for entry in "${FOUND_CRESTRON[@]+"${FOUND_CRESTRON[@]}"}"; do
        [[ -z "$entry" ]] && continue
        IFS='|' read -r ip port status <<< "$entry"
        printf "  ${DIM}│${NC} ${GREEN}%-20s${NC} %-16s %-6s %-20s ${DIM}│${NC}\n" "Crestron Matrix" "$ip" "$port" "$status"
    done
    for entry in "${FOUND_GLOBALCACHE[@]+"${FOUND_GLOBALCACHE[@]}"}"; do
        [[ -z "$entry" ]] && continue
        IFS='|' read -r ip port status <<< "$entry"
        printf "  ${DIM}│${NC} ${YELLOW}%-20s${NC} %-16s %-6s %-20s ${DIM}│${NC}\n" "Global Cache iTach" "$ip" "$port" "$status"
    done
    for entry in "${FOUND_ATLAS[@]+"${FOUND_ATLAS[@]}"}"; do
        [[ -z "$entry" ]] && continue
        IFS='|' read -r ip port status <<< "$entry"
        printf "  ${DIM}│${NC} ${CYAN}%-20s${NC} %-16s %-6s %-20s ${DIM}│${NC}\n" "Atlas Audio" "$ip" "$port" "$status"
    done
    for entry in "${FOUND_BSS[@]+"${FOUND_BSS[@]}"}"; do
        [[ -z "$entry" ]] && continue
        IFS='|' read -r ip port status <<< "$entry"
        printf "  ${DIM}│${NC} ${CYAN}%-20s${NC} %-16s %-6s %-20s ${DIM}│${NC}\n" "BSS BLU Audio" "$ip" "$port" "$status"
    done
    for entry in "${FOUND_DBX[@]+"${FOUND_DBX[@]}"}"; do
        [[ -z "$entry" ]] && continue
        IFS='|' read -r ip port status <<< "$entry"
        printf "  ${DIM}│${NC} ${CYAN}%-20s${NC} %-16s %-6s %-20s ${DIM}│${NC}\n" "dbx ZonePRO" "$ip" "$port" "$status"
    done
    for entry in "${FOUND_DIRECTV[@]+"${FOUND_DIRECTV[@]}"}"; do
        [[ -z "$entry" ]] && continue
        IFS='|' read -r ip port status <<< "$entry"
        printf "  ${DIM}│${NC} ${BLUE}%-20s${NC} %-16s %-6s %-20s ${DIM}│${NC}\n" "DirecTV Receiver" "$ip" "$port" "$status"
    done
    for entry in "${FOUND_FIRETV[@]+"${FOUND_FIRETV[@]}"}"; do
        [[ -z "$entry" ]] && continue
        local ip=$(echo "$entry" | cut -d'|' -f1)
        local port=$(echo "$entry" | cut -d'|' -f2)
        local status=$(echo "$entry" | cut -d'|' -f3)
        printf "  ${DIM}│${NC} ${BLUE}%-20s${NC} %-16s %-6s %-20s ${DIM}│${NC}\n" "Fire TV" "$ip" "$port" "$status"
    done
    for entry in "${FOUND_SAMSUNG[@]+"${FOUND_SAMSUNG[@]}"}"; do
        [[ -z "$entry" ]] && continue
        IFS='|' read -r ip port status <<< "$entry"
        printf "  ${DIM}│${NC} %-20s %-16s %-6s %-20s ${DIM}│${NC}\n" "Samsung TV" "$ip" "$port" "$status"
    done
    for entry in "${FOUND_LG[@]+"${FOUND_LG[@]}"}"; do
        [[ -z "$entry" ]] && continue
        IFS='|' read -r ip port status <<< "$entry"
        printf "  ${DIM}│${NC} %-20s %-16s %-6s %-20s ${DIM}│${NC}\n" "LG TV" "$ip" "$port" "$status"
    done
    for entry in "${FOUND_ROKU[@]+"${FOUND_ROKU[@]}"}"; do
        [[ -z "$entry" ]] && continue
        IFS='|' read -r ip port status <<< "$entry"
        printf "  ${DIM}│${NC} %-20s %-16s %-6s %-20s ${DIM}│${NC}\n" "Roku TV" "$ip" "$port" "$status"
    done
    for entry in "${FOUND_VIZIO[@]+"${FOUND_VIZIO[@]}"}"; do
        [[ -z "$entry" ]] && continue
        IFS='|' read -r ip port status <<< "$entry"
        printf "  ${DIM}│${NC} %-20s %-16s %-6s %-20s ${DIM}│${NC}\n" "Vizio TV" "$ip" "$port" "$status"
    done

    echo -e "  ${DIM}└──────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    log "Found ${BOLD}${total}${NC} devices on the network."
    echo ""
}

# ─── Device Configuration Functions ──────────────────────────────────────────

configure_wolfpack() {
    if [[ ${#FOUND_WOLFPACK[@]} -eq 0 ]]; then
        if ! prompt_yes_no "No Wolf Pack matrix found. Add one manually?" "n"; then
            return
        fi
        local ip
        ip=$(prompt_input "Wolf Pack IP address" "${SCAN_SUBNET}.100")
        if probe_port "$ip" 80; then
            log "Connected to ${ip}:80"
        else
            warn "Could not connect to ${ip}:80 — saving config anyway"
        fi
        FOUND_WOLFPACK+=("${ip}|80|Manual")
    fi

    local wp_ip
    wp_ip=$(echo "${FOUND_WOLFPACK[0]}" | cut -d'|' -f1)
    echo ""
    log "Configuring Wolf Pack at ${BOLD}${wp_ip}${NC}"

    # Model selection
    local models=("WP-4X4 (4 in, 4 out)" "WP-8X8 (8 in, 8 out)" "WP-16X16 (16 in, 16 out)" "WP-18X18 (18 in, 18 out)" "WP-36X36 (36 in, 36 out)" "WP-48X48 (48 in, 48 out)" "WP-64X64 (64 in, 64 out)" "WP-80X80 (80 in, 80 out)")
    local model_slugs=("WP-4X4" "WP-8X8" "WP-16X16" "WP-18X18" "WP-36X36" "WP-48X48" "WP-64X64" "WP-80X80")
    local model_idx
    model_idx=$(prompt_select "Select Wolf Pack model:" "${models[@]}")
    local model="${model_slugs[$((model_idx - 1))]}"

    # Parse input/output counts from model name
    local io_count
    io_count=$(echo "$model" | grep -oP '\d+' | head -1)

    # Credentials
    local username
    username=$(prompt_input "Username" "admin")
    local password
    password=$(prompt_input "Password" "admin")

    # Role
    local roles=("combined (video + audio)" "video only" "audio only")
    local role_slugs=("combined" "video" "audio")
    local role_idx
    role_idx=$(prompt_select "Matrix role:" "${roles[@]}")
    local role="${role_slugs[$((role_idx - 1))]}"

    # Generate chassis ID
    local chassis_id="wp-$(hostname -s)-${role}"

    # Build JSON
    local json
    json=$(cat <<WPEOF
{
  "chassis": [
    {
      "id": "${chassis_id}",
      "name": "Wolf Pack ${model}",
      "model": "${model}",
      "role": "${role}",
      "ipAddress": "${wp_ip}",
      "protocol": "TCP",
      "tcpPort": 5000,
      "httpPort": 80,
      "credentials": {
        "username": "${username}",
        "password": "${password}"
      },
      "isPrimary": true,
      "totalInputs": ${io_count},
      "totalOutputs": ${io_count},
      "inputs": [],
      "outputs": []
    }
  ]
}
WPEOF
)
    write_file "${DATA_DIR}/wolfpack-devices.json" "$json"
    log "Wolf Pack ${model} configured at ${wp_ip}"
}

configure_globalcache() {
    if [[ ${#FOUND_GLOBALCACHE[@]} -eq 0 ]]; then
        if ! prompt_yes_no "No Global Cache iTach found. Add one manually?" "n"; then
            return
        fi
        local ip
        ip=$(prompt_input "Global Cache IP address")
        FOUND_GLOBALCACHE+=("${ip}|4998|Manual")
    fi

    echo ""
    log "Configuring ${#FOUND_GLOBALCACHE[@]} Global Cache device(s)"

    local gc_num=1
    for entry in "${FOUND_GLOBALCACHE[@]}"; do
        local ip
        ip=$(echo "$entry" | cut -d'|' -f1)
        echo ""
        info "Global Cache ${gc_num} at ${ip}"

        # Try to detect ports by sending getdevices command
        local num_ports=3  # Default: iTach IP2IR has 3 IR ports
        local port_response
        port_response=$( (echo -e "getdevices\r"; sleep 1) | nc "$ip" 4998 2>/dev/null || true)
        if [[ "$port_response" == *"IR"* ]]; then
            num_ports=$(echo "$port_response" | grep -oP 'IR' | wc -l)
            [[ "$num_ports" -eq 0 ]] && num_ports=3
            log "Detected ${num_ports} IR port(s)"
        else
            num_ports=$(prompt_input "Number of IR ports on this device" "3")
        fi

        # Register in database
        local device_id="gc-$(echo "$ip" | tr '.' '-')"
        run_sql "INSERT OR REPLACE INTO GlobalCacheDevice (id, name, ipAddress, port, model, status, createdAt, updatedAt) VALUES ('${device_id}', 'Global Cache ${gc_num}', '${ip}', 4998, 'iTach IP2IR', 'online', datetime('now'), datetime('now'));"

        # Register each port
        for p in $(seq 1 "$num_ports"); do
            run_sql "INSERT OR REPLACE INTO GlobalCachePort (id, deviceId, portNumber, portType, label, createdAt, updatedAt) VALUES ('${device_id}-port-${p}', '${device_id}', ${p}, 'IR', 'IR Port ${p}', datetime('now'), datetime('now'));"
        done

        log "Global Cache ${gc_num} registered with ${num_ports} IR ports"
        ((gc_num++))
    done
}

configure_cable_boxes() {
    if [[ ${#FOUND_GLOBALCACHE[@]} -eq 0 ]]; then
        info "No Global Cache devices configured — skipping cable box setup"
        return
    fi

    if ! prompt_yes_no "Do you have cable boxes controlled via IR?" "y"; then
        return
    fi

    echo ""
    local num_boxes
    num_boxes=$(prompt_input "How many cable boxes?" "4")

    for i in $(seq 1 "$num_boxes"); do
        echo ""
        info "Cable Box ${i}:"

        # Associate with Global Cache port
        local gc_ip
        gc_ip=$(echo "${FOUND_GLOBALCACHE[0]}" | cut -d'|' -f1)
        if [[ ${#FOUND_GLOBALCACHE[@]} -gt 1 ]]; then
            gc_ip=$(prompt_input "Global Cache IP for Cable Box ${i}" "$gc_ip")
        fi
        local gc_port
        gc_port=$(prompt_input "Global Cache IR port number" "$i")

        # Wolf Pack input mapping
        local wp_input=""
        if [[ ${#FOUND_WOLFPACK[@]} -gt 0 ]]; then
            wp_input=$(prompt_input "Wolf Pack input number for Cable Box ${i}" "$i")
            WP_INPUTS["$wp_input"]="Cable Box ${i} (${gc_ip}:${gc_port})"
        fi

        # Register in database
        local box_id="cable-box-${i}"
        run_sql "INSERT OR REPLACE INTO CableBox (id, name, globalCacheIp, globalCachePort, inputChannel, controlType, createdAt, updatedAt) VALUES ('${box_id}', 'Cable Box ${i}', '${gc_ip}', ${gc_port}, ${wp_input:-0}, 'ir', datetime('now'), datetime('now'));"

        log "Cable Box ${i} → Global Cache ${gc_ip} port ${gc_port}, Wolf Pack input ${wp_input:-N/A}"
    done
}

configure_atlas() {
    if [[ ${#FOUND_ATLAS[@]} -eq 0 ]]; then
        if ! prompt_yes_no "No Atlas audio processor found. Add one manually?" "n"; then
            return
        fi
        local ip
        ip=$(prompt_input "Atlas IP address")
        FOUND_ATLAS+=("${ip}|5321|Manual")
    fi

    local atlas_ip
    atlas_ip=$(echo "${FOUND_ATLAS[0]}" | cut -d'|' -f1)
    echo ""
    log "Configuring Atlas audio processor at ${BOLD}${atlas_ip}${NC}"

    local models=("AZM4 (4 zones, 6 sources)" "AZM8 (8 zones, 9 sources)" "AZMP4 (4 zones, 10 sources)" "AZMP8 (8 zones, 14 sources)")
    local model_slugs=("AZM4" "AZM8" "AZMP4" "AZMP8")
    local model_idx
    model_idx=$(prompt_select "Select Atlas model:" "${models[@]}")
    local model="${model_slugs[$((model_idx - 1))]}"

    local username
    username=$(prompt_input "Username" "admin")
    local password
    password=$(prompt_input "Password" "6809233DjD\$\$\$")

    local json
    json=$(cat <<ATLASEOF
{
  "processors": [
    {
      "name": "Atlas ${model}",
      "model": "${model}",
      "ipAddress": "${atlas_ip}",
      "tcpPort": 5321,
      "udpPort": 3131,
      "httpPort": 80,
      "username": "${username}",
      "password": "${password}"
    }
  ]
}
ATLASEOF
)
    mkdir -p "${DATA_DIR}/atlas-configs" 2>/dev/null || true
    write_file "${DATA_DIR}/atlas-configs/processor.json" "$json"
    log "Atlas ${model} configured at ${atlas_ip}"
}

configure_directv() {
    if [[ ${#FOUND_DIRECTV[@]} -eq 0 ]]; then
        if ! prompt_yes_no "No DirecTV receivers found. Add manually?" "n"; then
            return
        fi
        echo ""
        local num
        num=$(prompt_input "How many DirecTV receivers?" "1")
        for i in $(seq 1 "$num"); do
            local ip
            ip=$(prompt_input "DirecTV receiver ${i} IP address")
            FOUND_DIRECTV+=("${ip}|8080|Manual")
        done
    fi

    # Sort by IP so lowest IP = first device
    sort_by_ip FOUND_DIRECTV

    echo ""
    log "Configuring ${#FOUND_DIRECTV[@]} DirecTV receiver(s) (sorted by IP)"
    echo ""

    # Show all discovered with auto-suggested numbering
    echo -e "  ${BOLD}Discovered DirecTV receivers (sorted by IP):${NC}"
    local dtv_num=1
    for entry in "${FOUND_DIRECTV[@]}"; do
        local ip=$(echo "$entry" | cut -d'|' -f1)
        local octet=$(ip_last_octet "$ip")
        printf "    ${BOLD}%d.${NC} %-16s (last octet: .%s)\n" "$dtv_num" "$ip" "$octet"
        ((dtv_num++))
    done
    echo ""

    local devices_json="["
    dtv_num=1
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

    for entry in "${FOUND_DIRECTV[@]}"; do
        local ip
        ip=$(echo "$entry" | cut -d'|' -f1)

        # Wolf Pack input mapping — auto-suggest based on device order
        local wp_input=""
        if [[ ${#FOUND_WOLFPACK[@]} -gt 0 ]]; then
            wp_input=$(prompt_input "Wolf Pack input for Direct TV ${dtv_num} (.$(ip_last_octet "$ip"))" "$dtv_num")
            if [[ -n "$wp_input" ]]; then
                WP_INPUTS["$wp_input"]="Direct TV ${dtv_num} (${ip})"
            fi
        fi

        [[ $dtv_num -gt 1 ]] && devices_json+=","
        devices_json+=$(cat <<DTVEOF

    {
      "id": "directv_${dtv_num}",
      "name": "Direct TV ${dtv_num}",
      "ipAddress": "${ip}",
      "port": 8080,
      "receiverType": "unknown",
      "inputChannel": ${wp_input:-0},
      "isOnline": true,
      "addedAt": "${now}",
      "updatedAt": "${now}"
    }
DTVEOF
)
        log "Direct TV ${dtv_num} at ${ip} → Wolf Pack input ${wp_input:-N/A}"
        ((dtv_num++))
    done

    devices_json+=$'\n  ]'
    local full_json='{\n  "devices": '"${devices_json}"$'\n}'
    write_file "${DATA_DIR}/directv-devices.json" "$(echo -e "$full_json")"
}

configure_firetv() {
    if [[ ${#FOUND_FIRETV[@]} -eq 0 ]]; then
        if ! prompt_yes_no "No Fire TV devices found. Add manually?" "n"; then
            return
        fi
        local num
        num=$(prompt_input "How many Fire TV devices?" "1")
        for i in $(seq 1 "$num"); do
            local ip
            ip=$(prompt_input "Fire TV ${i} IP address")
            FOUND_FIRETV+=("${ip}|5555|Fire TV|false")
        done
    fi

    # Sort by IP so lowest IP = first device
    sort_by_ip FOUND_FIRETV

    echo ""
    log "Configuring ${#FOUND_FIRETV[@]} Fire TV device(s) (sorted by IP)"
    echo ""

    # Show all discovered
    echo -e "  ${BOLD}Discovered Fire TV / Streaming devices (sorted by IP):${NC}"
    local preview_num=1
    for entry in "${FOUND_FIRETV[@]}"; do
        local ip=$(echo "$entry" | cut -d'|' -f1)
        local dtype=$(echo "$entry" | cut -d'|' -f3)
        local octet=$(ip_last_octet "$ip")
        printf "    ${BOLD}%d.${NC} %-16s .%-4s %s\n" "$preview_num" "$ip" "$octet" "$dtype"
        ((preview_num++))
    done
    echo ""

    local devices_json="["
    local ftv_num=1
    local atm_num=1
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

    for entry in "${FOUND_FIRETV[@]}"; do
        local ip=$(echo "$entry" | cut -d'|' -f1)
        local port=$(echo "$entry" | cut -d'|' -f2)
        local device_type=$(echo "$entry" | cut -d'|' -f3)
        local is_atmosphere=$(echo "$entry" | cut -d'|' -f4)

        local device_name
        if [[ "$is_atmosphere" == "true" ]]; then
            device_name="Atmosphere ${atm_num}"
            ((atm_num++))
        else
            device_name="Amazon ${ftv_num}"
            ((ftv_num++))
        fi

        # Wolf Pack input mapping — auto-suggest based on device order
        local wp_input=""
        if [[ ${#FOUND_WOLFPACK[@]} -gt 0 ]]; then
            wp_input=$(prompt_input "Wolf Pack input for ${device_name} (.$(ip_last_octet "$ip"))" "$((ftv_num - 1 + atm_num - 1))")
            if [[ -n "$wp_input" ]]; then
                WP_INPUTS["$wp_input"]="${device_name} (${ip})"
            fi
        fi

        [[ "${devices_json}" != "[" ]] && devices_json+=","
        devices_json+=$(cat <<FTVEOF

    {
      "name": "${device_name}",
      "ipAddress": "${ip}",
      "port": 5555,
      "deviceType": "${device_type}",
      "inputChannel": ${wp_input:-0},
      "id": "firetv_${ftv_num}_$(date +%s)",
      "isOnline": true,
      "addedAt": "${now}",
      "updatedAt": "${now}",
      "lastSeen": "${now}"
    }
FTVEOF
)
        log "${device_name} at ${ip} → Wolf Pack input ${wp_input:-N/A}"
    done

    devices_json+=$'\n  ]'
    local full_json='{\n  "devices": '"${devices_json}"$'\n}'
    write_file "${DATA_DIR}/firetv-devices.json" "$(echo -e "$full_json")"

    # Sideload option
    echo ""
    if prompt_yes_no "Do you have an APK to sideload to Fire TV devices?" "n"; then
        local apk_path
        apk_path=$(prompt_input "Path to APK file")
        if [[ ! -f "$apk_path" ]]; then
            err "APK file not found: ${apk_path}"
            return
        fi
        echo ""
        for entry in "${FOUND_FIRETV[@]}"; do
            local ip=$(echo "$entry" | cut -d'|' -f1)
            local is_atm=$(echo "$entry" | cut -d'|' -f4)
            [[ "$is_atm" == "true" ]] && continue  # Skip Atmosphere devices

            info "Sideloading to ${ip}..."
            adb connect "${ip}:5555" &>/dev/null || true
            sleep 1
            if adb -s "${ip}:5555" install -r "$apk_path" 2>&1 | tail -1; then
                log "Sideload to ${ip}: SUCCESS"
            else
                warn "Sideload to ${ip}: FAILED"
            fi
        done
    fi
}

configure_tvs() {
    local total_tvs=$(( ${#FOUND_SAMSUNG[@]} + ${#FOUND_LG[@]} + ${#FOUND_ROKU[@]} + ${#FOUND_VIZIO[@]} ))

    if [[ $total_tvs -eq 0 ]]; then
        if ! prompt_yes_no "No smart TVs found on the network. Add manually?" "n"; then
            return
        fi
        local num
        num=$(prompt_input "How many TVs?" "1")
        for i in $(seq 1 "$num"); do
            local ip
            ip=$(prompt_input "TV ${i} IP address")
            local brand
            brand=$(prompt_input "Brand (samsung/lg/roku/vizio/other)" "samsung")
            FOUND_SAMSUNG+=("${ip}|8001|Manual")
        done
        total_tvs=${#FOUND_SAMSUNG[@]}
    fi

    # Sort all TV arrays by IP so lowest IP = first output
    [[ ${#FOUND_SAMSUNG[@]} -gt 0 ]] && sort_by_ip FOUND_SAMSUNG
    [[ ${#FOUND_LG[@]} -gt 0 ]] && sort_by_ip FOUND_LG
    [[ ${#FOUND_ROKU[@]} -gt 0 ]] && sort_by_ip FOUND_ROKU
    [[ ${#FOUND_VIZIO[@]} -gt 0 ]] && sort_by_ip FOUND_VIZIO

    # Build combined list for preview, sorted by IP across all brands
    echo ""
    log "Configuring ${total_tvs} TV(s) (sorted by IP)"
    echo ""
    echo -e "  ${BOLD}Discovered TVs — IP last octet → suggested Wolf Pack output:${NC}"
    echo -e "  ${DIM}(e.g., .1 → output 01, .15 → output 15)${NC}"
    echo ""

    # Preview all TVs sorted
    local all_tvs=()
    for entry in "${FOUND_SAMSUNG[@]+"${FOUND_SAMSUNG[@]}"}"; do
        [[ -z "$entry" ]] && continue
        local ip=$(echo "$entry" | cut -d'|' -f1)
        all_tvs+=("${ip}|samsung|Samsung")
    done
    for entry in "${FOUND_LG[@]+"${FOUND_LG[@]}"}"; do
        [[ -z "$entry" ]] && continue
        local ip=$(echo "$entry" | cut -d'|' -f1)
        all_tvs+=("${ip}|lg|LG")
    done
    for entry in "${FOUND_ROKU[@]+"${FOUND_ROKU[@]}"}"; do
        [[ -z "$entry" ]] && continue
        local ip=$(echo "$entry" | cut -d'|' -f1)
        all_tvs+=("${ip}|roku|Roku")
    done
    for entry in "${FOUND_VIZIO[@]+"${FOUND_VIZIO[@]}"}"; do
        [[ -z "$entry" ]] && continue
        local ip=$(echo "$entry" | cut -d'|' -f1)
        all_tvs+=("${ip}|vizio|Vizio")
    done

    # Sort combined list by IP
    [[ ${#all_tvs[@]} -gt 0 ]] && sort_by_ip all_tvs

    # Show preview with auto-suggested outputs
    local preview_num=1
    for entry in "${all_tvs[@]}"; do
        local ip=$(echo "$entry" | cut -d'|' -f1)
        local brand_label=$(echo "$entry" | cut -d'|' -f3)
        local octet=$(ip_last_octet "$ip")
        # Auto-suggest: use the IP last octet as the output number
        printf "    ${BOLD}%2d.${NC} %-16s .%-4s %-8s → ${CYAN}output %02d${NC}\n" "$preview_num" "$ip" "$octet" "$brand_label" "$octet"
        ((preview_num++))
    done
    echo ""

    local tv_num=1

    # Samsung TVs
    for entry in "${FOUND_SAMSUNG[@]+"${FOUND_SAMSUNG[@]}"}"; do
        [[ -z "$entry" ]] && continue
        local ip
        ip=$(echo "$entry" | cut -d'|' -f1)
        local octet=$(ip_last_octet "$ip")

        # Try to get model info
        local model="Samsung TV"
        local resp
        resp=$(http_get "http://${ip}:8001/api/v2/" 2>/dev/null || true)
        if [[ -n "$resp" ]]; then
            local parsed_name
            parsed_name=$(echo "$resp" | grep -oP '"name"\s*:\s*"\K[^"]+' | head -1 || true)
            [[ -n "$parsed_name" ]] && model="$parsed_name"
        fi

        # Wolf Pack output mapping — auto-suggest from IP last octet
        local wp_output=""
        if [[ ${#FOUND_WOLFPACK[@]} -gt 0 ]]; then
            wp_output=$(prompt_input "Wolf Pack output for TV ${tv_num} - ${model} (.${octet})" "${octet}")
            if [[ -n "$wp_output" ]]; then
                WP_OUTPUTS["$wp_output"]="TV ${tv_num} - Samsung (${ip})"
            fi
        fi

        # Register in database
        run_sql "INSERT OR REPLACE INTO NetworkTVDevice (id, name, brand, model, ipAddress, port, macAddress, status, createdAt, updatedAt) VALUES ('tv-${tv_num}', 'TV ${tv_num}', 'samsung', '${model}', '${ip}', 8002, '', 'discovered', datetime('now'), datetime('now'));"

        log "TV ${tv_num}: Samsung at ${ip} (.${octet}) → Wolf Pack output ${wp_output:-N/A}"
        ((tv_num++))
    done

    # LG TVs
    for entry in "${FOUND_LG[@]+"${FOUND_LG[@]}"}"; do
        [[ -z "$entry" ]] && continue
        local ip
        ip=$(echo "$entry" | cut -d'|' -f1)
        local octet=$(ip_last_octet "$ip")

        local wp_output=""
        if [[ ${#FOUND_WOLFPACK[@]} -gt 0 ]]; then
            wp_output=$(prompt_input "Wolf Pack output for TV ${tv_num} - LG (.${octet})" "${octet}")
            [[ -n "$wp_output" ]] && WP_OUTPUTS["$wp_output"]="TV ${tv_num} - LG (${ip})"
        fi

        run_sql "INSERT OR REPLACE INTO NetworkTVDevice (id, name, brand, model, ipAddress, port, macAddress, status, createdAt, updatedAt) VALUES ('tv-${tv_num}', 'TV ${tv_num}', 'lg', 'LG WebOS', '${ip}', 3000, '', 'discovered', datetime('now'), datetime('now'));"
        log "TV ${tv_num}: LG at ${ip} (.${octet}) → Wolf Pack output ${wp_output:-N/A}"
        ((tv_num++))
    done

    # Roku TVs
    for entry in "${FOUND_ROKU[@]+"${FOUND_ROKU[@]}"}"; do
        [[ -z "$entry" ]] && continue
        local ip
        ip=$(echo "$entry" | cut -d'|' -f1)
        local octet=$(ip_last_octet "$ip")

        local wp_output=""
        if [[ ${#FOUND_WOLFPACK[@]} -gt 0 ]]; then
            wp_output=$(prompt_input "Wolf Pack output for TV ${tv_num} - Roku (.${octet})" "${octet}")
            [[ -n "$wp_output" ]] && WP_OUTPUTS["$wp_output"]="TV ${tv_num} - Roku (${ip})"
        fi

        run_sql "INSERT OR REPLACE INTO NetworkTVDevice (id, name, brand, model, ipAddress, port, macAddress, status, createdAt, updatedAt) VALUES ('tv-${tv_num}', 'TV ${tv_num}', 'roku', 'Roku TV', '${ip}', 8060, '', 'discovered', datetime('now'), datetime('now'));"
        log "TV ${tv_num}: Roku at ${ip} (.${octet}) → Wolf Pack output ${wp_output:-N/A}"
        ((tv_num++))
    done

    # Vizio TVs
    for entry in "${FOUND_VIZIO[@]+"${FOUND_VIZIO[@]}"}"; do
        [[ -z "$entry" ]] && continue
        local ip
        ip=$(echo "$entry" | cut -d'|' -f1)
        local octet=$(ip_last_octet "$ip")

        local wp_output=""
        if [[ ${#FOUND_WOLFPACK[@]} -gt 0 ]]; then
            wp_output=$(prompt_input "Wolf Pack output for TV ${tv_num} - Vizio (.${octet})" "${octet}")
            [[ -n "$wp_output" ]] && WP_OUTPUTS["$wp_output"]="TV ${tv_num} - Vizio (${ip})"
        fi

        run_sql "INSERT OR REPLACE INTO NetworkTVDevice (id, name, brand, model, ipAddress, port, macAddress, status, createdAt, updatedAt) VALUES ('tv-${tv_num}', 'TV ${tv_num}', 'vizio', 'Vizio SmartCast', '${ip}', 7345, '', 'discovered', datetime('now'), datetime('now'));"
        log "TV ${tv_num}: Vizio at ${ip} (.${octet}) → Wolf Pack output ${wp_output:-N/A}"
        ((tv_num++))
    done

    echo ""
    info "Samsung TVs require on-screen pairing — complete via web UI at /device-config"
}

configure_crestron() {
    if [[ ${#FOUND_CRESTRON[@]} -eq 0 ]]; then
        if ! prompt_yes_no "No Crestron matrix found. Add one manually?" "n"; then
            return
        fi
        local ip
        ip=$(prompt_input "Crestron IP address")
        FOUND_CRESTRON+=("${ip}|41795|Manual")
    fi

    local crest_ip
    crest_ip=$(echo "${FOUND_CRESTRON[0]}" | cut -d'|' -f1)
    local crest_port
    crest_port=$(echo "${FOUND_CRESTRON[0]}" | cut -d'|' -f2)

    echo ""
    log "Configuring Crestron matrix at ${BOLD}${crest_ip}${NC}"

    local models=("DM-MD8X8" "DM-MD16X16" "DM-MD32X32" "DM-MD64X64" "DM-MD128X128" "HD-MD8X8" "DMPS3-4K-350-C")
    local model_idx
    model_idx=$(prompt_select "Select Crestron model:" "${models[@]}")
    local model="${models[$((model_idx - 1))]}"

    run_sql "INSERT OR REPLACE INTO CrestronMatrix (id, name, model, ipAddress, port, protocol, status, createdAt, updatedAt) VALUES ('crestron-1', 'Crestron ${model}', '${model}', '${crest_ip}', ${crest_port}, 'CTP', 'online', datetime('now'), datetime('now'));"
    log "Crestron ${model} configured at ${crest_ip}:${crest_port}"
}

configure_bss_dbx() {
    # BSS BLU
    if [[ ${#FOUND_BSS[@]} -gt 0 ]]; then
        local bss_ip
        bss_ip=$(echo "${FOUND_BSS[0]}" | cut -d'|' -f1)
        echo ""
        log "Configuring BSS BLU at ${BOLD}${bss_ip}${NC}"

        local models=("BLU-50" "BLU-100" "BLU-120" "BLU-160" "BLU-320" "BLU-800" "BLU-806")
        local model_idx
        model_idx=$(prompt_select "Select BSS model:" "${models[@]}")
        local model="${models[$((model_idx - 1))]}"

        run_sql "INSERT OR REPLACE INTO AudioProcessor (id, name, model, processorType, ipAddress, port, connectionType, status, createdAt, updatedAt) VALUES ('bss-1', 'BSS ${model}', '${model}', 'bss-blu', '${bss_ip}', 1023, 'ethernet', 'online', datetime('now'), datetime('now'));"
        log "BSS ${model} configured"
    fi

    # dbx ZonePRO
    if [[ ${#FOUND_DBX[@]} -gt 0 ]]; then
        local dbx_ip
        dbx_ip=$(echo "${FOUND_DBX[0]}" | cut -d'|' -f1)
        echo ""
        log "Configuring dbx ZonePRO at ${BOLD}${dbx_ip}${NC}"

        local models=("640" "640m" "641" "641m" "1260" "1260m" "1261" "1261m")
        local model_idx
        model_idx=$(prompt_select "Select dbx model:" "${models[@]}")
        local model="${models[$((model_idx - 1))]}"

        run_sql "INSERT OR REPLACE INTO AudioProcessor (id, name, model, processorType, ipAddress, port, connectionType, status, createdAt, updatedAt) VALUES ('dbx-1', 'dbx ZonePRO ${model}', '${model}', 'dbx-zonepro', '${dbx_ip}', 3804, 'ethernet', 'online', datetime('now'), datetime('now'));"
        log "dbx ZonePRO ${model} configured"
    fi

    # Neither found
    if [[ ${#FOUND_BSS[@]} -eq 0 ]] && [[ ${#FOUND_DBX[@]} -eq 0 ]]; then
        if prompt_yes_no "No BSS/dbx audio processors found. Add one?" "n"; then
            local type
            type=$(prompt_input "Type (bss/dbx)" "bss")
            local ip
            ip=$(prompt_input "IP address")
            if [[ "$type" == "bss" ]]; then
                FOUND_BSS+=("${ip}|1023|Manual")
                configure_bss_dbx
            else
                FOUND_DBX+=("${ip}|3804|Manual")
                configure_bss_dbx
            fi
        fi
    fi
}

# ─── Wolf Pack Routing Map Display ───────────────────────────────────────────

show_routing_map() {
    if [[ ${#FOUND_WOLFPACK[@]} -eq 0 ]] && [[ ${#FOUND_CRESTRON[@]} -eq 0 ]]; then
        return
    fi

    echo ""
    echo -e "  ${BOLD}MATRIX ROUTING MAP${NC}"
    echo -e "  ${DIM}┌─────────────────────────────────────────────────┐${NC}"

    # Inputs
    if [[ ${#WP_INPUTS[@]} -gt 0 ]]; then
        printf "  ${DIM}│${NC} ${BOLD}%-7s %-40s${NC} ${DIM}│${NC}\n" "INPUT" "DEVICE"
        echo -e "  ${DIM}├─────────────────────────────────────────────────┤${NC}"
        for input_num in $(echo "${!WP_INPUTS[@]}" | tr ' ' '\n' | sort -n); do
            printf "  ${DIM}│${NC} ${GREEN}%-7s${NC} %-40s ${DIM}│${NC}\n" "$input_num" "${WP_INPUTS[$input_num]}"
        done
    fi

    # Outputs
    if [[ ${#WP_OUTPUTS[@]} -gt 0 ]]; then
        echo -e "  ${DIM}├─────────────────────────────────────────────────┤${NC}"
        printf "  ${DIM}│${NC} ${BOLD}%-7s %-40s${NC} ${DIM}│${NC}\n" "OUTPUT" "TV"
        echo -e "  ${DIM}├─────────────────────────────────────────────────┤${NC}"
        for output_num in $(echo "${!WP_OUTPUTS[@]}" | tr ' ' '\n' | sort -n); do
            printf "  ${DIM}│${NC} ${CYAN}%-7s${NC} %-40s ${DIM}│${NC}\n" "$output_num" "${WP_OUTPUTS[$output_num]}"
        done
    fi

    echo -e "  ${DIM}└─────────────────────────────────────────────────┘${NC}"
    echo ""

    if [[ ${#WP_INPUTS[@]} -gt 0 ]] || [[ ${#WP_OUTPUTS[@]} -gt 0 ]]; then
        if ! prompt_yes_no "Is this routing map correct?" "y"; then
            warn "You can update the routing map later via the web UI at /matrix-control"
        fi
    fi
}

# ─── Location Branch Setup ───────────────────────────────────────────────────

wizard_location() {
    echo ""
    if ! prompt_yes_no "Create a git location branch for this installation?" "y"; then
        return
    fi

    local location_name
    location_name=$(prompt_input "Location name (lowercase, hyphens only, e.g. 'lucky-s-1313')")

    # Validate slug format
    if [[ ! "$location_name" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$ ]]; then
        warn "Invalid format. Use lowercase letters, numbers, and hyphens."
        location_name=$(prompt_input "Try again")
    fi

    if [[ "$DRY_RUN" == true ]]; then
        info "DRY RUN: Would create branch location/${location_name}"
        return
    fi

    cd "$APP_DIR"
    git checkout -b "location/${location_name}" 2>/dev/null || git checkout "location/${location_name}" 2>/dev/null || true
    git add apps/web/data/ 2>/dev/null || true
    git commit -m "feat(${location_name}): Initial device configuration from setup wizard" 2>/dev/null || true

    log "Created branch: location/${location_name}"

    if prompt_yes_no "Push to GitHub?" "n"; then
        git push -u origin "location/${location_name}" 2>&1 || warn "Push failed — you can push later"
    fi
}

# ─── Ollama AI Setup ─────────────────────────────────────────────────────────

wizard_ollama() {
    echo ""
    if ! command -v ollama &>/dev/null; then
        if prompt_yes_no "Ollama not installed. Install it now?" "y"; then
            if [[ "$DRY_RUN" == true ]]; then
                info "DRY RUN: Would install Ollama"
            else
                info "Installing Ollama..."
                curl -fsSL https://ollama.com/install.sh | sh 2>&1 | tail -3
                sudo systemctl enable ollama 2>/dev/null || true
                sudo systemctl start ollama 2>/dev/null || true
                sleep 2
            fi
        else
            return
        fi
    fi

    if [[ "$DRY_RUN" == true ]]; then
        info "DRY RUN: Would pull llama3.1:8b and nomic-embed-text"
        return
    fi

    log "Ollama is installed. Pulling AI models..."
    echo ""

    info "Pulling llama3.1:8b (this may take several minutes)..."
    ollama pull llama3.1:8b 2>&1 | tail -3 || warn "Failed to pull llama3.1:8b"

    info "Pulling nomic-embed-text..."
    ollama pull nomic-embed-text 2>&1 | tail -3 || warn "Failed to pull nomic-embed-text"

    echo ""
    log "Installed models:"
    ollama list 2>/dev/null || true
}

# ─── .env Configuration ─────────────────────────────────────────────────────

configure_env() {
    if [[ "$DRY_RUN" == true ]]; then
        info "DRY RUN: Would update .env with NEXTAUTH_URL=http://${LOCAL_IP}:3001"
        return
    fi

    # Create .env if it doesn't exist
    if [[ ! -f "$ENV_FILE" ]]; then
        cat > "$ENV_FILE" << ENVEOF
DATABASE_URL="file:/home/ubuntu/sports-bar-data/production.db"
NODE_ENV=production
PORT=3001
NEXTAUTH_URL=http://${LOCAL_IP}:3001
OLLAMA_BASE_URL=http://localhost:11434
ENVEOF
        chown ubuntu:ubuntu "$ENV_FILE"
        log "Created .env with NEXTAUTH_URL=http://${LOCAL_IP}:3001"
    else
        # Update NEXTAUTH_URL
        if grep -q "NEXTAUTH_URL" "$ENV_FILE"; then
            sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=http://${LOCAL_IP}:3001|" "$ENV_FILE"
        else
            echo "NEXTAUTH_URL=http://${LOCAL_IP}:3001" >> "$ENV_FILE"
        fi
        log "Updated NEXTAUTH_URL in .env"
    fi
}

# ─── Final Verification ─────────────────────────────────────────────────────

wizard_verify() {
    echo ""
    echo -e "  ${BOLD}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "  ${BOLD}║         SETUP COMPLETE - DEVICE SUMMARY         ║${NC}"
    echo -e "  ${BOLD}╠══════════════════════════════════════════════════╣${NC}"

    printf "  ${BOLD}║${NC} %-14s %-34s ${BOLD}║${NC}\n" "Network:" "http://${LOCAL_IP}:3001"

    # Matrix
    if [[ ${#FOUND_WOLFPACK[@]} -gt 0 ]]; then
        local wp_ip=$(echo "${FOUND_WOLFPACK[0]}" | cut -d'|' -f1)
        printf "  ${BOLD}║${NC} ${GREEN}%-14s${NC} %-34s ${BOLD}║${NC}\n" "Wolf Pack:" "${wp_ip} [CONFIGURED]"
    elif [[ ${#FOUND_CRESTRON[@]} -gt 0 ]]; then
        local cr_ip=$(echo "${FOUND_CRESTRON[0]}" | cut -d'|' -f1)
        printf "  ${BOLD}║${NC} ${GREEN}%-14s${NC} %-34s ${BOLD}║${NC}\n" "Crestron:" "${cr_ip} [CONFIGURED]"
    else
        printf "  ${BOLD}║${NC} ${DIM}%-14s${NC} %-34s ${BOLD}║${NC}\n" "Matrix:" "None configured"
    fi

    # Audio
    if [[ ${#FOUND_ATLAS[@]} -gt 0 ]]; then
        local at_ip=$(echo "${FOUND_ATLAS[0]}" | cut -d'|' -f1)
        printf "  ${BOLD}║${NC} ${CYAN}%-14s${NC} %-34s ${BOLD}║${NC}\n" "Atlas:" "${at_ip} [CONFIGURED]"
    fi

    # Global Cache
    printf "  ${BOLD}║${NC} ${YELLOW}%-14s${NC} %-34s ${BOLD}║${NC}\n" "Global Cache:" "${#FOUND_GLOBALCACHE[@]} device(s)"

    # DirecTV
    printf "  ${BOLD}║${NC} ${BLUE}%-14s${NC} %-34s ${BOLD}║${NC}\n" "DirecTV:" "${#FOUND_DIRECTV[@]} receiver(s)"

    # Fire TV
    printf "  ${BOLD}║${NC} ${BLUE}%-14s${NC} %-34s ${BOLD}║${NC}\n" "Fire TV:" "${#FOUND_FIRETV[@]} device(s)"

    # TVs
    local total_tvs=$(( ${#FOUND_SAMSUNG[@]} + ${#FOUND_LG[@]} + ${#FOUND_ROKU[@]} + ${#FOUND_VIZIO[@]} ))
    printf "  ${BOLD}║${NC} %-14s %-34s ${BOLD}║${NC}\n" "TVs:" "${total_tvs} discovered"

    # Ollama
    local ollama_status="Not installed"
    if command -v ollama &>/dev/null; then
        local model_count
        model_count=$(ollama list 2>/dev/null | tail -n +2 | wc -l || echo 0)
        ollama_status="${model_count} model(s) loaded"
    fi
    printf "  ${BOLD}║${NC} %-14s %-34s ${BOLD}║${NC}\n" "Ollama:" "${ollama_status}"

    echo -e "  ${BOLD}╠══════════════════════════════════════════════════╣${NC}"
    echo -e "  ${BOLD}║${NC}                                                  ${BOLD}║${NC}"
    echo -e "  ${BOLD}║${NC}  Open your browser to:                           ${BOLD}║${NC}"
    echo -e "  ${BOLD}║${NC}  ${GREEN}${BOLD}http://${LOCAL_IP}:3001${NC}                        ${BOLD}║${NC}"
    echo -e "  ${BOLD}║${NC}                                                  ${BOLD}║${NC}"
    echo -e "  ${BOLD}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
}

# ─── Banner ──────────────────────────────────────────────────────────────────

print_banner() {
    echo ""
    echo -e "${BOLD}${GREEN}================================================================${NC}"
    echo -e "${BOLD}   SPORTS BAR TV CONTROLLER${NC}"
    echo -e "${BOLD}   Location Setup Wizard v${WIZARD_VERSION}${NC}"
    echo -e "${BOLD}${GREEN}================================================================${NC}"
    echo ""
    echo "  This wizard will:"
    echo "    1. Auto-detect your network configuration"
    echo "    2. Scan for all AV equipment on your network"
    echo "    3. Configure discovered devices"
    echo "    4. Map source devices to matrix inputs/outputs"
    echo "    5. Set up AI models and location branch"
    echo ""
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "  ${YELLOW}*** DRY RUN MODE — no files will be written ***${NC}"
        echo ""
    fi
    read -rp "  Press Enter to begin... "
    echo ""
}

# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════

main() {
    # Redirect to log file (while keeping terminal output)
    exec > >(tee -a "$LOG_FILE") 2>&1

    print_banner

    # ── Step 1: Network ──────────────────────────────────────────────────
    step "Step 1/7: Network Configuration"

    LOCAL_IP=$(detect_local_ip)
    SCAN_SUBNET=$(detect_subnet "$LOCAL_IP")
    local gateway
    gateway=$(detect_gateway)

    # Detect primary network interface
    local net_iface
    net_iface=$(ip -o -4 addr show | grep -v '127.0.0.1' | grep -E '(eth|enp|eno)' | awk '{print $2}' | head -1)
    net_iface="${net_iface:-$(ip -o -4 addr show | grep -v '127.0.0.1' | awk '{print $2}' | head -1)}"

    echo -e "  Detected network:"
    echo -e "    Interface:   ${BOLD}${net_iface:-unknown}${NC}"
    echo -e "    IP Address:  ${BOLD}${LOCAL_IP}${NC}"
    echo -e "    Subnet:      ${BOLD}${SCAN_SUBNET}.0/24${NC}"
    echo -e "    Gateway:     ${BOLD}${gateway:-unknown}${NC}"
    echo -e "    Type:        ${BOLD}$(grep -q 'dhcp' /etc/netplan/*.yaml 2>/dev/null && echo 'DHCP' || echo 'Static')${NC}"
    echo ""

    if ! prompt_yes_no "Is this correct?" "y"; then
        LOCAL_IP=$(prompt_input "Enter your IP address" "$LOCAL_IP")
        SCAN_SUBNET=$(detect_subnet "$LOCAL_IP")
        gateway=$(prompt_input "Enter gateway" "$gateway")
    fi

    # Offer to set static IP
    echo ""
    if prompt_yes_no "Set a static IP address? (recommended for servers)" "y"; then
        local static_ip
        static_ip=$(prompt_input "Static IP address" "$LOCAL_IP")
        local static_gateway
        static_gateway=$(prompt_input "Gateway" "${gateway:-${SCAN_SUBNET}.1}")
        local static_dns
        static_dns=$(prompt_input "DNS server" "8.8.8.8")
        local static_iface
        static_iface=$(prompt_input "Network interface" "${net_iface}")

        if [[ "$DRY_RUN" == true ]]; then
            info "DRY RUN: Would set static IP ${static_ip} on ${static_iface}"
        else
            # Write netplan config (600 permissions required by netplan)
            cat > /etc/netplan/01-static.yaml << NETPLANEOF
network:
  version: 2
  renderer: networkd
  ethernets:
    ${static_iface}:
      dhcp4: no
      addresses:
        - ${static_ip}/24
      routes:
        - to: default
          via: ${static_gateway}
      nameservers:
        addresses:
          - ${static_dns}
          - 8.8.4.4
NETPLANEOF
            chmod 600 /etc/netplan/01-static.yaml
            # Remove any DHCP config
            rm -f /etc/netplan/00-installer-config.yaml 2>/dev/null || true
            rm -f /etc/netplan/01-netcfg.yaml 2>/dev/null || true

            log "Applying static IP ${static_ip}..."
            netplan apply 2>&1 || warn "netplan apply failed — may need manual fix"
            sleep 2

            # Update our variables
            LOCAL_IP="$static_ip"
            SCAN_SUBNET=$(detect_subnet "$LOCAL_IP")
            log "Static IP set: ${static_ip} on ${static_iface}"
        fi
    else
        info "Keeping current network configuration (DHCP)"
    fi

    configure_env

    # ── Step 2: Network Scan ─────────────────────────────────────────────
    step "Step 2/7: Scanning Network for Devices"

    scan_subnet_full "$SCAN_SUBNET"
    identify_firetv_devices
    display_scan_results

    if [[ "$SCAN_ONLY" == true ]]; then
        log "Scan complete (--scan-only mode). Exiting."
        exit 0
    fi

    # ── Step 3: Video Matrix ─────────────────────────────────────────────
    step "Step 3/7: Video Matrix Configuration"

    if [[ ${#FOUND_WOLFPACK[@]} -gt 0 ]]; then
        configure_wolfpack
    elif [[ ${#FOUND_CRESTRON[@]} -gt 0 ]]; then
        configure_crestron
    else
        echo "  No matrix switcher found on the network."
        if prompt_yes_no "Do you have a Wolf Pack matrix?" "n"; then
            configure_wolfpack
        elif prompt_yes_no "Do you have a Crestron DM matrix?" "n"; then
            configure_crestron
        else
            info "Skipping matrix configuration"
        fi
    fi

    # ── Step 4: Audio Processor ──────────────────────────────────────────
    step "Step 4/7: Audio Processor Configuration"

    if [[ ${#FOUND_ATLAS[@]} -gt 0 ]]; then
        configure_atlas
    fi
    if [[ ${#FOUND_BSS[@]} -gt 0 ]] || [[ ${#FOUND_DBX[@]} -gt 0 ]]; then
        configure_bss_dbx
    fi
    if [[ ${#FOUND_ATLAS[@]} -eq 0 ]] && [[ ${#FOUND_BSS[@]} -eq 0 ]] && [[ ${#FOUND_DBX[@]} -eq 0 ]]; then
        echo "  No audio processors found on the network."
        if prompt_yes_no "Do you have an Atlas IED processor?" "n"; then
            configure_atlas
        elif prompt_yes_no "Do you have a BSS BLU or dbx ZonePRO?" "n"; then
            configure_bss_dbx
        else
            info "Skipping audio processor configuration"
        fi
    fi

    # ── Step 5: Source Devices ───────────────────────────────────────────
    step "Step 5/7: Source Devices (Cable, DirecTV, Fire TV)"

    # Global Cache + Cable Boxes
    if [[ ${#FOUND_GLOBALCACHE[@]} -gt 0 ]]; then
        configure_globalcache
    fi
    configure_cable_boxes

    # DirecTV
    if [[ ${#FOUND_DIRECTV[@]} -gt 0 ]]; then
        configure_directv
    else
        if prompt_yes_no "No DirecTV receivers found. Add manually?" "n"; then
            configure_directv
        fi
    fi

    # Fire TV
    if [[ ${#FOUND_FIRETV[@]} -gt 0 ]]; then
        configure_firetv
    else
        if prompt_yes_no "No Fire TV devices found. Add manually?" "n"; then
            configure_firetv
        fi
    fi

    # ── Step 6: TVs & Routing Map ────────────────────────────────────────
    step "Step 6/7: TV Discovery & Matrix Routing"

    configure_tvs
    show_routing_map

    # ── Step 7: AI & Location Branch ─────────────────────────────────────
    step "Step 7/7: AI Setup & Location Branch"

    wizard_ollama
    wizard_location

    # ── Done ─────────────────────────────────────────────────────────────
    wizard_verify

    # Mark as complete
    if [[ "$DRY_RUN" != true ]]; then
        touch "$DONE_MARKER" 2>/dev/null || true
    fi

    log "Setup wizard complete. Log saved to ${LOG_FILE}"
}

# ─── Entry Point ─────────────────────────────────────────────────────────────
if [[ "$SOURCE_ONLY" == true ]]; then
    : # Functions loaded, do not run main
else
    main
fi
