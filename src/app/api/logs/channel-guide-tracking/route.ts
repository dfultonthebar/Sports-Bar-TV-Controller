

import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get('hours') || '24')

    // Get user interaction logs related to channel guide
    const userLogs = await enhancedLogger.getRecentLogs(hours, 'user_interaction')
    
    // Filter for channel guide related activities
    const channelGuideLogs = userLogs.filter(log => 
      log.action.includes('guide_') || 
      log.action.includes('channel_') ||
      log.action.includes('sports_guide') ||
      log.source.includes('SportsGuide') ||
      log.details?.component?.includes('Guide')
    )

    // Analyze channel guide usage patterns
    const guideActions = channelGuideLogs.reduce((acc, log) => {
      const action = log.action
      acc[action] = (acc[action] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Track content downloads and access patterns
    const contentAccess = channelGuideLogs
      .filter(log => log.action.includes('content_') || log.action.includes('download_'))
      .map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        action: log.action,
        content: log.details?.content || 'unknown',
        league: log.details?.league,
        channel: log.details?.channel,
        success: log.success,
        duration: log.duration
      }))

    // Track search patterns
    const searchActivities = channelGuideLogs
      .filter(log => log.action.includes('search') || log.action.includes('filter'))
      .map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        query: log.details?.query || log.details?.search,
        filters: log.details?.filters,
        results: log.details?.resultsCount,
        success: log.success
      }))

    // Channel selection patterns
    const channelSelections = channelGuideLogs
      .filter(log => log.action.includes('select_channel') || log.action.includes('channel_change'))
      .map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        channel: log.details?.channelNumber || log.details?.channel,
        channelName: log.details?.channelName,
        league: log.details?.league,
        sport: log.details?.sport,
        success: log.success
      }))

    // Popular content analysis
    const popularChannels = channelSelections.reduce((acc, selection) => {
      const channel = selection.channel || 'unknown'
      const count = acc[channel] || 0
      acc[channel] = count + 1
      return acc
    }, {} as Record<string, number>)

    const popularLeagues = channelGuideLogs.reduce((acc, log) => {
      const league = log.details?.league
      if (league && typeof league === 'string') {
        const count = acc[league] || 0
        acc[league] = count + 1
      }
      return acc
    }, {} as Record<string, number>)

    // Generate usage statistics
    const stats = {
      totalGuideInteractions: channelGuideLogs.length,
      uniqueActions: Object.keys(guideActions).length,
      contentDownloads: contentAccess.length,
      searchQueries: searchActivities.length,
      channelSelections: channelSelections.length,
      mostUsedAction: Object.entries(guideActions)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none',
      mostPopularChannel: Object.entries(popularChannels)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none',
      mostPopularLeague: Object.entries(popularLeagues)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none',
      avgSessionDuration: calculateAverageSessionDuration(channelGuideLogs)
    }

    const response = {
      channelGuideActivity: {
        logs: channelGuideLogs.slice(0, 50), // Limit for response size
        actions: guideActions,
        contentAccess,
        searchActivities: searchActivities.slice(0, 20),
        channelSelections: channelSelections.slice(0, 20)
      },
      popularContent: {
        channels: Object.entries(popularChannels)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10),
        leagues: Object.entries(popularLeagues)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
      },
      statistics: stats,
      filters: { hours },
      timestamp: new Date().toISOString()
    }

    // Log the tracking request
    await enhancedLogger.info(
      'api',
      'channel-guide-tracking-api',
      'track_guide_usage',
      'Channel guide tracking data requested',
      {
        hours,
        totalInteractions: channelGuideLogs.length,
        contentDownloads: contentAccess.length,
        searchQueries: searchActivities.length
      }
    )

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Failed to track channel guide usage:', error)
    
    await enhancedLogger.error(
      'api',
      'channel-guide-tracking-api',
      'track_guide_usage',
      'Failed to track channel guide usage',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      { error: 'Failed to track channel guide usage' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const {
      action,
      content,
      channel,
      league,
      searchQuery,
      filters,
      results,
      userId,
      sessionId,
      metadata
    } = bodyValidation.data

    // Validate required fields
    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    // Determine log details based on action type
    const logDetails: any = {
      action,
      content,
      channel,
      league,
      searchQuery,
      filters,
      results,
      metadata,
      timestamp: Date.now()
    }

    // Log channel guide interaction
    await enhancedLogger.logUserInteraction(
      action,
      logDetails,
      userId,
      sessionId
    )

    // Special handling for content downloads
    if (typeof action === 'string' && (action.includes('download') || action.includes('content_access'))) {
      await enhancedLogger.info(
        'user_interaction',
        'channel-guide',
        'content_download',
        `Content downloaded: ${content || 'unknown'}`,
        {
          content,
          channel,
          league,
          downloadTime: new Date().toISOString(),
          userId
        }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Channel guide interaction logged',
      timestamp: new Date().toISOString(),
      interaction: {
        action,
        content,
        channel,
        league
      }
    })
  } catch (error) {
    logger.error('Failed to log channel guide interaction:', error)
    
    await enhancedLogger.error(
      'api',
      'channel-guide-tracking-api',
      'log_guide_interaction',
      'Failed to log channel guide interaction',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      { error: 'Failed to log channel guide interaction' },
      { status: 500 }
    )
  }
}

function calculateAverageSessionDuration(logs: any[]): number {
  if (logs.length === 0) return 0

  // Group logs by session ID
  const sessions = logs.reduce((acc, log) => {
    const sessionId = log.sessionId || 'anonymous'
    if (!acc[sessionId]) {
      acc[sessionId] = [] as any[]
    }
    acc[sessionId].push(log)
    return acc
  }, {} as Record<string, any[]>)

  // Calculate duration for each session
  const sessionDurations: number[] = []
  
  Object.values(sessions).forEach(sessionLogs => {
    if (!Array.isArray(sessionLogs) || sessionLogs.length < 2) return
    
    const timestamps = sessionLogs
      .map(log => new Date(log.timestamp).getTime())
      .filter(timestamp => !isNaN(timestamp))
      .sort((a, b) => a - b)
    
    if (timestamps.length >= 2) {
      const duration = timestamps[timestamps.length - 1] - timestamps[0]
      sessionDurations.push(duration)
    }
  })

  if (sessionDurations.length === 0) return 0

  const totalDuration = sessionDurations.reduce((sum, duration) => sum + duration, 0)
  return Math.round(totalDuration / sessionDurations.length / 1000) // Convert to seconds
}
