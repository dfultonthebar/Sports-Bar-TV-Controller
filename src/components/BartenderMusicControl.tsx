
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

  // Load data once on mount
  useEffect(() => {
    loadData()
  }, [])

  // Set up interval for updating now playing when player changes
  useEffect(() => {
    if (!selectedPlayer) return

    // Update immediately
    updateNowPlaying(selectedPlayer.id)

    // Then update every 15 seconds
    const interval = setInterval(() => {
      updateNowPlaying(selectedPlayer.id)
    }, 15000)

    return () => clearInterval(interval)
  }, [selectedPlayer])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch only bartender-visible players
      const [playersRes, stationsRes] = await Promise.all([
        fetch('/api/soundtrack/players?bartenderOnly=true'),
        fetch('/api/soundtrack/stations')
      ])

      if (playersRes.ok) {
        const data = await playersRes.json()
        const bartenderPlayers = data.players || []
        setPlayers(bartenderPlayers)
        
        if (bartenderPlayers.length > 0) {
          setSelectedPlayer(bartenderPlayers[0])
          updateNowPlaying(bartenderPlayers[0].id)
        } else {
          setError('No music players are configured for bartender control. Contact management.')
        }
      } else {
        const data = await playersRes.json()
        setError(data.error || 'Failed to load Soundtrack players. Check configuration.')
      }

      if (stationsRes.ok) {
        const data = await stationsRes.json()
        setStations(data.stations || [])
      }
    } catch (err: any) {
      console.error('Failed to load Soundtrack data:', err)
      setError('Music system not configured. Contact management.')
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
        <div className="bg-slate-800 or bg-slate-900/10 backdrop-blur-sm rounded-lg p-8">
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
          <div className="flex items-center justify-center text-red-300 mb-4">
            <AlertCircle className="w-6 h-6 mr-3 flex-shrink-0" />
            <span className="text-center">{error}</span>
          </div>
          {error.includes('404') && (
            <div className="mt-4 p-4 bg-orange-900/30 border border-orange-800 rounded-lg text-sm text-orange-200">
              <p className="font-medium mb-2">Troubleshooting Steps:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Verify the Soundtrack API configuration in the admin settings</li>
                <li>Check if your Soundtrack Your Brand account is active</li>
                <li>Run the API connection diagnostic tool</li>
                <li>Contact management to review the Soundtrack integration</li>
              </ul>
            </div>
          )}
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
        <div className="bg-slate-800 or bg-slate-900/10 backdrop-blur-sm rounded-lg p-8 text-center text-slate-500">
          <Music2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>No Soundtrack players configured</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Player Selection (if multiple players) */}
      {players.length > 1 && (
        <div className="bg-slate-800 or bg-slate-900/10 backdrop-blur-sm rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Select Music Zone:</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {players.map((player) => (
              <button
                key={player.id}
                onClick={() => {
                  setSelectedPlayer(player)
                  updateNowPlaying(player.id)
                }}
                className={`p-3 rounded-lg border transition-all ${
                  selectedPlayer?.id === player.id
                    ? 'bg-purple-600 border-purple-400 text-white shadow-lg'
                    : 'bg-slate-900 border-slate-700 text-gray-300 hover:border-slate-600'
                }`}
              >
                <div className="font-medium text-sm">{player.name}</div>
                <div className="flex items-center justify-center mt-2">
                  {player.isPlaying ? (
                    <Play className="w-4 h-4 text-green-400" />
                  ) : (
                    <Pause className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Now Playing Card */}
      {nowPlaying && (
        <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-sm rounded-lg p-6 border border-purple-800/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center">
              <Disc className="w-5 h-5 mr-2 text-purple-400" />
              Now Playing {players.length > 1 && `- ${selectedPlayer.name}`}
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
      <div className="bg-slate-800 or bg-slate-900/10 backdrop-blur-sm rounded-lg p-6">
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

        {/* Current Playlist Display */}
        {selectedPlayer.currentStation && (
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-center text-slate-400 text-sm mb-1">
              <Radio className="w-4 h-4 mr-2" />
              <span>Current Playlist</span>
            </div>
            <div className="text-white font-medium">{selectedPlayer.currentStation.name}</div>
          </div>
        )}

        {/* Info about playlist control */}
        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
          <p className="text-xs text-blue-200">
            <strong>Note:</strong> Playlists are managed through the Soundtrack Your Brand web app. Use the play/pause button above to control playback.
          </p>
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
