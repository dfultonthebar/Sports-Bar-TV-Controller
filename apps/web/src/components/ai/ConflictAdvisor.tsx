'use client'

// Embedded advisor that shows after a bartender-schedule POST returns
// 409. Calls /api/ai/conflict-suggestion, renders the displacement
// recommendation, and offers a one-click "Displace & Retry" that
// DELETEs the conflicting allocation then re-POSTs the original
// request.

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, CheckCircle, ArrowRightLeft } from 'lucide-react'
import { logger } from '@sports-bar/logger'

interface ConflictAdvisorContext {
  rejectedGameScheduleId: string
  rejectedInputSourceId: string
  rejectedTuneAt: string  // ISO
  conflictingAllocationId: string
  // Original POST body to replay after displacing
  retryBody: Record<string, any>
}

interface Props {
  context: ConflictAdvisorContext
  onResolved?: (result: { displaced: boolean; newAllocationId?: string }) => void
  onDismiss?: () => void
}

type Recommendation = 'displace' | 'keep' | 'ambiguous'

interface Suggestion {
  success: boolean
  recommendation: Recommendation
  score: number
  factors: string[]
  llmReasoning: string
  rejectedMatchup: string
  conflictingMatchup: string
  conflictingAllocationId: string
}

export default function ConflictAdvisor({ context, onResolved, onDismiss }: Props) {
  const [loading, setLoading] = useState(true)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)

  useEffect(() => { fetchSuggestion() }, [])

  async function fetchSuggestion() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/conflict-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejectedGameScheduleId: context.rejectedGameScheduleId,
          rejectedInputSourceId: context.rejectedInputSourceId,
          rejectedTuneAt: context.rejectedTuneAt,
          conflictingAllocationId: context.conflictingAllocationId,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'conflict-suggestion failed')
      setSuggestion(data)
    } catch (e: any) {
      setError(e.message)
      logger.error('[CONFLICT-ADVISOR]', e)
    } finally {
      setLoading(false)
    }
  }

  async function displaceAndRetry() {
    setExecuting(true)
    setError(null)
    try {
      // 1. Force-displace conflicting allocation
      const delRes = await fetch(`/api/schedules/bartender-schedule?id=${encodeURIComponent(context.conflictingAllocationId)}&force=true`, {
        method: 'DELETE',
      })
      if (!delRes.ok) {
        const d = await delRes.json().catch(() => ({}))
        throw new Error(`Could not cancel conflicting allocation: ${d.error || delRes.statusText}`)
      }
      // 2. Replay the original POST
      const retryRes = await fetch('/api/schedules/bartender-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context.retryBody),
      })
      const retryBody = await retryRes.json().catch(() => ({}))
      if (!retryRes.ok) throw new Error(retryBody.error || `Retry failed (${retryRes.status})`)
      setDoneMessage(`Displaced and rescheduled. New allocation ${retryBody.allocationId || ''}`)
      if (onResolved) onResolved({ displaced: true, newAllocationId: retryBody.allocationId })
    } catch (e: any) {
      setError(e.message)
      logger.error('[CONFLICT-ADVISOR] displace', e)
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-amber-200 font-medium">Scheduling conflict</div>
          {loading && (
            <div className="text-amber-300/80 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyzing…
            </div>
          )}
          {error && <div className="text-red-300">{error}</div>}
          {suggestion && !doneMessage && (
            <>
              <div className="text-slate-200">
                Trying to schedule <span className="font-semibold">{suggestion.rejectedMatchup}</span>, but{' '}
                <span className="font-semibold">{suggestion.conflictingMatchup}</span> is already booked on the same input.
              </div>
              <div className="text-xs">
                <RecommendationPill recommendation={suggestion.recommendation} score={suggestion.score} />
              </div>
              {suggestion.llmReasoning && (
                <div className="text-slate-300 italic text-xs">"{suggestion.llmReasoning}"</div>
              )}
              {suggestion.factors.length > 0 && (
                <ul className="text-xs text-slate-300 list-disc ml-4 space-y-0.5">
                  {suggestion.factors.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={displaceAndRetry}
                  disabled={executing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50 ${suggestion.recommendation === 'displace'
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-100'}`}
                >
                  {executing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRightLeft className="h-3 w-3" />}
                  Displace & retry
                </button>
                {onDismiss && (
                  <button
                    onClick={onDismiss}
                    disabled={executing}
                    className="px-3 py-1.5 rounded text-xs border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Leave as-is
                  </button>
                )}
              </div>
            </>
          )}
          {doneMessage && (
            <div className="flex items-center gap-2 text-green-300">
              <CheckCircle className="h-4 w-4" />
              {doneMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RecommendationPill({ recommendation, score }: { recommendation: Recommendation; score: number }) {
  const styles: Record<Recommendation, string> = {
    displace: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    keep: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    ambiguous: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded border ${styles[recommendation]}`}>
      Recommendation: <strong>{recommendation}</strong> (score {score})
    </span>
  )
}
