'use client'

/**
 * Shure SLX-D Wireless Mic admin panel — lives under Device Config.
 *
 * One place for everything Shure: setup, pre-install check, live
 * status, event history, dedicated log file inspection. Pulls from
 * the existing endpoints:
 *   - GET  /api/audio-processor      — list/CRUD (filtered to shure-slxd)
 *   - POST /api/audio-processor      — create (processorType='shure-slxd')
 *   - PUT  /api/audio-processor      — edit
 *   - DELETE /api/audio-processor    — remove
 *   - POST /api/shure-rf/preflight   — ADMIN-gated pre-install check
 *   - GET  /api/shure-rf/status      — live per-channel state
 *   - GET  /api/shure-rf             — event history
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Radio,
  Plus,
  Edit2,
  Trash2,
  PlayCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Battery,
  BatteryLow,
  BatteryWarning,
  Mic,
  MicOff,
  AlertCircle,
  FileText,
  X,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logger } from '@sports-bar/logger'
import type { ShureChannelState, ShureReceiverSnapshot } from '@sports-bar/shure-slxd'
import ShureSdrSpectrumPanel from './ShureSdrSpectrumPanel'
import SafeBoundary from './SafeBoundary'

interface ShureReceiverRow {
  id: string
  name: string
  model: string
  ipAddress: string
  tcpPort: number
  description?: string
  status: 'online' | 'offline' | 'error'
}

interface PreflightCheck { name: string; passed: boolean; detail: string }
interface PreflightResult {
  ready: boolean
  checks: PreflightCheck[]
  receiver: { model: string | null; firmwareVersion: string | null; rfBand: string | null }
}

interface HistoryEvent {
  id: string
  receiver_id: string
  receiver_name: string | null
  channel: number
  event_type: string
  rssi_dbm: number | null
  frequency_mhz: number | null
  tx_type: string | null
  note: string | null
  detected_at: number
  detected_at_iso: string
  seconds_ago: number
}

const SHURE_MODELS = [
  { value: 'SLXD4', label: 'SLXD4 — single rx', channels: 1 },
  { value: 'SLXD4D', label: 'SLXD4D — dual rx', channels: 2 },
  { value: 'SLXD24', label: 'SLXD24 — handheld combo', channels: 1 },
  { value: 'SLXD24D', label: 'SLXD24D — dual handheld', channels: 2 },
  { value: 'SLXD14', label: 'SLXD14 — bodypack combo', channels: 1 },
  { value: 'SLXD14D', label: 'SLXD14D — dual bodypack', channels: 2 },
]

type FormState = {
  id?: string
  name: string
  model: string
  ipAddress: string
  tcpPort: number
  description: string
}

const EMPTY_FORM: FormState = {
  name: '',
  model: 'SLXD24D',
  ipAddress: '',
  tcpPort: 2202,
  description: '',
}

function rssiColor(dbm: number | undefined, txOff: boolean) {
  if (txOff) return 'text-slate-500'
  if (dbm === undefined) return 'text-slate-500'
  if (dbm >= -65) return 'text-green-400'
  if (dbm >= -75) return 'text-teal-400'
  if (dbm >= -85) return 'text-amber-400'
  return 'text-red-400'
}

function batteryDisplay(bars: number | undefined, txOff: boolean) {
  if (txOff) return { Icon: Battery, color: 'text-slate-500', label: 'Mic off' }
  if (bars === undefined || bars === 255) return { Icon: Battery, color: 'text-slate-500', label: 'Unknown' }
  if (bars === 0) return { Icon: AlertCircle, color: 'text-red-400', label: 'CRITICAL' }
  if (bars === 1) return { Icon: BatteryWarning, color: 'text-amber-400', label: 'Replace soon' }
  if (bars <= 3) return { Icon: BatteryLow, color: 'text-teal-400', label: `${bars}/5 bars` }
  return { Icon: Battery, color: 'text-green-400', label: `${bars}/5 bars` }
}

export default function ShureWirelessMicAdmin() {
  const [receivers, setReceivers] = useState<ShureReceiverRow[]>([])
  const [snapshots, setSnapshots] = useState<ShureReceiverSnapshot[]>([])
  const [history, setHistory] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)
  const [preflightRunning, setPreflightRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'active' | 'last-hour'>('all')
  // Inline-edit state for per-channel name/freq/gain. One channel at a
  // time across the whole page. Replaces the front-panel-menu workflow
  // operators used pre-v2.37.10 — see /api/shure-rf/channel route.
  const [editChannel, setEditChannel] = useState<{ receiverId: string; channel: number } | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; freqMhz: string; audioGain: string }>({
    name: '', freqMhz: '', audioGain: '',
  })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  // "Find clean freq" sweep state — software equivalent of receiver's
  // front-panel Group Scan, since SLX-D firmware 1.4.7.0 doesn't expose
  // scan via TCP 2202 (probed live, 16 candidate commands all returned
  // < REP ERR >). Sweeps ~12 G58 freqs, dwell 2.5s each.
  const [sweepRunning, setSweepRunning] = useState(false)
  const [sweepResults, setSweepResults] = useState<Array<{
    freq: number; samples: number; avgRssi: number; maxRssi: number; verdict: string
  }> | null>(null)
  const [sweepError, setSweepError] = useState<string | null>(null)
  // Pattern-digest (Stage 1 AI) — Ollama summary of recurring
  // interference patterns. On-demand via "Analyze" button, server
  // caches for 1h (POST is gated by ADMIN auth + AI rate limit).
  const [digest, setDigest] = useState<{
    text: string
    eventCount: number
    windowDays: number
    generatedAt: number
    stale: boolean
    stats?: any
    model?: string
  } | null>(null)
  const [digestRunning, setDigestRunning] = useState(false)
  const [digestError, setDigestError] = useState<string | null>(null)

  const fetchReceivers = useCallback(async () => {
    try {
      const r = await fetch('/api/audio-processor')
      const data = await r.json()
      const rows: ShureReceiverRow[] = (data.processors || [])
        .filter((p: any) => p.processorType === 'shure-slxd')
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          model: p.model,
          ipAddress: p.ipAddress,
          tcpPort: p.tcpPort,
          description: p.description,
          status: p.status,
        }))
      setReceivers(rows)
    } catch (err) {
      logger.error('Failed to fetch Shure receivers:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSnapshots = useCallback(async () => {
    try {
      const r = await fetch('/api/shure-rf/status')
      if (!r.ok) return
      const data = await r.json()
      setSnapshots(data.receivers || [])
    } catch {
      // silent — non-critical
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (historyFilter === 'active') params.set('active', 'true')
      params.set('limit', '100')
      const r = await fetch(`/api/shure-rf?${params}`)
      if (!r.ok) return
      const data = await r.json()
      let events: HistoryEvent[] = data.events || []
      if (historyFilter === 'last-hour') {
        events = events.filter((e) => e.seconds_ago <= 3600)
      }
      setHistory(events)
    } catch {
      // silent
    }
  }, [historyFilter])

  useEffect(() => {
    fetchReceivers()
    fetchSnapshots()
    fetchHistory()
    loadCachedDigest()
    const statusId = setInterval(fetchSnapshots, 3_000)
    const historyId = setInterval(fetchHistory, 10_000)
    return () => { clearInterval(statusId); clearInterval(historyId) }
  }, [fetchReceivers, fetchSnapshots, fetchHistory, loadCachedDigest])

  // Run a pre-flight against an explicit ip/port. Pass the form
  // button calls this with the form's current IP; the "re-test
  // existing receiver" row buttons pass the receiver's IP directly.
  // This avoids racing against React state updates — if we used
  // `form.ipAddress` here and the caller had just set it via
  // setForm(...), we'd read the stale closure value.
  const runPreflightAgainst = async (ip: string, port: number) => {
    const cleanIp = ip.trim()
    if (!cleanIp) {
      setMessage({ type: 'error', text: 'IP address required for pre-flight' })
      return
    }
    setPreflightRunning(true)
    setPreflight(null)
    try {
      const r = await fetch('/api/shure-rf/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: cleanIp, port }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || `Pre-flight failed (${r.status})` })
        return
      }
      setPreflight({ ready: data.ready, checks: data.checks, receiver: data.receiver })
      if (data.receiver?.model) {
        const detected = SHURE_MODELS.find((m) => m.value === data.receiver.model)
        if (detected) setForm((p) => ({ ...p, model: detected.value }))
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Pre-flight network error' })
    } finally {
      setPreflightRunning(false)
    }
  }

  // Form's "Run Pre-flight" button — uses the form's current IP/port.
  const runPreflight = () => runPreflightAgainst(form.ipAddress, form.tcpPort)

  // Per-row "Run Pre-flight" button — uses the row's stored IP/port
  // directly to avoid the React-state-race that the old setTimeout
  // path had (form.ipAddress would still be the previous value).
  const runPreflightForExisting = async (rec: ShureReceiverRow) => {
    setMessage(null)
    setPreflight(null)
    setForm({ ...EMPTY_FORM, ipAddress: rec.ipAddress, tcpPort: rec.tcpPort, name: rec.name })
    setShowForm(true)
    await runPreflightAgainst(rec.ipAddress, rec.tcpPort)
  }

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const url = '/api/audio-processor'
      const method = form.id ? 'PUT' : 'POST'
      const modelMeta = SHURE_MODELS.find((m) => m.value === form.model)
      const body = {
        id: form.id || undefined,
        name: form.name,
        processorType: 'shure-slxd',
        model: form.model,
        ipAddress: form.ipAddress.trim(),
        port: 80,
        tcpPort: form.tcpPort,
        connectionType: 'ethernet',
        zones: modelMeta?.channels ?? 2,
        description: form.description,
      }
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Save failed')
      setMessage({ type: 'success', text: form.id ? 'Receiver updated' : 'Receiver added' })
      setShowForm(false)
      setForm(EMPTY_FORM)
      setPreflight(null)
      await fetchReceivers()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const deleteReceiver = async (id: string, name: string) => {
    if (!confirm(`Delete Shure receiver "${name}"? This stops monitoring but does not affect the receiver hardware.`)) return
    try {
      const r = await fetch(`/api/audio-processor?id=${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Delete failed')
      setMessage({ type: 'success', text: 'Receiver removed' })
      await fetchReceivers()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const editReceiver = (rec: ShureReceiverRow) => {
    setForm({
      id: rec.id,
      name: rec.name,
      model: rec.model,
      ipAddress: rec.ipAddress,
      tcpPort: rec.tcpPort,
      description: rec.description || '',
    })
    setPreflight(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setForm(EMPTY_FORM)
    setPreflight(null)
  }

  const snapshotByReceiver = (id: string): ShureReceiverSnapshot | undefined =>
    snapshots.find((s) => s.receiverId === id)

  const loadCachedDigest = useCallback(async () => {
    try {
      const r = await fetch('/api/shure-rf/pattern-digest')
      if (!r.ok) return
      const data = await r.json()
      if (data.success && data.digest) {
        setDigest({
          text: data.digest,
          eventCount: data.eventCount,
          windowDays: data.windowDays,
          generatedAt: data.generatedAt,
          stale: !!data.stale,
          stats: data.stats,
          model: data.model,
        })
      }
    } catch { /* cache miss or net error — silent */ }
  }, [])

  const runDigest = async (force = false) => {
    setDigestRunning(true)
    setDigestError(null)
    try {
      const r = await fetch(`/api/shure-rf/pattern-digest${force ? '?force=true' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windowDays: 30 }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setDigestError(data.error || `Analysis failed (${r.status})`)
        return
      }
      setDigest({
        text: data.digest,
        eventCount: data.eventCount,
        windowDays: data.windowDays,
        generatedAt: data.generatedAt,
        stale: false,
        stats: data.stats,
        model: data.model,
      })
    } catch (err) {
      setDigestError((err as Error).message || 'Network error')
    } finally {
      setDigestRunning(false)
    }
  }

  const runFindCleanFreq = async (receiverId: string, channel: number) => {
    if (sweepRunning) return
    const ok = window.confirm(
      'Find Clean Frequency will tune Channel ' + channel + ' through ~12 candidate ' +
      'frequencies, dwelling 2.5s at each.\n\n' +
      'Effects:\n' +
      '• Channel unusable for ~30 seconds\n' +
      '• One audio click per hop (audible if mic is routed to speakers)\n' +
      '• Channel will end up on the last swept freq — re-PATCH to the best one\n' +
      '• TX handheld must NOT be powered on (will refuse if paired)\n' +
      '• Handheld will need re-SYNC after applying the new freq\n\n' +
      'Continue?',
    )
    if (!ok) return
    setSweepRunning(true)
    setSweepError(null)
    setSweepResults(null)
    try {
      const r = await fetch('/api/shure-rf/find-clean-freq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId, channel }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setSweepError(data.error || `Sweep failed (${r.status})`)
        return
      }
      setSweepResults(data.results)
      setMessage({
        type: 'success',
        text: `Sweep complete. Suggested: ${data.best?.freqMhz?.toFixed(3) ?? '?'} MHz (${data.best?.verdict ?? '?'}).`,
      })
    } catch (err) {
      setSweepError((err as Error).message || 'Network error')
    } finally {
      setSweepRunning(false)
    }
  }

  const openChannelEdit = (receiverId: string, ch: ShureChannelState) => {
    setEditError(null)
    setEditChannel({ receiverId, channel: ch.channel })
    setEditForm({
      name: ch.channelName ?? '',
      freqMhz: ch.frequencyMhz !== undefined ? ch.frequencyMhz.toFixed(3) : '',
      audioGain: ch.audioGainDb !== undefined ? String(ch.audioGainDb) : '',
    })
  }

  const closeChannelEdit = () => {
    setEditChannel(null)
    setEditError(null)
  }

  const submitChannelEdit = async (origCh: ShureChannelState) => {
    if (!editChannel) return
    setEditSaving(true)
    setEditError(null)
    try {
      // Only send fields the operator actually changed — keeps the
      // receiver's GROUP_CHAN intact when only the name changed
      // (SET FREQUENCY resets GROUP_CHAN to Manual).
      const body: Record<string, unknown> = {
        receiverId: editChannel.receiverId,
        channel: editChannel.channel,
      }
      const newName = editForm.name.trim()
      if (newName && newName !== (origCh.channelName ?? '')) body.name = newName
      const newFreq = parseFloat(editForm.freqMhz)
      if (
        Number.isFinite(newFreq) && newFreq > 0 &&
        Math.abs(newFreq - (origCh.frequencyMhz ?? -1)) > 0.0005
      ) body.freqMhz = newFreq
      const newGain = parseInt(editForm.audioGain, 10)
      if (Number.isFinite(newGain) && newGain !== (origCh.audioGainDb ?? 0)) body.audioGain = newGain

      if (Object.keys(body).length === 2) {
        // Only receiverId+channel, no real diff.
        closeChannelEdit()
        return
      }

      const r = await fetch('/api/shure-rf/channel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok || !data.success) {
        setEditError(data.error || `Edit failed (${r.status})`)
        return
      }
      if (data.warnings?.length) {
        setMessage({ type: 'success', text: `Saved. ⚠ ${data.warnings.join(' / ')}` })
      } else {
        setMessage({ type: 'success', text: 'Channel updated.' })
      }
      closeChannelEdit()
      fetchSnapshots()
    } catch (err) {
      setEditError((err as Error).message || 'Network error')
    } finally {
      setEditSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${
            message.type === 'success'
              ? 'border-green-500/40 bg-green-950/30 text-green-300'
              : 'border-red-500/40 bg-red-950/30 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Shure SLX-D Wireless Mics</h3>
          <p className="text-sm text-slate-400">
            RF interference detection + battery monitoring. {receivers.length === 0 && 'No receivers configured yet.'}
          </p>
        </div>
        <Button
          onClick={() => { setForm(EMPTY_FORM); setPreflight(null); setShowForm(true) }}
          className="bg-cyan-600 hover:bg-cyan-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Receiver
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={submitForm}
          className="rounded-xl border border-cyan-500/40 bg-slate-900/80 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-white font-medium">
              {form.id ? 'Edit Receiver' : 'Add Shure SLX-D Receiver'}
            </h4>
            <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Bar wireless mics"
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Model</label>
              <select
                value={form.model}
                onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
              >
                {SHURE_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">IP Address</label>
              <input
                type="text"
                value={form.ipAddress}
                onChange={(e) => setForm((p) => ({ ...p, ipAddress: e.target.value }))}
                placeholder="192.168.x.y"
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">TCP Port</label>
              <input
                type="number"
                value={form.tcpPort}
                onChange={(e) => setForm((p) => ({ ...p, tcpPort: parseInt(e.target.value) || 2202 }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
              />
              <p className="text-[10px] text-slate-500 mt-1">Default 2202</p>
            </div>
          </div>

          <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-cyan-200">
                Run pre-flight BEFORE saving. Verifies TCP reachable, third-party-controls enabled
                (default BLOCKED on new units — must be enabled on the receiver's
                front panel: <span className="font-mono">Menu → Advanced → Network → Allow Third-Party Controls</span>),
                firmware ≥ 1.1.0, model detected.
              </p>
              <Button
                type="button"
                onClick={runPreflight}
                disabled={preflightRunning || !form.ipAddress.trim()}
                className="bg-cyan-600 hover:bg-cyan-700 text-white flex-shrink-0"
              >
                {preflightRunning ? (
                  <span className="inline-flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Probing…</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><PlayCircle className="w-3 h-3" /> Run Pre-flight</span>
                )}
              </Button>
            </div>
            {preflight && (
              <div className="space-y-1 pt-1">
                <div className={`text-xs font-medium ${preflight.ready ? 'text-green-400' : 'text-amber-400'}`}>
                  {preflight.ready ? '✓ Ready to save' : '⚠ Issues found — fix before saving'}
                </div>
                {preflight.checks.map((chk) => (
                  <div key={chk.name} className="flex items-start gap-2 text-xs">
                    {chk.passed
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />}
                    <span className={chk.passed ? 'text-slate-300' : 'text-red-300'}>{chk.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="submit"
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? 'Saving…' : (form.id ? 'Update' : 'Save Receiver')}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm} className="text-slate-300">
              Cancel
            </Button>
          </div>
        </form>
      )}

      {receivers.length === 0 && !showForm && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-10 text-center">
          <Radio className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No Shure SLX-D receivers configured.</p>
          <p className="text-slate-500 text-xs mt-1">
            Click <span className="font-medium text-cyan-400">Add Receiver</span> to set one up.
          </p>
        </div>
      )}

      {receivers.length > 0 && (
        <div className="space-y-3">
          {receivers.map((rec) => {
            const snap = snapshotByReceiver(rec.id)
            return (
              <div
                key={rec.id}
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
              >
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Radio className={`w-4 h-4 ${snap?.connected ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <span className="font-medium text-white truncate">{rec.name}</span>
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${snap?.connected ? 'text-green-400' : 'text-red-400'}`}>
                        {snap?.connected ? 'Connected' : (rec.status === 'offline' ? 'Offline' : 'Pending')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {rec.model} · {rec.ipAddress}:{rec.tcpPort}
                      {snap?.firmwareVersion && ` · fw ${snap.firmwareVersion}`}
                      {snap?.rfBand && ` · band ${snap.rfBand}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      type="button"
                      onClick={() => runPreflightForExisting(rec)}
                      variant="ghost"
                      className="text-cyan-400 hover:bg-cyan-500/10"
                      title="Run pre-flight against this receiver"
                    >
                      <PlayCircle className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => editReceiver(rec)}
                      variant="ghost"
                      className="text-slate-300 hover:bg-slate-700"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => deleteReceiver(rec.id, rec.name)}
                      variant="ghost"
                      className="text-red-400 hover:bg-red-500/10"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {snap && snap.channels.length > 0 ? (
                  <div className="space-y-2">
                    {snap.channels.map((ch: ShureChannelState) => {
                      // TX-presence signal: battery bars + audio peak.
                      // Same fix as ShureMicStatusPanel v2.37.6 — txType
                      // is REP-on-change and may not arrive promptly;
                      // battery bars + audio peak are SAMPLE-frame fields
                      // pushed every second and are the real truth.
                      const hasBattery = ch.txBattBars !== undefined && ch.txBattBars !== 255
                      const hasAudio = (ch.audioPeakDbfs ?? -120) > -95
                      const txOff = !hasBattery && !hasAudio
                      const batt = batteryDisplay(ch.txBattBars, txOff)
                      const BIcon = batt.Icon
                      const RIcon = txOff ? MicOff : Mic
                      const isEditing = editChannel?.receiverId === rec.id && editChannel?.channel === ch.channel
                      return (
                        <div key={ch.channel} className={`rounded-lg border p-3 ${txOff ? 'border-slate-800 bg-slate-900/50' : 'border-slate-700 bg-slate-800/80'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <RIcon className={`w-4 h-4 ${txOff ? 'text-slate-500' : 'text-cyan-400'}`} />
                              <span className={`text-sm font-medium ${txOff ? 'text-slate-500' : 'text-slate-200'}`}>
                                {ch.channelName || `Channel ${ch.channel}`}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">ch {ch.channel}</span>
                            </div>
                            {!isEditing && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => openChannelEdit(rec.id, ch)}
                                className="h-7 px-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                                title="Edit channel name / frequency / gain"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-slate-500">Signal</div>
                              <div className={`mt-0.5 font-mono ${rssiColor(ch.rssiDbm, txOff)}`}>
                                {txOff ? '—' : (ch.rssiDbm !== undefined ? `${ch.rssiDbm.toFixed(0)} dBm` : '—')}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-slate-500">Battery</div>
                              <div className={`mt-0.5 inline-flex items-center gap-1 ${batt.color}`}>
                                <BIcon className="w-3.5 h-3.5" />
                                <span className="font-medium">{batt.label}</span>
                              </div>
                              {ch.txBattRuntimeMin !== undefined && ch.txBattRuntimeMin < 65_000 && !txOff && (
                                <div className="text-[10px] text-slate-400 mt-0.5">{ch.txBattRuntimeMin} min left</div>
                              )}
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-slate-500">Frequency</div>
                              <div className={`mt-0.5 font-mono ${txOff ? 'text-slate-500' : 'text-slate-200'}`}>
                                {ch.frequencyMhz !== undefined ? `${ch.frequencyMhz.toFixed(3)} MHz` : '—'}
                              </div>
                            </div>
                          </div>
                          {isEditing && (
                            <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                <label className="block">
                                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Channel name</span>
                                  <input
                                    type="text"
                                    value={editForm.name}
                                    maxLength={31}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="mt-0.5 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:border-cyan-500 focus:outline-none"
                                    placeholder="e.g. Mic 1"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Frequency (MHz)</span>
                                  <input
                                    type="number"
                                    value={editForm.freqMhz}
                                    step="0.025"
                                    onChange={(e) => setEditForm({ ...editForm, freqMhz: e.target.value })}
                                    className="mt-0.5 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                                    placeholder="e.g. 537.125"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Audio gain (dB)</span>
                                  <input
                                    type="number"
                                    value={editForm.audioGain}
                                    step="1"
                                    min="-18"
                                    max="42"
                                    onChange={(e) => setEditForm({ ...editForm, audioGain: e.target.value })}
                                    className="mt-0.5 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                                  />
                                </label>
                              </div>
                              <div className="text-[11px] text-amber-400/80">
                                ⚠ Changing the frequency resets GROUP/CHAN to Manual and requires re-SYNCing the TX
                                via IR (Menu → SYNC on the receiver).
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  type="button"
                                  onClick={() => runFindCleanFreq(rec.id, ch.channel)}
                                  disabled={sweepRunning || editSaving}
                                  variant="ghost"
                                  className="text-cyan-400 hover:bg-cyan-500/10 h-7 text-xs"
                                  title="Software equivalent of receiver's Group Scan — tunes through G58 candidate freqs and ranks by ambient RSSI"
                                >
                                  {sweepRunning ? (
                                    <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Sweeping (~30s)…</>
                                  ) : (
                                    <><PlayCircle className="w-3 h-3 mr-1" /> Find clean freq</>
                                  )}
                                </Button>
                              </div>
                              {sweepError && (
                                <div className="text-[11px] text-red-400 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> {sweepError}
                                </div>
                              )}
                              {sweepResults && sweepResults.length > 0 && (
                                <div className="pt-1 space-y-0.5">
                                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Sweep results (quietest first)</div>
                                  <div className="rounded border border-slate-700 bg-slate-900/50 max-h-40 overflow-y-auto">
                                    {sweepResults.slice(0, 8).map((res) => {
                                      const verdictColor =
                                        res.verdict === 'clean' ? 'text-emerald-400' :
                                        res.verdict === 'quiet' ? 'text-cyan-300' :
                                        res.verdict === 'moderate' ? 'text-amber-400' : 'text-red-400'
                                      return (
                                        <button
                                          key={res.freq}
                                          type="button"
                                          onClick={() => setEditForm({ ...editForm, freqMhz: res.freq.toFixed(3) })}
                                          className="w-full flex items-center justify-between px-2 py-1 text-xs hover:bg-slate-800/60 border-b border-slate-700/40 last:border-b-0"
                                          title="Click to use this frequency"
                                        >
                                          <span className="font-mono text-slate-200">{res.freq.toFixed(3)} MHz</span>
                                          <span className={`font-mono ${verdictColor}`}>
                                            {res.avgRssi.toFixed(0)} dBm · {res.verdict}
                                          </span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Click a row to set frequency, then Save.
                                  </div>
                                </div>
                              )}
                              {editError && (
                                <div className="text-xs text-red-400 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" /> {editError}
                                </div>
                              )}
                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  type="button"
                                  onClick={() => submitChannelEdit(ch)}
                                  disabled={editSaving}
                                  className="bg-cyan-500 hover:bg-cyan-600 text-white h-8"
                                >
                                  {editSaving ? (
                                    <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Saving…</>
                                  ) : (
                                    <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Save</>
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={closeChannelEdit}
                                  disabled={editSaving}
                                  className="text-slate-400 hover:text-slate-200 h-8"
                                >
                                  <X className="w-3.5 h-3.5 mr-1" /> Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">
                    Waiting for first sample (receiver may be unreachable — try Run pre-flight)
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-xl border border-cyan-700/40 bg-cyan-950/20 p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-medium text-white">Interference Patterns (AI)</h4>
            {digest && (
              <span className="text-xs text-slate-400">
                {digest.eventCount} events · last {digest.windowDays}d ·{' '}
                {(() => {
                  const ageSec = Math.max(0, Math.floor(Date.now() / 1000) - digest.generatedAt)
                  if (ageSec < 60) return `${ageSec}s ago`
                  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m ago`
                  return `${Math.floor(ageSec / 3600)}h ago`
                })()}
                {digest.stale && <span className="ml-1 text-amber-400">(stale)</span>}
              </span>
            )}
          </div>
          <Button
            type="button"
            onClick={() => runDigest(true)}
            disabled={digestRunning}
            className="bg-cyan-500 hover:bg-cyan-600 text-white h-8"
            title="Re-run Ollama analysis against the last 30 days of events"
          >
            {digestRunning ? (
              <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Analyzing…</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5 mr-1" /> {digest ? 'Re-analyze' : 'Analyze'}</>
            )}
          </Button>
        </div>
        {digestError && (
          <div className="mb-2 px-3 py-2 rounded border border-red-500/40 bg-red-950/30 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {digestError}
          </div>
        )}
        {!digest && !digestRunning && !digestError && (
          <div className="text-xs text-slate-400 italic">
            Click <span className="text-cyan-400 font-medium">Analyze</span> to run Ollama on the last
            30 days of RF events. Looks for recurring interference patterns by frequency, time-of-day,
            and day-of-week. ~60-180s on the iGPU.
          </div>
        )}
        {digestRunning && !digest && (
          <div className="text-xs text-slate-400 italic">
            Running Ollama analysis — this takes 60-180s on the Intel iGPU. Stay on the page.
          </div>
        )}
        {digest && (
          <div className="space-y-2">
            <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
              {digest.text}
            </div>
            <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-700/50">
              model: {digest.model ?? 'llama3.1:8b'} · cache TTL: 1h
            </div>
          </div>
        )}
      </div>

      {/* Wide-band SDR spectrum monitor — auto-hides into a setup
          explainer when SDR_ENABLED is unset. Frequencies passed
          through so the waterfall annotates our tuned freqs. Wrapped
          in SafeBoundary so a render crash here is contained to the
          section instead of taking down the whole Wireless Mics
          admin tab (Holmgren 2026-05-18: full page "Something went
          wrong" after v2.42.0 SDR mount — boundary isolates the
          fault so the surrounding admin remains usable while we
          diagnose). */}
      <SafeBoundary label="SDR Spectrum Monitor">
        <ShureSdrSpectrumPanel
          ourFrequencies={
            (snapshots || []).flatMap((r) =>
              (r?.channels || [])
                .filter((c) => typeof c?.frequencyMhz === 'number')
                .map((c) => ({
                  freqMhz: c.frequencyMhz!,
                  label: c.channelName?.trim() || `Ch${c.channel}`,
                })),
            )
          }
        />
      </SafeBoundary>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-medium text-white">Event History</h4>
            <span className="text-xs text-slate-500">{history.length} events</span>
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'active', 'last-hour'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setHistoryFilter(f)}
                className={`px-2 py-1 rounded text-xs ${
                  historyFilter === f
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f === 'all' ? 'All' : f === 'active' ? 'Active (30s)' : 'Last hour'}
              </button>
            ))}
          </div>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No events match — watcher writes startup rows on boot if no receivers configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="py-1.5 pr-3">Time</th>
                  <th className="py-1.5 pr-3">Receiver</th>
                  <th className="py-1.5 pr-3">Ch</th>
                  <th className="py-1.5 pr-3">Event</th>
                  <th className="py-1.5 pr-3">RSSI</th>
                  <th className="py-1.5 pr-3">Freq</th>
                  <th className="py-1.5">Note</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {history.slice(0, 100).map((e) => {
                  const isInterference = e.event_type === 'rf_interference' || e.event_type === 'rf_interference_heartbeat'
                  const isWarn = isInterference || e.event_type === 'low_battery'
                  return (
                    <tr key={e.id} className="border-t border-slate-700/50">
                      <td className="py-1.5 pr-3 font-mono text-slate-400">{new Date(e.detected_at * 1000).toLocaleTimeString()}</td>
                      <td className="py-1.5 pr-3">{e.receiver_name || '—'}</td>
                      <td className="py-1.5 pr-3 text-slate-400">{e.channel || '—'}</td>
                      <td className={`py-1.5 pr-3 font-medium ${isWarn ? 'text-amber-400' : 'text-slate-300'}`}>
                        {isWarn && <AlertTriangle className="inline w-3 h-3 mr-1" />}
                        {e.event_type}
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-slate-400">{e.rssi_dbm !== null ? `${e.rssi_dbm.toFixed(0)} dBm` : '—'}</td>
                      <td className="py-1.5 pr-3 font-mono text-slate-400">{e.frequency_mhz !== null ? `${e.frequency_mhz.toFixed(3)}` : '—'}</td>
                      <td className="py-1.5 text-slate-400 truncate max-w-md">{e.note || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
        <p className="text-xs text-slate-400">
          <span className="font-medium text-slate-300">Dedicated log file:</span>{' '}
          <code className="font-mono text-slate-300">/home/ubuntu/sports-bar-data/logs/shure-rf-YYYY-MM-DD.log</code>{' '}
          — daily rotation, 30-day retention. Mirrors through PM2 with tag <code className="font-mono text-slate-300">[SHURE-RF]</code>.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          <span className="font-medium text-slate-300">Mock receiver (for offline testing):</span>{' '}
          <code className="font-mono text-slate-300">npx tsx scripts/mock-shure-receiver.ts --port=2202 --scenario=interference-rising</code>{' '}
          — scenarios: clean, interference-rising, tx-battery-dying, coalesced-frames, partial-frames, third-party-controls-disabled.
        </p>
      </div>
    </div>
  )
}
