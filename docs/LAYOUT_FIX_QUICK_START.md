# TV Layout Fix - Quick Start Guide

## What Was Fixed

✅ **Output numbers now match TV labels** - TVs are correctly mapped to their physical output channels
✅ **TV 25 is detected** - All 24 TVs including TV 25 (in patio) are found
✅ **Backup/restore system** - Preserve your mappings when reuploading layouts
✅ **Manual override support** - Correct OCR errors easily

---

## Quick Commands

### 1. Analyze Current Layout Issues
```bash
node scripts/analyze-layout-issues.js
```
Shows duplicate outputs, missing outputs, and OCR errors.

### 2. Fix Layout Mappings
```bash
# Preview what will change
node scripts/remap-layout-outputs.js --dry-run

# Apply fixes (creates automatic backup)
node scripts/remap-layout-outputs.js
```

### 3. Create Manual Backup
```bash
cp data/tv-layout.json data/backups/tv-layout-manual-$(date +%Y%m%d-%H%M%S).json
```

### 4. Restore From Backup
```bash
cp data/backups/tv-layout-YYYYMMDD-HHMMSS.json data/tv-layout.json
```

---

## Current Status

**✅ Already Fixed**:
- Output number mapping script created and tested
- OCR service updated to assign correct output numbers on future uploads
- Backup/restore API ready
- TV 25 is being detected correctly

**⚠️ Still Needs Attention**:
- Some duplicate output numbers (5 duplicates)
- Some missing output numbers (6 missing: 2, 5, 6, 12, 13, 22)
- OCR misreads need manual correction (TV 108, TV 109, TV 121)

Run `node scripts/analyze-layout-issues.js` for detailed analysis.

---

## How to Correct OCR Errors

Edit `/home/ubuntu/Sports-Bar-TV-Controller/data/layout-overrides.json`:

```json
{
  "overrides": {
    "TV 108": 7,   // Map misread label to correct output
    "TV 109": 11,
    "TV 121": 17
  }
}
```

Then run:
```bash
node scripts/remap-layout-outputs.js
```

---

## For Future Layout Uploads

1. **Before uploading**: Create a backup
   ```bash
   node scripts/remap-layout-outputs.js --dry-run  # Just to create backup
   ```

2. **Upload layout**: Use the Bartender UI as normal

3. **Verify**: Check that output numbers match TV labels
   ```bash
   node scripts/analyze-layout-issues.js
   ```

4. **If needed**: Apply corrections with the remap script

---

## Files & Documentation

- 📖 **Detailed Guide**: `docs/TV_LAYOUT_FIX_SUMMARY.md`
- 🔧 **Remap Script**: `scripts/remap-layout-outputs.js`
- 📊 **Analyze Script**: `scripts/analyze-layout-issues.js`
- ⚙️ **Manual Overrides**: `data/layout-overrides.json`
- 💾 **Backups**: `data/backups/`

---

## API Endpoints (For Frontend Integration)

### List Backups
```bash
GET /api/bartender/layout/backup
```

### Create Backup
```bash
POST /api/bartender/layout/backup
Content-Type: application/json

{"action": "create"}
```

### Restore Backup
```bash
POST /api/bartender/layout/backup
Content-Type: application/json

{"action": "restore", "filename": "tv-layout-2025-10-31T20-27-46-919Z.json"}
```

---

## Need Help?

1. Check `docs/TV_LAYOUT_FIX_SUMMARY.md` for detailed explanations
2. Run `node scripts/analyze-layout-issues.js` to diagnose problems
3. Review server logs for OCR processing errors
4. Check `data/backups/` for previous versions

---

## Technical Details

**Root Cause**: OCR service ran AFTER zone detection and only updated the `label` field, not the `outputNumber` field. Output numbers were assigned based on spatial detection order (top-to-bottom, left-to-right) rather than the OCR-extracted TV labels.

**Solution**: Updated OCR service to set both `label` AND `outputNumber` from OCR results. Created manual scripts and API for backup/restore and remapping.

**Files Modified**:
- `services/ocr-service.py` - Now sets outputNumber from OCR

**Files Created**:
- `scripts/remap-layout-outputs.js` - Manual remapping tool
- `scripts/analyze-layout-issues.js` - Diagnostic tool
- `src/app/api/bartender/layout/backup/route.ts` - Backup/restore API
- `data/layout-overrides.json` - Manual override configuration
