

/**
 * NFHS Network API Integration Service
 * Free access to high school sports data and streaming information
 */

export interface NFHSGame {
  id: string
  homeTeam: {
    name: string
    school: string
    city: string
    state: string
  }
  awayTeam: {
    name: string
    school: string
    city: string
    state: string
  }
  sport: string
  league: string
  division?: string
  date: string
  time: string
  venue: string
  status: 'scheduled' | 'live' | 'completed'
  streamUrl?: string
  isNFHSNetwork: boolean
  ticketInfo?: string
  homeScore?: number
  awayScore?: number
}

export interface NFHSSchool {
  id: string
  name: string
  city: string
  state: string
  district?: string
  conferences: string[]
  sports: string[]
}

class NFHSAPIService {
  private readonly baseUrl = 'https://www.nfhsnetwork.com'
  private readonly timeout = 15000

  /**
   * Fetch with timeout and error handling
   */
  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Sports-Bar-AI-Assistant/1.0',
          'Accept': 'application/json, text/html',
          ...options?.headers,
        }
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  /**
   * NFHS data fetcher with real streaming integration only
   * Only returns actual data from NFHS Network sources
   */
  async getHighSchoolGames(
    state?: string, 
    sport?: string, 
    startDate?: string, 
    endDate?: string
  ): Promise<NFHSGame[]> {
    try {
      // Only attempt to get real NFHS Network data via web scraping/API
      const realGames = await this.fetchRealNFHSData(state, sport, startDate, endDate)
      
      if (realGames && realGames.length > 0) {
        console.log(`✅ Successfully fetched ${realGames.length} NFHS Network games`)
        return realGames
      }
      
      // No fallback to mock data - return empty array if no real data available
      console.log('ℹ️ No real NFHS data available for the requested criteria')
      return []
    } catch (error) {
      console.error('Error fetching NFHS games:', error)
      // No fallback to mock data - return empty array on error
      return []
    }
  }

  /**
   * Get games by location (zip code or city/state) - real data only
   */
  async getGamesByLocation(
    zipCode?: string,
    city?: string,
    state?: string,
    radiusMiles: number = 50
  ): Promise<NFHSGame[]> {
    try {
      // Use the real NFHS data fetcher with location parameters
      const locationBasedGames = await this.fetchRealNFHSData(state, undefined, undefined, undefined)
      
      if (!locationBasedGames || locationBasedGames.length === 0) {
        console.log('ℹ️ No NFHS games found for the specified location')
        return []
      }
      
      // Filter by location if city is specified
      if (city) {
        const filteredGames = locationBasedGames.filter(game => 
          game.homeTeam.city.toLowerCase().includes(city.toLowerCase()) ||
          game.awayTeam.city.toLowerCase().includes(city.toLowerCase())
        )
        console.log(`✅ Found ${filteredGames.length} NFHS games near ${city}, ${state}`)
        return filteredGames
      }
      
      console.log(`✅ Found ${locationBasedGames.length} NFHS games in ${state}`)
      return locationBasedGames
    } catch (error) {
      console.error('Error fetching NFHS games by location:', error)
      return []
    }
  }

  /**
   * Get NFHS Network streaming games
   */
  async getNFHSNetworkStreams(sport?: string, date?: string): Promise<NFHSGame[]> {
    try {
      const games = await this.getHighSchoolGames(undefined, sport, date)
      return games.filter(game => game.isNFHSNetwork)
    } catch (error) {
      console.error('Error fetching NFHS Network streams:', error)
      return []
    }
  }

  /**
   * Search for schools by name or location - real data only
   */
  async searchSchools(query: string, state?: string): Promise<NFHSSchool[]> {
    try {
      // Attempt to get real school data from NFHS Network school directory
      console.log(`🏫 Searching for schools matching: "${query}" in ${state || 'all states'}`)
      
      // NFHS Network doesn't have a public school directory API
      // For real implementation, this would need to scrape their school directory
      // or use an official API if one becomes available
      
      // For now, return empty array as no real data source is available
      console.log('ℹ️ No real NFHS school directory API available')
      return []
    } catch (error) {
      console.error('Error searching schools:', error)
      return []
    }
  }

  /**
   * Attempt to fetch real NFHS Network streaming data
   * Enhanced approach to get actual streaming schedules from NFHS Network
   */
  private async fetchRealNFHSData(
    state?: string,
    sport?: string,
    startDate?: string,
    endDate?: string
  ): Promise<NFHSGame[]> {
    try {
      console.log(`🏫 Attempting to fetch real NFHS data for ${state || 'all states'}, sport: ${sport || 'all sports'}`)
      
      // Try multiple real data sources for NFHS Network
      const dataSources = [
        // Method 1: Try potential NFHS API endpoints
        () => this.tryNFHSApiEndpoints(state, sport, startDate, endDate),
        
        // Method 2: Try to scrape live streams
        () => this.scrapeNFHSLiveStreams(),
        
        // Method 3: Try to get schedule data from feeds
        () => this.tryNFHSScheduleFeeds(state, sport, startDate, endDate),
        
        // Method 4: Try mobile API endpoints
        () => this.tryNFHSMobileApi(state, sport, startDate, endDate)
      ]
      
      for (const [index, dataSource] of dataSources.entries()) {
        try {
          console.log(`🔍 Trying NFHS data source method ${index + 1}...`)
          const games = await dataSource()
          if (games && games.length > 0) {
            console.log(`✅ Found ${games.length} real NFHS games using method ${index + 1}`)
            return games
          }
        } catch (methodError) {
          console.log(`❌ NFHS data source method ${index + 1} failed:`, methodError.message)
          continue
        }
      }

      console.log('ℹ️ No real NFHS data found from any source')
      return []
    } catch (error) {
      console.error('Error fetching real NFHS data:', error)
      return []
    }
  }
  
  /**
   * Try various NFHS API endpoints that might exist
   */
  private async tryNFHSApiEndpoints(
    state?: string,
    sport?: string,
    startDate?: string,
    endDate?: string
  ): Promise<NFHSGame[]> {
    const searchParams = new URLSearchParams()
    if (state) searchParams.set('state', state)
    if (sport) searchParams.set('sport', sport)
    if (startDate) searchParams.set('start', startDate)
    if (endDate) searchParams.set('end', endDate)

    // Try known/potential NFHS endpoints
    const endpoints = [
      `/api/schedule?${searchParams.toString()}`,
      `/api/events?${searchParams.toString()}`,
      `/api/games?${searchParams.toString()}`,
      `/feed/schedule.json?${searchParams.toString()}`,
      `/data/schedule?${searchParams.toString()}`
    ]
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
          headers: {
            'Accept': 'application/json',
            'Referer': 'https://www.nfhsnetwork.com',
            'User-Agent': 'Mozilla/5.0 (compatible; Sports-Bar-AI/1.0)',
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data && (data.games || data.events || data.schedule)) {
            return this.parseNFHSApiResponse(data.games || data.events || data.schedule)
          }
        }
      } catch (error) {
        console.log(`NFHS endpoint ${endpoint} failed:`, error.message)
        continue
      }
    }
    
    return []
  }
  
  /**
   * Try NFHS schedule feeds (RSS, JSON feeds)
   */
  private async tryNFHSScheduleFeeds(
    state?: string,
    sport?: string,
    startDate?: string,
    endDate?: string
  ): Promise<NFHSGame[]> {
    // Try RSS feeds or other structured data feeds
    const feedUrls = [
      '/feeds/schedule.rss',
      '/feeds/events.json',
      '/api/v2/events',
      '/data/live-events.json'
    ]
    
    for (const feedUrl of feedUrls) {
      try {
        const response = await this.fetchWithTimeout(`${this.baseUrl}${feedUrl}`, {
          headers: {
            'Accept': 'application/json, application/rss+xml',
            'User-Agent': 'Mozilla/5.0 (compatible; Sports-Bar-AI/1.0)',
          }
        })
        
        if (response.ok) {
          const contentType = response.headers.get('content-type') || ''
          
          if (contentType.includes('application/json')) {
            const data = await response.json()
            if (data && Array.isArray(data)) {
              return this.parseNFHSApiResponse(data)
            }
          }
        }
      } catch (error) {
        console.log(`NFHS feed ${feedUrl} failed:`, error.message)
        continue
      }
    }
    
    return []
  }
  
  /**
   * Try NFHS mobile API endpoints
   */
  private async tryNFHSMobileApi(
    state?: string,
    sport?: string,
    startDate?: string,
    endDate?: string
  ): Promise<NFHSGame[]> {
    const mobileEndpoints = [
      '/mobile/api/events',
      '/app/api/schedule',
      '/api/mobile/games',
      '/v1/mobile/events'
    ]
    
    for (const endpoint of mobileEndpoints) {
      try {
        const response = await this.fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'NFHSNetwork/1.0 (Mobile)',
            'X-Requested-With': 'XMLHttpRequest'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data && (data.events || data.games)) {
            return this.parseNFHSApiResponse(data.events || data.games)
          }
        }
      } catch (error) {
        console.log(`NFHS mobile endpoint ${endpoint} failed:`, error.message)
        continue
      }
    }
    
    return []
  }

  /**
   * Parse NFHS API response into our game format
   */
  private parseNFHSApiResponse(apiGames: any[]): NFHSGame[] {
    return apiGames.map((apiGame: any) => ({
      id: `nfhs-real-${apiGame.id || Math.random()}`,
      homeTeam: {
        name: apiGame.home_team?.name || 'Home Team',
        school: apiGame.home_team?.school || 'Unknown School',
        city: apiGame.home_team?.city || 'Unknown City',
        state: apiGame.home_team?.state || 'Unknown State'
      },
      awayTeam: {
        name: apiGame.away_team?.name || 'Away Team',
        school: apiGame.away_team?.school || 'Unknown School',
        city: apiGame.away_team?.city || 'Unknown City',
        state: apiGame.away_team?.state || 'Unknown State'
      },
      sport: apiGame.sport || 'Unknown Sport',
      league: apiGame.league || 'High School',
      division: apiGame.division,
      date: apiGame.date || new Date().toISOString().split('T')[0],
      time: apiGame.time || '7:00 PM',
      venue: apiGame.venue || 'Unknown Venue',
      status: apiGame.status || 'scheduled',
      streamUrl: apiGame.stream_url,
      isNFHSNetwork: apiGame.is_streaming || false,
      homeScore: apiGame.home_score,
      awayScore: apiGame.away_score,
      ticketInfo: apiGame.ticket_info
    }))
  }

  /**
   * Scrape NFHS Network for live streaming games
   */
  private async scrapeNFHSLiveStreams(): Promise<NFHSGame[]> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/`, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      })

      if (!response.ok) return []

      const html = await response.text()
      
      // Simple HTML parsing to find live games
      // In a real implementation, you'd use a proper HTML parser like jsdom
      const liveGameMatches = html.match(/live.*?game.*?stream/gi) || []
      
      if (liveGameMatches.length > 0) {
        console.log(`Found ${liveGameMatches.length} potential live streams`)
        // This is a simplified approach - in production you'd parse the actual HTML structure
      }

      return []
    } catch (error) {
      console.error('Error scraping NFHS live streams:', error)
      return []
    }
  }

  /**
   * Mock data generation removed - only real data sources supported
   * This method has been removed to ensure only live data is used
   */



  private getVenueType(sport: string): string {
    switch (sport.toLowerCase()) {
      case 'football': return 'Stadium'
      case 'basketball': return 'Gymnasium'
      case 'volleyball': return 'Gymnasium'
      case 'soccer': return 'Soccer Field'
      case 'baseball': return 'Baseball Diamond'
      case 'softball': return 'Softball Field'
      case 'swimming': return 'Aquatic Center'
      case 'tennis': return 'Tennis Courts'
      case 'track and field': return 'Track Complex'
      case 'wrestling': return 'Gymnasium'
      default: return 'Athletic Facility'
    }
  }

  /**
   * Get live/streaming games currently available on NFHS Network
   */
  async getLiveStreams(): Promise<NFHSGame[]> {
    try {
      const allGames = await this.getHighSchoolGames()
      const now = new Date()
      
      return allGames.filter(game => {
        if (!game.isNFHSNetwork) return false
        
        const gameDateTime = new Date(`${game.date} ${game.time}`)
        const timeDiff = Math.abs(now.getTime() - gameDateTime.getTime())
        const hoursDiff = timeDiff / (1000 * 60 * 60)
        
        // Consider games "live" if they're within 3 hours of start time
        return hoursDiff <= 3
      })
    } catch (error) {
      console.error('Error fetching live NFHS streams:', error)
      return []
    }
  }

  /**
   * Get upcoming NFHS Network streaming schedule
   */
  async getUpcomingStreams(days: number = 7): Promise<NFHSGame[]> {
    try {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + days)
      
      const games = await this.getHighSchoolGames(
        undefined, 
        undefined,
        new Date().toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )
      
      return games
        .filter(game => game.isNFHSNetwork)
        .sort((a, b) => {
          const dateA = new Date(`${a.date} ${a.time}`)
          const dateB = new Date(`${b.date} ${b.time}`)
          return dateA.getTime() - dateB.getTime()
        })
    } catch (error) {
      console.error('Error fetching upcoming NFHS streams:', error)
      return []
    }
  }
}

export const nfhsAPI = new NFHSAPIService()
