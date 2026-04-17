import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { enhanceLayout } from '@/lib/layout-enhancer'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

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
    // Read current layout from DB
    const row = await db.select().from(schema.bartenderLayouts)
      .where(eq(schema.bartenderLayouts.isDefault, true))
      .get()
      || await db.select().from(schema.bartenderLayouts)
        .where(eq(schema.bartenderLayouts.isActive, true))
        .get()

    if (!row) {
      return NextResponse.json(
        { success: false, error: 'No layout found. Upload a layout and detect zones first.' },
        { status: 400 }
      )
    }

    const zones = JSON.parse(row.zones || '[]')
    if (zones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No zones defined. Upload a layout and detect zones first.' },
        { status: 400 }
      )
    }

    // Resolve the original image path on disk
    const imageUrl = row.imageUrl || row.originalFileUrl || ''
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
      zones,
      row.name || 'Bar Layout',
      provider
    )

    // Save professionalImageUrl to DB
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    await db.update(schema.bartenderLayouts)
      .set({
        professionalImageUrl: result.imageUrl,
        updatedAt: now,
      })
      .where(eq(schema.bartenderLayouts.id, row.id))

    logger.info(`[LAYOUT-ENHANCE] Saved professional image URL to DB: ${result.imageUrl}`)

    return NextResponse.json({
      success: true,
      professionalImageUrl: result.imageUrl,
      analysis: result.analysis,
      provider,
    })
  } catch (error: any) {
    logger.error('[LAYOUT-ENHANCE] Enhancement failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Enhancement failed' },
      { status: 500 }
    )
  }
}
