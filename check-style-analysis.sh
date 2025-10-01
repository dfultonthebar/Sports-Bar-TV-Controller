#!/bin/bash
# Monitor the style analysis progress

LOG_FILE="ai-style-analysis-run.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Analysis log not found. Has the analysis started?"
    exit 1
fi

echo "🎨 Style Analysis Progress Monitor"
echo "=================================="
echo ""

# Count completed analyses
COMPLETED=$(grep -c "✅" "$LOG_FILE" 2>/dev/null || echo "0")
ERRORS=$(grep -c "❌" "$LOG_FILE" 2>/dev/null || echo "0")
TOTAL=89

echo "Progress: $COMPLETED/$TOTAL components analyzed"
echo "Errors: $ERRORS"
echo ""

# Show recent activity
echo "Recent activity:"
tail -20 "$LOG_FILE"

echo ""
echo "=================================="
echo "To follow live: tail -f $LOG_FILE"
