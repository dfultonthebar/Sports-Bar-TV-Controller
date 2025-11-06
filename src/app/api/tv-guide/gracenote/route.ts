
// Gracenote TV Guide API Endpoint
import { NextRequest, NextResponse } from 'next/server'
import { gracenoteService } from '@/lib/gracenote-service'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const body = bodyValidation.data
  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const zipCode = searchParams.get('zipCode') || '53703' // Default to Madison, WI
    
    switch (action) {
      case 'status':
        const status = await gracenoteService.getStatus()
        return NextResponse.json(status)
        
      case 'channels':
        const provider = searchParams.get('provider')
        const channels = await gracenoteService.getChannelLineup(zipCode, provider || undefined)
        return NextResponse.json({
          success: true,
          channels,
          zipCode,
          provider: provider || 'All Providers'
        })
        
      case 'guide':
        const channelsParam = searchParams.get('channels')
        const startTimeParam = searchParams.get('startTime')
        const endTimeParam = searchParams.get('endTime')
        
        const channelIds = channelsParam ? channelsParam.split(',') : []
        const startTime = startTimeParam ? new Date(startTimeParam) : new Date()
        const endTime = endTimeParam ? new Date(endTimeParam) : new Date(Date.now() + 24 * 60 * 60 * 1000)
        
        const guideData = await gracenoteService.getGuideData(channelIds, startTime, endTime, zipCode)
        return NextResponse.json(guideData)
        
      case 'sports':
        const leaguesParam = searchParams.get('leagues')
        const sportsStartTime = searchParams.get('startTime') ? new Date(searchParams.get('startTime')!) : new Date()
        const sportsEndTime = searchParams.get('endTime') ? new Date(searchParams.get('endTime')!) : new Date(Date.now() + 24 * 60 * 60 * 1000)
        const leagues = leaguesParam ? leaguesParam.split(',') : undefined
        
        const sportsPrograms = await gracenoteService.getSportsPrograms(sportsStartTime, sportsEndTime, leagues, zipCode)
        return NextResponse.json({
          success: true,
          programs: sportsPrograms,
          leagues: leagues || 'All Leagues',
          timeRange: { startTime: sportsStartTime, endTime: sportsEndTime }
        })
        
      case 'search':
        const query = searchParams.get('query')
        if (!query) {
          return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
        }
        
        const searchResults = await gracenoteService.searchPrograms(query, zipCode)
        return NextResponse.json({
          success: true,
          results: searchResults,
          query,
          zipCode
        })
        
      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }
  } catch (error) {
    logger.error('Gracenote API error:', error)
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
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const body = bodyValidation.data

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  try {
    const action = body.action as string | undefined
    const data = body.data as Record<string, any> | undefined

    if (!data) {
      return NextResponse.json({ error: 'Data is required' }, { status: 400 })
    }

    switch (action) {
      case 'bulkGuide':
        const { channels, startTime, endTime, zipCode } = data
        const guideData = await gracenoteService.getGuideData(
          channels || [],
          new Date(startTime),
          new Date(endTime),
          zipCode
        )
        return NextResponse.json(guideData)

      case 'sportsByLeagues':
        const { leagues, startTime: sportsStart, endTime: sportsEnd, zipCode: sportsZip } = data
        const sportsPrograms = await gracenoteService.getSportsPrograms(
          new Date(sportsStart),
          new Date(sportsEnd),
          leagues,
          sportsZip
        )
        return NextResponse.json({
          success: true,
          programs: sportsPrograms,
          requestedLeagues: leagues
        })

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }
  } catch (error) {
    logger.error('Gracenote POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
