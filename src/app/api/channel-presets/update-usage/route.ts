
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

    // Update the preset's usage count and last used timestamp
    const updatedPreset = await prisma.channelPreset.update({
      where: { id: presetId },
      data: {
        usageCount: { increment: 1 },
        lastUsed: new Date()
      }
    })

    console.log(`[Usage Tracking] Preset "${updatedPreset.name}" usage updated: ${updatedPreset.usageCount} uses`)

    return NextResponse.json({
      success: true,
      preset: updatedPreset,
      message: 'Usage tracking updated successfully'
    })
  } catch (error) {
    console.error('[Usage Tracking] Error updating preset usage:', error)
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
