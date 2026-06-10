'use client'

/**
 * ErrorWatchPanel
 *
 * SystemAdmin > Watchers tab — surface for the Phase 2a error_watch_events
 * table. Three sections stacked vertically:
 *   1. Status header: heartbeat freshness, last startup, total errors in window
 *   2. Signature count bar (one row per signature with count)
 *   3. Recent events table (newest first)
 *
 * Polls /api/error-watch every 30s. Filter chips toggle the window between
 * 1h / 24h / 7d. Click a signature row to filter the events table to that
 * signature.
 *
 * Pattern mirrors WatcherHealthPanel for the status-header card; the events
 * table is a new pattern (atlas-drops UI is the closest sibling but renders
 * differently — too zone-specific to reuse directly).
 */

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bug,
  Clock,
  RefreshCw,
  Filter,
  X,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import SafeBoundary from '@/components/SafeBoundary'

interface SignatureCount {
  signature: string
  count: number
}

interface EventRow {
  id: string
  kind: string
  signature: string
  sample: string
  source_file: string | null
  detected_at: number
  detectedAtIso: string
}

interface ErrorWatchResponse {
  success: boolean
  now: string
  windowHours: number
  summary: {
    heartbeatFreshSec: number | null
    latestStartupAt: string | null
    errorCountWindow: number
    signatureCounts: SignatureCount[]
  }
  events: EventRow[]
  error?: string
}

const POLL_INTERVAL_MS = 30_000

// 2 × HEARTBEAT_INTERVAL_SEC (300s default) — anything older means the
// watcher is probably dead.
const STALE_THRESHOLD_SEC = 700

// Per-signature accent colors. Anything not listed falls through to slate.
const SIG_COLOR: Record<string, string> = {
  error_level: 'text-red-300 bg-red-900/30 border-red-700/40',
  unhandled_rejection: 'text-red-300 bg-red-900/30 border-red-700/40',
  fk_constraint: 'text-orange-300 bg-orange-900/30 border-orange-700/40',
  econn_refused: 'text-amber-300 bg-amber-900/30 border-amber-700/40',
  etimedout: 'text-amber-300 bg-amber-900/30 border-amber-700/40',
  module_not_found: 'text-purple-300 bg-purple-900/30 border-purple-700/40',
  type_error: 'text-pink-300 bg-pink-900/30 border-pink-700/40',
  exception: 'text-rose-300 bg-rose-900/30 border-rose-700/40',
}
const SIG_DEFAULT = 'text-slate-300 bg-slate-700/40 border-slate-600/40'

function sigClass(sig: string) {
  return SIG_COLOR[sig] ?? SIG_DEFAULT
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return 'never'
  const deltaSec = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (deltaSec < 10) return 'just now'
  if (deltaSec < 60) return `${deltaSec} sec ago`
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)} min ago`
  if (deltaSec < 86400) {
    const h = Math.floor(deltaSec / 3600)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  const d = Math.floor(deltaSec / 86400)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

function HeartbeatBadge({ freshSec }: { freshSec: number | null }) {
  if (freshSec == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-700/40 px-2 py-1 text-xs text-slate-300">
        <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
        no heartbeat yet
      </span>
    )
  }
  const stale = freshSec > STALE_THRESHOLD_SEC
  return (
    <span
      className={
        stale
          ? 'inline-flex items-center gap-1 rounded-md border border-red-700 bg-red-900/30 px-2 py-1 text-xs text-red-200'
          : 'inline-flex items-center gap-1 rounded-md border border-green-700 bg-green-900/30 px-2 py-1 text-xs text-green-200'
      }
    >
      <span
        className={
          stale
            ? 'inline-block h-2 w-2 rounded-full bg-red-400'
            : 'inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse'
        }
      />
      heartbeat {freshSec}s ago
    </span>
  )
}

function ErrorWatchPanelInner() {
  const [data, setData] = useState<ErrorWatchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)
  const [windowHours, setWindowHours] = useState(24)
  const [sigFilter, setSigFilter] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchEvents() {
      try {
        const params = new URLSearchParams({ windowHours: String(windowHours) })
        if (sigFilter) params.set('signature', sigFilter)
        const res = await fetch(`/api/error-watch?${params.toString()}`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: ErrorWatchResponse = await res.json()
        if (cancelled) return
        if (json.success === false) {
          setError(json.error ?? 'Unknown error')
        } else {
          setData(json)
          setError(null)
        }
      } catch (err) {
        if (cancelled) return
        setError((err as Error)?.message ?? 'Failed to fetch error-watch events')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchEvents()
    const id = setInterval(fetchEvents, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [refreshTick, windowHours, sigFilter])

  const sigMax = useMemo(() => {
    if (!data?.summary.signatureCounts.length) return 0
    return Math.max(...data.summary.signatureCounts.map((s) => s.count))
  }, [data?.summary.signatureCounts])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Bug className="h-5 w-5 text-orange-400" />
              Error Watch
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              PM2 error-log tail. Polls every 30 seconds. Backed by the
              <code className="mx-1 font-mono text-xs text-slate-300">error_watch_events</code>
              table.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-700/60 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 active:bg-slate-600 min-h-[44px] min-w-[44px]"
            aria-label="Refresh error-watch events now"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-xs text-slate-400 uppercase tracking-wide">Window:</span>
          {[1, 24, 168].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setWindowHours(h)}
              className={
                'rounded-md border px-3 py-1.5 text-xs font-medium min-h-[36px] ' +
                (windowHours === h
                  ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                  : 'border-slate-600 bg-slate-700/40 text-slate-300 hover:bg-slate-700')
              }
            >
              {h === 1 ? '1 hour' : h === 24 ? '24 hours' : '7 days'}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-2">
            <HeartbeatBadge freshSec={data?.summary.heartbeatFreshSec ?? null} />
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-700/40 px-2 py-1 text-xs text-slate-300">
              <Clock className="h-3 w-3" />
              boot {relativeTime(data?.summary.latestStartupAt ?? null)}
            </span>
          </span>
        </div>

        {sigFilter && (
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-slate-300">Filtering by signature:</span>
            <span
              className={
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-mono ' +
                sigClass(sigFilter)
              }
            >
              {sigFilter}
              <button
                type="button"
                onClick={() => setSigFilter(null)}
                className="hover:text-white"
                aria-label="Clear signature filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-200">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Status fetch failed:</strong> {error}
            </span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">
            Signature breakdown
          </h3>
          <span className="text-sm text-slate-400">
            {data?.summary.errorCountWindow ?? 0} error events in window
          </span>
        </div>

        {loading && !data ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : data?.summary.signatureCounts.length ? (
          <ul className="space-y-1">
            {data.summary.signatureCounts.map((s) => {
              const pct = sigMax > 0 ? (s.count / sigMax) * 100 : 0
              return (
                <li key={s.signature}>
                  <button
                    type="button"
                    onClick={() =>
                      setSigFilter((cur) => (cur === s.signature ? null : s.signature))
                    }
                    className={
                      'group relative flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ' +
                      (sigFilter === s.signature
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-slate-700 bg-slate-800 hover:bg-slate-700/40')
                    }
                  >
                    <span
                      className={
                        'inline-block rounded border px-2 py-0.5 text-xs font-mono flex-shrink-0 ' +
                        sigClass(s.signature)
                      }
                    >
                      {s.signature}
                    </span>
                    <div className="relative flex-1 h-2 rounded-full bg-slate-700/60 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500/70 to-red-500/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono text-slate-200 w-12 text-right">
                      {s.count}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="rounded-md border border-green-700/50 bg-green-900/20 p-3 text-sm text-green-200">
            No error events in the last {windowHours === 1 ? 'hour' : windowHours === 24 ? '24 hours' : '7 days'} — quiet box.
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">Recent events</h3>
          <span className="text-sm text-slate-400">
            {data?.events.length ?? 0} shown
          </span>
        </div>

        {loading && !data ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : data?.events.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2 font-medium">When</th>
                  <th className="px-2 py-2 font-medium">Kind</th>
                  <th className="px-2 py-2 font-medium">Signature</th>
                  <th className="px-2 py-2 font-medium">Sample</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-slate-700/40 last:border-b-0 hover:bg-slate-700/20"
                  >
                    <td className="px-2 py-2 text-slate-300 font-mono whitespace-nowrap">
                      {relativeTime(e.detectedAtIso)}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          'inline-block rounded border px-2 py-0.5 text-xs font-mono ' +
                          (e.kind === 'error'
                            ? 'text-red-300 bg-red-900/30 border-red-700/40'
                            : e.kind === 'startup'
                              ? 'text-blue-300 bg-blue-900/30 border-blue-700/40'
                              : 'text-slate-300 bg-slate-700/40 border-slate-600/40')
                        }
                      >
                        {e.kind}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          'inline-block rounded border px-2 py-0.5 text-xs font-mono ' +
                          sigClass(e.signature)
                        }
                      >
                        {e.signature}
                      </span>
                    </td>
                    <td
                      className="px-2 py-2 text-slate-300 font-mono text-xs"
                      title={e.sample}
                    >
                      {e.sample.length > 120 ? e.sample.slice(0, 120) + '…' : e.sample}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-md border border-slate-700 bg-slate-800 p-3 text-sm text-slate-400">
            {sigFilter ? (
              <>No events matching <code className="font-mono text-slate-200">{sigFilter}</code> in the selected window.</>
            ) : (
              <>No events in the selected window.</>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ErrorWatchPanel() {
  return (
    <SafeBoundary label="ErrorWatchPanel">
      <ErrorWatchPanelInner />
    </SafeBoundary>
  )
}
