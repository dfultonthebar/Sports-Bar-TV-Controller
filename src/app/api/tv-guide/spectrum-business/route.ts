
// Spectrum Business API Endpoint
import { NextRequest, NextResponse } from 'next/server'
import { spectrumBusinessApiService } from '@/lib/spectrum-business-api'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    switch (action) {
      case 'status':
        const status = await spectrumBusinessApiService.getStatus()
        return NextResponse.json(status)
        
      case 'account':
        const accountInfo = await spectrumBusinessApiService.getAccountInfo()
        return NextResponse.json({
          success: true,
          accountInfo
        })
        
      case 'channels':
        const channels = await spectrumBusinessApiService.getChannelLineup()
        return NextResponse.json({
          success: true,
          channels,
          source: 'Spectrum Business API'
        })
        
      case 'guide':
        const startTimeParam = searchParams.get('startTime')
        const endTimeParam = searchParams.get('endTime')
        const channelIdsParam = searchParams.get('channelIds')
        
        const startTime = startTimeParam ? new Date(startTimeParam) : new Date()
        const endTime = endTimeParam ? new Date(endTimeParam) : new Date(Date.now() + 24 * 60 * 60 * 1000)
        const channelIds = channelIdsParam ? channelIdsParam.split(',') : undefined
        
        const guideData = await spectrumBusinessApiService.getGuideData(startTime, endTime, channelIds)
        return NextResponse.json(guideData)
        
      case 'sports':
        const sportsStartTime = searchParams.get('startTime') ? new Date(searchParams.get('startTime')!) : new Date()
        const sportsEndTime = searchParams.get('endTime') ? new Date(searchParams.get('endTime')!) : new Date(Date.now() + 24 * 60 * 60 * 1000)
        const leaguesParam = searchParams.get('leagues')
        const leagues = leaguesParam ? leaguesParam.split(',') : undefined
        
        const sportsPrograms = await spectrumBusinessApiService.getSportsPrograms(sportsStartTime, sportsEndTime, leagues)
        return NextResponse.json({
          success: true,
          programs: sportsPrograms,
          leagues: leagues || 'All Leagues',
          timeRange: { startTime: sportsStartTime, endTime: sportsEndTime }
        })
        
      case 'current-sports':
        const currentSports = await spectrumBusinessApiService.getCurrentSportsPrograms()
        return NextResponse.json({
          success: true,
          programs: currentSports,
          timestamp: new Date().toISOString()
        })
        
      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Spectrum Business API error:', error)
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

  try {
    const body = await request.json()
    const { action, data } = body
    
    switch (action) {
      case 'bulkGuide':
        const { startTime, endTime, channelIds } = data
        const guideData = await spectrumBusinessApiService.getGuideData(
          new Date(startTime),
          new Date(endTime),
          channelIds
        )
        return NextResponse.json(guideData)
        
      case 'customSports':
        const { startTime: sportsStart, endTime: sportsEnd, leagues, filters } = data
        let sportsPrograms = await spectrumBusinessApiService.getSportsPrograms(
          new Date(sportsStart),
          new Date(sportsEnd),
          leagues
        )
        
        // Apply additional filters if provided
        if (filters) {
          if (filters.teams && filters.teams.length > 0) {
            sportsPrograms = sportsPrograms.filter(program => 
              filters.teams.some((team: string) =>
                program.sportsData?.homeTeam?.toLowerCase().includes(team.toLowerCase()) ||
                program.sportsData?.awayTeam?.toLowerCase().includes(team.toLowerCase())
              )
            )
          }
          
          if (filters.venues && filters.venues.length > 0) {
            sportsPrograms = sportsPrograms.filter(program =>
              filters.venues.some((venue: string) =>
                program.sportsData?.venue?.toLowerCase().includes(venue.toLowerCase())
              )
            )
          }
        }
        
        return NextResponse.json({
          success: true,
          programs: sportsPrograms,
          appliedFilters: filters
        })
        
      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Spectrum Business POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
