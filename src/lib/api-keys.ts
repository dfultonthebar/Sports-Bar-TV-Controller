
// Utility functions for managing API keys from the database

import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { decrypt } from './encryption'

interface ApiKeyData {
  id: string
  name: string
  provider: string
  keyValue: string
  isActive: boolean
  description?: string
}

/**
 * Get API keys for a specific provider
 */
export async function getApiKeysByProvider(provider: string): Promise<ApiKeyData[]> {
  try {
    const apiKeys = await db
      .select()
      .from(schema.apiKeys)
      .where(
        and(
          eq(schema.apiKeys.provider, provider),
          eq(schema.apiKeys.isActive, true)
        )
      )
      .all()

    // Decrypt the key values
    return apiKeys.map(key => ({
      ...key,
      keyValue: decrypt(key.keyValue),
      description: key.description ?? undefined
    }))
  } catch (error) {
    console.error(`Error fetching API keys for provider ${provider}:`, error)
    return []
  }
}

/**
 * Get the first active API key for a provider
 */
export async function getApiKey(provider: string): Promise<string | null> {
  try {
    const apiKey = await db
      .select()
      .from(schema.apiKeys)
      .where(
        and(
          eq(schema.apiKeys.provider, provider),
          eq(schema.apiKeys.isActive, true)
        )
      )
      .limit(1)
      .get()

    if (!apiKey) {
      return null
    }

    return decrypt(apiKey.keyValue)
  } catch (error) {
    console.error(`Error fetching API key for provider ${provider}:`, error)
    return null
  }
}

/**
 * Get multiple API keys by their names for a provider
 */
export async function getApiKeysByNames(provider: string, names: string[]): Promise<Record<string, string>> {
  try {
    const { inArray } = await import('drizzle-orm')

    const apiKeys = await db
      .select()
      .from(schema.apiKeys)
      .where(
        and(
          eq(schema.apiKeys.provider, provider),
          eq(schema.apiKeys.isActive, true),
          inArray(schema.apiKeys.name, names)
        )
      )
      .all()

    const result: Record<string, string> = {}
    apiKeys.forEach(key => {
      result[key.name] = decrypt(key.keyValue)
    })

    return result
  } catch (error) {
    console.error(`Error fetching API keys by names for provider ${provider}:`, error)
    return {}
  }
}

/**
 * Get Gracenote configuration from database
 */
export async function getGracenoteConfig(): Promise<{
  apiKey?: string
  partnerId?: string
  userId?: string
  baseUrl?: string
}> {
  try {
    const keys = await getApiKeysByProvider('gracenote')
    const config: any = {}

    keys.forEach(key => {
      const lowerName = key.name.toLowerCase()
      if (lowerName.includes('api') && lowerName.includes('key')) {
        config.apiKey = key.keyValue
      } else if (lowerName.includes('partner') && lowerName.includes('id')) {
        config.partnerId = key.keyValue
      } else if (lowerName.includes('user') && lowerName.includes('id')) {
        config.userId = key.keyValue
      } else if (lowerName.includes('base') && lowerName.includes('url')) {
        config.baseUrl = key.keyValue
      } else {
        // Fallback - if only one key, assume it's the API key
        if (!config.apiKey) {
          config.apiKey = key.keyValue
        }
      }
    })

    // Add default base URL if not provided
    if (!config.baseUrl) {
      config.baseUrl = 'https://c.web.cddbp.net/webapi/xml/1.0/'
    }

    return config
  } catch (error) {
    console.error('Error getting Gracenote config:', error)
    return {}
  }
}

/**
 * Get Spectrum Business configuration from database
 */
export async function getSpectrumBusinessConfig(): Promise<{
  apiKey?: string
  accountId?: string
  clientId?: string
  clientSecret?: string
  region?: string
}> {
  try {
    const keys = await getApiKeysByProvider('spectrum-business')
    const config: any = {}

    keys.forEach(key => {
      const lowerName = key.name.toLowerCase()
      if (lowerName.includes('api') && lowerName.includes('key')) {
        config.apiKey = key.keyValue
      } else if (lowerName.includes('account') && lowerName.includes('id')) {
        config.accountId = key.keyValue
      } else if (lowerName.includes('client') && lowerName.includes('id')) {
        config.clientId = key.keyValue
      } else if (lowerName.includes('client') && lowerName.includes('secret')) {
        config.clientSecret = key.keyValue
      } else if (lowerName.includes('region')) {
        config.region = key.keyValue
      } else {
        // Fallback - if only one key, assume it's the API key
        if (!config.apiKey) {
          config.apiKey = key.keyValue
        }
      }
    })

    // Add default region if not provided
    if (!config.region) {
      config.region = 'midwest'
    }

    return config
  } catch (error) {
    console.error('Error getting Spectrum Business config:', error)
    return {}
  }
}

/**
 * Check if a provider is configured with API keys
 */
export async function isProviderConfigured(provider: string): Promise<boolean> {
  try {
    const { count } = await import('drizzle-orm')

    const result = await db
      .select({ count: count() })
      .from(schema.apiKeys)
      .where(
        and(
          eq(schema.apiKeys.provider, provider),
          eq(schema.apiKeys.isActive, true)
        )
      )
      .get()

    return (result?.count ?? 0) > 0
  } catch (error) {
    console.error(`Error checking if provider ${provider} is configured:`, error)
    return false
  }
}
