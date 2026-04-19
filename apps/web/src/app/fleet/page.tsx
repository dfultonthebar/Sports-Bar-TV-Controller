'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, CheckCircle, Clock, GitBranch, GitCommit, RefreshCw, XCircle, HelpCircle, Loader2 } from 'lucide-react'

interface FleetLocation {
  branch: string
  displayName: string
  version: string | null
  versionsBehind: number | null
  lastCommitTimestamp: number
  lastCommitDate: string
  lastCommitSubject: string
  commitsBehindMain: number
  commitsAheadOfMain: number
  lastAutoUpdateTimestamp: number | null
  lastAutoUpdateDate: string | null
  staleness: 'healthy' | 'warning' | 'stuck' | 'unknown'
  stalenessReason: string
  heartbeat?: {
    successAtUnix: number
    runId: string
    verifyInstallStatus: string | null
    verifyInstallPassed: number | null
    verifyInstallTotal: number | null
  } | null
}

interface FleetStatus {
  locations: FleetLocation[]
  mainVersion: string | null
  mainLastCommitTimestamp: number
  mainLastCommitSubject: string
  generatedAt: string
  fromCache: boolean
  refreshedSecondsAgo: number
}

function timeAgo(ts: number): string {
  if (!ts || ts <= 0) return 'never'
  const now = Date.now() / 1000
  const diff = now - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  return `${days}d ago`
}

const STALENESS_STYLES: Record<FleetLocation['staleness'], { border: string; bg: string; badge: string; icon: JSX.Element; label: string }> = {
  healthy: {
    border: 'border-emerald-500/30',
    bg: 'bg-slate-800/50',
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'Healthy',
  },
  warning: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/20',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'Warning',
  },
  stuck: {
    border: 'border-red-500/40',
    bg: 'bg-red-950/20',
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <XCircle className="h-4 w-4" />,
    label: 'Stuck',
  },
  unknown: {
    border: 'border-slate-500/30',
    bg: 'bg-slate-800/30',
    badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    icon: <HelpCircle className="h-4 w-4" />,
    label: 'Unknown',
  },
}

export default function FleetDashboardPage() {
  const [status, setStatus] = useState<FleetStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (force = false) => {
    setError(null)
    if (force) setRefreshing(true)
    try {
      const res = await fetch(`/api/fleet/status${force ? '?refresh=1' : ''}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      setStatus(await res.json())
    } catch (err: any) {
      setError(err.message || 'Failed to load fleet status')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(false)
  }, [load])

  const stuckCount = status?.locations.filter(l => l.staleness === 'stuck').length ?? 0
  const warningCount = status?.locations.filter(l => l.staleness === 'warning').length ?? 0
  const healthyCount = status?.locations.filter(l => l.staleness === 'healthy').length ?? 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-sky-400" />
              Fleet Dashboard
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Per-location version + update status. Data from the shared git history — each
              location pushes its auto-update merges to GitHub, so stalls show up here even if a
              location&apos;s own server is unreachable.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>{refreshing ? 'Fetching…' : 'Refresh'}</span>
          </button>
        </div>

        {/* Top summary row */}
        {status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 flex items-center gap-3">
              <GitCommit className="h-6 w-6 text-sky-400" />
              <div>
                <p className="text-xs text-slate-400">Main version</p>
                <p className="text-lg font-semibold text-white">{status.mainVersion ?? '?'}</p>
              </div>
            </div>
            <div className="rounded-lg bg-red-950/30 border border-red-500/40 p-4 flex items-center gap-3">
              <XCircle className="h-6 w-6 text-red-400" />
              <div>
                <p className="text-xs text-slate-400">Stuck</p>
                <p className="text-lg font-semibold text-red-300">{stuckCount}</p>
              </div>
            </div>
            <div className="rounded-lg bg-amber-950/20 border border-amber-500/30 p-4 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
              <div>
                <p className="text-xs text-slate-400">Warning</p>
                <p className="text-lg font-semibold text-amber-300">{warningCount}</p>
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-emerald-500/30 p-4 flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-emerald-400" />
              <div>
                <p className="text-xs text-slate-400">Healthy</p>
                <p className="text-lg font-semibold text-emerald-300">{healthyCount}</p>
              </div>
            </div>
          </div>
        )}

        {status && (
          <p className="text-xs text-slate-500 mb-4">
            Snapshot taken {timeAgo(new Date(status.generatedAt).getTime() / 1000)}
            {status.fromCache ? ` (cached ${status.refreshedSecondsAgo}s)` : ' (live fetch)'} ·
            main is at {status.mainVersion ?? '?'} (last commit {timeAgo(status.mainLastCommitTimestamp)})
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-950/30 border border-red-500/40 p-4 mb-4 text-red-300 text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !status && (
          <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-6 text-slate-400 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Fetching fleet status (runs git fetch +
            per-branch probes, ~3-5s on first load)…
          </div>
        )}

        {/* Location cards */}
        {status && (
          <div className="space-y-3">
            {status.locations.map(loc => {
              const style = STALENESS_STYLES[loc.staleness]
              return (
                <div key={loc.branch} className={`rounded-lg border ${style.border} ${style.bg} p-5`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        {loc.displayName}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border ${style.badge}`}>
                          {style.icon} {style.label}
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 font-mono">{loc.branch}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Version</p>
                      <p className="text-lg font-semibold text-white">{loc.version ?? '?'}</p>
                      {loc.version && status.mainVersion && loc.version !== status.mainVersion && (
                        <p className="text-xs text-amber-400 mt-0.5">
                          main {status.mainVersion}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 mb-3">
                    <span className="text-slate-500">Status: </span>
                    {loc.stalenessReason}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500">Last commit</p>
                      <p className="text-slate-200 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {timeAgo(loc.lastCommitTimestamp)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Behind main</p>
                      <p className="text-slate-200">{loc.commitsBehindMain} commits</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Ahead of main</p>
                      <p className="text-slate-200">{loc.commitsAheadOfMain} commits</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Last auto-update</p>
                      <p className="text-slate-200">
                        {loc.lastAutoUpdateTimestamp ? timeAgo(loc.lastAutoUpdateTimestamp) : 'never seen'}
                      </p>
                    </div>
                  </div>

                  {loc.lastCommitSubject && (
                    <p className="text-xs text-slate-500 mt-3 font-mono truncate">
                      <span className="text-slate-600">&rarr; </span>
                      {loc.lastCommitSubject}
                    </p>
                  )}

                  {loc.heartbeat && loc.heartbeat.successAtUnix > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                      <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                        <span className="text-emerald-400 font-medium">✓ Last verified-good</span>
                        <span>{timeAgo(loc.heartbeat.successAtUnix)}</span>
                        {loc.heartbeat.verifyInstallStatus && (
                          <span>
                            · verify-install:
                            <span className={loc.heartbeat.verifyInstallStatus === 'PASS' ? 'text-emerald-300 ml-1' : 'text-rose-300 ml-1'}>
                              {loc.heartbeat.verifyInstallStatus}
                              {loc.heartbeat.verifyInstallPassed !== null && loc.heartbeat.verifyInstallTotal !== null && (
                                <span> {loc.heartbeat.verifyInstallPassed}/{loc.heartbeat.verifyInstallTotal}</span>
                              )}
                            </span>
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
            {status.locations.length === 0 && (
              <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-6 text-slate-400 text-sm text-center">
                No location branches found under <code>origin/location/*</code>.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
