# 🔧 CRITICAL FIX: Resolve Database Path Mismatch Causing Data Loss

## Problem Summary

Despite PR #36 being merged (which removed the `--accept-data-loss` flag), the database **continues to be overwritten on every update**. Users lose all Atlas configurations, audio settings, and other data.

## Root Cause Discovery

Through comprehensive investigation in a sandbox environment, I discovered the **real** issue:

**The `.env` file has the WRONG database path:**
- `.env` says: `DATABASE_URL="file:./data/sports_bar.db"`
- Actual location: `./prisma/data/sports_bar.db`

### Why This Causes Data Loss

1. Update script extracts path from `.env`: `DB_PATH='data/sports_bar.db'`
2. Script checks if file exists: `if [ -f "$DB_PATH" ]` → **FALSE**
3. Script sets: `DB_EXISTS=false`
4. Script skips the "existing database" path (lines 836-861) **where PR #36's fix lives**
5. Script falls through to "new database" path (lines 863-880)
6. Creates a **brand new database**, destroying the real one

### Why PR #36 Didn't Fix It

PR #36 made excellent changes:
- Removed `--accept-data-loss` flag
- Changed to `prisma migrate deploy` (safe for existing databases)

**But these changes never execute** because the script can't find the database file due to the path mismatch. The safe migration code is unreachable when `DB_EXISTS=false`.

## The Solution

This PR adds **intelligent database path detection** in two critical places:

### 1. Backup Section (Lines 357-391)
```bash
# Extract path from .env
DB_PATH=$(grep "DATABASE_URL" .env | cut -d'=' -f2 | tr -d '"' | sed 's|file:./||')

# NEW: Validate and find actual location
if [ ! -f "$DB_PATH" ]; then
    log_warning "Database not found at path from .env: $DB_PATH"
    log "Searching for actual database location..."
    
    # Try common locations
    POSSIBLE_PATHS=(
        "prisma/$DB_PATH"
        "prisma/data/sports_bar.db"
        "data/sports_bar.db"
        "prisma/dev.db"
    )
    
    for POSSIBLE_PATH in "${POSSIBLE_PATHS[@]}"; do
        if [ -f "$POSSIBLE_PATH" ]; then
            log_success "Found database at: $POSSIBLE_PATH"
            DB_PATH="$POSSIBLE_PATH"
            
            # Update .env with correct path
            CORRECT_URL="file:./$DB_PATH"
            sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=\"$CORRECT_URL\"|" .env
            log_success ".env updated with correct path"
            break
        fi
    done
fi
```

### 2. Database Update Section (Lines 848-880)
Same intelligent path detection logic ensures:
- Database is found
- `DB_EXISTS=true` is set correctly
- PR #36's safe migration executes
- User data is preserved

## What This Fixes

✅ **Detects path mismatch** between `.env` and actual file location  
✅ **Finds the real database** by searching common locations  
✅ **Updates `.env`** with correct path automatically  
✅ **Enables PR #36 fix** to execute (safe migration path now reachable)  
✅ **Preserves all user data** during updates  
✅ **Self-healing** - after first run, `.env` is corrected for future updates  

## Data Preserved

After this fix, the following will survive updates:
- ✅ Atlas Matrix configurations
- ✅ Audio processor settings (AZMP8)
- ✅ Input/output mappings and scenes
- ✅ Device configurations (DirecTV, FireTV, Cable boxes)
- ✅ TV provider settings
- ✅ Sports team preferences
- ✅ API keys and credentials
- ✅ All database content

## Testing Evidence

Verified in sandbox environment:
1. ✅ Path mismatch detection works
2. ✅ Script finds actual database location
3. ✅ `.env` is updated with correct path
4. ✅ Backup is created successfully
5. ✅ Safe migration executes (PR #36 fix now works!)
6. ✅ Test data survives update process

## Expected Behavior

### First Update After This Fix
```
💾 Backing up local configuration and database...
⚠️  Database not found at path from .env: data/sports_bar.db
   Searching for actual database location...
✅ Found database at: prisma/data/sports_bar.db
   Updating .env with correct database path...
✅ .env updated with correct path: file:./prisma/data/sports_bar.db
   📊 Creating SQL dump of database...
   
🗄️  Updating database schema...
   ℹ️  Existing database detected - your data will be preserved
   📊 Applying migrations to existing database...
   🔒 SAFE MODE: Data will be preserved
   ✅ All your data has been preserved
```

### Subsequent Updates
```
💾 Backing up local configuration and database...
   Using database: prisma/data/sports_bar.db
   ✅ Database SQL dump created
   
🗄️  Updating database schema...
   ✅ Database migrations applied successfully
   ✅ All your data has been preserved
```

## Documentation

- **ROOT_CAUSE_ANALYSIS.md** - Detailed investigation and evidence
- **FIX_VERIFICATION.md** - Testing guide and verification steps

## Impact

This is a **critical production fix** that finally solves the database overwrite issue. Combined with PR #36, this ensures user data is preserved during all future updates.

## Rollback Plan

If issues occur:
1. Restore from backup: `tar -xzf ~/sports-bar-backups/config-backup-*.tar.gz`
2. Revert script: `git checkout HEAD~1 update_from_github.sh`
3. Manually fix `.env` path to match actual database location

---

**This PR completes the fix started in PR #36 and finally stops the database from being overwritten on updates.**
