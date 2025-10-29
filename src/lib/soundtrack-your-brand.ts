/**
 * Soundtrack Your Brand API Integration
 * https://api.soundtrackyourbrand.com/v2/docs
 * 
 * RATE LIMITING:
 * - Maximum tokens: 3600
 * - Token regeneration: 50 tokens per second
 * - Tokens deducted based on query complexity
 * 
 * AUTHENTICATION STRATEGY:
 * - Authenticate ONCE when token is saved
 * - Reuse token for all subsequent requests
 * - Token stored in database
 * - Only re-authenticate on 401 error
 */

export interface SoundtrackAccount {
  id: string
  name: string
  accounts?: Array<{
    id: string
    name: string
  }>
}

export interface SoundtrackStation {
  id: string
  name: string
  description?: string
  genre?: string
  mood?: string
  imageUrl?: string
}

export interface SoundtrackSoundZone {
  id: string
  name: string
  account: {
    id: string
    name: string
  }
  currentPlayback?: {
    station?: {
      id: string
      name: string
    }
    playing: boolean
    volume: number
  }
}

export interface NowPlaying {
  nowPlaying?: {
    track?: {
      title: string
      artist: string
      album?: string
      images?: Array<{ url: string }>
    }
    startedAt?: string
  }
}

class RateLimiter {
  private requestTimestamps: number[] = []
  private readonly maxRequestsPerSecond = 10
  private readonly minRequestInterval = 100
  private lastRequestTime = 0

  async waitIfNeeded(): Promise<void> {
    const now = Date.now()
    
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < 1000
    )

    if (this.requestTimestamps.length >= this.maxRequestsPerSecond) {
      const oldestTimestamp = this.requestTimestamps[0]
      const waitTime = 1000 - (now - oldestTimestamp) + 10
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    this.lastRequestTime = Date.now()
    this.requestTimestamps.push(this.lastRequestTime)
  }

  getStatus(): { requestsInLastSecond: number; canMakeRequest: boolean } {
    const now = Date.now()
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < 1000
    )
    return {
      requestsInLastSecond: this.requestTimestamps.length,
      canMakeRequest: this.requestTimestamps.length < this.maxRequestsPerSecond
    }
  }
}

export class SoundtrackYourBrandAPI {
  private apiToken: string
  private baseUrl = 'https://api.soundtrackyourbrand.com/v2'
  private rateLimiter = new RateLimiter()
  private tokenValidated = false

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  private getAuthHeader(): string {
    // Check if token is already base64 encoded (contains : when decoded)
    try {
      const decoded = Buffer.from(this.apiToken, 'base64').toString('utf-8')
      if (decoded.includes(':')) {
        // Token is already base64 encoded in "username:password" format
        console.log('[Soundtrack] Using pre-encoded token')
        return `Basic ${this.apiToken}`
      }
    } catch (e) {
      // Not base64, continue with normal encoding
    }

    // Token is plain, encode it as "token:" format
    const credentials = `${this.apiToken}:`
    const base64Credentials = Buffer.from(credentials).toString('base64')
    return `Basic ${base64Credentials}`
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    await this.rateLimiter.waitIfNeeded()

    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    })

    const rateLimitCost = response.headers.get('x-ratelimiting-cost')
    const tokensAvailable = response.headers.get('x-ratelimiting-tokens-available')
    if (rateLimitCost || tokensAvailable) {
      console.log(`[Soundtrack] Rate limit - Cost: ${rateLimitCost}, Available: ${tokensAvailable}`)
    }

    if (!response.ok) {
      let errorMessage = `Soundtrack API error: ${response.status} ${response.statusText}`
      
      try {
        const errorData = await response.json()
        if (errorData.message || errorData.error) {
          errorMessage = errorData.message || errorData.error
        }
      } catch (e) {
        // Could not parse error
      }
      
      if (response.status === 404) {
        errorMessage = 'Soundtrack API endpoint not found.'
      } else if (response.status === 401) {
        this.tokenValidated = false
        errorMessage = 'Authentication failed. Token may be expired.'
      } else if (response.status === 403) {
        errorMessage = 'Access forbidden. Check account permissions.'
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait before trying again.'
      }
      
      throw new Error(errorMessage)
    }

    if (!this.tokenValidated) {
      this.tokenValidated = true
    }

    return response.json()
  }

  private async graphql(query: string, variables: any = {}) {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify({ query, variables })
    })
  }

  isTokenValidated(): boolean {
    return this.tokenValidated
  }

  getRateLimitStatus() {
    return this.rateLimiter.getStatus()
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const testQuery = `
        query {
          me {
            __typename
            ... on PublicAPIClient {
              accounts(first: 1) {
                edges {
                  node {
                    id
                    businessName
                  }
                }
              }
            }
          }
        }
      `
      
      const result = await this.graphql(testQuery)
      
      if (result.errors) {
        return {
          success: false,
          message: result.errors[0]?.message || 'Failed to connect',
          details: { errors: result.errors }
        }
      }
      
      if (result.data?.me) {
        const accounts = result.data.me.accounts?.edges || []
        this.tokenValidated = true
        return {
          success: true,
          message: 'Successfully connected to Soundtrack API',
          details: {
            clientType: result.data.me.__typename,
            accountsFound: accounts.length
          }
        }
      }
      
      return {
        success: false,
        message: 'Unexpected API response'
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Connection failed'
      }
    }
  }

  async getAccount(): Promise<SoundtrackAccount> {
    const query = `
      query {
        me {
          ... on PublicAPIClient {
            accounts(first: 10) {
              edges {
                node {
                  id
                  businessName
                }
              }
            }
          }
        }
      }
    `
    
    const result = await this.graphql(query)
    
    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'Failed to fetch account')
    }
    
    const accounts = result.data?.me?.accounts?.edges?.map((edge: any) => ({
      id: edge.node.id,
      name: edge.node.businessName
    })) || []
    
    if (accounts.length === 0) {
      throw new Error('No accounts found')
    }
    
    return {
      id: accounts[0].id,
      name: accounts[0].name,
      accounts: accounts
    }
  }

  async listSoundZones(accountId?: string): Promise<SoundtrackSoundZone[]> {
    // First, get the list of sound zones (without currentPlayback - not supported in list query)
    const query = `
      query {
        me {
          ... on PublicAPIClient {
            accounts(first: 10) {
              edges {
                node {
                  id
                  businessName
                  soundZones(first: 100) {
                    edges {
                      node {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `

    const result = await this.graphql(query)

    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'Failed to fetch sound zones')
    }

    const accounts = result.data?.me?.accounts?.edges || []
    const soundZones: SoundtrackSoundZone[] = []

    for (const accountEdge of accounts) {
      const account = accountEdge?.node
      if (!account || !account.id) continue

      const zones = account.soundZones?.edges || []

      for (const zoneEdge of zones) {
        const zone = zoneEdge?.node
        if (!zone || !zone.id || !zone.name) continue

        soundZones.push({
          id: zone.id,
          name: zone.name,
          account: {
            id: account.id,
            name: account.businessName
          },
          currentPlayback: null
        })
      }
    }

    // Filter by accountId if specified
    let filteredZones = soundZones
    if (accountId) {
      filteredZones = soundZones.filter(zone => zone.account.id === accountId)
    }

    // Now fetch currentPlayback for each zone individually
    // Note: This makes multiple API calls, but it's the only way to get live playback status
    const zonesWithPlayback = await Promise.all(
      filteredZones.map(async (zone) => {
        try {
          const fullZone = await this.getSoundZone(zone.id)
          return fullZone
        } catch (error) {
          // If fetching a single zone fails, return the zone without playback info
          console.error(`Failed to fetch playback for zone ${zone.id}:`, error)
          return zone
        }
      })
    )

    return zonesWithPlayback
  }

  async getSoundZone(soundZoneId: string): Promise<SoundtrackSoundZone> {
    const query = `
      query GetSoundZone($id: ID!) {
        soundZone(id: $id) {
          id
          name
          account {
            id
            name
          }
          currentPlayback {
            station {
              id
              name
            }
            playing
            volume
          }
        }
      }
    `
    
    const result = await this.graphql(query, { id: soundZoneId })
    
    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'Failed to fetch sound zone')
    }
    
    return result.data.soundZone
  }

  async listStations(accountId: string): Promise<SoundtrackStation[]> {
    const query = `
      query ListStations($accountId: ID!) {
        account(id: $accountId) {
          stations {
            id
            name
          }
        }
      }
    `
    
    const result = await this.graphql(query, { accountId })
    
    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'Failed to fetch stations')
    }
    
    return result.data?.account?.stations || []
  }

  async updateSoundZone(soundZoneId: string, data: {
    stationId?: string
    volume?: number
    playing?: boolean
  }): Promise<SoundtrackSoundZone> {
    const mutation = `
      mutation UpdateSoundZone($id: ID!, $input: SoundZoneInput!) {
        updateSoundZone(id: $id, input: $input) {
          soundZone {
            id
            name
            currentPlayback {
              station {
                id
                name
              }
              playing
              volume
            }
          }
        }
      }
    `
    
    const input: any = {}
    if (data.stationId !== undefined) input.stationId = data.stationId
    if (data.volume !== undefined) input.volume = Math.max(0, Math.min(100, data.volume))
    if (data.playing !== undefined) input.playing = data.playing
    
    const result = await this.graphql(mutation, { id: soundZoneId, input })
    
    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'Failed to update sound zone')
    }
    
    return result.data.updateSoundZone.soundZone
  }

  async play(soundZoneId: string, stationId?: string): Promise<void> {
    const data: any = { playing: true }
    if (stationId) data.stationId = stationId
    await this.updateSoundZone(soundZoneId, data)
  }

  async pause(soundZoneId: string): Promise<void> {
    await this.updateSoundZone(soundZoneId, { playing: false })
  }

  async setVolume(soundZoneId: string, volume: number): Promise<void> {
    await this.updateSoundZone(soundZoneId, { volume: Math.max(0, Math.min(100, volume)) })
  }

  async changeStation(soundZoneId: string, stationId: string): Promise<void> {
    await this.updateSoundZone(soundZoneId, { stationId })
  }

  async getNowPlaying(soundZoneId: string): Promise<NowPlaying | null> {
    try {
      const query = `
        query GetNowPlaying($id: ID!) {
          soundZone(id: $id) {
            nowPlaying {
              track {
                title
                artist
                album
                images {
                  url
                }
              }
              startedAt
            }
          }
        }
      `
      
      const result = await this.graphql(query, { id: soundZoneId })
      
      if (result.errors) {
        return null
      }
      
      return result.data?.soundZone || null
    } catch (error) {
      return null
    }
  }
}

let soundtrackAPI: SoundtrackYourBrandAPI | null = null

export function getSoundtrackAPI(apiToken?: string): SoundtrackYourBrandAPI {
  // If a token is explicitly provided, always use it (recreate instance if needed)
  // This ensures we always use the latest token from the database
  if (apiToken) {
    soundtrackAPI = new SoundtrackYourBrandAPI(apiToken)
    return soundtrackAPI
  }

  // Otherwise, reuse existing instance or create from environment
  if (!soundtrackAPI) {
    const token = process.env.SOUNDTRACK_API_TOKEN
    if (!token) {
      throw new Error('Soundtrack API token not configured')
    }
    soundtrackAPI = new SoundtrackYourBrandAPI(token)
  }
  return soundtrackAPI
}

export function setSoundtrackAPIToken(apiToken: string) {
  soundtrackAPI = new SoundtrackYourBrandAPI(apiToken)
}

export function clearSoundtrackAPI() {
  soundtrackAPI = null
}
