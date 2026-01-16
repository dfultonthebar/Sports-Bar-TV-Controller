import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, gte, lte, or, inArray } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

// GET - Check if a game is scheduled on any input
// Query params: homeTeam, awayTeam, startTime (ISO), OR espnEventId
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const url = new URL(request.url)
  const homeTeam = url.searchParams.get('homeTeam')
  const awayTeam = url.searchParams.get('awayTeam')
  const startTime = url.searchParams.get('startTime')
  const espnEventId = url.searchParams.get('espnEventId')
  const excludeInputId = url.searchParams.get('excludeInputId') // Exclude current input from results

  try {
    // Find game schedules that match
    let gameScheduleIds: string[] = []

    if (espnEventId) {
      // Direct ESPN event ID lookup
      const game = await db.select().from(schema.gameSchedules)
        .where(eq(schema.gameSchedules.espnEventId, espnEventId))
        .get()
      if (game) {
        gameScheduleIds.push(game.id)
      }
    } else if (homeTeam && awayTeam && startTime) {
      // Find by teams and approximate time
      const startTimeUnix = Math.floor(new Date(startTime).getTime() / 1000)

      const games = await db.select().from(schema.gameSchedules)
        .where(
          and(
            eq(schema.gameSchedules.homeTeamName, homeTeam),
            eq(schema.gameSchedules.awayTeamName, awayTeam),
            gte(schema.gameSchedules.scheduledStart, startTimeUnix - 3600), // Within 1 hour
            lte(schema.gameSchedules.scheduledStart, startTimeUnix + 3600)
          )
        )
        .all()

      gameScheduleIds = games.map(g => g.id)
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either espnEventId or (homeTeam, awayTeam, startTime) required'
      }, { status: 400 })
    }

    if (gameScheduleIds.length === 0) {
      return NextResponse.json({
        success: true,
        isScheduled: false,
        allocations: []
      })
    }

    // Find allocations for these games
    let allocationsQuery = db.select({
      allocation: schema.inputSourceAllocations,
      inputSource: schema.inputSources,
      game: schema.gameSchedules,
    })
    .from(schema.inputSourceAllocations)
    .innerJoin(schema.inputSources, eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id))
    .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
    .where(
      and(
        inArray(schema.inputSourceAllocations.gameScheduleId, gameScheduleIds),
        or(
          eq(schema.inputSourceAllocations.status, 'pending'),
          eq(schema.inputSourceAllocations.status, 'active')
        )
      )
    )

    let results = await allocationsQuery.all()

    // Filter out the current input if specified
    if (excludeInputId) {
      results = results.filter(r => r.inputSource.id !== excludeInputId && r.inputSource.deviceId !== excludeInputId)
    }

    const allocations = results.map(r => ({
      allocationId: r.allocation.id,
      inputLabel: r.inputSource.name,
      inputSourceId: r.inputSource.id,
      deviceId: r.inputSource.deviceId,
      deviceType: r.allocation.inputSourceType,
      channelNumber: r.allocation.channelNumber,
      status: r.allocation.status,
      scheduledBy: r.allocation.scheduledBy,
      tuneAt: new Date((r.allocation.allocatedAt || 0) * 1000).toISOString(),
      gameId: r.game.id,
      homeTeam: r.game.homeTeamName,
      awayTeam: r.game.awayTeamName,
      league: r.game.league,
    }))

    return NextResponse.json({
      success: true,
      isScheduled: allocations.length > 0,
      allocations
    })
  } catch (error: any) {
    logger.error('[BY-GAME] Error checking game allocations:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Bulk check multiple games at once (for channel guide efficiency)
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_READ)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { games, excludeInputId } = body as {
      games: Array<{
        espnEventId?: string
        homeTeam?: string
        awayTeam?: string
        startTime?: string
      }>,
      excludeInputId?: string
    }

    if (!games || !Array.isArray(games)) {
      return NextResponse.json({
        success: false,
        error: 'games array required'
      }, { status: 400 })
    }

    // Get all pending/active allocations with their games
    const allAllocations = await db.select({
      allocation: schema.inputSourceAllocations,
      inputSource: schema.inputSources,
      game: schema.gameSchedules,
    })
    .from(schema.inputSourceAllocations)
    .innerJoin(schema.inputSources, eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id))
    .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
    .where(
      or(
        eq(schema.inputSourceAllocations.status, 'pending'),
        eq(schema.inputSourceAllocations.status, 'active')
      )
    )
    .all()

    // Filter out excluded input
    const filteredAllocations = excludeInputId
      ? allAllocations.filter(r => r.inputSource.id !== excludeInputId && r.inputSource.deviceId !== excludeInputId)
      : allAllocations

    // Match games to allocations
    const results: Record<string, any> = {}

    for (const game of games) {
      let matchingAllocations: typeof filteredAllocations = []

      if (game.espnEventId) {
        matchingAllocations = filteredAllocations.filter(a => a.game.espnEventId === game.espnEventId)
      } else if (game.homeTeam && game.awayTeam && game.startTime) {
        const startTimeUnix = Math.floor(new Date(game.startTime).getTime() / 1000)
        matchingAllocations = filteredAllocations.filter(a =>
          a.game.homeTeamName === game.homeTeam &&
          a.game.awayTeamName === game.awayTeam &&
          Math.abs((a.game.scheduledStart || 0) - startTimeUnix) <= 3600
        )
      }

      const gameKey = game.espnEventId || `${game.homeTeam}-${game.awayTeam}-${game.startTime}`
      results[gameKey] = {
        isScheduled: matchingAllocations.length > 0,
        allocations: matchingAllocations.map(r => ({
          allocationId: r.allocation.id,
          inputLabel: r.inputSource.name,
          inputSourceId: r.inputSource.id,
          deviceType: r.allocation.inputSourceType,
          channelNumber: r.allocation.channelNumber,
          status: r.allocation.status,
          scheduledBy: r.allocation.scheduledBy,
        }))
      }
    }

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error: any) {
    logger.error('[BY-GAME] Error bulk checking game allocations:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
