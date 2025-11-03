import { NextRequest, NextResponse } from 'next/server'
import { cacheManager, getCacheStats, getCacheTypeStats, exportCacheState, CacheType } from '@/lib/cache-manager'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

/**
 * GET /api/cache/stats
 * Get cache statistics and performance metrics
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SYSTEM)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as CacheType | null
    const detailed = searchParams.get('detailed') === 'true'

    if (type) {
      // Get stats for specific cache type
      const typeStats = getCacheTypeStats(type)
      const config = cacheManager.getConfig(type)

      return NextResponse.json({
        success: true,
        type,
        stats: typeStats,
        config,
        timestamp: new Date().toISOString()
      })
    }

    // Get overall cache stats
    const stats = getCacheStats()

    if (detailed) {
      // Include full cache state export
      const state = exportCacheState()
      return NextResponse.json({
        success: true,
        stats,
        state,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to get cache stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve cache statistics'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cache/stats
 * Clear cache or update configuration
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SYSTEM)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const body = await request.json()
    const { action, type, config } = body

    switch (action) {
      case 'clear':
        if (type) {
          cacheManager.clearType(type as CacheType)
        } else {
          cacheManager.clear()
        }
        return NextResponse.json({
          success: true,
          message: type ? `Cleared cache for type: ${type}` : 'Cleared entire cache'
        })

      case 'cleanup':
        const removed = cacheManager.cleanup()
        return NextResponse.json({
          success: true,
          message: `Removed ${removed} expired entries`
        })

      case 'update-config':
        if (!type || !config) {
          return NextResponse.json(
            {
              success: false,
              error: 'Type and config are required for update-config action'
            },
            { status: 400 }
          )
        }
        cacheManager.updateConfig(type as CacheType, config)
        return NextResponse.json({
          success: true,
          message: `Updated configuration for cache type: ${type}`,
          config: cacheManager.getConfig(type as CacheType)
        })

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action. Supported actions: clear, cleanup, update-config'
          },
          { status: 400 }
        )
    }
  } catch (error) {
    logger.error('Failed to perform cache operation:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform cache operation'
      },
      { status: 500 }
    )
  }
}
