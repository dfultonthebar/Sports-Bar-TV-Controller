# Database Overwrite Root Cause Analysis

## Executive Summary

**The database keeps getting overwritten because the .env file has the WRONG database path.**

PR #36 fixed the `--accept-data-loss` flag issue, but the fix never executes because the update script can't find the database file due to a path mismatch.

## The Problem

### What the User Experiences
- User configures Atlas audio processor settings
- User runs `./update_from_github.sh`
- All Atlas configurations are lost
- This happens EVERY update, despite PR #36 being merged

### What's Actually Happening

1. **The .env file says:**
   ```
   DATABASE_URL="file:./data/sports_bar.db"
   ```

2. **The actual database file is at:**
   ```
   ./prisma/data/sports_bar.db
   ```

3. **The update script extracts the path as:**
   ```bash
   DB_PATH='data/sports_bar.db'  # Missing 'prisma/' prefix!
   ```

4. **The script checks if this file exists:**
   ```bash
   if [ -f "$DB_PATH" ]; then
       DB_EXISTS=true
   else
       DB_EXISTS=false  # ← This is what happens!
   fi
   ```

5. **Because DB_EXISTS=false, the script:**
   - Skips the "existing database" path (line 836-861) where PR #36's fix lives
   - Falls through to the "new database" path (line 863-880)
   - Creates a BRAND NEW database, destroying the real one

## Why PR #36 Didn't Fix It

PR #36 made these changes:
- Line 842: Removed `--accept-data-loss` flag
- Line 843: Changed to `prisma migrate deploy` (safe for existing databases)

**But these lines never execute** because:
```bash
if [ "$DB_EXISTS" = true ]; then
    # PR #36 fix is here (lines 836-861)
    # ← NEVER REACHED because DB_EXISTS=false
else
    # New database path (lines 863-880)
    # ← THIS is what runs instead
fi
```

## The Evidence

### Test Results
```bash
$ cd /home/ubuntu/github_repos/Sports-Bar-TV-Controller
$ grep "DATABASE_URL" .env
DATABASE_URL="file:./data/sports_bar.db"

$ DB_PATH=$(grep "DATABASE_URL" .env | cut -d'=' -f2 | tr -d '"' | sed 's|file:./||')
$ echo $DB_PATH
data/sports_bar.db

$ ls -la data/sports_bar.db
ls: cannot access 'data/sports_bar.db': No such file or directory

$ find . -name "sports_bar.db" -type f
./prisma/data/sports_bar.db  ← The REAL database location
```

### What Happens During Update

**Backup Section (Line 355-391):**
```bash
DB_PATH='data/sports_bar.db'  # Wrong path
if [ -f "$DB_PATH" ]; then    # File doesn't exist
    # Create backup
else
    # Skip backup ← This happens!
fi
```
**Result:** No backup is created, user's data is not protected.

**Database Update Section (Line 810-908):**
```bash
DB_PATH='data/sports_bar.db'  # Wrong path again
if [ -f "$DB_PATH" ]; then
    DB_EXISTS=true
else
    DB_EXISTS=false  ← This happens!
fi

if [ "$DB_EXISTS" = true ]; then
    # Use migrate deploy (PR #36 fix) ← NEVER REACHED
else
    # Create new database ← THIS RUNS INSTEAD
    npx prisma db push  # Creates fresh database, destroying the real one
fi
```
**Result:** A new empty database is created, the real database (with all user data) is ignored and effectively lost.

## The Fix

There are two possible fixes:

### Option 1: Fix the .env file (Recommended)
Change the DATABASE_URL to match the actual file location:
```bash
# Change from:
DATABASE_URL="file:./data/sports_bar.db"

# To:
DATABASE_URL="file:./prisma/data/sports_bar.db"
```

### Option 2: Move the database file
Move the database to match the .env path:
```bash
mv ./prisma/data/sports_bar.db ./data/sports_bar.db
```

### Option 3: Fix the update script (Most Robust)
Make the script smarter about finding the database:
```bash
# Instead of just extracting from .env, also check if file exists
DB_PATH=$(grep "DATABASE_URL" .env | cut -d'=' -f2 | tr -d '"' | sed 's|file:./||')

# If extracted path doesn't exist, try common locations
if [ ! -f "$DB_PATH" ]; then
    if [ -f "prisma/$DB_PATH" ]; then
        DB_PATH="prisma/$DB_PATH"
    elif [ -f "prisma/data/sports_bar.db" ]; then
        DB_PATH="prisma/data/sports_bar.db"
    fi
fi
```

## Impact Assessment

### What Was Lost
Every time the user ran the update script:
- All Atlas Matrix configurations
- All audio processor settings (AZMP8)
- All input/output mappings
- All saved scenes
- All device configurations
- All TV provider settings
- All sports team preferences
- All API keys and credentials
- Everything in the database

### Why Backups Didn't Help
The backup section also uses the wrong path, so:
1. It tries to backup `data/sports_bar.db` (doesn't exist)
2. Backup is skipped
3. User has no backup to restore from

## Verification

To verify this is the issue in production:
```bash
# Check what .env says
grep DATABASE_URL .env

# Check where the actual database is
find . -name "sports_bar.db" -type f

# They should match, but they don't!
```

## Recommended Solution

**Immediate Fix:**
1. Update the .env file to use the correct path
2. Add validation to the update script to detect this mismatch
3. Create a proper backup before any database operations

**Long-term Fix:**
1. Standardize on a single database location
2. Add path validation to the update script
3. Add a pre-update check that verifies the database path
4. Improve error messages when database is not found

## Timeline

- **Before PR #36:** Database was being destroyed by `--accept-data-loss` flag
- **After PR #36:** Flag was removed, but fix never executes due to path mismatch
- **Current State:** Database still being destroyed, but for a different reason
- **After This Fix:** Database will be properly preserved during updates

## Conclusion

PR #36 was a good fix, but it fixed the wrong problem. The real issue is that the update script can't find the database file because the .env path doesn't match the actual file location. This causes the script to think there's no existing database, so it creates a new one, destroying all user data in the process.

The fix is simple: correct the path mismatch. The impact is critical: this will finally stop the database from being overwritten on every update.
