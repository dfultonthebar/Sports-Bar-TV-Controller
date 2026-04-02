#!/bin/bash
# Verify DB Migration - Tests all critical API flows
# Run after code updates to ensure nothing is broken

PORT=${1:-3001}
BASE="http://localhost:$PORT"
PASS=0
FAIL=0

green() { echo -e "\033[32m✓ $1\033[0m"; PASS=$((PASS+1)); }
red() { echo -e "\033[31m✗ $1\033[0m"; FAIL=$((FAIL+1)); }

echo "=== Sports Bar TV Controller - DB Migration Verification ==="
echo "Testing against $BASE"
echo ""

# 1. Device endpoints
echo "--- Device Endpoints ---"

# DirecTV devices from DB
RESULT=$(curl -s "$BASE/api/directv-devices")
COUNT=$(echo "$RESULT" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('devices',[])))" 2>/dev/null)
[ "$COUNT" -gt 0 ] 2>/dev/null && green "DirecTV devices: $COUNT found" || red "DirecTV devices: none found (expected >0)"

# Fire TV devices from DB
RESULT=$(curl -s "$BASE/api/firetv-devices")
COUNT=$(echo "$RESULT" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('devices',[])))" 2>/dev/null)
[ "$COUNT" -gt 0 ] 2>/dev/null && green "Fire TV devices: $COUNT found" || red "Fire TV devices: none found (expected >0)"

# All devices combined
RESULT=$(curl -s "$BASE/api/devices/all")
SUCCESS=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
[ "$SUCCESS" = "True" ] && green "Devices/all endpoint OK" || red "Devices/all endpoint failed"

echo ""
echo "--- Matrix & Audio ---"

# Matrix config
RESULT=$(curl -s "$BASE/api/matrix/config")
SUCCESS=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('configs',[]))>0)" 2>/dev/null)
[ "$SUCCESS" = "True" ] && green "Matrix config loaded" || red "Matrix config empty"

# Current channels
RESULT=$(curl -s "$BASE/api/matrix/current-channels")
SUCCESS=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
[ "$SUCCESS" = "True" ] && green "Current channels endpoint OK" || red "Current channels endpoint failed"

# Audio zones
RESULT=$(curl -s "$BASE/api/audio-processor/zones?processorId=3641dcba-98b8-4f7c-b0ae-d4c7dbecaed9")
ZONES=$(echo "$RESULT" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('zones',[])))" 2>/dev/null)
[ "$ZONES" -gt 0 ] 2>/dev/null && green "Audio zones: $ZONES found" || red "Audio zones: none found"

echo ""
echo "--- Channel Guide ---"

# Channel guide
RESULT=$(curl -s "$BASE/api/channel-guide?source=directv")
SUCCESS=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
[ "$SUCCESS" = "True" ] && green "Channel guide endpoint OK" || red "Channel guide endpoint failed"

# Station aliases in DB
ALIASES=$(sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT COUNT(*) FROM station_aliases;" 2>/dev/null)
[ "$ALIASES" -gt 0 ] 2>/dev/null && green "Station aliases: $ALIASES in DB" || red "Station aliases: none in DB"

# Channel overrides in DB
OVERRIDES=$(sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT COUNT(*) FROM local_channel_overrides;" 2>/dev/null)
[ "$OVERRIDES" -gt 0 ] 2>/dev/null && green "Channel overrides: $OVERRIDES in DB" || red "Channel overrides: none in DB (may be OK if no local overrides)"

echo ""
echo "--- Scheduling ---"

# Scheduler status
RESULT=$(curl -s "$BASE/api/scheduler/manage")
SUCCESS=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
[ "$SUCCESS" = "True" ] && green "Scheduler endpoint OK" || red "Scheduler endpoint failed"

echo ""
echo "--- Health ---"

RESULT=$(curl -s "$BASE/api/health")
STATUS=$(echo "$RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
[ "$STATUS" = "ok" ] || [ "$STATUS" = "healthy" ] && green "Health check: $STATUS" || red "Health check: $STATUS"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && echo -e "\033[32mAll checks passed!\033[0m" || echo -e "\033[31m$FAIL check(s) failed\033[0m"
exit $FAIL
