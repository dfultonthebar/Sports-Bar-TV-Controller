/**
 * API Keys configuration for TV Guide services
 *
 * This module provides configuration from environment variables.
 * In a server context, the app may override these with database-stored values.
 */

export interface GracenoteConfig {
  apiKey?: string
  partnerId?: string
  userId?: string
  baseUrl?: string
}

export interface SpectrumBusinessConfig {
  apiKey?: string
  accountId?: string
  clientId?: string
  clientSecret?: string
  region?: string
}

/**
 * Get Gracenote configuration from environment variables
 */
export async function getGracenoteConfig(): Promise<GracenoteConfig> {
  return {
    apiKey: process.env.GRACENOTE_API_KEY,
    partnerId: process.env.GRACENOTE_PARTNER_ID,
    userId: process.env.GRACENOTE_USER_ID,
    baseUrl: process.env.GRACENOTE_BASE_URL || 'https://c.web.cddbp.net/webapi/xml/1.0/'
  }
}

/**
 * Get Spectrum Business configuration from environment variables
 */
export async function getSpectrumBusinessConfig(): Promise<SpectrumBusinessConfig> {
  return {
    apiKey: process.env.SPECTRUM_BUSINESS_API_KEY,
    accountId: process.env.SPECTRUM_BUSINESS_ACCOUNT_ID,
    clientId: process.env.SPECTRUM_BUSINESS_CLIENT_ID,
    clientSecret: process.env.SPECTRUM_BUSINESS_CLIENT_SECRET,
    region: process.env.SPECTRUM_BUSINESS_REGION || 'midwest'
  }
}
