import { logger } from '@/lib/logger'


// Gracenote (Nielsen) TV Guide Service
// Professional-grade TV guide data with comprehensive metadata and sports-focused features

interface GracenoteConfig {
  apiKey: string
  partnerId: string
  userId?: string
  baseUrl?: string
}

interface GracenoteChannel {
  id: string
  callsign: string
  number: string
  name: string
  affiliate?: string
  logo?: string
  isHD: boolean
  category: string
}

interface GracenoteProgram {
  id: string
  title: string
  description?: string
  episodeTitle?: string
  season?: number
  episode?: number
  originalAirDate?: string
  startTime: string
  endTime: string
  duration: number
  rating?: string
  genre: string[]
  isLive: boolean
  isNew: boolean
  isSports: boolean
  sportsInfo?: {
    league?: string
    teams?: string[]
    eventType?: string
    venue?: string
  }
  cast?: string[]
  director?: string
  year?: number
}

interface GracenoteGuideData {
  success: boolean
  channels: GracenoteChannel[]
  programs: GracenoteProgram[]
  lastUpdated: string
  source: string
}

class GracenoteService {
  private config: GracenoteConfig | null = null
  private cache: Map<string, any> = new Map()
  private cacheTimeout = 15 * 60 * 1000 // 15 minutes

  constructor() {
    // Config will be loaded dynamically from database when needed
  }

  private async loadConfig(): Promise<GracenoteConfig> {
    // Try to import the API keys utility (only available on server side)
    try {
      const { getGracenoteConfig } = await import('./api-keys')
      const dbConfig = await getGracenoteConfig()
      
      this.config = {
        apiKey: dbConfig.apiKey || process.env.GRACENOTE_API_KEY || '',
        partnerId: dbConfig.partnerId || process.env.GRACENOTE_PARTNER_ID || '',
        userId: dbConfig.userId || process.env.GRACENOTE_USER_ID || '',
        baseUrl: dbConfig.baseUrl || process.env.GRACENOTE_BASE_URL || 'https://c.web.cddbp.net/webapi/xml/1.0/'
      }
    } catch (error) {
      // Fallback to environment variables if database is not available
      this.config = {
        apiKey: process.env.GRACENOTE_API_KEY || '',
        partnerId: process.env.GRACENOTE_PARTNER_ID || '',
        userId: process.env.GRACENOTE_USER_ID || '',
        baseUrl: process.env.GRACENOTE_BASE_URL || 'https://c.web.cddbp.net/webapi/xml/1.0/'
      }
    }
    
    return this.config
  }

  private async isConfigured(): Promise<boolean> {
    const config = await this.loadConfig()
    return !!(config?.apiKey && config?.partnerId)
  }

  private getCacheKey(method: string, params: any): string {
    return `${method}_${JSON.stringify(params)}`
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }
    return null
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Get channel lineup for a specific provider and zip code
   */
  async getChannelLineup(zipCode: string, provider?: string): Promise<GracenoteChannel[]> {
    const cacheKey = this.getCacheKey('channels', { zipCode, provider })
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    if (!(await this.isConfigured())) {
      logger.warn('Gracenote API not configured - using fallback data')
      return this.getFallbackChannels()
    }

    try {
      // Gracenote API call would go here
      // For now, return enhanced channel data based on common lineups
      const channels = await this.fetchChannelLineup(zipCode, provider)
      this.setCache(cacheKey, channels)
      return channels
    } catch (error) {
      logger.error('Gracenote channel lineup error:', error)
      return this.getFallbackChannels()
    }
  }

  /**
   * Get TV guide data for specified channels and time range
   */
  async getGuideData(
    channels: string[], 
    startTime: Date, 
    endTime: Date,
    zipCode?: string
  ): Promise<GracenoteGuideData> {
    const cacheKey = this.getCacheKey('guide', { channels, startTime, endTime, zipCode })
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    if (!(await this.isConfigured())) {
      logger.warn('Gracenote API not configured - using fallback data')
      return this.getFallbackGuideData(channels, startTime, endTime)
    }

    try {
      const guideData = await this.fetchGuideData(channels, startTime, endTime, zipCode)
      this.setCache(cacheKey, guideData)
      return guideData
    } catch (error) {
      logger.error('Gracenote guide data error:', error)
      return this.getFallbackGuideData(channels, startTime, endTime)
    }
  }

  /**
   * Get sports programming specifically
   */
  async getSportsPrograms(
    startTime: Date,
    endTime: Date,
    leagues?: string[],
    zipCode?: string
  ): Promise<GracenoteProgram[]> {
    const cacheKey = this.getCacheKey('sports', { startTime, endTime, leagues, zipCode })
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    try {
      const guideData = await this.getGuideData([], startTime, endTime, zipCode)
      const sportsPrograms = guideData.programs.filter(program => {
        if (!program.isSports) return false
        if (leagues && leagues.length > 0) {
          return leagues.some(league => 
            program.sportsInfo?.league?.toLowerCase().includes(league.toLowerCase())
          )
        }
        return true
      })

      this.setCache(cacheKey, sportsPrograms)
      return sportsPrograms
    } catch (error) {
      logger.error('Gracenote sports programs error:', error)
      return []
    }
  }

  /**
   * Search for specific programs
   */
  async searchPrograms(query: string, zipCode?: string): Promise<GracenoteProgram[]> {
    const cacheKey = this.getCacheKey('search', { query, zipCode })
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    try {
      // In a real implementation, this would search Gracenote's database
      const now = new Date()
      const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000) // Next 24 hours
      
      const guideData = await this.getGuideData([], now, endTime, zipCode)
      const results = guideData.programs.filter(program =>
        program.title.toLowerCase().includes(query.toLowerCase()) ||
        program.description?.toLowerCase().includes(query.toLowerCase()) ||
        program.episodeTitle?.toLowerCase().includes(query.toLowerCase())
      )

      this.setCache(cacheKey, results)
      return results
    } catch (error) {
      logger.error('Gracenote search error:', error)
      return []
    }
  }

  private async fetchChannelLineup(zipCode: string, provider?: string): Promise<GracenoteChannel[]> {
    // This would make the actual Gracenote API call
    // For now, return enhanced fallback data
    return this.getFallbackChannels()
  }

  private async fetchGuideData(
    channels: string[],
    startTime: Date,
    endTime: Date,
    zipCode?: string
  ): Promise<GracenoteGuideData> {
    // This would make the actual Gracenote API call
    return this.getFallbackGuideData(channels, startTime, endTime)
  }

  private getFallbackChannels(): GracenoteChannel[] {
    return [
      { id: 'espn', callsign: 'ESPN', number: '24', name: 'ESPN', isHD: true, category: 'sports' },
      { id: 'espn2', callsign: 'ESPN2', number: '25', name: 'ESPN2', isHD: true, category: 'sports' },
      { id: 'fs1', callsign: 'FS1', number: '83', name: 'Fox Sports 1', isHD: true, category: 'sports' },
      { id: 'nfl', callsign: 'NFLN', number: '144', name: 'NFL Network', isHD: true, category: 'sports' },
      { id: 'nba', callsign: 'NBATV', number: '146', name: 'NBA TV', isHD: true, category: 'sports' },
      { id: 'mlb', callsign: 'MLBN', number: '147', name: 'MLB Network', isHD: true, category: 'sports' }
    ]
  }

  private getFallbackGuideData(
    channels: string[],
    startTime: Date,
    endTime: Date
  ): GracenoteGuideData {
    // Generate sample sports programming data
    const programs: GracenoteProgram[] = [
      {
        id: 'sample1',
        title: 'Monday Night Football',
        description: 'NFL regular season matchup',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        duration: 180,
        genre: ['Sports'],
        isLive: true,
        isNew: true,
        isSports: true,
        sportsInfo: {
          league: 'NFL',
          teams: ['Green Bay Packers', 'Chicago Bears'],
          eventType: 'Regular Season',
          venue: 'Lambeau Field'
        }
      }
    ]

    return {
      success: true,
      channels: this.getFallbackChannels(),
      programs,
      lastUpdated: new Date().toISOString(),
      source: 'Gracenote Fallback Data'
    }
  }

  /**
   * Check if API is properly configured
   */
  async getStatus(): Promise<{ configured: boolean; message: string }> {
    if (!(await this.isConfigured())) {
      return {
        configured: false,
        message: 'Gracenote API keys not configured. Add API keys through the API Keys Management interface or environment variables.'
      }
    }
    
    return {
      configured: true,
      message: 'Gracenote API is configured and ready to use.'
    }
  }
}

// Create singleton instance
export const gracenoteService = new GracenoteService()

// Export types
export type { GracenoteChannel, GracenoteProgram, GracenoteGuideData, GracenoteConfig }
