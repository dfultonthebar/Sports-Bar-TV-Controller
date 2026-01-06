#!/bin/bash

# Sports Bar AI Assistant - Log Cleanup Script
# Cleans up old log files to prevent disk space issues

LOG_DIR="logs"
AI_LOG_DIR="ai-analysis/logs" 
DAYS_TO_KEEP=30

echo "🧹 Cleaning up old log files..."
echo "Keeping logs from the last $DAYS_TO_KEEP days"

if [ -d "$LOG_DIR" ]; then
    echo "Cleaning main logs directory..."
    find "$LOG_DIR" -name "*.log" -mtime +$DAYS_TO_KEEP -delete 2>/dev/null || true
    find "$LOG_DIR" -name "*.log.*" -mtime +$DAYS_TO_KEEP -delete 2>/dev/null || true
fi

if [ -d "$AI_LOG_DIR" ]; then
    echo "Cleaning AI analysis logs..."
    find "$AI_LOG_DIR" -name "*.log" -mtime +$DAYS_TO_KEEP -delete 2>/dev/null || true
fi

echo "✅ Log cleanup completed"
