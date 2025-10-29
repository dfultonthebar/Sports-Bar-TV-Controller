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

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    // Convert URL to file path
    const filename = imageUrl.split('/').pop()
    const filepath = join(process.cwd(), 'public', 'uploads', 'layouts', filename!)

    console.log(`[Layout Detection] Processing: ${filepath}`)

    // Detect zones
    const detectionResult = await detectTVZonesFromImage(filepath)

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

    console.log(`[Layout Detection] Detected ${zones.length} zones`)

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
    console.error('[Layout Detection] Error:', error)
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
