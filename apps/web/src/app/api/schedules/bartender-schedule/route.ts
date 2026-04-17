import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, or, gte, lte, inArray } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { getExpectedDurationSeconds } from '@/lib/game-duration-stats'
import crypto from 'crypto'

// Schema for creating a bartender schedule
const bartenderScheduleSchema = z.object({
  // Device info
  inputSourceId: z.string().optional(), // If using input_sources table
  deviceId: z.string().optional(), // Direct device ID (IR device, Fire TV, etc.)
  deviceType: z.enum(['cable', 'directv', 'firetv']),
  deviceName: z.string().optional(),

  // Channel info
  channelNumber: z.string(),
  channelName: z.string().optional(),

  // Game info (to find or create game schedule)
  gameInfo: z.object({
    espnEventId: z.string().optional(),
    homeTeam: z.string(),
    awayTeam: z.string(),
    league: z.string(),
    startTime: z.string(), // ISO timestamp
    endTime: z.string().optional(),
  }),

  // When to tune
  tuneAt: z.string(), // ISO timestamp - when to actually tune

  // TV outputs to route this input to (matrix output channel numbers).
  // Optional on POST: the bartender Guide tab flow creates the allocation first
  // and then PATCHes tvOutputIds from a previous allocation on the same device.
  // The AI-suggestion approve flow sends them inline. Either is fine.
  tvOutputIds: z.array(z.number().int().min(0)).optional().default([]),
})

// POST - Create a scheduled channel tune from bartender
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  logger.info('[BARTENDER-SCHEDULE] Creating new scheduled tune')

  const bodyValidation = await validateRequestBody(request, bartenderScheduleSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { deviceId, deviceType, deviceName, channelNumber, channelName, gameInfo, tuneAt, inputSourceId, tvOutputIds } = bodyValidation.data

  try {
    // 1. Find or get an input source
    let inputSource = null

    if (inputSourceId) {
      // Use provided input source
      inputSource = await db.select().from(schema.inputSources).where(eq(schema.inputSources.id, inputSourceId)).get()
    } else if (deviceId) {
      // Find input source by device ID
      inputSource = await db.select().from(schema.inputSources).where(eq(schema.inputSources.deviceId, deviceId)).get()

      // If no input source exists, create one
      if (!inputSource) {
        const newInputSource = {
          id: crypto.randomUUID(),
          name: deviceName || `${deviceType} ${deviceId}`,
          type: deviceType,
          deviceId: deviceId,
          availableNetworks: JSON.stringify([]),
          isActive: true,
          currentlyAllocated: false,
          priorityRank: deviceType === 'cable' ? 80 : deviceType === 'directv' ? 70 : 50,
        }
        await db.insert(schema.inputSources).values(newInputSource)
        inputSource = newInputSource
        logger.info(`[BARTENDER-SCHEDULE] Created new input source: ${newInputSource.id}`)
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Either inputSourceId or deviceId is required' },
        { status: 400 }
      )
    }

    // 2. Find or create game schedule
    const tuneAtUnix = Math.floor(new Date(tuneAt).getTime() / 1000)
    const startTimeUnix = Math.floor(new Date(gameInfo.startTime).getTime() / 1000)
    // endTime derivation order: explicit caller value > learned per-league
    // average from historical durations > 3h fallback. The per-league
    // average comes from `game_schedules.duration_minutes` rows populated
    // by ESPN sync — see apps/web/src/lib/game-duration-stats.ts and
    // CLAUDE.md §9. Before v2.18.3 every sport used the same 3h default,
    // which over-reserved TVs for short sports (NBA ~2h15m, college
    // basketball ~2h) and under-reserved for NFL (~3h30m).
    let endTimeUnix: number
    if (gameInfo.endTime) {
      endTimeUnix = Math.floor(new Date(gameInfo.endTime).getTime() / 1000)
    } else {
      const leagueForDuration = gameInfo.league ?? null
      const { durationSeconds, source, sampleCount } = await getExpectedDurationSeconds(leagueForDuration)
      endTimeUnix = startTimeUnix + durationSeconds
      logger.debug(
        `[BARTENDER-SCHEDULE] endTime defaulted for ${leagueForDuration || 'unknown league'}: ` +
        `${Math.round(durationSeconds / 60)}min (${source}${source === 'learned' ? `, n=${sampleCount}` : ''})`
      )
    }

    let gameSchedule = null

    // Try to find existing game by ESPN ID first
    if (gameInfo.espnEventId) {
      gameSchedule = await db.select().from(schema.gameSchedules)
        .where(eq(schema.gameSchedules.espnEventId, gameInfo.espnEventId))
        .get()
    }

    // If not found, try to find by teams and time window.
    // League is deliberately NOT part of the match criteria because data sources
    // use different labels for the same league: The Rail Media returns "MLB Baseball"
    // while our ESPN sync stores "mlb" (lowercase). Team names + a ±1 hour start
    // time window are unique enough in practice.
    if (!gameSchedule) {
      const results = await db.select().from(schema.gameSchedules)
        .where(
          and(
            eq(schema.gameSchedules.homeTeamName, gameInfo.homeTeam),
            eq(schema.gameSchedules.awayTeamName, gameInfo.awayTeam),
            gte(schema.gameSchedules.scheduledStart, startTimeUnix - 3600),
            lte(schema.gameSchedules.scheduledStart, startTimeUnix + 3600)
          )
        )
        .all()

      if (results.length > 0) {
        gameSchedule = results[0]
      }
    }

    // If still not found, fail explicitly rather than silently creating a phantom game row
    if (!gameSchedule) {
      const gameTime = new Date(gameInfo.startTime).toLocaleString()
      const msg = `No matching game schedule found for ${gameInfo.awayTeam} @ ${gameInfo.homeTeam} at ${gameTime}. The MLB/sports sync may not have imported this game yet.`
      logger.warn(`[BARTENDER-SCHEDULE] ${msg}`)
      return NextResponse.json(
        { success: false, error: msg },
        { status: 404 }
      )
    }

    // 3. Check if there's already a pending allocation for this game on this input
    const existingAllocation = await db.select().from(schema.inputSourceAllocations)
      .where(
        and(
          eq(schema.inputSourceAllocations.inputSourceId, inputSource.id),
          eq(schema.inputSourceAllocations.gameScheduleId, gameSchedule.id),
          eq(schema.inputSourceAllocations.status, 'pending')
        )
      )
      .get()

    if (existingAllocation) {
      logger.info(`[BARTENDER-SCHEDULE] Allocation already exists: ${existingAllocation.id}`)
      return NextResponse.json({
        success: true,
        message: 'Schedule already exists',
        allocationId: existingAllocation.id,
        inputLabel: inputSource.name,
        channelNumber,
        tuneAt,
      })
    }

    // Normalize input source type from the DB record — the caller's `deviceType`
    // claim is unreliable (e.g. AI-suggest approve flow once hardcoded 'cable' for
    // every suggestion). The DB row is the source of truth for what kind of input
    // this is, and downstream scheduler-service dispatches tune calls based on
    // this field. Mismatches cause "Cable box device not found" loops when a
    // DirecTV ID is sent down the cable/IR path.
    const normalizedType = inputSource.type === 'satellite' ? 'directv' : inputSource.type
    const allowedTypes = ['cable', 'directv', 'firetv']
    const resolvedType = allowedTypes.includes(normalizedType) ? normalizedType : deviceType
    if (resolvedType !== deviceType) {
      logger.warn(
        `[BARTENDER-SCHEDULE] Caller claimed deviceType='${deviceType}' but input source ` +
        `${inputSource.name} is type='${inputSource.type}'. Using '${resolvedType}'.`
      )
    }

    // Reject overlapping allocations on the same input — only one game can be
    // live per input at a time. An overlap exists if any pending/active allocation
    // on the same input has a time window that intersects this one.
    const sameInputAllocs = await db.select({
      alloc: schema.inputSourceAllocations,
      game: schema.gameSchedules,
    })
      .from(schema.inputSourceAllocations)
      .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
      .where(
        and(
          eq(schema.inputSourceAllocations.inputSourceId, inputSource.id),
          or(
            eq(schema.inputSourceAllocations.status, 'pending'),
            eq(schema.inputSourceAllocations.status, 'active')
          )
        )
      )
      .all()

    const overlap = sameInputAllocs.find(r =>
      r.alloc.allocatedAt < endTimeUnix && r.alloc.expectedFreeAt > tuneAtUnix
    )
    if (overlap) {
      const msg = `Input ${inputSource.name} already has "${overlap.game.awayTeamName} @ ${overlap.game.homeTeamName}" scheduled during that window`
      logger.warn(`[BARTENDER-SCHEDULE] ${msg}`)
      return NextResponse.json(
        { success: false, error: msg, conflictingAllocationId: overlap.alloc.id },
        { status: 409 }
      )
    }

    // 4. Create the input source allocation
    const allocation = {
      id: crypto.randomUUID(),
      inputSourceId: inputSource.id,
      inputSourceType: resolvedType,
      gameScheduleId: gameSchedule.id,
      channelNumber: channelNumber,
      tvOutputIds: JSON.stringify(tvOutputIds), // Matrix output channel numbers the bartender assigned
      tvCount: tvOutputIds.length,
      allocatedAt: tuneAtUnix, // When to actually tune
      expectedFreeAt: endTimeUnix,
      status: 'pending',
      scheduledBy: 'bartender',
    }

    await db.insert(schema.inputSourceAllocations).values(allocation)

    logger.info(`[BARTENDER-SCHEDULE] Created allocation: ${allocation.id} for ${inputSource.name} to ch ${channelNumber} at ${tuneAt}`)

    return NextResponse.json({
      success: true,
      message: `Scheduled ${inputSource.name || deviceName} to tune to ${channelName || `channel ${channelNumber}`} at ${new Date(tuneAt).toLocaleTimeString()}`,
      allocationId: allocation.id,
      inputLabel: inputSource.name,
      channelNumber,
      tuneAt,
      gameId: gameSchedule.id,
    })
  } catch (error: any) {
    logger.error('[BARTENDER-SCHEDULE] Error creating schedule:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET - List bartender-created schedules
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const url = new URL(request.url)
  const deviceId = url.searchParams.get('deviceId')
  const status = url.searchParams.get('status')

  try {
    // Default: show pending + active (today's full schedule)
    const statusFilter = status
      ? eq(schema.inputSourceAllocations.status, status as string)
      : or(
          eq(schema.inputSourceAllocations.status, 'pending'),
          eq(schema.inputSourceAllocations.status, 'active'),
          eq(schema.inputSourceAllocations.status, 'needs_confirmation')
        )

    let query = db.select({
      allocation: schema.inputSourceAllocations,
      inputSource: schema.inputSources,
      game: schema.gameSchedules,
    })
    .from(schema.inputSourceAllocations)
    .innerJoin(schema.inputSources, eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id))
    .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
    .where(
      and(
        eq(schema.inputSourceAllocations.scheduledBy, 'bartender'),
        statusFilter!
      )
    )

    const results = await query.all()

    const schedules = results.map(r => {
      let tvOutputIds: number[] = []
      try {
        const parsed = JSON.parse(r.allocation.tvOutputIds || '[]')
        tvOutputIds = Array.isArray(parsed) ? parsed : []
      } catch {
        tvOutputIds = []
      }

      let audioZoneIds: number[] = []
      try {
        const parsedZones = JSON.parse(r.allocation.audioZoneIds || '[]')
        audioZoneIds = Array.isArray(parsedZones) ? parsedZones : []
      } catch {
        audioZoneIds = []
      }

      return {
        id: r.allocation.id,
        inputSourceId: r.allocation.inputSourceId,
        inputLabel: r.inputSource.name,
        deviceId: r.inputSource.deviceId || null,
        deviceType: r.allocation.inputSourceType,
        channelNumber: r.allocation.channelNumber,
        gameId: r.allocation.gameScheduleId,
        homeTeam: r.game.homeTeamName,
        awayTeam: r.game.awayTeamName,
        league: r.game.league,
        tuneAt: new Date(r.allocation.allocatedAt * 1000).toISOString(),
        status: r.allocation.status,
        tvOutputIds,
        audioSourceIndex: r.allocation.audioSourceIndex ?? null,
        audioSourceName: r.allocation.audioSourceName ?? null,
        audioZoneIds,
      }
    })

    return NextResponse.json({
      success: true,
      schedules,
    })
  } catch (error: any) {
    logger.error('[BARTENDER-SCHEDULE] Error listing schedules:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Cancel a scheduled tune
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const url = new URL(request.url)
  const allocationId = url.searchParams.get('id')

  if (!allocationId) {
    return NextResponse.json(
      { success: false, error: 'Allocation ID required' },
      { status: 400 }
    )
  }

  try {
    const allocation = await db.select().from(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.id, allocationId))
      .get()

    if (!allocation) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Only allow cancelling pending schedules
    if (allocation.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot cancel schedule with status: ${allocation.status}` },
        { status: 400 }
      )
    }

    await db.update(schema.inputSourceAllocations)
      .set({ status: 'cancelled', updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(schema.inputSourceAllocations.id, allocationId))

    logger.info(`[BARTENDER-SCHEDULE] Cancelled allocation: ${allocationId}`)

    return NextResponse.json({
      success: true,
      message: 'Schedule cancelled',
    })
  } catch (error: any) {
    logger.error('[BARTENDER-SCHEDULE] Error cancelling schedule:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Schema for PATCH - updating TV output assignments and audio routing
const patchScheduleSchema = z.object({
  id: z.string().min(1, 'Allocation ID is required'),
  tvOutputIds: z.array(z.number().int().min(0)).default([]),
  audioSourceIndex: z.number().int().min(0).optional(),
  audioSourceName: z.string().optional(),
  audioZoneIds: z.array(z.number().int().min(0)).optional(),
})

// PATCH - Update TV output assignments for a scheduled allocation
export async function PATCH(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const bodyValidation = await validateRequestBody(request, patchScheduleSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const { id, tvOutputIds, audioSourceIndex, audioSourceName, audioZoneIds } = bodyValidation.data

  try {
    // Verify the allocation exists
    const allocation = await db.select().from(schema.inputSourceAllocations)
      .where(eq(schema.inputSourceAllocations.id, id))
      .get()

    if (!allocation) {
      return NextResponse.json(
        { success: false, error: 'Allocation not found' },
        { status: 404 }
      )
    }

    // Build update payload
    const updateData: Record<string, any> = {
      tvOutputIds: JSON.stringify(tvOutputIds),
      tvCount: tvOutputIds.length,
      updatedAt: Math.floor(Date.now() / 1000),
    }

    if (audioSourceIndex !== undefined) {
      updateData.audioSourceIndex = audioSourceIndex
    }
    if (audioSourceName !== undefined) {
      updateData.audioSourceName = audioSourceName
    }
    if (audioZoneIds !== undefined) {
      updateData.audioZoneIds = JSON.stringify(audioZoneIds)
    }

    await db.update(schema.inputSourceAllocations)
      .set(updateData)
      .where(eq(schema.inputSourceAllocations.id, id))

    logger.info(`[BARTENDER-SCHEDULE] Updated allocation ${id}: TV outputs=${JSON.stringify(tvOutputIds)}${audioSourceIndex !== undefined ? `, audioSource=${audioSourceIndex}` : ''}${audioZoneIds ? `, audioZones=${JSON.stringify(audioZoneIds)}` : ''}`)

    return NextResponse.json({
      success: true,
      message: `Updated allocation`,
      allocationId: id,
      tvOutputIds,
      tvCount: tvOutputIds.length,
      audioSourceIndex: audioSourceIndex ?? null,
      audioSourceName: audioSourceName ?? null,
      audioZoneIds: audioZoneIds ?? null,
    })
  } catch (error: any) {
    logger.error('[BARTENDER-SCHEDULE] Error updating TV outputs:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Helper to get sport from league
function getSportFromLeague(league: string): string {
  const leagueSportMap: Record<string, string> = {
    'nfl': 'football',
    'ncaaf': 'football',
    'cfb': 'football',
    'nba': 'basketball',
    'ncaab': 'basketball',
    'cbb': 'basketball',
    'nhl': 'hockey',
    'mlb': 'baseball',
    'mls': 'soccer',
    'epl': 'soccer',
    'uefa': 'soccer',
    'ncaaw': 'basketball',
  }
  return leagueSportMap[league.toLowerCase()] || 'other'
}
