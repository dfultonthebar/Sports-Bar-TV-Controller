/**
 * SDR sweep emitter — globalThis singleton EventEmitter that lets the
 * SDR watcher push per-sweep raw bin data to the SSE stream route in
 * real time (1-sec cadence) without waiting for the per-minute
 * aggregator flush.
 *
 * Problem this solves (v2.52.10): the FFT panadapter in
 * ShureSdrSpectrumPanel.tsx derives its current-snapshot state from
 * `buckets[buckets.length - 1]`, which only refreshes when a new
 * SSE `bucket` event arrives — and buckets only flush on the per-
 * minute boundary. A 30-second DJ-mic burst at a neighboring bar
 * would either be diluted across the minute aggregate or missed
 * entirely if the burst crossed a minute boundary unevenly.
 *
 * Architecture:
 *   sdr-watcher.ts assembles a full-band sweep (across the multiple
 *   ~2.6 MHz chunks rtl_power emits per second) and calls
 *   `getSdrSweepEmitter().emit('sweep', { bins, dbms, t })` once per
 *   completed band scan.
 *
 *   /api/sdr/stream/route.ts subscribes via `on('sweep', ...)` and
 *   pushes a `sweep` SSE event to all connected clients. The
 *   component listens for `sweep` events and updates its
 *   `fftSnapshot` directly.
 *
 * Per-bundle hoisting (Gotcha #10): every Next.js route handler is
 * its own bundle, so a module-scope `new EventEmitter()` would be
 * per-bundle. We stash it on globalThis with Symbol.for() so the
 * watcher (running in instrumentation.ts's bundle) and the SSE
 * route (its own bundle) share the same emitter instance.
 */

import { EventEmitter } from 'events'

const KEY = Symbol.for('@sports-bar/sdr-sweep-emitter')

export interface SweepEvent {
  /** Unix seconds when the sweep was completed (band scan boundary). */
  t: number
  /** Frequency bin centers in MHz, ascending. */
  bins: number[]
  /** Power values in dBm (rtl_power native scale, +30-40 offset). */
  dbms: number[]
  /** Band boundaries (MHz) for sanity-checking the assembled sweep. */
  startMhz: number
  endMhz: number
}

export function getSdrSweepEmitter(): EventEmitter {
  const g = globalThis as any
  if (!g[KEY]) {
    const ee = new EventEmitter()
    // Bump max listeners — the SSE route can have multiple open
    // clients (operator's browser, fleet dashboard scraper, etc.).
    // Default is 10 which is too low for a long-lived process.
    ee.setMaxListeners(50)
    g[KEY] = ee
  }
  return g[KEY] as EventEmitter
}
