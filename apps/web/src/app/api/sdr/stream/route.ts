/**
 * GET /api/sdr/stream  —  Server-Sent Events live stream of SDR data
 *
 * Day 3 of the SDR build: replaces the 15-second polling on the
 * spectrum panel with a push channel that emits the latest minute
 * bucket the moment it lands in sdr_spectrum, plus carrier_active /
 * carrier_cleared events from sdr_carriers as they happen.
 *
 * Why SSE not WebSockets:
 *   - One-way server→client, which is all we need.
 *   - Plays nice with the nginx proxy on port 3002 (no Upgrade
 *     handshake required, just Content-Type: text/event-stream and
 *     proxy_buffering off — already configured for /api/atlas/).
 *   - Auto-reconnects on disconnect with EventSource.
 *   - Works through the rate-limit middleware without per-frame
 *     accounting.
 *
 * Event shapes (newline-terminated JSON in data: lines):
 *   event: bucket
 *   data: { bucketAt, bins[], dbms[] }   ← one per minute, all freq bins for that bucket
 *
 *   event: carrier
 *   data: { freqMhz, eventType, peakDbm, durationSec }
 *
 *   event: heartbeat
 *   data: { at }                          ← every 30s, keeps proxies awake
 *
 * Client implementation lives in ShureSdrSpectrumPanel — replaces
 * setInterval polling with `new EventSource('/api/sdr/stream')`.
 *
 * Backpressure: pollDb runs every 1 second, only emits when there's
 * new data. Disconnected clients are detected via writer.closed and
 * cleanup happens on the writer.write rejection path.
 */

import { NextRequest } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { getSdrSweepEmitter, type SweepEvent } from '@/lib/sdr-sweep-emitter'

// Polling interval for fresh DB rows. The watcher writes per-minute
// aggregates so the natural cadence is 60s, but new CARRIER events
// can fire at any time — poll the events table every 1s, bucket
// rows every 5s (cheaper, no point checking faster than the watcher
// flushes).
const CARRIER_POLL_MS = 1_000
const BUCKET_POLL_MS = 5_000
const HEARTBEAT_MS = 30_000

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const encoder = new TextEncoder()
  let lastBucketAt = 0
  let lastCarrierAt = Math.floor(Date.now() / 1000)
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          )
        } catch {
          closed = true
        }
      }

      // Initial hello with the last 10 min of bucket data so a fresh
      // client connection has something to draw immediately (otherwise
      // they'd see an empty waterfall until the next minute rollover).
      try {
        const seed = await db.all<{
          freq_mhz: number
          max_dbm: number
          bucket_at: number
        }>(sql`
          SELECT freq_mhz, max_dbm, bucket_at
          FROM sdr_spectrum
          WHERE bucket_at >= ${Math.floor(Date.now() / 1000) - 600}
          ORDER BY bucket_at ASC, freq_mhz ASC
          LIMIT 50000
        `)
        // Bail if client disconnected during the seed query. Otherwise
        // the timers below are created and orphaned — abort handler
        // already fired before they existed, so cleanup never runs and
        // they tick until the process restarts. Caught by code review
        // on v2.45.0.
        if (closed) { try { controller.close() } catch {} ; return }
        if (seed.length > 0) {
          // Group by bucket_at so the client can render bucket-by-bucket.
          const byBucket = new Map<number, { bins: number[]; dbms: number[] }>()
          for (const r of seed) {
            const b = byBucket.get(r.bucket_at) ?? { bins: [], dbms: [] }
            b.bins.push(r.freq_mhz)
            b.dbms.push(r.max_dbm)
            byBucket.set(r.bucket_at, b)
          }
          for (const [bucketAt, data] of byBucket) {
            enqueue('bucket', { bucketAt, bins: data.bins, dbms: data.dbms })
          }
          lastBucketAt = Math.max(...Array.from(byBucket.keys()))
        }
        enqueue('hello', { at: Math.floor(Date.now() / 1000), seeded: seed.length })
      } catch (err) {
        // If sdr_spectrum doesn't exist yet (SDR watcher hasn't started),
        // just send the hello and start polling — the table is lazily
        // created by the watcher when it first writes.
        enqueue('hello', { at: Math.floor(Date.now() / 1000), seeded: 0 })
      }

      // Three concurrent timers — bucket poll, carrier poll, heartbeat.
      const bucketTimer = setInterval(async () => {
        if (closed) return
        try {
          const rows = await db.all<{
            freq_mhz: number
            max_dbm: number
            bucket_at: number
          }>(sql`
            SELECT freq_mhz, max_dbm, bucket_at
            FROM sdr_spectrum
            WHERE bucket_at > ${lastBucketAt}
            ORDER BY bucket_at ASC, freq_mhz ASC
            LIMIT 5000
          `)
          if (rows.length === 0) return
          const byBucket = new Map<number, { bins: number[]; dbms: number[] }>()
          for (const r of rows) {
            const b = byBucket.get(r.bucket_at) ?? { bins: [], dbms: [] }
            b.bins.push(r.freq_mhz)
            b.dbms.push(r.max_dbm)
            byBucket.set(r.bucket_at, b)
          }
          for (const [bucketAt, data] of byBucket) {
            enqueue('bucket', { bucketAt, bins: data.bins, dbms: data.dbms })
          }
          lastBucketAt = Math.max(lastBucketAt, ...Array.from(byBucket.keys()))
        } catch { /* sdr_spectrum may not exist yet */ }
      }, BUCKET_POLL_MS)

      const carrierTimer = setInterval(async () => {
        if (closed) return
        try {
          const rows = await db.all<{
            freq_mhz: number
            event_type: string
            peak_dbm: number | null
            duration_sec: number | null
            detected_at: number
          }>(sql`
            SELECT freq_mhz, event_type, peak_dbm, duration_sec, detected_at
            FROM sdr_carriers
            WHERE detected_at > ${lastCarrierAt}
            ORDER BY detected_at ASC
            LIMIT 100
          `)
          for (const r of rows) {
            enqueue('carrier', {
              freqMhz: r.freq_mhz,
              eventType: r.event_type,
              peakDbm: r.peak_dbm,
              durationSec: r.duration_sec,
              detectedAt: r.detected_at,
            })
            if (r.detected_at > lastCarrierAt) lastCarrierAt = r.detected_at
          }
        } catch { /* sdr_carriers may not exist yet */ }
      }, CARRIER_POLL_MS)

      const heartbeatTimer = setInterval(() => {
        enqueue('heartbeat', { at: Math.floor(Date.now() / 1000) })
      }, HEARTBEAT_MS)

      // v2.52.10: subscribe to per-sweep events from the watcher.
      // Each rtl_power band scan (~1 sec cadence) is assembled in
      // sdr-watcher.ts into one full-band sweep snapshot and emitted
      // via the globalThis EventEmitter singleton. We forward each
      // sweep to this SSE connection as a 'sweep' event. The UI uses
      // these for the FFT panadapter — sub-second freshness instead of
      // waiting for the per-minute aggregator flush.
      //
      // v2.52.19 fix (audit H1): register the abort handler IMMEDIATELY,
      // synchronously, after subscribing the sweep listener. Pre-fix
      // had a race window — if request.signal aborted between the
      // emitter.on(...) line and the abort listener registration, the
      // sweep listener leaked forever (EventEmitter held a ref to a
      // closure that referenced the now-dead controller). Order: hook
      // abort cleanup first, then subscribe.
      const sweepListener = (ev: SweepEvent) => {
        if (closed) return
        enqueue('sweep', { t: ev.t, bins: ev.bins, dbms: ev.dbms, startMhz: ev.startMhz, endMhz: ev.endMhz })
      }
      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(bucketTimer)
        clearInterval(carrierTimer)
        clearInterval(heartbeatTimer)
        getSdrSweepEmitter().off('sweep', sweepListener)
        try { controller.close() } catch { /* already closed */ }
      })
      getSdrSweepEmitter().on('sweep', sweepListener)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering for SSE
    },
  })
}
