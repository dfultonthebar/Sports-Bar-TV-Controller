#!/bin/bash

# AV System Service Monitor
# This script checks the status of the Wolf Pack matrix switcher TCP and UDP ports
# and restarts the services if they are down. It also logs the service status and
# sends a notification on service restart.

# Usage: Run this script periodically (e.g., via cron job) to monitor the AV system.

# Set the log file path
LOG_FILE="/var/log/av-system-monitor.log"

# Function to check TCP port status
check_tcp_port() {
    local port=$1
    local status=$(nc -z -w 2 localhost "$port" && echo "up" || echo "down")
    echo "$status"
}

# Function to check UDP port status
check_udp_port() {
    local port=$1
    local status=$(nc -uz -w 2 localhost "$port" && echo "up" || echo "down")
    echo "$status"
}

# Function to restart services
restart_services() {
    # Add commands to restart the relevant services
    echo "Restarting Wolf Pack matrix switcher services..."
    # systemctl restart wolf-pack-service
    # systemctl restart av-control-service
}

# Function to send notification
send_notification() {
    local message=$1
    echo "NOTIFICATION: $message"
}

# Main script
check_date=$(date)
echo "[$check_date] Checking Wolf Pack matrix switcher services" | tee -a "$LOG_FILE"

# Check TCP port status (Wolf Pack TCP control)
tcp_port_status=$(check_tcp_port 5000)
echo "[$check_date] TCP port 5000 status: $tcp_port_status" | tee -a "$LOG_FILE"

# Check UDP port status (Wolf Pack UDP control)
udp_port_status=$(check_udp_port 4000)
echo "[$check_date] UDP port 4000 status: $udp_port_status" | tee -a "$LOG_FILE"

# Restart services if necessary
if [ "$tcp_port_status" == "down" ] || [ "$udp_port_status" == "down" ]; then
    echo "[$check_date] Wolf Pack services are down - restarting..." | tee -a "$LOG_FILE"
    restart_services
    send_notification "Wolf Pack matrix switcher services have been restarted"
else
    echo "[$check_date] Wolf Pack services are running normally" | tee -a "$LOG_FILE"
fi