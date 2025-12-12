
// DirecTV Channel Guide Service

import { SHEFClient } from './shef-client';
import { COMMON_SPORTS_CHANNELS, CHANNEL_CATEGORIES } from './constants';
import type { DirecTVChannel } from './types';

import { logger } from '@/lib/logger'
export class ChannelGuideService {
  /**
   * Fetch channel information from a DirecTV box
   */
  async fetchChannelInfo(ipAddress: string, channelNumber: number, subChannel?: number): Promise<DirecTVChannel | null> {
    const client = new SHEFClient(ipAddress);

    try {
      const response = await client.getProgramInfo(channelNumber, subChannel);

      if (response.status.code !== 200) {
        return null;
      }

      const channel: DirecTVChannel = {
        id: '', // Will be set by database
        channelNumber,
        subChannel,
        channelName: response.title || `Channel ${channelNumber}`,
        callsign: response.callsign,
        network: undefined,
        stationId: response.stationId,
        isHD: response.callsign?.includes('HD') || false,
        isOffAir: response.isOffAir || false,
        isPPV: response.isPpv || false,
        category: this.categorizeChannel(channelNumber),
        logoUrl: undefined,
        description: response.episodeTitle,
        isActive: !response.isOffAir,
      };

      return channel;
    } catch (error) {
      logger.error(`Error fetching channel ${channelNumber}:`, error);
      return null;
    }
  }

  /**
   * Build channel guide by querying common channels
   */
  async buildChannelGuide(ipAddress: string, channelRange?: { start: number; end: number }): Promise<DirecTVChannel[]> {
    const channels: DirecTVChannel[] = [];
    const start = channelRange?.start || 2;
    const end = channelRange?.end || 999;

    logger.info(`Building channel guide from ${start} to ${end}...`);

    // First, try common sports channels
    for (const commonChannel of COMMON_SPORTS_CHANNELS) {
      const channel = await this.fetchChannelInfo(ipAddress, commonChannel.number);
      if (channel) {
        channel.channelName = commonChannel.name;
        channels.push(channel);
      }
    }

    // Then scan the range (in batches to avoid overwhelming the box)
    const batchSize = 10;
    for (let i = start; i <= end; i += batchSize) {
      const batch: Promise<DirecTVChannel | null>[] = [];
      
      for (let j = i; j < i + batchSize && j <= end; j++) {
        // Skip if already fetched
        if (channels.some(ch => ch.channelNumber === j)) {
          continue;
        }
        
        batch.push(this.fetchChannelInfo(ipAddress, j));
      }

      const results = await Promise.all(batch);
      channels.push(...results.filter((ch): ch is DirecTVChannel => ch !== null));

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info(`Channel guide built with ${channels.length} channels`);
    return channels;
  }

  /**
   * Refresh channel guide data
   */
  async refreshGuide(ipAddress: string): Promise<{ updated: number; added: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;
    let added = 0;

    try {
      // Fetch common sports channels
      for (const commonChannel of COMMON_SPORTS_CHANNELS) {
        try {
          const channel = await this.fetchChannelInfo(ipAddress, commonChannel.number);
          if (channel) {
            added++;
          }
        } catch (error: any) {
          errors.push(`Failed to fetch channel ${commonChannel.number}: ${error.message}`);
        }
      }

      return { updated, added, errors };
    } catch (error: any) {
      errors.push(`Guide refresh failed: ${error.message}`);
      return { updated, added, errors };
    }
  }

  /**
   * Categorize channel based on channel number
   */
  private categorizeChannel(channelNumber: number): string {
    // Sports channels (200-299)
    if (channelNumber >= 200 && channelNumber < 300) {
      return CHANNEL_CATEGORIES.SPORTS;
    }
    
    // News channels (350-399)
    if (channelNumber >= 350 && channelNumber < 400) {
      return CHANNEL_CATEGORIES.NEWS;
    }
    
    // Movies (500-599)
    if (channelNumber >= 500 && channelNumber < 600) {
      return CHANNEL_CATEGORIES.MOVIES;
    }
    
    // Premium (600-699)
    if (channelNumber >= 600 && channelNumber < 700) {
      return CHANNEL_CATEGORIES.PREMIUM;
    }
    
    // Local channels (2-99)
    if (channelNumber >= 2 && channelNumber < 100) {
      return CHANNEL_CATEGORIES.LOCAL;
    }
    
    return CHANNEL_CATEGORIES.ENTERTAINMENT;
  }

  /**
   * Get channel logo URL from external source
   */
  getChannelLogoUrl(callsign: string): string | undefined {
    // This would integrate with a channel logo API
    // For now, return undefined
    return undefined;
  }
}
