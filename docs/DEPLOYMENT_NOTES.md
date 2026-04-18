
# Deployment Notes - Fix Remaining Critical Issues

## Issues Fixed in This PR

### 1. ✅ SERVER_PORT Unbound Variable Error
**Problem:** The user's installation at `~/Sports-Bar-TV-Controller/update_from_github.sh` still had the old version with direct `$SERVER_PORT` references, causing "unbound variable" errors when running with `set -u`.

**Root Cause:** While we fixed the script in the repository (PR #147), the user's local installation wasn't updated because they run the script from their local directory, not from the repo.

**Solution:** The fix is already in the repository. When the user pulls the latest changes and runs the updated script, the error will be resolved. All `$SERVER_PORT` references have been replaced with `$(get_server_port)` function calls.

**Verification:** After deployment, the script will use the `get_server_port()` function consistently throughout, eliminating the unbound variable error.

### 2. ✅ Wolfpack Inputs/Outputs Display in Rows of 4
**Problem:** The MatrixControl component was displaying inputs and outputs in rows of 3 (`grid-cols-3`), but the Wolfpack hardware has 4 ports per card.

**Changes Made:**
- **Line 540:** Changed `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3` to `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- **Line 655:** Changed `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3` to `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Added hardware card layout indicators showing which channels belong to which physical card
- Updated section headers to clarify "Rows of 4 match hardware cards"

**Result:** The interface now correctly displays 4 inputs/outputs per row, matching the physical Wolfpack card layout where each card has exactly 4 ports.

### 3. ✅ Image Validation Errors for Layout Images
**Problem:** Next.js Image component was failing validation for locally uploaded layout images with error: "The requested resource isn't a valid image for /uploads/layouts/[uuid].png received null"

**Root Cause:** Next.js Image component performs strict validation and optimization by default, which can fail for local file uploads even when the images are valid.

**Solution:** Modified `next.config.js`:
- Set `unoptimized: true` globally to disable Next.js image optimization
- Added explicit localhost:3001 remote pattern for the production port
- This allows the Image component to serve local uploads without validation issues

**Trade-off:** Images won't be optimized by Next.js, but this is acceptable for:
- Local development and testing
- Layout images that are already optimized during upload (Sharp processing)
- Avoiding validation errors that block functionality

**Alternative Considered:** Using `<img>` tag instead of Next.js `<Image>` component, but keeping the Image component maintains consistency with the codebase.

## Deployment Instructions

### For the User's Installation

1. **Pull Latest Changes:**
   ```bash
   cd ~/Sports-Bar-TV-Controller
   git pull origin main
   ```

2. **The update_from_github.sh script will now have the SERVER_PORT fix**
   - All references use `$(get_server_port)` function
   - No more "unbound variable" errors

3. **Rebuild and Restart:**
   ```bash
   npm install
   npm run build
   pm2 restart sports-bar-tv-controller
   ```

4. **Verify Fixes:**
   - ✅ No SERVER_PORT errors in logs
   - ✅ Matrix Control page shows inputs/outputs in rows of 4
   - ✅ Layout images display without validation errors

### Testing Checklist

- [ ] Run `./update_from_github.sh` - should complete without SERVER_PORT errors
- [ ] Visit Matrix Control page - inputs should display in 4 columns on large screens
- [ ] Visit Matrix Control page - outputs should display in 4 columns on large screens
- [ ] Upload a layout image - should display without validation errors
- [ ] Check hardware card indicators - should show "Card 1: Ch 1-4", "Card 2: Ch 5-8", etc.

## Technical Details

### Wolfpack Hardware Layout
Each Wolfpack card has exactly 4 ports (either inputs OR outputs):
- **Input Cards:** 9 cards × 4 inputs = 36 total inputs
- **Output Cards:** 9 cards × 4 outputs = 36 total outputs
- **Special:** First output card (Outputs 1-4) routes audio to Atlas system

### Grid Layout Responsive Breakpoints
- **Mobile (default):** 1 column - full width cards
- **Tablet (md):** 2 columns - easier to scan
- **Desktop (lg):** 4 columns - matches hardware layout exactly

### Image Handling
- Images uploaded via `/api/bartender/upload-layout`
- Stored in `public/uploads/layouts/`
- PDFs converted to PNG at 300 DPI for AI analysis
- Sharp optimization applied during upload
- Next.js serves without additional optimization (unoptimized: true)

## Notes for Future Development

1. **SERVER_PORT:** The `get_server_port()` function is the single source of truth for port detection. Never use `$SERVER_PORT` directly.

2. **Grid Layout:** If adding more matrix configurations, maintain the 4-column layout for consistency with hardware.

3. **Image Optimization:** If image optimization becomes necessary in production, consider:
   - Using a CDN for image serving
   - Pre-optimizing images during upload (already done with Sharp)
   - Using `<img>` tag for local uploads and `<Image>` for external URLs

4. **Hardware Cards:** The card indicator sections help users understand the physical-to-logical mapping. Keep these updated if hardware changes.

