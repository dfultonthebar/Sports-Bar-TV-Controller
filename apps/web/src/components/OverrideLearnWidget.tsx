'use client'

/**
 * Compact override-learn summary for the bartender remote Schedule tab.
 *
 * Surfaces the top 3-5 correction patterns the manager might want to
 * act on, with a single "Apply" button per row. Tapping "View all"
 * opens the full digest at /override-learn.
 *
 * Design: bordered div, bg-slate-800/50, text-sm, 44x44 min touch
 * targets per CLAUDE.md Bartender Remote section. No Card components.
 */

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Brain, Check, ExternalLink, Home as HomeIcon, Loader2, Sparkles } from 'lucide-react'

interface PatternRow {
  team: string
  outputNum: number
  action: 'add' | 'remove'
  occurrences: number
  isHomeTeam: boolean
  applied: { id: string; appliedAt: string } | null
}

interface Digest {
  totalEvents: number
  byPattern: PatternRow[]
  appliedCount: number
}

export default function OverrideLearnWidget() {
  const [digest, setDigest] = useState<Digest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/override-learn/digest?days=30', { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      setDigest(await res.json())
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const applyPattern = useCallback(
    async (p: PatternRow) => {
      const key = `${p.team}:${p.outputNum}:${p.action}`
      setBusyKey(key)
      try {
        const res = await fetch('/api/override-learn/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team: p.team,
            outputNum: p.outputNum,
            action: p.action === 'remove' ? 'exclude' : 'include',
            isHomeTeam: p.isHomeTeam,
            occurrences: p.occurrences,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error || `HTTP ${res.status}`)
        }
        await load()
      } catch (err: any) {
        setError(err.message || 'Apply failed')
      } finally {
        setBusyKey(null)
      }
    },
    [load],
  )

  // Filter out the noise: show the top 5 unapplied patterns with 2+ occurrences,
  // sorted by occurrences descending. If nothing unapplied, show recently-applied
  // ones as a confirmation.
  const visible = digest?.byPattern.filter(p => !p.applied && p.occurrences >= 2).slice(0, 5) ?? []
  const hasAppliedOnly = visible.length === 0 && (digest?.byPattern.filter(p => p.applied).length ?? 0) > 0

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 sm:p-5 mt-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-sky-400" />
          <h3 className="text-base sm:text-lg font-semibold text-white">Scheduler corrections</h3>
        </div>
        <a
          href="/override-learn"
          className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-lg text-sm text-slate-300 hover:text-sky-300 hover:bg-slate-800 transition-colors"
        >
          View all <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {loading && (
        <div className="text-slate-400 text-sm flex items-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading patterns…
        </div>
      )}

      {error && !loading && (
        <div className="text-rose-300 text-sm py-2">{error}</div>
      )}

      {!loading && !error && digest && (
        <>
          <p className="text-xs text-slate-400 mb-3">
            {digest.totalEvents === 0
              ? 'No corrections in the last 30 days — scheduler is routing correctly.'
              : `${digest.totalEvents} corrections in the last 30 days, ${digest.appliedCount} already applied.`}
          </p>

          {visible.length > 0 && (
            <div className="space-y-2">
              {visible.map(p => {
                const busyKeyThis = `${p.team}:${p.outputNum}:${p.action}`
                const isBusy = busyKey === busyKeyThis
                return (
                  <div
                    key={`${p.team}-${p.outputNum}-${p.action}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 flex items-center gap-1.5">
                        {p.isHomeTeam && <HomeIcon className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                        <span className="truncate">{p.team}</span>
                        <span className="text-xs text-slate-500 whitespace-nowrap">×{p.occurrences}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.action === 'remove' ? (
                          <span className="inline-flex items-center gap-1 text-rose-300">
                            <ArrowDown className="h-3 w-3" /> remove from TV {p.outputNum}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-300">
                            <ArrowUp className="h-3 w-3" /> add to TV {p.outputNum}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => applyPattern(p)}
                      disabled={isBusy}
                      className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 min-h-[44px] min-w-[72px] justify-center rounded-lg text-sm border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 transition-colors"
                    >
                      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Apply
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {hasAppliedOnly && (
            <p className="text-xs text-slate-400 flex items-center gap-1 py-2">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              All patterns addressed. Tap View all to see history.
            </p>
          )}
        </>
      )}
    </div>
  )
}
