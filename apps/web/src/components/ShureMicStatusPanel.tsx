'use client'

/**
 * Bartender Audio tab — live per-receiver / per-channel status tile
 * for Shure SLX-D wireless mic receivers.
 *
 * Shows battery, RSSI quality, frequency, TX type, runtime minutes,
 * and last-seen timestamp. Multi-receiver friendly — renders one
 * card per receiver, one row per channel.
 *
 * Polls /api/shure-rf/status every 3 seconds. Silent failure on
 * fetch error (banner is non-critical). Hidden entirely when no
 * Shure receivers configured (empty `receivers` array).
 */

import { useEffect, useState } from 'react'
import {
  Battery,
  BatteryLow,
  BatteryWarning,
  Mic,
  MicOff,
  Radio,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Signal,
  AlertCircle,
} from 'lucide-react'
import type { ShureChannelState, ShureReceiverSnapshot } from '@sports-bar/shure-slxd'

// Use the canonical types from the package — no local copies, so a
// future field addition to ShureChannelState (e.g. encryption state)
// surfaces here on next typecheck instead of silently being dropped.
type ShureStatusChannel = ShureChannelState
type ShureStatusReceiver = ShureReceiverSnapshot

type RssiTier = 'excellent' | 'good' | 'marginal' | 'poor' | 'off' | 'unknown'

function rssiTier(rssi: number | undefined, txOff: boolean): RssiTier {
  if (txOff) return 'off'
  if (rssi === undefined) return 'unknown'
  if (rssi >= -65) return 'excellent'
  if (rssi >= -75) return 'good'
  if (rssi >= -85) return 'marginal'
  return 'poor'
}

function rssiLabel(tier: RssiTier): string {
  switch (tier) {
    case 'excellent': return 'Excellent'
    case 'good': return 'Good'
    case 'marginal': return 'Marginal'
    case 'poor': return 'Poor'
    case 'off': return 'Mic off'
    default: return 'No signal'
  }
}

function rssiColor(tier: RssiTier): string {
  switch (tier) {
    case 'excellent': return 'text-green-400'
    case 'good': return 'text-teal-400'
    case 'marginal': return 'text-amber-400'
    case 'poor': return 'text-red-400'
    case 'off': return 'text-slate-500'
    default: return 'text-slate-500'
  }
}

function RssiIcon({ tier }: { tier: RssiTier }) {
  const cls = `w-4 h-4 ${rssiColor(tier)}`
  switch (tier) {
    case 'excellent': return <SignalHigh className={cls} />
    case 'good': return <SignalMedium className={cls} />
    case 'marginal': return <SignalLow className={cls} />
    case 'poor': return <Signal className={cls} />
    case 'off':
    default: return <Signal className={cls} />
  }
}

type BatteryTier = 'critical' | 'low' | 'mid' | 'good' | 'unknown' | 'off'

function batteryTier(bars: number | undefined, txOff: boolean): BatteryTier {
  if (txOff) return 'off'
  if (bars === undefined || bars === 255) return 'unknown'
  if (bars === 0) return 'critical'
  if (bars === 1) return 'low'
  if (bars <= 3) return 'mid'
  return 'good'
}

function BatteryDisplay({ tier, bars }: { tier: BatteryTier; bars: number | undefined }) {
  if (tier === 'unknown' || tier === 'off') {
    return (
      <div className="inline-flex items-center gap-1.5 text-slate-500">
        <Battery className="w-4 h-4" />
        <span className="text-xs">{tier === 'off' ? '—' : 'Unknown'}</span>
      </div>
    )
  }
  const color = tier === 'critical' ? 'text-red-400'
    : tier === 'low' ? 'text-amber-400'
    : tier === 'mid' ? 'text-teal-400'
    : 'text-green-400'
  const Icon = tier === 'critical' ? AlertCircle
    : tier === 'low' ? BatteryWarning
    : tier === 'mid' ? BatteryLow
    : Battery
  const label = tier === 'critical' ? 'CRITICAL'
    : tier === 'low' ? 'Replace soon'
    : `${bars}/5 bars`
  return (
    <div className={`inline-flex items-center gap-1.5 ${color}`}>
      <Icon className="w-4 h-4" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}

function relativeSecs(ts: number | undefined, nowSec: number): string {
  if (!ts) return '—'
  const diff = Math.max(0, nowSec - ts)
  if (diff < 5) return 'now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function txTypeIcon(txType: string | undefined) {
  const t = (txType ?? '').toUpperCase()
  if (t === 'UNKNOWN' || !t) return <MicOff className="w-4 h-4 text-slate-500" />
  return <Mic className="w-4 h-4 text-cyan-400" />
}

function txTypeLabel(txType: string | undefined): string {
  const t = (txType ?? '').toUpperCase()
  if (t === 'SLXD1') return 'Bodypack'
  if (t === 'SLXD2') return 'Handheld'
  if (t === 'UNKNOWN' || !t) return 'Off'
  return t
}

export default function ShureMicStatusPanel() {
  const [receivers, setReceivers] = useState<ShureStatusReceiver[]>([])
  const [loaded, setLoaded] = useState(false)
  const [nowSec, setNowSec] = useState(Math.floor(Date.now() / 1000))

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const r = await fetch('/api/shure-rf/status')
        if (!r.ok || cancelled) return
        const j = await r.json()
        if (Array.isArray(j.receivers)) {
          setReceivers(j.receivers)
        }
        setLoaded(true)
        setNowSec(Math.floor(Date.now() / 1000))
      } catch {
        // Silent — read-only panel, network blips are non-critical
      }
    }
    poll()
    const id = setInterval(poll, 3_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Render nothing until first fetch returns OR if no receivers
  // configured — keeps the Audio tab uncluttered at locations
  // without a Shure unit.
  if (!loaded || receivers.length === 0) return null

  return (
    <div className="space-y-3">
      {receivers.map((rcv) => (
        <div
          key={rcv.receiverId}
          className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Radio className={`w-4 h-4 flex-shrink-0 ${rcv.connected ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span className="font-medium text-white text-sm truncate">{rcv.receiverName}</span>
              {rcv.model && (
                <span className="text-[10px] text-slate-500 font-mono">{rcv.model}</span>
              )}
              {rcv.rfBand && (
                <span className="text-[10px] text-slate-500 font-mono">{rcv.rfBand}</span>
              )}
            </div>
            <span
              className={`text-[10px] font-medium uppercase tracking-wide ${
                rcv.connected ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {rcv.connected ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div className="space-y-2">
            {rcv.channels.length === 0 && (
              <div className="text-xs text-slate-500">Waiting for first sample…</div>
            )}
            {rcv.channels.map((ch) => {
              // Use battery bars (in every SAMPLE frame) as the TX-present
              // signal, not txType (slow-changing REP-on-change property).
              // Holmgren 2026-05-18: receiver had bars=4 RSSI=-61dBm
              // audio active, but txType was still undefined because no
              // TX_TYPE REP had arrived since connect — tile dimmed and
              // showed "off" while the TX was clearly live.
              const hasBattery = ch.txBattBars !== undefined && ch.txBattBars !== 255
              const hasAudio = (ch.audioPeakDbfs ?? -120) > -95
              const txOff = !hasBattery && !hasAudio
              const rTier = rssiTier(ch.rssiDbm, txOff)
              const bTier = batteryTier(ch.txBattBars, txOff)
              const muted = txOff
              return (
                <div
                  key={ch.channel}
                  className={`rounded-lg border p-3 ${
                    muted
                      ? 'border-slate-800 bg-slate-900/50'
                      : 'border-slate-700 bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {txTypeIcon(ch.txType)}
                      <span className={`text-sm font-medium truncate ${muted ? 'text-slate-500' : 'text-slate-200'}`}>
                        {ch.channelName || `Channel ${ch.channel}`}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        ch {ch.channel} · {txTypeLabel(ch.txType)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {relativeSecs(ch.lastSampleAt ?? ch.lastRepAt, nowSec)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* RSSI / signal quality */}
                    <div className="flex flex-col">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Signal</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <RssiIcon tier={rTier} />
                        <span className={`text-xs font-medium ${rssiColor(rTier)}`}>
                          {rssiLabel(rTier)}
                        </span>
                      </div>
                      {ch.rssiDbm !== undefined && !muted && (
                        <div className="mt-0.5 text-[10px] text-slate-400 font-mono">
                          {ch.rssiDbm.toFixed(0)} dBm
                        </div>
                      )}
                    </div>

                    {/* Battery */}
                    <div className="flex flex-col">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Battery</div>
                      <div className="mt-0.5">
                        <BatteryDisplay tier={bTier} bars={ch.txBattBars} />
                      </div>
                      {ch.txBattRuntimeMin !== undefined &&
                        ch.txBattRuntimeMin < 65_000 && !muted && (
                        <div className="mt-0.5 text-[10px] text-slate-400 font-mono">
                          {ch.txBattRuntimeMin} min left
                        </div>
                      )}
                    </div>

                    {/* Frequency */}
                    <div className="flex flex-col">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Frequency</div>
                      <div className={`mt-0.5 text-xs font-mono ${muted ? 'text-slate-500' : 'text-slate-200'}`}>
                        {ch.frequencyMhz !== undefined ? `${ch.frequencyMhz.toFixed(3)} MHz` : '—'}
                      </div>
                      {ch.groupChannel && (
                        <div className="mt-0.5 text-[10px] text-slate-500 font-mono">
                          grp {ch.groupChannel}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
