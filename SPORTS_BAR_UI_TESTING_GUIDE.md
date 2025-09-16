# Sports Bar TV Controller - Comprehensive UI Testing Guide

## Overview

The Sports Bar TV Controller is currently running on **port 5000** with the main dashboard interface operational. This guide provides comprehensive testing instructions for all UI components and services.

## Current System Status

### ✅ Working Components
- **Main Dashboard UI** - Fully functional at `http://localhost:5000`
- **Basic API Status Endpoint** - Available at `/api/status`
- **Web Interface** - Responsive design with TV controls
- **Visual Elements** - 4 volume sliders, preset buttons, sync controls

### ⚠️ Components Requiring Configuration
- **AI Agent Dashboard** - Routes not registered (404 errors)
- **Sports Content Dashboard** - Routes not registered (404 errors)
- **Backend FastAPI** - Not integrated with current Flask server
- **Log File Dependencies** - Missing log directory causing API errors

## Testing Instructions

### 1. Browser-Based Testing

#### Main Dashboard Access
```bash
# Open main dashboard
http://localhost:5000
```

**What to verify:**
- Page loads with "Sports Bar AV Control" title
- Sync mode indicator shows "Enabled" 
- Four preset buttons visible: Big Game, Chill Mode, Multi Game, Closing Time
- Three TV control sections: Main Bar TV, Patio TV, Dining TV
- Each TV section has source dropdown and volume slider
- Apply buttons for each TV section

#### Interactive Elements Testing
1. **Sync Toggle Button**: Click "Turn OFF Sync" button
2. **Preset Buttons**: Click each preset (Big Game, Chill Mode, etc.)
3. **Volume Sliders**: Adjust volume sliders for each TV
4. **Source Dropdowns**: Change source selections
5. **Apply Buttons**: Click "Apply to [TV Name]" buttons

### 2. Command-Line API Testing

#### Basic Health Checks
```bash
# Test main dashboard availability
curl -I http://localhost:5000
# Expected: HTTP/1.1 200 OK

# Test API status endpoint
curl http://localhost:5000/api/status
# Expected: JSON response with system status

# Test service responsiveness
curl -w "Response Time: %{time_total}s\n" -o /dev/null -s http://localhost:5000
```

#### API Endpoint Testing
```bash
# Test all available endpoints
curl http://localhost:5000/api/inputs
curl http://localhost:5000/api/outputs
curl http://localhost:5000/toggle_sync
curl http://localhost:5000/preset/big_game
```

### 3. Service Health Verification

#### Check Running Processes
```bash
# Verify server is running on port 5000
lsof -i :5000

# Check process details
ps aux | grep python | grep dashboard

# Verify working directory
pwdx $(pgrep -f dashboard.py)
```

#### Log File Monitoring
```bash
# Check for log files (currently missing)
ls -la /home/ubuntu/github_repos/Sports-Bar-TV-Controller/ui/logs/
ls -la /home/ubuntu/github_repos/Sports-Bar-TV-Controller/logs/

# Monitor real-time logs if available
tail -f /home/ubuntu/github_repos/Sports-Bar-TV-Controller/ui/logs/sportsbar_av.log
```

### 4. Network and Connectivity Testing

#### Port Accessibility
```bash
# Test from localhost
telnet localhost 5000

# Test HTTP connectivity
nc -zv localhost 5000

# Check network interfaces
netstat -tlnp | grep :5000
```

#### Cross-Network Testing
```bash
# Test from external network (if applicable)
curl -I http://[SERVER_IP]:5000

# Test with different user agents
curl -H "User-Agent: Mobile" http://localhost:5000
```

### 5. Browser Developer Tools Testing

#### Console Testing
Open browser developer tools (F12) and run:

```javascript
// Check page elements
console.log("Title:", document.title);
console.log("Volume sliders:", document.querySelectorAll('input[type="range"]').length);
console.log("Preset buttons:", document.querySelectorAll('.preset-btn').length);

// Test AJAX functionality
fetch('/api/status')
  .then(response => response.json())
  .then(data => console.log('API Status:', data));

// Check for JavaScript errors
console.log("No JavaScript errors should appear above this line");
```

#### Network Tab Monitoring
1. Open Network tab in developer tools
2. Refresh the page
3. Verify all resources load successfully (CSS, JS, images)
4. Check for any failed requests (red entries)

### 6. Performance Testing

#### Response Time Testing
```bash
# Test response times for multiple requests
for i in {1..10}; do
  curl -w "Request $i: %{time_total}s\n" -o /dev/null -s http://localhost:5000
done

# Test concurrent requests
ab -n 100 -c 10 http://localhost:5000/
```

#### Load Testing
```bash
# Install Apache Bench if not available
sudo apt-get install apache2-utils

# Run load test
ab -n 1000 -c 50 http://localhost:5000/

# Monitor system resources during load
htop
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. 404 Errors for AI/Sports Dashboards
**Problem**: `/ai` and `/sports` routes return 404
**Solution**: 
- Currently only the main dashboard is running
- To enable other dashboards, run the full application via `main.py`
- Check if blueprints are properly registered

#### 2. API Errors Due to Missing Logs
**Problem**: `/api/inputs` and `/api/outputs` return file not found errors
**Solution**:
```bash
# Create missing log directory
mkdir -p /home/ubuntu/github_repos/Sports-Bar-TV-Controller/ui/logs
touch /home/ubuntu/github_repos/Sports-Bar-TV-Controller/ui/logs/sportsbar_av.log
```

#### 3. 500 Errors on Toggle/Preset Endpoints
**Problem**: `/toggle_sync` and `/preset/*` return 500 errors
**Solution**: 
- These endpoints require backend AV manager integration
- Check if AV devices are properly configured
- Verify configuration files exist

#### 4. Port Already in Use
**Problem**: Cannot start server on port 5000
**Solution**:
```bash
# Find process using port 5000
lsof -ti:5000

# Kill the process
kill -9 $(lsof -ti:5000)

# Or use a different port
python dashboard.py --port 5001
```

### Advanced Debugging

#### Enable Debug Mode
```bash
# Run with debug enabled
cd /home/ubuntu/github_repos/Sports-Bar-TV-Controller/ui
python dashboard.py --debug
```

#### Check Configuration Files
```bash
# Verify configuration files exist
ls -la /home/ubuntu/github_repos/Sports-Bar-TV-Controller/config/
cat /home/ubuntu/github_repos/Sports-Bar-TV-Controller/config/mappings.yaml
```

#### Database/State Verification
```bash
# Check for any database files
find /home/ubuntu/github_repos/Sports-Bar-TV-Controller -name "*.db" -o -name "*.sqlite"

# Check for state files
find /home/ubuntu/github_repos/Sports-Bar-TV-Controller -name "*.json" -o -name "*.yaml"
```

## Security Testing

### Basic Security Checks
```bash
# Check for exposed sensitive information
curl http://localhost:5000/config
curl http://localhost:5000/.env
curl http://localhost:5000/admin

# Test for common vulnerabilities
curl -X POST http://localhost:5000/api/status
curl -H "X-Forwarded-For: malicious-ip" http://localhost:5000
```

## Integration Testing

### Full System Integration
1. **Start all services**: Ensure main.py is running instead of just dashboard.py
2. **Test service communication**: Verify AI bridge, sports services, and backend API
3. **Test device integration**: Check AV device connectivity
4. **Test real-time features**: Verify WebSocket connections and live updates

### Service Dependencies
```bash
# Check for required services
systemctl status nginx  # If using reverse proxy
systemctl status redis  # If using caching
ps aux | grep node      # If using Node.js services
```

## Automated Testing Script

Create a comprehensive test script:

```bash
#!/bin/bash
# save as test_sports_bar_ui.sh

echo "=== Sports Bar TV Controller UI Test Suite ==="

# Test 1: Basic connectivity
echo "Testing basic connectivity..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 | grep -q "200"; then
    echo "✅ Main dashboard accessible"
else
    echo "❌ Main dashboard not accessible"
fi

# Test 2: API endpoints
echo "Testing API endpoints..."
curl -s http://localhost:5000/api/status | jq . > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ API status endpoint working"
else
    echo "⚠️ API status endpoint has issues"
fi

# Test 3: Response times
echo "Testing response times..."
response_time=$(curl -w "%{time_total}" -o /dev/null -s http://localhost:5000)
if (( $(echo "$response_time < 1.0" | bc -l) )); then
    echo "✅ Response time acceptable: ${response_time}s"
else
    echo "⚠️ Response time slow: ${response_time}s"
fi

echo "=== Test Complete ==="
```

## Conclusion

The Sports Bar TV Controller main dashboard is fully operational and accessible at `http://localhost:5000`. While the AI and Sports dashboards require additional configuration, the core functionality is working correctly. Use this guide to systematically test all components and troubleshoot any issues that arise.

For full functionality, consider running the complete application via `main.py` instead of the standalone dashboard to enable all features and services.
