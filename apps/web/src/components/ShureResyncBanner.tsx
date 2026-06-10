'use client'

/**
 * Bartender Audio tab — wireless-mic re-sync warning banner.
 *
 * Shows when an admin has queued a receiver-side freq change via
 * POST /api/shure-rf/queue-freq-change. The banner stays up until the
 * shure-rf-watcher detects that the transmitter has been IR-synced AND
 * keyed up on the new frequency (TX_MODEL != UNKNOWN + audio active).
 *
 * Polls /api/shure-rf/pending-resync every 5 sec. Renders nothing when
 * no pending entries — invisible to the bartender during normal
 * operation.
 *
 * Workflow visible to the bartender:
 *   1. Admin clicks "Move to 503 MHz" in the wireless-mic admin
 *   2. This banner appears: "⚠ Mic 1 needs re-sync — Receiver moved
 *      from 485.325 MHz to 503.000 MHz. IR-sync the transmitter."
 *   3. Bartender powers on the mic + holds it near the receiver's
 *      IR port, presses SYNC
 *   4. Mic keys up on the new freq, watcher confirms, banner clears
 *
 * Wrapped in <SafeBoundary> per [[feedback-safeboundary-for-new-panels]]
 * since this is brand-new code on the bartender's most-touched tab.
 */

import { useEffect, useState } from 'react'
import { Radio, AlertTriangle } from 'lucide-react'
import SafeBoundary from './SafeBoundary'

interface PendingResync {
  id: string
  receiverId: string
  receiverName: string | null
  channel: number
  oldFreqMhz: number
  newFreqMhz: number
  setAt: number
  setAtIso: string
  ageSec: number
  notes: string | null
}

interface ApiResponse {
  success: boolean
  count: number
  pending: PendingResync[]
}

const POLL_INTERVAL_MS = 5_000

function formatAge(secs: number): string {
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)} min`
  if (secs < 86400) {
    const h = Math.floor(secs / 3600)
    return `${h} hr`
  }
  const d = Math.floor(secs / 86400)
  return `${d} day${d === 1 ? '' : 's'}`
}

function ShureResyncBannerInner() {
  const [pending, setPending] = useState<PendingResync[]>([])

  useEffect(() => {
    let cancelled = false

    async function fetchPending() {
      try {
        const res = await fetch('/api/shure-rf/pending-resync', {
          cache: 'no-store',
        })
        if (!res.ok) return
        const json = (await res.json()) as ApiResponse
        if (cancelled) return
        if (json.success) {
          setPending(json.pending ?? [])
        }
      } catch {
        // Silent — banner is non-critical; the alternative is showing
        // a fake-positive warning when the API hiccups, which is worse.
      }
    }

    fetchPending()
    const id = setInterval(fetchPending, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (pending.length === 0) return null

  return (
    <div className="space-y-2">
      {pending.map((p) => (
        <div
          key={p.id}
          className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 flex items-start gap-3"
          role="alert"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Radio className="w-4 h-4 text-amber-300" />
              <span className="text-sm font-semibold text-amber-200">
                Wireless mic needs re-sync —{' '}
                {p.receiverName ? p.receiverName + ' / ' : ''}
                Channel {p.channel}
              </span>
              <span className="text-[10px] text-amber-400/70 font-mono">
                queued {formatAge(p.ageSec)} ago
              </span>
            </div>
            <div className="mt-1 text-sm text-amber-100 leading-snug">
              Receiver was moved from{' '}
              <span className="font-mono font-semibold text-amber-50">
                {p.oldFreqMhz > 0 ? `${p.oldFreqMhz.toFixed(3)} MHz` : '(prior freq unknown)'}
              </span>
              {' '}→{' '}
              <span className="font-mono font-semibold text-amber-50">
                {p.newFreqMhz.toFixed(3)} MHz
              </span>
              . Power on the matching transmitter, hold it near the
              receiver's IR port, and press <span className="font-semibold">SYNC</span>{' '}
              on the receiver's front panel.
            </div>
            <div className="mt-1.5 text-[11px] text-amber-300/80">
              This warning will clear automatically the first time the mic keys up on
              the new frequency.
            </div>
            {p.notes && (
              <div className="mt-1 text-[11px] text-amber-300/60 italic">
                Note: {p.notes}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ShureResyncBanner() {
  return (
    <SafeBoundary label="ShureResyncBanner">
      <ShureResyncBannerInner />
    </SafeBoundary>
  )
}
