import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { bartenderLayouts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

// POST /api/layouts/[id]/set-default - Set a layout as the default
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if layout exists and is active
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

    if (!existing[0].isActive) {
      return NextResponse.json(
        { success: false, error: 'Cannot set inactive layout as default' },
        { status: 400 }
      )
    }

    // Unset any existing default
    await db
      .update(bartenderLayouts)
      .set({ isDefault: false, updatedAt: new Date().toISOString() })
      .where(eq(bartenderLayouts.isDefault, true))

    // Set this layout as default
    await db
      .update(bartenderLayouts)
      .set({ isDefault: true, updatedAt: new Date().toISOString() })
      .where(eq(bartenderLayouts.id, id))

    logger.info('[Layouts API] Set default layout:', { id })

    return NextResponse.json({
      success: true,
      message: 'Layout set as default',
    })
  } catch (error) {
    logger.error('[Layouts API] Failed to set default layout:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to set default layout' },
      { status: 500 }
    )
  }
}
