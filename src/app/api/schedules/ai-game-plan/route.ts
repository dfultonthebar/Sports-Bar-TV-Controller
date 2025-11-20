/**
 * API Route: Get AI Scheduler's Game Plan
 *
 * Returns the games that the AI scheduler found and which inputs/TVs they're scheduled for
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@/lib/logger'
import { espnScoreboardAPI } from '@/lib/sports-apis/espn-scoreboard-api'

// Map league names to ESPN API parameters
function mapLeagueToESPN(league: string): { sport: string; league: string } | null {
  const leagueLower = league.toLowerCase()

  if (leagueLower.includes('nfl')) return { sport: 'football', league: 'nfl' }
  if (leagueLower.includes('ncaa football') || leagueLower.includes('college football'))
    return { sport: 'football', league: 'college-football' }

  if (leagueLower.includes('nba')) return { sport: 'basketball', league: 'nba' }
  if (leagueLower.includes('ncaa basketball') || leagueLower.includes('college basketball')) {
    if (leagueLower.includes("women")) return { sport: 'basketball', league: 'womens-college-basketball' }
    return { sport: 'basketball', league: 'mens-college-basketball' }
  }

  if (leagueLower.includes('nhl')) return { sport: 'hockey', league: 'nhl' }
  if (leagueLower.includes('mlb') || leagueLower.includes('baseball')) return { sport: 'baseball', league: 'mlb' }
  if (leagueLower.includes('mls') || leagueLower.includes('soccer')) return { sport: 'soccer', league: 'usa.1' }

  return null
}

// Match game by team names (fuzzy matching)
function matchGameByTeams(espnGames: any[], homeTeam: string, awayTeam: string): any | null {
  const cleanTeam = (name: string) => {
    // Remove common prefixes like "NCAA:", "NFL:", "NBA:", etc.
    let cleaned = name.replace(/^(NCAA|NFL|NBA|NHL|MLB|MLS):\s*/i, '')
    // Convert to lowercase and remove all non-alphanumeric characters
    return cleaned.toLowerCase().replace(/[^a-z0-9]/g, '')
  }
  const homeClean = cleanTeam(homeTeam)
  const awayClean = cleanTeam(awayTeam)

  for (const espnGame of espnGames) {
    const espnHomeClean = cleanTeam(espnGame.homeTeam.displayName)
    const espnAwayClean = cleanTeam(espnGame.awayTeam.displayName)

    // Check if teams match (in either order since sometimes home/away can be swapped)
    const exactMatch = (
      (espnHomeClean.includes(homeClean) || homeClean.includes(espnHomeClean)) &&
      (espnAwayClean.includes(awayClean) || awayClean.includes(espnAwayClean))
    ) || (
      (espnHomeClean.includes(awayClean) || awayClean.includes(espnHomeClean)) &&
      (espnAwayClean.includes(homeClean) || homeClean.includes(espnAwayClean))
    )

    if (exactMatch) {
      return espnGame
    }
  }

  return null
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Get the AI Game Monitor schedule
    const aiSchedule = await db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.scheduleType, 'continuous'))
      .limit(1)
      .get()

    if (!aiSchedule) {
      return NextResponse.json({
        success: false,
        error: 'AI Game Monitor schedule not found'
      }, { status: 404 })
    }

    // Parse the last result
    let lastResult: any = null
    if (aiSchedule.lastResult) {
      try {
        lastResult = JSON.parse(aiSchedule.lastResult)
      } catch (e) {
        logger.error('[AI_GAME_PLAN] Failed to parse lastResult:', e)
      }
    }

    // Get matrix inputs
    const inputs = await db.select().from(schema.matrixInputs).all()

    // Get ACTUAL device states (what's currently playing on each input)
    const cableBoxes = await db.select().from(schema.cableBoxes).all()

    // Create a map of input ID to current game/program
    const inputGameMap = new Map<string, any>()

    // Process cable boxes
    for (const box of cableBoxes) {
      if (box.currentProgram) {
        try {
          const program = JSON.parse(box.currentProgram)

          // Match cable box to matrix input by name
          const input = inputs.find(i => i.label === box.name)

          if (input && program.league) {
            inputGameMap.set(input.id, {
              inputLabel: input.label || box.name,
              inputNumber: input.channelNumber,
              league: program.league,
              homeTeam: program.homeTeam,
              awayTeam: program.awayTeam,
              gameTime: program.time,
              channelNumber: box.lastChannel,
              venue: program.venue,
              isHomeTeamGame: false // We'll check this against home teams
            })
          }
        } catch (e) {
          logger.debug('[AI_GAME_PLAN] Failed to parse currentProgram for', box.name)
        }
      }
    }

    // Fetch live ESPN data for all games
    logger.info('[AI_GAME_PLAN] Fetching live ESPN data for assigned games')
    const espnDataByLeague = new Map<string, any[]>()

    // Group games by league and fetch ESPN data
    const leaguesInUse = new Set<string>()
    for (const [_, gameData] of inputGameMap.entries()) {
      leaguesInUse.add(gameData.league)
    }

    // Fetch ESPN data for each league
    for (const league of leaguesInUse) {
      const espnMapping = mapLeagueToESPN(league)
      if (espnMapping) {
        try {
          const espnGames = await espnScoreboardAPI.getTodaysGames(espnMapping.sport, espnMapping.league)
          logger.info(`[AI_GAME_PLAN] Fetched ${espnGames.length} ESPN games for ${league}`)
          espnDataByLeague.set(league, espnGames)
        } catch (error: any) {
          logger.error(`[AI_GAME_PLAN] Failed to fetch ESPN data for ${league}:`, error.message)
        }
      }
    }

    // Get home teams from lastResult to mark which games are home team games
    const allGamesFromResult = lastResult?.details?.games || lastResult?.games || []
    const homeTeamGameIds = new Set(
      allGamesFromResult
        .filter((g: any) => g.isHomeTeamGame)
        .map((g: any) => `${g.homeTeam}-${g.awayTeam}`)
    )

    // Group games by input and enrich with ESPN live data
    const gamesByInput: Record<string, any[]> = {}
    const games: any[] = []

    for (const [inputId, gameData] of inputGameMap.entries()) {
      const gameId = `${gameData.homeTeam}-${gameData.awayTeam}`
      const isHomeTeamGame = homeTeamGameIds.has(gameId)

      // Try to find matching ESPN game for live data
      let liveData = null
      const espnGames = espnDataByLeague.get(gameData.league)
      if (espnGames) {
        const matchedGame = matchGameByTeams(espnGames, gameData.homeTeam, gameData.awayTeam)
        if (matchedGame) {
          liveData = {
            homeScore: matchedGame.homeTeam.score,
            awayScore: matchedGame.awayTeam.score,
            clock: matchedGame.status.displayClock,
            period: matchedGame.status.period,
            statusState: matchedGame.status.type.state, // 'pre', 'in', 'post'
            statusDetail: matchedGame.status.type.shortDetail,
            isLive: espnScoreboardAPI.isLive(matchedGame),
            isCompleted: espnScoreboardAPI.isCompleted(matchedGame),
          }
          logger.debug(`[AI_GAME_PLAN] Matched ESPN data for ${gameData.homeTeam} vs ${gameData.awayTeam}`)
        }
      }

      const game = {
        ...gameData,
        isHomeTeamGame,
        startTime: null, // We don't have exact start time from cable box data
        liveData, // Add live ESPN data if available
      }

      games.push(game)

      if (!gamesByInput[gameData.inputLabel]) {
        gamesByInput[gameData.inputLabel] = []
      }
      gamesByInput[gameData.inputLabel].push(game)
    }

    // Get upcoming games from lastResult that aren't currently assigned
    const assignedGameIds = new Set(games.map(g => `${g.homeTeam}-${g.awayTeam}`))
    const upcomingGames = allGamesFromResult
      .filter((g: any) => !assignedGameIds.has(`${g.homeTeam}-${g.awayTeam}`))
      .map((g: any) => ({
        ...g,
        liveData: null // Could enrich with ESPN data later if needed
      }))
      .sort((a: any, b: any) => {
        // Sort by start time if available, otherwise by league
        if (a.startTime && b.startTime) {
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        }
        return (a.league || '').localeCompare(b.league || '')
      })

    return NextResponse.json({
      success: true,
      scheduleName: aiSchedule.name,
      lastExecuted: aiSchedule.lastExecuted,
      gamesFound: lastResult?.gamesFound || 0,
      channelsSet: lastResult?.channelsSet || 0,
      games,
      gamesByInput,
      upcomingGames,
      summary: {
        totalGames: allGamesFromResult.length,
        homeTeamGames: allGamesFromResult.filter((g: any) => g.isHomeTeamGame).length,
        inputsWithGames: Object.keys(gamesByInput).length,
        upcomingCount: upcomingGames.length,
        leagues: [...new Set(allGamesFromResult.map((g: any) => g.league))].filter(Boolean)
      }
    })

  } catch (error: any) {
    logger.error('[AI_GAME_PLAN] Error getting AI game plan:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to get AI game plan',
      details: error.message
    }, { status: 500 })
  }
}
