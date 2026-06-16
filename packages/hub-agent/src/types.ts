/**
 * Shared telemetry contract between the per-location hub-agent and the SBCC hub.
 * Both `packages/hub-agent` (sender) and `apps/hub` (ingest) import these.
 */

export type IngestKind = 'health' | 'metrics' | 'scheduler' | 'errors'

/** Every POST to the hub is one of these, JSON-stringified then HMAC-signed. */
export interface IngestEnvelope<T = unknown> {
  locationId: string
  kind: IngestKind
  sentAt: number // unix ms
  agentVersion: string
  payload: T
}

export type OverallStatus = 'healthy' | 'degraded' | 'critical' | 'unknown'

export interface HealthPayload {
  overallStatus: OverallStatus
  httpStatus: number
  version?: string
  devicesOnline?: number
  devicesTotal?: number
  errorRate?: number
  raw: unknown // trimmed /api/health body, for the detail view
}

export interface MetricsPayload {
  cpuUsagePct?: number
  memUsedPct?: number
  diskUsedPct?: number
  uptimeSec?: number
  raw: unknown
}

export interface SchedulerPayload {
  isRunning?: boolean
  successRate?: number
  totalOps?: number
  errorCount?: number
  raw: unknown
}

/** Where a fleet error originated. 'watcher-down' is synthesized by the agent. */
export type ErrorSource =
  | 'error-watch'
  | 'atlas-drop'
  | 'atlas-priority'
  | 'shure-rf'
  | 'sdr'
  | 'watcher-down'
  | 'health'

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface ErrorEvent {
  source: ErrorSource
  signature: string
  severity: ErrorSeverity
  sample: string
  occurredAt: number // unix ms
  raw?: unknown
}

export interface ErrorsPayload {
  events: ErrorEvent[]
  /** newest occurredAt the agent has now reported; it resumes from here next poll */
  watermark: number
}

export interface AgentConfig {
  hubUrl: string // e.g. http://hub:3010
  locationId: string // e.g. holmgren-way
  hubAgentSecret: string
  localApiUrl: string // e.g. http://localhost:3001
  fastIntervalMs: number // health + metrics + errors
  slowIntervalMs: number // scheduler
  /** seconds a watcher heartbeat may lag before we emit a 'watcher-down' error */
  watcherStaleSec: number
}

/** HTTP headers the agent sets and the hub verifies. */
export const SIG_HEADER = 'x-sbcc-signature'
export const LOCATION_HEADER = 'x-sbcc-location'
export const TIMESTAMP_HEADER = 'x-sbcc-timestamp'
