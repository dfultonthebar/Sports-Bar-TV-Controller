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

// Classic SDR-spectrum-analyzer colormap. Mimics SDR# / GQRX / HDSDR's
// black → blue → cyan → green → yellow → red → white thermal gradient.
//
// v2.52.10: reverted to textbook -110 → 0 dBm range because the watcher
// now applies a -55 dB software calibration offset at ingest (per the
// rtl_power-is-uncalibrated-dBFS research digest). With offset applied:
//   ~ -110 dBm = black            (sub-thermal floor)
//   ~  -90 dBm = dark blue        (true noise floor — matches Shure RSSI)
//   ~  -70 dBm = cyan/green       (textbook wireless mic signal)
//   ~  -50 dBm = yellow           (loud mic at close range)
//   ~  -30 dBm = orange/red       (broadcast TV nearby)
//   ~    0 dBm = white            (transmitter blast / ADC clip)
const COLORMAP: Array<{ dbm: number; r: number; g: number; b: number }> = [
  { dbm: -110, r: 0,   g: 0,   b: 0   }, // black
  { dbm: -100, r: 0,   g: 0,   b: 48  }, // deep navy
  { dbm: -90,  r: 0,   g: 0,   b: 128 }, // dark blue — noise floor
  { dbm: -80,  r: 0,   g: 64,  b: 255 }, // blue
  { dbm: -70,  r: 0,   g: 200, b: 255 }, // cyan
  { dbm: -60,  r: 0,   g: 220, b: 0   }, // green — moderate signal
  { dbm: -50,  r: 180, g: 240, b: 0   }, // yellow-green
  { dbm: -40,  r: 255, g: 230, b: 0   }, // yellow
  { dbm: -30,  r: 255, g: 140, b: 0   }, // orange
  { dbm: -20,  r: 255, g: 0,   b: 0   }, // red — broadcast TV
  { dbm: -10,  r: 255, g: 80,  b: 80  }, // bright red
  { dbm:   0,  r: 255, g: 255, b: 255 }, // white
]

function colorForPower(dbm: number): string {
  // Clamp out-of-range to the endpoints
  if (dbm <= COLORMAP[0].dbm) {
    const c = COLORMAP[0]
    return `rgb(${c.r},${c.g},${c.b})`
  }
  if (dbm >= COLORMAP[COLORMAP.length - 1].dbm) {
    const c = COLORMAP[COLORMAP.length - 1]
    return `rgb(${c.r},${c.g},${c.b})`
  }
  // Find the two control points bracketing dbm, then linearly interpolate.
  for (let i = 0; i < COLORMAP.length - 1; i++) {
    const lo = COLORMAP[i]
    const hi = COLORMAP[i + 1]
    if (dbm >= lo.dbm && dbm <= hi.dbm) {
      const t = (dbm - lo.dbm) / (hi.dbm - lo.dbm)
      const r = Math.round(lo.r + (hi.r - lo.r) * t)
      const g = Math.round(lo.g + (hi.g - lo.g) * t)
      const b = Math.round(lo.b + (hi.b - lo.b) * t)
      return `rgb(${r},${g},${b})`
    }
  }
  // Defensive fallback (unreachable in practice — clamps above cover it)
  return 'rgb(0,0,0)'
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

// v2.52.9: shared X-mapping used by both FFT + waterfall canvases.
// Hoisted out of the per-render closure so the two render effects use
// identical math (was duplicated inline in v2.52.8).
function xForFreq(freq: number, minF: number, maxF: number, W: number): number {
  if (maxF === minF) return 0
  return ((freq - minF) / (maxF - minF)) * W
}

// v2.52.10: textbook -110 → 0 dBm range. The watcher's -55 dB
// calibration offset (sdr-watcher.ts SDR_DBM_OFFSET) now puts
// rtl_power's uncalibrated dBFS into proper antenna-port dBm
// register: noise floor ~-90, wireless mics -70 to -50, broadcast
// TV -30 to -10.
const FFT_DBM_MIN = -110
const FFT_DBM_MAX = 0
const FFT_GRID_DBM = [-110, -90, -70, -50, -30, -10]

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
  // v2.52.9: hover tooltip state — shared by both FFT and waterfall.
  // null when not hovering. Pos is relative to the canvas wrapper div.
  const [hoverInfo, setHoverInfo] = useState<{ freqMhz: number; dbm: number; xPct: number; yPx: number } | null>(null)
  // v2.52.10: live per-sweep snapshot pushed via SSE 'sweep' events.
  // When set, this overrides fftSnapshot (which derives from the
  // slower per-minute buckets). Null until the first sweep arrives.
  const [liveSweep, setLiveSweep] = useState<{ bins: number[]; dbms: number[]; t: number } | null>(null)
  // v2.52.9: client-side ticking age counter so the "last sweep Xs ago"
  // header feels live between the 30s status polls (was static otherwise).
  const [tickSec, setTickSec] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fftCanvasRef = useRef<HTMLCanvasElement>(null)
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

      // v2.52.10: per-sweep snapshots for the FFT panadapter.
      // The watcher emits one `sweep` event per rtl_power band scan
      // (~1 sec cadence), giving the FFT line graph sub-second
      // freshness. The waterfall still uses per-minute `bucket`
      // events (long-term history view). Operator-reported 14:44:
      // "refresh is way too slow" — the bucket-derived FFT
      // refreshed once per minute, missing brief mic bursts.
      es.addEventListener('sweep', (e: MessageEvent) => {
        try {
          const sw: { t: number; bins: number[]; dbms: number[] } = JSON.parse(e.data)
          setLiveSweep({ bins: sw.bins, dbms: sw.dbms, t: sw.t })
        } catch { /* malformed event — silent */ }
      })

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

    ctx.lineWidth = 1
    ctx.font = '10px ui-monospace, monospace'
    for (const m of G58_BAND_MARKERS) {
      if (m.freq < minF || m.freq > maxF) continue
      const x = xForFreq(m.freq, minF, maxF, W)
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.setLineDash([2, 2])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillText(m.label, x + 2, 12)
    }
    for (const o of ourFrequencies) {
      if (o.freqMhz < minF || o.freqMhz > maxF) continue
      const x = xForFreq(o.freqMhz, minF, maxF, W)
      ctx.strokeStyle = 'rgba(6,182,212,0.95)' // cyan
      ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      ctx.fillStyle = 'rgba(6,182,212,0.95)'
      ctx.fillText(o.label, x + 2, H - 4)
    }
  }, [history, ourFrequencies])

  // v2.52.9: FFT panadapter — derive a current-snapshot line graph from
  // the latest bucket in the rolling buffer. Real spectrum-analyzer
  // look (SDR# / GQRX / HDSDR): lime-green line over a grid of dBm
  // gridlines, semi-transparent fill underneath, Shure freq overlays.
  const fftSnapshot = useMemo(() => {
    // v2.52.10: prefer the live per-sweep snapshot (1-sec freshness)
    // over the per-minute bucket-derived fallback. liveSweep updates
    // whenever the watcher emits a 'sweep' SSE event; buckets only
    // refresh on minute boundaries.
    if (liveSweep && liveSweep.bins.length > 0) {
      return { bins: liveSweep.bins, dbms: liveSweep.dbms, bucketAt: liveSweep.t }
    }
    if (buckets.length === 0) return null
    const latest = buckets[buckets.length - 1]
    if (latest.bins.length === 0) return null
    return { bins: latest.bins, dbms: latest.dbms, bucketAt: latest.bucketAt }
  }, [liveSweep, buckets])

  useEffect(() => {
    if (!fftSnapshot) return
    const canvas = fftCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const minF = fftSnapshot.bins[0]
    const maxF = fftSnapshot.bins[fftSnapshot.bins.length - 1]

    ctx.clearRect(0, 0, W, H)

    // dBm grid lines (horizontal)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.setLineDash([2, 4])
    ctx.lineWidth = 1
    for (const dbm of FFT_GRID_DBM) {
      const y = H - ((dbm - FFT_DBM_MIN) / (FFT_DBM_MAX - FFT_DBM_MIN)) * H
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }
    ctx.setLineDash([])

    // FFT line + fill under
    ctx.beginPath()
    for (let i = 0; i < fftSnapshot.bins.length; i++) {
      const x = xForFreq(fftSnapshot.bins[i], minF, maxF, W)
      const dbmClamped = Math.max(FFT_DBM_MIN, Math.min(FFT_DBM_MAX, fftSnapshot.dbms[i]))
      const y = H - ((dbmClamped - FFT_DBM_MIN) / (FFT_DBM_MAX - FFT_DBM_MIN)) * H
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    // Close path down to baseline for fill
    const lastX = xForFreq(fftSnapshot.bins[fftSnapshot.bins.length - 1], minF, maxF, W)
    const firstX = xForFreq(fftSnapshot.bins[0], minF, maxF, W)
    ctx.lineTo(lastX, H)
    ctx.lineTo(firstX, H)
    ctx.closePath()
    ctx.fillStyle = 'rgba(74,222,128,0.12)' // lime, semi-transparent
    ctx.fill()
    // Re-stroke the line on top of the fill (path was closed, redraw)
    ctx.beginPath()
    for (let i = 0; i < fftSnapshot.bins.length; i++) {
      const x = xForFreq(fftSnapshot.bins[i], minF, maxF, W)
      const dbmClamped = Math.max(FFT_DBM_MIN, Math.min(FFT_DBM_MAX, fftSnapshot.dbms[i]))
      const y = H - ((dbmClamped - FFT_DBM_MIN) / (FFT_DBM_MAX - FFT_DBM_MIN)) * H
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = '#4ade80' // lime-400 — SDR# signature color
    ctx.lineWidth = 1.25
    ctx.stroke()

    // Shure freq overlays + TV markers (same as waterfall, shared X-axis)
    ctx.lineWidth = 1
    for (const o of ourFrequencies) {
      if (o.freqMhz < minF || o.freqMhz > maxF) continue
      const x = xForFreq(o.freqMhz, minF, maxF, W)
      ctx.strokeStyle = 'rgba(6,182,212,0.7)'
      ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    for (const m of G58_BAND_MARKERS) {
      if (m.freq < minF || m.freq > maxF) continue
      const x = xForFreq(m.freq, minF, maxF, W)
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.setLineDash([2, 2])
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    ctx.setLineDash([])
  }, [fftSnapshot, ourFrequencies])

  // v2.52.9: 1-second tick to make the "last sweep Xs ago" feel live.
  // Increments tickSec; the display computes (status.ageSecs + tickSec)
  // minus tick at last poll. Simpler: just force a re-render every sec.
  useEffect(() => {
    const id = setInterval(() => setTickSec((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // v2.52.9: shared click + hover handlers for both FFT and waterfall.
  // Both panels share the same X-axis math, so clicking either yields
  // the same freq inspect. Hover shows freq + current dBm — bartender-
  // grade copy ("(click to inspect)").
  const handleSpectrumClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>, h: HistoryResp) => {
      if (h.bins.length === 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const xFrac = (e.clientX - rect.left) / rect.width
      const minF = h.bins[0]
      const maxF = h.bins[h.bins.length - 1]
      const clickedFreq = minF + xFrac * (maxF - minF)
      const freqMhz = Math.round(clickedFreq * 40) / 40
      setInspect({ freqMhz, stats: null, loading: true })
      try {
        const r = await fetch(
          `/api/sdr/peak-stats?daysAgo=7&freqStart=${(freqMhz - 0.05).toFixed(3)}&freqEnd=${(freqMhz + 0.05).toFixed(3)}&topN=1`,
        )
        if (!r.ok) {
          setInspect({ freqMhz, stats: null, loading: false })
          return
        }
        const d = await r.json()
        setInspect({ freqMhz, stats: d.stats?.[0] ?? null, loading: false })
      } catch {
        setInspect({ freqMhz, stats: null, loading: false })
      }
    },
    [],
  )

  const handleSpectrumHover = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>, h: HistoryResp, panel: 'fft' | 'waterfall') => {
      if (h.bins.length === 0 || !fftSnapshot) return
      const rect = e.currentTarget.getBoundingClientRect()
      const xFrac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const yPx = e.clientY - rect.top
      const minF = h.bins[0]
      const maxF = h.bins[h.bins.length - 1]
      const freqMhz = minF + xFrac * (maxF - minF)
      // Find closest bin in latest FFT snapshot to read dBm.
      let bestIdx = 0
      let bestDelta = Infinity
      for (let i = 0; i < fftSnapshot.bins.length; i++) {
        const d = Math.abs(fftSnapshot.bins[i] - freqMhz)
        if (d < bestDelta) {
          bestDelta = d
          bestIdx = i
        }
      }
      const dbm = fftSnapshot.dbms[bestIdx] ?? -120
      // Position tooltip near the cursor but offset for the panel
      // (FFT canvas height=56, waterfall=140; we report yPx relative
      // to the parent wrapper so it positions correctly regardless of
      // which panel was hovered).
      const wrapperY = panel === 'fft' ? yPx : yPx + 56 + 12 // +12 for shared X-axis
      setHoverInfo({ freqMhz, dbm, xPct: xFrac * 100, yPx: wrapperY })
    },
    [fftSnapshot],
  )

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
            {/* v2.52.9: compute live age from lastSweepAt + Date.now()
                so it ticks every second (re-render driven by tickSec),
                not just on each 30s status poll. */}
            last sweep {Math.max(0, Math.floor(Date.now() / 1000 - status.lastSweepAt))}s ago
            {' · '}{status.totalAggregatedRows.toLocaleString()} rows
            {tickSec >= 0 ? '' : ''}
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
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                <span>
                  Live spectrum · {history.bins[0].toFixed(1)}–{history.bins[history.bins.length - 1].toFixed(1)} MHz
                </span>
                <span className="text-slate-500 normal-case tracking-normal">
                  FFT (now) over waterfall (last {WATERFALL_WINDOW_MIN} min · {history.times.length} snapshots)
                </span>
              </div>

              {/* v2.52.9: stacked FFT + waterfall with shared X-axis.
                  Both canvases use the same xForFreq math so a freq at
                  X-pixel-N on the FFT lines up with the same X-pixel-N
                  on the waterfall column. */}
              <div className="relative">
                {/* FFT panadapter — current snapshot, lime line graph */}
                <div className="relative">
                  <div className="absolute left-1 top-0 h-full flex flex-col justify-between text-[8px] text-slate-500 font-mono pointer-events-none select-none z-10">
                    <span>0</span>
                    <span>−40</span>
                    <span>−75</span>
                    <span>−110</span>
                  </div>
                  {/* v2.52.9 (operator preference): FFT is the primary
                      view, expanded to 160px. Waterfall demoted to a
                      thin 50px strip below for "what changed recently"
                      context. */}
                  <canvas
                    ref={fftCanvasRef}
                    width={1100}
                    height={160}
                    className="w-full rounded-t border border-b-0 border-slate-700 bg-slate-950 cursor-crosshair"
                    style={{ imageRendering: 'pixelated' }}
                    onClick={(e) => handleSpectrumClick(e, history)}
                    onMouseMove={(e) => handleSpectrumHover(e, history, 'fft')}
                    onMouseLeave={() => setHoverInfo(null)}
                  />
                </div>

                {/* Shared X-axis — freq labels rendered as real DOM text */}
                <div className="relative h-3 bg-slate-900 border-x border-slate-700">
                  {(() => {
                    const minF = history.bins[0]
                    const maxF = history.bins[history.bins.length - 1]
                    const labels: number[] = []
                    const step = Math.max(1, Math.ceil((maxF - minF) / 6))
                    for (let f = Math.ceil(minF); f <= Math.floor(maxF); f += step) labels.push(f)
                    return labels.map((f) => {
                      const pct = ((f - minF) / (maxF - minF)) * 100
                      return (
                        <span
                          key={f}
                          className="absolute top-0 text-[9px] text-slate-500 font-mono -translate-x-1/2"
                          style={{ left: `${pct}%` }}
                        >
                          {f}
                        </span>
                      )
                    })
                  })()}
                </div>

                {/* Waterfall — thin strip below FFT for "what changed
                    in the last 10 min" context. Demoted from primary
                    in v2.52.9 per operator preference (FFT is what
                    they want to see). */}
                <canvas
                  ref={canvasRef}
                  width={1100}
                  height={50}
                  className="w-full rounded-b border border-t-0 border-slate-700 bg-slate-950 cursor-crosshair"
                  style={{ imageRendering: 'pixelated' }}
                  onClick={(e) => handleSpectrumClick(e, history)}
                  onMouseMove={(e) => handleSpectrumHover(e, history, 'waterfall')}
                  onMouseLeave={() => setHoverInfo(null)}
                />

                {/* Hover tooltip (v2.52.9) — bartender-grade copy */}
                {hoverInfo && (
                  <div
                    className="absolute pointer-events-none z-20 px-2 py-1 rounded text-[10px] font-mono bg-slate-900/95 border border-cyan-500/40 text-cyan-100 shadow-lg whitespace-nowrap"
                    style={{
                      left: `${hoverInfo.xPct}%`,
                      top: hoverInfo.yPx,
                      transform: 'translate(8px, -100%)',
                    }}
                  >
                    {hoverInfo.freqMhz.toFixed(3)} MHz · {hoverInfo.dbm.toFixed(0)} dBm
                    <span className="text-slate-400 ml-1">(click to inspect)</span>
                  </div>
                )}
              </div>

              {/* Color legend — updated for the smooth thermal colormap */}
              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 flex-wrap">
                <span className="inline-flex items-center gap-1"><span className="w-3 h-2 inline-block rounded-sm" style={{ background: 'linear-gradient(to right, rgb(0,0,0), rgb(0,0,128), rgb(0,200,255), rgb(0,220,0), rgb(255,230,0), rgb(255,0,0), rgb(255,255,255))' }} /> −60 dBm (cold) → 0 dBm (hot, rtl_power scale)</span>
                <span className="ml-auto text-slate-600">click any column to inspect · cyan vertical line = your mic freq · white dashes = TV station edges</span>
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
