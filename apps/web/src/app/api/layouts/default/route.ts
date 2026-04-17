import { NextResponse } from 'next/server'
import { db } from '@/db'
import { bartenderLayouts } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

// GET /api/layouts/default - Get the default layout (or first active layout if none is default)
export async function GET() {
  try {
    // First try to get the default layout
    let layouts = await db
      .select()
      .from(bartenderLayouts)
      .where(and(
        eq(bartenderLayouts.isDefault, true),
        eq(bartenderLayouts.isActive, true)
      ))
      .limit(1)

    // If no default, get the first active layout by display order
    if (layouts.length === 0) {
      layouts = await db
        .select()
        .from(bartenderLayouts)
        .where(eq(bartenderLayouts.isActive, true))
        .orderBy(asc(bartenderLayouts.displayOrder))
        .limit(1)
    }

    if (layouts.length === 0) {
      return NextResponse.json({
        success: true,
        layout: null,
        message: 'No layouts configured',
      })
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
    logger.error('[Layouts API] Failed to get default layout:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get default layout' },
      { status: 500 }
    )
  }
}
