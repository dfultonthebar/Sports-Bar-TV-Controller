export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findMany, or } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
import { cacheManager } from '@/lib/cache-manager'


/**
 * GET /api/channel-presets/by-device?deviceType=cable|directv
 * Fetch presets for a specific device type, ordered by usage or alphabetically
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


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

    // Cache key based on device type
    const cacheKey = `presets:${deviceType}`

    // Try to get from cache first (5 minute TTL)
    const cached = cacheManager.get('device-config', cacheKey)
    if (cached && typeof cached === 'object' && 'count' in cached) {
      logger.debug(`[ChannelPresets] Returning ${cached.count} ${deviceType} presets from cache`)
      return NextResponse.json({
        ...cached,
        fromCache: true
      })
    }

    // Fetch presets for the specified device type
    // Order by: order field (which is set by AI reordering), then by name
    const presets = await findMany('channelPresets', {
      where: and(
        eq(schema.channelPresets.deviceType, deviceType),
        eq(schema.channelPresets.isActive, true)
      ),
      orderBy: [
        asc(schema.channelPresets.order),
        asc(schema.channelPresets.name)
      ]
    })

    // Check if any preset has been used (indicating AI reordering has occurred)
    const hasUsageData = presets.some(p => p.usageCount > 0)

    const response = {
      success: true,
      presets,
      deviceType,
      count: presets.length,
      hasUsageData,
      orderingMethod: hasUsageData ? 'usage-based' : 'alphabetical'
    }

    // Cache for 5 minutes
    cacheManager.set('device-config', cacheKey, response)
    logger.debug(`[ChannelPresets] Cached ${presets.length} ${deviceType} presets`)

    return NextResponse.json({
      ...response,
      fromCache: false
    })
  } catch (error) {
    logger.error('[Preset Fetch] Error fetching presets by device:', error)
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
