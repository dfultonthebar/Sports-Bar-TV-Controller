#!/bin/bash

# Simple PM2 Health Check (no external dependencies)
# Usage: ./scripts/pm2-simple-health.sh

echo "=== PM2 Health Check ==="
echo "Timestamp: $(date)"
echo ""

echo "PM2 Process Status:"
pm2 status

echo ""
echo "Process Details:"
pm2 describe sports-bar-tv-controller

echo ""
echo "Recent Errors (last 20 lines):"
tail -20 /home/ubuntu/.pm2/logs/sports-bar-tv-controller-error.log

echo ""
echo "Log File Sizes:"
ls -lh /home/ubuntu/.pm2/logs/sports-bar-tv-controller-*.log

echo ""
echo "System Resources:"
free -h
echo ""
uptime
echo ""
df -h /home/ubuntu

echo ""
echo "Application Endpoint Test:"
curl -s http://localhost:3001 > /dev/null && echo "✓ Application is responding" || echo "✗ Application not responding"

echo ""
echo "=== Health Check Complete ==="
