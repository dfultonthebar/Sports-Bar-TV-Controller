/**
 * Conflict Detector
 * Detects scheduling conflicts where multiple priority games overlap
 * and there aren't enough input sources to show them all
 */

import { db, schema, eq, and, gte, lte } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

export interface SchedulingConflict {
  id: string;
  timeWindow: {
    start: number; // Unix timestamp
    end: number;
  };
  conflictingGames: Array<{
    id: string;
    espnEventId: string;
    awayTeamName: string;
    homeTeamName: string;
    scheduledStart: number;
    estimatedEnd: number;
    calculatedPriority: number;
    isPriorityGame: boolean;
    primaryNetwork: string | null;
    broadcastNetworks: string[];
  }>;
  availableInputs: number;
  requiredInputs: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  canBeResolved: boolean;
}

export interface ConflictDetectionResult {
  conflicts: SchedulingConflict[];
  totalConflicts: number;
  criticalConflicts: number;
  affectedGames: number;
  detectedAt: number; // Unix timestamp
}

class ConflictDetector {
  /**
   * Detect all current and upcoming scheduling conflicts
   */
  async detectConflicts(
    lookAheadHours: number = 24
  ): Promise<ConflictDetectionResult> {
    try {
      logger.info('[CONFLICT-DETECTOR] Starting conflict detection');

      const now = Math.floor(Date.now() / 1000);
      const lookAheadEnd = now + lookAheadHours * 3600;

      // Get all priority games in the time window
      const priorityGames = await db
        .select()
        .from(schema.gameSchedules)
        .where(
          and(
            eq(schema.gameSchedules.isPriorityGame, true),
            gte(schema.gameSchedules.scheduledStart, now),
            lte(schema.gameSchedules.scheduledStart, lookAheadEnd)
          )
        );

      logger.debug(
        `[CONFLICT-DETECTOR] Found ${priorityGames.length} priority games in next ${lookAheadHours} hours`
      );

      // Get all available input sources
      const inputSources = await db
        .select()
        .from(schema.inputSources)
        .where(eq(schema.inputSources.isActive, true));

      const conflicts: SchedulingConflict[] = [];
      const processedWindows = new Set<string>();

      // Check each game for overlaps with other priority games
      for (const game of priorityGames) {
        const gameStart = game.scheduledStart;
        const gameEnd = game.estimatedEnd;

        // Find all games that overlap with this time window
        const overlappingGames = priorityGames.filter(other => {
          if (other.id === game.id) return false;

          const otherStart = other.scheduledStart;
          const otherEnd = other.estimatedEnd;

          // Check for time overlap
          return (
            (otherStart >= gameStart && otherStart < gameEnd) || // Other starts during this game
            (otherEnd > gameStart && otherEnd <= gameEnd) || // Other ends during this game
            (otherStart <= gameStart && otherEnd >= gameEnd) // Other completely contains this game
          );
        });

        if (overlappingGames.length === 0) continue;

        // Create a unique window ID to avoid duplicate conflicts
        const windowId = this.createWindowId([game, ...overlappingGames]);
        if (processedWindows.has(windowId)) continue;
        processedWindows.add(windowId);

        // All games in this conflict
        const allConflictingGames = [game, ...overlappingGames];

        // Determine the actual time window
        const windowStart = Math.min(
          ...allConflictingGames.map(g => g.scheduledStart)
        );
        const windowEnd = Math.max(
          ...allConflictingGames.map(g => g.estimatedEnd)
        );

        // Count how many input sources can show these networks
        const requiredNetworks = new Set(
          allConflictingGames
            .map(g => g.primaryNetwork)
            .filter((n): n is string => n !== null)
        );

        const capableInputs = this.countCapableInputs(
          inputSources,
          Array.from(requiredNetworks)
        );

        const requiredInputs = allConflictingGames.length;
        const severity = this.calculateSeverity(
          capableInputs,
          requiredInputs,
          allConflictingGames
        );

        const conflict: SchedulingConflict = {
          id: crypto.randomUUID(),
          timeWindow: {
            start: windowStart,
            end: windowEnd,
          },
          conflictingGames: allConflictingGames.map(g => ({
            id: g.id,
            espnEventId: g.espnEventId,
            awayTeamName: g.awayTeamName,
            homeTeamName: g.homeTeamName,
            scheduledStart: g.scheduledStart,
            estimatedEnd: g.estimatedEnd,
            calculatedPriority: g.calculatedPriority,
            isPriorityGame: g.isPriorityGame,
            primaryNetwork: g.primaryNetwork,
            broadcastNetworks: JSON.parse(g.broadcastNetworks || '[]'),
          })),
          availableInputs: capableInputs,
          requiredInputs,
          severity,
          recommendations: this.generateRecommendations(
            capableInputs,
            requiredInputs,
            allConflictingGames
          ),
          canBeResolved: capableInputs >= requiredInputs,
        };

        conflicts.push(conflict);
      }

      const result: ConflictDetectionResult = {
        conflicts,
        totalConflicts: conflicts.length,
        criticalConflicts: conflicts.filter(c => c.severity === 'critical')
          .length,
        affectedGames: conflicts.reduce(
          (sum, c) => sum + c.conflictingGames.length,
          0
        ),
        detectedAt: now,
      };

      logger.info(
        `[CONFLICT-DETECTOR] Detected ${result.totalConflicts} conflicts (${result.criticalConflicts} critical)`
      );

      return result;
    } catch (error: any) {
      logger.error('[CONFLICT-DETECTOR] Error detecting conflicts:', { error });
      throw error;
    }
  }

  /**
   * Create a unique window ID from a set of games
   */
  private createWindowId(games: any[]): string {
    return games
      .map(g => g.id)
      .sort()
      .join('|');
  }

  /**
   * Count how many input sources can show at least one of the required networks
   */
  private countCapableInputs(
    inputSources: any[],
    requiredNetworks: string[]
  ): number {
    return inputSources.filter(input => {
      const availableNetworks = JSON.parse(input.availableNetworks || '[]');
      return requiredNetworks.some(network =>
        availableNetworks.includes(network)
      );
    }).length;
  }

  /**
   * Calculate conflict severity
   */
  private calculateSeverity(
    availableInputs: number,
    requiredInputs: number,
    games: any[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    const shortfall = requiredInputs - availableInputs;

    // Can be resolved - low severity
    if (shortfall <= 0) return 'low';

    // Missing 1 input - medium severity
    if (shortfall === 1) return 'medium';

    // Check if any games are high priority (priority > 600)
    const hasHighPriorityGames = games.some(g => g.calculatedPriority > 600);

    // Missing multiple inputs with high priority games - critical
    if (hasHighPriorityGames && shortfall >= 2) return 'critical';

    // Missing multiple inputs - high severity
    if (shortfall >= 2) return 'high';

    return 'medium';
  }

  /**
   * Generate recommendations for resolving conflicts
   */
  private generateRecommendations(
    availableInputs: number,
    requiredInputs: number,
    games: any[]
  ): string[] {
    const recommendations: string[] = [];

    if (availableInputs >= requiredInputs) {
      recommendations.push(
        'Sufficient input sources available - conflict can be resolved automatically'
      );
      return recommendations;
    }

    const shortfall = requiredInputs - availableInputs;

    // Recommend adding input sources
    recommendations.push(
      `Add ${shortfall} more input source${shortfall > 1 ? 's' : ''} to resolve this conflict`
    );

    // Sort games by priority
    const sortedGames = [...games].sort(
      (a, b) => b.calculatedPriority - a.calculatedPriority
    );

    // Recommend which games to show
    if (availableInputs > 0) {
      const topGames = sortedGames
        .slice(0, availableInputs)
        .map(g => `${g.awayTeamName} @ ${g.homeTeamName}`);
      recommendations.push(
        `Prioritize showing: ${topGames.join(', ')} (highest priority games)`
      );
    }

    // Recommend streaming alternatives
    const lowerPriorityGames = sortedGames.slice(availableInputs);
    if (lowerPriorityGames.length > 0) {
      recommendations.push(
        'Consider using Fire TV streaming for lower priority games'
      );
    }

    // Check if games have different networks
    const networks = new Set(
      games.map(g => g.primaryNetwork).filter((n): n is string => n !== null)
    );
    if (networks.size < games.length) {
      recommendations.push(
        'Some games share the same network - consider showing different games to maximize variety'
      );
    }

    return recommendations;
  }

  /**
   * Get conflicts for a specific time window
   */
  async getConflictsForTimeWindow(
    startTime: number,
    endTime: number
  ): Promise<SchedulingConflict[]> {
    const lookAheadHours = Math.ceil((endTime - startTime) / 3600);
    const result = await this.detectConflicts(lookAheadHours);

    return result.conflicts.filter(
      conflict =>
        conflict.timeWindow.start >= startTime &&
        conflict.timeWindow.end <= endTime
    );
  }

  /**
   * Check if a specific game has conflicts
   */
  async checkGameConflicts(gameId: string): Promise<SchedulingConflict[]> {
    const game = await db
      .select()
      .from(schema.gameSchedules)
      .where(eq(schema.gameSchedules.id, gameId))
      .limit(1);

    if (game.length === 0) {
      throw new Error(`Game ${gameId} not found`);
    }

    const result = await this.detectConflicts(24);

    return result.conflicts.filter(conflict =>
      conflict.conflictingGames.some(g => g.id === gameId)
    );
  }
}

export const conflictDetector = new ConflictDetector()
