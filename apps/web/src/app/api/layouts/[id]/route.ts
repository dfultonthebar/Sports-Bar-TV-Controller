import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { bartenderLayouts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { z } from 'zod'

// Validation schema for updating a layout
const updateLayoutSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  originalFileUrl: z.string().nullable().optional(),
  zones: z.array(z.object({
    id: z.string(),
    outputNumber: z.number(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    label: z.string().optional(),
    confidence: z.number().optional(),
  })).optional(),
  isDefault: z.boolean().optional(),
  displayOrder: z.number().optional(),
})

// GET /api/layouts/[id] - Get a single layout
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const layouts = await db
      .select()
      .from(bartenderLayouts)
      .where(eq(bartenderLayouts.id, id))
      .limit(1)

    if (layouts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Layout not found' },
        { status: 404 }
      )
    }

    const layout = layouts[0]

    return NextResponse.json({
      success: true,
      layout: {
        ...layout,
        zones: JSON.parse(layout.zones || '[]'),
      },
    })
  } catch (error) {
    logger.error('[Layouts API] Failed to get layout:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get layout' },
      { status: 500 }
    )
  }
}

// PUT /api/layouts/[id] - Update a layout
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validation = updateLayoutSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      )
    }

    // Check if layout exists
    const existing = await db
      .select()
      .from(bartenderLayouts)
      .where(eq(bartenderLayouts.id, id))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Layout not found' },
        { status: 404 }
      )
    }

    const updates = validation.data

    // If this is being set as default, unset any existing default
    if (updates.isDefault === true) {
      await db
        .update(bartenderLayouts)
        .set({ isDefault: false, updatedAt: new Date().toISOString() })
        .where(eq(bartenderLayouts.isDefault, true))
    }

    // Prepare update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.imageUrl !== undefined) updateData.imageUrl = updates.imageUrl
    if (updates.originalFileUrl !== undefined) updateData.originalFileUrl = updates.originalFileUrl
    if (updates.zones !== undefined) updateData.zones = JSON.stringify(updates.zones)
    if (updates.isDefault !== undefined) updateData.isDefault = updates.isDefault
    if (updates.displayOrder !== undefined) updateData.displayOrder = updates.displayOrder

    await db
      .update(bartenderLayouts)
      .set(updateData)
      .where(eq(bartenderLayouts.id, id))

    // Fetch updated layout
    const updatedLayouts = await db
      .select()
      .from(bartenderLayouts)
      .where(eq(bartenderLayouts.id, id))
      .limit(1)

    const updatedLayout = updatedLayouts[0]

    logger.info('[Layouts API] Updated layout:', { id, updates: Object.keys(updates) })

    return NextResponse.json({
      success: true,
      layout: {
        ...updatedLayout,
        zones: JSON.parse(updatedLayout.zones || '[]'),
      },
    })
  } catch (error) {
    logger.error('[Layouts API] Failed to update layout:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update layout' },
      { status: 500 }
    )
  }
}

// DELETE /api/layouts/[id] - Delete a layout (soft delete by setting isActive to false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if layout exists
    const existing = await db
      .select()
      .from(bartenderLayouts)
      .where(eq(bartenderLayouts.id, id))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Layout not found' },
        { status: 404 }
      )
    }

    // Soft delete by setting isActive to false
    await db
      .update(bartenderLayouts)
      .set({
        isActive: false,
        isDefault: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(bartenderLayouts.id, id))

    logger.info('[Layouts API] Deleted layout:', { id })

    return NextResponse.json({
      success: true,
      message: 'Layout deleted',
    })
  } catch (error) {
    logger.error('[Layouts API] Failed to delete layout:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete layout' },
      { status: 500 }
    )
  }
}
