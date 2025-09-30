

import { NextRequest, NextResponse } from 'next/server'
import { liveSportsService } from '../../../../lib/sports-apis/live-sports-service'

export const dynamic = 'force-dynamic'

// This endpoint handles the scheduled 7-day sports guide updates with timezone support
export async function POST(request: NextRequest) {
  try {
    const timezone = 'America/New_York'
    
    // Get current time in configured timezone
    const now = new Date()
    const localNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }))
    const sevenDaysFromNow = new Date(localNow.getTime() + (7 * 24 * 60 * 60 * 1000))
    
    // Get all major sports leagues for comprehensive coverage
    const allLeagues = [
      'nfl', 'nba', 'mlb', 'nhl', 'ncaa-fb', 'ncaa-bb', 'mls',
      'premier', 'champions', 'la-liga', 'serie-a', 'bundesliga'
    ]

    console.log(`🏆 Starting scheduled sports guide update for ${allLeagues.length} leagues`)
    console.log(`📅 Date range: ${localNow.toISOString().split('T')[0]} to ${sevenDaysFromNow.toISOString().split('T')[0]}`)

    // Call the live sports service directly
    const liveData = await liveSportsService.getLiveGames(
      allLeagues,
      localNow.toISOString().split('T')[0],
      sevenDaysFromNow.toISOString().split('T')[0]
    )

    // Log the successful update with timezone-adjusted time
    console.log(`🏆 Scheduled Sports Guide Update Completed:`, {
      timestamp: localNow.toISOString(),
      timezone: timezone,
      totalGames: liveData.totalGames,
      liveGames: liveData.liveGames,
      upcomingGames: liveData.upcomingGames,
      completedGames: liveData.completedGames,
      dataSources: liveData.sources,
      dateRange: `${localNow.toISOString().split('T')[0]} to ${sevenDaysFromNow.toISOString().split('T')[0]}`
    })

    return NextResponse.json({
      success: true,
      message: '7-Day Sports Guide Update Completed Successfully',
      data: {
        updateTime: localNow.toISOString(),
        timezone: timezone,
        totalGames: liveData.totalGames,
        liveGames: liveData.liveGames,
        upcomingGames: liveData.upcomingGames,
        completedGames: liveData.completedGames,
        dataSources: liveData.sources,
        channelsCovered: Array.from(new Set(liveData.games.map(g => g.channel.name))).length,
        dateRange: {
          start: localNow.toISOString().split('T')[0],
          end: sevenDaysFromNow.toISOString().split('T')[0]
        },
        leagues: allLeagues,
        nextUpdate: new Date(localNow.getTime() + (24 * 60 * 60 * 1000)).toISOString(),
        gamesPerLeague: allLeagues.reduce((acc, league) => {
          const leagueGames = liveData.games.filter(g => g.league.toLowerCase().includes(league.replace('-', ' ')))
          acc[league] = leagueGames.length
          return acc
        }, {} as Record<string, number>)
      }
    })
  } catch (error) {
    console.error('❌ Scheduled sports guide update failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to complete scheduled update',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(0, 0, 0, 0)
    midnight.setDate(midnight.getDate() + 1) // Next midnight

    return NextResponse.json({
      success: true,
      info: 'Scheduled Live Sports Guide Update Endpoint',
      version: '2.0.0',
      schedule: {
        frequency: 'Daily at 12:00 AM',
        nextRun: midnight.toISOString(),
        coverage: '7 days from update time',
        timezone: 'America/New_York',
        leagues: [
          'NFL (ESPN API)', 'NBA (ESPN API)', 'MLB (ESPN API)', 'NHL (ESPN API)', 
          'NCAA Football (ESPN API)', 'NCAA Basketball (ESPN API)', 'MLS (ESPN API)',
          'Premier League (TheSportsDB)', 'Champions League (TheSportsDB)', 
          'La Liga (TheSportsDB)', 'Serie A (TheSportsDB)', 'Bundesliga (TheSportsDB)'
        ],
        dataSources: [
          'ESPN API (Free) - No API key required',
          'TheSportsDB API (Free) - No API key required'
        ],
        features: [
          'Live game data from free APIs',
          'Real-time scores and game status',
          'Automatic fallback to mock data if APIs unavailable',
          'Channel and broadcast information',
          'Comprehensive 7-day coverage'
        ]
      },
      usage: {
        'POST /api/sports-guide/scheduled': 'Run the scheduled live data update manually',
        'GET /api/sports-guide/scheduled': 'Get schedule information and status'
      },
      lastUpdate: null, // Would be populated from actual logs/database
      apiStatus: 'Ready for live data integration'
    })
  } catch (error) {
    console.error('Error getting scheduled update info:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get schedule info' },
      { status: 500 }
    )
  }
}

