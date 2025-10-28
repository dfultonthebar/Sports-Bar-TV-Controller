#!/bin/bash

# Atlas Integration Testing Script
# Tests all Atlas-related functionality

set -e

echo "=========================================="
echo "Atlas Integration Testing"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_info() { echo -e "${NC}ℹ $1${NC}"; }

# Configuration
APP_URL="http://localhost:3001"
ATLAS_IP="192.168.1.100"
ATLAS_TCP_PORT="5321"
ATLAS_HTTP_PORT="80"

# Test 1: Check if application is running
echo "Test 1: Application Status"
if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" | grep -q "200\|301\|302"; then
    print_success "Application is running"
else
    print_error "Application is not responding"
    echo "Please start the application first"
    exit 1
fi
echo ""

# Test 2: Check Atlas TCP connectivity
echo "Test 2: Atlas TCP Connectivity (Port $ATLAS_TCP_PORT)"
if timeout 3 nc -zv $ATLAS_IP $ATLAS_TCP_PORT 2>&1 | grep -q "succeeded\|open"; then
    print_success "Atlas TCP port $ATLAS_TCP_PORT is reachable"
else
    print_error "Cannot reach Atlas on $ATLAS_IP:$ATLAS_TCP_PORT"
    print_warning "This will cause input gain and zone control failures"
fi
echo ""

# Test 3: Check Atlas HTTP connectivity
echo "Test 3: Atlas HTTP Connectivity (Port $ATLAS_HTTP_PORT)"
if timeout 3 curl -s -o /dev/null -w "%{http_code}" "http://$ATLAS_IP:$ATLAS_HTTP_PORT" | grep -q "200\|401"; then
    print_success "Atlas HTTP port $ATLAS_HTTP_PORT is reachable"
else
    print_warning "Cannot reach Atlas HTTP interface (non-critical)"
fi
echo ""

# Test 4: Get audio processors from API
echo "Test 4: Audio Processor API"
PROCESSORS_RESPONSE=$(curl -s "$APP_URL/api/audio-processor")
if echo "$PROCESSORS_RESPONSE" | grep -q "processors"; then
    print_success "Audio processor API is working"
    PROCESSOR_COUNT=$(echo "$PROCESSORS_RESPONSE" | grep -o '"id"' | wc -l)
    print_info "Found $PROCESSOR_COUNT processor(s)"
    
    # Extract first processor ID
    PROCESSOR_ID=$(echo "$PROCESSORS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$PROCESSOR_ID" ]; then
        print_info "Using processor ID: $PROCESSOR_ID"
    else
        print_error "No processor ID found"
        echo "Please configure an audio processor first"
        exit 1
    fi
else
    print_error "Audio processor API failed"
    echo "Response: $PROCESSORS_RESPONSE"
    exit 1
fi
echo ""

# Test 5: Test input gain API
echo "Test 5: Input Gain API"
GAIN_RESPONSE=$(curl -s "$APP_URL/api/audio-processor/$PROCESSOR_ID/input-gain")
if echo "$GAIN_RESPONSE" | grep -q "gainSettings\|success"; then
    print_success "Input gain API is working"
    
    # Check if we got real data or mock data
    if echo "$GAIN_RESPONSE" | grep -q "SourceGain"; then
        print_success "Receiving REAL data from Atlas processor"
    else
        print_warning "May be receiving mock data - check Atlas connectivity"
    fi
    
    # Show sample data
    echo "Sample response:"
    echo "$GAIN_RESPONSE" | head -c 500
    echo "..."
else
    print_error "Input gain API failed"
    echo "Response: $GAIN_RESPONSE"
fi
echo ""

# Test 6: Test zones status API
echo "Test 6: Zones Status API"
ZONES_RESPONSE=$(curl -s "$APP_URL/api/audio-processor/$PROCESSOR_ID/zones-status")
if echo "$ZONES_RESPONSE" | grep -q "zones\|success"; then
    print_success "Zones status API is working"
    
    # Check if we got real data
    if echo "$ZONES_RESPONSE" | grep -q "ZoneName\|currentSource"; then
        print_success "Receiving REAL zone data from Atlas processor"
    else
        print_warning "May be receiving mock data - check Atlas connectivity"
    fi
    
    # Show sample data
    echo "Sample response:"
    echo "$ZONES_RESPONSE" | head -c 500
    echo "..."
else
    print_error "Zones status API failed"
    echo "Response: $ZONES_RESPONSE"
fi
echo ""

# Test 7: Test setting input gain
echo "Test 7: Set Input Gain (Test Write Operation)"
read -p "Test setting input gain? This will change Input 1 gain to -20dB (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    SET_GAIN_RESPONSE=$(curl -s -X POST "$APP_URL/api/audio-processor/$PROCESSOR_ID/input-gain" \
        -H "Content-Type: application/json" \
        -d '{"inputNumber":1,"gain":-20,"reason":"test"}')
    
    if echo "$SET_GAIN_RESPONSE" | grep -q "success.*true"; then
        print_success "Successfully set input gain"
        echo "Response: $SET_GAIN_RESPONSE"
    else
        print_error "Failed to set input gain"
        echo "Response: $SET_GAIN_RESPONSE"
    fi
else
    print_info "Skipped write test"
fi
echo ""

# Test 8: Test zone control
echo "Test 8: Zone Control (Test Write Operation)"
read -p "Test zone control? This will set Zone 1 volume to 50% (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ZONE_CONTROL_RESPONSE=$(curl -s -X POST "$APP_URL/api/audio-processor/control" \
        -H "Content-Type: application/json" \
        -d "{\"processorId\":\"$PROCESSOR_ID\",\"command\":{\"action\":\"volume\",\"zone\":1,\"value\":50}}")
    
    if echo "$ZONE_CONTROL_RESPONSE" | grep -q "success.*true"; then
        print_success "Successfully controlled zone"
        echo "Response: $ZONE_CONTROL_RESPONSE"
    else
        print_error "Failed to control zone"
        echo "Response: $ZONE_CONTROL_RESPONSE"
    fi
else
    print_info "Skipped zone control test"
fi
echo ""

# Test 9: Check application logs for errors
echo "Test 9: Checking Recent Logs"
if command -v pm2 &> /dev/null; then
    print_info "Recent PM2 logs (last 20 lines):"
    pm2 logs --lines 20 --nostream 2>/dev/null || print_warning "Could not fetch PM2 logs"
else
    print_info "PM2 not available, check logs manually"
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""
echo "If all tests passed:"
echo "  ✓ Application is properly configured"
echo "  ✓ Atlas processor is reachable"
echo "  ✓ Input gains are pulling real data"
echo "  ✓ Zone controls are working"
echo ""
echo "If tests failed:"
echo "  1. Check Atlas processor connectivity"
echo "  2. Verify processor configuration in database"
echo "  3. Check application logs for errors"
echo "  4. Review DIAGNOSTIC_AND_FIX_REPORT.md"
echo ""
echo "For detailed diagnostics, run:"
echo "  ./fix_deployment.sh"
echo ""
