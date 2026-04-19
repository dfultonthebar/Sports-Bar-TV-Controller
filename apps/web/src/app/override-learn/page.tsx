'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Brain, Home as HomeIcon, Loader2, RefreshCw, Sparkles, Tv2, XCircle } from 'lucide-react'

interface TeamRow {
  team: string
  isHomeTeam: boolean
  league: string
  corrections: number
  addCount: number
  removeCount: number
  lastSeen: number
}
interface OutputRow {
  outputNum: number
  corrections: number
  addCount: number
  removeCount: number
  topTeams: Array<{ team: string; n: number }>
}
interface PatternRow {
  team: string
  outputNum: number
  action: 'add' | 'remove'
  occurrences: number
  isHomeTeam: boolean
  firstSeen: number
  lastSeen: number
}
interface RecentEvent {
  ts: number
  operation: 'add' | 'remove'
  team: string
  league: string
  isHomeTeam: boolean
  outputNum: number
  inputNum: number | null
  prevOutputs: number[]
  newOutputs: number[]
  level: string
}
interface Recommendation {
  ts: number
  message: string
  level: string
  metadata: string | null
}
interface Digest {
  windowDays: number
  totalEvents: number
  generatedAt: string
  byTeam: TeamRow[]
  byOutput: OutputRow[]
  byPattern: PatternRow[]
  recentEvents: RecentEvent[]
  existingRecommendations: Recommendation[]
}

function timeAgo(ts: number): string {
  if (!ts || ts <= 0) return 'never'
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatDate(ts: number): string {
  if (!ts || ts <= 0) return '—'
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function OverrideLearnPage() {
  const [digest, setDigest] = useState<Digest | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (force = false) => {
    setError(null)
    if (force) setRefreshing(true)
    try {
      const res = await fetch(`/api/override-learn/digest?days=${days}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      setDigest(await res.json())
    } catch (err: any) {
      setError(err.message || 'Failed to load digest')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [days])

  useEffect(() => {
    load(false)
  }, [load])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Brain className="h-6 w-6 text-sky-400" />
              Override-Learn Digest
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Patterns in bartender corrections during the first 10 minutes after a scheduled tune.
              Each event is a moment where the manager knew better than the scheduler — repeated
              corrections are candidates for updating default routing so bartenders don&apos;t fix
              the same mistake every night.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 flex items-center gap-2">
              Window
              <select
                value={days}
                onChange={e => setDays(parseInt(e.target.value, 10))}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100"
              >
                <option value={7}>7d</option>
                <option value={14}>14d</option>
                <option value={30}>30d</option>
                <option value={60}>60d</option>
                <option value={90}>90d</option>
              </select>
            </label>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 disabled:opacity-50 transition-colors text-sm"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span>{refreshing ? 'Loading…' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/30 border border-red-500/40 p-4 mb-4 text-red-300 text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {loading && !digest && (
          <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-6 text-slate-400 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading override digest…
          </div>
        )}

        {digest && (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Stat icon={<Sparkles className="h-6 w-6 text-sky-400" />} label="Total events" value={digest.totalEvents.toString()} />
              <Stat icon={<Brain className="h-6 w-6 text-sky-400" />} label="Teams corrected" value={digest.byTeam.length.toString()} />
              <Stat icon={<Tv2 className="h-6 w-6 text-amber-400" />} label="TVs corrected" value={digest.byOutput.length.toString()} />
              <Stat icon={<HomeIcon className="h-6 w-6 text-emerald-400" />} label="Stable patterns (≥3)" value={digest.byPattern.filter(p => p.occurrences >= 3).length.toString()} />
            </div>

            {digest.totalEvents === 0 && (
              <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-8 text-center">
                <Sparkles className="h-8 w-8 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-300 font-medium mb-1">No override events in this window</p>
                <p className="text-slate-500 text-sm">
                  Either the scheduler is routing correctly from the start, or bartenders aren&apos;t
                  making corrections within the 10-minute learn window. Try a longer time range.
                </p>
              </div>
            )}

            {/* Existing digester recommendations (from hourly override-digester job) */}
            {digest.existingRecommendations.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-5 mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  Scheduler recommendations (from hourly digester)
                </h2>
                <p className="text-xs text-slate-400 mb-3">
                  Patterns the hourly <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">override-digester</code> job has already flagged as stable (≥3 corrections across separate allocations). Act on these by updating default <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">tv_output_ids</code> in the relevant input-source or scheduler preference.
                </p>
                <div className="space-y-2">
                  {digest.existingRecommendations.slice(0, 10).map((r, i) => (
                    <div
                      key={i}
                      className={`rounded p-3 text-sm border ${
                        r.level === 'warn'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300'
                      }`}
                    >
                      <p>{r.message}</p>
                      <p className="text-xs opacity-70 mt-1">{formatDate(r.ts)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Two-column layout: teams + outputs */}
            {digest.totalEvents > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* By team */}
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                    <Brain className="h-5 w-5 text-sky-400" /> Most-corrected teams
                  </h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 text-xs">
                        <th className="pb-2 pr-2">Team</th>
                        <th className="pb-2 px-2">League</th>
                        <th className="pb-2 px-2 text-right">+</th>
                        <th className="pb-2 px-2 text-right">−</th>
                        <th className="pb-2 pl-2 text-right">Last</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {digest.byTeam.map((t, i) => (
                        <tr key={t.team} className={i % 2 === 0 ? 'bg-slate-800/30' : ''}>
                          <td className="py-2 pr-2 text-slate-100 font-medium flex items-center gap-1.5">
                            {t.isHomeTeam && <HomeIcon className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                            {t.team}
                          </td>
                          <td className="py-2 px-2 text-slate-400 text-xs uppercase">{t.league}</td>
                          <td className="py-2 px-2 text-right text-emerald-300 font-mono">{t.addCount}</td>
                          <td className="py-2 px-2 text-right text-rose-300 font-mono">{t.removeCount}</td>
                          <td className="py-2 pl-2 text-right text-slate-500 text-xs">{timeAgo(t.lastSeen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* By output */}
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                    <Tv2 className="h-5 w-5 text-amber-400" /> Most-corrected TVs (outputs)
                  </h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 text-xs">
                        <th className="pb-2 pr-2">Output</th>
                        <th className="pb-2 px-2 text-right">+</th>
                        <th className="pb-2 px-2 text-right">−</th>
                        <th className="pb-2 pl-2">Top teams</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {digest.byOutput.map((o, i) => (
                        <tr key={o.outputNum} className={i % 2 === 0 ? 'bg-slate-800/30' : ''}>
                          <td className="py-2 pr-2 text-slate-100 font-mono">TV {o.outputNum}</td>
                          <td className="py-2 px-2 text-right text-emerald-300 font-mono">{o.addCount}</td>
                          <td className="py-2 px-2 text-right text-rose-300 font-mono">{o.removeCount}</td>
                          <td className="py-2 pl-2 text-slate-400 text-xs">
                            {o.topTeams.map((t, i) => (
                              <span key={t.team}>
                                {i > 0 ? ', ' : ''}
                                {t.team}×{t.n}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Stable patterns */}
            {digest.byPattern.length > 0 && (
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5 mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-sky-400" /> Patterns (team × TV × action)
                </h2>
                <p className="text-xs text-slate-400 mb-3">
                  Identical corrections repeated across separate allocations. Patterns with 3+
                  occurrences are the strongest signal — the hourly digester promotes those
                  into scheduler recommendations above.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 text-xs border-b border-slate-700">
                      <th className="pb-2 pr-2">Team</th>
                      <th className="pb-2 px-2">Action</th>
                      <th className="pb-2 px-2">TV</th>
                      <th className="pb-2 px-2 text-right">Times</th>
                      <th className="pb-2 px-2">First seen</th>
                      <th className="pb-2 pl-2">Last seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {digest.byPattern.map((p, i) => {
                      const strong = p.occurrences >= 3
                      return (
                        <tr key={`${p.team}-${p.outputNum}-${p.action}`} className={strong ? 'bg-amber-500/5' : i % 2 === 0 ? 'bg-slate-800/30' : ''}>
                          <td className="py-2 pr-2 text-slate-100 font-medium flex items-center gap-1.5">
                            {p.isHomeTeam && <HomeIcon className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                            {p.team}
                          </td>
                          <td className="py-2 px-2">
                            {p.action === 'add' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-300 text-xs">
                                <ArrowUp className="h-3 w-3" /> add to
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-300 text-xs">
                                <ArrowDown className="h-3 w-3" /> remove from
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-slate-100 font-mono">TV {p.outputNum}</td>
                          <td className={`py-2 px-2 text-right font-mono ${strong ? 'text-amber-300 font-semibold' : 'text-slate-200'}`}>
                            {p.occurrences}×
                          </td>
                          <td className="py-2 px-2 text-slate-500 text-xs">{formatDate(p.firstSeen)}</td>
                          <td className="py-2 pl-2 text-slate-500 text-xs">{formatDate(p.lastSeen)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Raw events */}
            {digest.recentEvents.length > 0 && (
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  Recent raw events
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {digest.recentEvents.map((ev, i) => (
                    <div key={i} className="text-xs flex items-start gap-3 py-1.5 border-b border-slate-800 last:border-0">
                      <span className="text-slate-500 font-mono w-28 flex-shrink-0">{formatDate(ev.ts)}</span>
                      <span className={`font-mono w-16 flex-shrink-0 ${ev.operation === 'add' ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {ev.operation === 'add' ? '+ add' : '− remove'}
                      </span>
                      <span className="font-mono text-slate-300 w-12 flex-shrink-0">TV {ev.outputNum}</span>
                      <span className="text-slate-400 flex-1">
                        {ev.isHomeTeam && <HomeIcon className="h-3 w-3 text-emerald-400 inline mr-1" />}
                        {ev.team}
                        <span className="text-slate-600 text-xs ml-1">[{ev.league}]</span>
                      </span>
                      <span className="text-slate-600 font-mono">
                        [{ev.prevOutputs.join(',')}] → [{ev.newOutputs.join(',')}]
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500 mt-4 text-right">
              Generated {timeAgo(new Date(digest.generatedAt).getTime() / 1000)} · window: last {digest.windowDays} days
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
      </div>
    </div>
  )
}
