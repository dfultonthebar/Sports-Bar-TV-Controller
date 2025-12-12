/**
 * Live Game Status API
 * Returns current allocations with live game data (scores, time remaining)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { schema } from '@/db';
import { eq, and, gte, lte } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { espnScoreboardAPI } from '@/lib/sports-apis/espn-scoreboard-api';

interface LiveGameData {
  gameId: string;
  espnGameId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  timeRemaining: string | null;
  quarter: string | null;
  isLive: boolean;
  scheduledStart: number;
  channel: string | null;
  inputSource: string | null;
  inputLabel: string | null;
  isAutoScheduled: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const liveGames: LiveGameData[] = [];

    // NOTE: gameAllocations table doesn't exist - commenting out for now
    // The AI scheduler uses CableBox.currentProgram instead

    // ALSO FETCH AI SCHEDULER GAMES (from cable boxes)
    const cableBoxes = await db.select().from(schema.cableBoxes)

    for (const box of cableBoxes) {
      if (box.currentProgram) {
        try {
          const program = JSON.parse(box.currentProgram)

          if (program.league && program.homeTeam && program.awayTeam) {
            // Map league to ESPN parameters
            const espnMapping = mapLeagueToESPN(program.league)

            if (espnMapping) {
              // Fetch ESPN data for this league
              try {
                const espnGames = await espnScoreboardAPI.getTodaysGames(espnMapping.sport, espnMapping.league)

                // Find matching game
                const matchedGame = matchGameByTeams(espnGames, program.homeTeam, program.awayTeam)

                if (matchedGame) {
                  const espnData = {
                    homeScore: matchedGame.homeTeam.score,
                    awayScore: matchedGame.awayTeam.score,
                    timeRemaining: matchedGame.status.displayClock,
                    quarter: matchedGame.status.period ? `Q${matchedGame.status.period}` : null,
                    isLive: espnScoreboardAPI.isLive(matchedGame),
                    status: matchedGame.status.type.shortDetail,
                  }

                  // Get input label from matrix inputs
                  const input = await db
                    .select()
                    .from(schema.matrixInputs)
                    .where(eq(schema.matrixInputs.id, box.matrixInputId || ''))
                    .limit(1)
                    .get()

                  liveGames.push({
                    gameId: `ai-${box.id}`,
                    espnGameId: matchedGame.id || '',
                    homeTeam: program.homeTeam,
                    awayTeam: program.awayTeam,
                    league: program.league,
                    status: espnData.status,
                    homeScore: espnData.homeScore,
                    awayScore: espnData.awayScore,
                    timeRemaining: espnData.timeRemaining,
                    quarter: espnData.quarter,
                    isLive: espnData.isLive,
                    scheduledStart: program.startTime ? Math.floor(new Date(program.startTime).getTime() / 1000) : 0,
                    channel: box.lastChannel || null,
                    inputSource: box.matrixInputId,
                    inputLabel: input?.label || box.name,
                    isAutoScheduled: true,
                  })
                }
              } catch (error: any) {
                logger.debug(`[LIVE-STATUS] Failed to fetch ESPN data for ${program.league}:`, error.message)
              }
            }
          }
        } catch (e) {
          // Ignore parse errors for invalid currentProgram data
        }
      }
    }

    return NextResponse.json({
      success: true,
      games: liveGames,
      count: liveGames.length,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    logger.error('[LIVE-STATUS] Error fetching live game status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch live game status',
      },
      { status: 500 }
    );
  }
}

// Helper function: Map league names to ESPN API parameters
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

// Helper function: Match game by team names (fuzzy matching)
function matchGameByTeams(espnGames: any[], homeTeam: string, awayTeam: string): any | null {
  const cleanTeam = (name: string) => {
    // Remove common prefixes like "NCAA:", "NFL:", "NBA:", etc.
    let cleaned = name.replace(/^(NCAA|NFL|NBA|NHL|MLB|MLS):\\s*/i, '')
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
