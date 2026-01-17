/**
 * ESPN Schedule Sync Service
 * Syncs game schedules from ESPN API to database
 * Runs as background worker to keep game data fresh
 */

import { db, schema, eq, and, gte, lte } from '@sports-bar/database'
import { espnScoreboardAPI, type ESPNScoreboardGame as ESPNGame } from '@sports-bar/sports-apis'
import { logger } from '@sports-bar/logger'

export interface SyncConfig {
  sport: string;
  league: string;
  enabled: boolean;
  syncInterval?: number; // minutes
}

export interface SyncResult {
  sport: string;
  league: string;
  gamesAdded: number;
  gamesUpdated: number;
  errors: string[];
  lastSync: Date;
}

class ESPNSyncService {
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: Map<string, boolean> = new Map();

  /**
   * Start syncing a league on an interval
   */
  async startSync(config: SyncConfig): Promise<void> {
    const key = `${config.sport}-${config.league}`;

    if (this.syncIntervals.has(key)) {
      logger.warn(`[ESPN SYNC] Already syncing ${key}`);
      return;
    }

    logger.info(`[ESPN SYNC] Starting sync for ${key} (interval: ${config.syncInterval || 15}min)`);

    // Initial sync
    await this.syncLeague(config.sport, config.league);

    // Schedule recurring sync
    const intervalMs = (config.syncInterval || 15) * 60 * 1000;
    const interval = setInterval(async () => {
      await this.syncLeague(config.sport, config.league);
    }, intervalMs);

    this.syncIntervals.set(key, interval);
  }

  /**
   * Stop syncing a league
   */
  stopSync(sport: string, league: string): void {
    const key = `${sport}-${league}`;
    const interval = this.syncIntervals.get(key);

    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(key);
      this.isRunning.delete(key);
      logger.info(`[ESPN SYNC] Stopped sync for ${key}`);
    }
  }

  /**
   * Stop all syncs
   */
  stopAllSyncs(): void {
    this.syncIntervals.forEach((interval, key) => {
      clearInterval(interval);
      logger.info(`[ESPN SYNC] Stopped sync for ${key}`);
    });
    this.syncIntervals.clear();
    this.isRunning.clear();
  }

  /**
   * Sync a single league (7-day window)
   */
  async syncLeague(sport: string, league: string): Promise<SyncResult> {
    const key = `${sport}-${league}`;

    // Prevent concurrent syncs for same league
    if (this.isRunning.get(key)) {
      logger.warn(`[ESPN SYNC] Sync already running for ${key}`);
      return {
        sport,
        league,
        gamesAdded: 0,
        gamesUpdated: 0,
        errors: ['Sync already in progress'],
        lastSync: new Date(),
      };
    }

    this.isRunning.set(key, true);

    const result: SyncResult = {
      sport,
      league,
      gamesAdded: 0,
      gamesUpdated: 0,
      errors: [],
      lastSync: new Date(),
    };

    try {
      logger.info(`[ESPN SYNC] Starting sync for ${sport}/${league}`);

      // Fetch games from ESPN (7-day window)
      const games = await espnScoreboardAPI.getWeekGames(sport, league);
      logger.info(`[ESPN SYNC] Fetched ${games.length} games for ${sport}/${league}`);

      // Sync each game
      for (const game of games) {
        try {
          const isNew = await this.syncGame(game, sport, league);
          if (isNew) {
            result.gamesAdded++;
          } else {
            result.gamesUpdated++;
          }
        } catch (error: any) {
          const errorMsg = `Failed to sync game ${game.id}: ${error.message}`;
          logger.error(`[ESPN SYNC] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      logger.info(
        `[ESPN SYNC] Completed sync for ${sport}/${league}: ` +
        `+${result.gamesAdded} new, ~${result.gamesUpdated} updated, ${result.errors.length} errors`
      );
    } catch (error: any) {
      logger.error(`[ESPN SYNC] Error syncing ${sport}/${league}:`, { error });
      result.errors.push(error.message);
    } finally {
      this.isRunning.set(key, false);
    }

    return result;
  }

  /**
   * Sync a single game to database
   * Returns true if new game created, false if updated
   */
  private async syncGame(game: ESPNGame, sport: string, league: string): Promise<boolean> {
    // Check if game already exists
    const existing = await db
      .select()
      .from(schema.gameSchedules)
      .where(eq(schema.gameSchedules.espnEventId, game.id))
      .limit(1);

    const scheduledStart = new Date(game.date);
    const estimatedEnd = espnScoreboardAPI.estimateGameEnd(game, sport);

    // Determine game status
    let status = 'scheduled';
    if (espnScoreboardAPI.isLive(game)) {
      status = 'in_progress';
    } else if (espnScoreboardAPI.isCompleted(game)) {
      status = 'completed';
    }

    // Get playoff info
    const isPlayoff = espnScoreboardAPI.isPlayoffGame(game);
    const playoffRound = espnScoreboardAPI.getPlayoffRound(game);

    // Get broadcast networks
    const primaryNetwork = espnScoreboardAPI.getPrimaryNetwork(game);
    const allNetworks = espnScoreboardAPI.getAllNetworks(game);

    // Convert dates to Unix timestamps (seconds since epoch)
    const scheduledStartTimestamp = Math.floor(scheduledStart.getTime() / 1000);
    const estimatedEndTimestamp = Math.floor(estimatedEnd.getTime() / 1000);
    const nowTimestamp = Math.floor(Date.now() / 1000);

    const gameData = {
      espnEventId: game.id,
      espnCompetitionId: game.competitionId,
      sport,
      league,

      homeTeamId: null, // Will be linked later when we match ESPN IDs to our teams
      awayTeamId: null,
      homeTeamEspnId: game.homeTeam.id,
      awayTeamEspnId: game.awayTeam.id,
      homeTeamName: game.homeTeam.displayName,
      awayTeamName: game.awayTeam.displayName,

      scheduledStart: scheduledStartTimestamp,
      estimatedEnd: estimatedEndTimestamp,
      actualStart: status === 'in_progress' || status === 'completed' ? scheduledStartTimestamp : null,
      actualEnd: status === 'completed' ? nowTimestamp : null,

      status,
      statusDetail: game.status.type.detail,
      currentPeriod: game.status.period,
      clockTime: game.status.displayClock,

      homeScore: game.homeTeam.score || 0,
      awayScore: game.awayTeam.score || 0,

      seasonType: game.season.type,
      seasonYear: game.season.year,
      playoffRound: isPlayoff ? playoffRound : null,

      primaryNetwork,
      broadcastNetworks: JSON.stringify(allNetworks),

      calculatedPriority: 0, // Will be calculated by priority engine
      isPriorityGame: false,

      lastSynced: nowTimestamp,
    };

    if (existing.length > 0) {
      // Update existing game
      await db
        .update(schema.gameSchedules)
        .set(gameData)
        .where(eq(schema.gameSchedules.id, existing[0].id));

      logger.debug(`[ESPN SYNC] Updated game: ${game.name}`);
      return false;
    } else {
      // Insert new game
      await db.insert(schema.gameSchedules).values({
        id: crypto.randomUUID(),
        ...gameData,
      });

      logger.debug(`[ESPN SYNC] Added new game: ${game.name}`);
      return true;
    }
  }

  /**
   * Link ESPN teams to our home teams table
   * Note: This requires homeTeams to have an espnTeamId column (not yet implemented)
   * For now, we match by team name
   */
  async linkTeamsToHomeTeams(): Promise<void> {
    logger.info('[ESPN SYNC] Linking ESPN teams to home teams...');

    try {
      // Get all games without linked home teams
      const unlinkedGames = await db
        .select()
        .from(schema.gameSchedules)
        .where(eq(schema.gameSchedules.homeTeamId, null));

      let linkedCount = 0;

      for (const game of unlinkedGames) {
        // Try to find matching home teams by team name
        // TODO: Add espnTeamId column to homeTeams schema for better matching
        const homeTeam = await db
          .select()
          .from(schema.homeTeams)
          .where(eq(schema.homeTeams.teamName, game.homeTeamName || ''))
          .limit(1);

        const awayTeam = await db
          .select()
          .from(schema.homeTeams)
          .where(eq(schema.homeTeams.teamName, game.awayTeamName || ''))
          .limit(1);

        if (homeTeam.length > 0 || awayTeam.length > 0) {
          await db
            .update(schema.gameSchedules)
            .set({
              homeTeamId: homeTeam.length > 0 ? homeTeam[0].id : null,
              awayTeamId: awayTeam.length > 0 ? awayTeam[0].id : null,
            })
            .where(eq(schema.gameSchedules.id, game.id));

          linkedCount++;
        }
      }

      logger.info(`[ESPN SYNC] Linked ${linkedCount} games to home teams`);
    } catch (error: any) {
      logger.error('[ESPN SYNC] Error linking teams:', { error });
    }
  }

  /**
   * Get sync status for all active leagues
   */
  getActiveSyncs(): Array<{ sport: string; league: string; isRunning: boolean }> {
    const syncs: Array<{ sport: string; league: string; isRunning: boolean }> = [];

    this.syncIntervals.forEach((_, key) => {
      const [sport, league] = key.split('-');
      syncs.push({
        sport,
        league,
        isRunning: this.isRunning.get(key) || false,
      });
    });

    return syncs;
  }

  /**
   * Manual sync for a specific date range
   */
  async syncDateRange(
    sport: string,
    league: string,
    startDate: string, // YYYYMMDD
    endDate: string    // YYYYMMDD
  ): Promise<SyncResult> {
    const result: SyncResult = {
      sport,
      league,
      gamesAdded: 0,
      gamesUpdated: 0,
      errors: [],
      lastSync: new Date(),
    };

    try {
      logger.info(`[ESPN SYNC] Manual sync for ${sport}/${league} from ${startDate} to ${endDate}`);

      const games = await espnScoreboardAPI.getGamesForDateRange(sport, league, startDate, endDate);
      logger.info(`[ESPN SYNC] Fetched ${games.length} games`);

      for (const game of games) {
        try {
          const isNew = await this.syncGame(game, sport, league);
          if (isNew) {
            result.gamesAdded++;
          } else {
            result.gamesUpdated++;
          }
        } catch (error: any) {
          const errorMsg = `Failed to sync game ${game.id}: ${error.message}`;
          logger.error(`[ESPN SYNC] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      logger.info(
        `[ESPN SYNC] Manual sync complete: +${result.gamesAdded} new, ~${result.gamesUpdated} updated`
      );
    } catch (error: any) {
      logger.error(`[ESPN SYNC] Error in manual sync:`, { error });
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Clean up old completed games (older than 7 days)
   */
  async cleanupOldGames(): Promise<number> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoTimestamp = Math.floor(sevenDaysAgo.getTime() / 1000);

      const deleted = await db
        .delete(schema.gameSchedules)
        .where(
          and(
            eq(schema.gameSchedules.status, 'completed'),
            lte(schema.gameSchedules.scheduledStart, sevenDaysAgoTimestamp)
          )
        );

      logger.info(`[ESPN SYNC] Cleaned up ${deleted.changes} old games`);
      return deleted.changes || 0;
    } catch (error: any) {
      logger.error('[ESPN SYNC] Error cleaning up old games:', { error });
      return 0;
    }
  }
}

export const espnSyncService = new ESPNSyncService()
