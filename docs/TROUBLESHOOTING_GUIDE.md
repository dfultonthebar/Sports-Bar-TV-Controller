# Troubleshooting Guide

**Last Updated:** November 6, 2025
**Version:** 2.0

---

## Table of Contents

1. [Quick Diagnostic Steps](#quick-diagnostic-steps)
2. [Device Issues](#device-issues)
3. [Application Issues](#application-issues)
4. [Network Issues](#network-issues)
5. [Database Issues](#database-issues)
6. [Hardware Issues](#hardware-issues)
7. [Performance Issues](#performance-issues)
8. [Audio Issues](#audio-issues)
9. [Matrix Routing Issues](#matrix-routing-issues)
10. [Error Messages](#error-messages)
11. [Recovery Procedures](#recovery-procedures)

---

## Quick Diagnostic Steps

### Universal Troubleshooting Workflow

When encountering any issue, follow this systematic approach:

```
1. IDENTIFY
   ↓
   What exactly isn't working?
   What error messages appear?
   When did it start?

2. ISOLATE
   ↓
   Is it one device or all?
   Is it one feature or system-wide?
   Can you reproduce it?

3. CHECK BASICS
   ↓
   Is it powered on?
   Is it connected to network?
   Are there any obvious errors?

4. TEST
   ↓
   Try basic functionality
   Check system logs
   Review recent changes

5. REMEDIATE
   ↓
   Apply fix from this guide
   Document what worked
   Monitor for recurrence

6. ESCALATE (if needed)
   ↓
   Contact system admin
   Provide diagnostic info
   Explain steps already tried
```

### Health Check Commands

**Quick System Health:**
```bash
# Application status
pm2 status

# Check web interface
curl -s http://localhost:3001/api/health/database | python3 -m json.tool

# Check disk space
df -h /home/ubuntu/sports-bar-data

# Check memory
free -h

# Recent errors
tail -50 /home/ubuntu/.pm2/logs/sports-bar-tv-controller-error.log
```

---

## Device Issues

### Fire TV Device Not Responding

#### Symptoms
- Device shows "Offline" status
- Commands don't execute
- "Connection refused" error
- ADB connection failure

#### Diagnostic Steps

1. **Check Device Status:**
   ```bash
   # Test ADB connection
   adb connect <fire-tv-ip>:5555
   adb devices
   ```

2. **Verify Network:**
   ```bash
   # Ping device
   ping <fire-tv-ip>

   # Check if port is open
   nc -zv <fire-tv-ip> 5555
   ```

3. **Check ADB Server:**
   ```bash
   # Restart ADB server
   adb kill-server
   adb start-server
   ```

#### Solutions

**Solution 1: Restart ADB Connection**
```bash
# Via admin panel
Go to /admin/firetv
Find device → Click "Restart ADB"

# Via command line
adb disconnect <fire-tv-ip>
adb connect <fire-tv-ip>:5555
```

**Solution 2: Restart Fire TV Device**
1. Unplug Fire TV power
2. Wait 30 seconds
3. Plug back in
4. Wait for boot (1-2 minutes)
5. Reconnect from admin panel

**Solution 3: Re-enable ADB Debugging**
1. On Fire TV: Settings → My Fire TV → About
2. Click "Network" - note IP hasn't changed
3. Go to Developer Options
4. Disable then re-enable "ADB Debugging"
5. Try connection again

**Solution 4: Check Firewall**
```bash
# Verify port 5037 is accessible
sudo ufw status
sudo ufw allow 5037/tcp
```

**Solution 5: Reset Device Configuration**
1. Remove device from admin panel
2. Factory reset Fire TV (if necessary)
3. Re-enable ADB
4. Add device again with correct IP

#### Common Causes

| Cause | Indicator | Fix |
|-------|-----------|-----|
| DHCP IP changed | "Host unreachable" | Use static IP or update config |
| ADB unauthorized | "Unauthorized" | Accept prompt on TV |
| Network issue | Ping fails | Check switch/router/cables |
| Fire TV crashed | No response to any command | Restart Fire TV |
| ADB server died | All Fire TVs offline | Restart ADB server |

### DirecTV Device Not Responding

#### Symptoms
- "Connection timeout" error
- Channel changes don't work
- Device shows offline

#### Diagnostic Steps

1. **Test Network Connection:**
   ```bash
   # Ping DirecTV receiver
   ping <directv-ip>

   # Test port
   nc -zv <directv-ip> 8080
   ```

2. **Manual Test:**
   ```bash
   # Send test command
   curl "http://<directv-ip>:8080/remote/processKey?key=info"
   ```

3. **Check DirecTV Settings:**
   - Menu → Settings → Whole-Home → External Device
   - Verify "External Access" is enabled

#### Solutions

**Solution 1: Restart DirecTV Receiver**
1. Press and hold red power button for 10 seconds
2. Wait for full reboot (3-5 minutes)
3. Test connection from admin panel

**Solution 2: Re-enable External Access**
1. DirecTV Menu → Settings
2. Whole-Home → External Device
3. Disable then re-enable "External Access"
4. Note IP address (verify it matches config)

**Solution 3: Check Network Path**
```bash
# Trace route to DirecTV
traceroute <directv-ip>

# Check for network issues
mtr <directv-ip>
```

**Solution 4: Update Device IP**
1. Find current DirecTV IP (from DirecTV menu)
2. Update in admin panel: `/admin/directv`
3. Save and test connection

### Cable Box IR Control Not Working

#### Symptoms
- Channel changes don't work
- Cable box doesn't respond
- "Command failed" error

#### Diagnostic Steps

1. **Check IR Emitter Placement:**
   - Is emitter positioned correctly? (4-6" from IR sensor)
   - Is emitter cable connected to iTach?
   - Is emitter LED visible through phone camera?

2. **Test iTach Connection:**
   ```bash
   # Ping iTach
   ping <itach-ip>

   # Test port
   nc -zv <itach-ip> 4998

   # Send test command
   echo "get_NET,0:1" | nc <itach-ip> 4998
   ```

3. **Visual IR Test:**
   - Point phone camera at IR emitter
   - Send command from system
   - You should see purple/white flashing
   - No flashing = emitter issue or cable issue

#### Solutions

**Solution 1: Reposition IR Emitter**

See IR_EMITTER_PLACEMENT_GUIDE.md for detailed instructions.

Quick tips:
- Move closer to IR sensor (4-6 inches)
- Ensure direct line of sight
- Clean IR sensor window
- Avoid bright light interference

**Solution 2: Test Different iTach Port**
1. Move emitter cable to different port (1:2 or 1:3)
2. Update device config with new port
3. Test commands

**Solution 3: Re-learn IR Codes**
1. Go to `/admin/ir-devices`
2. Select device
3. Click "Learn IR Codes"
4. Re-learn problematic commands
5. Test each code

**Solution 4: Check iTach Power**
- Verify iTach is powered on (LED lit)
- Check power adapter connection
- Try power cycling iTach
- Wait 60 seconds, test again

**Solution 5: Cable Box Hard Reset**
1. Unplug cable box
2. Wait 30 seconds
3. Plug back in
4. Wait for full boot (2-3 minutes)
5. Test IR commands

#### IR Troubleshooting Matrix

| Symptom | Possible Cause | Fix |
|---------|---------------|-----|
| No IR visible on camera | Emitter disconnected or dead | Check cable, replace emitter |
| IR visible but box doesn't respond | Wrong position | Reposition per guide |
| Intermittent response | Marginal placement | Move closer or adjust angle |
| Wrong device responds | Too much spread | Use dual-eye, reposition |
| Commands work then stop | Cable box firmware update | Re-learn codes |

### CEC Control Not Working

#### Symptoms
- CEC commands fail
- Cable box doesn't respond to CEC
- Device shows as offline

#### Important Note

**Spectrum/Charter Cable Boxes:**
- CEC is DISABLED in firmware
- Cannot be enabled
- Must use IR control instead
- See CEC_DEPRECATION_NOTICE.md

**For Compatible Devices (Xfinity, etc.):**

#### Diagnostic Steps

1. **Check CEC Adapter:**
   ```bash
   # List CEC adapters
   ls -l /dev/ttyACM*

   # Test adapter
   echo "scan" | cec-client -s -d 1
   ```

2. **Check Device Path:**
   ```bash
   # Verify device path in config matches actual device
   ls -l /dev/ttyACM*
   ```

3. **Test CEC Command:**
   ```bash
   # Send test power command
   echo "on 0" | cec-client -s -d 1 -t p /dev/ttyACM0
   ```

#### Solutions

**Solution 1: Reconnect CEC Adapter**
1. Unplug USB adapter from server
2. Wait 10 seconds
3. Plug back in
4. Check new device path: `ls -l /dev/ttyACM*`
5. Update config if path changed

**Solution 2: Check HDMI Connection**
1. Verify HDMI cable from adapter to cable box
2. Check cable is fully seated
3. Try different HDMI port on cable box
4. Use known-good HDMI cable

**Solution 3: Restart CEC Service**
```bash
# Stop application
pm2 stop sports-bar-tv-controller

# Kill any stuck CEC processes
pkill -9 cec-client

# Restart application
pm2 start sports-bar-tv-controller
```

**Solution 4: Switch to IR Control**

For Spectrum and other CEC-incompatible boxes:
1. Set up iTach IP2IR
2. Learn IR codes from physical remote
3. Configure device as IR device instead
4. See CEC_TO_IR_MIGRATION_GUIDE.md

---

## Application Issues

### Application Won't Start

#### Symptoms
- PM2 shows "errored" or "stopped" status
- Web interface not accessible
- Port 3001 not responding

#### Diagnostic Steps

1. **Check PM2 Status:**
   ```bash
   pm2 status
   pm2 logs sports-bar-tv-controller --lines 50
   ```

2. **Check Port:**
   ```bash
   # Is something using port 3001?
   lsof -i :3001
   netstat -tlnp | grep 3001
   ```

3. **Check Permissions:**
   ```bash
   # Can we access application directory?
   ls -la /home/ubuntu/Sports-Bar-TV-Controller

   # Can we access database?
   ls -la /home/ubuntu/sports-bar-data/production.db
   ```

#### Solutions

**Solution 1: Restart Application**
```bash
pm2 restart sports-bar-tv-controller

# If that fails, try full stop/start
pm2 stop sports-bar-tv-controller
pm2 start sports-bar-tv-controller

# Check logs
pm2 logs sports-bar-tv-controller
```

**Solution 2: Rebuild Application**
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npm run build
pm2 restart sports-bar-tv-controller
```

**Solution 3: Check Database**
```bash
# Verify database integrity
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"

# If corrupted, restore from backup
pm2 stop sports-bar-tv-controller
cp /home/ubuntu/sports-bar-data/production.db /home/ubuntu/sports-bar-data/production.db.bad
gunzip -c /home/ubuntu/sports-bar-data/backups/latest.db.gz > /home/ubuntu/sports-bar-data/production.db
pm2 start sports-bar-tv-controller
```

**Solution 4: Kill Port Conflict**
```bash
# Find process using port 3001
lsof -ti:3001

# Kill it
kill -9 $(lsof -ti:3001)

# Start application
pm2 start sports-bar-tv-controller
```

**Solution 5: Check Node.js**
```bash
# Verify Node.js version
node --version
# Should be v18 or higher

# Reinstall dependencies
cd /home/ubuntu/Sports-Bar-TV-Controller
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart sports-bar-tv-controller
```

### Application Crashes or Restarts Frequently

#### Symptoms
- PM2 shows high restart count
- Application restarts every few minutes
- "Out of memory" errors

#### Diagnostic Steps

1. **Check Restart Count:**
   ```bash
   pm2 show sports-bar-tv-controller
   # Look at "restarts" number
   ```

2. **Check Memory Usage:**
   ```bash
   pm2 monit
   # Or
   ./scripts/analyze-memory.sh
   ```

3. **Review Crash Logs:**
   ```bash
   tail -100 /home/ubuntu/.pm2/logs/sports-bar-tv-controller-error.log
   ```

#### Solutions

**Solution 1: Memory Leak**
```bash
# Restart to clear memory
pm2 restart sports-bar-tv-controller

# Monitor memory over time
pm2 monit

# If memory keeps growing:
# 1. Check recent code changes
# 2. Review for unclosed connections
# 3. Check for infinite loops in logs
```

**Solution 2: Increase Memory Limit**

Edit `/home/ubuntu/Sports-Bar-TV-Controller/ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'sports-bar-tv-controller',
    max_memory_restart: '1G',  // Increase from 512M
    // ...
  }]
};
```

Reload:
```bash
pm2 reload sports-bar-tv-controller
```

**Solution 3: Database Lock Issues**
```bash
# Check for database locks
lsof /home/ubuntu/sports-bar-data/production.db

# Clear stale locks
rm -f /home/ubuntu/sports-bar-data/production.db-shm

# Checkpoint WAL
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Restart
pm2 restart sports-bar-tv-controller
```

**Solution 4: Unhandled Promise Rejections**

Check logs for:
```
UnhandledPromiseRejectionWarning
```

If found:
1. Note which service/component
2. Check recent code changes
3. Review error handling in that component
4. May need code fix

### Web Interface Not Loading

#### Symptoms
- Blank page
- "Cannot GET /" error
- Infinite loading spinner
- 404 errors

#### Diagnostic Steps

1. **Check Application Status:**
   ```bash
   pm2 status
   curl http://localhost:3001
   ```

2. **Check Browser Console:**
   - Open browser DevTools (F12)
   - Check Console tab for errors
   - Check Network tab for failed requests

3. **Test API Directly:**
   ```bash
   curl http://localhost:3001/api/health/database
   ```

#### Solutions

**Solution 1: Clear Browser Cache**
1. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. Or clear cache: Settings → Privacy → Clear browsing data
3. Reload page

**Solution 2: Check Build Files**
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
ls -la .next/

# If .next is missing or incomplete:
npm run build
pm2 restart sports-bar-tv-controller
```

**Solution 3: Check Network Path**
```bash
# From another device on network
curl http://<server-ip>:3001

# If fails, check firewall
sudo ufw status
sudo ufw allow 3001/tcp
```

**Solution 4: Check Next.js Errors**
```bash
# Look for Next.js specific errors
grep -i "next" /home/ubuntu/.pm2/logs/sports-bar-tv-controller-error.log

# Common issues:
# - Missing environment variables
# - Build errors
# - Module not found
```

---

## Network Issues

### Devices Losing Network Connection

#### Symptoms
- Multiple devices offline simultaneously
- "Network unreachable" errors
- Intermittent connectivity

#### Diagnostic Steps

1. **Check Network Infrastructure:**
   ```bash
   # Ping gateway
   ping 192.168.1.1

   # Check DNS
   nslookup google.com

   # Check internet
   curl -I https://google.com
   ```

2. **Check Server Network:**
   ```bash
   # Check interface status
   ip addr show

   # Check routing
   ip route

   # Check for packet loss
   ping -c 10 192.168.1.1
   ```

3. **Check Switch/Router:**
   - Verify switch has power
   - Check link lights on ports
   - Try accessing switch admin interface

#### Solutions

**Solution 1: Restart Network**
```bash
# Restart network service (Ubuntu)
sudo systemctl restart NetworkManager

# Or restart interface
sudo ip link set <interface> down
sudo ip link set <interface> up
```

**Solution 2: Check DHCP Conflicts**
- Verify devices have unique IPs
- Check for DHCP pool exhaustion
- Consider static IPs for critical devices

**Solution 3: Restart Network Hardware**
1. Restart switch (power cycle)
2. Wait 60 seconds
3. Check device connectivity
4. May need to restart router as well

**Solution 4: Check Network Segmentation**
- Verify all devices on same subnet (if required)
- Check VLAN configuration
- Verify routing between VLANs

### Slow Network Performance

#### Symptoms
- Commands take long to execute
- High latency
- Timeouts

#### Diagnostic Steps

1. **Measure Latency:**
   ```bash
   # Ping devices
   ping -c 10 <device-ip>

   # Check for high latency or packet loss
   ```

2. **Check Network Load:**
   ```bash
   # Check bandwidth usage
   iftop
   # or
   nload
   ```

3. **Check Switch Performance:**
   - Look for switch errors/collisions
   - Check switch CPU usage
   - Verify switch isn't oversubscribed

#### Solutions

**Solution 1: Reduce Network Traffic**
- Limit video streaming quality
- Reduce health check frequency (temporarily)
- Disable unnecessary services

**Solution 2: Upgrade Network Infrastructure**
- Use gigabit switches (not 100Mbps)
- Replace failing network cables
- Upgrade router if bottleneck

**Solution 3: Optimize Application**
- Increase command timeout values
- Implement request batching
- Cache frequently accessed data

---

## Database Issues

### Database Locked

#### Symptoms
- "Database is locked" error
- Commands fail with database error
- Application hangs

#### Diagnostic Steps

1. **Check Database Locks:**
   ```bash
   # Check what's using database
   lsof /home/ubuntu/sports-bar-data/production.db
   ```

2. **Check WAL File Size:**
   ```bash
   ls -lh /home/ubuntu/sports-bar-data/production.db-wal
   # Should be < 10MB normally
   ```

#### Solutions

**Solution 1: Checkpoint WAL**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

**Solution 2: Clear Stale Locks**
```bash
# Stop application
pm2 stop sports-bar-tv-controller

# Remove shared memory file
rm -f /home/ubuntu/sports-bar-data/production.db-shm

# Restart
pm2 start sports-bar-tv-controller
```

**Solution 3: Increase Timeout**

In database configuration, increase busy timeout:
```sql
PRAGMA busy_timeout = 30000;  -- 30 seconds
```

### Database Corrupted

#### Symptoms
- "Database disk image is malformed"
- Integrity check fails
- Application won't start

#### Diagnostic Steps

1. **Check Integrity:**
   ```bash
   sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"
   ```

2. **Check File:**
   ```bash
   file /home/ubuntu/sports-bar-data/production.db
   # Should say "SQLite 3.x database"
   ```

#### Solutions

**Solution 1: Restore from Backup**

See EMERGENCY_QUICK_REFERENCE.md for detailed steps.

Quick procedure:
```bash
pm2 stop sports-bar-tv-controller
cp /home/ubuntu/sports-bar-data/production.db /home/ubuntu/sports-bar-data/production.db.corrupt
gunzip -c /home/ubuntu/sports-bar-data/backups/latest.db.gz > /home/ubuntu/sports-bar-data/production.db
pm2 start sports-bar-tv-controller
```

**Solution 2: Attempt Recovery**
```bash
# Dump and rebuild
sqlite3 /home/ubuntu/sports-bar-data/production.db ".dump" | \
  sqlite3 /home/ubuntu/sports-bar-data/production_recovered.db

# If successful, swap databases
pm2 stop sports-bar-tv-controller
mv /home/ubuntu/sports-bar-data/production.db /home/ubuntu/sports-bar-data/production.db.corrupt
mv /home/ubuntu/sports-bar-data/production_recovered.db /home/ubuntu/sports-bar-data/production.db
pm2 start sports-bar-tv-controller
```

---

## Hardware Issues

### Matrix Switcher Not Responding

#### Symptoms
- Matrix commands fail
- Input switching doesn't work
- "Connection timeout" error

#### Diagnostic Steps

1. **Test Connection:**
   ```bash
   # Ping matrix
   ping <matrix-ip>

   # Test telnet port
   nc -zv <matrix-ip> 23

   # Try manual connection
   telnet <matrix-ip> 23
   ```

2. **Send Test Command:**
   ```bash
   # Connect and send command
   echo "I1O1" | nc <matrix-ip> 23
   ```

#### Solutions

**Solution 1: Restart Matrix**
1. Power cycle matrix switcher
2. Wait 60 seconds for full boot
3. Test connection from admin panel

**Solution 2: Check Network**
- Verify IP address hasn't changed
- Check network cable connection
- Verify on correct VLAN/subnet

**Solution 3: Reset Matrix Configuration**
1. Access matrix admin interface (if available)
2. Check for firmware updates
3. Verify telnet is enabled
4. Check security settings

**Solution 4: Alternative Control**
- Use matrix remote control (if available)
- Check RS-232 control option
- Verify matrix is functioning properly

### Audio Processor Issues

#### Symptoms
- Volume control doesn't work
- Zones not responding
- AtlasIED connection error

#### Diagnostic Steps

1. **Test Connection:**
   ```bash
   # Ping processor
   ping <atlas-ip>

   # Test HTTP
   curl http://<atlas-ip>/
   ```

2. **Check Processor Status:**
   - Access web interface: `http://<atlas-ip>`
   - Check all zones are enabled
   - Verify firmware version

#### Solutions

**Solution 1: Restart Audio Processor**
1. Power cycle processor
2. Wait for full boot (60-90 seconds)
3. Test from admin panel

**Solution 2: Reconfigure Zones**
1. Go to `/admin/audio`
2. Verify zone configuration
3. Test each zone individually
4. Check input assignments

**Solution 3: Update Firmware**
- Check AtlasIED website for updates
- Follow vendor update procedure
- Reconfigure after update

---

## Performance Issues

### High Memory Usage

#### Symptoms
- PM2 shows memory > 512MB
- Application slow
- Frequent restarts

#### Diagnostic Steps

1. **Check Current Usage:**
   ```bash
   pm2 monit
   # or
   ./scripts/analyze-memory.sh
   ```

2. **Check Memory Growth:**
   ```bash
   # Watch over time
   watch -n 5 'pm2 show sports-bar-tv-controller | grep memory'
   ```

#### Solutions

**Solution 1: Restart Application**
```bash
pm2 restart sports-bar-tv-controller
```

**Solution 2: Investigate Memory Leak**
- Check recent code changes
- Review connection handling
- Look for unclosed handles
- Use Node.js profiler

**Solution 3: Increase Limit (Temporary)**

Edit `ecosystem.config.js`:
```javascript
max_memory_restart: '1G'
```

### Slow Response Times

#### Symptoms
- Commands take > 2 seconds
- Web interface laggy
- High API latency

#### Diagnostic Steps

1. **Measure Response Time:**
   ```bash
   # Time an API call
   time curl http://localhost:3001/api/health/database
   ```

2. **Check System Load:**
   ```bash
   top
   htop
   ```

3. **Check Database:**
   ```bash
   # Database size
   ls -lh /home/ubuntu/sports-bar-data/production.db

   # WAL size
   ls -lh /home/ubuntu/sports-bar-data/production.db-wal
   ```

#### Solutions

**Solution 1: Database Optimization**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA optimize; VACUUM; ANALYZE;"
```

**Solution 2: Clear Logs**
```bash
# Clean old database logs
# Via SQL or admin panel
DELETE FROM logs WHERE timestamp < datetime('now', '-7 days');
```

**Solution 3: Restart Services**
```bash
pm2 restart sports-bar-tv-controller
```

---

## Audio Issues

### No Audio from TVs

#### Symptoms
- Video playing but no sound
- Volume changes have no effect

#### Solutions

1. **Check TV Mute Status:**
   - Look for mute icon on TV
   - Try unmute command

2. **Check Audio Zone:**
   - Verify zone isn't muted
   - Check zone volume level
   - Verify correct source selected

3. **Check Physical Connections:**
   - Audio cable from TV to processor
   - Processor outputs to amplifier
   - Amplifier to speakers

4. **Check Audio Source:**
   - Some inputs may not have audio
   - Verify correct audio input selected on processor

### Audio Clipping or Distortion

#### Symptoms
- Audio sounds distorted
- Clipping at high volume
- Inconsistent levels

#### Solutions

1. **Adjust Input Gain:**
   - Go to `/admin/audio`
   - Lower input level
   - Use AI gain optimization

2. **Check Volume Levels:**
   - Reduce zone volume
   - Check max volume settings
   - Verify amplifier not overdriven

3. **Check Cables:**
   - Verify all connections tight
   - Check for damaged cables
   - Ensure proper cable type (balanced vs unbalanced)

---

## Matrix Routing Issues

### Inputs Not Switching

#### Symptoms
- Route command succeeds but video doesn't change
- Wrong input appears
- No video after switch

#### Solutions

1. **Verify Matrix Configuration:**
   - Check input/output numbers match physical setup
   - Verify matrix type/model correct

2. **Test Direct Command:**
   ```bash
   echo "I1O1" | nc <matrix-ip> 23
   ```

3. **Check HDMI Handshake:**
   - Power cycle source device
   - Power cycle TV
   - Allow 10 seconds for HDCP negotiation

4. **Check Cable Quality:**
   - Verify all HDMI cables are high-speed
   - Check cable length (< 25ft without repeater)
   - Replace suspect cables

---

## Error Messages

### Common Error Messages and Fixes

#### "Connection refused (ECONNREFUSED)"

**Meaning:** Target device or service isn't accepting connections

**Causes:**
- Service not running on target device
- Wrong IP address or port
- Firewall blocking connection
- Device powered off

**Fix:**
1. Verify device is on and IP is correct
2. Check service is running on device
3. Test with ping and port check
4. Check firewall rules

#### "Network unreachable (ENETUNREACH)"

**Meaning:** Can't reach network where device is located

**Causes:**
- Device on different subnet
- Routing issue
- Network cable disconnected
- Switch/router down

**Fix:**
1. Check server network connection
2. Verify device IP and subnet
3. Check routing table
4. Restart network hardware

#### "Database is locked (SQLITE_BUSY)"

**Meaning:** Another process is writing to database

**Causes:**
- Multiple database connections
- Long-running transaction
- Stale lock file

**Fix:**
1. See [Database Locked](#database-locked) section above

#### "Out of memory (JavaScript heap out of memory)"

**Meaning:** Node.js process exhausted memory

**Causes:**
- Memory leak
- Processing large dataset
- Insufficient memory allocation

**Fix:**
1. Restart application
2. Investigate memory leak
3. Increase memory limit
4. Optimize code

#### "ADB unauthorized"

**Meaning:** Fire TV requires authorization

**Fix:**
1. Look at Fire TV screen
2. Accept authorization prompt
3. Reconnect ADB

#### "Command timed out"

**Meaning:** Device didn't respond within timeout period

**Causes:**
- Device slow to respond
- Network latency
- Device busy processing
- Device crashed

**Fix:**
1. Increase timeout value
2. Check device status
3. Restart device
4. Check network performance

---

## Recovery Procedures

### Emergency System Recovery

**Complete System Failure:**

1. **Stop Everything:**
   ```bash
   pm2 stop all
   ```

2. **Create Emergency Backup:**
   ```bash
   cp /home/ubuntu/sports-bar-data/production.db \
      /home/ubuntu/sports-bar-data/emergency-$(date +%s).db
   ```

3. **Check Database:**
   ```bash
   sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"
   ```

4. **Restore if Needed:**
   ```bash
   gunzip -c /home/ubuntu/sports-bar-data/backups/latest.db.gz > \
      /home/ubuntu/sports-bar-data/production.db
   ```

5. **Rebuild Application:**
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   npm run build
   ```

6. **Restart:**
   ```bash
   pm2 start sports-bar-tv-controller
   ```

7. **Verify:**
   ```bash
   pm2 logs sports-bar-tv-controller
   curl http://localhost:3001/api/health/database
   ```

### Rollback After Bad Update

See SYSTEM_ADMIN_GUIDE.md "Rollback Procedure" section.

### Data Recovery

**Lost Configuration:**

1. Check database backups for most recent good data
2. Restore from specific backup:
   ```bash
   gunzip -c /home/ubuntu/sports-bar-data/backups/backup_YYYYMMDD_HHMMSS.db.gz > restored.db
   ```
3. Extract specific data:
   ```bash
   sqlite3 restored.db ".dump channelPresets" > presets.sql
   sqlite3 /home/ubuntu/sports-bar-data/production.db < presets.sql
   ```

---

## When to Escalate

### Contact System Administrator If:

- Multiple recovery attempts fail
- Database corruption persists
- Hardware failure suspected
- Security incident suspected
- System completely unresponsive
- Data loss occurred
- Unknown errors in logs

### Information to Provide:

1. **Problem Description:**
   - What's not working
   - When it started
   - What changed recently

2. **Error Messages:**
   - Exact text of errors
   - Screenshots if applicable

3. **Steps Taken:**
   - What you've already tried
   - Results of each attempt

4. **System State:**
   ```bash
   # Collect diagnostic info
   pm2 status > /tmp/system-diagnostics.txt
   pm2 logs sports-bar-tv-controller --lines 100 >> /tmp/system-diagnostics.txt
   df -h >> /tmp/system-diagnostics.txt
   free -h >> /tmp/system-diagnostics.txt
   ```

5. **Logs:**
   - Recent error logs
   - Application logs around time of issue

---

## Preventive Maintenance

### To Avoid Issues:

1. **Regular Backups:**
   - Verify automated backups running
   - Test restore procedure monthly

2. **Monitor Health:**
   - Check health dashboard daily
   - Review logs weekly
   - Watch for trends

3. **Keep Updated:**
   - Apply security updates promptly
   - Update application monthly
   - Update device firmware as needed

4. **Test Regularly:**
   - Test all devices weekly
   - Verify backups restore correctly
   - Practice recovery procedures

5. **Document Changes:**
   - Note all configuration changes
   - Keep change log
   - Document custom configurations

---

**End of Troubleshooting Guide**

*For system administration, see SYSTEM_ADMIN_GUIDE.md*
*For operations procedures, see OPERATIONS_PLAYBOOK.md*
*For emergency procedures, see EMERGENCY_QUICK_REFERENCE.md*
