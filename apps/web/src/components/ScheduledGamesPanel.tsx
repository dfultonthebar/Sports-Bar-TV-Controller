'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, Tv, RefreshCw, X, Monitor } from 'lucide-react'
import ScheduledGameTVPicker from './ScheduledGameTVPicker'
import { logger } from '@sports-bar/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduledGame {
  id: string
  inputSourceId: string
  inputLabel: string
  deviceType: string
  channelNumber: string
  gameId: string
  homeTeam: string
  awayTeam: string
  league: string
  tuneAt: string
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  tvOutputIds: number[]
}

interface CableBoxChannel {
  channelNumber: string
  channelName: string | null
  deviceType: string
  inputLabel: string
  lastTuned: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO timestamp to local time, e.g. "12:00 PM" */
function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScheduledGamesPanel() {
  const [games, setGames] = useState<ScheduledGame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cableBoxChannels, setCableBoxChannels] = useState<Record<string, CableBoxChannel>>({})

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
  // Fetch schedule
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

  // Initial fetch + auto-refresh every 30 seconds
  useEffect(() => {
    fetchSchedule()
    fetchCableBoxChannels()
    const interval = setInterval(() => {
      fetchSchedule()
      fetchCableBoxChannels()
    }, 30_000)
    return () => clearInterval(interval)
  }, [fetchSchedule, fetchCableBoxChannels])

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
  // Handle TV picker updates (optimistic local state)
  // -----------------------------------------------------------------------

  const handleTVUpdate = useCallback((id: string, outputIds: number[]) => {
    setGames((prev) =>
      prev.map((g) => (g.id === id ? { ...g, tvOutputIds: outputIds } : g))
    )
  }, [])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-4">
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

      {/* Cable Box Status Cards */}
      {Object.keys(cableBoxChannels).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(cableBoxChannels)
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

            return (
              <div
                key={game.id}
                className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 flex items-start gap-4"
              >
                {/* Left: Time & status dot */}
                <div className="flex flex-col items-center gap-1 min-w-[64px] pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor} ${
                        game.status === 'active' ? 'animate-pulse' : ''
                      }`}
                    />
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <span className="text-sm font-medium text-white whitespace-nowrap">
                    {formatTime(game.tuneAt)}
                  </span>
                  <span
                    className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight ${badge.classes}`}
                  >
                    {badge.label}
                  </span>
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
                </div>

                {/* Right: Cancel button (pending only) */}
                <div className="flex-shrink-0">
                  {isPending && (
                    <button
                      type="button"
                      onClick={() => cancelSchedule(game.id)}
                      disabled={isCancelling}
                      title="Cancel scheduled game"
                      className="rounded-md border border-slate-600 bg-slate-800 p-1.5 text-slate-400 hover:border-red-500/50 hover:bg-red-950/30 hover:text-red-400 transition-colors disabled:opacity-50"
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
    </div>
  )
}
