'use client'

// Modal for the bulk-schedule flow. Takes a set of proposed games,
// calls /api/ai/distribution-plan to get a coverage-maximizing plan,
// renders per-line with preflight status, and commits each line
// through the existing bartender-schedule POST. The optimizer reads
// historical team routes + learned game durations so two locations
// running for weeks will get very different plans.

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertTriangle, Loader2, Sparkles, Play } from 'lucide-react'
import { logger } from '@sports-bar/logger'
import ConflictAdvisor from './ConflictAdvisor'

interface ProposedGame {
  gameScheduleId: string
  homeTeam: string
  awayTeam: string
  league: string
  startTime: string  // ISO
  channelNumber?: string
  channelName?: string
  suggestedDeviceType?: string
}

interface AssignmentPlan {
  gameId: string
  gameDescription: string
  league: string
  isHomeTeam: boolean
  inputSourceId: string
  inputSourceName: string
  inputSourceType: string
  channelNumber: string
  tvOutputIds: number[]
  tuneAtUnix: number
  expectedFreeAtUnix: number
  durationMinutes: number
  durationSource: 'learned' | 'default'
  score: number
  reasoning: string[]
  preflight: {
    channelMappingExists: boolean
    inputSourceActive: boolean
    outputsFree: boolean
    overallOk: boolean
  }
}

interface PlanResponse {
  success: boolean
  plan: AssignmentPlan[]
  unassigned: Array<{ gameId: string; gameDescription: string; reason: string }>
  warnings: string[]
  stats: {
    totalGames: number
    assigned: number
    homeTeamGames: number
    homeTeamAssigned: number
    inputSourcesUsed: number
    avgTvsPerGame: number
  }
}

interface Props {
  open: boolean
  proposedGames: ProposedGame[]
  onClose: () => void
  onCommitted?: () => void
}

export default function DistributionPlanModal({ open, proposedGames, onClose, onCommitted }: Props) {
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [skipIds, setSkipIds] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<Record<string, 'ok' | 'fail' | 'pending'>>({})
  const [error, setError] = useState<string | null>(null)
  // When a commit line fails with 409, we stash the context here so the
  // advisor can render inline below that row.
  const [conflictByGame, setConflictByGame] = useState<Record<string, {
    conflictingAllocationId: string
    retryBody: Record<string, any>
  }>>({})

  useEffect(() => {
    if (open && proposedGames.length > 0) {
      fetchPlan()
    } else if (!open) {
      setPlan(null)
      setSkipIds(new Set())
      setResults({})
      setError(null)
      setConflictByGame({})
    }
  }, [open, proposedGames.length])

  async function fetchPlan() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/distribution-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          games: proposedGames.map(g => ({ gameScheduleId: g.gameScheduleId })),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'distribution plan failed')
      setPlan(data)
    } catch (e: any) {
      setError(e.message)
      logger.error('[DIST-MODAL] fetchPlan', e)
    } finally {
      setLoading(false)
    }
  }

  async function commitPlan() {
    if (!plan) return
    setCommitting(true)
    const lines = plan.plan.filter(p => !skipIds.has(p.gameId))
    for (const line of lines) {
      setResults(r => ({ ...r, [line.gameId]: 'pending' }))
      // Find the original proposedGame for channel name / device type info
      const original = proposedGames.find(p => p.gameScheduleId === line.gameId)
      const body = {
        inputSourceId: line.inputSourceId,
        deviceType: line.inputSourceType === 'satellite' ? 'directv' : line.inputSourceType,
        channelNumber: line.channelNumber,
        channelName: original?.channelName,
        gameInfo: {
          homeTeam: original?.homeTeam ?? line.gameDescription.split(' @ ')[1] ?? '',
          awayTeam: original?.awayTeam ?? line.gameDescription.split(' @ ')[0] ?? '',
          league: line.league,
          startTime: new Date(line.tuneAtUnix * 1000).toISOString(),
          endTime: new Date(line.expectedFreeAtUnix * 1000).toISOString(),
        },
        tuneAt: new Date(line.tuneAtUnix * 1000).toISOString(),
        tvOutputIds: line.tvOutputIds,
      }
      try {
        const res = await fetch('/api/schedules/bartender-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          setResults(r => ({ ...r, [line.gameId]: 'ok' }))
        } else {
          setResults(r => ({ ...r, [line.gameId]: 'fail' }))
          // 409 means overlap with another allocation — enrich with advisor context.
          if (res.status === 409) {
            const data = await res.json().catch(() => ({}))
            if (data?.conflictingAllocationId) {
              setConflictByGame(c => ({
                ...c,
                [line.gameId]: { conflictingAllocationId: data.conflictingAllocationId, retryBody: body },
              }))
            }
          }
        }
      } catch {
        setResults(r => ({ ...r, [line.gameId]: 'fail' }))
      }
    }
    setCommitting(false)
    if (onCommitted) onCommitted()
  }

  function toggleSkip(gameId: string) {
    setSkipIds(s => {
      const next = new Set(s)
      if (next.has(gameId)) next.delete(gameId)
      else next.add(gameId)
      return next
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-slate-100">Distribution Plan</h3>
            {plan && (
              <span className="text-xs text-slate-400 ml-2">
                {plan.stats.assigned}/{plan.stats.totalGames} games · {plan.stats.inputSourcesUsed} sources · {plan.stats.homeTeamAssigned}/{plan.stats.homeTeamGames} home teams
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-300" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building plan from historical routes + learned durations…
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-950/40 border border-red-500/40 p-3 text-sm text-red-300">
              {error}
            </div>
          )}
          {plan?.warnings.map((w, i) => (
            <div key={i} className="rounded-lg bg-amber-950/30 border border-amber-500/40 p-3 text-sm text-amber-200 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}

          {plan?.plan.map((line) => {
            const skipped = skipIds.has(line.gameId)
            const result = results[line.gameId]
            const preflight = line.preflight
            return (
              <div
                key={line.gameId}
                className={`rounded-lg border p-3 ${skipped ? 'border-slate-700 bg-slate-800/30 opacity-50' : preflight.overallOk ? 'border-slate-700 bg-slate-800/60' : 'border-amber-500/40 bg-amber-950/20'}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={!skipped}
                    onChange={() => toggleSkip(line.gameId)}
                    className="mt-1 h-5 w-5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-100">{line.gameDescription}</span>
                      {line.isHomeTeam && (
                        <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded">home team</span>
                      )}
                      <span className="text-xs text-slate-400">{line.league}</span>
                    </div>
                    <div className="text-xs text-slate-300 mt-1">
                      → <span className="font-semibold text-slate-100">{line.inputSourceName}</span> ch {line.channelNumber} · {line.tvOutputIds.length > 0 ? `${line.tvOutputIds.length} TVs [${line.tvOutputIds.join(',')}]` : <em>TVs TBD</em>}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Duration {line.durationMinutes}min ({line.durationSource}) · score {line.score}
                    </div>
                    {line.reasoning.length > 0 && (
                      <details className="mt-1">
                        <summary className="text-[11px] text-slate-500 cursor-pointer hover:text-slate-300">why</summary>
                        <ul className="mt-1 text-[11px] text-slate-400 space-y-0.5 ml-3 list-disc">
                          {line.reasoning.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </details>
                    )}
                  </div>
                  <div className="text-xs flex flex-col items-end gap-1 shrink-0">
                    <Pill ok={preflight.channelMappingExists} label="chan" />
                    <Pill ok={preflight.inputSourceActive} label="src" />
                    <Pill ok={preflight.outputsFree} label="outs" />
                  </div>
                  {result && (
                    <div className="shrink-0">
                      {result === 'pending' && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                      {result === 'ok' && <CheckCircle className="h-4 w-4 text-green-400" />}
                      {result === 'fail' && <AlertTriangle className="h-4 w-4 text-red-400" />}
                    </div>
                  )}
                </div>
                {conflictByGame[line.gameId] && (
                  <div className="mt-2">
                    <ConflictAdvisor
                      context={{
                        rejectedGameScheduleId: line.gameId,
                        rejectedInputSourceId: line.inputSourceId,
                        rejectedTuneAt: new Date(line.tuneAtUnix * 1000).toISOString(),
                        conflictingAllocationId: conflictByGame[line.gameId].conflictingAllocationId,
                        retryBody: conflictByGame[line.gameId].retryBody,
                      }}
                      onResolved={(r) => {
                        if (r.displaced) {
                          setResults(s => ({ ...s, [line.gameId]: 'ok' }))
                          setConflictByGame(c => {
                            const next = { ...c }
                            delete next[line.gameId]
                            return next
                          })
                        }
                      }}
                      onDismiss={() => {
                        setConflictByGame(c => {
                          const next = { ...c }
                          delete next[line.gameId]
                          return next
                        })
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {plan?.unassigned.map((u, i) => (
            <div key={`u-${i}`} className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 text-sm">
              <div className="font-semibold text-amber-200">{u.gameDescription}</div>
              <div className="text-xs text-amber-300 mt-1">Not assigned: {u.reason}</div>
            </div>
          ))}
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t border-slate-700 flex items-center justify-between gap-3">
          <button
            onClick={fetchPlan}
            disabled={loading || committing}
            className="px-3 py-2 rounded-lg border border-slate-600 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Regenerate plan
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={committing}
              className="px-3 py-2 rounded-lg border border-slate-600 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={commitPlan}
              disabled={committing || loading || !plan || plan.plan.length === 0}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Commit {plan ? plan.plan.length - skipIds.size : 0} selected
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ok ? 'bg-green-500/20 text-green-300 border-green-500/40' : 'bg-red-500/20 text-red-300 border-red-500/40'}`}>
      {label} {ok ? '✓' : '✗'}
    </span>
  )
}
