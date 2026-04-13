'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import DefaultSourceSettings from './DefaultSourceSettings'
import {
  Calendar,
  Clock,
  Tv,
  RefreshCw,
  Settings,
  X,
  Monitor,
  Play,
  Sparkles,
  Zap,
  Hand,
  Loader2,
  Check,
  CheckCheck,
  Pencil,
  SkipForward,
  Trophy,
  Cable,
  Satellite,
  Search,
  ChevronDown,
  ChevronUp,
  StopCircle,
  AlertTriangle,
  Timer,
} from 'lucide-react'
import ScheduledGameTVPicker from './ScheduledGameTVPicker'
import { logger } from '@sports-bar/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduledGame {
  id: string
  inputSourceId: string
  inputLabel: string
  deviceId: string | null
  deviceType: string
  channelNumber: string
  gameId: string
  homeTeam: string
  awayTeam: string
  league: string
  tuneAt: string
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  tvOutputIds: number[]
  audioSourceIndex: number | null
  audioSourceName: string | null
  audioZoneIds: number[]
}

interface CableBoxChannel {
  channelNumber: string
  channelName: string | null
  deviceType: string
  inputLabel: string
  lastTuned: string
}

type ScheduleMode = 'manual' | 'ai-suggest' | 'auto-pilot'

// AI Suggest types
interface AISuggestion {
  gameId: string
  homeTeam: string
  awayTeam: string
  league: string
  startTime: string
  channelNumber: string
  channelName: string
  suggestedInput: string
  suggestedInputId: string
  suggestedOutputs: number[]
  confidence: number
  reasoning: string
}

// Auto-Pilot types (from AIGamePlanModal)
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO timestamp to local time, e.g. "12:00 PM" */
function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Check if a pending game is delayed because an active game is still running on the same input. */
function getDelayInfo(
  game: ScheduledGame,
  allGames: ScheduledGame[]
): { isDelayed: boolean; delayMinutes: number; blockingGame: ScheduledGame | null } {
  if (game.status !== 'pending') return { isDelayed: false, delayMinutes: 0, blockingGame: null }
  const tuneTime = new Date(game.tuneAt).getTime() - 300_000 // 5-minute early buffer
  if (tuneTime >= Date.now()) return { isDelayed: false, delayMinutes: 0, blockingGame: null }
  const blocker = allGames.find(
    (g) => g.status === 'active' && g.inputLabel === game.inputLabel && g.id !== game.id
  ) ?? null
  if (!blocker) return { isDelayed: false, delayMinutes: 0, blockingGame: null }
  const delayMs = Date.now() - tuneTime
  const delayMinutes = Math.max(1, Math.round(delayMs / 60_000))
  return { isDelayed: true, delayMinutes, blockingGame: blocker }
}

/** Status dot color classes keyed by status. */
const STATUS_DOT_COLOR: Record<ScheduledGame['status'], string> = {
  pending: 'bg-blue-400',
  active: 'bg-green-400',
  completed: 'bg-slate-500',
  cancelled: 'bg-red-400',
}

/** Status badge styles keyed by status. */
const STATUS_BADGE: Record<
  ScheduledGame['status'],
  { label: string; classes: string }
> = {
  pending: {
    label: 'Pending',
    classes: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  },
  active: {
    label: 'Live',
    classes: 'bg-green-500/20 text-green-400 border border-green-500/30',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-slate-500/20 text-slate-500 border border-slate-500/30',
  },
  cancelled: {
    label: 'Cancelled',
    classes:
      'bg-red-500/20 text-red-400 border border-red-500/30 line-through',
  },
}

// LocalStorage keys for persisting Auto-Pilot allow lists
const ALLOWED_OUTPUTS_KEY = 'ai-game-plan-allowed-outputs'
const ALLOWED_INPUTS_KEY = 'ai-game-plan-allowed-inputs'

/** Get icon for an input source type */
function getInputIcon(inputType: string) {
  const type = inputType.toLowerCase()
  if (type.includes('cable')) return <Cable className="w-3 h-3 text-blue-400" />
  if (type.includes('directv') || type.includes('satellite')) return <Satellite className="w-3 h-3 text-purple-400" />
  if (type.includes('fire') || type.includes('streaming')) return <Play className="w-3 h-3 text-green-400" />
  return <Tv className="w-3 h-3 text-slate-400" />
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScheduledGamesPanel() {
  // -----------------------------------------------------------------------
  // Shared state (used by all modes)
  // -----------------------------------------------------------------------
  const [mode, setMode] = useState<ScheduleMode>('manual')
  const [games, setGames] = useState<ScheduledGame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [showDefaults, setShowDefaults] = useState(false)
  const [tuningId, setTuningId] = useState<string | null>(null)
  const [cableBoxChannels, setCableBoxChannels] = useState<Record<string, CableBoxChannel>>({})
  const [notification, setNotification] = useState<string | null>(null)
  const prevGamesRef = useRef<ScheduledGame[]>([])

  // -----------------------------------------------------------------------
  // AI Suggest state
  // -----------------------------------------------------------------------
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set())
  const [approvingAll, setApprovingAll] = useState(false)
  const [modifyingId, setModifyingId] = useState<string | null>(null)
  const [modifyOutputs, setModifyOutputs] = useState<Record<string, number[]>>({})

  // -----------------------------------------------------------------------
  // Auto-Pilot state
  // -----------------------------------------------------------------------
  const [autoPilotData, setAutoPilotData] = useState<AIGamePlanData | null>(null)
  const [autoPilotLoading, setAutoPilotLoading] = useState(false)
  const [autoPilotError, setAutoPilotError] = useState<string | null>(null)
  const [autoPilotRunning, setAutoPilotRunning] = useState(false)
  const [schedulingGameId, setSchedulingGameId] = useState<string | null>(null)
  const [autoPilotSuccess, setAutoPilotSuccess] = useState<string | null>(null)

  // Input/Output allow lists for Auto-Pilot
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [allowedInputs, setAllowedInputs] = useState<Set<number>>(new Set())
  const [showInputSelection, setShowInputSelection] = useState(false)
  const [inputSearch, setInputSearch] = useState('')
  const [inputsLoading, setInputsLoading] = useState(false)

  const [outputs, setOutputs] = useState<MatrixOutput[]>([])
  const [allowedOutputs, setAllowedOutputs] = useState<Set<number>>(new Set())
  const [showOutputSelection, setShowOutputSelection] = useState(false)
  const [outputSearch, setOutputSearch] = useState('')
  const [outputsLoading, setOutputsLoading] = useState(false)

  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Atlas processor IP fetched from database
  const [atlasProcessorIp, setAtlasProcessorIp] = useState<string | null>(null)


  // -----------------------------------------------------------------------
  // Fetch current cable box channels
  // -----------------------------------------------------------------------

  const fetchCableBoxChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/matrix/current-channels')
      if (!res.ok) return
      const data = await res.json()
      if (data.success && data.channels) {
        setCableBoxChannels(data.channels)
      }
    } catch (err) {
      logger.debug('[SCHEDULED-GAMES] Failed to fetch cable box channels', err)
    }
  }, [])

  // -----------------------------------------------------------------------
  // Fetch schedule (Manual mode)
  // -----------------------------------------------------------------------

  const fetchSchedule = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    setError(null)

    try {
      const res = await fetch('/api/schedules/bartender-schedule')
      if (!res.ok) {
        throw new Error(`Failed to fetch schedule (${res.status})`)
      }
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Unknown error fetching schedule')
      }

      // Sort by tuneAt ascending
      const sorted = (data.schedules as ScheduledGame[]).sort(
        (a, b) => new Date(a.tuneAt).getTime() - new Date(b.tuneAt).getTime()
      )

      // Check for games that just went from pending to active
      if (prevGamesRef.current.length > 0) {
        const prevMap = new Map(prevGamesRef.current.map((g) => [g.id, g]))
        for (const game of sorted) {
          const prev = prevMap.get(game.id)
          if (prev && prev.status === 'pending' && game.status === 'active') {
            const msg = `\u{1F3C8} Game Started: ${game.awayTeam} @ ${game.homeTeam} on ${game.inputLabel} Ch ${game.channelNumber}`
            setNotification(msg)
            // Play a short notification beep via Web Audio API
            try {
              const ctx = new AudioContext()
              const osc = ctx.createOscillator()
              osc.type = 'sine'
              osc.frequency.value = 800
              osc.connect(ctx.destination)
              osc.start()
              setTimeout(() => osc.stop(), 200)
            } catch {}
            break // Show one notification at a time
          }
        }
      }
      prevGamesRef.current = sorted

      setGames(sorted)
      logger.debug('[SCHEDULED-GAMES] Loaded schedule', {
        count: sorted.length,
      })
    } catch (err: any) {
      logger.error('[SCHEDULED-GAMES] Failed to fetch schedule:', err)
      setError(err.message || 'Failed to load schedule')
    } finally {
      setLoading(false)
      if (isManual) setRefreshing(false)
    }
  }, [])

  // Initial fetch + auto-refresh every 30 seconds (paused while editing defaults)
  useEffect(() => {
    fetchSchedule()
    fetchCableBoxChannels()
    if (showDefaults) return // Pause auto-refresh while defaults section is open
    const interval = setInterval(() => {
      fetchSchedule()
      fetchCableBoxChannels()
    }, 30_000)
    return () => clearInterval(interval)
  }, [fetchSchedule, fetchCableBoxChannels, showDefaults])

  // Fetch Atlas processor IP from database on mount
  useEffect(() => {
    fetch('/api/audio-processor')
      .then((res) => res.json())
      .then((data) => {
        if (data.processors?.length > 0) {
          setAtlasProcessorIp(data.processors[0].ipAddress)
        }
      })
      .catch((err) => {
        logger.debug('[SCHEDULED-GAMES] Failed to fetch Atlas processor IP', err)
      })
  }, [])


  // Auto-dismiss notification after 10 seconds
  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(null), 10_000)
    return () => clearTimeout(timer)
  }, [notification])

  // -----------------------------------------------------------------------
  // Cancel a pending schedule
  // -----------------------------------------------------------------------

  const cancelSchedule = useCallback(
    async (id: string) => {
      setCancellingId(id)
      try {
        const res = await fetch('/api/schedules/bartender-schedule', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: 'cancelled' }),
        })
        if (!res.ok) {
          logger.error('[SCHEDULED-GAMES] Failed to cancel schedule', {
            id,
            status: res.status,
          })
        } else {
          logger.debug('[SCHEDULED-GAMES] Cancelled schedule', { id })
          // Optimistically update local state
          setGames((prev) =>
            prev.map((g) => (g.id === id ? { ...g, status: 'cancelled' } : g))
          )
        }
      } catch (err: any) {
        logger.error('[SCHEDULED-GAMES] Error cancelling schedule:', err)
      } finally {
        setCancellingId(null)
      }
    },
    []
  )

  // -----------------------------------------------------------------------
  // Tune Now -- immediately tune a pending scheduled game
  // -----------------------------------------------------------------------

  const tuneNow = useCallback(
    async (game: ScheduledGame) => {
      setTuningId(game.id)
      try {
        const tuneBody: Record<string, unknown> = {
          channelNumber: game.channelNumber,
          deviceType: game.deviceType,
        }

        // Pass the device ID so the tune API can find the right hardware
        if (game.deviceType === 'cable' && game.deviceId) {
          tuneBody.cableBoxId = game.deviceId
        } else if (game.deviceType === 'directv' && game.deviceId) {
          tuneBody.directTVId = game.deviceId
        }

        const res = await fetch('/api/channel-presets/tune', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tuneBody),
        })

        if (res.ok) {
          logger.debug('[SCHEDULED-GAMES] Tune Now succeeded', { id: game.id })
          // Optimistically mark as active
          setGames((prev) =>
            prev.map((g) => (g.id === game.id ? { ...g, status: 'active' } : g))
          )

          // Route matrix input to assigned TV/audio outputs
          if (game.tvOutputIds && game.tvOutputIds.length > 0) {
            // Derive matrix input from cable box label (Cable Box 1 = input 1, etc.)
            const inputMatch = game.inputLabel.match(/(\d+)/)
            const matrixInput = inputMatch ? parseInt(inputMatch[1], 10) : null

            if (matrixInput) {
              logger.debug('[SCHEDULED-GAMES] Routing matrix input', { matrixInput, outputs: game.tvOutputIds })
              await Promise.all(
                game.tvOutputIds.map((output) =>
                  fetch('/api/matrix/route', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input: matrixInput, output }),
                  }).catch(() => {})
                )
              )
            }
          }

          // Switch Atlas audio groups to the game audio source
          if (game.audioSourceIndex != null && game.audioZoneIds && game.audioZoneIds.length > 0) {
            if (!atlasProcessorIp) {
              logger.warn('[SCHEDULED-GAMES] Atlas processor IP not loaded, skipping audio group switch')
            } else {
              logger.debug('[SCHEDULED-GAMES] Switching Atlas audio groups', {
                source: game.audioSourceIndex,
                groups: game.audioZoneIds,
              })
              await Promise.all(
                game.audioZoneIds.map((groupIndex) =>
                  fetch('/api/atlas/groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      processorIp: atlasProcessorIp,
                      groupIndex,
                      action: 'setSource',
                      value: game.audioSourceIndex,
                    }),
                  }).catch(() => {})
                )
              )
            }
          }
        } else {
          const data = await res.json().catch(() => ({}))
          logger.error('[SCHEDULED-GAMES] Tune Now failed', {
            id: game.id,
            status: res.status,
            error: data.error,
          })
        }
      } catch (err: any) {
        logger.error('[SCHEDULED-GAMES] Error during Tune Now:', err)
      } finally {
        setTuningId(null)
      }
    },
    [atlasProcessorIp]
  )

  // -----------------------------------------------------------------------
  // Handle TV picker updates (optimistic local state)
  // -----------------------------------------------------------------------

  const handleTVUpdate = useCallback((id: string, outputIds: number[]) => {
    setGames((prev) =>
      prev.map((g) => (g.id === id ? { ...g, tvOutputIds: outputIds } : g))
    )
  }, [])

  // -----------------------------------------------------------------------
  // AI Suggest — fetch suggestions
  // -----------------------------------------------------------------------

  const fetchSuggestions = useCallback(async () => {
    setSuggestLoading(true)
    setSuggestError(null)
    setSuggestions([])
    setSkippedIds(new Set())
    setApprovedIds(new Set())
    setModifyingId(null)

    try {
      const res = await fetch('/api/scheduling/ai-suggest')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to get suggestions')
      }
      setSuggestions(data.suggestions || [])
    } catch (err: any) {
      logger.error('[AI-SUGGEST] Failed to fetch suggestions:', err)
      setSuggestError(err.message || 'Failed to fetch suggestions')
    } finally {
      setSuggestLoading(false)
    }
  }, [])

  // -----------------------------------------------------------------------
  // AI Suggest — approve a single suggestion
  // -----------------------------------------------------------------------

  const approveSuggestion = useCallback(async (suggestion: AISuggestion) => {
    setApprovingId(suggestion.gameId)
    try {
      const outputIds = modifyOutputs[suggestion.gameId] ?? suggestion.suggestedOutputs
      // Send BOTH inputSourceId and deviceId when available — the
      // bartender-schedule route accepts either and the ai-suggest route
      // does its best to resolve the matching input source for us.
      const res = await fetch('/api/schedules/bartender-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputSourceId: suggestion.suggestedInputId || undefined,
          deviceId: (suggestion as any).suggestedDeviceId || undefined,
          deviceName: suggestion.suggestedInput || undefined,
          deviceType: 'cable',
          channelNumber: suggestion.channelNumber,
          channelName: suggestion.channelName,
          gameInfo: {
            homeTeam: suggestion.homeTeam,
            awayTeam: suggestion.awayTeam,
            league: suggestion.league,
            startTime: suggestion.startTime,
          },
          tuneAt: suggestion.startTime,
          tvOutputIds: outputIds,
        }),
      })

      if (res.ok) {
        setApprovedIds((prev) => new Set(prev).add(suggestion.gameId))
        // Refresh the manual schedule too
        fetchSchedule()
      } else {
        const data = await res.json().catch(() => ({}))
        logger.error('[AI-SUGGEST] Failed to approve suggestion', { error: data.error })
        setSuggestError(`Failed to approve: ${data.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      logger.error('[AI-SUGGEST] Error approving suggestion:', err)
      setSuggestError(err.message || 'Failed to approve suggestion')
    } finally {
      setApprovingId(null)
    }
  }, [modifyOutputs, fetchSchedule])

  // -----------------------------------------------------------------------
  // AI Suggest — approve all visible suggestions
  // -----------------------------------------------------------------------

  const approveAll = useCallback(async () => {
    setApprovingAll(true)
    const toApprove = suggestions.filter(
      (s) => !skippedIds.has(s.gameId) && !approvedIds.has(s.gameId)
    )

    for (const suggestion of toApprove) {
      await approveSuggestion(suggestion)
    }
    setApprovingAll(false)
  }, [suggestions, skippedIds, approvedIds, approveSuggestion])

  // -----------------------------------------------------------------------
  // Auto-Pilot — load inputs & outputs
  // -----------------------------------------------------------------------

  const loadInputs = useCallback(async () => {
    setInputsLoading(true)
    try {
      const response = await fetch('/api/wolfpack/inputs')
      const result = await response.json()
      if (result.success && result.inputs) {
        const sourceInputs = result.inputs
          .filter((i: any) => i.isActive && ['Cable Box', 'CableBox', 'DirecTV', 'Fire TV'].includes(i.deviceType))
          .map((i: any) => ({
            id: i.id,
            channelNumber: i.channelNumber,
            label: i.label,
            inputType: i.deviceType?.toLowerCase().replace(' ', '') || 'unknown',
            isActive: i.isActive,
          }))
        setInputs(sourceInputs)
        const saved = localStorage.getItem(ALLOWED_INPUTS_KEY)
        if (!saved) {
          setAllowedInputs(new Set(sourceInputs.map((i: MatrixInput) => i.channelNumber)))
        }
      }
    } catch (err) {
      logger.error('[AUTO-PILOT] Failed to load inputs', err)
    } finally {
      setInputsLoading(false)
    }
  }, [])

  const loadOutputs = useCallback(async () => {
    setOutputsLoading(true)
    try {
      const response = await fetch('/api/matrix/config')
      const result = await response.json()
      if (result.outputs) {
        const activeOutputs = result.outputs.filter((o: MatrixOutput) => o.isActive)
        setOutputs(activeOutputs)
        const saved = localStorage.getItem(ALLOWED_OUTPUTS_KEY)
        if (!saved) {
          setAllowedOutputs(new Set(activeOutputs.map((o: MatrixOutput) => o.channelNumber)))
        }
      }
    } catch (err) {
      logger.error('[AUTO-PILOT] Failed to load outputs', err)
    } finally {
      setOutputsLoading(false)
    }
  }, [])

  // Load allowed lists from DB on mount
  useEffect(() => {
    const loadAllowedOutputs = async () => {
      try {
        const response = await fetch('/api/schedules/ai-allowed-outputs')
        const result = await response.json()
        if (result.success && result.allowedOutputs && result.allowedOutputs.length > 0) {
          setAllowedOutputs(new Set(result.allowedOutputs))
          localStorage.setItem(ALLOWED_OUTPUTS_KEY, JSON.stringify(result.allowedOutputs))
        } else {
          const saved = localStorage.getItem(ALLOWED_OUTPUTS_KEY)
          if (saved) {
            setAllowedOutputs(new Set(JSON.parse(saved)))
          }
        }
      } catch {
        const saved = localStorage.getItem(ALLOWED_OUTPUTS_KEY)
        if (saved) {
          try { setAllowedOutputs(new Set(JSON.parse(saved))) } catch { /* ignore */ }
        }
      }
    }
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
            setAllowedInputs(new Set(JSON.parse(saved)))
          }
        }
      } catch {
        const saved = localStorage.getItem(ALLOWED_INPUTS_KEY)
        if (saved) {
          try { setAllowedInputs(new Set(JSON.parse(saved))) } catch { /* ignore */ }
        }
      }
    }
    loadAllowedOutputs()
    loadAllowedInputs()
  }, [])

  // Mark initial load done after 1s
  useEffect(() => {
    const timer = setTimeout(() => setInitialLoadDone(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  // Persist allow lists to DB when they change (after initial load)
  useEffect(() => {
    if (!initialLoadDone) return
    localStorage.setItem(ALLOWED_OUTPUTS_KEY, JSON.stringify([...allowedOutputs]))
    fetch('/api/schedules/ai-allowed-outputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedOutputs: [...allowedOutputs] }),
    }).catch(() => {})
  }, [allowedOutputs, initialLoadDone])

  useEffect(() => {
    if (!initialLoadDone) return
    localStorage.setItem(ALLOWED_INPUTS_KEY, JSON.stringify([...allowedInputs]))
    fetch('/api/schedules/ai-allowed-inputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedInputs: [...allowedInputs] }),
    }).catch(() => {})
  }, [allowedInputs, initialLoadDone])

  // Load inputs/outputs when Auto-Pilot mode is selected
  useEffect(() => {
    if (mode === 'auto-pilot') {
      loadInputs()
      loadOutputs()
    }
  }, [mode, loadInputs, loadOutputs])

  // -----------------------------------------------------------------------
  // Auto-Pilot — toggle helpers
  // -----------------------------------------------------------------------

  const toggleOutput = (channelNumber: number) => {
    setAllowedOutputs((prev) => {
      const s = new Set(prev)
      if (s.has(channelNumber)) s.delete(channelNumber)
      else s.add(channelNumber)
      return s
    })
  }
  const toggleInput = (channelNumber: number) => {
    setAllowedInputs((prev) => {
      const s = new Set(prev)
      if (s.has(channelNumber)) s.delete(channelNumber)
      else s.add(channelNumber)
      return s
    })
  }

  const filteredOutputs = outputs.filter(
    (o) =>
      !outputSearch ||
      o.label.toLowerCase().includes(outputSearch.toLowerCase()) ||
      String(o.channelNumber).includes(outputSearch)
  )
  const filteredInputs = inputs.filter(
    (i) =>
      !inputSearch ||
      i.label.toLowerCase().includes(inputSearch.toLowerCase()) ||
      String(i.channelNumber).includes(inputSearch)
  )

  // -----------------------------------------------------------------------
  // Auto-Pilot — run the game plan
  // -----------------------------------------------------------------------

  const runAutoPilot = useCallback(async () => {
    setAutoPilotLoading(true)
    setAutoPilotError(null)
    setAutoPilotData(null)
    setAutoPilotSuccess(null)

    try {
      const response = await fetch('/api/schedules/ai-game-plan')
      const result = await response.json()
      if (result.success) {
        setAutoPilotData(result)
        setAutoPilotRunning(true)
      } else {
        setAutoPilotError(result.error || 'Failed to run AI game plan')
      }
    } catch (err: any) {
      setAutoPilotError(err.message || 'Failed to run AI game plan')
    } finally {
      setAutoPilotLoading(false)
    }
  }, [])

  // Auto-Pilot — schedule a single game from game plan results
  const handleScheduleGame = useCallback(async (game: any) => {
    const gameId = game.id || `${game.homeTeam}-${game.awayTeam}`
    setSchedulingGameId(gameId)
    setAutoPilotSuccess(null)

    try {
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
            gameTime: game.gameTime,
          },
          allowedOutputs: [...allowedOutputs],
          allowedInputs: [...allowedInputs],
        }),
      })

      const result = await response.json()
      if (result.success) {
        setAutoPilotSuccess(
          `${game.homeTeam} vs ${game.awayTeam} scheduled to ${result.tvsControlled || 1} TV(s)`
        )
        runAutoPilot() // Refresh
        fetchSchedule() // Refresh manual view too
      } else {
        setAutoPilotError(`Failed to schedule game: ${result.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      setAutoPilotError(`Failed to schedule game: ${err.message}`)
    } finally {
      setSchedulingGameId(null)
    }
  }, [allowedOutputs, allowedInputs, runAutoPilot, fetchSchedule])

  const stopAutoPilot = useCallback(() => {
    setAutoPilotRunning(false)
    setAutoPilotData(null)
  }, [])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Game-started toast notification */}
      {notification && (
        <div
          onClick={() => setNotification(null)}
          className="fixed top-0 left-0 right-0 z-[100] bg-green-600 text-white p-4 text-center text-base font-semibold shadow-lg cursor-pointer animate-pulse"
        >
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-400" />
          Today&apos;s Schedule
        </h3>
        <button
          type="button"
          onClick={() => { fetchSchedule(true); fetchCableBoxChannels() }}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* ================================================================= */}
      {/* Mode Selector — pill buttons */}
      {/* ================================================================= */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex items-center gap-2 rounded-full py-3 px-4 text-sm font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
              : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-300'
          }`}
        >
          <Hand className="h-4 w-4" />
          Manual
        </button>
        <button
          type="button"
          onClick={() => setMode('ai-suggest')}
          className={`flex items-center gap-2 rounded-full py-3 px-4 text-sm font-medium transition-colors ${
            mode === 'ai-suggest'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
              : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-300'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          AI Suggest
        </button>
        <button
          type="button"
          onClick={() => setMode('auto-pilot')}
          className={`flex items-center gap-2 rounded-full py-3 px-4 text-sm font-medium transition-colors ${
            mode === 'auto-pilot'
              ? 'bg-green-500/20 text-green-400 border border-green-500/50'
              : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-300'
          }`}
        >
          <Zap className="h-4 w-4" />
          Auto-Pilot
        </button>
      </div>

      {/* Cable Box Status Cards (always visible) */}
      {Object.keys(cableBoxChannels).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(cableBoxChannels)
            .filter(([_, channel]) => channel.deviceType === 'cable')
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([inputNum, channel]) => {
              // Find active allocation for this cable box by matching inputLabel
              const activeGame = games.find(
                (g) =>
                  g.status === 'active' &&
                  g.inputLabel === channel.inputLabel
              )
              const hasActiveAllocation = !!activeGame

              return (
                <div
                  key={inputNum}
                  className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 py-3"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                        hasActiveAllocation
                          ? 'bg-green-400 animate-pulse'
                          : 'bg-blue-400'
                      }`}
                    />
                    <span className="text-sm font-semibold text-white truncate">
                      Cable Box {inputNum}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-300 mb-1">
                    <Tv className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">
                      Ch {channel.channelNumber}
                      {channel.channelName ? ` - ${channel.channelName}` : ''}
                    </span>
                  </div>
                  {hasActiveAllocation && activeGame ? (
                    <p className="text-xs text-green-400 font-medium truncate">
                      {activeGame.awayTeam} vs {activeGame.homeTeam}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">Idle</p>
                  )}
                </div>
              )
            })}
        </div>
      )}

      {/* ================================================================= */}
      {/* MANUAL MODE — existing timeline view */}
      {/* ================================================================= */}
      {mode === 'manual' && (
        <>
          {/* Cascade delay warning banner */}
          {(() => {
            const delayedGames = games.filter((g) => getDelayInfo(g, games).isDelayed)
            if (delayedGames.length === 0) return null
            // Group delayed games by the cable box (inputLabel) that's blocking them
            const byInput = new Map<string, number>()
            for (const g of delayedGames) {
              const count = byInput.get(g.inputLabel) || 0
              byInput.set(g.inputLabel, count + 1)
            }
            const inputSummaries = Array.from(byInput.entries())
              .map(([label, count]) => `${count} on ${label}`)
              .join(', ')
            return (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-300">
                    {delayedGames.length} game{delayedGames.length !== 1 ? 's' : ''} delayed
                    {' '}&mdash; live game{byInput.size !== 1 ? 's' : ''} running long
                  </p>
                  <p className="text-xs text-amber-400/70 mt-0.5">
                    {inputSummaries}
                  </p>
                </div>
              </div>
            )
          })()}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 text-slate-500 animate-spin" />
              <span className="ml-2 text-slate-400 text-sm">
                Loading schedule...
              </span>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && games.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Calendar className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm font-medium">No games scheduled today</p>
              <p className="text-xs text-slate-600 mt-1">
                Scheduled games will appear here automatically.
              </p>
            </div>
          )}

          {/* Timeline list */}
          {!loading && !error && games.length > 0 && (
            <div className="space-y-3">
              {games.map((game) => {
                const badge = STATUS_BADGE[game.status]
                const dotColor = STATUS_DOT_COLOR[game.status]
                const isPending = game.status === 'pending'
                const isCancelling = cancellingId === game.id
                const delayInfo = getDelayInfo(game, games)

                return (
                  <div
                    key={game.id}
                    className={`rounded-lg bg-slate-800/50 border p-4 flex items-start gap-4 ${
                      delayInfo.isDelayed
                        ? 'border-amber-500/40'
                        : 'border-slate-700'
                    }`}
                  >
                    {/* Left: Time & status dot */}
                    <div className="flex flex-col items-center gap-1 min-w-[64px] pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${
                            delayInfo.isDelayed ? 'bg-amber-400 animate-pulse' : dotColor
                          } ${
                            game.status === 'active' ? 'animate-pulse' : ''
                          }`}
                        />
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                      <span className="text-sm font-medium text-white whitespace-nowrap">
                        {formatTime(game.tuneAt)}
                      </span>
                      {delayInfo.isDelayed ? (
                        <span className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Delayed
                        </span>
                      ) : (
                        <span
                          className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>

                    {/* Center: Game details */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* League badge */}
                      <span className="inline-flex items-center bg-slate-700 text-slate-300 rounded-full px-2 py-0.5 text-xs">
                        {game.league}
                      </span>

                      {/* Teams */}
                      <p
                        className={`text-sm font-semibold ${
                          game.status === 'cancelled'
                            ? 'text-slate-500 line-through'
                            : 'text-white'
                        }`}
                      >
                        {game.awayTeam} @ {game.homeTeam}
                      </p>

                      {/* Channel & input info */}
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Tv className="h-3 w-3 flex-shrink-0" />
                        <span>
                          Ch {game.channelNumber}
                        </span>
                        <span className="text-slate-600">&#x2022;</span>
                        <Monitor className="h-3 w-3 flex-shrink-0" />
                        <span>{game.inputLabel}</span>
                      </div>

                      {/* TV Picker */}
                      <ScheduledGameTVPicker
                        allocationId={game.id}
                        currentOutputIds={game.tvOutputIds}
                        onUpdate={(outputIds) => handleTVUpdate(game.id, outputIds)}
                      />

                      {/* Delay notification banner */}
                      {(() => {
                        const { isDelayed, delayMinutes, blockingGame } = getDelayInfo(game, games)
                        if (!isDelayed || !blockingGame) return null
                        return (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/20 p-3 mt-1">
                            <div className="flex items-start gap-2">
                              <Timer className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-amber-300">
                                  Delayed {delayMinutes} minute{delayMinutes !== 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-amber-400/80 mt-0.5">
                                  {blockingGame.awayTeam} @ {blockingGame.homeTeam} still in progress on {game.inputLabel}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => tuneNow(game)}
                                disabled={tuningId === game.id}
                                className="flex-shrink-0 flex items-center gap-1.5 rounded-md border border-amber-500/50 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white py-2 px-4 text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                <Zap className="h-4 w-4" />
                                {tuningId === game.id ? 'Tuning...' : 'Force Tune Now'}
                              </button>
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Right: Tune/Re-Tune + Cancel buttons */}
                    <div className="flex-shrink-0 flex flex-col gap-2">
                      {(isPending || game.status === 'active') && (
                        <button
                          type="button"
                          onClick={() => tuneNow(game)}
                          disabled={tuningId === game.id}
                          title={isPending ? 'Tune this channel now' : 'Re-tune this channel'}
                          className={`flex items-center gap-1.5 rounded-md border py-2 px-4 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                            isPending
                              ? 'border-green-600 bg-green-700 hover:bg-green-600 active:bg-green-800'
                              : 'border-blue-600 bg-blue-700 hover:bg-blue-600 active:bg-blue-800'
                          }`}
                        >
                          <Play className="h-4 w-4" />
                          {tuningId === game.id ? 'Tuning...' : isPending ? 'Tune Now' : 'Re-Tune'}
                        </button>
                      )}
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => cancelSchedule(game.id)}
                          disabled={isCancelling}
                          title="Cancel scheduled game"
                          className="rounded-md border border-slate-600 bg-slate-800 p-1.5 text-slate-400 hover:border-red-500/50 hover:bg-red-950/30 hover:text-red-400 transition-colors disabled:opacity-50 self-center"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* AI SUGGEST MODE */}
      {/* ================================================================= */}
      {mode === 'ai-suggest' && (
        <div className="space-y-4">
          {/* Get Suggestions button */}
          {suggestions.length === 0 && !suggestLoading && (
            <div className="flex flex-col items-center justify-center py-10">
              <Sparkles className="h-12 w-12 text-purple-400/40 mb-3" />
              <p className="text-sm text-slate-400 mb-4 text-center">
                AI will analyze upcoming games and suggest the best cable box and TV assignments.
              </p>
              <button
                type="button"
                onClick={fetchSuggestions}
                className="flex items-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white py-3 px-6 text-sm font-medium transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Get Suggestions
              </button>
              {suggestError && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-400 max-w-md text-center">
                  {suggestError}
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {suggestLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-purple-400 animate-spin mb-3" />
              <p className="text-sm text-slate-400">
                AI is analyzing games and generating suggestions...
              </p>
              <p className="text-xs text-slate-500 mt-1">
                This may take up to 30 seconds
              </p>
            </div>
          )}

          {/* Suggestion cards */}
          {suggestions.length > 0 && !suggestLoading && (
            <div className="space-y-3">
              {/* Error/Success banner */}
              {suggestError && (
                <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-400 flex items-center justify-between">
                  <span>{suggestError}</span>
                  <button type="button" onClick={() => setSuggestError(null)} className="text-red-400 hover:text-red-300">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} found
                </p>
                <button
                  type="button"
                  onClick={fetchSuggestions}
                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Re-analyze
                </button>
              </div>

              {suggestions.map((suggestion) => {
                const isSkipped = skippedIds.has(suggestion.gameId)
                const isApproved = approvedIds.has(suggestion.gameId)
                const isApproving = approvingId === suggestion.gameId
                const isModifying = modifyingId === suggestion.gameId
                const confidencePct = Math.round(suggestion.confidence * 100)

                if (isSkipped) return null

                return (
                  <div
                    key={suggestion.gameId}
                    className={`rounded-lg border p-4 space-y-3 transition-colors ${
                      isApproved
                        ? 'bg-green-950/20 border-green-500/30'
                        : 'bg-slate-800/50 border-slate-700'
                    }`}
                  >
                    {/* Game info row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center bg-slate-700 text-slate-300 rounded-full px-2 py-0.5 text-xs">
                            {suggestion.league}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              confidencePct >= 80
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : confidencePct >= 50
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {confidencePct}% confidence
                          </span>
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                              <Check className="h-3 w-3" /> Approved
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-white">
                          {suggestion.awayTeam} @ {suggestion.homeTeam}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(suggestion.startTime)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Tv className="h-3 w-3" />
                            Ch {suggestion.channelNumber}
                            {suggestion.channelName ? ` (${suggestion.channelName})` : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            {suggestion.suggestedInput}
                          </span>
                          {suggestion.suggestedOutputs.length > 0 && (
                            <span className="text-slate-500">
                              TVs: {(modifyOutputs[suggestion.gameId] ?? suggestion.suggestedOutputs).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Reasoning */}
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {suggestion.reasoning}
                    </p>

                    {/* Modify TV picker inline */}
                    {isModifying && (
                      <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-3 space-y-2">
                        <p className="text-xs text-blue-400 font-medium">
                          Edit TV outputs (comma-separated output numbers):
                        </p>
                        <input
                          type="text"
                          defaultValue={(modifyOutputs[suggestion.gameId] ?? suggestion.suggestedOutputs).join(', ')}
                          onChange={(e) => {
                            const nums = e.target.value
                              .split(',')
                              .map((s) => parseInt(s.trim(), 10))
                              .filter((n) => !isNaN(n))
                            setModifyOutputs((prev) => ({
                              ...prev,
                              [suggestion.gameId]: nums,
                            }))
                          }}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. 1, 2, 5, 8"
                        />
                        <button
                          type="button"
                          onClick={() => setModifyingId(null)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Done
                        </button>
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isApproved && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => approveSuggestion(suggestion)}
                          disabled={isApproving}
                          className="flex items-center gap-1.5 rounded-lg border border-green-600 bg-green-700 hover:bg-green-600 active:bg-green-800 text-white py-2.5 px-4 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {isApproving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          {isApproving ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setModifyingId(isModifying ? null : suggestion.gameId)
                          }
                          className="flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-700 hover:bg-blue-600 active:bg-blue-800 text-white py-2.5 px-4 text-sm font-medium transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                          Modify
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSkippedIds((prev) => new Set(prev).add(suggestion.gameId))
                          }
                          className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 px-4 text-sm font-medium transition-colors"
                        >
                          <SkipForward className="h-4 w-4" />
                          Skip
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Approve All button */}
              {suggestions.some(
                (s) => !skippedIds.has(s.gameId) && !approvedIds.has(s.gameId)
              ) && (
                <button
                  type="button"
                  onClick={approveAll}
                  disabled={approvingAll}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-green-600 bg-green-700 hover:bg-green-600 active:bg-green-800 text-white py-3 px-4 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {approvingAll ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4" />
                  )}
                  {approvingAll ? 'Approving All...' : 'Approve All'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* AUTO-PILOT MODE */}
      {/* ================================================================= */}
      {mode === 'auto-pilot' && (
        <div className="space-y-4">
          {/* ---- TV Output Allow List ---- */}
          <div className="bg-cyan-500/5 border border-cyan-400/30 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOutputSelection(!showOutputSelection)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-cyan-400" />
                <span className="font-medium text-white text-sm">Allowed TV Outputs</span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  {allowedOutputs.size} of {outputs.length} selected
                </span>
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
                  <button
                    type="button"
                    onClick={() => setAllowedOutputs(new Set(outputs.map((o) => o.channelNumber)))}
                    className="rounded-md border border-slate-600 bg-slate-800 py-2 px-3 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedOutputs(new Set())}
                    className="rounded-md border border-slate-600 bg-slate-800 py-2 px-3 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    None
                  </button>
                </div>

                {outputsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {filteredOutputs.map((output) => (
                      <button
                        key={output.id}
                        type="button"
                        onClick={() => toggleOutput(output.channelNumber)}
                        className={`p-2.5 rounded-lg text-left transition-all border ${
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
                  <p className="text-sm text-slate-500 text-center py-4">No TVs match your search</p>
                )}
              </div>
            )}
          </div>

          {/* ---- Input Source Allow List ---- */}
          <div className="bg-purple-500/5 border border-purple-400/30 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowInputSelection(!showInputSelection)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Cable className="w-5 h-5 text-purple-400" />
                <span className="font-medium text-white text-sm">Allowed Input Sources</span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  {allowedInputs.size} of {inputs.length} selected
                </span>
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
                  <button
                    type="button"
                    onClick={() => setAllowedInputs(new Set(inputs.map((i) => i.channelNumber)))}
                    className="rounded-md border border-slate-600 bg-slate-800 py-2 px-3 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedInputs(new Set())}
                    className="rounded-md border border-slate-600 bg-slate-800 py-2 px-3 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    None
                  </button>
                </div>

                {inputsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {filteredInputs.map((input) => (
                      <button
                        key={input.id}
                        type="button"
                        onClick={() => toggleInput(input.channelNumber)}
                        className={`p-2.5 rounded-lg text-left transition-all border ${
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
                  <p className="text-sm text-slate-500 text-center py-4">No inputs match your search</p>
                )}
              </div>
            )}
          </div>

          {/* ---- Run / Stop Auto-Pilot ---- */}
          {!autoPilotRunning ? (
            <button
              type="button"
              onClick={runAutoPilot}
              disabled={autoPilotLoading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-500 active:bg-green-700 text-white py-3 px-4 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {autoPilotLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {autoPilotLoading ? 'Running Auto-Pilot...' : 'Run Auto-Pilot'}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopAutoPilot}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white py-3 px-4 text-sm font-medium transition-colors"
            >
              <StopCircle className="h-4 w-4" />
              Stop Auto-Pilot
            </button>
          )}

          {/* Auto-Pilot error */}
          {autoPilotError && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-400 flex items-center justify-between">
              <span>{autoPilotError}</span>
              <button type="button" onClick={() => setAutoPilotError(null)} className="text-red-400 hover:text-red-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Auto-Pilot success */}
          {autoPilotSuccess && (
            <div className="rounded-lg border border-green-500/30 bg-green-950/30 p-3 text-sm text-green-400 flex items-center justify-between">
              <span>{autoPilotSuccess}</span>
              <button type="button" onClick={() => setAutoPilotSuccess(null)} className="text-green-400 hover:text-green-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Auto-Pilot loading spinner */}
          {autoPilotLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 text-green-400 animate-spin mb-3" />
              <p className="text-sm text-slate-400">Running AI Game Plan...</p>
            </div>
          )}

          {/* Auto-Pilot results */}
          {autoPilotRunning && autoPilotData && (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-3">
                  <div className="text-2xl font-bold text-blue-400">{autoPilotData.summary.totalGames}</div>
                  <div className="text-xs text-slate-400">Total Games</div>
                </div>
                <div className="bg-purple-500/10 border border-purple-400/30 rounded-xl p-3">
                  <div className="text-2xl font-bold text-purple-400">{autoPilotData.summary.homeTeamGames}</div>
                  <div className="text-xs text-slate-400">Home Team</div>
                </div>
                <div className="bg-orange-500/10 border border-orange-400/30 rounded-xl p-3">
                  <div className="text-2xl font-bold text-orange-400">{autoPilotData.summary.upcomingCount || 0}</div>
                  <div className="text-xs text-slate-400">Upcoming</div>
                </div>
                <div className="bg-green-500/10 border border-green-400/30 rounded-xl p-3">
                  <div className="text-2xl font-bold text-green-400">{autoPilotData.channelsSet}</div>
                  <div className="text-xs text-slate-400">Channels Set</div>
                </div>
              </div>

              {/* Leagues */}
              {autoPilotData.summary.leagues.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {autoPilotData.summary.leagues.map((league, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600"
                    >
                      {league}
                    </span>
                  ))}
                </div>
              )}

              {/* Available Games */}
              {autoPilotData.upcomingGames && autoPilotData.upcomingGames.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-400" />
                    Available Games Today ({autoPilotData.upcomingGames.length})
                  </h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {autoPilotData.upcomingGames.slice(0, 20).map((game: any, index: number) => {
                      const gameId = game.id || `${game.homeTeam}-${game.awayTeam}`
                      return (
                        <div
                          key={index}
                          className={`rounded-lg border p-3 ${
                            game.isHomeTeamGame
                              ? 'border-yellow-400/50 bg-yellow-500/5'
                              : game.liveData?.isLive
                              ? 'border-green-400/50 bg-green-500/5'
                              : 'border-slate-700 bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {game.isHomeTeamGame && <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                                <span className="text-sm font-medium text-white">
                                  {game.homeTeam} vs {game.awayTeam}
                                </span>
                                {game.liveData?.isLive && (
                                  <span className="px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded uppercase animate-pulse">
                                    LIVE
                                  </span>
                                )}
                              </div>
                              {/* Score display */}
                              {game.liveData && (game.liveData.isLive || game.liveData.isCompleted) && (
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-sm font-bold ${game.liveData.homeScore > game.liveData.awayScore ? 'text-green-400' : 'text-white'}`}>
                                    {game.liveData.homeAbbrev || game.homeTeam.split(' ').pop()}: {game.liveData.homeScore}
                                  </span>
                                  <span className="text-slate-500">-</span>
                                  <span className={`text-sm font-bold ${game.liveData.awayScore > game.liveData.homeScore ? 'text-green-400' : 'text-white'}`}>
                                    {game.liveData.awayAbbrev || game.awayTeam.split(' ').pop()}: {game.liveData.awayScore}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {game.league}
                                </span>
                                {!game.liveData?.isLive && game.gameTime && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {game.gameTime}
                                  </span>
                                )}
                                {game.channelNumber && (
                                  <span className="flex items-center gap-1">
                                    <Tv className="w-3 h-3" />
                                    Ch {game.channelNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Schedule button */}
                            <button
                              type="button"
                              onClick={() => handleScheduleGame(game)}
                              disabled={schedulingGameId === gameId || !game.channelNumber}
                              className={`flex-shrink-0 flex items-center gap-1.5 rounded-lg py-2.5 px-4 text-sm font-medium transition-colors ${
                                !game.channelNumber
                                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                  : 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white'
                              } disabled:opacity-50`}
                            >
                              {schedulingGameId === gameId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                              {schedulingGameId === gameId ? 'Scheduling...' : 'Schedule'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {autoPilotData.upcomingGames.length > 20 && (
                    <p className="text-xs text-slate-500 text-center">
                      Showing 20 of {autoPilotData.upcomingGames.length} upcoming games
                    </p>
                  )}
                </div>
              )}

              {/* Currently Tuned */}
              {autoPilotData.gamesByInput &&
                Object.keys(autoPilotData.gamesByInput).filter((k) => k !== 'Unassigned').length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Tv className="h-4 w-4 text-blue-400" />
                      Currently Tuned on TVs
                    </h4>
                    {Object.entries(autoPilotData.gamesByInput)
                      .filter(([label]) => label !== 'Unassigned')
                      .map(([inputLabel, inputGames]) => (
                        <div key={inputLabel} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white flex items-center gap-2">
                              <Tv className="h-3.5 w-3.5 text-purple-400" />
                              {inputLabel}
                            </span>
                            <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-400/30">
                              {inputGames.length} {inputGames.length === 1 ? 'game' : 'games'}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {inputGames.map((game: any, idx: number) => (
                              <div
                                key={idx}
                                className={`rounded-lg border p-2.5 text-xs ${
                                  game.isHomeTeamGame
                                    ? 'border-yellow-400/50 bg-yellow-500/5'
                                    : game.liveData?.isLive
                                    ? 'border-green-400/50 bg-green-500/5'
                                    : 'border-slate-600 bg-slate-800/30'
                                }`}
                              >
                                <span className="text-sm text-white font-medium">
                                  {game.homeTeam} vs {game.awayTeam}
                                </span>
                                {game.liveData?.isLive && (
                                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded uppercase animate-pulse">
                                    LIVE
                                  </span>
                                )}
                                <div className="flex items-center gap-2 text-slate-400 mt-1">
                                  <span>{game.league}</span>
                                  {game.channelNumber && <span>Ch {game.channelNumber}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
            </div>
          )}
        </div>
      )}
      {/* Default Source Configuration */}
      <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDefaults(!showDefaults)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
        >
          <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-400" />
            Default Sources (When No Games Scheduled)
          </h3>
          <span className="text-slate-500 text-sm">{showDefaults ? '▲ Hide' : '▼ Show'}</span>
        </button>
        {showDefaults && (
          <div className="border-t border-slate-700 p-4" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <DefaultSourceSettings />
          </div>
        )}
      </div>
    </div>
  )
}
