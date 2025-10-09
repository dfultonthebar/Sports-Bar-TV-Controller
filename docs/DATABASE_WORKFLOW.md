# Database Workflow Documentation

## Overview
The Sports Bar TV Controller uses SQLite as its database. This document outlines best practices for working with the database safely.

## Database Location
- **Production**: `./data/sports-bar.db`
- **Backups**: `./backups/sports-bar_YYYYMMDD_HHMMSS.db`

## Backup Strategy

### Automated Backups
Use the provided backup script before any risky operations:

```bash
./scripts/backup-database.sh
```

This script:
- Creates timestamped backups
- Verifies backup integrity
- Maintains only the 10 most recent backups
- Can be customized via environment variables

### Manual Backups
For critical operations, create a manual backup:

```bash
mkdir -p backups
cp data/sports-bar.db backups/sports-bar_manual_$(date +%Y%m%d_%H%M%S).db
```

### Backup Schedule Recommendations
- **Before deployment**: Always
- **Before schema changes**: Always
- **Before bulk data operations**: Always
- **Automated daily backups**: Recommended (via cron)

Example cron job (daily at 2 AM):
```bash
0 2 * * * cd /path/to/Sports-Bar-TV-Controller && ./scripts/backup-database.sh >> logs/backup.log 2>&1
```

## Database Schema Changes

### Safe Schema Migration Process

1. **Backup First**
   ```bash
   ./scripts/backup-database.sh
   ```

2. **Test Migration Locally**
   - Copy production database to local environment
   - Test migration on copy
   - Verify data integrity

3. **Create Migration Script**
   - Document all changes
   - Include rollback steps
   - Test rollback procedure

4. **Apply to Production**
   - During low-traffic period
   - Monitor for errors
   - Verify application functionality

### Example Migration Script
```sql
-- Migration: Add new column to devices table
-- Date: YYYY-MM-DD
-- Author: [Your name]

BEGIN TRANSACTION;

-- Add new column
ALTER TABLE devices ADD COLUMN last_heartbeat TIMESTAMP;

-- Verify change
SELECT COUNT(*) FROM devices;

COMMIT;

-- Rollback (if needed):
-- BEGIN TRANSACTION;
-- ALTER TABLE devices DROP COLUMN last_heartbeat;
-- COMMIT;
```

## Common Database Operations

### Viewing Database Contents
```bash
# Open SQLite CLI
sqlite3 data/sports-bar.db

# List all tables
.tables

# View table schema
.schema devices

# Query data
SELECT * FROM devices LIMIT 10;

# Exit
.quit
```

### Checking Database Integrity
```bash
sqlite3 data/sports-bar.db "PRAGMA integrity_check;"
```

### Database Size and Statistics
```bash
# Check database size
ls -lh data/sports-bar.db

# View table sizes
sqlite3 data/sports-bar.db << EOF
SELECT 
    name,
    SUM(pgsize) as size_bytes
FROM dbstat
GROUP BY name
ORDER BY size_bytes DESC;
