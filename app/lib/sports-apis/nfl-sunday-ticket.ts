

/**
 * NFL Sunday Ticket Game Identification Service
 * Identifies out-of-market NFL games typically exclusive to Sunday Ticket
 */

import { ESPNGame } from './espn-api'

export interface SundayTicketGame {
  id: string
  league: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  gameDate: string
  isSundayTicketExclusive: boolean
  isRedZoneEligible: boolean
  marketRestrictions: string[]
  channel: {
    id: string
    name: string
    platforms: string[]
    type: string
    cost: string
    channelNumber?: string
    deviceType?: string
  }
  venue?: string
  broadcast?: string[]
  description?: string
  priority: 'high' | 'medium' | 'low'
  status: 'upcoming' | 'live' | 'completed'
  homeScore?: string
  awayScore?: string
  source: 'sunday-ticket'
}

class NFLSundayTicketService {
  /**
   * Identify which NFL games are likely Sunday Ticket exclusives
   * Based on game time, market restrictions, and broadcast availability
   */
  identifySundayTicketGames(espnGames: ESPNGame[]): SundayTicketGame[] {
    const sundayTicketGames: SundayTicketGame[] = []
    
    espnGames.forEach(game => {
      if (!game.name.toLowerCase().includes('nfl')) return
      
      const competition = game.competitions[0]
      const homeTeam = competition.competitors.find(c => c.homeAway === 'home')
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away')
      
      if (!homeTeam || !awayTeam) return
      
      // Determine if this is likely a Sunday Ticket game
      const isSundayTicketExclusive = this.isSundayTicketExclusive(game)
      const isRedZoneEligible = this.isRedZoneEligible(game)
      
      // If it's a Sunday Ticket game or RedZone eligible, add it
      if (isSundayTicketExclusive || isRedZoneEligible) {
        const gameDate = new Date(game.date)
        const gameTime = gameDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/New_York'
        }) + ' EST'
        
        // Determine status
        let status: 'upcoming' | 'live' | 'completed' = 'upcoming'
        if (competition.status.type.completed) {
          status = 'completed'
        } else if (competition.status.type.state === 'in') {
          status = 'live'
        }
        
        const channel = this.getSundayTicketChannel(isSundayTicketExclusive, isRedZoneEligible)
        
        sundayTicketGames.push({
          id: `st-${game.id}`,
          league: 'NFL Sunday Ticket',
          homeTeam: homeTeam.team.displayName,
          awayTeam: awayTeam.team.displayName,
          gameTime,
          gameDate: gameDate.toISOString().split('T')[0],
          isSundayTicketExclusive,
          isRedZoneEligible,
          marketRestrictions: this.getMarketRestrictions(homeTeam.team.location, awayTeam.team.location),
          channel,
          venue: homeTeam.team.location,
          broadcast: competition.broadcasts?.flatMap(b => b.names) || ['DirecTV Sunday Ticket'],
          description: `${isSundayTicketExclusive ? 'Sunday Ticket Exclusive' : 'RedZone Available'} - Out-of-market NFL game`,
          priority: status === 'live' ? 'high' : 'medium',
          status,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          source: 'sunday-ticket'
        })
      }
    })
    
    return sundayTicketGames
  }

  /**
   * Determine if a game is likely Sunday Ticket exclusive
   */
  private isSundayTicketExclusive(game: ESPNGame): boolean {
    const competition = game.competitions[0]
    const gameDate = new Date(game.date)
    const dayOfWeek = gameDate.getDay() // 0 = Sunday
    
    // Check if it's a Sunday afternoon game (typical Sunday Ticket time)
    const isSunday = dayOfWeek === 0
    const gameHour = gameDate.getHours()
    const isSundayAfternoon = isSunday && gameHour >= 13 && gameHour <= 19 // 1 PM - 7 PM EST
    
    // Check if broadcast info suggests out-of-market
    const broadcasts = competition.broadcasts?.flatMap(b => b.names) || []
    const hasLocalBroadcast = broadcasts.some(b => 
      ['CBS', 'FOX', 'NBC', 'ABC'].some(network => b.toUpperCase().includes(network))
    )
    
    // Sunday afternoon games without major network broadcast are likely Sunday Ticket
    return isSundayAfternoon && !hasLocalBroadcast
  }

  /**
   * Determine if a game is eligible for RedZone coverage
   */
  private isRedZoneEligible(game: ESPNGame): boolean {
    const gameDate = new Date(game.date)
    const dayOfWeek = gameDate.getDay()
    const gameHour = gameDate.getHours()
    
    // RedZone covers Sunday afternoon games (1 PM - 7 PM EST)
    return dayOfWeek === 0 && gameHour >= 13 && gameHour <= 19
  }

  /**
   * Get appropriate channel for Sunday Ticket content
   */
  private getSundayTicketChannel(isSundayTicketExclusive: boolean, isRedZoneEligible: boolean) {
    if (isRedZoneEligible) {
      return {
        id: 'nfl-redzone',
        name: 'NFL RedZone',
        platforms: ['DirecTV Ch. 213', 'Sunday Ticket App', 'DirecTV Stream'],
        type: 'satellite',
        cost: 'premium',
        channelNumber: '213',
        deviceType: 'satellite'
      }
    }
    
    if (isSundayTicketExclusive) {
      // Sunday Ticket games are on channels 705-719
      const channelNumber = (Math.floor(Math.random() * 15) + 705).toString()
      return {
        id: `sunday-ticket-${channelNumber}`,
        name: `Sunday Ticket ${channelNumber}`,
        platforms: [`DirecTV Ch. ${channelNumber}`, 'Sunday Ticket App', 'DirecTV Stream'],
        type: 'satellite',
        cost: 'premium',
        channelNumber,
        deviceType: 'satellite'
      }
    }
    
    // Default to NFL Network
    return {
      id: 'nfl-network',
      name: 'NFL Network',
      platforms: ['DirecTV Ch. 212', 'Sunday Ticket Package'],
      type: 'satellite',
      cost: 'premium',
      channelNumber: '212',
      deviceType: 'satellite'
    }
  }

  /**
   * Get market restrictions for a game
   */
  private getMarketRestrictions(homeTeamLocation: string, awayTeamLocation: string): string[] {
    const restrictions = []
    
    if (homeTeamLocation) {
      restrictions.push(`Available in ${homeTeamLocation} market on local TV`)
    }
    if (awayTeamLocation && awayTeamLocation !== homeTeamLocation) {
      restrictions.push(`Available in ${awayTeamLocation} market on local TV`)
    }
    
    restrictions.push('Out-of-market: Sunday Ticket required')
    
    return restrictions
  }

  /**
   * Get upcoming Sunday Ticket games for the next week
   */
  async getUpcomingSundayTicketGames(): Promise<SundayTicketGame[]> {
    try {
      // This would typically fetch from ESPN API
      // For now, return mock Sunday Ticket games
      return this.generateMockSundayTicketGames()
    } catch (error) {
      console.error('Error fetching Sunday Ticket games:', error)
      return []
    }
  }

  /**
   * Generate mock Sunday Ticket games for demonstration
   */
  private generateMockSundayTicketGames(): SundayTicketGame[] {
    const games: SundayTicketGame[] = []
    const nflTeams = [
      'Cowboys', 'Patriots', 'Packers', 'Chiefs', '49ers', 'Ravens', 'Bills', 'Rams',
      'Bengals', 'Dolphins', 'Eagles', 'Vikings', 'Cardinals', 'Seahawks', 'Steelers', 'Broncos'
    ]
    
    // Generate Sunday games (next Sunday)
    const nextSunday = new Date()
    nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()) % 7)
    
    // Early Sunday games (1 PM EST)
    for (let i = 0; i < 8; i++) {
      const gameTime = new Date(nextSunday)
      gameTime.setHours(13, 0, 0) // 1:00 PM EST
      
      const homeTeam = nflTeams[i * 2]
      const awayTeam = nflTeams[i * 2 + 1]
      const channelNumber = (705 + i).toString()
      
      games.push({
        id: `st-early-${i}`,
        league: 'NFL Sunday Ticket',
        homeTeam,
        awayTeam,
        gameTime: '1:00 PM EST',
        gameDate: nextSunday.toISOString().split('T')[0],
        isSundayTicketExclusive: true,
        isRedZoneEligible: true,
        marketRestrictions: [
          `Available in ${homeTeam} market on local TV`,
          `Available in ${awayTeam} market on local TV`,
          'Out-of-market: Sunday Ticket required'
        ],
        channel: {
          id: `sunday-ticket-${channelNumber}`,
          name: `Sunday Ticket ${channelNumber}`,
          platforms: [`DirecTV Ch. ${channelNumber}`, 'Sunday Ticket App', 'DirecTV Stream'],
          type: 'satellite',
          cost: 'premium',
          channelNumber,
          deviceType: 'satellite'
        },
        venue: `${homeTeam} Stadium`,
        broadcast: ['DirecTV Sunday Ticket'],
        description: 'Sunday Ticket Exclusive - Out-of-market NFL game',
        priority: 'medium',
        status: 'upcoming',
        source: 'sunday-ticket'
      })
    }
    
    // Add RedZone coverage
    games.push({
      id: 'redzone-sunday',
      league: 'NFL RedZone',
      homeTeam: 'Multiple Games',
      awayTeam: 'RedZone Coverage',
      gameTime: '1:00 PM EST',
      gameDate: nextSunday.toISOString().split('T')[0],
      isSundayTicketExclusive: false,
      isRedZoneEligible: true,
      marketRestrictions: ['Available with Sunday Ticket package'],
      channel: {
        id: 'nfl-redzone',
        name: 'NFL RedZone',
        platforms: ['DirecTV Ch. 213', 'Sunday Ticket App', 'DirecTV Stream'],
        type: 'satellite',
        cost: 'premium',
        channelNumber: '213',
        deviceType: 'satellite'
      },
      broadcast: ['NFL RedZone'],
      description: 'Commercial-free highlights and live look-ins from Sunday afternoon games',
      priority: 'high',
      status: 'upcoming',
      source: 'sunday-ticket'
    })
    
    return games
  }
}

export const nflSundayTicketService = new NFLSundayTicketService()
