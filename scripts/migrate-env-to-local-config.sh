#!/bin/bash

# Migrate existing .env settings to local config files
# This preserves your actual device settings in the new config system

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

echo "🔄 Migrating .env settings to local configuration..."
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Nothing to migrate."
    exit 0
fi

# Source the .env file
source .env

# Backup current local config
if [ -f "config/local.local.json" ]; then
    cp config/local.local.json config/local.local.json.backup
    echo "💾 Backed up: config/local.local.json.backup"
fi

# Update local.local.json with actual settings from .env
if [ -n "$WOLFPACK_HOST" ] || [ -n "$WOLFPACK_PORT" ]; then
    echo "📝 Updating Wolfpack settings..."
    
    # Use jq to update the JSON (or sed if jq not available)
    if command -v jq &> /dev/null; then
        # Use jq for clean JSON manipulation
        jq --arg ip "${WOLFPACK_HOST:-192.168.1.100}" \
           --arg port "${WOLFPACK_PORT:-4999}" \
           '.wolfpack.ip = $ip | .wolfpack.port = ($port | tonumber)' \
           config/local.local.json > config/local.local.json.tmp
        mv config/local.local.json.tmp config/local.local.json
        echo "   ✅ Wolfpack IP: $WOLFPACK_HOST"
        echo "   ✅ Wolfpack Port: $WOLFPACK_PORT"
    else
        # Fallback to sed if jq not available
        sed -i "s/\"ip\": \"[^\"]*\"/\"ip\": \"${WOLFPACK_HOST:-192.168.1.100}\"/" config/local.local.json
        sed -i "s/\"port\": [0-9]*/\"port\": ${WOLFPACK_PORT:-4999}/" config/local.local.json
        echo "   ✅ Wolfpack IP: $WOLFPACK_HOST"
        echo "   ✅ Wolfpack Port: $WOLFPACK_PORT"
    fi
fi

# Update API ports if specified
if [ -n "$API_PORT" ]; then
    echo "📝 Updating API port..."
    if command -v jq &> /dev/null; then
        jq --arg port "$API_PORT" \
           '.network.apiPort = ($port | tonumber)' \
           config/local.local.json > config/local.local.json.tmp
        mv config/local.local.json.tmp config/local.local.json
        echo "   ✅ API Port: $API_PORT"
    else
        sed -i "s/\"apiPort\": [0-9]*/\"apiPort\": $API_PORT/" config/local.local.json
        echo "   ✅ API Port: $API_PORT"
    fi
fi

echo ""
echo "✅ Migration complete!"
echo ""
echo "📋 Review your settings:"
echo "   cat config/local.local.json | grep -A 10 wolfpack"
echo ""
echo "📝 To restore backup if needed:"
echo "   cp config/local.local.json.backup config/local.local.json"

