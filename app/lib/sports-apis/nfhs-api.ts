

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
   * Mock NFHS data generator for development/demonstration
   * In production, this would connect to actual NFHS Network APIs
   */
  async getHighSchoolGames(
    state?: string, 
    sport?: string, 
    startDate?: string, 
    endDate?: string
  ): Promise<NFHSGame[]> {
    try {
      // Generate mock high school sports data
      // In production, this would make actual API calls to NFHS Network
      return this.generateMockNFHSGames(state, sport, startDate, endDate)
    } catch (error) {
      console.error('Error fetching NFHS games:', error)
      return []
    }
  }

  /**
   * Get games by location (zip code or city/state)
   */
  async getGamesByLocation(
    zipCode?: string,
    city?: string,
    state?: string,
    radiusMiles: number = 50
  ): Promise<NFHSGame[]> {
    try {
      // Mock implementation - in production would use location-based API
      const mockState = state || 'WI' // Default to Wisconsin as mentioned in conversation
      return this.generateMockNFHSGames(mockState, undefined, undefined, undefined, radiusMiles)
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
   * Search for schools by name or location
   */
  async searchSchools(query: string, state?: string): Promise<NFHSSchool[]> {
    try {
      // Mock school search - in production would use actual NFHS school directory
      return this.generateMockSchools(query, state)
    } catch (error) {
      console.error('Error searching schools:', error)
      return []
    }
  }

  /**
   * Generate mock NFHS games for development
   */
  private generateMockNFHSGames(
    state?: string, 
    sport?: string, 
    startDate?: string, 
    endDate?: string,
    radiusMiles?: number
  ): NFHSGame[] {
    const games: NFHSGame[] = []
    const targetState = state || 'WI'
    
    const sports = sport ? [sport] : [
      'Football', 'Basketball', 'Volleyball', 'Soccer', 'Baseball', 
      'Softball', 'Wrestling', 'Track and Field', 'Swimming', 'Tennis'
    ]

    const wisConsimSchools = [
      { name: 'Madison West High School', city: 'Madison', team: 'Regents' },
      { name: 'Milwaukee Hamilton High School', city: 'Milwaukee', team: 'Chargers' },
      { name: 'Green Bay East High School', city: 'Green Bay', team: 'Red Devils' },
      { name: 'Appleton North High School', city: 'Appleton', team: 'Lightning' },
      { name: 'Eau Claire Memorial High School', city: 'Eau Claire', team: 'Old Abes' },
      { name: 'Kenosha Bradford High School', city: 'Kenosha', team: 'Red Devils' },
      { name: 'Waukesha West High School', city: 'Waukesha', team: 'Wolverines' },
      { name: 'Stevens Point High School', city: 'Stevens Point', team: 'Panthers' },
      { name: 'Oshkosh North High School', city: 'Oshkosh', team: 'Spartans' },
      { name: 'La Crosse Central High School', city: 'La Crosse', team: 'Red Raiders' }
    ]

    const conferences = [
      'Big Eight Conference',
      'Fox Valley Association', 
      'Wisconsin Valley Conference',
      'Southeast Conference',
      'North Shore Conference',
      'Metro Classic Conference'
    ]

    // Generate games for the next 7 days
    const today = new Date()
    for (let day = 0; day < 7; day++) {
      const gameDate = new Date(today)
      gameDate.setDate(gameDate.getDate() + day)
      
      sports.forEach(sportType => {
        const numGames = Math.floor(Math.random() * 3) + 1 // 1-3 games per sport per day
        
        for (let i = 0; i < numGames; i++) {
          const homeSchool = wisConsimSchools[Math.floor(Math.random() * wisConsimSchools.length)]
          let awaySchool = wisConsimSchools[Math.floor(Math.random() * wisConsimSchools.length)]
          while (awaySchool.name === homeSchool.name) {
            awaySchool = wisConsimSchools[Math.floor(Math.random() * wisConsimSchools.length)]
          }
          
          const conference = conferences[Math.floor(Math.random() * conferences.length)]
          const isNFHSStream = Math.random() > 0.6 // 40% chance of being streamed on NFHS Network
          
          const gameHour = Math.floor(Math.random() * 6) + 15 // Games between 3 PM and 8 PM
          const gameMinute = ['00', '30'][Math.floor(Math.random() * 2)]
          const displayHour = gameHour > 12 ? gameHour - 12 : gameHour
          const gameTime = `${displayHour}:${gameMinute} PM CST`
          
          games.push({
            id: `nfhs-${sportType.toLowerCase()}-${day}-${i}`,
            homeTeam: {
              name: homeSchool.team,
              school: homeSchool.name,
              city: homeSchool.city,
              state: targetState
            },
            awayTeam: {
              name: awaySchool.team,
              school: awaySchool.name,
              city: awaySchool.city,
              state: targetState
            },
            sport: sportType,
            league: `${targetState} High School ${sportType}`,
            division: conference,
            date: gameDate.toISOString().split('T')[0],
            time: gameTime,
            venue: `${homeSchool.name} ${this.getVenueType(sportType)}`,
            status: 'scheduled',
            streamUrl: isNFHSStream ? `https://www.nfhsnetwork.com/events/${sportType.toLowerCase()}-game-${Math.floor(Math.random() * 10000)}` : undefined,
            isNFHSNetwork: isNFHSStream,
            ticketInfo: Math.random() > 0.5 ? 'Tickets available at the door' : undefined
          })
        }
      })
    }

    return games.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`)
      const dateB = new Date(`${b.date} ${b.time}`)
      return dateA.getTime() - dateB.getTime()
    })
  }

  private generateMockSchools(query: string, state?: string): NFHSSchool[] {
    const mockSchools: NFHSSchool[] = [
      {
        id: 'madison-west',
        name: 'Madison West High School',
        city: 'Madison',
        state: state || 'WI',
        district: 'Madison Metropolitan School District',
        conferences: ['Big Eight Conference'],
        sports: ['Football', 'Basketball', 'Volleyball', 'Soccer', 'Swimming']
      },
      {
        id: 'milwaukee-hamilton',
        name: 'Milwaukee Hamilton High School', 
        city: 'Milwaukee',
        state: state || 'WI',
        district: 'Milwaukee Public Schools',
        conferences: ['Milwaukee City Conference'],
        sports: ['Football', 'Basketball', 'Track and Field', 'Wrestling']
      },
      {
        id: 'green-bay-east',
        name: 'Green Bay East High School',
        city: 'Green Bay',
        state: state || 'WI',
        district: 'Green Bay Area Public School District',
        conferences: ['Fox River Classic Conference'],
        sports: ['Football', 'Basketball', 'Hockey', 'Baseball', 'Softball']
      }
    ]

    if (query) {
      return mockSchools.filter(school => 
        school.name.toLowerCase().includes(query.toLowerCase()) ||
        school.city.toLowerCase().includes(query.toLowerCase())
      )
    }

    return mockSchools
  }

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
