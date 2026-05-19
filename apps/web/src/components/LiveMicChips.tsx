'use client'

/**
 * Live Wireless Mic chips — compact persistent status strip for the
 * bartender Audio tab.
 *
 * The existing Atlas priority banner fires only when an audio input
 * crosses -45 dBFS (someone is speaking through the mic). That's the
 * loud, hard-to-miss alert. This strip is the OPPOSITE — a passive
 * always-visible indicator that just says "Mic 1 is paired and on"
 * even when the bartender isn't talking through it yet, so they know
 * at a glance whether a handheld is hot and could go live at any
 * moment.
 *
 * Driven by /api/shure-rf/status (already polled by
 * ShureMicStatusPanel further down the page; we share the bucket).
 * Hidden entirely when no Shure receiver is configured — same
 * pattern as ShureMicStatusPanel.
 */

import { useEffect, useState } from 'react'
import { Mic, MicOff, Battery, BatteryLow } from 'lucide-react'
import type { ShureReceiverSnapshot, ShureChannelState } from '@sports-bar/shure-slxd'

const POLL_INTERVAL_MS = 3_000

function isLive(ch: ShureChannelState): boolean {
  // Same TX-presence semantics as ShureMicStatusPanel v2.37.6:
  // battery bars (every SAMPLE) or audio activity, never the slow
  // TX_TYPE REP.
  const hasBattery = ch.txBattBars !== undefined && ch.txBattBars !== 255
  const hasAudio = (ch.audioPeakDbfs ?? -120) > -95
  return hasBattery || hasAudio
}

function batteryColor(bars: number | undefined): string {
  if (bars === undefined || bars === 255) return 'text-slate-500'
  if (bars <= 1) return 'text-red-400'
  if (bars <= 2) return 'text-amber-400'
  return 'text-emerald-400'
}

export default function LiveMicChips() {
  const [receivers, setReceivers] = useState<ShureReceiverSnapshot[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchStatus = async () => {
      try {
        const r = await fetch('/api/shure-rf/status')
        if (!r.ok) return
        const data = await r.json()
        if (cancelled) return
        setReceivers(data.receivers || [])
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    fetchStatus()
    const id = setInterval(fetchStatus, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Hide entirely until first fetch resolves, and when no receiver
  // is configured. Matches ShureMicStatusPanel — locations without
  // wireless mics shouldn't see Shure chrome at all.
  if (!loaded || receivers.length === 0) return null

  const channels = receivers.flatMap((r) =>
    r.channels.map((c) => ({ rec: r, ch: c }))
  )
  if (channels.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
        Wireless mics
      </span>
      {channels.map(({ rec, ch }) => {
        const live = isLive(ch)
        const Icon = live ? Mic : MicOff
        const lowBatt = ch.txBattBars !== undefined && ch.txBattBars !== 255 && ch.txBattBars <= 1
        const BattIcon = lowBatt ? BatteryLow : Battery
        const battCls = batteryColor(ch.txBattBars)
        return (
          <div
            key={`${rec.receiverId}-${ch.channel}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
              live
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700 bg-slate-800/60 text-slate-500'
            }`}
            title={
              live
                ? `${ch.channelName || `Channel ${ch.channel}`}: paired and on ` +
                  `(${ch.rssiDbm?.toFixed(0) ?? '?'} dBm, bars=${ch.txBattBars ?? '?'})`
                : `${ch.channelName || `Channel ${ch.channel}`}: TX off / no carrier`
            }
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="truncate max-w-[120px]">{ch.channelName || `Channel ${ch.channel}`}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wide ${live ? 'text-emerald-400' : 'text-slate-500'}`}>
              {live ? 'Live' : 'Off'}
            </span>
            {live && (
              <span className={`inline-flex items-center gap-0.5 ${battCls}`}>
                <BattIcon className="w-3 h-3" />
                <span className="text-[10px] font-mono">
                  {ch.txBattBars !== undefined && ch.txBattBars !== 255 ? `${ch.txBattBars}/5` : '?'}
                </span>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
