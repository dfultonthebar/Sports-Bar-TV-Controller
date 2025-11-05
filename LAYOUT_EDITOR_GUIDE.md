# Layout Editor - Complete Manual Editing Guide

**Access:** http://24.123.87.42:3001/layout-editor

---

## Features Overview

The Layout Editor provides complete control over your bar's TV layout configuration with both automatic AI detection and full manual editing capabilities.

### ✨ What You Can Do

1. **Upload & Auto-Detect** - Upload bar layout image, AI detects all TVs automatically
2. **Drag & Drop Positioning** - Reposition any TV zone with mouse drag
3. **Draw New Zones** - Manually add TVs the AI missed
4. **Edit Labels** - Change TV names (TV 1, TV 2, etc.)
5. **Reassign Outputs** - Map TVs to different Wolf Pack outputs
6. **Delete Zones** - Remove incorrect detections
7. **Re-detect** - Run AI detection again with different settings
8. **Save Layout** - Persist all changes to database

---

## Step-by-Step Workflow

### 1. Upload Your Layout Image

**Left Panel → Upload Layout:**
- Click "Choose Image"
- Select your bar floor plan (PNG, JPG, PDF)
- Max size: 25MB
- Click "Upload & Auto-Detect"

**Result:** AI will automatically detect all TV positions and create zones.

### 2. Review Auto-Detected Zones

**Center Panel:** Your image with colored rectangles showing detected TVs

**Right Panel:** List of all zones with:
- TV label (e.g., "TV 1")
- Output number (Wolf Pack channel)
- Position (x, y, width, height %)

### 3. Manual Editing - Three Modes

#### Mode A: Select & Edit
**Use For:** Changing labels and output assignments

1. Keep "Select & Edit" mode active (default)
2. Click any zone on the image
3. Edit in the right panel:
   - Label field: Change TV name
   - Output # field: Reassign Wolf Pack output
4. Changes apply instantly

#### Mode B: Move Zones (NEW! 🎉)
**Use For:** Repositioning TVs that are slightly off

1. Click "Move Zones" button in left panel
2. Click any TV zone on the image
3. Drag to new position
4. Release to drop
5. Zone stays within boundaries automatically

**Features:**
- Real-time visual feedback
- Move icon appears on selected zone
- Cursor changes to move cursor
- Smooth dragging experience

#### Mode C: Draw New Zone
**Use For:** Adding TVs the AI missed

1. Click "Draw New Zone" button
2. Click first corner on the image
3. Click opposite corner
4. New zone created automatically
5. Edit label and output in right panel

### 4. Fine-Tune Individual Zones

**For Each Zone:**
- **Label:** Change from "TV 1" to any name (e.g., "Main Bar TV")
- **Output Number:** Map to Wolf Pack output (1-36)
- **Position:** View exact x, y, width, height percentages
- **Delete:** Click trash icon to remove

### 5. Save Your Changes

**Left Panel → Save Layout:**
- Click "Save Layout" button
- Changes persist to database
- Layout immediately available on `/remote` page

---

## Edit Mode Comparison

| Mode | Purpose | How to Use | Best For |
|------|---------|------------|----------|
| **Select & Edit** | Change labels/outputs | Click zone → Edit right panel | Renaming TVs, reassigning outputs |
| **Move Zones** | Reposition TVs | Click & drag | Adjusting AI detection positions |
| **Draw New Zone** | Add missing TVs | Click 2 corners | TVs AI didn't detect |

---

## Advanced Features

### Re-detect Zones
**When to Use:** AI detection needs improvement

1. Adjust your image (brightness, contrast, crop)
2. Re-upload OR click "Re-detect Zones"
3. AI runs again with fresh analysis
4. Replaces all current zones

**Warning:** This clears all manual edits!

### Delete Zones
**When to Use:** AI detected something that's not a TV

1. Select zone in right panel or on image
2. Click trash icon
3. Zone removed instantly

### Position Constraints
- Zones automatically stay within 0-95% of image
- Prevents TVs from being positioned off-screen
- Drag boundaries enforced in real-time

---

## Keyboard Shortcuts & Tips

### Mouse Controls
- **Click zone** - Select for editing
- **Drag zone** (in Move mode) - Reposition
- **Click two points** (in Draw mode) - Create rectangle

### Best Practices
1. **Upload high-quality images** - Better AI detection
2. **Use "Move Zones" for small adjustments** - Faster than re-detecting
3. **Label TVs clearly** - "Main Bar", "Back Corner", etc. more helpful than "TV 1"
4. **Save frequently** - Changes only persist after clicking "Save Layout"
5. **Test on /remote** - Verify layout displays correctly

---

## Troubleshooting

### AI Didn't Detect All TVs
**Solution:** Use "Draw New Zone" to manually add missing TVs

### TV Position is Slightly Off
**Solution:** Use "Move Zones" mode to drag to correct position

### Wrong Output Assignment
**Solution:** Select zone → Edit "Output #" field in right panel

### Need to Start Over
**Solution:** Click "Re-detect Zones" or upload new image

### Changes Not Showing on /remote
**Solution:** Make sure you clicked "Save Layout" button

---

## Technical Details

### Layout Data Structure
```json
{
  "name": "Bar Layout",
  "imageUrl": "/api/uploads/layouts/xyz_professional.png",
  "zones": [
    {
      "id": "tv1",
      "outputNumber": 1,
      "x": 85.88,
      "y": 9.63,
      "width": 5.5,
      "height": 5.5,
      "label": "TV 1",
      "confidence": 0.95
    }
  ]
}
```

### Position Values
- **x, y:** Top-left corner position (% of image width/height)
- **width, height:** Zone dimensions (% of image width/height)
- **Percentages:** Responsive across all screen sizes

### Storage Locations
- **Layout Data:** `/data/tv-layout.json`
- **Images:** `/public/uploads/layouts/`
- **API Endpoint:** `/api/bartender/layout`

---

## Integration with Other Pages

### /remote (Video Tab)
- Displays saved layout with interactive TV controls
- Click TV to route video sources
- Real-time status indicators
- Your manual edits appear here automatically

### /device-config
- Alternative entry point for layout configuration
- Same data source as Layout Editor
- Synchronized in real-time

---

## Workflow Summary

```
Upload Image
    ↓
AI Auto-Detect
    ↓
Review Zones
    ↓
Manual Adjustments:
  - Move Zones (drag & drop)
  - Edit Labels
  - Reassign Outputs
  - Draw New Zones
  - Delete Zones
    ↓
Save Layout
    ↓
View on /remote
```

---

## FAQs

**Q: Can I edit the layout after saving?**
A: Yes! Layout Editor loads your saved layout. Make changes and save again.

**Q: What happens if I don't save?**
A: Changes are lost. Always click "Save Layout" before leaving.

**Q: Can I undo changes?**
A: Not currently. Refresh page to reload last saved version.

**Q: How many TVs can I have?**
A: Up to 36 TVs (Wolf Pack matrix limit)

**Q: Can I upload multiple layouts?**
A: Currently one active layout at a time. Upload new image to replace.

**Q: Do I need to re-upload to adjust positions?**
A: No! Use "Move Zones" mode to drag TVs to new positions.

---

## Support & Additional Tools

### Related Pages
- `/remote` - Interactive TV control with layout
- `/device-config` - Device configuration
- `/matrix-control` - Wolf Pack routing
- `/system-health` - System status

### Tools Used
- **AI Detection:** Claude 3.5 Sonnet Vision API
- **OCR:** Google Coral TPU (if available)
- **Image Processing:** Sharp (Node.js)
- **PDF Conversion:** pdftoppm

---

**Last Updated:** 2025-11-05
**Version:** 2.1.0 (Drag & Drop Release)
