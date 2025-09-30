
/**
 * Soundtrack Your Brand API Integration
 * https://soundtrack.api-docs.io/
 */

export interface SoundtrackAccount {
  id: string
  name: string
  token: string
}

export interface SoundtrackStation {
  id: string
  name: string
  description?: string
  genre?: string
  mood?: string
  imageUrl?: string
}

export interface SoundtrackPlayer {
  id: string
  name: string
  accountId: string
  currentStation?: SoundtrackStation
  isPlaying: boolean
  volume: number
  lastUpdated: string
}

export interface NowPlaying {
  track: {
    title: string
    artist: string
    album?: string
    albumArt?: string
  }
  station: {
    id: string
    name: string
  }
  startedAt: string
}

export class SoundtrackYourBrandAPI {
  private apiKey: string
  private baseUrl = 'https://api.soundtrackyourbrand.com/v2'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Soundtrack API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Account Management
  async getAccount(): Promise<any> {
    return this.request('/account')
  }

  // Stations
  async listStations(): Promise<SoundtrackStation[]> {
    const response = await this.request('/stations')
    return response.stations || []
  }

  async getStation(stationId: string): Promise<SoundtrackStation> {
    return this.request(`/stations/${stationId}`)
  }

  // Players (Sound Zones)
  async listPlayers(): Promise<SoundtrackPlayer[]> {
    const response = await this.request('/players')
    return response.players || []
  }

  async getPlayer(playerId: string): Promise<SoundtrackPlayer> {
    return this.request(`/players/${playerId}`)
  }

  async updatePlayer(playerId: string, data: {
    stationId?: string
    volume?: number
    playing?: boolean
  }): Promise<SoundtrackPlayer> {
    return this.request(`/players/${playerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  // Playback Control
  async play(playerId: string, stationId?: string): Promise<void> {
    const data: any = { playing: true }
    if (stationId) data.stationId = stationId
    await this.updatePlayer(playerId, data)
  }

  async pause(playerId: string): Promise<void> {
    await this.updatePlayer(playerId, { playing: false })
  }

  async setVolume(playerId: string, volume: number): Promise<void> {
    await this.updatePlayer(playerId, { volume: Math.max(0, Math.min(100, volume)) })
  }

  async changeStation(playerId: string, stationId: string): Promise<void> {
    await this.updatePlayer(playerId, { stationId })
  }

  // Now Playing
  async getNowPlaying(playerId: string): Promise<NowPlaying | null> {
    try {
      return await this.request(`/players/${playerId}/now-playing`)
    } catch (error) {
      return null
    }
  }

  // Soundzones (Multi-room audio)
  async getSoundzones(): Promise<any[]> {
    const response = await this.request('/soundzones')
    return response.soundzones || []
  }

  async createSoundzone(name: string, playerIds: string[]): Promise<any> {
    return this.request('/soundzones', {
      method: 'POST',
      body: JSON.stringify({ name, players: playerIds }),
    })
  }

  async updateSoundzone(soundzoneId: string, data: {
    name?: string
    stationId?: string
    volume?: number
    playing?: boolean
  }): Promise<any> {
    return this.request(`/soundzones/${soundzoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }
}

// Singleton instance
let soundtrackAPI: SoundtrackYourBrandAPI | null = null

export function getSoundtrackAPI(apiKey?: string): SoundtrackYourBrandAPI {
  if (!soundtrackAPI) {
    const key = apiKey || process.env.SOUNDTRACK_API_KEY
    if (!key) {
      throw new Error('Soundtrack Your Brand API key not configured')
    }
    soundtrackAPI = new SoundtrackYourBrandAPI(key)
  }
  return soundtrackAPI
}

export function setSoundtrackAPIKey(apiKey: string) {
  soundtrackAPI = new SoundtrackYourBrandAPI(apiKey)
}
