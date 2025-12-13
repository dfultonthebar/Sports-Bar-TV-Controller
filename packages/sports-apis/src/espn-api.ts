
/**
 * ESPN API Integration Service
 * Free access to live sports data without API keys
 *
 * Updated with request throttling, rate limiting, and intelligent caching
 */

import { espnThrottler } from '@sports-bar/rate-limiting'
import { cacheManager } from '@sports-bar/cache-manager'
import { createCircuitBreaker } from '@sports-bar/circuit-breaker'
import type CircuitBreaker from 'opossum'
import { logger } from '@sports-bar/logger'
export interface ESPNGame {
  id: string
  uid: string
  date: string
  name: string
  shortName: string
  season: {
    year: number
    type: number
  }
  competitions: Array<{
    id: string
    uid: string
    date: string
    attendance: number
    type: {
      id: string
      abbreviation: string
    }
    timeValid: boolean
    neutralSite: boolean
    conferenceCompetition: boolean
    recent: boolean
    competitors: Array<{
      id: string
      uid: string
      type: string
      order: number
      homeAway: string
      team: {
        id: string
        uid: string
        location: string
        name: string
        abbreviation: string
        displayName: string
        shortDisplayName: string
        color: string
        alternateColor: string
        isActive: boolean
        logos: Array<{
          href: string
          width: number
          height: number
        }>
      }
      score: string
      linescores?: Array<{
        value: number
        displayValue: string
      }>
      statistics?: any[]
      records?: Array<{
        name: string
        abbreviation: string
        type: string
        summary: string
      }>
    }>
    status: {
      clock: number
      displayClock: string
      period: number
      type: {
        id: string
        name: string
        state: string
        completed: boolean
        description: string
        detail: string
        shortDetail: string
      }
    }
    broadcasts?: Array<{
      market: string
      names: string[]
    }>
  }>
  links: Array<{
    language: string
    rel: string[]
    href: string
    text: string
    shortText: string
    isExternal: boolean
    isPremium: boolean
  }>
}

export interface ESPNScheduleResponse {
  leagues: Array<{
    id: string
    uid: string
    name: string
    abbreviation: string
    shortName: string
  }>
  season: {
    year: number
    type: number
  }
  week?: {
    number: number
    text: string
  }
  events: ESPNGame[]
}

class ESPNAPIService {
  private readonly baseUrl = 'https://site.api.espn.com/apis/site/v2/sports'
  private readonly timeout = 10000
  private circuitBreaker: CircuitBreaker<[string, RequestInit?], Response>

  constructor() {
    // Create circuit breaker for ESPN API calls with fallback
    this.circuitBreaker = createCircuitBreaker<Response>(
      async (url: string, options?: RequestInit) => this.fetchWithoutCircuitBreaker(url, options),
      {
        name: 'espn-api',
        timeout: this.timeout,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        rollingCountTimeout: 60000,
        volumeThreshold: 10
      },
      async (url: string) => {
        // Fallback: Return a mock response indicating service unavailable
        return new Response(JSON.stringify({ events: [] }), {
          status: 503,
          statusText: 'Service Unavailable - Circuit Breaker Open',
          headers: { 'Content-Type': 'application/json' }
        })
      }
    ) as CircuitBreaker<[string, RequestInit?], Response>
  }

  /**
   * Fetch with timeout, error handling, and request throttling (without circuit breaker)
   * Used internally by circuit breaker
   */
  private async fetchWithoutCircuitBreaker(url: string, options?: RequestInit): Promise<Response> {
    return espnThrottler.execute(async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'User-Agent': 'Sports-Bar-AI-Assistant/1.0',
            ...options?.headers,
          }
        })
        clearTimeout(timeoutId)
        return response
      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }
    }, 'espn-api')
  }

  /**
   * Fetch with timeout, error handling, request throttling, and circuit breaker protection
   */
  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    return this.circuitBreaker.fire(url, options)
  }

  /**
   * Get NFL games for a specific date or date range
   */
  async getNFLGames(date?: string): Promise<ESPNGame[]> {
    const cacheKey = `nfl-${date || 'today'}`

    // Try cache first
    return await cacheManager.getOrSet(
      'sports-data',
      cacheKey,
      async () => {
        try {
          const dateParam = date ? `?dates=${date.replace(/-/g, '')}` : ''
          const url = `${this.baseUrl}/football/nfl/scoreboard${dateParam}`

          const response = await this.fetchWithTimeout(url)
          if (!response.ok) {
            throw new Error(`ESPN API error: ${response.status}`)
          }

          const data: ESPNScheduleResponse = await response.json()
          return data.events || []
        } catch (error) {
          logger.error('Error fetching NFL games from ESPN:', error)
          return []
        }
      }
    )
  }

  /**
   * Get NBA games for a specific date or date range
   */
  async getNBAGames(date?: string): Promise<ESPNGame[]> {
    try {
      const dateParam = date ? `?dates=${date.replace(/-/g, '')}` : ''
      const url = `${this.baseUrl}/basketball/nba/scoreboard${dateParam}`
      
      const response = await this.fetchWithTimeout(url)
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`)
      }
      
      const data: ESPNScheduleResponse = await response.json()
      return data.events || []
    } catch (error) {
      logger.error('Error fetching NBA games from ESPN:', error)
      return []
    }
  }

  /**
   * Get MLB games for a specific date or date range
   */
  async getMLBGames(date?: string): Promise<ESPNGame[]> {
    try {
      const dateParam = date ? `?dates=${date.replace(/-/g, '')}` : ''
      const url = `${this.baseUrl}/baseball/mlb/scoreboard${dateParam}`
      
      const response = await this.fetchWithTimeout(url)
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`)
      }
      
      const data: ESPNScheduleResponse = await response.json()
      return data.events || []
    } catch (error) {
      logger.error('Error fetching MLB games from ESPN:', error)
      return []
    }
  }

  /**
   * Get NHL games for a specific date or date range
   */
  async getNHLGames(date?: string): Promise<ESPNGame[]> {
    try {
      const dateParam = date ? `?dates=${date.replace(/-/g, '')}` : ''
      const url = `${this.baseUrl}/hockey/nhl/scoreboard${dateParam}`
      
      const response = await this.fetchWithTimeout(url)
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`)
      }
      
      const data: ESPNScheduleResponse = await response.json()
      return data.events || []
    } catch (error) {
      logger.error('Error fetching NHL games from ESPN:', error)
      return []
    }
  }

  /**
   * Get College Football games
   */
  async getCollegeFootballGames(date?: string): Promise<ESPNGame[]> {
    try {
      const dateParam = date ? `?dates=${date.replace(/-/g, '')}` : ''
      const url = `${this.baseUrl}/football/college-football/scoreboard${dateParam}`
      
      const response = await this.fetchWithTimeout(url)
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`)
      }
      
      const data: ESPNScheduleResponse = await response.json()
      return data.events || []
    } catch (error) {
      logger.error('Error fetching College Football games from ESPN:', error)
      return []
    }
  }

  /**
   * Get College Basketball games
   */
  async getCollegeBasketballGames(date?: string): Promise<ESPNGame[]> {
    try {
      const dateParam = date ? `?dates=${date.replace(/-/g, '')}` : ''
      const url = `${this.baseUrl}/basketball/mens-college-basketball/scoreboard${dateParam}`
      
      const response = await this.fetchWithTimeout(url)
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`)
      }
      
      const data: ESPNScheduleResponse = await response.json()
      return data.events || []
    } catch (error) {
      logger.error('Error fetching College Basketball games from ESPN:', error)
      return []
    }
  }

  // Big Ten Conference teams for filtering
  private readonly BIG_TEN_TEAMS = [
    'Illinois', 'Indiana', 'Iowa', 'Maryland', 'Michigan', 'Michigan State',
    'Minnesota', 'Nebraska', 'Northwestern', 'Ohio State', 'Oregon',
    'Penn State', 'Purdue', 'Rutgers', 'UCLA', 'USC', 'Washington', 'Wisconsin'
  ]

  // ESPN Conference ID for Big Ten
  private readonly BIG_TEN_CONFERENCE_ID = '7'

  /**
   * Check if a game involves a Big Ten team
   */
  private isBigTenGame(game: ESPNGame): boolean {
    const competitors = game.competitions?.[0]?.competitors || []
    return competitors.some(competitor => {
      const team = competitor.team
      // Check by conference ID or team name
      if ((team as any).conferenceId === this.BIG_TEN_CONFERENCE_ID) return true
      // Fallback to name matching
      return this.BIG_TEN_TEAMS.some(bigTenTeam =>
        team.displayName?.includes(bigTenTeam) ||
        team.location?.includes(bigTenTeam)
      )
    })
  }

  /**
   * Get Big Ten Basketball games (using ESPN conference group filter)
   * Group 7 = Big Ten Conference for basketball
   */
  async getBigTenBasketballGames(date?: string): Promise<ESPNGame[]> {
    try {
      const dateParam = date ? `&dates=${date.replace(/-/g, '')}` : ''
      const url = `${this.baseUrl}/basketball/mens-college-basketball/scoreboard?groups=7${dateParam}`

      const response = await this.fetchWithTimeout(url)
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`)
      }

      const data: ESPNScheduleResponse = await response.json()
      const games = data.events || []
      logger.info(`[ESPN API] Found ${games.length} Big Ten basketball games`)
      return games
    } catch (error) {
      logger.error('Error fetching Big Ten Basketball games from ESPN:', error)
      return []
    }
  }

  /**
   * Get Big Ten Football games (using ESPN conference group filter)
   * Group 5 = Big Ten Conference for football
   */
  async getBigTenFootballGames(date?: string): Promise<ESPNGame[]> {
    try {
      const dateParam = date ? `&dates=${date.replace(/-/g, '')}` : ''
      const url = `${this.baseUrl}/football/college-football/scoreboard?groups=5${dateParam}`

      const response = await this.fetchWithTimeout(url)
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`)
      }

      const data: ESPNScheduleResponse = await response.json()
      const games = data.events || []
      logger.info(`[ESPN API] Found ${games.length} Big Ten football games`)
      return games
    } catch (error) {
      logger.error('Error fetching Big Ten Football games from ESPN:', error)
      return []
    }
  }

  /**
   * Get all Big Ten games (basketball + football) for a date
   */
  async getBigTenGames(date?: string): Promise<{ sport: string; games: ESPNGame[] }[]> {
    const [basketball, football] = await Promise.all([
      this.getBigTenBasketballGames(date),
      this.getBigTenFootballGames(date)
    ])

    return [
      { sport: 'Basketball', games: basketball },
      { sport: 'Football', games: football }
    ].filter(item => item.games.length > 0)
  }

  /**
   * Get MLS games
   */
  async getMLSGames(date?: string): Promise<ESPNGame[]> {
    try {
      const dateParam = date ? `?dates=${date.replace(/-/g, '')}` : ''
      const url = `${this.baseUrl}/soccer/usa.1/scoreboard${dateParam}`
      
      const response = await this.fetchWithTimeout(url)
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`)
      }
      
      const data: ESPNScheduleResponse = await response.json()
      return data.events || []
    } catch (error) {
      logger.error('Error fetching MLS games from ESPN:', error)
      return []
    }
  }

  /**
   * Get games for all available leagues for a specific date
   */
  async getAllGamesForDate(date: string): Promise<{ league: string; games: ESPNGame[] }[]> {
    const results = await Promise.allSettled([
      this.getNFLGames(date).then(games => ({ league: 'NFL', games })),
      this.getNBAGames(date).then(games => ({ league: 'NBA', games })),
      this.getMLBGames(date).then(games => ({ league: 'MLB', games })),
      this.getNHLGames(date).then(games => ({ league: 'NHL', games })),
      this.getCollegeFootballGames(date).then(games => ({ league: 'NCAA Football', games })),
      this.getCollegeBasketballGames(date).then(games => ({ league: 'NCAA Basketball', games })),
      this.getMLSGames(date).then(games => ({ league: 'MLS', games }))
    ])

    return results
      .filter((result): result is PromiseFulfilledResult<{ league: string; games: ESPNGame[] }> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value)
  }

  /**
   * Get games for multiple dates (date range)
   */
  async getGamesForDateRange(startDate: string, endDate: string): Promise<{ league: string; games: ESPNGame[] }[]> {
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    const allGames: { league: string; games: ESPNGame[] }[] = []
    
    for (const date of dates) {
      try {
        const dailyGames = await this.getAllGamesForDate(date)
        dailyGames.forEach(({ league, games }) => {
          const existingLeague = allGames.find(item => item.league === league)
          if (existingLeague) {
            existingLeague.games.push(...games)
          } else {
            allGames.push({ league, games })
          }
        })

        // No manual delay needed - throttler handles this
      } catch (error) {
        logger.error(`Error fetching games for date ${date}:`, error)
      }
    }

    return allGames
  }

  /**
   * Get throttler metrics for monitoring
   */
  getMetrics() {
    return espnThrottler.getMetrics('espn-api')
  }
}

export const espnAPI = new ESPNAPIService()
