/**
 * Game Priority Calculator
 * Calculates priority scores for games based on:
 * - Priority teams (home teams in database)
 * - Playoff/tournament games
 * - League importance
 * - Game timing
 */

import { db } from '@/db';
import { schema } from '@/db';
import { eq, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface PriorityFactors {
  baseScore: number;
  priorityTeamBonus: number;
  playoffBonus: number;
  leagueMultiplier: number;
  timingBonus: number;
  totalScore: number;
  breakdown: string[];
}

export interface PriorityConfig {
  // Base scores by league tier
  leagueTiers: Record<string, number>;

  // Bonus points
  priorityTeamBonus: number;
  playoffBonus: number;
  championshipBonus: number;
  primeTimeBonus: number;

  // Priority thresholds
  priorityThreshold: number; // Games above this are "priority games"
}

const DEFAULT_CONFIG: PriorityConfig = {
  leagueTiers: {
    // Professional leagues
    'nfl': 100,
    'nba': 90,
    'mlb': 85,
    'nhl': 80,
    'mls': 70,
    'wnba': 75,

    // College football
    'college-football': 80,

    // College basketball
    'mens-college-basketball': 75,
    'womens-college-basketball': 70,
    'mens-college-basketball-horizon': 75,

    // College baseball
    'college-baseball': 70,

    // College soccer
    'mens-college-soccer': 65,
    'womens-college-soccer': 65,

    // Other sports
    'womens-college-volleyball': 65,
    'college-softball': 65,
  },

  priorityTeamBonus: 500, // Huge bonus for priority teams
  playoffBonus: 200,
  championshipBonus: 500,
  primeTimeBonus: 50,

  priorityThreshold: 500, // Games with score >= 500 are priority games
};

class PriorityCalculator {
  private config: PriorityConfig;

  constructor(config?: Partial<PriorityConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate priority for a single game
   */
  async calculateGamePriority(gameId: string): Promise<PriorityFactors> {
    const game = await db
      .select()
      .from(schema.gameSchedules)
      .where(eq(schema.gameSchedules.id, gameId))
      .limit(1);

    if (game.length === 0) {
      throw new Error(`Game ${gameId} not found`);
    }

    return this.calculatePriority(game[0]);
  }

  /**
   * Calculate priority for all games in a time window
   */
  async calculatePrioritiesForTimeWindow(startDate: Date, endDate: Date): Promise<void> {
    const games = await db
      .select()
      .from(schema.gameSchedules)
      .where(
        eq(schema.gameSchedules.status, 'scheduled')
      );

    logger.info(`[PRIORITY] Calculating priorities for ${games.length} games`);

    let updatedCount = 0;
    for (const game of games) {
      try {
        const factors = await this.calculatePriority(game);

        await db
          .update(schema.gameSchedules)
          .set({
            calculatedPriority: factors.totalScore,
            isPriorityGame: factors.totalScore >= this.config.priorityThreshold,
          })
          .where(eq(schema.gameSchedules.id, game.id));

        updatedCount++;
      } catch (error: any) {
        logger.error(`[PRIORITY] Error calculating priority for game ${game.id}: ${error.message}`, error);
      }
    }

    logger.info(`[PRIORITY] Updated priorities for ${updatedCount} games`);
  }

  /**
   * Core priority calculation logic
   */
  private async calculatePriority(game: any): Promise<PriorityFactors> {
    const breakdown: string[] = [];

    // 1. Base score from league tier
    const baseScore = this.config.leagueTiers[game.league] || 50;
    breakdown.push(`League (${game.league}): ${baseScore}`);

    // 2. Priority team bonus
    let priorityTeamBonus = 0;
    const hasPriorityTeam = await this.checkPriorityTeam(
      game.homeTeamName,
      game.awayTeamName
    );
    if (hasPriorityTeam) {
      priorityTeamBonus = this.config.priorityTeamBonus;
      breakdown.push(`Priority Team: +${priorityTeamBonus}`);
    }

    // 3. Playoff bonus
    let playoffBonus = 0;
    if (game.seasonType === 3) {
      // Postseason
      playoffBonus = this.config.playoffBonus;

      // Championship games get even bigger bonus
      if (this.isChampionshipGame(game.playoffRound)) {
        playoffBonus += this.config.championshipBonus;
        breakdown.push(`Championship Game: +${playoffBonus}`);
      } else {
        breakdown.push(`Playoff Game: +${playoffBonus}`);
      }
    }

    // 4. Timing bonus (prime time games)
    let timingBonus = 0;
    const gameHour = new Date(game.scheduledStart * 1000).getHours(); // Convert Unix timestamp to milliseconds
    if (this.isPrimeTime(gameHour)) {
      timingBonus = this.config.primeTimeBonus;
      breakdown.push(`Prime Time: +${timingBonus}`);
    }

    // 5. Calculate total score
    const totalScore = baseScore + priorityTeamBonus + playoffBonus + timingBonus;

    return {
      baseScore,
      priorityTeamBonus,
      playoffBonus,
      leagueMultiplier: 1.0,
      timingBonus,
      totalScore,
      breakdown,
    };
  }

  /**
   * Check if game involves a priority team (home team from database)
   */
  private async checkPriorityTeam(homeTeamName: string, awayTeamName: string): Promise<boolean> {
    // Get all active priority teams
    const priorityTeams = await db
      .select()
      .from(schema.homeTeams)
      .where(eq(schema.homeTeams.isActive, true));

    // Simple name matching (case-insensitive contains check)
    const homeNameLower = homeTeamName.toLowerCase();
    const awayNameLower = awayTeamName.toLowerCase();

    for (const priorityTeam of priorityTeams) {
      const teamNameLower = priorityTeam.teamName.toLowerCase();

      // Check if priority team name is contained in either game team name
      // or vice versa (for abbreviated names like "Bucks" vs "Milwaukee Bucks")
      if (homeNameLower.includes(teamNameLower) || teamNameLower.includes(homeNameLower) ||
          awayNameLower.includes(teamNameLower) || teamNameLower.includes(awayNameLower)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if playoff round is a championship
   */
  private isChampionshipGame(playoffRound?: string | null): boolean {
    if (!playoffRound) return false;

    const championshipKeywords = [
      'super bowl',
      'world series',
      'nba finals',
      'stanley cup',
      'mls cup',
      'national championship',
      'championship game',
    ];

    const roundLower = playoffRound.toLowerCase();
    return championshipKeywords.some(keyword => roundLower.includes(keyword));
  }

  /**
   * Check if time is prime time (7pm-10pm local)
   */
  private isPrimeTime(hour: number): boolean {
    return hour >= 19 && hour <= 22;
  }

  /**
   * Get priority breakdown for debugging
   */
  async getPriorityBreakdown(gameId: string): Promise<string> {
    const factors = await this.calculateGamePriority(gameId);

    let output = `Priority Score: ${factors.totalScore}\n`;
    output += `Is Priority Game: ${factors.totalScore >= this.config.priorityThreshold}\n\n`;
    output += `Breakdown:\n`;
    factors.breakdown.forEach(line => {
      output += `  ${line}\n`;
    });

    return output;
  }

  /**
   * Recalculate all priorities (maintenance task)
   */
  async recalculateAllPriorities(): Promise<void> {
    const now = new Date();
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(now.getDate() + 7);

    await this.calculatePrioritiesForTimeWindow(now, oneWeekFromNow);
  }
}

export const priorityCalculator = new PriorityCalculator();
