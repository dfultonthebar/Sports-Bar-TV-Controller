# TV Layout Detection and Output Mapping Fix

## Problem Summary

The TV layout detection system had critical issues where output numbers were incorrectly mapped to TV positions:

1. **Output Numbers Didn't Match Labels**: TV 03 was mapped to output 23, TV 04 to output 22, etc.
2. **TV 25 Detection**: TV 25 (in the patio area) was being detected but appeared as output 24
3. **No Preservation of Mappings**: Reuploading layouts would lose all manual corrections

## Root Cause Analysis

### Issue 1: OCR Labels Not Used for Output Numbers

**Location**: `/home/ubuntu/Sports-Bar-TV-Controller/src/lib/layout-detector.ts` (lines 528-542)

The detection algorithm:
1. ✅ Detected red rectangles correctly
2. ✅ OCR extracted labels correctly (via `ocr-service.py`)
3. ❌ **BUT** assigned `outputNumber` based on spatial detection order (top-to-bottom, left-to-right)
4. ❌ OCR ran AFTER initial detection and only updated `label` field, not `outputNumber`

**Code Flow**:
```
upload-layout/route.ts → detectTVZonesFromImage() → extractZonesFromRectangles()
    ↓ (assigns outputNumber based on index)
    ↓
ocr-service.py runs AFTER
    ↓ (updates label but NOT outputNumber)
```

### Issue 2: TV 25 Was Actually Being Detected

TV 25 was successfully detected at position (28.30%, 94.29%) but was assigned outputNumber 24 because it was the 24th rectangle detected in spatial order. The OCR correctly identified it as "TV 25" but this label wasn't used for the output number.

### Issue 3: No Backup/Restore System

There was no mechanism to preserve correct mappings when reuploading layouts.

---

## Solutions Implemented

### Fix 1: Updated OCR Service to Set Output Numbers ✅

**File**: `/home/ubuntu/Sports-Bar-TV-Controller/services/ocr-service.py`

**Changes**:
- Modified `_clean_ocr_text()` to return `(label, tv_number)` tuple
- Updated `extract_text_from_region()` to return TV number along with label
- **CRITICAL**: Modified `process_layout()` to update BOTH `label` AND `outputNumber` from OCR

```python
# Before: Only updated label
zone_copy['label'] = label

# After: Updates both label AND outputNumber
zone_copy['label'] = label
zone_copy['outputNumber'] = tv_number  # ← FIX
zone_copy['id'] = f"tv{tv_number}"     # ← FIX
```

This ensures future uploads will correctly map output numbers based on OCR-detected labels.

### Fix 2: Created Manual Remapping Script ✅

**File**: `/home/ubuntu/Sports-Bar-TV-Controller/scripts/remap-layout-outputs.js`

**Usage**:
```bash
# Dry run (preview changes)
node scripts/remap-layout-outputs.js --dry-run

# Apply changes (creates automatic backup)
node scripts/remap-layout-outputs.js

# Apply without backup (not recommended)
node scripts/remap-layout-outputs.js --no-backup
```

**Features**:
- Extracts TV numbers from labels and updates output numbers
- Supports manual overrides via `/data/layout-overrides.json`
- Creates automatic backups before making changes
- Detailed logging of all changes

### Fix 3: Manual Override System ✅

**File**: `/home/ubuntu/Sports-Bar-TV-Controller/data/layout-overrides.json`

Use this file to correct OCR errors (e.g., "TV 108" should be "TV 08"):

```json
{
  "overrides": {
    "TV 108": 7,
    "TV 109": 11,
    "TV 121": 17
  }
}
```

### Fix 4: Backup/Restore API ✅

**File**: `/home/ubuntu/Sports-Bar-TV-Controller/src/app/api/bartender/layout/backup/route.ts`

**API Endpoints**:

```bash
# List all backups
GET /api/bartender/layout/backup

# Create backup
POST /api/bartender/layout/backup
{
  "action": "create"
}

# Restore from backup
POST /api/bartender/layout/backup
{
  "action": "restore",
  "filename": "tv-layout-2025-10-31T20-27-46-919Z.json"
}

# Delete backup
DELETE /api/bartender/layout/backup?filename=tv-layout-2025-10-31T20-27-46-919Z.json
```

**Backup Location**: `/home/ubuntu/Sports-Bar-TV-Controller/data/backups/`

---

## Current Status

### ✅ Fixed

1. **Output number remapping script created and applied**
   - Backup created: `data/backups/tv-layout-2025-10-31T20-27-46-919Z.json`
   - 20 zones remapped to correct output numbers
   - TV 25 now correctly mapped (output 25, label "TV 25")

2. **Future uploads will work correctly**
   - OCR service now updates both `label` and `outputNumber`
   - Detection algorithm unchanged (still finds all TVs including TV 25)

3. **Backup/restore system in place**
   - API endpoints ready for frontend integration
   - Automatic backups on remap operations

### ⚠️ Remaining Issues

Looking at the current layout data, there are still some problems:

1. **Duplicate Output Numbers**:
   - Two TVs mapped to output 1 (should be TV 01 and TV 02)
   - Two TVs mapped to output 10
   - Two TVs mapped to output 14
   - Two TVs mapped to output 16
   - Two TVs mapped to output 19

2. **Missing TVs**:
   - No TVs mapped to outputs: 2, 5, 6, 12, 13, 17, 22

3. **OCR Misreads**:
   - "TV 108" detected instead of "TV 08" or "TV 07"
   - "TV 109" detected instead of "TV 09" or "TV 11"
   - "TV 121" detected instead of "TV 17"

### 🔧 How to Fix Remaining Issues

#### Option 1: Update Manual Overrides (Recommended)

Edit `/home/ubuntu/Sports-Bar-TV-Controller/data/layout-overrides.json` to map each zone by its current label and position. You'll need to identify which physical TV each zone represents.

Example:
```json
{
  "overrides": {
    "TV 01": 2,  // If the second "TV 01" is actually TV 02
    "TV 108": 7,  // Already set
    "TV 109": 11  // Already set
  }
}
```

Then run:
```bash
node scripts/remap-layout-outputs.js
```

#### Option 2: Manual JSON Edit

Edit `/home/ubuntu/Sports-Bar-TV-Controller/data/tv-layout.json` directly and update:
- `outputNumber` field
- `id` field (should be `tv{outputNumber}`)
- `label` field

**Create a backup first!**
```bash
cp data/tv-layout.json data/tv-layout-manual-backup.json
```

#### Option 3: Re-upload Layout with Better OCR

1. Create backup: `node scripts/remap-layout-outputs.js --dry-run` (check first)
2. Edit the layout image to have clearer labels (if possible)
3. Re-upload through the UI
4. The updated OCR service will now correctly map output numbers

---

## Testing Recommendations

### 1. Test OCR-Based Detection on New Upload

1. Go to Bartender Layout Configuration
2. Upload a test layout image with clear TV labels
3. Verify output numbers match the labels in the uploaded image
4. Check server logs for OCR processing messages

### 2. Test Backup/Restore API

```bash
# Create backup
curl -X POST http://localhost:3000/api/bartender/layout/backup \
  -H "Content-Type: application/json" \
  -d '{"action": "create"}'

# List backups
curl http://localhost:3000/api/bartender/layout/backup

# Restore backup
curl -X POST http://localhost:3000/api/bartender/layout/backup \
  -H "Content-Type: application/json" \
  -d '{"action": "restore", "filename": "tv-layout-2025-10-31T20-27-46-919Z.json"}'
```

### 3. Test Manual Remapping Script

```bash
# Preview changes
node scripts/remap-layout-outputs.js --dry-run

# Apply changes
node scripts/remap-layout-outputs.js

# Verify
python3 -c "
import json
with open('data/tv-layout.json') as f:
    layout = json.load(f)
    for z in sorted(layout['zones'], key=lambda x: x['outputNumber']):
        print(f'Output {z[\"outputNumber\"]:2d}: {z[\"label\"]}')
"
```

---

## Long-Term Prevention

### For Future Uploads:

1. **Always create a backup first**: Use the backup API or manually copy the file
2. **Use the manual override file**: Add known OCR errors to `layout-overrides.json`
3. **Verify after upload**: Check that output numbers match expected TV positions
4. **Use the remap script**: If needed, run `node scripts/remap-layout-outputs.js`

### For Better OCR Accuracy:

1. **High-resolution images**: Upload images at 300 DPI or higher
2. **Clear labels**: Ensure TV labels are clearly visible and unobstructed
3. **Consistent format**: Use "TV 01", "TV 02" format (not "TV1", "TV-01", etc.)
4. **Good contrast**: Black text on white background works best

---

## Files Modified/Created

### Modified Files:
- `/home/ubuntu/Sports-Bar-TV-Controller/services/ocr-service.py`
  - Updated to set `outputNumber` from OCR results

### New Files:
- `/home/ubuntu/Sports-Bar-TV-Controller/scripts/remap-layout-outputs.js`
  - Manual remapping script
- `/home/ubuntu/Sports-Bar-TV-Controller/scripts/remap-layout-outputs.ts`
  - TypeScript version (needs ts-node config)
- `/home/ubuntu/Sports-Bar-TV-Controller/src/app/api/bartender/layout/backup/route.ts`
  - Backup/restore API
- `/home/ubuntu/Sports-Bar-TV-Controller/data/layout-overrides.json`
  - Manual override configuration
- `/home/ubuntu/Sports-Bar-TV-Controller/docs/TV_LAYOUT_FIX_SUMMARY.md`
  - This documentation

### Backup Files:
- `/home/ubuntu/Sports-Bar-TV-Controller/data/backups/tv-layout-2025-10-31T20-27-46-919Z.json`
  - Automatic backup before remapping

---

## Next Steps

### Immediate Actions:

1. **Review the current mappings** to identify which zones need manual correction
2. **Update `layout-overrides.json`** with correct mappings for duplicate outputs
3. **Run the remap script** to apply corrections
4. **Test in the UI** to verify TVs respond to the correct output channels

### Future Improvements:

1. **Add Position-Based Override**: Allow overrides by X/Y coordinates for cases where labels are completely wrong
2. **UI for Override Management**: Build a frontend interface to manage overrides
3. **OCR Training**: Improve OCR accuracy for specific font styles used in layouts
4. **Interactive Mapping Tool**: Create a UI tool to manually map TVs by clicking on the layout image

---

## Support

If you encounter issues:

1. Check server logs for OCR processing errors
2. Verify backup files exist in `data/backups/`
3. Review `data/layout-overrides.json` for syntax errors
4. Run remap script with `--dry-run` first to preview changes

For OCR errors, the manual override file is the quickest solution.
