#!/bin/bash
# Sports Bar TV Controller - UI Health Check Script
# Usage: ./test_ui_health.sh

echo "🏈 Sports Bar TV Controller - UI Health Check"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if server is running
echo "1. Checking server status..."
if lsof -i :5000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server is running on port 5000${NC}"
else
    echo -e "${RED}❌ Server is not running on port 5000${NC}"
    exit 1
fi

# Test 2: Test main dashboard
echo ""
echo "2. Testing main dashboard..."
status_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000)
response_time=$(curl -s -o /dev/null -w "%{time_total}" http://localhost:5000)

if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ Main dashboard accessible (HTTP $status_code)${NC}"
    echo -e "   Response time: ${response_time}s"
else
    echo -e "${RED}❌ Main dashboard not accessible (HTTP $status_code)${NC}"
fi

# Test 3: Test API endpoints
echo ""
echo "3. Testing API endpoints..."

# Test /api/status
status_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/status)
if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ /api/status working (HTTP $status_code)${NC}"
else
    echo -e "${YELLOW}⚠️ /api/status issues (HTTP $status_code)${NC}"
fi

# Test /api/inputs
status_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/inputs)
if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ /api/inputs working (HTTP $status_code)${NC}"
else
    echo -e "${YELLOW}⚠️ /api/inputs issues (HTTP $status_code)${NC}"
fi

# Test /api/outputs
status_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/outputs)
if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ /api/outputs working (HTTP $status_code)${NC}"
else
    echo -e "${YELLOW}⚠️ /api/outputs issues (HTTP $status_code)${NC}"
fi

# Test 4: Check additional dashboards
echo ""
echo "4. Testing additional dashboards..."

# Test AI dashboard
status_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/ai)
if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ AI dashboard accessible${NC}"
else
    echo -e "${YELLOW}⚠️ AI dashboard not available (HTTP $status_code)${NC}"
fi

# Test Sports dashboard
status_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/sports)
if [ "$status_code" = "200" ]; then
    echo -e "${GREEN}✅ Sports dashboard accessible${NC}"
else
    echo -e "${YELLOW}⚠️ Sports dashboard not available (HTTP $status_code)${NC}"
fi

# Test 5: Performance check
echo ""
echo "5. Performance testing..."
echo "Running 5 requests to test response time..."
times=()
for i in {1..5}; do
    time=$(curl -s -o /dev/null -w "%{time_total}" http://localhost:5000)
    times+=($time)
    echo "   Request $i: ${time}s"
done

# Simple average calculation using awk
avg_time=$(printf '%s\n' "${times[@]}" | awk '{sum+=$1} END {printf "%.3f", sum/NR}')

# Simple comparison using awk
if awk "BEGIN {exit !($avg_time < 0.5)}"; then
    echo -e "${GREEN}✅ Average response time: ${avg_time}s (Excellent)${NC}"
elif awk "BEGIN {exit !($avg_time < 1.0)}"; then
    echo -e "${YELLOW}⚠️ Average response time: ${avg_time}s (Good)${NC}"
else
    echo -e "${RED}❌ Average response time: ${avg_time}s (Slow)${NC}"
fi

# Test 6: Check log directories
echo ""
echo "6. Checking log directories..."
if [ -d "ui/logs" ]; then
    echo -e "${GREEN}✅ UI logs directory exists${NC}"
else
    echo -e "${YELLOW}⚠️ UI logs directory missing${NC}"
    echo "   Run: mkdir -p ui/logs && touch ui/logs/sportsbar_av.log"
fi

if [ -d "logs" ]; then
    echo -e "${GREEN}✅ Main logs directory exists${NC}"
else
    echo -e "${YELLOW}⚠️ Main logs directory missing${NC}"
    echo "   Run: mkdir -p logs"
fi

# Summary
echo ""
echo "=============================================="
echo "🏈 Health Check Complete!"
echo ""
echo "📋 Quick Access URLs:"
echo "   Main Dashboard: http://localhost:5000"
echo "   API Status:     http://localhost:5000/api/status"
echo "   AI Dashboard:   http://localhost:5000/ai (may not be available)"
echo "   Sports Dashboard: http://localhost:5000/sports (may not be available)"
echo ""
echo "📖 For detailed testing instructions, see:"
echo "   SPORTS_BAR_UI_TESTING_GUIDE.md"
echo ""
