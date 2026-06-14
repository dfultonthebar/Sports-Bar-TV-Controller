import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { parseHardwareResult } from '@sports-bar/utils'

// GET - Return all allocations with status='needs_confirmation'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const results = await db.select({
      allocation: schema.inputSourceAllocations,
      inputSource: schema.inputSources,
      game: schema.gameSchedules,
    })
    .from(schema.inputSourceAllocations)
    .innerJoin(schema.inputSources, eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id))
    .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
    .where(eq(schema.inputSourceAllocations.status, 'needs_confirmation'))
    .all()

    const pendingRecovery = results.map(r => ({
      id: r.allocation.id,
      inputLabel: r.inputSource.name,
      inputSourceId: r.allocation.inputSourceId,
      inputSourceType: r.allocation.inputSourceType,
      channelNumber: r.allocation.channelNumber,
      homeTeam: r.game.homeTeamName,
      awayTeam: r.game.awayTeamName,
      league: r.game.league,
      scheduledTime: new Date(r.game.scheduledStart * 1000).toISOString(),
    }))

    return NextResponse.json({
      success: true,
      pendingRecovery,
    })
  } catch (error: any) {
    logger.error('[RECOVERY] Error fetching pending recovery items:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Schema for POST - execute or dismiss recovery items
const recoveryActionSchema = z.object({
  allocationId: z.string().min(1, 'Allocation ID is required'),
  action: z.enum(['resume', 'skip']),
})

// POST - Execute or dismiss a recovery item
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const bodyValidation = await validateRequestBody(request, recoveryActionSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { allocationId, action } = bodyValidation.data

  try {
    // Fetch the allocation with its input source and game info
    const result = await db.select({
      allocation: schema.inputSourceAllocations,
      inputSource: schema.inputSources,
      game: schema.gameSchedules,
    })
    .from(schema.inputSourceAllocations)
    .innerJoin(schema.inputSources, eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id))
    .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
    .where(eq(schema.inputSourceAllocations.id, allocationId))
    .get()

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Allocation not found' },
        { status: 404 }
      )
    }

    if (result.allocation.status !== 'needs_confirmation') {
      return NextResponse.json(
        { success: false, error: `Allocation status is '${result.allocation.status}', expected 'needs_confirmation'` },
        { status: 400 }
      )
    }

    if (action === 'skip') {
      // Set status to cancelled
      await db.update(schema.inputSourceAllocations)
        .set({ status: 'cancelled', updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(schema.inputSourceAllocations.id, allocationId))

      logger.info(`[RECOVERY] Skipped recovery for allocation ${allocationId} (${result.inputSource.name} ch ${result.allocation.channelNumber})`)

      return NextResponse.json({
        success: true,
        message: `Skipped recovery for ${result.inputSource.name}`,
      })
    }

    // action === 'resume'
    // Call the tune API to resume the channel
    const tunePayload: Record<string, string> = {
      channelNumber: result.allocation.channelNumber || '',
      deviceType: result.allocation.inputSourceType,
    }

    // Include the device ID from input source if available
    if (result.inputSource.deviceId) {
      if (result.allocation.inputSourceType === 'cable') {
        tunePayload.cableBoxId = result.inputSource.deviceId
      } else if (result.allocation.inputSourceType === 'directv') {
        tunePayload.directTVId = result.inputSource.deviceId
      }
    }

    logger.info(`[RECOVERY] Resuming allocation ${allocationId}: ${result.inputSource.name} to ch ${result.allocation.channelNumber}`)

    const tuneResponse = await fetch('http://localhost:3001/api/channel-presets/tune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tunePayload),
    })

    // OR-gate guard: the tune route returns HTTP 200 with {success:false} on a
    // soft failure (e.g. cable box offline). A raw `!tuneResponse.ok` check would
    // treat that as success and flip the allocation to 'active' — the operator
    // sees "resumed" and takes no action while the TV never moved. parseHardwareResult
    // consumes the body internally (Gotcha #1) and treats malformedOk as a FAILURE.
    const tuneHw = await parseHardwareResult(tuneResponse)

    if (!tuneHw.ok) {
      logger.error(`[RECOVERY] Tune failed for allocation ${allocationId}:`, tuneHw.error)
      return NextResponse.json(
        { success: false, error: `Tune failed: ${tuneHw.error || 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Set status to active — only when tuneHw.ok === true
    await db.update(schema.inputSourceAllocations)
      .set({ status: 'active', updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(schema.inputSourceAllocations.id, allocationId))

    logger.info(`[RECOVERY] Successfully resumed allocation ${allocationId}: ${result.inputSource.name} to ch ${result.allocation.channelNumber}`)

    return NextResponse.json({
      success: true,
      message: `Resumed ${result.inputSource.name} on channel ${result.allocation.channelNumber}`,
      tuneResult: tuneHw.body,
    })
  } catch (error: any) {
    logger.error('[RECOVERY] Error processing recovery action:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
