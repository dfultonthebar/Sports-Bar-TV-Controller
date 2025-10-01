
'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  Music2, 
  Play, 
  Pause, 
  RefreshCw,
  AlertCircle,
  Radio,
  Disc,
  List
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

export default function BartenderMusicControl() {
  const [players, setPlayers] = useState<SoundtrackPlayer[]>([])
  const [stations, setStations] = useState<SoundtrackStation[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<SoundtrackPlayer | null>(null)
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showStations, setShowStations] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(() => {
      if (selectedPlayer) {
        updateNowPlaying(selectedPlayer.id)
      }
    }, 15000) // Update every 15 seconds
    return () => clearInterval(interval)
  }, [selectedPlayer])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

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
      } else {
        setError('Failed to load Soundtrack players. Check configuration.')
      }

      if (stationsRes.ok) {
        const data = await stationsRes.json()
        setStations(data.stations || [])
      }
    } catch (err: any) {
      console.error('Failed to load Soundtrack data:', err)
      setError('Not configured. Contact management.')
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
    if (!selectedPlayer || actionLoading) return
    
    setActionLoading(true)
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
    } finally {
      setActionLoading(false)
    }
  }

  const handleStationChange = async (stationId: string) => {
    if (!selectedPlayer || actionLoading) return
    
    setActionLoading(true)
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
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mr-3" />
            <span className="text-white">Loading Soundtrack...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-900/30 backdrop-blur-sm rounded-lg p-8 border border-red-800">
          <div className="flex items-center justify-center text-red-300">
            <AlertCircle className="w-6 h-6 mr-3" />
            <span>{error}</span>
          </div>
          <div className="text-center mt-4">
            <Button onClick={loadData} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!selectedPlayer) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 text-center text-slate-500">
          <Music2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>No Soundtrack players configured</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Now Playing Card */}
      {nowPlaying && (
        <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-sm rounded-lg p-6 border border-purple-800/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center">
              <Disc className="w-5 h-5 mr-2 text-purple-400" />
              Now Playing
            </h3>
            <Badge variant="secondary" className="bg-purple-800/50 text-purple-200">
              {nowPlaying.station.name}
            </Badge>
          </div>
          
          <div className="flex items-start space-x-4">
            {nowPlaying.track.albumArt && (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
                <Image
                  src={nowPlaying.track.albumArt}
                  alt={nowPlaying.track.album || 'Album art'}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-xl font-bold text-white truncate">{nowPlaying.track.title}</h4>
              <p className="text-lg text-gray-300 truncate">{nowPlaying.track.artist}</p>
              {nowPlaying.track.album && (
                <p className="text-sm text-slate-500 truncate mt-1">{nowPlaying.track.album}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Player Controls */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold">{selectedPlayer.name}</h3>
            <p className="text-sm text-slate-500">Music Player</p>
          </div>
          <Badge variant={selectedPlayer.isPlaying ? "default" : "secondary"} className="text-sm">
            {selectedPlayer.isPlaying ? <><Play className="w-3 h-3 mr-1" /> Playing</> : <><Pause className="w-3 h-3 mr-1" /> Paused</>}
          </Badge>
        </div>

        {/* Play/Pause Controls */}
        <div className="mb-6">
          <Button
            onClick={handlePlayPause}
            disabled={actionLoading}
            size="lg"
            className={`w-full ${selectedPlayer.isPlaying ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {selectedPlayer.isPlaying ? (
              <>
                <Pause className="w-6 h-6 mr-2" />
                Stop Music
              </>
            ) : (
              <>
                <Play className="w-6 h-6 mr-2" />
                Start Music
              </>
            )}
          </Button>
        </div>

        {/* Playlist/Station Selection */}
        <div>
          <Button
            onClick={() => setShowStations(!showStations)}
            variant="outline"
            className="w-full justify-between h-12 text-base"
            disabled={actionLoading}
          >
            <div className="flex items-center">
              <Radio className="w-5 h-5 mr-3" />
              <span>{selectedPlayer.currentStation?.name || 'Select Playlist'}</span>
            </div>
            <List className={`w-5 h-5 transition-transform ${showStations ? 'rotate-180' : ''}`} />
          </Button>

          {showStations && (
            <div className="mt-3 space-y-2 max-h-80 overflow-y-auto bg-white/5 rounded-lg p-3">
              <h4 className="text-sm font-medium text-slate-500 mb-2 px-2">Available Playlists</h4>
              {stations.map((station) => (
                <button
                  key={station.id}
                  onClick={() => handleStationChange(station.id)}
                  disabled={actionLoading}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedPlayer.currentStation?.id === station.id
                      ? 'bg-purple-600 border-purple-400 text-white shadow-lg'
                      : 'bg-white/5 border-gray-600 text-gray-300 hover:bg-white/10 hover:border-gray-500'
                  } ${actionLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-base">{station.name}</div>
                      {station.description && (
                        <div className="text-xs opacity-80 mt-1">{station.description}</div>
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
                    </div>
                    {selectedPlayer.currentStation?.id === station.id && (
                      <Disc className="w-5 h-5 text-white animate-spin" style={{ animationDuration: '3s' }} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <div className="mt-4 text-center">
          <Button
            onClick={loadData}
            disabled={loading || actionLoading}
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  )
}
