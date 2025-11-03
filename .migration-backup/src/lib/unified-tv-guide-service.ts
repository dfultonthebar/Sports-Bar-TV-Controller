
// Unified TV Guide Service
// Combines Gracenote and Spectrum Business API data for comprehensive guide information

import { gracenoteService, type GracenoteProgram, type GracenoteChannel } from './gracenote-service'
import { spectrumBusinessApiService, type SpectrumBusinessProgram, type SpectrumBusinessChannel } from './spectrum-business-api'

import { logger } from '@/lib/logger'
interface UnifiedChannel {
  id: string
  number: string
  callsign: string
  name: string
  isHD: boolean
  category: string
  source: 'gracenote' | 'spectrum' | 'both'
  gracenoteData?: GracenoteChannel
  spectrumData?: SpectrumBusinessChannel
  isSubscribed?: boolean
  packageLevel?: string
}

interface UnifiedProgram {
  id: string
  channelId: string
  title: string
  description?: string
  episodeTitle?: string
  startTime: string
  endTime: string
  duration: number
  genre: string[]
  isLive: boolean
  isNew: boolean
  isSports: boolean
  sportsInfo?: {
    league?: string
    teams?: string[]
    homeTeam?: string
    awayTeam?: string
    venue?: string
    status?: string
    gameType?: string
  }
  source: 'gracenote' | 'spectrum'
  confidence: number // Matching confidence when merging data
}

interface UnifiedGuideData {
  success: boolean
  channels: UnifiedChannel[]
  programs: UnifiedProgram[]
  sources: {
    gracenote: { configured: boolean; used: boolean }
    spectrum: { configured: boolean; used: boolean }
  }
  lastUpdated: string
  coverage: {
    totalChannels: number
    sportsChannels: number
    premiumChannels: number
    timeRange: { start: string; end: string }
  }
}

class UnifiedTVGuideService {
  private cache: Map<string, any> = new Map()
  private cacheTimeout = 10 * 60 * 1000 // 10 minutes

  private getCacheKey(method: string, params: any): string {
    return `unified_${method}_${JSON.stringify(params)}`
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
   * Get unified channel lineup from all available sources
   */
  async getUnifiedChannelLineup(): Promise<UnifiedChannel[]> {
    const cacheKey = this.getCacheKey('channels', {})
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    try {
      const [gracenoteChannels, spectrumChannels] = await Promise.allSettled([
        gracenoteService.getChannelLineup('53703'), // Default zip
        spectrumBusinessApiService.getChannelLineup()
      ])

      const unifiedChannels = this.mergeChannelData(
        gracenoteChannels.status === 'fulfilled' ? gracenoteChannels.value : [],
        spectrumChannels.status === 'fulfilled' ? spectrumChannels.value : []
      )

      this.setCache(cacheKey, unifiedChannels)
      return unifiedChannels
    } catch (error) {
      logger.error('Unified channel lineup error:', error)
      return []
    }
  }

  /**
   * Get comprehensive guide data from all sources
   */
  async getUnifiedGuideData(
    startTime: Date,
    endTime: Date,
    channelIds?: string[]
  ): Promise<UnifiedGuideData> {
    const cacheKey = this.getCacheKey('guide', { startTime, endTime, channelIds })
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    try {
      const [gracenoteData, spectrumData] = await Promise.allSettled([
        gracenoteService.getGuideData(channelIds || [], startTime, endTime),
        spectrumBusinessApiService.getGuideData(startTime, endTime, channelIds)
      ])

      const gracenoteStatus = await gracenoteService.getStatus()
      const spectrumStatus = await spectrumBusinessApiService.getStatus()

      const unifiedChannels = await this.getUnifiedChannelLineup()
      const unifiedPrograms = this.mergeProgramData(
        gracenoteData.status === 'fulfilled' ? gracenoteData.value.programs : [],
        spectrumData.status === 'fulfilled' ? spectrumData.value.programs : []
      )

      const result: UnifiedGuideData = {
        success: true,
        channels: unifiedChannels,
        programs: unifiedPrograms,
        sources: {
          gracenote: {
            configured: gracenoteStatus.configured,
            used: gracenoteData.status === 'fulfilled'
          },
          spectrum: {
            configured: spectrumStatus.configured,
            used: spectrumData.status === 'fulfilled'
          }
        },
        lastUpdated: new Date().toISOString(),
        coverage: {
          totalChannels: unifiedChannels.length,
          sportsChannels: unifiedChannels.filter(ch => ch.category === 'sports').length,
          premiumChannels: unifiedChannels.filter(ch => ch.packageLevel === 'premium').length,
          timeRange: { start: startTime.toISOString(), end: endTime.toISOString() }
        }
      }

      this.setCache(cacheKey, result)
      return result
    } catch (error) {
      logger.error('Unified guide data error:', error)
      return this.getErrorFallbackData(startTime, endTime)
    }
  }

  /**
   * Get sports programming from all sources with enhanced metadata
   */
  async getUnifiedSportsPrograms(
    startTime: Date,
    endTime: Date,
    leagues?: string[]
  ): Promise<UnifiedProgram[]> {
    const cacheKey = this.getCacheKey('sports', { startTime, endTime, leagues })
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    try {
      const [gracenotePrograms, spectrumPrograms] = await Promise.allSettled([
        gracenoteService.getSportsPrograms(startTime, endTime, leagues),
        spectrumBusinessApiService.getSportsPrograms(startTime, endTime, leagues)
      ])

      const allPrograms = [
        ...(gracenotePrograms.status === 'fulfilled' ? 
           gracenotePrograms.value.map(p => this.convertGracenoteProgram(p)) : []),
        ...(spectrumPrograms.status === 'fulfilled' ? 
           spectrumPrograms.value.map(p => this.convertSpectrumProgram(p)) : [])
      ]

      // Remove duplicates and merge similar programs
      const uniquePrograms = this.deduplicatePrograms(allPrograms)
      
      this.setCache(cacheKey, uniquePrograms)
      return uniquePrograms
    } catch (error) {
      logger.error('Unified sports programs error:', error)
      return []
    }
  }

  /**
   * Search across all data sources
   */
  async searchAllSources(query: string): Promise<UnifiedProgram[]> {
    try {
      const [gracenoteResults, spectrumGuide] = await Promise.allSettled([
        gracenoteService.searchPrograms(query),
        spectrumBusinessApiService.getGuideData(
          new Date(),
          new Date(Date.now() + 24 * 60 * 60 * 1000)
        )
      ])

      let allResults: UnifiedProgram[] = []

      if (gracenoteResults.status === 'fulfilled') {
        allResults.push(...gracenoteResults.value.map(p => this.convertGracenoteProgram(p)))
      }

      if (spectrumGuide.status === 'fulfilled') {
        const matchingPrograms = spectrumGuide.value.programs.filter(program =>
          program.title.toLowerCase().includes(query.toLowerCase()) ||
          program.description?.toLowerCase().includes(query.toLowerCase())
        )
        allResults.push(...matchingPrograms.map(p => this.convertSpectrumProgram(p)))
      }

      return this.deduplicatePrograms(allResults)
    } catch (error) {
      logger.error('Unified search error:', error)
      return []
    }
  }

  private mergeChannelData(
    gracenoteChannels: GracenoteChannel[],
    spectrumChannels: SpectrumBusinessChannel[]
  ): UnifiedChannel[] {
    const channelMap = new Map<string, UnifiedChannel>()

    // Add Gracenote channels
    gracenoteChannels.forEach(channel => {
      channelMap.set(channel.callsign, {
        id: channel.id,
        number: channel.number,
        callsign: channel.callsign,
        name: channel.name,
        isHD: channel.isHD,
        category: channel.category,
        source: 'gracenote',
        gracenoteData: channel
      })
    })

    // Add or merge Spectrum channels
    spectrumChannels.forEach(channel => {
      const existing = channelMap.get(channel.callsign)
      if (existing) {
        // Merge data
        channelMap.set(channel.callsign, {
          ...existing,
          source: 'both',
          spectrumData: channel,
          isSubscribed: channel.isSubscribed,
          packageLevel: channel.packageLevel,
          // Prefer Spectrum's channel number if available
          number: channel.number || existing.number
        })
      } else {
        // Add new Spectrum channel
        channelMap.set(channel.callsign, {
          id: channel.id,
          number: channel.number,
          callsign: channel.callsign,
          name: channel.name,
          isHD: channel.isHD,
          category: channel.category,
          source: 'spectrum',
          spectrumData: channel,
          isSubscribed: channel.isSubscribed,
          packageLevel: channel.packageLevel
        })
      }
    })

    return Array.from(channelMap.values()).sort((a, b) => 
      parseInt(a.number) - parseInt(b.number)
    )
  }

  private mergeProgramData(
    gracenotePrograms: GracenoteProgram[],
    spectrumPrograms: SpectrumBusinessProgram[]
  ): UnifiedProgram[] {
    const allPrograms = [
      ...gracenotePrograms.map(p => this.convertGracenoteProgram(p)),
      ...spectrumPrograms.map(p => this.convertSpectrumProgram(p))
    ]

    return this.deduplicatePrograms(allPrograms)
  }

  private convertGracenoteProgram(program: GracenoteProgram): UnifiedProgram {
    return {
      id: `gracenote_${program.id}`,
      channelId: program.id,
      title: program.title,
      description: program.description,
      episodeTitle: program.episodeTitle,
      startTime: program.startTime,
      endTime: program.endTime,
      duration: program.duration,
      genre: program.genre,
      isLive: program.isLive,
      isNew: program.isNew,
      isSports: program.isSports,
      sportsInfo: program.sportsInfo ? {
        league: program.sportsInfo.league,
        teams: program.sportsInfo.teams,
        venue: program.sportsInfo.venue
      } : undefined,
      source: 'gracenote',
      confidence: 1.0
    }
  }

  private convertSpectrumProgram(program: SpectrumBusinessProgram): UnifiedProgram {
    return {
      id: `spectrum_${program.id}`,
      channelId: program.channelId,
      title: program.title,
      description: program.description,
      episodeTitle: program.episodeTitle,
      startTime: program.startTime,
      endTime: program.endTime,
      duration: program.duration,
      genre: program.genre,
      isLive: program.isLive,
      isNew: program.isNew,
      isSports: program.isSports,
      sportsInfo: program.sportsData ? {
        league: program.sportsData.league,
        homeTeam: program.sportsData.homeTeam,
        awayTeam: program.sportsData.awayTeam,
        teams: program.sportsData.homeTeam && program.sportsData.awayTeam ? 
          [program.sportsData.homeTeam, program.sportsData.awayTeam] : undefined,
        venue: program.sportsData.venue,
        status: program.sportsData.status,
        gameType: program.sportsData.gameType
      } : undefined,
      source: 'spectrum',
      confidence: 1.0
    }
  }

  private deduplicatePrograms(programs: UnifiedProgram[]): UnifiedProgram[] {
    const programMap = new Map<string, UnifiedProgram>()

    programs.forEach(program => {
      const key = `${program.title}_${program.startTime}_${program.endTime}`
      const existing = programMap.get(key)

      if (!existing) {
        programMap.set(key, program)
      } else {
        // Merge programs with preference for more complete data
        const merged = {
          ...existing,
          description: program.description || existing.description,
          episodeTitle: program.episodeTitle || existing.episodeTitle,
          sportsInfo: {
            ...existing.sportsInfo,
            ...program.sportsInfo
          },
          confidence: Math.max(existing.confidence, program.confidence)
        }
        programMap.set(key, merged)
      }
    })

    return Array.from(programMap.values()).sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )
  }

  private getErrorFallbackData(startTime: Date, endTime: Date): UnifiedGuideData {
    return {
      success: false,
      channels: [] as any[],
      programs: [] as any[],
      sources: {
        gracenote: { configured: false, used: false },
        spectrum: { configured: false, used: false }
      },
      lastUpdated: new Date().toISOString(),
      coverage: {
        totalChannels: 0,
        sportsChannels: 0,
        premiumChannels: 0,
        timeRange: { start: startTime.toISOString(), end: endTime.toISOString() }
      }
    }
  }

  /**
   * Get service status for all providers
   */
  async getServicesStatus(): Promise<{
    gracenote: { configured: boolean; message: string }
    spectrum: { configured: boolean; message: string }
    unified: { ready: boolean; message: string }
  }> {
    const gracenoteStatus = await gracenoteService.getStatus()
    const spectrumStatus = await spectrumBusinessApiService.getStatus()

    return {
      gracenote: gracenoteStatus,
      spectrum: spectrumStatus,
      unified: {
        ready: gracenoteStatus.configured || spectrumStatus.configured,
        message: gracenoteStatus.configured || spectrumStatus.configured 
          ? 'Unified TV Guide is ready with at least one data source configured.'
          : 'Configure at least one TV guide service (Gracenote or Spectrum Business) to use the unified guide.'
      }
    }
  }
}

// Create singleton instance
export const unifiedTVGuideService = new UnifiedTVGuideService()

// Export types
export type { UnifiedChannel, UnifiedProgram, UnifiedGuideData }
