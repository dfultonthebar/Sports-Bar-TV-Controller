# Deployment Instructions for Drizzle Migration Fix

## Issue Summary
The application was experiencing 500 Internal Server Errors after the Prisma to Drizzle ORM migration. The main issues were:
1. Missing support for Prisma's `include` option in the Drizzle adapter
2. Missing model definitions causing undefined reference errors
3. Incomplete relation handling in database queries

## Fix Applied
Pull Request #214 has been created with the following fixes:
- Enhanced Prisma adapter with full `include` support
- Added stub adapters for missing models
- Improved error handling and null checks

## Deployment Steps

### Option 1: Merge PR and Deploy (Recommended)

1. **Review and Merge PR #214**
   - Visit: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/214
   - Review the changes
   - Merge the PR to main branch

2. **SSH into the remote server**
   ```bash
   ssh -p 224 ubuntu@24.123.87.42
   ```

3. **Navigate to project directory**
   ```bash
   cd /path/to/Sports-Bar-TV-Controller
   ```

4. **Pull latest changes**
   ```bash
   git pull origin main
   ```

5. **Install dependencies (if needed)**
   ```bash
   npm install
   ```

6. **Rebuild the application**
   ```bash
   npm run build
   ```

7. **Restart the application**
   
   If using PM2:
   ```bash
   pm2 restart sports-bar-tv-controller
   # or
   pm2 restart all
   ```
   
   If using systemd:
   ```bash
   sudo systemctl restart sports-bar-tv-controller
   ```
   
   If running directly:
   ```bash
   # Stop the current process (Ctrl+C or kill)
   npm start
   ```

### Option 2: Deploy from Feature Branch (For Testing)

1. **SSH into the remote server**
   ```bash
   ssh -p 224 ubuntu@24.123.87.42
   ```

2. **Navigate to project directory**
   ```bash
   cd /path/to/Sports-Bar-TV-Controller
   ```

3. **Fetch and checkout the fix branch**
   ```bash
   git fetch origin
   git checkout fix-drizzle-migration-500-errors
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Rebuild the application**
   ```bash
   npm run build
   ```

6. **Restart the application**
   ```bash
   pm2 restart sports-bar-tv-controller
   # or appropriate restart command
   ```

## Verification Steps

After deployment, verify the fixes by testing these endpoints:

### 1. Test Audio Processor Endpoint
```bash
curl http://localhost:3001/api/audio-processor
```
Expected: `{"processors":[]}`

### 2. Test Matrix Video Input Selection
```bash
curl http://localhost:3001/api/matrix/video-input-selection
```
Expected: `{"error":"No active matrix configuration found","status":404}` or `{"success":true,"selections":[]}`

### 3. Test Zones Status (will fail until processor is configured)
```bash
curl http://localhost:3001/api/audio-processor/atlas-001/zones-status
```
Expected: `{"error":"Audio processor not found","status":404}`

### 4. Check Application Logs
```bash
pm2 logs sports-bar-tv-controller
# or
journalctl -u sports-bar-tv-controller -f
```

Look for:
- ✅ No "Cannot read properties of undefined" errors
- ✅ "[Database] Drizzle ORM connected successfully" message
- ✅ Successful API responses

## Configure Atlas Processor

Once the application is running without errors, configure the Atlas processor:

```bash
curl -X POST http://localhost:3001/api/audio-processor \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Atlas Main Processor",
    "model": "AZM4",
    "ipAddress": "192.168.5.101",
    "port": 80,
    "tcpPort": 5321,
    "zones": 4,
    "description": "Main Atlas Atmosphere DSP"
  }'
```

Adjust the model and zones based on your actual Atlas processor model.

## Troubleshooting

### Issue: Git pull fails with merge conflicts
```bash
# Stash local changes
git stash

# Pull changes
git pull origin main

# Reapply local changes if needed
git stash pop
```

### Issue: Build fails
```bash
# Clear build cache
rm -rf .next

# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### Issue: Application won't start
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill process if needed
kill -9 <PID>

# Check logs for errors
pm2 logs sports-bar-tv-controller --lines 100
```

### Issue: Database errors
```bash
# Check database file exists
ls -la prisma/data/sports_bar.db

# Check database permissions
chmod 644 prisma/data/sports_bar.db
```

## Network Connectivity Note

**Important**: The remote server at 24.123.87.42 was not reachable during the fix development. The correct IP appears to be **24.123.87.42** (not 24.123.187.42 as initially provided). Ensure you're using the correct IP address when connecting.

## Next Steps After Deployment

1. **Test all API endpoints** to ensure no 500 errors
2. **Configure the Atlas processor** at 192.168.5.101:5321
3. **Test Atlas communication** using the zones-status endpoint
4. **Monitor logs** for any remaining issues
5. **Add missing models** to the Drizzle schema (see PR description for list)

## Support

If issues persist after deployment:
1. Check the application logs for specific error messages
2. Verify the database file is accessible and not corrupted
3. Ensure all environment variables are set correctly
4. Review the PR #214 for detailed technical information

## Files Modified
- `src/db/prisma-adapter.ts` - Enhanced with include support and missing model stubs

## Commit Hash
- Branch: `fix-drizzle-migration-500-errors`
- Commit: `6cf57ea`
- PR: #214
