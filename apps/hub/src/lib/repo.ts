/** DB write/read helpers for the hub (better-sqlite3 sync API). */
import { randomUUID } from 'node:crypto'
import { eq, desc, and, gte } from 'drizzle-orm'
import { db, schema } from '../db/index'
import type {
  HealthPayload,
  MetricsPayload,
  SchedulerPayload,
  ErrorEvent,
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
