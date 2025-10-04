
import { NextRequest, NextResponse } from 'next/server'
import { nfhsAPI, NFHSGame } from '@/lib/sports-apis/nfhs-api'

export const dynamic = 'force-dynamic'

interface NFHSStreamRequest {
  state?: string
  sport?: string
  location?: {
    zip?: string
    city?: string
    state?: string
  }
  homeTeam?: string
  radiusMiles?: number
  daysAhead?: number
  liveOnly?: boolean
}

interface NFHSStreamResponse {
  success: boolean
  data?: {
    games: NFHSGame[]
    liveGames: NFHSGame[]
    upcomingStreams: NFHSGame[]
    totalGames: number
    streamingGames: number
  }
  error?: string
  metadata?: {
    searchCriteria: NFHSStreamRequest
    generatedAt: string
    dataSource: string
  }
}

/**
 * GET /api/nfhs-streams
 * Fetch NFHS Network streaming games and schedules
 */
export async function GET(request: NextRequest): Promise<NextResponse<NFHSStreamResponse>> {
  try {
    const { searchParams } = new URL(request.url)
    
    const requestParams: NFHSStreamRequest = {
      state: searchParams.get('state') || 'WI',
      sport: searchParams.get('sport') || undefined,
      homeTeam: searchParams.get('homeTeam') || undefined,
      radiusMiles: parseInt(searchParams.get('radiusMiles') || '50'),
      daysAhead: parseInt(searchParams.get('daysAhead') || '7'),
      liveOnly: searchParams.get('liveOnly') === 'true',
      location: {
        zip: searchParams.get('zip') || undefined,
        city: searchParams.get('city') || undefined,
        state: searchParams.get('locationState') || searchParams.get('state') || 'WI'
      }
    }

    console.log('🏫 Fetching NFHS Network streams:', requestParams)

    // Get high school games
    const allGames = await nfhsAPI.getHighSchoolGames(
      requestParams.state,
      requestParams.sport,
      new Date().toISOString().split('T')[0]
    )

    // Filter by location if specified
    let filteredGames = allGames
    if (requestParams.location?.city) {
      filteredGames = allGames.filter(game => 
        game.homeTeam.city.toLowerCase().includes(requestParams.location!.city!.toLowerCase()) ||
        game.awayTeam.city.toLowerCase().includes(requestParams.location!.city!.toLowerCase())
      )
    }

    // Filter by home team if specified
    if (requestParams.homeTeam) {
      const homeTeamLower = requestParams.homeTeam.toLowerCase()
      filteredGames = filteredGames.filter(game => 
        game.homeTeam.name.toLowerCase().includes(homeTeamLower) ||
        game.homeTeam.school.toLowerCase().includes(homeTeamLower) ||
        game.awayTeam.name.toLowerCase().includes(homeTeamLower) ||
        game.awayTeam.school.toLowerCase().includes(homeTeamLower)
      )
    }

    // Get live streams
    const liveGames = await nfhsAPI.getLiveStreams()
    
    // Get upcoming streams
    const upcomingStreams = await nfhsAPI.getUpcomingStreams(requestParams.daysAhead)

    // Filter for live only if requested
    if (requestParams.liveOnly) {
      filteredGames = filteredGames.filter(game => 
        game.status === 'live' || 
        (game.isNFHSNetwork && liveGames.some(live => live.id === game.id))
      )
    }

    const streamingGames = filteredGames.filter(game => game.isNFHSNetwork)

    const response: NFHSStreamResponse = {
      success: true,
      data: {
        games: filteredGames,
        liveGames: liveGames,
        upcomingStreams: upcomingStreams,
        totalGames: filteredGames.length,
        streamingGames: streamingGames.length
      },
      metadata: {
        searchCriteria: requestParams,
        generatedAt: new Date().toISOString(),
        dataSource: filteredGames.length > 0 ? 'NFHS Network Enhanced API' : 'Mock Data (Development)'
      }
    }

    console.log(`✅ NFHS API Response: ${filteredGames.length} total games, ${streamingGames.length} streaming`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error in NFHS streams API:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch NFHS streams'
    }, { status: 500 })
  }
}

/**
 * POST /api/nfhs-streams
 * Search for NFHS Network streams with advanced criteria
 */
export async function POST(request: NextRequest): Promise<NextResponse<NFHSStreamResponse>> {
  try {
    const body: NFHSStreamRequest = await request.json()
    
    console.log('🏫 NFHS Network search request:', body)

    // Get games by location if specified
    let games: NFHSGame[] = []
    
    if (body.location?.zip || body.location?.city) {
      games = await nfhsAPI.getGamesByLocation(
        body.location.zip,
        body.location.city,
        body.location.state,
        body.radiusMiles
      )
    } else {
      games = await nfhsAPI.getHighSchoolGames(
        body.state,
        body.sport,
        new Date().toISOString().split('T')[0]
      )
    }

    // Filter by home team with fuzzy matching
    if (body.homeTeam) {
      const homeTeamLower = body.homeTeam.toLowerCase()
      games = games.filter(game => {
        const homeTeamMatch = 
          game.homeTeam.name.toLowerCase().includes(homeTeamLower) ||
          game.homeTeam.school.toLowerCase().includes(homeTeamLower) ||
          homeTeamLower.includes(game.homeTeam.name.toLowerCase()) ||
          homeTeamLower.includes(game.homeTeam.school.toLowerCase())
        
        const awayTeamMatch = 
          game.awayTeam.name.toLowerCase().includes(homeTeamLower) ||
          game.awayTeam.school.toLowerCase().includes(homeTeamLower) ||
          homeTeamLower.includes(game.awayTeam.name.toLowerCase()) ||
          homeTeamLower.includes(game.awayTeam.school.toLowerCase())

        return homeTeamMatch || awayTeamMatch
      })
    }

    // Get streaming games
    const streamingGames = games.filter(game => game.isNFHSNetwork)
    
    // Get live games if requested
    let liveGames: NFHSGame[] = []
    if (body.liveOnly) {
      liveGames = await nfhsAPI.getLiveStreams()
      games = games.filter(game => 
        liveGames.some(live => live.id === game.id) || 
        game.status === 'live'
      )
    } else {
      liveGames = await nfhsAPI.getLiveStreams()
    }

    const response: NFHSStreamResponse = {
      success: true,
      data: {
        games: games,
        liveGames: liveGames,
        upcomingStreams: streamingGames.filter(game => game.status === 'scheduled'),
        totalGames: games.length,
        streamingGames: streamingGames.length
      },
      metadata: {
        searchCriteria: body,
        generatedAt: new Date().toISOString(),
        dataSource: 'NFHS Network Enhanced Search'
      }
    }

    console.log(`✅ NFHS Search Results: ${games.length} total, ${streamingGames.length} streaming, ${liveGames.length} live`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error in NFHS streams search:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search NFHS streams'
    }, { status: 500 })
  }
}
