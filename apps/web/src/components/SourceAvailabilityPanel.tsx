'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tv, Wifi, Radio, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'

type Source = { id: string; name: string; type: string; isActive: boolean }

const TYPE_ICON: Record<string, typeof Tv> = { cable: Radio, directv: Tv, firetv: Wifi }

/**
 * Bartender-remote "Source Status" toggle. Lets the operator mark an input box
 * (e.g. a dead cable box) DOWN so AI Suggest / the scheduler skip it, and flip
 * it back when repaired. Writes input_sources.is_active via PATCH
 * /api/scheduling/input-sources. Manual matrix routing is unaffected.
 *
 * Collapsed by default — this is an occasional operator action, not part of the
 * normal bartender flow.
 */
export default function SourceAvailabilityPanel() {
  const [sources, setSources] = useState<Source[]>([])
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/scheduling/input-sources')
      const d = await r.json()
      if (d.success) {
        setSources(
          d.sources.map((s: any) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            isActive: s.isActive !== false,
          })),
        )
        setError(null)
      }
    } catch {
      setError('Could not load sources')
    }
  }, [])

  useEffect(() => {
    if (expanded) load()
  }, [expanded, load])

  const toggle = async (s: Source) => {
    setBusy(s.id)
    setError(null)
    const next = !s.isActive
    setSources(prev => prev.map(x => (x.id === s.id ? { ...x, isActive: next } : x))) // optimistic
    try {
      const r = await fetch('/api/scheduling/input-sources', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, isActive: next }),
      })
      const d = await r.json()
      if (!d.success) throw new Error('update failed')
    } catch {
      setSources(prev => prev.map(x => (x.id === s.id ? { ...x, isActive: s.isActive } : x))) // revert
      setError(`Could not update ${s.name}`)
    } finally {
      setBusy(null)
    }
  }

  const downCount = sources.filter(s => !s.isActive).length

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <h3 className="text-lg font-bold flex items-center text-white">
          <AlertCircle className="mr-3 w-5 h-5 text-amber-400" />
          Source Status
          {downCount > 0 && (
            <span className="ml-2 text-xs font-medium text-amber-300 bg-amber-500/20 rounded-full px-2 py-0.5">
              {downCount} down
            </span>
          )}
        </h3>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-slate-400">
            Mark a box <span className="text-red-300 font-medium">Down</span> if it's broken — the
            auto-scheduler (AI Suggest) will skip it. Manual routing still works. Flip it back to{' '}
            <span className="text-green-300 font-medium">Available</span> when it's fixed.
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          {sources.length === 0 && (
            <p className="text-sm text-slate-500 py-2">No sources configured.</p>
          )}
          {sources.map(s => {
            const Icon = TYPE_ICON[s.type] || Tv
            return (
              <div
                key={s.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${s.isActive ? 'text-green-400' : 'text-slate-500'}`}
                  />
                  <span
                    className={`text-sm font-medium truncate ${
                      s.isActive ? 'text-white' : 'text-slate-500 line-through'
                    }`}
                  >
                    {s.name}
                  </span>
                  <span className="text-[10px] uppercase text-slate-500">{s.type}</span>
                </div>
                <button
                  onClick={() => toggle(s)}
                  disabled={busy === s.id}
                  className={`min-w-[92px] min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                    s.isActive
                      ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                      : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}
                >
                  {busy === s.id ? '…' : s.isActive ? 'Available' : 'Down'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
