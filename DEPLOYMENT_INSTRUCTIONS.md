# Deployment Instructions for Matrix-Atlas Integration

## Summary of Changes

This feature branch (`feature/matrix-atlas-video-routing`) has been successfully created and pushed to GitHub. A pull request (#178) has been created and is ready for review.

### What Was Implemented

1. **Database Schema Updates**
   - Extended `MatrixOutput` model with `selectedVideoInput` and `videoInputLabel` fields
   - Migration file ready to be applied

2. **New API Endpoints**
   - `/api/matrix/video-input-selection` - Video input selection and routing
   - `/api/atlas/route-matrix-to-zone` - Atlas zone routing integration

3. **UI Enhancements**
   - Video input selection modal for Matrix outputs (33-36)
   - Enhanced Matrix output cards with routing UI
   - Real-time label updates

4. **Documentation**
   - Comprehensive feature documentation in `MATRIX_ATLAS_INTEGRATION.md`
   - API specifications and usage examples

## Manual Deployment Steps

Since the SSH connection timed out, please follow these steps manually on the remote server:

### Step 1: SSH into Remote Server

```bash
ssh ubuntu@24.123.87.42
# Password: 6809233DjD$$$
```

### Step 2: Navigate to Project Directory

```bash
cd ~/Sports-Bar-TV-Controller
```

### Step 3: Fetch and Checkout Feature Branch

```bash
# Fetch latest changes
git fetch origin

# Checkout feature branch
git checkout feature/matrix-atlas-video-routing

# Pull latest changes
git pull origin feature/matrix-atlas-video-routing

# Verify you're on the correct branch
git branch --show-current
# Should show: feature/matrix-atlas-video-routing
```

### Step 4: Install Dependencies (if needed)

```bash
npm install
```

### Step 5: Run Database Migration

```bash
# This will add the new fields to MatrixOutput table
npx prisma migrate dev --name add_video_input_selection

# Generate Prisma client
npx prisma generate
```

### Step 6: Build the Application

```bash
npm run build
```

### Step 7: Restart the Application

```bash
# If using PM2
pm2 restart all

# OR if running manually
pkill -f "next dev" || true
pkill -f "next start" || true
npm run start &

# OR for development mode
npm run dev &
```

### Step 8: Verify Deployment

1. Open browser and navigate to: `http://24.123.87.42:3001`
2. Go to Matrix Control page
3. Click on "Outputs" tab
4. Look for Matrix outputs (channels 33-36)
5. You should see "Matrix Audio Routing" section with "Select Video Input" button

## Testing the Feature

### Test 1: Video Input Selection

1. Navigate to Matrix Control → Outputs tab
2. Find Matrix 1 (Output 33)
3. Click "Select Video Input" button
4. Modal should appear with available video inputs
5. Click on any video input (e.g., "Cable Box 1")
6. Verify:
   - Toast notification appears
   - Label updates to match video input
   - Routing state persists after page refresh

### Test 2: API Endpoints

```bash
# Test video input selection
curl -X POST http://localhost:3001/api/matrix/video-input-selection \
  -H "Content-Type: application/json" \
  -d '{
    "matrixOutputNumber": 3,
    "videoInputNumber": 5,
    "videoInputLabel": "Direct TV 1"
  }'

# Get current selections
curl http://localhost:3001/api/matrix/video-input-selection

# Test Atlas zone routing
curl -X POST http://localhost:3001/api/atlas/route-matrix-to-zone \
  -H "Content-Type: application/json" \
  -d '{
    "matrixInputNumber": 3,
    "zoneNumbers": [1, 2, 5]
  }'

# Get routing state
curl http://localhost:3001/api/atlas/route-matrix-to-zone
```

### Test 3: Database Verification

```bash
# Check if migration was applied
npx prisma studio

# Or query directly
sqlite3 ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db

# Check MatrixOutput table structure
.schema MatrixOutput

# Should show selectedVideoInput and videoInputLabel fields
```

## Merging to Main

Once testing is complete and everything works:

### Option 1: Merge via GitHub UI

1. Go to: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/178
2. Review the changes
3. Click "Merge pull request"
4. Confirm merge

### Option 2: Merge via Command Line

```bash
cd ~/Sports-Bar-TV-Controller

# Switch to main branch
git checkout main

# Pull latest changes
git pull origin main

# Merge feature branch
git merge feature/matrix-atlas-video-routing

# Push to GitHub
git push origin main

# Restart application
pm2 restart all
# OR
npm run start &
```

## Troubleshooting

### Issue: Migration Fails

```bash
# Reset migration
npx prisma migrate reset

# Re-run migration
npx prisma migrate dev --name add_video_input_selection
```

### Issue: Build Fails

```bash
# Clear cache
rm -rf .next
rm -rf node_modules

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

### Issue: API Returns 404

- Ensure application was rebuilt after pulling changes
- Check that the application is running
- Verify the API route files exist in `src/app/api/`

### Issue: Modal Not Appearing

- Check browser console for errors
- Verify MatrixControl component was updated
- Clear browser cache and refresh

## Rollback Instructions

If you need to rollback:

```bash
cd ~/Sports-Bar-TV-Controller

# Switch back to main branch
git checkout main

# Pull latest main
git pull origin main

# Restart application
pm2 restart all
```

## Support

For issues or questions:
- Check application logs: `tail -f ~/app.log`
- Check PM2 logs: `pm2 logs`
- Review documentation: `MATRIX_ATLAS_INTEGRATION.md`
- Check database: `npx prisma studio`

## GitHub Pull Request

- **PR Number:** #178
- **PR URL:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller/pull/178
- **Branch:** feature/matrix-atlas-video-routing
- **Status:** Open and ready for review

## Important Notes

1. **Database Migration:** The migration adds new fields but does NOT modify existing data
2. **Backward Compatibility:** This feature is fully backward compatible
3. **No Breaking Changes:** Existing functionality remains unchanged
4. **GitHub App Access:** Ensure you have given access to the [GitHub App](https://github.com/apps/abacusai/installations/select_target) for full functionality

## Next Steps After Deployment

1. Test video input selection on all Matrix outputs (1-4)
2. Verify Wolfpack commands are sent correctly
3. Test Atlas zone routing integration
4. Monitor application logs for any errors
5. Gather user feedback
6. Merge PR to main when ready

---

**Deployment Date:** October 9, 2025  
**Feature Branch:** feature/matrix-atlas-video-routing  
**Pull Request:** #178  
**Status:** Ready for manual deployment and testing
