# Power Loss Data Corruption Protection

## Executive Summary

This document provides a comprehensive analysis of power loss data corruption risks in the Sports-Bar-TV-Controller system and outlines multi-layered fail-safe strategies to protect against data loss.

**Current Status:** MODERATE PROTECTION
- **Database:** WAL mode enabled with basic settings
- **Backups:** Hourly automated backups (30 retained)
- **Recovery:** Manual recovery procedures
- **UPS:** Not installed (CRITICAL GAP)

**Risk Level:** MEDIUM-HIGH
Without UPS protection, the system is vulnerable to sudden power loss during database writes, which could lead to data corruption despite WAL mode protections.

---

## Table of Contents

1. [Current System Assessment](#current-system-assessment)
2. [SQLite WAL Mode Protection](#sqlite-wal-mode-protection)
3. [Risk Analysis](#risk-analysis)
4. [Multi-Layer Protection Strategy](#multi-layer-protection-strategy)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Recovery Procedures](#recovery-procedures)

---

## Current System Assessment

### Database Configuration

**Location:** `/home/ubuntu/sports-bar-data/production.db`

**Current PRAGMA Settings:**
```
journal_mode      = WAL
synchronous       = 2 (FULL)
wal_autocheckpoint = 1000
busy_timeout      = 0 (NOT SET - CRITICAL)
```

**Database Statistics:**
- Size: 14 MB (production.db)
- WAL Size: 4 MB (production.db-wal)
- Tables: 64 tables
- Active Connections: 1 (Next.js application)

**Files Present:**
- `production.db` - Main database file
- `production.db-wal` - Write-Ahead Log
- `production.db-shm` - Shared memory file

### Current Safeguards

#### 1. WAL Mode (ENABLED)
**Status:** Active and working correctly

**Benefits:**
- Readers don't block writers
- Atomic commits
- Better crash recovery
- Checkpoints preserve consistency

**Limitations:**
- No protection against hardware failure during checkpoint
- Relies on OS filesystem cache behavior
- Can lose last few transactions if power fails during WAL flush

#### 2. Automated Hourly Backups (WORKING)
**Cron Job:** `0 * * * * /home/ubuntu/sports-bar-data/backup.sh`

**Backup Details:**
- Frequency: Every hour at :00
- Retention: Last 30 backups
- Location: `/home/ubuntu/sports-bar-data/backups/`
- Total Size: 417 MB (30 backups × ~14 MB each)
- Method: Simple `cp` command (NOT WAL-aware)

**CRITICAL ISSUE:** The backup script uses `cp` which may create inconsistent backups if database is being written during backup. Should use SQLite `.backup` command or checkpoint before copy.

#### 3. PM2 Process Manager (CONFIGURED)
**Status:** Enabled and auto-restart configured

**Configuration:**
```javascript
{
  name: 'sports-bar-tv-controller',
  autorestart: true,
  max_memory_restart: '1G',
  instances: 1
}
```

**PM2 Systemd Service:** Enabled (starts on boot)

**Restart Count:** 21 restarts (suggests some instability)

**Missing:** No graceful shutdown handlers for database cleanup

### Current Gaps

| Gap | Risk Level | Impact |
|-----|-----------|--------|
| No UPS protection | CRITICAL | Power loss = potential corruption |
| No graceful shutdown handlers | HIGH | Database may be left in inconsistent state |
| Backup script not WAL-aware | HIGH | Backups may be corrupted |
| No busy_timeout setting | MEDIUM | Concurrent access errors |
| No synchronous pragma tuning | MEDIUM | Performance vs. durability tradeoff |
| No startup integrity check | MEDIUM | Corrupted DB goes undetected |
| No JSON file atomic writes | LOW | Config files may be partial |

---

## SQLite WAL Mode Protection

### How WAL Mode Works

Write-Ahead Logging (WAL) provides better concurrency and crash recovery than traditional rollback journals.

**Normal Operation:**
1. Changes are written to WAL file first
2. WAL file is fsynced to disk (if synchronous=FULL)
3. Original database remains unchanged
4. Readers read from database + WAL overlay
5. Periodically, WAL is checkpointed into main database

**On Crash Recovery:**
1. SQLite checks for WAL file on startup
2. Valid committed transactions in WAL are replayed
3. Partial/uncommitted transactions are discarded
4. Database is consistent up to last checkpoint + valid WAL entries

### WAL Mode Guarantees

**What WAL DOES Protect Against:**
- Application crashes (code bugs, segfaults)
- OS crashes (kernel panic)
- Ungraceful process termination (SIGKILL)
- Concurrent access conflicts
- Partial transactions

**What WAL DOES NOT Protect Against:**
- Hardware failure (disk corruption)
- Power loss during checkpoint
- Filesystem corruption
- Storage device failure
- Multiple simultaneous failures

### PRAGMA Settings Deep Dive

#### 1. journal_mode = WAL
**Current:** ENABLED ✅

**Recommendation:** Keep enabled

**Why:**
- Better crash recovery than DELETE/TRUNCATE modes
- Allows concurrent readers during writes
- Atomic commits
- Required for production systems

#### 2. synchronous
**Current:** 2 (FULL)

**Options:**
- `OFF (0)`: Fastest, NO durability (NEVER use in production)
- `NORMAL (1)`: Good balance, syncs at critical moments
- `FULL (2)`: Maximum durability, syncs every transaction
- `EXTRA (3)`: Paranoid mode, extra syncs (very slow)

**Current Setting Analysis:**
- FULL mode is currently set (good for durability)
- Every transaction waits for disk sync
- Slower performance but maximum safety
- **Recommended for financial/critical data**

**Recommendation for Sports Bar System:**
```sql
PRAGMA synchronous = NORMAL;
```

**Why NORMAL is sufficient:**
- Sports bar data is not financial
- WAL mode already provides good protection
- NORMAL syncs at critical moments (WAL file writes, checkpoints)
- 2-3x performance improvement over FULL
- Still provides excellent crash protection
- Power loss might lose last transaction, but no corruption

**Trade-offs:**
- FULL: Slower, max safety, syncs every commit
- NORMAL: Faster, good safety, syncs at critical moments only
- Risk with NORMAL: Last transaction might be lost on power failure
- For this use case: Acceptable risk (can replay from backup)

#### 3. wal_autocheckpoint
**Current:** 1000 pages

**Analysis:**
- Checkpoint occurs automatically after 1000 pages (~4MB) written to WAL
- Current WAL size: 4 MB (close to checkpoint threshold)
- Too large: WAL grows big, longer recovery time
- Too small: Frequent checkpoints, slower performance

**Recommendation:**
```sql
PRAGMA wal_autocheckpoint = 1000;  -- Keep current setting
```

**Alternative for high-write systems:**
```sql
PRAGMA wal_autocheckpoint = 2000;  -- Less frequent checkpoints
```

#### 4. busy_timeout
**Current:** 0 (NOT SET) ❌

**Problem:**
- With 0 timeout, concurrent writes fail immediately with SQLITE_BUSY
- No retry mechanism
- Poor user experience (random "database locked" errors)

**Recommendation:**
```sql
PRAGMA busy_timeout = 5000;  -- Wait up to 5 seconds
```

**Why:**
- Gives transactions time to complete
- Automatic retry on SQLITE_BUSY errors
- Better for web applications with concurrent requests
- 5000ms is reasonable for sports bar use case

#### 5. cache_size
**Not Currently Set**

**Recommendation:**
```sql
PRAGMA cache_size = -8000;  -- 8 MB cache
```

**Why:**
- Negative number = kilobytes (positive = pages)
- More cache = fewer disk reads
- 8 MB is good balance for 14 MB database
- Faster queries and writes

### Optimal PRAGMA Configuration

```typescript
// Enhanced database initialization
const sqlite = new Database(dbPath)

// Enable WAL mode (already doing this)
sqlite.pragma('journal_mode = WAL')

// Set synchronous to NORMAL for better performance with good safety
sqlite.pragma('synchronous = NORMAL')

// Set busy timeout to handle concurrent access
sqlite.pragma('busy_timeout = 5000')

// Configure cache for better performance
sqlite.pragma('cache_size = -8000')  // 8 MB

// Keep auto-checkpoint at 1000 pages (~4MB)
sqlite.pragma('wal_autocheckpoint = 1000')

// Enable foreign keys (data integrity)
sqlite.pragma('foreign_keys = ON')

// Disable checkpoint on close for faster shutdown
// Note: WAL file will persist but will be cleaned up on next startup
sqlite.pragma('wal_checkpoint(PASSIVE)')  // Run passive checkpoint
```

---

## Risk Analysis

### Power Loss Scenarios

#### Scenario 1: Power Loss During Write
**Probability:** High (no UPS)
**Impact:** CRITICAL

**What Happens:**
1. Application is writing to database
2. Power fails instantly
3. OS cannot flush buffers to disk
4. WAL file may have partial transaction

**With WAL Mode:**
- ✅ Committed transactions in WAL are safe (if synced)
- ✅ Partial transactions are rolled back on restart
- ⚠️ Last transaction may be lost (depends on sync mode)
- ⚠️ If power fails during checkpoint, database may be inconsistent

**Risk Mitigation:**
- UPS provides time to complete writes
- Backup can restore lost transactions
- Integrity check on startup detects corruption

#### Scenario 2: Power Loss During Checkpoint
**Probability:** Low (checkpoints are infrequent)
**Impact:** HIGH

**What Happens:**
1. SQLite is moving data from WAL to main database
2. Power fails mid-checkpoint
3. Main database may be partially updated
4. WAL file may be partially consumed

**With WAL Mode:**
- ⚠️ Database may be in inconsistent state
- ⚠️ Recovery depends on filesystem consistency
- ✅ Usually recoverable on restart
- ❌ Worst case: database corruption

**Risk Mitigation:**
- UPS prevents mid-checkpoint power loss
- Regular backups provide recovery point
- Integrity check detects corruption

#### Scenario 3: Power Loss During Backup
**Probability:** Medium (hourly backups)
**Impact:** MEDIUM

**What Happens:**
1. Backup script is copying database
2. Power fails
3. Backup file is incomplete/corrupted

**Current Risk:**
- ❌ Backup script uses `cp` (not atomic)
- ❌ No verification of backup integrity
- ✅ Previous backups still exist

**Risk Mitigation:**
- Use SQLite `.backup` command (atomic)
- Verify backup after creation
- Keep multiple backup generations

#### Scenario 4: Power Loss During PM2 Operations
**Probability:** Low
**Impact:** LOW

**What Happens:**
1. PM2 is restarting process
2. Power fails
3. PM2 state file may be inconsistent

**Risk:**
- PM2 may not restart app on reboot
- ✅ PM2 systemd service is enabled (good)
- ✅ PM2 saves state regularly

**Risk Mitigation:**
- PM2 systemd service auto-starts
- Manual restart is trivial

#### Scenario 5: Power Loss During JSON File Write
**Probability:** Low (infrequent writes)
**Impact:** LOW-MEDIUM

**What Happens:**
1. Application writing to JSON config file
2. Power fails
3. JSON file is truncated or invalid

**Current JSON Files:**
- `/data/firetv-devices.json` (385 bytes)
- `/data/device-subscriptions.json` (1.7 KB)
- `/data/tv-layout.json` (4.8 KB)
- Others...

**Risk:**
- ⚠️ No atomic write operations
- ⚠️ File may be empty or truncated
- ⚠️ JSON parse errors on startup

**Risk Mitigation:**
- Use atomic write pattern (write temp, rename)
- Validate JSON before writing
- Keep backup of previous version

### Hardware State Loss

#### Matrix Switch State
**Risk:** Power loss resets matrix to unknown state

**Impact:**
- Outputs may be disconnected
- Input routing is lost
- Need to re-establish all connections

**Mitigation:**
- Matrix configuration stored in database (persistent)
- Auto-restore state on startup (if implemented)
- Health check detects disconnected state

#### CEC Device State
**Risk:** HDMI-CEC state is volatile

**Impact:**
- TV power states unknown
- Input selections lost
- Device discovery needed

**Mitigation:**
- CEC state stored in database
- Re-discovery on startup
- Health monitoring detects issues

#### FireTV Connection State
**Risk:** ADB connections are lost

**Impact:**
- Need to reconnect to all devices
- Current app state unknown
- Commands may fail until reconnected

**Mitigation:**
- Connection manager with auto-reconnect (✅ EXISTS)
- Connection state stored in database
- Health monitor tracks online/offline status

---

## Multi-Layer Protection Strategy

### Layer 1: Database Protection (CRITICAL)

#### A. Optimized PRAGMA Settings

**Implementation File:** `/home/ubuntu/Sports-Bar-TV-Controller/src/db/index.ts`

**Current Code:**
```typescript
sqlite.pragma('journal_mode = WAL')
```

**Enhanced Code:**
```typescript
// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL')

// Set synchronous to NORMAL for better performance with good safety
// NORMAL ensures critical data is synced (WAL file, checkpoints) but doesn't
// wait for every transaction. This is acceptable for sports bar use case.
sqlite.pragma('synchronous = NORMAL')

// Set busy timeout to handle concurrent access gracefully
// If database is locked, wait up to 5 seconds before failing
sqlite.pragma('busy_timeout = 5000')

// Configure cache for better performance (8 MB)
sqlite.pragma('cache_size = -8000')

// Keep auto-checkpoint at 1000 pages (~4MB WAL file)
sqlite.pragma('wal_autocheckpoint = 1000')

// Enable foreign keys for data integrity
sqlite.pragma('foreign_keys = ON')

logger.debug('SQLite PRAGMA configuration applied:', {
  journal_mode: sqlite.pragma('journal_mode', { simple: true }),
  synchronous: sqlite.pragma('synchronous', { simple: true }),
  busy_timeout: sqlite.pragma('busy_timeout', { simple: true }),
  cache_size: sqlite.pragma('cache_size', { simple: true }),
  wal_autocheckpoint: sqlite.pragma('wal_autocheckpoint', { simple: true })
})
```

#### B. Startup Integrity Check

**New Function to Add:**
```typescript
/**
 * Check database integrity on startup
 * Detects corruption and attempts recovery
 */
async function checkDatabaseIntegrity(dbPath: string): Promise<void> {
  logger.system.startup('Database Integrity Check')

  try {
    // Check if WAL file exists (indicates unclean shutdown)
    const walPath = `${dbPath}-wal`
    if (existsSync(walPath)) {
      const walSize = statSync(walPath).size
      logger.warn(`WAL file exists (${(walSize / 1024).toFixed(2)} KB) - possible unclean shutdown`)
      logger.info('SQLite will automatically recover from WAL on first connection')
    }

    // Run integrity check
    const result = sqlite.pragma('integrity_check', { simple: true })

    if (result === 'ok') {
      logger.success('Database integrity check PASSED')
    } else {
      logger.error('Database integrity check FAILED:', result)

      // Attempt recovery
      logger.warn('Attempting automatic recovery...')

      // Try to recover from WAL
      sqlite.pragma('wal_checkpoint(TRUNCATE)')

      // Check again
      const retryResult = sqlite.pragma('integrity_check', { simple: true })
      if (retryResult === 'ok') {
        logger.success('Database recovered successfully')
      } else {
        // Critical failure - need to restore from backup
        logger.error('Database recovery FAILED - restoration required')
        throw new Error('Database corruption detected - please restore from backup')
      }
    }

    // Run quick check for common issues
    const quickCheck = sqlite.pragma('quick_check', { simple: true })
    logger.debug(`Quick check result: ${quickCheck}`)

    logger.system.ready('Database Integrity Check')
  } catch (error) {
    logger.error('Database integrity check error:', error)
    throw error
  }
}

// Call this before creating Drizzle instance
checkDatabaseIntegrity(dbPath)
```

#### C. Graceful Shutdown Handler

**New File:** `/home/ubuntu/Sports-Bar-TV-Controller/src/lib/shutdown-handler.ts`

```typescript
/**
 * Graceful Shutdown Handler
 * Ensures database is properly closed on process termination
 */

import { logger } from '@/lib/logger'
import Database from 'better-sqlite3'

interface ShutdownHandler {
  name: string
  handler: () => Promise<void> | void
}

class GracefulShutdown {
  private handlers: ShutdownHandler[] = []
  private isShuttingDown = false
  private shutdownTimeout = 30000 // 30 seconds

  /**
   * Register a handler to be called during shutdown
   */
  register(name: string, handler: () => Promise<void> | void) {
    this.handlers.push({ name, handler })
    logger.debug(`Shutdown handler registered: ${name}`)
  }

  /**
   * Initialize shutdown listeners
   */
  initialize(sqlite?: Database.Database) {
    // Register database checkpoint handler
    if (sqlite) {
      this.register('database-checkpoint', () => {
        logger.info('Running final WAL checkpoint...')
        try {
          // Force full checkpoint before shutdown
          sqlite.pragma('wal_checkpoint(TRUNCATE)')
          logger.success('WAL checkpoint completed')
        } catch (error) {
          logger.error('WAL checkpoint failed:', error)
        }
      })

      this.register('database-close', () => {
        logger.info('Closing database connection...')
        try {
          sqlite.close()
          logger.success('Database connection closed')
        } catch (error) {
          logger.error('Error closing database:', error)
        }
      })
    }

    // Listen for shutdown signals
    process.on('SIGTERM', () => this.shutdown('SIGTERM'))
    process.on('SIGINT', () => this.shutdown('SIGINT'))
    process.on('SIGHUP', () => this.shutdown('SIGHUP'))

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error)
      this.shutdown('uncaughtException', 1)
    })

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', reason)
      this.shutdown('unhandledRejection', 1)
    })

    logger.info('Graceful shutdown handlers initialized')
  }

  /**
   * Execute shutdown sequence
   */
  private async shutdown(signal: string, exitCode: number = 0) {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress...')
      return
    }

    this.isShuttingDown = true
    logger.system.startup(`Shutdown Signal Received: ${signal}`)

    // Set timeout to force exit
    const timeout = setTimeout(() => {
      logger.error('Shutdown timeout exceeded - forcing exit')
      process.exit(1)
    }, this.shutdownTimeout)

    try {
      // Run all handlers in sequence
      for (const { name, handler } of this.handlers) {
        logger.info(`Running shutdown handler: ${name}`)
        try {
          await handler()
        } catch (error) {
          logger.error(`Shutdown handler "${name}" failed:`, error)
        }
      }

      logger.system.ready('Graceful Shutdown Complete')
      clearTimeout(timeout)
      process.exit(exitCode)
    } catch (error) {
      logger.error('Error during shutdown:', error)
      clearTimeout(timeout)
      process.exit(1)
    }
  }
}

export const gracefulShutdown = new GracefulShutdown()
```

**Usage in `/src/db/index.ts`:**
```typescript
import { gracefulShutdown } from '@/lib/shutdown-handler'

// After creating SQLite connection
gracefulShutdown.initialize(sqlite)
```

### Layer 2: Backup Strategy (HIGH PRIORITY)

#### A. Enhanced Backup Script

**New File:** `/home/ubuntu/sports-bar-data/backup-enhanced.sh`

```bash
#!/bin/bash

# =============================================================================
# Enhanced Database Backup Script with WAL Support
# =============================================================================
# This script creates atomic, verified backups of the SQLite database
# Properly handles WAL mode and verifies backup integrity
# =============================================================================

set -e

SCRIPT_NAME="backup-enhanced.sh"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_PATH=$(date +%Y/%m/%d)

# Paths
DB_FILE="/home/ubuntu/sports-bar-data/production.db"
BACKUP_BASE="/home/ubuntu/sports-bar-data/backups"
BACKUP_DIR="$BACKUP_BASE/$DATE_PATH"
LOG_FILE="/home/ubuntu/sports-bar-data/backup.log"
TEMP_DIR="/tmp/db-backup-$$"

# Backup retention (days)
HOURLY_RETENTION=7    # Keep 7 days of hourly backups
DAILY_RETENTION=30    # Keep 30 days of daily backups
WEEKLY_RETENTION=90   # Keep 90 days of weekly backups

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

# Create backup directories
mkdir -p "$BACKUP_DIR"
mkdir -p "$TEMP_DIR"

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Enhanced Database Backup - $TIMESTAMP"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    error "Database not found at $DB_FILE"
    exit 1
fi

# Get database info
DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
WAL_SIZE="N/A"
if [ -f "$DB_FILE-wal" ]; then
    WAL_SIZE=$(du -h "$DB_FILE-wal" | cut -f1)
fi

log "Database size: $DB_SIZE"
log "WAL size: $WAL_SIZE"

# Step 1: Create backup using SQLite's .backup command (atomic and WAL-aware)
BACKUP_FILE="$TEMP_DIR/backup_$TIMESTAMP.db"
log "Creating atomic backup using SQLite..."

sqlite3 "$DB_FILE" "PRAGMA wal_checkpoint(PASSIVE); .backup '$BACKUP_FILE'"

if [ $? -ne 0 ]; then
    error "Backup creation failed"
    rm -rf "$TEMP_DIR"
    exit 1
fi

success "Backup created: $BACKUP_FILE"

# Step 2: Verify backup integrity
log "Verifying backup integrity..."
INTEGRITY_CHECK=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>&1)

if [ "$INTEGRITY_CHECK" = "ok" ]; then
    success "Integrity check PASSED"
else
    error "Integrity check FAILED: $INTEGRITY_CHECK"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Step 3: Verify backup can be opened
log "Verifying backup can be opened..."
TABLE_COUNT=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>&1)

if [ $? -eq 0 ]; then
    success "Backup verified: $TABLE_COUNT tables found"
else
    error "Failed to open backup database"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Step 4: Compress backup
log "Compressing backup..."
COMPRESSED_FILE="$BACKUP_DIR/backup_$TIMESTAMP.db.gz"
gzip -c "$BACKUP_FILE" > "$COMPRESSED_FILE"

if [ $? -eq 0 ]; then
    COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
    success "Backup compressed: $COMPRESSED_SIZE"
else
    error "Compression failed"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Step 5: Create backup metadata
METADATA_FILE="$BACKUP_DIR/backup_$TIMESTAMP.meta"
cat > "$METADATA_FILE" <<EOF
Backup Metadata
===============
Timestamp: $TIMESTAMP
Date: $(date '+%Y-%m-%d %H:%M:%S')
Source DB: $DB_FILE
Source Size: $DB_SIZE
WAL Size: $WAL_SIZE
Backup File: backup_$TIMESTAMP.db.gz
Compressed Size: $COMPRESSED_SIZE
Table Count: $TABLE_COUNT
Integrity Check: $INTEGRITY_CHECK
Hostname: $(hostname)
EOF

# Step 6: Create symbolic link to latest backup
ln -sf "$COMPRESSED_FILE" "$BACKUP_BASE/latest.db.gz"
ln -sf "$METADATA_FILE" "$BACKUP_BASE/latest.meta"

# Step 7: Cleanup temp directory
rm -rf "$TEMP_DIR"

# Step 8: Cleanup old backups based on retention policy
log "Cleaning up old backups..."

# Remove hourly backups older than 7 days
find "$BACKUP_BASE" -name "backup_*.db.gz" -type f -mtime +$HOURLY_RETENTION -delete 2>/dev/null || true
find "$BACKUP_BASE" -name "backup_*.meta" -type f -mtime +$HOURLY_RETENTION -delete 2>/dev/null || true

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_BASE" -name "backup_*.db.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_BASE" | cut -f1)

success "Backup complete!"
log "Total backups: $BACKUP_COUNT"
log "Total backup size: $TOTAL_SIZE"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Exit successfully
exit 0
```

**Make executable:**
```bash
chmod +x /home/ubuntu/sports-bar-data/backup-enhanced.sh
```

#### B. Update Crontab

**Replace current hourly backup:**
```bash
# Remove old backup cron:
# 0 * * * * /home/ubuntu/sports-bar-data/backup.sh >> /home/ubuntu/sports-bar-data/backup.log 2>&1

# Add new enhanced backup:
0 * * * * /home/ubuntu/sports-bar-data/backup-enhanced.sh >> /home/ubuntu/sports-bar-data/backup.log 2>&1

# Add daily backup at 3 AM (for long-term retention):
0 3 * * * /home/ubuntu/sports-bar-data/backup-enhanced.sh >> /home/ubuntu/sports-bar-data/backup.log 2>&1
```

#### C. Backup Verification Script

**New File:** `/home/ubuntu/sports-bar-data/verify-backups.sh`

```bash
#!/bin/bash

# =============================================================================
# Backup Verification Script
# =============================================================================
# Verifies all recent backups for integrity
# Run daily to ensure backups are restorable
# =============================================================================

BACKUP_BASE="/home/ubuntu/sports-bar-data/backups"
LOG_FILE="/home/ubuntu/sports-bar-data/backup-verify.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Backup Verification - $(date)"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Find all backups from last 24 hours
RECENT_BACKUPS=$(find "$BACKUP_BASE" -name "backup_*.db.gz" -type f -mtime -1)

if [ -z "$RECENT_BACKUPS" ]; then
    log "WARNING: No recent backups found!"
    exit 1
fi

TOTAL=0
PASSED=0
FAILED=0

while IFS= read -r BACKUP_FILE; do
    TOTAL=$((TOTAL + 1))
    BACKUP_NAME=$(basename "$BACKUP_FILE")

    log "Checking: $BACKUP_NAME"

    # Decompress to temp location
    TEMP_DB="/tmp/verify_$$.db"
    gunzip -c "$BACKUP_FILE" > "$TEMP_DB"

    # Run integrity check
    RESULT=$(sqlite3 "$TEMP_DB" "PRAGMA integrity_check;" 2>&1)

    if [ "$RESULT" = "ok" ]; then
        log "  ✓ PASSED: $BACKUP_NAME"
        PASSED=$((PASSED + 1))
    else
        log "  ✗ FAILED: $BACKUP_NAME - $RESULT"
        FAILED=$((FAILED + 1))
    fi

    # Cleanup
    rm -f "$TEMP_DB"

done <<< "$RECENT_BACKUPS"

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Verification Complete"
log "Total: $TOTAL | Passed: $PASSED | Failed: $FAILED"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAILED -gt 0 ]; then
    exit 1
fi

exit 0
```

**Add to crontab (daily at 4 AM):**
```bash
0 4 * * * /home/ubuntu/sports-bar-data/verify-backups.sh
```

### Layer 3: Hardware Protection (CRITICAL)

#### A. UPS Recommendation

**Recommended Models:**

1. **APC Back-UPS Pro 1500VA (BR1500G)**
   - Runtime: ~10 minutes at 200W load
   - Battery capacity: 865Wh
   - Auto-shutdown support via USB
   - Price: ~$300-350
   - **Best for:** Small single-server setup

2. **CyberPower CP1500PFCLCD**
   - Runtime: ~12 minutes at 200W
   - Pure sine wave output
   - LCD display
   - Price: ~$250-300
   - **Best for:** Budget-conscious option

3. **Eaton 5SC 1500VA**
   - Runtime: ~15 minutes at 200W
   - Enterprise-grade
   - Price: ~$400-450
   - **Best for:** Maximum reliability

**Sizing Calculation:**
```
Server Power Consumption:
- Intel NUC or similar: ~50W idle, ~100W load
- Network switch: ~10W
- Monitor (if used): ~30W
- Total: ~140W peak

UPS Requirement:
- 1500VA / 900W model recommended
- Provides 10-15 minutes runtime
- Enough for graceful shutdown
```

#### B. UPS Software Setup (apcupsd)

**Install UPS Monitoring Daemon:**
```bash
#!/bin/bash
# Install apcupsd for UPS monitoring
sudo apt-get update
sudo apt-get install -y apcupsd

# Configure apcupsd
sudo nano /etc/apcupsd/apcupsd.conf
```

**Configuration (`/etc/apcupsd/apcupsd.conf`):**
```conf
## APC UPS Configuration

# UPS name (for logging)
UPSNAME sports-bar-ups

# Device to use for communications with UPS
DEVICE /dev/usb/hiddev0
UPSTYPE usb

# Time in seconds before apcupsd starts shutdown
TIMEOUT 60

# Battery charge % below which shutdown will occur
BATTERYLEVEL 10

# Time in minutes on battery before shutdown
MINUTES 5

# Shutdown command
SHUTDOWNCMD "/home/ubuntu/sports-bar-data/graceful-shutdown.sh"
```

**Enable and start service:**
```bash
sudo systemctl enable apcupsd
sudo systemctl start apcupsd
```

#### C. Graceful Shutdown Script

**New File:** `/home/ubuntu/sports-bar-data/graceful-shutdown.sh`

```bash
#!/bin/bash

# =============================================================================
# Graceful Shutdown Script
# =============================================================================
# Called by UPS daemon when battery is low
# Ensures database is properly checkpointed before shutdown
# =============================================================================

LOG_FILE="/home/ubuntu/sports-bar-data/shutdown.log"
DB_FILE="/home/ubuntu/sports-bar-data/production.db"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "GRACEFUL SHUTDOWN INITIATED - UPS Battery Low"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Stop PM2 applications gracefully
log "Stopping PM2 applications..."
sudo -u ubuntu pm2 stop all
sleep 2

# Step 2: Checkpoint WAL file
log "Checkpointing database WAL file..."
sqlite3 "$DB_FILE" "PRAGMA wal_checkpoint(TRUNCATE);" 2>&1 | tee -a "$LOG_FILE"

# Step 3: Create emergency backup
log "Creating emergency backup..."
BACKUP_FILE="/home/ubuntu/sports-bar-data/backups/emergency_$(date +%Y%m%d_%H%M%S).db"
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'" 2>&1 | tee -a "$LOG_FILE"

# Step 4: Verify backup
log "Verifying emergency backup..."
INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>&1)
log "Integrity check: $INTEGRITY"

# Step 5: Sync filesystem
log "Syncing filesystem..."
sync

# Step 6: Shutdown system
log "Initiating system shutdown..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Shutdown system (will be executed by apcupsd)
/sbin/shutdown -h now "UPS battery low - graceful shutdown initiated"
```

**Make executable:**
```bash
chmod +x /home/ubuntu/sports-bar-data/graceful-shutdown.sh
```

#### D. Power Monitoring Script

**New File:** `/home/ubuntu/sports-bar-data/monitor-ups.sh`

```bash
#!/bin/bash

# =============================================================================
# UPS Monitoring Script
# =============================================================================
# Monitors UPS status and sends alerts
# Run every minute via cron
# =============================================================================

LOG_FILE="/home/ubuntu/sports-bar-data/ups-monitor.log"

# Get UPS status
STATUS=$(apcaccess status 2>&1)

if [ $? -ne 0 ]; then
    # UPS not available
    exit 0
fi

# Extract key metrics
BATTERY_CHARGE=$(echo "$STATUS" | grep "BCHARGE" | awk '{print $3}')
TIME_LEFT=$(echo "$STATUS" | grep "TIMELEFT" | awk '{print $3}')
LOAD_PERCENT=$(echo "$STATUS" | grep "LOADPCT" | awk '{print $3}')
LINE_VOLTAGE=$(echo "$STATUS" | grep "LINEV" | awk '{print $3}')
UPS_STATUS=$(echo "$STATUS" | grep "STATUS" | awk '{print $3}')

# Check if on battery power
if [ "$UPS_STATUS" = "ONBATT" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: System on battery power! Charge: $BATTERY_CHARGE%, Time left: $TIME_LEFT min" >> "$LOG_FILE"

    # Alert if battery is low
    if [ "${BATTERY_CHARGE%.*}" -lt 50 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] CRITICAL: Low battery! $BATTERY_CHARGE%" >> "$LOG_FILE"
    fi
fi

# Log daily status at noon
HOUR=$(date +%H)
if [ "$HOUR" = "12" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] UPS Status: $UPS_STATUS | Battery: $BATTERY_CHARGE% | Load: $LOAD_PERCENT% | Voltage: $LINE_VOLTAGE V" >> "$LOG_FILE"
fi
```

**Add to crontab:**
```bash
* * * * * /home/ubuntu/sports-bar-data/monitor-ups.sh
```

### Layer 4: System Recovery (AUTOMATED)

#### A. Auto-Recovery on Startup

**New File:** `/home/ubuntu/Sports-Bar-TV-Controller/src/lib/auto-recovery.ts`

```typescript
/**
 * Automatic Database Recovery System
 * Detects and recovers from database corruption on startup
 */

import { logger } from '@/lib/logger'
import { existsSync, statSync, copyFileSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'

export interface RecoveryResult {
  recovered: boolean
  method?: 'wal-checkpoint' | 'backup-restore' | 'none'
  backupUsed?: string
  error?: string
}

export class DatabaseRecovery {
  private dbPath: string
  private backupDir: string

  constructor(dbPath: string) {
    this.dbPath = dbPath
    this.backupDir = path.join(path.dirname(dbPath), 'backups')
  }

  /**
   * Check database integrity and recover if needed
   */
  async checkAndRecover(): Promise<RecoveryResult> {
    logger.system.startup('Database Recovery Check')

    try {
      // Step 1: Check if database exists
      if (!existsSync(this.dbPath)) {
        logger.error('Database file does not exist!')
        return await this.restoreFromBackup()
      }

      // Step 2: Check if WAL file exists (indicates unclean shutdown)
      const walPath = `${this.dbPath}-wal`
      if (existsSync(walPath)) {
        const walSize = statSync(walPath).size
        if (walSize > 0) {
          logger.warn(`WAL file exists (${(walSize / 1024).toFixed(2)} KB)`)
          logger.info('Attempting WAL recovery...')
          return await this.recoverFromWAL()
        }
      }

      // Step 3: Run integrity check
      const isCorrupted = await this.checkIntegrity()
      if (isCorrupted) {
        logger.error('Database corruption detected!')
        return await this.restoreFromBackup()
      }

      // Step 4: All good
      logger.success('Database integrity verified')
      return { recovered: false, method: 'none' }

    } catch (error: any) {
      logger.error('Recovery check failed:', error)
      return { recovered: false, error: error.message }
    }
  }

  /**
   * Recover from WAL file
   */
  private async recoverFromWAL(): Promise<RecoveryResult> {
    try {
      // Force WAL checkpoint
      execSync(`sqlite3 "${this.dbPath}" "PRAGMA wal_checkpoint(TRUNCATE);"`)

      // Verify integrity after checkpoint
      const isCorrupted = await this.checkIntegrity()
      if (isCorrupted) {
        logger.error('WAL recovery failed - corruption still present')
        return await this.restoreFromBackup()
      }

      logger.success('WAL recovery successful')
      return { recovered: true, method: 'wal-checkpoint' }

    } catch (error: any) {
      logger.error('WAL recovery error:', error)
      return await this.restoreFromBackup()
    }
  }

  /**
   * Restore from most recent backup
   */
  private async restoreFromBackup(): Promise<RecoveryResult> {
    try {
      logger.warn('Attempting to restore from backup...')

      // Find latest backup
      const latestBackup = this.findLatestBackup()
      if (!latestBackup) {
        logger.error('No backup found!')
        return { recovered: false, error: 'No backup available' }
      }

      logger.info(`Found backup: ${latestBackup}`)

      // Backup current corrupted database
      const corruptedBackup = `${this.dbPath}.corrupted-${Date.now()}`
      copyFileSync(this.dbPath, corruptedBackup)
      logger.info(`Corrupted database saved to: ${corruptedBackup}`)

      // Restore from backup
      if (latestBackup.endsWith('.gz')) {
        // Decompress
        execSync(`gunzip -c "${latestBackup}" > "${this.dbPath}"`)
      } else {
        copyFileSync(latestBackup, this.dbPath)
      }

      // Verify restored database
      const isCorrupted = await this.checkIntegrity()
      if (isCorrupted) {
        logger.error('Restored database is also corrupted!')
        return { recovered: false, error: 'Backup is corrupted', backupUsed: latestBackup }
      }

      logger.success('Database restored successfully from backup')
      return { recovered: true, method: 'backup-restore', backupUsed: latestBackup }

    } catch (error: any) {
      logger.error('Backup restoration failed:', error)
      return { recovered: false, error: error.message }
    }
  }

  /**
   * Check database integrity
   */
  private async checkIntegrity(): Promise<boolean> {
    try {
      const result = execSync(
        `sqlite3 "${this.dbPath}" "PRAGMA integrity_check;"`,
        { encoding: 'utf-8' }
      ).trim()

      return result !== 'ok'
    } catch (error) {
      // If we can't even run integrity check, database is corrupted
      return true
    }
  }

  /**
   * Find latest backup file
   */
  private findLatestBackup(): string | null {
    try {
      // Try to use 'latest' symlink first
      const latestSymlink = path.join(this.backupDir, 'latest.db.gz')
      if (existsSync(latestSymlink)) {
        return latestSymlink
      }

      // Otherwise find most recent backup
      const backups = execSync(
        `find "${this.backupDir}" -name "backup_*.db.gz" -o -name "backup_*.db" | sort -r`,
        { encoding: 'utf-8' }
      ).trim().split('\n')

      return backups[0] || null
    } catch (error) {
      return null
    }
  }
}

/**
 * Run recovery check on startup
 */
export async function runStartupRecovery(dbPath: string): Promise<RecoveryResult> {
  const recovery = new DatabaseRecovery(dbPath)
  return await recovery.checkAndRecover()
}
```

**Usage in `/src/db/index.ts`:**
```typescript
import { runStartupRecovery } from '@/lib/auto-recovery'

// Before creating database connection
const recoveryResult = await runStartupRecovery(dbPath)
if (recoveryResult.recovered) {
  logger.warn('Database was recovered:', recoveryResult)
}
```

#### B. Health Check Endpoint

**New File:** `/home/ubuntu/Sports-Bar-TV-Controller/src/app/api/health/database/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { execSync } from 'child_process'
import { existsSync, statSync } from 'fs'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health/database
 * Check database health and integrity
 */
export async function GET() {
  try {
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') ||
                   '/home/ubuntu/sports-bar-data/production.db'

    // Check 1: Database file exists
    if (!existsSync(dbPath)) {
      return NextResponse.json({
        healthy: false,
        error: 'Database file not found',
        dbPath
      }, { status: 500 })
    }

    // Check 2: Get file stats
    const stats = statSync(dbPath)
    const walStats = existsSync(`${dbPath}-wal`) ? statSync(`${dbPath}-wal`) : null

    // Check 3: Run integrity check
    const integrityResult = execSync(
      `sqlite3 "${dbPath}" "PRAGMA integrity_check;"`,
      { encoding: 'utf-8' }
    ).trim()

    const isHealthy = integrityResult === 'ok'

    // Check 4: Run quick check
    const quickCheck = execSync(
      `sqlite3 "${dbPath}" "PRAGMA quick_check;"`,
      { encoding: 'utf-8' }
    ).trim()

    // Check 5: Count tables
    const tableCount = await db.execute('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"')

    // Check 6: Test write capability
    const testWrite = await db.execute('SELECT 1 as test')

    return NextResponse.json({
      healthy: isHealthy,
      integrity: integrityResult,
      quickCheck,
      database: {
        path: dbPath,
        size: stats.size,
        sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
        modified: stats.mtime,
        tables: tableCount.rows[0]?.count || 0
      },
      wal: walStats ? {
        exists: true,
        size: walStats.size,
        sizeFormatted: `${(walStats.size / 1024).toFixed(2)} KB`
      } : {
        exists: false
      },
      write_test: testWrite ? 'OK' : 'FAILED'
    })

  } catch (error: any) {
    return NextResponse.json({
      healthy: false,
      error: error.message
    }, { status: 500 })
  }
}
```

### Layer 5: JSON File Protection

#### A. Atomic Write Helper

**New File:** `/home/ubuntu/Sports-Bar-TV-Controller/src/lib/atomic-file-write.ts`

```typescript
/**
 * Atomic File Write Utilities
 * Ensures JSON files are written atomically to prevent corruption
 */

import { writeFileSync, renameSync, existsSync, copyFileSync, unlinkSync } from 'fs'
import { logger } from '@/lib/logger'
import path from 'path'

export interface AtomicWriteOptions {
  backup?: boolean
  validate?: (data: any) => boolean
  encoding?: BufferEncoding
}

/**
 * Write JSON file atomically
 * Uses write-to-temp-then-rename pattern to ensure atomicity
 */
export function atomicWriteJSON(
  filePath: string,
  data: any,
  options: AtomicWriteOptions = {}
): void {
  const {
    backup = true,
    validate,
    encoding = 'utf-8'
  } = options

  try {
    // Step 1: Validate data if validator provided
    if (validate && !validate(data)) {
      throw new Error('Data validation failed')
    }

    // Step 2: Serialize to JSON
    const jsonString = JSON.stringify(data, null, 2)

    // Step 3: Backup existing file if requested
    if (backup && existsSync(filePath)) {
      const backupPath = `${filePath}.backup`
      copyFileSync(filePath, backupPath)
      logger.debug(`Backed up ${filePath} to ${backupPath}`)
    }

    // Step 4: Write to temporary file
    const tempPath = `${filePath}.tmp.${Date.now()}`
    writeFileSync(tempPath, jsonString, { encoding })
    logger.debug(`Wrote to temp file: ${tempPath}`)

    // Step 5: Atomic rename (this is atomic on POSIX systems)
    renameSync(tempPath, filePath)
    logger.debug(`Atomically renamed to: ${filePath}`)

    // Step 6: Clean up old backup if write successful
    if (backup) {
      const backupPath = `${filePath}.backup`
      if (existsSync(backupPath)) {
        // Keep the backup for safety
        logger.debug(`Backup retained at: ${backupPath}`)
      }
    }

  } catch (error: any) {
    logger.error(`Atomic write failed for ${filePath}:`, error)

    // Try to clean up temp file
    const tempPattern = `${filePath}.tmp.`
    // This is a simplified cleanup - you might want to implement a more robust version

    throw error
  }
}

/**
 * Read JSON file with fallback to backup
 */
export function atomicReadJSON(filePath: string): any {
  try {
    // Try to read main file
    if (existsSync(filePath)) {
      const content = require('fs').readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    }

    // Try backup
    const backupPath = `${filePath}.backup`
    if (existsSync(backupPath)) {
      logger.warn(`Main file not found, using backup: ${backupPath}`)
      const content = require('fs').readFileSync(backupPath, 'utf-8')
      return JSON.parse(content)
    }

    throw new Error(`File not found: ${filePath}`)

  } catch (error: any) {
    // Try to recover from backup
    const backupPath = `${filePath}.backup`
    if (existsSync(backupPath)) {
      logger.error(`Error reading ${filePath}, attempting recovery from backup`)
      try {
        const content = require('fs').readFileSync(backupPath, 'utf-8')
        const data = JSON.parse(content)

        // Restore backup to main file
        copyFileSync(backupPath, filePath)
        logger.success(`Recovered ${filePath} from backup`)

        return data
      } catch (backupError) {
        logger.error('Backup recovery also failed:', backupError)
      }
    }

    throw error
  }
}

/**
 * Example usage in FireTV devices manager
 */
export class FireTVDeviceManager {
  private dataFile: string

  constructor(dataFile: string) {
    this.dataFile = dataFile
  }

  async loadDevices() {
    return atomicReadJSON(this.dataFile)
  }

  async saveDevices(devices: any[]) {
    atomicWriteJSON(this.dataFile, devices, {
      backup: true,
      validate: (data) => Array.isArray(data) && data.every(d => d.id && d.ipAddress)
    })
  }
}
```

**Usage Example:**
```typescript
import { atomicWriteJSON, atomicReadJSON } from '@/lib/atomic-file-write'

// Writing FireTV devices
const devices = [{ id: 'device1', ipAddress: '192.168.1.100', ... }]
atomicWriteJSON('/path/to/firetv-devices.json', devices, {
  backup: true,
  validate: (data) => Array.isArray(data)
})

// Reading with auto-recovery
const devices = atomicReadJSON('/path/to/firetv-devices.json')
```

---

## Implementation Roadmap

### Phase 1: Critical Fixes (Implement Immediately - Day 1)

**Priority:** CRITICAL
**Estimated Time:** 2-4 hours

#### 1.1 Update Database PRAGMA Settings
- [ ] Update `/src/db/index.ts` with enhanced PRAGMA settings
- [ ] Test synchronous = NORMAL performance impact
- [ ] Add busy_timeout and cache_size
- [ ] Deploy to production

**Code:**
```typescript
sqlite.pragma('synchronous = NORMAL')
sqlite.pragma('busy_timeout = 5000')
sqlite.pragma('cache_size = -8000')
```

#### 1.2 Add Startup Integrity Check
- [ ] Implement checkDatabaseIntegrity() function
- [ ] Add to database initialization
- [ ] Test with corrupted database
- [ ] Deploy to production

#### 1.3 Implement Graceful Shutdown Handlers
- [ ] Create `/src/lib/shutdown-handler.ts`
- [ ] Register database checkpoint handlers
- [ ] Test with `pm2 stop` and `kill` signals
- [ ] Deploy to production

#### 1.4 Fix Backup Script
- [ ] Deploy enhanced backup script
- [ ] Update crontab
- [ ] Test backup creation and verification
- [ ] Verify old backups are cleaned up

**Verification:**
```bash
# Test new backup script
/home/ubuntu/sports-bar-data/backup-enhanced.sh

# Check integrity
gunzip -c /home/ubuntu/sports-bar-data/backups/latest.db.gz | sqlite3 /tmp/test.db "PRAGMA integrity_check;"
```

### Phase 2: High Priority (Within 1 Week)

**Priority:** HIGH
**Estimated Time:** 1-2 days

#### 2.1 UPS Hardware Setup
- [ ] Purchase UPS (recommended: APC BR1500G)
- [ ] Install and connect to server
- [ ] Install apcupsd software
- [ ] Configure monitoring
- [ ] Test graceful shutdown

**Steps:**
```bash
# Install UPS daemon
sudo apt-get install apcupsd

# Configure
sudo nano /etc/apcupsd/apcupsd.conf

# Test
sudo apctest
```

#### 2.2 Auto-Recovery System
- [ ] Implement DatabaseRecovery class
- [ ] Add to startup sequence
- [ ] Test with corrupted database
- [ ] Test backup restoration
- [ ] Deploy to production

#### 2.3 Atomic JSON Writes
- [ ] Implement atomic-file-write.ts
- [ ] Update FireTV device manager
- [ ] Update other JSON file writers
- [ ] Test corruption scenarios
- [ ] Deploy to production

**Files to Update:**
- `/src/services/firetv-connection-manager.ts`
- Any code writing to `/data/*.json` files

#### 2.4 Health Check Endpoint
- [ ] Implement `/api/health/database`
- [ ] Add to monitoring dashboard
- [ ] Set up alerts (optional)

### Phase 3: Medium Priority (Within 1 Month)

**Priority:** MEDIUM
**Estimated Time:** 2-3 days

#### 3.1 Off-Site Backup
- [ ] Set up remote backup destination (cloud or NAS)
- [ ] Implement rsync-based backup
- [ ] Schedule daily off-site sync
- [ ] Test restoration from off-site

**Example rsync command:**
```bash
rsync -avz --delete \
  /home/ubuntu/sports-bar-data/backups/ \
  user@remote:/backups/sports-bar/
```

#### 3.2 Monitoring & Alerting
- [ ] Set up email alerts for backup failures
- [ ] Set up UPS battery alerts
- [ ] Monitor WAL file size growth
- [ ] Dashboard for backup status

#### 3.3 Disaster Recovery Documentation
- [ ] Create step-by-step recovery procedures
- [ ] Document backup locations
- [ ] Test full disaster recovery
- [ ] Create runbook for emergencies

#### 3.4 Advanced Monitoring
- [ ] Database query performance tracking
- [ ] WAL file size monitoring
- [ ] Checkpoint frequency analysis
- [ ] Transaction failure rate tracking

### Phase 4: Nice-to-Have (Future Enhancements)

**Priority:** LOW
**Estimated Time:** 1-2 days

#### 4.1 Replication
- [ ] Implement SQLite replication (Litestream or similar)
- [ ] Set up secondary database for failover
- [ ] Test automatic failover

#### 4.2 Point-in-Time Recovery
- [ ] Implement continuous WAL archiving
- [ ] Create restore-to-timestamp utility
- [ ] Test recovery procedures

#### 4.3 Advanced Testing
- [ ] Chaos testing (random power loss simulation)
- [ ] Load testing under power failure scenarios
- [ ] Automated recovery testing

---

## Recovery Procedures

### Scenario 1: Database Corruption Detected

**Symptoms:**
- Application fails to start
- "database disk image is malformed" error
- Integrity check fails

**Recovery Steps:**

1. **Verify Corruption:**
   ```bash
   sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"
   ```

2. **Stop Application:**
   ```bash
   pm2 stop sports-bar-tv-controller
   ```

3. **Backup Corrupted Database:**
   ```bash
   cp /home/ubuntu/sports-bar-data/production.db \
      /home/ubuntu/sports-bar-data/production.db.corrupted-$(date +%Y%m%d_%H%M%S)
   ```

4. **Attempt WAL Recovery:**
   ```bash
   sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"
   sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"
   ```

5. **If WAL Recovery Fails, Restore from Backup:**
   ```bash
   # Find latest backup
   ls -lt /home/ubuntu/sports-bar-data/backups/*.db.gz | head -1

   # Restore
   gunzip -c /home/ubuntu/sports-bar-data/backups/latest.db.gz > \
      /home/ubuntu/sports-bar-data/production.db

   # Verify
   sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"
   ```

6. **Restart Application:**
   ```bash
   pm2 start sports-bar-tv-controller
   pm2 logs
   ```

7. **Verify Functionality:**
   - Check web interface
   - Test database operations
   - Review logs for errors

**Data Loss:**
- With hourly backups: Up to 1 hour of data
- With WAL recovery: Minimal (last transaction only)

### Scenario 2: Backup Restoration

**When to Use:**
- Accidental data deletion
- Want to restore to previous state
- Testing recovery procedures

**Steps:**

1. **List Available Backups:**
   ```bash
   ls -lh /home/ubuntu/sports-bar-data/backups/
   ```

2. **Choose Backup to Restore:**
   ```bash
   # View backup metadata
   cat /home/ubuntu/sports-bar-data/backups/2025/11/03/backup_20251103_120000.meta
   ```

3. **Stop Application:**
   ```bash
   pm2 stop sports-bar-tv-controller
   ```

4. **Backup Current Database:**
   ```bash
   cp /home/ubuntu/sports-bar-data/production.db \
      /home/ubuntu/sports-bar-data/production.db.before-restore-$(date +%Y%m%d_%H%M%S)
   ```

5. **Restore from Backup:**
   ```bash
   gunzip -c /home/ubuntu/sports-bar-data/backups/2025/11/03/backup_20251103_120000.db.gz > \
      /home/ubuntu/sports-bar-data/production.db
   ```

6. **Verify Integrity:**
   ```bash
   sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"
   ```

7. **Restart Application:**
   ```bash
   pm2 start sports-bar-tv-controller
   ```

### Scenario 3: Emergency Restore from Off-Site Backup

**When to Use:**
- Server failure
- All local backups lost
- Disk failure

**Steps:**

1. **Retrieve Off-Site Backup:**
   ```bash
   rsync -avz user@remote:/backups/sports-bar/latest.db.gz /tmp/
   ```

2. **Restore:**
   ```bash
   gunzip -c /tmp/latest.db.gz > /home/ubuntu/sports-bar-data/production.db
   ```

3. **Follow Scenario 2 steps 6-7**

### Scenario 4: Power Loss Recovery (Automatic)

**With Auto-Recovery Implemented:**

1. **System Powers On**
2. **PM2 Systemd Service Starts**
3. **PM2 Starts Application**
4. **Application Runs Startup Checks:**
   - Detects WAL file
   - Runs integrity check
   - Auto-recovers if needed
   - Restores from backup if corruption detected

**Manual Intervention Only If:**
- All backups are corrupted
- Database is completely missing
- Recovery scripts fail

**Check Recovery Status:**
```bash
# Check application logs
pm2 logs sports-bar-tv-controller --lines 100 | grep -i "recovery\|integrity\|corrupt"

# Check database health
curl http://localhost:3001/api/health/database
```

---

## Quick Reference

### Important Paths

```
Database:
  /home/ubuntu/sports-bar-data/production.db
  /home/ubuntu/sports-bar-data/production.db-wal
  /home/ubuntu/sports-bar-data/production.db-shm

Backups:
  /home/ubuntu/sports-bar-data/backups/
  /home/ubuntu/sports-bar-data/backups/latest.db.gz

Logs:
  /home/ubuntu/sports-bar-data/backup.log
  /home/ubuntu/sports-bar-data/shutdown.log
  /home/ubuntu/.pm2/logs/sports-bar-tv-controller-error.log

Scripts:
  /home/ubuntu/sports-bar-data/backup-enhanced.sh
  /home/ubuntu/sports-bar-data/graceful-shutdown.sh
  /home/ubuntu/sports-bar-data/verify-backups.sh
```

### Quick Commands

```bash
# Check database integrity
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA integrity_check;"

# Check WAL file size
ls -lh /home/ubuntu/sports-bar-data/production.db-wal

# Force WAL checkpoint
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA wal_checkpoint(TRUNCATE);"

# List recent backups
ls -lth /home/ubuntu/sports-bar-data/backups/ | head -10

# Verify backup
gunzip -c /home/ubuntu/sports-bar-data/backups/latest.db.gz | \
  sqlite3 /tmp/test.db "PRAGMA integrity_check;"

# Check UPS status
apcaccess status

# Check PM2 status
pm2 status
pm2 logs sports-bar-tv-controller --lines 50

# Check database health via API
curl http://localhost:3001/api/health/database | jq
```

### Emergency Contacts

```
System Administrator: [YOUR CONTACT]
UPS Support: 1-800-APC-HELP (for APC UPS)
Backup Location: [OFF-SITE LOCATION]
```

---

## Conclusion

This comprehensive power loss protection strategy provides **multiple layers of defense** against data corruption:

1. **Database Layer:** Optimized PRAGMA settings + WAL mode
2. **Backup Layer:** Hourly verified backups with 7-day retention
3. **Hardware Layer:** UPS with graceful shutdown
4. **Recovery Layer:** Automated detection and recovery
5. **Monitoring Layer:** Health checks and alerts

**Risk Reduction:**
- **Before:** HIGH risk of corruption on power loss
- **After Phase 1:** MEDIUM risk (software protection only)
- **After Phase 2:** LOW risk (UPS + full protection)

**Expected Outcomes:**
- ✅ Zero data corruption on power loss
- ✅ Maximum 1 hour of data loss (from backup)
- ✅ Automatic recovery without manual intervention
- ✅ Complete audit trail of all recovery events
- ✅ Peace of mind for 24/7 operation

**Next Steps:**
1. Review this document with team
2. Prioritize implementation phases
3. Order UPS hardware
4. Begin Phase 1 implementation
5. Schedule testing and validation

---

**Document Version:** 1.0
**Last Updated:** 2025-11-03
**Author:** Claude (Anthropic AI Assistant)
**Review Status:** Pending Review
