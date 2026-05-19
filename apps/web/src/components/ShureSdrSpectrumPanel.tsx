'use client'

/**
 * RF Spectrum Monitor — wide-band SDR view of the wireless mic band.
 *
 * Lives inside ShureWirelessMicAdmin, between the Patterns digest and
 * the Event History, so RF coordination is a single workflow:
 *   1. Receivers + per-channel tiles (top)         — what WE'RE using
 *   2. Interference Patterns (AI)                   — what's HAPPENED
 *   3. RF Spectrum Monitor (SDR)  ← THIS COMPONENT — what's HAPPENING
 *   4. Event History                                — receipts trail
 *
 * Polls /api/sdr/status every 5s for liveness + active carriers, and
 * /api/sdr/history?minutesAgo=10 every 15s for the recent waterfall.
 *
 * Three visual states:
 *   - SDR disabled (no rtl-sdr / no dongle): explainer + setup instructions
 *   - SDR enabled + healthy + first sweep arrived: live waterfall + carriers
 *   - SDR enabled but no recent sweep: warning + last-seen
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Activity, Radio, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react'

// v2.44.0: replaced polling fetchHistory/fetchStatus with SSE consumer
// on /api/sdr/stream — sub-second waterfall updates instead of 15-sec
// polled redraws. STATUS_POLL_MS retained at slower rate just for the
// liveness header (lastSweepAt, totalAggregatedRows).
const STATUS_POLL_MS = 30_000
const WATERFALL_WINDOW_MIN = 10
const WATERFALL_WINDOW_SEC = WATERFALL_WINDOW_MIN * 60
const G58_BAND_MARKERS = [
  { freq: 476.000, label: 'WCWF↑' },   // CW 14 upper edge
  { freq: 500.000, label: 'WLUK↓' },   // Fox 11 lower edge
  { freq: 506.000, label: 'WLUK↑' },   // Fox 11 upper edge
]

type SseBucket = { bucketAt: number; bins: number[]; dbms: number[] }
type SseCarrier = { freqMhz: number; eventType: string; peakDbm: number | null; durationSec: number | null; detectedAt: number }

type StatusResp = {
  enabled: boolean
  healthy: boolean
  lastSweepAt: number | null
  ageSecs: number | null
  totalAggregatedRows: number
  activeCarriers: Array<{ freqMhz: number; peakDbm: number | null; lastSeenSec: number }>
}

type HistoryResp = {
  success: boolean
  bins: number[]
  times: number[]
  grid: number[][]
}

function colorForPower(dbm: number): string {
  // Color gradient matching operator-intuitive RF mental model.
  if (dbm <= -100) return '#0a1929' // deep blue — noise floor
  if (dbm <= -90)  return '#1e3a5f'
  if (dbm <= -85)  return '#22577a'
  if (dbm <= -80)  return '#1b9aaa' // teal — threshold
  if (dbm <= -70)  return '#06b6d4' // cyan — moderate
  if (dbm <= -60)  return '#a3e635' // lime — strong
  if (dbm <= -50)  return '#facc15' // yellow — very strong
  if (dbm <= -40)  return '#fb923c' // orange
  return '#ef4444' // red — loud
}

interface Props {
  /** Frequencies our receivers are tuned to, so we can annotate them */
  ourFrequencies?: Array<{ freqMhz: number; label: string }>
}

type InspectStat = {
  freqMhz: number
  maxDbm: number
  avgDbm: number
  p95Dbm: number | null
  hotMinutes: number
  lastHotAt: number | null
}

export default function ShureSdrSpectrumPanel({ ourFrequencies = [] }: Props) {
  const [status, setStatus] = useState<StatusResp | null>(null)
  // Rolling buffer of recent buckets, accumulated from SSE bucket
  // events. Evicted when older than WATERFALL_WINDOW_SEC. The
  // waterfall canvas re-renders any time this changes.
  const [buckets, setBuckets] = useState<SseBucket[]>([])
  const [sseStatus, setSseStatus] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting'>('idle')
  // Inspect popover — when operator clicks a column on the waterfall,
  // we fetch /api/sdr/peak-stats narrowed to ±0.025 MHz around that
  // freq + show recent stats for the bin. Click outside / click X
  // closes.
  const [inspect, setInspect] = useState<{ freqMhz: number; stats: InspectStat | null; loading: boolean } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sseRef = useRef<EventSource | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/sdr/status')
      if (!r.ok) return
      const d = await r.json()
      if (d.success) setStatus(d)
    } catch { /* silent */ }
  }, [])

  // Status header (lastSweepAt, totalAggregatedRows, active carriers)
  // still polled — these are fine at 30-sec cadence and avoid having
  // to mirror the watcher's carrier-detection state machine in JS.
  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, STATUS_POLL_MS)
    return () => clearInterval(id)
  }, [fetchStatus])

  // SSE subscriber — replaces /api/sdr/history polling.
  // EventSource auto-reconnects with exponential backoff built into
  // the browser; we just track the state for the badge.
  useEffect(() => {
    if (!status?.enabled) return
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      setSseStatus('connecting')
      const es = new EventSource('/api/sdr/stream')
      sseRef.current = es

      es.addEventListener('hello', () => setSseStatus('connected'))

      es.addEventListener('bucket', (e: MessageEvent) => {
        try {
          const b: SseBucket = JSON.parse(e.data)
          const cutoff = Math.floor(Date.now() / 1000) - WATERFALL_WINDOW_SEC
          setBuckets((prev) => {
            // Insert in ascending order; evict any beyond the rolling
            // window so memory stays bounded across long sessions.
            const next = prev.filter((p) => p.bucketAt >= cutoff)
            // Skip duplicates (server may resend on reconnect seed).
            if (!next.some((p) => p.bucketAt === b.bucketAt)) next.push(b)
            next.sort((a, b) => a.bucketAt - b.bucketAt)
            return next
          })
        } catch { /* malformed event — silent */ }
      })

      es.addEventListener('carrier', (e: MessageEvent) => {
        try {
          const c: SseCarrier = JSON.parse(e.data)
          // Surface live carriers to the existing status object so the
          // bottom panel updates without waiting for the 30s status
          // poll. carrier_active / carrier_heartbeat add or refresh;
          // carrier_cleared removes.
          setStatus((s) => {
            if (!s) return s
            const others = s.activeCarriers.filter((x) => Math.abs(x.freqMhz - c.freqMhz) > 0.013)
            if (c.eventType === 'carrier_cleared') {
              return { ...s, activeCarriers: others }
            }
            return {
              ...s,
              activeCarriers: [
                ...others,
                { freqMhz: c.freqMhz, peakDbm: c.peakDbm, lastSeenSec: 0 },
              ],
            }
          })
        } catch { /* malformed event — silent */ }
      })

      es.addEventListener('heartbeat', () => { /* keep-alive only */ })

      es.onerror = () => {
        // EventSource auto-reconnects; just reflect the state. If the
        // server has been redeployed, the connection drops and the
        // browser reconnects on its own.
        setSseStatus('reconnecting')
      }
    }

    connect()
    return () => {
      cancelled = true
      sseRef.current?.close()
      sseRef.current = null
      setSseStatus('idle')
    }
  }, [status?.enabled])

  // Build the canvas-friendly grid from the rolling bucket buffer.
  // Memoized so we don't recompute on every render — only when
  // buckets change. Returns bins[] (sorted unique frequencies) and
  // grid[time_idx][freq_idx] = power dBm (-120 sentinel for missing).
  const history = useMemo<HistoryResp | null>(() => {
    if (buckets.length === 0) return null
    const binSet = new Set<number>()
    for (const b of buckets) for (const f of b.bins) binSet.add(f)
    const bins = Array.from(binSet).sort((a, b) => a - b)
    const binIdx = new Map(bins.map((f, i) => [f, i]))
    const times = buckets.map((b) => b.bucketAt)
    const grid: number[][] = Array.from({ length: times.length }, () =>
      Array(bins.length).fill(-120),
    )
    for (let ti = 0; ti < buckets.length; ti++) {
      const b = buckets[ti]
      for (let i = 0; i < b.bins.length; i++) {
        const fi = binIdx.get(b.bins[i])
        if (fi !== undefined) grid[ti][fi] = b.dbms[i]
      }
    }
    return { success: true, bins, times, grid }
  }, [buckets])

  // Render waterfall whenever new history arrives.
  useEffect(() => {
    if (!history || history.bins.length === 0 || history.times.length === 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const cellW = W / history.bins.length
    const cellH = H / history.times.length

    // Time axis is ascending → render top-to-bottom so newest is at
    // the bottom (operator-intuitive: data falls in like a real
    // waterfall display).
    for (let ti = 0; ti < history.times.length; ti++) {
      for (let fi = 0; fi < history.bins.length; fi++) {
        ctx.fillStyle = colorForPower(history.grid[ti][fi])
        ctx.fillRect(fi * cellW, ti * cellH, Math.ceil(cellW), Math.ceil(cellH))
      }
    }
    // Annotations: vertical lines at our tuned freqs + TV station boundaries
    const minF = history.bins[0]
    const maxF = history.bins[history.bins.length - 1]
    const xForFreq = (f: number) => ((f - minF) / (maxF - minF)) * W

    ctx.lineWidth = 1
    ctx.font = '10px ui-monospace, monospace'
    for (const m of G58_BAND_MARKERS) {
      if (m.freq < minF || m.freq > maxF) continue
      const x = xForFreq(m.freq)
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.setLineDash([2, 2])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillText(m.label, x + 2, 12)
    }
    for (const o of ourFrequencies) {
      if (o.freqMhz < minF || o.freqMhz > maxF) continue
      const x = xForFreq(o.freqMhz)
      ctx.strokeStyle = 'rgba(6,182,212,0.95)' // cyan
      ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      ctx.fillStyle = 'rgba(6,182,212,0.95)'
      ctx.fillText(o.label, x + 2, H - 4)
    }
  }, [history, ourFrequencies])

  if (!status) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
          <span className="text-sm text-slate-400">Loading spectrum status…</span>
        </div>
      </div>
    )
  }

  const accentColor =
    !status.enabled ? 'border-slate-700 bg-slate-800/50' :
    status.healthy ? 'border-purple-700/40 bg-purple-950/20' :
    'border-amber-600/40 bg-amber-950/15'

  return (
    <div className={`rounded-xl border p-4 ${accentColor}`}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${status.healthy ? 'text-purple-400' : 'text-slate-500'}`} />
          <h4 className="text-sm font-medium text-white">RF Spectrum Monitor (SDR)</h4>
          {status.enabled && (
            <>
              <span className={`text-[10px] font-bold uppercase tracking-wide ${status.healthy ? 'text-emerald-400' : 'text-amber-400'}`}>
                {status.healthy ? 'Live' : 'Waiting for sweep'}
              </span>
              {/* SSE connection state — distinct from "data is fresh"
                  (status.healthy). SSE down means waterfall stops
                  updating in real time; status poll still works. */}
              <span
                title={`Server-Sent Events stream: ${sseStatus}`}
                className={`text-[10px] font-mono uppercase ${
                  sseStatus === 'connected' ? 'text-emerald-400/70' :
                  sseStatus === 'connecting' ? 'text-cyan-400/70' :
                  sseStatus === 'reconnecting' ? 'text-amber-400/70' :
                  'text-slate-500'
                }`}
              >
                • SSE {sseStatus}
              </span>
            </>
          )}
        </div>
        {status.enabled && status.lastSweepAt && (
          <span className="text-[10px] text-slate-400 font-mono">
            last sweep {status.ageSecs}s ago · {status.totalAggregatedRows.toLocaleString()} rows
          </span>
        )}
      </div>

      {!status.enabled && (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <WifiOff className="w-4 h-4" />
            <span>SDR watcher is <span className="font-semibold text-slate-300">disabled</span>.</span>
          </div>
          <div className="text-slate-400 leading-relaxed">
            Wide-band RF monitoring requires an RTL-SDR (NooElec NESDR Smart or
            compatible) plugged into the PM2 host. When the dongle arrives:
          </div>
          <ol className="list-decimal list-inside text-slate-400 space-y-0.5 ml-1">
            <li>Plug into a USB 2.0 port via a 6+ ft extension cable (away from chassis RFI)</li>
            <li><code className="text-cyan-300 font-mono">sudo apt install rtl-sdr</code></li>
            <li>Add <code className="text-cyan-300 font-mono">blacklist dvb_usb_rtl28xxu</code> to <code className="text-cyan-300 font-mono">/etc/modprobe.d/blacklist-rtl.conf</code></li>
            <li><code className="text-cyan-300 font-mono">rtl_test -t</code> to verify the dongle works</li>
            <li>Set <code className="text-cyan-300 font-mono">SDR_ENABLED=true</code> in <code className="text-cyan-300 font-mono">.env</code>, restart PM2</li>
          </ol>
        </div>
      )}

      {status.enabled && !status.healthy && (
        <div className="flex items-start gap-2 text-xs text-amber-300/90">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div>Watcher is enabled but hasn't received a sweep in {status.ageSecs ?? '?'} seconds.</div>
            <div className="text-slate-400 mt-1">
              Common causes: rtl_power subprocess died (will auto-restart with backoff), USB
              dongle disconnected, kernel DVB driver grabbed the device. Check PM2 logs for
              <code className="ml-1 text-cyan-300 font-mono">[SDR-WATCHER]</code> entries.
            </div>
          </div>
        </div>
      )}

      {status.enabled && status.healthy && (
        <div className="space-y-3">
          {history && history.bins.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                Last {WATERFALL_WINDOW_MIN} min · {history.bins[0].toFixed(1)}–{history.bins[history.bins.length - 1].toFixed(1)} MHz
              </div>
              <canvas
                ref={canvasRef}
                width={1100}
                height={180}
                className="w-full rounded border border-slate-700 bg-slate-950 cursor-crosshair"
                style={{ imageRendering: 'pixelated' }}
                onClick={async (e) => {
                  if (!history || history.bins.length === 0) return
                  const canvas = e.currentTarget
                  const rect = canvas.getBoundingClientRect()
                  const xFrac = (e.clientX - rect.left) / rect.width
                  const minF = history.bins[0]
                  const maxF = history.bins[history.bins.length - 1]
                  const clickedFreq = minF + xFrac * (maxF - minF)
                  // Round to nearest 25 kHz step.
                  const freqMhz = Math.round(clickedFreq * 40) / 40
                  setInspect({ freqMhz, stats: null, loading: true })
                  try {
                    const r = await fetch(`/api/sdr/peak-stats?daysAgo=7&freqStart=${(freqMhz - 0.05).toFixed(3)}&freqEnd=${(freqMhz + 0.05).toFixed(3)}&topN=1`)
                    if (!r.ok) { setInspect({ freqMhz, stats: null, loading: false }); return }
                    const d = await r.json()
                    setInspect({ freqMhz, stats: d.stats?.[0] ?? null, loading: false })
                  } catch {
                    setInspect({ freqMhz, stats: null, loading: false })
                  }
                }}
              />
              <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 inline-block" style={{ background: '#0a1929' }} /> floor (≤−100)</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 inline-block" style={{ background: '#1b9aaa' }} /> threshold (−80)</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 inline-block" style={{ background: '#facc15' }} /> strong (−50)</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 inline-block" style={{ background: '#ef4444' }} /> loud (≥−40)</span>
                <span className="ml-auto text-slate-600">click any column to inspect · cyan vertical line = your mic freq</span>
              </div>
              {inspect && (
                <div className="mt-2 rounded border border-cyan-500/40 bg-cyan-950/30 p-3 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-mono font-medium text-cyan-200">
                      Inspect {inspect.freqMhz.toFixed(3)} MHz (last 7 days)
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspect(null)}
                      className="text-cyan-400 hover:text-cyan-200 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  {inspect.loading && <div className="text-cyan-400/70 italic">Querying peak-stats…</div>}
                  {!inspect.loading && !inspect.stats && (
                    <div className="text-cyan-400/70 italic">
                      No samples recorded for this frequency yet. The SDR may not have been running for long, or this freq sits outside the active sweep band.
                    </div>
                  )}
                  {inspect.stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-cyan-100">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-cyan-400">Max peak</div>
                        <div className="font-mono font-medium">{inspect.stats.maxDbm.toFixed(0)} dBm</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-cyan-400">95th percentile</div>
                        <div className="font-mono font-medium">{inspect.stats.p95Dbm?.toFixed(0) ?? '—'} dBm</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-cyan-400">Avg level</div>
                        <div className="font-mono font-medium">{inspect.stats.avgDbm.toFixed(0)} dBm</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-cyan-400">Minutes hot (≥−85)</div>
                        <div className="font-mono font-medium">{inspect.stats.hotMinutes} min</div>
                      </div>
                      {inspect.stats.lastHotAt && (
                        <div className="col-span-2 md:col-span-4 text-[10px] text-cyan-400/80">
                          Last hot: {new Date(inspect.stats.lastHotAt * 1000).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
              Active carriers ({status.activeCarriers.length})
            </div>
            {status.activeCarriers.length === 0 ? (
              <div className="text-xs text-slate-500 italic">No carriers above threshold right now. RF environment quiet.</div>
            ) : (
              <div className="space-y-1">
                {status.activeCarriers.map((c) => (
                  <div key={c.freqMhz} className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/60 border border-slate-700/50">
                    <span className="inline-flex items-center gap-2">
                      <Radio className="w-3 h-3 text-amber-400" />
                      <span className="font-mono text-xs text-slate-200">{c.freqMhz.toFixed(3)} MHz</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      peak {c.peakDbm?.toFixed(0) ?? '?'} dBm · {c.lastSeenSec}s ago
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
