
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

    // Get Soundtrack API instance
    const api = getSoundtrackAPI(config.apiKey)

    // List all stations (will get stations from all accounts)
    const stations = await api.listStations()

    logger.debug(`[Soundtrack] Found ${stations.length} stations`)

    return NextResponse.json({
      success: true,
      stations: stations
    })
  } catch (error: any) {
    logger.error('Error fetching Soundtrack stations:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

