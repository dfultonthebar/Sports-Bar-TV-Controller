
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const state = searchParams.get('state')
    const city = searchParams.get('city')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where clause
    const where: any = {
      isActive: true
    }

    if (state) {
      where.state = state
    }

    if (city) {
      where.city = {
        contains: city,
        mode: 'insensitive'
      }
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          city: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    }

    // Fetch schools
    const schools = await prisma.nFHSSchool.findMany({
      where,
      orderBy: [
        { state: 'asc' },
        { city: 'asc' },
        { name: 'asc' }
      ],
      take: limit
    })

    // Get game counts for each school
    const schoolsWithCounts = await Promise.all(
      schools.map(async (school) => {
        const upcomingGames = await prisma.nFHSGame.count({
          where: {
            OR: [
              { homeSchoolId: school.id },
              { awaySchoolId: school.id }
            ],
            gameDate: {
              gte: new Date()
            },
            status: 'scheduled'
          }
        })

        return {
          id: school.id,
          nfhsId: school.nfhsId,
          name: school.name,
          city: school.city,
          state: school.state,
          district: school.district,
          conferences: school.conferences ? JSON.parse(school.conferences) : [],
          sports: school.sports ? JSON.parse(school.sports) : [],
          upcomingGames,
          createdAt: school.createdAt,
          updatedAt: school.updatedAt
        }
      })
    )

    return NextResponse.json({
      success: true,
      count: schoolsWithCounts.length,
      schools: schoolsWithCounts
    })
  } catch (error) {
    console.error('Error fetching NFHS schools:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to fetch schools'
      },
      { status: 500 }
    )
  }
}

