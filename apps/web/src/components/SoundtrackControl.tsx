
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
  Radio,
  Disc,
  Music2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import Image from 'next/image'

import { logger } from '@/lib/logger'
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
  showVolumeControls?: boolean
  bartenderOnly?: boolean
}

export default function SoundtrackControl({
  zoneId = 'default',
  zoneName = 'Audio Zone',
  compact = false,
  showVolumeControls = true,
  bartenderOnly = false
}: SoundtrackControlProps) {
  const [players, setPlayers] = useState<SoundtrackPlayer[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<SoundtrackPlayer | null>(null)
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load data once on mount
  useEffect(() => {
    loadData()
  }, [])

  // Set up interval for updating now playing when player changes
  useEffect(() => {
    if (!selectedPlayer) return

    // Update immediately
    updateNowPlaying(selectedPlayer.id)

    // Then update every 10 seconds
    const interval = setInterval(() => {
      updateNowPlaying(selectedPlayer.id)
    }, 10000)

    return () => clearInterval(interval)
  }, [selectedPlayer])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load players
      const queryParam = bartenderOnly ? '?bartenderOnly=true' : ''
      const playersRes = await fetch(`/api/soundtrack/players${queryParam}`)

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
    } catch (err: any) {
      logger.error('Failed to load Soundtrack data:', err)
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
      logger.error('Failed to get now playing:', err)
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
      logger.error('Failed to toggle playback:', err)
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
      logger.error('Failed to change volume:', err)
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

          {showVolumeControls && (
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
          )}
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
                    {selectedPlayer?.currentStation?.name || 'Now Playing'}
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

            {showVolumeControls && (
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
            )}
          </div>
        </div>

        {/* Current Station Display */}
        {selectedPlayer.currentStation && (
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center text-slate-400 text-sm mb-1">
              <Radio className="w-4 h-4 mr-2" />
              <span>Current Playlist</span>
            </div>
            <div className="text-white font-medium">{selectedPlayer.currentStation.name}</div>
          </div>
        )}

        {/* Playlist Management Info */}
        <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3">
          <p className="text-xs text-blue-200">
            <strong>Playlist Management:</strong> To change playlists, visit the{' '}
            <a
              href="https://business.soundtrackyourbrand.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-blue-100"
            >
              Soundtrack Your Brand dashboard
            </a>
            {' '}and select a different station for this zone.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
