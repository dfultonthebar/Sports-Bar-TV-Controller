
/**
 * ESPN API Integration Service
 * Free access to live sports data without API keys
 *
 * Updated with request throttling, rate limiting, and intelligent caching
 */

import { espnThrottler } from '@/lib/rate-limiting/request-throttler'
import { cacheManager } from '../cache-manager'
import { createCircuitBreaker } from '@/lib/circuit-breaker'
import type { CircuitBreaker } from 'opossum'

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
    this.circuitBreaker = createCircuitBreaker(
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
    )
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
          console.error('Error fetching NFL games from ESPN:', error)
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
      console.error('Error fetching NBA games from ESPN:', error)
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
      console.error('Error fetching MLB games from ESPN:', error)
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
      console.error('Error fetching NHL games from ESPN:', error)
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
      console.error('Error fetching College Football games from ESPN:', error)
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
      console.error('Error fetching College Basketball games from ESPN:', error)
      return []
    }
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
      console.error('Error fetching MLS games from ESPN:', error)
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
        console.error(`Error fetching games for date ${date}:`, error)
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
