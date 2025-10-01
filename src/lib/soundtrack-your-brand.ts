
/**
 * Soundtrack Your Brand API Integration
 * https://api.soundtrackyourbrand.com/v2/docs
 * 
 * This integration uses the Soundtrack Your Brand GraphQL and REST APIs
 * Authentication: Basic Auth with API token
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

export class SoundtrackYourBrandAPI {
  private apiToken: string
  private baseUrl = 'https://api.soundtrackyourbrand.com/v2'

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  /**
   * Encode the API token for Basic Authentication
   * Soundtrack API requires the token to be base64 encoded with a colon appended
   */
  private getAuthHeader(): string {
    // Basic Authentication format: base64(token:)
    // The colon after the token indicates an empty password
    const credentials = `${this.apiToken}:`
    const base64Credentials = Buffer.from(credentials).toString('base64')
    return `Basic ${base64Credentials}`
  }

  /**
   * Make an authenticated request to the Soundtrack API
   * Uses Basic Authentication as required by Soundtrack
   */
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`
    
    // Soundtrack API uses Basic Authentication with base64 encoded token
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      // Provide detailed error messages
      let errorMessage = `Soundtrack API error: ${response.status} ${response.statusText}`
      
      try {
        const errorData = await response.json()
        if (errorData.message || errorData.error) {
          errorMessage = errorData.message || errorData.error
        }
      } catch (e) {
        // Could not parse error response
      }
      
      if (response.status === 404) {
        errorMessage = 'Soundtrack API endpoint not found. Please verify your account has access to this feature.'
      } else if (response.status === 401) {
        errorMessage = 'Authentication failed. Please check your API token is correct and not expired.'
      } else if (response.status === 403) {
        errorMessage = 'Access forbidden. Your account may not have permission for this feature.'
      }
      
      throw new Error(errorMessage)
    }

    return response.json()
  }

  /**
   * Make a GraphQL query to the Soundtrack API
   */
  private async graphql(query: string, variables: any = {}) {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify({ query, variables })
    })
  }

  /**
   * Test API connection with comprehensive diagnostics
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Test with the correct 'me' query structure
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
          message: result.errors[0]?.message || 'Failed to connect to Soundtrack API',
          details: {
            errors: result.errors
          }
        }
      }
      
      if (result.data?.me) {
        const accounts = result.data.me.accounts?.edges || []
        return {
          success: true,
          message: 'Successfully connected to Soundtrack Your Brand API',
          details: {
            clientType: result.data.me.__typename,
            accountsFound: accounts.length
          }
        }
      }
      
      return {
        success: false,
        message: 'Unexpected API response structure'
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Could not connect to Soundtrack API'
      }
    }
  }

  /**
   * Get current user's account information
   * Uses the 'me' query with PublicAPIClient inline fragment
   */
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
      throw new Error(result.errors[0]?.message || 'Failed to fetch account information')
    }
    
    const accounts = result.data?.me?.accounts?.edges?.map((edge: any) => ({
      id: edge.node.id,
      name: edge.node.businessName
    })) || []
    
    if (accounts.length === 0) {
      throw new Error('No accounts found for this Soundtrack API token')
    }
    
    return {
      id: accounts[0].id,
      name: accounts[0].name,
      accounts: accounts
    }
  }

  /**
   * List all sound zones (players) for the account
   * Uses the correct 'me' query with PublicAPIClient structure
   */
  async listSoundZones(accountId?: string): Promise<SoundtrackSoundZone[]> {
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
    
    // Flatten sound zones from all accounts
    for (const accountEdge of accounts) {
      const account = accountEdge.node
      const zones = account.soundZones?.edges || []
      
      for (const zoneEdge of zones) {
        const zone = zoneEdge.node
        soundZones.push({
          id: zone.id,
          name: zone.name,
          account: {
            id: account.id,
            name: account.businessName
          },
          currentPlayback: zone.currentPlayback
        })
      }
    }
    
    // Filter by account ID if provided
    if (accountId) {
      return soundZones.filter(zone => zone.account.id === accountId)
    }
    
    return soundZones
  }

  /**
   * Get a specific sound zone
   */
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

  /**
   * List available stations for an account
   */
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

  /**
   * Update a sound zone (play, pause, volume, station)
   */
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

  /**
   * Play a sound zone (optionally change station)
   */
  async play(soundZoneId: string, stationId?: string): Promise<void> {
    const data: any = { playing: true }
    if (stationId) data.stationId = stationId
    await this.updateSoundZone(soundZoneId, data)
  }

  /**
   * Pause a sound zone
   */
  async pause(soundZoneId: string): Promise<void> {
    await this.updateSoundZone(soundZoneId, { playing: false })
  }

  /**
   * Set volume for a sound zone
   */
  async setVolume(soundZoneId: string, volume: number): Promise<void> {
    await this.updateSoundZone(soundZoneId, { volume: Math.max(0, Math.min(100, volume)) })
  }

  /**
   * Change station on a sound zone
   */
  async changeStation(soundZoneId: string, stationId: string): Promise<void> {
    await this.updateSoundZone(soundZoneId, { stationId })
  }

  /**
   * Get now playing information for a sound zone
   */
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

// Singleton instance
let soundtrackAPI: SoundtrackYourBrandAPI | null = null

export function getSoundtrackAPI(apiToken?: string): SoundtrackYourBrandAPI {
  if (!soundtrackAPI) {
    const token = apiToken || process.env.SOUNDTRACK_API_TOKEN
    if (!token) {
      throw new Error('Soundtrack Your Brand API token not configured')
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
