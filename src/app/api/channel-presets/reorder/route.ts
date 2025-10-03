
import { NextRequest, NextResponse } from 'next/server'
import { reorderAllPresets } from '@/services/presetReorderService'

/**
 * POST /api/channel-presets/reorder
 * Manually trigger preset reordering based on usage
 */
export async function POST(request: NextRequest) {
  try {
    await reorderAllPresets()

    return NextResponse.json({
      success: true,
      message: 'Presets reordered successfully based on usage patterns'
    })
  } catch (error) {
    console.error('Error reordering presets:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reorder presets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
