export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server'
import prisma from "@/lib/prisma"


/**
 * GET /api/channel-presets/by-device?deviceType=cable|directv
 * Fetch presets for a specific device type, ordered by usage or alphabetically
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const deviceType = searchParams.get('deviceType')

    if (!deviceType) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameter: deviceType' 
        },
        { status: 400 }
      )
    }

    if (!['cable', 'directv'].includes(deviceType)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid deviceType. Must be "cable" or "directv"' 
        },
        { status: 400 }
      )
    }

    // Fetch presets for the specified device type
    // Order by: order field (which is set by AI reordering), then by name
    const presets = await prisma.channelPreset.findMany({
      where: { 
        deviceType,
        isActive: true 
      },
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    })

    // Check if any preset has been used (indicating AI reordering has occurred)
    const hasUsageData = presets.some(p => p.usageCount > 0)

    return NextResponse.json({
      success: true,
      presets,
      deviceType,
      count: presets.length,
      hasUsageData,
      orderingMethod: hasUsageData ? 'usage-based' : 'alphabetical'
    })
  } catch (error) {
    console.error('[Preset Fetch] Error fetching presets by device:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch presets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
