# 🚨 CRITICAL DATA LOSS FIX

## Problem Summary

**CRITICAL ISSUE**: Users were losing all their Atlas (AZMP8) audio processor configurations, device settings, and other data every time they ran the update script.

## Root Cause Analysis

### Issue #1: Destructive Database Command (PRIMARY CAUSE)
**Location**: Line 826 of `update_from_github.sh`

**The Problem**:
```bash
npx prisma db push --accept-data-loss
```

The `--accept-data-loss` flag tells Prisma to **DROP and RECREATE all tables**, which **DELETES ALL DATA** in the database. This is catastrophic for production systems.

**What was happening**:
1. User runs update script
2. Script backs up database (good!)
3. Script pulls latest code (good!)
4. Script runs `prisma db push --accept-data-loss` (BAD!)
5. **ALL DATA IS DELETED** - Atlas configs, device settings, everything gone
6. User has to manually restore from backup every time

### Issue #2: Database Path Inconsistency (SECONDARY CAUSE)
**Location**: Multiple places in `update_from_github.sh`

**The Problem**:
- `.env` file specifies: `DATABASE_URL="file:./data/sports_bar.db"`
- Script was checking for: `prisma/dev.db`
- Script was overriding DATABASE_URL to: `file:./dev.db`

This path mismatch could cause:
- Backups of wrong database file
- Migrations applied to wrong database
- Data loss even without the `--accept-data-loss` flag

## The Fix

### Fix #1: Remove Destructive Flag
**Changed from**:
```bash
npx prisma db push --accept-data-loss
```

**Changed to**:
```bash
npx prisma migrate deploy
```

**Why this is better**:
- `migrate deploy` applies migrations **WITHOUT dropping data**
- It's the recommended approach for production databases
- It preserves all existing data while adding new schema changes
- Migrations are additive (ADD COLUMN, CREATE TABLE) not destructive

### Fix #2: Use Correct Database Path
**Changes made**:
1. Read database path from `.env` file instead of hardcoding
2. Use the correct path for all operations (backup, migration, verification)
3. Don't override DATABASE_URL - respect what's in `.env`

**Code changes**:
```bash
# Get database path from .env
DB_PATH=$(grep "DATABASE_URL" .env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | sed 's|file:./||' || echo "prisma/dev.db")

# Use this path for all operations
if [ -f "$DB_PATH" ]; then
    # Backup, migrate, verify using $DB_PATH
fi
```

### Fix #3: Better Error Handling
Added comprehensive error checking:
- Check if migrations are already applied (no-op if current)
- Handle "No pending migrations" gracefully
- Provide clear error messages
- Confirm data preservation in logs

## What Data Was Being Lost

Every update was deleting:
- ✅ **Atlas Matrix Configurations** (MatrixConfiguration, MatrixInput, MatrixOutput, MatrixRoute, MatrixScene)
- ✅ **Audio Processor Settings** (AudioProcessor, AudioZone, AudioScene, AudioMessage, AudioInputMeter)
- ✅ **AI Gain Control Settings** (AIGainConfiguration)
- ✅ **HDMI-CEC Settings** (CECConfiguration)
- ✅ **TV Provider Mappings** (TVProvider, ProviderInput)
- ✅ **Sports Teams** (HomeTeam, SportsGuideConfiguration)
- ✅ **Soundtrack API Credentials** (SoundtrackConfig, SoundtrackPlayer)
- ✅ **Automated Schedules** (Schedule)
- ✅ **Wolfpack Routing State** (WolfpackMatrixRouting, WolfpackMatrixState)
- ✅ **NFHS Sports Data** (NFHSSchool, NFHSGame)
- ✅ **AI API Keys** (ApiKey)
- ✅ **User Accounts** (User)
- ✅ **Equipment Inventory** (Equipment)
- ✅ **Uploaded Documents** (Document)

## Testing the Fix

### Before the Fix:
1. Configure Atlas audio processor
2. Run update script
3. **All Atlas settings are gone** ❌
4. Have to manually restore from backup

### After the Fix:
1. Configure Atlas audio processor
2. Run update script
3. **All Atlas settings are preserved** ✅
4. No manual restore needed

## Migration Strategy

The fix uses the proper Prisma migration workflow:

### For Existing Databases (with data):
```bash
npx prisma migrate deploy
```
- Applies pending migrations
- **Preserves all existing data**
- Only adds new columns/tables
- Never drops or truncates

### For New Databases (first run):
```bash
npx prisma migrate deploy
```
- Creates database with all tables
- Applies all migrations in order
- Sets up schema correctly

### Fallback (if migrations fail):
```bash
npx prisma db push
```
- Syncs schema without migrations
- **WITHOUT --accept-data-loss flag**
- Safe for existing data

## Verification

After applying this fix, users should see:
```
🗄️  Updating database schema...
   Using database: data/sports_bar.db
   Generating Prisma Client...
   ℹ️  Existing database detected at data/sports_bar.db - your data will be preserved
   📊 Applying migrations to existing database...
   🔒 SAFE MODE: Your data will be preserved
   ✅ Database migrations applied successfully
   ✅ All your data has been preserved
```

## Additional Safeguards

The fix also includes:
1. **Backup before migration** - Database is backed up before any changes
2. **SQL dumps** - Compressed SQL dumps for easy restoration
3. **Path validation** - Verifies database path from `.env`
4. **Clear logging** - Shows exactly what's happening
5. **Error recovery** - Graceful handling of edge cases

## Impact

**Before Fix**:
- Data loss on every update
- Manual restore required every time
- User frustration and lost productivity
- Risk of losing configurations permanently

**After Fix**:
- Data persists automatically
- No manual intervention needed
- Smooth update experience
- Configurations are safe

## Related Documentation

- `UPDATE_PROCESS.md` - How updates work and data persistence
- `BACKUP_RESTORE_GUIDE.md` - How to backup and restore data
- `README.md` - Updated with data persistence information

## For Developers

**NEVER use these flags in production**:
- ❌ `--accept-data-loss` - Drops all data
- ❌ `--force-reset` - Resets database
- ❌ `prisma migrate reset` - Drops and recreates database

**ALWAYS use these for production**:
- ✅ `prisma migrate deploy` - Safe migrations
- ✅ `prisma db push` (without flags) - Safe schema sync
- ✅ `prisma migrate dev` (development only) - Creates migrations

## Conclusion

This fix resolves the critical data loss issue by:
1. Removing the destructive `--accept-data-loss` flag
2. Using proper migration commands (`migrate deploy`)
3. Fixing database path inconsistencies
4. Adding comprehensive error handling

**Users will no longer lose their Atlas configurations or any other data during updates.**
