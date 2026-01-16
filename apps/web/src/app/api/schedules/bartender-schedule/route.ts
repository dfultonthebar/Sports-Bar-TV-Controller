import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, gte, lte } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
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

  const { deviceId, deviceType, deviceName, channelNumber, channelName, gameInfo, tuneAt, inputSourceId } = bodyValidation.data

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
    const endTimeUnix = gameInfo.endTime
      ? Math.floor(new Date(gameInfo.endTime).getTime() / 1000)
      : startTimeUnix + (3 * 60 * 60) // Default 3 hour game

    let gameSchedule = null

    // Try to find existing game by ESPN ID first
    if (gameInfo.espnEventId) {
      gameSchedule = await db.select().from(schema.gameSchedules)
        .where(eq(schema.gameSchedules.espnEventId, gameInfo.espnEventId))
        .get()
    }

    // If not found, try to find by teams and time
    if (!gameSchedule) {
      const results = await db.select().from(schema.gameSchedules)
        .where(
          and(
            eq(schema.gameSchedules.homeTeamName, gameInfo.homeTeam),
            eq(schema.gameSchedules.awayTeamName, gameInfo.awayTeam),
            eq(schema.gameSchedules.league, gameInfo.league),
            gte(schema.gameSchedules.scheduledStart, startTimeUnix - 3600), // Within 1 hour
            lte(schema.gameSchedules.scheduledStart, startTimeUnix + 3600)
          )
        )
        .all()

      if (results.length > 0) {
        gameSchedule = results[0]
      }
    }

    // Create game schedule if not found
    if (!gameSchedule) {
      const newGameSchedule = {
        id: crypto.randomUUID(),
        espnEventId: gameInfo.espnEventId || `bartender-${Date.now()}`,
        espnCompetitionId: gameInfo.espnEventId || `bartender-${Date.now()}`,
        sport: getSportFromLeague(gameInfo.league),
        league: gameInfo.league,
        homeTeamEspnId: 'unknown',
        awayTeamEspnId: 'unknown',
        homeTeamName: gameInfo.homeTeam,
        awayTeamName: gameInfo.awayTeam,
        scheduledStart: startTimeUnix,
        estimatedEnd: endTimeUnix,
        status: 'scheduled',
        seasonType: 2, // Regular season
        seasonYear: new Date().getFullYear(),
        primaryNetwork: channelName || null,
      }
      await db.insert(schema.gameSchedules).values(newGameSchedule)
      gameSchedule = newGameSchedule
      logger.info(`[BARTENDER-SCHEDULE] Created new game schedule: ${newGameSchedule.id}`)
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

    // 4. Create the input source allocation
    const allocation = {
      id: crypto.randomUUID(),
      inputSourceId: inputSource.id,
      inputSourceType: deviceType,
      gameScheduleId: gameSchedule.id,
      channelNumber: channelNumber,
      tvOutputIds: JSON.stringify([]), // Bartender doesn't specify outputs, they pick the input
      tvCount: 0,
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
  const status = url.searchParams.get('status') || 'pending'

  try {
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
        eq(schema.inputSourceAllocations.status, status as 'pending' | 'active' | 'completed' | 'preempted' | 'cancelled')
      )
    )

    const results = await query.all()

    const schedules = results.map(r => ({
      id: r.allocation.id,
      inputSourceId: r.allocation.inputSourceId,
      inputLabel: r.inputSource.name,
      deviceType: r.allocation.inputSourceType,
      channelNumber: r.allocation.channelNumber,
      gameId: r.allocation.gameScheduleId,
      homeTeam: r.game.homeTeamName,
      awayTeam: r.game.awayTeamName,
      league: r.game.league,
      tuneAt: new Date(r.allocation.allocatedAt * 1000).toISOString(),
      status: r.allocation.status,
    }))

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
