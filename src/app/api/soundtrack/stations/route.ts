
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

// GET - Fetch available stations/playlists
export async function GET() {
  try {
    // Get API key from config
    const config = await findFirst('soundtrackConfigs')

    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'Soundtrack not configured'
      }, { status: 404 })
    }

    // NOTE: The Soundtrack API does not currently provide a way to list all available stations/playlists
    // via the PublicAPIClient schema. Stations can only be controlled via the soundZone.currentPlayback.station field.
    // Return empty array for now to prevent UI from hanging.
    logger.debug('[Soundtrack] Stations listing not supported by API - returning empty array')

    return NextResponse.json({
      success: true,
      stations: [],
      message: 'Station listing not available. Control playback via sound zones.'
    })
  } catch (error: any) {
    logger.error('Error fetching Soundtrack stations:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

