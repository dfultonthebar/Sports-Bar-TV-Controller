# Database Protection System - Configuration Data Persistence

**Version:** 1.0  
**Implemented:** October 16, 2025  
**Status:** ✅ ACTIVE AND PROTECTING DATA

---

## 🚨 CRITICAL ISSUE RESOLVED

### The Problem
Configuration data (Wolfpack matrix, DirecTV boxes, Cable boxes, Audio processor settings) was being **LOST** every time the system was rebuilt, redeployed, or updated via git pull. This happened because:

1. **Database was in project directory** (`prisma/dev.db`)
2. **Git operations could overwrite it**
3. **Build processes could delete it**
4. **Prisma migrations could reset it**
5. **No backup system existed**

### The Solution
Implemented a **bulletproof, multi-layered protection system** that ensures configuration data **NEVER gets lost again**.

---

## 🛡️ Protection System Overview

### 1. Persistent Database Location
**Database moved OUTSIDE project directory:**
- **Old Location:** `/home/ubuntu/Sports-Bar-TV-Controller/prisma/dev.db` ❌
- **New Location:** `/home/ubuntu/sports-bar-data/production.db` ✅

**Why this matters:**
- Git operations cannot touch it
- Build processes cannot delete it
- Completely isolated from code changes
- Survives all deployment operations

### 2. Automatic Backup System
**Hourly automated backups via cron:**
- Runs every hour at minute 0
- Keeps last 30 backups automatically
- Timestamped filenames for easy identification
- Backup location: `/home/ubuntu/sports-bar-data/backups/`

**Backup naming format:**
```
backup_20251016_123524.db
backup_YYYYMMDD_HHMMSS.db
```

### 3. Pre-Deployment Protection
**Safe deployment script that ALWAYS backs up before changes:**
- Automatic backup before git pull
- Automatic backup before npm build
- Automatic backup before PM2 restart
- Never runs Prisma migrations automatically (protects data)

### 4. Easy Restore Mechanism
**One-command restore from any backup:**
```bash
/home/ubuntu/sports-bar-data/restore.sh backup_20251016_123524.db
```

---

## 📁 File Structure

```
/home/ubuntu/sports-bar-data/
├── production.db              # Main production database (PROTECTED)
├── backup.sh                  # Automatic backup script
├── restore.sh                 # Database restore script
├── safe-deploy.sh            # Safe deployment script
├── backup.log                # Backup operation logs
└── backups/                  # Backup storage directory
    ├── backup_20251016_123524.db
    ├── backup_20251016_133524.db
    ├── backup_20251016_143524.db
    └── ... (up to 30 backups)
```

---

## 🔧 Configuration Changes

### .env File Update
```bash
# Old (UNSAFE):
DATABASE_URL="file:./prisma/dev.db"

# New (PROTECTED):
DATABASE_URL="file:/home/ubuntu/sports-bar-data/production.db"
```

### .gitignore Protection
```
*.db
*.db-*
```
Ensures database files are NEVER committed to git.

---

## 📋 Usage Guide

### Daily Operations

#### Check Database Status
```bash
ls -lh /home/ubuntu/sports-bar-data/production.db
```

#### View Available Backups
```bash
ls -lht /home/ubuntu/sports-bar-data/backups/
```

#### Manual Backup (anytime)
```bash
/home/ubuntu/sports-bar-data/backup.sh
```

#### Restore from Backup
```bash
# List available backups
/home/ubuntu/sports-bar-data/restore.sh

# Restore specific backup
/home/ubuntu/sports-bar-data/restore.sh backup_20251016_123524.db

# Restart application after restore
pm2 restart sports-bar-tv
```

### Safe Deployment

**ALWAYS use the safe deployment script:**
```bash
/home/ubuntu/sports-bar-data/safe-deploy.sh
```

**What it does:**
1. ✅ Backs up database automatically
2. ✅ Pulls latest code from GitHub
3. ✅ Installs dependencies
4. ✅ Generates Prisma Client (NOT migrate!)
5. ✅ Builds application
6. ✅ Restarts PM2
7. ✅ Shows backup location

**What it NEVER does:**
- ❌ Run `prisma migrate` (protects existing data)
- ❌ Delete or overwrite database
- ❌ Touch the persistent data directory

### Emergency Recovery

**If data is lost (shouldn't happen, but just in case):**

1. **Stop the application:**
   ```bash
   pm2 stop sports-bar-tv
   ```

2. **List available backups:**
   ```bash
   ls -lht /home/ubuntu/sports-bar-data/backups/
   ```

3. **Restore from most recent backup:**
   ```bash
   /home/ubuntu/sports-bar-data/restore.sh backup_YYYYMMDD_HHMMSS.db
   ```

4. **Restart application:**
   ```bash
   pm2 restart sports-bar-tv
   ```

5. **Verify data is restored:**
   - Open web interface: http://24.123.87.42:3000
   - Check matrix configuration
   - Check DirecTV devices
   - Check audio processor settings

---

## 🔍 Monitoring & Logs

### Backup Logs
```bash
# View backup log
tail -f /home/ubuntu/sports-bar-data/backup.log

# Check recent backups
tail -20 /home/ubuntu/sports-bar-data/backup.log
```

### Cron Job Status
```bash
# View cron jobs
crontab -l

# Check cron execution
grep CRON /var/log/syslog | grep backup
```

### Application Logs
```bash
# Real-time logs
pm2 logs sports-bar-tv

# Check for database errors
pm2 logs sports-bar-tv | grep -i "database\|prisma"
```

---

## ⚠️ CRITICAL DO's and DON'Ts

### ✅ DO:
- **DO** use `/home/ubuntu/sports-bar-data/safe-deploy.sh` for deployments
- **DO** verify backups are running hourly
- **DO** keep the persistent data directory secure
- **DO** test restore process periodically
- **DO** check backup logs regularly

### ❌ DON'T:
- **DON'T** run `prisma migrate dev` in production (resets data!)
- **DON'T** run `prisma migrate reset` (destroys all data!)
- **DON'T** delete `/home/ubuntu/sports-bar-data/` directory
- **DON'T** move database back to project directory
- **DON'T** commit `.db` files to git
- **DON'T** run `git clean -fdx` (could delete backups if in wrong directory)

---

## 🔐 Security Considerations

### File Permissions
```bash
# Data directory
chmod 755 /home/ubuntu/sports-bar-data

# Database file
chmod 644 /home/ubuntu/sports-bar-data/production.db

# Scripts
chmod 755 /home/ubuntu/sports-bar-data/*.sh

# Backups directory
chmod 755 /home/ubuntu/sports-bar-data/backups
```

### Backup Retention
- **Automatic:** Last 30 backups kept
- **Manual:** Create additional backups before major changes
- **Offsite:** Consider periodic offsite backup for disaster recovery

---

## 🧪 Testing & Verification

### Test Backup System
```bash
# Create manual backup
/home/ubuntu/sports-bar-data/backup.sh

# Verify backup was created
ls -lht /home/ubuntu/sports-bar-data/backups/ | head -5

# Check backup log
tail -5 /home/ubuntu/sports-bar-data/backup.log
```

### Test Restore Process
```bash
# List backups
/home/ubuntu/sports-bar-data/restore.sh

# Restore from backup (creates safety backup first)
/home/ubuntu/sports-bar-data/restore.sh backup_20251016_123524.db

# Restart application
pm2 restart sports-bar-tv

# Verify data in web interface
```

### Test Safe Deployment
```bash
# Run safe deployment
/home/ubuntu/sports-bar-data/safe-deploy.sh

# Verify backup was created
ls -lht /home/ubuntu/sports-bar-data/backups/ | head -2

# Check application is running
pm2 status sports-bar-tv

# Verify data persists in web interface
```

---

## 📊 System Status

### Current Configuration
- **Database Location:** `/home/ubuntu/sports-bar-data/production.db`
- **Backup Directory:** `/home/ubuntu/sports-bar-data/backups/`
- **Backup Frequency:** Hourly (via cron)
- **Backup Retention:** Last 30 backups
- **Protection Status:** ✅ ACTIVE

### Verification Commands
```bash
# Check database exists
ls -lh /home/ubuntu/sports-bar-data/production.db

# Check backup count
ls -1 /home/ubuntu/sports-bar-data/backups/*.db | wc -l

# Check cron job
crontab -l | grep backup.sh

# Check application status
pm2 status sports-bar-tv

# Test database connection
cd /home/ubuntu/Sports-Bar-TV-Controller
npx prisma db pull
```

---

## 🆘 Troubleshooting

### Issue: Database file not found
**Solution:**
```bash
# Check if database exists
ls -lh /home/ubuntu/sports-bar-data/production.db

# If missing, restore from backup
/home/ubuntu/sports-bar-data/restore.sh backup_YYYYMMDD_HHMMSS.db
```

### Issue: Application won't start
**Solution:**
```bash
# Check logs
pm2 logs sports-bar-tv --lines 50

# Verify DATABASE_URL in .env
grep DATABASE_URL /home/ubuntu/Sports-Bar-TV-Controller/.env

# Should show: DATABASE_URL="file:/home/ubuntu/sports-bar-data/production.db"
```

### Issue: Backups not running
**Solution:**
```bash
# Check cron job exists
crontab -l | grep backup.sh

# Test backup script manually
/home/ubuntu/sports-bar-data/backup.sh

# Check backup log
tail -20 /home/ubuntu/sports-bar-data/backup.log
```

### Issue: Data lost after deployment
**Solution:**
```bash
# This should NEVER happen with the new system, but if it does:

# 1. Stop application
pm2 stop sports-bar-tv

# 2. Restore from most recent backup
/home/ubuntu/sports-bar-data/restore.sh backup_YYYYMMDD_HHMMSS.db

# 3. Restart application
pm2 restart sports-bar-tv

# 4. Investigate why protection failed
pm2 logs sports-bar-tv --lines 100
```

---

## 📝 Migration Notes

### What Changed
1. Database moved from `prisma/dev.db` to `/home/ubuntu/sports-bar-data/production.db`
2. `.env` file updated with new DATABASE_URL
3. Automatic backup system implemented
4. Safe deployment script created
5. Restore mechanism added
6. Hourly cron job configured

### Data Preservation
- All existing data was preserved during migration
- Pre-migration backup created: `pre-migration_backup_20251016_123524.db`
- No data loss occurred during implementation

### Rollback (if needed)
```bash
# Stop application
pm2 stop sports-bar-tv

# Restore pre-migration backup
cp /home/ubuntu/sports-bar-data/backups/pre-migration_backup_*.db \
   /home/ubuntu/sports-bar-data/production.db

# Restart application
pm2 restart sports-bar-tv
```

---

## 🎯 Success Criteria

### ✅ Protection System is Working When:
1. Database file exists at `/home/ubuntu/sports-bar-data/production.db`
2. Hourly backups are being created automatically
3. Safe deployment script runs without errors
4. Configuration data persists after git pull
5. Configuration data persists after npm build
6. Configuration data persists after PM2 restart
7. Restore process works correctly

### 🔍 Regular Checks (Weekly)
```bash
# 1. Verify backup count (should be ~168 per week, max 30 kept)
ls -1 /home/ubuntu/sports-bar-data/backups/*.db | wc -l

# 2. Check backup log for errors
tail -50 /home/ubuntu/sports-bar-data/backup.log | grep -i error

# 3. Verify cron job is running
grep CRON /var/log/syslog | grep backup | tail -5

# 4. Test restore process
/home/ubuntu/sports-bar-data/restore.sh  # List backups only
```

---

## 📞 Support

### For Issues:
1. Check this documentation first
2. Review application logs: `pm2 logs sports-bar-tv`
3. Check backup logs: `tail -50 /home/ubuntu/sports-bar-data/backup.log`
4. Verify cron job: `crontab -l`
5. Test database connection: `npx prisma db pull`

### Emergency Contact:
- **GitHub Issues:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues
- **Documentation:** This file and SYSTEM_DOCUMENTATION.md

---

## 🎉 Summary

**Your configuration data is now BULLETPROOF!**

✅ Database in persistent location (survives all operations)  
✅ Hourly automatic backups (last 30 kept)  
✅ Pre-deployment backup (before every change)  
✅ Easy restore mechanism (one command)  
✅ Safe deployment script (protects data)  
✅ Comprehensive logging (track everything)  
✅ Multiple layers of protection (defense in depth)

**This can't happen ever again!** ✨

---

*Last Updated: October 16, 2025*  
*Implementation Status: COMPLETE AND ACTIVE*  
*Protection Level: MAXIMUM*
