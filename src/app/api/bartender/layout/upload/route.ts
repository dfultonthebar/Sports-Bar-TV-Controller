/**
 * Layout Upload and Auto-Detection API
 *
 * Handles uploaded layout images and automatically detects TV zones
 */

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { detectTVZonesFromImage, autoMatchZonesToOutputs } from '@/lib/layout-detector'
import { db } from '@/db'
import { matrixOutputs } from '@/db/schema'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('layout') as File
    const layoutName = formData.get('name') as string || 'Bar Layout'
    const autoDetect = formData.get('autoDetect') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const filename = `layout_${timestamp}.png`
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'layouts')
    const filepath = join(uploadDir, filename)

    // Ensure upload directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Save uploaded file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    console.log(`[Layout Upload] Saved: ${filepath}`)

    const imageUrl = `/uploads/layouts/${filename}`
    let zones: any[] = []
    let detectionResult: any = null

    // Auto-detect TV zones if requested
    if (autoDetect) {
      console.log('[Layout Upload] Starting auto-detection...')
      console.log('[Layout Upload] Image path:', filepath)

      detectionResult = await detectTVZonesFromImage(filepath)

      console.log('[Layout Upload] Detection result:', {
        zonesFound: detectionResult.zones.length,
        detectionsCount: detectionResult.detectionsCount,
        errors: detectionResult.errors
      })

      if (detectionResult.zones.length > 0) {
        // Get WolfPack outputs for auto-matching
        const outputs = await db.select().from(matrixOutputs)

        console.log(`[Layout Upload] Found ${outputs.length} matrix outputs for matching`)

        if (outputs.length > 0) {
          // Auto-match detected zones to outputs
          zones = autoMatchZonesToOutputs(
            detectionResult.zones,
            outputs.map(o => ({
              channelNumber: o.channelNumber,
              label: o.label
            }))
          )
          console.log(`[Layout Upload] Auto-matched ${zones.length} TV zones`)
        } else {
          // No outputs to match against, just use detected zones
          zones = detectionResult.zones
          console.log(`[Layout Upload] No outputs to match, using ${zones.length} detected zones as-is`)
        }
      } else {
        console.warn('[Layout Upload] No zones detected')
        console.warn('[Layout Upload] Detection errors:', detectionResult.errors)
      }
    }

    // Return result
    return NextResponse.json({
      success: true,
      layout: {
        name: layoutName,
        imageUrl,
        originalFileUrl: imageUrl,
        zones,
        imageWidth: detectionResult?.imageWidth || 0,
        imageHeight: detectionResult?.imageHeight || 0
      },
      detection: detectionResult ? {
        detectionsCount: detectionResult.detectionsCount,
        zonesExtracted: detectionResult.zones.length,
        errors: detectionResult.errors
      } : null
    })
  } catch (error) {
    console.error('[Layout Upload] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process layout',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
