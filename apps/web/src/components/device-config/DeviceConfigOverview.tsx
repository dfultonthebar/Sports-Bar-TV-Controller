'use client'

/**
 * Device Config Overview tab — the default landing for /device-config.
 *
 * Shows operators what's connected, what's broken, and what just
 * happened (the three questions they actually open this page to
 * answer). Replaces "Channel Presets" as the default tab so the first
 * thing an operator sees is "status of my bar" instead of "configure
 * channel shortcuts".
 *
 * Pulls from existing endpoints in parallel — no new server work:
 *   GET  /api/audio-processor       — Atlas/DBX/BSS/Shure list
 *   GET  /api/firetv-devices        — Fire TV list
 *   GET  /api/directv-devices       — DirecTV list
 *   GET  /api/atlas-drops?limit=10  — recent unexplained zone drops
 *   GET  /api/atlas-priority?limit=10 — recent priority events
 *   GET  /api/shure-rf?limit=10     — recent RF events
 *   GET  /api/system/version        — version + branch + uptime
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Tv,
  Volume2,
  Radio,
  Satellite,
  MonitorPlay,
  Clock,
  ExternalLink,
  RefreshCw,
  Mic2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'

interface DeviceCount {
  total: number
  online: number
  offline: number
}

interface OverviewState {
  audioProcessors: { type: string; name: string; status: string; ipAddress: string }[]
  firetv: DeviceCount
  directv: DeviceCount
  atlasDrops: { total: number; silent: number; latestIso: string | null }
  atlasPriority: { active: boolean; rfInduced: number; latestIso: string | null }
  shureRf: { interference: number; lowBattery: number; latestIso: string | null }
  version: string
  uptimeSecs: number
  buildDate: string | null
  loading: boolean
}

const EMPTY: OverviewState = {
  audioProcessors: [],
  firetv: { total: 0, online: 0, offline: 0 },
  directv: { total: 0, online: 0, offline: 0 },
  atlasDrops: { total: 0, silent: 0, latestIso: null },
  atlasPriority: { active: false, rfInduced: 0, latestIso: null },
  shureRf: { interference: 0, lowBattery: 0, latestIso: null },
  version: '',
  uptimeSecs: 0,
  buildDate: null,
  loading: true,
}

function tally(arr: any[]): DeviceCount {
  const online = arr.filter((d) => d.isOnline ?? d.status === 'online').length
  return { total: arr.length, online, offline: arr.length - online }
}

function relativeAgo(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function fmtUptime(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`
}

interface OverviewProps {
  onJumpToTab?: (tab: string) => void
}

export default function DeviceConfigOverview({ onJumpToTab }: OverviewProps) {
  const [state, setState] = useState<OverviewState>(EMPTY)

  const fetchAll = useCallback(async () => {
    try {
      const [audio, fire, dtv, drops, priority, rf, ver] = await Promise.all([
        fetch('/api/audio-processor').then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/firetv-devices').then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/directv-devices').then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/atlas-drops?limit=50').then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/atlas-priority?limit=50').then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/shure-rf?limit=50').then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/system/version').then((r) => r.ok ? r.json() : null).catch(() => null),
      ])

      const processorList = (audio?.processors || []).map((p: any) => ({
        type: p.processorType || 'unknown',
        name: p.name,
        status: p.status,
        ipAddress: p.ipAddress,
      }))

      const dropsList = drops?.drops || []
      const silentDrops = dropsList.filter((d: any) => !d.explained).length
      const priorityEvents = priority?.events || []
      const priorityRfInduced = priorityEvents.filter((e: any) =>
        e.event_type === 'rf_induced_mic_active'
      ).length
      const rfEvents = rf?.events || []
      const rfInterference = rfEvents.filter((e: any) =>
        e.event_type === 'rf_interference' || e.event_type === 'rf_interference_heartbeat'
      ).length
      const lowBattery = rfEvents.filter((e: any) => e.event_type === 'low_battery').length

      setState({
        audioProcessors: processorList,
        firetv: tally(fire?.devices || []),
        directv: tally(dtv?.devices || []),
        atlasDrops: {
          total: dropsList.length,
          silent: silentDrops,
          latestIso: dropsList[0]?.detected_at_iso || null,
        },
        atlasPriority: {
          active: !!priority?.active,
          rfInduced: priorityRfInduced,
          latestIso: priorityEvents[0]?.detected_at_iso || null,
        },
        shureRf: {
          interference: rfInterference,
          lowBattery,
          latestIso: rfEvents[0]?.detected_at_iso || null,
        },
        version: ver?.version || '?',
        uptimeSecs: ver?.uptimeSecs || 0,
        buildDate: ver?.buildDate || null,
        loading: false,
      })
    } catch {
      setState((p) => ({ ...p, loading: false }))
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 10_000)
    return () => clearInterval(id)
  }, [fetchAll])

  // Surface alerts only when there's actually something to surface —
  // empty days should look healthy, not noisy. Operator should be able
  // to tell at a glance: green = nothing to do.
  const alerts: Array<{ severity: 'warn' | 'error'; text: string; tab?: string }> = []
  if (state.atlasDrops.silent > 0) {
    alerts.push({
      severity: 'warn',
      text: `${state.atlasDrops.silent} unexplained Atlas zone drop${state.atlasDrops.silent > 1 ? 's' : ''} in the last 50 events`,
    })
  }
  if (state.atlasPriority.active) {
    alerts.push({
      severity: 'warn',
      text: 'Atlas priority bus is currently active (mic / page / juke box)',
    })
  }
  if (state.atlasPriority.rfInduced > 0) {
    alerts.push({
      severity: 'warn',
      text: `${state.atlasPriority.rfInduced} priority event${state.atlasPriority.rfInduced > 1 ? 's' : ''} labeled RF-induced — Shure interference triggered the Atlas`,
      tab: 'shure-mics',
    })
  }
  if (state.shureRf.interference > 0) {
    alerts.push({
      severity: 'warn',
      text: `${state.shureRf.interference} Shure RF interference event${state.shureRf.interference > 1 ? 's' : ''} in the last 50`,
      tab: 'shure-mics',
    })
  }
  if (state.shureRf.lowBattery > 0) {
    alerts.push({
      severity: 'warn',
      text: `${state.shureRf.lowBattery} low-battery event${state.shureRf.lowBattery > 1 ? 's' : ''} on a wireless mic`,
      tab: 'shure-mics',
    })
  }
  if (state.firetv.offline > 0) {
    alerts.push({
      severity: 'error',
      text: `${state.firetv.offline} Fire TV device${state.firetv.offline > 1 ? 's' : ''} offline`,
      tab: 'firetv',
    })
  }
  if (state.directv.offline > 0) {
    alerts.push({
      severity: 'error',
      text: `${state.directv.offline} DirecTV receiver${state.directv.offline > 1 ? 's' : ''} offline`,
      tab: 'directv',
    })
  }

  if (state.loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alerts strip — only renders when there's something to flag.
          Operators get an empty area when the bar is healthy, which is
          itself useful information. */}
      {alerts.length === 0 ? (
        <div className="rounded-xl border border-green-500/30 bg-green-950/20 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div className="text-sm text-green-300">
            All systems normal. No recent alerts.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`rounded-xl border px-4 py-2.5 flex items-center gap-3 ${
                a.severity === 'error'
                  ? 'border-red-500/40 bg-red-950/30'
                  : 'border-amber-500/40 bg-amber-950/30'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${a.severity === 'error' ? 'text-red-400' : 'text-amber-400'}`} />
              <div className={`text-sm flex-1 ${a.severity === 'error' ? 'text-red-200' : 'text-amber-200'}`}>
                {a.text}
              </div>
              {a.tab && onJumpToTab && (
                <button
                  type="button"
                  onClick={() => onJumpToTab(a.tab!)}
                  className="text-xs text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
                >
                  View <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Device count grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Volume2 className="w-4 h-4" />}
          label="Audio Processors"
          color="teal"
          primary={`${state.audioProcessors.filter((p) => p.status === 'online').length}/${state.audioProcessors.length}`}
          subline={state.audioProcessors.map((p) => p.type).join(', ') || 'None configured'}
        />
        <StatCard
          icon={<Mic2 className="w-4 h-4" />}
          label="Wireless Mics"
          color="cyan"
          primary={`${state.audioProcessors.filter((p) => p.type === 'shure-slxd').length}`}
          subline={
            state.shureRf.interference > 0 || state.shureRf.lowBattery > 0
              ? `${state.shureRf.interference} RF · ${state.shureRf.lowBattery} battery`
              : 'Quiet'
          }
          onClick={onJumpToTab ? () => onJumpToTab('shure-mics') : undefined}
        />
        <StatCard
          icon={<MonitorPlay className="w-4 h-4" />}
          label="Fire TV"
          color={state.firetv.offline > 0 ? 'red' : 'blue'}
          primary={`${state.firetv.online}/${state.firetv.total}`}
          subline={state.firetv.offline > 0 ? `${state.firetv.offline} offline` : 'all online'}
          onClick={onJumpToTab ? () => onJumpToTab('firetv') : undefined}
        />
        <StatCard
          icon={<Satellite className="w-4 h-4" />}
          label="DirecTV"
          color={state.directv.offline > 0 ? 'red' : 'blue'}
          primary={`${state.directv.online}/${state.directv.total}`}
          subline={state.directv.offline > 0 ? `${state.directv.offline} offline` : 'all online'}
          onClick={onJumpToTab ? () => onJumpToTab('directv') : undefined}
        />
      </div>

      {/* Recent activity timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-cyan-400" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityRow
            label="Atlas zone drops (silent)"
            value={state.atlasDrops.silent}
            latest={state.atlasDrops.latestIso}
            hint="Atlas zones whose volume crashed without a command from us — firmware override, scene recall, or priority bus"
          />
          <ActivityRow
            label="Atlas priority events"
            value={state.atlasPriority.rfInduced > 0
              ? `${state.atlasPriority.rfInduced} RF-induced`
              : (state.atlasPriority.active ? 'active' : 'none recent')}
            latest={state.atlasPriority.latestIso}
            hint="Mic/page/jukebox triggered the priority bus; RF-induced means a Shure interference event matched"
          />
          <ActivityRow
            label="Shure RF interference"
            value={state.shureRf.interference}
            latest={state.shureRf.latestIso}
            hint="Ghost-carrier detected on a wireless mic frequency (TX off + RSSI ≥ -85 dBm)"
            isLast
          />
        </CardContent>
      </Card>

      {/* Audio processors detail */}
      {state.audioProcessors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Volume2 className="w-4 h-4 text-teal-400" />
              Audio Processors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {state.audioProcessors.map((p) => (
                <div key={`${p.name}-${p.ipAddress}`} className="flex items-center gap-3 text-sm">
                  {p.status === 'online'
                    ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                  <span className="text-slate-200 truncate flex-1">{p.name}</span>
                  <span className="text-xs text-slate-500 font-mono">{p.type}</span>
                  <span className="text-xs text-slate-500 font-mono">{p.ipAddress}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System info footer */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-400">
        <div>
          <span className="text-slate-500">Version:</span>{' '}
          <span className="font-mono text-slate-300">v{state.version}</span>
        </div>
        <div>
          <span className="text-slate-500">Uptime:</span>{' '}
          <span className="font-mono text-slate-300">{fmtUptime(state.uptimeSecs)}</span>
        </div>
        <div>
          <span className="text-slate-500">Build:</span>{' '}
          <span className="font-mono text-slate-300">{state.buildDate ? new Date(state.buildDate).toLocaleString() : '—'}</span>
        </div>
        <div className="ml-auto inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Refreshes every 10s</span>
        </div>
      </div>
    </div>
  )
}

// ---- presentational helpers ----

function StatCard({
  icon,
  label,
  primary,
  subline,
  color,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  primary: string
  subline: string
  color: 'teal' | 'cyan' | 'blue' | 'red'
  onClick?: () => void
}) {
  const accent = {
    teal: 'border-teal-500/30 bg-teal-950/20 text-teal-400',
    cyan: 'border-cyan-500/30 bg-cyan-950/20 text-cyan-400',
    blue: 'border-blue-500/30 bg-blue-950/20 text-blue-400',
    red:  'border-red-500/40  bg-red-950/30  text-red-400',
  }[color]
  const interactive = onClick ? 'cursor-pointer hover:border-slate-600 transition-colors' : ''
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-slate-800/50 border-slate-700 p-4 ${interactive}`}
    >
      <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded text-xs ${accent}`}>
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-white mt-2 font-mono">{primary}</div>
      <div className="text-xs text-slate-400 mt-0.5 truncate">{subline}</div>
    </div>
  )
}

function ActivityRow({
  label,
  value,
  latest,
  hint,
  isLast,
}: {
  label: string
  value: number | string
  latest: string | null
  hint: string
  isLast?: boolean
}) {
  return (
    <div className={`py-2 ${isLast ? '' : 'border-b border-slate-700/40'}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-slate-200">{label}</span>
        <div className="text-right">
          <span className="text-sm font-mono text-cyan-300">{value}</span>
          <span className="text-xs text-slate-500 ml-2">{relativeAgo(latest)}</span>
        </div>
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>
    </div>
  )
}
