/**
 * Probe-then-latch circuit breaker for the remote Ollama.
 *
 * The `/api/tags` probe is the connectivity oracle (it returns instantly, unlike
 * a non-streaming /api/generate which only returns when generation finishes). We
 * probe on first import and every REMOTE_PROBE_INTERVAL_MS; `remoteIsUp()` reflects
 * the latched result. Per-call code additionally trips the breaker on a fast
 * connection error (remote died between probes) — see index.ts.
 *
 * State is hoisted to globalThis via Symbol.for() so every Next.js route bundle
 * shares ONE breaker (Gotcha #10), not N per-bundle copies.
 */
import {
  OLLAMA_REMOTE_BASE,
  REMOTE_PROBE_INTERVAL_MS,
  REMOTE_CONNECT_TIMEOUT_MS,
  hasRemote,
} from './config'

type CircuitState = 'open' | 'closed' // open = remote usable; closed = use local

interface Circuit {
  state: CircuitState
  lastProbeAt: number
  probeInFlight: Promise<void> | null
  timer: ReturnType<typeof setInterval> | null
}

const KEY = Symbol.for('@sports-bar/ollama-client.circuit')

function getCircuit(): Circuit {
  const g = globalThis as any
  if (!g[KEY]) {
    const c: Circuit = {
      // Optimistic when a remote is configured (a probe corrects it within ~3s);
      // permanently closed when no remote — every resolve goes local.
      state: hasRemote() ? 'open' : 'closed',
      lastProbeAt: 0,
      probeInFlight: null,
      timer: null,
    }
    g[KEY] = c
    if (hasRemote()) {
      void probeRemote() // non-blocking initial probe
      c.timer = setInterval(() => void probeRemote(), REMOTE_PROBE_INTERVAL_MS)
      // Don't keep the event loop alive just for probes.
      if (c.timer && typeof (c.timer as any).unref === 'function') (c.timer as any).unref()
    }
  }
  return g[KEY] as Circuit
}

/** Probe the remote /api/tags; latch open/closed. In-flight lock prevents probe storms. */
export async function probeRemote(): Promise<void> {
  if (!hasRemote()) return
  const c = getCircuit()
  if (c.probeInFlight) return c.probeInFlight
  c.probeInFlight = (async () => {
    try {
      const res = await fetch(`${OLLAMA_REMOTE_BASE}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(REMOTE_CONNECT_TIMEOUT_MS),
      })
      c.state = res.ok ? 'open' : 'closed'
    } catch {
      c.state = 'closed'
    } finally {
      c.lastProbeAt = Date.now()
      c.probeInFlight = null
    }
  })()
  return c.probeInFlight
}

/** Mark remote down after a real call's connection failure; schedule a recovery probe. */
export function tripRemote(): void {
  getCircuit().state = 'closed'
  void probeRemote()
}

export function remoteIsUp(): boolean {
  if (!hasRemote()) return false
  return getCircuit().state === 'open'
}

export function circuitSnapshot(): { state: CircuitState; lastProbeAt: number } {
  const c = getCircuit()
  return { state: c.state, lastProbeAt: c.lastProbeAt }
}
