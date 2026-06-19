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
  UpdateEvent,
  UpdateResult,
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
    // A watcher with zero evidence of ever running (no events, no startup row, no 24h count)
    // is hardware-not-present at this location — NOT "down". Only Holmgren has an SDR dongle,
    // so SDR reports alive:false everywhere else; flagging that floods the feed with false
    // watcher_down:sdr. Same guard covers any optional-hardware watcher (Shure, etc.). A real
    // down — a watcher that ran before but is now stale — keeps a non-null lastEventAt.
    const everRan =
      w.lastEventAt != null ||
      w.lastStartupAt != null ||
      (typeof w.eventCount24h === 'number' && w.eventCount24h > 0)
    const down = w.alive === false || w.status === 'down' || w.healthy === false
    if (down && everRan) {
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

interface UpdatesResult {
  events: UpdateEvent[]
  /** newest run occurredAt the agent has reported; it resumes from here next poll */
  watermark: number
}

/** Map a parsed auto-update run's outcome onto the hub's UpdateResult enum. */
function mapUpdateResult(run: any): UpdateResult {
  if (run.finalResult === 'success') return 'success'
  if (run.rollbackTag) return 'rollback'
  const failed = String(run.failedStep || '').toLowerCase()
  if (/merge|conflict/.test(failed)) return 'conflict'
  if (run.finalResult === 'fail') return 'failed'
  return 'skipped'
}

/**
 * Auto-update outcomes come from GET /api/auto-update/runs (log-parsed, unauthenticated
 * on localhost — same access model as the other collectors; the DB-backed status route
 * needs ADMIN auth the agent doesn't carry). Only FINISHED runs newer than `sinceMs` are
 * emitted; an in-progress run (no finish timestamp) is skipped and picked up next cycle.
 * The hub dedups on (location, runId), so a resend after restart is harmless.
 */
export async function collectUpdates(base: string, sinceMs: number): Promise<UpdatesResult> {
  const events: UpdateEvent[] = []
  let watermark = sinceMs

  const r = await fetchJson(`${base}/api/auto-update/runs?limit=50`)
  const runs: any[] = Array.isArray(r.body?.runs) ? r.body.runs : []
  for (const run of runs) {
    // skip still-running rows: no finish timestamp and no terminal result yet
    if (run.finishedUnix == null && run.finalResult === 'unknown') continue
    const finishedUnix = run.finishedUnix ?? run.startedUnix
    if (!finishedUnix) continue
    const occurredAt = finishedUnix * 1000
    if (occurredAt <= sinceMs) continue

    const result = mapUpdateResult(run)
    const errorMessage =
      result === 'failed' || result === 'conflict'
        ? [
            run.failedStep ? `FAIL at step '${run.failedStep}'` : null,
            run.verifyInstallStatus === 'FAIL' ? 'verify-install FAIL' : null,
          ]
            .filter(Boolean)
            .join('; ') || undefined
        : undefined

    events.push({
      runId: String(run.id),
      occurredAt,
      result,
      fromVersion: run.preMergeVersion || undefined,
      toVersion: run.postMergeVersion || run.preMergeVersion || undefined,
      fromSha: run.preMergeSha || undefined,
      toSha: run.postMergeSha || undefined,
      durationSecs: run.totalDurationMs != null ? Math.round(run.totalDurationMs / 1000) : undefined,
      // auto-update.sh tags a safety-net rollback point at the START of every run, so a
      // tag exists even on success; only surface it when a rollback actually happened.
      rollbackTag: result === 'rollback' ? run.rollbackTag || undefined : undefined,
      triggeredBy: run.triggeredBy || undefined,
      errorMessage,
      raw: {
        checkpoints: Array.isArray(run.checkpoints)
          ? run.checkpoints.map((c: any) => ({ name: c.name, decision: c.decision, reason: c.reason }))
          : undefined,
        verifyInstallStatus: run.verifyInstallStatus,
        failedStep: run.failedStep,
        steps: Array.isArray(run.steps) ? run.steps.length : undefined,
      },
    })
    if (occurredAt > watermark) watermark = occurredAt
  }

  return { events, watermark }
}
