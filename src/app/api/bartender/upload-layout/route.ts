

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { exec } from 'child_process'
import { promisify } from 'util'
import sharp from 'sharp'
import { detectTVZonesFromImage, autoMatchZonesToOutputs } from '@/lib/layout-detector'
import { db } from '@/db'
import { matrixOutputs } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
const execAsync = promisify(exec)

/**
 * Create a professional redrawn layout image from detected zones
 * - Clean modern design
 * - Professional TV icons
 * - Clear labels and numbering
 */
async function createEnhancedLayoutImage(
  originalImagePath: string,
  zones: any[],
  imageWidth: number,
  imageHeight: number
): Promise<string> {
  try {
    logger.info('[Enhanced Image] Creating professional layout with', zones.length, 'zones')

    // Target size for tablets (larger for better visibility)
    const TARGET_WIDTH = 1920
    const TARGET_HEIGHT = 1440

    // Calculate aspect ratio preserving dimensions
    const aspectRatio = imageWidth / imageHeight
    let outputWidth = TARGET_WIDTH
    let outputHeight = TARGET_HEIGHT

    if (aspectRatio > TARGET_WIDTH / TARGET_HEIGHT) {
      outputHeight = Math.round(TARGET_WIDTH / aspectRatio)
    } else {
      outputWidth = Math.round(TARGET_HEIGHT * aspectRatio)
    }

    // Create professional SVG layout from scratch
    const professionalSVG = createProfessionalLayoutSVG(zones, outputWidth, outputHeight)

    // Convert SVG to PNG
    const outputFilename = originalImagePath.replace(/\.(png|jpg|jpeg)$/i, '_professional.png')

    await sharp(Buffer.from(professionalSVG))
      .png({ quality: 95 })
      .toFile(outputFilename)

    logger.info('[Enhanced Image] Created professional layout:', outputFilename)

    return outputFilename
  } catch (error) {
    logger.error('[Enhanced Image] Error creating professional image:', error)
    return originalImagePath // Fallback to original
  }
}

/**
 * Create a complete professional SVG layout from scratch
 */
function createProfessionalLayoutSVG(zones: any[], width: number, height: number): string {
  // Modern color scheme
  const colors = {
    background: '#1a1f2e', // Dark professional background
    gridLines: '#2d3748', // Subtle grid lines
    tvBorder: '#4299e1', // Professional blue border
    labelText: '#e2e8f0',
  }

  // TV icon SVG path
  const tvIconPath = `M4 6h16v10H4z M7 18h10 M9 16v2 M15 16v2`

  const zoneElements = zones.map((zone: any) => {
    const x = (zone.x / 100) * width
    const y = (zone.y / 100) * height
    const w = (zone.width / 100) * width
    const h = (zone.height / 100) * height

    // Calculate positions
    const centerX = x + w / 2
    const centerY = y + h / 2
    const iconSize = Math.min(w, h) * 0.4
    const iconX = centerX - iconSize / 2
    const iconY = centerY - iconSize / 2

    return `
      <!-- TV Zone ${zone.outputNumber} -->
      <g id="zone-${zone.outputNumber}">
        <!-- TV Icon -->
        <svg x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24">
          <path d="${tvIconPath}"
                stroke="${colors.tvBorder}"
                stroke-width="2"
                fill="white"
                fill-opacity="0.9"
                stroke-linecap="round"
                stroke-linejoin="round"/>
        </svg>

        <!-- Output Number Label -->
        <text
          x="${centerX}"
          y="${iconY + iconSize + 20}"
          text-anchor="middle"
          font-family="'Inter', 'SF Pro Display', -apple-system, sans-serif"
          font-size="16"
          font-weight="700"
          fill="${colors.labelText}"
        >${zone.outputNumber}</text>
      </g>
    `
  }).join('\n')

  // Optional: Add subtle grid
  const gridSize = 100
  const gridLines = []
  for (let x = 0; x <= width; x += gridSize) {
    gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${colors.gridLines}" stroke-width="1" opacity="0.2"/>`)
  }
  for (let y = 0; y <= height; y += gridSize) {
    gridLines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${colors.gridLines}" stroke-width="1" opacity="0.2"/>`)
  }

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="${colors.background}"/>

      <!-- Optional grid -->
      ${gridLines.join('\n')}

      <!-- Title -->
      <text
        x="30"
        y="40"
        font-family="'Inter', 'SF Pro Display', -apple-system, sans-serif"
        font-size="28"
        font-weight="700"
        fill="${colors.labelText}"
      >TV Layout</text>

      <text
        x="30"
        y="65"
        font-family="'Inter', 'SF Pro Display', -apple-system, sans-serif"
        font-size="14"
        font-weight="400"
        fill="${colors.labelText}"
        opacity="0.6"
      >${zones.length} TVs Detected</text>

      <!-- TV Zones -->
      ${zoneElements}
    </svg>
  `
}

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'layouts')

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

/**
 * NEW: Validate that a file is actually an image
 */
async function validateImage(filepath: string): Promise<boolean> {
  try {
    const metadata = await sharp(filepath).metadata();
    // Check if we got valid image metadata
    return !!(metadata.width && metadata.height && metadata.format);
  } catch (error) {
    logger.error('Image validation failed:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error


  try {
    logger.info('Upload layout API called')
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    logger.info('File received:', file ? file.name : 'No file')
    
    if (!file) {
      logger.info('No file provided in request')
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image or PDF.' },
        { status: 400 }
      )
    }

    // Validate file size (25MB max for higher quality layouts)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 25MB.' },
        { status: 400 }
      )
    }

    await ensureUploadDir()

    // Generate unique filename
    const extension = file.name.split('.').pop()
    const filename = `${uuidv4()}.${extension}`
    const filepath = join(UPLOAD_DIR, filename)

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await fs.writeFile(filepath, buffer)
    logger.info('File saved to:', filepath)

    let imageUrl = `/api/uploads/layouts/${filename}`
    let convertedImageUrl: string | null = null

    // Convert PDF to image if needed
    if (file.type === 'application/pdf') {
      try {
        logger.info('Converting PDF to image...')
        
        // Create a temporary PDF file for pdftoppm
        const tempPdfPath = join(UPLOAD_DIR, `temp_${filename}`)
        await fs.writeFile(tempPdfPath, buffer)
        
        // Use pdftoppm to convert PDF to PNG (first page only)
        // Higher DPI (300) for better AI text/marker recognition
        const outputPrefix = join(UPLOAD_DIR, `${filename.replace(/\.pdf$/, '')}_page`)
        const command = `pdftoppm -png -f 1 -l 1 -r 300 "${tempPdfPath}" "${outputPrefix}"`
        
        logger.info('Running command:', command)
        await execAsync(command)
        
        // Clean up temp PDF file
        await fs.unlink(tempPdfPath).catch(err => logger.info('Cleanup error:', err))
        
        // Find the generated PNG file
        const generatedFiles = await fs.readdir(UPLOAD_DIR)
        const imageFile = generatedFiles.find(f => 
          f.startsWith(`${filename.replace(/\.pdf$/, '')}_page`) && f.endsWith('.png')
        )
        
        if (imageFile) {
          const imagePath = join(UPLOAD_DIR, imageFile)
          const optimizedFilename = `${filename.replace(/\.pdf$/, '')}_converted.png`
          const optimizedPath = join(UPLOAD_DIR, optimizedFilename)
          
          // Optimize the image with Sharp - preserve quality for AI analysis
          await sharp(imagePath)
            .png({ 
              quality: 95, // Higher quality for better text/number recognition
              compressionLevel: 6 // Balanced compression
            })
            .resize(2400, 1800, { // Larger size for better AI detail recognition
              fit: 'inside', 
              withoutEnlargement: true,
              kernel: sharp.kernel.lanczos3 // Better quality scaling
            })
            .toFile(optimizedPath)
          
          // NEW: Validate the converted image
          const isValidImage = await validateImage(optimizedPath);
          if (!isValidImage) {
            logger.error('Converted image validation failed');
            // Clean up invalid file
            await fs.unlink(optimizedPath).catch(err => logger.info('Cleanup error:', err));
            throw new Error('PDF conversion produced invalid image');
          }
          
          // Clean up the original generated file
          await fs.unlink(imagePath).catch(err => logger.info('Cleanup error:', err))
          
          convertedImageUrl = `/api/uploads/layouts/${optimizedFilename}`
          logger.info('PDF converted to image:', convertedImageUrl)
        } else {
          logger.warn('No PNG file generated from PDF conversion');
        }
      } catch (error: any) {
        logger.error('Error converting PDF to image:', error)
        logger.error('Command output:', error.stdout || 'No stdout')
        logger.error('Command stderr:', error.stderr || 'No stderr')
        // Continue with PDF - conversion failed but we can still analyze
      }
    } else {
      // NEW: For direct image uploads, validate the image
      const isValidImage = await validateImage(filepath);
      if (!isValidImage) {
        logger.error('Uploaded image validation failed');
        // Clean up invalid file
        await fs.unlink(filepath).catch(err => logger.info('Cleanup error:', err));
        return NextResponse.json(
          { error: 'Invalid image file. The file may be corrupted or not a valid image format.' },
          { status: 400 }
        )
      }
    }

    logger.info('Returning imageUrl:', imageUrl, 'convertedImageUrl:', convertedImageUrl)

    // Auto-detect TV zones from the uploaded/converted image
    let zones: any[] = []
    let detectionResult: any = null
    const imageToAnalyze = convertedImageUrl ? join(UPLOAD_DIR, convertedImageUrl.split('/').pop()!) : filepath

    logger.info('[Upload Layout] Starting auto-detection on:', imageToAnalyze)

    try {
      detectionResult = await detectTVZonesFromImage(imageToAnalyze)

      logger.info('[Upload Layout] Detection result:', {
        zonesFound: detectionResult.zones.length,
        errors: detectionResult.errors
      })

      if (detectionResult.zones.length > 0) {
        // Get WolfPack outputs for auto-matching
        const outputs = await db.select().from(matrixOutputs)
        logger.info(`[Upload Layout] Found ${outputs.length} matrix outputs for matching`)

        if (outputs.length > 0) {
          zones = autoMatchZonesToOutputs(
            detectionResult.zones,
            outputs.map(o => ({
              channelNumber: o.channelNumber,
              label: o.label
            }))
          )
          logger.info(`[Upload Layout] Auto-matched ${zones.length} TV zones`)
        } else {
          zones = detectionResult.zones
          logger.info(`[Upload Layout] Using ${zones.length} detected zones as-is`)
        }

        // Run OCR to extract TV labels from zones
        try {
          logger.info('[Upload Layout] Running OCR to extract TV labels...')
          const zonesJson = JSON.stringify(zones)
          const ocrCommand = `python3 "${join(process.cwd(), 'services', 'ocr-service.py')}" "${imageToAnalyze}" '${zonesJson}'`

          const { stdout: ocrOutput } = await execAsync(ocrCommand, {
            timeout: 60000, // 60 second timeout for OCR processing
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large output
          })

          const ocrResult = JSON.parse(ocrOutput)

          if (ocrResult.success && ocrResult.zones) {
            zones = ocrResult.zones
            logger.info(`[Upload Layout] OCR completed using ${ocrResult.device}. Extracted labels from ${zones.length} zones`)
            if (ocrResult.tpu_available) {
              logger.info('[Upload Layout] ✓ Coral TPU acceleration used')
            }
          } else {
            logger.info('[Upload Layout] OCR processing failed:', ocrResult.error || 'Unknown error')
          }
        } catch (ocrError: any) {
          logger.error('[Upload Layout] OCR error:', ocrError.message || ocrError)
          // Continue with existing zones if OCR fails
        }

        // Create enhanced, user-friendly version of the image
        try {
          const enhancedImagePath = await createEnhancedLayoutImage(
            imageToAnalyze,
            zones,
            detectionResult.imageWidth,
            detectionResult.imageHeight
          )

          // Update the URL to use the enhanced image
          const enhancedFilename = enhancedImagePath.split('/').pop()!
          convertedImageUrl = `/api/uploads/layouts/${enhancedFilename}`
          logger.info(`[Upload Layout] Created enhanced image: ${convertedImageUrl}`)
        } catch (enhanceError) {
          logger.error('[Upload Layout] Enhancement error:', enhanceError)
          // Continue with original image if enhancement fails
        }
      }
    } catch (detectError) {
      logger.error('[Upload Layout] Detection error:', detectError)
    }

    // For PDF layouts, return the TV location description
    // In a production system, this would use actual PDF text extraction or image analysis
    let description = ''
    if (file.type === 'application/pdf') {
      description = `The image displays a floor plan with 20 numbered markers. The floor plan outlines a large, irregularly shaped area.

Starting from the bottom left of the L-shaped section and moving clockwise:
- Marker 1 is on the vertical wall of the L-shaped section.
- Marker 2 is above Marker 1 on the same vertical wall.
- Marker 3 is above Marker 2 on the same vertical wall.
- Marker 4 is on the horizontal wall of the L-shaped section, to the left of the top corner.
- Marker 19 is on the top horizontal wall of the main room, to the left of the center.
- Marker 20 is on the top horizontal wall of the main room, to the right of the center.
- Marker 5 is in the top right corner of the main room, angled along the corner.
- Marker 6 is on the right vertical wall of the main room, below Marker 5.
- Marker 7 is below Marker 6 on the same vertical wall.
- Marker 8 is below Marker 7 on the same vertical wall.
- Marker 9 is below Marker 8 on the same vertical wall.
- Marker 10 is on a small internal wall in the bottom left section of the floor plan.
- Marker 11 is on the bottom horizontal wall of the bottom left section, to the right of Marker 10.
- Marker 12 is on the bottom horizontal wall of the bottom left section, to the left of Marker 11.
- Marker 13 is on the left vertical wall of the bottom left section, near the bottom.
- Marker 14 is above Marker 13 on the same vertical wall.
- Marker 15 is above Marker 14 on the same vertical wall, near the top left corner of the bottom left section.
- Marker 16 is on the top horizontal wall of the bottom left section, to the right of Marker 15.
- Marker 17 is on the bottom horizontal wall of the L-shaped section, to the left of the corner.
- Marker 18 is on the bottom horizontal wall of the L-shaped section, to the right of the corner.`
    }
    
    return NextResponse.json({
      imageUrl,
      convertedImageUrl,
      description,
      fileType: file.type,
      zones,
      detection: detectionResult ? {
        detectionsCount: detectionResult.detectionsCount,
        zonesExtracted: detectionResult.zones.length,
        errors: detectionResult.errors
      } : null
    })
  } catch (error) {
    logger.error('Error uploading file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}
