
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or, update } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'


/**
 * POST /api/channel-presets/update-usage
 * Update usage tracking for a preset when it's clicked
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { presetId } = body

    if (!presetId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: presetId' 
        },
        { status: 400 }
      )
    }

    // Get current preset to increment usage count
    const currentPreset = await findFirst('channelPresets', {
      where: eq(schema.channelPresets.id, presetId)
    })

    if (!currentPreset) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Preset not found' 
        },
        { status: 404 }
      )
    }

    // Update the preset's usage count and last used timestamp
    await update('channelPresets', presetId, {
      usageCount: currentPreset.usageCount + 1,
      lastUsed: new Date().toISOString()
    })

    // Get the updated preset
    const updatedPreset = await findFirst('channelPresets', {
      where: eq(schema.channelPresets.id, presetId)
    })

    logger.debug(`[Usage Tracking] Preset "${updatedPreset?.name}" usage updated: ${updatedPreset?.usageCount} uses`)

    return NextResponse.json({
      success: true,
      preset: updatedPreset,
      message: 'Usage tracking updated successfully'
    })
  } catch (error) {
    logger.error('[Usage Tracking] Error updating preset usage:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update usage tracking',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
