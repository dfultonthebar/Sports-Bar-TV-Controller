
# 🎯 Layout Analysis & AI Recognition Guide

## Overview

This guide provides comprehensive instructions for creating optimal layout images that work best with the Sports Bar AI Assistant's automated TV position detection and mapping system.

## 📋 Image Specifications for Optimal AI Analysis

### **Recommended File Formats**
- **PDF**: Preferred for vector-based layouts (AutoCAD, architectural drawings)
- **PNG**: Best for raster images with sharp details
- **JPEG**: Acceptable but may lose fine detail in text/numbers

### **Optimal Image Settings**

| Specification | Recommended Value | Benefit |
|---------------|------------------|---------|
| **Resolution** | 2400×1800+ pixels | Better text/number recognition |
| **DPI** | 300+ for PDFs | Sharp conversion to raster |
| **File Size** | 5-20MB (max 25MB) | High quality without performance issues |
| **Color Mode** | RGB or Grayscale | Consistent processing |
| **Compression** | Minimal/Lossless | Preserve fine details |

### **Layout Content Guidelines**

✅ **DO Include:**
- Clear, readable TV/marker numbers (TV 1, TV 2, etc.)
- Consistent numbering scheme throughout
- Wall labels or directional indicators
- Room/area names or sections
- High contrast between numbers and background
- Font size 12pt+ for text elements

❌ **AVOID:**
- Blurry or pixelated numbers
- Inconsistent numbering (mixing TV 1, Screen A, Display #3)
- Very small fonts (under 10pt)
- Low contrast colors
- Overlapping text or numbers
- Rotated text that's hard to read

## 🤖 How the AI Analysis Works

### **Detection Process**
1. **PDF Conversion**: PDFs converted to PNG at 300 DPI
2. **Number Extraction**: AI scans for TV/marker numbers using pattern recognition
3. **Position Analysis**: Determines wall positions from text descriptions
4. **Smart Mapping**: Maps detected numbers to physical positions
5. **Fallback Generation**: Creates grid layouts for unrecognized patterns

### **Pattern Recognition**
The AI looks for these patterns:
- `TV 1`, `TV 2`, `TV 3...`
- `Marker 1`, `Marker 2`, `Marker 3...`
- `Display 1`, `Screen 1`, etc.
- `1 is located...`, `2 is on the...`

### **Position Detection**
Wall positions determined by text context:
- **Left Wall**: "left wall", "vertical wall" + "left"
- **Right Wall**: "right wall", "vertical wall" + "right"
- **Top Wall**: "top wall", "upper wall", "horizontal wall" + "top"
- **Bottom Wall**: "bottom wall", "lower wall", "horizontal wall" + "bottom"
- **Corner**: "corner", "angled"

## 🎨 Graphics Designer Guidelines

### **Creating New Layouts**

1. **Use Consistent Numbering**
   ```
   ✅ Good: TV 1, TV 2, TV 3, TV 4...
   ❌ Bad: TV-1, Display A, Screen #3, Monitor Four
   ```

2. **Add Descriptive Text**
   ```
   ✅ Good: "TV 5 is on the right wall near the entrance"
   ❌ Bad: Just showing "5" with no context
   ```

3. **Include Area Names**
   ```
   ✅ Good: "Main Bar Area", "Side Dining", "VIP Section"
   ❌ Bad: Unlabeled room sections
   ```

4. **Use High Contrast**
   - Dark numbers on light backgrounds
   - Bold, sans-serif fonts
   - Minimum 12pt font size

### **Layout Structure Examples**

**Architectural Floor Plan:**
```
Main Bar Area:
- TV 1: Left wall, near entrance
- TV 2: Behind main bar, center
- TV 3: Right wall, corner position

Side Dining Area:
- TV 4: Top wall, above booth seating
- TV 5: Left wall, facing tables
```

**Simple Grid Layout:**
```
[TV 1]    [TV 2]    [TV 3]
  |         |         |
[TV 4]    [TV 5]    [TV 6]
  |         |         |
[TV 7]    [TV 8]    [TV 9]
```

## 🔧 Technical Implementation

### **Image Processing Pipeline**
1. **Upload**: File uploaded via bartender interface
2. **Validation**: Format and size checks (max 25MB)
3. **Conversion**: PDFs converted at 300 DPI using `pdftoppm`
4. **Optimization**: Sharp processing with 95% PNG quality
5. **Analysis**: AI parsing of text and number patterns
6. **Mapping**: Intelligent position assignment

### **Supported File Types**
```javascript
const validTypes = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
  'application/pdf'
]
```

### **Processing Limits**
- **File Size**: 25MB maximum
- **Resolution**: Up to 2400×1800 optimized output
- **TV Count**: Up to 50 TVs per layout
- **Processing Time**: ~5-15 seconds depending on complexity

## 📊 Testing Your Layouts

### **Upload Process**
1. Navigate to Management → Layout Import
2. Upload your layout file
3. Review AI-detected TV positions
4. Use "Import Layout Positions" to apply to matrix
5. Verify mappings in Matrix Control section

### **Validation Checklist**
- [ ] All TV numbers detected correctly
- [ ] Positions mapped to appropriate walls
- [ ] No overlapping TV locations
- [ ] Matrix outputs properly assigned
- [ ] Bartender interface displays layout correctly

## 🚀 Best Practices

### **For Maximum Accuracy:**
1. **Create dedicated layout documents** (don't use existing floor plans with cluttered text)
2. **Use sequential numbering** starting from 1
3. **Include wall descriptions** in text form
4. **Test with simple layouts first** before complex designs
5. **Provide multiple views** if needed (overview + detail views)

### **Common Issues & Solutions**

| Problem | Solution |
|---------|----------|
| Numbers not detected | Increase font size, improve contrast |
| Wrong positions | Add wall descriptions in text |
| Overlapping TVs | Improve spacing, use edge margins |
| Missing TVs | Ensure consistent numbering scheme |
| Poor quality conversion | Use higher DPI PDFs or PNG format |

## 📞 Support

If you encounter issues with layout analysis:
1. Check the browser console for error messages
2. Verify your image meets the recommended specifications
3. Try a simplified version of your layout first
4. Review the AI analysis results in the management interface

---

## 🔄 Version History

- **v2.0** (Current): Dynamic AI parsing, 300 DPI processing, 25MB limit
- **v1.0**: Hardcoded layouts, 200 DPI processing, 10MB limit

---

*Last updated: [Current Date] - For the latest version, check the GitHub repository*
