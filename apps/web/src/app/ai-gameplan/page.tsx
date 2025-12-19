'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar, Tv, Clock, MapPin, Trophy, Loader2, ChevronDown, ChevronUp,
  Check, Search, Cable, Satellite, Play, Settings, RefreshCw, Send,
  Lock, Unlock, AlertTriangle, X, CheckCircle, XCircle, Timer
} from 'lucide-react'

// Types
interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  deviceType: string
  isActive: boolean
}

interface MatrixOutput {
  id: string
  channelNumber: number
  label: string
  isActive: boolean
  isSchedulingEnabled: boolean
}

interface BartenderOverride {
  id: string
  tvId: string
  tvName: string
  lockedUntil: string
  lockType: 'manual' | 'permanent' | 'game_end_buffer'
  currentChannel: string | null
  currentGameId: string | null
  gameEndBufferUntil: string | null
}

interface GameData {
  id: string
  homeTeam: string
  awayTeam: string
  league: string
  startTime: string
  gameTime: string
  cableChannel: string
  directvChannel: string
  channelNumber: string
  venue?: string
  isHomeTeamGame: boolean
  streamingApp?: string // e.g., "Peacock", "ESPN+"
  streamingOnly?: boolean // True if only available on streaming
  liveData?: {
    homeScore: string
    awayScore: string
    clock: string
    period: number
    statusState: 'pre' | 'in' | 'post'
    statusDetail: string
    isLive: boolean
    isCompleted: boolean
  }
}

interface FireTVStatus {
  deviceId: string
  deviceName: string
  isOnline: boolean
  currentApp: string | null
  currentAppName: string | null
  currentGame: string | null
  installedApps: string[]
  loggedInApps: string[]
  capabilities: {
    app: string
    package: string
    leagues: string[]
  }[]
}

interface VenueProfile {
  id?: string
  openTime: string
  closeTime: string
  timezone: string
  fillerChannels: string[]
  fillerApps: string[]
  defaultFillerMode: 'sports_network' | 'local_news' | 'music'
  autoRunEnabled: boolean
  autoRunTime: string
  alwaysShowLocalTeams: boolean
  nationalGameBoost: number
  playoffBoost: number
  conflictStrategy: 'priority' | 'round_robin' | 'audience_request'
}

// Helper functions
const formatTime = (dateString: string) => {
  try {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch {
    return dateString
  }
}

const formatCountdown = (lockedUntil: string) => {
  const now = new Date()
  const lockEnd = new Date(lockedUntil)
  const diff = lockEnd.getTime() - now.getTime()

  if (diff <= 0) return 'Expired'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

const getInputIcon = (deviceType: string) => {
  const type = deviceType?.toLowerCase() || ''
  if (type.includes('cable')) return <Cable className="w-4 h-4 text-blue-400" />
  if (type.includes('directv') || type.includes('satellite')) return <Satellite className="w-4 h-4 text-purple-400" />
  if (type.includes('fire') || type.includes('streaming')) return <Play className="w-4 h-4 text-green-400" />
  return <Tv className="w-4 h-4 text-slate-400" />
}

export default function AIGamePlanPage() {
  // Loading states
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [executing, setExecuting] = useState(false)

  // Data states
  const [games, setGames] = useState<GameData[]>([])
  const [upcomingGames, setUpcomingGames] = useState<GameData[]>([])
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [outputs, setOutputs] = useState<MatrixOutput[]>([])
  const [overrides, setOverrides] = useState<BartenderOverride[]>([])
  const [venueProfile, setVenueProfile] = useState<VenueProfile | null>(null)
  const [fireTVStatuses, setFireTVStatuses] = useState<FireTVStatus[]>([])
  const [streamingApps, setStreamingApps] = useState<any[]>([])

  // Selection states
  const [allowedInputs, setAllowedInputs] = useState<Set<number>>(new Set())
  const [allowedOutputs, setAllowedOutputs] = useState<Set<number>>(new Set())

  // UI states
  const [showVenueSettings, setShowVenueSettings] = useState(false)
  const [showTVGrid, setShowTVGrid] = useState(true)
  const [showGamePlan, setShowGamePlan] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Channel presets for display
  const [channelPresets, setChannelPresets] = useState<any[]>([])

  // Load all data on mount
  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    setError(null)

    try {
      await Promise.all([
        loadGamePlan(),
        loadInputs(),
        loadOutputs(),
        loadOverrides(),
        loadVenueProfile(),
        loadChannelPresets(),
        loadAllowedSettings(),
        loadFireTVStatuses(),
        loadStreamingApps()
      ])
      setLastRefresh(new Date())
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadFireTVStatuses = async () => {
    try {
      const response = await fetch('/api/firestick-scout')
      const result = await response.json()

      if (result.success) {
        setFireTVStatuses(result.statuses || [])
      }
    } catch {
      // API might not have data yet
      setFireTVStatuses([])
    }
  }

  const loadStreamingApps = async () => {
    try {
      const response = await fetch('/api/firestick-scout/apps?sportsOnly=true')
      const result = await response.json()

      if (result.success) {
        setStreamingApps(result.apps || [])
      }
    } catch {
      setStreamingApps([])
    }
  }

  const loadGamePlan = async () => {
    const response = await fetch('/api/schedules/ai-game-plan')
    const result = await response.json()

    if (result.success) {
      setGames(result.games || [])
      setUpcomingGames(result.upcomingGames || [])
    }
  }

  const loadInputs = async () => {
    const response = await fetch('/api/wolfpack/inputs')
    const result = await response.json()

    if (result.success && result.inputs) {
      const sourceInputs = result.inputs
        .filter((i: any) => i.isActive && ['Cable Box', 'DirecTV', 'Fire TV'].includes(i.deviceType))
        .map((i: any) => ({
          id: i.id,
          channelNumber: i.channelNumber,
          label: i.label,
          deviceType: i.deviceType?.toLowerCase().replace(' ', '') || 'unknown',
          isActive: i.isActive
        }))
      setInputs(sourceInputs)
    }
  }

  const loadOutputs = async () => {
    const response = await fetch('/api/matrix/config')
    const result = await response.json()

    if (result.outputs) {
      setOutputs(result.outputs.filter((o: MatrixOutput) => o.isActive))
    }
  }

  const loadOverrides = async () => {
    try {
      const response = await fetch('/api/bartender-overrides')
      const result = await response.json()

      if (result.success) {
        setOverrides(result.overrides || [])
      }
    } catch {
      // API might not exist yet
      setOverrides([])
    }
  }

  const loadVenueProfile = async () => {
    try {
      const response = await fetch('/api/ai-venue-profile')
      const result = await response.json()

      if (result.success && result.profile) {
        setVenueProfile(result.profile)
      } else {
        // Set defaults
        setVenueProfile({
          openTime: '11:00',
          closeTime: '02:00',
          timezone: 'America/New_York',
          fillerChannels: [],
          fillerApps: [],
          defaultFillerMode: 'sports_network',
          autoRunEnabled: false,
          autoRunTime: '09:00',
          alwaysShowLocalTeams: true,
          nationalGameBoost: 20,
          playoffBoost: 30,
          conflictStrategy: 'priority'
        })
      }
    } catch {
      // API might not exist yet
      setVenueProfile({
        openTime: '11:00',
        closeTime: '02:00',
        timezone: 'America/New_York',
        fillerChannels: [],
        fillerApps: [],
        defaultFillerMode: 'sports_network',
        autoRunEnabled: false,
        autoRunTime: '09:00',
        alwaysShowLocalTeams: true,
        nationalGameBoost: 20,
        playoffBoost: 30,
        conflictStrategy: 'priority'
      })
    }
  }

  const loadChannelPresets = async () => {
    const response = await fetch('/api/channel-presets')
    const result = await response.json()

    if (result.success && result.presets) {
      setChannelPresets(result.presets)
    }
  }

  const loadAllowedSettings = async () => {
    try {
      const [inputsRes, outputsRes] = await Promise.all([
        fetch('/api/schedules/ai-allowed-inputs'),
        fetch('/api/schedules/ai-allowed-outputs')
      ])

      const inputsResult = await inputsRes.json()
      const outputsResult = await outputsRes.json()

      if (inputsResult.success && inputsResult.allowedInputs) {
        setAllowedInputs(new Set(inputsResult.allowedInputs))
      }
      if (outputsResult.success && outputsResult.allowedOutputs) {
        setAllowedOutputs(new Set(outputsResult.allowedOutputs))
      }
    } catch {
      // Fall back to all enabled
    }
  }

  // Get channel mapping display string
  const getChannelMapping = (game: GameData) => {
    const cablePreset = channelPresets.find(
      p => p.deviceType === 'cable' && p.channelNumber === game.cableChannel
    )
    const directvPreset = channelPresets.find(
      p => p.deviceType === 'directv' && p.channelNumber === game.directvChannel
    )

    if (game.directvChannel && directvPreset) {
      return {
        text: `${directvPreset.name} → Ch ${game.directvChannel} (DirecTV)`,
        type: 'directv',
        available: true
      }
    }
    if (game.cableChannel && cablePreset) {
      return {
        text: `${cablePreset.name} → Ch ${game.cableChannel} (Cable)`,
        type: 'cable',
        available: true
      }
    }
    if (game.directvChannel) {
      return {
        text: `Ch ${game.directvChannel} (DirecTV - preset not found)`,
        type: 'directv',
        available: false
      }
    }
    if (game.cableChannel) {
      return {
        text: `Ch ${game.cableChannel} (Cable - preset not found)`,
        type: 'cable',
        available: false
      }
    }
    return { text: 'No channel available', type: 'none', available: false }
  }

  // Check if a TV has an active override
  const getTVOverride = (outputNum: number) => {
    return overrides.find(o => o.tvId === String(outputNum))
  }

  // Generate today's game plan
  const handleGeneratePlan = async () => {
    setGenerating(true)
    setError(null)
    setSuccess(null)

    try {
      await loadGamePlan()
      setSuccess('Game plan refreshed with latest sports data')
      setLastRefresh(new Date())
    } catch (err: any) {
      setError(err.message || 'Failed to generate game plan')
    } finally {
      setGenerating(false)
    }
  }

  // Execute the game plan - send to TVs
  const handleExecutePlan = async () => {
    setExecuting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/schedules/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowedOutputs: [...allowedOutputs],
          allowedInputs: [...allowedInputs]
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(`Plan executed! ${result.tvsControlled || 0} TVs updated.`)
        await loadGamePlan()
      } else {
        setError(result.error || 'Failed to execute plan')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute plan')
    } finally {
      setExecuting(false)
    }
  }

  // Save allowed inputs/outputs to server
  const saveAllowedSettings = async (newInputs: Set<number>, newOutputs: Set<number>) => {
    try {
      await Promise.all([
        fetch('/api/schedules/ai-allowed-inputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allowedInputs: [...newInputs] })
        }),
        fetch('/api/schedules/ai-allowed-outputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allowedOutputs: [...newOutputs] })
        })
      ])
    } catch (err) {
      console.error('Failed to save allowed settings:', err)
    }
  }

  // Toggle output selection
  const toggleOutput = (channelNumber: number) => {
    setAllowedOutputs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(channelNumber)) {
        newSet.delete(channelNumber)
      } else {
        newSet.add(channelNumber)
      }
      // Auto-save after toggle
      saveAllowedSettings(allowedInputs, newSet)
      return newSet
    })
  }

  // Toggle input selection
  const toggleInput = (channelNumber: number) => {
    setAllowedInputs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(channelNumber)) {
        newSet.delete(channelNumber)
      } else {
        newSet.add(channelNumber)
      }
      // Auto-save after toggle
      saveAllowedSettings(newSet, allowedOutputs)
      return newSet
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <span className="ml-3 text-lg">Loading AI Game Plan...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              AI Game Plan
            </h1>
            <p className="text-slate-400 mt-1">
              Automatically schedule games to your TVs based on team priorities
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-slate-500">
                Last refresh: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <Button
              onClick={handleGeneratePlan}
              disabled={generating}
              variant="outline"
              className="border-slate-600"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh Plan
            </Button>
            <Button
              onClick={handleExecutePlan}
              disabled={executing || upcomingGames.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {executing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send to TVs Now
            </Button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="bg-green-900/50 border border-green-600 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Venue Profile Section (Collapsible) */}
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <button
            onClick={() => setShowVenueSettings(!showVenueSettings)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-slate-400" />
              <span className="font-semibold">Venue Profile</span>
              <Badge variant="secondary" className="bg-slate-700">
                {venueProfile?.openTime} - {venueProfile?.closeTime}
              </Badge>
            </div>
            {showVenueSettings ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showVenueSettings && venueProfile && (
            <div className="p-4 pt-0 border-t border-slate-700 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Open Time</label>
                  <input
                    type="time"
                    value={venueProfile.openTime}
                    onChange={(e) => setVenueProfile({...venueProfile, openTime: e.target.value})}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Close Time</label>
                  <input
                    type="time"
                    value={venueProfile.closeTime}
                    onChange={(e) => setVenueProfile({...venueProfile, closeTime: e.target.value})}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Conflict Strategy</label>
                  <select
                    value={venueProfile.conflictStrategy}
                    onChange={(e) => setVenueProfile({...venueProfile, conflictStrategy: e.target.value as any})}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 w-full"
                  >
                    <option value="priority">Priority (highest first)</option>
                    <option value="round_robin">Round Robin</option>
                    <option value="audience_request">Audience Request</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6 mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={venueProfile.alwaysShowLocalTeams}
                    onChange={(e) => setVenueProfile({...venueProfile, alwaysShowLocalTeams: e.target.checked})}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">Always show local teams</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={venueProfile.autoRunEnabled}
                    onChange={(e) => setVenueProfile({...venueProfile, autoRunEnabled: e.target.checked})}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">Auto-run daily at {venueProfile.autoRunTime}</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* TV Availability Grid */}
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <button
            onClick={() => setShowTVGrid(!showTVGrid)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <Tv className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">TV Availability</span>
              <Badge variant="secondary" className="bg-blue-900/50 text-blue-300">
                {allowedOutputs.size} / {outputs.length} TVs enabled
              </Badge>
              <Badge variant="secondary" className="bg-purple-900/50 text-purple-300">
                {allowedInputs.size} / {inputs.length} inputs enabled
              </Badge>
            </div>
            {showTVGrid ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showTVGrid && (
            <div className="p-4 pt-0 border-t border-slate-700 mt-2">
              {/* Inputs Section */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-300">Source Inputs (Cable/DirecTV/Fire TV)</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const allInputs = new Set(inputs.map(i => i.channelNumber))
                        setAllowedInputs(allInputs)
                        saveAllowedSettings(allInputs, allowedOutputs)
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => {
                        setAllowedInputs(new Set())
                        saveAllowedSettings(new Set(), allowedOutputs)
                      }}
                      className="text-xs text-slate-400 hover:text-slate-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {inputs.map(input => (
                    <button
                      key={input.id}
                      onClick={() => toggleInput(input.channelNumber)}
                      className={`p-2 rounded border text-left text-sm transition-colors ${
                        allowedInputs.has(input.channelNumber)
                          ? 'bg-blue-900/30 border-blue-500 text-blue-200'
                          : 'bg-slate-700/50 border-slate-600 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getInputIcon(input.deviceType)}
                        <span className="truncate">{input.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Outputs Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-300">TV Outputs</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const allOutputs = new Set(outputs.map(o => o.channelNumber))
                        setAllowedOutputs(allOutputs)
                        saveAllowedSettings(allowedInputs, allOutputs)
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => {
                        setAllowedOutputs(new Set())
                        saveAllowedSettings(allowedInputs, new Set())
                      }}
                      className="text-xs text-slate-400 hover:text-slate-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {outputs.map(output => {
                    const override = getTVOverride(output.channelNumber)
                    const isLocked = override && new Date(override.lockedUntil) > new Date()

                    return (
                      <button
                        key={output.id}
                        onClick={() => !isLocked && toggleOutput(output.channelNumber)}
                        disabled={isLocked}
                        className={`p-2 rounded border text-left text-sm transition-colors relative ${
                          isLocked
                            ? 'bg-yellow-900/30 border-yellow-600 text-yellow-300 cursor-not-allowed'
                            : allowedOutputs.has(output.channelNumber)
                            ? 'bg-green-900/30 border-green-500 text-green-200'
                            : 'bg-slate-700/50 border-slate-600 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isLocked ? (
                            <Lock className="w-4 h-4 text-yellow-400" />
                          ) : (
                            <Tv className="w-4 h-4" />
                          )}
                          <span className="truncate">{output.label}</span>
                        </div>
                        {isLocked && (
                          <div className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            {formatCountdown(override.lockedUntil)}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fire TV Streaming Status */}
        {fireTVStatuses.length > 0 && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <Play className="w-5 h-5 text-orange-400" />
              <span className="font-semibold">Fire TV Streaming</span>
              <Badge variant="secondary" className="bg-orange-900/50 text-orange-300">
                {fireTVStatuses.filter(s => s.isOnline).length} / {fireTVStatuses.length} online
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {fireTVStatuses.map(status => (
                <div
                  key={status.deviceId}
                  className={`p-2 rounded border text-sm ${
                    status.isOnline
                      ? status.currentGame
                        ? 'bg-green-900/30 border-green-500'
                        : 'bg-orange-900/30 border-orange-500'
                      : 'bg-slate-700/50 border-slate-600 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Play className={`w-4 h-4 ${status.isOnline ? 'text-orange-400' : 'text-slate-500'}`} />
                    <span className="truncate font-medium">{status.deviceName}</span>
                  </div>
                  {status.isOnline && (
                    <div className="text-xs mt-1 text-slate-400">
                      {status.currentAppName || 'Idle'}
                      {status.currentGame && (
                        <div className="text-green-400 truncate">{status.currentGame}</div>
                      )}
                    </div>
                  )}
                  {status.capabilities && status.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {status.capabilities.slice(0, 3).map((cap: any, idx: number) => (
                        <span key={idx} className="text-xs px-1 bg-slate-700 rounded text-slate-300">
                          {cap.app}
                        </span>
                      ))}
                      {status.capabilities.length > 3 && (
                        <span className="text-xs text-slate-500">+{status.capabilities.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Game Plan */}
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <button
            onClick={() => setShowGamePlan(!showGamePlan)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-green-400" />
              <span className="font-semibold">Today's Games</span>
              <Badge variant="secondary" className="bg-green-900/50 text-green-300">
                {upcomingGames.length + games.length} games found
              </Badge>
              {games.filter(g => g.isHomeTeamGame).length > 0 && (
                <Badge variant="secondary" className="bg-yellow-900/50 text-yellow-300">
                  {games.filter(g => g.isHomeTeamGame).length} home team games
                </Badge>
              )}
            </div>
            {showGamePlan ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showGamePlan && (
            <div className="p-4 pt-0 border-t border-slate-700 mt-2">
              {/* Currently Showing */}
              {games.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Currently Showing
                  </h3>
                  <div className="grid gap-3">
                    {games.map((game, idx) => (
                      <GameCard key={idx} game={game} channelPresets={channelPresets} />
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Games */}
              {upcomingGames.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Upcoming Games</h3>
                  <div className="grid gap-3">
                    {upcomingGames.map((game, idx) => (
                      <GameCard key={idx} game={game} channelPresets={channelPresets} isUpcoming />
                    ))}
                  </div>
                </div>
              )}

              {games.length === 0 && upcomingGames.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No games found for today</p>
                  <p className="text-sm mt-1">Check back later or refresh the data</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bartender Override Notice */}
        {overrides.length > 0 && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-yellow-300">Bartender Overrides Active</h3>
                <p className="text-sm text-yellow-400/80 mt-1">
                  {overrides.length} TV(s) have been manually changed and are locked from AI control.
                  These locks expire after 4 hours or 10 minutes after the current game ends.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {overrides.map(o => (
                    <Badge key={o.id} variant="secondary" className="bg-yellow-800/50">
                      <Lock className="w-3 h-3 mr-1" />
                      {o.tvName} ({formatCountdown(o.lockedUntil)})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Game Card Component
function GameCard({
  game,
  channelPresets,
  isUpcoming = false
}: {
  game: GameData
  channelPresets: any[]
  isUpcoming?: boolean
}) {
  // Get channel mapping
  const cablePreset = channelPresets.find(
    p => p.deviceType === 'cable' && p.channelNumber === game.cableChannel
  )
  const directvPreset = channelPresets.find(
    p => p.deviceType === 'directv' && p.channelNumber === game.directvChannel
  )

  const hasChannel = game.cableChannel || game.directvChannel

  return (
    <div className={`rounded-lg border p-4 ${
      game.isHomeTeamGame
        ? 'bg-yellow-900/20 border-yellow-700'
        : isUpcoming
        ? 'bg-slate-700/30 border-slate-600'
        : 'bg-slate-700/50 border-slate-600'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* League & Time */}
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <Badge variant="secondary" className="bg-slate-700 text-xs">
              {game.league}
            </Badge>
            <Clock className="w-3 h-3" />
            <span>{game.gameTime || formatTime(game.startTime)}</span>
            {game.isHomeTeamGame && (
              <Badge variant="secondary" className="bg-yellow-600/50 text-yellow-200 text-xs">
                HOME TEAM
              </Badge>
            )}
          </div>

          {/* Teams */}
          <div className="font-medium mb-2">
            <span className="text-slate-200">{game.awayTeam}</span>
            <span className="text-slate-500 mx-2">@</span>
            <span className="text-white">{game.homeTeam}</span>
          </div>

          {/* Live Score */}
          {game.liveData && (
            <div className="flex items-center gap-3 mb-2">
              {game.liveData.isLive ? (
                <>
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    LIVE
                  </Badge>
                  <span className="text-lg font-bold text-white">
                    {game.liveData.awayScore} - {game.liveData.homeScore}
                  </span>
                  <span className="text-sm text-slate-400">
                    {game.liveData.statusDetail}
                  </span>
                </>
              ) : game.liveData.isCompleted ? (
                <>
                  <Badge variant="secondary" className="text-xs bg-slate-600">
                    FINAL
                  </Badge>
                  <span className="text-lg font-bold text-slate-300">
                    {game.liveData.awayScore} - {game.liveData.homeScore}
                  </span>
                </>
              ) : (
                <Badge variant="secondary" className="text-xs bg-slate-700">
                  {game.liveData.statusDetail || 'Scheduled'}
                </Badge>
              )}
            </div>
          )}

          {/* Channel Mapping */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {hasChannel || game.streamingApp ? (
              <>
                {game.directvChannel && (
                  <div className="flex items-center gap-1.5 bg-purple-900/30 px-2 py-1 rounded text-purple-300">
                    <Satellite className="w-3 h-3" />
                    <span>
                      {directvPreset?.name || 'Unknown'} → Ch {game.directvChannel}
                    </span>
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  </div>
                )}
                {game.cableChannel && (
                  <div className="flex items-center gap-1.5 bg-blue-900/30 px-2 py-1 rounded text-blue-300">
                    <Cable className="w-3 h-3" />
                    <span>
                      {cablePreset?.name || 'Unknown'} → Ch {game.cableChannel}
                    </span>
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  </div>
                )}
                {game.streamingApp && (
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${
                    game.streamingOnly
                      ? 'bg-orange-900/30 text-orange-300'
                      : 'bg-green-900/30 text-green-300'
                  }`}>
                    <Play className="w-3 h-3" />
                    <span>{game.streamingApp}</span>
                    {game.streamingOnly && (
                      <span className="text-xs opacity-70">(streaming only)</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5 bg-red-900/30 px-2 py-1 rounded text-red-300">
                <XCircle className="w-3 h-3" />
                <span>No channel mapping available</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
