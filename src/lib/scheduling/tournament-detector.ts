/**
 * Tournament Detector
 * Automatically detects playoff/tournament games from ESPN data
 * and creates tournament bracket structures
 */

import { db } from '@/db';
import { schema } from '@/db';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface DetectedTournament {
  league: string;
  sport: string;
  seasonType: number;
  year: number;
  tournamentName: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  startDate: number;
  endDate?: number;
  gameCount: number;
}

class TournamentDetector {
  /**
   * Detect all active tournaments/playoffs
   */
  async detectTournaments(): Promise<DetectedTournament[]> {
    logger.info('[TOURNAMENT-DETECTOR] Scanning for tournaments...');

    // Get all playoff games grouped by league
    const playoffGames = await db
      .select()
      .from(schema.gameSchedules)
      .where(eq(schema.gameSchedules.seasonType, 3)); // seasonType 3 = playoffs

    logger.debug(`[TOURNAMENT-DETECTOR] Found ${playoffGames.length} playoff games`);

    // Group by league and year
    const tournaments = new Map<string, DetectedTournament>();

    for (const game of playoffGames) {
      const gameDate = new Date(game.scheduledStart * 1000);
      const year = gameDate.getFullYear();
      const key = `${game.league}-${year}`;

      if (!tournaments.has(key)) {
        tournaments.set(key, {
          league: game.league,
          sport: game.sport,
          seasonType: 3,
          year,
          tournamentName: this.generateTournamentName(game.league, year),
          status: this.determineStatus(game.status),
          startDate: game.scheduledStart,
          endDate: game.estimatedEnd,
          gameCount: 1,
        });
      } else {
        const tournament = tournaments.get(key)!;
        tournament.gameCount++;

        // Update date range
        if (game.scheduledStart < tournament.startDate) {
          tournament.startDate = game.scheduledStart;
        }
        if (game.estimatedEnd && (!tournament.endDate || game.estimatedEnd > tournament.endDate)) {
          tournament.endDate = game.estimatedEnd;
        }

        // Update status based on game status
        const gameStatus = this.determineStatus(game.status);
        if (gameStatus === 'in_progress' || tournament.status === 'in_progress') {
          tournament.status = 'in_progress';
        } else if (gameStatus === 'completed' && tournament.status !== 'in_progress') {
          tournament.status = 'completed';
        }
      }
    }

    const detected = Array.from(tournaments.values());
    logger.info(`[TOURNAMENT-DETECTOR] Detected ${detected.length} tournaments`);

    return detected;
  }

  /**
   * Auto-create tournament brackets for detected playoffs
   */
  async autoCreateBrackets(): Promise<string[]> {
    logger.info('[TOURNAMENT-DETECTOR] Auto-creating tournament brackets...');

    const detected = await this.detectTournaments();
    const created: string[] = [];

    for (const tournament of detected) {
      // Check if tournament already exists
      const existing = await db
        .select()
        .from(schema.tournamentBrackets)
        .where(
          and(
            eq(schema.tournamentBrackets.league, tournament.league),
            eq(schema.tournamentBrackets.seasonYear, tournament.year)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        logger.debug(`[TOURNAMENT-DETECTOR] Tournament already exists: ${tournament.tournamentName}`);
        continue;
      }

      // Create new tournament bracket
      const bracketId = crypto.randomUUID();
      await db.insert(schema.tournamentBrackets).values({
        id: bracketId,
        league: tournament.league,
        sport: tournament.sport,
        seasonYear: tournament.year,
        tournamentName: tournament.tournamentName,
        status: tournament.status,
        tournamentStart: tournament.startDate,
        tournamentEnd: tournament.endDate || null,
        bracketStructure: JSON.stringify({
          rounds: this.detectRounds(tournament.league),
          matchups: [],
        }),
        totalGames: tournament.gameCount,
        gamesScheduled: tournament.gameCount,
        gamesInProgress: 0,
        gamesCompleted: 0,
      });

      created.push(bracketId);
      logger.info(`[TOURNAMENT-DETECTOR] Created tournament bracket: ${tournament.tournamentName}`);
    }

    logger.info(`[TOURNAMENT-DETECTOR] Created ${created.length} new tournament brackets`);
    return created;
  }

  /**
   * Update existing tournament brackets with game data
   */
  async updateBrackets(): Promise<number> {
    logger.info('[TOURNAMENT-DETECTOR] Updating tournament brackets...');

    const tournaments = await db.select().from(schema.tournamentBrackets);
    let updated = 0;

    for (const tournament of tournaments) {
      // Get playoff games for this tournament
      const games = await db
        .select()
        .from(schema.gameSchedules)
        .where(
          and(
            eq(schema.gameSchedules.league, tournament.league),
            eq(schema.gameSchedules.seasonType, 3)
          )
        );

      if (games.length === 0) continue;

      // Group games by playoff round
      const roundsMap = new Map<string, any[]>();
      for (const game of games) {
        const round = game.playoffRound || 'Unknown';
        if (!roundsMap.has(round)) {
          roundsMap.set(round, []);
        }
        roundsMap.get(round)!.push({
          gameId: game.id,
          homeTeam: game.homeTeamName,
          awayTeam: game.awayTeamName,
          homeScore: game.homeScore,
          awayScore: game.awayScore,
          status: game.status,
          scheduledStart: game.scheduledStart,
        });
      }

      // Update bracket structure
      const rounds = Array.from(roundsMap.entries()).map(([name, matchups]) => ({
        name,
        matchups,
      }));

      await db
        .update(schema.tournamentBrackets)
        .set({
          bracketStructure: JSON.stringify({ rounds }),
          gamesScheduled: games.length,
          gamesInProgress: games.filter(g => g.status === 'in_progress').length,
          gamesCompleted: games.filter(g => g.status === 'completed').length,
        })
        .where(eq(schema.tournamentBrackets.id, tournament.id));

      updated++;
    }

    logger.info(`[TOURNAMENT-DETECTOR] Updated ${updated} tournament brackets`);
    return updated;
  }

  /**
   * Generate tournament name based on league and year
   */
  private generateTournamentName(league: string, year: number): string {
    const names: Record<string, string> = {
      'nba': `NBA Playoffs ${year}`,
      'nfl': `NFL Playoffs ${year}`,
      'mlb': `MLB Playoffs ${year}`,
      'nhl': `NHL Playoffs ${year}`,
      'college-football': `College Football Playoff ${year}`,
      'mens-college-basketball': `March Madness ${year}`,
      'womens-college-basketball': `Women\'s March Madness ${year}`,
    };

    return names[league] || `${league.toUpperCase()} Playoffs ${year}`;
  }

  /**
   * Determine tournament status from game status
   */
  private determineStatus(gameStatus: string): 'upcoming' | 'in_progress' | 'completed' {
    if (gameStatus === 'scheduled') return 'upcoming';
    if (gameStatus === 'in_progress' || gameStatus === 'halftime') return 'in_progress';
    return 'completed';
  }

  /**
   * Detect round structure for league
   */
  private detectRounds(league: string): string[] {
    const structures: Record<string, string[]> = {
      'nba': ['First Round', 'Conference Semifinals', 'Conference Finals', 'NBA Finals'],
      'nfl': ['Wild Card', 'Divisional', 'Conference Championship', 'Super Bowl'],
      'nhl': ['First Round', 'Second Round', 'Conference Finals', 'Stanley Cup Finals'],
      'mlb': ['Wild Card', 'Division Series', 'Championship Series', 'World Series'],
      'mens-college-basketball': ['First Four', 'First Round', 'Second Round', 'Sweet 16', 'Elite 8', 'Final Four', 'Championship'],
    };

    return structures[league] || ['Round 1', 'Round 2', 'Semifinals', 'Finals'];
  }
}

export const tournamentDetector = new TournamentDetector();
