'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Clock, Loader2, RefreshCw, XCircle, AlertTriangle, ChevronRight, FileText, GitBranch } from 'lucide-react'

interface StepRecord { name: string; startedAt: string; startedUnix: number; durationMs: number }
interface CheckpointRecord { name: string; decision: string; reason: string; timestamp: string }
interface Run {
  id: string
  filename: string
  startedAt: string
  startedUnix: number
  finishedAt: string | null
  totalDurationMs: number | null
  triggeredBy: string | null
  preMergeBranch: string | null
  preMergeVersion: string | null
  postMergeSha: string | null
  commitsPendingMerge: number | null
  steps: StepRecord[]
  checkpoints: CheckpointRecord[]
  verifyInstallStatus: string | null
  verifyInstallDetail: string | null
  finalResult: 'success' | 'fail' | 'unknown'
  failedStep: string | null
  rollbackTag: string | null
  logLines: number
  fileSizeBytes: number
}

function timeAgo(ts: number): string {
  if (!ts || ts <= 0) return '—'
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`
}

function resultBadge(r: Run['finalResult']): { bg: string; label: string; icon: JSX.Element } {
  switch (r) {
    case 'success': return { bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', label: 'SUCCESS', icon: <CheckCircle className="h-3.5 w-3.5" /> }
    case 'fail':    return { bg: 'bg-red-500/20 text-red-300 border-red-500/30', label: 'FAILED', icon: <XCircle className="h-3.5 w-3.5" /> }
    default:        return { bg: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'UNKNOWN', icon: <AlertTriangle className="h-3.5 w-3.5" /> }
  }
}

function decisionStyle(d: string): string {
  switch (d) {
    case 'GO':      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    case 'CAUTION': return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    case 'STOP':    return 'bg-red-500/20 text-red-300 border-red-500/30'
    default:        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

export default function AutoUpdateHistoryPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/auto-update/runs?limit=30', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRuns(data.runs || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const successCount = runs.filter(r => r.finalResult === 'success').length
  const failCount = runs.filter(r => r.finalResult === 'fail').length
  const totalDurations = runs.filter(r => r.finalResult === 'success' && r.totalDurationMs).map(r => r.totalDurationMs!)
  const medianDuration = totalDurations.sort((a, b) => a - b)[Math.floor(totalDurations.length / 2)] || 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-sky-400" />
              Auto-Update History
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Every scripts/auto-update.sh run on this host, parsed from the local log files. Expand a row to see step timings and Claude checkpoint decisions. A live stream of the currently-running update is at <a className="text-sky-400 hover:underline" href="/auto-update/live">/auto-update/live</a>.
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors text-sm"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/30 border border-red-500/40 p-4 mb-4 text-red-300 text-sm">{error}</div>
        )}

        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4">
              <p className="text-xs text-slate-400">Runs shown</p>
              <p className="text-lg font-semibold text-white">{runs.length}</p>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-emerald-500/30 p-4">
              <p className="text-xs text-slate-400">Succeeded</p>
              <p className="text-lg font-semibold text-emerald-300">{successCount}</p>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-red-500/30 p-4">
              <p className="text-xs text-slate-400">Failed (rolled back)</p>
              <p className="text-lg font-semibold text-red-300">{failCount}</p>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4">
              <p className="text-xs text-slate-400">Median duration (success)</p>
              <p className="text-lg font-semibold text-white">{formatDuration(medianDuration)}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-6 text-slate-400 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Parsing log files…
          </div>
        )}

        {!loading && runs.length === 0 && !error && (
          <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-8 text-slate-400 text-sm text-center">
            No auto-update logs found at <code>/home/ubuntu/sports-bar-data/update-logs/</code>.
          </div>
        )}

        <div className="space-y-2">
          {runs.map(run => {
            const isExpanded = expanded === run.id
            const badge = resultBadge(run.finalResult)
            return (
              <div key={run.id} className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : run.id)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-800 transition-colors"
                >
                  <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border ${badge.bg}`}>
                    {badge.icon} {badge.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-100 font-medium truncate">
                      {run.preMergeVersion ?? '?'}
                      {run.postMergeSha && run.preMergeVersion !== run.postMergeSha && <span className="text-slate-400"> → </span>}
                      <span className="text-slate-400 text-xs font-mono">{run.postMergeSha ? run.postMergeSha.slice(0, 7) : ''}</span>
                      {run.commitsPendingMerge !== null && run.commitsPendingMerge > 0 && <span className="text-slate-500 text-xs ml-2">({run.commitsPendingMerge} commits)</span>}
                      {run.triggeredBy && <span className="text-slate-500 text-xs ml-2">· {run.triggeredBy}</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {timeAgo(run.startedUnix)}</span>
                      <span>{formatDuration(run.totalDurationMs)}</span>
                      {run.failedStep && <span className="text-red-400">· failed at: {run.failedStep}</span>}
                      {run.verifyInstallStatus && <span className="text-slate-500">· verify: {run.verifyInstallStatus}</span>}
                    </p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-700 bg-slate-900/40 p-4 space-y-4">
                    {/* Checkpoints */}
                    {run.checkpoints.length > 0 && (
                      <div>
                        <h3 className="text-xs uppercase tracking-wider text-slate-400 mb-2">Claude Checkpoints</h3>
                        <div className="space-y-2">
                          {run.checkpoints.map((cp, i) => (
                            <div key={i} className="flex items-start gap-3 p-2 rounded bg-slate-800/60 border border-slate-700">
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded border font-mono ${decisionStyle(cp.decision)}`}>
                                {cp.name}: {cp.decision}
                              </span>
                              <p className="text-xs text-slate-300 flex-1 leading-relaxed">{cp.reason || '(no reason captured)'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Steps */}
                    {run.steps.length > 0 && (
                      <div>
                        <h3 className="text-xs uppercase tracking-wider text-slate-400 mb-2">Steps</h3>
                        <div className="space-y-1">
                          {run.steps.map((s, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs">
                              <span className="text-slate-500 font-mono w-16 flex-shrink-0">{formatDuration(s.durationMs)}</span>
                              <span className={`font-mono ${s.name === run.failedStep ? 'text-red-300' : 'text-slate-200'}`}>{s.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                      <a href={`/api/auto-update/runs/${run.id}?raw=1`} className="flex items-center gap-1 hover:text-sky-300">
                        <FileText className="h-3 w-3" /> Raw log ({run.logLines} lines, {Math.round(run.fileSizeBytes / 1024)} KB)
                      </a>
                      {run.verifyInstallDetail && (
                        <span>verify-install: {run.verifyInstallDetail}</span>
                      )}
                      {run.rollbackTag && <span>rollback tag: <code>{run.rollbackTag}</code></span>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
