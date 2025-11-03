
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findFirst, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { getSoundtrackAPI } from '@/lib/soundtrack-your-brand'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { cacheManager } from '@/lib/cache-manager'


// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

// GET - Fetch available stations/playlists
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Get API key from config
    const config = await findFirst('soundtrackConfigs')

    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'Soundtrack not configured'
      }, { status: 404 })
    }

    // Cache key based on config ID
    const cacheKey = `stations:${config.id}`

    // Try to get from cache first
    const cached = cacheManager.get('soundtrack-data', cacheKey)
    if (cached) {
      logger.debug(`[Soundtrack] Returning ${cached.length} stations from cache`)
      return NextResponse.json({
        success: true,
        stations: cached,
        fromCache: true
      })
    }

    // Get Soundtrack API instance
    const api = getSoundtrackAPI(config.apiKey)

    // List all stations (will get stations from all accounts)
    const stations = await api.listStations()

    logger.debug(`[Soundtrack] Found ${stations.length} stations`)

    // Cache the stations for 2 minutes
    cacheManager.set('soundtrack-data', cacheKey, stations)

    return NextResponse.json({
      success: true,
      stations: stations,
      fromCache: false
    })
  } catch (error: any) {
    logger.error('Error fetching Soundtrack stations:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

