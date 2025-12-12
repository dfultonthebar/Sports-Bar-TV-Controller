/**
 * ESPN Teams & Leagues API Service
 * Fetches teams, leagues, and divisions from ESPN API
 */

import { logger } from '@/lib/logger';
import { cacheManager } from '../cache-manager';

export interface ESPNTeam {
  id: string;
  uid: string;
  slug: string;
  location: string;
  name: string;
  nickname: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  color: string;
  alternateColor: string;
  isActive: boolean;
  logos?: Array<{
    href: string;
    width: number;
    height: number;
    alt: string;
    rel: string[];
  }>;
}

export interface ESPNGroup {
  id: string;
  name: string;
  shortName: string;
  teams?: ESPNTeam[];
}

export interface ESPNLeague {
  id: string;
  name: string;
  abbreviation: string;
  sport: string;
  groups?: ESPNGroup[];
  teams?: ESPNTeam[];
}

class ESPNTeamsAPIService {
  private baseUrl = 'https://site.api.espn.com/apis/site/v2/sports';

  /**
   * Fetch teams for a specific league
   */
  async getTeams(sport: string, league: string): Promise<ESPNTeam[]> {
    const cacheKey = `espn-teams-${sport}-${league}`;

    // Check cache first (7 days)
    const cached = cacheManager.get<ESPNTeam[]>('sports-data', cacheKey);
    if (cached) {
      logger.debug(`[ESPN TEAMS] Cache hit for ${sport}/${league}`);
      return cached;
    }

    try {
      // Check if this league has a specific group ID (for college conferences)
      const groupId = this.getGroupIdForLeague(league);

      // Extract base sport/league for ESPN API
      let baseSport = sport;
      let baseLeague = league;

      // Handle conference-specific leagues
      if (league.startsWith('mens-college-basketball-')) {
        baseSport = 'basketball';
        baseLeague = 'mens-college-basketball';
      } else if (league.startsWith('womens-college-basketball-')) {
        baseSport = 'basketball';
        baseLeague = 'womens-college-basketball';
      }

      // Build URL with optional group filter and limit parameter
      let url = `${this.baseUrl}/${baseSport}/${baseLeague}/teams`;
      if (groupId) {
        url += `?groups=${groupId}&limit=500`;
      } else {
        url += `?limit=500`;
      }

      logger.info(`[ESPN TEAMS] Fetching teams from ${url}`);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // ESPN returns teams in a sports array
      const teams: ESPNTeam[] = data.sports?.[0]?.leagues?.[0]?.teams?.map((t: any) => t.team) || [];

      logger.info(`[ESPN TEAMS] Fetched ${teams.length} teams for ${sport}/${league}`);

      // Cache for 7 days
      try {
        cacheManager.set('sports-data', cacheKey, teams, 7 * 24 * 60 * 60 * 1000);
        logger.debug(`[ESPN TEAMS] Cached ${teams.length} teams`);
      } catch (cacheError) {
        logger.error(`[ESPN TEAMS] Cache set error:`, cacheError);
      }

      return teams;
    } catch (error: any) {
      logger.error(`[ESPN TEAMS] Error fetching teams for ${sport}/${league}:`, error);
      logger.error(`[ESPN TEAMS] Error stack:`, error.stack);
      return [];
    }
  }

  /**
   * Get all available leagues with their metadata
   */
  async getAvailableLeagues(): Promise<ESPNLeague[]> {
    const leagues: ESPNLeague[] = [
      // Professional Leagues
      { id: 'nfl', name: 'National Football League', abbreviation: 'NFL', sport: 'football' },
      { id: 'nba', name: 'National Basketball Association', abbreviation: 'NBA', sport: 'basketball' },
      { id: 'mlb', name: 'Major League Baseball', abbreviation: 'MLB', sport: 'baseball' },
      { id: 'nhl', name: 'National Hockey League', abbreviation: 'NHL', sport: 'hockey' },
      { id: 'mls', name: 'Major League Soccer', abbreviation: 'MLS', sport: 'soccer' },
      { id: 'wnba', name: 'Women\'s National Basketball Association', abbreviation: 'WNBA', sport: 'basketball' },

      // College Football
      { id: 'college-football', name: 'NCAA Football (All)', abbreviation: 'CFB', sport: 'football' },

      // College Basketball - Major Conferences
      { id: 'mens-college-basketball', name: 'NCAA Men\'s Basketball (All)', abbreviation: 'NCAAM', sport: 'basketball' },
      { id: 'womens-college-basketball', name: 'NCAA Women\'s Basketball (All)', abbreviation: 'NCAAW', sport: 'basketball' },

      // College Basketball - Power Conferences
      { id: 'mens-college-basketball-acc', name: 'ACC (Men\'s)', abbreviation: 'ACC', sport: 'basketball' },
      { id: 'mens-college-basketball-big12', name: 'Big 12 (Men\'s)', abbreviation: 'Big 12', sport: 'basketball' },
      { id: 'mens-college-basketball-bigten', name: 'Big Ten (Men\'s)', abbreviation: 'Big Ten', sport: 'basketball' },
      { id: 'mens-college-basketball-sec', name: 'SEC (Men\'s)', abbreviation: 'SEC', sport: 'basketball' },
      { id: 'mens-college-basketball-bigeast', name: 'Big East (Men\'s)', abbreviation: 'Big East', sport: 'basketball' },
      { id: 'mens-college-basketball-pac12', name: 'Pac-12 (Men\'s)', abbreviation: 'Pac-12', sport: 'basketball' },

      // College Basketball - Mid-Major Conferences
      { id: 'mens-college-basketball-a10', name: 'Atlantic 10 (Men\'s)', abbreviation: 'A-10', sport: 'basketball' },
      { id: 'mens-college-basketball-horizon', name: 'Horizon League (Men\'s)', abbreviation: 'Horizon', sport: 'basketball' },
      { id: 'mens-college-basketball-mvc', name: 'Missouri Valley (Men\'s)', abbreviation: 'MVC', sport: 'basketball' },
      { id: 'mens-college-basketball-wcc', name: 'West Coast Conference (Men\'s)', abbreviation: 'WCC', sport: 'basketball' },
      { id: 'mens-college-basketball-aac', name: 'American Athletic (Men\'s)', abbreviation: 'AAC', sport: 'basketball' },
      { id: 'mens-college-basketball-mwc', name: 'Mountain West (Men\'s)', abbreviation: 'MWC', sport: 'basketball' },
      { id: 'mens-college-basketball-cusa', name: 'Conference USA (Men\'s)', abbreviation: 'C-USA', sport: 'basketball' },
      { id: 'mens-college-basketball-mac', name: 'Mid-American (Men\'s)', abbreviation: 'MAC', sport: 'basketball' },
      { id: 'mens-college-basketball-sunbelt', name: 'Sun Belt (Men\'s)', abbreviation: 'Sun Belt', sport: 'basketball' },

      // Volleyball
      { id: 'womens-college-volleyball', name: 'NCAA Women\'s Volleyball', abbreviation: 'NCAAVB', sport: 'volleyball' },

      // Softball
      { id: 'college-softball', name: 'NCAA Softball', abbreviation: 'NCAASB', sport: 'baseball' },
    ];

    return leagues;
  }

  /**
   * Map league ID to ESPN group ID for conference-specific queries
   */
  private getGroupIdForLeague(leagueId: string): string | null {
    const groupMap: Record<string, string> = {
      // College Basketball Men's Conferences (ESPN Group IDs)
      'mens-college-basketball-acc': '2',
      'mens-college-basketball-big12': '8',
      'mens-college-basketball-bigten': '7',
      'mens-college-basketball-sec': '23',
      'mens-college-basketball-bigeast': '4',
      'mens-college-basketball-pac12': '21',
      'mens-college-basketball-a10': '3',
      'mens-college-basketball-horizon': '45',
      'mens-college-basketball-mvc': '18',
      'mens-college-basketball-wcc': '26',
      'mens-college-basketball-aac': '62',
      'mens-college-basketball-mwc': '44',
      'mens-college-basketball-cusa': '11',
      'mens-college-basketball-mac': '15',
      'mens-college-basketball-sunbelt': '37',
    };

    return groupMap[leagueId] || null;
  }

  /**
   * Get hardcoded divisions/conferences for known leagues
   */
  private getHardcodedDivisions(league: string): ESPNGroup[] {
    const divisions: Record<string, ESPNGroup[]> = {
      'nfl': [
        { id: 'afc-east', name: 'AFC East', shortName: 'AFC East' },
        { id: 'afc-north', name: 'AFC North', shortName: 'AFC North' },
        { id: 'afc-south', name: 'AFC South', shortName: 'AFC South' },
        { id: 'afc-west', name: 'AFC West', shortName: 'AFC West' },
        { id: 'nfc-east', name: 'NFC East', shortName: 'NFC East' },
        { id: 'nfc-north', name: 'NFC North', shortName: 'NFC North' },
        { id: 'nfc-south', name: 'NFC South', shortName: 'NFC South' },
        { id: 'nfc-west', name: 'NFC West', shortName: 'NFC West' },
      ],
      'nba': [
        { id: 'atlantic', name: 'Atlantic Division', shortName: 'Atlantic' },
        { id: 'central', name: 'Central Division', shortName: 'Central' },
        { id: 'southeast', name: 'Southeast Division', shortName: 'Southeast' },
        { id: 'northwest', name: 'Northwest Division', shortName: 'Northwest' },
        { id: 'pacific', name: 'Pacific Division', shortName: 'Pacific' },
        { id: 'southwest', name: 'Southwest Division', shortName: 'Southwest' },
      ],
      'mlb': [
        { id: 'al-east', name: 'AL East', shortName: 'AL East' },
        { id: 'al-central', name: 'AL Central', shortName: 'AL Central' },
        { id: 'al-west', name: 'AL West', shortName: 'AL West' },
        { id: 'nl-east', name: 'NL East', shortName: 'NL East' },
        { id: 'nl-central', name: 'NL Central', shortName: 'NL Central' },
        { id: 'nl-west', name: 'NL West', shortName: 'NL West' },
      ],
      'nhl': [
        { id: 'atlantic', name: 'Atlantic Division', shortName: 'Atlantic' },
        { id: 'metropolitan', name: 'Metropolitan Division', shortName: 'Metropolitan' },
        { id: 'central', name: 'Central Division', shortName: 'Central' },
        { id: 'pacific', name: 'Pacific Division', shortName: 'Pacific' },
      ],
      'college-football': [
        { id: 'acc', name: 'ACC', shortName: 'ACC' },
        { id: 'big-ten', name: 'Big Ten', shortName: 'Big Ten' },
        { id: 'big-12', name: 'Big 12', shortName: 'Big 12' },
        { id: 'sec', name: 'SEC', shortName: 'SEC' },
        { id: 'pac-12', name: 'Pac-12', shortName: 'Pac-12' },
        { id: 'independent', name: 'Independent', shortName: 'Independent' },
      ],
      'mens-college-basketball': [
        { id: 'acc', name: 'ACC', shortName: 'ACC' },
        { id: 'big-ten', name: 'Big Ten', shortName: 'Big Ten' },
        { id: 'big-12', name: 'Big 12', shortName: 'Big 12' },
        { id: 'sec', name: 'SEC', shortName: 'SEC' },
        { id: 'big-east', name: 'Big East', shortName: 'Big East' },
        { id: 'pac-12', name: 'Pac-12', shortName: 'Pac-12' },
      ],
    };

    return divisions[league] || [];
  }

  /**
   * Get teams with divisions/conferences
   */
  async getTeamsWithDivisions(sport: string, league: string): Promise<{ teams: ESPNTeam[]; groups: ESPNGroup[]; autoConference?: string }> {
    try {
      // Get teams from ESPN API
      const teams = await this.getTeams(sport, league);

      // Use hardcoded divisions for professional leagues
      const groups = this.getHardcodedDivisions(league);

      // For conference-specific leagues, extract the conference name
      let autoConference: string | undefined;
      if (league.startsWith('mens-college-basketball-') || league.startsWith('womens-college-basketball-')) {
        // Find the league definition to get the conference name
        const leagues = await this.getAvailableLeagues();
        const leagueDef = leagues.find(l => l.id === league);
        if (leagueDef && leagueDef.id !== 'mens-college-basketball' && leagueDef.id !== 'womens-college-basketball') {
          // Extract conference name (everything except sport and "(Men's)" or "(Women's)")
          autoConference = leagueDef.name.replace(' (Men\'s)', '').replace(' (Women\'s)', '').replace(' (All)', '');
        }
      }

      logger.info(`[ESPN TEAMS] Returning ${teams.length} teams, ${groups.length} divisions${autoConference ? `, auto-conference: ${autoConference}` : ''} for ${sport}/${league}`);
      return { teams, groups, autoConference };
    } catch (error: any) {
      logger.error(`[ESPN TEAMS] Error in getTeamsWithDivisions for ${sport}/${league}:`, error);
      logger.error(`[ESPN TEAMS] Error stack:`, error.stack);
      return { teams, groups: [] };
    }
  }

  /**
   * Search teams across all leagues
   */
  async searchTeams(query: string): Promise<Array<ESPNTeam & { league: string; sport: string }>> {
    const leagues = await this.getAvailableLeagues();
    const results: Array<ESPNTeam & { league: string; sport: string }> = [];

    // Search across all leagues in parallel
    const searches = leagues.map(async (league) => {
      const teams = await this.getTeams(league.sport, league.id);
      return teams
        .filter(team =>
          team.displayName.toLowerCase().includes(query.toLowerCase()) ||
          team.location.toLowerCase().includes(query.toLowerCase()) ||
          team.name.toLowerCase().includes(query.toLowerCase()) ||
          team.abbreviation.toLowerCase().includes(query.toLowerCase())
        )
        .map(team => ({
          ...team,
          league: league.abbreviation,
          sport: league.sport,
        }));
    });

    const allResults = await Promise.all(searches);
    allResults.forEach(leagueResults => results.push(...leagueResults));

    return results;
  }
}

export const espnTeamsAPI = new ESPNTeamsAPIService();
