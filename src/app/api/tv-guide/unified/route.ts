
// Unified TV Guide API Endpoint
import { NextRequest, NextResponse } from 'next/server'
import { unifiedTVGuideService } from '@/lib/unified-tv-guide-service'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
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
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    switch (action) {
      case 'status':
        const status = await unifiedTVGuideService.getServicesStatus()
        return NextResponse.json(status)
        
      case 'channels':
        const channels = await unifiedTVGuideService.getUnifiedChannelLineup()
        return NextResponse.json({
          success: true,
          channels,
          totalChannels: channels.length,
          sportsChannels: channels.filter(ch => ch.category === 'sports').length
        })
        
      case 'guide':
        const startTimeParam = searchParams.get('startTime')
        const endTimeParam = searchParams.get('endTime')
        const channelIdsParam = searchParams.get('channelIds')
        
        const startTime = startTimeParam ? new Date(startTimeParam) : new Date()
        const endTime = endTimeParam ? new Date(endTimeParam) : new Date(Date.now() + 24 * 60 * 60 * 1000)
        const channelIds = channelIdsParam ? channelIdsParam.split(',') : undefined
        
        const guideData = await unifiedTVGuideService.getUnifiedGuideData(startTime, endTime, channelIds)
        return NextResponse.json(guideData)
        
      case 'sports':
        const sportsStartTime = searchParams.get('startTime') ? new Date(searchParams.get('startTime')!) : new Date()
        const sportsEndTime = searchParams.get('endTime') ? new Date(searchParams.get('endTime')!) : new Date(Date.now() + 24 * 60 * 60 * 1000)
        const leaguesParam = searchParams.get('leagues')
        const leagues = leaguesParam ? leaguesParam.split(',') : undefined
        
        const sportsPrograms = await unifiedTVGuideService.getUnifiedSportsPrograms(sportsStartTime, sportsEndTime, leagues)
        return NextResponse.json({
          success: true,
          programs: sportsPrograms,
          count: sportsPrograms.length,
          leagues: leagues || 'All Leagues',
          timeRange: { startTime: sportsStartTime, endTime: sportsEndTime }
        })
        
      case 'search':
        const query = searchParams.get('query')
        if (!query) {
          return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
        }
        
        const searchResults = await unifiedTVGuideService.searchAllSources(query)
        return NextResponse.json({
          success: true,
          results: searchResults,
          count: searchResults.length,
          query
        })
        
      case 'current-sports':
        const now = new Date()
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000)
        const currentSports = await unifiedTVGuideService.getUnifiedSportsPrograms(now, nextHour)
        
        // Filter to only currently airing programs
        const airingNow = currentSports.filter(program => 
          new Date(program.startTime) <= now && new Date(program.endTime) >= now
        )
        
        return NextResponse.json({
          success: true,
          programs: airingNow,
          count: airingNow.length,
          timestamp: now.toISOString()
        })
        
      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }
  } catch (error) {
    logger.error('Unified TV Guide API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
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
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const body = await request.json()
    const { action, data } = body
    
    switch (action) {
      case 'customGuide':
        const { startTime, endTime, channelIds, filters } = data
        let guideData = await unifiedTVGuideService.getUnifiedGuideData(
          new Date(startTime),
          new Date(endTime),
          channelIds
        )
        
        // Apply custom filters
        if (filters) {
          if (filters.sportsOnly) {
            guideData.programs = guideData.programs.filter(p => p.isSports)
          }
          
          if (filters.genres && filters.genres.length > 0) {
            guideData.programs = guideData.programs.filter(p =>
              p.genre.some(g => filters.genres.includes(g))
            )
          }
          
          if (filters.liveOnly) {
            guideData.programs = guideData.programs.filter(p => p.isLive)
          }
          
          if (filters.newOnly) {
            guideData.programs = guideData.programs.filter(p => p.isNew)
          }
        }
        
        return NextResponse.json({
          ...guideData,
          appliedFilters: filters
        })
        
      case 'sportsSchedule':
        const { leagues, teams, venues, timeRange } = data
        const { startTime: scheduleStart, endTime: scheduleEnd } = timeRange
        
        let sportsPrograms = await unifiedTVGuideService.getUnifiedSportsPrograms(
          new Date(scheduleStart),
          new Date(scheduleEnd),
          leagues
        )
        
        // Apply team filters
        if (teams && teams.length > 0) {
          sportsPrograms = sportsPrograms.filter(program =>
            teams.some((team: string) =>
              program.sportsInfo?.teams?.some(t => 
                t.toLowerCase().includes(team.toLowerCase())
              ) ||
              program.sportsInfo?.homeTeam?.toLowerCase().includes(team.toLowerCase()) ||
              program.sportsInfo?.awayTeam?.toLowerCase().includes(team.toLowerCase())
            )
          )
        }
        
        // Apply venue filters
        if (venues && venues.length > 0) {
          sportsPrograms = sportsPrograms.filter(program =>
            venues.some((venue: string) =>
              program.sportsInfo?.venue?.toLowerCase().includes(venue.toLowerCase())
            )
          )
        }
        
        return NextResponse.json({
          success: true,
          programs: sportsPrograms,
          count: sportsPrograms.length,
          filters: { leagues, teams, venues }
        })
        
      case 'bulkSearch':
        const { queries, timeWindow } = data
        const searchWindow = timeWindow || 24 // hours
        const searchEndTime = new Date(Date.now() + searchWindow * 60 * 60 * 1000)
        
        const searchResults = await Promise.all(
          queries.map(async (query: string) => ({
            query,
            results: await unifiedTVGuideService.searchAllSources(query)
          }))
        )
        
        return NextResponse.json({
          success: true,
          searches: searchResults,
          totalResults: searchResults.reduce((total, search) => total + search.results.length, 0)
        })
        
      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }
  } catch (error) {
    logger.error('Unified TV Guide POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
