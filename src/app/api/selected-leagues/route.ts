import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'

/**
 * GET /api/selected-leagues
 * Retrieves all selected leagues from the database
 */
export async function GET(request: NextRequest) {
  try {
    const selectedLeagues = await prisma.selectedLeague.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    const leagueIds = selectedLeagues.map(league => league.leagueId)

    return NextResponse.json({
      success: true,
      data: leagueIds,
      total: leagueIds.length
    })
  } catch (error) {
    console.error('Error fetching selected leagues:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch selected leagues' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/selected-leagues
 * Saves selected leagues to the database
 * Body: { leagueIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leagueIds } = body

    if (!Array.isArray(leagueIds)) {
      return NextResponse.json(
        { success: false, error: 'leagueIds must be an array' },
        { status: 400 }
      )
    }

    // Start a transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // First, mark all existing leagues as inactive
      await tx.selectedLeague.updateMany({
        where: {},
        data: {
          isActive: false
        }
      })

      // Then, upsert the selected leagues
      for (const leagueId of leagueIds) {
        await tx.selectedLeague.upsert({
          where: {
            leagueId: leagueId
          },
          update: {
            isActive: true,
            updatedAt: new Date()
          },
          create: {
            leagueId: leagueId,
            isActive: true
          }
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Selected leagues saved successfully',
      data: leagueIds
    })
  } catch (error) {
    console.error('Error saving selected leagues:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save selected leagues' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/selected-leagues
 * Clears all selected leagues
 */
export async function DELETE(request: NextRequest) {
  try {
    await prisma.selectedLeague.updateMany({
      where: {},
      data: {
        isActive: false
      }
    })

    return NextResponse.json({
      success: true,
      message: 'All selected leagues cleared'
    })
  } catch (error) {
    console.error('Error clearing selected leagues:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to clear selected leagues' },
      { status: 500 }
    )
  }
}
