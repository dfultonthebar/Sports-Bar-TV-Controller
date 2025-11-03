# Database Path Cleanup Summary

**Date**: 2025-11-02
**Issue**: Multiple empty database files and incorrect fallback paths causing confusion
**Solution**: Standardized all references to production database at `/home/ubuntu/sports-bar-data/production.db`

## Problem

The system had multiple empty database files scattered across the project:
- `/home/ubuntu/Sports-Bar-TV-Controller/data/sports-bar.db` (0 bytes)
- `/home/ubuntu/Sports-Bar-TV-Controller/data/sqlite.db` (0 bytes)
- `/home/ubuntu/Sports-Bar-TV-Controller/data/tv-controller.db` (0 bytes)
- `/home/ubuntu/Sports-Bar-TV-Controller/prisma/dev.db` (0 bytes)
- `/home/ubuntu/Sports-Bar-TV-Controller/prisma/sportsbar.db` (0 bytes)

Additionally, code had incorrect fallback database paths pointing to:
- `./prisma/data/sports_bar.db` (non-existent in production)
- `./data/sports_bar.db` (non-existent)
- `./dev.db` (non-existent)

**Actual Production Database**: `/home/ubuntu/sports-bar-data/production.db` (13.09 MB, 64 tables)

## Actions Taken

### 1. Deleted Empty Database Files

```bash
# Removed from /data/ directory
rm /home/ubuntu/Sports-Bar-TV-Controller/data/sports-bar.db
rm /home/ubuntu/Sports-Bar-TV-Controller/data/sqlite.db
rm /home/ubuntu/Sports-Bar-TV-Controller/data/tv-controller.db

# Removed from /prisma/ directory
rm /home/ubuntu/Sports-Bar-TV-Controller/prisma/dev.db
rm /home/ubuntu/Sports-Bar-TV-Controller/prisma/sportsbar.db
```

**Status**: All empty database files deleted successfully.

### 2. Updated Code References

#### File: `/home/ubuntu/Sports-Bar-TV-Controller/src/db/index.ts`

**Changes**:
- Updated fallback database path from `file:./prisma/data/sports_bar.db` to `file:/home/ubuntu/sports-bar-data/production.db`
- Added startup validation to check database exists and is non-empty
- Added file size validation (rejects 0-byte databases)
- Added detailed error logging if database is misconfigured

**Before**:
```typescript
const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/data/sports_bar.db'
```

**After**:
```typescript
// Production database is at /home/ubuntu/sports-bar-data/production.db
const databaseUrl = process.env.DATABASE_URL || 'file:/home/ubuntu/sports-bar-data/production.db'

// Validate database file exists and is non-empty
import { existsSync, statSync } from 'fs'
if (!existsSync(dbPath)) {
  logger.error(`DATABASE ERROR: Database file not found at ${dbPath}`)
  throw new Error(`Database file not found: ${dbPath}`)
}

const dbStats = statSync(dbPath)
if (dbStats.size === 0) {
  logger.error(`DATABASE ERROR: Database file is empty (0 bytes): ${dbPath}`)
  throw new Error(`Database file is empty: ${dbPath}`)
}
```

#### File: `/home/ubuntu/Sports-Bar-TV-Controller/drizzle.config.ts`

**Changes**:
- Updated fallback database path to production database

**Before**:
```typescript
url: process.env.DATABASE_URL || 'file:./prisma/data/sports_bar.db'
```

**After**:
```typescript
// Production database is at /home/ubuntu/sports-bar-data/production.db
url: process.env.DATABASE_URL || 'file:/home/ubuntu/sports-bar-data/production.db'
```

#### File: `/home/ubuntu/Sports-Bar-TV-Controller/src/app/api/health/route.ts`

**Changes**:
- Updated fallback path in database health check

**Before**:
```typescript
const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './prisma/data/sports_bar.db'
```

**After**:
```typescript
// Production database is at /home/ubuntu/sports-bar-data/production.db
const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '/home/ubuntu/sports-bar-data/production.db'
```

#### File: `/home/ubuntu/Sports-Bar-TV-Controller/test-presets-api.js`

**Changes**:
- Updated to use environment variable or correct fallback

**Before**:
```javascript
const db = new sqlite3.Database('./prisma/data/sports_bar.db');
```

**After**:
```javascript
// Production database is at /home/ubuntu/sports-bar-data/production.db
const db = new sqlite3.Database(process.env.DATABASE_URL?.replace('file:', '') || '/home/ubuntu/sports-bar-data/production.db');
```

### 3. Updated Configuration Files

#### File: `/home/ubuntu/Sports-Bar-TV-Controller/.env.example`

**Changes**:
- Updated DATABASE_URL to point to production database
- Added comments explaining production vs development paths

**Before**:
```bash
DATABASE_URL="file:./dev.db"
```

**After**:
```bash
# Production: file:/home/ubuntu/sports-bar-data/production.db
# Development: file:./dev.db (for local testing only)
DATABASE_URL="file:/home/ubuntu/sports-bar-data/production.db"
```

### 4. Created Verification Script

**File**: `/home/ubuntu/Sports-Bar-TV-Controller/scripts/verify-database-config.sh`

**Purpose**: Automated script to verify database configuration is correct

**Checks**:
1. No empty database files in data/ or prisma/ directories
2. DATABASE_URL environment variable points to production database
3. Production database file exists and is non-empty
4. Database integrity check (SQLite validation)
5. No hardcoded wrong database paths in source code

**Usage**:
```bash
./scripts/verify-database-config.sh
```

**Sample Output**:
```
========================================
Database Configuration Verification
========================================

[1/5] Checking for empty database files...
  ✓ No empty database files found

[2/5] Checking DATABASE_URL environment variable...
  Current DATABASE_URL: /home/ubuntu/sports-bar-data/production.db
  ✓ DATABASE_URL points to correct production database

[3/5] Checking production database file...
  ✓ Database file exists
  ✓ Database size: 13.09 MB

[4/5] Checking database integrity...
  ✓ Database is readable
  ✓ Database has 64 tables
  ✓ Database integrity check passed

[5/5] Checking for hardcoded database paths in code...
  ✓ No hardcoded wrong database paths found in src/

========================================
Verification Summary
========================================

✓ All critical checks passed!
✓ Database is correctly configured at: /home/ubuntu/sports-bar-data/production.db
```

## Files Modified

1. `/home/ubuntu/Sports-Bar-TV-Controller/src/db/index.ts` - Added validation, updated fallback path
2. `/home/ubuntu/Sports-Bar-TV-Controller/drizzle.config.ts` - Updated fallback path
3. `/home/ubuntu/Sports-Bar-TV-Controller/src/app/api/health/route.ts` - Updated fallback path
4. `/home/ubuntu/Sports-Bar-TV-Controller/test-presets-api.js` - Updated to use env var
5. `/home/ubuntu/Sports-Bar-TV-Controller/.env.example` - Updated with correct path and comments
6. `/home/ubuntu/Sports-Bar-TV-Controller/scripts/verify-database-config.sh` - Created (new file)

## Files Deleted

1. `/home/ubuntu/Sports-Bar-TV-Controller/data/sports-bar.db` (0 bytes)
2. `/home/ubuntu/Sports-Bar-TV-Controller/data/sqlite.db` (0 bytes)
3. `/home/ubuntu/Sports-Bar-TV-Controller/data/tv-controller.db` (0 bytes)
4. `/home/ubuntu/Sports-Bar-TV-Controller/prisma/dev.db` (0 bytes)
5. `/home/ubuntu/Sports-Bar-TV-Controller/prisma/sportsbar.db` (0 bytes)

## Verification Results

Ran verification script: **ALL CHECKS PASSED**

```
✓ No empty database files found
✓ DATABASE_URL points to correct production database
✓ Database file exists (13.09 MB)
✓ Database has 64 tables
✓ Database integrity check passed
✓ No hardcoded wrong database paths in source code
```

## Current Database Status

**Production Database**: `/home/ubuntu/sports-bar-data/production.db`
- **Size**: 13.09 MB
- **Tables**: 64
- **Integrity**: OK
- **Last Modified**: 2025-11-02 20:20

**Backup Databases** (preserved in `/home/ubuntu/Sports-Bar-TV-Controller/database_backups/`):
- `sportsbar_empty_20251029.db`
- `sports_bar_prisma_20251029.db`
- `sports-bar-tv-controller_empty_20251029.db`
- `sports_bar_old_20251029.db`

These backups are intentionally preserved for historical reference.

## .gitignore Status

The `.gitignore` file already properly excludes database files:

```gitignore
# Database
prisma/*.db
prisma/*.db-journal
data/*.db
data/*.db-journal
```

This prevents accidentally committing empty or test database files in the future.

## Best Practices Going Forward

1. **Always use `process.env.DATABASE_URL`** for database connections
2. **Never hardcode database paths** in application code
3. **Run verification script** after any database-related changes:
   ```bash
   ./scripts/verify-database-config.sh
   ```
4. **Check .env file** has correct DATABASE_URL:
   ```bash
   DATABASE_URL="file:/home/ubuntu/sports-bar-data/production.db"
   ```
5. **Startup validation** will now catch misconfigured databases automatically

## Startup Validation

The application now validates the database on startup:

1. Checks if database file exists
2. Checks if database file is non-empty (size > 0 bytes)
3. Logs database size for confirmation
4. Throws error and exits if database is misconfigured

This prevents the application from starting with a wrong or empty database.

## Documentation Updates Needed

The following documentation files contain references to old database paths and should be updated in a future cleanup:

- `DEPLOYMENT_INSTRUCTIONS.md`
- `USER_INSTRUCTIONS.md`
- `INSTALLATION.md`
- `DEPLOYMENT.md`
- `README.md`
- Various shell scripts in `/scripts/` directory

**Note**: These are primarily documentation files and don't affect runtime behavior. The critical runtime code has been updated.

## Summary

All references to wrong database paths have been cleaned up in the critical runtime code. The system now:

1. Uses the correct production database at `/home/ubuntu/sports-bar-data/production.db`
2. Has no empty database files causing confusion
3. Validates database on startup
4. Has a verification script to prevent future misconfigurations
5. Uses environment variables correctly throughout

**Status**: COMPLETE - No further action required for runtime code. Documentation updates can be done as a separate task.
