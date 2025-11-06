/**
 * Sports Guide API Client
 *
 * Integrates with The Rail Media's Sports Guide API to fetch TV guide data
 * for sports programming across cable, satellite, and streaming services.
 *
 * API Documentation: https://guide.thedailyrail.com/api/v1/guide/{configuration_id}
 */

import { createCircuitBreaker } from './circuit-breaker'
import type { CircuitBreaker } from 'opossum'

export interface SportsGuideListing {
  time: string;
  date?: string;
  stations?: string[] | { [key: string]: string };
  channel_numbers?: {
    [lineup: string]: {
      [station: string]: number[];
    };
  };
  data: {
    [key: string]: string;
  };
}

export interface SportsGuideListingGroup {
  group_title: string;
  listings: SportsGuideListing[];
  data_descriptions: string[];
}

export interface SportsGuideResponse {
  listing_groups: SportsGuideListingGroup[];
}

export interface SportsGuideApiConfig {
  apiKey: string;
  userId: string;
  baseUrl: string;
}

export class SportsGuideApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'SportsGuideApiError';
  }
}

/**
 * Sports Guide API Client
 */
export class SportsGuideApi {
  private config: SportsGuideApiConfig;
  private circuitBreaker: CircuitBreaker<[string, RequestInit], Response>;

  constructor(config: SportsGuideApiConfig) {
    this.config = config;

    // Create circuit breaker for Sports Guide API calls with empty fallback
    this.circuitBreaker = createCircuitBreaker(
      async (url: string, options: RequestInit) => this.fetchWithoutCircuitBreaker(url, options),
      {
        name: 'sports-guide-api',
        timeout: 15000, // 15 seconds for guide data
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        rollingCountTimeout: 60000,
        volumeThreshold: 5 // Lower threshold since this is less frequently called
      },
      async () => {
        // Fallback: Return empty guide structure
        return new Response(JSON.stringify({ listing_groups: [] }), {
          status: 503,
          statusText: 'Service Unavailable - Circuit Breaker Open',
          headers: { 'Content-Type': 'application/json' }
        })
      }
    )
  }

  /**
   * Fetch without circuit breaker protection (used internally by circuit breaker)
   */
  private async fetchWithoutCircuitBreaker(url: string, options: RequestInit): Promise<Response> {
    return fetch(url, options)
  }

  /**
   * Fetch with circuit breaker protection
   */
  private async fetchWithCircuitBreaker(url: string, options: RequestInit): Promise<Response> {
    return this.circuitBreaker.fire(url, options)
  }

  /**
   * Verify API key is valid by making a test request
   */
  async verifyApiKey(): Promise<{ valid: boolean; message: string }> {
    try {
      const response = await this.fetchWithCircuitBreaker(
        `${this.config.baseUrl}/guide/${this.config.userId}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'apikey': this.config.apiKey,
          },
        }
      );

      if (response.ok) {
        return {
          valid: true,
          message: 'API key is valid and working',
        };
      } else if (response.status === 401 || response.status === 403) {
        return {
          valid: false,
          message: 'API key is invalid or unauthorized',
        };
      } else {
        return {
          valid: false,
          message: `API returned status ${response.status}`,
        };
      }
    } catch (error) {
      return {
        valid: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Fetch guide data for the configured user
   *
   * @param startDate - Optional start date (YYYY-MM-DD format)
   * @param endDate - Optional end date (YYYY-MM-DD format)
   */
  async fetchGuide(
    startDate?: string,
    endDate?: string
  ): Promise<SportsGuideResponse> {
    try {
      let url = `${this.config.baseUrl}/guide/${this.config.userId}`;

      // Add date parameters if provided
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await this.fetchWithCircuitBreaker(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'apikey': this.config.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new SportsGuideApiError(
          `API request failed: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const data = await response.json();
      return data as SportsGuideResponse;
    } catch (error) {
      if (error instanceof SportsGuideApiError) {
        throw error;
      }
      throw new SportsGuideApiError(
        `Failed to fetch guide data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Fetch guide data for today
   */
  async fetchTodayGuide(): Promise<SportsGuideResponse> {
    const today = new Date().toISOString().split('T')[0];
    return this.fetchGuide(today, today);
  }

  /**
   * Fetch guide data for a specific date range
   */
  async fetchDateRangeGuide(days: number = 7): Promise<SportsGuideResponse> {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    const startDateStr = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    return this.fetchGuide(startDateStr, endDateStr);
  }

  /**
   * Get channel listings for a specific lineup (SAT, DRTV, etc.)
   */
  getChannelsByLineup(
    guide: SportsGuideResponse,
    lineup: string
  ): Array<{
    time: string;
    station: string;
    channel: number;
    data: { [key: string]: string };
  }> {
    const channels: Array<{
      time: string;
      station: string;
      channel: number;
      data: { [key: string]: string };
    }> = [];

    for (const group of guide.listing_groups) {
      for (const listing of group.listings) {
        if (listing.channel_numbers && listing.channel_numbers[lineup]) {
          const lineupChannels = listing.channel_numbers[lineup];
          for (const [station, channelNumbers] of Object.entries(lineupChannels)) {
            for (const channel of channelNumbers) {
              channels.push({
                time: listing.time,
                station,
                channel,
                data: listing.data,
              });
            }
          }
        }
      }
    }

    return channels;
  }

  /**
   * Search guide for specific sport or team
   */
  searchGuide(
    guide: SportsGuideResponse,
    searchTerm: string
  ): SportsGuideListingGroup[] {
    const searchLower = searchTerm.toLowerCase();
    const results: SportsGuideListingGroup[] = [];

    for (const group of guide.listing_groups) {
      const matchingListings = group.listings.filter((listing) => {
        // Check if search term matches any data field
        return Object.values(listing.data).some((value) =>
          value.toLowerCase().includes(searchLower)
        );
      });

      if (matchingListings.length > 0) {
        results.push({
          ...group,
          listings: matchingListings,
        });
      }
    }

    return results;
  }
}

/**
 * Create Sports Guide API client from environment variables
 */
export function createSportsGuideApiFromEnv(): SportsGuideApi {
  const apiKey = process.env.SPORTS_GUIDE_API_KEY;
  const userId = process.env.SPORTS_GUIDE_USER_ID;
  const baseUrl = process.env.SPORTS_GUIDE_API_URL || 'https://guide.thedailyrail.com/api/v1';

  if (!apiKey || !userId) {
    throw new Error('Sports Guide API configuration missing in environment variables');
  }

  return new SportsGuideApi({
    apiKey,
    userId,
    baseUrl,
  });
}

/**
 * Singleton instance for server-side usage
 */
let apiInstance: SportsGuideApi | null = null;

export function getSportsGuideApi(): SportsGuideApi {
  if (!apiInstance) {
    apiInstance = createSportsGuideApiFromEnv();
  }
  return apiInstance;
}
