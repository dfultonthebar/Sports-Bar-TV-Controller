# Database Logging Implementation Summary

## Date: October 16, 2025

## Overview
Comprehensive verbose logging has been implemented for all database operations and file monitoring in the Sports Bar TV Controller application.

## Components Implemented

### 1. Prisma Query Logging
**File**: `src/lib/prisma.ts`

- Logs all database queries with full SQL, parameters, and duration
- Emits query events for custom logging
- Logs errors, warnings, and info messages to stdout
- Output visible in PM2 logs

### 2. Database Audit Logger
**File**: `src/lib/db-audit-logger.ts`

- Structured logging for database operations
- User attribution tracking
- Metadata support for additional context
- Error logging with stack traces
- JSON format for easy parsing
- Console output for PM2 visibility

### 3. Enhanced Backup Script
**File**: `/home/ubuntu/sports-bar-data/backup.sh`

Features:
- Detailed logging of all backup operations
- Database size tracking
- Backup count monitoring
- Automatic cleanup logging
- Error handling with detailed messages
- Timestamped entries

### 4. Enhanced Restore Script
**File**: `/home/ubuntu/sports-bar-data/restore.sh`

Features:
- Restore operation logging
- Safety backup creation before restore
- Backup file validation
- Size verification
- Error recovery logging
- User guidance messages

### 5. Database File Monitor
**File**: `/home/ubuntu/sports-bar-data/monitor.sh`

Features:
- Real-time file system monitoring using inotifywait
- Tracks: modify, attrib, close_write, move, create, delete, open events
- Logs file size and inode changes
- Initial state logging
- Continuous monitoring as PM2 process

### 6. Log Aggregation Script
**File**: `/home/ubuntu/sports-bar-data/view-logs.sh`

Features:
- Single command to view all logs
- Last 30 lines of each log file
- Database file status
- PM2 application logs
- Formatted output for readability

## Log File Locations

| Log Type | Location | Purpose |
|----------|----------|---------|
| Audit | `/home/ubuntu/sports-bar-data/audit.log` | Database operations |
| Backup | `/home/ubuntu/sports-bar-data/backup.log` | Backup operations |
| Restore | `/home/ubuntu/sports-bar-data/restore.log` | Restore operations |
| Monitor | `/home/ubuntu/sports-bar-data/file-monitor.log` | File system events |
| Application | PM2 logs | Prisma queries & app logs |

## Usage Examples

### View All Logs
```bash
/home/ubuntu/sports-bar-data/view-logs.sh
```

### View Specific Log
```bash
tail -f /home/ubuntu/sports-bar-data/audit.log
```

### Search Logs
```bash
grep "ERROR" /home/ubuntu/sports-bar-data/*.log
grep "INSERT" /home/ubuntu/sports-bar-data/audit.log
```

### Monitor Real-Time
```bash
# Watch file monitor
tail -f /home/ubuntu/sports-bar-data/file-monitor.log

# Watch PM2 logs (includes Prisma queries)
pm2 logs sports-bar-tv --lines 50
```

## Integration Points

### Application Code
To use the audit logger in your code:

```typescript
import { logDatabaseOperation, logDatabaseError } from '@/lib/db-audit-logger'

// Log successful operation
try {
  const result = await prisma.user.create({ data: userData })
  logDatabaseOperation('INSERT', 'users', result, currentUser?.email)
} catch (error) {
  logDatabaseError('INSERT', 'users', error, { userData })
  throw error
}
```

### Backup/Restore Scripts
Scripts are located in `/home/ubuntu/sports-bar-data/`:
- `backup.sh` - Run backups with logging
- `restore.sh <backup_file>` - Restore with logging
- `monitor.sh` - File monitoring (runs as PM2 process)

### PM2 Process
File monitor runs as a PM2 process:
```bash
pm2 start /home/ubuntu/sports-bar-data/monitor.sh --name db-file-monitor
pm2 save
```

## Benefits

1. **Complete Visibility**: Every database operation is logged
2. **Debugging**: Easy to trace issues with detailed logs
3. **Audit Trail**: Full history of database changes
4. **Performance Monitoring**: Query duration tracking
5. **File Integrity**: Real-time file change detection
6. **Backup Verification**: Detailed backup/restore logging
7. **AI Integration**: Logs accessible to local AI for assistance

## Next Steps

1. Deploy scripts to production server
2. Start file monitor as PM2 process
3. Test logging with sample operations
4. Verify log rotation strategy
5. Document log analysis procedures

## Deployment Checklist

- [x] Update Prisma client with query logging
- [x] Create database audit logger
- [x] Create enhanced backup script
- [x] Create enhanced restore script
- [x] Create file monitor script
- [x] Create log viewing script
- [x] Update documentation
- [ ] Deploy scripts to server
- [ ] Install inotify-tools on server
- [ ] Start file monitor as PM2 process
- [ ] Test all logging components
- [ ] Verify log files are created
- [ ] Test log viewing script

## Notes

- All scripts use emoji icons for visual clarity
- Logs use structured format for easy parsing
- File monitor uses kernel-level inotify for efficiency
- Prisma logging is always enabled (not just in development)
- Audit log grows indefinitely - consider rotation strategy

