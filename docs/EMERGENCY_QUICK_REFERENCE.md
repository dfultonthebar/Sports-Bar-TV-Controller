# 🚨 EMERGENCY QUICK REFERENCE

**Print this page and keep near the TV control station!**

Last Updated: November 6, 2025

---

## 📞 Emergency Contacts

| Issue | Contact | Phone |
|-------|---------|-------|
| **Technical Support** | System Admin | ____________ |
| **Manager on Duty** | Bar Manager | ____________ |
| **IT Support** | Tech Team | ____________ |
| **Hardware Vendor** | AV Company | ____________ |

---

## ⚡ CRITICAL: TV Won't Turn On

**If a TV won't turn on:**

1. **Check physical power**
   - Is TV plugged in?
   - Is power strip on?
   - Try TV's physical power button

2. **Check remote batteries**
   - Replace batteries in remote
   - Try different remote

3. **System restart**
   - Open TV Control app: http://[IP]:3001
   - Go to System Health
   - Click "Restart Fire TV Device"
   - Wait 2 minutes

4. **Last resort**
   - Unplug TV for 30 seconds
   - Plug back in
   - Power on with physical button

---

## 🔊 CRITICAL: No Audio

**If you can't hear audio:**

1. **Check volume**
   - Open Audio Control page
   - Check zone volume (should be 50-80%)
   - Unmute if needed

2. **Check audio routing**
   - Go to Matrix Control
   - Verify correct input selected
   - Check cable connections

3. **Check AtlasIED processor**
   - Look for red lights on processor
   - Try turning off/on problem zone
   - Wait 10 seconds, turn back on

4. **Emergency bypass**
   - Use TV's built-in speakers as backup
   - TV Menu → Audio → Internal Speakers: ON

---

## 📺 CRITICAL: Wrong Channel

**If TV showing wrong game:**

1. **Quick channel change**
   - Open Sports Guide
   - Find correct game
   - Click "Watch on TV #X"
   - Select correct TV
   - Click "Tune Now"

2. **Manual channel change**
   - Open Remote Control page
   - Select TV
   - Enter channel number (e.g., 206 for ESPN)
   - Click OK/Enter

3. **Provider issues**
   - If channel won't change: Check cable box
   - Look for error messages on screen
   - Restart cable box if needed

---

## 🌐 CRITICAL: Control App Not Loading

**If http://[IP]:3001 won't load:**

1. **Check your device**
   - Are you on the bar's WiFi?
   - Try different device (tablet, phone)
   - Close and reopen browser

2. **Check server**
   - Ask manager to check server computer
   - Look for green power light
   - Server should be running

3. **Use physical remotes**
   - As backup, use physical remotes
   - Located: [LOCATION]
   - Works independently of app

4. **Call technical support**
   - Contact: [PHONE]
   - Provide: What you tried, error messages

---

## 🎮 CRITICAL: Fire TV Device Frozen

**If streaming device is frozen/not responding:**

1. **Soft restart**
   - Open TV Control app
   - System Health page
   - Find frozen device (red status)
   - Click "Restart Device"
   - Wait 2 minutes

2. **Hard restart**
   - Unplug Fire TV stick
   - Wait 30 seconds
   - Plug back in
   - Wait for home screen (2-3 minutes)

3. **Check internet**
   - Other devices working?
   - If no internet, call ISP: [PHONE]

---

## 🔄 CRITICAL: System Completely Down

**If EVERYTHING is down (rare):**

1. **Restart server** (Manager only)
   - Go to server computer
   - Note: [LOCATION]
   - Open terminal/command prompt
   - Run: `pm2 restart sports-bar-tv-controller`
   - Wait 1 minute
   - Refresh browser

2. **If server won't restart**
   - Call technical support immediately
   - Use physical remotes as backup
   - Document what happened

---

## 📋 Troubleshooting Checklist

Before calling support, try these steps:

- [ ] Restarted affected device
- [ ] Checked physical connections (power, HDMI, network)
- [ ] Tested with different device/browser
- [ ] Checked if other TVs/devices working
- [ ] Noted any error messages
- [ ] Checked what time problem started
- [ ] Tried emergency backup (physical remotes)

---

## 🆘 When to Call Emergency Support

**Call immediately if:**
- Multiple TVs affected during major game
- Complete system failure
- Smoke/burning smell from equipment
- Electrical issues
- Customer safety concerns

**Can wait until tomorrow:**
- One TV having minor issues
- Slow response times
- Questions about features
- Training requests

---

## 🔧 Quick Server Information

| Item | Value |
|------|-------|
| **Server IP** | [FILL IN: 192.168.x.x] |
| **Control App URL** | http://[IP]:3001 |
| **Server Location** | [FILL IN: Back office] |
| **PM2 Command** | `pm2 restart sports-bar-tv-controller` |
| **Database Location** | /home/ubuntu/sports-bar-data/production.db |

---

## 🎯 Most Common Issues (90% of Problems)

1. **TV just needs power cycle** (30%)
2. **Volume muted or too low** (25%)
3. **Wrong input selected on TV** (20%)
4. **Fire TV needs restart** (15%)
5. **Someone changed channel manually** (10%)

---

## ✅ Daily Opening Checklist

**Every day before opening:**
- [ ] Open control app: http://[IP]:3001
- [ ] Click "Opening Routine" (or "Power On All")
- [ ] Verify all TVs show green status
- [ ] Check audio levels (50-80%)
- [ ] Set TVs to default channels
- [ ] Volume test (can you hear?)

---

## 🌙 Daily Closing Checklist

**Every night at close:**
- [ ] Click "Closing Routine" (or "Power Off All")
- [ ] Verify all devices powered down
- [ ] Check for any error messages
- [ ] Note any issues for next shift

---

## 📝 Incident Report Template

**If something goes wrong, document it:**

```
Date/Time: _______________
Problem: _________________
What I tried: ____________
Outcome: _________________
Who I called: ____________
```

Keep this log near the control station!

---

## 💡 Pro Tips

- **Keep physical remotes charged** - They're your backup!
- **Take photos of normal setup** - Easier to restore if changed
- **Label everything** - TVs, cables, devices
- **Print this guide** - Laminate and post near station
- **Train all staff** - Everyone should know basics

---

## 🔗 More Resources

For detailed troubleshooting:
- **Full Troubleshooting Guide:** docs/TROUBLESHOOTING_GUIDE.md
- **Bartender Quick Start:** docs/BARTENDER_QUICK_START.md
- **System Admin Guide:** docs/SYSTEM_ADMIN_GUIDE.md

---

# SYSTEM ADMIN EMERGENCY PROCEDURES

**For technical staff only - requires server access**

---

## Emergency System Commands

### Quick Diagnostics

```bash
# Application status
pm2 status

# Database integrity
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"

# Recent backups
ls -lth /home/ubuntu/sports-bar-data/backups/*.db.gz | head -5

# Disk space
df -h /home/ubuntu/sports-bar-data

# View recent logs
pm2 logs sports-bar-tv-controller --lines 50

# Test API
curl http://localhost:3001/api/health/database

# Check port
lsof -i :3001
```

---

## Emergency Procedure #1: Application Won't Start

```bash
# Restart application
pm2 restart sports-bar-tv-controller

# If that fails, rebuild
cd /home/ubuntu/Sports-Bar-TV-Controller
npm run build
pm2 restart sports-bar-tv-controller

# Check logs
pm2 logs sports-bar-tv-controller
```

**If database is corrupted, see Procedure #2**

---

## Emergency Procedure #2: Database Corrupted

```bash
# STOP APPLICATION FIRST
pm2 stop sports-bar-tv-controller

# Backup corrupted database
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/production.db.corrupted-$(date +%s)

# Restore from latest backup
gunzip -c /home/ubuntu/sports-bar-data/backups/latest.db.gz > \
   /home/ubuntu/sports-bar-data/production.db

# Verify integrity
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"

# Restart application
pm2 start sports-bar-tv-controller
```

**Data Loss: Up to 1 hour**

---

## Emergency Procedure #3: System After Power Loss

```bash
# Check if system recovered automatically
pm2 status

# If not running, start it
pm2 start sports-bar-tv-controller

# Check database integrity
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"

# If corrupted, see Procedure #2

# Check for large WAL file
ls -lh /home/ubuntu/sports-bar-data/production.db-wal

# Checkpoint if needed
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

---

## Emergency Procedure #4: Emergency Stop

```bash
# Stop everything immediately
pm2 stop all

# Checkpoint database
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Create emergency backup
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/backups/emergency/emergency_$(date +%Y%m%d_%H%M%S).db
```

---

## Emergency Procedure #5: Restore from Backup

```bash
# Stop application
pm2 stop sports-bar-tv-controller

# List available backups
ls -lth /home/ubuntu/sports-bar-data/backups/*.db.gz

# Choose backup and restore
gunzip -c /home/ubuntu/sports-bar-data/backups/backup_YYYYMMDD_HHMMSS.db.gz > \
   /home/ubuntu/sports-bar-data/production.db

# Restart
pm2 start sports-bar-tv-controller
```

---

## Important File Paths

```
Database:
  /home/ubuntu/sports-bar-data/production.db
  /home/ubuntu/sports-bar-data/production.db-wal

Backups:
  /home/ubuntu/sports-bar-data/backups/
  /home/ubuntu/sports-bar-data/backups/latest.db.gz

Logs:
  /home/ubuntu/.pm2/logs/sports-bar-tv-controller-error.log
  /home/ubuntu/.pm2/logs/sports-bar-tv-controller-out.log
  /home/ubuntu/sports-bar-data/backup.log

Scripts:
  /home/ubuntu/sports-bar-data/backup-enhanced.sh
  /home/ubuntu/sports-bar-data/emergency-db-recovery.sh
  /home/ubuntu/sports-bar-data/graceful-shutdown.sh
```

---

## Common Technical Issues

### "Database is locked"
```bash
# Check for stale lock
rm /home/ubuntu/sports-bar-data/production.db-shm

# Restart application
pm2 restart sports-bar-tv-controller
```

### "Port 3001 already in use"
```bash
# Find process using port
lsof -i :3001

# Kill it
kill -9 <PID>

# Restart application
pm2 restart sports-bar-tv-controller
```

### "Out of disk space"
```bash
# Check disk usage
df -h

# Clean up old logs
find /home/ubuntu/.pm2/logs -name "*.log" -mtime +7 -delete

# Clean up old backups
find /home/ubuntu/sports-bar-data/backups -name "backup_*.db.gz" -mtime +7 -delete

# Checkpoint WAL
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

---

## Verification Commands

### After Any Recovery

```bash
# 1. Check database integrity
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"
# Expected: ok

# 2. Check application is running
pm2 status
# Expected: online

# 3. Check API responds
curl http://localhost:3001/api/health/database
# Expected: {"healthy":true,...}

# 4. Check no errors in logs
pm2 logs sports-bar-tv-controller --lines 20

# 5. Check backup is scheduled
crontab -l | grep backup
# Expected: 0 * * * * /home/ubuntu/sports-bar-data/backup-enhanced.sh
```

---

## Recovery Time Estimates

| Scenario | Time | Data Loss |
|----------|------|-----------|
| Application restart | 30 sec | None |
| Database restore | 2 min | < 1 hour |
| Full system rebuild | 30-60 min | < 24 hours |

---

## When to Escalate

**Immediate escalation if:**
- Multiple restore attempts fail
- Data loss is unacceptable
- System won't start after 3 attempts
- Security incident suspected
- Hardware failure suspected

**Document before escalating:**
- What happened (timeline)
- What you tried
- Current error messages
- Relevant log excerpts

---

**This is an EMERGENCY reference. For non-urgent issues, see the full documentation.**

**Print this page and laminate it! Post near the TV control station.**

**Last Updated:** November 6, 2025
**Keep this document updated with your contact information!**
