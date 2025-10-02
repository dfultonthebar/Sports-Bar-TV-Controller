
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const sport = searchParams.get('sport')
    const schoolId = searchParams.get('schoolId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const streamingOnly = searchParams.get('streamingOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where clause
    const where: any = {}

    if (sport && sport !== 'all') {
      where.sport = sport
    }

    if (schoolId) {
      where.OR = [
        { homeSchoolId: schoolId },
        { awaySchoolId: schoolId }
      ]
    }

    if (status) {
      where.status = status
    }

    if (startDate) {
      where.gameDate = {
        ...where.gameDate,
        gte: new Date(startDate)
      }
    }

    if (endDate) {
      where.gameDate = {
        ...where.gameDate,
        lte: new Date(endDate)
      }
    }

    if (streamingOnly) {
      where.isNFHSNetwork = true
    }

    // Fetch games with related school data
    const games = await prisma.nFHSGame.findMany({
      where,
      include: {
        homeSchool: true,
        awaySchool: true
      },
      orderBy: {
        gameDate: 'asc'
      },
      take: limit
    })

    // Transform data for frontend
    const transformedGames = games.map(game => ({
      id: game.id,
      homeTeam: {
        name: game.homeTeamName,
        school: game.homeSchool.name,
        city: game.homeSchool.city,
        state: game.homeSchool.state
      },
      awayTeam: {
        name: game.awayTeamName,
        school: game.awaySchool.name,
        city: game.awaySchool.city,
        state: game.awaySchool.state
      },
      sport: game.sport,
      league: game.league || `${game.homeSchool.state} High School ${game.sport}`,
      division: game.division,
      level: game.level,
      gender: game.gender,
      date: game.gameDate.toISOString().split('T')[0],
      time: game.gameTime,
      venue: game.venue,
      status: game.status,
      streamUrl: game.streamUrl,
      isNFHSNetwork: game.isNFHSNetwork,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      ticketInfo: game.ticketInfo,
      lastSynced: game.lastSynced
    }))

    return NextResponse.json({
      success: true,
      count: transformedGames.length,
      games: transformedGames
    })
  } catch (error) {
    console.error('Error fetching NFHS games:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to fetch games'
      },
      { status: 500 }
    )
  }
}

