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
    // App version reported by /api/health (HealthPayload.version). Was only
    // buried in rawPayload JSON — promoted to a real column so the fleet
    // target/drift view can query "actual vs target" per location cheaply.
    version: text('version'),
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

/** Fleet auto-update outcomes — one row per auto-update.sh run, reported by the agent. */
export const fleetUpdateEvents = sqliteTable(
  'fleet_update_events',
  {
    id: text('id').primaryKey(),
    locationId: text('location_id').notNull(),
    runId: text('run_id').notNull(),
    occurredAt: integer('occurred_at').notNull(), // unix ms (run finished)
    receivedAt: integer('received_at').notNull(), // unix ms (hub insert)
    result: text('result').notNull(), // success|rollback|conflict|skipped|failed
    fromVersion: text('from_version'),
    toVersion: text('to_version'),
    fromSha: text('from_sha'),
    toSha: text('to_sha'),
    durationSecs: integer('duration_secs'),
    rollbackTag: text('rollback_tag'),
    conflictPaths: text('conflict_paths'), // JSON array
    triggeredBy: text('triggered_by'),
    errorMessage: text('error_message'),
    rawPayload: text('raw_payload'),
  },
  (t) => [
    index('update_loc_ts').on(t.locationId, t.occurredAt),
    // idempotency: same run reported twice (agent restart) collapses.
    uniqueIndex('update_dedup').on(t.locationId, t.runId),
  ],
)

/**
 * Desired fleet version — the missing "target" half of drift detection.
 * `health_snapshots.version` is the ACTUAL version each box last reported;
 * this single-row table is the DESIRED version an operator/rollout pinned.
 * The hub overview diffs actual vs target per location. Superseded in scope
 * (not storage) once the P2 rollout controller lands — `rollouts` will carry
 * its own target_version per rollout, but this table remains the simple
 * always-current "what SHOULD every box be on" pin for the plain drift view.
 */
export const fleetTarget = sqliteTable('fleet_target', {
  id: integer('id').primaryKey(), // always row 1 — singleton
  targetVersion: text('target_version').notNull(),
  targetSha: text('target_sha'),
  setBy: text('set_by'), // operator/script identity, freeform
  setAt: integer('set_at').notNull(), // unix ms
})

/**
 * Staged rollout state machine (Phase 2 of the fleet-update redesign).
 *
 * IMPORTANT — the hub has NO SSH access to the fleet or to Hermes/CT212
 * (verified 2026-07-01: key auth rejected both hops). This is intentional —
 * the hub stays a read-only telemetry sink, consistent with its existing
 * design. So this state machine does NOT execute anything itself. It:
 *   1. Tracks desired state (which locations, what target, canary-first).
 *   2. Detects PROGRESS purely from telemetry it already receives
 *      (fleet_update_events + health_snapshots — zero new plumbing).
 *   3. Exposes an explicit "next action" (e.g. "trigger canary on leg-lamp")
 *      that an external executor — Hermes (has working fleet SSH via
 *      fleet-deploy.sh) or an operator by hand — performs, then reports back
 *      via ackAction. This makes the dashboard useful immediately even
 *      before any Hermes-side automation polls it.
 */
export const rollouts = sqliteTable('rollouts', {
  id: text('id').primaryKey(),
  targetVersion: text('target_version').notNull(),
  targetSha: text('target_sha'),
  canaryLocationId: text('canary_location_id').notNull(),
  minSoakMinutes: integer('min_soak_minutes').notNull().default(30),
  // pending -> canary_triggered -> canary_soaking -> waving -> converged
  //                             \-> canary_failed              \-> partial_failure
  // aborted reachable from any non-terminal state via POST /abort.
  status: text('status').notNull().default('pending'),
  canaryTriggeredAt: integer('canary_triggered_at'),
  canarySuccessAt: integer('canary_success_at'), // when it reported target-version success — soak clock starts here
  waveTriggeredAt: integer('wave_triggered_at'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

/** One row per non-canary location tracked by a rollout. */
export const rolloutBoxes = sqliteTable(
  'rollout_boxes',
  {
    id: text('id').primaryKey(),
    rolloutId: text('rollout_id').notNull(),
    locationId: text('location_id').notNull(),
    // pending -> triggered -> success | rolled_back | failed | timeout
    state: text('state').notNull().default('pending'),
    triggeredAt: integer('triggered_at'),
    resolvedAt: integer('resolved_at'),
    note: text('note'),
  },
  (t) => [index('rollout_boxes_rollout').on(t.rolloutId)],
)

/**
 * Central ESPN game-data cache (Feature B1). The hub runs the 26-league ESPN
 * sync ONCE and stores each league's raw ESPNGame[] as JSON here; locations pull
 * from `/api/game-data/espn` and run their existing syncLeague() over the games,
 * so the per-location DB write-path is byte-identical to a direct ESPN fetch.
 * One row per `${sport}-${league}`.
 */
export const espnCache = sqliteTable('espn_cache', {
  leagueKey: text('league_key').primaryKey(), // `${sport}-${league}`
  sport: text('sport').notNull(),
  league: text('league').notNull(),
  gamesJson: text('games_json').notNull(), // raw ESPNGame[] as JSON
  gameCount: integer('game_count').notNull(),
  updatedAt: integer('updated_at').notNull(), // unix ms of last successful sync
})
