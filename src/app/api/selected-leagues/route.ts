import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findMany, or, updateMany, upsert, create, update, transaction, db } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'


// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'

/**
 * GET /api/selected-leagues
 * Retrieves all selected leagues from the database
 */
export async function GET(request: NextRequest) {
  logger.api.request('GET', '/api/selected-leagues')
  
  try {
    const selectedLeagues = await findMany('selectedLeagues', {
      where: eq(schema.selectedLeagues.isActive, true),
      orderBy: asc(schema.selectedLeagues.createdAt)
    })

    const leagueIds = selectedLeagues.map(league => league.leagueId)

    logger.api.response('GET', '/api/selected-leagues', 200, { count: leagueIds.length })
    return NextResponse.json({
      success: true,
      data: leagueIds,
      total: leagueIds.length
    })
  } catch (error) {
    logger.api.error('GET', '/api/selected-leagues', error)
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
  logger.api.request('POST', '/api/selected-leagues')
  
  try {
    const body = await request.json()
    const { leagueIds } = body

    logger.debug('Saving selected leagues', { leagueIds })

    if (!Array.isArray(leagueIds)) {
      logger.api.response('POST', '/api/selected-leagues', 400, { error: 'Invalid input' })
      return NextResponse.json(
        { success: false, error: 'leagueIds must be an array' },
        { status: 400 }
      )
    }

    // Start a transaction to ensure data consistency
    await transaction(async (tx) => {
      // First, mark all existing leagues as inactive
      const allLeagues = await tx.select().from(schema.selectedLeagues).all()
      for (const league of allLeagues) {
        await tx.update(schema.selectedLeagues)
          .set({ isActive: false, updatedAt: new Date().toISOString() })
          .where(eq(schema.selectedLeagues.id, league.id))
      }

      // Then, upsert the selected leagues
      for (const leagueId of leagueIds) {
        await upsert(
          'selectedLeagues',
          eq(schema.selectedLeagues.leagueId, leagueId),
          { leagueId, isActive: true },
          { isActive: true, updatedAt: new Date().toISOString() }
        )
      }
    })

    logger.api.response('POST', '/api/selected-leagues', 200, { count: leagueIds.length })
    return NextResponse.json({
      success: true,
      message: 'Selected leagues saved successfully',
      data: leagueIds
    })
  } catch (error) {
    logger.api.error('POST', '/api/selected-leagues', error)
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
  logger.api.request('DELETE', '/api/selected-leagues')
  
  try {
    // Get all leagues and mark them as inactive
    const allLeagues = await findMany('selectedLeagues', {})
    
    for (const league of allLeagues) {
      await update('selectedLeagues', eq(schema.selectedLeagues.id, league.id), {
        isActive: false
      })
    }

    logger.api.response('DELETE', '/api/selected-leagues', 200, { cleared: allLeagues.length })
    return NextResponse.json({
      success: true,
      message: 'All selected leagues cleared'
    })
  } catch (error) {
    logger.api.error('DELETE', '/api/selected-leagues', error)
    return NextResponse.json(
      { success: false, error: 'Failed to clear selected leagues' },
      { status: 500 }
    )
  }
}
