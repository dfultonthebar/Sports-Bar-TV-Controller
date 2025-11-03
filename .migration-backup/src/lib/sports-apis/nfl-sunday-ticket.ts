

/**
 * NFL Sunday Ticket Game Identification Service
 * Identifies out-of-market NFL games typically exclusive to Sunday Ticket
 */

import { ESPNGame } from './espn-api'

import { logger } from '@/lib/logger'
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
    const restrictions: any[] = []
    
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
   * Get upcoming Sunday Ticket games for the next week - real data only
   */
  async getUpcomingSundayTicketGames(): Promise<SundayTicketGame[]> {
    try {
      // Sunday Ticket identification requires real NFL schedule data from ESPN API or similar
      // Since DirecTV doesn't provide a public API for Sunday Ticket schedules,
      // and Sunday Ticket is now part of DirecTV Stream/YouTube TV,
      // we rely on the ESPN API integration to identify out-of-market games
      
      logger.info('ℹ️ Sunday Ticket games are identified through the ESPN NFL API integration')
      logger.info('ℹ️ Use the ESPN API with identifySundayTicketGames() method for real Sunday Ticket data')
      
      // No mock data fallback - return empty array
      return []
    } catch (error) {
      logger.error('Error fetching Sunday Ticket games:', error)
      return []
    }
  }
}

export const nflSundayTicketService = new NFLSundayTicketService()
