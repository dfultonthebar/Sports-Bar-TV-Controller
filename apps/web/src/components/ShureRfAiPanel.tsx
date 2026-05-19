'use client'

/**
 * RF AI Panel — surfaces the Tier 3 daily Ollama-powered RF Pattern
 * Digest and the Tier 4 on-demand clean-freq suggestions in one card.
 * Sits on the Wireless Mics admin tab below ShureSdrSpectrumPanel.
 *
 * v2.52.15 — first UI for the v2.52.12-14 backend AI work. Until
 * this shipped, all that intelligence sat behind API endpoints with
 * no operator-visible surface.
 */

import { useEffect, useState, useCallback } from 'react'
import { Sparkles, RefreshCw, Search, AlertCircle } from 'lucide-react'

interface DigestResp {
  success: boolean
  digest: {
    id: string
    periodStart: number
    periodEnd: number
    summaryText: string
    structured: any
    modelUsed: string
    promptTokenCount: number | null
    completionTokenCount: number | null
    generationMs: number | null
    generatedAt: number
    ageSec: number
  } | null
  message?: string
}

interface CleanFreq {
  freqMhz: number
  avgDbm: number
  hotMinutes: number
  totalMinutes: number
  rationale: string
}

interface CleanFreqsResp {
  success: boolean
  topN: number
  suggestions: CleanFreq[]
  note: string | null
}

export default function ShureRfAiPanel() {
  const [digest, setDigest] = useState<DigestResp['digest'] | null>(null)
  const [digestLoading, setDigestLoading] = useState(false)
  const [digestErr, setDigestErr] = useState<string | null>(null)

  const [cleanFreqs, setCleanFreqs] = useState<CleanFreq[] | null>(null)
  const [cleanLoading, setCleanLoading] = useState(false)
  const [cleanErr, setCleanErr] = useState<string | null>(null)

  const fetchDigest = useCallback(async () => {
    setDigestErr(null)
    try {
      const r = await fetch('/api/sdr/digest')
      if (!r.ok) {
        setDigestErr(`HTTP ${r.status}`)
        return
      }
      const d: DigestResp = await r.json()
      setDigest(d.digest)
    } catch (e) {
      setDigestErr((e as Error).message)
    }
  }, [])

  const regenerateDigest = useCallback(async () => {
    setDigestLoading(true)
    setDigestErr(null)
    try {
      // Ollama qwen2.5:14b: 30-90 sec typical on iGPU
      const r = await fetch('/api/sdr/digest', { method: 'POST' })
      if (!r.ok) {
        setDigestErr(`HTTP ${r.status} — Ollama may be unreachable or overloaded`)
        return
      }
      // Refresh from GET to pull the freshly-stored row
      await fetchDigest()
    } catch (e) {
      setDigestErr((e as Error).message)
    } finally {
      setDigestLoading(false)
    }
  }, [fetchDigest])

  const findCleanFreqs = useCallback(async () => {
    setCleanLoading(true)
    setCleanErr(null)
    try {
      const r = await fetch('/api/sdr/clean-freqs?topN=5')
      if (!r.ok) {
        setCleanErr(`HTTP ${r.status}`)
        return
      }
      const d: CleanFreqsResp = await r.json()
      setCleanFreqs(d.suggestions)
      if (d.note) setCleanErr(d.note)
    } catch (e) {
      setCleanErr((e as Error).message)
    } finally {
      setCleanLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDigest()
  }, [fetchDigest])

  const fmtAge = (sec: number) => {
    if (sec < 60) return `${sec}s ago`
    if (sec < 3600) return `${Math.round(sec / 60)} min ago`
    if (sec < 86400) return `${Math.round(sec / 3600)} hr ago`
    return `${Math.round(sec / 86400)}d ago`
  }

  return (
    <div className="rounded-xl border border-purple-700/40 bg-purple-950/15 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <h4 className="text-sm font-medium text-white">RF AI Insights</h4>
        <span className="text-[10px] text-slate-500">Tier 3 + Tier 4 (v2.52.15)</span>
      </div>

      {/* DIGEST CARD */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">
            RF Environment Summary
            {digest && (
              <span className="ml-2 text-slate-500 normal-case tracking-normal">
                {fmtAge(digest.ageSec)} · {digest.modelUsed}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={regenerateDigest}
            disabled={digestLoading}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 disabled:opacity-50 disabled:cursor-wait font-mono"
          >
            <RefreshCw className={`w-3 h-3 ${digestLoading ? 'animate-spin' : ''}`} />
            {digestLoading ? 'Generating…' : 'Refresh'}
          </button>
        </div>

        {digestErr && (
          <div className="flex items-start gap-2 text-xs text-amber-300 mb-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{digestErr}</span>
          </div>
        )}

        {!digest && !digestErr && (
          <div className="text-xs text-slate-500 italic">
            No digest generated yet. Tap Refresh to generate one now (qwen2.5:14b — typically 30-90s).
          </div>
        )}

        {digest && (
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {digest.summaryText}
          </p>
        )}

        {digest?.structured?.counts && (
          <div className="mt-2 pt-2 border-t border-slate-700/50 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
            <div className="rounded bg-slate-800/50 p-1.5">
              <div className="text-slate-500">Shure interference (24h)</div>
              <div className="font-mono text-slate-200">{digest.structured.counts.shureEvents24h ?? 0}</div>
            </div>
            <div className="rounded bg-slate-800/50 p-1.5">
              <div className="text-slate-500">SDR carriers (24h)</div>
              <div className="font-mono text-slate-200">{digest.structured.counts.sdrCarriers24h ?? 0}</div>
            </div>
            <div className="rounded bg-slate-800/50 p-1.5">
              <div className="text-slate-500">SDR near our mics (24h)</div>
              <div className="font-mono text-slate-200">{digest.structured.counts.sdrCarriersOnOurFreqs24h ?? 0}</div>
            </div>
            <div className="rounded bg-slate-800/50 p-1.5">
              <div className="text-slate-500">Event attributions (24h)</div>
              <div className="font-mono text-slate-200">{digest.structured.counts.attributionsToday ?? 0}</div>
            </div>
          </div>
        )}
      </div>

      {/* FIND CLEAN FREQ CARD */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">
            Suggest a Clean Frequency
          </div>
          <button
            type="button"
            onClick={findCleanFreqs}
            disabled={cleanLoading}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 disabled:opacity-50 disabled:cursor-wait font-mono"
          >
            <Search className={`w-3 h-3 ${cleanLoading ? 'animate-pulse' : ''}`} />
            {cleanLoading ? 'Searching…' : 'Find clean freq'}
          </button>
        </div>

        {cleanErr && cleanFreqs === null && (
          <div className="flex items-start gap-2 text-xs text-amber-300">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{cleanErr}</span>
          </div>
        )}

        {cleanFreqs === null && !cleanErr && !cleanLoading && (
          <div className="text-xs text-slate-500 italic">
            Tap the button above. Scores 7 days of SDR data and ranks the quietest freqs in the G58 band, excluding your currently-tuned Shure freqs.
          </div>
        )}

        {cleanFreqs && cleanFreqs.length === 0 && (
          <div className="text-xs text-slate-500 italic">
            No clean candidates found. SDR may need more sweep history (~7 days) to score reliably.
          </div>
        )}

        {cleanFreqs && cleanFreqs.length > 0 && (
          <div className="space-y-1">
            {cleanFreqs.map((f, i) => (
              <div
                key={f.freqMhz}
                className="flex items-center justify-between px-2 py-1.5 rounded bg-slate-800/50 border border-slate-700/50"
              >
                <span className="inline-flex items-center gap-2">
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${i === 0 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-600/20 text-slate-400 border-slate-600/30'}`}>
                    #{i + 1}
                  </span>
                  <span className="font-mono text-sm text-slate-200">{f.freqMhz.toFixed(1)} MHz</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{f.rationale}</span>
              </div>
            ))}
          </div>
        )}

        {cleanErr && cleanFreqs !== null && (
          <div className="mt-2 text-[10px] text-amber-300/80 italic">{cleanErr}</div>
        )}
      </div>
    </div>
  )
}
