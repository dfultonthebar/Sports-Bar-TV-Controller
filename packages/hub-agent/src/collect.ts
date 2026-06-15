/**
 * Collectors — poll the location's own HTTP APIs (never the DB directly; PM2 holds
 * production.db and a second opener risks a lock per the orphan-DB-lock gotcha).
 * Every collector is defensive: on any failure it returns a best-effort object with
 * `raw` set to the error, and NEVER throws into the poll loop.
 */
import type {
  HealthPayload,
  MetricsPayload,
  SchedulerPayload,
  ErrorEvent,
  ErrorsPayload,
  ErrorSeverity,
  OverallStatus,
} from './types.js'

interface FetchResult {
  httpStatus: number
  body: any
  ok: boolean
  error?: string
}

async function fetchJson(url: string, timeoutMs = 15000): Promise<FetchResult> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } })
    let body: any = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    return { httpStatus: res.status, body, ok: res.ok }
  } catch (e: any) {
    return { httpStatus: 0, body: null, ok: false, error: e?.message || String(e) }
  } finally {
    clearTimeout(t)
  }
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

/** Pick the first defined numeric value across candidate paths. */
function pickNum(obj: any, paths: string[]): number | undefined {
  for (const p of paths) {
    const v = p.split('.').reduce((o: any, k) => (o == null ? o : o[k]), obj)
    const n = num(v)
    if (n !== undefined) return n
  }
  return undefined
}

export async function collectHealth(base: string): Promise<HealthPayload> {
  const r = await fetchJson(`${base}/api/health`)
  const b = r.body || {}
  // /api/health returns 200 healthy, 207 degraded, 503 critical
  let overallStatus: OverallStatus =
    (b.status as OverallStatus) ||
    (r.httpStatus === 200 ? 'healthy' : r.httpStatus === 207 ? 'degraded' : r.httpStatus === 503 ? 'critical' : 'unknown')
  if (!r.httpStatus) overallStatus = 'critical' // unreachable app
  return {
    overallStatus,
    httpStatus: r.httpStatus,
    version: b.version || b?.system?.version,
    devicesOnline: pickNum(b, ['metrics.onlineDevices', 'metrics.devicesOnline', 'devicesOnline']),
    devicesTotal: pickNum(b, ['metrics.totalDevices', 'metrics.devicesTotal', 'devicesTotal']),
    errorRate: pickNum(b, ['metrics.errorRate', 'errorRate']),
    raw: r.error ? { error: r.error } : b,
  }
}

export async function collectMetrics(base: string): Promise<MetricsPayload> {
  const r = await fetchJson(`${base}/api/system/metrics`)
  const b = r.body || {}
  // shape: { success, metrics: { cpu:{usage}, memory:{usage}, disk:{usage}, uptime, gpu:{usage} } }
  return {
    cpuUsagePct: pickNum(b, ['metrics.cpu.usage', 'cpu.usage', 'cpuUsage']),
    memUsedPct: pickNum(b, ['metrics.memory.usage', 'memory.usage', 'memUsedPct']),
    diskUsedPct: pickNum(b, ['metrics.disk.usage', 'disk.usage', 'diskUsedPct']),
    uptimeSec: pickNum(b, ['metrics.uptime', 'uptime', 'uptimeSeconds']),
    raw: r.error ? { error: r.error } : b.metrics || b,
  }
}

export async function collectScheduler(base: string): Promise<SchedulerPayload> {
  // /api/scheduler/status is 404; /api/scheduler/metrics returns { data: { summary: {...} } }
  const r = await fetchJson(`${base}/api/scheduler/metrics`)
  const b = r.body || {}
  const totalOps = pickNum(b, ['data.summary.totalOperations', 'summary.totalOperations', 'totalOps'])
  return {
    // this endpoint reports activity, not a live flag; treat "had operations" as running
    isRunning: totalOps !== undefined ? totalOps >= 0 : undefined,
    successRate: pickNum(b, ['data.summary.successRate', 'summary.successRate', 'successRate']),
    totalOps,
    errorCount: pickNum(b, ['data.summary.failureCount', 'summary.failureCount', 'errorCount']),
    raw: r.error ? { error: r.error } : b.data?.summary || b,
  }
}

function sevFromSignature(sig: string): ErrorSeverity {
  const s = sig.toLowerCase()
  if (/fk_constraint|fatal|crash|unhandled|segfault|boom|econnrefused/.test(s)) return 'critical'
  if (/error|exception|type_error|etimedout|module_not_found/.test(s)) return 'high'
  return 'medium'
}

/**
 * Errors are assembled from two HTTP sources:
 *  - GET /api/system/status   → recent error rows (last 6h) + recommendations
 *  - GET /api/system/watchers/status → if a watcher heartbeat is stale, synth a 'watcher-down'
 * `sinceMs` is the agent's high-water mark; only newer rows are emitted.
 */
export async function collectErrors(
  base: string,
  sinceMs: number,
  watcherStaleSec: number,
  nowMs: number,
): Promise<ErrorsPayload> {
  const events: ErrorEvent[] = []
  let watermark = sinceMs

  const status = await fetchJson(`${base}/api/system/status`)
  // shape: { errors: { recent: [...], analysis: {...} } }
  const recent: any[] = status.body?.errors?.recent || status.body?.recentErrors || []
  for (const e of Array.isArray(recent) ? recent : []) {
    const occurredAt =
      num(e.timestamp) ?? (e.timestamp ? Date.parse(e.timestamp) : undefined) ?? num(e.detectedAt) ?? nowMs
    if (occurredAt <= sinceMs) continue
    const signature = String(e.signature || e.kind || e.type || e.message || 'error').slice(0, 120)
    events.push({
      source: 'error-watch',
      signature,
      severity: (e.severity as ErrorSeverity) || sevFromSignature(signature),
      sample: String(e.sample || e.message || e.detail || '').slice(0, 400),
      occurredAt,
      raw: e,
    })
    if (occurredAt > watermark) watermark = occurredAt
  }

  const watchers = await fetchJson(`${base}/api/system/watchers/status`)
  // shape: { success, now, sdr:{alive,lastEventAt,...}, shure:{...}, atlas:{...} } — keyed by name.
  // Events are SPARSE (atlas can legitimately go hours between events), so 'down' is driven by
  // `alive===false`, NOT heartbeat age. watcherStaleSec is reserved for watchers that expose a
  // real heartbeat timestamp (none do today).
  const wbody = watchers.body || {}
  for (const [name, w] of Object.entries<any>(wbody)) {
    if (name === 'success' || name === 'now' || w == null || typeof w !== 'object') continue
    if (w.alive === false || w.status === 'down' || w.healthy === false) {
      events.push({
        source: 'watcher-down',
        signature: `watcher_down:${name}`,
        severity: 'high',
        sample: `Watcher "${name}" reports not alive (last event ${w.lastEventAt || '?'})`,
        occurredAt: nowMs,
        raw: w,
      })
    }
  }
  void watcherStaleSec // reserved; see note above

  return { events, watermark }
}
