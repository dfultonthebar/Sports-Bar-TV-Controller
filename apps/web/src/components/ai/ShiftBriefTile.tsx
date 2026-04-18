'use client'

// Compact shift-brief card for the bartender remote. Calls
// GET /api/ai/shift-brief (server-cached 10 min) on mount, renders the
// AI-generated or deterministic brief, dismissable per-session via
// localStorage so it doesn't take space after the bartender has read
// it this shift.

import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react'
import { logger } from '@sports-bar/logger'

const DISMISS_KEY = 'shift-brief-dismissed-at'
const DISMISS_TTL_MS = 4 * 60 * 60 * 1000 // 4h — re-show after a shift handoff

export default function ShiftBriefTile() {
  const [brief, setBrief] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    // Respect prior dismissal within TTL
    try {
      const raw = localStorage.getItem(DISMISS_KEY)
      if (raw) {
        const at = parseInt(raw, 10)
        if (!Number.isNaN(at) && Date.now() - at < DISMISS_TTL_MS) {
          setDismissed(true)
          setLoading(false)
          return
        }
      }
    } catch {}
    loadBrief(false)
  }, [])

  async function loadBrief(force: boolean) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ai/shift-brief${force ? '?force=true' : ''}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'brief fetch failed')
      setBrief(data.brief || '')
      setFromCache(!!data.fromCache)
    } catch (e: any) {
      setError(e.message)
      logger.error('[SHIFT-BRIEF-TILE]', e)
    } finally {
      setLoading(false)
    }
  }

  function handleDismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="rounded-lg border border-purple-500/30 bg-linear-to-r from-purple-900/20 to-blue-900/20 p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-purple-300 shrink-0" />
          <span className="text-sm font-semibold text-slate-100">Shift Brief</span>
          {fromCache && <span className="text-xs text-slate-500">cached</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => loadBrief(true)}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-300 disabled:opacity-50"
            title="Regenerate"
            aria-label="Regenerate"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-300"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-300"
            aria-label="Dismiss until next shift"
            title="Dismiss for this shift"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[340px] overflow-y-auto">
          {loading && !brief && <span className="text-slate-400">Loading brief…</span>}
          {error && <span className="text-red-400">Brief unavailable: {error}</span>}
          {!loading && !error && brief}
        </div>
      )}
    </div>
  )
}
