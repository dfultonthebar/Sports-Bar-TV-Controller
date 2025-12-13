import { logger } from '@sports-bar/logger'

/**
 * MLB Stats API Integration
 * 
 * Integration with MLB's official Stats API for baseball data.
 * This is a free, public API that doesn't require authentication.
 * 
 * API Documentation: https://appac.github.io/mlb-data-api-docs/
 */

export interface MLBTeam {
  id: number
  name: string
  teamName: string
  abbreviation: string
  locationName: string
  division: {
    id: number
    name: string
  }
  venue: {
    id: number
    name: string
  }
}

export interface MLBGame {
  gamePk: number
  gameDate: string
  status: {
    abstractGameState: string
    detailedState: string
    statusCode: string
  }
  teams: {
    away: {
      team: MLBTeam
      score?: number
    }
    home: {
      team: MLBTeam
      score?: number
    }
  }
  venue: {
    id: number
    name: string
  }
  content: {
    link: string
  }
}

export interface MLBSchedule {
  dates: Array<{
    date: string
    totalGames: number
    games: MLBGame[]
  }>
  totalGames: number
}

export interface MLBApiConfig {
  baseUrl?: string
}

/**
 * MLB Stats API Client
 */
export class MLBApiClient {
  private config: MLBApiConfig

  constructor(config: MLBApiConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://statsapi.mlb.com/api/v1'
    }

    logger.info('[MLB API] Client initialized')
  }

  /**
   * Get schedule for a specific date or date range
   */
  public async getSchedule(options?: {
    startDate?: string // Format: YYYY-MM-DD
    endDate?: string   // Format: YYYY-MM-DD
    teamId?: number
    sportId?: number   // Default: 1 (MLB)
  }): Promise<MLBSchedule> {
    try {
      logger.info('[MLB API] Getting schedule')

      const url = new URL(`${this.config.baseUrl}/schedule`)
      
      url.searchParams.append('sportId', (options?.sportId || 1).toString())
      
      if (options?.startDate) {
        url.searchParams.append('startDate', options.startDate)
      }
      
      if (options?.endDate) {
        url.searchParams.append('endDate', options.endDate)
      }
      
      if (options?.teamId) {
        url.searchParams.append('teamId', options.teamId.toString())
      }

      // Add hydrations to get more detailed data
      url.searchParams.append('hydrate', 'team,venue,game(content(summary))')

      const response = await fetch(url.toString())
      
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data as MLBSchedule
    } catch (error) {
      logger.error('[MLB API] Error getting schedule:', error)
      throw error
    }
  }

  /**
   * Get today's games
   */
  public async getTodaysGames(): Promise<MLBGame[]> {
    const today = new Date().toISOString().split('T')[0]
    const schedule = await this.getSchedule({ startDate: today, endDate: today })
    
    if (schedule.dates.length > 0) {
      return schedule.dates[0].games
    }
    
    return []
  }

  /**
   * Get live games
   */
  public async getLiveGames(): Promise<MLBGame[]> {
    const todaysGames = await this.getTodaysGames()
    
    return todaysGames.filter(game => 
      game.status.abstractGameState === 'Live' ||
      game.status.statusCode === 'I'  // In Progress
    )
  }

  /**
   * Get upcoming games
   */
  public async getUpcomingGames(days: number = 7): Promise<MLBGame[]> {
    const today = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + days)
    
    const schedule = await this.getSchedule({
      startDate: today.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    })
    
    const allGames: MLBGame[] = []
    for (const date of schedule.dates) {
      allGames.push(...date.games)
    }
    
    return allGames
  }

  /**
   * Get game details
   */
  public async getGame(gamePk: number): Promise<any> {
    try {
      logger.info(`[MLB API] Getting game ${gamePk}`)

      const url = `${this.config.baseUrl}/game/${gamePk}/feed/live`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('[MLB API] Error getting game:', error)
      throw error
    }
  }

  /**
   * Get all MLB teams
   */
  public async getTeams(): Promise<MLBTeam[]> {
    try {
      logger.info('[MLB API] Getting all teams')

      const url = `${this.config.baseUrl}/teams?sportId=1`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.teams as MLBTeam[]
    } catch (error) {
      logger.error('[MLB API] Error getting teams:', error)
      throw error
    }
  }

  /**
   * Get team details
   */
  public async getTeam(teamId: number): Promise<MLBTeam> {
    try {
      logger.info(`[MLB API] Getting team ${teamId}`)

      const url = `${this.config.baseUrl}/teams/${teamId}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`MLB API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.teams[0] as MLBTeam
    } catch (error) {
      logger.error('[MLB API] Error getting team:', error)
      throw error
    }
  }

  /**
   * Search for team by name
   */
  public async searchTeamByName(teamName: string): Promise<MLBTeam | null> {
    const teams = await this.getTeams()
    
    const normalizedSearch = teamName.toLowerCase()
    const match = teams.find(team =>
      team.name.toLowerCase().includes(normalizedSearch) ||
      team.teamName.toLowerCase().includes(normalizedSearch) ||
      team.abbreviation.toLowerCase() === normalizedSearch ||
      team.locationName.toLowerCase().includes(normalizedSearch)
    )
    
    return match || null
  }

  /**
   * Get games for a specific team
   */
  public async getTeamSchedule(teamId: number, options?: {
    startDate?: string
    endDate?: string
  }): Promise<MLBGame[]> {
    const schedule = await this.getSchedule({
      teamId,
      startDate: options?.startDate,
      endDate: options?.endDate
    })
    
    const allGames: MLBGame[] = []
    for (const date of schedule.dates) {
      allGames.push(...date.games)
    }
    
    return allGames
  }

  /**
   * Generate deep link for MLB.TV app
   */
  public generateGameDeepLink(gamePk: number): string {
    return `mlb://game/${gamePk}`
  }

  /**
   * Generate web URL for a game
   */
  public generateGameWebUrl(gamePk: number): string {
    return `https://www.mlb.com/tv/g${gamePk}`
  }

  /**
   * Check if a game is live
   */
  public isGameLive(game: MLBGame): boolean {
    return game.status.abstractGameState === 'Live' || game.status.statusCode === 'I'
  }

  /**
   * Check if a game is upcoming
   */
  public isGameUpcoming(game: MLBGame): boolean {
    return game.status.abstractGameState === 'Preview' || game.status.statusCode === 'P'
  }

  /**
   * Check if a game is final
   */
  public isGameFinal(game: MLBGame): boolean {
    return game.status.abstractGameState === 'Final' || game.status.statusCode === 'F'
  }

  /**
   * Format game for display
   */
  public formatGame(game: MLBGame): string {
    const away = game.teams.away.team.abbreviation
    const home = game.teams.home.team.abbreviation
    const awayScore = game.teams.away.score ?? '-'
    const homeScore = game.teams.home.score ?? '-'
    
    return `${away} ${awayScore} @ ${home} ${homeScore} - ${game.status.detailedState}`
  }
}

/**
 * Create and export a singleton instance
 */
export const mlbApi = new MLBApiClient()

/**
 * Check if MLB API is available (always true since it's public)
 */
export function isMLBApiAvailable(): boolean {
  return true
}
