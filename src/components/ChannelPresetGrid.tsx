
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Star, TrendingUp, Tv, Radio, Zap } from 'lucide-react'

import { logger } from '@/lib/logger'
interface ChannelPreset {
  id: string
  name: string
  channelNumber: string
  deviceType: 'cable' | 'directv'
  order: number
  usageCount: number
  lastUsed: Date | null
}

interface LiveGameData {
  league: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  startTime: string
  channelNumber: string
  venue: string
  liveData?: {
    homeScore: number
    awayScore: number
    homeAbbrev: string
    awayAbbrev: string
    clock: string
    period: number
    statusState: string
    statusDetail: string
    isLive: boolean
    isCompleted: boolean
  }
}

interface ChannelPresetGridProps {
  deviceType: 'cable' | 'directv'
  onPresetClick: (preset: ChannelPreset) => void
  maxVisible?: number
}

export default function ChannelPresetGrid({
  deviceType,
  onPresetClick,
  maxVisible = 6
}: ChannelPresetGridProps) {
  const [presets, setPresets] = useState<ChannelPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [liveGames, setLiveGames] = useState<Record<string, LiveGameData>>({})
  const [loadingLiveData, setLoadingLiveData] = useState(false)

  // Load live game data for all channel presets
  const loadLiveGameData = useCallback(async (presetList: ChannelPreset[]) => {
    if (presetList.length === 0) return

    try {
      setLoadingLiveData(true)
      const channelNumbers = presetList.map(p => p.channelNumber).join(',')

      const response = await fetch(
        `/api/sports-guide/live-by-channel?channels=${channelNumbers}&deviceType=${deviceType}`
      )
      const data = await response.json()

      if (data.success && data.channels) {
        setLiveGames(data.channels)
      }
    } catch (err) {
      logger.error('Error loading live game data:', err)
    } finally {
      setLoadingLiveData(false)
    }
  }, [deviceType])

  useEffect(() => {
    loadPresets()
  }, [deviceType])

  // Refresh live game data every 60 seconds
  useEffect(() => {
    if (presets.length > 0) {
      loadLiveGameData(presets)

      const interval = setInterval(() => {
        loadLiveGameData(presets)
      }, 3600000) // Refresh every 1 hour

      return () => clearInterval(interval)
    }
  }, [presets, loadLiveGameData])

  const loadPresets = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/channel-presets/by-device?deviceType=${deviceType}`)
      const data = await response.json()

      if (data.success) {
        setPresets(data.presets || [])
      } else {
        setError(data.error || 'Failed to load presets')
      }
    } catch (err) {
      logger.error('Error loading presets:', err)
      setError('Failed to load channel presets')
    } finally {
      setLoading(false)
    }
  }

  const handlePresetClick = async (preset: ChannelPreset) => {
    // Call the parent's click handler
    onPresetClick(preset)

    // Update usage tracking in the background (fire-and-forget)
    fetch('/api/channel-presets/update-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: preset.id })
    }).catch(err => logger.error('Error updating preset usage:', err))

    // Update local state instead of reloading - prevents scroll jump
    setPresets(prev => prev.map(p =>
      p.id === preset.id
        ? { ...p, usageCount: p.usageCount + 1, lastUsed: new Date() }
        : p
    ))
  }

  // Sort presets: Live games first, then scheduled games, then completed, then no games
  // IMPORTANT: Must be defined before any conditional returns (React hooks rules)
  const sortedPresets = useMemo(() => {
    if (presets.length === 0) return []
    return [...presets].sort((a, b) => {
      const gameA = liveGames[a.channelNumber]
      const gameB = liveGames[b.channelNumber]

      // Priority: 1=Live, 2=Scheduled (pre), 3=Completed, 4=No game
      const getPriority = (game: LiveGameData | undefined): number => {
        if (!game) return 4
        if (game.liveData?.isLive) return 1
        if (game.liveData?.isCompleted) return 3
        // Scheduled game (has game data but not live or completed)
        return 2
      }

      const priorityA = getPriority(gameA)
      const priorityB = getPriority(gameB)

      // Sort by priority first
      if (priorityA !== priorityB) return priorityA - priorityB

      // Within same priority, sort by start time (earlier games first)
      if (gameA?.startTime && gameB?.startTime) {
        return new Date(gameA.startTime).getTime() - new Date(gameB.startTime).getTime()
      }

      // Fallback to original order
      return a.order - b.order
    })
  }, [presets, liveGames])

  const hasLiveOrScheduled = useMemo(() => {
    return Object.values(liveGames).some(g => g.liveData?.isLive || !g.liveData?.isCompleted)
  }, [liveGames])

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 mt-4">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
          <span className="ml-2 text-slate-400">Loading presets...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 mt-4">
        <div className="text-center py-4 text-red-400">
          {error}
        </div>
      </div>
    )
  }

  if (presets.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 mt-4">
        <div className="text-center py-4 text-slate-400">
          <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No channel presets configured</p>
          <p className="text-xs mt-1">Add presets in Sports Guide Config → Presets tab</p>
        </div>
      </div>
    )
  }

  const visiblePresets = showAll ? sortedPresets : sortedPresets.slice(0, maxVisible)
  const hasMore = sortedPresets.length > maxVisible

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center">
          <Star className="w-4 h-4 mr-2 text-yellow-400" />
          Quick Channel Access
        </h3>
        <div className="flex items-center gap-2">
          {hasLiveOrScheduled && (
            <div className="flex items-center text-xs text-green-400">
              <Zap className="w-3 h-3 mr-1" />
              <span>Games First</span>
            </div>
          )}
          {presets.some(p => p.usageCount > 0) && (
            <div className="flex items-center text-xs text-blue-400">
              <TrendingUp className="w-3 h-3 mr-1" />
              <span>Trending</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {visiblePresets.map((preset) => {
          const liveGame = liveGames[preset.channelNumber]
          const isLive = liveGame?.liveData?.isLive
          const isCompleted = liveGame?.liveData?.isCompleted
          const hasGame = !!liveGame

          return (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset)}
              className={`group relative text-white rounded-lg p-3 transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl ${
                isLive
                  ? 'bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 ring-2 ring-green-400/50'
                  : isCompleted
                  ? 'bg-gradient-to-br from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600'
                  : hasGame
                  ? 'bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600'
                  : 'bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600'
              }`}
            >
              <div className="flex flex-col items-start text-left">
                {/* Channel name and number */}
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="text-xs font-medium opacity-90 truncate max-w-[70%]">
                    {preset.name}
                  </div>
                  <div className="text-xs font-bold opacity-75">
                    Ch {preset.channelNumber}
                  </div>
                </div>

                {/* Live game info */}
                {liveGame?.liveData ? (
                  <div className="w-full">
                    {/* Score display */}
                    <div className="flex items-center justify-between text-sm font-bold mb-0.5">
                      <span className={liveGame.liveData.homeScore > liveGame.liveData.awayScore ? 'text-yellow-300' : ''}>
                        {liveGame.liveData.homeAbbrev || liveGame.homeTeam?.split(' ').pop()}: {liveGame.liveData.homeScore}
                      </span>
                      <span className="text-white/60">-</span>
                      <span className={liveGame.liveData.awayScore > liveGame.liveData.homeScore ? 'text-yellow-300' : ''}>
                        {liveGame.liveData.awayAbbrev || liveGame.awayTeam?.split(' ').pop()}: {liveGame.liveData.awayScore}
                      </span>
                    </div>
                    {/* Period/Clock or FINAL */}
                    <div className="text-[10px] text-center opacity-80">
                      {isCompleted ? (
                        <span className="text-slate-300">FINAL</span>
                      ) : isLive ? (
                        <span className="text-green-300">
                          {liveGame.liveData.period > 0 && `Q${liveGame.liveData.period} `}
                          {liveGame.liveData.clock}
                        </span>
                      ) : (
                        <span>{liveGame.liveData.statusDetail}</span>
                      )}
                    </div>
                  </div>
                ) : hasGame ? (
                  // Game scheduled but not started
                  <div className="w-full">
                    <div className="text-xs truncate opacity-90">
                      {liveGame.homeTeam?.split(' ').pop()} vs {liveGame.awayTeam?.split(' ').pop()}
                    </div>
                    <div className="text-[10px] opacity-70">
                      {liveGame.gameTime}
                    </div>
                  </div>
                ) : (
                  // No game on this channel
                  <div className="text-lg font-bold opacity-50">
                    <Tv className="w-5 h-5 inline-block" />
                  </div>
                )}

                {/* Live badge */}
                {isLive && (
                  <div className="absolute top-1 right-1 flex items-center gap-0.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-[8px] font-bold text-red-400 uppercase">Live</span>
                  </div>
                )}

                {/* Usage count badge - bottom right so channel number is visible */}
                {preset.usageCount > 0 && (
                  <div className="absolute bottom-1 right-1 bg-black/40 text-white/80 text-[10px] px-1.5 py-0.5 rounded font-medium">
                    {preset.usageCount}x
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full mt-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
        >
          {showAll ? 'Show Less' : `Show All (${presets.length} total)`}
        </button>
      )}
    </div>
  )
}
