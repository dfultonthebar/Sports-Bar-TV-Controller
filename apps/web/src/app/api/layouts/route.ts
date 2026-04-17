import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { bartenderLayouts } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'

// Validation schema for creating a layout
const createLayoutSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  originalFileUrl: z.string().optional(),
  zones: z.array(z.object({
    id: z.string(),
    outputNumber: z.number(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    label: z.string().optional(),
    confidence: z.number().optional(),
  })).optional().default([]),
  isDefault: z.boolean().optional().default(false),
})

// GET /api/layouts - List all layouts
export async function GET() {
  try {
    const layouts = await db
      .select()
      .from(bartenderLayouts)
      .where(eq(bartenderLayouts.isActive, true))
      .orderBy(asc(bartenderLayouts.displayOrder))

    // Parse zones JSON for each layout
    const parsedLayouts = layouts.map(layout => ({
      ...layout,
      zones: JSON.parse(layout.zones || '[]'),
    }))

    return NextResponse.json({
      success: true,
      layouts: parsedLayouts,
    })
  } catch (error) {
    logger.error('[Layouts API] Failed to list layouts:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list layouts' },
      { status: 500 }
    )
  }
}

// POST /api/layouts - Create a new layout
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = createLayoutSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { name, description, imageUrl, originalFileUrl, zones, isDefault } = validation.data

    // If this is set as default, unset any existing default
    if (isDefault) {
      await db
        .update(bartenderLayouts)
        .set({ isDefault: false, updatedAt: new Date().toISOString() })
        .where(eq(bartenderLayouts.isDefault, true))
    }

    // Get the next display order
    const existingLayouts = await db
      .select({ displayOrder: bartenderLayouts.displayOrder })
      .from(bartenderLayouts)
      .orderBy(asc(bartenderLayouts.displayOrder))

    const nextOrder = existingLayouts.length > 0
      ? Math.max(...existingLayouts.map(l => l.displayOrder)) + 1
      : 0

    // Create the new layout
    const newLayout = {
      id: crypto.randomUUID(),
      name,
      description: description || null,
      imageUrl: imageUrl || null,
      originalFileUrl: originalFileUrl || null,
      zones: JSON.stringify(zones),
      isDefault: isDefault,
      isActive: true,
      displayOrder: nextOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await db.insert(bartenderLayouts).values(newLayout)

    logger.info('[Layouts API] Created new layout:', { id: newLayout.id, name })

    return NextResponse.json({
      success: true,
      layout: {
        ...newLayout,
        zones: zones,
      },
    }, { status: 201 })
  } catch (error) {
    logger.error('[Layouts API] Failed to create layout:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create layout' },
      { status: 500 }
    )
  }
}
