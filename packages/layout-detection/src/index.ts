/**
 * TV Layout Auto-Detection System
 *
 * Analyzes uploaded layout images to automatically detect TV positions
 * by finding red rectangles and extracting labels.
 */

import sharp from 'sharp'
import Tesseract from 'tesseract.js'
import fetch from 'node-fetch'

import { logger } from '@sports-bar/logger'

export interface DetectedZone {
  id: string
  outputNumber: number
  x: number // percentage
  y: number // percentage
  width: number // percentage
  height: number // percentage
  label: string
  confidence: number // 0-1 scale
  ocrMethod?: 'ollama' | 'tesseract' | 'manual' // Track which OCR method was used
}

export interface LayoutDetectionResult {
  zones: DetectedZone[]
  imageWidth: number
  imageHeight: number
  detectionsCount: number
  errors: string[]
}

interface Rectangle {
  x: number
  y: number
  width: number
  height: number
  pixels: number[][]
}

/**
 * Detect red rectangles in layout image
 * Red rectangles represent TV positions
 */
export async function detectTVZonesFromImage(
  imagePath: string,
  options?: { skipOCR?: boolean }
): Promise<LayoutDetectionResult> {
  const errors: string[] = []
  const skipOCR = options?.skipOCR ?? false

  try {
    // Load image and get metadata
    const image = sharp(imagePath)
    const metadata = await image.metadata()

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions')
    }

    const imageWidth = metadata.width
    const imageHeight = metadata.height

    // Extract raw pixel data
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true })

    logger.info(`[Layout Detector] Image loaded: ${imageWidth}x${imageHeight}, channels: ${info.channels}`)

    // Detect red regions (TV rectangles)
    const rectangles = await detectRedRectangles(data, imageWidth, imageHeight, info.channels)

    logger.info(`[Layout Detector] Found ${rectangles.length} potential TV rectangles`)

    // Extract labels and create zones
    const zones = await extractZonesFromRectangles(
      rectangles,
      imagePath,
      imageWidth,
      imageHeight,
      skipOCR
    )

    // Sort by position (top to bottom, left to right)
    zones.sort((a, b) => {
      const yDiff = a.y - b.y
      if (Math.abs(yDiff) > 5) return yDiff // Different rows
      return a.x - b.x // Same row, sort by x
    })

    return {
      zones,
      imageWidth,
      imageHeight,
      detectionsCount: rectangles.length,
      errors
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(errorMsg)
    logger.error('[Layout Detector] Error:', error)

    return {
      zones: [],
      imageWidth: 0,
      imageHeight: 0,
      detectionsCount: 0,
      errors
    }
  }
}

/**
 * Detect rectangles filled with red color
 */
async function detectRedRectangles(
  pixelData: Buffer,
  width: number,
  height: number,
  channels: number
): Promise<Rectangle[]> {
  const rectangles: Rectangle[] = []
  const visited = new Set<string>()

  // Red color thresholds (for detecting red rectangles in the layout)
  // Adjusted for RGB(237,28,36) - the actual red color in Graystone Layout
  const RED_THRESHOLD = { min: 180, max: 255 }  // More lenient red threshold
  const GREEN_THRESHOLD = { max: 150 }  // Allow some green (was 100)
  const BLUE_THRESHOLD = { max: 150 }   // Allow some blue (was 100)

  const isRed = (r: number, g: number, b: number): boolean => {
    // Must be predominantly red (R > G and R > B)
    return (
      r >= RED_THRESHOLD.min &&
      r <= RED_THRESHOLD.max &&
      g <= GREEN_THRESHOLD.max &&
      b <= BLUE_THRESHOLD.max &&
      r > g + 50 &&  // Red must be significantly higher than green
      r > b + 50     // Red must be significantly higher than blue
    )
  }

  const getPixel = (x: number, y: number) => {
    const idx = (y * width + x) * channels
    return {
      r: pixelData[idx],
      g: pixelData[idx + 1],
      b: pixelData[idx + 2]
    }
  }

  // Flood fill to find connected red regions
  const floodFill = (startX: number, startY: number): Rectangle | null => {
    const queue: [number, number][] = [[startX, startY]]
    const pixels: number[][] = []
    let minX = startX, maxX = startX, minY = startY, maxY = startY

    while (queue.length > 0) {
      const [x, y] = queue.shift()!
      const key = `${x},${y}`

      if (visited.has(key)) continue
      if (x < 0 || x >= width || y < 0 || y >= height) continue

      const pixel = getPixel(x, y)
      if (!isRed(pixel.r, pixel.g, pixel.b)) continue

      visited.add(key)
      pixels.push([x, y])

      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)

      // Check neighbors (4-directional)
      queue.push([x + 1, y])
      queue.push([x - 1, y])
      queue.push([x, y + 1])
      queue.push([x, y - 1])
    }

    // Filter out noise (very small regions)
    const rectWidth = maxX - minX + 1
    const rectHeight = maxY - minY + 1
    const MIN_SIZE = 5 // minimum 5px in either dimension (reduced from 10)

    // Also check pixel count to avoid tiny noise
    if (rectWidth < MIN_SIZE || rectHeight < MIN_SIZE || pixels.length < 20) {
      return null
    }

    return {
      x: minX,
      y: minY,
      width: rectWidth,
      height: rectHeight,
      pixels
    }
  }

  // Scan image for red pixels and flood fill to find rectangles
  // Sample every 3 pixels for better detection (was 5)
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const key = `${x},${y}`
      if (visited.has(key)) continue

      const pixel = getPixel(x, y)
      if (isRed(pixel.r, pixel.g, pixel.b)) {
        const rect = floodFill(x, y)
        if (rect) {
          rectangles.push(rect)
          logger.info(`[Detector] Found rectangle at (${rect.x}, ${rect.y}) size ${rect.width}x${rect.height}`)
        }
      }
    }
  }

  logger.info(`[Detector] Total rectangles found before merging: ${rectangles.length}`)

  // Merge nearby rectangles that might be the same TV
  const mergedRectangles = mergeNearbyRectangles(rectangles, width, height)

  logger.info(`[Detector] Total rectangles after merging: ${mergedRectangles.length}`)

  return mergedRectangles
}

/**
 * Resolve overlapping zones by adjusting positions and sizes
 */
function resolveOverlappingZones(
  zones: Array<{x: number, y: number, width: number, height: number, rect: Rectangle, index: number}>,
  imageWidth: number,
  imageHeight: number,
  minSpacing: number
): Array<{x: number, y: number, width: number, height: number, rect: Rectangle, index: number}> {

  const result = zones.map(z => ({ ...z })) // Deep copy

  // Check for overlaps and resolve them
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const zone1 = result[i]
      const zone2 = result[j]

      // Calculate overlap
      const x1Min = zone1.x
      const x1Max = zone1.x + zone1.width
      const y1Min = zone1.y
      const y1Max = zone1.y + zone1.height

      const x2Min = zone2.x
      const x2Max = zone2.x + zone2.width
      const y2Min = zone2.y
      const y2Max = zone2.y + zone2.height

      // Check for horizontal overlap
      const xOverlap = Math.max(0, Math.min(x1Max, x2Max) - Math.max(x1Min, x2Min))
      // Check for vertical overlap
      const yOverlap = Math.max(0, Math.min(y1Max, y2Max) - Math.max(y1Min, y2Min))

      // If they overlap or are too close
      if (xOverlap > 0 && yOverlap > 0) {
        logger.info(`[Zone Resolver] Zones ${i} and ${j} overlap by ${xOverlap.toFixed(2)}% x ${yOverlap.toFixed(2)}%`)

        // Determine if they're side-by-side or stacked
        const centerX1 = zone1.x + zone1.width / 2
        const centerX2 = zone2.x + zone2.width / 2
        const centerY1 = zone1.y + zone1.height / 2
        const centerY2 = zone2.y + zone2.height / 2

        const dx = Math.abs(centerX2 - centerX1)
        const dy = Math.abs(centerY2 - centerY1)

        if (dx > dy) {
          // Side-by-side: adjust horizontally
          const totalWidth = (x1Max - x1Min) + (x2Max - x2Min)
          const gap = minSpacing
          const availableWidth = (x2Max - x1Min)

          // Shrink both zones proportionally and add gap
          const scale = (availableWidth - gap) / totalWidth

          if (centerX1 < centerX2) {
            // zone1 is on the left
            zone1.width = zone1.width * scale
            zone2.x = zone1.x + zone1.width + gap
            zone2.width = zone2.width * scale
          } else {
            // zone2 is on the left
            zone2.width = zone2.width * scale
            zone1.x = zone2.x + zone2.width + gap
            zone1.width = zone1.width * scale
          }

          logger.info(`[Zone Resolver] Adjusted horizontally: zone${i} width=${zone1.width.toFixed(2)}%, zone${j} width=${zone2.width.toFixed(2)}%`)
        } else {
          // Stacked: adjust vertically
          const totalHeight = (y1Max - y1Min) + (y2Max - y2Min)
          const gap = minSpacing
          const availableHeight = (y2Max - y1Min)

          // Shrink both zones proportionally and add gap
          const scale = (availableHeight - gap) / totalHeight

          if (centerY1 < centerY2) {
            // zone1 is on top
            zone1.height = zone1.height * scale
            zone2.y = zone1.y + zone1.height + gap
            zone2.height = zone2.height * scale
          } else {
            // zone2 is on top
            zone2.height = zone2.height * scale
            zone1.y = zone2.y + zone2.height + gap
            zone1.height = zone1.height * scale
          }

          logger.info(`[Zone Resolver] Adjusted vertically: zone${i} height=${zone1.height.toFixed(2)}%, zone${j} height=${zone2.height.toFixed(2)}%`)
        }
      }
    }
  }

  logger.info(`[Zone Resolver] Resolved ${result.length} zones with minimum ${minSpacing}% spacing`)

  return result
}

/**
 * Adjust spacing between zones that are too close together
 * Specifically handles horizontally adjacent zones like TV 01 and TV 02
 */
function adjustTightlySpacedZones(
  zones: DetectedZone[]
): DetectedZone[] {
  const result = zones.map(z => ({ ...z })) // Deep copy
  const MIN_HORIZONTAL_GAP = 4.0 // Minimum 4% gap between horizontally adjacent zones

  // Check each pair of zones
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const zone1 = result[i]
      const zone2 = result[j]

      // Calculate centers
      const centerY1 = zone1.y + zone1.height / 2
      const centerY2 = zone2.y + zone2.height / 2

      // Check if they're on roughly the same horizontal line (within 10% vertically)
      const verticalDiff = Math.abs(centerY1 - centerY2)
      if (verticalDiff < 10) {
        // They're horizontally adjacent
        const zone1Right = zone1.x + zone1.width
        const zone2Left = zone2.x
        const zone2Right = zone2.x + zone2.width
        const zone1Left = zone1.x

        let gap = 0
        let isAdjacent = false

        // Check if zone2 is to the right of zone1
        if (zone1Right < zone2Right && zone1Left < zone2Left) {
          gap = zone2Left - zone1Right
          if (gap < MIN_HORIZONTAL_GAP) {
            logger.info(`[Zone Adjuster] Zones ${zone1.label} and ${zone2.label} are too close (gap: ${gap.toFixed(2)}%)`)
            // Move zone2 to the right
            const adjustment = MIN_HORIZONTAL_GAP - gap
            zone2.x += adjustment / 2
            zone1.x -= adjustment / 2
            // Make sure zone1 doesn't go negative
            if (zone1.x < 0) {
              const overflow = Math.abs(zone1.x)
              zone1.x = 0
              zone2.x += overflow
            }
            logger.info(`[Zone Adjuster] Adjusted ${zone1.label} to x=${zone1.x.toFixed(2)}%, ${zone2.label} to x=${zone2.x.toFixed(2)}%`)
            isAdjacent = true
          }
        }
        // Check if zone1 is to the right of zone2
        else if (zone2Right < zone1Right && zone2Left < zone1Left) {
          gap = zone1Left - zone2Right
          if (gap < MIN_HORIZONTAL_GAP) {
            logger.info(`[Zone Adjuster] Zones ${zone2.label} and ${zone1.label} are too close (gap: ${gap.toFixed(2)}%)`)
            // Move zone1 to the right
            const adjustment = MIN_HORIZONTAL_GAP - gap
            zone1.x += adjustment / 2
            zone2.x -= adjustment / 2
            // Make sure zone2 doesn't go negative
            if (zone2.x < 0) {
              const overflow = Math.abs(zone2.x)
              zone2.x = 0
              zone1.x += overflow
            }
            logger.info(`[Zone Adjuster] Adjusted ${zone2.label} to x=${zone2.x.toFixed(2)}%, ${zone1.label} to x=${zone1.x.toFixed(2)}%`)
            isAdjacent = true
          }
        }
      }
    }
  }

  return result
}

/**
 * Merge rectangles that are very close together (likely same TV)
 */
function mergeNearbyRectangles(
  rectangles: Rectangle[],
  imageWidth: number,
  imageHeight: number
): Rectangle[] {
  if (rectangles.length === 0) return []

  // Sort by position (top to bottom, left to right)
  const sorted = [...rectangles].sort((a, b) => {
    const yDiff = a.y - b.y
    if (Math.abs(yDiff) > 20) return yDiff
    return a.x - b.x
  })

  const merged: Rectangle[] = []
  const used = new Set<number>()

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue

    let current = sorted[i]
    const toMerge = [i]

    // Find nearby rectangles to merge
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue

      const other = sorted[j]

      // Calculate distance between rectangles
      const centerX1 = current.x + current.width / 2
      const centerY1 = current.y + current.height / 2
      const centerX2 = other.x + other.width / 2
      const centerY2 = other.y + other.height / 2

      const distance = Math.sqrt(
        Math.pow(centerX2 - centerX1, 2) +
        Math.pow(centerY2 - centerY1, 2)
      )

      // If very close (within 30 pixels), merge them
      if (distance < 30) {
        toMerge.push(j)

        // Expand bounding box to include both rectangles
        const minX = Math.min(current.x, other.x)
        const minY = Math.min(current.y, other.y)
        const maxX = Math.max(current.x + current.width, other.x + other.width)
        const maxY = Math.max(current.y + current.height, other.y + other.height)

        current = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          pixels: [...current.pixels, ...other.pixels]
        }
      }
    }

    // Mark all merged rectangles as used
    toMerge.forEach(idx => used.add(idx))
    merged.push(current)
  }

  return merged
}

/**
 * Extract TV zone information from detected rectangles
 */
async function extractZonesFromRectangles(
  rectangles: Rectangle[],
  imagePath: string,
  imageWidth: number,
  imageHeight: number,
  skipOCR: boolean = false
): Promise<DetectedZone[]> {
  const zones: DetectedZone[] = []

  // Minimum touch-friendly sizes (percentages)
  const MIN_TOUCH_WIDTH = 5.5  // Larger TVs for better visibility
  const MIN_TOUCH_HEIGHT = 5.5 // Larger TVs for better visibility
  const MIN_SPACING = 2.0 // Increased spacing between zones for clarity

  // First pass: expand zones to minimum size
  const expandedZones: Array<{x: number, y: number, width: number, height: number, rect: Rectangle, index: number}> = []

  for (let i = 0; i < rectangles.length; i++) {
    const rect = rectangles[i]

    // Convert pixel coordinates to percentages
    let x = (rect.x / imageWidth) * 100
    let y = (rect.y / imageHeight) * 100
    let width = (rect.width / imageWidth) * 100
    let height = (rect.height / imageHeight) * 100

    // Expand zones to be touch-friendly
    // If width/height is less than minimum, expand it from the center
    if (width < MIN_TOUCH_WIDTH) {
      const expansion = (MIN_TOUCH_WIDTH - width) / 2
      x = Math.max(0, x - expansion)
      width = MIN_TOUCH_WIDTH
    }

    if (height < MIN_TOUCH_HEIGHT) {
      const expansion = (MIN_TOUCH_HEIGHT - height) / 2
      y = Math.max(0, y - expansion)
      height = MIN_TOUCH_HEIGHT
    }

    expandedZones.push({ x, y, width, height, rect, index: i })
  }

  // Second pass: detect and resolve overlaps
  const resolvedZones = resolveOverlappingZones(expandedZones, imageWidth, imageHeight, MIN_SPACING)

  // Third pass: create final zone objects
  for (let i = 0; i < resolvedZones.length; i++) {
    const zone = resolvedZones[i]
    let { x, y, width, height, rect } = zone

    let ocrResult: { label: string; ocrMethod?: 'ollama' | 'tesseract' | 'manual' }

    if (skipOCR) {
      // Fast mode: skip OCR, use manual labels
      const tvNumber = i + 1
      ocrResult = {
        label: `TV ${String(tvNumber).padStart(2, '0')}`,
        ocrMethod: 'manual'
      }
    } else {
      // Normal mode: extract label from nearby text using OCR (Ollama Vision or Tesseract)
      ocrResult = await extractLabelNearRectangle(rect, imagePath, imageWidth, imageHeight)
    }

    // Extract TV number from label (e.g., "TV 01" → 1)
    const tvNumber = extractTVNumber(ocrResult.label) || (i + 1)
    const finalLabel = ocrResult.label || `TV ${String(tvNumber).padStart(2, '0')}`

    zones.push({
      id: `tv${tvNumber}`,
      outputNumber: tvNumber,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      width: Math.round(width * 100) / 100,
      height: Math.round(height * 100) / 100,
      label: finalLabel,
      confidence: 0.85,
      ocrMethod: ocrResult.ocrMethod || (ocrResult.label ? undefined : 'manual')
    })
  }

  logger.info(`[Zone Extractor] Expanded zones for touch-friendly interaction`)

  return zones
}

/**
 * Extract label using Ollama Vision Model (GPU-accelerated with Intel graphics)
 * Uses local AI model to read text from images - more accurate than traditional OCR
 */
async function extractLabelWithOllama(regionBuffer: Buffer): Promise<string | null> {
  try {
    // Convert buffer to base64 for Ollama API
    const base64Image = regionBuffer.toString('base64')

    logger.debug('[OLLAMA-OCR] Calling Ollama vision model...')

    // Call Ollama API with vision model
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2-vision',
        prompt: 'Read any text visible in this image. Look for TV labels like "TV 01", "TV 02", etc. Return ONLY the exact text you see, nothing else. If you see a TV number, return it in the format "TV 01".',
        images: [base64Image],
        stream: false
      })
    })

    if (!response.ok) {
      logger.warn(`[OLLAMA-OCR] Ollama API returned ${response.status}`)
      return null
    }

    const data = await response.json() as { response?: string }
    const detectedText = data.response?.trim() || ''

    if (detectedText) {
      logger.info(`[OLLAMA-OCR] Vision model detected: "${detectedText}"`)
      return detectedText
    }

    return null
  } catch (error) {
    logger.debug(`[OLLAMA-OCR] Ollama vision failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return null
  }
}

/**
 * Extract label text near a rectangle using OCR
 * Primary: Ollama Vision (GPU-accelerated)
 * Fallback: Tesseract (CPU-based)
 * Searches above and inside the detected red rectangle for labels like "TV 01", "TV 02", etc.
 */
async function extractLabelNearRectangle(
  rect: Rectangle,
  imagePath: string,
  imageWidth: number,
  imageHeight: number
): Promise<{ label: string; ocrMethod?: 'ollama' | 'tesseract' | 'manual' }> {
  try {
    // Define search region: expand rectangle to capture label text
    // Search above (primary) and inside the rectangle
    const EXPANSION_ABOVE = 80 // pixels above rectangle
    const EXPANSION_SIDES = 20 // pixels on each side
    const EXPANSION_INSIDE = 30 // pixels inside rectangle from top

    // Calculate expanded region (primarily above the rectangle)
    const searchX = Math.max(0, rect.x - EXPANSION_SIDES)
    const searchY = Math.max(0, rect.y - EXPANSION_ABOVE)
    const searchWidth = Math.min(
      imageWidth - searchX,
      rect.width + (EXPANSION_SIDES * 2)
    )
    const searchHeight = Math.min(
      imageHeight - searchY,
      EXPANSION_ABOVE + EXPANSION_INSIDE
    )

    // Skip if region is too small
    if (searchWidth < 20 || searchHeight < 20) {
      logger.debug('[OCR] Search region too small, skipping OCR')
      return { label: '', ocrMethod: 'manual' }
    }

    logger.debug(`[OCR] Extracting region at (${searchX}, ${searchY}) size ${searchWidth}x${searchHeight}`)

    // Extract the region from the image
    const regionBuffer = await sharp(imagePath)
      .extract({
        left: Math.round(searchX),
        top: Math.round(searchY),
        width: Math.round(searchWidth),
        height: Math.round(searchHeight)
      })
      .png() // Convert to PNG for better OCR results
      .toBuffer()

    // Try Ollama Vision Model first (GPU-accelerated with Intel graphics)
    const ollamaText = await extractLabelWithOllama(regionBuffer)
    if (ollamaText) {
      const cleanedText = cleanOCRText(ollamaText)
      if (cleanedText) {
        logger.info(`[OCR] Successfully extracted label via Ollama Vision: "${cleanedText}"`)
        return { label: cleanedText, ocrMethod: 'ollama' }
      }
    }

    // Fallback to Tesseract OCR (CPU-based)
    logger.debug('[OCR] Falling back to Tesseract OCR...')

    const result = await Tesseract.recognize(
      regionBuffer,
      'eng',
      {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            logger.debug(`[OCR] Progress: ${Math.round(m.progress * 100)}%`)
          }
        }
      }
    )

    const detectedText = result.data.text.trim()
    const confidence = result.data.confidence

    logger.info(`[OCR] Raw text detected: "${detectedText}" (confidence: ${confidence.toFixed(1)}%)`)

    // Check if confidence is too low
    if (confidence < 60) {
      logger.warn(`[OCR] Confidence too low (${confidence.toFixed(1)}%), ignoring result`)
      return { label: '', ocrMethod: 'manual' }
    }

    // Clean and normalize the text
    const cleanedText = cleanOCRText(detectedText)

    if (cleanedText) {
      logger.info(`[OCR] Successfully extracted label via Tesseract: "${cleanedText}"`)
      return { label: cleanedText, ocrMethod: 'tesseract' }
    }

    return { label: '', ocrMethod: 'manual' }

  } catch (error) {
    logger.error('[OCR] Error extracting label:', error)
    return { label: '', ocrMethod: 'manual' } // Fallback to manual on error
  }
}

/**
 * Clean and normalize OCR text to extract TV labels
 * Handles formats: "TV 01", "TV01", "TV 1", etc.
 */
function cleanOCRText(rawText: string): string {
  if (!rawText) return ''

  // Remove extra whitespace and newlines
  let cleaned = rawText.replace(/\s+/g, ' ').trim()

  // Look for TV label patterns
  // Match: "TV 01", "TV01", "TV 1", "tv 01", etc.
  const tvPattern = /TV\s*(\d+)/i
  const match = cleaned.match(tvPattern)

  if (match) {
    const tvNumber = match[1].padStart(2, '0') // Normalize to 2 digits
    return `TV ${tvNumber}`
  }

  // If we found just a number near the top, assume it's a TV number
  const numberPattern = /^\s*(\d{1,2})\s*$/
  const numMatch = cleaned.match(numberPattern)
  if (numMatch) {
    const tvNumber = numMatch[1].padStart(2, '0')
    return `TV ${tvNumber}`
  }

  // Return cleaned text if it looks like a label (short text)
  if (cleaned.length > 0 && cleaned.length < 20) {
    return cleaned
  }

  return ''
}

/**
 * Extract TV number from label text
 * Examples: "TV 01" → 1, "TV 23" → 23, "TV23" → 23
 */
function extractTVNumber(label: string): number | null {
  if (!label) return null

  const match = label.match(/TV\s*(\d+)/i)
  if (match) {
    return parseInt(match[1], 10)
  }

  const numMatch = label.match(/(\d+)/)
  if (numMatch) {
    return parseInt(numMatch[1], 10)
  }

  return null
}

/**
 * Auto-match detected zones to WolfPack outputs
 * Matches based on label similarity and output number
 */
export function autoMatchZonesToOutputs(
  zones: DetectedZone[],
  outputs: Array<{ channelNumber: number; label: string }>
): DetectedZone[] {
  return zones.map(zone => {
    // Try to find matching output by number first
    let matchedOutput = outputs.find(o => o.channelNumber === zone.outputNumber)

    // If not found, try to match by label similarity
    if (!matchedOutput && zone.label) {
      matchedOutput = outputs.find(o =>
        o.label.toLowerCase().includes(zone.label.toLowerCase()) ||
        zone.label.toLowerCase().includes(o.label.toLowerCase())
      )
    }

    // Update zone with matched output info
    if (matchedOutput) {
      return {
        ...zone,
        label: matchedOutput.label,
        outputNumber: matchedOutput.channelNumber,
        confidence: zone.confidence + 0.1 // Boost confidence for successful match
      }
    }

    return zone
  })
}
