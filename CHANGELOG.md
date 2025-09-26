
# 📝 Changelog

All notable changes to the Sports Bar AI Assistant project will be documented in this file.

## [2.1.0] - 2024-09-26

### 🎯 Layout Analysis Optimization

#### Added
- **Dynamic AI Layout Parsing**: Replace hardcoded TV locations with intelligent text analysis
- **Enhanced Image Processing**: 300 DPI PDF conversion (up from 200 DPI)
- **Higher Quality Output**: 2400x1800 max resolution with 95% PNG quality
- **Increased File Support**: 25MB file size limit (up from 10MB)
- **Smart Number Detection**: Regex-based extraction of TV/marker numbers from descriptions
- **Wall Position Analysis**: Automatic detection of left/right/top/bottom wall positions
- **Fallback Grid Generation**: Intelligent positioning for unknown layout formats
- **Multi-format Support**: Works with any layout type, not just Stoneyard Appleton

#### Changed
- PDF conversion DPI: 200 → 300 for better text recognition
- Image quality: 90% → 95% PNG compression
- Max resolution: 1920x1080 → 2400x1800
- File size limit: 10MB → 25MB
- Scaling algorithm: Default → Lanczos3 for superior quality

#### Fixed
- Hardcoded TV locations limiting flexibility
- Poor text recognition in converted PDFs
- Overlapping TV positions in corner areas
- Limited support for different layout types

#### Technical Details
```javascript
// Before: Hardcoded locations
const knownLocations = [
  { number: 1, description: "Side Area 1...", wall: "left" },
  // ... fixed 20 locations
]

// After: Dynamic parsing
const foundNumbers = extractNumbersFromDescription(description)
const locations = foundNumbers.map(num => 
  extractTVLocationFromDescription(description, num)
)
```

### 🔧 Performance Improvements
- Better compression settings for optimal quality/size balance
- Improved regex patterns for number detection
- Enhanced error handling for unknown layouts

---

## [2.0.0] - 2024-09-25

### 🚀 Major Features Added
- **Matrix Audio Control**: Added audio output labeling and routing
- **Unused Channel Management**: Mark inputs/outputs as unused with visual indicators
- **Enhanced Matrix Interface**: Improved matrix control with status management
- **AI Layout Import**: Import TV positions from uploaded layout images
- **Bartender Layout Display**: Show venue layout in bartender remote interface

### 📊 Database Updates
- Added `audioOutput` field to matrix outputs
- Added `status` fields for inputs/outputs (active/unused/audio)
- Enhanced Prisma schema for better matrix management

---

## [1.5.0] - 2024-09-24

### 🎨 UI/UX Improvements
- **Bartender Interface Redesign**: Cleaner, more intuitive remote control
- **Management Access Control**: Restricted management features from bartender view
- **Layout Visualization**: Added TV layout display in operational interface
- **Responsive Design**: Improved mobile and tablet compatibility

### 🔧 Bug Fixes
- Fixed PDF to PNG conversion issues
- Resolved overlapping TV positioning in corners
- Improved matrix control reliability
- Enhanced error handling for file uploads

---

## [1.0.0] - 2024-09-23

### 🎉 Initial Release
- **Core AV Control**: Basic matrix switching and device control
- **AI Assistant**: Document analysis and troubleshooting support
- **Wolf Pack Integration**: Matrix control system support
- **IR Device Management**: Global Cache IR control
- **Document Upload**: PDF and image analysis capabilities
- **Web Interface**: Management and bartender interfaces

### 🛠️ Technical Foundation
- Next.js 14 with TypeScript
- Prisma ORM with SQLite
- PDF processing with pdftoppm
- Sharp image processing
- Tailwind CSS styling

---

## Development Notes

### Package Manager Migration
- **Migrated from Yarn to NPM**: Resolved version conflicts and build issues
- **Automated Update Scripts**: Created reliable deployment and update processes
- **GitHub Integration**: Automated commit and push workflows

### Deployment
- **PM2 Process Management**: Reliable server process management
- **Environment Configuration**: Proper .env handling and database setup
- **Update Automation**: One-command updates from GitHub

---

*For detailed technical information, see the README.md and LAYOUT_ANALYSIS_GUIDE.md files.*
