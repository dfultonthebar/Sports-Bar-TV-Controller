'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Tv,
  Play,
  Clock,
  Radio,
  Smartphone,
} from 'lucide-react'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'

// ── Types ──────────────────────────────────────────────────────────────

interface DashboardGame {
  league: string
  homeTeam: string
  awayTeam: string
  homeAbbrev: string
  awayAbbrev: string
  homeScore: number | null
  awayScore: number | null
  clock: string
  period: number
  statusDetail: string
  statusState: string
  isLive: boolean
  isCompleted: boolean
  startTime: string
  gameTime: string
  minutesUntilStart: number
  networks: string[]
  primaryNetwork: string | null
  direcTVChannel: string | null
  cableChannel: string | null
  streamingApp: { appId: string; name: string; packageName: string } | null
  venue: string
}

interface DashboardData {
  success: boolean
  liveNow: DashboardGame[]
  comingUp: DashboardGame[]
  todaySchedule: DashboardGame[]
  totalGames: number
  fetchedAt: string
  cached?: boolean
  cacheAge?: number
}

interface IRDevice {
  id: string
  name: string
  matrixInput: number
  deviceType: string
  iTachAddress?: string
}

interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  isOnline: boolean
  inputChannel?: number
}

interface FireTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  isOnline: boolean
  inputChannel?: number
}

interface LiveSportsDashboardProps {
  inputs: Array<{ channelNumber: number; label: string; inputType: string }>
  irDevices: IRDevice[]
  direcTVDevices: DirecTVDevice[]
  fireTVDevices: FireTVDevice[]
  selectedInputLabel?: string | null
  selectedDeviceType?: 'cable' | 'satellite' | 'streaming' | null
  onTuneChannel: (channelNumber: string, deviceId: string, deviceType: 'cable' | 'directv') => void
  onLaunchApp: (appId: string, packageName: string, deviceId: string) => void
  onStatusMessage: (message: string) => void
}

// ── Quick-launch app definitions ────────────────────────────────────────

const QUICK_LAUNCH_APPS = [
  { id: 'paramount-live', name: 'Paramount+ Live', packageName: 'com.cbs.ott', color: 'bg-blue-600/20 border-blue-500/30 text-blue-400', special: true },
  { id: 'espn-plus', name: 'ESPN', packageName: 'com.espn.gtv', color: 'bg-red-600/20 border-red-500/30 text-red-400', special: false },
  { id: 'peacock', name: 'Peacock', packageName: 'com.peacocktv.peacockandroid', color: 'bg-yellow-600/20 border-yellow-500/30 text-yellow-400', special: false },
  { id: 'fox-sports', name: 'Fox Sports', packageName: 'com.fox.nowapp', color: 'bg-sky-600/20 border-sky-500/30 text-sky-400', special: false },
  { id: 'youtube-tv', name: 'YouTube TV', packageName: 'com.google.android.youtube.tvunplugged', color: 'bg-red-600/20 border-red-500/30 text-red-300', special: false },
  { id: 'sling-tv', name: 'Sling TV', packageName: 'com.sling', color: 'bg-orange-600/20 border-orange-500/30 text-orange-400', special: false },
]

// ── League colors ───────────────────────────────────────────────────────

const LEAGUE_COLORS: Record<string, string> = {
  'NFL': 'bg-green-500/20 text-green-400 border-green-500/30',
  'NBA': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'MLB': 'bg-red-500/20 text-red-400 border-red-500/30',
  'NHL': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'College Football': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'College Basketball': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  "Women's College Basketball": 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'MLS': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Premier League': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'Champions League': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'Liga MX': 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  'PGA Tour': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'UFC': 'bg-red-600/20 text-red-300 border-red-600/30',
  'Formula 1': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

// ── Component ───────────────────────────────────────────────────────────

export default function LiveSportsDashboard({
  irDevices,
  direcTVDevices,
  fireTVDevices,
  selectedInputLabel,
  selectedDeviceType,
  onTuneChannel,
  onLaunchApp,
  onStatusMessage,
}: LiveSportsDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFullSchedule, setShowFullSchedule] = useState(false)
  const [devicePickerFor, setDevicePickerFor] = useState<{
    type: 'tune' | 'launch'
    channelNumber?: string
    deviceType?: 'cable' | 'directv'
    appId?: string
    packageName?: string
  } | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch('/api/sports-guide/live-dashboard')
      const json = await response.json()
      if (json.success) {
        setData(json)
        setError(null)
      } else {
        setError(json.error || 'Failed to load')
      }
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 90000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  const handleRefresh = () => {
    setLoading(true)
    fetchDashboard()
  }

  // ── Tune channel handler ─────────────────────────────────────────────

  const handleTuneChannel = (channelNumber: string, deviceType: 'cable' | 'directv') => {
    const devices = deviceType === 'cable'
      ? irDevices.filter(d => d.deviceType === 'Cable Box' || d.deviceType === 'CableBox')
      : direcTVDevices

    if (devices.length === 0) {
      onStatusMessage(`No ${deviceType} devices configured`)
      return
    }
    if (devices.length === 1) {
      onTuneChannel(channelNumber, devices[0].id, deviceType)
      return
    }
    // Multiple devices — show picker
    setDevicePickerFor({ type: 'tune', channelNumber, deviceType })
  }

  // ── Launch app handler ────────────────────────────────────────────────

  const handleLaunchApp = (appId: string, packageName: string) => {
    if (fireTVDevices.length === 0) {
      onStatusMessage('No Fire TV devices configured')
      return
    }
    if (fireTVDevices.length === 1) {
      onLaunchApp(appId, packageName, fireTVDevices[0].id)
      return
    }
    setDevicePickerFor({ type: 'launch', appId, packageName })
  }

  // ── Period label helper ───────────────────────────────────────────────

  const getPeriodLabel = (game: DashboardGame): string => {
    if (!game.isLive) return game.statusDetail || game.gameTime
    const league = game.league
    if (league === 'NHL') return `P${game.period}`
    if (league === 'MLB') return game.statusDetail || `Inn ${game.period}`
    if (league === 'MLS' || league === 'Premier League' || league === 'Champions League' || league === 'Liga MX') {
      return game.statusDetail || `${game.clock}'`
    }
    if (league === 'PGA Tour' || league === 'Formula 1' || league === 'UFC') return game.statusDetail || ''
    return `Q${game.period}`
  }

  // ── Filter games by selected device type ─────────────────────────────

  const filterByDeviceType = (games: DashboardGame[]): DashboardGame[] => {
    if (!selectedDeviceType) return games
    return games.filter((game) => {
      if (selectedDeviceType === 'cable') return !!game.cableChannel
      if (selectedDeviceType === 'satellite') return !!game.direcTVChannel
      if (selectedDeviceType === 'streaming') return !!game.streamingApp
      return true
    })
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <RefreshCw className="w-8 h-8 text-blue-400 mx-auto mb-3 animate-spin" />
        <p className="text-slate-400">Loading live sports...</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <p className="text-red-400 mb-3">Failed to load sports data</p>
        <Button onClick={handleRefresh} variant="outline" size="sm" className="border-slate-600">
          Try Again
        </Button>
      </div>
    )
  }

  const liveNow = filterByDeviceType(data?.liveNow || [])
  const comingUp = filterByDeviceType(data?.comingUp || [])
  const todaySchedule = filterByDeviceType(data?.todaySchedule || [])

  return (
    <div className="space-y-4">
      {/* ── Device Picker Popup ─────────────────────────────────────── */}
      {devicePickerFor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDevicePickerFor(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-white font-medium mb-3">
              {devicePickerFor.type === 'tune' ? 'Tune on which device?' : 'Launch on which Fire TV?'}
            </h4>
            <div className="space-y-2">
              {devicePickerFor.type === 'tune' ? (
                devicePickerFor.deviceType === 'cable'
                  ? irDevices.filter(d => d.deviceType === 'Cable Box' || d.deviceType === 'CableBox').map((device) => (
                    <button
                      key={device.id}
                      onClick={() => {
                        onTuneChannel(devicePickerFor.channelNumber!, device.id, devicePickerFor.deviceType!)
                        setDevicePickerFor(null)
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                    >
                      <div className="font-medium">{device.name}</div>
                    </button>
                  ))
                  : direcTVDevices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() => {
                        onTuneChannel(devicePickerFor.channelNumber!, device.id, devicePickerFor.deviceType!)
                        setDevicePickerFor(null)
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                    >
                      <div className="font-medium">{device.name}</div>
                    </button>
                  ))
              ) : (
                fireTVDevices.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => {
                      onLaunchApp(devicePickerFor.appId!, devicePickerFor.packageName!, device.id)
                      setDevicePickerFor(null)
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                  >
                    <div className="font-medium">{device.name}</div>
                    <div className="text-xs text-slate-400">{device.ipAddress}</div>
                  </button>
                ))
              )}
            </div>
            <button onClick={() => setDevicePickerFor(null)} className="mt-3 w-full text-center text-sm text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ SECTION A: Live Now ══════════════ */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <h3 className="text-lg font-bold text-white">
              {liveNow.length > 0 ? `${liveNow.length} LIVE GAME${liveNow.length !== 1 ? 'S' : ''}` : 'NO LIVE GAMES'}
              {selectedInputLabel && (
                <span className="text-sm font-normal text-slate-400 ml-2">on {selectedInputLabel}</span>
              )}
            </h3>
          </div>
          <button onClick={handleRefresh} className="text-slate-400 hover:text-white transition-colors p-1" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {liveNow.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-700">
            {liveNow.map((game, i) => (
              <div key={i} className="flex-shrink-0 w-[280px] snap-start rounded-lg border border-slate-700 bg-slate-800/80 p-3">
                {/* League badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${LEAGUE_COLORS[game.league] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                    {game.league}
                  </span>
                  <span className="text-xs text-red-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    {getPeriodLabel(game)} {game.clock && `- ${game.clock}`}
                  </span>
                </div>

                {/* Scores */}
                <div className="space-y-1 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white font-medium truncate max-w-[180px]">{game.awayAbbrev}</span>
                    <span className="text-lg font-bold text-white">{game.awayScore ?? '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white font-medium truncate max-w-[180px]">{game.homeAbbrev}</span>
                    <span className="text-lg font-bold text-white">{game.homeScore ?? '-'}</span>
                  </div>
                </div>

                {/* Network + Actions */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700">
                  {game.primaryNetwork && (
                    <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">{game.primaryNetwork}</span>
                  )}
                  <div className="flex gap-1 ml-auto">
                    {game.cableChannel && (
                      <button
                        onClick={() => handleTuneChannel(game.cableChannel!, 'cable')}
                        className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 transition-colors"
                      >
                        <Tv className="w-3 h-3 inline mr-1" />Ch {game.cableChannel}
                      </button>
                    )}
                    {!game.cableChannel && game.direcTVChannel && (
                      <button
                        onClick={() => handleTuneChannel(game.direcTVChannel!, 'directv')}
                        className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 transition-colors"
                      >
                        <Tv className="w-3 h-3 inline mr-1" />Ch {game.direcTVChannel}
                      </button>
                    )}
                    {/* v2.32.2 — gate the streaming-app launch button to
                        when a Fire TV is actually the selected input.
                        Operator reported the Apple TV+ / Prime Video buttons
                        appearing on cable-box and DirecTV-selected views;
                        clicking them would launch on the FIRST Fire TV
                        (handleLaunchApp uses fireTVDevices[0]) instead of
                        the input the bartender was actually controlling.
                        Quick-launch only makes sense when the selected
                        input IS a Fire TV. */}
                    {game.streamingApp && selectedDeviceType === 'streaming' && (
                      <button
                        onClick={() => handleLaunchApp(game.streamingApp!.appId, game.streamingApp!.packageName)}
                        className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
                      >
                        <Play className="w-3 h-3 inline mr-1" />{game.streamingApp.name}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No games are live right now. Check Coming Up below.</p>
        )}
      </div>

      {/* ══════════════ SECTION B: Coming Up ══════════════ */}
      {comingUp.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-400 uppercase">Coming Up (Next 2 Hours)</h3>
          </div>
          <div className="space-y-2">
            {comingUp.map((game, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="text-xs text-amber-400 font-mono w-16 flex-shrink-0">{game.gameTime}</span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded border flex-shrink-0 ${LEAGUE_COLORS[game.league] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                  {game.league}
                </span>
                <span className="text-sm text-white truncate flex-1">
                  {game.awayAbbrev} @ {game.homeAbbrev}
                </span>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {game.minutesUntilStart > 0 ? `in ${game.minutesUntilStart}m` : 'soon'}
                </span>
                {game.primaryNetwork && (
                  <span className="text-xs text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded flex-shrink-0">{game.primaryNetwork}</span>
                )}
                <div className="flex gap-1 flex-shrink-0">
                  {game.cableChannel && (
                    <button
                      onClick={() => handleTuneChannel(game.cableChannel!, 'cable')}
                      className="text-xs px-1.5 py-0.5 rounded bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30"
                    >
                      Ch {game.cableChannel}
                    </button>
                  )}
                  {!game.cableChannel && game.direcTVChannel && (
                    <button
                      onClick={() => handleTuneChannel(game.direcTVChannel!, 'directv')}
                      className="text-xs px-1.5 py-0.5 rounded bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30"
                    >
                      Ch {game.direcTVChannel}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ SECTION C: Quick App Launchers ══════════════ */}
      {fireTVDevices.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-slate-300 uppercase">Quick App Launch</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_LAUNCH_APPS.map((app) => (
              <button
                key={app.id}
                onClick={() => {
                  if (app.special && app.id === 'paramount-live') {
                    // Use dedicated Paramount+ Live TV endpoint
                    if (fireTVDevices.length === 1) {
                      handleParamountLive(fireTVDevices[0].id)
                    } else {
                      setDevicePickerFor({ type: 'launch', appId: 'paramount-live', packageName: app.packageName })
                    }
                  } else {
                    handleLaunchApp(app.id, app.packageName)
                  }
                }}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:opacity-80 ${app.color}`}
              >
                {app.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ SECTION D: Full Schedule ══════════════ */}
      {todaySchedule.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
          <button
            onClick={() => setShowFullSchedule(!showFullSchedule)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-400 uppercase">
                Today's Full Schedule ({todaySchedule.length} more)
              </h3>
            </div>
            {showFullSchedule ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showFullSchedule && (
            <div className="mt-3 space-y-1.5">
              {todaySchedule.map((game, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded bg-slate-800/40 text-sm">
                  <span className="text-xs text-slate-500 font-mono w-16 flex-shrink-0">{game.gameTime}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded border flex-shrink-0 ${LEAGUE_COLORS[game.league] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                    {game.league}
                  </span>
                  <span className="text-slate-300 truncate flex-1">{game.awayAbbrev} @ {game.homeAbbrev}</span>
                  {game.primaryNetwork && (
                    <span className="text-xs text-slate-500 flex-shrink-0">{game.primaryNetwork}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      {data && (
        <div className="text-center text-xs text-slate-600">
          Updated {new Date(data.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: HARDWARE_CONFIG.venue.timezone })}
          {data.cached && ` (cached ${data.cacheAge}s ago)`}
          {' · '}Auto-refresh 90s
        </div>
      )}
    </div>
  )

  // ── Paramount+ Live TV special handler ─────────────────────────────

  async function handleParamountLive(deviceId: string) {
    onStatusMessage('Launching Paramount+ Live TV...')
    try {
      const res = await fetch(`/api/firetv-devices/${deviceId}/paramount-live`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        onStatusMessage('Paramount+ Live TV launched')
      } else {
        onStatusMessage(`Failed: ${json.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      onStatusMessage(`Error: ${err.message}`)
    }
  }
}
