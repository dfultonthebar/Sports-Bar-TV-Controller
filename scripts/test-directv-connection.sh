#!/bin/bash

# DirecTV Connection Diagnostic Tool
# This script helps diagnose DirecTV connection issues

echo "╔════════════════════════════════════════════════════════════╗"
echo "║      DirecTV Connection Diagnostic Tool                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if IP address is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <DirecTV_IP_Address> [port]"
    echo ""
    echo "Example: $0 192.168.1.100"
    echo "Example: $0 192.168.1.100 8080"
    echo ""
    exit 1
fi

DIRECTV_IP="$1"
DIRECTV_PORT="${2:-8080}"

echo "Testing DirecTV receiver at: $DIRECTV_IP:$DIRECTV_PORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Basic ping
echo "[ 1/5 ] Testing network connectivity..."
if ping -c 2 -W 2 "$DIRECTV_IP" > /dev/null 2>&1; then
    echo "   ✅ Receiver is reachable on network"
else
    echo "   ❌ Cannot reach receiver at $DIRECTV_IP"
    echo "   💡 Check: IP address correct? Receiver powered on?"
fi
echo ""

# Test 2: Port check
echo "[ 2/5 ] Testing port $DIRECTV_PORT..."
if timeout 3 bash -c "echo > /dev/tcp/$DIRECTV_IP/$DIRECTV_PORT" 2>/dev/null; then
    echo "   ✅ Port $DIRECTV_PORT is open"
else
    echo "   ❌ Port $DIRECTV_PORT is not responding"
    echo "   💡 Check: Using correct port? (DirecTV usually uses 8080)"
fi
echo ""

# Test 3: HTTP connectivity
echo "[ 3/5 ] Testing HTTP endpoint..."
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://$DIRECTV_IP:$DIRECTV_PORT/" 2>/dev/null)
if [ -n "$HTTP_RESPONSE" ]; then
    if [ "$HTTP_RESPONSE" = "200" ] || [ "$HTTP_RESPONSE" = "404" ]; then
        echo "   ✅ HTTP server is responding (HTTP $HTTP_RESPONSE)"
    elif [ "$HTTP_RESPONSE" = "403" ]; then
        echo "   ⚠️  HTTP server responding but access forbidden (HTTP 403)"
        echo "   💡 This likely means External Access is disabled or needs restart"
    else
        echo "   ⚠️  HTTP server responding with code $HTTP_RESPONSE"
    fi
else
    echo "   ❌ No HTTP response received"
fi
echo ""

# Test 4: SHEF API endpoint
echo "[ 4/5 ] Testing SHEF API (info/getOptions)..."
SHEF_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://$DIRECTV_IP:$DIRECTV_PORT/info/getOptions" 2>/dev/null)
if [ -n "$SHEF_RESPONSE" ]; then
    if [ "$SHEF_RESPONSE" = "200" ]; then
        echo "   ✅ SHEF API is accessible (HTTP $SHEF_RESPONSE)"
    elif [ "$SHEF_RESPONSE" = "403" ]; then
        echo "   ❌ SHEF API blocked (HTTP 403)"
        echo "   💡 External Access is disabled or receiver needs restart"
    else
        echo "   ⚠️  SHEF API returned HTTP $SHEF_RESPONSE"
    fi
else
    echo "   ❌ SHEF API not responding"
fi
echo ""

# Test 5: Remote control endpoint
echo "[ 5/5 ] Testing remote control endpoint..."
REMOTE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://$DIRECTV_IP:$DIRECTV_PORT/remote/processKey?key=KEY_INFO&hold=keyPress" 2>/dev/null)
if [ -n "$REMOTE_RESPONSE" ]; then
    if [ "$REMOTE_RESPONSE" = "200" ]; then
        echo "   ✅ Remote control endpoint working! (HTTP $REMOTE_RESPONSE)"
        echo "   🎉 DirecTV control should be fully functional!"
    elif [ "$REMOTE_RESPONSE" = "403" ]; then
        echo "   ❌ Remote control blocked (HTTP 403)"
        echo "   💡 External Access issue - see recommendations below"
    else
        echo "   ⚠️  Remote control returned HTTP $REMOTE_RESPONSE"
    fi
else
    echo "   ❌ Remote control endpoint not responding"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Provide recommendations based on results
if [ "$REMOTE_RESPONSE" = "403" ] || [ "$SHEF_RESPONSE" = "403" ]; then
    echo "🔧 RECOMMENDATIONS FOR 403 ERRORS:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. Enable External Access on DirecTV Receiver:"
    echo "   • Press MENU button on DirecTV remote"
    echo "   • Navigate to: Settings & Help → Settings"
    echo "   • Select: Whole-Home → External Device"
    echo "   • Enable 'External Access'"
    echo ""
    echo "2. IMPORTANT - Power Cycle the Receiver:"
    echo "   • Unplug the receiver from power"
    echo "   • Wait 30 seconds"
    echo "   • Plug it back in"
    echo "   • Wait 2-3 minutes for full boot"
    echo ""
    echo "3. Verify IP Address:"
    echo "   • On DirecTV: MENU → Settings & Help → Settings → Info & Test"
    echo "   • Look for 'Network' or 'IP Address' section"
    echo "   • Confirm it matches: $DIRECTV_IP"
    echo ""
    echo "4. If still not working, check:"
    echo "   • Firewall settings on network"
    echo "   • Parental controls on receiver"
    echo "   • Receiver firmware is up to date"
    echo ""
elif [ "$REMOTE_RESPONSE" = "200" ]; then
    echo "✅ ALL TESTS PASSED!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Your DirecTV receiver is properly configured and ready for"
    echo "remote control via the Sports Bar TV Controller."
    echo ""
else
    echo "⚠️  CONNECTIVITY ISSUES DETECTED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Please check:"
    echo "• DirecTV receiver is powered on"
    echo "• IP address $DIRECTV_IP is correct"
    echo "• Receiver and server are on same network"
    echo "• No firewall blocking port $DIRECTV_PORT"
    echo ""
fi

echo ""
echo "For detailed diagnostics, use the API endpoint:"
echo "curl -X POST http://localhost:3001/api/directv-devices/diagnose \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"ipAddress\":\"$DIRECTV_IP\",\"port\":$DIRECTV_PORT}'"
echo ""
