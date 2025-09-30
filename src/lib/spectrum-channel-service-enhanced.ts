
// Enhanced Spectrum Channel Service
// Updated to work with the new professional TV guide system

import { spectrumBusinessApiService } from './spectrum-business-api'
import type { SpectrumBusinessChannel } from './spectrum-business-api'

interface SpectrumChannelData {
  channelNumber: string
  channelName: string
  networkName: string
  isHD: boolean
  category: string
  logoUrl?: string
  isSubscribed?: boolean
  packageLevel?: string
  source: 'api' | 'fallback'
}

interface ChannelLineupResponse {
  success: boolean
  channels: SpectrumChannelData[]
  lastUpdated: string
  source: string
  apiConfigured: boolean
}

// Enhanced fallback data with more sports channels for Wisconsin market
const ENHANCED_SPECTRUM_BUSINESS_CHANNELS: SpectrumChannelData[] = [
  // Local Networks
  { channelNumber: '2', channelName: 'CBS 3 WISC', networkName: 'CBS', isHD: true, category: 'local', source: 'fallback' },
  { channelNumber: '4', channelName: 'NBC 15 WMTV', networkName: 'NBC', isHD: true, category: 'local', source: 'fallback' },
  { channelNumber: '5', channelName: 'FOX 47 WMSN', networkName: 'FOX', isHD: true, category: 'local', source: 'fallback' },
  { channelNumber: '7', channelName: 'ABC 27 WKOW', networkName: 'ABC', isHD: true, category: 'local', source: 'fallback' },
  { channelNumber: '8', channelName: 'PBS 21 WHA', networkName: 'PBS', isHD: true, category: 'local', source: 'fallback' },
  
  // Basic Cable
  { channelNumber: '10', channelName: 'TBS', networkName: 'TBS', isHD: true, category: 'entertainment', source: 'fallback' },
  { channelNumber: '11', channelName: 'TNT', networkName: 'TNT', isHD: true, category: 'entertainment', source: 'fallback' },
  { channelNumber: '12', channelName: 'USA Network', networkName: 'USA', isHD: true, category: 'entertainment', source: 'fallback' },
  { channelNumber: '13', channelName: 'FX', networkName: 'FX', isHD: true, category: 'entertainment', source: 'fallback' },
  
  // Major Sports Networks
  { channelNumber: '24', channelName: 'ESPN', networkName: 'ESPN', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Pro', source: 'fallback' },
  { channelNumber: '25', channelName: 'ESPN2', networkName: 'ESPN2', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Pro', source: 'fallback' },
  { channelNumber: '26', channelName: 'ESPN Classic', networkName: 'ESPN Classic', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Premium', source: 'fallback' },
  { channelNumber: '32', channelName: 'TNT', networkName: 'TNT', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Basic', source: 'fallback' },
  { channelNumber: '33', channelName: 'Bally Sports Wisconsin', networkName: 'Bally Sports', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Regional Sports', source: 'fallback' },
  
  // Extended Sports Package
  { channelNumber: '83', channelName: 'Fox Sports 1', networkName: 'FS1', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Pro', source: 'fallback' },
  { channelNumber: '84', channelName: 'Fox Sports 2', networkName: 'FS2', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Premium', source: 'fallback' },
  { channelNumber: '85', channelName: 'Golf Channel', networkName: 'Golf Channel', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Pro', source: 'fallback' },
  { channelNumber: '86', channelName: 'Tennis Channel', networkName: 'Tennis Channel', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Premium', source: 'fallback' },
  { channelNumber: '87', channelName: 'NBC Sports Network', networkName: 'NBC Sports', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Pro', source: 'fallback' },
  { channelNumber: '88', channelName: 'CBS Sports Network', networkName: 'CBS Sports', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Pro', source: 'fallback' },
  { channelNumber: '89', channelName: 'beIN Sports', networkName: 'beIN Sports', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'International Sports', source: 'fallback' },
  { channelNumber: '90', channelName: 'Stadium', networkName: 'Stadium', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Premium', source: 'fallback' },
  
  // College Sports Networks
  { channelNumber: '141', channelName: 'ESPNU', networkName: 'ESPNU', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'College Sports', source: 'fallback' },
  { channelNumber: '142', channelName: 'ESPN News', networkName: 'ESPN News', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Pro', source: 'fallback' },
  { channelNumber: '143', channelName: 'Big Ten Network', networkName: 'BTN', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'College Sports', source: 'fallback' },
  { channelNumber: '144', channelName: 'NFL Network', networkName: 'NFL Network', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Pro', source: 'fallback' },
  { channelNumber: '145', channelName: 'NFL RedZone', networkName: 'NFL RedZone', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Premium', source: 'fallback' },
  { channelNumber: '146', channelName: 'NBA TV', networkName: 'NBA TV', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Pro', source: 'fallback' },
  { channelNumber: '147', channelName: 'MLB Network', networkName: 'MLB Network', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Pro', source: 'fallback' },
  { channelNumber: '148', channelName: 'NHL Network', networkName: 'NHL Network', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Pro', source: 'fallback' },
  { channelNumber: '149', channelName: 'SEC Network', networkName: 'SEC Network', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'College Sports', source: 'fallback' },
  { channelNumber: '150', channelName: 'ACC Network', networkName: 'ACC Network', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'College Sports', source: 'fallback' },
  { channelNumber: '151', channelName: 'Pac-12 Network', networkName: 'Pac-12 Network', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'College Sports', source: 'fallback' },
  { channelNumber: '152', channelName: 'Olympic Channel', networkName: 'Olympic Channel', isHD: true, category: 'sports', isSubscribed: true, packageLevel: 'Sports Premium', source: 'fallback' },
  
  // News & Information
  { channelNumber: '35', channelName: 'CNN', networkName: 'CNN', isHD: true, category: 'news', source: 'fallback' },
  { channelNumber: '36', channelName: 'Fox News Channel', networkName: 'Fox News', isHD: true, category: 'news', source: 'fallback' },
  { channelNumber: '37', channelName: 'MSNBC', networkName: 'MSNBC', isHD: true, category: 'news', source: 'fallback' },
  
  // Premium Movie Channels
  { channelNumber: '501', channelName: 'HBO', networkName: 'HBO', isHD: true, category: 'premium', isSubscribed: true, packageLevel: 'Premium', source: 'fallback' },
  { channelNumber: '502', channelName: 'HBO2', networkName: 'HBO2', isHD: true, category: 'premium', isSubscribed: true, packageLevel: 'Premium', source: 'fallback' },
  { channelNumber: '510', channelName: 'Showtime', networkName: 'Showtime', isHD: true, category: 'premium', isSubscribed: true, packageLevel: 'Premium', source: 'fallback' },
  { channelNumber: '520', channelName: 'Starz', networkName: 'Starz', isHD: true, category: 'premium', isSubscribed: true, packageLevel: 'Premium', source: 'fallback' }
]

class EnhancedSpectrumChannelService {
  private channels: SpectrumChannelData[]
  private lastUpdated: Date
  private apiConfigured: boolean

  constructor() {
    this.channels = ENHANCED_SPECTRUM_BUSINESS_CHANNELS
    this.lastUpdated = new Date()
    this.apiConfigured = false
    this.checkApiConfiguration()
  }

  private checkApiConfiguration() {
    const status = spectrumBusinessApiService.getStatus()
    this.apiConfigured = status.configured
  }

  /**
   * Get the complete channel lineup - uses API if configured, fallback otherwise
   */
  async getChannelLineup(): Promise<ChannelLineupResponse> {
    try {
      this.checkApiConfiguration()

      if (this.apiConfigured) {
        try {
          // Try to get data from the professional API
          const apiChannels = await spectrumBusinessApiService.getChannelLineup()
          const convertedChannels = this.convertApiChannelsToLocalFormat(apiChannels)
          
          return {
            success: true,
            channels: convertedChannels,
            lastUpdated: new Date().toISOString(),
            source: 'Spectrum Business API (Live Data)',
            apiConfigured: true
          }
        } catch (apiError) {
          console.warn('Spectrum API failed, using enhanced fallback:', apiError)
          // Fall through to use enhanced fallback data
        }
      }

      // Use enhanced fallback data
      return {
        success: true,
        channels: this.channels,
        lastUpdated: this.lastUpdated.toISOString(),
        source: this.apiConfigured ? 
          'Spectrum Business Enhanced Fallback (API temporarily unavailable)' : 
          'Spectrum Business Enhanced Fallback (API not configured)',
        apiConfigured: this.apiConfigured
      }
    } catch (error) {
      console.error('Error in enhanced channel lineup:', error)
      return {
        success: false,
        channels: [],
        lastUpdated: new Date().toISOString(),
        source: 'Error - No data available',
        apiConfigured: this.apiConfigured
      }
    }
  }

  private convertApiChannelsToLocalFormat(apiChannels: SpectrumBusinessChannel[]): SpectrumChannelData[] {
    return apiChannels.map(channel => ({
      channelNumber: channel.number,
      channelName: channel.name,
      networkName: channel.callsign,
      isHD: channel.isHD,
      category: channel.category,
      logoUrl: channel.logo,
      isSubscribed: channel.isSubscribed,
      packageLevel: channel.packageLevel,
      source: 'api' as const
    }))
  }

  /**
   * Get sports channels only
   */
  async getSportsChannels(): Promise<SpectrumChannelData[]> {
    const lineup = await this.getChannelLineup()
    return lineup.channels.filter(channel => channel.category === 'sports')
  }

  /**
   * Get subscribed channels only (when API is configured)
   */
  async getSubscribedChannels(): Promise<SpectrumChannelData[]> {
    const lineup = await this.getChannelLineup()
    return lineup.channels.filter(channel => 
      channel.isSubscribed === true || channel.isSubscribed === undefined // Include fallback channels
    )
  }

  /**
   * Find a specific channel by name or network
   */
  async findChannelByName(channelName: string): Promise<SpectrumChannelData | null> {
    const lineup = await this.getChannelLineup()
    const channel = lineup.channels.find(ch => 
      ch.channelName.toLowerCase().includes(channelName.toLowerCase()) ||
      ch.networkName.toLowerCase().includes(channelName.toLowerCase())
    )
    return channel || null
  }

  /**
   * Get channel number for a specific network
   */
  async getChannelNumber(networkName: string): Promise<string | null> {
    const channel = await this.findChannelByName(networkName)
    return channel ? channel.channelNumber : null
  }

  /**
   * Check if a channel is available in the lineup
   */
  async isChannelAvailable(channelName: string): Promise<boolean> {
    const channel = await this.findChannelByName(channelName)
    return channel !== null
  }

  /**
   * Get all channels by category
   */
  async getChannelsByCategory(category: string): Promise<SpectrumChannelData[]> {
    const lineup = await this.getChannelLineup()
    return lineup.channels.filter(channel => channel.category === category)
  }

  /**
   * Get channels by package level (when API is configured)
   */
  async getChannelsByPackage(packageLevel: string): Promise<SpectrumChannelData[]> {
    const lineup = await this.getChannelLineup()
    return lineup.channels.filter(channel => 
      channel.packageLevel?.toLowerCase().includes(packageLevel.toLowerCase())
    )
  }

  /**
   * Update channel information from API
   */
  async updateChannelLineup(): Promise<boolean> {
    try {
      this.checkApiConfiguration()
      
      if (this.apiConfigured) {
        // Force refresh from API
        await spectrumBusinessApiService.getChannelLineup()
      }
      
      this.lastUpdated = new Date()
      console.log('✅ Enhanced channel lineup updated successfully')
      return true
    } catch (error) {
      console.error('❌ Error updating enhanced channel lineup:', error)
      return false
    }
  }

  /**
   * Get service status and configuration info
   */
  getServiceInfo(): {
    configured: boolean
    hasApiAccess: boolean
    channelCount: number
    sportsChannelCount: number
    lastUpdated: string
    source: string
  } {
    const sportsChannels = this.channels.filter(ch => ch.category === 'sports')
    
    return {
      configured: true, // Always configured with fallback
      hasApiAccess: this.apiConfigured,
      channelCount: this.channels.length,
      sportsChannelCount: sportsChannels.length,
      lastUpdated: this.lastUpdated.toISOString(),
      source: this.apiConfigured ? 'API + Enhanced Fallback' : 'Enhanced Fallback Only'
    }
  }

  /**
   * Get comprehensive sports channel mapping for sports bar use
   */
  async getSportsChannelMapping(): Promise<{
    majorSports: SpectrumChannelData[]
    collegeSports: SpectrumChannelData[]
    regionalSports: SpectrumChannelData[]
    premiumSports: SpectrumChannelData[]
    specialtySports: SpectrumChannelData[]
  }> {
    const sportsChannels = await this.getSportsChannels()
    
    return {
      majorSports: sportsChannels.filter(ch => 
        ['ESPN', 'ESPN2', 'FS1', 'FS2', 'TNT', 'TBS'].includes(ch.networkName)
      ),
      collegeSports: sportsChannels.filter(ch =>
        ['ESPNU', 'BTN', 'SEC Network', 'ACC Network', 'Pac-12 Network'].includes(ch.networkName)
      ),
      regionalSports: sportsChannels.filter(ch =>
        ch.networkName.includes('Bally') || ch.networkName.includes('Regional')
      ),
      premiumSports: sportsChannels.filter(ch =>
        ['NFL RedZone', 'MLB Strike Zone', 'NBA League Pass'].includes(ch.networkName)
      ),
      specialtySports: sportsChannels.filter(ch =>
        ['Golf Channel', 'Tennis Channel', 'Olympic Channel', 'beIN Sports'].includes(ch.networkName)
      )
    }
  }
}

// Create singleton instance
export const enhancedSpectrumChannelService = new EnhancedSpectrumChannelService()

// Export types
export type { SpectrumChannelData, ChannelLineupResponse }

// For backward compatibility, also export the original service
export const spectrumChannelService = enhancedSpectrumChannelService
