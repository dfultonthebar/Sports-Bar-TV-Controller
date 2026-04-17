import { promises as fs } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { logger } from '@sports-bar/logger'

interface Zone {
  id: string
  outputNumber: number
  x: number
  y: number
  width: number
  height: number
  label: string
}

/**
 * Generate a subtle grid pattern SVG (blueprint feel)
 */
function generateGridSVG(width: number, height: number): string {
  const cellSize = Math.round(Math.min(width, height) * 0.025)
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="grid" width="${cellSize}" height="${cellSize}" patternUnits="userSpaceOnUse">
        <path d="M ${cellSize} 0 L 0 0 0 ${cellSize}" fill="none" stroke="#1e293b" stroke-width="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)"/>
  </svg>`
}

/**
 * Enhance layout: extract walls from original floor plan, remove red markers
 * and original number labels, produce a clean dark-themed background image.
 *
 * IMPORTANT: This generates a BACKGROUND-ONLY image (no TV markers baked in).
 * The bartender remote and layout editor overlay their own interactive markers
 * using the zone coordinates from tv-layout.json. Baking markers into the
 * image would cause mismatches whenever zones are repositioned.
 *
 * Layer order (bottom to top):
 *  1. Dark slate background
 *  2. Subtle grid pattern
 *  3. Extracted + colorized wall outlines
 */
export async function enhanceLayout(
  imagePath: string,
  zones: Zone[],
  layoutName: string,
  _provider: 'ollama' | 'claude' | 'none' = 'none'
): Promise<{ imageUrl: string; analysis: { rooms: any[]; layoutDescription: string } }> {
  logger.info(`[LAYOUT-ENHANCE] Starting clean redraw for "${layoutName}" with ${zones.length} zones`)

  const metadata = await sharp(imagePath).metadata()
  const origWidth = metadata.width || 1920
  const origHeight = metadata.height || 1440

  const MAX_WIDTH = 1920
  const scale = origWidth > MAX_WIDTH ? MAX_WIDTH / origWidth : 1
  const outWidth = Math.round(origWidth * scale)
  const outHeight = Math.round(origHeight * scale)

  logger.info(`[LAYOUT-ENHANCE] Processing ${origWidth}x${origHeight} -> ${outWidth}x${outHeight}`)

  // ── Step 1: Extract wall structure, remove red markers ──
  // Red channel: red markers (R≈255) become white = same as background = invisible.
  // Black walls (R≈0) remain dark.
  const redChannel = await sharp(imagePath)
    .resize(outWidth, outHeight, { fit: 'fill' })
    .extractChannel(0)
    .toBuffer()

  // ── Step 2: Median filter to strip text/numbers ──
  // Median removes features thinner than ~half kernel size.
  // At 1920px wide, number strokes are ~4-6px, walls are ~10-15px thick.
  const cleaned = await sharp(redChannel)
    .median(13)
    .toBuffer()

  // ── Step 3: Morphological cleanup (erode then dilate) ──
  // Erode: blur + high threshold removes thin remnants
  const eroded = await sharp(cleaned)
    .blur(3)
    .threshold(220)
    .toBuffer()

  // Dilate: blur + low threshold restores wall thickness
  const wallMask = await sharp(eroded)
    .blur(3)
    .threshold(20)
    .negate() // Invert: walls = 255, bg = 0
    .toBuffer()

  logger.info(`[LAYOUT-ENHANCE] Wall mask extracted`)

  // ── Step 4: Colorize walls via alpha compositing ──
  // Create solid wall-color image, use wallMask as alpha channel.
  const wallColorRaw = await sharp({
    create: {
      width: outWidth,
      height: outHeight,
      channels: 3,
      background: { r: 95, g: 115, b: 145 } // Muted slate-blue wall color
    }
  }).raw().toBuffer()

  const wallOverlay = await sharp(wallColorRaw, {
    raw: { width: outWidth, height: outHeight, channels: 3 }
  })
    .joinChannel(wallMask) // wallMask becomes alpha: walls visible, bg transparent
    .png()
    .toBuffer()

  // ── Step 5: Create dark background ──
  const darkBackground = await sharp({
    create: {
      width: outWidth,
      height: outHeight,
      channels: 3,
      background: { r: 15, g: 23, b: 42 } // slate-900
    }
  }).png().toBuffer()

  // ── Step 6: Grid pattern ──
  const gridPng = await sharp(Buffer.from(generateGridSVG(outWidth, outHeight)))
    .resize(outWidth, outHeight)
    .png()
    .toBuffer()

  // ── Step 7: Composite layers (background only — no markers) ──
  const outputFilename = `layout_professional_${Date.now()}.png`
  const outputDir = join(process.cwd(), 'public', 'uploads', 'layouts')
  await fs.mkdir(outputDir, { recursive: true })
  const outputPath = join(outputDir, outputFilename)

  await sharp(darkBackground)
    .composite([
      { input: gridPng, top: 0, left: 0, blend: 'over' },
      { input: wallOverlay, top: 0, left: 0, blend: 'over' },
    ])
    .png({ quality: 90 })
    .toFile(outputPath)

  const imageUrl = `/api/uploads/layouts/${outputFilename}`
  logger.info(`[LAYOUT-ENHANCE] Professional floor plan generated: ${imageUrl} (${outWidth}x${outHeight})`)

  return {
    imageUrl,
    analysis: {
      rooms: [],
      layoutDescription: `Clean dark-themed floor plan. ${zones.length} TV zones configured.`
    }
  }
}
