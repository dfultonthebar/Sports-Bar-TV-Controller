#!/bin/bash

################################################################################
# Retrieve Benchmark Results from Remote System
# Run this script after the benchmark completes on the remote system
################################################################################

REMOTE_HOST="135.131.39.26"
REMOTE_PORT="223"
REMOTE_USER="ubuntu"
REMOTE_PASS="6809233DjD\$\$\$"

echo "=== Checking Benchmark Status on Remote System ==="
echo ""

# Check if benchmark is still running
STATUS=$(sshpass -p "${REMOTE_PASS}" ssh -o StrictHostKeyChecking=no -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} '
if pgrep -f "system-benchmark.sh" > /dev/null; then
    echo "RUNNING"
    LOG_FILE=$(ls -t /home/ubuntu/benchmark-run-*.log 2>/dev/null | head -1)
    if [ -n "$LOG_FILE" ]; then
        echo "Progress:"
        tail -10 "$LOG_FILE" | grep -E "Progress:|▶" | tail -3
    fi
else
    echo "COMPLETED"
fi
')

echo "$STATUS"
echo ""

if echo "$STATUS" | grep -q "RUNNING"; then
    echo "⏳ Benchmark is still running. Please wait and run this script again."
    echo ""
    echo "Estimated time remaining: Check the progress percentage above"
    exit 0
fi

echo "✓ Benchmark completed! Retrieving results..."
echo ""

# Retrieve and commit results
sshpass -p "${REMOTE_PASS}" ssh -o StrictHostKeyChecking=no -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} '
cd /home/ubuntu/Sports-Bar-TV-Controller

echo "=== Generated Reports ==="
ls -lh benchmark-reports/baseline-report-*.md 2>/dev/null
ls -lh benchmark-reports/baseline-report-*.json 2>/dev/null
echo ""

if ls benchmark-reports/baseline-report-*.md 1> /dev/null 2>&1; then
    echo "=== Committing to GitHub ==="
    git add benchmark-reports/baseline-report-*.md
    git add benchmark-reports/baseline-report-*.json
    
    git commit -m "Add baseline benchmark results from current production system

- Hardware: Intel Core i5-7200U, 4 cores
- Comprehensive performance metrics captured  
- Ready for NUC13ANHi5 comparison"
    
    git push origin benchmark-baseline-20251007
    
    echo ""
    echo "✓ Results committed and pushed!"
    echo ""
    
    # Show summary
    LATEST_MD=$(ls -t benchmark-reports/baseline-report-*.md | head -1)
    echo "=== Report Summary ==="
    head -150 "$LATEST_MD"
else
    echo "✗ No reports found!"
    LOG_FILE=$(ls -t /home/ubuntu/benchmark-run-*.log 2>/dev/null | head -1)
    if [ -n "$LOG_FILE" ]; then
        echo "Check log: $LOG_FILE"
        tail -50 "$LOG_FILE"
    fi
fi
'

echo ""
echo "=== Next Steps ==="
echo "1. Review the benchmark report above"
echo "2. Create a PR for the benchmark results"
echo "3. Deploy to NUC13ANHi5"
echo "4. Run benchmark again on new system"
echo "5. Compare results using comparison-template.md"

