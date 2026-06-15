/**
 * SBCC hub time-series schema (its OWN SQLite, separate from any location's production.db).
 * Receives what `@sports-bar/hub-agent` sends (see that package's types.ts contract).
 * 30-day retention; a daily cleanup job trims snapshots/errors older than that.
 */
import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

/** One row per registered location. */
export const hubLocations = sqliteTable('hub_locations', {
  id: text('id').primaryKey(), // e.g. holmgren-way
  name: text('name').notNull(),
  branch: text('branch'), // location/<name>
  timezone: text('timezone'),
  tailscaleHost: text('tailscale_host'), // for live per-location reads (Phase B)
  hmacSecret: text('hmac_secret').notNull(), // shared per-location agent secret
  lastSeenAt: integer('last_seen_at'), // unix ms of most recent ingest
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  metadata: text('metadata'), // JSON blob
  createdAt: integer('created_at').notNull(),
})

export const healthSnapshots = sqliteTable(
  'health_snapshots',
  {
    id: text('id').primaryKey(),
    locationId: text('location_id').notNull(),
    ts: integer('ts').notNull(), // unix ms (sentAt)
    overallStatus: text('overall_status').notNull(), // healthy|degraded|critical|unknown
    httpStatus: integer('http_status'),
    devicesOnline: integer('devices_online'),
    devicesTotal: integer('devices_total'),
    errorRate: real('error_rate'),
    rawPayload: text('raw_payload'), // JSON
  },
  (t) => [index('health_loc_ts').on(t.locationId, t.ts)],
)

export const metricsSnapshots = sqliteTable(
  'metrics_snapshots',
  {
    id: text('id').primaryKey(),
    locationId: text('location_id').notNull(),
    ts: integer('ts').notNull(),
    cpuUsagePct: real('cpu_usage_pct'),
    memUsedPct: real('mem_used_pct'),
    diskUsedPct: real('disk_used_pct'),
    uptimeSec: real('uptime_sec'),
    rawPayload: text('raw_payload'),
  },
  (t) => [index('metrics_loc_ts').on(t.locationId, t.ts)],
)

export const schedulerSnapshots = sqliteTable(
  'scheduler_snapshots',
  {
    id: text('id').primaryKey(),
    locationId: text('location_id').notNull(),
    ts: integer('ts').notNull(),
    isRunning: integer('is_running', { mode: 'boolean' }),
    successRate: real('success_rate'),
    totalOps: integer('total_ops'),
    errorCount: integer('error_count'),
    rawPayload: text('raw_payload'),
  },
  (t) => [index('scheduler_loc_ts').on(t.locationId, t.ts)],
)

/** The central error feed — error-watch + atlas/shure/sdr + synthesized watcher-down. */
export const errorEvents = sqliteTable(
  'error_events',
  {
    id: text('id').primaryKey(),
    locationId: text('location_id').notNull(),
    occurredAt: integer('occurred_at').notNull(), // unix ms (source timestamp)
    receivedAt: integer('received_at').notNull(), // unix ms (hub insert time)
    source: text('source').notNull(), // error-watch|atlas-drop|atlas-priority|shure-rf|sdr|watcher-down|health
    signature: text('signature').notNull(),
    severity: text('severity').notNull(), // critical|high|medium|low|info
    sample: text('sample'),
    rawPayload: text('raw_payload'),
  },
  (t) => [
    index('error_loc_ts').on(t.locationId, t.occurredAt),
    // idempotency: the agent may resend a row across restarts; the same event collapses.
    uniqueIndex('error_dedup').on(t.locationId, t.source, t.signature, t.occurredAt),
  ],
)
