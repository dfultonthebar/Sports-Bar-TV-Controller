/**
 * Tournament Brackets API Endpoint
 *
 * Provides tournament bracket data for playoffs and tournaments
 * GET - Fetch tournament brackets with games organized by round
 * POST - Create or update tournament bracket data
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateQueryParams, validateRequestBody, z } from '@/lib/validation'
import { logger } from '@/lib/logger'

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const getTournamentsQuerySchema = z.object({
  league: z.string().optional(),
  sport: z.string().optional(),
  status: z.enum(['upcoming', 'in_progress', 'completed']).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
})

const createTournamentBracketSchema = z.object({
  espnTournamentId: z.string().optional(),
  tournamentName: z.string().min(1),
  shortName: z.string().optional(),
  seasonYear: z.number().int().min(2000).max(2100),
  sport: z.string().min(1),
  league: z.string().min(1),
  totalTeams: z.number().int().positive().optional(),
  totalRounds: z.number().int().positive().optional(),
  currentRound: z.number().int().positive().optional(),
  roundName: z.string().optional(),
  regions: z.array(z.string()).optional(),
  tournamentStart: z.number().int().optional(),
  tournamentEnd: z.number().int().optional(),
  status: z.enum(['upcoming', 'in_progress', 'completed']).optional().default('upcoming'),
})

// ============================================================================
// GET HANDLER - Fetch Tournament Brackets
// ============================================================================

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  // Validate query parameters
  const queryValidation = validateQueryParams(request, getTournamentsQuerySchema)
  if (!queryValidation.success) return queryValidation.error

  const { league, sport, status, year, limit } = queryValidation.data

  try {
    // Build WHERE conditions
    const conditions = []

    if (league) {
      conditions.push(eq(schema.tournamentBrackets.league, league))
    }
    if (sport) {
      conditions.push(eq(schema.tournamentBrackets.sport, sport))
    }
    if (status) {
      conditions.push(eq(schema.tournamentBrackets.status, status))
    }
    if (year) {
      conditions.push(eq(schema.tournamentBrackets.seasonYear, year))
    }

    // Fetch tournament brackets
    const brackets = await db
      .select()
      .from(schema.tournamentBrackets)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.tournamentBrackets.tournamentStart))
      .limit(limit)

    // For each bracket, fetch associated games from gameSchedules
    const tournamentsWithGames = await Promise.all(
      brackets.map(async (bracket) => {
        // Fetch playoff games for this tournament
        const games = await db
          .select()
          .from(schema.gameSchedules)
          .where(
            and(
              eq(schema.gameSchedules.league, bracket.league),
              eq(schema.gameSchedules.seasonYear, bracket.seasonYear),
              eq(schema.gameSchedules.seasonType, 3), // Playoff games
              bracket.tournamentStart
                ? gte(schema.gameSchedules.scheduledStart, bracket.tournamentStart)
                : undefined,
              bracket.tournamentEnd
                ? lte(schema.gameSchedules.scheduledStart, bracket.tournamentEnd)
                : undefined
            )
          )
          .orderBy(schema.gameSchedules.scheduledStart)

        // Group games by playoff round
        const gamesByRound: Record<string, any[]> = {}
        games.forEach((game) => {
          const round = game.playoffRound || game.weekText || 'Unknown Round'
          if (!gamesByRound[round]) {
            gamesByRound[round] = []
          }
          gamesByRound[round].push(game)
        })

        // Update bracket statistics based on actual games
        const gamesScheduled = games.filter((g) => g.status === 'scheduled').length
        const gamesInProgress = games.filter((g) =>
          ['in_progress', 'halftime'].includes(g.status)
        ).length
        const gamesCompleted = games.filter((g) => g.status === 'final').length

        // Update bracket if stats changed
        if (
          bracket.totalGames !== games.length ||
          bracket.gamesScheduled !== gamesScheduled ||
          bracket.gamesInProgress !== gamesInProgress ||
          bracket.gamesCompleted !== gamesCompleted
        ) {
          await db
            .update(schema.tournamentBrackets)
            .set({
              totalGames: games.length,
              gamesScheduled,
              gamesInProgress,
              gamesCompleted,
              updated_at: sql`(strftime('%s', 'now'))`,
            })
            .where(eq(schema.tournamentBrackets.id, bracket.id))
        }

        return {
          bracket: {
            ...bracket,
            totalGames: games.length,
            gamesScheduled,
            gamesInProgress,
            gamesCompleted,
          },
          games,
          gamesByRound,
        }
      })
    )

    logger.info(`[TOURNAMENTS] Fetched ${brackets.length} tournament brackets`, {
      league,
      sport,
      status,
      year,
    })

    return NextResponse.json({
      success: true,
      tournaments: tournamentsWithGames,
      count: brackets.length,
    })
  } catch (error: any) {
    logger.error('[TOURNAMENTS] Failed to fetch tournament brackets:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tournament brackets',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST HANDLER - Create/Update Tournament Bracket
// ============================================================================

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  // Validate request body
  const bodyValidation = await validateRequestBody(request, createTournamentBracketSchema)
  if (!bodyValidation.success) return bodyValidation.error

  const data = bodyValidation.data

  try {
    // Check if tournament already exists (by ESPN ID or by league+year+name)
    let existingBracket = null

    if (data.espnTournamentId) {
      existingBracket = await db
        .select()
        .from(schema.tournamentBrackets)
        .where(eq(schema.tournamentBrackets.espnTournamentId, data.espnTournamentId))
        .limit(1)
        .then((rows) => rows[0])
    }

    if (!existingBracket) {
      existingBracket = await db
        .select()
        .from(schema.tournamentBrackets)
        .where(
          and(
            eq(schema.tournamentBrackets.league, data.league),
            eq(schema.tournamentBrackets.seasonYear, data.seasonYear),
            eq(schema.tournamentBrackets.tournamentName, data.tournamentName)
          )
        )
        .limit(1)
        .then((rows) => rows[0])
    }

    // Prepare bracket data
    const bracketData = {
      espnTournamentId: data.espnTournamentId || null,
      tournamentName: data.tournamentName,
      shortName: data.shortName || null,
      seasonYear: data.seasonYear,
      sport: data.sport,
      league: data.league,
      totalTeams: data.totalTeams || null,
      totalRounds: data.totalRounds || null,
      currentRound: data.currentRound || null,
      roundName: data.roundName || null,
      regions: data.regions ? JSON.stringify(data.regions) : null,
      tournamentStart: data.tournamentStart || null,
      tournamentEnd: data.tournamentEnd || null,
      status: data.status || 'upcoming',
      lastSynced: sql`(strftime('%s', 'now'))`,
      updated_at: sql`(strftime('%s', 'now'))`,
    }

    let bracket

    if (existingBracket) {
      // Update existing bracket
      await db
        .update(schema.tournamentBrackets)
        .set(bracketData)
        .where(eq(schema.tournamentBrackets.id, existingBracket.id))

      bracket = {
        ...existingBracket,
        ...bracketData,
      }

      logger.info('[TOURNAMENTS] Updated tournament bracket', {
        bracketId: existingBracket.id,
        tournamentName: data.tournamentName,
      })
    } else {
      // Create new bracket
      const result = await db
        .insert(schema.tournamentBrackets)
        .values({
          ...bracketData,
          created_at: sql`(strftime('%s', 'now'))`,
        })
        .returning()

      bracket = result[0]

      logger.info('[TOURNAMENTS] Created new tournament bracket', {
        bracketId: bracket.id,
        tournamentName: data.tournamentName,
      })
    }

    return NextResponse.json({
      success: true,
      bracket,
      created: !existingBracket,
    })
  } catch (error: any) {
    logger.error('[TOURNAMENTS] Failed to create/update tournament bracket:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create/update tournament bracket',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
