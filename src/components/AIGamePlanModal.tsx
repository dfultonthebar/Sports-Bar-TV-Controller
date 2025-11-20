'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { X, Calendar, Tv, Clock, MapPin, Trophy, Loader2 } from 'lucide-react'

interface AIGamePlanData {
  success: boolean
  scheduleName: string
  lastExecuted: string | null
  gamesFound: number
  channelsSet: number
  games: any[]
  gamesByInput: Record<string, any[]>
  upcomingGames: any[]
  summary: {
    totalGames: number
    homeTeamGames: number
    inputsWithGames: number
    upcomingCount: number
    leagues: string[]
  }
}

interface AIGamePlanModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AIGamePlanModal({ isOpen, onClose }: AIGamePlanModalProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AIGamePlanData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadGamePlan()
    }
  }, [isOpen])

  const loadGamePlan = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/schedules/ai-game-plan')
      const result = await response.json()

      if (result.success) {
        setData(result)
      } else {
        setError(result.error || 'Failed to load AI game plan')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load AI game plan')
    } finally {
      setLoading(false)
    }
  }

  const formatGameTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return dateString
    }
  }

  const formatLastExecuted = (dateString: string | null) => {
    if (!dateString) return 'Never'
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins} min ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours} hr ago`
      return date.toLocaleDateString()
    } catch {
      return dateString
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl max-h-[90vh] m-4 backdrop-blur-xl bg-gradient-to-br from-slate-900/95 to-slate-800/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center">
              <Trophy className="mr-3 w-7 h-7 text-blue-400" />
              AI Game Plan
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {data && `Last updated: ${formatLastExecuted(data.lastExecuted)}`}
            </p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
              <p className="text-slate-400">Loading AI game plan...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-red-400 mb-4">⚠️ Error</div>
              <p className="text-slate-400">{error}</p>
              <Button onClick={loadGamePlan} className="mt-4 bg-blue-600 hover:bg-blue-700">
                Retry
              </Button>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="backdrop-blur-xl bg-blue-500/10 border border-blue-400/30 rounded-xl p-4">
                  <div className="text-3xl font-bold text-blue-400">{data.summary.totalGames}</div>
                  <div className="text-sm text-slate-400">Total Games</div>
                </div>
                <div className="backdrop-blur-xl bg-purple-500/10 border border-purple-400/30 rounded-xl p-4">
                  <div className="text-3xl font-bold text-purple-400">{data.summary.homeTeamGames}</div>
                  <div className="text-sm text-slate-400">Home Team Games</div>
                </div>
                <div className="backdrop-blur-xl bg-pink-500/10 border border-pink-400/30 rounded-xl p-4">
                  <div className="text-3xl font-bold text-pink-400">{data.summary.inputsWithGames}</div>
                  <div className="text-sm text-slate-400">Currently Assigned</div>
                </div>
                <div className="backdrop-blur-xl bg-orange-500/10 border border-orange-400/30 rounded-xl p-4">
                  <div className="text-3xl font-bold text-orange-400">{data.summary.upcomingCount || 0}</div>
                  <div className="text-sm text-slate-400">Upcoming Games</div>
                </div>
                <div className="backdrop-blur-xl bg-green-500/10 border border-green-400/30 rounded-xl p-4">
                  <div className="text-3xl font-bold text-green-400">{data.channelsSet}</div>
                  <div className="text-sm text-slate-400">Channels Set</div>
                </div>
              </div>

              {/* Leagues */}
              {data.summary.leagues.length > 0 && (
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Active Leagues</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.summary.leagues.map((league, index) => (
                      <Badge key={index} variant="outline" className="bg-slate-800/50 border-slate-700 text-slate-300">
                        {league}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Games by Input */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <Tv className="mr-2 w-5 h-5 text-blue-400" />
                  Currently Assigned Games
                </h3>

                {Object.keys(data.gamesByInput).filter(key => key !== 'Unassigned').length === 0 ? (
                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                    <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                    <p className="text-slate-400">No games scheduled at this time</p>
                  </div>
                ) : (
                  Object.entries(data.gamesByInput)
                    .filter(([inputLabel]) => inputLabel !== 'Unassigned')
                    .map(([inputLabel, games]) => (
                    <div key={inputLabel} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-white flex items-center">
                          <Tv className="mr-2 w-4 h-4 text-purple-400" />
                          {inputLabel}
                        </h4>
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30">
                          {games.length} {games.length === 1 ? 'game' : 'games'}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {games.map((game: any, index: number) => (
                          <div
                            key={index}
                            className={`backdrop-blur-xl bg-slate-800/50 border rounded-lg p-3 ${
                              game.isHomeTeamGame
                                ? 'border-yellow-400/50 bg-yellow-500/5'
                                : game.liveData?.isLive
                                ? 'border-green-400/50 bg-green-500/5'
                                : 'border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {game.isHomeTeamGame && (
                                    <Trophy className="w-4 h-4 text-yellow-400" />
                                  )}
                                  <span className="text-sm font-medium text-white">
                                    {game.homeTeam} vs {game.awayTeam}
                                  </span>
                                  {game.liveData?.isLive && (
                                    <span className="px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded uppercase animate-pulse">
                                      LIVE
                                    </span>
                                  )}
                                </div>
                                {/* Score display for live/completed games */}
                                {game.liveData && (game.liveData.isLive || game.liveData.isCompleted) && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-lg font-bold ${game.liveData.homeScore > game.liveData.awayScore ? 'text-green-400' : 'text-white'}`}>
                                      {game.homeTeam.split(' ').pop()}: {game.liveData.homeScore}
                                    </span>
                                    <span className="text-slate-500">-</span>
                                    <span className={`text-lg font-bold ${game.liveData.awayScore > game.liveData.homeScore ? 'text-green-400' : 'text-white'}`}>
                                      {game.awayTeam.split(' ').pop()}: {game.liveData.awayScore}
                                    </span>
                                  </div>
                                )}
                                {/* Game status */}
                                {game.liveData?.isLive && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-green-400">
                                      Q{game.liveData.period} - {game.liveData.clock}
                                    </span>
                                  </div>
                                )}
                                {game.liveData?.isCompleted && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-slate-400">
                                      FINAL
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                  <span className="flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {game.league}
                                  </span>
                                  {!game.liveData?.isLive && (
                                    <span className="flex items-center">
                                      <Clock className="w-3 h-3 mr-1" />
                                      {game.gameTime || formatGameTime(game.startTime)}
                                    </span>
                                  )}
                                  {game.channelNumber && (
                                    <span className="flex items-center">
                                      <Tv className="w-3 h-3 mr-1" />
                                      Ch {game.channelNumber}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Upcoming Games */}
              {data.upcomingGames && data.upcomingGames.length > 0 && (
                <div className="space-y-4 mt-6">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <Calendar className="mr-2 w-5 h-5 text-purple-400" />
                    Upcoming Games ({data.upcomingGames.length})
                  </h3>
                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 max-h-96 overflow-y-auto">
                    <div className="space-y-2">
                      {data.upcomingGames.slice(0, 20).map((game: any, index: number) => (
                        <div
                          key={index}
                          className={`backdrop-blur-xl bg-slate-800/50 border rounded-lg p-3 ${
                            game.isHomeTeamGame
                              ? 'border-yellow-400/50 bg-yellow-500/5'
                              : 'border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {game.isHomeTeamGame && (
                                  <Trophy className="w-4 h-4 text-yellow-400" />
                                )}
                                <span className="text-sm font-medium text-white">
                                  {game.homeTeam} vs {game.awayTeam}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400">
                                <span className="flex items-center">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {game.league}
                                </span>
                                {game.gameTime && (
                                  <span className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {game.gameTime}
                                  </span>
                                )}
                                {game.channelNumber && (
                                  <span className="flex items-center">
                                    <Tv className="w-3 h-3 mr-1" />
                                    Ch {game.channelNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {data.upcomingGames.length > 20 && (
                      <p className="text-xs text-slate-500 text-center mt-3">
                        Showing 20 of {data.upcomingGames.length} upcoming games
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 bg-slate-900/50">
          <p className="text-xs text-slate-500">
            AI automatically finds and schedules games based on your preferences
          </p>
          <div className="flex gap-2">
            <Button onClick={loadGamePlan} variant="outline" size="sm" disabled={loading}>
              Refresh
            </Button>
            <Button onClick={onClose} size="sm" className="bg-blue-600 hover:bg-blue-700">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
