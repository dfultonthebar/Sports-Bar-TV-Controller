
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
  Disc
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

export default function BartenderMusicControl() {
  const [players, setPlayers] = useState<SoundtrackPlayer[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<SoundtrackPlayer | null>(null)
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
      const playersRes = await fetch('/api/soundtrack/players?bartenderOnly=true')

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
    } catch (err: any) {
      logger.error('Failed to load Soundtrack data:', err)
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
      logger.error('Failed to get now playing:', err)
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
      logger.error('Failed to toggle playback:', err)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-pink-400 animate-spin mr-3" />
            <span className="text-white font-medium">Loading Soundtrack...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="backdrop-blur-xl bg-red-500/10 border border-red-400/30 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center text-red-300 mb-4">
            <AlertCircle className="w-6 h-6 mr-3 flex-shrink-0" />
            <span className="text-center font-medium">{error}</span>
          </div>
          {error.includes('404') && (
            <div className="mt-4 p-4 backdrop-blur-xl bg-orange-500/10 border border-orange-400/30 rounded-xl text-sm text-orange-200">
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
            <Button onClick={loadData} variant="outline" size="sm" className="backdrop-blur-xl bg-white/5 border-white/10 hover:bg-white/10 transition-all duration-300">
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
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8 text-center text-slate-400">
          <Music2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No Soundtrack players configured</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Player Selection (if multiple players) */}
      {players.length > 1 && (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">Select Music Zone:</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {players.map((player) => (
              <button
                key={player.id}
                onClick={() => {
                  setSelectedPlayer(player)
                  updateNowPlaying(player.id)
                }}
                className={`group relative p-4 rounded-xl border-2 transition-all duration-300 ${
                  selectedPlayer?.id === player.id
                    ? 'backdrop-blur-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-pink-400/50 shadow-xl scale-105'
                    : 'backdrop-blur-xl bg-white/5 border-white/10 hover:border-pink-400/30 hover:scale-105'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br from-pink-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl`}></div>
                <div className="relative z-10">
                  <div className="font-semibold text-sm text-white">{player.name}</div>
                  <div className="flex items-center justify-center mt-2">
                    {player.isPlaying ? (
                      <div className="relative">
                        <Play className="w-4 h-4 text-green-400" />
                        <span className="absolute inset-0 animate-ping">
                          <Play className="w-4 h-4 text-green-400 opacity-75" />
                        </span>
                      </div>
                    ) : (
                      <Pause className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Now Playing Card */}
      {nowPlaying && (
        <div className="backdrop-blur-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-2 border-pink-400/30 rounded-2xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center text-lg bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              <Disc className="w-6 h-6 mr-2 text-pink-400 animate-spin" style={{ animationDuration: '3s' }} />
              Now Playing {players.length > 1 && `- ${selectedPlayer.name}`}
            </h3>
            <Badge variant="secondary" className="backdrop-blur-xl bg-pink-500/20 border border-pink-400/30 text-pink-200 font-medium">
              {selectedPlayer?.currentStation?.name || 'Now Playing'}
            </Badge>
          </div>

          <div className="flex items-start space-x-4">
            {nowPlaying.track.albumArt && (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 shadow-2xl border-2 border-white/10">
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
              <p className="text-lg text-gray-200 truncate mt-1">{nowPlaying.track.artist}</p>
              {nowPlaying.track.album && (
                <p className="text-sm text-slate-400 truncate mt-2">{nowPlaying.track.album}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Player Controls */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">{selectedPlayer.name}</h3>
            <p className="text-sm text-slate-400 mt-1">Music Player</p>
          </div>
          <Badge variant={selectedPlayer.isPlaying ? "default" : "secondary"} className={`text-sm font-medium ${selectedPlayer.isPlaying ? 'backdrop-blur-xl bg-green-500/20 border border-green-400/30 text-green-200' : 'backdrop-blur-xl bg-white/5 border border-white/10 text-slate-300'}`}>
            {selectedPlayer.isPlaying ? (
              <>
                <div className="relative mr-1">
                  <Play className="w-3 h-3" />
                  <span className="absolute inset-0 animate-ping">
                    <Play className="w-3 h-3 opacity-75" />
                  </span>
                </div>
                Playing
              </>
            ) : (
              <>
                <Pause className="w-3 h-3 mr-1" /> Paused
              </>
            )}
          </Badge>
        </div>

        {/* Play/Pause Controls */}
        <div className="mb-6">
          <button
            onClick={handlePlayPause}
            disabled={actionLoading}
            className={`group relative w-full backdrop-blur-xl rounded-xl border-2 transition-all duration-300 shadow-xl hover:scale-105 py-4 ${
              selectedPlayer.isPlaying
                ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-400/50 hover:border-orange-400/70'
                : 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-400/50 hover:border-green-400/70'
            }`}
          >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl ${
              selectedPlayer.isPlaying
                ? 'bg-gradient-to-br from-orange-500/10 to-red-500/10'
                : 'bg-gradient-to-br from-green-500/10 to-emerald-500/10'
            }`}></div>
            <div className="relative z-10 flex items-center justify-center text-white font-bold text-lg">
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
            </div>
          </button>
        </div>

        {/* Current Playlist Display */}
        {selectedPlayer.currentStation && (
          <div className="mt-4 p-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl">
            <div className="flex items-center text-slate-400 text-sm mb-2">
              <Radio className="w-4 h-4 mr-2" />
              <span className="font-medium">Current Playlist</span>
            </div>
            <div className="text-white font-semibold">{selectedPlayer.currentStation.name}</div>
          </div>
        )}

        {/* Playlist Management Info */}
        <div className="mt-4 p-4 backdrop-blur-xl bg-blue-500/10 border border-blue-400/30 rounded-xl">
          <p className="text-xs text-blue-200">
            <strong>Note:</strong> To change playlists, visit the <a href="https://business.soundtrackyourbrand.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-100 transition-colors duration-300">Soundtrack Your Brand dashboard</a> and select a different station for this zone.
          </p>
        </div>

        {/* Refresh Button */}
        <div className="mt-6 text-center">
          <button
            onClick={loadData}
            disabled={loading || actionLoading}
            className="group relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-slate-400 hover:text-white hover:border-white/20 transition-all duration-300 hover:scale-105"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
            <div className="relative z-10 flex items-center">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
