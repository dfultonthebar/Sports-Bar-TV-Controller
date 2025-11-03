
/**
 * The Sports DB API Integration Service
 * Free access to sports data without API keys
 * Documentation: https://www.thesportsdb.com/api.php
 *
 * Updated with request throttling and rate limiting
 */

import { sportsDBThrottler } from '@/lib/rate-limiting/request-throttler'
import { createCircuitBreaker } from '@/lib/circuit-breaker'
import type { CircuitBreaker } from 'opossum'

export interface SportsDBTeam {
  idTeam: string
  idSoccerXML?: string
  idAPIfootball?: string
  intLoved?: string
  strTeam: string
  strTeamShort?: string
  strAlternate?: string
  intFormedYear?: string
  strSport: string
  strLeague: string
  idLeague: string
  strLeague2?: string
  idLeague2?: string
  strDivision?: string
  strManager?: string
  strStadium?: string
  strKeywords?: string
  strRSS?: string
  strStadiumThumb?: string
  strStadiumDescription?: string
  strStadiumLocation?: string
  intStadiumCapacity?: string
  strWebsite?: string
  strFacebook?: string
  strTwitter?: string
  strInstagram?: string
  strDescriptionEN?: string
  strGender?: string
  strCountry?: string
  strTeamBadge?: string
  strTeamJersey?: string
  strTeamLogo?: string
  strTeamFanart1?: string
  strTeamFanart2?: string
  strTeamFanart3?: string
  strTeamFanart4?: string
  strTeamBanner?: string
  strYoutube?: string
  strLocked?: string
}

export interface SportsDBEvent {
  idEvent: string
  idSoccerXML?: string
  idAPIfootball?: string
  strEvent: string
  strEventAlternate?: string
  strFilename?: string
  strSport: string
  idLeague: string
  strLeague: string
  strSeason: string
  strDescriptionEN?: string
  strHomeTeam: string
  strAwayTeam: string
  intHomeScore?: string
  intAwayScore?: string
  intRound?: string
  intSpectators?: string
  strHomeGoalDetails?: string
  strHomeRedCards?: string
  strHomeYellowCards?: string
  strHomeLineupGoalkeeper?: string
  strHomeLineupDefense?: string
  strHomeLineupMidfield?: string
  strHomeLineupForward?: string
  strHomeLineupSubstitutes?: string
  strAwayGoalDetails?: string
  strAwayRedCards?: string
  strAwayYellowCards?: string
  strAwayLineupGoalkeeper?: string
  strAwayLineupDefense?: string
  strAwayLineupMidfield?: string
  strAwayLineupForward?: string
  strAwayLineupSubstitutes?: string
  strDate: string
  strTime?: string
  dateEvent: string
  strTimeLocal?: string
  strTVStation?: string
  idHomeTeam: string
  idAwayTeam: string
  strResult?: string
  strVenue?: string
  strCountry?: string
  strCity?: string
  strPoster?: string
  strSquare?: string
  strFanart?: string
  strThumb?: string
  strBanner?: string
  strMap?: string
  strTweet1?: string
  strTweet2?: string
  strTweet3?: string
  strVideo?: string
  strStatus?: string
  strPostponed?: string
  strLocked?: string
}

export interface SportsDBLeague {
  idLeague: string
  strLeague: string
  strSport: string
  strLeagueAlternate?: string
  intDivision?: string
  idCup?: string
  strCurrentSeason?: string
  intFormedYear?: string
  dateFirstEvent?: string
  strGender?: string
  strCountry?: string
  strWebsite?: string
  strFacebook?: string
  strTwitter?: string
  strYoutube?: string
  strRSS?: string
  strDescriptionEN?: string
  strBadge?: string
  strBanner?: string
  strComplete?: string
  strLocked?: string
}

class SportsDBAPIService {
  private readonly baseUrl = 'https://www.thesportsdb.com/api/v1/json/3'
  private readonly timeout = 10000
  private circuitBreaker: CircuitBreaker<[string, RequestInit?], Response>

  constructor() {
    // Create circuit breaker for TheSportsDB API calls with fallback
    this.circuitBreaker = createCircuitBreaker(
      async (url: string, options?: RequestInit) => this.fetchWithoutCircuitBreaker(url, options),
      {
        name: 'thesportsdb-api',
        timeout: this.timeout,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        rollingCountTimeout: 60000,
        volumeThreshold: 10
      },
      async (url: string) => {
        // Fallback: Return empty response indicating service unavailable
        return new Response(JSON.stringify({ events: [], teams: [], leagues: [] }), {
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
    return sportsDBThrottler.execute(async () => {
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
    }, 'sportsdb-api')
  }

  /**
   * Fetch with timeout, error handling, request throttling, and circuit breaker protection
   */
  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    return this.circuitBreaker.fire(url, options)
  }

  /**
   * Get events for a team by team ID
   */
  async getTeamEvents(teamId: string): Promise<SportsDBEvent[]> {
    try {
      const url = `${this.baseUrl}/eventsnext.php?id=${teamId}`
      const response = await this.fetchWithTimeout(url)
      
      if (!response.ok) {
        throw new Error(`SportsDB API error: ${response.status}`)
      }
      
      const data = await response.json()
      return data.events || []
    } catch (error) {
      console.error('Error fetching team events from SportsDB:', error)
      return []
    }
  }

  /**
   * Get events by league and date
   */
  async getEventsByLeagueAndDate(leagueId: string, date: string): Promise<SportsDBEvent[]> {
    try {
      // Format date as YYYY-MM-DD
      const formattedDate = date.replace(/-/g, '-')
      const url = `${this.baseUrl}/eventsday.php?d=${formattedDate}&l=${leagueId}`
      const response = await this.fetchWithTimeout(url)
      
      if (!response.ok) {
        throw new Error(`SportsDB API error: ${response.status}`)
      }
      
      const data = await response.json()
      return data.events || []
    } catch (error) {
      console.error('Error fetching events by league and date:', error)
      return []
    }
  }

  /**
   * Get all leagues for a sport
   */
  async getLeaguesBySport(sport: string): Promise<SportsDBLeague[]> {
    try {
      const url = `${this.baseUrl}/all_leagues.php`
      const response = await this.fetchWithTimeout(url)
      
      if (!response.ok) {
        throw new Error(`SportsDB API error: ${response.status}`)
      }
      
      const data = await response.json()
      const allLeagues = data.leagues || []
      
      // Filter by sport
      return allLeagues.filter((league: SportsDBLeague) => 
        league.strSport.toLowerCase().includes(sport.toLowerCase())
      )
    } catch (error) {
      console.error('Error fetching leagues by sport:', error)
      return []
    }
  }

  /**
   * Search for teams by name
   */
  async searchTeams(teamName: string): Promise<SportsDBTeam[]> {
    try {
      const url = `${this.baseUrl}/searchteams.php?t=${encodeURIComponent(teamName)}`
      const response = await this.fetchWithTimeout(url)
      
      if (!response.ok) {
        throw new Error(`SportsDB API error: ${response.status}`)
      }
      
      const data = await response.json()
      return data.teams || []
    } catch (error) {
      console.error('Error searching teams:', error)
      return []
    }
  }

  /**
   * Get Premier League events for a specific date
   */
  async getPremierLeagueEvents(date: string): Promise<SportsDBEvent[]> {
    // Premier League ID in TheSportsDB
    return this.getEventsByLeagueAndDate('4328', date)
  }

  /**
   * Get Champions League events for a specific date
   */
  async getChampionsLeagueEvents(date: string): Promise<SportsDBEvent[]> {
    // Champions League ID in TheSportsDB
    return this.getEventsByLeagueAndDate('4480', date)
  }

  /**
   * Get La Liga events for a specific date
   */
  async getLaLigaEvents(date: string): Promise<SportsDBEvent[]> {
    // La Liga ID in TheSportsDB
    return this.getEventsByLeagueAndDate('4335', date)
  }

  /**
   * Get Serie A events for a specific date
   */
  async getSerieAEvents(date: string): Promise<SportsDBEvent[]> {
    // Serie A ID in TheSportsDB
    return this.getEventsByLeagueAndDate('4332', date)
  }

  /**
   * Get Bundesliga events for a specific date
   */
  async getBundesligaEvents(date: string): Promise<SportsDBEvent[]> {
    // Bundesliga ID in TheSportsDB
    return this.getEventsByLeagueAndDate('4331', date)
  }

  /**
   * Get events for all major soccer leagues for a specific date
   */
  async getAllSoccerEventsForDate(date: string): Promise<{ league: string; events: SportsDBEvent[] }[]> {
    const results = await Promise.allSettled([
      this.getPremierLeagueEvents(date).then(events => ({ league: 'Premier League', events })),
      this.getChampionsLeagueEvents(date).then(events => ({ league: 'Champions League', events })),
      this.getLaLigaEvents(date).then(events => ({ league: 'La Liga', events })),
      this.getSerieAEvents(date).then(events => ({ league: 'Serie A', events })),
      this.getBundesligaEvents(date).then(events => ({ league: 'Bundesliga', events }))
    ])

    return results
      .filter((result): result is PromiseFulfilledResult<{ league: string; events: SportsDBEvent[] }> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value)
  }

  /**
   * Get events for multiple dates (date range)
   */
  async getSoccerEventsForDateRange(startDate: string, endDate: string): Promise<{ league: string; events: SportsDBEvent[] }[]> {
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    const allEvents: { league: string; events: SportsDBEvent[] }[] = []
    
    for (const date of dates) {
      try {
        const dailyEvents = await this.getAllSoccerEventsForDate(date)
        dailyEvents.forEach(({ league, events }) => {
          const existingLeague = allEvents.find(item => item.league === league)
          if (existingLeague) {
            existingLeague.events.push(...events)
          } else {
            allEvents.push({ league, events })
          }
        })

        // No manual delay needed - throttler handles this
      } catch (error) {
        console.error(`Error fetching soccer events for date ${date}:`, error)
      }
    }

    return allEvents
  }

  /**
   * Get throttler metrics for monitoring
   */
  getMetrics() {
    return sportsDBThrottler.getMetrics('sportsdb-api')
  }
}

export const sportsDBAPI = new SportsDBAPIService()
