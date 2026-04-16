'use client'

/**
 * Auto Update Panel
 * Phase 3a UI for the auto-update system. Wired into the System Admin → Sync tab.
 * Styled per the Location tab dark theme — no white backgrounds, no Card components.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Clock,
  GitCommit,
  History,
  Power,
  Save,
  Loader2,
  RotateCcw,
} from 'lucide-react'

// ----- types matching the API contracts -----

type RunResult = 'pass' | 'fail' | 'rolled_back' | 'in_progress' | null

interface RecentRun {
  id: string | number
  startedAt: string
  finishedAt?: string | null
  result: RunResult
  commitShaBefore?: string | null
  commitShaAfter?: string | null
  branch?: string | null
  durationSecs?: number | null
  verifyResultJson?: string | null
  errorMessage?: string | null
  triggeredBy?: string | null
}

interface StatusResponse {
  enabled: boolean
  scheduleCron: string
  lastRunAt: string | null
  lastResult: RunResult
  lastCommitShaBefore: string | null
  lastCommitShaAfter: string | null
  lastError: string | null
  lastDurationSecs: number | null
  recentRuns: RecentRun[]
  currentlyRunning: boolean
  currentPid?: number
}

interface LogResponse {
  jobId: string
  content: string
  exists: boolean
  size: number
}

// ----- helpers -----

function shortSha(sha: string | null | undefined): string {
  if (!sha) return '—'
  return sha.slice(0, 7)
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'unknown'
  const diff = Date.now() - then
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function formatLocal(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function formatDuration(secs: number | null | undefined): string {
  if (secs == null) return '—'
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${s}s`
}

// Parse cron "M H * * *" to "HH:MM"
function cronToTime(cron: string | null | undefined): string {
  if (!cron) return '02:30'
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return '02:30'
  const m = parts[0].padStart(2, '0')
  const h = parts[1].padStart(2, '0')
  if (!/^\d+$/.test(m) || !/^\d+$/.test(h)) return '02:30'
  return `${h}:${m}`
}

function timeToCron(time: string): string {
  const [h, m] = time.split(':')
  const hh = parseInt(h, 10)
  const mm = parseInt(m, 10)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return '30 2 * * *'
  return `${mm} ${hh} * * *`
}

function humanCron(cron: string | null | undefined): string {
  if (!cron) return 'Not scheduled'
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return cron
  const [m, h, dom, mon, dow] = parts
  if (dom === '*' && mon === '*' && dow === '*' && /^\d+$/.test(m) && /^\d+$/.test(h)) {
    const hh = parseInt(h, 10)
    const mm = parseInt(m, 10)
    const period = hh >= 12 ? 'PM' : 'AM'
    const h12 = hh % 12 === 0 ? 12 : hh % 12
    return `Daily at ${h12}:${String(mm).padStart(2, '0')} ${period}`
  }
  return cron
}

// Derive jobId from a run's startedAt timestamp (matches buildJobId in run-now route)
function buildJobIdFromStarted(startedAt: string): string {
  const d = new Date(startedAt)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `auto-update-${yyyy}-${mm}-${dd}-${hh}-${mi}`
}

const RESULT_BADGE: Record<string, string> = {
  pass: 'bg-green-500/20 text-green-400 border-green-500/30',
  fail: 'bg-red-500/20 text-red-400 border-red-500/30',
  rolled_back: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

function ResultBadge({ result }: { result: RunResult }) {
  if (!result) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border bg-slate-500/20 text-slate-400 border-slate-500/30">
        none
      </span>
    )
  }
  const Icon =
    result === 'pass'
      ? CheckCircle2
      : result === 'fail'
      ? XCircle
      : result === 'rolled_back'
      ? RotateCcw
      : Activity
  const label =
    result === 'pass'
      ? 'pass'
      : result === 'fail'
      ? 'fail'
      : result === 'rolled_back'
      ? 'rolled back'
      : 'in progress'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${RESULT_BADGE[result]}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// ----- main component -----

export default function AutoUpdatePanel() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Editable controls (dirty tracking)
  const [enabledDraft, setEnabledDraft] = useState(false)
  const [timeDraft, setTimeDraft] = useState('02:30')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // Run-now state
  const [running, setRunning] = useState(false)

  // Log modal
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [logContent, setLogContent] = useState<string>('')
  const [logExists, setLogExists] = useState<boolean>(false)
  const logPollRef = useRef<NodeJS.Timeout | null>(null)
  const logIdleRef = useRef<{ lastSize: number; idleCount: number }>({
    lastSize: -1,
    idleCount: 0,
  })
  const logBodyRef = useRef<HTMLPreElement | null>(null)

  const [needsAuth, setNeedsAuth] = useState(false)
  // Tracks whether the user has touched the form. Once true, background
  // status polls stop overwriting the user's draft state — otherwise the
  // 15-second poll would reset `enabledDraft` / `timeDraft` to the server
  // values mid-edit, clearing the dirty flag and disabling the Save button
  // before the user could click it.
  const draftTouchedRef = useRef(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/auto-update/status', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.status === 401) {
        setNeedsAuth(true)
        setError(null)
        setLoading(false)
        return
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data: StatusResponse = await res.json()
      setStatus(data)
      // Only sync draft values from the server if the user hasn't touched
      // the form yet. Once they have, preserve their edits until they Save
      // or explicitly refresh.
      if (!draftTouchedRef.current) {
        setEnabledDraft(data.enabled)
        setTimeDraft(cronToTime(data.scheduleCron))
      }
      setError(null)
      setNeedsAuth(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to load status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const t = setInterval(() => {
      // Don't hammer the 401 endpoint; once unauthed, stop auto-polling
      // and let the login-prompt handle the next attempt.
      if (needsAuth) return
      fetchStatus()
    }, 15000)
    return () => clearInterval(t)
  }, [fetchStatus, needsAuth])

  const dirty =
    !!status &&
    (enabledDraft !== status.enabled || timeToCron(timeDraft) !== status.scheduleCron)

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const body = {
        enabled: enabledDraft,
        scheduleCron: timeToCron(timeDraft),
      }
      const res = await fetch('/api/system/auto-update/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      setSaveMsg('Settings saved')
      // Clear touched flag so the next poll re-syncs cleanly from server
      draftTouchedRef.current = false
      await fetchStatus()
    } catch (e: any) {
      setSaveMsg(`Save failed: ${e?.message || 'unknown'}`)
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 4000)
    }
  }

  // ----- log polling -----

  const stopLogPolling = useCallback(() => {
    if (logPollRef.current) {
      clearInterval(logPollRef.current)
      logPollRef.current = null
    }
  }, [])

  const startLogPolling = useCallback(
    (jobId: string) => {
      stopLogPolling()
      logIdleRef.current = { lastSize: -1, idleCount: 0 }
      const poll = async () => {
        try {
          const res = await fetch(
            `/api/system/auto-update/logs/${encodeURIComponent(jobId)}`,
            { credentials: 'include', cache: 'no-store' }
          )
          if (!res.ok) return
          const data: LogResponse = await res.json()
          setLogExists(data.exists)
          setLogContent(data.content || '')
          // Auto-scroll
          requestAnimationFrame(() => {
            if (logBodyRef.current) {
              logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight
            }
          })
          // Idle detection — stop polling only after the log has been
          // silent for a LONG time. Checkpoint B and C invoke Claude
          // Code CLI which can take 60-180s to respond, and during that
          // window the log file doesn't grow. A short idle threshold
          // would stop polling mid-run. 150 polls × 2s = 5 minutes of
          // silence before we conclude the run is truly done.
          // Also: don't count idleness until we've seen the file exist
          // (first bytes written), so "waiting for script to start"
          // doesn't count as idle.
          if (!data.exists || data.size === 0) {
            // Script hasn't written anything yet; reset counter and keep polling
            logIdleRef.current.idleCount = 0
            logIdleRef.current.lastSize = 0
          } else if (data.size === logIdleRef.current.lastSize) {
            logIdleRef.current.idleCount++
            if (logIdleRef.current.idleCount >= 150) {
              stopLogPolling()
            }
          } else {
            logIdleRef.current.lastSize = data.size
            logIdleRef.current.idleCount = 0
          }
        } catch {
          // swallow — keep polling on transient errors
        }
      }
      poll()
      logPollRef.current = setInterval(poll, 2000)
    },
    [stopLogPolling]
  )

  const openLogModal = (jobId: string) => {
    setActiveJobId(jobId)
    setLogContent('')
    setLogExists(false)
    setLogModalOpen(true)
    startLogPolling(jobId)
  }

  const closeLogModal = () => {
    stopLogPolling()
    setLogModalOpen(false)
    setActiveJobId(null)
  }

  useEffect(() => {
    return () => stopLogPolling()
  }, [stopLogPolling])

  const handleRunNow = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/system/auto-update/run-now', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      if (data.jobId) {
        openLogModal(data.jobId)
      }
      // Refresh status shortly to reflect currentlyRunning
      setTimeout(fetchStatus, 1500)
    } catch (e: any) {
      setError(`Run failed: ${e?.message || 'unknown'}`)
    } finally {
      setRunning(false)
    }
  }

  // ----- render -----

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700 p-6 flex items-center gap-3 text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
        Loading auto-update status...
      </div>
    )
  }

  if (needsAuth) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-6 text-slate-300">
        <div className="flex items-center gap-2 font-semibold mb-2 text-white">
          <Power className="h-5 w-5 text-blue-400" /> Auto Update System
        </div>
        <div className="text-sm mb-4">
          You must be signed in as an Admin to view or control the auto-update
          system. The routes at <code className="text-blue-300">/api/system/auto-update/*</code> require an
          active ADMIN session.
        </div>
        <a
          href="/login?redirect=/system-admin%3Ftab%3Dsync"
          className="inline-flex items-center gap-2 rounded-md border border-slate-600 px-4 py-2 text-sm hover:bg-slate-700"
        >
          Go to Login
        </a>
      </div>
    )
  }

  if (error && !status) {
    return (
      <div className="rounded-lg border border-red-700 bg-red-950/30 p-6 text-red-300">
        <div className="flex items-center gap-2 font-semibold mb-2">
          <XCircle className="h-5 w-5" /> Error loading auto-update status
        </div>
        <div className="text-sm">{error}</div>
        <Button
          variant="outline"
          className="mt-4 border-slate-600 hover:bg-slate-700"
          onClick={fetchStatus}
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    )
  }

  if (!status) return null

  return (
    <div className="space-y-6">
      {/* ========== Status banner ========== */}
      <div className="rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Power className="h-5 w-5 text-blue-400" />
          Auto Update System
          {status.currentlyRunning && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border bg-blue-500/20 text-blue-400 border-blue-500/30">
              <Activity className="h-3 w-3 animate-pulse" /> Running
              {status.currentPid ? ` (pid ${status.currentPid})` : ''}
            </span>
          )}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg bg-slate-800/50 p-4 flex items-center gap-3">
            <Power
              className={`h-8 w-8 ${
                status.enabled ? 'text-green-400' : 'text-slate-500'
              }`}
            />
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className="text-lg font-bold text-white">
                {status.enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-slate-800/50 p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-xs text-slate-400">Schedule</p>
              <p className="text-sm font-bold text-white">
                {humanCron(status.scheduleCron)}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-slate-800/50 p-4 flex items-center gap-3">
            <History className="h-8 w-8 text-purple-400" />
            <div>
              <p className="text-xs text-slate-400">Last Run</p>
              <div className="flex items-center gap-2">
                <ResultBadge result={status.lastResult} />
                <span className="text-xs text-slate-400">
                  {relativeTime(status.lastRunAt)}
                </span>
              </div>
              {status.lastDurationSecs != null && (
                <p className="text-xs text-slate-500">
                  took {formatDuration(status.lastDurationSecs)}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-slate-800/50 p-4 flex items-center gap-3">
            <GitCommit className="h-8 w-8 text-cyan-400" />
            <div>
              <p className="text-xs text-slate-400">Last Update</p>
              <p className="text-sm font-mono text-white">
                {shortSha(status.lastCommitShaBefore)}
                <span className="text-slate-500 mx-1">→</span>
                {shortSha(status.lastCommitShaAfter)}
              </p>
            </div>
          </div>
        </div>

        {status.lastError && (
          <div className="mt-4 rounded-lg border border-red-700 bg-red-950/30 p-3">
            <div className="flex items-center gap-2 text-red-300 text-sm font-semibold mb-1">
              <AlertTriangle className="h-4 w-4" /> Last error
            </div>
            <div className="text-xs text-red-200 font-mono whitespace-pre-wrap">
              {status.lastError}
            </div>
          </div>
        )}
      </div>

      {/* ========== Controls ========== */}
      <div className="rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Save className="h-5 w-5 text-blue-400" />
          Settings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <Power className="h-3 w-3" /> Enable scheduled updates
            </label>
            <div className="flex items-center gap-3 h-10">
              <Switch
                checked={enabledDraft}
                onCheckedChange={(v) => {
                  draftTouchedRef.current = true
                  setEnabledDraft(v)
                }}
              />
              <span className="text-sm text-slate-300">
                {enabledDraft ? 'On' : 'Off'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Run daily at (24h local time)
            </label>
            <Input
              type="time"
              value={timeDraft}
              onChange={(e) => {
                draftTouchedRef.current = true
                setTimeDraft(e.target.value)
              }}
              className="bg-slate-800 border-slate-600 text-white"
            />
            <p className="text-xs text-slate-500">
              cron: <span className="font-mono">{timeToCron(timeDraft)}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="w-full"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
            {saveMsg && (
              <p
                className={`text-xs ${
                  saveMsg.startsWith('Save failed')
                    ? 'text-red-400'
                    : 'text-green-400'
                }`}
              >
                {saveMsg}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-700 flex flex-wrap items-center gap-3">
          <Button
            onClick={handleRunNow}
            disabled={running || status.currentlyRunning}
            variant="outline"
            className="border-blue-600 text-blue-400 hover:bg-blue-950"
          >
            {running || status.currentlyRunning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Update Now
          </Button>
          <Button
            onClick={fetchStatus}
            variant="outline"
            className="border-slate-600 hover:bg-slate-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <p className="text-xs text-slate-500">
            Manually triggers <span className="font-mono">scripts/auto-update.sh</span>{' '}
            with verification + auto-rollback on failure.
          </p>
        </div>
      </div>

      {/* ========== History table ========== */}
      <div className="rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-blue-400" />
          Update History
          <span className="text-xs text-slate-500 font-normal">
            (last {status.recentRuns.length})
          </span>
        </h3>

        {status.recentRuns.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-8">
            No update runs recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800">
                <tr>
                  <th className="text-left p-3 text-slate-300 font-medium">Started</th>
                  <th className="text-left p-3 text-slate-300 font-medium">Duration</th>
                  <th className="text-left p-3 text-slate-300 font-medium">Result</th>
                  <th className="text-left p-3 text-slate-300 font-medium">Trigger</th>
                  <th className="text-left p-3 text-slate-300 font-medium">Branch</th>
                  <th className="text-left p-3 text-slate-300 font-medium">Commits</th>
                  <th className="text-left p-3 text-slate-300 font-medium">Error</th>
                  <th className="text-right p-3 text-slate-300 font-medium">Logs</th>
                </tr>
              </thead>
              <tbody>
                {status.recentRuns.map((run, i) => {
                  const rowBg =
                    run.result === 'fail'
                      ? 'bg-red-950/30'
                      : run.result === 'rolled_back'
                      ? 'bg-amber-950/20'
                      : i % 2 === 0
                      ? 'bg-slate-800/30'
                      : 'bg-slate-800/50'
                  const jobId = buildJobIdFromStarted(run.startedAt)
                  return (
                    <tr
                      key={run.id}
                      className={`${rowBg} hover:bg-slate-700/40 cursor-pointer`}
                      onClick={() => jobId && openLogModal(jobId)}
                    >
                      <td className="p-3 text-slate-300 whitespace-nowrap">
                        {formatLocal(run.startedAt)}
                      </td>
                      <td className="p-3 text-slate-300">
                        {formatDuration(run.durationSecs)}
                      </td>
                      <td className="p-3">
                        <ResultBadge result={run.result} />
                      </td>
                      <td className="p-3 text-slate-400 text-xs">
                        {run.triggeredBy || '—'}
                      </td>
                      <td className="p-3 text-slate-400 text-xs font-mono">
                        {run.branch || '—'}
                      </td>
                      <td className="p-3 text-slate-300 font-mono text-xs whitespace-nowrap">
                        {shortSha(run.commitShaBefore)}
                        <span className="text-slate-500 mx-1">→</span>
                        {shortSha(run.commitShaAfter)}
                      </td>
                      <td
                        className="p-3 text-red-300 text-xs max-w-xs truncate"
                        title={run.errorMessage || ''}
                      >
                        {run.errorMessage || ''}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-600 hover:bg-slate-700 h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (jobId) openLogModal(jobId)
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========== Log modal ========== */}
      <Dialog
        open={logModalOpen}
        onOpenChange={(open) => {
          if (!open) closeLogModal()
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Update Log
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono text-xs">{activeJobId}</span>
            </DialogDescription>
          </DialogHeader>
          <pre
            ref={logBodyRef}
            className="bg-slate-950 border border-slate-700 rounded-md p-4 text-xs font-mono text-slate-200 max-h-[60vh] overflow-auto whitespace-pre-wrap"
          >
            {logContent ||
              (logExists
                ? '(empty)'
                : "File doesn't exist yet, waiting for script to write first line...")}
          </pre>
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              {logPollRef.current ? 'Polling every 2s...' : 'Polling stopped (idle)'}
            </p>
            <Button
              variant="outline"
              className="border-slate-600 hover:bg-slate-700"
              onClick={closeLogModal}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
