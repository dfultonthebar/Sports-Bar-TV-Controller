import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
}

const DEFAULT_LAYOUT = {
  name: 'Bar Layout',
  zones: [] as any[],
  backgroundImage: null,
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    // Get the active/default layout from DB
    const row = await db.select().from(schema.bartenderLayouts)
      .where(eq(schema.bartenderLayouts.isDefault, true))
      .get()

    if (!row) {
      // Try any active layout
      const anyActive = await db.select().from(schema.bartenderLayouts)
        .where(eq(schema.bartenderLayouts.isActive, true))
        .get()

      if (!anyActive) {
        return NextResponse.json({ layout: DEFAULT_LAYOUT }, { headers: NO_CACHE_HEADERS })
      }

      const layout = {
        name: anyActive.name,
        zones: JSON.parse(anyActive.zones || '[]'),
        // InteractiveBartenderLayout reads layout.imageUrl / .professionalImageUrl.
        // Keep backgroundImage for older consumers (the layout-editor page).
        imageUrl: anyActive.imageUrl || null,
        professionalImageUrl: anyActive.professionalImageUrl || null,
        backgroundImage: anyActive.imageUrl || anyActive.professionalImageUrl || null,
        id: anyActive.id,
      }
      return NextResponse.json({ layout }, { headers: NO_CACHE_HEADERS })
    }

    const layout = {
      name: row.name,
      zones: JSON.parse(row.zones || '[]'),
      imageUrl: row.imageUrl || null,
      professionalImageUrl: row.professionalImageUrl || null,
      backgroundImage: row.imageUrl || row.professionalImageUrl || null,
      id: row.id,
    }
    return NextResponse.json({ layout }, { headers: NO_CACHE_HEADERS })
  } catch (error) {
    logger.error('[BARTENDER LAYOUT] GET error:', error)
    return NextResponse.json({ layout: DEFAULT_LAYOUT }, { headers: NO_CACHE_HEADERS })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, z.object({
    layout: z.object({
      name: z.string().optional().default('Bar Layout'),
      zones: z.array(z.any()).optional().default([]),
      backgroundImage: z.string().nullable().optional(),
      id: z.string().optional(),
    }),
  }))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { layout } = bodyValidation.data
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    if (layout.id) {
      // Update existing layout
      await db.update(schema.bartenderLayouts)
        .set({
          name: layout.name,
          zones: JSON.stringify(layout.zones),
          imageUrl: layout.backgroundImage || null,
          updatedAt: now,
        })
        .where(eq(schema.bartenderLayouts.id, layout.id))
    } else {
      // Check if any layout exists - if so update the default, otherwise create
      const existing = await db.select().from(schema.bartenderLayouts)
        .where(eq(schema.bartenderLayouts.isDefault, true))
        .get()

      if (existing) {
        await db.update(schema.bartenderLayouts)
          .set({
            name: layout.name,
            zones: JSON.stringify(layout.zones),
            imageUrl: layout.backgroundImage || null,
            updatedAt: now,
          })
          .where(eq(schema.bartenderLayouts.id, existing.id))
      } else {
        await db.insert(schema.bartenderLayouts).values({
          name: layout.name,
          zones: JSON.stringify(layout.zones),
          imageUrl: layout.backgroundImage || null,
          isDefault: true,
          isActive: true,
          displayOrder: 0,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[BARTENDER LAYOUT] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save layout' },
      { status: 500 }
    )
  }
}
