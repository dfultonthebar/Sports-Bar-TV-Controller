import { NextRequest, NextResponse } from 'next/server'
import { findMany, gte, lte, asc, and, eq, schema } from '@/lib/db-helpers'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
import { cacheManager } from '@/lib/cache-manager'

/**
 * GET /api/sports/upcoming
 * Get upcoming sports events
 *
 * Query params:
 * - days: number of days ahead to fetch (default: 7)
 * - importance: filter by importance level
 * - league: filter by specific league
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
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const importance = searchParams.get('importance')
    const league = searchParams.get('league')

    // Cache key based on query parameters
    const cacheKey = `upcoming:days:${days}:importance:${importance || 'all'}:league:${league || 'all'}`

    // Try to get from cache first (5 minute TTL)
    const cached = cacheManager.get('sports-data', cacheKey)
    if (cached && typeof cached === 'object' && 'total' in cached) {
      logger.debug(`[Sports] Returning ${cached.total} upcoming events from cache`)
      return NextResponse.json({
        ...cached,
        fromCache: true
      })
    }

    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)

    // Build where clause
    let whereConditions: any[] = [
      gte(schema.sportsEvents.eventDate, now.toISOString()),
      lte(schema.sportsEvents.eventDate, futureDate.toISOString()),
      eq(schema.sportsEvents.status, 'scheduled')
    ]

    if (importance) {
      whereConditions.push(eq(schema.sportsEvents.importance, importance))
    }

    if (league) {
      whereConditions.push(eq(schema.sportsEvents.league, league))
    }

    const events = await findMany('sportsEvents', {
      where: and(...whereConditions) as any,
      orderBy: asc(schema.sportsEvents.eventDate),
      limit: 50
    })

    // Group events by day
    const eventsByDay = events.reduce((acc: any, event: any) => {
      const date = new Date(event.eventDate).toDateString()
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(event)
      return acc
    }, {})

    const response = {
      success: true,
      total: events.length,
      events,
      eventsByDay
    }

    // Cache for 5 minutes
    cacheManager.set('sports-data', cacheKey, response)
    logger.debug(`[Sports] Cached ${events.length} upcoming events`)

    return NextResponse.json({
      ...response,
      fromCache: false
    })
  } catch (error) {
    logger.error('[Upcoming Sports API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch upcoming events' },
      { status: 500 }
    )
  }
}
