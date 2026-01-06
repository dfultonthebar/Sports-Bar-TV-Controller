# @sports-bar/layout-detection

TV Layout Auto-Detection System for Sports Bar TV Controller

## Overview

This package provides functionality to automatically detect TV positions from uploaded layout images by finding red rectangles and extracting labels using OCR.

## Features

- **Red Rectangle Detection**: Analyzes images to find TV positions marked with red rectangles
- **Dual OCR System**:
  - Primary: Ollama Vision Model (GPU-accelerated)
  - Fallback: Tesseract OCR (CPU-based)
- **Touch-Friendly Zone Expansion**: Automatically expands detected zones to minimum touch-friendly sizes
- **Overlap Resolution**: Intelligently resolves overlapping zones
- **Auto-Matching**: Matches detected zones to WolfPack HDMI matrix outputs

## Dependencies

- **sharp**: Image processing
- **tesseract.js**: OCR text extraction
- **node-fetch**: HTTP requests for Ollama API
- **@sports-bar/logger**: Logging utilities

## API

### `detectTVZonesFromImage(imagePath: string, options?: { skipOCR?: boolean })`

Detects TV zones from an uploaded layout image.

**Parameters:**
- `imagePath`: Absolute path to the layout image
- `options.skipOCR`: Skip OCR and use auto-generated labels (faster)

**Returns:** `Promise<LayoutDetectionResult>`

```typescript
interface LayoutDetectionResult {
  zones: DetectedZone[]
  imageWidth: number
  imageHeight: number
  detectionsCount: number
  errors: string[]
}
```

### `autoMatchZonesToOutputs(zones: DetectedZone[], outputs: Array<{ channelNumber: number; label: string }>)`

Matches detected zones to WolfPack HDMI matrix outputs.

**Parameters:**
- `zones`: Array of detected zones
- `outputs`: Array of output configurations

**Returns:** `DetectedZone[]` with updated output mappings

## Types

### `DetectedZone`

```typescript
interface DetectedZone {
  id: string
  outputNumber: number
  x: number // percentage
  y: number // percentage
  width: number // percentage
  height: number // percentage
  label: string
  confidence: number // 0-1 scale
  ocrMethod?: 'ollama' | 'tesseract' | 'manual'
}
```

## Usage Example

```typescript
import { detectTVZonesFromImage, autoMatchZonesToOutputs } from '@sports-bar/layout-detection'

// Detect TV zones from layout image
const result = await detectTVZonesFromImage('/path/to/layout.png')

console.log(`Found ${result.zones.length} TVs`)
result.zones.forEach(zone => {
  console.log(`${zone.label}: ${zone.x}%, ${zone.y}%`)
})

// Match to WolfPack outputs
const outputs = [
  { channelNumber: 1, label: 'TV 01' },
  { channelNumber: 2, label: 'TV 02' }
]

const matchedZones = autoMatchZonesToOutputs(result.zones, outputs)
```

## How It Works

1. **Image Loading**: Uses Sharp to load and process the image
2. **Red Rectangle Detection**: Scans pixels to find red-colored rectangles (RGB: 237, 28, 36)
3. **Flood Fill**: Groups connected red pixels into rectangles
4. **Zone Expansion**: Expands small zones to minimum touch-friendly sizes (5.5% width/height)
5. **Overlap Resolution**: Adjusts overlapping zones to maintain spacing
6. **OCR Extraction**:
   - Tries Ollama Vision Model first (if available)
   - Falls back to Tesseract OCR
   - Uses manual labels as last resort
7. **Label Cleaning**: Normalizes detected text to standard format (e.g., "TV 01")

## Configuration

### Red Color Thresholds

The detector looks for red rectangles with these thresholds:

```typescript
const RED_THRESHOLD = { min: 180, max: 255 }
const GREEN_THRESHOLD = { max: 150 }
const BLUE_THRESHOLD = { max: 150 }
```

### Touch-Friendly Sizes

```typescript
const MIN_TOUCH_WIDTH = 5.5  // % of image width
const MIN_TOUCH_HEIGHT = 5.5 // % of image height
const MIN_SPACING = 2.0      // % minimum spacing between zones
```

## OCR Methods

### Ollama Vision (Primary)

- Requires Ollama server running on `localhost:11434`
- Uses `llama3.2-vision` model
- GPU-accelerated with Intel graphics
- More accurate for reading TV labels

### Tesseract (Fallback)

- CPU-based OCR
- English language support
- Confidence threshold: 60%

### Manual Labels (Last Resort)

- Auto-generated labels: "TV 01", "TV 02", etc.
- Used when OCR fails or is skipped

## Notes

- The original implementation was at `apps/web/src/lib/layout-detector.ts` (803 lines)
- Now extracted to this shared package for reusability
- The web app uses a bridge file at the original location that re-exports from this package
- All existing imports continue to work without changes

## License

Part of Sports Bar TV Controller monorepo
