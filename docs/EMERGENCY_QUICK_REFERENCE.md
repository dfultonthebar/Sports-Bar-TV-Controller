# Emergency Quick Reference Card

**Print this page and keep it accessible!**

---

## Emergency Contacts

```
System Admin: ___________________________
Phone:        ___________________________
Email:        ___________________________

UPS Support:  1-800-APC-HELP (APC)
Vendor:       ___________________________
```

---

## Quick Diagnostics

### Check System Status
```bash
# Application status
pm2 status

# Database integrity
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"

# Recent backups
ls -lth /home/ubuntu/sports-bar-data/backups/*.db.gz | head -5

# Disk space
df -h /home/ubuntu/sports-bar-data

# UPS status (if installed)
apcaccess status
```

### Check Application Health
```bash
# View recent logs
pm2 logs sports-bar-tv-controller --lines 50

# Test API
curl http://localhost:3001/api/health/database

# Check port
lsof -i :3001
```

---

## Emergency Procedures

### 1. Application Won't Start

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

**If database is corrupted, see #2 below**

### 2. Database Corrupted

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

### 3. System After Power Loss

```bash
# Check if system recovered automatically
pm2 status

# If not running, start it
pm2 start sports-bar-tv-controller

# Check database integrity
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"

# If corrupted, see #2 above

# Check for large WAL file
ls -lh /home/ubuntu/sports-bar-data/production.db-wal

# Checkpoint if needed
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

### 4. Emergency Stop

```bash
# Stop everything immediately
pm2 stop all

# Checkpoint database
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Create emergency backup
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/backups/emergency/emergency_$(date +%Y%m%d_%H%M%S).db
```

### 5. Restore from Backup

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

## Common Issues

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

## When to Call for Help

**Immediate escalation if:**
- Multiple restore attempts fail
- Data loss is unacceptable
- System won't start after 3 attempts
- Security incident suspected
- Hardware failure suspected

**Document before calling:**
- What happened (timeline)
- What you tried
- Current error messages
- Relevant log excerpts

---

## Recovery Time Estimates

| Scenario | Time | Data Loss |
|----------|------|-----------|
| Application restart | 30 sec | None |
| Database restore | 2 min | < 1 hour |
| Full system rebuild | 30-60 min | < 24 hours |

---

**Last Updated:** 2025-11-03
**Keep this document updated with your contact information!**
