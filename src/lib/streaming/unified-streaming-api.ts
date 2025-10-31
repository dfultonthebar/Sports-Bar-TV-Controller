/**
 * Unified Streaming API Interface
 * 
 * Provides a consistent interface across all streaming service APIs.
 * Combines ESPN, MLB, NFHS, and other streaming service integrations.
 */

import { espnApi, ESPNEvent, ESPNScoreboard, isESPNApiAvailable } from './api-integrations/espn-api'
import { mlbApi, MLBGame, isMLBApiAvailable } from './api-integrations/mlb-api'
import { nfhsApi, NFHSEvent, isNFHSApiAvailable } from './api-integrations/nfhs-api'
import { streamingManager, InstalledStreamingApp } from '@/services/streaming-service-manager'
import { StreamingApp, STREAMING_APPS_DATABASE } from './streaming-apps-database'

/**
 * Unified event interface that works across all streaming services
 */
export interface UnifiedEvent {
  id: string
  source: 'espn' | 'mlb' | 'nfhs' | 'other'
  title: string
  sport: string
  date: string
  startTime: string
  status: 'upcoming' | 'live' | 'final'
  teams?: {
    home: string
    away: string
    homeScore?: number
    awayScore?: number
  }
  league?: string
  broadcast?: string[]
  streamingApp?: string // App ID from streaming-apps-database
  deepLink?: string
  webUrl?: string
  rawData?: any // Original data from source API
}

/**
 * Service availability status
 */
export interface ServiceStatus {
  service: string
  isAvailable: boolean
  hasCredentials: boolean
  lastChecked: Date
}

/**
 * Unified Streaming API Client
 */
class UnifiedStreamingAPI {
  private static instance: UnifiedStreamingAPI

  private constructor() {
    console.log('[UNIFIED API] Initializing Unified Streaming API')
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): UnifiedStreamingAPI {
    if (!UnifiedStreamingAPI.instance) {
      UnifiedStreamingAPI.instance = new UnifiedStreamingAPI()
    }
    return UnifiedStreamingAPI.instance
  }

  /**
   * Get all available services and their status
   */
  public getServiceStatus(): ServiceStatus[] {
    const now = new Date()
    
    return [
      {
        service: 'ESPN',
        isAvailable: isESPNApiAvailable(),
        hasCredentials: true, // ESPN is public
        lastChecked: now
      },
      {
        service: 'MLB',
        isAvailable: isMLBApiAvailable(),
        hasCredentials: true, // MLB is public
        lastChecked: now
      },
      {
        service: 'NFHS',
        isAvailable: isNFHSApiAvailable(),
        hasCredentials: isNFHSApiAvailable(),
        lastChecked: now
      }
    ]
  }

  /**
   * Get all live events across all available services
   */
  public async getAllLiveEvents(): Promise<UnifiedEvent[]> {
    console.log('[UNIFIED API] Getting all live events')
    
    const events: UnifiedEvent[] = []

    // Get ESPN live events
    try {
      if (isESPNApiAvailable()) {
        const espnLive = await espnApi.getLiveEvents()
        events.push(...espnLive.map(e => this.convertESPNEvent(e)))
      }
    } catch (error) {
      console.error('[UNIFIED API] Error getting ESPN live events:', error)
    }

    // Get MLB live events
    try {
      if (isMLBApiAvailable()) {
        const mlbLive = await mlbApi.getLiveGames()
        events.push(...mlbLive.map(g => this.convertMLBGame(g)))
      }
    } catch (error) {
      console.error('[UNIFIED API] Error getting MLB live events:', error)
    }

    // Get NFHS live events (if API available)
    try {
      if (isNFHSApiAvailable()) {
        const nfhsLive = await nfhsApi.getLiveEvents()
        events.push(...nfhsLive.map(e => this.convertNFHSEvent(e)))
      }
    } catch (error) {
      console.error('[UNIFIED API] Error getting NFHS live events:', error)
    }

    console.log(`[UNIFIED API] Found ${events.length} total live events`)
    return events
  }

  /**
   * Get upcoming events for a specific sport
   */
  public async getUpcomingEvents(sport?: string, days: number = 7): Promise<UnifiedEvent[]> {
    console.log(`[UNIFIED API] Getting upcoming events${sport ? ` for ${sport}` : ''}`)
    
    const events: UnifiedEvent[] = []
    const today = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + days)

    // Get ESPN events
    try {
      if (isESPNApiAvailable() && sport) {
        const todayStr = today.toISOString().split('T')[0].replace(/-/g, '')
        const league = this.getESPNLeague(sport)
        
        if (league) {
          const scoreboard = await espnApi.getScoreboard(sport, league, { dates: todayStr })
          events.push(...scoreboard.events.map(e => this.convertESPNEvent(e)))
        }
      }
    } catch (error) {
      console.error('[UNIFIED API] Error getting ESPN events:', error)
    }

    // Get MLB events
    try {
      if (isMLBApiAvailable() && (!sport || sport === 'baseball')) {
        const mlbEvents = await mlbApi.getUpcomingGames(days)
        events.push(...mlbEvents.map(g => this.convertMLBGame(g)))
      }
    } catch (error) {
      console.error('[UNIFIED API] Error getting MLB events:', error)
    }

    // Get NFHS events (if API available)
    try {
      if (isNFHSApiAvailable()) {
        const nfhsEvents = await nfhsApi.getUpcomingEvents({
          sport,
          limit: 50
        })
        events.push(...nfhsEvents.events.map(e => this.convertNFHSEvent(e)))
      }
    } catch (error) {
      console.error('[UNIFIED API] Error getting NFHS events:', error)
    }

    console.log(`[UNIFIED API] Found ${events.length} upcoming events`)
    return events
  }

  /**
   * Search for events by team name
   */
  public async searchEventsByTeam(teamName: string, sport?: string): Promise<UnifiedEvent[]> {
    console.log(`[UNIFIED API] Searching for events with team: ${teamName}`)
    
    const events: UnifiedEvent[] = []

    // Search ESPN
    try {
      if (isESPNApiAvailable()) {
        const espnEvents = await espnApi.searchEventsByTeam(teamName, sport)
        events.push(...espnEvents.map(e => this.convertESPNEvent(e)))
      }
    } catch (error) {
      console.error('[UNIFIED API] Error searching ESPN:', error)
    }

    // Search MLB
    try {
      if (isMLBApiAvailable() && (!sport || sport === 'baseball')) {
        const mlbTeam = await mlbApi.searchTeamByName(teamName)
        
        if (mlbTeam) {
          const mlbGames = await mlbApi.getTeamSchedule(mlbTeam.id)
          events.push(...mlbGames.map(g => this.convertMLBGame(g)))
        }
      }
    } catch (error) {
      console.error('[UNIFIED API] Error searching MLB:', error)
    }

    // Search NFHS (if API available)
    try {
      if (isNFHSApiAvailable()) {
        const schools = await nfhsApi.searchSchools(teamName)
        
        for (const school of schools) {
          const schedule = await nfhsApi.getSchoolSchedule(school.id, { sport })
          events.push(...schedule.events.map(e => this.convertNFHSEvent(e)))
        }
      }
    } catch (error) {
      console.error('[UNIFIED API] Error searching NFHS:', error)
    }

    console.log(`[UNIFIED API] Found ${events.length} events for ${teamName}`)
    return events
  }

  /**
   * Get events for today
   */
  public async getTodaysEvents(): Promise<UnifiedEvent[]> {
    return this.getUpcomingEvents(undefined, 1)
  }

  /**
   * Get events that are available on installed Fire TV apps
   */
  public async getEventsForInstalledApps(
    deviceId: string,
    ipAddress: string,
    port: number = 5555
  ): Promise<{ app: StreamingApp; events: UnifiedEvent[] }[]> {
    console.log(`[UNIFIED API] Getting events for installed apps on device ${deviceId}`)
    
    // Get installed streaming apps
    const installedApps = await streamingManager.getInstalledApps(deviceId, ipAddress, port)
    const results: { app: StreamingApp; events: UnifiedEvent[] }[] = []

    // Get events for each installed app
    for (const installed of installedApps) {
      if (!installed.isInstalled || !installed.app.hasPublicApi) {
        continue
      }

      const events = await this.getEventsForApp(installed.app.id)
      
      if (events.length > 0) {
        results.push({
          app: installed.app,
          events
        })
      }
    }

    console.log(`[UNIFIED API] Found events for ${results.length} installed apps`)
    return results
  }

  /**
   * Get events for a specific streaming app
   */
  private async getEventsForApp(appId: string): Promise<UnifiedEvent[]> {
    // Map app IDs to services
    const events: UnifiedEvent[] = []

    switch (appId) {
      case 'espn-plus':
        try {
          // Get live events
          const liveEvents = await espnApi.getLiveEvents()
          events.push(...liveEvents.map(e => this.convertESPNEvent(e)))

          // Get upcoming events for next 3 days (reduced from 7 to avoid overwhelming the browser)
          const today = new Date()
          const leagues = [
            { sport: 'football', league: 'nfl' },
            { sport: 'basketball', league: 'nba' },
            { sport: 'baseball', league: 'mlb' },
            { sport: 'hockey', league: 'nhl' },
            { sport: 'soccer', league: 'usa.1' }
          ]

          // Fetch events day by day to avoid too many simultaneous requests
          for (let i = 0; i < 3; i++) {
            const date = new Date(today)
            date.setDate(date.getDate() + i)
            const dateStr = date.toISOString().split('T')[0].replace(/-/g, '')

            // Fetch all leagues for this day sequentially
            for (const { sport, league } of leagues) {
              try {
                const scoreboard = await espnApi.getScoreboard(sport, league, { dates: dateStr })
                events.push(...scoreboard.events.map(e => this.convertESPNEvent(e)))
              } catch (error) {
                // Silently continue if a league has no events
              }
            }
          }
        } catch (error) {
          console.error('[UNIFIED API] Error getting ESPN+ events:', error)
        }
        break

      case 'mlb-tv':
        try {
          const mlbGames = await mlbApi.getUpcomingGames(7)
          events.push(...mlbGames.map(g => this.convertMLBGame(g)))
        } catch (error) {
          console.error('[UNIFIED API] Error getting MLB.TV events:', error)
        }
        break

      case 'nfhs-network':
        try {
          if (isNFHSApiAvailable()) {
            const nfhsEvents = await nfhsApi.getUpcomingEvents({ limit: 50 })
            events.push(...nfhsEvents.events.map(e => this.convertNFHSEvent(e)))
          }
        } catch (error) {
          console.error('[UNIFIED API] Error getting NFHS events:', error)
        }
        break
    }

    return events
  }

  /**
   * Convert ESPN event to unified format
   */
  private convertESPNEvent(event: ESPNEvent): UnifiedEvent {
    const isLive = event.status.type.state === 'in' || event.status.type.name === 'STATUS_IN_PROGRESS'
    const isFinal = event.status.type.completed
    
    let teams: UnifiedEvent['teams'] | undefined
    if (event.competitions?.[0]?.competitors) {
      const competitors = event.competitions[0].competitors
      const home = competitors.find(c => c.homeAway === 'home')
      const away = competitors.find(c => c.homeAway === 'away')
      
      if (home && away) {
        teams = {
          home: home.team.displayName,
          away: away.team.displayName,
          homeScore: home.score ? parseInt(home.score) : undefined,
          awayScore: away.score ? parseInt(away.score) : undefined
        }
      }
    }

    const broadcasts = event.competitions?.[0]?.broadcasts
      ?.flatMap(b => b.names) || []

    return {
      id: event.id,
      source: 'espn',
      title: event.name,
      sport: event.name.toLowerCase().includes('football') ? 'football' : 
             event.name.toLowerCase().includes('basketball') ? 'basketball' : 'other',
      date: event.date.split('T')[0],
      startTime: event.date,
      status: isLive ? 'live' : isFinal ? 'final' : 'upcoming',
      teams,
      broadcast: broadcasts,
      streamingApp: 'espn-plus',
      deepLink: `espn://x-callback-url/showEvent?eventId=${event.id}`,
      webUrl: event.links?.[0]?.href,
      rawData: event
    }
  }

  /**
   * Convert MLB game to unified format
   */
  private convertMLBGame(game: MLBGame): UnifiedEvent {
    return {
      id: game.gamePk.toString(),
      source: 'mlb',
      title: `${game.teams.away.team.name} @ ${game.teams.home.team.name}`,
      sport: 'baseball',
      date: game.gameDate.split('T')[0],
      startTime: game.gameDate,
      status: mlbApi.isGameLive(game) ? 'live' : 
              mlbApi.isGameFinal(game) ? 'final' : 'upcoming',
      teams: {
        home: game.teams.home.team.name,
        away: game.teams.away.team.name,
        homeScore: game.teams.home.score,
        awayScore: game.teams.away.score
      },
      league: 'MLB',
      streamingApp: 'mlb-tv',
      deepLink: mlbApi.generateGameDeepLink(game.gamePk),
      webUrl: mlbApi.generateGameWebUrl(game.gamePk),
      rawData: game
    }
  }

  /**
   * Convert NFHS event to unified format
   */
  private convertNFHSEvent(event: NFHSEvent): UnifiedEvent {
    return {
      id: event.id,
      source: 'nfhs',
      title: event.title,
      sport: event.sport,
      date: event.date,
      startTime: event.startTime,
      status: event.isLive ? 'live' : 'upcoming',
      league: event.league,
      streamingApp: 'nfhs-network',
      deepLink: nfhsApi.generateEventDeepLink(event.id),
      webUrl: nfhsApi.generateEventWebUrl(event.id),
      rawData: event
    }
  }

  /**
   * Get ESPN league for a sport
   */
  private getESPNLeague(sport: string): string | null {
    const leagueMap: Record<string, string> = {
      'football': 'nfl',
      'basketball': 'nba',
      'baseball': 'mlb',
      'hockey': 'nhl',
      'soccer': 'usa.1'
    }

    return leagueMap[sport.toLowerCase()] || null
  }
}

/**
 * Export singleton instance
 */
export const unifiedStreamingApi = UnifiedStreamingAPI.getInstance()
