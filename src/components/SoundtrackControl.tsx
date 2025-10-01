
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  Music, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Radio,
  Disc,
  Music2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Settings,
  AlertCircle
} from 'lucide-react'
import Image from 'next/image'

interface SoundtrackStation {
  id: string
  name: string
  description?: string
  genre?: string
  mood?: string
  imageUrl?: string
}

interface SoundtrackPlayer {
  id: string
  name: string
  accountId: string
  currentStation?: SoundtrackStation
  isPlaying: boolean
  volume: number
  lastUpdated: string
}

interface NowPlaying {
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

interface SoundtrackControlProps {
  zoneId?: string
  zoneName?: string
  compact?: boolean
}

export default function SoundtrackControl({ 
  zoneId = 'default', 
  zoneName = 'Audio Zone',
  compact = false 
}: SoundtrackControlProps) {
  const [players, setPlayers] = useState<SoundtrackPlayer[]>([])
  const [stations, setStations] = useState<SoundtrackStation[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<SoundtrackPlayer | null>(null)
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showStations, setShowStations] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(() => {
      if (selectedPlayer) {
        updateNowPlaying(selectedPlayer.id)
      }
    }, 10000) // Update every 10 seconds
    return () => clearInterval(interval)
  }, [selectedPlayer])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load players and stations in parallel
      const [playersRes, stationsRes] = await Promise.all([
        fetch('/api/soundtrack/players'),
        fetch('/api/soundtrack/stations')
      ])

      if (playersRes.ok) {
        const data = await playersRes.json()
        setPlayers(data.players || [])
        if (data.players?.[0]) {
          setSelectedPlayer(data.players[0])
          updateNowPlaying(data.players[0].id)
        }
      } else if (playersRes.status === 404) {
        const data = await playersRes.json()
        if (data.error && data.error.includes('not configured')) {
          setError('Soundtrack Your Brand is not configured. Please configure your API key in the system settings.')
          return
        }
      }

      if (stationsRes.ok) {
        const data = await stationsRes.json()
        setStations(data.stations || [])
      }
    } catch (err: any) {
      console.error('Failed to load Soundtrack data:', err)
      setError(err.message || 'Failed to connect to Soundtrack Your Brand')
    } finally {
      setLoading(false)
    }
  }

  const updateNowPlaying = async (playerId: string) => {
    try {
      const response = await fetch(`/api/soundtrack/now-playing?playerId=${playerId}`)
      if (response.ok) {
        const data = await response.json()
        setNowPlaying(data.nowPlaying)
      }
    } catch (err) {
      console.error('Failed to get now playing:', err)
    }
  }

  const handlePlayPause = async () => {
    if (!selectedPlayer) return
    
    try {
      const response = await fetch('/api/soundtrack/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedPlayer.id,
          playing: !selectedPlayer.isPlaying
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedPlayer(data.player)
      }
    } catch (err) {
      console.error('Failed to toggle playback:', err)
    }
  }

  const handleVolumeChange = async (delta: number) => {
    if (!selectedPlayer) return
    
    const newVolume = Math.max(0, Math.min(100, selectedPlayer.volume + delta))
    
    try {
      const response = await fetch('/api/soundtrack/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedPlayer.id,
          volume: newVolume
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedPlayer(data.player)
      }
    } catch (err) {
      console.error('Failed to change volume:', err)
    }
  }

  const handleStationChange = async (stationId: string) => {
    if (!selectedPlayer) return
    
    try {
      const response = await fetch('/api/soundtrack/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedPlayer.id,
          stationId: stationId,
          playing: true
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedPlayer(data.player)
        setShowStations(false)
        setTimeout(() => updateNowPlaying(data.player.id), 1000)
      }
    } catch (err) {
      console.error('Failed to change station:', err)
    }
  }

  if (loading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
          <span className="ml-2 text-slate-500">Loading Soundtrack...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-8">
          <div className="flex items-center justify-center text-red-400">
            <AlertCircle className="w-6 h-6 mr-2" />
            <span>{error}</span>
          </div>
          <div className="text-center mt-4">
            <Button onClick={loadData} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!selectedPlayer) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-8 text-center text-slate-500">
          No Soundtrack players found
        </CardContent>
      </Card>
    )
  }

  if (compact) {
    return (
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Music2 className="w-5 h-5 text-purple-400" />
            <span className="text-white font-medium">{zoneName}</span>
          </div>
          <Badge variant={selectedPlayer.isPlaying ? "default" : "secondary"}>
            {selectedPlayer.isPlaying ? 'Playing' : 'Paused'}
          </Badge>
        </div>

        {nowPlaying && (
          <div className="mb-3 text-sm">
            <div className="text-white font-medium truncate">{nowPlaying.track.title}</div>
            <div className="text-slate-500 truncate">{nowPlaying.track.artist}</div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            onClick={handlePlayPause}
            size="sm"
            variant={selectedPlayer.isPlaying ? "secondary" : "default"}
          >
            {selectedPlayer.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>

          <div className="flex items-center space-x-2">
            <Button 
              onClick={() => handleVolumeChange(-10)} 
              size="sm" 
              variant="outline"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
            <span className="text-white font-mono w-8 text-center">{selectedPlayer.volume}</span>
            <Button 
              onClick={() => handleVolumeChange(10)} 
              size="sm" 
              variant="outline"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Music className="w-6 h-6 text-purple-400" />
            <CardTitle className="text-white">Soundtrack Your Brand</CardTitle>
          </div>
          <Button onClick={loadData} size="sm" variant="ghost">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <CardDescription className="text-slate-500">{zoneName}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Now Playing */}
        {nowPlaying && (
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-start space-x-4">
              {nowPlaying.track.albumArt && (
                <div className="relative w-20 h-20 rounded overflow-hidden flex-shrink-0">
                  <Image
                    src={nowPlaying.track.albumArt}
                    alt={nowPlaying.track.album || 'Album art'}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <Disc className="w-4 h-4 text-purple-400" />
                  <Badge variant="secondary" className="text-xs">
                    {nowPlaying.station.name}
                  </Badge>
                </div>
                <h3 className="text-white font-semibold truncate">{nowPlaying.track.title}</h3>
                <p className="text-slate-500 text-sm truncate">{nowPlaying.track.artist}</p>
                {nowPlaying.track.album && (
                  <p className="text-slate-400 text-xs truncate">{nowPlaying.track.album}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Player Controls */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <Badge variant={selectedPlayer.isPlaying ? "default" : "secondary"}>
              {selectedPlayer.isPlaying ? 'Playing' : 'Paused'}
            </Badge>
            <span className="text-slate-500 text-sm">{selectedPlayer.name}</span>
          </div>

          <div className="flex items-center justify-between">
            <Button
              onClick={handlePlayPause}
              variant={selectedPlayer.isPlaying ? "secondary" : "default"}
            >
              {selectedPlayer.isPlaying ? (
                <>
                  <Pause className="w-5 h-5 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Play
                </>
              )}
            </Button>

            <div className="flex items-center space-x-3">
              <Button 
                onClick={() => handleVolumeChange(-10)} 
                size="sm" 
                variant="outline"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              <div className="flex items-center space-x-2">
                <Volume2 className="w-5 h-5 text-slate-500" />
                <span className="text-white font-mono w-12 text-center text-lg">
                  {selectedPlayer.volume}
                </span>
              </div>
              <Button 
                onClick={() => handleVolumeChange(10)} 
                size="sm" 
                variant="outline"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Station Selection */}
        <div>
          <Button
            onClick={() => setShowStations(!showStations)}
            variant="outline"
            className="w-full justify-between"
          >
            <div className="flex items-center">
              <Radio className="w-4 h-4 mr-2" />
              {selectedPlayer.currentStation?.name || 'Select Station'}
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showStations ? 'rotate-180' : ''}`} />
          </Button>

          {showStations && (
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {stations.map((station) => (
                <button
                  key={station.id}
                  onClick={() => handleStationChange(station.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedPlayer.currentStation?.id === station.id
                      ? 'bg-purple-500/20 border-purple-500 text-white'
                      : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium">{station.name}</div>
                  {station.description && (
                    <div className="text-xs text-slate-500 mt-1">{station.description}</div>
                  )}
                  {(station.genre || station.mood) && (
                    <div className="flex gap-2 mt-2">
                      {station.genre && (
                        <Badge variant="secondary" className="text-xs">{station.genre}</Badge>
                      )}
                      {station.mood && (
                        <Badge variant="outline" className="text-xs">{station.mood}</Badge>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
