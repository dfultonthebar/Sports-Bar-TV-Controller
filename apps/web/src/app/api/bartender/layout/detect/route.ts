/**
 * Layout Detection API
 *
 * Re-run auto-detection on an existing layout image
 */

import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { detectTVZonesFromImage, autoMatchZonesToOutputs } from '@/lib/layout-detector'
import { db } from '@/db'
import { matrixOutputs } from '@/db/schema'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { imageUrl } = bodyValidation.data

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    // Convert URL to file path
    const filename = imageUrl.split('/').pop()
    const filepath = join(process.cwd(), 'public', 'uploads', 'layouts', filename!)

    logger.info(`[Layout Detection] Processing: ${filepath}`)

    // Check if full OCR requested (default: skip OCR for speed)
    const enableOCR = bodyValidation.data.enableOCR === true

    logger.info(`[Layout Detection] OCR mode: ${enableOCR ? 'ENABLED (slow, 2-4 min)' : 'DISABLED (fast, 8 sec)'}`)

    // Detect zones
    const detectionResult = await detectTVZonesFromImage(filepath, { skipOCR: !enableOCR })

    if (detectionResult.zones.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No TV zones detected in image',
        errors: detectionResult.errors
      })
    }

    // Get WolfPack outputs for auto-matching
    const outputs = await db.select().from(matrixOutputs)

    // Auto-match detected zones to outputs
    const zones = autoMatchZonesToOutputs(
      detectionResult.zones,
      outputs.map(o => ({
        channelNumber: o.channelNumber,
        label: o.label
      }))
    )

    logger.info(`[Layout Detection] Detected ${zones.length} zones`)

    return NextResponse.json({
      success: true,
      zones,
      detection: {
        detectionsCount: detectionResult.detectionsCount,
        zonesExtracted: zones.length,
        imageWidth: detectionResult.imageWidth,
        imageHeight: detectionResult.imageHeight,
        errors: detectionResult.errors
      }
    })
  } catch (error) {
    logger.error('[Layout Detection] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to detect zones',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
