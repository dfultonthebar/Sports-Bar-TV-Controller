

/**
 * Enhanced Live Sports Service
 * Integrates ESPN API, The Sports DB, NFHS Network, and NFL Sunday Ticket
 */

import { espnAPI, ESPNGame } from './espn-api'
import { sportsDBAPI, SportsDBEvent } from './thesportsdb-api'
import { nfhsAPI, NFHSGame } from './nfhs-api'
import { nflSundayTicketService, SundayTicketGame } from './nfl-sunday-ticket'

export interface EnhancedUnifiedGame {
  id: string
  league: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  gameDate: string
  status: 'upcoming' | 'live' | 'completed'
  homeScore?: string | number
  awayScore?: string | number
  venue?: string
  broadcast?: string[]
  description?: string
  priority?: 'high' | 'medium' | 'low'
  source: 'espn' | 'sportsdb' | 'nfhs' | 'sunday-ticket'
  category: 'professional' | 'college' | 'high-school' | 'international'
  isNFHSStream?: boolean
  isSundayTicketExclusive?: boolean
  isRedZoneEligible?: boolean
  streamUrl?: string
  marketRestrictions?: string[]
  channel: {
    id: string
    name: string
    platforms: string[]
    type: 'cable' | 'streaming' | 'ota' | 'satellite'
    cost: 'free' | 'subscription' | 'premium'
    channelNumber?: string
    deviceType?: 'cable' | 'satellite' | 'streaming' | 'gaming'
  }
}

export interface EnhancedSportsDataResponse {
  games: EnhancedUnifiedGame[]
  totalGames: number
  liveGames: number
  upcomingGames: number
  completedGames: number
  sources: string[]
  categories: {
    professional: number
    college: number
    highSchool: number
    international: number
  }
  sundayTicketGames: number
  nfhsStreamingGames: number
}

// Enhanced channel mappings including NFHS and Sunday Ticket
const ENHANCED_CHANNEL_MAPPINGS: Record<string, any> = {
  'NFHS Network': {
    id: 'nfhs-network',
    name: 'NFHS Network',
    platforms: ['NFHS Network App', 'Web Browser', 'Roku', 'Apple TV'],
    type: 'streaming',
    cost: 'subscription',
    deviceType: 'streaming'
  },
  'NFL Sunday Ticket': {
    id: 'nfl-sunday-ticket',
    name: 'NFL Sunday Ticket',
    platforms: ['DirecTV', 'DirecTV Stream', 'Sunday Ticket App'],
    type: 'satellite',
    cost: 'premium',
    deviceType: 'satellite'
  },
  'NFL RedZone': {
    id: 'nfl-redzone',
    name: 'NFL RedZone',
    platforms: ['DirecTV Ch. 213', 'Sunday Ticket Package'],
    type: 'satellite',
    cost: 'premium',
    channelNumber: '213',
    deviceType: 'satellite'
  },
  'ESPN': {
    id: 'espn',
    name: 'ESPN',
    platforms: ['DirecTV Ch. 206', 'Spectrum Ch. 300', 'Hulu Live TV', 'YouTube TV'],
    type: 'cable',
    cost: 'subscription',
    channelNumber: '206',
    deviceType: 'cable'
  }
  // ... other existing mappings
}

class EnhancedLiveSportsService {
  /**
   * Get comprehensive live games from all sources
   */
  async getEnhancedLiveGames(
    selectedLeagues: string[],
    location?: { state?: string, city?: string, zipCode?: string },
    startDate?: string,
    endDate?: string
  ): Promise<EnhancedSportsDataResponse> {
    const allGames: EnhancedUnifiedGame[] = []
    const sources: Set<string> = new Set()
    
    // Set default date range
    const today = startDate || new Date().toISOString().split('T')[0]
    const weekFromToday = endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    try {
      // 1. Fetch ESPN data for professional/college sports
      if (selectedLeagues.some(league => 
        ['nfl', 'nba', 'mlb', 'nhl', 'ncaa-fb', 'ncaa-bb', 'mls'].includes(league)
      )) {
        console.log('Fetching ESPN data...')
        const espnData = await espnAPI.getGamesForDateRange(today, weekFromToday)
        
        espnData.forEach(({ league, games }) => {
          const leagueKey = this.getLeagueKey(league)
          if (selectedLeagues.includes(leagueKey)) {
            games.forEach(game => {
              allGames.push(this.convertESPNGame(game))
              sources.add('ESPN API')
            })
          }
        })

        // 2. Process NFL games for Sunday Ticket identification
        if (selectedLeagues.includes('nfl')) {
          console.log('Identifying NFL Sunday Ticket games...')
          const nflGames = espnData.find(d => d.league === 'NFL')?.games || []
          const sundayTicketGames = nflSundayTicketService.identifySundayTicketGames(nflGames)
          
          sundayTicketGames.forEach(game => {
            allGames.push(this.convertSundayTicketGame(game))
            sources.add('NFL Sunday Ticket')
          })
        }
      }

      // 3. Fetch international sports data
      if (selectedLeagues.some(league => 
        ['premier', 'champions', 'la-liga', 'serie-a', 'bundesliga'].includes(league)
      )) {
        console.log('Fetching TheSportsDB data...')
        const sportsDBData = await sportsDBAPI.getSoccerEventsForDateRange(today, weekFromToday)
        
        sportsDBData.forEach(({ league, events }) => {
          const leagueKey = this.getLeagueKey(league)
          if (selectedLeagues.includes(leagueKey)) {
            events.forEach(event => {
              allGames.push(this.convertSportsDBEvent(event))
              sources.add('TheSportsDB API')
            })
          }
        })
      }

      // 4. Fetch high school sports data (NFHS)
      if (selectedLeagues.includes('high-school') || selectedLeagues.includes('nfhs')) {
        console.log('Fetching NFHS Network data...')
        const nfhsGames = location 
          ? await nfhsAPI.getGamesByLocation(location.zipCode, location.city, location.state)
          : await nfhsAPI.getHighSchoolGames(location?.state)
        
        nfhsGames.forEach(game => {
          allGames.push(this.convertNFHSGame(game))
          sources.add('NFHS Network')
        })
      }

    } catch (error) {
      console.error('Error fetching enhanced sports data:', error)
    }

    // Sort by date and time
    allGames.sort((a, b) => {
      const dateTimeA = new Date(`${a.gameDate} ${a.gameTime}`)
      const dateTimeB = new Date(`${b.gameDate} ${b.gameTime}`)
      return dateTimeA.getTime() - dateTimeB.getTime()
    })

    // Calculate statistics
    const liveGames = allGames.filter(g => g.status === 'live').length
    const upcomingGames = allGames.filter(g => g.status === 'upcoming').length
    const completedGames = allGames.filter(g => g.status === 'completed').length

    const categories = {
      professional: allGames.filter(g => g.category === 'professional').length,
      college: allGames.filter(g => g.category === 'college').length,
      highSchool: allGames.filter(g => g.category === 'high-school').length,
      international: allGames.filter(g => g.category === 'international').length
    }

    const sundayTicketGames = allGames.filter(g => g.isSundayTicketExclusive).length
    const nfhsStreamingGames = allGames.filter(g => g.isNFHSStream).length

    return {
      games: allGames,
      totalGames: allGames.length,
      liveGames,
      upcomingGames,
      completedGames,
      sources: Array.from(sources),
      categories,
      sundayTicketGames,
      nfhsStreamingGames
    }
  }

  /**
   * Convert ESPN game to enhanced unified format
   */
  private convertESPNGame(game: ESPNGame): EnhancedUnifiedGame {
    const competition = game.competitions[0]
    const homeTeam = competition.competitors.find(c => c.homeAway === 'home')
    const awayTeam = competition.competitors.find(c => c.homeAway === 'away')
    
    let status: 'upcoming' | 'live' | 'completed' = 'upcoming'
    if (competition.status.type.completed) {
      status = 'completed'
    } else if (competition.status.type.state === 'in') {
      status = 'live'
    }

    const broadcasts = competition.broadcasts?.flatMap(b => b.names) || []
    const gameDate = new Date(game.date)
    const gameTime = gameDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    }) + ' EST'

    // Determine category
    const leagueName = game.name.split(' ')[0] || 'Unknown'
    let category: 'professional' | 'college' | 'high-school' | 'international' = 'professional'
    if (leagueName.toLowerCase().includes('college') || leagueName.toLowerCase().includes('ncaa')) {
      category = 'college'
    }

    return {
      id: game.id,
      league: leagueName,
      homeTeam: homeTeam?.team.displayName || 'TBD',
      awayTeam: awayTeam?.team.displayName || 'TBD',
      gameTime,
      gameDate: gameDate.toISOString().split('T')[0],
      status,
      homeScore: homeTeam?.score,
      awayScore: awayTeam?.score,
      venue: homeTeam?.team.location,
      broadcast: broadcasts,
      description: game.shortName,
      priority: status === 'live' ? 'high' : 'medium',
      source: 'espn',
      category,
      channel: this.getChannelMapping(broadcasts[0])
    }
  }

  /**
   * Convert NFHS game to enhanced unified format
   */
  private convertNFHSGame(game: NFHSGame): EnhancedUnifiedGame {
    // Convert NFHS game status to match the expected status type
    let status: 'upcoming' | 'live' | 'completed' = 'upcoming'
    if (game.status === 'completed') {
      status = 'completed'
    } else if (game.status === 'live') {
      status = 'live'
    } else { // 'scheduled' or any other status becomes 'upcoming'
      status = 'upcoming'
    }

    return {
      id: game.id,
      league: game.league,
      homeTeam: `${game.homeTeam.name} (${game.homeTeam.school})`,
      awayTeam: `${game.awayTeam.name} (${game.awayTeam.school})`,
      gameTime: game.time,
      gameDate: game.date,
      status,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      venue: game.venue,
      broadcast: game.isNFHSNetwork ? ['NFHS Network'] : undefined,
      description: `${game.sport} - ${game.division || 'High School'}`,
      priority: 'medium',
      source: 'nfhs',
      category: 'high-school',
      isNFHSStream: game.isNFHSNetwork,
      streamUrl: game.streamUrl,
      channel: game.isNFHSNetwork 
        ? ENHANCED_CHANNEL_MAPPINGS['NFHS Network']
        : {
            id: 'local-coverage',
            name: 'Local Coverage',
            platforms: ['At Venue', 'Local Broadcast'],
            type: 'ota',
            cost: 'free',
            deviceType: 'cable'
          }
    }
  }

  /**
   * Convert Sunday Ticket game to enhanced unified format
   */
  private convertSundayTicketGame(game: SundayTicketGame): EnhancedUnifiedGame {
    return {
      id: game.id,
      league: game.league,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      gameTime: game.gameTime,
      gameDate: game.gameDate,
      status: game.status,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      venue: game.venue,
      broadcast: game.broadcast,
      description: game.description,
      priority: game.priority,
      source: 'sunday-ticket',
      category: 'professional',
      isSundayTicketExclusive: game.isSundayTicketExclusive,
      isRedZoneEligible: game.isRedZoneEligible,
      marketRestrictions: game.marketRestrictions,
      channel: game.channel as any
    }
  }

  /**
   * Convert SportsDB event to enhanced unified format
   */
  private convertSportsDBEvent(event: SportsDBEvent): EnhancedUnifiedGame {
    const eventDate = new Date(event.dateEvent + (event.strTime ? ` ${event.strTime}` : ''))
    const now = new Date()
    
    let status: 'upcoming' | 'live' | 'completed' = 'upcoming'
    if (event.strStatus === 'Match Finished' || (event.intHomeScore && event.intAwayScore)) {
      status = 'completed'
    } else if (eventDate < now && !event.intHomeScore && !event.intAwayScore) {
      status = 'live'
    }

    const gameTime = eventDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    }) + ' EST'

    return {
      id: event.idEvent,
      league: event.strLeague,
      homeTeam: event.strHomeTeam,
      awayTeam: event.strAwayTeam,
      gameTime,
      gameDate: eventDate.toISOString().split('T')[0],
      status,
      homeScore: event.intHomeScore,
      awayScore: event.intAwayScore,
      venue: event.strVenue,
      broadcast: event.strTVStation ? [event.strTVStation] : undefined,
      description: event.strEvent,
      priority: status === 'live' ? 'high' : 'medium',
      source: 'sportsdb',
      category: 'international',
      channel: this.getChannelMapping(event.strTVStation)
    }
  }

  /**
   * Get channel mapping with enhanced support
   */
  private getChannelMapping(broadcastName?: string): any {
    if (!broadcastName) {
      return ENHANCED_CHANNEL_MAPPINGS['ESPN']
    }

    const upperBroadcast = broadcastName.toUpperCase()
    for (const [key, mapping] of Object.entries(ENHANCED_CHANNEL_MAPPINGS)) {
      if (upperBroadcast.includes(key.toUpperCase())) {
        return mapping
      }
    }

    return ENHANCED_CHANNEL_MAPPINGS['ESPN']
  }

  /**
   * Convert league name to key
   */
  private getLeagueKey(leagueName: string): string {
    const mapping: Record<string, string> = {
      'NFL': 'nfl',
      'NBA': 'nba',
      'MLB': 'mlb',
      'NHL': 'nhl',
      'NCAA Football': 'ncaa-fb',
      'NCAA Basketball': 'ncaa-bb',
      'MLS': 'mls',
      'Premier League': 'premier',
      'Champions League': 'champions',
      'La Liga': 'la-liga',
      'Serie A': 'serie-a',
      'Bundesliga': 'bundesliga'
    }
    
    return mapping[leagueName] || leagueName.toLowerCase().replace(/\s+/g, '-')
  }

  /**
   * Get NFHS streaming games
   */
  async getNFHSStreams(state?: string): Promise<EnhancedUnifiedGame[]> {
    try {
      const nfhsGames = await nfhsAPI.getUpcomingStreams()
      return nfhsGames.map(game => this.convertNFHSGame(game))
    } catch (error) {
      console.error('Error fetching NFHS streams:', error)
      return []
    }
  }

  /**
   * Get Sunday Ticket games
   */
  async getSundayTicketGames(): Promise<EnhancedUnifiedGame[]> {
    try {
      const sundayTicketGames = await nflSundayTicketService.getUpcomingSundayTicketGames()
      return sundayTicketGames.map(game => this.convertSundayTicketGame(game))
    } catch (error) {
      console.error('Error fetching Sunday Ticket games:', error)
      return []
    }
  }
}

export const enhancedLiveSportsService = new EnhancedLiveSportsService()
