/**
 * ESPN Scoreboard API Service
 * Fetches live game data, schedules, and playoff information from ESPN
 */

import { logger } from '@sports-bar/logger';
import { cacheManager } from '@sports-bar/cache-manager';
import { HARDWARE_CONFIG } from '@sports-bar/config';

export interface ESPNGame {
  id: string;
  uid: string;
  date: string;
  name: string;
  shortName: string;

  // Competition details
  competitionId: string;

  // Teams
  homeTeam: {
    id: string;
    uid: string;
    displayName: string;
    abbreviation: string;
    logo?: string;
    score?: number;
    record?: string;
  };

  awayTeam: {
    id: string;
    uid: string;
    displayName: string;
    abbreviation: string;
    logo?: string;
    score?: number;
    record?: string;
  };

  // Status
  status: {
    clock: number;
    displayClock: string;
    period: number;
    type: {
      id: string;
      name: string;
      state: string;
      completed: boolean;
      description: string;
      detail: string;
      shortDetail: string;
    };
  };

  // Season information
  season: {
    year: number;
    type: number; // 1=Preseason, 2=Regular, 3=Postseason
    slug: string;
  };

  // Week/Round information
  week?: {
    number: number;
    text?: string; // "Wild Card", "Super Bowl", etc.
  };

  // Broadcast information
  broadcasts?: Array<{
    market: string;
    names: string[];
  }>;

  // Venue
  venue?: {
    fullName: string;
    address: {
      city: string;
      state?: string;
    };
  };
}

export interface ESPNScoreboardResponse {
  leagues: Array<{
    id: string;
    name: string;
    abbreviation: string;
    season: {
      year: number;
      type: number;
    };
  }>;
  events: ESPNGame[];
  day?: {
    date: string;
  };
}

class ESPNScoreboardAPIService {
  private baseUrl = 'https://site.api.espn.com/apis/site/v2/sports';

  /**
   * Get games for a specific league on a specific date
   */
  async getGamesForDate(
    sport: string,
    league: string,
    date: string // Format: YYYYMMDD
  ): Promise<ESPNGame[]> {
    const cacheKey = `espn-scoreboard-${sport}-${league}-${date}`;

    // Check cache first (15 minutes for live data)
    const cached = cacheManager.get<ESPNGame[]>('sports-data', cacheKey);
    if (cached) {
      logger.debug(`[ESPN SCOREBOARD] Cache hit for ${sport}/${league} on ${date}`);
      return cached;
    }

    try {
      const url = `${this.baseUrl}/${sport}/${league}/scoreboard?dates=${date}`;
      logger.info(`[ESPN SCOREBOARD] Fetching games from ${url}`);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
      }

      const data: ESPNScoreboardResponse = await response.json();
      const games = this.parseScoreboardResponse(data);

      logger.info(`[ESPN SCOREBOARD] Fetched ${games.length} games for ${sport}/${league} on ${date}`);

      // Cache for 15 minutes (games update frequently)
      try {
        cacheManager.set('sports-data', cacheKey, games, 15 * 60 * 1000);
        logger.debug(`[ESPN SCOREBOARD] Cached ${games.length} games`);
      } catch (cacheError) {
        logger.error(`[ESPN SCOREBOARD] Cache set error:`, cacheError);
      }

      return games;
    } catch (error: any) {
      logger.error(`[ESPN SCOREBOARD] Error fetching games for ${sport}/${league} on ${date}`, {
        error,
        data: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      return [];
    }
  }

  /**
   * Leagues whose ESPN scoreboard endpoint does NOT accept YYYYMMDD-YYYYMMDD
   * date ranges — they 404 with `{"code":404,"message":"Failed to get events endpoint."}`
   * when a range is passed, but work fine with a single YYYYMMDD date.
   * Verified 2026-04-14 against site.api.espn.com.
   */
  private static readonly LEAGUES_REQUIRING_SINGLE_DATE = new Set<string>([
    'mens-college-basketball',
    'womens-college-basketball',
  ]);

  /**
   * Get games for a date range
   */
  async getGamesForDateRange(
    sport: string,
    league: string,
    startDate: string, // Format: YYYYMMDD
    endDate: string    // Format: YYYYMMDD
  ): Promise<ESPNGame[]> {
    const cacheKey = `espn-scoreboard-range-${sport}-${league}-${startDate}-${endDate}`;

    // Check cache first (1 hour for date ranges)
    const cached = cacheManager.get<ESPNGame[]>('sports-data', cacheKey);
    if (cached) {
      logger.debug(`[ESPN SCOREBOARD] Cache hit for ${sport}/${league} range ${startDate}-${endDate}`);
      return cached;
    }

    try {
      // Some leagues (notably mens-/womens-college-basketball) reject YYYYMMDD-YYYYMMDD
      // range params and return 404 "Failed to get events endpoint." We fall back to
      // iterating single dates across the range and concatenating results.
      let games: ESPNGame[];
      if (ESPNScoreboardAPIService.LEAGUES_REQUIRING_SINGLE_DATE.has(league)) {
        logger.info(`[ESPN SCOREBOARD] ${league} requires per-day fetches; iterating ${startDate}..${endDate}`);
        games = await this.fetchRangeByDay(sport, league, startDate, endDate);
      } else {
        const url = `${this.baseUrl}/${sport}/${league}/scoreboard?dates=${startDate}-${endDate}`;
        logger.info(`[ESPN SCOREBOARD] Fetching games from ${url}`);

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const bodySnippet = await response.text().catch(() => '');
          throw new Error(
            `ESPN API error: ${response.status} ${response.statusText} url=${url} body=${bodySnippet.slice(0, 200)}`
          );
        }

        const data: ESPNScoreboardResponse = await response.json();
        games = this.parseScoreboardResponse(data);
      }

      logger.info(`[ESPN SCOREBOARD] Fetched ${games.length} games for ${sport}/${league} from ${startDate} to ${endDate}`);

      // Cache for 1 hour
      try {
        cacheManager.set('sports-data', cacheKey, games, 60 * 60 * 1000);
        logger.debug(`[ESPN SCOREBOARD] Cached ${games.length} games for range`);
      } catch (cacheError) {
        logger.error(`[ESPN SCOREBOARD] Cache set error`, { error: cacheError });
      }

      return games;
    } catch (error: any) {
      logger.error(`[ESPN SCOREBOARD] Error fetching games for ${sport}/${league} range ${startDate}-${endDate}`, {
        error,
        data: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      return [];
    }
  }

  /**
   * Fetch a date range by iterating one YYYYMMDD at a time and merging results.
   * Used for ESPN leagues whose scoreboard endpoint rejects range params.
   * Deduplicates by event id in case ESPN returns the same game on adjacent days.
   */
  private async fetchRangeByDay(
    sport: string,
    league: string,
    startDate: string,
    endDate: string
  ): Promise<ESPNGame[]> {
    const parseYmd = (s: string): Date => {
      const y = parseInt(s.slice(0, 4), 10);
      const m = parseInt(s.slice(4, 6), 10) - 1;
      const d = parseInt(s.slice(6, 8), 10);
      return new Date(Date.UTC(y, m, d));
    };
    const formatYmd = (d: Date): string => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    };

    const start = parseYmd(startDate);
    const end = parseYmd(endDate);
    const seen = new Set<string>();
    const merged: ESPNGame[] = [];

    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
      const ymd = formatYmd(d);
      const url = `${this.baseUrl}/${sport}/${league}/scoreboard?dates=${ymd}`;
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
          const bodySnippet = await response.text().catch(() => '');
          logger.warn(
            `[ESPN SCOREBOARD] per-day fetch non-OK for ${sport}/${league} ${ymd}: ${response.status} ${response.statusText} body=${bodySnippet.slice(0, 200)}`
          );
          continue;
        }
        const data: ESPNScoreboardResponse = await response.json();
        const dayGames = this.parseScoreboardResponse(data);
        for (const g of dayGames) {
          if (!seen.has(g.id)) {
            seen.add(g.id);
            merged.push(g);
          }
        }
      } catch (dayError: any) {
        logger.warn(`[ESPN SCOREBOARD] per-day fetch threw for ${sport}/${league} ${ymd}`, {
          error: dayError,
          data: {
            message: dayError instanceof Error ? dayError.message : String(dayError),
          },
        });
        // Continue with other days rather than aborting the whole range
      }
    }

    return merged;
  }

  /**
   * Get today's games for a league
   * Uses venue timezone since the bar is in Central timezone
   */
  async getTodaysGames(sport: string, league: string): Promise<ESPNGame[]> {
    // Use venue timezone for date calculation (bar's timezone)
    // This ensures 6 PM CST still shows today's games, not tomorrow's
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: HARDWARE_CONFIG.venue.timezone
    }).replace(/-/g, '');
    logger.debug(`[ESPN SCOREBOARD] getTodaysGames using Central Time date: ${today}`);
    return this.getGamesForDate(sport, league, today);
  }

  /**
   * Get this week's games for a league (7 day window)
   * Uses venue timezone for date calculations
   */
  async getWeekGames(sport: string, league: string): Promise<ESPNGame[]> {
    // Helper to format date in venue timezone
    const formatDateCentral = (date: Date): string => {
      return date.toLocaleDateString('en-CA', {
        timeZone: HARDWARE_CONFIG.venue.timezone
      }).replace(/-/g, '');
    };

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 1); // Start from yesterday
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 6); // Next 6 days

    const start = formatDateCentral(startDate);
    const end = formatDateCentral(endDate);

    return this.getGamesForDateRange(sport, league, start, end);
  }

  /**
   * Parse ESPN scoreboard response into structured game data
   */
  private parseScoreboardResponse(data: ESPNScoreboardResponse): ESPNGame[] {
    if (!data.events || data.events.length === 0) {
      return [];
    }

    return data.events.map((event: any) => {
      const competition = event.competitions?.[0];
      const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away');

      return {
        id: event.id,
        uid: event.uid,
        date: event.date,
        name: event.name,
        shortName: event.shortName,

        competitionId: competition?.id || event.id,

        homeTeam: {
          id: homeTeam?.team?.id || '',
          uid: homeTeam?.team?.uid || '',
          displayName: homeTeam?.team?.displayName || '',
          abbreviation: homeTeam?.team?.abbreviation || '',
          logo: homeTeam?.team?.logo,
          score: parseInt(homeTeam?.score) || 0,
          record: homeTeam?.records?.[0]?.summary,
        },

        awayTeam: {
          id: awayTeam?.team?.id || '',
          uid: awayTeam?.team?.uid || '',
          displayName: awayTeam?.team?.displayName || '',
          abbreviation: awayTeam?.team?.abbreviation || '',
          logo: awayTeam?.team?.logo,
          score: parseInt(awayTeam?.score) || 0,
          record: awayTeam?.records?.[0]?.summary,
        },

        status: {
          clock: competition?.status?.clock || 0,
          displayClock: competition?.status?.displayClock || '0:00',
          period: competition?.status?.period || 0,
          type: {
            id: competition?.status?.type?.id || '',
            name: competition?.status?.type?.name || '',
            state: competition?.status?.type?.state || '',
            completed: competition?.status?.type?.completed || false,
            description: competition?.status?.type?.description || '',
            detail: competition?.status?.type?.detail || '',
            shortDetail: competition?.status?.type?.shortDetail || '',
          },
        },

        season: {
          year: event.season?.year || new Date().getFullYear(),
          type: event.season?.type || 2,
          slug: event.season?.slug || '',
        },

        week: event.week ? {
          number: event.week.number,
          text: event.week.text,
        } : undefined,

        broadcasts: competition?.broadcasts?.map((b: any) => ({
          market: b.market || 'national',
          names: b.names || [],
        })),

        venue: competition?.venue ? {
          fullName: competition.venue.fullName,
          address: {
            city: competition.venue.address?.city || '',
            state: competition.venue.address?.state,
          },
        } : undefined,
      };
    });
  }

  /**
   * Check if a game is a playoff game
   */
  isPlayoffGame(game: ESPNGame): boolean {
    return game.season.type === 3;
  }

  /**
   * Get playoff round name
   */
  getPlayoffRound(game: ESPNGame): string | null {
    if (!this.isPlayoffGame(game)) {
      return null;
    }

    return game.week?.text || 'Playoffs';
  }

  /**
   * Get primary broadcast network for a game
   */
  getPrimaryNetwork(game: ESPNGame): string | null {
    if (!game.broadcasts || game.broadcasts.length === 0) {
      return null;
    }

    // Prefer national broadcasts
    const nationalBroadcast = game.broadcasts.find(b => b.market === 'national');
    if (nationalBroadcast && nationalBroadcast.names.length > 0) {
      return nationalBroadcast.names[0];
    }

    // Fall back to first broadcast
    return game.broadcasts[0]?.names?.[0] || null;
  }

  /**
   * Get all broadcast networks for a game
   */
  getAllNetworks(game: ESPNGame): string[] {
    if (!game.broadcasts || game.broadcasts.length === 0) {
      return [];
    }

    const networks: string[] = [];
    game.broadcasts.forEach(broadcast => {
      broadcast.names.forEach(name => {
        if (!networks.includes(name)) {
          networks.push(name);
        }
      });
    });

    return networks;
  }

  /**
   * Check if game is currently live
   */
  isLive(game: ESPNGame): boolean {
    return game.status.type.state === 'in';
  }

  /**
   * Check if game is scheduled (not started)
   */
  isScheduled(game: ESPNGame): boolean {
    return game.status.type.state === 'pre';
  }

  /**
   * Check if game is completed
   */
  isCompleted(game: ESPNGame): boolean {
    return game.status.type.completed;
  }

  /**
   * Get game status description
   */
  getStatusDescription(game: ESPNGame): string {
    if (this.isLive(game)) {
      return `Live - ${game.status.displayClock} ${game.status.period}Q`;
    }

    if (this.isCompleted(game)) {
      return 'Final';
    }

    if (this.isScheduled(game)) {
      const gameDate = new Date(game.date);
      return `Scheduled - ${gameDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      })}`;
    }

    return game.status.type.detail;
  }

  /**
   * Estimate game end time based on sport and current status
   */
  estimateGameEnd(game: ESPNGame, sport: string): Date {
    const startTime = new Date(game.date);

    // Default durations by sport (in hours)
    const sportDurations: Record<string, number> = {
      'football': 3.5,     // NFL/College Football
      'basketball': 2.5,   // NBA/College Basketball
      'baseball': 3.0,     // MLB
      'hockey': 2.5,       // NHL
      'soccer': 2.0,       // MLS/Soccer
      'volleyball': 2.0,   // Volleyball
    };

    const durationHours = sportDurations[sport] || 3.0;
    const estimatedEnd = new Date(startTime);
    estimatedEnd.setHours(estimatedEnd.getHours() + durationHours);

    return estimatedEnd;
  }
}

export const espnScoreboardAPI = new ESPNScoreboardAPIService();
