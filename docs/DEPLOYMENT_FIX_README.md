# Deployment Fix for TypeScript Error and Migration Failure

## Issues Addressed

This fix resolves two critical deployment issues:

1. **TypeScript Build Error**: `Cannot find namespace 'cron'`
   - **Root Cause**: The file `src/services/presetCronService.ts` on your server wasn't updated when you pulled PR #53
   - **Solution**: The fix script updates the import statement to use the correct syntax

2. **Failed Migration**: `20250103_add_usage_tracking`
   - **Root Cause**: Migration was marked as failed in the database, blocking all subsequent migrations
   - **Solution**: The fix script resolves the failed state and re-applies migrations

## How to Apply the Fix

### Quick Fix (Recommended)

Run the automated fix script:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
curl -O https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/fix/server-deployment-issues/fix_server_deployment.sh
chmod +x fix_server_deployment.sh
./fix_server_deployment.sh
```

The script will:
1. ✅ Fix the TypeScript import in `presetCronService.ts`
2. ✅ Resolve the failed migration state
3. ✅ Apply all pending migrations
4. ✅ Rebuild the application
5. ✅ Restart your server (PM2 or systemd)

### Manual Fix (If Needed)

If you prefer to fix manually:

#### Step 1: Fix TypeScript Import

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Backup the file
cp src/services/presetCronService.ts src/services/presetCronService.ts.backup

# Fix the import (replace first line)
sed -i "1s/.*/import cron, { ScheduledTask } from 'node-cron'/" src/services/presetCronService.ts
```

#### Step 2: Resolve Failed Migration

```bash
# Mark the failed migration as rolled back
npx prisma migrate resolve --rolled-back 20250103_add_usage_tracking

# Apply all migrations
npx prisma migrate deploy
```

#### Step 3: Rebuild and Restart

```bash
# Rebuild
npm run build

# Restart (choose your method)
pm2 restart sports-bar-tv-controller
# OR
sudo systemctl restart sports-bar-tv-controller
```

## Verification

After running the fix, verify everything is working:

```bash
# Check build status
npm run build

# Check migration status
npx prisma migrate status

# Check server logs
pm2 logs sports-bar-tv-controller
# OR
sudo journalctl -u sports-bar-tv-controller -f
```

## What Changed

### File: `src/services/presetCronService.ts`

**Before (incorrect):**
```typescript
import * as cron from 'node-cron'
// or
import cron from 'node-cron'
```

**After (correct):**
```typescript
import cron, { ScheduledTask } from 'node-cron'
```

### Database: `_prisma_migrations` table

The migration `20250103_add_usage_tracking` will be:
- Marked as rolled back (if failed)
- Re-applied cleanly
- Status changed from "failed" to "success"

## Troubleshooting

### If the script fails:

1. **Check file permissions:**
   ```bash
   ls -la /home/ubuntu/Sports-Bar-TV-Controller/src/services/presetCronService.ts
   ```

2. **Check database connection:**
   ```bash
   npx prisma db pull
   ```

3. **Check for running processes:**
   ```bash
   pm2 list
   # OR
   sudo systemctl status sports-bar-tv-controller
   ```

### If migration still fails:

The migration might have partially applied. Check the database:

```bash
npx prisma studio
# Navigate to ChannelPreset table and check if usageCount and lastUsed columns exist
```

If columns exist but migration is marked failed:
```bash
# Mark as applied
npx prisma migrate resolve --applied 20250103_add_usage_tracking
```

## Support

If you encounter any issues:
1. Check the script output for specific error messages
2. Review the backup file: `src/services/presetCronService.ts.backup`
3. Check server logs for detailed error information
4. Open an issue on GitHub with the error details

## Next Steps

After the fix is applied:
1. ✅ Your preset feature will be fully functional
2. ✅ The monthly auto-reordering cron job will be active
3. ✅ All future updates should apply cleanly

The preset quick access buttons should now work perfectly in your bartender remote!
