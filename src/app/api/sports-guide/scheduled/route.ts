

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// This endpoint handles the scheduled 7-day sports guide updates
export async function POST(request: NextRequest) {
  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000))
    
    // Get all major sports leagues for comprehensive coverage
    const allLeagues = [
      'nfl', 'nba', 'mlb', 'nhl', 'ncaa-fb', 'ncaa-bb', 'mls',
      'premier', 'champions', 'la-liga', 'serie-a', 'bundesliga'
    ]

    // Call the main sports guide generation with all leagues
    const sportsGuideResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/sports-guide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        selectedLeagues: allLeagues,
        scheduledUpdate: true,
        dateRange: {
          start: now.toISOString().split('T')[0],
          end: sevenDaysFromNow.toISOString().split('T')[0]
        }
      })
    })

    if (!sportsGuideResponse.ok) {
      throw new Error('Failed to generate sports guide')
    }

    const sportsData = await sportsGuideResponse.json()

    // Log the successful update
    console.log(`🏆 Scheduled Sports Guide Update Completed:`, {
      timestamp: now.toISOString(),
      totalGames: sportsData.data?.totalGames || 0,
      channels: sportsData.data?.channels?.length || 0,
      dateRange: `${now.toISOString().split('T')[0]} to ${sevenDaysFromNow.toISOString().split('T')[0]}`
    })

    return NextResponse.json({
      success: true,
      message: '7-Day Sports Guide Update Completed Successfully',
      data: {
        updateTime: now.toISOString(),
        gamesFound: sportsData.data?.totalGames || 0,
        channelsCovered: sportsData.data?.channels?.length || 0,
        dateRange: {
          start: now.toISOString().split('T')[0],
          end: sevenDaysFromNow.toISOString().split('T')[0]
        },
        leagues: allLeagues,
        nextUpdate: new Date(now.getTime() + (24 * 60 * 60 * 1000)).toISOString()
      }
    })
  } catch (error) {
    console.error('❌ Scheduled sports guide update failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to complete scheduled update',
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
      info: 'Scheduled Sports Guide Update Endpoint',
      schedule: {
        frequency: 'Daily at 12:00 AM',
        nextRun: midnight.toISOString(),
        coverage: '7 days from update time',
        leagues: [
          'NFL', 'NBA', 'MLB', 'NHL', 'NCAA Football', 'NCAA Basketball',
          'MLS', 'Premier League', 'Champions League', 'La Liga', 'Serie A', 'Bundesliga'
        ],
        channels: [
          'ESPN', 'ESPN2', 'ESPNU', 'ESPN News', 'Fox Sports 1', 'Fox Sports 2',
          'Big Ten Network', 'Bally Sports', 'Golf Channel', 'NFL Network', 'NFL RedZone',
          'NBA TV', 'MLB Network', 'NHL Network', 'SEC Network', 'ACC Network',
          'Tennis Channel', 'NBC Sports', 'CBS Sports', 'TNT', 'Amazon Prime Video',
          'Netflix', 'Paramount+', 'Peacock Premium', 'Apple TV+', 'YouTube TV'
        ]
      },
      usage: {
        'POST /api/sports-guide/scheduled': 'Run the scheduled update manually',
        'GET /api/sports-guide/scheduled': 'Get schedule information'
      }
    })
  } catch (error) {
    console.error('Error getting scheduled update info:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get schedule info' },
      { status: 500 }
    )
  }
}

