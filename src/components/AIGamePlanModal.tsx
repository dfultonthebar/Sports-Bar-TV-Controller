'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { X, Calendar, Tv, Clock, MapPin, Trophy, Loader2, ChevronDown, ChevronUp, Check, Search, Cable, Satellite, Play } from 'lucide-react'

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
}

interface MatrixOutput {
  id: string
  channelNumber: number
  label: string
  isActive: boolean
  isSchedulingEnabled: boolean
}

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

// LocalStorage keys for persisting settings
const ALLOWED_OUTPUTS_KEY = 'ai-game-plan-allowed-outputs'
const ALLOWED_INPUTS_KEY = 'ai-game-plan-allowed-inputs'

export default function AIGamePlanModal({ isOpen, onClose }: AIGamePlanModalProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AIGamePlanData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const [schedulingGameId, setSchedulingGameId] = useState<string | null>(null)
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null)

  // Input selection state (Cable boxes, DirecTV, etc.)
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [allowedInputs, setAllowedInputs] = useState<Set<number>>(new Set())
  const [showInputSelection, setShowInputSelection] = useState(false)
  const [inputSearch, setInputSearch] = useState('')
  const [inputsLoading, setInputsLoading] = useState(false)

  // Output selection state
  const [outputs, setOutputs] = useState<MatrixOutput[]>([])
  const [allowedOutputs, setAllowedOutputs] = useState<Set<number>>(new Set())
  const [showOutputSelection, setShowOutputSelection] = useState(false)
  const [outputSearch, setOutputSearch] = useState('')
  const [outputsLoading, setOutputsLoading] = useState(false)

  // Load data on open
  useEffect(() => {
    if (isOpen) {
      loadGamePlan()
      loadInputs()
      loadOutputs()
    }
  }, [isOpen])

  // Load allowed outputs from database API on mount
  useEffect(() => {
    const loadAllowedOutputs = async () => {
      try {
        const response = await fetch('/api/schedules/ai-allowed-outputs')
        const result = await response.json()
        if (result.success && result.allowedOutputs && result.allowedOutputs.length > 0) {
          setAllowedOutputs(new Set(result.allowedOutputs))
          // Also update localStorage for quick access
          localStorage.setItem(ALLOWED_OUTPUTS_KEY, JSON.stringify(result.allowedOutputs))
        } else {
          // Fall back to localStorage if no database setting
          const saved = localStorage.getItem(ALLOWED_OUTPUTS_KEY)
          if (saved) {
            const parsed = JSON.parse(saved)
            setAllowedOutputs(new Set(parsed))
          }
        }
      } catch (e) {
        console.error('Failed to load allowed outputs from API:', e)
        // Fall back to localStorage
        const saved = localStorage.getItem(ALLOWED_OUTPUTS_KEY)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            setAllowedOutputs(new Set(parsed))
          } catch (parseError) {
            console.error('Failed to parse saved allowed outputs:', parseError)
          }
        }
      }
    }
    loadAllowedOutputs()
  }, [])

  // Load allowed inputs from database API on mount
  useEffect(() => {
    const loadAllowedInputs = async () => {
      try {
        const response = await fetch('/api/schedules/ai-allowed-inputs')
        const result = await response.json()
        if (result.success && result.allowedInputs && result.allowedInputs.length > 0) {
          setAllowedInputs(new Set(result.allowedInputs))
          localStorage.setItem(ALLOWED_INPUTS_KEY, JSON.stringify(result.allowedInputs))
        } else {
          const saved = localStorage.getItem(ALLOWED_INPUTS_KEY)
          if (saved) {
            const parsed = JSON.parse(saved)
            setAllowedInputs(new Set(parsed))
          }
        }
      } catch (e) {
        console.error('Failed to load allowed inputs from API:', e)
        const saved = localStorage.getItem(ALLOWED_INPUTS_KEY)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            setAllowedInputs(new Set(parsed))
          } catch (parseError) {
            console.error('Failed to parse saved allowed inputs:', parseError)
          }
        }
      }
    }
    loadAllowedInputs()
  }, [])

  // Track if initial load is done (to avoid saving during initial load)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Mark initial load complete after loading from DB/localStorage
  useEffect(() => {
    const timer = setTimeout(() => setInitialLoadDone(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  // Save allowed outputs to both localStorage and database whenever they change
  useEffect(() => {
    // Don't save during initial load
    if (!initialLoadDone) return

    // Save to localStorage for quick access
    localStorage.setItem(ALLOWED_OUTPUTS_KEY, JSON.stringify([...allowedOutputs]))

    // Save to database for server-side scheduler access
    console.log('[AI Game Plan] Saving allowed outputs to database:', [...allowedOutputs])
    fetch('/api/schedules/ai-allowed-outputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedOutputs: [...allowedOutputs] })
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          console.log('[AI Game Plan] Saved successfully:', result.message)
        } else {
          console.error('[AI Game Plan] Save failed:', result.error)
        }
      })
      .catch(err => console.error('[AI Game Plan] Failed to save allowed outputs:', err))
  }, [allowedOutputs, initialLoadDone])

  // Save allowed inputs to both localStorage and database whenever they change
  useEffect(() => {
    if (!initialLoadDone) return

    localStorage.setItem(ALLOWED_INPUTS_KEY, JSON.stringify([...allowedInputs]))

    console.log('[AI Game Plan] Saving allowed inputs to database:', [...allowedInputs])
    fetch('/api/schedules/ai-allowed-inputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedInputs: [...allowedInputs] })
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          console.log('[AI Game Plan] Saved inputs successfully:', result.message)
        } else {
          console.error('[AI Game Plan] Save inputs failed:', result.error)
        }
      })
      .catch(err => console.error('[AI Game Plan] Failed to save allowed inputs:', err))
  }, [allowedInputs, initialLoadDone])

  const loadInputs = async () => {
    setInputsLoading(true)
    try {
      const response = await fetch('/api/matrix/config')
      const result = await response.json()

      if (result.inputs) {
        // Filter to only active inputs that are cable or satellite
        const sourceInputs = result.inputs.filter((i: MatrixInput) =>
          i.isActive && (i.inputType === 'cable' || i.inputType === 'satellite' || i.inputType === 'streaming')
        )
        setInputs(sourceInputs)

        // If no inputs are selected yet, select cable and satellite by default
        const saved = localStorage.getItem(ALLOWED_INPUTS_KEY)
        if (!saved) {
          setAllowedInputs(new Set(sourceInputs.map((i: MatrixInput) => i.channelNumber)))
        }
      }
    } catch (err) {
      console.error('Failed to load inputs:', err)
    } finally {
      setInputsLoading(false)
    }
  }

  const loadOutputs = async () => {
    setOutputsLoading(true)
    try {
      const response = await fetch('/api/matrix/config')
      const result = await response.json()

      if (result.outputs) {
        // Filter to only active outputs
        const activeOutputs = result.outputs.filter((o: MatrixOutput) => o.isActive)
        setOutputs(activeOutputs)

        // If no outputs are selected yet, select all by default
        const saved = localStorage.getItem(ALLOWED_OUTPUTS_KEY)
        if (!saved) {
          setAllowedOutputs(new Set(activeOutputs.map((o: MatrixOutput) => o.channelNumber)))
        }
      }
    } catch (err) {
      console.error('Failed to load outputs:', err)
    } finally {
      setOutputsLoading(false)
    }
  }

  const toggleOutput = (channelNumber: number) => {
    setAllowedOutputs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(channelNumber)) {
        newSet.delete(channelNumber)
      } else {
        newSet.add(channelNumber)
      }
      return newSet
    })
  }

  const selectAllOutputs = () => {
    setAllowedOutputs(new Set(outputs.map(o => o.channelNumber)))
  }

  const deselectAllOutputs = () => {
    setAllowedOutputs(new Set())
  }

  const filteredOutputs = outputs.filter(output =>
    !outputSearch ||
    output.label.toLowerCase().includes(outputSearch.toLowerCase()) ||
    String(output.channelNumber).includes(outputSearch)
  )

  // Input toggle functions
  const toggleInput = (channelNumber: number) => {
    setAllowedInputs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(channelNumber)) {
        newSet.delete(channelNumber)
      } else {
        newSet.add(channelNumber)
      }
      return newSet
    })
  }

  const selectAllInputs = () => {
    setAllowedInputs(new Set(inputs.map(i => i.channelNumber)))
  }

  const deselectAllInputs = () => {
    setAllowedInputs(new Set())
  }

  const filteredInputs = inputs.filter(input =>
    !inputSearch ||
    input.label.toLowerCase().includes(inputSearch.toLowerCase()) ||
    String(input.channelNumber).includes(inputSearch)
  )

  // Get icon for input type
  const getInputIcon = (inputType: string) => {
    switch (inputType) {
      case 'cable': return <Cable className="w-3 h-3 text-blue-400" />
      case 'satellite': return <Satellite className="w-3 h-3 text-purple-400" />
      case 'streaming': return <Play className="w-3 h-3 text-green-400" />
      default: return <Tv className="w-3 h-3 text-slate-400" />
    }
  }

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

  // Schedule a specific game to be shown on TVs
  const handleScheduleGame = async (game: any) => {
    const gameId = game.id || `${game.homeTeam}-${game.awayTeam}`
    setSchedulingGameId(gameId)
    setScheduleSuccess(null)

    try {
      // Call the schedule execute API with just this game
      const response = await fetch('/api/schedules/execute-single-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: {
            id: gameId,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            league: game.league,
            channelNumber: game.channelNumber,
            cableChannel: game.cableChannel,
            directvChannel: game.directvChannel,
            startTime: game.startTime,
            gameTime: game.gameTime
          },
          allowedOutputs: [...allowedOutputs],
          allowedInputs: [...allowedInputs]
        })
      })

      const result = await response.json()

      if (result.success) {
        setScheduleSuccess(`${game.homeTeam} vs ${game.awayTeam} scheduled to ${result.tvsControlled || 1} TV(s)`)
        // Refresh the game plan to show updated assignments
        loadGamePlan()
      } else {
        setError(`Failed to schedule game: ${result.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      setError(`Failed to schedule game: ${err.message}`)
    } finally {
      setSchedulingGameId(null)
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
              {/* Success/Error Messages */}
              {scheduleSuccess && (
                <div className="bg-green-500/20 border border-green-400/50 text-green-300 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm">{scheduleSuccess}</span>
                  <button onClick={() => setScheduleSuccess(null)} className="text-green-400 hover:text-green-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

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

              {/* TV Output Selection - Collapsible */}
              <div className="backdrop-blur-xl bg-cyan-500/5 border border-cyan-400/30 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowOutputSelection(!showOutputSelection)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center">
                    <Tv className="mr-2 w-5 h-5 text-cyan-400" />
                    <span className="font-medium text-white">Allowed TV Outputs</span>
                    <Badge className="ml-3 bg-cyan-500/20 text-cyan-300 border-cyan-400/30">
                      {allowedOutputs.size} of {outputs.length} selected
                    </Badge>
                  </div>
                  {showOutputSelection ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {showOutputSelection && (
                  <div className="p-4 pt-0 border-t border-white/10">
                    <p className="text-xs text-slate-400 mb-3">
                      Select which TVs the AI scheduler is allowed to route content to
                    </p>

                    {/* Search and Select All/None buttons */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search TVs..."
                          value={outputSearch}
                          onChange={(e) => setOutputSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        />
                      </div>
                      <Button
                        onClick={selectAllOutputs}
                        variant="outline"
                        size="sm"
                        className="text-xs border-slate-600 hover:bg-slate-700"
                      >
                        All
                      </Button>
                      <Button
                        onClick={deselectAllOutputs}
                        variant="outline"
                        size="sm"
                        className="text-xs border-slate-600 hover:bg-slate-700"
                      >
                        None
                      </Button>
                    </div>

                    {/* Output Grid */}
                    {outputsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                        {filteredOutputs.map((output) => (
                          <button
                            key={output.id}
                            onClick={() => toggleOutput(output.channelNumber)}
                            className={`p-2 rounded-lg text-left transition-all border ${
                              allowedOutputs.has(output.channelNumber)
                                ? 'bg-cyan-500/20 border-cyan-400/50 text-white'
                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium truncate">{output.label}</span>
                              {allowedOutputs.has(output.channelNumber) && (
                                <Check className="w-4 h-4 text-cyan-400 flex-shrink-0 ml-1" />
                              )}
                            </div>
                            <div className="text-xs opacity-60">Output {output.channelNumber}</div>
                          </button>
                        ))}
                      </div>
                    )}

                    {filteredOutputs.length === 0 && !outputsLoading && (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No TVs match your search
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Input Source Selection - Collapsible */}
              <div className="backdrop-blur-xl bg-purple-500/5 border border-purple-400/30 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowInputSelection(!showInputSelection)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center">
                    <Cable className="mr-2 w-5 h-5 text-purple-400" />
                    <span className="font-medium text-white">Allowed Input Sources</span>
                    <Badge className="ml-3 bg-purple-500/20 text-purple-300 border-purple-400/30">
                      {allowedInputs.size} of {inputs.length} selected
                    </Badge>
                  </div>
                  {showInputSelection ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {showInputSelection && (
                  <div className="p-4 pt-0 border-t border-white/10">
                    <p className="text-xs text-slate-400 mb-3">
                      Select which input sources (Cable boxes, DirecTV, Fire TV) the AI scheduler can use for games
                    </p>

                    {/* Search and Select All/None buttons */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search inputs..."
                          value={inputSearch}
                          onChange={(e) => setInputSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      <Button
                        onClick={selectAllInputs}
                        variant="outline"
                        size="sm"
                        className="text-xs border-slate-600 hover:bg-slate-700"
                      >
                        All
                      </Button>
                      <Button
                        onClick={deselectAllInputs}
                        variant="outline"
                        size="sm"
                        className="text-xs border-slate-600 hover:bg-slate-700"
                      >
                        None
                      </Button>
                    </div>

                    {/* Input Grid */}
                    {inputsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                        {filteredInputs.map((input) => (
                          <button
                            key={input.id}
                            onClick={() => toggleInput(input.channelNumber)}
                            className={`p-2 rounded-lg text-left transition-all border ${
                              allowedInputs.has(input.channelNumber)
                                ? 'bg-purple-500/20 border-purple-400/50 text-white'
                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                {getInputIcon(input.inputType)}
                                <span className="text-sm font-medium truncate">{input.label}</span>
                              </div>
                              {allowedInputs.has(input.channelNumber) && (
                                <Check className="w-4 h-4 text-purple-400 flex-shrink-0 ml-1" />
                              )}
                            </div>
                            <div className="text-xs opacity-60 capitalize">
                              {input.inputType} - Input {input.channelNumber}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {filteredInputs.length === 0 && !inputsLoading && (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No inputs match your search
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Upcoming Games - Show First */}
              {data.upcomingGames && data.upcomingGames.length > 0 && (
                <div className="space-y-4 mb-6">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <Calendar className="mr-2 w-5 h-5 text-green-400" />
                    Available Games Today ({data.upcomingGames.length})
                  </h3>
                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 max-h-96 overflow-y-auto">
                    <div className="space-y-2">
                      {data.upcomingGames.slice(0, 20).map((game: any, index: number) => (
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
                                    {game.liveData.homeAbbrev || game.homeTeam.split(' ').pop()}: {game.liveData.homeScore}
                                  </span>
                                  <span className="text-slate-500">-</span>
                                  <span className={`text-lg font-bold ${game.liveData.awayScore > game.liveData.homeScore ? 'text-green-400' : 'text-white'}`}>
                                    {game.liveData.awayAbbrev || game.awayTeam.split(' ').pop()}: {game.liveData.awayScore}
                                  </span>
                                </div>
                              )}
                              {/* Game status */}
                              {game.liveData?.isLive && (
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-green-400">
                                    {game.liveData.period > 0 && `Q${game.liveData.period} `}
                                    {game.liveData.clock}
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
                                {!game.liveData?.isLive && game.gameTime && (
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
                            {/* Schedule button */}
                            <div className="flex-shrink-0 ml-2">
                              <Button
                                onClick={() => handleScheduleGame(game)}
                                disabled={schedulingGameId === (game.id || `${game.homeTeam}-${game.awayTeam}`) || !game.channelNumber}
                                size="sm"
                                className={`text-xs ${
                                  !game.channelNumber
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-500 text-white'
                                }`}
                              >
                                {schedulingGameId === (game.id || `${game.homeTeam}-${game.awayTeam}`) ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
                                <span className="ml-1">
                                  {schedulingGameId === (game.id || `${game.homeTeam}-${game.awayTeam}`)
                                    ? 'Scheduling...'
                                    : 'Schedule'}
                                </span>
                              </Button>
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

              {/* Games by Input */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <Tv className="mr-2 w-5 h-5 text-blue-400" />
                  Currently Tuned on TVs
                </h3>

                {Object.keys(data.gamesByInput).filter(key => key !== 'Unassigned').length === 0 ? (
                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                    <p className="text-sm text-slate-400">No TVs currently tuned to games</p>
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
