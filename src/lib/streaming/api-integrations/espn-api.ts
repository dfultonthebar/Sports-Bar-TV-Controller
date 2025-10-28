/**
 * ESPN API Integration
 * 
 * Integration with ESPN's public API for sports scores and schedules.
 * ESPN provides a free, public API for scores, schedules, and team data.
 * 
 * API Documentation: http://www.espn.com/apis/devcenter/docs/
 */

export interface ESPNEvent {
  id: string
  uid: string
  date: string
  name: string
  shortName: string
  status: {
    type: {
      id: string
      name: string
      state: string
      completed: boolean
    }
  }
  competitions: Array<{
    id: string
    competitors: Array<{
      id: string
      type: 'team' | 'athlete'
      homeAway: 'home' | 'away'
      team: {
        id: string
        name: string
        abbreviation: string
        displayName: string
        logo?: string
      }
      score?: string
    }>
    broadcasts?: Array<{
      market: string
      names: string[]
    }>
  }>
  links?: Array<{
    href: string
    text: string
  }>
}

export interface ESPNScoreboard {
  leagues: Array<{
    id: string
    name: string
    abbreviation: string
  }>
  events: ESPNEvent[]
  day: {
    date: string
  }
}

export interface ESPNApiConfig {
  baseUrl?: string
}

/**
 * ESPN API Client
 * 
 * Note: ESPN's public API does not require authentication for basic access
 */
export class ESPNApiClient {
  private config: ESPNApiConfig
  private readonly SUPPORTED_SPORTS = [
    'football', 'basketball', 'baseball', 'hockey', 'soccer',
    'tennis', 'golf', 'boxing', 'mma', 'nascar', 'cricket'
  ]

  constructor(config: ESPNApiConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://site.api.espn.com/apis/site/v2/sports'
    }

    console.log('[ESPN API] Client initialized')
  }

  /**
   * Get scoreboard for a specific sport and league
   */
  public async getScoreboard(sport: string, league: string, options?: {
    dates?: string // Format: YYYYMMDD
    limit?: number
  }): Promise<ESPNScoreboard> {
    try {
      console.log(`[ESPN API] Getting scoreboard for ${sport}/${league}`)

      const url = new URL(`${this.config.baseUrl}/${sport}/${league}/scoreboard`)
      
      if (options?.dates) {
        url.searchParams.append('dates', options.dates)
      }
      
      if (options?.limit) {
        url.searchParams.append('limit', options.limit.toString())
      }

      const response = await fetch(url.toString())
      
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data as ESPNScoreboard
    } catch (error) {
      console.error(`[ESPN API] Error getting scoreboard:`, error)
      throw error
    }
  }

  /**
   * Get NFL scoreboard
   */
  public async getNFLScoreboard(date?: string): Promise<ESPNScoreboard> {
    return this.getScoreboard('football', 'nfl', date ? { dates: date } : undefined)
  }

  /**
   * Get NBA scoreboard
   */
  public async getNBAScoreboard(date?: string): Promise<ESPNScoreboard> {
    return this.getScoreboard('basketball', 'nba', date ? { dates: date } : undefined)
  }

  /**
   * Get MLB scoreboard
   */
  public async getMLBScoreboard(date?: string): Promise<ESPNScoreboard> {
    return this.getScoreboard('baseball', 'mlb', date ? { dates: date } : undefined)
  }

  /**
   * Get NHL scoreboard
   */
  public async getNHLScoreboard(date?: string): Promise<ESPNScoreboard> {
    return this.getScoreboard('hockey', 'nhl', date ? { dates: date } : undefined)
  }

  /**
   * Get MLS (Soccer) scoreboard
   */
  public async getMLSScoreboard(date?: string): Promise<ESPNScoreboard> {
    return this.getScoreboard('soccer', 'usa.1', date ? { dates: date } : undefined)
  }

  /**
   * Get college football scoreboard
   */
  public async getCollegeFootballScoreboard(date?: string): Promise<ESPNScoreboard> {
    return this.getScoreboard('football', 'college-football', date ? { dates: date } : undefined)
  }

  /**
   * Get college basketball scoreboard
   */
  public async getCollegeBasketballScoreboard(date?: string): Promise<ESPNScoreboard> {
    return this.getScoreboard('basketball', 'mens-college-basketball', date ? { dates: date } : undefined)
  }

  /**
   * Get team information
   */
  public async getTeam(sport: string, league: string, teamId: string): Promise<any> {
    try {
      console.log(`[ESPN API] Getting team ${teamId} for ${sport}/${league}`)

      const url = `${this.config.baseUrl}/${sport}/${league}/teams/${teamId}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`[ESPN API] Error getting team:`, error)
      throw error
    }
  }

  /**
   * Get event details
   */
  public async getEvent(sport: string, league: string, eventId: string): Promise<any> {
    try {
      console.log(`[ESPN API] Getting event ${eventId} for ${sport}/${league}`)

      const url = `${this.config.baseUrl}/${sport}/${league}/summary`
      const urlWithParams = `${url}?event=${eventId}`
      
      const response = await fetch(urlWithParams)
      
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`[ESPN API] Error getting event:`, error)
      throw error
    }
  }

  /**
   * Get live events across all sports
   */
  public async getLiveEvents(): Promise<ESPNEvent[]> {
    try {
      console.log('[ESPN API] Getting live events')

      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const liveEvents: ESPNEvent[] = []

      // Check major leagues for live games
      const leagues = [
        { sport: 'football', league: 'nfl' },
        { sport: 'basketball', league: 'nba' },
        { sport: 'baseball', league: 'mlb' },
        { sport: 'hockey', league: 'nhl' },
        { sport: 'soccer', league: 'usa.1' }
      ]

      for (const { sport, league } of leagues) {
        try {
          const scoreboard = await this.getScoreboard(sport, league, { dates: today })
          
          const live = scoreboard.events.filter(event =>
            event.status.type.state === 'in' || 
            event.status.type.name === 'STATUS_IN_PROGRESS'
          )
          
          liveEvents.push(...live)
        } catch (error) {
          console.error(`[ESPN API] Error checking ${sport}/${league} for live events:`, error)
        }
      }

      console.log(`[ESPN API] Found ${liveEvents.length} live events`)
      return liveEvents
    } catch (error) {
      console.error('[ESPN API] Error getting live events:', error)
      return []
    }
  }

  /**
   * Search for events by team name
   */
  public async searchEventsByTeam(teamName: string, sport?: string): Promise<ESPNEvent[]> {
    try {
      console.log(`[ESPN API] Searching for events with team: ${teamName}`)

      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const matchingEvents: ESPNEvent[] = []

      const leaguesToCheck = sport 
        ? [{ sport, league: this.getDefaultLeague(sport) }]
        : [
            { sport: 'football', league: 'nfl' },
            { sport: 'basketball', league: 'nba' },
            { sport: 'baseball', league: 'mlb' },
            { sport: 'hockey', league: 'nhl' }
          ]

      for (const { sport, league } of leaguesToCheck) {
        try {
          const scoreboard = await this.getScoreboard(sport, league, { dates: today })
          
          const matches = scoreboard.events.filter(event =>
            event.name.toLowerCase().includes(teamName.toLowerCase()) ||
            event.shortName.toLowerCase().includes(teamName.toLowerCase())
          )
          
          matchingEvents.push(...matches)
        } catch (error) {
          console.error(`[ESPN API] Error searching ${sport}/${league}:`, error)
        }
      }

      console.log(`[ESPN API] Found ${matchingEvents.length} matching events`)
      return matchingEvents
    } catch (error) {
      console.error('[ESPN API] Error searching events:', error)
      return []
    }
  }

  /**
   * Get default league for a sport
   */
  private getDefaultLeague(sport: string): string {
    const leagueMap: Record<string, string> = {
      'football': 'nfl',
      'basketball': 'nba',
      'baseball': 'mlb',
      'hockey': 'nhl',
      'soccer': 'usa.1'
    }

    return leagueMap[sport.toLowerCase()] || sport
  }

  /**
   * Format date for ESPN API (YYYYMMDD)
   */
  public static formatDate(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '')
  }

  /**
   * Get today's date in ESPN format
   */
  public static getTodayFormatted(): string {
    return ESPNApiClient.formatDate(new Date())
  }

  /**
   * Get supported sports
   */
  public getSupportedSports(): string[] {
    return [...this.SUPPORTED_SPORTS]
  }
}

/**
 * Create and export a singleton instance
 */
export const espnApi = new ESPNApiClient()

/**
 * Check if ESPN API is available (always true since it's public)
 */
export function isESPNApiAvailable(): boolean {
  return true
}
