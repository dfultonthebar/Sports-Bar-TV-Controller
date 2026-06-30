import { NextRequest, NextResponse } from 'next/server'
import { schema } from '@/db'
import { asc, eq, and } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { findMany } from '@/lib/db-helpers'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateQueryParams, isValidationError } from '@/lib/validation'

/**
 * GET /api/audio-processor/groups?processorId=<id>
 *
 * Returns the Atlas GROUPS configured for a processor (mirror of
 * /api/audio-processor/zones). Groups are populated by the Atlas
 * hardware query (/api/atlas/query-hardware) into the AudioGroup table.
 * groupNumber is 0-based (= Atlas GroupGain_<index>).
 *
 * Used by the Schedule-tab Default Source Settings UI to enumerate groups
 * for the per-group default-level controls (Stoneyard locations manage
 * audio by group rather than by individual zone).
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    const groups = await findMany('audioGroups', {
      where: and(eq(schema.audioGroups.processorId, processorId)),
      orderBy: asc(schema.audioGroups.groupNumber),
      limit: 1000,
    })

    return NextResponse.json({ groups })
  } catch (error) {
    logger.error('Error fetching audio groups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audio groups' },
      { status: 500 }
    )
  }
}
