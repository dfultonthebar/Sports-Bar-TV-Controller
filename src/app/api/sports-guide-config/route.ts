
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export interface SportsGuideConfigRequest {
  zipCode?: string
  city?: string
  state?: string
  timezone: string
  providers: {
    id?: string
    name: string
    type: string
    channels: string[]
    packages: string[]
    inputId?: string
  }[]
  homeTeams: {
    id?: string
    teamName: string
    league: string
    category: string
    sport: string
    location?: string
    conference?: string
    isPrimary: boolean
  }[]
}

export async function GET() {
  try {
    // Get current configuration
    const config = await prisma.sportsGuideConfiguration.findFirst({
      where: { isActive: true }
    })

    const providers = await prisma.tVProvider.findMany({
      where: { isActive: true }
    })

    const homeTeams = await prisma.homeTeam.findMany({
      where: { isActive: true },
      orderBy: [
        { isPrimary: 'desc' },
        { category: 'asc' },
        { teamName: 'asc' }
      ]
    })

    // Get matrix inputs for assignment
    const matrixConfig = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      include: {
        inputs: {
          where: { isActive: true },
          orderBy: { channelNumber: 'asc' }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        configuration: config,
        providers: providers.map(p => ({
          ...p,
          channels: JSON.parse(p.channels),
          packages: JSON.parse(p.packages)
        })),
        homeTeams,
        matrixInputs: matrixConfig?.inputs || []
      }
    })
  } catch (error) {
    console.error('Error loading sports guide config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load configuration' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { zipCode, city, state, timezone, providers, homeTeams }: SportsGuideConfigRequest = await request.json()

    // Update or create sports guide configuration
    const config = await prisma.sportsGuideConfiguration.upsert({
      where: { id: '1' }, // Use single configuration record
      update: {
        zipCode,
        city,
        state,
        timezone,
        isActive: true
      },
      create: {
        id: '1',
        zipCode,
        city,
        state,
        timezone,
        isActive: true
      }
    })

    // Clear existing providers and create new ones
    await prisma.tVProvider.deleteMany({ where: { isActive: true } })
    
    if (providers.length > 0) {
      await prisma.tVProvider.createMany({
        data: providers.map(provider => ({
          name: provider.name,
          type: provider.type,
          channels: JSON.stringify(provider.channels),
          packages: JSON.stringify(provider.packages),
          inputId: provider.inputId,
          isActive: true
        }))
      })
    }

    // Clear existing home teams and create new ones
    await prisma.homeTeam.deleteMany({ where: { isActive: true } })
    
    if (homeTeams.length > 0) {
      await prisma.homeTeam.createMany({
        data: homeTeams.map(team => ({
          teamName: team.teamName,
          league: team.league,
          category: team.category,
          sport: team.sport,
          location: team.location,
          conference: team.conference,
          isPrimary: team.isPrimary,
          isActive: true
        }))
      })
    }

    return NextResponse.json({
      success: true,
      data: { configuration: config }
    })
  } catch (error) {
    console.error('Error saving sports guide config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save configuration' },
      { status: 500 }
    )
  }
}
