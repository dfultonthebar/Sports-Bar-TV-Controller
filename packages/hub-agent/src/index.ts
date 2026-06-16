#!/usr/bin/env node
/**
 * SBCC hub-agent — per-location telemetry sidecar (PM2).
 * Polls local HTTP APIs, HMAC-signs, POSTs to the hub.
 *
 *   sbcc-hub-agent              # run the poll loop forever
 *   sbcc-hub-agent --once       # one collection cycle then exit
 *   sbcc-hub-agent --dry-run    # collect + print envelopes, do NOT POST (implies safe to run anywhere)
 *
 * Config via env (see AgentConfig): HUB_URL, LOCATION_ID, HUB_AGENT_SECRET,
 * LOCAL_API_URL (default http://localhost:3001), plus optional *_INTERVAL_MS / WATCHER_STALE_SEC.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { collectHealth, collectMetrics, collectScheduler, collectErrors } from './collect.js'
import { signPayload } from './hmac.js'
import {
  type AgentConfig,
  type IngestEnvelope,
  type IngestKind,
  SIG_HEADER,
  LOCATION_HEADER,
  TIMESTAMP_HEADER,
} from './types.js'

const AGENT_VERSION = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const pkg = JSON.parse(readFileSync(resolve(here, '..', 'package.json'), 'utf8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
})()

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const ONCE = args.includes('--once')

function loadConfig(): AgentConfig {
  return {
    hubUrl: process.env.HUB_URL || 'http://localhost:3010',
    locationId: process.env.LOCATION_ID || 'unknown-location',
    hubAgentSecret: process.env.HUB_AGENT_SECRET || '',
    localApiUrl: process.env.LOCAL_API_URL || 'http://localhost:3001',
    fastIntervalMs: Number(process.env.HUB_AGENT_FAST_INTERVAL_MS) || 60_000,
    slowIntervalMs: Number(process.env.HUB_AGENT_SLOW_INTERVAL_MS) || 300_000,
    watcherStaleSec: Number(process.env.HUB_AGENT_WATCHER_STALE_SEC) || 900,
  }
}

function log(msg: string, extra?: unknown) {
  const line = `[hub-agent] ${new Date().toISOString()} ${msg}`
  if (extra !== undefined) console.log(line, typeof extra === 'string' ? extra : JSON.stringify(extra))
  else console.log(line)
}

async function send<T>(cfg: AgentConfig, kind: IngestKind, payload: T): Promise<void> {
  const envelope: IngestEnvelope<T> = {
    locationId: cfg.locationId,
    kind,
    sentAt: Date.now(),
    agentVersion: AGENT_VERSION,
    payload,
  }
  const body = JSON.stringify(envelope)

  if (DRY_RUN) {
    log(`DRY-RUN ${kind} (${body.length}B):`, body.length > 1200 ? body.slice(0, 1200) + '…' : body)
    return
  }
  if (!cfg.hubAgentSecret) {
    log(`skip ${kind}: HUB_AGENT_SECRET not set`)
    return
  }
  const ts = envelope.sentAt
  const sig = signPayload(cfg.hubAgentSecret, ts, body)
  try {
    const res = await fetch(`${cfg.hubUrl}/api/ingest/${kind}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [SIG_HEADER]: sig,
        [LOCATION_HEADER]: cfg.locationId,
        [TIMESTAMP_HEADER]: String(ts),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) log(`POST ${kind} -> HTTP ${res.status}`)
  } catch (e: any) {
    log(`POST ${kind} failed: ${e?.message || e}`)
  }
}

// agent-process error high-water mark (in-memory; resets on restart, which is fine —
// the hub dedups by (location, source, signature, occurredAt))
let errorWatermark = Date.now() - 6 * 60 * 60_000 // first run: look back 6h

async function fastCycle(cfg: AgentConfig) {
  const now = Date.now()
  const [health, metrics, errors] = await Promise.all([
    collectHealth(cfg.localApiUrl),
    collectMetrics(cfg.localApiUrl),
    collectErrors(cfg.localApiUrl, errorWatermark, cfg.watcherStaleSec, now),
  ])
  await send(cfg, 'health', health)
  await send(cfg, 'metrics', metrics)
  if (errors.events.length) {
    await send(cfg, 'errors', errors)
    errorWatermark = errors.watermark
  } else {
    log(`no new errors (watermark ${new Date(errorWatermark).toISOString()})`)
  }
}

async function slowCycle(cfg: AgentConfig) {
  const scheduler = await collectScheduler(cfg.localApiUrl)
  await send(cfg, 'scheduler', scheduler)
}

async function main() {
  const cfg = loadConfig()
  log(`start v${AGENT_VERSION} location=${cfg.locationId} hub=${cfg.hubUrl} local=${cfg.localApiUrl}${DRY_RUN ? ' [DRY-RUN]' : ''}`)

  await fastCycle(cfg)
  await slowCycle(cfg)
  if (ONCE) {
    log('done (--once)')
    return
  }

  setInterval(() => fastCycle(cfg).catch((e) => log('fastCycle error', String(e))), cfg.fastIntervalMs)
  setInterval(() => slowCycle(cfg).catch((e) => log('slowCycle error', String(e))), cfg.slowIntervalMs)
}

main().catch((e) => {
  log('fatal', String(e))
  process.exit(1)
})
