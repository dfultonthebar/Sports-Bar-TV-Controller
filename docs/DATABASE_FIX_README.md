# Database Fix Documentation

## Problem Summary

The Sports Bar TV Controller application was experiencing a critical database issue where:

1. ✅ Migration files existed and contained proper SQL
2. ✅ Migrations were marked as "applied" in the system
3. ❌ **BUT the ChannelPreset table (and ALL tables) did NOT exist in the database**

### Root Cause Analysis

Investigation revealed that the database file (`prisma/dev.db`) existed but was **completely empty**:
- No tables at all
- Not even the `_prisma_migrations` tracking table
- This indicates migrations were never actually executed, despite being marked as applied

This is a known Prisma edge case that can occur when:
- Database file is created but migrations fail silently
- Migration state becomes desynchronized
- Database file permissions issues
- Interrupted migration process

## The Solution

We created an aggressive fix script that uses **three fallback methods** to ensure the database is properly created:

### Method 1: Prisma DB Push (Force)
```bash
npx prisma db push --accept-data-loss --skip-generate
```
This forces the schema to match the Prisma schema file, bypassing migration history.

### Method 2: Migration Reset
```bash
npx prisma migrate reset --force --skip-generate --skip-seed
```
This completely resets the database and re-runs all migrations from scratch.

### Method 3: Manual SQL Creation
If both Prisma methods fail, the script directly executes SQL to create the table:
```sql
CREATE TABLE "ChannelPreset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "channelNumber" TEXT NOT NULL,
  "deviceType" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "lastUsed" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
```

## How to Use the Fix

### Quick Fix (Recommended)
```bash
npm install
npm run force-db-fix
```

### Manual Steps (if needed)
```bash
# 1. Install dependencies
npm install

# 2. Run the force fix script
npm run force-db-fix

# 3. Verify the fix worked
npx prisma studio
# Check that ChannelPreset table exists with all columns

# 4. Restart your development server
npm run dev
```

## What the Script Does

1. **Backs up** your existing database to `prisma/dev.db.backup`
2. **Checks** current database state and lists all tables
3. **Attempts Method 1**: Prisma DB Push with force flag
4. **Falls back to Method 2**: Complete migration reset if needed
5. **Falls back to Method 3**: Manual SQL table creation if needed
6. **Verifies** that ChannelPreset table exists
7. **Generates** Prisma Client
8. **Reports** success or failure with detailed logging

## Expected Output

### Successful Run
```
[INFO] === Force Database Creation Script ===
[INFO] This script will aggressively fix the database issue

[INFO] Database file found at: /path/to/prisma/dev.db
[SUCCESS] ✓ Database backed up to: /path/to/prisma/dev.db.backup
[INFO] Checking existing tables...
[WARNING] ⚠ No tables found in database!
[ERROR] ✗ ChannelPreset table does NOT exist. Proceeding with fixes...

[INFO] === Method 1: Prisma DB Push (Force) ===
[INFO] Executing: Prisma DB Push
[SUCCESS] ✓ Prisma DB Push completed
[SUCCESS] ✓ ChannelPreset table created successfully via Prisma DB Push!

[INFO] Generating Prisma Client...
[SUCCESS] ✓ Prisma Client Generation completed

[INFO] === Final Verification ===
[INFO] Total tables in database: 2
[INFO] Tables: ChannelPreset, _prisma_migrations
[SUCCESS] ✓✓✓ SUCCESS! ChannelPreset table exists and is ready to use!
```

## Files Modified

1. **`scripts/force_db_creation.ts`** (NEW)
   - Comprehensive fix script with three fallback methods
   - Detailed logging and verification
   - Automatic backup creation

2. **`package.json`** (MODIFIED)
   - Added `force-db-fix` script
   - Added `better-sqlite3` dependency for direct database access
   - Added `tsx` dependency for TypeScript execution

## Verification Steps

After running the fix, verify everything works:

```bash
# 1. Check tables exist
npx prisma studio
# Should show ChannelPreset table with all columns

# 2. Test the API
npm run dev
# Visit http://localhost:3000/api/channel-presets
# Should return empty array [] instead of error

# 3. Check database directly (optional)
python3 -c "
import sqlite3
conn = sqlite3.connect('prisma/dev.db')
cursor = conn.cursor()
cursor.execute('SELECT name FROM sqlite_master WHERE type=\"table\"')
print([row[0] for row in cursor.fetchall()])
conn.close()
"
# Should output: ['ChannelPreset', '_prisma_migrations']
```

## Troubleshooting

### If the script fails:
1. Check file permissions on `prisma/dev.db`
2. Ensure you have write access to the prisma directory
3. Try deleting `prisma/dev.db` and running the script again
4. Check the backup file `prisma/dev.db.backup` if you need to restore

### If tables still don't exist:
1. Delete the database file: `rm prisma/dev.db`
2. Run: `npx prisma migrate reset --force`
3. Run: `npm run force-db-fix`

### If you get permission errors:
```bash
chmod 644 prisma/dev.db
chmod 755 prisma/
```

## Prevention

To prevent this issue in the future:
1. Always run `npx prisma migrate dev` after pulling new migrations
2. Verify migrations with `npx prisma studio` before starting the server
3. Keep the `prisma/dev.db` file in `.gitignore` (it already is)
4. Use `npx prisma db push` for development schema changes

## Technical Details

### Migration Files Verified
- ✅ `20250103_channel_presets/migration.sql` - Contains CREATE TABLE statement
- ✅ `20250103_add_usage_tracking/migration.sql` - Contains ALTER TABLE statements
- ✅ Both files have proper SQL syntax

### Database Schema
The ChannelPreset table includes:
- `id`: Primary key (CUID)
- `name`: Channel name (e.g., "ESPN", "Fox Sports")
- `channelNumber`: Channel number to tune to
- `deviceType`: "cable" or "directv"
- `order`: Display order
- `isActive`: Active status
- `usageCount`: Usage tracking for AI reordering
- `lastUsed`: Last usage timestamp
- `createdAt`: Creation timestamp
- `updatedAt`: Update timestamp

### Indexes Created
- `deviceType + order` - For efficient preset listing
- `isActive` - For filtering active presets
- `usageCount` - For AI-powered auto-reordering

## Support

If you continue to experience issues after running this fix:
1. Check the GitHub Issues page
2. Provide the full output of `npm run force-db-fix`
3. Include your Node.js version: `node --version`
4. Include your npm version: `npm --version`

---

**Created**: October 3, 2025  
**Author**: AI Assistant  
**Issue**: ChannelPreset table not being created despite migrations
