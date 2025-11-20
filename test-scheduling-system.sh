#!/bin/bash

BASE_URL="http://localhost:3001"

echo "=== Sports Bar TV Controller - Smart Scheduling System Test ==="
echo ""

# Test 1: Create input sources
echo "1. Creating input sources..."
curl -s -X POST "$BASE_URL/api/scheduling/input-sources" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "cable-box-1",
    "name": "Cable Box Main",
    "type": "cable",
    "availableNetworks": ["ESPN", "ESPN2", "FS1", "FOX", "CBS", "NBC"],
    "priorityRank": 10
  }' | jq '.success'

curl -s -X POST "$BASE_URL/api/scheduling/input-sources" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "firetv-1",
    "name": "Fire TV Bar 1",
    "type": "firetv",
    "availableNetworks": ["ESPN+", "Peacock", "Paramount+"],
    "installedApps": ["ESPN", "Peacock", "Paramount+", "Fox Sports"],
    "priorityRank": 20
  }' | jq '.success'

echo "✓ Input sources created"
echo ""

# Test 2: Sync NBA games
echo "2. Syncing NBA games from ESPN..."
SYNC_RESULT=$(curl -s -X POST "$BASE_URL/api/scheduling/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "basketball",
    "league": "nba"
  }')

echo "$SYNC_RESULT" | jq '{
  success: .success,
  gamesAdded: .result.gamesAdded,
  gamesUpdated: .result.gamesUpdated,
  errors: .result.errors | length
}'

echo ""

# Test 3: Sync NFL games
echo "3. Syncing NFL games from ESPN..."
SYNC_RESULT=$(curl -s -X POST "$BASE_URL/api/scheduling/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "football",
    "league": "nfl"
  }')

echo "$SYNC_RESULT" | jq '{
  success: .success,
  gamesAdded: .result.gamesAdded,
  gamesUpdated: .result.gamesUpdated,
  errors: .result.errors | length
}'

echo ""

# Test 4: Get all scheduled games
echo "4. Getting all scheduled games..."
GAMES=$(curl -s "$BASE_URL/api/scheduling/games?status=scheduled")
GAME_COUNT=$(echo "$GAMES" | jq '.games | length')
echo "Found $GAME_COUNT scheduled games"

if [ "$GAME_COUNT" -gt 0 ]; then
  echo ""
  echo "Sample games:"
  echo "$GAMES" | jq -r '.games[:3] | .[] | "  - \(.awayTeamName) @ \(.homeTeamName) on \(.scheduledStart | split("T")[0]) (\(.league))"'
fi

echo ""

# Test 5: Get input sources
echo "5. Getting all input sources..."
SOURCES=$(curl -s "$BASE_URL/api/scheduling/input-sources")
echo "$SOURCES" | jq '{
  success: .success,
  count: .sources | length,
  sources: .sources | map({id, name, type})
}'

echo ""

# Test 6: Test allocation (if we have games)
if [ "$GAME_COUNT" -gt 0 ]; then
  FIRST_GAME_ID=$(echo "$GAMES" | jq -r '.games[0].id')
  echo "6. Testing game allocation for game: $FIRST_GAME_ID"

  ALLOCATION=$(curl -s -X POST "$BASE_URL/api/scheduling/allocate" \
    -H "Content-Type: application/json" \
    -d "{
      \"gameId\": \"$FIRST_GAME_ID\",
      \"tvOutputIds\": [\"tv-1\", \"tv-2\"]
    }")

  echo "$ALLOCATION" | jq '{
    success: .success,
    inputSource: .allocation.inputSourceId,
    message: .allocation.message
  }'

  echo ""

  # Test 7: Get current allocations
  echo "7. Getting current allocations..."
  curl -s "$BASE_URL/api/scheduling/allocate" | jq '{
    success: .success,
    count: .allocations | length
  }'
fi

echo ""
echo "=== Test Complete ==="
