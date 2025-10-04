#!/bin/bash
# Test script for Multi-AI Consultant System
# Tests Claude and Grok model integration

set -e

echo "=== Testing Multi-AI Consultant System ==="
echo "Test started at $(date)"
echo ""

# Test endpoint
ENDPOINT="http://localhost:3000/api/chat/diagnostics"

# Test query
QUERY="What are the most common causes of TV display issues in a sports bar?"

echo "Testing diagnostics chat endpoint..."
echo "Query: $QUERY"
echo ""

# Make the API call
RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$QUERY\"}" \
  2>&1)

# Check if response is valid JSON
if echo "$RESPONSE" | jq empty 2>/dev/null; then
  echo "✓ Valid JSON response received"
  echo ""
  
  # Extract key information
  echo "=== Response Summary ==="
  echo "$RESPONSE" | jq -r '.summary // "No summary available"'
  echo ""
  
  # Check for AI responses
  echo "=== AI Providers ==="
  PROVIDERS=$(echo "$RESPONSE" | jq -r '.responses[]?.provider // empty' 2>/dev/null)
  
  if [ -z "$PROVIDERS" ]; then
    echo "⚠ No AI provider responses found"
  else
    echo "$PROVIDERS" | while read -r provider; do
      echo "✓ $provider responded"
    done
  fi
  echo ""
  
  # Check for errors
  ERRORS=$(echo "$RESPONSE" | jq -r '.responses[]? | select(.error != null) | "\(.provider): \(.error)"' 2>/dev/null)
  
  if [ -n "$ERRORS" ]; then
    echo "=== Errors Detected ==="
    echo "$ERRORS"
    echo ""
  fi
  
  # Check consensus
  echo "=== Consensus ==="
  AGREEMENT=$(echo "$RESPONSE" | jq -r '.consensus?.agreementLevel // "unknown"')
  CONFIDENCE=$(echo "$RESPONSE" | jq -r '.consensus?.confidence // "unknown"')
  echo "Agreement Level: $AGREEMENT"
  echo "Confidence: $CONFIDENCE"
  echo ""
  
  # Save full response
  echo "$RESPONSE" | jq '.' > /tmp/multi-ai-test-response.json
  echo "Full response saved to: /tmp/multi-ai-test-response.json"
  
else
  echo "✗ Invalid response received"
  echo "Response:"
  echo "$RESPONSE"
  exit 1
fi

echo ""
echo "=== Test Complete at $(date) ==="
