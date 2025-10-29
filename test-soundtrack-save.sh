#!/bin/bash
# Test saving Soundtrack token via API

TOKEN="eG5uYUR1U2hhQ0hGWkNpMWQ4Y1c2MXNMTmhja2NsMGg6RXdzWXdmMzRhQUlXVHNlbmgzbG5LcmNVd3JibTJKQktMVmhmbkJZT3U5Unl3c0ZHcWpvMXpWaWRqbFIxZU9WSA=="

echo "Testing Soundtrack API token save..."
echo "Token: ${TOKEN:0:20}..."
echo ""

curl -X POST http://localhost:3001/api/soundtrack/config \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\": \"$TOKEN\"}" \
  --verbose

echo ""
echo ""
echo "Done!"
