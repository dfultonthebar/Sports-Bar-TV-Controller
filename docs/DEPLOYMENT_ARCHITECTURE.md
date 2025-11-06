# Deployment Architecture Documentation

**Sports-Bar-TV-Controller Production Environment**

Last Updated: November 6, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Production Environment](#production-environment)
3. [PM2 Process Management](#pm2-process-management)
4. [Database Management](#database-management)
5. [Logging & Monitoring](#logging--monitoring)
6. [Health Monitoring](#health-monitoring)
7. [Backup & Recovery](#backup--recovery)
8. [Deployment Process](#deployment-process)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### Production Stack

| Component | Technology | Location |
|-----------|------------|----------|
| Operating System | Ubuntu Linux 5.15.0-160 | Physical server |
| Node.js Runtime | Node.js 20.x | System-wide |
| Process Manager | PM2 5.x | System-wide |
| Application | Next.js 15.5.6 | /home/ubuntu/Sports-Bar-TV-Controller |
| Database | SQLite 3.x | /home/ubuntu/sports-bar-data/production.db |
| Web Server | Next.js Built-in | Port 3001 |
| Init System | systemd + PM2 | Startup script |

### Deployment Model

- **Single Server**: All components on one physical machine
- **Local Network**: No public internet exposure
- **No Reverse Proxy**: Direct access on port 3001
- **No Load Balancer**: Single PM2 process (fork mode)
- **No Containerization**: Native installation

---

## Production Environment

### Server Specifications

```
Hardware:
  - CPU: [To be documented]
  - RAM: [To be documented]
  - Storage: [To be documented]
  - Network: 1 Gbps Ethernet (local)

Software:
  - OS: Ubuntu 20.04 LTS or 22.04 LTS
  - Kernel: Linux 5.15.0-160-generic
  - Node.js: v20.x.x
  - npm: v10.x.x
  - PM2: v5.x.x
```

### Directory Structure

```
/home/ubuntu/
├── Sports-Bar-TV-Controller/    # Application root
│   ├── .next/                    # Built Next.js app
│   ├── src/                      # Source code
│   ├── docs/                     # Documentation
│   ├── node_modules/             # Dependencies
│   ├── package.json
│   ├── next.config.js
│   ├── ecosystem.config.js       # PM2 config
│   └── drizzle.config.ts         # Database config
│
├── sports-bar-data/              # Data directory
│   ├── production.db             # Production database
│   ├── backups/                  # Automated backups
│   │   ├── production-20251106.db
│   │   └── ...
│   └── logs/                     # Application logs (optional)
│
└── memory-bank/                  # Context snapshots
    ├── snapshot-*.md
    └── ...
```

### Environment Variables

**Location**: `/home/ubuntu/Sports-Bar-TV-Controller/.env` (not committed)

```bash
# Database
DATABASE_URL=file:/home/ubuntu/sports-bar-data/production.db

# Application
NODE_ENV=production
PORT=3001

# External APIs (optional)
SOUNDTRACK_API_KEY=your_key_here
THESPORTSDB_API_KEY=your_key_here
GRACENOTE_API_KEY=your_key_here

# Ollama (local LLM)
OLLAMA_BASE_URL=http://localhost:11434

# Logging
LOG_LEVEL=info
```

### Network Configuration

**Firewall Rules**:
```bash
# Allow local network only (192.168.x.x)
sudo ufw allow from 192.168.0.0/16 to any port 3001

# Allow localhost
sudo ufw allow from 127.0.0.1 to any port 3001

# Block everything else
sudo ufw default deny incoming
sudo ufw enable
```

**Port Allocation**:
```
3001 - Next.js application (production)
3000 - Next.js development (when running)
11434 - Ollama LLM server
5555 - ADB connection to Fire TVs
4998 - Global Cache iTach IR
23 - HDMI matrix (Telnet)
80/5321/3131 - AtlasIED audio processor
```

---

## PM2 Process Management

### PM2 Configuration

**File**: `/home/ubuntu/Sports-Bar-TV-Controller/ecosystem.config.js`

```javascript
module.exports = {
  apps: [{
    name: 'sports-bar-tv-controller',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3001',
    cwd: '/home/ubuntu/Sports-Bar-TV-Controller',
    instances: 1,
    exec_mode: 'fork',  // NOT cluster (SQLite doesn't support concurrent writes)
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: '3001'
    },
    error_file: '~/.pm2/logs/sports-bar-tv-controller-error.log',
    out_file: '~/.pm2/logs/sports-bar-tv-controller-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Cron jobs
    cron_restart: '0 4 * * *',  // Restart daily at 4 AM

    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
}
```

### PM2 Commands

**Start Application**:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
pm2 start ecosystem.config.js
```

**Restart Application**:
```bash
pm2 restart sports-bar-tv-controller
```

**Stop Application**:
```bash
pm2 stop sports-bar-tv-controller
```

**View Logs**:
```bash
# Real-time logs
pm2 logs sports-bar-tv-controller

# Last 100 lines
pm2 logs sports-bar-tv-controller --lines 100

# Error logs only
pm2 logs sports-bar-tv-controller --err

# Output logs only
pm2 logs sports-bar-tv-controller --out
```

**Status Check**:
```bash
pm2 status

# Output:
┌─────┬────────────────────────────┬─────────┬─────────┬─────────┬──────────┐
│ id  │ name                       │ mode    │ ↺       │ status  │ cpu      │
├─────┼────────────────────────────┼─────────┼─────────┼─────────┼──────────┤
│ 0   │ sports-bar-tv-controller   │ fork    │ 15      │ online  │ 2%       │
└─────┴────────────────────────────┴─────────┴─────────┴─────────┴──────────┘
```

**Memory Monitoring**:
```bash
pm2 monit

# Shows real-time:
# - CPU usage
# - Memory usage
# - Active requests
# - Logs
```

**Startup Script** (systemd):
```bash
# Generate startup script
pm2 startup systemd

# Save current PM2 processes
pm2 save

# Result: PM2 auto-starts on system boot
```

### PM2 Log Rotation

**Install PM2 Log Rotate Module**:
```bash
pm2 install pm2-logrotate
```

**Configure Log Rotation**:
```bash
# Keep 30 days of logs
pm2 set pm2-logrotate:retain 30

# Rotate when log reaches 10MB
pm2 set pm2-logrotate:max_size 10M

# Compress rotated logs
pm2 set pm2-logrotate:compress true

# Rotate daily at 4 AM
pm2 set pm2-logrotate:rotateInterval '0 4 * * *'
```

**Log Locations**:
```
~/.pm2/logs/
├── sports-bar-tv-controller-out.log
├── sports-bar-tv-controller-error.log
├── sports-bar-tv-controller-out-2025-11-05.log.gz
└── sports-bar-tv-controller-error-2025-11-05.log.gz
```

---

## Database Management

### Database Location

**Production**: `/home/ubuntu/sports-bar-data/production.db`

**Configuration** (`drizzle.config.ts`):
```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:/home/ubuntu/sports-bar-data/production.db'
  }
} satisfies Config
```

### Database Operations

**View Schema**:
```bash
npm run db:studio

# Opens Drizzle Studio at http://localhost:4983
# Browse tables, run queries, view data
```

**Generate Migration** (after schema changes):
```bash
npm run db:generate

# Creates migration file in /src/db/migrations/
# Example: 0005_add_ir_devices.sql
```

**Apply Migration**:
```bash
npm run db:push

# Applies schema changes to database
# Updates production.db
```

**Backup Database**:
```bash
# Manual backup
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/backups/production-$(date +%Y%m%d-%H%M%S).db

# Automated backup (cron)
# See Backup & Recovery section
```

**Optimize Database**:
```bash
# Run monthly
sqlite3 /home/ubuntu/sports-bar-data/production.db "VACUUM;"
sqlite3 /home/ubuntu/sports-bar-data/production.db "ANALYZE;"

# Result: Reclaim space, rebuild indexes, update statistics
```

**Database Health Check**:
```bash
# Check integrity
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"

# Check size
du -h /home/ubuntu/sports-bar-data/production.db

# Check table sizes
sqlite3 /home/ubuntu/sports-bar-data/production.db <<EOF
SELECT
  name,
  (SELECT COUNT(*) FROM name) as row_count
FROM sqlite_master
WHERE type='table'
ORDER BY row_count DESC;
EOF
```

---

## Logging & Monitoring

### Application Logging

**Structured Logging** (`/src/lib/logger.ts`):
```typescript
import { logger } from '@/lib/logger'

logger.info('[COMPONENT] Message', { context: 'data' })
logger.error('[COMPONENT] Error:', error)
logger.debug('[COMPONENT] Debug info')
logger.warn('[COMPONENT] Warning')
```

**Log Levels**:
- `debug`: Development debugging (not in production logs)
- `info`: General information
- `warn`: Warnings (non-critical)
- `error`: Errors (require attention)

**Log Format**:
```
2025-11-06 12:30:45 [INFO] [FIRETV] Health check completed { deviceId: 'device-1', status: 'online' }
2025-11-06 12:30:46 [ERROR] [ADB] Connection failed { error: 'ETIMEDOUT', deviceId: 'device-2' }
```

### Database Logging

**Enhanced Logger** (`/src/lib/enhanced-logger.ts`):
- Logs all operations to database
- Used by System Admin analytics
- Query performance metrics

**Logged Events**:
- Device operations
- Hardware commands
- Authentication events
- Configuration changes
- Error events

### PM2 Monitoring

**Real-Time Monitoring**:
```bash
pm2 monit
```

**Process Metrics**:
```bash
pm2 describe sports-bar-tv-controller

# Shows:
# - Uptime
# - Restart count
# - CPU usage
# - Memory usage
# - PID
# - Mode (fork/cluster)
```

**Restart Analysis**:
```bash
# Check restart reasons
pm2 logs sports-bar-tv-controller --lines 1000 | grep -i "restart\|error\|crash"

# View restart count
pm2 status
# Look for ↺ column (restart count)
```

---

## Health Monitoring

### Fire TV Health Monitor

**Service**: `/src/lib/firetv-health-monitor.ts`

**Schedule**: Every 5 minutes (cron job via PM2 or system cron)

**Process**:
1. Load active Fire TV devices from config
2. Parallel health checks (Promise.allSettled)
3. Batch database update (single transaction)
4. Log failures only

**Performance Optimizations** (implemented Nov 2025):
- Config file reads instead of DB queries
- Batch updates instead of individual writes
- Reduced check frequency (1min → 5min)
- Result: 70% reduction in database load

**Setup Cron Job**:
```bash
# Option 1: PM2 cron (recommended)
# Already configured in ecosystem.config.js

# Option 2: System cron
crontab -e

# Add:
*/5 * * * * cd /home/ubuntu/Sports-Bar-TV-Controller && node -e "require('./src/services/firetv-health-monitor.ts').runHealthCheck()"
```

### System Health Endpoint

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-06T12:30:00Z",
  "uptime": 86400,
  "memory": {
    "used": 512000000,
    "total": 1073741824,
    "percentage": 47.6
  },
  "database": {
    "connected": true,
    "size": "45.2 MB"
  },
  "services": {
    "firetv": "online",
    "atlas": "online",
    "matrix": "online"
  }
}
```

### Memory Monitoring

**Service**: `/src/lib/memory-monitoring.ts`

**Purpose**: Track memory usage and prevent leaks

**Alerts**:
- Warning: >800MB
- Critical: >950MB
- Auto-restart: >1GB (PM2 config)

**Monitoring Script**:
```bash
#!/bin/bash
# /home/ubuntu/scripts/memory-monitor.sh

THRESHOLD=800000000  # 800MB

MEMORY=$(pm2 jlist | jq '.[0].monit.memory')

if [ "$MEMORY" -gt "$THRESHOLD" ]; then
  echo "High memory usage: $MEMORY bytes"
  pm2 restart sports-bar-tv-controller
fi
```

---

## Backup & Recovery

### Automated Backups

**Backup Script** (`/home/ubuntu/scripts/backup-database.sh`):
```bash
#!/bin/bash

BACKUP_DIR="/home/ubuntu/sports-bar-data/backups"
DB_FILE="/home/ubuntu/sports-bar-data/production.db"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/production-$DATE.db"

# Create backup
cp "$DB_FILE" "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

# Delete backups older than 30 days
find "$BACKUP_DIR" -name "production-*.db.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_FILE.gz"
```

**Cron Schedule**:
```bash
crontab -e

# Daily backup at 3 AM
0 3 * * * /home/ubuntu/scripts/backup-database.sh >> /home/ubuntu/sports-bar-data/logs/backup.log 2>&1
```

### Recovery Procedures

**Restore from Backup**:
```bash
# 1. Stop application
pm2 stop sports-bar-tv-controller

# 2. Backup current database (just in case)
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/production.db.before-restore

# 3. Restore from backup
gunzip -c /home/ubuntu/sports-bar-data/backups/production-20251106-030000.db.gz \
  > /home/ubuntu/sports-bar-data/production.db

# 4. Verify integrity
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"

# 5. Restart application
pm2 restart sports-bar-tv-controller
```

**Disaster Recovery**:
```bash
# If database is corrupted beyond repair

# 1. Stop app
pm2 stop sports-bar-tv-controller

# 2. Rename corrupted database
mv /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/production.db.corrupted

# 3. Initialize new database
cd /home/ubuntu/Sports-Bar-TV-Controller
npm run db:push

# 4. Restart app
pm2 restart sports-bar-tv-controller

# 5. Manual data re-entry required
# (No data migration from corrupted DB)
```

---

## Deployment Process

### Initial Deployment

```bash
# 1. Clone repository
cd /home/ubuntu
git clone <repository-url> Sports-Bar-TV-Controller
cd Sports-Bar-TV-Controller

# 2. Install dependencies
npm install

# 3. Create production database directory
mkdir -p /home/ubuntu/sports-bar-data/backups

# 4. Initialize database
npm run db:push

# 5. Build application
npm run build

# 6. Start with PM2
pm2 start ecosystem.config.js

# 7. Save PM2 configuration
pm2 save

# 8. Setup PM2 startup script
pm2 startup systemd
# Follow instructions to run generated command

# 9. Verify deployment
curl http://localhost:3001/api/health
```

### Update Deployment

```bash
# 1. Pull latest changes
cd /home/ubuntu/Sports-Bar-TV-Controller
git pull origin main

# 2. Install new dependencies (if package.json changed)
npm install

# 3. Run database migrations (if schema.ts changed)
npm run db:generate
npm run db:push

# 4. Rebuild application
npm run build

# 5. Restart PM2
pm2 restart sports-bar-tv-controller

# 6. Verify deployment
pm2 logs sports-bar-tv-controller --lines 50
curl http://localhost:3001/api/health
```

### Rollback Procedure

```bash
# 1. Check git log for last known good commit
git log --oneline -10

# 2. Revert to previous commit
git reset --hard <commit-hash>

# 3. Reinstall dependencies
npm install

# 4. Restore database backup (if schema changed)
# See Recovery Procedures section

# 5. Rebuild
npm run build

# 6. Restart
pm2 restart sports-bar-tv-controller
```

---

## Troubleshooting

### Application Won't Start

**Check PM2 Status**:
```bash
pm2 status
pm2 logs sports-bar-tv-controller --lines 50
```

**Common Issues**:

1. **Port 3001 already in use**:
```bash
# Find process using port
sudo lsof -i :3001

# Kill process
sudo kill -9 <PID>

# Restart PM2
pm2 restart sports-bar-tv-controller
```

2. **Database locked**:
```bash
# Check for stale locks
fuser /home/ubuntu/sports-bar-data/production.db

# If locked, kill process or restart PM2
pm2 restart sports-bar-tv-controller
```

3. **Build errors**:
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

### High Memory Usage

**Check Memory**:
```bash
pm2 monit
# OR
pm2 describe sports-bar-tv-controller
```

**Solutions**:
1. Restart PM2: `pm2 restart sports-bar-tv-controller`
2. Increase memory limit in `ecosystem.config.js`
3. Check for memory leaks in logs

### Database Issues

**Integrity Check**:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"
```

**Repair Corrupted Database**:
```bash
# Export data
sqlite3 /home/ubuntu/sports-bar-data/production.db ".dump" > dump.sql

# Create new database
mv production.db production.db.old
sqlite3 /home/ubuntu/sports-bar-data/production.db < dump.sql
```

### PM2 Logs Not Rotating

**Check Log Rotate Module**:
```bash
pm2 ls
# Look for pm2-logrotate in module list

# Reinstall if missing
pm2 install pm2-logrotate
```

**Manual Log Cleanup**:
```bash
# Clear logs
pm2 flush

# Rotate manually
pm2 reloadLogs
```

---

## Performance Tuning

### PM2 Optimization

**Current Settings** (optimized for SQLite):
- Fork mode (not cluster)
- Single instance
- 1GB memory limit
- Daily restart at 4 AM

**Why Not Cluster Mode?**
- SQLite doesn't support concurrent writes
- Single instance prevents database lock contention
- Fork mode is more stable for our use case

### Database Optimization

**Indexes** (already implemented):
- All foreign keys indexed
- Timestamp columns indexed
- Status/flag columns indexed

**Regular Maintenance**:
```bash
# Monthly
sqlite3 production.db "VACUUM;"
sqlite3 production.db "ANALYZE;"
```

### Node.js Tuning

**Memory Settings** (if needed):
```javascript
// ecosystem.config.js
node_args: '--max-old-space-size=1024'  // 1GB heap
```

---

## Related Documentation

- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - Overall architecture
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database design
- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md) - Security model
- [PM2_MONITORING_REPORT.md](./PM2_MONITORING_REPORT.md) - PM2 setup details
- [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) - Full recovery procedures
- [CLAUDE.md](../CLAUDE.md) - Developer reference
