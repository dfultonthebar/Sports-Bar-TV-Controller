# System Administrator Guide

**Last Updated:** November 6, 2025
**Version:** 2.0

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Admin Interface Access](#admin-interface-access)
4. [Device Management](#device-management)
5. [User Management](#user-management)
6. [Channel Presets](#channel-presets)
7. [Matrix Routing Configuration](#matrix-routing-configuration)
8. [Audio Zone Management](#audio-zone-management)
9. [System Health Monitoring](#system-health-monitoring)
10. [Backup and Recovery](#backup-and-recovery)
11. [Updating the System](#updating-the-system)
12. [Log Management](#log-management)
13. [Performance Optimization](#performance-optimization)
14. [Security Management](#security-management)

---

## Overview

This guide provides comprehensive documentation for system administrators managing the Sports Bar TV Controller system. It covers day-to-day administration, device configuration, troubleshooting, and maintenance.

### Administrator Responsibilities

- Add and configure new devices
- Manage user accounts and access
- Configure channel presets and routing
- Monitor system health
- Perform backups and updates
- Review logs and diagnose issues
- Optimize system performance
- Ensure security best practices

### Prerequisites

- Access to admin panel (PIN-based authentication)
- SSH access to server (for advanced tasks)
- Understanding of network basics
- Familiarity with devices (Fire TV, DirecTV, etc.)

---

## System Architecture

### Components Overview

```
┌──────────────────────────────────────────────────┐
│          Web Interface (Next.js 15)              │
│  - Bartender Remote                              │
│  - Admin Panel                                   │
│  - Device Control                                │
└─────────────┬────────────────────────────────────┘
              │
┌─────────────▼────────────────────────────────────┐
│      Application Server (Node.js/PM2)            │
│  - API Endpoints                                 │
│  - Device Services                               │
│  - Health Monitor                                │
│  - Scheduler                                     │
└─────────────┬────────────────────────────────────┘
              │
┌─────────────▼────────────────────────────────────┐
│         Database (SQLite + Drizzle ORM)          │
│  - Device configurations                         │
│  - User accounts                                 │
│  - Channel presets                               │
│  - Logs and audit trails                         │
└──────────────────────────────────────────────────┘
              │
┌─────────────▼────────────────────────────────────┐
│          Hardware Control Layer                  │
│  - Fire TV (ADB)                                 │
│  - DirecTV (IP Control)                          │
│  - Cable Boxes (IR/CEC)                          │
│  - Matrix Switcher (Telnet)                      │
│  - Audio Processor (HTTP)                        │
└──────────────────────────────────────────────────┘
```

### Key File Locations

```bash
# Application
/home/ubuntu/Sports-Bar-TV-Controller/         # Main application directory

# Database
/home/ubuntu/sports-bar-data/production.db     # Production database
/home/ubuntu/sports-bar-data/production.db-wal # Write-ahead log
/home/ubuntu/sports-bar-data/production.db-shm # Shared memory

# Backups
/home/ubuntu/sports-bar-data/backups/          # Automated backups
/home/ubuntu/sports-bar-data/backups/latest.db.gz

# Logs
/home/ubuntu/.pm2/logs/sports-bar-tv-controller-out.log
/home/ubuntu/.pm2/logs/sports-bar-tv-controller-error.log

# Scripts
/home/ubuntu/sports-bar-data/backup-enhanced.sh
/home/ubuntu/Sports-Bar-TV-Controller/scripts/
```

### Network Ports

| Port | Service | Purpose |
|------|---------|---------|
| 3001 | HTTP | Web interface (production) |
| 3000 | HTTP | Web interface (development) |
| 5037 | ADB | Fire TV communication |
| 23 | Telnet | Matrix switcher control |
| 80 | HTTP | AtlasIED audio processor |

---

## Admin Interface Access

### Accessing Admin Panel

**URL:** `http://[server-ip]:3001/admin`

**Authentication:**
- System uses PIN-based authentication
- Default PIN setup during installation
- Change PIN after first login

### Admin Sections

**Available Admin Pages:**

1. **Dashboard** - `/admin`
   - System overview
   - Quick health check
   - Recent activity

2. **Device Management**
   - Fire TV: `/admin/firetv`
   - DirecTV: `/admin/directv`
   - IR Devices: `/admin/ir-devices`
   - CEC Devices: `/admin/cec-devices`

3. **Matrix Control** - `/admin/matrix`
   - Configure Wolf Pack matrix
   - View/edit input/output mappings
   - Test routing

4. **Audio Control** - `/admin/audio`
   - AtlasIED processor configuration
   - Zone management
   - Input level monitoring

5. **Channel Presets** - `/admin/channel-presets`
   - Create/edit presets
   - Assign to devices
   - Reorder presets

6. **User Management** - `/admin/users`
   - Add/remove users
   - Manage PINs
   - Set permissions

7. **System Health** - `/admin/health`
   - Device status monitoring
   - System diagnostics
   - Performance metrics

8. **Logs** - `/admin/logs`
   - View application logs
   - Command history
   - Error tracking

---

## Device Management

### Adding a Fire TV Device

**Prerequisites:**
- Fire TV connected to network
- ADB debugging enabled on Fire TV
- Know the Fire TV IP address

**Steps:**

1. **Enable ADB on Fire TV:**
   - Go to Settings → My Fire TV
   - Select About
   - Click on "Serial Number" 7 times (developer mode)
   - Go back → Developer Options
   - Enable "ADB Debugging"

2. **Find IP Address:**
   - Settings → My Fire TV → About → Network
   - Note the IP address (e.g., 192.168.1.50)

3. **Add Device in Admin Panel:**
   - Go to `/admin/firetv`
   - Click "Add Fire TV Device"
   - Fill in form:
     - **Name:** "TV 1 - Main Bar" (descriptive name)
     - **IP Address:** 192.168.1.50
     - **Port:** 5555 (default)
     - **Location:** "Main Bar" (optional)
   - Click "Add Device"

4. **Test Connection:**
   - Click "Test Connection" button
   - Should show "Connected" status
   - If fails, see troubleshooting section

5. **Configure Advanced Settings:**
   - **Restart on Failure:** Enable (recommended)
   - **Health Check Interval:** 60 seconds (default)
   - **Auto-reconnect:** Enable (recommended)

**Common Issues:**
- "Connection refused" - ADB not enabled
- "Host unreachable" - Wrong IP or network issue
- "Unauthorized" - Accept prompt on Fire TV screen

### Adding a DirecTV Device

**Prerequisites:**
- DirecTV receiver with network capability
- Know the receiver IP address
- Network control enabled

**Steps:**

1. **Enable Network Control on DirecTV:**
   - Press MENU on DirecTV remote
   - Go to Settings & Help → Settings → Whole-Home → External Device
   - Enable "External Access"
   - Note the IP address

2. **Add Device:**
   - Go to `/admin/directv`
   - Click "Add DirecTV Receiver"
   - Fill in form:
     - **Name:** "DirecTV - Dining Room"
     - **IP Address:** 192.168.1.75
     - **Port:** 8080 (default)
     - **Receiver ID:** (usually 0)
   - Click "Add Device"

3. **Test:**
   - Send channel change command
   - Verify DirecTV responds
   - Check status shows "Online"

### Adding IR Devices (Cable Boxes)

**Prerequisites:**
- Global Cache iTach IP2IR on network
- IR emitters placed on cable boxes
- Cable box powered on

**Steps:**

1. **Configure iTach:**
   - Find iTach IP address (check DHCP or use Global Cache app)
   - Set static IP if possible
   - Default ports: 1:1, 1:2, 1:3

2. **Add IR Device:**
   - Go to `/admin/ir-devices`
   - Click "Add IR Device"
   - Fill in form:
     - **Name:** "Cable Box 1"
     - **iTach IP:** 192.168.1.100
     - **Port:** 1:1
     - **Device Type:** Spectrum Cable Box
   - Click "Add Device"

3. **Learn IR Codes:**
   - Click "Learn IR Codes" button
   - For each command (Power, Ch+, Ch-, etc.):
     - Click "Start Learning"
     - Point physical remote at iTach
     - Press button on remote
     - System captures IR code
     - Save code
   - See IR_LEARNING_DEMO_SCRIPT.md for details

4. **Place IR Emitter:**
   - Position emitter 4-6 inches from cable box IR sensor
   - See IR_EMITTER_PLACEMENT_GUIDE.md
   - Test commands
   - Adjust placement if needed

**IR Learning Tips:**
- Use original remote for best results
- Learn in area with minimal IR interference
- Test each code after learning
- Keep backup of learned codes

### Adding CEC Devices (Cable Boxes)

**Note:** CEC is deprecated for Spectrum cable boxes (firmware disabled). Use IR control instead.

**For Compatible Devices (Xfinity/Comcast):**

1. **Connect Pulse-Eight CEC Adapter:**
   - USB to server
   - HDMI to cable box
   - Check adapter appears as `/dev/ttyACM*`

2. **Identify Device Path:**
   ```bash
   ls -l /dev/ttyACM*
   # Example output: /dev/ttyACM0
   ```

3. **Add CEC Device:**
   - Go to `/admin/cec-devices`
   - Click "Add CEC Device"
   - Fill in form:
     - **Name:** "Cable Box 2"
     - **Device Path:** /dev/ttyACM0
     - **CEC Address:** 1 (usually)
   - Click "Add Device"

4. **Test CEC Commands:**
   - Send power on/off
   - Try channel change
   - Verify cable box responds

### Device Health Monitoring

**Automated Health Checks:**

The system automatically monitors device health:
- Fire TV: ADB connection check every 60 seconds
- DirecTV: API ping every 60 seconds
- IR Devices: iTach connectivity check
- CEC: Device availability check

**Health Status:**
- 🟢 **Online** - Device responding normally
- 🟡 **Warning** - Intermittent issues detected
- 🔴 **Offline** - Device not responding

**View Health:**
- Dashboard shows health summary
- `/admin/health` for detailed view
- Click device for diagnostic info

**Auto-Recovery:**

System attempts automatic recovery:
1. Detects device offline
2. Waits for cooldown period (30 seconds)
3. Attempts reconnection
4. Retries up to 3 times
5. Logs failure if recovery unsuccessful
6. Alerts admin (if notifications configured)

---

## User Management

### User Types

1. **Admin** - Full system access
2. **Manager** - Limited admin access
3. **Bartender** - Basic device control only

### Adding Users

1. Go to `/admin/users`
2. Click "Add User"
3. Fill in details:
   - Username
   - Display Name
   - PIN (4-6 digits)
   - Role (Admin/Manager/Bartender)
4. Save

### Changing PINs

**Admin Changing User PIN:**
1. Go to `/admin/users`
2. Find user
3. Click "Change PIN"
4. Enter new PIN (4-6 digits)
5. Confirm

**User Changing Own PIN:**
1. Login with current PIN
2. Go to Profile (if available)
3. Change PIN option
4. Enter old PIN, then new PIN
5. Confirm

### Session Management

- Sessions expire after 24 hours of inactivity
- Force logout: Delete session from admin panel
- View active sessions: `/admin/sessions`

---

## Channel Presets

Channel presets provide one-tap access to common channels.

### Creating Channel Presets

1. **Navigate to Presets:**
   - Go to `/admin/channel-presets`

2. **Add New Preset:**
   - Click "Add Preset"
   - Fill in form:
     - **Channel Name:** ESPN
     - **Channel Number:** 206
     - **Network:** ESPN
     - **Logo URL:** (optional, for display)
     - **Category:** Sports (optional)
     - **Display Order:** 1 (lower = higher priority)
   - Save

3. **Assign to Devices:**
   - Presets can be global or device-specific
   - For device-specific: assign in device settings
   - Different channel numbers for different providers (Spectrum vs DirecTV)

### Organizing Presets

**Best Practices:**
- Put most-used channels first (ESPN, FS1, etc.)
- Group by category (News, Sports, Entertainment)
- Use consistent naming
- Include channel numbers in name (optional)

**Display Order:**
- Order 1-10: Top priority (always visible)
- Order 11-20: Secondary
- Order 21+: Scroll to see

### Provider-Specific Presets

**Example: ESPN on Different Providers**

| Provider | Channel | Preset Config |
|----------|---------|---------------|
| Spectrum | 206 | ESPN (206) |
| DirecTV | 206 | ESPN (206) |
| Comcast | 30 | ESPN (30) |

**Configuration:**
- Create presets per device type
- Or use device mapping table
- System auto-selects based on device

### Bulk Import

**CSV Import (Advanced):**

1. Prepare CSV:
   ```csv
   name,number,network,category,order
   ESPN,206,ESPN,Sports,1
   ESPN2,209,ESPN,Sports,2
   FS1,212,FOX Sports,Sports,3
   ```

2. Import via admin panel:
   - Go to `/admin/channel-presets`
   - Click "Import CSV"
   - Upload file
   - Review and confirm

---

## Matrix Routing Configuration

### Wolf Pack Matrix Setup

**Initial Configuration:**

1. **Access Matrix Admin:**
   - Go to `/admin/matrix`

2. **Add Matrix Processor:**
   - Click "Add Matrix"
   - Fill in form:
     - **Name:** "Main Matrix"
     - **IP Address:** 192.168.1.100
     - **Port:** 23
     - **Protocol:** TCP
     - **Type:** Wolf Pack
   - Save

3. **Configure Inputs:**
   - Define each input source:
     - Input 1: "Cable Box 1"
     - Input 2: "Cable Box 2"
     - Input 3: "Fire TV 1"
     - Input 4: "DirecTV"
     - etc.

4. **Configure Outputs:**
   - Define each output (TV):
     - Output 1: "TV 1 - Main Bar"
     - Output 2: "TV 2 - Dining"
     - Output 3: "TV 3 - Patio"
     - etc.

### Creating Routes

**Manual Routing:**
1. Select input source
2. Select output destination
3. Click "Route"
4. Verify TV switches

**Preset Routes:**

Create common routing scenarios:

1. **Game Day Setup:**
   - Cable Box 1 → Outputs 1-4
   - Cable Box 2 → Outputs 5-8
   - Fire TV → Outputs 9-12

2. **Save Preset:**
   - Name: "Game Day"
   - Save configuration
   - Apply with one click later

### Advanced Routing

**Multi-Output Routing:**
- Route one input to multiple outputs
- Use "Route to Multiple" option
- Select all target outputs
- Apply

**Scheduled Routing:**
- Automate route changes
- Create schedule in `/admin/scheduler`
- Set time and routing preset
- Enable schedule

---

## Audio Zone Management

### AtlasIED Configuration

**Initial Setup:**

1. **Add Audio Processor:**
   - Go to `/admin/audio`
   - Click "Add Processor"
   - Fill in:
     - **Name:** "Main Audio Processor"
     - **IP Address:** 192.168.1.110
     - **Port:** 80
     - **Model:** (select from list)
   - Save

2. **Configure Zones:**
   - Click "Configure Zones"
   - For each zone:
     - **Zone Name:** "Main Bar"
     - **Zone Number:** 1
     - **Input Source:** (audio source)
     - **Max Volume:** 85% (recommended)
     - **Default Volume:** 50%
   - Save

### Zone Control

**Volume Management:**
- Set global max volume (safety)
- Per-zone volume control
- Mute zones individually
- Link zones for synchronized control

**Audio Sources:**
- TV audio outputs
- Music streaming (Soundtrack)
- Background music
- Microphone inputs (for announcements)

### AI Gain Optimization

**Automated Audio Leveling:**

The system includes AI-powered audio optimization:

1. **Enable AI Gain Control:**
   - Go to `/admin/audio`
   - Enable "AI Gain Optimization"
   - Set optimization interval (default: 5 minutes)

2. **How It Works:**
   - Monitors audio input levels
   - Analyzes peak and average levels
   - Adjusts gain automatically
   - Prevents clipping and distortion

3. **Configure Parameters:**
   - **Target Level:** -20 dBFS (default)
   - **Max Gain:** +12 dB
   - **Min Gain:** -12 dB
   - **Response Time:** Fast/Medium/Slow

---

## System Health Monitoring

### Health Dashboard

**Access:** `/admin/health`

**Metrics Displayed:**
- Overall system health score (0-100)
- Devices online vs total
- Active issues count
- Network connectivity
- Database status
- Disk space usage
- Memory usage
- CPU usage

### Device Monitoring

**Per-Device Metrics:**
- Online/offline status
- Last seen timestamp
- Connection uptime
- Command success rate
- Error count (last 24h)
- Response time (latency)

**Alerts:**
- Device offline > 5 minutes
- Command failure rate > 10%
- Response time > 5 seconds
- Disk space < 10%
- Memory usage > 90%

### Viewing Logs

**Real-Time Logs:**
```bash
# Via SSH
pm2 logs sports-bar-tv-controller

# Via admin panel
Go to /admin/logs
```

**Log Levels:**
- **INFO** - Normal operations
- **DEBUG** - Detailed debugging info
- **WARN** - Warnings (non-critical)
- **ERROR** - Errors requiring attention

**Filtering Logs:**
- Filter by component: `[FIRETV]`, `[CEC]`, `[MATRIX]`
- Filter by date range
- Filter by log level
- Search by keyword

### Performance Monitoring

**Key Metrics:**

1. **Response Time:**
   - API endpoint response time
   - Device command execution time
   - Target: < 1 second for most operations

2. **Memory Usage:**
   - Node.js heap usage
   - System memory
   - Check for memory leaks
   - Target: < 512 MB

3. **Database Performance:**
   - Query execution time
   - Database size
   - WAL file size
   - Target: queries < 100ms

**Monitoring Tools:**

```bash
# PM2 monitoring
pm2 monit

# Memory analysis
./scripts/analyze-memory.sh

# Database size
du -h /home/ubuntu/sports-bar-data/production.db
```

---

## Backup and Recovery

### Automated Backups

**Backup Schedule:**
- Hourly incremental backups
- Daily full backups
- Weekly archives (retained 4 weeks)

**Backup Script:**
```bash
/home/ubuntu/sports-bar-data/backup-enhanced.sh
```

**Verify Backups:**
```bash
# List recent backups
ls -lht /home/ubuntu/sports-bar-data/backups/*.db.gz | head -5

# Check backup log
tail -50 /home/ubuntu/sports-bar-data/backup.log

# Verify latest backup integrity
gunzip -c /home/ubuntu/sports-bar-data/backups/latest.db.gz | \
  sqlite3 - "PRAGMA integrity_check;"
```

### Manual Backup

**Create Manual Backup:**
```bash
# Stop application
pm2 stop sports-bar-tv-controller

# Create backup
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/backups/manual_$(date +%Y%m%d_%H%M%S).db

# Compress
gzip /home/ubuntu/sports-bar-data/backups/manual_*.db

# Restart application
pm2 start sports-bar-tv-controller
```

### Restore from Backup

**Steps:**

1. **Stop Application:**
   ```bash
   pm2 stop sports-bar-tv-controller
   ```

2. **Backup Current Database:**
   ```bash
   cp /home/ubuntu/sports-bar-data/production.db \
      /home/ubuntu/sports-bar-data/production.db.before-restore
   ```

3. **Restore:**
   ```bash
   # List available backups
   ls -lht /home/ubuntu/sports-bar-data/backups/*.db.gz

   # Restore specific backup
   gunzip -c /home/ubuntu/sports-bar-data/backups/backup_YYYYMMDD_HHMMSS.db.gz > \
      /home/ubuntu/sports-bar-data/production.db
   ```

4. **Verify Integrity:**
   ```bash
   sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"
   ```

5. **Restart:**
   ```bash
   pm2 start sports-bar-tv-controller
   ```

6. **Verify:**
   - Check web interface loads
   - Verify devices appear
   - Test basic functionality

### Disaster Recovery

**Complete System Loss:**

See DISASTER_RECOVERY.md for full procedures.

**Quick Recovery Steps:**
1. Reinstall OS and dependencies
2. Clone application repository
3. Restore database from backup
4. Restore configuration files
5. Start application
6. Verify all devices

---

## Updating the System

### Application Updates

**Standard Update Process:**

1. **Check for Updates:**
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   git fetch origin
   git status
   ```

2. **Backup First:**
   ```bash
   # Create backup
   /home/ubuntu/sports-bar-data/backup-enhanced.sh
   ```

3. **Pull Updates:**
   ```bash
   git pull origin main
   ```

4. **Install Dependencies:**
   ```bash
   npm install
   ```

5. **Build Application:**
   ```bash
   npm run build
   ```

6. **Database Migrations (if needed):**
   ```bash
   npm run db:push
   ```

7. **Restart Application:**
   ```bash
   pm2 restart sports-bar-tv-controller
   ```

8. **Verify:**
   - Check logs: `pm2 logs sports-bar-tv-controller`
   - Test web interface
   - Verify devices working

### Automated Update Script

**Using Update Script:**
```bash
# Recommended method
./scripts/update.sh

# Script performs:
# 1. Backup
# 2. Pull updates
# 3. Install dependencies
# 4. Build
# 5. Migrate database
# 6. Restart
# 7. Verify health
```

### Rollback Procedure

**If Update Fails:**

1. **Stop Application:**
   ```bash
   pm2 stop sports-bar-tv-controller
   ```

2. **Revert Code:**
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   git log --oneline -5  # Find previous commit
   git reset --hard <commit-hash>
   ```

3. **Restore Database:**
   ```bash
   gunzip -c /home/ubuntu/sports-bar-data/backups/before-update.db.gz > \
      /home/ubuntu/sports-bar-data/production.db
   ```

4. **Rebuild:**
   ```bash
   npm run build
   pm2 restart sports-bar-tv-controller
   ```

### Update Schedule

**Recommended:**
- **Minor updates:** Monthly
- **Security patches:** As released
- **Major updates:** Quarterly (after testing)

**Best Practices:**
- Update during off-hours
- Test in staging environment first (if available)
- Have rollback plan ready
- Notify staff of planned downtime

---

## Log Management

### Log Types

1. **Application Logs:**
   - Location: `/home/ubuntu/.pm2/logs/`
   - Out: `sports-bar-tv-controller-out.log`
   - Error: `sports-bar-tv-controller-error.log`

2. **Database Logs:**
   - Enhanced logger stores logs in database
   - View via `/admin/logs`

3. **System Logs:**
   - PM2 system logs
   - OS logs: `/var/log/syslog`

### Log Rotation

**PM2 Log Rotation:**

Install module:
```bash
pm2 install pm2-logrotate
```

Configure:
```bash
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### Analyzing Logs

**Common Log Searches:**

```bash
# Find errors
grep -i error /home/ubuntu/.pm2/logs/sports-bar-tv-controller-error.log

# Find device connection issues
grep -i "connection failed" /home/ubuntu/.pm2/logs/*.log

# Find specific device logs
grep "\[FIRETV\]" /home/ubuntu/.pm2/logs/sports-bar-tv-controller-out.log

# Count errors by type
grep -i error /home/ubuntu/.pm2/logs/*.log | sort | uniq -c | sort -rn
```

### Database Log Queries

**Via Admin Panel:**
- Go to `/admin/logs`
- Use filters for component, level, date range

**Via SQL:**
```sql
-- Recent errors
SELECT * FROM logs
WHERE level = 'ERROR'
ORDER BY timestamp DESC
LIMIT 50;

-- Device-specific logs
SELECT * FROM logs
WHERE component = '[FIRETV]'
ORDER BY timestamp DESC
LIMIT 100;

-- Error summary
SELECT component, COUNT(*) as error_count
FROM logs
WHERE level = 'ERROR'
  AND timestamp > datetime('now', '-24 hours')
GROUP BY component
ORDER BY error_count DESC;
```

---

## Performance Optimization

### Database Optimization

**Regular Maintenance:**

```bash
# Checkpoint WAL
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "PRAGMA wal_checkpoint(TRUNCATE);"

# Optimize database
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA optimize;"

# Vacuum (reclaim space)
sqlite3 /home/ubuntu/sports-bar-data/production.db "VACUUM;"

# Analyze tables
sqlite3 /home/ubuntu/sports-bar-data/production.db "ANALYZE;"
```

**Schedule Maintenance:**

Add to crontab:
```bash
# Weekly maintenance (Sunday 3 AM)
0 3 * * 0 sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA optimize; VACUUM; ANALYZE;"
```

### Memory Optimization

**Monitor Memory:**
```bash
# Check current usage
pm2 show sports-bar-tv-controller

# Memory analysis
./scripts/analyze-memory.sh

# Check for leaks
node --inspect node_modules/.bin/next start
# Use Chrome DevTools for profiling
```

**If Memory Issues:**
- Restart PM2 process
- Review recent code changes
- Check for unclosed connections
- Monitor over time

### Application Performance

**Optimize:**

1. **Enable Caching:**
   - Static asset caching (Next.js handles this)
   - API response caching where appropriate

2. **Database Query Optimization:**
   - Add indexes for frequent queries
   - Use prepared statements
   - Limit result sets

3. **Network Optimization:**
   - Use connection pooling
   - Reduce API call frequency
   - Implement request batching

**Monitor Performance:**
```bash
# API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/api/health/database

# Database query performance
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA compile_options;"
```

---

## Security Management

### Network Security

**Best Practices:**
- Use firewall to restrict port access
- Keep system on isolated VLAN if possible
- Use strong WiFi passwords
- Disable UPnP on router

**Firewall Configuration:**
```bash
# Allow only local network access
sudo ufw allow from 192.168.1.0/24 to any port 3001
sudo ufw enable
```

### Authentication

**PIN Management:**
- Use strong PINs (6+ digits)
- Change default PINs immediately
- Rotate PINs quarterly
- Don't share PINs between users

**Session Security:**
- Sessions expire after 24 hours
- Force logout on suspicious activity
- Monitor active sessions

### Database Security

**Backup Encryption (Optional):**
```bash
# Encrypt backup
gpg --symmetric /home/ubuntu/sports-bar-data/backups/backup.db.gz

# Decrypt when needed
gpg /home/ubuntu/sports-bar-data/backups/backup.db.gz.gpg
```

**File Permissions:**
```bash
# Secure database
chmod 600 /home/ubuntu/sports-bar-data/production.db

# Secure backups
chmod 700 /home/ubuntu/sports-bar-data/backups
chmod 600 /home/ubuntu/sports-bar-data/backups/*.gz
```

### API Security

**Rate Limiting:**
- All API endpoints are rate-limited
- Default: 100 requests per minute per IP
- Adjust in `/src/lib/rate-limiting/rate-limiter.ts`

**Input Validation:**
- All inputs validated with Zod schemas
- SQL injection prevention (parameterized queries)
- XSS prevention (input sanitization)

### Update Security

**Keep System Updated:**
```bash
# System packages
sudo apt update && sudo apt upgrade

# Node.js packages
npm audit
npm audit fix

# Check for vulnerabilities
npm run audit
```

---

## Maintenance Checklist

### Daily Tasks

- [ ] Check system health dashboard
- [ ] Review error logs (if any)
- [ ] Verify all devices online
- [ ] Check disk space
- [ ] Verify backups completed

### Weekly Tasks

- [ ] Review full logs for patterns
- [ ] Check device connection stability
- [ ] Test backup restoration (sample)
- [ ] Update channel presets if needed
- [ ] Review user access logs

### Monthly Tasks

- [ ] Full system health audit
- [ ] Database optimization (VACUUM, ANALYZE)
- [ ] Update system packages
- [ ] Review and clean old logs
- [ ] Test disaster recovery procedures
- [ ] Update documentation

### Quarterly Tasks

- [ ] Change admin PINs
- [ ] Full system update (application)
- [ ] Hardware inspection
- [ ] Performance benchmarking
- [ ] Security audit
- [ ] Staff training review

---

## Support and Escalation

### Getting Help

**Documentation:**
- This guide (System Admin Guide)
- Troubleshooting Guide
- Device Configuration Guide
- Operations Playbook

**Community:**
- GitHub Issues (if open source)
- Project documentation
- Vendor support (hardware)

### Escalation Path

1. **Level 1:** Check documentation and troubleshooting guide
2. **Level 2:** Review logs and attempt remediation
3. **Level 3:** Restore from backup if needed
4. **Level 4:** Contact developer/integrator

### Emergency Procedures

See EMERGENCY_QUICK_REFERENCE.md for critical procedures.

---

**End of System Administrator Guide**

*For user-facing documentation, see BARTENDER_QUICK_START.md*
*For operational procedures, see OPERATIONS_PLAYBOOK.md*
*For troubleshooting, see TROUBLESHOOTING_GUIDE.md*
