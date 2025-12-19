import { logger } from '@sports-bar/logger'

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
        logger.info('[Soundtrack] Using pre-encoded token')
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
      logger.info(`[Soundtrack] Rate limit - Cost: ${rateLimitCost}, Available: ${tokensAvailable}`)
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
          logger.error(`Failed to fetch playback for zone ${zone.id}:`, error)
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
            businessName
          }
        }
      }
    `

    const result = await this.graphql(query, { id: soundZoneId })

    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'Failed to fetch sound zone')
    }

    const zone = result.data.soundZone
    return {
      ...zone,
      account: {
        id: zone.account.id,
        name: zone.account.businessName
      },
      currentPlayback: undefined // Soundtrack API does not provide currentPlayback data
    }
  }

  async listStations(accountId?: string): Promise<SoundtrackStation[]> {
    // Query playlists from sound zones' playFrom field
    // This gets all currently assigned playlists across all sound zones
    const query = `
      query {
        me {
          ... on PublicAPIClient {
            accounts(first: 10) {
              edges {
                node {
                  id
                  soundZones(first: 100) {
                    edges {
                      node {
                        playFrom {
                          __typename
                          ... on Playlist {
                            id
                            name
                          }
                          ... on Schedule {
                            id
                            name
                          }
                          ... on Soundtrack {
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
        }
      }
    `

    const result = await this.graphql(query)

    if (result.errors) {
      logger.error('[Soundtrack] Error fetching playlists:', { data: JSON.stringify(result.errors, null, 2) })
      return []
    }

    const accounts = result.data?.me?.accounts?.edges || []
    const uniquePlaylists = new Map<string, SoundtrackStation>()

    for (const accountEdge of accounts) {
      const account = accountEdge?.node
      if (!account || !account.id) continue

      const soundZones = account.soundZones?.edges || []

      for (const zoneEdge of soundZones) {
        const zone = zoneEdge?.node
        if (!zone || !zone.playFrom) continue

        const playFrom = zone.playFrom
        if (playFrom.id && playFrom.name) {
          uniquePlaylists.set(playFrom.id, {
            id: playFrom.id,
            name: playFrom.name,
            description: `Type: ${playFrom.__typename}`
          })
        }
      }
    }

    logger.info(`[Soundtrack] Found ${uniquePlaylists.size} unique playlists`)
    return Array.from(uniquePlaylists.values())
  }

  async updateSoundZone(soundZoneId: string, data: {
    stationId?: string
    volume?: number
    playing?: boolean
  }): Promise<SoundtrackSoundZone> {
    // According to Soundtrack API v2, use separate mutations for play/pause and station changes
    // Correct mutation names are 'play' and 'pause' (not 'playSoundZone' or 'pauseSoundZone')
    // Input types are PlayInput and PauseInput with 'soundZone' field (not 'id')

    const result: any = { soundZone: {} }

    // Handle play/pause state
    if (data.playing !== undefined) {
      const playbackMutation = data.playing ? `
        mutation Play($input: PlayInput!) {
          play(input: $input) {
            status
          }
        }
      ` : `
        mutation Pause($input: PauseInput!) {
          pause(input: $input) {
            status
          }
        }
      `

      const playbackResult = await this.graphql(playbackMutation, {
        input: { soundZone: soundZoneId }
      })

      if (playbackResult.errors) {
        logger.error('[Soundtrack] Play/pause error:', { data: JSON.stringify(playbackResult.errors, null, 2) })
        throw new Error(playbackResult.errors[0]?.message || 'Failed to control playback')
      }

      const mutationName = data.playing ? 'play' : 'pause'
      const status = playbackResult.data[mutationName].status
      logger.info(`[Soundtrack] ${data.playing ? 'Play' : 'Pause'} mutation completed with status: ${status}`)

      // Populate result with basic zone info since mutation doesn't return full zone data
      result.soundZone = {
        id: soundZoneId,
        name: 'Sound Zone', // Name will be populated if we fetch full zone data later
        account: { id: '', name: '' },
        currentPlayback: {
          playing: data.playing,
          volume: 0,
          station: null
        }
      }
    }

    // Handle playlist/station change (if needed)
    if (data.stationId) {
      const stationMutation = `
        mutation SetPlayFrom($input: SetPlayFromInput!) {
          setPlayFrom(input: $input) {
            clientMutationId
          }
        }
      `

      const stationResult = await this.graphql(stationMutation, {
        input: {
          soundZone: soundZoneId,
          source: data.stationId
        }
      })

      if (stationResult.errors) {
        logger.error('[Soundtrack] Playlist/station change error:', { data: JSON.stringify(stationResult.errors, null, 2) })
        throw new Error(stationResult.errors[0]?.message || 'Failed to change playlist/station')
      }

      logger.info(`[Soundtrack] setPlayFrom mutation completed successfully`)

      // Update result to reflect the change
      result.soundZone.currentPlayback = {
        ...result.soundZone.currentPlayback,
        station: { id: data.stationId, name: 'Playlist' }
      }
    }

    // Volume changes are not supported by Soundtrack API v2 (controlled via hardware mixer)
    if (data.volume !== undefined) {
      logger.warn('[Soundtrack] Volume control not supported via API - use Atlas audio mixer')
    }

    return result.soundZone
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
      // According to Soundtrack API docs, nowPlaying is a root query, not nested in soundZone
      const query = `
        query GetNowPlaying($id: ID!) {
          nowPlaying(soundZone: $id) {
            track {
              name
              artists {
                name
              }
              album {
                name
              }
            }
            startedAt
          }
        }
      `

      const result = await this.graphql(query, { id: soundZoneId })

      if (result.errors) {
        logger.error('[Soundtrack] getNowPlaying GraphQL errors:', { data: JSON.stringify(result.errors, null, 2) })
        return null
      }

      const nowPlaying = result.data?.nowPlaying
      if (!nowPlaying) {
        return null
      }

      // Return just the inner object for the component
      // Component expects: { track: { title, artist, album }, startedAt }
      return {
        track: {
          title: nowPlaying.track?.name || '',
          artist: nowPlaying.track?.artists?.map((a: any) => a.name).join(', ') || '',
          album: nowPlaying.track?.album?.name
        },
        startedAt: nowPlaying.startedAt
      } as any
    } catch (error) {
      logger.error('[Soundtrack] getNowPlaying exception:', error)
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
