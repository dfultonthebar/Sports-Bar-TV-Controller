
/**
 * Combined Live Sports Service
 * Integrates ESPN API and The Sports DB for comprehensive sports data
 */

import { espnAPI, ESPNGame } from './espn-api'
import { sportsDBAPI, SportsDBEvent } from './thesportsdb-api'
import { logger } from '@sports-bar/logger'
export interface UnifiedGame {
  id: string
  league: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  gameDate: string
  status: 'upcoming' | 'live' | 'completed'
  homeScore?: string
  awayScore?: string
  venue?: string
  broadcast?: string[]
  description?: string
  priority?: 'high' | 'medium' | 'low'
  source: 'espn' | 'sportsdb'
}

export interface ChannelMapping {
  id: string
  name: string
  platforms: string[]
  type: 'cable' | 'streaming' | 'ota'
  cost: 'free' | 'subscription' | 'premium'
  channelNumber?: string
  deviceType?: 'cable' | 'satellite' | 'streaming' | 'gaming'
}

// Channel mappings for broadcast networks
const CHANNEL_MAPPINGS: Record<string, ChannelMapping> = {
  'ESPN': {
    id: 'espn',
    name: 'ESPN',
    platforms: ['DirecTV Ch. 206', 'Spectrum Ch. 300', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    channelNumber: '206',
    deviceType: 'cable'
  },
  'ESPN2': {
    id: 'espn2',
    name: 'ESPN2',
    platforms: ['DirecTV Ch. 209', 'Spectrum Ch. 301', 'Hulu Live TV', 'YouTube TV', 'Sling TV'],
    type: 'cable',
    cost: 'subscription',
    channelNumber: '209',
    deviceType: 'cable'
  },
  'FOX': {
    id: 'fox',
    name: 'FOX (Local)',
    platforms: ['Antenna', 'Cable Ch. 5', 'DirecTV Ch. 5'],
    type: 'ota',
    cost: 'free',
    channelNumber: '5',
    deviceType: 'cable'
  },
  'CBS': {
    id: 'cbs',
    name: 'CBS (Local)',
    platforms: ['Antenna', 'Cable Ch. 2', 'DirecTV Ch. 2'],
    type: 'ota',
    cost: 'free',
    channelNumber: '2',
    deviceType: 'cable'
  },
  'NBC': {
    id: 'nbc',
    name: 'NBC (Local)',
    platforms: ['Antenna', 'Cable Ch. 4', 'DirecTV Ch. 4'],
    type: 'ota',
    cost: 'free',
    channelNumber: '4',
    deviceType: 'cable'
  },
  'TNT': {
    id: 'tnt',
    name: 'TNT',
    platforms: ['DirecTV Ch. 245', 'Spectrum Ch. 32', 'Hulu Live TV', 'YouTube TV', 'Max'],
    type: 'cable',
    cost: 'subscription',
    channelNumber: '245',
    deviceType: 'cable'
  },
  'TBS': {
    id: 'tbs',
    name: 'TBS',
    platforms: ['DirecTV Ch. 247', 'Spectrum Ch. 33', 'Hulu Live TV', 'YouTube TV'],
    type: 'cable',
    cost: 'subscription',
    channelNumber: '247',
    deviceType: 'cable'
  },
  'FS1': {
    id: 'fox-sports',
    name: 'Fox Sports 1 (FS1)',
    platforms: ['DirecTV Ch. 219', 'Spectrum Ch. 311', 'Hulu Live TV', 'YouTube TV', 'FuboTV'],
    type: 'cable',
    cost: 'subscription',
    channelNumber: '219',
    deviceType: 'satellite'
  }
}

class LiveSportsService {
  /**
   * Convert ESPN game to unified format
   */
  private convertESPNGame(game: ESPNGame): UnifiedGame {
    const competition = game.competitions[0]
    const homeTeam = competition.competitors.find(c => c.homeAway === 'home')
    const awayTeam = competition.competitors.find(c => c.homeAway === 'away')
    
    // Determine game status
    let status: 'upcoming' | 'live' | 'completed' = 'upcoming'
    if (competition.status.type.completed) {
      status = 'completed'
    } else if (competition.status.type.state === 'in') {
      status = 'live'
    }

    // Extract broadcast info
    const broadcasts = competition.broadcasts?.flatMap(b => b.names) || []
    
    // Format game time
    const gameDate = new Date(game.date)
    const gameTime = gameDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    }) + ' EST'

    return {
      id: game.id,
      league: game.name.split(' ')[0] || 'Unknown',
      homeTeam: homeTeam?.team.displayName || 'TBD',
      awayTeam: awayTeam?.team.displayName || 'TBD',
      gameTime,
      gameDate: gameDate.toISOString().split('T')[0],
      status,
      homeScore: homeTeam?.score,
      awayScore: awayTeam?.score,
      venue: competition.competitors[0]?.team.location,
      broadcast: broadcasts,
      description: game.shortName,
      priority: status === 'live' ? 'high' : status === 'upcoming' ? 'medium' : 'low',
      source: 'espn'
    }
  }

  /**
   * Convert SportsDB event to unified format
   */
  private convertSportsDBEvent(event: SportsDBEvent): UnifiedGame {
    // Parse date and time
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
      priority: status === 'live' ? 'high' : status === 'upcoming' ? 'medium' : 'low',
      source: 'sportsdb'
    }
  }

  /**
   * Get channel mapping for a broadcast network
   */
  private getChannelMapping(broadcastName?: string): ChannelMapping {
    if (!broadcastName) {
      // Default to ESPN if no broadcast info
      return CHANNEL_MAPPINGS['ESPN']
    }

    // Try to match broadcast name to channel
    const upperBroadcast = broadcastName.toUpperCase()
    for (const [key, mapping] of Object.entries(CHANNEL_MAPPINGS)) {
      if (upperBroadcast.includes(key.toUpperCase())) {
        return mapping
      }
    }

    // Default fallback
    return CHANNEL_MAPPINGS['ESPN']
  }

  /**
   * Get live games for selected leagues and date range
   */
  async getLiveGames(selectedLeagues: string[], startDate?: string, endDate?: string): Promise<{
    games: Array<UnifiedGame & { channel: ChannelMapping }>
    totalGames: number
    liveGames: number
    upcomingGames: number
    completedGames: number
    sources: string[]
  }> {
    const allGames: UnifiedGame[] = []
    const sources: Set<string> = new Set()

    // Set default date range if not provided
    const today = startDate || new Date().toISOString().split('T')[0]
    const weekFromToday = endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    try {
      // Fetch ESPN data for American sports
      if (selectedLeagues.some(league => ['nfl', 'nba', 'mlb', 'nhl', 'ncaa-fb', 'ncaa-bb', 'mls'].includes(league))) {
        logger.info('Fetching ESPN data...')
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
      }

      // Fetch SportsDB data for international soccer
      if (selectedLeagues.some(league => ['premier', 'champions', 'la-liga', 'serie-a', 'bundesliga'].includes(league))) {
        logger.info('Fetching TheSportsDB data...')
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

    } catch (error) {
      logger.error('Error fetching live sports data:', error)
    }

    // Add channel mappings to games
    const gamesWithChannels = allGames.map(game => ({
      ...game,
      channel: this.getChannelMapping(game.broadcast?.[0])
    }))

    // Sort by date and time
    gamesWithChannels.sort((a, b) => {
      const dateTimeA = new Date(`${a.gameDate} ${a.gameTime}`)
      const dateTimeB = new Date(`${b.gameDate} ${b.gameTime}`)
      return dateTimeA.getTime() - dateTimeB.getTime()
    })

    // Calculate statistics
    const liveGames = gamesWithChannels.filter(g => g.status === 'live').length
    const upcomingGames = gamesWithChannels.filter(g => g.status === 'upcoming').length
    const completedGames = gamesWithChannels.filter(g => g.status === 'completed').length

    return {
      games: gamesWithChannels,
      totalGames: gamesWithChannels.length,
      liveGames,
      upcomingGames,
      completedGames,
      sources: Array.from(sources)
    }
  }

  /**
   * Convert full league name to league key
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
}

export const liveSportsService = new LiveSportsService()
