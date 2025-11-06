import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, findMany, or, updateMany, upsert, create, update, transaction, db, count, sql } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'


// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'

/**
 * GET /api/selected-leagues
 * Retrieves all selected leagues from the database
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

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
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  logger.api.request('POST', '/api/selected-leagues')

  try {
    const { data } = bodyValidation
    const { leagueIds } = data
    logger.debug('Saving selected leagues', { data: { leagueIds }
      })

    if (!Array.isArray(leagueIds)) {
      logger.api.response('POST', '/api/selected-leagues', 400, { error: 'Invalid input' })
      return NextResponse.json(
        { success: false, error: 'leagueIds must be an array' },
        { status: 400 }
      )
    }

    // Start a transaction to ensure data consistency
    await transaction(async (tx) => {
      // QUICK WIN 4: Batch update instead of loading all records
      // First, mark all existing leagues as inactive using a batch update
      await tx.update(schema.selectedLeagues)
        .set({ isActive: false, updatedAt: new Date().toISOString() })
        .where(eq(schema.selectedLeagues.isActive, true))

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
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  logger.api.request('DELETE', '/api/selected-leagues')

  try {
    // QUICK WIN 4: Batch update instead of loading and updating individually
    // Get count before update for logging
    const activeCount = await count('selectedLeagues', eq(schema.selectedLeagues.isActive, true))

    // Mark all leagues as inactive using a batch update
    await updateMany('selectedLeagues',
      sql`1=1`, // Match all records
      {
        isActive: false,
        updatedAt: new Date().toISOString()
      }
    )

    logger.api.response('DELETE', '/api/selected-leagues', 200, { cleared: activeCount })
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
