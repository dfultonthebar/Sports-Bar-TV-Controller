
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
   * Make an authenticated request to the Soundtrack API
   * Uses Basic Authentication as required by Soundtrack
   */
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`
    
    // Soundtrack API uses Basic Authentication
    // The token should already be base64 encoded from the Soundtrack dashboard
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Basic ${this.apiToken}`,
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
   * Test API connection by fetching user accounts
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const query = `
        query {
          me {
            id
            accounts {
              id
              name
            }
          }
        }
      `
      
      const result = await this.graphql(query)
      
      if (result.data && result.data.me) {
        return {
          success: true,
          message: 'Successfully connected to Soundtrack Your Brand API',
          details: result.data
        }
      } else if (result.errors) {
        return {
          success: false,
          message: result.errors[0]?.message || 'GraphQL query failed',
          details: result.errors
        }
      }
      
      return {
        success: false,
        message: 'Unexpected API response format'
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
   */
  async getAccount(): Promise<SoundtrackAccount> {
    const query = `
      query {
        me {
          id
          accounts {
            id
            name
          }
        }
      }
    `
    
    const result = await this.graphql(query)
    
    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'Failed to fetch account')
    }
    
    return result.data.me
  }

  /**
   * List all sound zones for the account
   */
  async listSoundZones(accountId?: string): Promise<SoundtrackSoundZone[]> {
    const query = `
      query ListSoundZones($accountId: ID) {
        me {
          accounts(id: $accountId) {
            soundZones {
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
        }
      }
    `
    
    const result = await this.graphql(query, { accountId })
    
    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'Failed to fetch sound zones')
    }
    
    const soundZones: SoundtrackSoundZone[] = []
    result.data?.me?.accounts?.forEach((account: any) => {
      if (account.soundZones) {
        soundZones.push(...account.soundZones)
      }
    })
    
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
