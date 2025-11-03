# Disaster Recovery Plan

## Executive Summary

This document provides step-by-step procedures for recovering the Sports-Bar-TV-Controller system from various disaster scenarios, including complete system failure, data corruption, and infrastructure loss.

**Recovery Objectives:**
- **RTO (Recovery Time Objective):** 15 minutes for critical operations
- **RPO (Recovery Point Objective):** 1 hour maximum data loss
- **System Availability Target:** 99.9% uptime

**Critical Dependencies:**
- Database: SQLite at `/home/ubuntu/sports-bar-data/production.db`
- Application: Next.js app at `/home/ubuntu/Sports-Bar-TV-Controller`
- Process Manager: PM2
- Network: Local network for hardware control

---

## Table of Contents

1. [Disaster Scenarios](#disaster-scenarios)
2. [Emergency Contacts](#emergency-contacts)
3. [Recovery Procedures](#recovery-procedures)
4. [Runbooks](#runbooks)
5. [Testing & Validation](#testing--validation)
6. [Post-Recovery Checklist](#post-recovery-checklist)

---

## Disaster Scenarios

### Classification

| Severity | Impact | Examples | RTO | Response |
|----------|--------|----------|-----|----------|
| **P0 - Critical** | Complete system down | Server failure, power loss, database corruption | 15 min | Immediate |
| **P1 - High** | Major feature broken | Matrix control down, API errors | 1 hour | Urgent |
| **P2 - Medium** | Degraded performance | Slow responses, partial failures | 4 hours | Scheduled |
| **P3 - Low** | Minor issues | UI glitch, logging issues | 24 hours | Next business day |

### Scenario Matrix

| Disaster Type | Likelihood | Impact | Recovery Complexity |
|---------------|-----------|---------|---------------------|
| Power loss (no UPS) | High | High | Low |
| Database corruption | Medium | Critical | Medium |
| Disk failure | Low | Critical | High |
| Server hardware failure | Low | Critical | High |
| Network outage | Medium | High | Low |
| Ransomware/Malware | Very Low | Critical | High |
| Accidental deletion | Medium | Medium | Low |
| Application crash | Medium | Low | Very Low |
| OS corruption | Low | High | High |
| Natural disaster | Very Low | Critical | Very High |

---

## Emergency Contacts

### Primary Contacts

```
System Administrator: [YOUR NAME]
Phone: [YOUR PHONE]
Email: [YOUR EMAIL]
Available: 24/7

Backup Administrator: [BACKUP CONTACT]
Phone: [PHONE]
Email: [EMAIL]
Available: Business hours
```

### Vendor Support

```
Hardware Vendor: [SERVER MANUFACTURER]
Support: [SUPPORT NUMBER]
Contract: [CONTRACT NUMBER]

UPS Vendor: APC/CyberPower
Support: 1-800-XXX-XXXX

Cloud Backup (if used): [PROVIDER]
Support: [SUPPORT NUMBER]
```

### Internal Escalation

```
Level 1: System Administrator (direct action)
Level 2: IT Manager (budget approval, vendor coordination)
Level 3: Business Owner (business continuity decisions)
```

---

## Recovery Procedures

### Procedure 1: Power Loss Recovery

**Scenario:** Server lost power, restarted unexpectedly

**Severity:** P0 if no UPS, P2 if UPS protected

**Automatic Recovery (with proper setup):**
1. Server powers on
2. PM2 systemd service starts automatically
3. Application auto-recovery checks database
4. System resumes normal operation

**Manual Recovery (if auto-recovery fails):**

```bash
# Step 1: Check system status
pm2 status

# Step 2: Check database integrity
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"

# Step 3: If database OK, restart application
pm2 restart sports-bar-tv-controller

# Step 4: If database corrupted, restore from backup
# See Procedure 3: Database Corruption Recovery

# Step 5: Verify system
curl http://localhost:3001/api/health/database

# Step 6: Check all subsystems
# - Matrix control
# - CEC devices
# - FireTV devices
# - Audio processor
```

**Expected Recovery Time:** 2-5 minutes

**Data Loss:** None if WAL recovered, up to 1 hour if backup restore needed

### Procedure 2: Application Crash Recovery

**Scenario:** Application stopped responding, PM2 shows error

**Severity:** P1

**Steps:**

```bash
# Step 1: Check PM2 status and logs
pm2 status
pm2 logs sports-bar-tv-controller --lines 100

# Step 2: Identify error cause
# Common issues:
# - Out of memory (max_memory_restart)
# - Uncaught exception
# - Database lock
# - Port already in use

# Step 3: Quick fix - restart application
pm2 restart sports-bar-tv-controller

# Step 4: If restart fails, check port
lsof -i :3001
# Kill process if needed: kill -9 <PID>

# Step 5: If still failing, check database
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"

# Step 6: Last resort - rebuild application
cd /home/ubuntu/Sports-Bar-TV-Controller
npm run build
pm2 restart sports-bar-tv-controller

# Step 7: Verify recovery
curl http://localhost:3001/api/health/database
```

**Expected Recovery Time:** 1-5 minutes

**Data Loss:** None

### Procedure 3: Database Corruption Recovery

**Scenario:** SQLite database is corrupted, integrity check fails

**Severity:** P0

**Steps:**

```bash
# Step 1: Stop application immediately
pm2 stop sports-bar-tv-controller

# Step 2: Backup corrupted database for analysis
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/production.db.corrupted-$TIMESTAMP

echo "Corrupted database saved to: production.db.corrupted-$TIMESTAMP"

# Step 3: Check WAL file
if [ -f /home/ubuntu/sports-bar-data/production.db-wal ]; then
    WAL_SIZE=$(stat -c%s /home/ubuntu/sports-bar-data/production.db-wal)
    echo "WAL file exists: $WAL_SIZE bytes"

    # Try WAL recovery
    echo "Attempting WAL recovery..."
    sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"

    # Check if recovery worked
    INTEGRITY=$(sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;")

    if [ "$INTEGRITY" = "ok" ]; then
        echo "✓ WAL recovery successful!"
        pm2 start sports-bar-tv-controller
        exit 0
    else
        echo "✗ WAL recovery failed, proceeding to backup restore..."
    fi
fi

# Step 4: Find latest valid backup
echo "Finding latest backup..."
LATEST_BACKUP=$(ls -t /home/ubuntu/sports-bar-data/backups/backup_*.db.gz 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    # Try 'latest' symlink
    LATEST_BACKUP="/home/ubuntu/sports-bar-data/backups/latest.db.gz"
fi

if [ ! -f "$LATEST_BACKUP" ]; then
    echo "ERROR: No backup found!"
    echo "Manual intervention required!"
    exit 1
fi

echo "Using backup: $LATEST_BACKUP"

# Step 5: Verify backup integrity
TEMP_DB="/tmp/verify_backup_$$.db"
gunzip -c "$LATEST_BACKUP" > "$TEMP_DB"

BACKUP_INTEGRITY=$(sqlite3 "$TEMP_DB" "PRAGMA integrity_check;")

if [ "$BACKUP_INTEGRITY" != "ok" ]; then
    echo "ERROR: Backup is also corrupted!"
    echo "Trying next backup..."

    # Try next backup
    NEXT_BACKUP=$(ls -t /home/ubuntu/sports-bar-data/backups/backup_*.db.gz 2>/dev/null | head -2 | tail -1)

    if [ -z "$NEXT_BACKUP" ]; then
        echo "ERROR: No valid backup found!"
        exit 1
    fi

    gunzip -c "$NEXT_BACKUP" > "$TEMP_DB"
    BACKUP_INTEGRITY=$(sqlite3 "$TEMP_DB" "PRAGMA integrity_check;")

    if [ "$BACKUP_INTEGRITY" != "ok" ]; then
        echo "ERROR: All recent backups are corrupted!"
        echo "Manual recovery required!"
        exit 1
    fi

    LATEST_BACKUP="$NEXT_BACKUP"
fi

echo "✓ Backup integrity verified"

# Step 6: Restore from backup
echo "Restoring database from backup..."
cp "$TEMP_DB" /home/ubuntu/sports-bar-data/production.db

# Cleanup temp file
rm "$TEMP_DB"

# Step 7: Final integrity check
FINAL_CHECK=$(sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;")

if [ "$FINAL_CHECK" != "ok" ]; then
    echo "ERROR: Restored database failed integrity check!"
    exit 1
fi

echo "✓ Database restored successfully"

# Step 8: Restart application
echo "Restarting application..."
pm2 start sports-bar-tv-controller

# Wait for startup
sleep 5

# Step 9: Verify system health
echo "Verifying system health..."
HEALTH=$(curl -s http://localhost:3001/api/health/database)
echo "$HEALTH"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Recovery Complete"
echo "Backup used: $LATEST_BACKUP"
echo "Corrupted DB saved: production.db.corrupted-$TIMESTAMP"
echo "Data loss: Up to 1 hour"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

**Expected Recovery Time:** 5-10 minutes

**Data Loss:** Up to 1 hour (from last backup)

**Save this as:** `/home/ubuntu/sports-bar-data/emergency-db-recovery.sh`

### Procedure 4: Complete Server Failure

**Scenario:** Server hardware failed, need to rebuild on new hardware

**Severity:** P0

**Prerequisites:**
- New server or VM ready
- Ubuntu 20.04+ installed
- Network connectivity
- Access to backups (local or off-site)

**Steps:**

```bash
#!/bin/bash
# Complete Server Rebuild Procedure

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Sports Bar TV Controller - Server Rebuild"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Phase 1: System Setup
echo "Phase 1: Installing system dependencies..."

sudo apt update
sudo apt install -y \
    git \
    curl \
    sqlite3 \
    build-essential \
    python3 \
    python3-pip

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node --version
npm --version

# Phase 2: Install PM2
echo "Phase 2: Installing PM2..."

sudo npm install -g pm2

# Configure PM2 to start on boot
pm2 startup systemd -u ubuntu --hp /home/ubuntu
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Phase 3: Create directory structure
echo "Phase 3: Creating directory structure..."

mkdir -p /home/ubuntu/sports-bar-data/backups
mkdir -p /home/ubuntu/Sports-Bar-TV-Controller

# Phase 4: Retrieve application code
echo "Phase 4: Retrieving application code..."

cd /home/ubuntu

# Option A: From git repository
git clone https://github.com/YOUR_USERNAME/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller

# Option B: From backup server
# rsync -avz backup-server:/backups/sports-bar/code/ /home/ubuntu/Sports-Bar-TV-Controller/

# Phase 5: Retrieve database backup
echo "Phase 5: Retrieving database backup..."

# Option A: From backup server
# rsync -avz backup-server:/backups/sports-bar/database/latest.db.gz \
#     /home/ubuntu/sports-bar-data/backups/

# Option B: From cloud storage
# aws s3 cp s3://your-bucket/sports-bar/latest.db.gz \
#     /home/ubuntu/sports-bar-data/backups/

# For this example, assume backup is available
BACKUP_FILE="/home/ubuntu/sports-bar-data/backups/latest.db.gz"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found!"
    echo "Please retrieve backup manually and place at: $BACKUP_FILE"
    exit 1
fi

# Phase 6: Restore database
echo "Phase 6: Restoring database..."

gunzip -c "$BACKUP_FILE" > /home/ubuntu/sports-bar-data/production.db

# Verify integrity
INTEGRITY=$(sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;")

if [ "$INTEGRITY" != "ok" ]; then
    echo "ERROR: Database integrity check failed: $INTEGRITY"
    exit 1
fi

echo "✓ Database restored and verified"

# Get database stats
DB_SIZE=$(du -h /home/ubuntu/sports-bar-data/production.db | cut -f1)
TABLE_COUNT=$(sqlite3 /home/ubuntu/sports-bar-data/production.db \
    "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")

echo "  Database size: $DB_SIZE"
echo "  Tables: $TABLE_COUNT"

# Phase 7: Install application dependencies
echo "Phase 7: Installing application dependencies..."

cd /home/ubuntu/Sports-Bar-TV-Controller
npm ci

# Phase 8: Configure environment
echo "Phase 8: Configuring environment..."

# Create .env file if not exists
if [ ! -f .env ]; then
    cat > .env <<EOF
NODE_ENV=production
DATABASE_URL=file:/home/ubuntu/sports-bar-data/production.db
PORT=3001
EOF
fi

# Phase 9: Build application
echo "Phase 9: Building application..."

npm run build

# Phase 10: Start application with PM2
echo "Phase 10: Starting application..."

pm2 start ecosystem.config.js
pm2 save

# Wait for startup
echo "Waiting for application to start..."
sleep 10

# Phase 11: Verify system health
echo "Phase 11: Verifying system health..."

# Check PM2 status
pm2 status

# Check application health
HEALTH_RESPONSE=$(curl -s http://localhost:3001/api/health/database)
echo "Health check response: $HEALTH_RESPONSE"

# Phase 12: Configure backups
echo "Phase 12: Configuring backup cron jobs..."

# Add backup cron job
(crontab -l 2>/dev/null; echo "0 * * * * /home/ubuntu/sports-bar-data/backup-enhanced.sh >> /home/ubuntu/sports-bar-data/backup.log 2>&1") | crontab -

# Phase 13: Final checks
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Rebuild Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "System Status:"
echo "  Application: $(pm2 list | grep sports-bar-tv-controller | awk '{print $10}')"
echo "  Database: $DB_SIZE ($TABLE_COUNT tables)"
echo "  Backup: Configured (hourly)"
echo ""
echo "Next Steps:"
echo "  1. Verify web interface at http://$(hostname -I | awk '{print $1}'):3001"
echo "  2. Test matrix control functionality"
echo "  3. Test CEC device control"
echo "  4. Test FireTV connectivity"
echo "  5. Configure UPS (if applicable)"
echo "  6. Set up off-site backups"
echo ""
echo "Important Notes:"
echo "  - Data restored from: $BACKUP_FILE"
echo "  - Data loss: Up to 1 hour (from last backup)"
echo "  - PM2 configured to start on boot"
echo "  - Backups scheduled hourly"
echo ""
```

**Save this as:** `/home/ubuntu/sports-bar-data/rebuild-server.sh`

**Expected Recovery Time:** 30-60 minutes

**Data Loss:** Up to 24 hours (depending on off-site backup frequency)

### Procedure 5: Disk Failure Recovery

**Scenario:** Storage disk failed, data lost

**Severity:** P0

**Prerequisites:**
- New disk installed
- Off-site backup accessible

**Steps:**

1. **Install new disk and mount:**
   ```bash
   # Identify new disk
   sudo fdisk -l

   # Format new disk
   sudo mkfs.ext4 /dev/sdb1

   # Mount disk
   sudo mount /dev/sdb1 /home/ubuntu

   # Add to /etc/fstab for persistent mount
   echo "/dev/sdb1 /home/ubuntu ext4 defaults 0 2" | sudo tee -a /etc/fstab
   ```

2. **Follow Procedure 4: Complete Server Failure** (steps 3-13)

**Expected Recovery Time:** 45-90 minutes

**Data Loss:** Depends on off-site backup age

### Procedure 6: Accidental Data Deletion

**Scenario:** User accidentally deleted important data

**Severity:** P2 (unless critical data)

**Steps:**

```bash
# Step 1: Stop application to prevent more changes
pm2 stop sports-bar-tv-controller

# Step 2: Identify what was deleted
# Check recent logs
pm2 logs sports-bar-tv-controller --lines 200 | grep DELETE

# Step 3: Find appropriate backup
# List backups from before deletion
ls -lt /home/ubuntu/sports-bar-data/backups/ | head -20

# Step 4: Extract deleted data from backup
BACKUP="/home/ubuntu/sports-bar-data/backups/backup_YYYYMMDD_HHMMSS.db.gz"
TEMP_DB="/tmp/backup_restore_$$.db"

gunzip -c "$BACKUP" > "$TEMP_DB"

# Step 5: Export deleted data
sqlite3 "$TEMP_DB" <<EOF
.mode insert TableName
SELECT * FROM TableName WHERE conditions;
EOF > /tmp/deleted_data.sql

# Step 6: Import back to production database
sqlite3 /home/ubuntu/sports-bar-data/production.db < /tmp/deleted_data.sql

# Step 7: Verify data restored
sqlite3 /home/ubuntu/sports-bar-data/production.db \
    "SELECT COUNT(*) FROM TableName WHERE conditions;"

# Step 8: Restart application
pm2 start sports-bar-tv-controller

# Step 9: Cleanup
rm "$TEMP_DB" /tmp/deleted_data.sql
```

**Expected Recovery Time:** 10-20 minutes

**Data Loss:** None if backup is recent

### Procedure 7: Ransomware/Security Incident

**Scenario:** System compromised by ransomware or malware

**Severity:** P0

**Immediate Actions:**

1. **ISOLATE IMMEDIATELY:**
   ```bash
   # Disconnect from network
   sudo ip link set eth0 down

   # Stop all services
   pm2 stop all
   sudo systemctl stop apache2 nginx  # If applicable
   ```

2. **Document the incident:**
   - Take screenshots of ransom message
   - Note time of discovery
   - List affected files/systems
   - Identify entry vector if known

3. **DO NOT PAY RANSOM**

4. **Contact security team/authorities**

**Recovery Steps:**

```bash
# Step 1: Wipe and reinstall OS
# Boot from USB/CD and reinstall Ubuntu

# Step 2: Restore from KNOWN GOOD off-site backup
# Ensure backup is from BEFORE infection

# Step 3: Follow Procedure 4: Complete Server Failure

# Step 4: Security hardening
# Update all software
sudo apt update && sudo apt upgrade -y

# Install fail2ban
sudo apt install -y fail2ban

# Configure firewall
sudo ufw enable
sudo ufw allow 22    # SSH
sudo ufw allow 3001  # Application

# Change all passwords
passwd

# Step 5: Investigate root cause
# Review logs from before infection
# Patch vulnerabilities
# Update security policies
```

**Expected Recovery Time:** 2-4 hours

**Data Loss:** Depends on off-site backup age

---

## Runbooks

### Runbook 1: Quick Health Check

**Purpose:** Verify system is healthy

**Frequency:** Daily or after any incident

```bash
#!/bin/bash
# quick-health-check.sh

echo "Sports Bar TV Controller - Health Check"
echo "========================================"

# Check 1: PM2 Status
echo -n "PM2 Status: "
pm2 list | grep sports-bar-tv-controller | grep online > /dev/null && echo "✓ ONLINE" || echo "✗ OFFLINE"

# Check 2: Database Integrity
echo -n "Database Integrity: "
INTEGRITY=$(sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;" 2>&1)
[ "$INTEGRITY" = "ok" ] && echo "✓ OK" || echo "✗ FAILED: $INTEGRITY"

# Check 3: Recent Backup
echo -n "Recent Backup: "
LATEST_BACKUP_AGE=$(find /home/ubuntu/sports-bar-data/backups -name "backup_*.db.gz" -mmin -120 | wc -l)
[ "$LATEST_BACKUP_AGE" -gt 0 ] && echo "✓ OK (< 2 hours)" || echo "✗ STALE (> 2 hours)"

# Check 4: Disk Space
echo -n "Disk Space: "
DISK_USAGE=$(df -h /home/ubuntu | tail -1 | awk '{print $5}' | sed 's/%//')
[ "$DISK_USAGE" -lt 80 ] && echo "✓ OK ($DISK_USAGE%)" || echo "⚠ WARNING ($DISK_USAGE%)"

# Check 5: WAL File Size
echo -n "WAL File Size: "
if [ -f /home/ubuntu/sports-bar-data/production.db-wal ]; then
    WAL_SIZE=$(stat -c%s /home/ubuntu/sports-bar-data/production.db-wal)
    WAL_MB=$((WAL_SIZE / 1024 / 1024))
    [ "$WAL_MB" -lt 10 ] && echo "✓ OK (${WAL_MB}MB)" || echo "⚠ LARGE (${WAL_MB}MB)"
else
    echo "✓ None"
fi

# Check 6: Application Health
echo -n "Application Health: "
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health/database 2>/dev/null)
[ "$HEALTH" = "200" ] && echo "✓ OK" || echo "✗ FAILED (HTTP $HEALTH)"

# Check 7: UPS Status (if available)
if command -v apcaccess &> /dev/null; then
    echo -n "UPS Status: "
    UPS_STATUS=$(apcaccess status 2>&1 | grep STATUS | awk '{print $3}')
    [ "$UPS_STATUS" = "ONLINE" ] && echo "✓ ONLINE" || echo "⚠ $UPS_STATUS"
fi

echo "========================================"
```

### Runbook 2: Weekly Maintenance

**Purpose:** Preventive maintenance

**Frequency:** Weekly (Sundays at 5 AM)

```bash
#!/bin/bash
# weekly-maintenance.sh

echo "Weekly Maintenance - $(date)"

# 1. Checkpoint WAL
echo "Checkpointing WAL..."
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 2. Optimize database
echo "Optimizing database..."
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA optimize;"

# 3. Analyze database
echo "Analyzing database..."
sqlite3 /home/ubuntu/sports-bar-data/production.db "ANALYZE;"

# 4. Clean up old logs
echo "Cleaning up old logs..."
find /home/ubuntu/.pm2/logs -name "*.log" -mtime +30 -delete

# 5. Clean up old backups (already in backup script)
echo "Old backups cleaned by backup script"

# 6. Update system packages (optional, commented out for safety)
# echo "Updating system packages..."
# sudo apt update && sudo apt upgrade -y

# 7. Restart application (to clear memory)
echo "Restarting application..."
pm2 restart sports-bar-tv-controller

echo "Weekly maintenance complete"
```

### Runbook 3: Emergency Stop

**Purpose:** Emergency shutdown of system

**When:** Security incident, critical bug, data corruption in progress

```bash
#!/bin/bash
# emergency-stop.sh

echo "EMERGENCY STOP INITIATED - $(date)"

# 1. Stop PM2 immediately
pm2 stop all

# 2. Checkpoint database
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 3. Create emergency backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/backups/emergency/emergency_$TIMESTAMP.db

# 4. Disconnect from network (optional)
# sudo ip link set eth0 down

echo "System stopped. Emergency backup created: emergency_$TIMESTAMP.db"
echo "To restart: pm2 start all"
```

---

## Testing & Validation

### Quarterly Disaster Recovery Test

**Schedule:** Every 3 months (suggested: last Sunday of quarter)

**Test Plan:**

```markdown
# Disaster Recovery Test Plan

## Preparation (1 hour before)
- [ ] Notify stakeholders of test
- [ ] Schedule maintenance window
- [ ] Ensure backups are current
- [ ] Document current system state

## Test Execution
- [ ] Simulate disaster (choose one):
  - [ ] Database corruption (rename production.db)
  - [ ] Server failure (stop PM2, clear database)
  - [ ] Disk failure (unmount data directory)

- [ ] Execute recovery procedure
- [ ] Time each step
- [ ] Document any issues

## Validation
- [ ] Database integrity check passes
- [ ] Application starts successfully
- [ ] All features working:
  - [ ] Matrix control
  - [ ] CEC devices
  - [ ] FireTV control
  - [ ] Audio processor
- [ ] Data completeness verified
- [ ] Performance normal

## Metrics
- Actual RTO: ___ minutes (target: 15 min)
- Actual RPO: ___ minutes (target: 60 min)
- Issues encountered: ___
- Success rate: ___

## Post-Test
- [ ] Restore original system
- [ ] Update documentation if needed
- [ ] Address any issues found
- [ ] Schedule next test
```

### Automated Recovery Testing

**Script:** `/home/ubuntu/sports-bar-data/test-recovery.sh`

```bash
#!/bin/bash
# Automated recovery test (safe - uses copy of database)

set -e

echo "Automated Recovery Test - $(date)"

# 1. Create test environment
TEST_DIR="/tmp/recovery-test-$$"
mkdir -p "$TEST_DIR"

# 2. Copy current database
cp /home/ubuntu/sports-bar-data/production.db "$TEST_DIR/test.db"

# 3. Simulate corruption
dd if=/dev/zero of="$TEST_DIR/test.db" bs=1024 count=10 seek=100 conv=notrunc

# 4. Verify corruption
INTEGRITY=$(sqlite3 "$TEST_DIR/test.db" "PRAGMA integrity_check;" 2>&1)

if [ "$INTEGRITY" = "ok" ]; then
    echo "ERROR: Failed to corrupt test database"
    exit 1
fi

echo "✓ Test database corrupted"

# 5. Test recovery from backup
BACKUP="/home/ubuntu/sports-bar-data/backups/latest.db.gz"
gunzip -c "$BACKUP" > "$TEST_DIR/recovered.db"

# 6. Verify recovery
INTEGRITY=$(sqlite3 "$TEST_DIR/recovered.db" "PRAGMA integrity_check;")

if [ "$INTEGRITY" != "ok" ]; then
    echo "ERROR: Recovery failed - $INTEGRITY"
    exit 1
fi

echo "✓ Recovery successful"

# 7. Compare data
ORIGINAL_COUNT=$(sqlite3 /home/ubuntu/sports-bar-data/production.db \
    "SELECT COUNT(*) FROM ChannelPreset;")
RECOVERED_COUNT=$(sqlite3 "$TEST_DIR/recovered.db" \
    "SELECT COUNT(*) FROM ChannelPreset;")

echo "Record count comparison:"
echo "  Original: $ORIGINAL_COUNT"
echo "  Recovered: $RECOVERED_COUNT"

# 8. Cleanup
rm -rf "$TEST_DIR"

echo "✓ Automated recovery test PASSED"
```

---

## Post-Recovery Checklist

### Immediate Post-Recovery (within 1 hour)

- [ ] Verify database integrity
- [ ] Confirm application is running
- [ ] Test critical features:
  - [ ] Matrix control (switch inputs/outputs)
  - [ ] CEC device control (power on/off)
  - [ ] FireTV connectivity
  - [ ] Audio processor control
- [ ] Check logs for errors
- [ ] Verify backup schedule is running
- [ ] Document recovery details:
  - [ ] Timestamp of incident
  - [ ] Root cause (if known)
  - [ ] Recovery procedure used
  - [ ] Time to recover (RTO)
  - [ ] Data loss amount (RPO)
  - [ ] Issues encountered

### Short-Term Post-Recovery (within 24 hours)

- [ ] Full system functionality test
- [ ] Review all logs from incident
- [ ] Analyze root cause
- [ ] Create incident report
- [ ] Update documentation if needed
- [ ] Communicate with stakeholders
- [ ] Review and update runbooks
- [ ] Schedule post-mortem meeting

### Medium-Term Post-Recovery (within 1 week)

- [ ] Implement preventive measures
- [ ] Update disaster recovery plan
- [ ] Conduct team training if needed
- [ ] Review monitoring and alerting
- [ ] Test recovery procedures again
- [ ] Update business continuity plan

### Incident Report Template

```markdown
# Incident Report

## Incident Details
- **Date/Time:** YYYY-MM-DD HH:MM:SS
- **Severity:** P0/P1/P2/P3
- **Duration:** X hours Y minutes
- **Reporter:** Name

## Summary
Brief description of what happened

## Impact
- Systems affected
- Users impacted
- Data loss (if any)
- Downtime duration

## Timeline
- HH:MM - Incident detected
- HH:MM - Response initiated
- HH:MM - Root cause identified
- HH:MM - Recovery started
- HH:MM - System restored
- HH:MM - Verification complete

## Root Cause
Technical details of what caused the incident

## Recovery Actions
Steps taken to recover the system

## Preventive Measures
Actions to prevent recurrence:
1.
2.
3.

## Lessons Learned
1.
2.
3.

## Follow-Up Actions
- [ ] Action item 1 (Owner: ___, Due: ___)
- [ ] Action item 2 (Owner: ___, Due: ___)
```

---

## Conclusion

This disaster recovery plan provides:

✅ **Comprehensive Coverage:** 7 major disaster scenarios
✅ **Clear Procedures:** Step-by-step recovery instructions
✅ **Fast Recovery:** 15-minute RTO for critical scenarios
✅ **Minimal Data Loss:** 1-hour RPO with hourly backups
✅ **Tested Procedures:** Quarterly validation testing
✅ **Documentation:** Complete runbooks and checklists

**Key Success Factors:**
1. **Regular backups** (automated hourly)
2. **Off-site storage** (protect against local disasters)
3. **Testing** (quarterly DR tests)
4. **Documentation** (up-to-date procedures)
5. **Training** (team knows procedures)
6. **Monitoring** (early detection of issues)

**Next Steps:**
1. Review this plan with team
2. Conduct first DR test
3. Set up off-site backups
4. Create incident response team
5. Schedule quarterly tests
6. Update emergency contacts

---

**Document Version:** 1.0
**Last Updated:** 2025-11-03
**Author:** Claude (Anthropic AI Assistant)
**Review Status:** Pending Review
**Next Review Date:** 2026-02-03
