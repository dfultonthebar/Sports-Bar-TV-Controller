
/**
 * API Route: Get Streaming Events
 * 
 * Get sports events from various streaming services
 */

import { NextRequest, NextResponse } from 'next/server'
import { unifiedStreamingApi } from '@/lib/streaming/unified-streaming-api'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.EXTERNAL)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'all' // all, live, today, upcoming
    const sport = searchParams.get('sport') || undefined
    const team = searchParams.get('team') || undefined
    const days = parseInt(searchParams.get('days') || '7')
    
    // Device info for getting events for installed apps
    const deviceId = searchParams.get('deviceId') || undefined
    const ipAddress = searchParams.get('ipAddress') || undefined
    const port = parseInt(searchParams.get('port') || '5555')

    logger.info(`[API] Getting ${type} events${sport ? ` for ${sport}` : ''}`)

    let events

    switch (type) {
      case 'live':
        events = await unifiedStreamingApi.getAllLiveEvents()
        break

      case 'today':
        events = await unifiedStreamingApi.getTodaysEvents()
        break

      case 'upcoming':
        events = await unifiedStreamingApi.getUpcomingEvents(sport, days)
        break

      case 'search':
        if (!team) {
          return NextResponse.json(
            { error: 'team parameter required for search' },
            { status: 400 }
          )
        }
        events = await unifiedStreamingApi.searchEventsByTeam(team, sport)
        break

      case 'installed':
        if (!deviceId || !ipAddress) {
          return NextResponse.json(
            { error: 'deviceId and ipAddress required for installed apps' },
            { status: 400 }
          )
        }
        const installedEvents = await unifiedStreamingApi.getEventsForInstalledApps(
          deviceId,
          ipAddress,
          port
        )

        // Filter out games that started more than 2 hours ago
        const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000))
        const filteredApps = installedEvents.map(app => {
          if (app.events && Array.isArray(app.events)) {
            const freshEvents = app.events.filter(event => {
              if (event.startTime) {
                const gameStart = new Date(event.startTime)
                return gameStart >= twoHoursAgo
              }
              return true // Keep events without startTime
            })

            const removedCount = app.events.length - freshEvents.length
            if (removedCount > 0) {
              logger.info(`[CLEANUP] Filtered out ${removedCount} old events from ${app.appName}`)
            }

            return { ...app, events: freshEvents }
          }
          return app
        })

        return NextResponse.json({
          success: true,
          type: 'installed',
          apps: filteredApps
        })

      default:
        // Get all upcoming events
        events = await unifiedStreamingApi.getUpcomingEvents(sport, days)
    }

    // Filter out games that started more than 2 hours ago to keep the guide fresh
    const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000))
    const freshEvents = events.filter(event => {
      if (event.startTime) {
        const gameStart = new Date(event.startTime)
        return gameStart >= twoHoursAgo
      }
      return true // Keep events without startTime
    })

    const removedCount = events.length - freshEvents.length
    if (removedCount > 0) {
      logger.info(`[CLEANUP] Filtered out ${removedCount} old events from streaming guide (${type})`)
    }

    return NextResponse.json({
      success: true,
      type,
      sport,
      count: freshEvents.length,
      events: freshEvents
    })
  } catch (error: any) {
    logger.error('[API] Error getting events:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get events',
        message: error.message
      },
      { status: 500 }
    )
  }
}
