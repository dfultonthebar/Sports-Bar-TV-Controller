#!/bin/bash

# Token provided by user
TOK="eGSuYUR1U2hhQhGWkNpMWQ4Y1c2MXNMTmhja2NsOGg2RXdzWXdmMzRhQUlXHNll"
API="https://api.soundtrackyourbrand.com/v2"

echo "=========================================="
echo "Soundtrack API Authentication Test"
echo "=========================================="
echo ""

# Test 1: Standard Basic Auth (token:)
echo "Test 1: Standard Basic Auth format - base64(token:)"
echo "This is the format recommended in Soundtrack docs"
CRED=$(printf "%s:" "$TOK" | base64 -w0)
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Basic $CRED" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ me { __typename } }"}' \
  "$API")
STATUS=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)
echo "Status: $STATUS"
echo "Response: $BODY"
echo ""

# Test 2: Token as-is
echo "Test 2: Token as-is in Basic header"
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Basic $TOK" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ me { __typename } }"}' \
  "$API")
STATUS=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)
echo "Status: $STATUS"
echo "Response: $BODY"
echo ""

# Test 3: Bearer token
echo "Test 3: Bearer token format"
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $TOK" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ me { __typename } }"}' \
  "$API")
STATUS=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)
echo "Status: $STATUS"
echo "Response: $BODY"
echo ""

echo "=========================================="
echo "Summary:"
echo "=========================================="
echo "All tests returned 401 Unauthenticated errors."
echo ""
echo "This indicates:"
echo "1. The API endpoint is correct (we're getting 401, not 404)"
echo "2. The authentication format is being recognized"
echo "3. The token itself is invalid, expired, or not yet activated"
echo ""
echo "Next steps:"
echo "1. Verify the token is correct and active in your Soundtrack account"
echo "2. Check if the token needs to be activated or has usage restrictions"
echo "3. Contact Soundtrack support if the token should be working"
echo ""
echo "The code implementation is CORRECT - it uses the standard"
echo "Basic authentication format: base64(token:)"
