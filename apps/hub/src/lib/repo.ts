/** DB write/read helpers for the hub (better-sqlite3 sync API). */
import { randomUUID } from 'node:crypto'
import { eq, desc, and, gte } from 'drizzle-orm'
import { db, schema } from '../db/index'
import type {
  HealthPayload,
  MetricsPayload,
  SchedulerPayload,
  ErrorEvent,
  UpdateEvent,
} from '@sports-bar/hub-agent/types'

export function getLocation(id: string) {
  return db.select().from(schema.hubLocations).where(eq(schema.hubLocations.id, id)).get()
}

export function listLocations() {
  return db.select().from(schema.hubLocations).all()
}

export function upsertLocation(row: {
  id: string
  name: string
  branch?: string
  timezone?: string
  tailscaleHost?: string
  hmacSecret: string
}) {
  const now = Date.now()
  db.insert(schema.hubLocations)
    .values({ ...row, isActive: true, createdAt: now })
    .onConflictDoUpdate({
      target: schema.hubLocations.id,
      set: {
        name: row.name,
        branch: row.branch,
        timezone: row.timezone,
        tailscaleHost: row.tailscaleHost,
        hmacSecret: row.hmacSecret,
      },
    })
    .run()
  return getLocation(row.id)
}

export function touchLocation(id: string, ts: number) {
  db.update(schema.hubLocations).set({ lastSeenAt: ts }).where(eq(schema.hubLocations.id, id)).run()
}

export function insertHealth(locationId: string, ts: number, p: HealthPayload) {
  db.insert(schema.healthSnapshots)
    .values({
      id: randomUUID(),
      locationId,
      ts,
      overallStatus: p.overallStatus,
      httpStatus: p.httpStatus,
      devicesOnline: p.devicesOnline,
      devicesTotal: p.devicesTotal,
      errorRate: p.errorRate,
      version: p.version ?? null,
      rawPayload: JSON.stringify(p.raw ?? null),
    })
    .run()
}

export function insertMetrics(locationId: string, ts: number, p: MetricsPayload) {
  db.insert(schema.metricsSnapshots)
    .values({
      id: randomUUID(),
      locationId,
      ts,
      cpuUsagePct: p.cpuUsagePct,
      memUsedPct: p.memUsedPct,
      diskUsedPct: p.diskUsedPct,
      uptimeSec: p.uptimeSec,
      rawPayload: JSON.stringify(p.raw ?? null),
    })
    .run()
}

export function insertScheduler(locationId: string, ts: number, p: SchedulerPayload) {
  db.insert(schema.schedulerSnapshots)
    .values({
      id: randomUUID(),
      locationId,
      ts,
      isRunning: p.isRunning,
      successRate: p.successRate,
      totalOps: p.totalOps,
      errorCount: p.errorCount,
      rawPayload: JSON.stringify(p.raw ?? null),
    })
    .run()
}

/** Insert error events; the (location,source,signature,occurredAt) unique index dedups resends. */
export function insertErrors(locationId: string, events: ErrorEvent[]): number {
  const now = Date.now()
  let inserted = 0
  for (const e of events) {
    const res = db
      .insert(schema.errorEvents)
      .values({
        id: randomUUID(),
        locationId,
        occurredAt: e.occurredAt,
        receivedAt: now,
        source: e.source,
        signature: e.signature,
        severity: e.severity,
        sample: e.sample,
        rawPayload: JSON.stringify(e.raw ?? null),
      })
      .onConflictDoNothing()
      .run()
    inserted += res.changes
  }
  return inserted
}

/** Insert fleet auto-update outcomes (kind:'update'). Dedups on (location, runId). */
export function insertFleetUpdate(locationId: string, events: UpdateEvent[]): number {
  const now = Date.now()
  let inserted = 0
  for (const e of events) {
    const res = db
      .insert(schema.fleetUpdateEvents)
      .values({
        id: randomUUID(),
        locationId,
        runId: e.runId,
        occurredAt: e.occurredAt,
        receivedAt: now,
        result: e.result,
        fromVersion: e.fromVersion ?? null,
        toVersion: e.toVersion ?? null,
        fromSha: e.fromSha ?? null,
        toSha: e.toSha ?? null,
        durationSecs: e.durationSecs ?? null,
        rollbackTag: e.rollbackTag ?? null,
        conflictPaths: e.conflictPaths ? JSON.stringify(e.conflictPaths) : null,
        triggeredBy: e.triggeredBy ?? null,
        errorMessage: e.errorMessage ?? null,
        rawPayload: JSON.stringify(e.raw ?? null),
      })
      .onConflictDoNothing()
      .run()
    inserted += res.changes
  }
  return inserted
}

/** Most-recent health snapshot per location (for the dashboard cards). */
export function latestHealthByLocation() {
  const rows = db.select().from(schema.healthSnapshots).orderBy(desc(schema.healthSnapshots.ts)).all()
  const seen = new Map<string, (typeof rows)[number]>()
  for (const r of rows) if (!seen.has(r.locationId)) seen.set(r.locationId, r)
  return seen
}

export function latestMetricsByLocation() {
  const rows = db.select().from(schema.metricsSnapshots).orderBy(desc(schema.metricsSnapshots.ts)).all()
  const seen = new Map<string, (typeof rows)[number]>()
  for (const r of rows) if (!seen.has(r.locationId)) seen.set(r.locationId, r)
  return seen
}

const latestOf = (table: any, col: any, locationId: string) =>
  db.select().from(table).where(eq(col, locationId)).orderBy(desc(table.ts)).limit(1).get()

export const latestHealth = (id: string) => latestOf(schema.healthSnapshots, schema.healthSnapshots.locationId, id)
export const latestMetrics = (id: string) => latestOf(schema.metricsSnapshots, schema.metricsSnapshots.locationId, id)
export const latestScheduler = (id: string) =>
  latestOf(schema.schedulerSnapshots, schema.schedulerSnapshots.locationId, id)

/** The single pinned fleet target (row id 1), or null if never set. */
export function getFleetTarget() {
  return db.select().from(schema.fleetTarget).where(eq(schema.fleetTarget.id, 1)).get()
}

/** Pin the desired fleet version. Upserts the singleton row. */
export function setFleetTarget(targetVersion: string, targetSha: string | null, setBy: string) {
  const now = Date.now()
  db.insert(schema.fleetTarget)
    .values({ id: 1, targetVersion, targetSha, setBy, setAt: now })
    .onConflictDoUpdate({
      target: schema.fleetTarget.id,
      set: { targetVersion, targetSha, setBy, setAt: now },
    })
    .run()
  return getFleetTarget()
}

// ---------------------------------------------------------------------------
// Rollout state machine (Phase 2). See the schema.ts doc comment on
// `rollouts` for why this tracks/detects rather than executes.
// ---------------------------------------------------------------------------

export function createRollout(input: {
  targetVersion: string
  targetSha?: string | null
  canaryLocationId: string
  minSoakMinutes?: number
  createdBy?: string
  waveLocationIds: string[]
}) {
  const now = Date.now()
  const id = randomUUID()
  db.insert(schema.rollouts)
    .values({
      id,
      targetVersion: input.targetVersion,
      targetSha: input.targetSha ?? null,
      canaryLocationId: input.canaryLocationId,
      minSoakMinutes: input.minSoakMinutes ?? 30,
      status: 'pending',
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run()
  for (const locationId of input.waveLocationIds) {
    db.insert(schema.rolloutBoxes)
      .values({ id: randomUUID(), rolloutId: id, locationId, state: 'pending' })
      .run()
  }
  return getRollout(id)
}

export function getRollout(id: string) {
  return db.select().from(schema.rollouts).where(eq(schema.rollouts.id, id)).get()
}

export function listRollouts(limit = 20) {
  return db.select().from(schema.rollouts).orderBy(desc(schema.rollouts.createdAt)).limit(limit).all()
}

export function getRolloutBoxes(rolloutId: string) {
  return db.select().from(schema.rolloutBoxes).where(eq(schema.rolloutBoxes.rolloutId, rolloutId)).all()
}

export function updateRollout(id: string, patch: Partial<typeof schema.rollouts.$inferInsert>) {
  db.update(schema.rollouts)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(schema.rollouts.id, id))
    .run()
  return getRollout(id)
}

export function updateRolloutBox(id: string, patch: Partial<typeof schema.rolloutBoxes.$inferInsert>) {
  db.update(schema.rolloutBoxes).set(patch).where(eq(schema.rolloutBoxes.id, id)).run()
}

/** Most recent fleet_update_events row for a location at/after `sinceMs` reporting `toVersion`. */
export function findUpdateEventSince(locationId: string, sinceMs: number, toVersion: string) {
  return db
    .select()
    .from(schema.fleetUpdateEvents)
    .where(
      and(
        eq(schema.fleetUpdateEvents.locationId, locationId),
        gte(schema.fleetUpdateEvents.occurredAt, sinceMs),
        eq(schema.fleetUpdateEvents.toVersion, toVersion),
      ),
    )
    .orderBy(desc(schema.fleetUpdateEvents.occurredAt))
    .get()
}

/** Open error feed across the fleet, newest first. */
export function recentErrors(sinceMs: number, locationId?: string) {
  const conds = [gte(schema.errorEvents.occurredAt, sinceMs)]
  if (locationId) conds.push(eq(schema.errorEvents.locationId, locationId))
  return db
    .select()
    .from(schema.errorEvents)
    .where(and(...conds))
    .orderBy(desc(schema.errorEvents.occurredAt))
    .limit(500)
    .all()
}
