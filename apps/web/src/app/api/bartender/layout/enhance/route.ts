import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { enhanceLayout } from '@/lib/layout-enhancer'

const enhanceSchema = z.object({
  provider: z.enum(['ollama', 'claude', 'none']).default('ollama'),
})

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, enhanceSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { provider } = bodyValidation.data

  try {
    // Read current layout from data file
    const layoutPath = join(process.cwd(), 'data', 'tv-layout.json')
    const layoutData = JSON.parse(await fs.readFile(layoutPath, 'utf-8'))

    if (!layoutData.zones || layoutData.zones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No zones defined. Upload a layout and detect zones first.' },
        { status: 400 }
      )
    }

    // Resolve the original image path on disk
    const imageUrl = layoutData.imageUrl || ''
    let imagePath = ''

    if (imageUrl.startsWith('/api/uploads/')) {
      imagePath = join(process.cwd(), 'public', imageUrl.replace('/api/uploads/', 'uploads/'))
    } else if (imageUrl.startsWith('/uploads/')) {
      imagePath = join(process.cwd(), 'public', imageUrl)
    } else {
      return NextResponse.json(
        { success: false, error: 'No layout image found. Upload an image first.' },
        { status: 400 }
      )
    }

    // Verify image exists
    try {
      await fs.access(imagePath)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Layout image file not found on disk.' },
        { status: 404 }
      )
    }

    // Run enhancement
    const result = await enhanceLayout(
      imagePath,
      layoutData.zones,
      layoutData.name || 'Bar Layout',
      provider
    )

    // Try to save professionalImageUrl to the layout data file
    try {
      layoutData.professionalImageUrl = result.imageUrl
      await fs.writeFile(layoutPath, JSON.stringify(layoutData, null, 2))
      logger.info(`[LAYOUT-ENHANCE] Saved professional image URL to layout data: ${result.imageUrl}`)
    } catch (writeError) {
      // File may be read-only (root owned) - the UI will save it via the layout save flow
      logger.warn(`[LAYOUT-ENHANCE] Could not write to layout file (will be saved via UI): ${writeError}`)
    }

    return NextResponse.json({
      success: true,
      professionalImageUrl: result.imageUrl,
      analysis: result.analysis,
      provider
    })
  } catch (error: any) {
    logger.error('[LAYOUT-ENHANCE] Enhancement failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Enhancement failed' },
      { status: 500 }
    )
  }
}
